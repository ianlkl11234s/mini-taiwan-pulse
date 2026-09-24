import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { fetchRainGaugeLatest, type RainGaugeLatestRow } from "../data/rainGaugeLoader";
import { assessBridgeRain, BRIDGE_RAIN_DEFINITIONS, BRIDGE_TABLE_VERSION } from "../data/bridgeRainThresholds";

const SOURCE = "bridge-rain-source";
export const BRIDGE_RAIN_CLICK_LAYER = "bridge-rain-circle";
const REFRESH_MS = 10 * 60_000; // 畫面讀取頻率；不改上游測站採集排程

function render(map: MapboxMap, rows: readonly RainGaugeLatestRow[], visible: boolean) {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  if (!map.getLayer(BRIDGE_RAIN_CLICK_LAYER)) map.addLayer({
    id: BRIDGE_RAIN_CLICK_LAYER,
    type: "circle",
    source: SOURCE,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 15, 11],
      "circle-color": ["match", ["get", "status"], "triggered", "#ef4444", "below", "#3b82f6", "#94a3b8"],
      "circle-opacity": 0.95,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
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
export function useBridgeRainLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const rowsRef = useRef<RainGaugeLatestRow[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    const apply = () => { if (map.isStyleLoaded()) render(map, rowsRef.current, visible); };
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
    if (visible) {
      void refresh();
      const timer = window.setInterval(() => { void refresh(); }, REFRESH_MS);
      return () => { cancelled = true; window.clearInterval(timer); };
    }
    return () => { cancelled = true; };
  }, [mapRef, visible, mapTick]);
  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(BRIDGE_RAIN_CLICK_LAYER)) {
      map.setPaintProperty(BRIDGE_RAIN_CLICK_LAYER, "circle-opacity", 0.95 * Math.max(0, Math.min(1, opacity)));
    }
  }, [mapRef, mapTick, opacity]);
}
