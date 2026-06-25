import type { OverlayConfig } from "../types";
import { ECO_NETWORK_ZONE_MATCH } from "../data/ecoNetworkZoneTypes";
import { FOREST_RESERVE_TYPE_MATCH } from "../data/forestReserveTypes";
import { NEWS_CATEGORY_COLOR_EXPR } from "../data/newsEventTypes";

const BASE_RADIUS = 5;

// ── 雲林覆蓋 PMTiles factory（5 layer 共用） ──
//   nearest distance 5 級色階：0-5km 深綠 / 5-10km 草綠 / 10-20km 黃 / 20-30km 橙 / 30km+ 紅
//   gas palette：「遠 = 沒油 = 警示紅」；ev palette：「遠 = 孤島 = 警示紅」（同方向）
//   ev 將「充足區間」改低調灰，凸顯偏遠 — 與加油站視覺區隔。
type CoveragePalette = "gas" | "ev";
function coverageColorExpr(palette: CoveragePalette): unknown[] {
  if (palette === "ev") {
    return [
      "match", ["get", "band"],
      "0-5km",    "rgba(150,150,150,0.4)",
      "5-10km",   "rgba(150,150,150,0.5)",
      "10-20km",  "#F2D64B",
      "20-30km",  "#F2A516",
      "over-30km","#F23535",
      "#7F1D1D",
    ];
  }
  return [
    "match", ["get", "band"],
    "0-5km",    "#16A34A",
    "5-10km",   "#84CC16",
    "10-20km",  "#F2D64B",
    "20-30km",  "#F2A516",
    "over-30km","#F23535",
    "#7F1D1D",
  ];
}
function gasCoverageOverlay(opts: {
  id: OverlayConfig["id"];
  sourceId: string;
  pmtilesUrl: string;
  sourceLayer: string;
  opacityKey: string;
  widthKey: string;
  palette: CoveragePalette;
}): OverlayConfig[] {
  const { id, sourceId, pmtilesUrl, sourceLayer, opacityKey, widthKey, palette } = opts;
  const defaultOpacity = palette === "ev" ? 0.6 : 0.85;
  return [{
    id,
    sourceUrl: pmtilesUrl,
    sourceId,
    pmtiles: { sourceLayer, minzoom: 6, maxzoom: 12 },
    rebuildOnParamChange: [opacityKey, widthKey],
    layers: [
      {
        suffix: "line",
        type: "line",
        paint: (_isDark, params) => {
          const o = params?.[opacityKey] ?? defaultOpacity;
          const w = params?.[widthKey] ?? 0.5;
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "line-color": coverageColorExpr(palette) as any,
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              6, w,
              10, w * 2.5,
              14, w * 5,
            ],
            "line-opacity": o,
          };
        },
      },
    ],
  }];
}

