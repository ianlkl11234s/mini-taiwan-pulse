import type { Map as MapboxMap } from "mapbox-gl";

const SOURCE_ID = "lighthouses";
const CIRCLE_LAYER = "lighthouse-circle";
const GLOW_LAYER = "lighthouse-glow";

const ALL_LAYERS = [GLOW_LAYER, CIRCLE_LAYER];

export function addLighthouseOverlay(map: MapboxMap, isDark: boolean) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: "./lighthouse.geojson",
  });

  // 光暈層
  map.addLayer({
    id: GLOW_LAYER,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        6, 8,
        10, 12,
        14, 16,
      ],
      "circle-color": "#ffd700",
      "circle-blur": 1,
      "circle-opacity": isDark ? 0.3 : 0.2,
    },
  });

  // 實心圓點層
  map.addLayer({
    id: CIRCLE_LAYER,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        6, 3,
        10, 5,
        14, 7,
      ],
      "circle-color": "#ffd700",
      "circle-stroke-color": isDark ? "#fff8dc" : "#b8860b",
      "circle-stroke-width": 1,
      "circle-opacity": isDark ? 0.9 : 0.8,
    },
  });
}

export function setLighthouseVisible(map: MapboxMap, visible: boolean) {
  const v = visible ? "visible" : "none";
  for (const id of ALL_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}

export function updateLighthouseStyle(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) return;

  map.setPaintProperty(GLOW_LAYER, "circle-opacity", isDark ? 0.3 : 0.2);
  map.setPaintProperty(CIRCLE_LAYER, "circle-stroke-color", isDark ? "#fff8dc" : "#b8860b");
  map.setPaintProperty(CIRCLE_LAYER, "circle-opacity", isDark ? 0.9 : 0.8);
}
