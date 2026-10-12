import { hookLineWidth, hookLineOpacity } from "./lineFillSpec";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";

const SOURCE_ID = "rail-tracks";
const LAYER_ID = "rail-tracks-line";
/** R6 段 3：平面列車要疊在 2D 軌道之上（flatMovingController 用）。 */
export const RAIL_TRACKS_LAYER_ID = LAYER_ID;
/**
 * R6 段 3 決議（2026-10-09）：列車平面（立體效果關）時軌道一律用 2D，讓平面箭頭與 Mapbox 軌道線對齊；
 * 立體效果開時照使用者存的 railTrackMode。只推導「有效值」，不改寫使用者存的參數。
 * 面板端由 railTrackMode 的 disableRule（3D 選項依 railTrain3D 停用）呈現同一條規則。
 */
export function effectiveRailTrackMode(railTrain3D: boolean, railTrackMode: string): string {
  return railTrain3D ? railTrackMode : "2d";
}

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