// ── 房地產 REAL ESTATE factory（3 類 × {grid 150m, point}，共 2 個 PMTiles source） ──
//   grid 依 price_per_sqm_median 上色、point 依 price_per_sqm；domain 單位 NT$/m²。
//   period filter 由 useRealEstateTimeline 用 setFilter 動態切換（realtime→ALL / historical→當季）。
//   ⚠️ 不用 rebuildOnParamChange：opacity 走 paint diff（setPaintProperty），避免 rebuild 洗掉 setFilter。
type RePalette = "rental" | "sale" | "presale";
// 每類：色票（low→high）+ 含雙北 domain + 排除雙北壓縮 domain（雙北房價過高會壓縮色階）。
// 色票科學分歧/序列、high=貴=紅、low 在深色底圖可辨識。domainExcl 由資料 p99（不含雙北）決定。
export const RE_PALETTES: Record<RePalette, { colors: string[]; domain: [number, number]; domainExcl: [number, number] }> = {
  // domain ≈ 全體 p95；domainExcl ≈ 排除雙北 p95（sale max 是 3200 萬 outlier，故用 p95 封頂）
  rental:  { colors: ["#41919A", "#7DB3B8", "#B3D6D8", "#EAB49C", "#D17A57", "#B33C1B"], domain: [92, 518], domainExcl: [92, 386] },
  sale:    { colors: ["#1a9850", "#f7f7f7", "#d73027"], domain: [28480, 227802], domainExcl: [28480, 147000] },
  presale: { colors: ["#ffffb2", "#fd8d3c", "#bd0026"], domain: [72845, 387844], domainExcl: [72845, 202000] },
};
function reColorExpr(palette: RePalette, field: string, excludeTaipei: boolean): unknown[] {
  const p = RE_PALETTES[palette];
  const [lo, hi] = excludeTaipei ? p.domainExcl : p.domain;
  const n = p.colors.length;
  const stops = p.colors.flatMap((c, i) => [lo + ((hi - lo) * i) / (n - 1), c]);
  return ["interpolate", ["linear"], ["coalesce", ["get", field], 0], ...stops];
}
function realEstateGridOverlay(id: OverlayConfig["id"], palette: RePalette, type: string): OverlayConfig {
  return {
    id,
    sourceUrl: "./coverage/real_estate_grid.pmtiles",
    sourceId: "re-grid",
    pmtiles: { sourceLayer: "real_estate_grid", minzoom: 6, maxzoom: 14 },
    // 初始 = realtime 全期靜態（period=ALL）；historical 模式由 hook 改成當季
    filter: ["all", ["==", ["get", "type"], type], ["==", ["get", "period"], "ALL"]],
    layers: [
      {
        suffix: `${type}-fill`,
        type: "fill",
        paint: (_isDark, params) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "fill-color": reColorExpr(palette, "price_per_sqm_median", !!(params?.realEstateExcludeTaipei)) as any,
          "fill-opacity": params?.realEstateOpacity ?? 0.7,
        }),
      },
      {
        suffix: `${type}-line`,
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
          "line-width": 0.3,
        }),
      },
    ],
  };
}

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
    sourceUrl: "./geo/national_highway.pmtiles",
    sourceId: "national-highways",
    pmtiles: { sourceLayer: "national_highway", minzoom: 0, maxzoom: 13 },
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
    sourceUrl: "./geo/provincial_road.pmtiles",
    sourceId: "provincial-roads",
    pmtiles: { sourceLayer: "provincial_road", minzoom: 0, maxzoom: 13 },
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
    sourceUrl: "./geo/bus_stations_city.pmtiles",
    sourceId: "bus-stations-city",
    pmtiles: { sourceLayer: "bus_stations_city", minzoom: 0, maxzoom: 12 },
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
  // ── CCTV (道路 CCTV 攝影機，~6,129 點) ──
  // source 分色：freeway 橙 / highway 黃 / city 青
  {
    id: "cctv",
    sourceUrl: "./geo/cctv.geojson",
    sourceId: "cctv",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        minzoom: 7,
        paint: (isDark, p) => {
          const scale = p?.cctvScale ?? 1;
          const opacity = p?.cctvOpacity ?? 0.7;
          const z = p?.cctvZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              7, 1.5 * scale, 11, 4 * scale, 14, 8 * scale, 17, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": [
              "match", ["get", "source"],
              "freeway", "#ff9800",
              "highway", "#ffd54f",
              "city", "#26c6da",
              "#26c6da",
            ] as unknown as string,
            "circle-opacity": (isDark ? 0.15 : 0.18) * opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        minzoom: 7,
        paint: (isDark, p) => {
          const scale = p?.cctvScale ?? 1;
          const opacity = p?.cctvOpacity ?? 0.7;
          const z = p?.cctvZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              7, 0.6 * scale, 11, 1.4 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": [
              "match", ["get", "source"],
              "freeway", "#ff9800",
              "highway", "#ffd54f",
              "city", "#26c6da",
              "#26c6da",
            ] as unknown as string,
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              7, 0, 11, 0.3, 14, 0.5,
            ],
            "circle-opacity": opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
    ],
  },

  // ── 消防分隊 (全台 22 縣市，677 點) ──
  // cat 分色：大隊 深紅 / 分隊 紅 / 分駐所 橘 / 其他 灰
  {
    id: "fireStations",
    sourceUrl: "./geo/fire_stations.geojson",
    sourceId: "fire-stations",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        minzoom: 7,
        paint: (isDark, p) => {
          const scale = p?.fireStationsScale ?? 1;
          const opacity = p?.fireStationsOpacity ?? 0.85;
          const z = p?.fireStationsZ ?? 0;
          // 半徑依階級分大小（大隊最大 → 分駐所/其他 最小）。
          // 注意：["zoom"] 必須在 interpolate 最上層，cat 倍率要放進每個 stop 的輸出（match）。
          const catR = (b: number) => [
            "match", ["get", "cat"],
            "大隊", b * 1.8, "分隊", b * 1.2, "分駐所", b * 0.85, b * 0.6,
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              7, catR(2 * scale), 11, catR(5 * scale), 14, catR(9 * scale), 17, catR(14 * scale),
            ] as unknown as number,
            "circle-blur": 1,
            "circle-color": [
              "match", ["get", "cat"],
              "大隊", "#b71c1c",
              "分隊", "#e53935",
              "分駐所", "#ff7043",
              "#bdbdbd",
            ] as unknown as string,
            // 散點 toggle 關閉 → opacity 0（仍可被 queryRenderedFeatures 命中 → popup 照常）
            "circle-opacity": (isDark ? 0.16 : 0.2) * opacity * (p?.fireStationsDots ?? 1),
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        minzoom: 7,
        paint: (isDark, p) => {
          const scale = p?.fireStationsScale ?? 1;
          const opacity = p?.fireStationsOpacity ?? 0.85;
          const z = p?.fireStationsZ ?? 0;
          const dots = p?.fireStationsDots ?? 1;
          const catR = (b: number) => [
            "match", ["get", "cat"],
            "大隊", b * 1.8, "分隊", b * 1.2, "分駐所", b * 0.85, b * 0.6,
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              7, catR(1 * scale), 11, catR(2.2 * scale), 14, catR(4 * scale), 17, catR(6.5 * scale),
            ] as unknown as number,
            "circle-color": [
              "match", ["get", "cat"],
              "大隊", "#b71c1c",
              "分隊", "#e53935",
              "分駐所", "#ff7043",
              "#bdbdbd",
            ] as unknown as string,
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              7, 0, 11, 0.5, 14, 1,
            ],
            "circle-opacity": opacity * dots,
            "circle-stroke-opacity": dots,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
    ],
  },

  // ── 消防栓 (僅臺北市 + 高雄市，69,839 點) ──
  // cat 分色：地上式 藍 / 地下式 青 / 其他 灰藍；70k 點 → minzoom 12 控密度
  {
    id: "fireHydrants",
    sourceUrl: "./geo/fire_hydrants.pmtiles",
    sourceId: "fire-hydrants",
    pmtiles: { sourceLayer: "fire_hydrants", minzoom: 0, maxzoom: 12 },
    layers: [
      {
        suffix: "glow",
        type: "circle",
        minzoom: 12,
        paint: (isDark, p) => {
          const scale = p?.fireHydrantsScale ?? 1;
          const opacity = p?.fireHydrantsOpacity ?? 0.7;
          const z = p?.fireHydrantsZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              12, 1.5 * scale, 15, 4 * scale, 18, 8 * scale,
            ],
            "circle-blur": 1,
            "circle-color": [
              "match", ["get", "cat"],
              "地上式", "#2196f3",
              "地下式", "#00acc1",
              "#90a4ae",
            ] as unknown as string,
            "circle-opacity": (isDark ? 0.14 : 0.18) * opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        minzoom: 12,
        paint: (isDark, p) => {
          const scale = p?.fireHydrantsScale ?? 1;
          const opacity = p?.fireHydrantsOpacity ?? 0.7;
          const z = p?.fireHydrantsZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              12, 0.8 * scale, 15, 2 * scale, 18, 4.5 * scale,
            ],
            "circle-color": [
              "match", ["get", "cat"],
              "地上式", "#2196f3",
              "地下式", "#00acc1",
              "#90a4ae",
            ] as unknown as string,
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              12, 0, 15, 0.4, 18, 0.8,
            ],
            "circle-opacity": opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
    ],
  },

  // 救援等時圈 coverage 已改用 PMTiles 向量切片（src/map/fireIsochroneLayerFactory.ts），
  // 不走 overlayRegistry。理由：GeoJSON 全台高頂點多邊形要麼大要麼簡化變醜，
  // PMTiles 依縮放/視窗分級載入，又清晰又流暢。

  // ── ETC Gantry (國道收費門架，341 點) ──
  {
    id: "etcGantry",
    sourceUrl: "./geo/etc_gantry.geojson",
    sourceId: "etc-gantry",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.etcGantryScale ?? 1;
          const opacity = p?.etcGantryOpacity ?? 0.8;
          const z = p?.etcGantryZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 2 * scale, 10, 5 * scale, 14, 10 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#f06292" : "#c2185b",
            "circle-opacity": (isDark ? 0.18 : 0.2) * opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.etcGantryScale ?? 1;
          const opacity = p?.etcGantryOpacity ?? 0.8;
          const z = p?.etcGantryZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1 * scale, 10, 2.2 * scale, 14, 4 * scale,
            ],
            "circle-color": isDark ? "#f06292" : "#c2185b",
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.4, 14, 0.7,
            ],
            "circle-opacity": opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
    ],
  },

  // ── Service Area (國道服務區，22 點) ──
  {
    id: "serviceArea",
    sourceUrl: "./geo/service_area.geojson",
    sourceId: "service-area",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.serviceAreaScale ?? 1.4;
          const opacity = p?.serviceAreaOpacity ?? 0.85;
          const z = p?.serviceAreaZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 4 * scale, 10, 9 * scale, 14, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#4db6ac" : "#00897b",
            "circle-opacity": (isDark ? 0.2 : 0.25) * opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.serviceAreaScale ?? 1.4;
          const opacity = p?.serviceAreaOpacity ?? 0.85;
          const z = p?.serviceAreaZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 2 * scale, 10, 4 * scale, 14, 7 * scale,
            ],
            "circle-color": isDark ? "#4db6ac" : "#00897b",
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.3, 10, 0.6, 14, 1,
            ],
            "circle-opacity": opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
    ],
  },

  // ── Service Area Polygon (國道服務區範圍，19 面) ──
  {
    id: "serviceAreaPolygon",
    sourceUrl: "./geo/service_area_polygon.geojson",
    sourceId: "service-area-polygon",
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (isDark, p) => {
          const opacity = p?.serviceAreaPolygonOpacity ?? 0.2;
          return {
            "fill-color": isDark ? "#4db6ac" : "#00897b",
            "fill-opacity": isDark ? opacity : opacity * 1.3,
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        paint: (isDark, p) => {
          const width = p?.serviceAreaPolygonLineWidth ?? 1.5;
          return {
            "line-color": isDark ? "#4db6ac" : "#00897b",
            "line-width": width,
            "line-opacity": isDark ? 0.6 : 0.75,
          };
        },
      },
    ],
  },

  // ── Taxi Stand (計程車招呼站，224 點) ──
  {
    id: "taxiStand",
    sourceUrl: "./geo/taxi_stand.geojson",
    sourceId: "taxi-stand",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.taxiStandScale ?? 1;
          const opacity = p?.taxiStandOpacity ?? 0.8;
          const z = p?.taxiStandZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, 2 * scale, 12, 6 * scale, 16, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#ffd54f" : "#f9a825",
            "circle-opacity": (isDark ? 0.18 : 0.2) * opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.taxiStandScale ?? 1;
          const opacity = p?.taxiStandOpacity ?? 0.8;
          const z = p?.taxiStandZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, 1 * scale, 12, 2.5 * scale, 16, 5 * scale,
            ],
            "circle-color": isDark ? "#ffd54f" : "#f9a825",
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              8, 0, 12, 0.4, 16, 0.7,
            ],
            "circle-opacity": opacity,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
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

  // ── Medical: Hospitals (醫院，451 點) ──
  {
    id: "medHospital",
    sourceUrl: "./geo/medical_hospitals.geojson",
    sourceId: "medical-hospitals",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medHospitalScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#e53935" : "#c62828",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medHospitalScale ?? 1;
          const opacity = params?.medHospitalOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#e53935" : "#c62828",
            "circle-stroke-color": isDark ? "#ef9a9a" : "#b71c1c",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.5,
            ],
            "circle-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── Medical: Clinics (診所，23,472 點) ──
  {
    id: "medClinic",
    sourceUrl: "./geo/medical_clinics.pmtiles",
    sourceId: "medical-clinics",
    pmtiles: { sourceLayer: "medical_clinics", minzoom: 0, maxzoom: 12 },
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medClinicScale ?? 1;
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
          const scale = params?.medClinicScale ?? 1;
          const opacity = params?.medClinicOpacity ?? 0.85;
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
            "circle-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── Medical: Pharmacies (藥局，7,680 點) ──
  {
    id: "medPharmacy",
    sourceUrl: "./geo/medical_pharmacies.pmtiles",
    sourceId: "medical-pharmacies",
    pmtiles: { sourceLayer: "medical_pharmacies", minzoom: 0, maxzoom: 12 },
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medPharmacyScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#66bb6a" : "#2e7d32",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medPharmacyScale ?? 1;
          const opacity = params?.medPharmacyOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#66bb6a" : "#2e7d32",
            "circle-stroke-color": isDark ? "#a5d6a7" : "#1b5e20",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.5,
            ],
            "circle-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── Medical: AED (自動體外心臟去顫器，15,490 點) ──
  {
    id: "medAED",
    sourceUrl: "./geo/medical_aed.pmtiles",
    sourceId: "medical-aed",
    pmtiles: { sourceLayer: "medical_aed", minzoom: 0, maxzoom: 12 },
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medAEDScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
            ],
            "circle-blur": 1,
            "circle-color": isDark ? "#fdd835" : "#f9a825",
            "circle-opacity": isDark ? 0.12 : 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medAEDScale ?? 1;
          const opacity = params?.medAEDOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#fdd835" : "#f9a825",
            "circle-stroke-color": isDark ? "#fff176" : "#f57f17",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.5,
            ],
            "circle-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── Medical: LTC (長照機構，30,764 點) ──
  {
    id: "medLTC",
    sourceUrl: "./geo/medical_ltc.pmtiles",
    sourceId: "medical-ltc",
    pmtiles: { sourceLayer: "medical_ltc", minzoom: 0, maxzoom: 12 },
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, params) => {
          const scale = params?.medLTCScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 1.5 * scale, 10, 4 * scale, 14, 8 * scale, 17, 14 * scale,
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
          const scale = params?.medLTCScale ?? 1;
          const opacity = params?.medLTCOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.6 * scale, 10, 1.2 * scale, 14, 3 * scale, 17, 5 * scale,
            ],
            "circle-color": isDark ? "#ab47bc" : "#7b1fa2",
            "circle-stroke-color": isDark ? "#ce93d8" : "#6a1b9a",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.5,
            ],
            "circle-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── News Events (新聞事件) ──
  // dynamicData：資料由 useNewsEventsLayer 按日從 Supabase 餵入；
  // sourceUrl 僅作為 newsEventsLoader 的靜態 fallback（Supabase 未設定時）
  {
    id: "newsEvents",
    sourceUrl: "./geo/news_events.geojson",
    sourceId: "news-events",
    dynamicData: true,
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        // 階段 B+：critical halo（gis_relevance=3 + severity>=2 才亮的白色背景光暈）
        suffix: "critical-halo",
        type: "circle",
        paint: (isDark, params) => {
          const s = params?.newsScale ?? 1;
          const isCritical = [
            "all",
            [">=", ["coalesce", ["get", "max_gis_relevance"], 0], 3],
            [">=", ["coalesce", ["get", "max_severity"], 0], 2],
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 14 * s, 10, 24 * s, 14, 36 * s,
            ],
            "circle-blur": 1.2,
            "circle-color": isDark ? "#ffffff" : "#fffbeb",
            "circle-opacity": [
              "case",
              isCritical,
              isDark ? 0.3 : 0.35,
              0,
            ] as unknown as number,
          };
        },
      },
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
          // 階段 B：event_count 1→1x、5→1.6x、15→2.4x、50→3.2x
          const countMult = [
            "interpolate", ["linear"], ["coalesce", ["get", "event_count"], 1],
            1, 1, 5, 1.6, 15, 2.4, 50, 3.2,
          ];
          // 階段 B+：severity 加成 — sev 3 → ×1.6、sev 2 → ×1.3、其他 ×1
          const sevMult = [
            "case",
            [">=", ["coalesce", ["get", "max_severity"], 0], 3], 1.6,
            [">=", ["coalesce", ["get", "max_severity"], 0], 2], 1.3,
            1,
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", 3 * s, countMult, sevMult],
              10, ["*", 5 * s, countMult, sevMult],
              14, ["*", 8 * s, countMult, sevMult],
            ] as unknown as number,
            "circle-color": NEWS_CATEGORY_COLOR_EXPR as unknown as string,
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              5, 0, 10, 0.5, 14, 1,
            ],
            "circle-opacity": [
              "case",
              ["==", ["get", "category"], "other"],
              isDark ? 0.4 : 0.35,
              isDark ? 0.9 : 0.8,
            ] as unknown as number,
          };
        },
      },
      {
        // 階段 B：event_count ≥ 2 時在點上顯示數字
        suffix: "count",
        type: "symbol",
        layout: {
          "text-field": [
            "case",
            [">=", ["coalesce", ["get", "event_count"], 0], 2],
            ["to-string", ["get", "event_count"]],
            "",
          ] as unknown as string,
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            5, 9, 10, 11, 14, 13,
          ],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: (isDark) => ({
          "text-color": isDark ? "#fff" : "#1a1a1a",
          "text-halo-color": isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)",
          "text-halo-width": 1.2,
        }),
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
  // PMTiles 向量切片（原 11MB GeoJSON 全量載入 → 按需載入）
  {
    id: "waterRivers",
    sourceUrl: "./geo/water_river_polygons.pmtiles",
    sourceId: "water-river-polygons",
    pmtiles: { sourceLayer: "river_polygons", minzoom: 4, maxzoom: 13 },
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
  // PMTiles 向量切片（原 16MB GeoJSON 全量載入 → 按需載入）
  {
    id: "waterRivers",
    sourceUrl: "./geo/water_rivers.pmtiles",
    sourceId: "water-rivers",
    pmtiles: { sourceLayer: "rivers", minzoom: 4, maxzoom: 13 },
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
  // PMTiles 向量切片（原 1.9MB GeoJSON → 按需載入；status 屬性保留供 case expression）
  {
    id: "waterLevees",
    sourceUrl: "./geo/water_levees.pmtiles",
    sourceId: "water-levees",
    pmtiles: { sourceLayer: "levees", minzoom: 5, maxzoom: 13 },
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

  // ── 灌排渠道 Canal (全台 17 管理處 29,469 條，依屬性 3 色) ──
  // t: 灌溉專用渠道(teal) / 下游具引灌需求(purple) / 下游不具引灌需求+宜蘭(slate)
  // PMTiles 向量切片（原 6.8MB GeoJSON、29,469 條 → 按需載入；t 屬性保留供 match expression）
  {
    id: "waterCanals",
    sourceUrl: "./geo/water_canals.pmtiles",
    sourceId: "water-canals",
    pmtiles: { sourceLayer: "canals", minzoom: 5, maxzoom: 13 },
    layers: [
      {
        suffix: "glow",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": [
            "match", ["get", "t"],
            "灌溉專用渠道", isDark ? "#2dd4bf" : "#0d9488",
            "下游具引灌需求", isDark ? "#a78bfa" : "#7c3aed",
            isDark ? "#94a3b8" : "#64748b",
          ] as unknown as string,
          "line-width": 3 * (p?.waterCanalWidth ?? 1),
          "line-blur": 2,
          "line-opacity": (isDark ? 0.22 : 0.18) * (p?.waterCanalOpacity ?? 1),
        }),
      },
      {
        suffix: "core",
        type: "line",
        paint: (isDark, p) => ({
          "line-color": [
            "match", ["get", "t"],
            "灌溉專用渠道", isDark ? "#2dd4bf" : "#0d9488",
            "下游具引灌需求", isDark ? "#a78bfa" : "#7c3aed",
            isDark ? "#94a3b8" : "#64748b",
          ] as unknown as string,
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
  // PMTiles 向量切片（原 19MB GeoJSON → 按需載入；name/reservoir_name 等屬性保留供 popup）
  {
    id: "waterReservoirs",
    sourceUrl: "./geo/water_reservoirs.pmtiles",
    sourceId: "water-reservoir-poly",
    pmtiles: { sourceLayer: "reservoirs", minzoom: 5, maxzoom: 13 },
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

  // ── 滯洪池 Detention Basin（防洪儲水池，56 點：tainan 45 + taoyuan 11）──
  {
    id: "waterDetentionBasins",
    sourceUrl: "./geo/water_detention_basins.geojson",
    sourceId: "water-detention-basins",
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.detentionBasinScale ?? 1;
          const opacity = p?.detentionBasinOpacity ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, 4 * scale,
              12, 9 * scale,
              16, 14 * scale,
            ],
            "circle-color": "#0284c7",
            "circle-blur": 1.2,
            "circle-opacity": (isDark ? 0.45 : 0.35) * opacity,
          };
        },
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, p) => {
          const scale = p?.detentionBasinScale ?? 1;
          const opacity = p?.detentionBasinOpacity ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, 2 * scale,
              12, 4 * scale,
              16, 6 * scale,
            ],
            "circle-color": "#0284c7",
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)",
            "circle-stroke-width": 0.8,
            "circle-opacity": 0.95 * opacity,
          };
        },
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
  // PMTiles 向量切片（原 80MB GeoJSON → 按需載入；depth_class/county 屬性保留供 paint match）
  {
    id: "waterFloodExtreme",
    sourceUrl: "./geo/water_flood_extreme.pmtiles",
    sourceId: "water-flood-extreme",
    pmtiles: { sourceLayer: "flood_extreme", minzoom: 5, maxzoom: 13 },
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

  // ── Waste Stops Static (全台清運點位散點) ──
  {
    id: "wasteStopsStatic",
    sourceUrl: "./geo/waste_stops_static.geojson",
    sourceId: "waste-stops-static",
    layers: [
      {
        suffix: "waste-stops-glow",
        type: "circle",
        minzoom: 6,
        paint: (isDark, p) => {
          const scale = p?.wasteStopsStaticScale ?? 1;
          const glow = p?.wasteStopsStaticGlow ?? 0.10;
          const z = p?.wasteStopsStaticZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.3 * scale,
              9, 0.6 * scale,
              11, 1 * scale,
              14, 2 * scale,
              17, 3.5 * scale,
            ],
            "circle-blur": 0.6,
            "circle-color": isDark ? "#fbbf24" : "#d97706",
            "circle-opacity": isDark ? glow : Math.min(1, glow * 1.8),
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
      {
        suffix: "waste-stops-fill",
        type: "circle",
        minzoom: 6,
        paint: (isDark, p) => {
          const scale = p?.wasteStopsStaticScale ?? 1;
          const z = p?.wasteStopsStaticZ ?? 0;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 0.25 * scale,
              9, 0.4 * scale,
              11, 0.6 * scale,
              14, 1.2 * scale,
              17, 2.2 * scale,
            ],
            "circle-color": isDark ? "#fbbf24" : "#d97706",
            "circle-opacity": isDark ? 0.6 : 0.75,
            "circle-stroke-width": 0,
            "circle-translate": [0, -z],
            "circle-translate-anchor": "viewport",
          };
        },
      },
    ],
  },

  // ── 農企業登記 (spatial.agri_business_registrations，business_type 區分 3 類) ──
  // 顏色與 src/data/agriCompanyTypes.ts 對齊；零售/批發點多 → minzoom 8 控密度
  {
    id: "agriRetail",
    sourceUrl: "./agriculture/agri_retail_companies.pmtiles",
    sourceId: "agri-retail",
    pmtiles: { sourceLayer: "agri_retail", minzoom: 0, maxzoom: 12 },
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 8,
        paint: (isDark, p) => {
          const scale = p?.agriRetailScale ?? 1;
          const opacity = p?.agriRetailOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, 1.4 * scale, 12, 3 * scale, 16, 6 * scale,
            ],
            "circle-color": "#e91e63",
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 0, 12, 0.4, 16, 0.8],
            "circle-opacity": opacity,
            "circle-stroke-opacity": opacity,
          };
        },
      },
    ],
  },
  {
    id: "agriProduceWholesale",
    sourceUrl: "./agriculture/produce_wholesale_companies.pmtiles",
    sourceId: "agri-produce-wholesale",
    pmtiles: { sourceLayer: "produce_wholesale", minzoom: 0, maxzoom: 12 },
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 8,
        paint: (isDark, p) => {
          const scale = p?.agriProduceWholesaleScale ?? 1;
          const opacity = p?.agriProduceWholesaleOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, 1.4 * scale, 12, 3 * scale, 16, 6 * scale,
            ],
            "circle-color": "#3f51b5",
            "circle-stroke-color": isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 0, 12, 0.4, 16, 0.8],
            "circle-opacity": opacity,
            "circle-stroke-opacity": opacity,
          };
        },
      },
    ],
  },
  {
    id: "agriWholesaleMarket",
    sourceUrl: "./agriculture/agri_wholesale_market_companies.geojson",
    sourceId: "agri-wholesale-market",
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 6,
        paint: (isDark, p) => {
          const scale = p?.agriWholesaleMarketScale ?? 1;
          const opacity = p?.agriWholesaleMarketOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 3 * scale, 10, 5 * scale, 14, 8 * scale,
            ],
            "circle-color": "#ffd600",
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.45)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 14, 1.4],
            "circle-opacity": opacity,
            "circle-stroke-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── 農路圖（LineString，單色，可 popup）──
  {
    id: "farmRoads",
    sourceUrl: "./agriculture/farm_roads.pmtiles",
    sourceId: "farm-roads",
    pmtiles: { sourceLayer: "farm_roads", minzoom: 0, maxzoom: 13 },
    rebuildOnParamChange: ["glow", "line"],
    layers: [
      {
        suffix: "glow",
        type: "line",
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.farmRoadsWidth ?? 1;
          return {
            "line-color": isDark ? "#a4b494" : "#7a8670",
            "line-width": 4 * w,
            "line-blur": 3,
            "line-opacity": isDark ? 0.06 : 0.1,
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.farmRoadsWidth ?? 1;
          const opacity = params?.farmRoadsOpacity ?? 0.8;
          return {
            "line-color": isDark ? "#a4b494" : "#7a8670",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              8, 0.4 * w, 11, 1 * w, 13, 1.6 * w, 16, 2.6 * w,
            ],
            "line-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── 全台步道（LineString，依 source 4 色分類：A 林業署 / B OSM / C 雪霸 / C 金門）──
  {
    id: "hikingTrails",
    sourceUrl: "./forestry/hiking_trails.pmtiles",
    sourceId: "hiking-trails",
    pmtiles: { sourceLayer: "hiking_trails", minzoom: 0, maxzoom: 13 },
    rebuildOnParamChange: ["glow", "line"],
    layers: [
      {
        suffix: "glow",
        type: "line",
        minzoom: 7,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.hikingTrailsWidth ?? 1.2;
          return {
            "line-color": [
              "match", ["get", "source"],
              "A_forest", "#d62728",
              "B_osm", "#1f77b4",
              "C_np_sheipa", "#2ca02c",
              "C_np_kinmen", "#9467bd",
              "D_taipei_grand", "#ff7f0e",
              "D_newtaipei", "#e377c2",
              "#888888",
            ],
            "line-width": 5 * w,
            "line-blur": 4,
            "line-opacity": 0.12,
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        minzoom: 7,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.hikingTrailsWidth ?? 1.2;
          const opacity = params?.hikingTrailsOpacity ?? 0.85;
          return {
            "line-color": [
              "match", ["get", "source"],
              "A_forest", "#d62728",
              "B_osm", "#1f77b4",
              "C_np_sheipa", "#2ca02c",
              "C_np_kinmen", "#9467bd",
              "D_taipei_grand", "#ff7f0e",
              "D_newtaipei", "#e377c2",
              "#888888",
            ],
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              7, 0.5 * w, 10, 1.2 * w, 13, 2.0 * w, 16, 3.0 * w,
            ],
            "line-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── 國土綠網分區圖（MultiPolygon，依 Zone 12 色分類，可 popup）──
  {
    id: "ecoNetworkZones",
    sourceUrl: "./agriculture/eco_network_zones.pmtiles",
    sourceId: "eco-network-zones",
    pmtiles: { sourceLayer: "eco_network_zones", minzoom: 0, maxzoom: 13 },
    rebuildOnParamChange: ["fill"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, params) => {
          const opacity = params?.ecoNetworkZonesOpacity ?? 0.5;
          return {
            "fill-color": ["match", ["get", "Zone"], ...ECO_NETWORK_ZONE_MATCH, "#9e9e9e"],
            "fill-opacity": opacity,
          };
        },
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark) => ({
          "line-color": isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.2)",
          "line-width": 0.8,
          "line-opacity": 1,
        }),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  FORESTRY — 林業 15 layer (12 base + 3 衍生)
  //  2026-06-10：compartments / reserve / roads 三大檔改走 PMTiles
  //  （原 219MB / 45MB / 16MB GeoJSON；compartments geojson 已 gitignore
  //   且本機不存在，geojson 路徑會 404 → 必須走 pmtiles）
  //  TODO: 3 衍生 layer 的 source URL 尚未產出（D1-D3 ETL pipeline），
  //        Mapbox 會 404 但不會 crash。
  // ═══════════════════════════════════════════════════════════════

  // ── 林班（Polygon，深綠面 + 邊框）──
  {
    id: "forestCompartments",
    sourceUrl: "./forestry/national_forest_compartments.pmtiles",
    sourceId: "forest-compartments",
    pmtiles: { sourceLayer: "national_forest_compartments", minzoom: 0, maxzoom: 13 },
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, params) => ({
          "fill-color": "#15803D",
          "fill-opacity": params?.forestCompartmentsOpacity ?? 0.45,
        }),
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark, params) => ({
          "line-color": isDark ? "#22c55e" : "#166534",
          "line-width": params?.forestCompartmentsOutlineWidth ?? 0.5,
          "line-opacity": (params?.forestCompartmentsShowOutline ?? 1) ? 0.7 : 0,
        }),
      },
    ],
  },

  // ── 保安林（Polygon，按「種類」13 類配色）──
  {
    id: "forestReserve",
    sourceUrl: "./forestry/forest_reserve.pmtiles",
    sourceId: "forest-reserve",
    pmtiles: { sourceLayer: "forest_reserve", minzoom: 0, maxzoom: 13 },
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, params) => ({
          "fill-color": ["match", ["get", "種類"], ...FOREST_RESERVE_TYPE_MATCH, "#0F766E"],
          "fill-opacity": params?.forestReserveOpacity ?? 0.6,
        }),
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark, params) => ({
          "line-color": isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
          "line-width": params?.forestReserveOutlineWidth ?? 0.5,
          "line-opacity": (params?.forestReserveShowOutline ?? 1) ? 0.7 : 0,
        }),
      },
    ],
  },

  // ── 森林遊樂區（Polygon）──
  {
    id: "forestRecreation",
    sourceUrl: "./forestry/forest_recreation_areas.geojson",
    sourceId: "forest-recreation",
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, params) => ({
          "fill-color": "#65A30D",
          "fill-opacity": params?.forestRecreationOpacity ?? 0.6,
        }),
      },
      {
        suffix: "outline",
        type: "line",
        paint: (isDark, params) => ({
          "line-color": isDark ? "#a3e635" : "#4d7c0f",
          "line-width": params?.forestRecreationOutlineWidth ?? 0.5,
          "line-opacity": (params?.forestRecreationShowOutline ?? 1) ? 0.8 : 0,
        }),
      },
    ],
  },

  // ── 治理工程（Point，源資料是 6275 個工程點位）──
  {
    id: "forestTreatmentWorks",
    sourceUrl: "./forestry/forestry_treatment_works.geojson",
    sourceId: "forest-treatment-works",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestTreatmentWorksScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * 0.55 * scale,
            "circle-color": "#F59E0B",
            "circle-stroke-color": "#b45309",
            "circle-stroke-width": 0.4,
            "circle-opacity": params?.forestTreatmentWorksOpacity ?? 0.85,
          };
        },
      },
    ],
  },

  // ── 平地森林（Point，3 個園區點位）──
  {
    id: "forestFlatParks",
    sourceUrl: "./forestry/flat_forest_parks.geojson",
    sourceId: "forest-flat-parks",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestFlatParksScale ?? 1.3;
          return {
            "circle-radius": BASE_RADIUS * 1.0 * scale,
            "circle-color": "#A3E635",
            "circle-stroke-color": "#365314",
            "circle-stroke-width": 1,
            "circle-opacity": params?.forestFlatParksOpacity ?? 0.9,
          };
        },
      },
    ],
  },

  // ── 堰塞湖（Point，32 個點位）──
  {
    id: "forestDamLakes",
    sourceUrl: "./forestry/dam_lakes_in_forest.geojson",
    sourceId: "forest-dam-lakes",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestDamLakesScale ?? 1.2;
          return {
            "circle-radius": BASE_RADIUS * 0.85 * scale,
            "circle-color": "#06B6D4",
            "circle-stroke-color": "#0e7490",
            "circle-stroke-width": 0.8,
            "circle-opacity": params?.forestDamLakesOpacity ?? 0.95,
          };
        },
      },
    ],
  },

  // ── 林道（LineString，木褐）──
  {
    id: "forestRoads",
    sourceUrl: "./forestry/forest_roads.pmtiles",
    sourceId: "forest-roads",
    pmtiles: { sourceLayer: "forest_roads", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line"],
    layers: [
      {
        suffix: "line",
        type: "line",
        minzoom: 7,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.forestRoadsWidth ?? 1;
          return {
            "line-color": "#A16207",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              7, 0.4 * w, 11, 1.2 * w, 14, 2.4 * w, 16, 3.2 * w,
            ],
            "line-opacity": params?.forestRoadsOpacity ?? 0.8,
          };
        },
      },
    ],
  },

  // ── 阿里山鐵路（Point，25 個車站；源資料是車站點位非線）──
  {
    id: "forestAlishanRail",
    sourceUrl: "./forestry/wildlife_distribution_3rd_alt.geojson",
    sourceId: "forest-alishan-rail",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestAlishanRailScale ?? 1.2;
          return {
            "circle-radius": BASE_RADIUS * 0.8 * scale,
            "circle-color": "#92400E",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
            "circle-opacity": params?.forestAlishanRailOpacity ?? 0.95,
          };
        },
      },
    ],
  },

  // ── 步道路標（Point）──
  {
    id: "forestTrailSigns",
    sourceUrl: "./forestry/mountain_trail_signs.geojson",
    sourceId: "forest-trail-signs",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestTrailSignsScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * 0.6 * scale,
            "circle-color": "#84CC16",
            "circle-stroke-color": "#365314",
            "circle-stroke-width": 0.5,
            "circle-opacity": params?.forestTrailSignsOpacity ?? 0.85,
          };
        },
      },
    ],
  },

  // ── 通訊點（Point）──
  {
    id: "forestSignalPoints",
    sourceUrl: "./forestry/mountain_signal_points.geojson",
    sourceId: "forest-signal-points",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestSignalPointsScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * 0.7 * scale,
            "circle-color": "#22C55E",
            "circle-stroke-color": "#14532d",
            "circle-stroke-width": 0.6,
            "circle-opacity": params?.forestSignalPointsOpacity ?? 0.85,
          };
        },
      },
    ],
  },

  // ── 自然教育中心（Point）──
  {
    id: "forestEducationCenters",
    sourceUrl: "./forestry/forest_education_centers.geojson",
    sourceId: "forest-education-centers",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestEducationCentersScale ?? 1.2;
          return {
            "circle-radius": BASE_RADIUS * 1.1 * scale,
            "circle-color": "#0EA5E9",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1.2,
            "circle-opacity": params?.forestEducationCentersOpacity ?? 0.9,
          };
        },
      },
    ],
  },

  // ── 野生動物分布（Point）──
  {
    id: "forestWildlife",
    sourceUrl: "./forestry/wildlife_distribution_3rd.geojson",
    sourceId: "forest-wildlife",
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.forestWildlifeScale ?? 1;
          return {
            "circle-radius": BASE_RADIUS * 0.65 * scale,
            "circle-color": "#A855F7",
            "circle-stroke-color": "#581c87",
            "circle-stroke-width": 0.5,
            "circle-opacity": params?.forestWildlifeOpacity ?? 0.85,
          };
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  //  ENERGY MVP — layer 1 / 5 / 6 (POI 2D circle)
  // ══════════════════════════════════════════════════════════════════

  // ── Layer 1：電廠總圖 all_power_plants_v 10,665 ──
  // fuel_type 分色（match expression），capacity_mw 4 階半徑（quantile p50/p80/p95）。
  // 響應 powerPlantsScale (大小) + powerPlantsOpacity (透明度) slider
  {
    id: "powerPlants",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-power-plants",
    dynamicData: true,
    rebuildOnParamChange: ["powerPlantsOpacity", "powerPlantsScale"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.powerPlantsOpacity ?? 0.95;
          const s = params?.powerPlantsScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", 1.5 * s, ["coalesce", ["get", "radius"], 3]],
              12, ["*", 2.4 * s, ["coalesce", ["get", "radius"], 3]],
            ],
            "circle-blur": 0.8,
            "circle-color": ["coalesce", ["get", "color"], "#9ca3af"],
            "circle-opacity": o * 0.25,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.powerPlantsOpacity ?? 0.95;
          const s = params?.powerPlantsScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, ["coalesce", ["get", "radius"], 3]],
              12, ["*", 1.6 * s, ["coalesce", ["get", "radius"], 3]],
            ],
            "circle-color": ["coalesce", ["get", "color"], "#9ca3af"],
            "circle-opacity": o,
            "circle-stroke-width": 1,
            "circle-stroke-color": isDark ? "#3B82F6" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Layer 4 hit-test：機組即時出力 (3D beam) 的 2D 點擊圈 ──
  // beam 是 Three.js CustomLayer 無法被 Mapbox queryRenderedFeatures 命中，
  // 這層提供「跟 beam 一起出現」的隱形大圓 → 用戶可點 beam 周圍區域 → 觸發 PowerPlantPanel
  {
    id: "powerGenerationUnit",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-power-generation-hit",
    dynamicData: true,
    rebuildOnParamChange: [],
    layers: [
      {
        suffix: "hit",
        type: "circle",
        paint: () => ({
          // 完全透明（看不到），但 ≥ 10px 半徑用戶仍能點到
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            5, 10, 12, 18,
          ],
          "circle-color": "#000000",
          "circle-opacity": 0,
        }),
      },
    ],
  },

  // ── Layer 5a：變電所（超高壓）38（EHV_SWITCH 5 + EHV 33）──
  // 含 halo 光暈強化全國級主幹節點視覺
  {
    id: "osmSubstationsEhv",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-substations-ehv",
    dynamicData: true,
    rebuildOnParamChange: ["osmSubstationsEhvOpacity", "osmSubstationsEhvSize"],
    layers: [
      // halo：紅色（開閉所）/ 白色（E/S 變電所）圓形光暈
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.osmSubstationsEhvOpacity ?? 0.85;
          return {
            // zoom 必須在 interpolate 最上層；per-class 倍率放進每個 stop 的 match 輸出
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6,  ["match", ["get", "class"], "EHV_SWITCH", 8,  "EHV", 6,  0],
              11, ["match", ["get", "class"], "EHV_SWITCH", 14, "EHV", 11, 0],
              14, ["match", ["get", "class"], "EHV_SWITCH", 20, "EHV", 16, 0],
            ],
            "circle-blur": 0.9,
            "circle-color": [
              "match", ["get", "class"],
              "EHV_SWITCH", "#ef4444",
              "EHV",        "#ffffff",
              "transparent",
            ],
            "circle-opacity": o * 0.45,
          };
        },
      },
      // core marker：菱形 SDF symbol
      {
        suffix: "circle",
        type: "symbol",
        layout: (_isDark, params) => {
          const sB = params?.osmSubstationsEhvSize ?? 1;
          return {
            "icon-image": "substation-diamond",
            "icon-rotate": 45,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              6,  ["match", ["get", "class"], "EHV_SWITCH", 0.40 * sB, "EHV", 0.32 * sB, 0.32 * sB],
              11, ["match", ["get", "class"], "EHV_SWITCH", 0.65 * sB, "EHV", 0.52 * sB, 0.52 * sB],
              14, ["match", ["get", "class"], "EHV_SWITCH", 0.90 * sB, "EHV", 0.72 * sB, 0.72 * sB],
            ],
          };
        },
        paint: (_isDark, params) => {
          const o = params?.osmSubstationsEhvOpacity ?? 0.85;
          return {
            "icon-color": [
              "match", ["get", "class"],
              "EHV_SWITCH", "#ef4444",
              "EHV",        "#ffffff",
              "#ffffff",
            ],
            "icon-opacity": o,
            "icon-halo-color": [
              "match", ["get", "class"],
              "EHV_SWITCH", "#ffffff",
              "rgba(0,0,0,0)",
            ],
            "icon-halo-width": [
              "match", ["get", "class"],
              "EHV_SWITCH", 2,
              0,
            ],
          };
        },
      },
    ],
  },

  // ── Layer 5b：變電所（區域）747（PS 129 + DPS 90 + SS 199 + TRACTION 11 + OTHER 318）──
  // 一次／二次／配電／鐵路牽引／未分類 — 在地分布密集型
  {
    id: "osmSubstations",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-substations",
    dynamicData: true,
    rebuildOnParamChange: ["osmSubstationsOpacity", "osmSubstationsSize"],
    layers: [
      {
        suffix: "circle",
        type: "symbol",
        layout: (_isDark, params) => {
          const sS = params?.osmSubstationsSize ?? 1;
          return {
            "icon-image": "substation-diamond",
            "icon-rotate": 45,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              6, ["match", ["get", "class"],
                  "PS", 0.25 * sS, "DPS", 0.20 * sS, "SS", 0.18 * sS,
                  "TRACTION", 0.16 * sS, 0.13 * sS],
              11, ["match", ["get", "class"],
                   "PS", 0.40 * sS, "DPS", 0.32 * sS, "SS", 0.28 * sS,
                   "TRACTION", 0.24 * sS, 0.20 * sS],
              14, ["match", ["get", "class"],
                   "PS", 0.55 * sS, "DPS", 0.45 * sS, "SS", 0.36 * sS,
                   "TRACTION", 0.32 * sS, 0.28 * sS],
            ],
          };
        },
        paint: (_isDark, params) => {
          const o = params?.osmSubstationsOpacity ?? 0.85;
          return {
            "icon-color": [
              "match", ["get", "class"],
              "PS",       "#f97316",
              "DPS",      "#14b8a6",
              "SS",       "#facc15",
              "TRACTION", "#3b82f6",
              "#6b7280",
            ],
            "icon-opacity": [
              "*", o,
              ["match", ["get", "class"], "OTHER", 0.55, 1.0],
            ],
          };
        },
      },
    ],
  },

  // ── Layer 5b：OSM 高壓輸電線 2,305（Energy v2 Phase C）──
  // hook 端把 voltage 算 tier(345/161/69/0) + 寫進 properties.tier
  {
    id: "osmPowerLines",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-power-lines",
    dynamicData: true,
    rebuildOnParamChange: ["osmPowerLinesOpacity", "osmPowerLinesWidth"],
    layers: [
      // ── 方案 C：bloom 走 Three.js custom layer（osm-power-lines-three-glow）──
      // 同時保留 Mapbox simple core 作為穩定 baseline（Three.js fail 時仍可見）
      {
        suffix: "core",
        type: "line",
        filter: ["!=", ["get", "line_type"], "cable"],
        paint: (_isDark, params) => {
          const o = params?.osmPowerLinesOpacity ?? 0.4;
          const w = params?.osmPowerLinesWidth ?? 1;
          return {
            "line-color": [
              "match", ["get", "tier"],
              345, "#1AB6D9",
              161, "#62D9AD",
              69,  "#468BA6",
              "#DFE0DC",
            ],
            "line-width": [
              "*", w,
              ["match", ["get", "tier"],
                345, ["match", ["get", "line_type"], "minor_line", 1.4, "line", 3, 2],
                161, ["match", ["get", "line_type"], "minor_line", 0.9, "line", 1.8, 1.3],
                69,  ["match", ["get", "line_type"], "minor_line", 0.6, "line", 1.2, 0.9],
                ["match", ["get", "line_type"], "minor_line", 0.5, "line", 1, 0.8],
              ],
            ],
            "line-opacity": [
              "match", ["get", "tier"],
              345, ["min", 1, ["*", o, 1.4]],
              ["*", o, ["match", ["get", "line_type"], "minor_line", 0.6, 1]],
            ],
          };
        },
      },
      // 地下電纜（dashed）— Three.js bloom 不畫虛線，保留 Mapbox 端
      {
        suffix: "cable",
        type: "line",
        filter: ["==", ["get", "line_type"], "cable"],
        paint: (_isDark, params) => {
          const o = params?.osmPowerLinesOpacity ?? 0.6;
          const w = params?.osmPowerLinesWidth ?? 1;
          return {
            "line-color": [
              "match", ["get", "tier"],
              345, "#1AB6D9",
              161, "#62D9AD",
              69,  "#468BA6",
              "#DFE0DC",
            ],
            "line-width": ["*", w, 1.6],
            "line-opacity": o * 0.7,
            "line-dasharray": [2, 2],
          };
        },
      },
    ],
  },

  // ── Layer 5c：OSM 高壓鐵塔 26,589（zoom-gated size） ──
  // 注意：99.97% voltage=NULL → 不依 tier 染色，統一用 sky-300 亮色
  // minzoom 8 全島可見、size 隨 zoom 漸進避免低 zoom 過密
  {
    id: "osmPowerTowers",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-power-towers",
    dynamicData: true,
    rebuildOnParamChange: ["osmPowerTowersOpacity", "osmPowerTowersSize"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 8,
        paint: (isDark, params) => {
          const o = params?.osmPowerTowersOpacity ?? 0.85;
          const s = params?.osmPowerTowersSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8,  ["*", s, 0.8],
              11, ["*", s, 1.6],
              14, ["*", s, 2.8],
              17, ["*", s, 4.5],
            ],
            "circle-color": "#468BA6",  // 藍綠，對齊 69 kV 主色（voltage 幾乎全空，不分色）
            "circle-opacity": [
              "interpolate", ["linear"], ["zoom"],
              8,  o * 0.45,
              11, o * 0.85,
              13, o,
            ],
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              8, 0, 12, 0.4, 15, 0.8,
            ],
            "circle-stroke-color": isDark ? "#0c4a6e" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.1：OSM 風機 812 ──
  // is_offshore boolean 分色：offshore=cyan-300、onshore=teal-400、null=灰
  // capacity_mw 分大小（4 段 1.5~5MW vestas 主流）
  {
    id: "osmWindTurbines",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-wind-turbines",
    dynamicData: true,
    rebuildOnParamChange: ["osmWindTurbinesOpacity", "osmWindTurbinesSize"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.osmWindTurbinesOpacity ?? 0.85;
          const s = params?.osmWindTurbinesSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 4], 10, ["*", s, 8], 14, ["*", s, 14],
            ],
            "circle-color": [
              "case", ["==", ["get", "is_offshore"], true], "#67e8f9", "#2dd4bf",
            ],
            "circle-opacity": o * 0.25,
            "circle-blur": 0.6,
          };
        },
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.osmWindTurbinesOpacity ?? 0.85;
          const s = params?.osmWindTurbinesSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 2], 10, ["*", s, 3.5], 14, ["*", s, 6],
            ],
            "circle-color": [
              "case",
              ["==", ["get", "is_offshore"], true], "#67e8f9",
              ["==", ["get", "is_offshore"], false], "#2dd4bf",
              "#94a3b8",
            ],
            "circle-opacity": o,
            "circle-stroke-width": 0.8,
            "circle-stroke-color": isDark ? "#0c4a6e" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.1：OSM 光電廠 734（POI centroid） ──
  // capacity_mw 分大小，色：amber
  {
    id: "osmSolarFarms",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-solar-farms",
    dynamicData: true,
    rebuildOnParamChange: ["osmSolarFarmsOpacity", "osmSolarFarmsSize"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.osmSolarFarmsOpacity ?? 0.85;
          const s = params?.osmSolarFarmsSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 4], 10, ["*", s, 8], 14, ["*", s, 14],
            ],
            "circle-color": "#fbbf24",
            "circle-opacity": o * 0.22,
            "circle-blur": 0.6,
          };
        },
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.osmSolarFarmsOpacity ?? 0.85;
          const s = params?.osmSolarFarmsSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 2], 10, ["*", s, 3.5], 14, ["*", s, 6],
            ],
            "circle-color": "#fbbf24",
            "circle-opacity": o,
            "circle-stroke-width": 0.8,
            "circle-stroke-color": isDark ? "#78350f" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.1：OSM 電廠 POI 513（補 IPP/小型） ──
  // plant_source 分色：solar/hydro/wind/coal/gas/nuclear/waste...
  {
    id: "osmPowerPlantsStatic",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-osm-power-plants-static",
    dynamicData: true,
    rebuildOnParamChange: ["osmPowerPlantsStaticOpacity", "osmPowerPlantsStaticSize"],
    layers: [
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.osmPowerPlantsStaticOpacity ?? 0.85;
          const s = params?.osmPowerPlantsStaticSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 2.5], 10, ["*", s, 4], 14, ["*", s, 7],
            ],
            "circle-color": [
              "match", ["get", "plant_source"],
              "solar", "#fbbf24",
              "wind", "#22d3ee",
              "hydro", "#3b82f6",
              "coal", "#374151",
              "gas", "#94a3b8",
              "diesel", "#1f2937",
              "nuclear", "#facc15",
              "waste", "#a3a300",
              "#9ca3af",
            ],
            "circle-opacity": o,
            "circle-stroke-width": 1,
            "circle-stroke-color": isDark ? "#1e293b" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.2：離岸風電潛力場址 36 MultiPolygon ──
  // fill 淡 cyan + line cyan-400；無 phase 分色（全部單一 zone_type）
  {
    id: "offshoreWindZones",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-offshore-wind-zones",
    dynamicData: true,
    rebuildOnParamChange: ["offshoreWindZonesOpacity"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, params) => {
          const o = params?.offshoreWindZonesOpacity ?? 0.35;
          return {
            "fill-color": "#22d3ee",
            "fill-opacity": o,
            "fill-outline-color": "#67e8f9",
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        paint: (_isDark, params) => {
          const o = params?.offshoreWindZonesOpacity ?? 0.35;
          return {
            "line-color": "#67e8f9",
            "line-width": 1.3,
            "line-opacity": Math.min(1, o * 2.5),
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.2：離島電網 14 POI ──
  {
    id: "islandPowerGrid",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-island-grid",
    dynamicData: true,
    rebuildOnParamChange: ["islandPowerGridOpacity", "islandPowerGridSize"],
    layers: [
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.islandPowerGridOpacity ?? 0.9;
          const s = params?.islandPowerGridSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 3.5], 10, ["*", s, 5.5], 14, ["*", s, 8],
            ],
            "circle-color": [
              "match", ["get", "fuel_type"],
              "diesel", "#f97316",
              "gas", "#94a3b8",
              "solar", "#fbbf24",
              "wind", "#22d3ee",
              "hydro", "#3b82f6",
              "#a78bfa",
            ],
            "circle-opacity": o,
            "circle-stroke-width": 1.2,
            "circle-stroke-color": isDark ? "#312e81" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.2：化石燃料設施 9 POI ──
  // facility_type 3 種：gas_power_plant / lng_terminal / oil_refinery
  {
    id: "fossilFuelInfra",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fossil-fuel",
    dynamicData: true,
    rebuildOnParamChange: ["fossilFuelInfraOpacity", "fossilFuelInfraSize"],
    layers: [
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.fossilFuelInfraOpacity ?? 0.85;
          const s = params?.fossilFuelInfraSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 3], 10, ["*", s, 5], 14, ["*", s, 8],
            ],
            "circle-color": [
              "match", ["get", "facility_type"],
              "lng_terminal", "#22d3ee",
              "oil_refinery", "#1f2937",
              "gas_power_plant", "#94a3b8",
              "#9ca3af",
            ],
            "circle-opacity": o,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": isDark ? "#0c4a6e" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.3：地熱井 36 POI ──
  {
    id: "geothermalWells",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-geothermal-wells",
    dynamicData: true,
    rebuildOnParamChange: ["geothermalWellsOpacity", "geothermalWellsSize"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.geothermalWellsOpacity ?? 0.85;
          const s = params?.geothermalWellsSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 5], 10, ["*", s, 9], 14, ["*", s, 14],
            ],
            "circle-color": "#ef4444",
            "circle-opacity": o * 0.2,
            "circle-blur": 0.8,
          };
        },
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.geothermalWellsOpacity ?? 0.85;
          const s = params?.geothermalWellsSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 2.5], 10, ["*", s, 4], 14, ["*", s, 6.5],
            ],
            "circle-color": "#ef4444",
            "circle-opacity": o,
            "circle-stroke-width": 0.9,
            "circle-stroke-color": isDark ? "#7f1d1d" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Energy v2 Phase D.3：北市再生能源設置許可 438 POI ──
  // category 6 種 match 分色
  {
    id: "renewablePermitsTaipei",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-taipei-re",
    dynamicData: true,
    rebuildOnParamChange: ["renewablePermitsTaipeiOpacity", "renewablePermitsTaipeiSize"],
    layers: [
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.renewablePermitsTaipeiOpacity ?? 0.85;
          const s = params?.renewablePermitsTaipeiSize ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.5], 12, ["*", s, 3], 15, ["*", s, 5],
            ],
            "circle-color": [
              "match", ["get", "category"],
              "學校", "#fbbf24",
              "國有房地", "#94a3b8",
              "機關", "#a78bfa",
              "焚化發電", "#ef4444",
              "沼氣發電", "#a3a300",
              "水力發電", "#3b82f6",
              "#9ca3af",
            ],
            "circle-opacity": o,
            "circle-stroke-width": 0.6,
            "circle-stroke-color": isDark ? "#1e293b" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── Layer 6：EV 充電站 3,060 ──
  {
    id: "evChargingStations",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-ev-charging",
    dynamicData: true,
    rebuildOnParamChange: ["evChargingOpacity"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.evChargingOpacity ?? 0.8;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              7, 2, 12, 3.5, 15, 5,
            ],
            "circle-color": "#10b981",
            "circle-opacity": o,
            "circle-stroke-width": 0.6,
            "circle-stroke-color": isDark ? "#064e3b" : "#ffffff",
          };
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  //  HAZARD（v2 Phase B）— 落雷 + 核安
  // ══════════════════════════════════════════════════════════════════

  // ── 落雷 day-preload + 漸入漸出 ──
  // properties.alpha 由 hook 端依 age 算（0~1）；circle-opacity = slider × alpha
  {
    id: "lightning",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "hazard-lightning",
    dynamicData: true,
    rebuildOnParamChange: ["lightningOpacity"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.lightningOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 4, 9, 7, 12, 12,
            ],
            "circle-color": [
              "match", ["get", "strike_type"],
              0, "#fb923c",
              1, "#22d3ee",
              "#9ca3af",
            ],
            "circle-blur": 0.85,
            "circle-opacity": [
              "*", o * 0.45, ["coalesce", ["get", "alpha"], 1],
            ],
          };
        },
      },
      {
        suffix: "core",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.lightningOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 1.2, 10, 2.2, 14, 3.5,
            ],
            "circle-color": [
              "match", ["get", "strike_type"],
              0, "#fb923c",
              1, "#22d3ee",
              "#9ca3af",
            ],
            "circle-opacity": [
              "*", o, ["coalesce", ["get", "alpha"], 1],
            ],
          };
        },
      },
    ],
  },

  // ── 核安 51 站 ──
  // 顏色由 properties.level（loader 預算好的 normal/watch/warning/alarm/stale）決定。
  // is_stale (level=stale) 用虛邊框 stroke 區分「離線」與真實警戒。
  {
    id: "nuclearRadiation",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "hazard-nuclear",
    dynamicData: true,
    rebuildOnParamChange: ["nuclearOpacity", "nuclearScale"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.nuclearOpacity ?? 0.9;
          const s = params?.nuclearScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", 6 * s, 1],
              12, ["*", 12 * s, 1],
            ],
            "circle-color": [
              "match", ["get", "level"],
              "normal", "#22c55e",
              "watch", "#facc15",
              "warning", "#f97316",
              "alarm", "#ef4444",
              "stale", "#6b7280",
              "#6b7280",
            ],
            "circle-blur": 0.75,
            "circle-opacity": [
              "*",
              ["match", ["get", "level"],
                "stale", o * 0.12,
                "normal", o * 0.18,
                o * 0.38,
              ],
              ["coalesce", ["get", "alpha"], 1],
            ],
          };
        },
      },
      {
        suffix: "core",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.nuclearOpacity ?? 0.9;
          const s = params?.nuclearScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", 3 * s, 1],
              12, ["*", 5.5 * s, 1],
            ],
            "circle-color": [
              "match", ["get", "level"],
              "normal", "#22c55e",
              "watch", "#facc15",
              "warning", "#f97316",
              "alarm", "#ef4444",
              "stale", "#6b7280",
              "#6b7280",
            ],
            "circle-opacity": [
              "*", o, ["coalesce", ["get", "alpha"], 1],
            ],
            "circle-stroke-width": [
              "match", ["get", "level"],
              "stale", 1.5,
              0.8,
            ],
            "circle-stroke-color": [
              "match", ["get", "level"],
              "stale", isDark ? "#9ca3af" : "#4b5563",
              isDark ? "#3B82F6" : "#ffffff",
            ],
          };
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  //  Phase 8 SSOT — 6-layer facilities 重構
  //  marker 大小用 log scale 連續映射（0.5MW ~ 6GW）；color 按 fuel_type
  // ══════════════════════════════════════════════════════════════════

  // ── L1 主要電廠（運轉中）209 ──
  {
    id: "facPrimary",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fac-primary",
    dynamicData: true,
    rebuildOnParamChange: ["facPrimaryOpacity", "facPrimaryScale", "facPrimaryRtScale", "facPrimaryNoRtScale"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.facPrimaryOpacity ?? 0.95;
          const s = params?.facPrimaryScale ?? 1;
          const rtScale = params?.facPrimaryRtScale ?? 1.0;
          const noRtScale = params?.facPrimaryNoRtScale ?? 0.3;
          const haloRadius = (factor: number, zoom6: number, zoom12: number) => [
            "*", factor * s,
            ["case", ["==", ["get", "has_realtime"], true], rtScale, noRtScale],
            ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
              Math.log10(0.5), zoom6, Math.log10(6000), zoom12],
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6,  haloRadius(1.6, 3, 18),
              12, haloRadius(2.0, 6, 40),
            ],
            "circle-blur": 0.85,
            "circle-color": "#ffffff",
            "circle-opacity": o * 0.45,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.facPrimaryOpacity ?? 0.95;
          const s = params?.facPrimaryScale ?? 1;
          const rtScale = params?.facPrimaryRtScale ?? 1.0;
          const noRtScale = params?.facPrimaryNoRtScale ?? 0.3;
          // rtScale slider 控制「有即時出力」廠（台電 14 大廠 + 廠級匯總）
          // noRtScale slider 控制「無即時出力」廠（~180 個小廠）
          const radius = (zoom6: number, zoom12: number) => [
            "*", s,
            ["case", ["==", ["get", "has_realtime"], true], rtScale, noRtScale],
            ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
              Math.log10(0.5), zoom6, Math.log10(6000), zoom12],
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6,  radius(2, 14),
              12, radius(5, 32),
            ],
            "circle-color": ["coalesce", ["get", "color"], "#9ca3af"],
            "circle-opacity": o,
            "circle-stroke-width": [
              "case", ["==", ["get", "has_realtime"], true], 1.4, 1,
            ],
            "circle-stroke-color": [
              "case", ["==", ["get", "has_realtime"], true],
              "#ffffff",                            // 大廠（即時）一律白邊
              isDark ? "#0f172a" : "#ffffff",       // 其他廠維持原色
            ],
          };
        },
      },
    ],
  },

  // ── L2 離岸風電場址 polygon 8 ──
  {
    id: "facOffshore",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fac-offshore",
    dynamicData: true,
    rebuildOnParamChange: ["facOffshoreOpacity"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, params) => {
          const o = params?.facOffshoreOpacity ?? 0.45;
          return {
            "fill-color": [
              "match", ["get", "status"],
              "operating", "#1F4373",
              "construction", "#2F5A99",
              "pre-construction", "#3C92A6",
              "announced", "#7AAEC0",
              "#475569",
            ],
            "fill-opacity": o * 0.35,
            "fill-outline-color": "#7AAEC0",
          };
        },
      },
      {
        suffix: "line",
        type: "line",
        paint: (_isDark, params) => {
          const o = params?.facOffshoreOpacity ?? 0.45;
          return {
            "line-color": [
              "match", ["get", "status"],
              "operating", "#3C92A6",
              "construction", "#7AAEC0",
              "pre-construction", "#7AAEC0",
              "announced", "#A8C5D0",
              "#A8C5D0",
            ],
            "line-width": 1.4,
            "line-opacity": o * 0.95,
            "line-dasharray": [
              "match", ["get", "status"],
              "operating",        ["literal", [1]],
              "construction",     ["literal", [3, 2]],
              "pre-construction", ["literal", [2, 2]],
              "announced",        ["literal", [1, 3]],
              ["literal", [2, 2]],
            ],
          };
        },
      },
    ],
  },

  // ── L3 規劃 / 未來電廠 35（半透明 + 虛線邊框）──
  {
    id: "facPlanned",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fac-planned",
    dynamicData: true,
    rebuildOnParamChange: ["facPlannedOpacity", "facPlannedScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.facPlannedOpacity ?? 0.7;
          const s = params?.facPlannedScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
                Math.log10(0.5), 2, Math.log10(6000), 12]],
              12, ["*", s, ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
                Math.log10(0.5), 4, Math.log10(6000), 26]],
            ],
            "circle-color": ["coalesce", ["get", "color"], "#9ca3af"],
            "circle-opacity": [
              "*", o,
              ["match", ["get", "status"],
                "construction", 0.85,
                "pre-construction", 0.55,
                "announced", 0.35,
                0.6],
            ],
            "circle-stroke-width": 1.2,
            "circle-stroke-color": [
              "match", ["get", "status"],
              "construction", "#fff500",        // 霓虹電光黃
              "pre-construction", "#00d4ff",    // 霓虹電光藍
              "announced", "#a5b4fc",           // 霓虹淡紫藍
              "#a5b4fc",
            ],
            // 注意：mapbox-gl 不支援 circle stroke dasharray
          };
        },
      },
    ],
  },

  // ── L4 歷史（退役 / 擱置）15 ──
  {
    id: "facHistorical",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fac-historical",
    dynamicData: true,
    rebuildOnParamChange: ["facHistoricalOpacity", "facHistoricalScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.facHistoricalOpacity ?? 0.5;
          const s = params?.facHistoricalScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
                Math.log10(0.5), 2, Math.log10(6000), 11]],
              12, ["*", s, ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
                Math.log10(0.5), 4, Math.log10(6000), 22]],
            ],
            "circle-color": "#525252",
            "circle-opacity": [
              "*", o,
              ["match", ["get", "status"],
                "mothballed", 0.55,
                "shelved", 0.35,
                "retired", 0.30,
                0.4],
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#737373",
          };
        },
      },
    ],
  },

  // ── L5 次要 341（小型 / 分散）──
  {
    id: "facSecondary",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fac-secondary",
    dynamicData: true,
    rebuildOnParamChange: ["facSecondaryOpacity", "facSecondaryScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.facSecondaryOpacity ?? 0.85;
          const s = params?.facSecondaryScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
                Math.log10(0.5), 1.5, Math.log10(100), 6]],
              12, ["*", s, ["interpolate", ["linear"], ["log10", ["max", ["coalesce", ["get", "total_capacity_mw"], 0.5], 0.5]],
                Math.log10(0.5), 3, Math.log10(100), 12]],
            ],
            "circle-color": ["coalesce", ["get", "color"], "#9ca3af"],
            "circle-opacity": o * 0.9,
            "circle-stroke-width": 0.6,
            "circle-stroke-color": isDark ? "#0f172a" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── L6 OSM 補充（無名單機）1,215 ──
  {
    id: "facOsmSupplement",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "energy-fac-osm-supplement",
    dynamicData: true,
    rebuildOnParamChange: ["facOsmSupplementOpacity", "facOsmSupplementScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.facOsmSupplementOpacity ?? 0.7;
          const s = params?.facOsmSupplementScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, 1.5],
              12, ["*", s, 3.5],
              15, ["*", s, 5.5],
            ],
            "circle-color": ["coalesce", ["get", "color"], "#9ca3af"],
            "circle-opacity": o * 0.75,
            "circle-stroke-width": 0.4,
            "circle-stroke-color": isDark ? "#1f2937" : "#e5e7eb",
          };
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  //  化石燃料 14 layer（Phase B — public.get_fossil_fuel_layers()）
  //  資料源：useFossilFuelLayers + fossilFuelLoader（單次 RPC + group by layer）
  //  point: circle (5 加油站 + 2 LPG + 1 LNG + 1 煤炭)
  //  line:  line   (天然氣 / 油氣管線)
  //  fill:  fill + line outline (煉油 / 儲槽 / 火力 polygon)
  // ══════════════════════════════════════════════════════════════════

  // ── 加油站（中油 主要）──
  {
    id: "gasStationCpc",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-gas-station-cpc",
    dynamicData: true,
    rebuildOnParamChange: ["gasStationCpcOpacity", "gasStationCpcScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.gasStationCpcOpacity ?? 0.85;
          const s = params?.gasStationCpcScale ?? 1.7;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.4],
              12, ["*", s, 3.5],
              15, ["*", s, 6],
            ],
            "circle-color": "#41AEF2",
            "circle-opacity": o,
            "circle-stroke-width": 0.3,
            "circle-stroke-color": "#ffffff",
          };
        },
      },
    ],
  },

  // ── 加油站（台塑系）──
  {
    id: "gasStationFpcc",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-gas-station-fpcc",
    dynamicData: true,
    rebuildOnParamChange: ["gasStationFpccOpacity", "gasStationFpccScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.gasStationFpccOpacity ?? 0.85;
          const s = params?.gasStationFpccScale ?? 1.7;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.4],
              12, ["*", s, 3.5],
              15, ["*", s, 6],
            ],
            "circle-color": "#22C55E",
            "circle-opacity": o,
            "circle-stroke-width": 0.3,
            "circle-stroke-color": "#ffffff",
          };
        },
      },
    ],
  },

  // ── 加油站（台糖）──
  {
    id: "gasStationTaisugar",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-gas-station-taisugar",
    dynamicData: true,
    rebuildOnParamChange: ["gasStationTaisugarOpacity", "gasStationTaisugarScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.gasStationTaisugarOpacity ?? 0.85;
          const s = params?.gasStationTaisugarScale ?? 1.7;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.4],
              12, ["*", s, 3.5],
              15, ["*", s, 6],
            ],
            "circle-color": "#F2522E",
            "circle-opacity": o,
            "circle-stroke-width": 0.3,
            "circle-stroke-color": "#ffffff",
          };
        },
      },
    ],
  },

  // ── 加油站（其他 / 私營）──
  {
    id: "gasStationOther",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-gas-station-other",
    dynamicData: true,
    rebuildOnParamChange: ["gasStationOtherOpacity", "gasStationOtherScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.gasStationOtherOpacity ?? 0.7;
          const s = params?.gasStationOtherScale ?? 2.2;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.2],
              12, ["*", s, 3],
              15, ["*", s, 5],
            ],
            "circle-color": "#D1D5DB",
            "circle-opacity": o,
            "circle-stroke-width": 0.3,
            "circle-stroke-color": "#ffffff",
          };
        },
      },
    ],
  },

  // ── 加油站 SSOT Canonical（全品牌合併） ──
  {
    id: "gasStationCanonical",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-gas-station-canonical",
    dynamicData: true,
    rebuildOnParamChange: ["gasStationCanonicalOpacity", "gasStationCanonicalScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.gasStationCanonicalOpacity ?? 0.9;
          const s = params?.gasStationCanonicalScale ?? 1.7;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.6],
              12, ["*", s, 4],
              15, ["*", s, 7],
            ],
            "circle-color": "#0FBFBF",
            "circle-opacity": o,
            "circle-stroke-width": 0.3,
            "circle-stroke-color": "#ffffff",
          };
        },
      },
    ],
  },

  // ── LPG 分裝 / 儲存場 ──
  {
    id: "lpgSubpackaging",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-lpg-subpackaging",
    dynamicData: true,
    rebuildOnParamChange: ["lpgSubpackagingOpacity", "lpgSubpackagingScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.lpgSubpackagingOpacity ?? 0.85;
          const s = params?.lpgSubpackagingScale ?? 1.1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, 2],
              12, ["*", s, 5],
              15, ["*", s, 8],
            ],
            "circle-color": "#F2622E",
            "circle-opacity": o,
            "circle-stroke-width": 0.8,
            "circle-stroke-color": isDark ? "#0f172a" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── LPG 加氣站 / 瓦斯行 ──
  {
    id: "lpgRetailers",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-lpg-retailers",
    dynamicData: true,
    rebuildOnParamChange: ["lpgRetailersOpacity", "lpgRetailersScale"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.lpgRetailersOpacity ?? 0.75;
          const s = params?.lpgRetailersScale ?? 1.3;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              8, ["*", s, 1.2],
              12, ["*", s, 3],
              15, ["*", s, 5],
            ],
            "circle-color": "#D9863D",
            "circle-opacity": o,
            "circle-stroke-width": 0.5,
            "circle-stroke-color": isDark ? "#1f2937" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── LNG 接收站 ──
  {
    id: "lngTerminal",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-lng-terminal",
    dynamicData: true,
    rebuildOnParamChange: ["lngTerminalOpacity", "lngTerminalScale"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.lngTerminalOpacity ?? 0.95;
          const s = params?.lngTerminalScale ?? 1.6;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, 6],
              12, ["*", s, 16],
            ],
            "circle-blur": 0.7,
            "circle-color": "#F2B84B",
            "circle-opacity": o * 0.35,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.lngTerminalOpacity ?? 0.95;
          const s = params?.lngTerminalScale ?? 1.6;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, 3],
              12, ["*", s, 8],
            ],
            "circle-color": "#F2B84B",
            "circle-opacity": o,
            "circle-stroke-width": 1.2,
            "circle-stroke-color": isDark ? "#0f172a" : "#ffffff",
          };
        },
      },
    ],
  },

  // ── 天然氣主幹線（LineString） ──
  {
    id: "pipelineGas",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-pipeline-gas",
    dynamicData: true,
    rebuildOnParamChange: ["pipelineGasOpacity", "pipelineGasWidth"],
    layers: [
      {
        suffix: "line",
        type: "line",
        paint: (_isDark, params) => {
          const o = params?.pipelineGasOpacity ?? 0.8;
          const w = params?.pipelineGasWidth ?? 2.0;
          return {
            "line-color": "#F2D64B",
            "line-width": w,
            "line-opacity": o,
          };
        },
      },
    ],
  },

  // ── 油氣管線（OSM LineString） ──
  {
    id: "pipelineOilGas",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-pipeline-oilgas",
    dynamicData: true,
    rebuildOnParamChange: ["pipelineOilGasOpacity", "pipelineOilGasWidth"],
    layers: [
      {
        suffix: "line",
        type: "line",
        paint: (_isDark, params) => {
          const o = params?.pipelineOilGasOpacity ?? 0.7;
          const w = params?.pipelineOilGasWidth ?? 1.5;
          return {
            "line-color": "#EDF249",
            "line-width": w,
            "line-opacity": o,
            "line-dasharray": [2, 2],
          };
        },
      },
    ],
  },

  // ── 煉油 / 化工廠 polygon + halo ──
  {
    id: "industrialRefinery",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-industrial-refinery",
    dynamicData: true,
    rebuildOnParamChange: ["industrialRefineryOpacity", "industrialRefineryOutline"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (_isDark, params) => {
          const o = params?.industrialRefineryOpacity ?? 0.55;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 10, 18, 14, 36],
            "circle-blur": 0.8,
            "circle-color": "#A855F7",
            "circle-opacity": o * 0.5,
          };
        },
      },
      {
        suffix: "halo-core",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (_isDark, params) => {
          const o = params?.industrialRefineryOpacity ?? 0.55;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2, 10, 5, 14, 9],
            "circle-color": "#A855F7",
            "circle-opacity": o,
          };
        },
      },
      {
        suffix: "fill",
        type: "fill",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (_isDark, params) => {
          const o = params?.industrialRefineryOpacity ?? 0.55;
          return {
            "fill-color": "#A855F7",
            "fill-opacity": o * 0.5,
          };
        },
      },
      {
        suffix: "outline",
        type: "line",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (_isDark, params) => {
          const o = params?.industrialRefineryOpacity ?? 0.55;
          const show = (params?.industrialRefineryOutline ?? 1) > 0;
          return {
            "line-color": "#A855F7",
            "line-width": show ? 1 : 0,
            "line-opacity": show ? o : 0,
          };
        },
      },
    ],
  },

  // ── 油氣儲槽 polygon + halo ──
  {
    id: "industrialStorageTank",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-industrial-storage-tank",
    dynamicData: true,
    rebuildOnParamChange: ["industrialStorageTankOpacity", "industrialStorageTankOutline"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (_isDark, params) => {
          const o = params?.industrialStorageTankOpacity ?? 0.55;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 10, 14, 14, 28],
            "circle-blur": 0.8,
            "circle-color": "#06B6D4",
            "circle-opacity": o * 0.5,
          };
        },
      },
      {
        suffix: "halo-core",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (_isDark, params) => {
          const o = params?.industrialStorageTankOpacity ?? 0.55;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.5, 10, 4, 14, 7],
            "circle-color": "#06B6D4",
            "circle-opacity": o,
          };
        },
      },
      {
        suffix: "fill",
        type: "fill",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (_isDark, params) => {
          const o = params?.industrialStorageTankOpacity ?? 0.55;
          return {
            "fill-color": "#06B6D4",
            "fill-opacity": o * 0.5,
          };
        },
      },
      {
        suffix: "outline",
        type: "line",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (_isDark, params) => {
          const o = params?.industrialStorageTankOpacity ?? 0.55;
          const show = (params?.industrialStorageTankOutline ?? 1) > 0;
          return {
            "line-color": "#06B6D4",
            "line-width": show ? 2 : 0,
            "line-opacity": show ? o : 0,
          };
        },
      },
    ],
  },

  // ── 火力廠 polygon + halo ──
  {
    id: "industrialPowerPlant",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-industrial-power-plant",
    dynamicData: true,
    rebuildOnParamChange: ["industrialPowerPlantOpacity", "industrialPowerPlantOutline"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (_isDark, params) => {
          const o = params?.industrialPowerPlantOpacity ?? 0.5;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 7, 10, 20, 14, 40],
            "circle-blur": 0.8,
            "circle-color": "#D946EF",
            "circle-opacity": o * 0.55,
          };
        },
      },
      {
        suffix: "halo-core",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (_isDark, params) => {
          const o = params?.industrialPowerPlantOpacity ?? 0.5;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 10, 6, 14, 10],
            "circle-color": "#D946EF",
            "circle-opacity": o,
          };
        },
      },
      {
        suffix: "fill",
        type: "fill",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (_isDark, params) => {
          const o = params?.industrialPowerPlantOpacity ?? 0.5;
          return {
            "fill-color": "#D946EF",
            "fill-opacity": o * 0.5,
          };
        },
      },
      {
        suffix: "outline",
        type: "line",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (_isDark, params) => {
          const o = params?.industrialPowerPlantOpacity ?? 0.5;
          const show = (params?.industrialPowerPlantOutline ?? 1) > 0;
          return {
            "line-color": "#D946EF",
            "line-width": show ? 1 : 0,
            "line-opacity": show ? o : 0,
          };
        },
      },
    ],
  },

  // ── 煤炭碼頭 ──
  {
    id: "coalTerminal",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "fossil-coal-terminal",
    dynamicData: true,
    rebuildOnParamChange: ["coalTerminalOpacity", "coalTerminalScale"],
    layers: [
      {
        suffix: "halo",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.coalTerminalOpacity ?? 0.95;
          const s = params?.coalTerminalScale ?? 1.4;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, 5],
              12, ["*", s, 13],
            ],
            "circle-blur": 0.7,
            "circle-color": "#3B82F6",
            "circle-opacity": o * 0.35,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.coalTerminalOpacity ?? 0.95;
          const s = params?.coalTerminalScale ?? 1.4;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, 3],
              12, ["*", s, 7],
            ],
            "circle-color": "#3B82F6",
            "circle-opacity": o,
            "circle-stroke-width": 1.2,
            "circle-stroke-color": isDark ? "#fafafa" : "#ffffff",
          };
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  //  雲林 POC 覆蓋分析（multi-source dijkstra nearest distance）— 5 個 toggle
  //  資料源：PMTiles 在 public/coverage/taiwan_*_nearest.pmtiles
  //  視覺：每條 OSM drive edge 染「到最近加油站/EV 站」距離 5 級色階
  //  仿 fire isochrone PMTiles 模式（factory 不需要 — 走 overlayRegistry pmtiles 設定）
  // ══════════════════════════════════════════════════════════════════

  ...gasCoverageOverlay({
    id: "gasCoverageAll",
    sourceId: "coverage-gas-all",
    pmtilesUrl: "./coverage/taiwan_all_gas_nearest.pmtiles",
    sourceLayer: "coverage_all_gas",
    opacityKey: "gasCoverageAllOpacity",
    widthKey: "gasCoverageAllLineWidth",
    palette: "gas",
  }),
  ...gasCoverageOverlay({
    id: "gasCoverageCpc",
    sourceId: "coverage-gas-cpc",
    pmtilesUrl: "./coverage/taiwan_cpc_nearest.pmtiles",
    sourceLayer: "coverage_cpc",
    opacityKey: "gasCoverageCpcOpacity",
    widthKey: "gasCoverageCpcLineWidth",
    palette: "gas",
  }),
  ...gasCoverageOverlay({
    id: "gasCoverageFpcc",
    sourceId: "coverage-gas-fpcc",
    pmtilesUrl: "./coverage/taiwan_fpcc_nearest.pmtiles",
    sourceLayer: "coverage_fpcc",
    opacityKey: "gasCoverageFpccOpacity",
    widthKey: "gasCoverageFpccLineWidth",
    palette: "gas",
  }),
  ...gasCoverageOverlay({
    id: "gasCoverageTaisugar",
    sourceId: "coverage-gas-taisugar",
    pmtilesUrl: "./coverage/taiwan_taisugar_nearest.pmtiles",
    sourceLayer: "coverage_taisugar",
    opacityKey: "gasCoverageTaisugarOpacity",
    widthKey: "gasCoverageTaisugarLineWidth",
    palette: "gas",
  }),
  ...gasCoverageOverlay({
    id: "evIsland",
    sourceId: "coverage-ev-island",
    pmtilesUrl: "./coverage/taiwan_ev_nearest.pmtiles",
    sourceLayer: "coverage_ev",
    opacityKey: "evIslandOpacity",
    widthKey: "evIslandLineWidth",
    palette: "gas",
  }),

  // ── 房地產 REAL ESTATE（grid 走 PMTiles；point 改走 WebGL CustomLayer，見 useRealEstatePointsLayer） ──
  realEstateGridOverlay("realEstateRentalGrid", "rental", "rental"),
  realEstateGridOverlay("realEstateSaleGrid", "sale", "sale"),
  realEstateGridOverlay("realEstatePresaleGrid", "presale", "presale"),

];
