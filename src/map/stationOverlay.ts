import mapboxgl from "mapbox-gl";

// ── Station Polygon (大站: TRA class 0-1 + THSR) ──

const STATION_POLY_SOURCE = "station-polygons";
const STATION_POLY_FILL = "station-poly-fill";
const STATION_POLY_LINE = "station-poly-line";
const STATION_POLY_GLOW_1 = "station-poly-glow-1";
const STATION_POLY_GLOW_2 = "station-poly-glow-2";

// ── Station Points (小站 + 捷運站) — 地面圓環風格 ──

const STATION_POINT_SOURCE = "station-points";
const STATION_POINT_GLOW_2 = "station-point-glow-2"; // 外層光暈
const STATION_POINT_GLOW_1 = "station-point-glow-1"; // 內層光暈
const STATION_POINT_FILL = "station-point-fill";       // 填充 + 邊框環

export function addStationPolygonOverlay(map: mapboxgl.Map, isDark: boolean) {
  const color = isDark ? "#ffffff" : "#e8dcc8";
  const glowColor = isDark ? "#ffffff" : "#d4c4a8";

  if (map.getSource(STATION_POLY_SOURCE)) return;

  map.addSource(STATION_POLY_SOURCE, {
    type: "geojson",
    data: "./station_polygons.geojson",
  });

  // 外層光暈（比機場小: width 15 vs 30）
  map.addLayer({
    id: STATION_POLY_GLOW_2,
    type: "line",
    source: STATION_POLY_SOURCE,
    paint: {
      "line-color": glowColor,
      "line-width": 15,
      "line-blur": 8,
      "line-opacity": isDark ? 0.06 : 0.12,
    },
  });

  // 內層光暈
  map.addLayer({
    id: STATION_POLY_GLOW_1,
    type: "line",
    source: STATION_POLY_SOURCE,
    paint: {
      "line-color": glowColor,
      "line-width": 6,
      "line-blur": 3,
      "line-opacity": isDark ? 0.12 : 0.25,
    },
  });

  // 填充
  map.addLayer({
    id: STATION_POLY_FILL,
    type: "fill",
    source: STATION_POLY_SOURCE,
    paint: {
      "fill-color": color,
      "fill-opacity": isDark ? 0.08 : 0.12,
    },
  });

  // 邊框
  map.addLayer({
    id: STATION_POLY_LINE,
    type: "line",
    source: STATION_POLY_SOURCE,
    paint: {
      "line-color": color,
      "line-width": isDark ? 1 : 1.5,
      "line-opacity": isDark ? 0.3 : 0.5,
    },
  });
}

const BASE_RADIUS = 5;

export function addStationPointOverlay(map: mapboxgl.Map, isDark: boolean, scale = 1) {
  if (map.getSource(STATION_POINT_SOURCE)) return;

  map.addSource(STATION_POINT_SOURCE, {
    type: "geojson",
    data: "./station_points.geojson",
  });

  addPointLayers(map, isDark, scale);
}

export function updateStationStyle(map: mapboxgl.Map, isDark: boolean, scale = 1) {
  const color = isDark ? "#ffffff" : "#e8dcc8";
  const glowColor = isDark ? "#ffffff" : "#d4c4a8";

  // Polygon
  if (map.getSource(STATION_POLY_SOURCE)) {
    map.setPaintProperty(STATION_POLY_FILL, "fill-color", color);
    map.setPaintProperty(STATION_POLY_FILL, "fill-opacity", isDark ? 0.08 : 0.12);
    map.setPaintProperty(STATION_POLY_LINE, "line-color", color);
    map.setPaintProperty(STATION_POLY_LINE, "line-width", isDark ? 1 : 1.5);
    map.setPaintProperty(STATION_POLY_LINE, "line-opacity", isDark ? 0.3 : 0.5);
    map.setPaintProperty(STATION_POLY_GLOW_1, "line-color", glowColor);
    map.setPaintProperty(STATION_POLY_GLOW_1, "line-opacity", isDark ? 0.12 : 0.25);
    map.setPaintProperty(STATION_POLY_GLOW_2, "line-color", glowColor);
    map.setPaintProperty(STATION_POLY_GLOW_2, "line-opacity", isDark ? 0.06 : 0.12);
  }

  // Points — 移除再重建圖層（保留 source）
  removePointLayers(map);
  if (map.getSource(STATION_POINT_SOURCE)) {
    addPointLayers(map, isDark, scale);
  }
}

function removePointLayers(map: mapboxgl.Map) {
  for (const id of [STATION_POINT_FILL, STATION_POINT_GLOW_1, STATION_POINT_GLOW_2]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
}

function addPointLayers(map: mapboxgl.Map, isDark: boolean, scale: number) {
  const color = isDark ? "#ffffff" : "#e8dcc8";
  const glowColor = isDark ? "#ffffff" : "#d4c4a8";

  map.addLayer({
    id: STATION_POINT_GLOW_2,
    type: "circle",
    source: STATION_POINT_SOURCE,
    minzoom: 10,
    paint: {
      "circle-radius": BASE_RADIUS * scale * 2.5,
      "circle-blur": 1,
      "circle-color": glowColor,
      "circle-opacity": isDark ? 0.06 : 0.12,
    },
  });

  map.addLayer({
    id: STATION_POINT_GLOW_1,
    type: "circle",
    source: STATION_POINT_SOURCE,
    minzoom: 10,
    paint: {
      "circle-radius": BASE_RADIUS * scale * 1.5,
      "circle-blur": 0.6,
      "circle-color": glowColor,
      "circle-opacity": isDark ? 0.12 : 0.25,
    },
  });

  map.addLayer({
    id: STATION_POINT_FILL,
    type: "circle",
    source: STATION_POINT_SOURCE,
    minzoom: 10,
    paint: {
      "circle-radius": BASE_RADIUS * scale,
      "circle-color": color,
      "circle-opacity": isDark ? 0.08 : 0.12,
      "circle-stroke-width": isDark ? 1 : 1.5,
      "circle-stroke-color": color,
      "circle-stroke-opacity": isDark ? 0.3 : 0.5,
    },
  });
}

export function setStationVisible(map: mapboxgl.Map, visible: boolean) {
  const v = visible ? "visible" : "none";
  const layers = [
    STATION_POLY_GLOW_2, STATION_POLY_GLOW_1, STATION_POLY_FILL, STATION_POLY_LINE,
    STATION_POINT_GLOW_2, STATION_POINT_GLOW_1, STATION_POINT_FILL,
  ];
  for (const id of layers) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}
