import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { fetchRainGaugeLatest, type RainGaugeLatestRow } from "../data/rainGaugeLoader";
import { assessBridgeRain, BRIDGE_RAIN_DEFINITIONS, BRIDGE_TABLE_VERSION } from "../data/bridgeRainThresholds";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";

const SOURCE = "bridge-rain-source";
export const BRIDGE_RAIN_CLICK_LAYER = "bridge-rain-circle";
const OPACITY_DEFAULT = Number(paramDefault("bridgeRainThresholds", "bridgeRainThresholdsOpacity"));
const REFRESH_MS = 10 * 60_000; // 畫面讀取頻率；不改上游測站採集排程

function render(map: MapboxMap, rows: readonly RainGaugeLatestRow[], visible: boolean, opacity: number, isDark: boolean) {
  const opacityScale = Math.max(0, Math.min(1, opacity)) / OPACITY_DEFAULT;
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  if (!map.getLayer(BRIDGE_RAIN_CLICK_LAYER)) map.addLayer({
    id: BRIDGE_RAIN_CLICK_LAYER,
    type: "circle",
    source: SOURCE,
    paint: {
      "circle-radius": pointRadius("L"),
      "circle-color": ["match", ["get", "status"], "triggered", "#ef4444", "below", "#3b82f6", "#94a3b8"],
      "circle-opacity": 0.95,
      ...pointStrokePaint(isDark, opacityScale),
    },
  });
  const latest = new Map(rows.map((row) => [row.station_id, row]));
  const source = map.getSource(SOURCE) as GeoJSONSource;
  source.setData({
    type: "FeatureCollection",
    features: BRIDGE_RAIN_DEFINITIONS.map((bridge) => {
      const assessment = assessBridgeRain(bridge, latest);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [bridge.lng, bridge.lat] },
        properties: {
          bridge_id: bridge.id,
          bridge_name: bridge.name,
          route: bridge.route,
          status: assessment.status,
          status_label: assessment.label,
          status_reason: assessment.reason,
          station_ids: bridge.stations.join("、"),
          matched_station: assessment.matchedStation ?? "",
          readings_json: JSON.stringify(assessment.stationReadings.map((row) => ({
            id: row.station_id,
            name: row.station_name,
            observed_at: row.observed_at,
            p1: row.precipitation_1hr,
            p3: row.precipitation_3hr,
            p6: row.precipitation_6hr,
            p24: row.precipitation_24hr,
          }))),
          note: bridge.note ?? "",
          table_version: BRIDGE_TABLE_VERSION,
          location_source: `OpenStreetMap way/${bridge.osmWay}（同名候選中心點，非官方橋位）`,
          location_url: `https://www.openstreetmap.org/way/${bridge.osmWay}`,
        },
      };
    }),
  });
  map.setLayoutProperty(BRIDGE_RAIN_CLICK_LAYER, "visibility", visible ? "visible" : "none");
}

/** 一級監控橋梁的參考雨量；固定 10 分鐘重抓 latest，過期後自然轉灰。 */
export function useBridgeRainLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean = true) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const rowsRef = useRef<RainGaugeLatestRow[]>([]);
  // 建圖層時讀最新值；opacity／isDark 變動只走第二個 effect 的 setPaintProperty，不重建 interval／重抓 API
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    let retryTimer: number | null = null;
    // isStyleLoaded() 在任何 tile 載入中都回 false（首載／busy 期間可長時間 false）。
    // 以前這裡直接放棄且不重試 → 關閉圖層時隱藏被吃掉、點位留在畫面上。
    // 改為：隱藏只需 setLayoutProperty（既有 layer 任何時刻都安全）→ 立刻套用；
    // 顯示需要建 source／setData → style 未就緒時每 150ms 有界重試（effect 清理或換狀態即停）。
    const apply = () => {
      if (cancelled) return;
      if (map.isStyleLoaded()) {
        render(map, rowsRef.current, visible, opacityRef.current, isDarkRef.current);
        return;
      }
      if (!visible) {
        if (map.getLayer(BRIDGE_RAIN_CLICK_LAYER)) map.setLayoutProperty(BRIDGE_RAIN_CLICK_LAYER, "visibility", "none");
        return;
      }
      if (retryTimer === null) {
        retryTimer = window.setTimeout(() => { retryTimer = null; apply(); }, 150);
      }
    };
    const clearRetry = () => { if (retryTimer !== null) { window.clearTimeout(retryTimer); retryTimer = null; } };
    const refresh = async () => {
      try {
        const rows = await fetchRainGaugeLatest();
        if (cancelled) return;
        rowsRef.current = rows;
      } catch (error) {
        if (cancelled) return;
        rowsRef.current = []; // 失敗不可沿用舊的綠色／紅色判讀
        console.warn("[BridgeRain] latest fetch failed", error);
      }
      apply();
    };
    apply();
    // 換底圖 setStyle() 會移除自建 source／layer：style.load 立刻用快取重掛，不等下一次 10 分鐘 refresh
    map.on("style.load", apply);
    if (visible) {
      void refresh();
      const timer = window.setInterval(() => { void refresh(); }, REFRESH_MS);
      return () => { cancelled = true; map.off("style.load", apply); window.clearInterval(timer); clearRetry(); };
    }
    return () => { cancelled = true; map.off("style.load", apply); clearRetry(); };
  }, [mapRef, visible, mapTick]);
  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(BRIDGE_RAIN_CLICK_LAYER)) {
      map.setPaintProperty(BRIDGE_RAIN_CLICK_LAYER, "circle-opacity", 0.95 * Math.max(0, Math.min(1, opacity)));
      for (const [k, v] of Object.entries(pointStrokePaint(isDark, Math.max(0, Math.min(1, opacity)) / OPACITY_DEFAULT))) {
        map.setPaintProperty(BRIDGE_RAIN_CLICK_LAYER, k as "circle-stroke-color", v as never);
      }
    }
  }, [mapRef, mapTick, opacity, isDark]);
}
