import mapboxgl from "mapbox-gl";

// ── Port Polygon (碼頭輪廓) ──

const PORT_POLY_SOURCE = "port-polygons";
const PORT_POLY_FILL = "port-poly-fill";
const PORT_POLY_LINE = "port-poly-line";
const PORT_POLY_GLOW_1 = "port-poly-glow-1";
const PORT_POLY_GLOW_2 = "port-poly-glow-2";

const ALL_LAYERS = [PORT_POLY_GLOW_2, PORT_POLY_GLOW_1, PORT_POLY_FILL, PORT_POLY_LINE];

export function addPortPolygonOverlay(map: mapboxgl.Map, isDark: boolean) {
  if (map.getSource(PORT_POLY_SOURCE)) return;

  map.addSource(PORT_POLY_SOURCE, {
    type: "geojson",
    data: "./port_polygons.geojson",
  });

  const color = isDark ? "#ffffff" : "#4a90d9";
  const glowColor = isDark ? "#88bbff" : "#3a7bd5";

  // 外層光暈
  map.addLayer({
    id: PORT_POLY_GLOW_2,
    type: "line",
    source: PORT_POLY_SOURCE,
    paint: {
      "line-color": glowColor,
      "line-width": 12,
      "line-blur": 8,
      "line-opacity": isDark ? 0.04 : 0.10,
    },
  });

  // 內層光暈
  map.addLayer({
    id: PORT_POLY_GLOW_1,
    type: "line",
    source: PORT_POLY_SOURCE,
    paint: {
      "line-color": glowColor,
      "line-width": 5,
      "line-blur": 3,
      "line-opacity": isDark ? 0.10 : 0.20,
    },
  });

  // 填充
  map.addLayer({
    id: PORT_POLY_FILL,
    type: "fill",
    source: PORT_POLY_SOURCE,
    paint: {
      "fill-color": color,
      "fill-opacity": isDark ? 0.06 : 0.10,
    },
  });

  // 邊框
  map.addLayer({
    id: PORT_POLY_LINE,
    type: "line",
    source: PORT_POLY_SOURCE,
    paint: {
      "line-color": color,
      "line-width": isDark ? 1 : 1.5,
      "line-opacity": isDark ? 0.25 : 0.40,
    },
  });
}

export function updatePortStyle(map: mapboxgl.Map, isDark: boolean) {
  if (!map.getSource(PORT_POLY_SOURCE)) return;
  const color = isDark ? "#ffffff" : "#4a90d9";
  const glowColor = isDark ? "#88bbff" : "#3a7bd5";

  map.setPaintProperty(PORT_POLY_FILL, "fill-color", color);
  map.setPaintProperty(PORT_POLY_FILL, "fill-opacity", isDark ? 0.06 : 0.10);
  map.setPaintProperty(PORT_POLY_LINE, "line-color", color);
  map.setPaintProperty(PORT_POLY_LINE, "line-opacity", isDark ? 0.25 : 0.40);
  map.setPaintProperty(PORT_POLY_GLOW_1, "line-color", glowColor);
  map.setPaintProperty(PORT_POLY_GLOW_1, "line-opacity", isDark ? 0.10 : 0.20);
  map.setPaintProperty(PORT_POLY_GLOW_2, "line-color", glowColor);
  map.setPaintProperty(PORT_POLY_GLOW_2, "line-opacity", isDark ? 0.04 : 0.10);
}

export function setPortVisible(map: mapboxgl.Map, visible: boolean) {
  const v = visible ? "visible" : "none";
  for (const id of ALL_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}
