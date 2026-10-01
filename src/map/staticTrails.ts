import { hookLineWidth, hookLineOpacity, hookLineLayout } from "./lineFillSpec";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Flight } from "../types";

const SOURCE_ID = "static-trails";
const LAYER_ID = "static-trails-line";
const GLOW_LAYER_ID = "static-trails-glow";
const sourceFlights = new WeakMap<GeoJSONSource, Flight[]>();

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
 * 暗色主題：t=0 → 白色 #ffffff，t=1 → 橘色 #ff8833
 * 亮色主題：t=0 → 深藍 #1a3a8a，t=1 → 深紅 #8a1a2a
 */
function lerpColorDark(t: number): string {
  const r = Math.round(255 + (0xff - 255) * t);
  const g = Math.round(255 + (0x88 - 255) * t);
  const b = Math.round(255 + (0x33 - 255) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lerpColorLight(t: number): string {
  const r = Math.round(26 + (138 - 26) * t);
  const g = Math.round(58 + (26 - 58) * t);
  const b = Math.round(138 + (42 - 138) * t);
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
          colorDark: lerpColorDark(hashToUnit(f.fr24_id)),
          colorLight: lerpColorLight(hashToUnit(f.fr24_id)),
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
 * 新增或更新靜態軌跡圖層
 * @param background - 3D 模式下作為背景路線，降低透明度
 */
export function updateStaticTrails(map: MapboxMap, flights: Flight[], isDark = true, background = false) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;

  const scale = background ? 0 : 1.0;
  const originalOpacity = isDark ? 0.25 : 0.5;
  const lineOpacity = hookLineOpacity("flights", LAYER_ID, originalOpacity * scale, originalOpacity);
  const glowOpacity = (isDark ? 0.08 : 0.15) * scale;

  if (source) {
    if (sourceFlights.get(source) !== flights) {
      source.setData(flightsToGeoJSON(flights));
      sourceFlights.set(source, flights);
    }
    if (map.getLayer(LAYER_ID)) {
      map.setPaintProperty(LAYER_ID, "line-opacity", lineOpacity);
      map.setPaintProperty(LAYER_ID, "line-color", ["get", isDark ? "colorDark" : "colorLight"]);
    }
    if (map.getLayer(GLOW_LAYER_ID)) {
      map.setPaintProperty(GLOW_LAYER_ID, "line-opacity", glowOpacity);
      map.setPaintProperty(GLOW_LAYER_ID, "line-color", ["get", isDark ? "colorDark" : "colorLight"]);
    }
  } else {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: flightsToGeoJSON(flights),
    });

    sourceFlights.set(map.getSource(SOURCE_ID) as GeoJSONSource, flights);

    // 外層 glow（較寬、較透明）
    map.addLayer({
      id: GLOW_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["get", isDark ? "colorDark" : "colorLight"],
        "line-width": 3,
        "line-opacity": glowOpacity,
        "line-blur": 4,
      },
    });

    // 內層線條（較細、較亮）
    map.addLayer({
      id: LAYER_ID,
      type: "line",
      layout: hookLineLayout("flights", LAYER_ID),
      source: SOURCE_ID,
      paint: {
        "line-color": ["get", isDark ? "colorDark" : "colorLight"],
        "line-width": hookLineWidth("flights", LAYER_ID, 1, 1),
        "line-opacity": lineOpacity,
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

/**
 * 設定靜態軌跡圖層可見性（用於 Display Mode 切換）
 */
export function setStaticTrailsVisible(map: MapboxMap, visible: boolean) {
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(LAYER_ID)) {
    map.setLayoutProperty(LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(GLOW_LAYER_ID)) {
    map.setLayoutProperty(GLOW_LAYER_ID, "visibility", visibility);
  }
}

/**
 * 直接設定靜態軌跡透明度（用於 zoom-based crossfade）
 */
export function setStaticTrailsOpacity(map: MapboxMap, lineOpacity: number, glowOpacity: number, isDark = true) {
  if (map.getLayer(LAYER_ID)) {
    map.setPaintProperty(LAYER_ID, "line-opacity", hookLineOpacity("flights", LAYER_ID, lineOpacity, isDark ? 0.25 : 0.5));
  }
  if (map.getLayer(GLOW_LAYER_ID)) {
    map.setPaintProperty(GLOW_LAYER_ID, "line-opacity", glowOpacity);
  }
}
