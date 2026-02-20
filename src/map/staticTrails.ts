import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Flight } from "../types";

const SOURCE_ID = "static-trails";
const LAYER_ID = "static-trails-line";
const GLOW_LAYER_ID = "static-trails-glow";

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
        "line-color": "#ff8833",
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
        "line-color": "#ffaa44",
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
