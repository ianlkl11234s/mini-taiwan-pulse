import { hookLineWidth, hookLineOpacity } from "./lineFillSpec";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";

const SOURCE_ID = "rail-tracks";
const LAYER_ID = "rail-tracks-line";
const sourceData = new WeakMap<GeoJSONSource, GeoJSON.FeatureCollection>();

/**
 * 新增或更新軌道靜態線圖層（Mapbox 2D）
 */
export function updateRailTracks(
  map: MapboxMap,
  geojson: GeoJSON.FeatureCollection,
  isDark = true,
) {
  const originalOpacity = isDark ? 0.75 : 0.6;
  const lineOpacity = hookLineOpacity("rail", LAYER_ID, originalOpacity, originalOpacity, isDark);

  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    if (sourceData.get(source) !== geojson) {
      source.setData(geojson);
      sourceData.set(source, geojson);
    }
    if (map.getLayer(LAYER_ID)) {
      map.setPaintProperty(LAYER_ID, "line-opacity", lineOpacity);
    }
  } else {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: geojson,
    });

    sourceData.set(map.getSource(SOURCE_ID) as GeoJSONSource, geojson);
    map.addLayer({
      id: LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": ["get", "color"],
        "line-width": hookLineWidth("rail", LAYER_ID, 5, 5),
        "line-opacity": lineOpacity,
      },
    });
  }
}

/**
 * 移除軌道靜態線圖層
 */
export function removeRailTracks(map: MapboxMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

/**
 * 設定軌道線可見性
 */
export function setRailTracksVisible(map: MapboxMap, visible: boolean) {
  if (map.getLayer(LAYER_ID)) {
    map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}
