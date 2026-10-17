import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  OSM_POWER_LINES_GLOW_LAYER_ID,
  osmPowerLinesGlowModule,
  mountLazyCustomLayer,
  removeLazyCustomLayer,
} from "../map/lazyThreeLayers";
import type { PowerLineFeature } from "../three/OsmPowerLinesGlowScene";
import { fetchOsmPowerLines, powerLineTierKv } from "../data/energyLoader";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * Three.js bloom glow layer 取代 Mapbox 4-line stacking 的視覺方案。
 * 共用既有的 osmPowerLines visibility + opacity + width slider。
 */
export function useOsmPowerLinesGlowLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  widthMul: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const featuresRef = useRef<PowerLineFeature[] | null>(null);
  const visibleRef = useRef(visible);
  const opacityRef = useRef(opacity);
  const widthRef = useRef(widthMul);
  visibleRef.current = visible;
  opacityRef.current = opacity;
  widthRef.current = widthMul;

  // Mount custom layer — try/catch + idle retry pattern
  // ⚠️ 不要用 isStyleLoaded() 守，因為 style.load 已 fire 過不會再 fire
  // 參考 usePowerGenerationBeamLayer 同 pattern（.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.log("[osmPowerLinesGlow] mount: mapRef null，等下次 deps 變化");
      return;
    }
    const tryMount = () => {
      // R6 段 1：不可見（含「立體效果」關）時不掛 Three 層；cleanup 已在 visible 變動時移除
      if (!visibleRef.current) return;
      if (map.getLayer(OSM_POWER_LINES_GLOW_LAYER_ID)) return;
      try {
        // C1b：three 模組第一次可見才載入；錨點佔住原位置
        mountLazyCustomLayer(map, OSM_POWER_LINES_GLOW_LAYER_ID, osmPowerLinesGlowModule, (m) => m.createOsmPowerLinesGlowLayer({
          getIsVisible: () => visibleRef.current,
          getOpacity:   () => opacityRef.current,
          getWidthMul:  () => widthRef.current,
          getFeatures:  () => featuresRef.current,
        }), () => visibleRef.current);
      } catch (e) {
        console.log("[osmPowerLinesGlow] addLayer 失敗 → idle 重試", e);
        map.once("idle", tryMount);
      }
    };
    tryMount();
    map.on("style.load", tryMount);
    return () => {
      map.off("style.load", tryMount);
      try {
        removeLazyCustomLayer(map, OSM_POWER_LINES_GLOW_LAYER_ID);
      } catch { /* map 可能已銷毀 */ }
    };
  }, [mapRef, visible, mapTick]);

  // Lazy fetch lines when first visible
  useEffect(() => {
    if (!visible || featuresRef.current) return;
    let cancelled = false;
    fetchOsmPowerLines()
      .then((rows) => {
        if (cancelled) return;
        const features: PowerLineFeature[] = [];
        let skippedNoGeom = 0, skippedType = 0;
        for (const r of rows) {
          const geom = r.geom_json as GeoJSON.LineString | string | null;
          if (!geom) { skippedNoGeom++; continue; }
          let parsed: GeoJSON.LineString | null = null;
          if (typeof geom === "string") {
            try { parsed = JSON.parse(geom) as GeoJSON.LineString; } catch { skippedType++; continue; }
          } else {
            parsed = geom;
          }
          if (!parsed || parsed.type !== "LineString") { skippedType++; continue; }
          const tier = powerLineTierKv(r.voltage);
          features.push({
            coords: parsed.coordinates as [number, number][],
            tier,
          });
        }
        console.log("[osmPowerLinesGlow] fetch:", rows.length, "rows →", features.length, "features (skipped noGeom:", skippedNoGeom, "badType:", skippedType, ")");
        featuresRef.current = features;
        mapRef.current?.triggerRepaint();
      })
      .catch((err) => console.warn("[osmPowerLinesGlow] fetch failed:", err));
    return () => { cancelled = true; };
  }, [visible, mapRef, mapTick]);

  // Param change → repaint
  useEffect(() => {
    mapRef.current?.triggerRepaint();
  }, [visible, opacity, widthMul, mapRef, mapTick]);
}
