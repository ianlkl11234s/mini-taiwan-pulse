import type { OverlayConfig } from "../types";

const BASE_RADIUS = 5;

export const OVERLAY_REGISTRY: OverlayConfig[] = [
  // ── Station Polygon (大站: TRA class 0-1 + THSR) ──
  {
    id: "stations",
    sourceUrl: "./station_polygons.geojson",
    sourceId: "station-polygons",
    layers: [
      {
        suffix: "poly-glow-2",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#d4c4a8",
          "line-width": 15,
          "line-blur": 8,
          "line-opacity": isDark ? 0.06 : 0.12,
        }),
      },
      {
        suffix: "poly-glow-1",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#d4c4a8",
          "line-width": 6,
          "line-blur": 3,
          "line-opacity": isDark ? 0.12 : 0.25,
        }),
      },
      {
        suffix: "poly-fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#ffffff" : "#e8dcc8",
          "fill-opacity": isDark ? 0.08 : 0.12,
        }),
      },
      {
        suffix: "poly-line",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#e8dcc8",
          "line-width": isDark ? 1 : 1.5,
          "line-opacity": isDark ? 0.3 : 0.5,
        }),
      },
    ],
  },

  // ── Station Points (小站 + 捷運站) ──
  {
    id: "stations",
    sourceUrl: "./station_points.geojson",
    sourceId: "station-points",
    rebuildOnParamChange: ["pt-glow-2", "pt-glow-1", "pt-fill"],
    layers: [
      {
        suffix: "pt-glow-2",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const isDark = _isDark;
          return {
            "circle-radius": BASE_RADIUS * scale * 2.5,
            "circle-blur": 1,
            "circle-color": isDark ? "#ffffff" : "#d4c4a8",
            "circle-opacity": isDark ? 0.06 : 0.12,
          };
        },
      },
      {
        suffix: "pt-glow-1",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const isDark = _isDark;
          return {
            "circle-radius": BASE_RADIUS * scale * 1.5,
            "circle-blur": 0.6,
            "circle-color": isDark ? "#ffffff" : "#d4c4a8",
            "circle-opacity": isDark ? 0.12 : 0.25,
          };
        },
      },
      {
        suffix: "pt-fill",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const isDark = _isDark;
          return {
            "circle-radius": BASE_RADIUS * scale,
            "circle-color": isDark ? "#ffffff" : "#e8dcc8",
            "circle-opacity": isDark ? 0.08 : 0.12,
            "circle-stroke-width": isDark ? 1 : 1.5,
            "circle-stroke-color": isDark ? "#ffffff" : "#e8dcc8",
            "circle-stroke-opacity": isDark ? 0.3 : 0.5,
          };
        },
      },
    ],
  },

  // ── Ports ──
  {
    id: "ports",
    sourceUrl: "./port_polygons.geojson",
    sourceId: "port-polygons",
    layers: [
      {
        suffix: "glow-2",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#88bbff" : "#3a7bd5",
          "line-width": 12,
          "line-blur": 8,
          "line-opacity": isDark ? 0.04 : 0.10,
        }),
      },
      {
        suffix: "glow-1",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#88bbff" : "#3a7bd5",
          "line-width": 5,
          "line-blur": 3,
          "line-opacity": isDark ? 0.10 : 0.20,
        }),
      },
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#ffffff" : "#4a90d9",
          "fill-opacity": isDark ? 0.06 : 0.10,
        }),
      },
      {
        suffix: "line",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#4a90d9",
          "line-width": isDark ? 1 : 1.5,
          "line-opacity": isDark ? 0.25 : 0.40,
        }),
      },
    ],
  },

  // ── Lighthouses ──
  {
    id: "lighthouses",
    sourceUrl: "./lighthouse.geojson",
    sourceId: "lighthouses",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.lighthouseScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 8 * scale, 10, 12 * scale, 14, 16 * scale,
            ],
            "circle-color": "#ffd700",
            "circle-blur": 1,
            "circle-opacity": isDark ? 0.3 : 0.2,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.lighthouseScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 3 * scale, 10, 5 * scale, 14, 7 * scale,
            ],
            "circle-color": "#ffd700",
            "circle-stroke-color": isDark ? "#fff8dc" : "#b8860b",
            "circle-stroke-width": 1,
            "circle-opacity": isDark ? 0.9 : 0.8,
          };
        },
      },
    ],
  },

  // ── National Highway (國道) ──
  {
    id: "highways",
    sourceUrl: "./national_highway.geojson",
    sourceId: "national-highways",
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark) => ({
          "line-color": isDark ? "#ff6b6b" : "#cc3333",
          "line-width": 8,
          "line-blur": 6,
          "line-opacity": isDark ? 0.08 : 0.12,
        }),
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark) => ({
          "line-color": isDark ? "#ff6b6b" : "#cc3333",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            6, 0.5, 10, 1.5, 13, 3, 16, 5,
          ],
          "line-opacity": isDark ? 0.6 : 0.5,
        }),
      },
    ],
  },

  // ── Provincial Road (省道) ──
  {
    id: "provincialRoads",
    sourceUrl: "./provincial_road.geojson",
    sourceId: "provincial-roads",
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark) => ({
          "line-color": isDark ? "#ffa94d" : "#cc7722",
          "line-width": 6,
          "line-blur": 5,
          "line-opacity": isDark ? 0.05 : 0.08,
        }),
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark) => ({
          "line-color": isDark ? "#ffa94d" : "#cc7722",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            6, 0.3, 10, 1, 13, 2, 16, 3.5,
          ],
          "line-opacity": isDark ? 0.45 : 0.4,
        }),
      },
    ],
  },

  // ── Wind Plan (離岸風電) ──
  {
    id: "windPlan",
    sourceUrl: "./wind_plan.geojson",
    sourceId: "wind-plan",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#5efca0" : "#3dbd6e",
          "line-width": 8,
          "line-blur": 6,
          "line-opacity": isDark ? 0.06 : 0.12,
        }),
      },
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#7efcb0" : "#2d9d5e",
          "fill-opacity": isDark ? 0.08 : 0.12,
        }),
      },
      {
        suffix: "line",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#7efcb0" : "#2d9d5e",
          "line-width": isDark ? 1 : 1.5,
          "line-opacity": isDark ? 0.35 : 0.50,
        }),
      },
    ],
  },

  // ── Bus Stations (City) ──
  {
    id: "busStationsCity",
    sourceUrl: "./bus_stations_city.geojson",
    sourceId: "bus-stations-city",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.busScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 2 * scale, 10, 5 * scale, 14, 10 * scale, 17, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#66bb6a" : "#388e3c",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.busScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.8 * scale, 10, 1.5 * scale, 14, 3.5 * scale, 17, 6 * scale,
            ],
            "circle-color": isDark ? "#66bb6a" : "#388e3c",
            "circle-stroke-color": isDark ? "#a5d6a7" : "#2e7d32",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.5,
            ],
            "circle-opacity": isDark ? 0.7 : 0.6,
          };
        },
      },
    ],
  },

  // ── Bus Stations (Intercity) ──
  {
    id: "busStationsIntercity",
    sourceUrl: "./bus_stations_intercity.geojson",
    sourceId: "bus-stations-intercity",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.busScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 2.5 * scale, 10, 6 * scale, 14, 12 * scale, 17, 18 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#ab47bc" : "#7b1fa2",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.busScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1 * scale, 10, 2 * scale, 14, 4 * scale, 17, 7 * scale,
            ],
            "circle-color": isDark ? "#ab47bc" : "#7b1fa2",
            "circle-stroke-color": isDark ? "#ce93d8" : "#6a1b9a",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.5,
            ],
            "circle-opacity": isDark ? 0.7 : 0.6,
          };
        },
      },
    ],
  },

  // ── Airports ──
  {
    id: "airports",
    sourceUrl: "./airports.geojson",
    sourceId: "airport-boundaries",
    layers: [
      {
        suffix: "glow-2",
        type: "line",
        paint: (isDark, params) => {
          const glow = params?.airportGlow ?? 0.8;
          return {
            "line-color": isDark ? "#ffffff" : "#daa520",
            "line-width": 30,
            "line-blur": 15,
            "line-opacity": glow * (isDark ? 0.06 : 0.15),
          };
        },
      },
      {
        suffix: "glow-1",
        type: "line",
        paint: (isDark, params) => {
          const glow = params?.airportGlow ?? 0.8;
          return {
            "line-color": isDark ? "#ffffff" : "#daa520",
            "line-width": 10,
            "line-blur": 5,
            "line-opacity": glow * (isDark ? 0.15 : 0.3),
          };
        },
      },
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark, params) => {
          const opacity = params?.airportOpacity ?? 0.12;
          return {
            "fill-color": isDark ? "#ffffff" : "#c89520",
            "fill-opacity": isDark ? opacity : opacity * 1.5,
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        paint: (isDark, params) => {
          const opacity = params?.airportOpacity ?? 0.12;
          return {
            "line-color": isDark ? "#ffffff" : "#c89520",
            "line-width": isDark ? 1.5 : 2,
            "line-opacity": Math.min(opacity * 3, isDark ? 0.5 : 0.7),
          };
        },
      },
    ],
  },
];
