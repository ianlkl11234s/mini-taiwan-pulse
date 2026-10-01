import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";
import { useMapReadyTick } from "./useMapReadyTick";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";

/**
 * 民航局 dronegis 歷史空域參考面 — 5,741 Polygon + 2 MultiPolygon 共用 PMTiles，filter 拆兩 layer
 *
 * 資料來源：
 *   taipei-gis-analytics/pipelines/aviation_drone/drone_restricted_zones/
 *   → /public/coverage/drone_restricted_zones.pmtiles（11 MB，z 5-14）
 *
 * 拆分：
 *   🚫 droneNoFlyZone     2026-06-30 快照：紅 4,311 + 未分類 1,324 = 5,635（不判定當前規則）
 *   ⚠️  droneRestrictedZone 2026-06-30 快照黃 108（不判定當前申請規則）
 *
 * 未分類併紅色顯示只因 __source = nfz 的中文「空域顏色」缺值；
 * 顏色與歷史幾何不能作現行飛行規則判定。
 */

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

let sourceTypeRegistered = false;
function registerSourceTypeOnce() {
  if (sourceTypeRegistered) return;
  sourceTypeRegistered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (t: string, impl: unknown) => void };
    }).Style;
    Style.setSourceType(SOURCE_TYPE, PmTilesSource);
  } catch {
    // 其他 PMTiles factory 已註冊過
  }
}

const BASE = `${import.meta.env.BASE_URL ?? "/"}coverage`;
const SOURCE_ID = "drone-restricted-zones";
const SOURCE_LAYER = "drone_restricted_zones";

const NFZ_FILL = "drone-nfz-fill";
const NFZ_LINE = "drone-nfz-line";
const RESTRICTED_FILL = "drone-restricted-fill";
const RESTRICTED_LINE = "drone-restricted-line";

// 紅 + 未分類（無 空域顏色 欄位）
const NFZ_FILTER: FilterSpecification = [
  "any",
  ["==", ["get", "空域顏色"], "紅區"],
  ["!", ["has", "空域顏色"]],
] as unknown as FilterSpecification;

// 黃
const RESTRICTED_FILTER: FilterSpecification = [
  "==", ["get", "空域顏色"], "黃區",
] as unknown as FilterSpecification;

const NFZ_COLOR = "#DC3545";
const RESTRICTED_COLOR = "#FFC107";

function setVis(map: MapboxMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}

function safeIsStyleLoaded(map: MapboxMap): boolean {
  try { return map.isStyleLoaded(); } catch { return false; }
}

export function useDroneZonesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  nfzVisible: boolean,
  restrictedVisible: boolean,
  nfzOpacity: number,
  restrictedOpacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);

  useEffect(() => {
    const anyVisible = nfzVisible || restrictedVisible;
    let cancelled = false;
    let map: MapboxMap | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayers = (): boolean => {
      map = mapRef.current;
      if (cancelled || !map) return false;
      if (!safeIsStyleLoaded(map)) return false;

      if (!anyVisible) {
        setVis(map, NFZ_FILL, false); setVis(map, NFZ_LINE, false);
        setVis(map, RESTRICTED_FILL, false); setVis(map, RESTRICTED_LINE, false);
        return true;
      }

      registerSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: SOURCE_TYPE,
          url: `${BASE}/drone_restricted_zones.pmtiles`,
          minzoom: 5,
          maxzoom: 14,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }

      const ensureFill = (key: string, id: string, filter: FilterSpecification, color: string, opacity: number) => {
        if (!map?.getLayer(id)) {
          map?.addLayer({
            id,
            type: "fill",
            source: SOURCE_ID,
            "source-layer": SOURCE_LAYER,
            minzoom: 7,
            filter,
            paint: hookFillPaint(key, id, {
              "fill-color": color,
              "fill-opacity": opacity,
              "fill-antialias": false,
            }, { "fill-color": color, "fill-opacity": 0.45, "fill-antialias": false }),
          });
        } else {
          map.setPaintProperty(id, "fill-opacity", hookFillOpacity(key, id, opacity, 0.45));
        }
      };
      const ensureLine = (key: string, id: string, filter: FilterSpecification, color: string, opacity: number) => {
        if (!map?.getLayer(id)) {
          map?.addLayer({
            id,
            type: "line",
            source: SOURCE_ID,
            "source-layer": SOURCE_LAYER,
            minzoom: 8,
            filter,
            layout: hookLineLayout(key, id),
            paint: hookLinePaint(key, id, {
              "line-color": color,
              "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 12, 1.2, 14, 2],
              "line-opacity": Math.min(1, opacity + 0.3),
            }, { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 12, 1.2, 14, 2], "line-opacity": 0.75 }),
          });
        } else {
          map.setPaintProperty(id, "line-opacity", hookLineOpacity(key, id, Math.min(1, opacity + 0.3), 0.75));
        }
      };

      ensureFill("droneNoFlyZone", NFZ_FILL, NFZ_FILTER, NFZ_COLOR, nfzOpacity);
      ensureLine("droneNoFlyZone", NFZ_LINE, NFZ_FILTER, NFZ_COLOR, nfzOpacity);
      ensureFill("droneRestrictedZone", RESTRICTED_FILL, RESTRICTED_FILTER, RESTRICTED_COLOR, restrictedOpacity);
      ensureLine("droneRestrictedZone", RESTRICTED_LINE, RESTRICTED_FILTER, RESTRICTED_COLOR, restrictedOpacity);

      setVis(map, NFZ_FILL, nfzVisible);
      setVis(map, NFZ_LINE, nfzVisible);
      setVis(map, RESTRICTED_FILL, restrictedVisible);
      setVis(map, RESTRICTED_LINE, restrictedVisible);
      console.log("[DroneZones] layers ready", { nfzVisible, restrictedVisible });
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

    const onStyleLoad = () => {
      if (!cancelled) setTimeout(retry, 0);
    };
    // bindTimer 只在圖層可見時建立：偵測 mapRef 換新實例好重綁 style.load，
    // 不可見時沒有畫面需求，等 anyVisible 轉真 effect 會重跑自然重建
    let bindTimer: ReturnType<typeof setInterval> | null = null;
    if (anyVisible) {
      bindTimer = setInterval(() => {
        const nextMap = mapRef.current;
        if (!nextMap || nextMap === map) return;
        map?.off("style.load", onStyleLoad);
        map = nextMap;
        map.on("style.load", onStyleLoad);
        retry();
      }, 200);
    }
    const initialMap = map as MapboxMap | null;
    if (initialMap) initialMap.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      if (bindTimer) clearInterval(bindTimer);
      map?.off("style.load", onStyleLoad);
      try {
        if (map) {
          setVis(map, NFZ_FILL, false); setVis(map, NFZ_LINE, false);
          setVis(map, RESTRICTED_FILL, false); setVis(map, RESTRICTED_LINE, false);
        }
      } catch { /* map 可能已銷毀 */ }
    };
  }, [mapRef, nfzVisible, restrictedVisible, nfzOpacity, restrictedOpacity, mapTick]);
}
