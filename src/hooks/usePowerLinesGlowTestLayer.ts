import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  fetchOsmPowerLines,
  powerLineTierKv,
  type OsmPowerLine,
} from "../data/energyLoader";

/**
 * 高壓輸電線 Bloom 測試 —— 純 Mapbox 4-pass line-blur 疊層版
 *
 * ⚠️ 走純 Mapbox 是因為原生 `useOsmPowerLinesGlowLayer` 已經在 App.tsx 掛了
 * OsmPowerLinesGlowScene 的 Three.js CustomLayer。同一個 Mapbox gl context 不能
 * 塞兩個 THREE.WebGLRenderer（狀態互相污染，第二個渲染不出來）。
 *
 * 這個測試層剛好提供「Mapbox line-blur 疊層」vs「Three.js additive shader」兩種
 * 技法的直接對照。
 *
 * 4 pass：
 *   halo-far   line-blur=14 width=22 α=0.15
 *   halo-mid   line-blur=6  width=10 α=0.28
 *   halo-near  line-blur=2  width=4  α=0.50
 *   core       line-blur=0  width=1.5 α=0.95
 */

const SOURCE_ID = "power-lines-glow-test-src";
const LAYER_IDS = [
  "power-lines-glow-halo-far",
  "power-lines-glow-halo-mid",
  "power-lines-glow-halo-near",
  "power-lines-glow-core",
] as const;

const COLOR_EXPR: ExpressionSpecification = [
  "match", ["get", "tier"],
  345, "#1AB6D9",
  161, "#62D9AD",
  69,  "#468BA6",
  "#DFE0DC",
] as unknown as ExpressionSpecification;

const WIDTH_MUL_FACTOR: ExpressionSpecification = [
  "match", ["get", "tier"],
  345, 1.3,
  161, 1.0,
  69,  0.75,
  0.6,
] as unknown as ExpressionSpecification;

function toFc(rows: OsmPowerLine[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    const geom = r.geom_json as GeoJSON.LineString | string | null;
    if (!geom) continue;
    let parsed: GeoJSON.LineString | null = null;
    if (typeof geom === "string") {
      try { parsed = JSON.parse(geom) as GeoJSON.LineString; } catch { continue; }
    } else {
      parsed = geom;
    }
    if (!parsed || parsed.type !== "LineString") continue;
    features.push({
      type: "Feature",
      geometry: parsed,
      properties: { tier: powerLineTierKv(r.voltage) },
    });
  }
  return { type: "FeatureCollection", features };
}

function setVis(map: MapboxMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}
function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

export function usePowerLinesGlowTestLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  widthMul: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // 拉一次資料
  useEffect(() => {
    if (!visible || fcRef.current) return;
    let cancelled = false;
    fetchOsmPowerLines()
      .then((rows) => {
        if (cancelled) return;
        const fc = toFc(rows);
        console.log(`[PowerLinesGlowTest] toFc: ${rows.length} rows → ${fc.features.length} features`);
        fcRef.current = fc;
        const map = mapRef.current;
        if (map) {
          const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          if (src) src.setData(fc);
        }
      })
      .catch((err) => console.warn("[PowerLinesGlowTest] fetch failed:", err));
    return () => { cancelled = true; };
  }, [visible, mapRef, mapTick]);

  useEffect(() => {
    let cancelled = false;
    let map: MapboxMap | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayers = (): boolean => {
      map = mapRef.current;
      if (cancelled || !map) return false;
      if (!safeIsStyleLoaded(map)) return false;

      if (!visible) {
        for (const id of LAYER_IDS) setVis(map, id, false);
        return true;
      }

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: fcRef.current ?? { type: "FeatureCollection", features: [] },
        });
      } else if (fcRef.current) {
        const src = map.getSource(SOURCE_ID) as GeoJSONSource;
        src.setData(fcRef.current);
      }

      const passes: Array<[string, number, number, number]> = [
        ["halo-far",  14, 22, 0.15],
        ["halo-mid",   6, 10, 0.28],
        ["halo-near",  2,  4, 0.50],
        ["core",       0,  1.5, 0.95],
      ];
      for (const [suffix, blur, width, alpha] of passes) {
        const id = `power-lines-glow-${suffix}`;
        const paintOpacity = Math.min(1, alpha * opacity);
        const paintWidth: ExpressionSpecification = [
          "*", width * widthMul, WIDTH_MUL_FACTOR,
        ] as unknown as ExpressionSpecification;
        if (!map.getLayer(id)) {
          map.addLayer({
            id,
            type: "line",
            source: SOURCE_ID,
            paint: {
              "line-color": COLOR_EXPR,
              "line-width": paintWidth,
              "line-blur": blur,
              "line-opacity": paintOpacity,
            },
          });
        } else {
          map.setPaintProperty(id, "line-opacity", paintOpacity);
          map.setPaintProperty(id, "line-width", paintWidth);
        }
      }

      for (const id of LAYER_IDS) setVis(map, id, visible);
      console.log("[PowerLinesGlowTest] Mapbox stacked layers ready");
      return true;
    };

    const retry = () => {
      if (ensureLayers() && retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    };
    retry();
    if (!map || !safeIsStyleLoaded(map)) retryTimer = setInterval(retry, 200);
    const onStyleLoad = () => { if (!cancelled) setTimeout(retry, 0); };
    const bindTimer = setInterval(() => {
      const nextMap = mapRef.current;
      if (!nextMap || nextMap === map) return;
      map?.off("style.load", onStyleLoad);
      map = nextMap;
      map.on("style.load", onStyleLoad);
      retry();
    }, 200);
    const initialMap = map as MapboxMap | null;
    if (initialMap) initialMap.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      clearInterval(bindTimer);
      map?.off("style.load", onStyleLoad);
      if (map) for (const id of LAYER_IDS) setVis(map, id, false);
    };
  }, [mapRef, visible, opacity, widthMul, mapTick]);
}
