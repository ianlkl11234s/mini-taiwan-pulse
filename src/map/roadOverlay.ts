import type { Map as MapboxMap } from "mapbox-gl";

// ── National Highway (國道) ──

const HWY_SOURCE = "national-highways";
const HWY_LINE = "national-highways-line";
const HWY_GLOW = "national-highways-glow";

// ── Provincial Road (省道) ──

const PROV_SOURCE = "provincial-roads";
const PROV_LINE = "provincial-roads-line";
const PROV_GLOW = "provincial-roads-glow";

const HWY_LAYERS = [HWY_GLOW, HWY_LINE];
const PROV_LAYERS = [PROV_GLOW, PROV_LINE];

// ────────────────────────────────────────
// National Highway
// ────────────────────────────────────────

export function addHighwayOverlay(map: MapboxMap, isDark: boolean) {
  if (map.getSource(HWY_SOURCE)) return;

  map.addSource(HWY_SOURCE, {
    type: "geojson",
    data: "./national_highway.geojson",
  });

  const color = isDark ? "#ff6b6b" : "#cc3333";

  // 光暈
  map.addLayer({
    id: HWY_GLOW,
    type: "line",
    source: HWY_SOURCE,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": color,
      "line-width": 8,
      "line-blur": 6,
      "line-opacity": isDark ? 0.08 : 0.12,
    },
  });

  // 主線
  map.addLayer({
    id: HWY_LINE,
    type: "line",
    source: HWY_SOURCE,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": color,
      "line-width": [
        "interpolate", ["linear"], ["zoom"],
        6, 0.5,
        10, 1.5,
        13, 3,
        16, 5,
      ],
      "line-opacity": isDark ? 0.6 : 0.5,
    },
  });
}

// ────────────────────────────────────────
// Provincial Road
// ────────────────────────────────────────

export function addProvincialRoadOverlay(map: MapboxMap, isDark: boolean) {
  if (map.getSource(PROV_SOURCE)) return;

  map.addSource(PROV_SOURCE, {
    type: "geojson",
    data: "./provincial_road.geojson",
  });

  const color = isDark ? "#ffa94d" : "#cc7722";

  // 光暈
  map.addLayer({
    id: PROV_GLOW,
    type: "line",
    source: PROV_SOURCE,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": color,
      "line-width": 6,
      "line-blur": 5,
      "line-opacity": isDark ? 0.05 : 0.08,
    },
  });

  // 主線
  map.addLayer({
    id: PROV_LINE,
    type: "line",
    source: PROV_SOURCE,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": color,
      "line-width": [
        "interpolate", ["linear"], ["zoom"],
        6, 0.3,
        10, 1,
        13, 2,
        16, 3.5,
      ],
      "line-opacity": isDark ? 0.45 : 0.4,
    },
  });
}

// ────────────────────────────────────────
// Visibility
// ────────────────────────────────────────

export function setHighwayVisible(map: MapboxMap, visible: boolean) {
  const v = visible ? "visible" : "none";
  for (const id of HWY_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}

export function setProvincialRoadVisible(map: MapboxMap, visible: boolean) {
  const v = visible ? "visible" : "none";
  for (const id of PROV_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}

// ────────────────────────────────────────
// Theme Update
// ────────────────────────────────────────

export function updateRoadStyle(map: MapboxMap, isDark: boolean) {
  // National Highway
  if (map.getSource(HWY_SOURCE)) {
    const hwyColor = isDark ? "#ff6b6b" : "#cc3333";

    map.setPaintProperty(HWY_LINE, "line-color", hwyColor);
    map.setPaintProperty(HWY_LINE, "line-opacity", isDark ? 0.6 : 0.5);
    map.setPaintProperty(HWY_GLOW, "line-color", hwyColor);
    map.setPaintProperty(HWY_GLOW, "line-opacity", isDark ? 0.08 : 0.12);
  }

  // Provincial Road
  if (map.getSource(PROV_SOURCE)) {
    const provColor = isDark ? "#ffa94d" : "#cc7722";

    map.setPaintProperty(PROV_LINE, "line-color", provColor);
    map.setPaintProperty(PROV_LINE, "line-opacity", isDark ? 0.45 : 0.4);
    map.setPaintProperty(PROV_GLOW, "line-color", provColor);
    map.setPaintProperty(PROV_GLOW, "line-opacity", isDark ? 0.05 : 0.08);
  }
}
