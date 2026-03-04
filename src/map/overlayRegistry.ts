import type { OverlayConfig } from "../types";

const BASE_RADIUS = 5;

export const OVERLAY_REGISTRY: OverlayConfig[] = [
  // ── THSR Station Polygon (高鐵站) ──
  {
    id: "stationsTHSR",
    sourceUrl: "./station_polygons.geojson",
    sourceId: "station-polygons",
    filter: ["==", ["get", "system_id"], "thsr"],
    layers: [
      {
        suffix: "thsr-poly-glow-2",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ff8c00" : "#cc7000",
          "line-width": 15,
          "line-blur": 8,
          "line-opacity": isDark ? 0.08 : 0.14,
        }),
      },
      {
        suffix: "thsr-poly-glow-1",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ff8c00" : "#cc7000",
          "line-width": 6,
          "line-blur": 3,
          "line-opacity": isDark ? 0.15 : 0.28,
        }),
      },
      {
        suffix: "thsr-poly-fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#ff8c00" : "#e8a040",
          "fill-opacity": isDark ? 0.08 : 0.12,
        }),
      },
      {
        suffix: "thsr-poly-line",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ff8c00" : "#e8a040",
          "line-width": isDark ? 1 : 1.5,
          "line-opacity": isDark ? 0.35 : 0.55,
        }),
      },
    ],
  },

  // ── TRA Station Polygon (台鐵大站) ──
  {
    id: "stationsTRA",
    sourceUrl: "./station_polygons.geojson",
    sourceId: "station-polygons",
    filter: ["==", ["get", "system_id"], "tra"],
    layers: [
      {
        suffix: "tra-poly-glow-2",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#d4c4a8",
          "line-width": 15,
          "line-blur": 8,
          "line-opacity": isDark ? 0.06 : 0.12,
        }),
      },
      {
        suffix: "tra-poly-glow-1",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#d4c4a8",
          "line-width": 6,
          "line-blur": 3,
          "line-opacity": isDark ? 0.12 : 0.25,
        }),
      },
      {
        suffix: "tra-poly-fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#ffffff" : "#e8dcc8",
          "fill-opacity": isDark ? 0.08 : 0.12,
        }),
      },
      {
        suffix: "tra-poly-line",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ffffff" : "#e8dcc8",
          "line-width": isDark ? 1 : 1.5,
          "line-opacity": isDark ? 0.3 : 0.5,
        }),
      },
    ],
  },

  // ── TRA Station Points (台鐵小站) ──
  {
    id: "stationsTRA",
    sourceUrl: "./station_points.geojson",
    sourceId: "station-points",
    filter: ["==", ["get", "system_id"], "tra"],
    rebuildOnParamChange: ["tra-pt-glow-2", "tra-pt-glow-1", "tra-pt-fill"],
    layers: [
      {
        suffix: "tra-pt-glow-2",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * scale * 2.5,
            "circle-blur": 1,
            "circle-color": _isDark ? "#ffffff" : "#d4c4a8",
            "circle-opacity": _isDark ? 0.06 : 0.12,
          };
        },
      },
      {
        suffix: "tra-pt-glow-1",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * scale * 1.5,
            "circle-blur": 0.6,
            "circle-color": _isDark ? "#ffffff" : "#d4c4a8",
            "circle-opacity": _isDark ? 0.12 : 0.25,
          };
        },
      },
      {
        suffix: "tra-pt-fill",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * scale,
            "circle-color": _isDark ? "#b8a080" : "#a08060",
            "circle-opacity": _isDark ? 0.08 : 0.12,
            "circle-stroke-width": _isDark ? 1 : 1.5,
            "circle-stroke-color": _isDark ? "#b8a080" : "#a08060",
            "circle-stroke-opacity": _isDark ? 0.3 : 0.5,
          };
        },
      },
    ],
  },

  // ── Metro Station Points (捷運/輕軌站) ──
  {
    id: "stationsMetro",
    sourceUrl: "./station_points.geojson",
    sourceId: "station-points",
    filter: ["in", ["get", "system_id"], ["literal", ["trtc", "krtc", "klrt", "tmrt"]]],
    rebuildOnParamChange: ["metro-pt-glow-2", "metro-pt-glow-1", "metro-pt-fill"],
    layers: [
      {
        suffix: "metro-pt-glow-2",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * scale * 2.5,
            "circle-blur": 1,
            "circle-color": _isDark ? "#00bcd4" : "#00838f",
            "circle-opacity": _isDark ? 0.06 : 0.12,
          };
        },
      },
      {
        suffix: "metro-pt-glow-1",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * scale * 1.5,
            "circle-blur": 0.6,
            "circle-color": _isDark ? "#00bcd4" : "#00838f",
            "circle-opacity": _isDark ? 0.12 : 0.25,
          };
        },
      },
      {
        suffix: "metro-pt-fill",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * scale,
            "circle-color": ["get", "color"] as unknown as string,
            "circle-opacity": _isDark ? 0.08 : 0.12,
            "circle-stroke-width": _isDark ? 1 : 1.5,
            "circle-stroke-color": ["get", "color"] as unknown as string,
            "circle-stroke-opacity": _isDark ? 0.3 : 0.5,
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
    rebuildOnParamChange: ["glow-2", "glow-1"],
    layers: [
      {
        suffix: "glow-2",
        type: "line",
        paint: (isDark, params) => {
          const g = params?.portGlow ?? 1;
          return {
            "line-color": isDark ? "#88bbff" : "#3a7bd5",
            "line-width": 12 * g,
            "line-blur": 8 * g,
            "line-opacity": g * (isDark ? 0.04 : 0.10),
          };
        },
      },
      {
        suffix: "glow-1",
        type: "line",
        paint: (isDark, params) => {
          const g = params?.portGlow ?? 1;
          return {
            "line-color": isDark ? "#88bbff" : "#3a7bd5",
            "line-width": 5 * g,
            "line-blur": 3 * g,
            "line-opacity": g * (isDark ? 0.10 : 0.20),
          };
        },
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
    rebuildOnParamChange: ["glow", "line"],
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const g = params?.highwayGlow ?? 1;
          return {
            "line-color": isDark ? "#ff6b6b" : "#cc3333",
            "line-width": 8 * g,
            "line-blur": 6 * g,
            "line-opacity": g * (isDark ? 0.08 : 0.12),
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.highwayWidth ?? 1;
          return {
            "line-color": isDark ? "#ff6b6b" : "#cc3333",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.5 * w, 10, 1.5 * w, 13, 3 * w, 16, 5 * w,
            ],
            "line-opacity": isDark ? 0.6 : 0.5,
          };
        },
      },
    ],
  },

  // ── Provincial Road (省道) ──
  {
    id: "provincialRoads",
    sourceUrl: "./provincial_road.geojson",
    sourceId: "provincial-roads",
    rebuildOnParamChange: ["glow", "line"],
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const g = params?.provincialGlow ?? 1;
          return {
            "line-color": isDark ? "#ffa94d" : "#cc7722",
            "line-width": 6 * g,
            "line-blur": 5 * g,
            "line-opacity": g * (isDark ? 0.05 : 0.08),
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.provincialWidth ?? 1;
          return {
            "line-color": isDark ? "#ffa94d" : "#cc7722",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.3 * w, 10, 1 * w, 13, 2 * w, 16, 3.5 * w,
            ],
            "line-opacity": isDark ? 0.45 : 0.4,
          };
        },
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

  // ── Bike Stations ──
  {
    id: "bikeStations",
    sourceUrl: "./bike_stations.geojson",
    sourceId: "bike-stations",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.bikeScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#ffca28" : "#f9a825",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.bikeScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#ffca28" : "#f9a825",
            "circle-stroke-color": isDark ? "#ffe082" : "#f57f17",
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

  // ── Cycling Routes (自行車道) ──
  {
    id: "cyclingRoutes",
    sourceUrl: "./cycling_routes.geojson",
    sourceId: "cycling-routes",
    rebuildOnParamChange: ["glow", "line"],
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.cyclingWidth ?? 1;
          return {
            "line-color": isDark ? "#66bb6a" : "#388e3c",
            "line-width": 6 * w,
            "line-blur": 5,
            "line-opacity": isDark ? 0.06 : 0.10,
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.cyclingWidth ?? 1;
          return {
            "line-color": isDark ? "#66bb6a" : "#388e3c",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.3 * w, 10, 1 * w, 13, 2 * w, 16, 3.5 * w,
            ],
            "line-opacity": isDark ? 0.5 : 0.45,
          };
        },
      },
    ],
  },

  // ── Freeway Congestion (國道壅塞) ──
  {
    id: "freewayCongestion",
    sourceUrl: "./freeway_congestion.geojson",
    sourceId: "freeway-congestion",
    rebuildOnParamChange: ["glow", "line"],
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.freewayWidth ?? 1;
          return {
            "line-color": ["get", "CongestionColor"] as unknown as string,
            "line-width": 8 * w,
            "line-blur": 6,
            "line-opacity": _isDark ? 0.08 : 0.12,
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.freewayWidth ?? 1;
          return {
            "line-color": ["get", "CongestionColor"] as unknown as string,
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.5 * w, 10, 1.5 * w, 13, 3 * w, 16, 5 * w,
            ],
            "line-opacity": _isDark ? 0.7 : 0.6,
          };
        },
      },
    ],
  },

  // ── Weather Stations (氣象站) ──
  {
    id: "weatherStations",
    sourceUrl: "./weather_stations.geojson",
    sourceId: "weather-stations",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.weatherScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 2 * scale, 10, 5 * scale, 14, 10 * scale, 17, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#4dd0e1" : "#00838f",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.weatherScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.8 * scale, 10, 1.5 * scale, 14, 3.5 * scale, 17, 6 * scale,
            ],
            "circle-color": isDark ? "#4dd0e1" : "#00838f",
            "circle-stroke-color": isDark ? "#80deea" : "#006064",
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
  // ── Submarine Cables (通訊海纜) ──
  // cable_type 分色：國際幹線 藍、海峽專線 紅、離島連接 綠、中國境內 橘、規劃中 灰
  {
    id: "submarineCables",
    sourceUrl: "./submarine_cables.geojson",
    sourceId: "submarine-cables",
    layers: [
      {
        suffix: "glow",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark) => ({
          "line-color": [
            "match", ["get", "cable_type"],
            "國際幹線", "#2196F3",
            "海峽專線", "#F44336",
            "離島連接", "#4CAF50",
            "中國境內", "#FF9800",
            "規劃中", "#9E9E9E",
            "#9E9E9E",
          ] as unknown as string,
          "line-width": 6,
          "line-blur": 5,
          "line-opacity": isDark ? 0.15 : 0.20,
        }),
      },
      {
        suffix: "line",
        type: "line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark) => ({
          "line-color": [
            "match", ["get", "cable_type"],
            "國際幹線", "#2196F3",
            "海峽專線", "#F44336",
            "離島連接", "#4CAF50",
            "中國境內", "#FF9800",
            "規劃中", "#9E9E9E",
            "#9E9E9E",
          ] as unknown as string,
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            4, 1, 8, 1.5, 12, 2.5,
          ],
          "line-opacity": isDark ? 0.6 : 0.5,
        }),
      },
    ],
  },

  // ── Landing Stations (海纜登陸站) ──
  // station_type 分色：國際樞紐 藍、區域節點 青、端點 灰
  {
    id: "landingStations",
    sourceUrl: "./landing_stations.geojson",
    sourceId: "landing-stations",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.landingScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 3 * scale, 10, 6 * scale, 14, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": [
              "match", ["get", "station_type"],
              "國際樞紐", "#2196F3",
              "區域節點", "#26c6da",
              "#9E9E9E",
            ] as unknown as string,
            "circle-opacity": isDark ? 0.2 : 0.25,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.landingScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 3 * scale, 14, 5 * scale,
            ],
            "circle-color": [
              "match", ["get", "station_type"],
              "國際樞紐", "#2196F3",
              "區域節點", "#26c6da",
              "#9E9E9E",
            ] as unknown as string,
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.5, 14, 1,
            ],
            "circle-opacity": isDark ? 0.8 : 0.7,
          };
        },
      },
    ],
  },

  // ── Schools (學校) ──
  {
    id: "schools",
    sourceUrl: "./schools.geojson",
    sourceId: "schools",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.schoolScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#42a5f5" : "#1565c0",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.schoolScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#42a5f5" : "#1565c0",
            "circle-stroke-color": isDark ? "#90caf9" : "#0d47a1",
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

  // ── Convenience Stores (超商) ──
  {
    id: "convenienceStores",
    sourceUrl: "./convenience_stores.geojson",
    sourceId: "convenience-stores",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.convenienceScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#26c6da" : "#00838f",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.convenienceScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#26c6da" : "#00838f",
            "circle-stroke-color": isDark ? "#80deea" : "#006064",
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
];
