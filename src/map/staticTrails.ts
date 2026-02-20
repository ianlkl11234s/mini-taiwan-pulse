import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Flight } from "../types";

const SOURCE_ID = "static-trails";
const LAYER_ID = "static-trails-line";
const GLOW_LAYER_ID = "static-trails-glow";

/**
 * 將 fr24_id hash 成 0~1 的穩定值
 */
function hashToUnit(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return (hash % 10000) / 10000;
}

/**
 * t=0 → 白色 #ffffff，t=1 → 橘色 #ff8833，線性插值回傳 hex string
 */
function lerpColor(t: number): string {
  const r = Math.round(255 + (0xff - 255) * t);
  const g = Math.round(255 + (0x88 - 255) * t);
  const b = Math.round(255 + (0x33 - 255) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 將航班路徑轉為 GeoJSON FeatureCollection
 */
function flightsToGeoJSON(flights: Flight[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: flights
      .filter((f) => f.path.length >= 2)
      .map((f) => ({
        type: "Feature" as const,
        properties: {
          callsign: f.callsign,
          origin: f.origin_iata,
          dest: f.dest_iata,
          color: lerpColor(hashToUnit(f.fr24_id)),
        },
        geometry: {
          type: "LineString" as const,
          // path 格式: [lat, lng, alt, ts] → GeoJSON 要 [lng, lat]
          coordinates: f.path.map((pt) => [pt[1], pt[0]]),
        },
      })),
  };
}

/**
 * 新增或更新靜態軌跡圖層（暖橘色光軌）
 */
export function updateStaticTrails(map: MapboxMap, flights: Flight[]) {
  const geojson = flightsToGeoJSON(flights);

  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(geojson);
  } else {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: geojson,
    });

    // 外層 glow（較寬、較透明）
    map.addLayer({
      id: GLOW_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
        "line-opacity": 0.08,
        "line-blur": 4,
      },
    });

    // 內層線條（較細、較亮）
    map.addLayer({
      id: LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1,
        "line-opacity": 0.25,
        "line-blur": 1,
      },
    });
  }
}

/**
 * 移除靜態軌跡圖層
 */
export function removeStaticTrails(map: MapboxMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getLayer(GLOW_LAYER_ID)) map.removeLayer(GLOW_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
