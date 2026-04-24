import type { OverlayConfig } from "../types";

const BASE_RADIUS = 5;

export const OVERLAY_REGISTRY: OverlayConfig[] = [
  // ── THSR Station Polygon (高鐵站) ──
  {
    id: "stationsTHSR",
    sourceUrl: "./geo/station_polygons.geojson",
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
    sourceUrl: "./geo/station_polygons.geojson",
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
    sourceUrl: "./geo/station_points.geojson",
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
    sourceUrl: "./geo/station_points.geojson",
    sourceId: "station-points",
    filter: ["in", ["get", "system_id"], ["literal", ["trtc", "krtc", "klrt", "tmrt"]]],
    rebuildOnParamChange: ["metro-pt-range", "metro-pt-glow-2", "metro-pt-glow-1", "metro-pt-fill"],
    layers: [
      {
        suffix: "metro-pt-range",
        type: "circle",
        minzoom: 11,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const is3d = (params?.metroPillar3d ?? 0) > 0;
          return {
            "circle-radius": BASE_RADIUS * scale * 8,
            "circle-blur": 0.8,
            "circle-color": _isDark ? "#ffffff" : "#00838f",
            "circle-opacity": is3d ? (_isDark ? 0.04 : 0.08) : (_isDark ? 0.03 : 0.06),
          };
        },
      },
      {
        suffix: "metro-pt-glow-2",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const is3d = (params?.metroPillar3d ?? 0) > 0;
          return {
            "circle-radius": BASE_RADIUS * scale * 2.5,
            "circle-blur": 1,
            "circle-color": _isDark ? "#00bcd4" : "#00838f",
            "circle-opacity": is3d ? 0 : (_isDark ? 0.06 : 0.12),
          };
        },
      },
      {
        suffix: "metro-pt-glow-1",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const is3d = (params?.metroPillar3d ?? 0) > 0;
          return {
            "circle-radius": BASE_RADIUS * scale * 1.5,
            "circle-blur": 0.6,
            "circle-color": _isDark ? "#00bcd4" : "#00838f",
            "circle-opacity": is3d ? 0 : (_isDark ? 0.12 : 0.25),
          };
        },
      },
      {
        suffix: "metro-pt-fill",
        type: "circle",
        minzoom: 10,
        paint: (_isDark, params) => {
          const scale = params?.stationScale ?? 1;
          const is3d = (params?.metroPillar3d ?? 0) > 0;
          return {
            "circle-radius": BASE_RADIUS * scale,
            "circle-color": ["get", "color"] as unknown as string,
            "circle-opacity": is3d ? 0 : (_isDark ? 0.08 : 0.12),
            "circle-stroke-width": _isDark ? 1 : 1.5,
            "circle-stroke-color": ["get", "color"] as unknown as string,
            "circle-stroke-opacity": is3d ? 0 : (_isDark ? 0.3 : 0.5),
          };
        },
      },
    ],
  },

  // ── Ports ──
  {
    id: "ports",
    sourceUrl: "./geo/port_polygons.geojson",
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
    sourceUrl: "./geo/lighthouse.geojson",
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
    sourceUrl: "./geo/national_highway.geojson",
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
    sourceUrl: "./geo/provincial_road.geojson",
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
    sourceUrl: "./geo/wind_plan.geojson",
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
    sourceUrl: "./geo/bus_stations_city.geojson",
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
    sourceUrl: "./geo/bus_stations_intercity.geojson",
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
    sourceUrl: "./geo/bike_stations.geojson",
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
    sourceUrl: "./geo/cycling_routes.geojson",
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
  // 已改由 useFreewayLayer (src/hooks/useFreewayLayer.ts) 動態管理：
  // 從 Supabase realtime.freeway_sections 依 timeline 回放，不再使用靜態 GeoJSON

  // ── Weather Stations (氣象站) ──
  {
    id: "weatherStations",
    sourceUrl: "./geo/weather_stations.geojson",
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
    sourceUrl: "./geo/airports.geojson",
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
    sourceUrl: "./geo/submarine_cables.geojson",
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
    sourceUrl: "./geo/landing_stations.geojson",
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
    sourceUrl: "./geo/schools.geojson",
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
          const useLevelColor = (params?.schoolLevelColor ?? 0) > 0;
          const color = useLevelColor
            ? [
                "match", ["get", "school_level"],
                "國民小學", "#66bb6a", "附設國民小學", "#66bb6a",
                "國民中學", "#ffa726", "附設國民中學", "#ffa726",
                "高級中等學校", "#ef5350",
                "大專校院", "#ab47bc", "宗教研修學院", "#ab47bc",
                "空中大學", "#ab47bc", "專科學校", "#ab47bc",
                "特殊教育學校", "#78909c",
                isDark ? "#42a5f5" : "#1565c0",
              ] as unknown as string
            : (isDark ? "#42a5f5" : "#1565c0");
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": color,
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
    sourceUrl: "./geo/convenience_stores.geojson",
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

  // ── News Events (新聞事件) ──
  {
    id: "newsEvents",
    sourceUrl: "./geo/news_events.geojson",
    sourceId: "news-events",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const s = params?.newsScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 6 * s, 10, 12 * s, 14, 18 * s,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#ff9800" : "#e65100",
            "circle-opacity": isDark ? 0.15 : 0.18,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const s = params?.newsScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 3 * s, 10, 5 * s, 14, 8 * s,
            ],
            "circle-color": [
              "case",
              ["==", ["get", "is_primary"], true],
              isDark ? "#ff9800" : "#e65100",
              isDark ? "#ffcc80" : "#ff9800",
            ] as unknown as string,
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              5, 0, 10, 0.5, 14, 1,
            ],
            "circle-opacity": isDark ? 0.85 : 0.75,
          };
        },
      },
    ],
  },

  // ── Active Faults (活動斷層地質敏感區) ──
  {
    id: "activeFaults",
    sourceUrl: "./geo/active_faults.geojson",
    sourceId: "active-faults",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ef5350" : "#c62828",
          "line-width": 8,
          "line-blur": 6,
          "line-opacity": isDark ? 0.08 : 0.12,
        }),
      },
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#ef5350" : "#e53935",
          "fill-opacity": isDark ? 0.12 : 0.15,
        }),
      },
      {
        suffix: "line",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#ef5350" : "#c62828",
          "line-width": isDark ? 1.5 : 2,
          "line-opacity": isDark ? 0.5 : 0.6,
        }),
      },
    ],
  },

  // ── 流域 Basin (polygon outline) ──
  {
    id: "waterBasins",
    sourceUrl: "./geo/water_basins.geojson",
    sourceId: "water-basins",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#4dd0e1" : "#0891b2",
          "line-width": 8,
          "line-blur": 5,
          "line-opacity": (isDark ? 0.18 : 0.15) * (p?.waterBasinOpacity ?? 1),
        }),
      },
      {
        suffix: "line",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#4dd0e1" : "#0891b2",
          "line-width": isDark ? 0.8 : 1.2,
          "line-opacity": (isDark ? 0.55 : 0.65) * (p?.waterBasinOpacity ?? 1),
          "line-dasharray": [2, 2],
        }),
      },
    ],
  },

  // ── 河川 River (河道多邊形 — 河床面，補齊 river_lines 缺漏的支流) ──
  {
    id: "waterRivers",
    sourceUrl: "./geo/water_river_polygons.geojson",
    sourceId: "water-river-polygons",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#38bdf8" : "#0284c7",
          "line-width": 4 * (p?.waterRiverWidth ?? 1),
          "line-blur": 3,
          "line-opacity": (isDark ? 0.2 : 0.15) * (p?.waterRiverOpacity ?? 1),
        }),
      },
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark, p) => ({
          "fill-color": isDark ? "#38bdf8" : "#0284c7",
          "fill-opacity": (isDark ? 0.25 : 0.22) * (p?.waterRiverOpacity ?? 1),
        }),
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#7dd3fc" : "#0369a1",
          "line-width": 0.6 * (p?.waterRiverWidth ?? 1),
          "line-opacity": (isDark ? 0.7 : 0.6) * (p?.waterRiverOpacity ?? 1),
        }),
      },
    ],
  },

  // ── 河川 River (line, 中央管主流 transmission-like glow) ──
  {
    id: "waterRivers",
    sourceUrl: "./geo/water_rivers.geojson",
    sourceId: "water-rivers",
    layers: [
      {
        suffix: "glow-2",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#38bdf8" : "#0284c7",
          "line-width": 10 * (p?.waterRiverWidth ?? 1),
          "line-blur": 7,
          "line-opacity": (isDark ? 0.12 : 0.1) * (p?.waterRiverOpacity ?? 1),
        }),
      },
      {
        suffix: "glow-1",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#38bdf8" : "#0284c7",
          "line-width": 4 * (p?.waterRiverWidth ?? 1),
          "line-blur": 2.5,
          "line-opacity": (isDark ? 0.3 : 0.28) * (p?.waterRiverOpacity ?? 1),
        }),
      },
      {
        suffix: "core",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#7dd3fc" : "#0369a1",
          "line-width": (isDark ? 1.2 : 1.6) * (p?.waterRiverWidth ?? 1),
          "line-opacity": (isDark ? 0.85 : 0.85) * (p?.waterRiverOpacity ?? 1),
        }),
      },
    ],
  },

  // ── 堤防 Levee (amber line — 4,222 筆防洪骨架；status=待建 用 case expression 淡化) ──
  {
    id: "waterLevees",
    sourceUrl: "./geo/water_levees.geojson",
    sourceId: "water-levees",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#f59e0b" : "#b45309",
          "line-width": 3 * (p?.waterLeveeWidth ?? 1),
          "line-blur": 2,
          "line-opacity": ["case",
            ["==", ["get", "status"], "待建"], 0.08 * (p?.waterLeveeOpacity ?? 1),
            (isDark ? 0.22 : 0.18) * (p?.waterLeveeOpacity ?? 1),
          ],
        }),
      },
      {
        suffix: "core",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": ["case",
            ["==", ["get", "status"], "待建"], (isDark ? "#fcd34d" : "#b45309"),
            (isDark ? "#fbbf24" : "#92400e"),
          ],
          "line-width": (isDark ? 0.9 : 1.1) * (p?.waterLeveeWidth ?? 1),
          "line-opacity": ["case",
            ["==", ["get", "status"], "待建"], 0.45 * (p?.waterLeveeOpacity ?? 1),
            (isDark ? 0.85 : 0.8) * (p?.waterLeveeOpacity ?? 1),
          ],
        }),
      },
    ],
  },

  // ── 渠道 Canal (thin purple, low-voltage look) ──
  {
    id: "waterCanals",
    sourceUrl: "./geo/water_canals.geojson",
    sourceId: "water-canals",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#a78bfa" : "#7c3aed",
          "line-width": 3 * (p?.waterCanalWidth ?? 1),
          "line-blur": 2,
          "line-opacity": (isDark ? 0.22 : 0.18) * (p?.waterCanalOpacity ?? 1),
        }),
      },
      {
        suffix: "core",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": isDark ? "#a78bfa" : "#7c3aed",
          "line-width": (isDark ? 0.5 : 0.8) * (p?.waterCanalWidth ?? 1),
          "line-opacity": (isDark ? 0.7 : 0.75) * (p?.waterCanalOpacity ?? 1),
        }),
      },
    ],
  },

  // ── 水資源管制區 (水源保護區 + 地下水管制區，合併 128 polygon) ──
  // zone_kind 分 4 種，fill 顏色各異：
  //   protection             (107)  飲用水水源保護區  → emerald 綠
  //   groundwater_control_2  (11)   禁止超抽          → red 紅（警告）
  //   groundwater_control_1  (1)    限制超抽          → orange 橙
  //   groundwater_region     (9)    地下水分區面      → neutral 灰（僅輪廓薄化）
  {
    id: "waterProtectionZones",
    sourceUrl: "./geo/water_protection_zones.geojson",
    sourceId: "water-protection-zones",
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark, p) => ({
          "fill-color": ["match", ["get", "zone_kind"],
            "protection",            (isDark ? "#10b981" : "#047857"),
            "groundwater_control_2", (isDark ? "#ef4444" : "#b91c1c"),
            "groundwater_control_1", (isDark ? "#f97316" : "#c2410c"),
            "groundwater_region",    (isDark ? "#94a3b8" : "#64748b"),
            /* default */            (isDark ? "#94a3b8" : "#64748b"),
          ],
          "fill-opacity": ["match", ["get", "zone_kind"],
            "protection",            0.32 * (p?.waterProtectionZoneOpacity ?? 1),
            "groundwater_control_2", 0.40 * (p?.waterProtectionZoneOpacity ?? 1),
            "groundwater_control_1", 0.35 * (p?.waterProtectionZoneOpacity ?? 1),
            "groundwater_region",    0.08 * (p?.waterProtectionZoneOpacity ?? 1),
            /* default */            0.2 * (p?.waterProtectionZoneOpacity ?? 1),
          ],
        }),
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": ["match", ["get", "zone_kind"],
            "protection",            (isDark ? "#34d399" : "#065f46"),
            "groundwater_control_2", (isDark ? "#fca5a5" : "#991b1b"),
            "groundwater_control_1", (isDark ? "#fdba74" : "#9a3412"),
            "groundwater_region",    (isDark ? "#cbd5e1" : "#475569"),
            /* default */            (isDark ? "#cbd5e1" : "#475569"),
          ],
          "line-width": ["match", ["get", "zone_kind"],
            "groundwater_region", 0.6,
            /* default */         1.2,
          ],
          "line-opacity": (isDark ? 0.75 : 0.7) * (p?.waterProtectionZoneOpacity ?? 1),
        }),
      },
    ],
  },

  // ── 水庫 Reservoir (polygon — 蓄水範圍) ──
  {
    id: "waterReservoirs",
    sourceUrl: "./geo/water_reservoirs.geojson",
    sourceId: "water-reservoir-poly",
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#22d3ee" : "#0891b2",
          "line-width": 10,
          "line-blur": 6,
          "line-opacity": isDark ? 0.25 : 0.2,
        }),
      },
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark) => ({
          "fill-color": isDark ? "#06b6d4" : "#0891b2",
          "fill-opacity": isDark ? 0.35 : 0.3,
        }),
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "#67e8f9" : "#0e7490",
          "line-width": isDark ? 1 : 1.2,
          "line-opacity": isDark ? 0.8 : 0.8,
        }),
      },
    ],
  },

  // 2026-04-22: ② 光球 bubble + ③ 靜態 pillar 已由 Three.js 水位計取代
  // （src/three/ReservoirScene.ts，外殼容量 + 內水位蓄水率）

  // ── 水庫 Reservoir (point — 壩體，白色發光節點像 Atlas power plants) ──
  {
    id: "waterReservoirs",
    sourceUrl: "./geo/water_dams.geojson",
    sourceId: "water-reservoir-dams",
    layers: [
      {
        suffix: "glow-2",
        type: "circle",
        paint: (isDark) => ({
          "circle-radius": [
            "interpolate", ["linear"], ["coalesce", ["get", "dam_height_m"], 20],
            0, 10, 50, 22, 200, 34,
          ],
          "circle-color": "#ffffff",
          "circle-blur": 1.8,
          "circle-opacity": isDark ? 0.35 : 0.28,
        }),
      },
      {
        suffix: "glow-1",
        type: "circle",
        paint: (isDark) => ({
          "circle-radius": [
            "interpolate", ["linear"], ["coalesce", ["get", "dam_height_m"], 20],
            0, 5, 50, 10, 200, 16,
          ],
          "circle-color": "#ffffff",
          "circle-blur": 0.8,
          "circle-opacity": isDark ? 0.7 : 0.55,
        }),
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark) => ({
          "circle-radius": [
            "interpolate", ["linear"], ["coalesce", ["get", "dam_height_m"], 20],
            0, 2.5, 50, 4.5, 200, 7,
          ],
          "circle-color": isDark ? "#ffffff" : "#0e7490",
          "circle-stroke-color": isDark ? "#67e8f9" : "#0891b2",
          "circle-stroke-width": 1.2,
          "circle-opacity": 1,
        }),
      },
    ],
  },

  // ── 水利設施 Facility (抽水/淨水/水塔) ──
  {
    id: "waterFacilities",
    sourceUrl: "./geo/water_facilities.geojson",
    sourceId: "water-facilities",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, p) => ({
          "circle-radius": 7 * (p?.waterFacilityScale ?? 1),
          "circle-color": [
            "match", ["get", "facility_type"],
            "pump_station", "#60a5fa",
            "pump_station_official", "#2563eb",
            "treatment_plant", "#34d399",
            "water_tower", "#fbbf24",
            "#9ca3af",
          ],
          "circle-blur": 1.2,
          "circle-opacity": (isDark ? 0.4 : 0.3) * (p?.waterFacilityOpacity ?? 1),
        }),
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, p) => ({
          "circle-radius": 3 * (p?.waterFacilityScale ?? 1),
          "circle-color": [
            "match", ["get", "facility_type"],
            "pump_station", "#60a5fa",
            "pump_station_official", "#2563eb",
            "treatment_plant", "#34d399",
            "water_tower", "#fbbf24",
            "#9ca3af",
          ],
          "circle-stroke-color": isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)",
          "circle-stroke-width": 0.6,
          "circle-opacity": 0.95 * (p?.waterFacilityOpacity ?? 1),
        }),
      },
    ],
  },

  // ── 淹水潛勢 (flood_650mm_24hr, 極端情境；可調 floodMinDepth 篩選) ──
  {
    id: "waterFloodExtreme",
    sourceUrl: "./geo/water_flood_extreme.geojson",
    sourceId: "water-flood-extreme",
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark, params) => {
          // floodMinDepth: 0 (全部) / 0.5 / 1 / 2 / 3
          const min = params?.floodMinDepth ?? 0;
          const ALL_CLASSES = ["0.3-0.5", "0.5-1.0", "1.0-2.0", "2.0-3.0", ">3.0"];
          // 每個 class 對應的下限（m）
          const CLASS_MIN: Record<string, number> = {
            "0.3-0.5": 0.3, "0.5-1.0": 0.5, "1.0-2.0": 1.0, "2.0-3.0": 2.0, ">3.0": 3.0,
          };
          const visible = ALL_CLASSES.filter((c) => (CLASS_MIN[c] ?? 0) >= min);
          const fullOpacity = (isDark ? 0.55 : 0.5) * (params?.waterFloodOpacity ?? 1);
          return {
            "fill-color": [
              "match", ["get", "depth_class"],
              "0.3-0.5", "#fee2e2",
              "0.5-1.0", "#fca5a5",
              "1.0-2.0", "#f87171",
              "2.0-3.0", "#dc2626",
              ">3.0", "#7f1d1d",
              "#fca5a5",
            ],
            "fill-opacity": [
              "case",
              ["in", ["get", "depth_class"], ["literal", visible]],
              fullOpacity,
              0,
            ],
          };
        },
      },
      {
        suffix: "glow",
        type: "line",
        paint: (isDark, params) => {
          const min = params?.floodMinDepth ?? 0;
          const ALL_CLASSES = ["0.3-0.5", "0.5-1.0", "1.0-2.0", "2.0-3.0", ">3.0"];
          const CLASS_MIN: Record<string, number> = {
            "0.3-0.5": 0.3, "0.5-1.0": 0.5, "1.0-2.0": 1.0, "2.0-3.0": 2.0, ">3.0": 3.0,
          };
          const visible = ALL_CLASSES.filter((c) => (CLASS_MIN[c] ?? 0) >= min);
          const op = params?.waterFloodOpacity ?? 1;
          return {
            "line-color": "#fb7185",
            "line-width": 3,
            "line-blur": 2,
            "line-opacity": [
              "case",
              ["in", ["get", "depth_class"], ["literal", visible]],
              (isDark ? 0.3 : 0.2) * op,
              0,
            ],
          };
        },
      },
    ],
  },

  // ── 監測站 Monitor (雨量/水位/地下水) ──
  {
    id: "waterMonitorStations",
    sourceUrl: "./geo/water_monitor_stations.geojson",
    sourceId: "water-monitor-stations",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, p) => ({
          "circle-radius": 5 * (p?.waterMonitorScale ?? 1),
          "circle-color": [
            "match", ["get", "station_type"],
            "rain_gauge", "#60a5fa",
            "river_level", "#22d3ee",
            "groundwater_well", "#f472b6",
            "#9ca3af",
          ],
          "circle-blur": 1,
          "circle-opacity": (isDark ? 0.35 : 0.25) * (p?.waterMonitorOpacity ?? 1),
        }),
      },
      {
        suffix: "core",
        type: "circle",
        paint: (_isDark, p) => ({
          "circle-radius": 2 * (p?.waterMonitorScale ?? 1),
          "circle-color": [
            "match", ["get", "station_type"],
            "rain_gauge", "#93c5fd",
            "river_level", "#67e8f9",
            "groundwater_well", "#f9a8d4",
            "#d1d5db",
          ],
          "circle-opacity": 0.9,
        }),
      },
    ],
  },
];
