import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  GeoJSONSource,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchIotWraStructureLatest,
  type IotWraLatestRow,
} from "../data/iotWraStructureLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";

/**
 * IoT 水工結構/環境圖層（5 in 1）
 *   - cumulativeflow 累計流量（紫）
 *   - watergate      閘門（橘）
 *   - damstructure   堤防安全（紅）
 *   - erosiondepth   河床沖刷（黃）
 *   - dustemission   揚塵（棕）
 *
 * 純 latest snapshot（不接 timeline）。timeline 拖拉時跟 latest 一致顯示。
 */

const SOURCE_ID = "iot-wra-structure";
const LAYER_GLOW = "iot-wra-structure-glow";
const LAYER_CIRCLE = "iot-wra-structure-circle";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
// IoT 端通常 10 分鐘內有資料；訂閱日期切換用
// 為避免時間軸拖拉重新 fetch，這個 layer 只在日期切換才重抓

function colorByType(): ExpressionSpecification {
  return [
    "match", ["get", "station_type"],
    "cumulativeflow", "#a855f7",
    "watergate",      "#f97316",
    "damstructure",   "#dc2626",
    "erosiondepth",   "#eab308",
    "dustemission",   "#92400e",
    "#94a3b8", // fallback
  ] as unknown as ExpressionSpecification;
}

function radiusByType(scale: number): ExpressionSpecification {
  return [
    "*",
    [
      "match", ["get", "station_type"],
      "damstructure", 8,    // 堤防安全（少站、重要）
      "watergate", 6.5,
      "cumulativeflow", 5.5,
      "dustemission", 7,
      "erosiondepth", 5.5,
      5,
    ],
    ["literal", scale],
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["*", radiusByType(scale), 1.8] as unknown as ExpressionSpecification,
        "circle-color": colorByType(),
        "circle-blur": 0.85,
        "circle-opacity": (isDark ? 0.45 : 0.32) * opacity,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": radiusByType(scale),
        "circle-color": colorByType(),
        "circle-opacity": (isDark ? 0.95 : 0.85) * opacity,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.6 * opacity,
      },
    } as CircleLayer);
  }
}

function updatePaint(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (map.getLayer(LAYER_GLOW)) {
    map.setPaintProperty(LAYER_GLOW, "circle-radius", [
      "*", radiusByType(scale), 1.8,
    ] as unknown as ExpressionSpecification);
    map.setPaintProperty(LAYER_GLOW, "circle-opacity", (isDark ? 0.45 : 0.32) * opacity);
  }
  if (map.getLayer(LAYER_CIRCLE)) {
    map.setPaintProperty(LAYER_CIRCLE, "circle-radius", radiusByType(scale));
    map.setPaintProperty(LAYER_CIRCLE, "circle-opacity", (isDark ? 0.95 : 0.85) * opacity);
    map.setPaintProperty(LAYER_CIRCLE, "circle-stroke-opacity", 0.6 * opacity);
  }
}

function setLayerVisibility(map: MapboxMap, visible: boolean) {
  for (const id of [LAYER_GLOW, LAYER_CIRCLE]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

interface TypeFilter {
  cumulativeflow: boolean;
  watergate: boolean;
  damstructure: boolean;
  erosiondepth: boolean;
  dustemission: boolean;
}

// 一站可能多 physical_quantity，地圖上只顯示一個點：取第一筆即可
function buildFC(rows: IotWraLatestRow[], filter: TypeFilter): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    if (!filter[r.station_type as keyof TypeFilter]) continue;
    if (seen.has(r.iow_station_id)) continue;
    seen.add(r.iow_station_id);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        iow_station_id: r.iow_station_id,
        station_type: r.station_type,
        name: r.name,
        county_name: r.county_name,
        measurement_name: r.measurement_name,
        si_unit: r.si_unit,
        value: r.value,
        delta_since_day_start: r.delta_since_day_start,
        observed_at: r.observed_at,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useIotWraStructureLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
  opacity = 1,
  showFlow = true,
  showGate = true,
  showDam = true,
  showErosion = true,
  showDust = true,
) {
  const rowsRef = useRef<IotWraLatestRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;

    const filter: TypeFilter = {
      cumulativeflow: showFlow,
      watergate: showGate,
      damstructure: showDam,
      erosiondepth: showErosion,
      dustemission: showDust,
    };

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryAttach = () => {
      if (cancelled) return;
      if (!map.isStyleLoaded()) return;
      ensureLayers(map, isDark, scale, opacity);
      updatePaint(map, isDark, scale, opacity);
      setLayerVisibility(map, true);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) tryAttach();
    else pollTimer = setInterval(tryAttach, 200);

    const redraw = () => {
      if (cancelled) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      src.setData(buildFC(rowsRef.current, filter));
    };

    const load = async () => {
      if (cancelled) return;
      try {
        const rows = await fetchIotWraStructureLatest();
        if (cancelled) return;
        rowsRef.current = rows;
        console.log(`[IotWraStructure] loaded ${rows.length} rows`);
        redraw();
        keepLoadingUntilMapIdle(map, "iot-wra-structure-render", "IoT 結構 渲染中", SOURCE_ID);
      } catch (err) {
        console.warn("[IotWraStructure] fetch failed:", err);
      }
    };

    load();

    // 當日期切換時重新 fetch（latest 也會跟著 cron 更新，每 10 min；
    // 但我們不需要太勤，跟 timeline 切換一起更新即可）
    const unsubDate = timeStore.subscribeDate(() => {
      load();
    });

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      unsubDate();
      if (map.getLayer(LAYER_GLOW) || map.getLayer(LAYER_CIRCLE)) {
        setLayerVisibility(map, false);
      }
    };
  }, [mapRef, visible, isDark, scale, opacity, showFlow, showGate, showDam, showErosion, showDust]);
}
