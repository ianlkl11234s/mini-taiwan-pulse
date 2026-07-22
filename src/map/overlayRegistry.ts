import type { OverlayConfig } from "../types";
import { ECO_NETWORK_ZONE_MATCH } from "../data/ecoNetworkZoneTypes";
import { FOREST_RESERVE_TYPE_MATCH } from "../data/forestReserveTypes";
import { NEWS_CATEGORY_COLOR_EXPR } from "../data/newsEventTypes";
import {
  SEVERITY_COLOR_EXPR,
  PENALTY_MEDIUM_COLOR_EXPR,
  PENALTY_SEVERITY_COLORS,
  PENALTY_CRITICAL_FILTER,
  PENALTY_GENERAL_FILTER,
  PENALTY_MOBILE_FILTER,
} from "../data/pollutionTypes";
import {
  FARM_COLOR, FARM_COLOR_RAMP, FARM_SIZE_DOMAIN, FARM_RADIUS_PX, FARM_HIGHLIGHT_OPTIONS,
  OTHER_SPECIES_SIZE_DOMAIN, OTHER_SIZE_DOMAIN_DEFAULT,
  OTHER_SPECIES_COLOR_RAMP, OTHER_COLOR_RAMP_DEFAULT,
  POULTRY_HEADS, SLAUGHTER_COLOR, FEED_COLOR, MARKET_COLOR,
} from "../data/livestockTypes";
import {
  sportsCategoryColorExpr, SPORTS_LAYERS, SPORTS_AREA_DOMAIN, SPORTS_RADIUS_PX,
  SPORTS_RADIUS_FALLBACK_PX, SPORTS_CLOSED_DIM, type SportsLayerMeta,
} from "../data/sportsTypes";
import {
  availabilityColorExpr, neutralCapacityColorExpr, sourceCategoryRingExpr,
} from "../data/parkingLoader";
import {
  streetTreeSpeciesColorExpr, streetTreeDiameterColorExpr, streetTreeHeightColorExpr,
} from "../data/streetTreeColors";
import {
  protectedTreeAgeColorExpr, protectedTreeCityColorExpr, PROTECTED_TREE_CITIES,
  riversideTreeSpeciesColorExpr, RIVERSIDE_PARKS,
  taipeiParkCategoryColorExpr, TAIPEI_PARK_CATEGORIES, PARK_AREA_DOMAIN,
  streetTree3epochTrajColorExpr, streetTree3epochSpeciesColorExpr,
  streetTree3epochDiameterColorExpr, streetTree3epochHeightColorExpr,
  STREET_TREE_3EPOCH_TRAJ_FILTERS,
  streetTreeNationalSpeciesColorExpr, streetTreeNationalCityColorExpr, STREET_TREE_NATIONAL_CITIES,
  treePitTypeColorExpr, TREE_PIT_TYPES,
} from "../data/urbanOpenSpaceTypes";
import { buildingHeightColorExpr, buildingSrcColorExpr, buildingNightLightColorExpr } from "../data/buildingsGbaTypes";
import { urbanFormGridColorExpr, urbanFormGridOpacityExpr } from "../data/urbanFormGridTypes";
import { urbanZoningColorExpr, URBAN_ZONING_CATEGORIES } from "../data/urbanZoningTypes";
import {
  culturalFacilityColorExpr, CULTURAL_FACILITY_TYPES,
  culturalMuseumColorExpr, CULTURAL_MUSEUM_TYPES,
  ARTS_EVENT_ONGOING_COLOR, ARTS_EVENT_UPCOMING_COLOR, PERFORMING_VENUE_COLOR,
} from "../data/cultureTypes";

/** 台北時區今日 YYYY/MM/DD（sv-SE 慣例見 useTimeline.ts:82；藝文活動進行中/未開始判斷用） */
function cultureTodayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).replace(/-/g, "/");
}

/**
 * aquacultureWaterSatelliteMoa 的「確認／漁電共生／其他」三組類別篩選 checkbox（0/1 param，預設全開）
 * → 組成 display_class in-list filter。三組皆關閉時回傳恆假 filter（面全隱藏，而非退回顯示全部）。
 */
function moaDisplayClassFilter(p?: Record<string, number>): unknown[] {
  const classes: string[] = [];
  if ((p?.aquacultureWaterSatelliteMoaShowConfirmed ?? 1) === 1) classes.push("confirmed");
  if ((p?.aquacultureWaterSatelliteMoaShowSolar ?? 1) === 1) classes.push("solar_symbiotic");
  if ((p?.aquacultureWaterSatelliteMoaShowOther ?? 1) === 1) classes.push("unverified", "ambiguous", "mountain_suspect");
  return classes.length > 0
    ? ["in", ["get", "display_class"], ["literal", classes]]
    : ["==", ["get", "display_class"], "__none__"];
}

/**
 * aquacultureWaterUnion 的「兩版都有／只官方／只舊版」三組類別篩選 checkbox（0/1 param，預設全開）
 * → 組成 union_class in-list filter（同 moaDisplayClassFilter pattern）。
 */
function unionClassFilter(p?: Record<string, number>): unknown[] {
  const classes: string[] = [];
  if ((p?.aquacultureWaterUnionShowBoth ?? 1) === 1) classes.push("both");
  if ((p?.aquacultureWaterUnionShowMoaOnly ?? 1) === 1) classes.push("moa_only");
  if ((p?.aquacultureWaterUnionShowOsmOnly ?? 1) === 1) classes.push("osm_only");
  return classes.length > 0
    ? ["in", ["get", "union_class"], ["literal", classes]]
    : ["==", ["get", "union_class"], "__none__"];
}

const BASE_RADIUS = 5;

// ── 🐷 畜牧 Livestock helpers ──
const FARM_SOURCE = "./agriculture/livestock_farms.geojson";

// 飼養場圓圈大小：per-species 總隻數 log 尺標（各層獨立 domain + 兩端 clamp）。
// 無 zoom 項（用戶要大小純綁數量，不隨 zoom 變）。
function farmRadius(scale: number, lo: number, hi: number): unknown[] {
  const [rMin, rMax] = FARM_RADIUS_PX;
  return [
    "interpolate", ["linear"],
    ["ln", ["max", ["to-number", ["get", "總隻數"]], 1]],
    Math.log(lo), rMin * scale,
    Math.log(hi), rMax * scale,
  ];
}

// 「其他」層依主畜種各自 size domain（鵪鶉量大、鹿量小，不共用尺標）
function otherFarmRadius(scale: number): unknown[] {
  const m: unknown[] = ["match", ["get", "主畜種"]];
  for (const [sp, dom] of Object.entries(OTHER_SPECIES_SIZE_DOMAIN)) {
    m.push(sp, farmRadius(scale, dom[0], dom[1]));
  }
  m.push(farmRadius(scale, OTHER_SIZE_DOMAIN_DEFAULT[0], OTHER_SIZE_DOMAIN_DEFAULT[1])); // default
  return m;
}

// 同色系「淺→深」依總隻數內插（越多越深）
function farmColorRamp(lo: number, hi: number, light: string, dark: string): unknown[] {
  return [
    "interpolate", ["linear"],
    ["ln", ["max", ["to-number", ["get", "總隻數"]], 1]],
    Math.log(lo), light,
    Math.log(hi), dark,
  ];
}

// 「其他」層依主畜種各自色系（domain 同 size，各物種淺→深）
function otherFarmColor(): unknown[] {
  const m: unknown[] = ["match", ["get", "主畜種"]];
  for (const [sp, dom] of Object.entries(OTHER_SPECIES_SIZE_DOMAIN)) {
    const ramp = OTHER_SPECIES_COLOR_RAMP[sp] ?? OTHER_COLOR_RAMP_DEFAULT;
    m.push(sp, farmColorRamp(dom[0], dom[1], ramp[0], ramp[1]));
  }
  m.push(farmColorRamp(OTHER_SIZE_DOMAIN_DEFAULT[0], OTHER_SIZE_DOMAIN_DEFAULT[1], OTHER_COLOR_RAMP_DEFAULT[0], OTHER_COLOR_RAMP_DEFAULT[1]));
  return m;
}

// 飼養場單層 config：4 層共用 livestock-farms source（1 次 fetch），靠 config.filter 分畜種。
function livestockFarmOverlay(
  id: "livestockFarmPig" | "livestockFarmChicken" | "livestockFarmCattle" | "livestockFarmDuck" | "livestockFarmGoose" | "livestockFarmSheep" | "livestockFarmOther",
  species: string,
  filter: unknown[],
): OverlayConfig {
  const color = FARM_COLOR[species] ?? "#9e9e9e";
  const [lo, hi]: [number, number] = FARM_SIZE_DOMAIN[id] ?? [1, 100];
  const [lightColor, darkColor] = FARM_COLOR_RAMP[species] ?? [color, color];
  // 同色系「淺→深」依總隻數內插（越多越深）；「其他」層再依主畜種各自色系
  const colorExpr: unknown[] = id === "livestockFarmOther"
    ? otherFarmColor()
    : farmColorRamp(lo, hi, lightColor, darkColor);
  const suffix = id.replace("livestockFarm", "").toLowerCase();
  return {
    id,
    sourceUrl: FARM_SOURCE,
    sourceId: "livestock-farms",
    // owner-only 動態：改由 useLivestockLayers 從 owner-only RPC setData（見 docs/features/owner-gated-layers）；
    // sourceUrl 保留作 loader 端 fallback（本層已改走 RPC，實務不再 fetch 該檔）。
    dynamicData: true,
    filter,
    layers: [
      {
        suffix,
        type: "circle",
        minzoom: 6,
        paint: (isDark, p) => {
          const scale = p?.[`${id}Scale`] ?? 1;
          const opacity = p?.[`${id}Opacity`] ?? 0.85;
          // 品項高亮：下拉選一個種類明細品項（idx>0）→ 命中場保持正常、其他淡化
          const hIdx = p?.[`${id}HighlightIdx`] ?? 0;
          const selected = hIdx > 0 ? FARM_HIGHLIGHT_OPTIONS[id][hIdx] : undefined;
          // 基礎透明度（低精度 523 場淡化，避免誤讀為精確場址）
          const baseFill: unknown[] = ["case", ["==", ["get", "精度"], "低"], opacity * 0.35, opacity];
          const matched: unknown[] = ["in", selected ?? "", ["get", "種類明細"]];
          const fillExpr: unknown[] = selected ? ["case", matched, baseFill, opacity * 0.08] : baseFill;
          const strokeExpr: unknown[] | number = selected
            ? ["case", matched, opacity * 0.7, opacity * 0.06]
            : opacity * 0.7;
          return {
            "circle-radius": id === "livestockFarmOther" ? otherFarmRadius(scale) : farmRadius(scale, lo, hi),
            "circle-color": colorExpr,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 14, 1],
            "circle-opacity": fillExpr,
            "circle-stroke-opacity": strokeExpr,
          };
        },
      },
    ],
  };
}

// ── 🏟️ 運動場館 Sports helpers ──
const SPORTS_SOURCE = "./sports/all_venues.geojson";

// 圓圈大小：area_sqm log 尺標（兩端 clamp）；area_sqm 缺值（380 筆 NULL/0）退化為固定半徑。
// 無 zoom 項（大小純綁面積，比照 livestock farmRadius）。
function sportsRadius(scale: number): unknown[] {
  const [lo, hi] = SPORTS_AREA_DOMAIN;
  const [rMin, rMax] = SPORTS_RADIUS_PX;
  const area: unknown[] = ["to-number", ["get", "area_sqm"], 0]; // null → 0
  const logSize: unknown[] = [
    "interpolate", ["linear"],
    ["ln", ["max", area, 1]],
    Math.log(lo), rMin * scale,
    Math.log(hi), rMax * scale,
  ];
  return ["case", [">", area, 0], logSize, SPORTS_RADIUS_FALLBACK_PX * scale];
}

// 單一 sublayer config：5 層共用 sports-venues source（sourceId 相同 → 只 fetch 一次），
// 靠 config.filter 分 layer 隸屬類；circle 依 category 27 類 match 分色 + open_status 淡化。
function sportsVenueOverlay(meta: SportsLayerMeta): OverlayConfig {
  const { id, layerValue, suffix } = meta;
  return {
    id,
    sourceUrl: SPORTS_SOURCE,
    sourceId: "sports-venues",
    filter: ["==", ["get", "layer"], layerValue],
    layers: [
      {
        suffix,
        type: "circle",
        minzoom: 7,
        paint: (isDark, p) => {
          const scale = p?.[`${id}Scale`] ?? 1;
          const opacity = p?.[`${id}Opacity`] ?? 0.8;
          // open_status="不對外" 淡化（避免誤讀為可用場地）
          const closed: unknown[] = ["==", ["get", "open_status"], "不對外"];
          const fillOpacity: unknown[] = ["case", closed, opacity * SPORTS_CLOSED_DIM, opacity];
          const strokeOpacity: unknown[] = ["case", closed, opacity * SPORTS_CLOSED_DIM * 0.8, opacity * 0.7];
          return {
            "circle-radius": sportsRadius(scale),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "circle-color": sportsCategoryColorExpr() as any,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 7, 0.3, 14, 1],
            "circle-opacity": fillOpacity,
            "circle-stroke-opacity": strokeOpacity,
          };
        },
      },
    ],
  };
}

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

  // ── Post Offices (郵局，1278 點) ──
  {
    id: "postOffices",
    sourceUrl: "./civic_facilities/post_offices_national.geojson",
    sourceId: "post-offices",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.postOfficesScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 6 * scale, 12, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": "#d32f2f",
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.postOfficesScale ?? 1;
          const opacity = params?.postOfficesOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 3 * scale, 12, 6 * scale,
            ],
            "circle-color": "#d32f2f",
            "circle-stroke-color": "#b71c1c",
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

  // ── iPost Boxes (i郵箱，2345 點) ──
  {
    id: "iPostBoxes",
    sourceUrl: "./civic_facilities/ibox_national.geojson",
    sourceId: "ipost-boxes",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.iPostBoxesScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 6 * scale, 12, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": "#ef6c00",
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.iPostBoxesScale ?? 1;
          const opacity = params?.iPostBoxesOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 3 * scale, 12, 6 * scale,
            ],
            "circle-color": "#ef6c00",
            "circle-stroke-color": "#e65100",
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

  // ── Community Centers (社區活動中心，1794 點，8 縣市部分覆蓋) ──
  {
    id: "communityCenters",
    sourceUrl: "./civic_facilities/community_centers_national.geojson",
    sourceId: "community-centers",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.communityCentersScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 6 * scale, 12, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": "#26a69a",
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.communityCentersScale ?? 1;
          const opacity = params?.communityCentersOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 3 * scale, 12, 6 * scale,
            ],
            "circle-color": "#26a69a",
            "circle-stroke-color": "#00897b",
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

  // ── Gov Service Offices (機關便民據點，702 點，type 3 類分色) ──
  {
    id: "govServiceOffices",
    sourceUrl: "./civic_facilities/gov_service_offices_national.geojson",
    sourceId: "gov-service-offices",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.govServiceOfficesScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 8 * scale, 12, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": [
              "match", ["get", "type"],
              "district_office", "#8d6e63",
              "household_registration", "#7986cb",
              "land_office", "#9ccc65",
              "#8d6e63",
            ] as unknown as string,
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.govServiceOfficesScale ?? 1;
          const opacity = params?.govServiceOfficesOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 4 * scale, 12, 8 * scale,
            ],
            "circle-color": [
              "match", ["get", "type"],
              "district_office", "#8d6e63",
              "household_registration", "#7986cb",
              "land_office", "#9ccc65",
              "#8d6e63",
            ] as unknown as string,
            "circle-stroke-color": "#3e2723",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              6, 0, 10, 0.3, 14, 0.6,
            ],
            "circle-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── Public Libraries (公共圖書館，634 點) ──
  {
    id: "publicLibraries",
    sourceUrl: "./culture/public_libraries_national.geojson",
    sourceId: "public-libraries",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.publicLibrariesScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 8 * scale, 12, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": "#5c6bc0",
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.publicLibrariesScale ?? 1;
          const opacity = params?.publicLibrariesOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 4 * scale, 12, 8 * scale,
            ],
            "circle-color": "#5c6bc0",
            "circle-stroke-color": "#3949ab",
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

  // ── Welfare Centers (社福中心，157 點，資料時點 2023-04) ──
  {
    id: "welfareCenters",
    sourceUrl: "./civic_facilities/welfare_centers_national.geojson",
    sourceId: "welfare-centers",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.welfareCentersScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 8 * scale, 12, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": "#ec407a",
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.welfareCentersScale ?? 1;
          const opacity = params?.welfareCentersOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 4 * scale, 12, 8 * scale,
            ],
            "circle-color": "#ec407a",
            "circle-stroke-color": "#c2185b",
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

  // ── Public Retail Markets (公有零售市場，731 點) ──
  {
    id: "retailMarkets",
    sourceUrl: "./poi/public_retail_markets_national.geojson",
    sourceId: "retail-markets",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.retailMarketsScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 8 * scale, 12, 16 * scale,
            ],
            "circle-blur": 1,
            "circle-color": "#66bb6a",
            "circle-opacity": 0.15,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const scale = params?.retailMarketsScale ?? 1;
          const opacity = params?.retailMarketsOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 4 * scale, 12, 8 * scale,
            ],
            "circle-color": "#66bb6a",
            "circle-stroke-color": "#388e3c",
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

  // ── Public Toilets (公廁，13,281 點) ──
  // grade 4 級分色（特優/優等/普通/不合格，缺值 fallback 灰）；13k 點 → minzoom 11 控密度
  {
    id: "publicToilets",
    sourceUrl: "./environment/public_toilets_national.geojson",
    sourceId: "public-toilets",
    rebuildOnParamChange: ["glow", "circle"],
    layers: [
      {
        suffix: "glow",
        type: "circle",
        minzoom: 11,
        paint: (_isDark, params) => {
          const scale = params?.publicToiletsScale ?? 1;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              11, 5 * scale, 16, 12 * scale,
            ],
            "circle-blur": 1,
            "circle-color": [
              "match", ["get", "grade"],
              "特優級", "#7e57c2",
              "優等級", "#ab47bc",
              "普通級", "#ffb300",
              "不合格", "#e53935",
              "#9e9e9e",
            ] as unknown as string,
            "circle-opacity": 0.12,
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        minzoom: 11,
        paint: (_isDark, params) => {
          const scale = params?.publicToiletsScale ?? 1;
          const opacity = params?.publicToiletsOpacity ?? 0.75;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              11, 2.5 * scale, 16, 6 * scale,
            ],
            "circle-color": [
              "match", ["get", "grade"],
              "特優級", "#7e57c2",
              "優等級", "#ab47bc",
              "普通級", "#ffb300",
              "不合格", "#e53935",
              "#9e9e9e",
            ] as unknown as string,
            "circle-stroke-color": "#311b92",
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              11, 0, 13, 0.3, 16, 0.6,
            ],
            "circle-opacity": opacity,
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

  // ── 湖泊 / 埤塘 / 池塘 Lakes & Ponds (OSM natural=water，52,314 面) ──
  // water 分色（pond/lake/reservoir/basin）；預設濾掉 overlaps_aquaculture=true
  // （39.1% 與魚塭圖層重疊，避免視覺打架，見上游 lakes_ponds_osm.md）。
  {
    id: "lakesPondsOsm",
    sourceUrl: "./water_resources/lakes_ponds_osm.pmtiles",
    sourceId: "lakes-ponds-osm",
    pmtiles: { sourceLayer: "lakes_ponds_osm", minzoom: 5, maxzoom: 14 },
    filter: ["!=", ["get", "overlaps_aquaculture"], true],
    rebuildOnParamChange: ["lakesPondsOsmOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill",
        paint: (_isDark, p) => ({
          "fill-color": [
            "match", ["get", "water"],
            "pond", "#4fc3f7",
            "lake", "#1e88e5",
            "reservoir", "#00acc1",
            "basin", "#7e57c2",
            "#4fc3f7",
          ],
          "fill-opacity": p?.lakesPondsOsmOpacity ?? 0.5,
        }),
      },
      {
        suffix: "line", type: "line",
        paint: () => ({
          "line-color": [
            "match", ["get", "water"],
            "pond", "#4fc3f7",
            "lake", "#1e88e5",
            "reservoir", "#00acc1",
            "basin", "#7e57c2",
            "#4fc3f7",
          ],
          "line-width": 0.5, "line-opacity": 0.6,
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

  // ── 🐷 畜牧 Livestock（靜態 CDN geojson，走 ./agriculture/）──
  // 飼養場 4 層共用 livestock-farms source（sourceId 相同 → 只 fetch 一次），靠 config.filter 分畜種
  livestockFarmOverlay("livestockFarmPig", "豬", ["==", ["get", "主畜種"], "豬"]),
  livestockFarmOverlay("livestockFarmChicken", "雞", ["==", ["get", "主畜種"], "雞"]),
  livestockFarmOverlay("livestockFarmCattle", "牛", ["==", ["get", "主畜種"], "牛"]),
  livestockFarmOverlay("livestockFarmDuck", "鴨", ["==", ["get", "主畜種"], "鴨"]),
  livestockFarmOverlay("livestockFarmGoose", "鵝", ["==", ["get", "主畜種"], "鵝"]),
  livestockFarmOverlay("livestockFarmSheep", "羊", ["==", ["get", "主畜種"], "羊"]),
  livestockFarmOverlay("livestockFarmOther", "其他", ["!", ["in", ["get", "主畜種"], ["literal", ["豬", "雞", "牛", "鴨", "鵝", "羊"]]]]),
  // 屠宰場：依「種類」首字分家畜(豬牛羊)/家禽(雞鴨鵝)
  {
    id: "livestockSlaughter",
    sourceUrl: "./agriculture/slaughterhouses.geojson",
    sourceId: "livestock-slaughter",
    // owner-only 動態：改由 useLivestockLayers 從 owner-only RPC setData
    dynamicData: true,
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 6,
        paint: (isDark, p) => {
          const scale = p?.livestockSlaughterScale ?? 1;
          const opacity = p?.livestockSlaughterOpacity ?? 0.9;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3.5 * scale, 10, 6 * scale, 14, 9 * scale],
            "circle-color": ["match", ["slice", ["get", "種類"], 0, 1], POULTRY_HEADS, SLAUGHTER_COLOR.poultry, SLAUGHTER_COLOR.livestock],
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 1.3],
            "circle-opacity": opacity,
            "circle-stroke-opacity": opacity,
          };
        },
      },
    ],
  },
  // 飼料廠：單色
  {
    id: "livestockFeed",
    sourceUrl: "./agriculture/feed_factories.geojson",
    sourceId: "livestock-feed",
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 6,
        paint: (isDark, p) => {
          const scale = p?.livestockFeedScale ?? 1;
          const opacity = p?.livestockFeedOpacity ?? 0.9;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3 * scale, 10, 5 * scale, 14, 8 * scale],
            "circle-color": FEED_COLOR,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 1.2],
            "circle-opacity": opacity,
            "circle-stroke-opacity": opacity,
          };
        },
      },
    ],
  },
  // 拍賣/批發市場：21 家全國拍賣樞紐，醒目大點
  {
    id: "livestockMarket",
    sourceUrl: "./agriculture/livestock_markets.geojson",
    sourceId: "livestock-market",
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 5,
        paint: (_isDark, p) => {
          const scale = p?.livestockMarketScale ?? 1;
          const opacity = p?.livestockMarketOpacity ?? 0.95;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5 * scale, 10, 9 * scale, 14, 14 * scale],
            "circle-color": MARKET_COLOR,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 14, 2],
            "circle-opacity": opacity,
            "circle-stroke-opacity": opacity,
          };
        },
      },
    ],
  },

  // ── 🐟 養殖漁業 Aquaculture（靜態 overlay；ponds=PMTiles，zone/cageNet=GeoJSON polygon）──
  {
    id: "aquaculturePonds",
    sourceUrl: "./fishery/aquaculture_ponds_osm.pmtiles",
    sourceId: "aquaculture-ponds",
    pmtiles: { sourceLayer: "aquaculture_ponds_osm", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["aquaculturePondsOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill", minzoom: 9,
        paint: (_isDark, p) => ({
          "fill-color": "#26c6da",
          "fill-opacity": p?.aquaculturePondsOpacity ?? 0.5,
        }),
      },
      {
        suffix: "line", type: "line", minzoom: 9,
        paint: () => ({ "line-color": "#26c6da", "line-width": 0.5, "line-opacity": 0.6 }),
      },
    ],
  },
  {
    id: "aquacultureZone",
    sourceUrl: "./fishery/aquaculture_production_zone.geojson",
    sourceId: "aquaculture-zone",
    rebuildOnParamChange: ["aquacultureZoneOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill", minzoom: 6,
        paint: (_isDark, p) => ({
          "fill-color": "#66bb6a",
          "fill-opacity": p?.aquacultureZoneOpacity ?? 0.35,
        }),
      },
      {
        suffix: "line", type: "line", minzoom: 6,
        paint: () => ({ "line-color": "#66bb6a", "line-width": 1, "line-opacity": 0.7 }),
      },
    ],
  },
  {
    id: "aquacultureCageNet",
    sourceUrl: "./fishery/aquaculture_cage_net.geojson",
    sourceId: "aquaculture-cage-net",
    rebuildOnParamChange: ["aquacultureCageNetOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill", minzoom: 6,
        paint: (_isDark, p) => ({
          "fill-color": "#5c6bc0",
          "fill-opacity": p?.aquacultureCageNetOpacity ?? 0.4,
        }),
      },
      {
        suffix: "line", type: "line", minzoom: 6,
        paint: () => ({ "line-color": "#5c6bc0", "line-width": 1, "line-opacity": 0.7 }),
      },
    ],
  },
  // 衛星偵測養殖水體（Sentinel-2 + RandomForest，5,095 面）。信心 3 級染色（藍→灰）：
  // 確定（in_osm / nlsc_code 0102 水產養殖 / solar_symbiotic 漁電共生）青 #26c6da、
  // 蓄水池/農業設施（nlsc_code 0402/0104）灰藍 #90a4ae、其他不確定 #cfd8dc。
  // 信心層級 select（ConfidenceIdx 0=全部 1=含蓄水池 2=只確定）走 opacity 篩選（filter 靜態，只 paint 隨 param 重算）。
  {
    id: "aquacultureWaterSatellite",
    sourceUrl: "./fishery/aquaculture_water_satellite.pmtiles",
    sourceId: "aquaculture-water-satellite",
    pmtiles: { sourceLayer: "aquaculture_water_satellite", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["aquacultureWaterSatelliteOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill",
        paint: (_isDark, p) => {
          const base = p?.aquacultureWaterSatelliteOpacity ?? 0.5;
          const level = p?.aquacultureWaterSatelliteConfidenceIdx ?? 0; // 0=全部 1=含蓄水池 2=只確定
          const isCertain: unknown[] = ["any", ["==", ["get", "in_osm"], true], ["==", ["get", "nlsc_code"], "0102"], ["==", ["get", "solar_symbiotic"], true]];
          const isReservoir: unknown[] = ["in", ["get", "nlsc_code"], ["literal", ["0402", "0104"]]]; // 蓄水池 0402 + 農業生產設施 0104
          return {
            "fill-color": ["case", isCertain, "#26c6da", isReservoir, "#90a4ae", "#cfd8dc"],
            // 確定恆顯示；蓄水池於「只確定」隱藏；不確定僅「全部」顯示
            "fill-opacity": ["case", isCertain, base, isReservoir, level === 2 ? 0 : base, level === 0 ? base : 0],
          };
        },
      },
      {
        suffix: "line", type: "line",
        paint: (_isDark, p) => {
          const base = p?.aquacultureWaterSatelliteOpacity ?? 0.5;
          const level = p?.aquacultureWaterSatelliteConfidenceIdx ?? 0;
          const isCertain: unknown[] = ["any", ["==", ["get", "in_osm"], true], ["==", ["get", "nlsc_code"], "0102"], ["==", ["get", "solar_symbiotic"], true]];
          const isReservoir: unknown[] = ["in", ["get", "nlsc_code"], ["literal", ["0402", "0104"]]];
          return {
            "line-color": ["case", isCertain, "#26c6da", isReservoir, "#90a4ae", "#cfd8dc"],
            "line-width": 0.5,
            "line-opacity": ["case", isCertain, base, isReservoir, level === 2 ? 0 : base, level === 0 ? base : 0],
          };
        },
      },
    ],
  },
  // 養殖漁業整合（PMTiles 20,212 面：逐口魚塭 OSM 15,241 + 衛星偵測補充 4,967 + 生產區 4）。
  // 依 source 三色染色：ponds 青 #26c6da / satellite 綠 #66bb6a / production 橙 #ffa726。
  {
    id: "aquacultureIntegrated",
    sourceUrl: "./fishery/aquaculture_integrated.pmtiles",
    sourceId: "aquaculture-integrated",
    pmtiles: { sourceLayer: "aquaculture_integrated", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["aquacultureIntegratedOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill",
        paint: (_isDark, p) => ({
          "fill-color": ["match", ["get", "source"], "ponds", "#26c6da", "satellite", "#66bb6a", "production", "#ffa726", "#9e9e9e"],
          "fill-opacity": p?.aquacultureIntegratedOpacity ?? 0.6,
        }),
      },
      {
        suffix: "line", type: "line",
        paint: () => ({
          "line-color": ["match", ["get", "source"], "ponds", "#26c6da", "satellite", "#66bb6a", "production", "#ffa726", "#9e9e9e"],
          "line-width": 0.5,
          "line-opacity": 0.6,
        }),
      },
    ],
  },
  // 官方標籤版魚塭辨識（27,205 面，2026-07，NLSC 標籤校正版）。與舊版 aquacultureWaterSatellite
  // 並排比較用，各自獨立 toggle。display_class 3 級分色（只凸顯確認/漁電共生，其餘壓灰底）：
  // confirmed 青 #26c6da（NLSC 確認，同舊版 certain 色）/ solar_symbiotic 藍 #1e88e5（漁電共生）/
  // unverified・ambiguous・mountain_suspect 一律灰 #9e9e9e（其他，未細分）。
  // 類別篩選走「確認／漁電共生／其他」三組 checkbox（0/1 param）→ filter 函式組 in-list；
  // filter 無 setFilter 式 diff，故 rebuildOnParamChange 收兩個 layer suffix 讓變更整層重建（同 buildingsGba）。
  {
    id: "aquacultureWaterSatelliteMoa",
    sourceUrl: "./fishery/aquaculture_water_satellite_moa.pmtiles",
    sourceId: "aquaculture-water-satellite-moa",
    pmtiles: { sourceLayer: "aquaculture_water_satellite_moa", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["fill", "line"],
    layers: [
      {
        suffix: "fill", type: "fill",
        filter: (p) => moaDisplayClassFilter(p),
        paint: (_isDark, p) => ({
          "fill-color": ["match", ["get", "display_class"],
            "confirmed", "#26c6da",
            "solar_symbiotic", "#1e88e5",
            "#9e9e9e",
          ],
          "fill-opacity": p?.aquacultureWaterSatelliteMoaOpacity ?? 0.55,
        }),
      },
      {
        suffix: "line", type: "line",
        filter: (p) => moaDisplayClassFilter(p),
        paint: (_isDark, p) => ({
          "line-color": ["match", ["get", "display_class"],
            "confirmed", "#26c6da",
            "solar_symbiotic", "#1e88e5",
            "#9e9e9e",
          ],
          "line-width": 0.5,
          "line-opacity": p?.aquacultureWaterSatelliteMoaOpacity ?? 0.55,
        }),
      },
    ],
  },
  // 魚塭偵測整合對照版（舊衛星 aquacultureWaterSatellite ∪ 新 aquacultureWaterSatelliteMoa，31,884 面，2026-07）。
  // union_class 3 級分色：both 青 #26c6da（兩版都命中，最高信心）/ moa_only 綠 #43a047（官方新找到）/
  // osm_only 橙 #fb8c00（舊版獨有，官方未涵蓋）。類別篩選同 moa 走三組 checkbox → filter in-list（同
  // buildingsGba pattern，filter 只能靠 rebuildOnParamChange 整層重建）。
  {
    id: "aquacultureWaterUnion",
    sourceUrl: "./fishery/aquaculture_water_satellite_union.pmtiles",
    sourceId: "aquaculture-water-satellite-union",
    pmtiles: { sourceLayer: "aquaculture_water_satellite_union", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["fill", "line"],
    layers: [
      {
        suffix: "fill", type: "fill",
        filter: (p) => unionClassFilter(p),
        paint: (_isDark, p) => ({
          "fill-color": ["match", ["get", "union_class"],
            "both", "#26c6da",
            "moa_only", "#43a047",
            "osm_only", "#fb8c00",
            "#9e9e9e",
          ],
          "fill-opacity": p?.aquacultureWaterUnionOpacity ?? 0.55,
        }),
      },
      {
        suffix: "line", type: "line",
        filter: (p) => unionClassFilter(p),
        paint: (_isDark, p) => ({
          "line-color": ["match", ["get", "union_class"],
            "both", "#26c6da",
            "moa_only", "#43a047",
            "osm_only", "#fb8c00",
            "#9e9e9e",
          ],
          "line-width": 0.5,
          "line-opacity": p?.aquacultureWaterUnionOpacity ?? 0.55,
        }),
      },
    ],
  },

  // ── 🌳 都市開放空間 Urban Open Space（靜態 overlay PMTiles 點，走 ./urban/）──
  // 台北行道樹 2024/11 vs 現在 三狀態點圖層（status 分色 + renumber 疑似重編號降透明 + status 篩選）
  {
    id: "streetTreesTaipeiDiff",
    sourceUrl: "./urban/street_trees_taipei_diff.pmtiles",
    sourceId: "street-trees-taipei-diff",
    pmtiles: { sourceLayer: "street_trees_taipei_diff", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["streetTreesTaipeiDiffOpacity", "streetTreesTaipeiDiffStatusIdx", "streetTreesTaipeiDiffRadius", "streetTreesTaipeiDiffColorModeIdx"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (_isDark, p) => {
          const base = p?.streetTreesTaipeiDiffOpacity ?? 0.7;
          const filt = p?.streetTreesTaipeiDiffStatusIdx ?? 0; // 0=全部 1=只看消失 2=只看變動
          const radiusMult = p?.streetTreesTaipeiDiffRadius ?? 1;
          const colorMode = p?.streetTreesTaipeiDiffColorModeIdx ?? 0; // 0=status 1=species 2=diameter 3=height
          const opFor = (st: string) => {
            if (filt === 1 && st !== "disappeared") return 0;      // 只看消失
            if (filt === 2 && st === "persisted") return 0;        // 只看變動（消失+新增）
            return base;
          };
          const opExpr = (mult: number): unknown[] => [
            "match", ["get", "status"],
            "disappeared", opFor("disappeared") * mult,
            "appeared", opFor("appeared") * mult,
            opFor("persisted") * mult, // persisted / default
          ];
          // 染色模式分支（JS 端 switch，重繪時 colorMode 是純數字，不引入 zoom）。
          // status 篩選（opacity）與 renumber 降透明在四種模式下都繼續有效（共用下方 opExpr）。
          const statusColor: unknown[] = ["match", ["get", "status"],
            "disappeared", "#e53935",
            "appeared", "#9ccc65",
            "#2e7d32"]; // persisted
          let circleColor: unknown[];
          switch (colorMode) {
            case 1: circleColor = streetTreeSpeciesColorExpr(); break;
            case 2: circleColor = streetTreeDiameterColorExpr(); break;
            case 3: circleColor = streetTreeHeightColorExpr(); break;
            default: circleColor = statusColor;
          }
          return {
            "circle-color": circleColor,
            // renumber_suspect 疑似重編號（真 boolean）→ 透明度降 0.35 倍
            "circle-opacity": ["case",
              ["==", ["get", "renumber_suspect"], true], opExpr(0.35),
              opExpr(1)],
            // 隨 zoom 漸變的基準值 × 點位大小倍率，並設 1.5px 下限，避免低 zoom（拉遠）
            // 配合縮小倍率時點位小到肉眼看不見（PMTiles 沒有 minzoom 限制，z5 起即可見）。
            // 注意：MapLibre 規定 zoom 表達式只能在最外層 interpolate/step，
            // 故倍率與下限在 JS 端算進各 stop（radiusMult 是重繪時的純數字）。
            "circle-radius": ["interpolate", ["linear"], ["zoom"],
              5, Math.max(1.5, 1 * radiusMult),
              9, Math.max(1.5, 1.8 * radiusMult),
              12, Math.max(1.5, 3 * radiusMult),
              14, Math.max(1.5, 4.5 * radiusMult),
            ],
            "circle-stroke-width": 0,
          };
        },
      },
    ],
  },

  // 受保護樹木全國（GeoJSON 6,544 點，8 城市）：預設依推估樹齡 5 級冷→暖染色（null 灰），
  // 可切換依城市 categorical；城市篩選走 opacity 歸零（同 streetTreesTaipeiDiff statusIdx 做法）。
  // 半徑 = zoom 基準（z6 4px → z12 8px）× dbh_m 胸徑因子 × 用戶倍率（composite：zoom 只在最外層）。
  {
    id: "protectedTreesNational",
    sourceUrl: "./urban/protected_trees_national.geojson",
    sourceId: "protected-trees-national",
    rebuildOnParamChange: ["protectedTreesNationalOpacity", "protectedTreesNationalRadius", "protectedTreesNationalColorModeIdx", "protectedTreesNationalCityIdx"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (isDark, p) => {
          const opacity = p?.protectedTreesNationalOpacity ?? 0.85;
          const radiusMult = p?.protectedTreesNationalRadius ?? 1;
          const colorMode = p?.protectedTreesNationalColorModeIdx ?? 0; // 0=樹齡 1=城市
          const cityIdx = p?.protectedTreesNationalCityIdx ?? 0;       // 0=全部 1..8=單一城市
          const city = cityIdx > 0 ? PROTECTED_TREE_CITIES[cityIdx - 1]?.name : undefined;
          const opExpr = (mult: number): unknown[] | number =>
            city ? ["case", ["==", ["get", "city"], city], opacity * mult, 0] : opacity * mult;
          // 胸徑因子：dbh_m 0.3→×0.7 / 1→×1 / 2→×1.6 / 4→×2.2（null coalesce 0.5 ≈ ×0.79）
          const dbhFactor: unknown[] = [
            "interpolate", ["linear"], ["coalesce", ["get", "dbh_m"], 0.5],
            0.3, 0.7, 1, 1, 2, 1.6, 4, 2.2,
          ];
          const r = (base: number): unknown[] => ["*", base * radiusMult, dbhFactor];
          return {
            "circle-color": colorMode === 1 ? protectedTreeCityColorExpr() : protectedTreeAgeColorExpr(),
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, r(4), 12, r(8)],
            "circle-opacity": opExpr(1),
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 14, 1],
            "circle-stroke-opacity": opExpr(0.7),
          };
        },
      },
    ],
  },
  // 台北河濱喬木（GeoJSON 10,917 點，30 座河濱公園）：樹種前 10 大 categorical 染色（其他灰），
  // 河濱公園篩選走 opacity 歸零。半徑 z6 3px → z12 6px × 用戶倍率（設 1px 下限防縮小到不可見）。
  {
    id: "riversideTreesTaipei",
    sourceUrl: "./urban/riverside_trees_taipei.geojson",
    sourceId: "riverside-trees-taipei",
    rebuildOnParamChange: ["riversideTreesTaipeiOpacity", "riversideTreesTaipeiRadius", "riversideTreesTaipeiParkIdx"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (isDark, p) => {
          const opacity = p?.riversideTreesTaipeiOpacity ?? 0.85;
          const radiusMult = p?.riversideTreesTaipeiRadius ?? 1;
          const parkIdx = p?.riversideTreesTaipeiParkIdx ?? 0; // 0=全部 1..30=單一河濱公園
          const park = parkIdx > 0 ? RIVERSIDE_PARKS[parkIdx - 1] : undefined;
          const opExpr = (mult: number): unknown[] | number =>
            park ? ["case", ["==", ["get", "park_name"], park], opacity * mult, 0] : opacity * mult;
          return {
            "circle-color": riversideTreeSpeciesColorExpr(),
            "circle-radius": ["interpolate", ["linear"], ["zoom"],
              6, Math.max(1, 3 * radiusMult),
              12, Math.max(1, 6 * radiusMult),
            ],
            "circle-opacity": opExpr(1),
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 14, 0.8],
            "circle-stroke-opacity": opExpr(0.6),
          };
        },
      },
    ],
  },
  // 台北公園（GeoJSON 2,917 點）：category 7 類 categorical 染色，分類篩選走 opacity 歸零。
  // 圓點大小依 area_sqm log 尺標（z12 時小公園 3px → 大公園 10px，兩端 clamp）；
  // area_sqm null/0 → fallback 固定最小半徑（同 sportsRadius 做法）。
  {
    id: "parksTaipei",
    sourceUrl: "./urban/parks_taipei.geojson",
    sourceId: "parks-taipei",
    rebuildOnParamChange: ["parksTaipeiOpacity", "parksTaipeiRadius", "parksTaipeiCategoryIdx"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (isDark, p) => {
          const opacity = p?.parksTaipeiOpacity ?? 0.85;
          const radiusMult = p?.parksTaipeiRadius ?? 1;
          const catIdx = p?.parksTaipeiCategoryIdx ?? 0; // 0=全部 1..7=單一分類
          const cat = catIdx > 0 ? TAIPEI_PARK_CATEGORIES[catIdx - 1]?.name : undefined;
          const opExpr = (mult: number): unknown[] | number =>
            cat ? ["case", ["==", ["get", "category"], cat], opacity * mult, 0] : opacity * mult;
          const [lo, hi] = PARK_AREA_DOMAIN;
          const area: unknown[] = ["to-number", ["get", "area_sqm"], 0]; // null → 0
          const areaRadius = (rMin: number, rMax: number): unknown[] => ["case",
            [">", area, 0],
            ["interpolate", ["linear"], ["ln", ["max", area, 1]],
              Math.log(lo), rMin * radiusMult,
              Math.log(hi), rMax * radiusMult],
            rMin * radiusMult,
          ];
          return {
            "circle-color": taipeiParkCategoryColorExpr(),
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, areaRadius(1.5, 5), 12, areaRadius(3, 10)],
            "circle-opacity": opExpr(1),
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 14, 1],
            "circle-stroke-opacity": opExpr(0.7),
          };
        },
      },
    ],
  },
  // 台北行道樹三時點 2022/2024/2026 軌跡（PMTiles，105,675 點）：traj 7 類 categorical 染色（預設），
  // 可切換樹種/胸徑/樹高（分級與顏色照抄 streetTreeColors，跨層視覺可比）；
  // 軌跡篩選走 opacity 歸零（同 streetTreesTaipeiDiff statusIdx 做法）。
  // 半徑基準 + 倍率照抄 streetTreesTaipeiDiff（同資料密度同城市）。
  {
    id: "streetTreesTaipei3epoch",
    sourceUrl: "./urban/street_trees_taipei_3epoch.pmtiles",
    sourceId: "street-trees-taipei-3epoch",
    pmtiles: { sourceLayer: "street_trees_taipei_3epoch", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["streetTreesTaipei3epochOpacity", "streetTreesTaipei3epochRadius", "streetTreesTaipei3epochColorModeIdx", "streetTreesTaipei3epochTrajFilterIdx"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (_isDark, p) => {
          const base = p?.streetTreesTaipei3epochOpacity ?? 0.7;
          const radiusMult = p?.streetTreesTaipei3epochRadius ?? 1;
          const colorMode = p?.streetTreesTaipei3epochColorModeIdx ?? 0; // 0=traj 1=species 2=diameter 3=height
          const filtIdx = p?.streetTreesTaipei3epochTrajFilterIdx ?? 0;  // 0=全部 1..4 見 STREET_TREE_3EPOCH_TRAJ_FILTERS
          const codes = STREET_TREE_3EPOCH_TRAJ_FILTERS[filtIdx]?.codes ?? null;
          // 軌跡篩選：非目標 traj → opacity 歸零（match 的 label 可用字串陣列一臂多值）
          const opExpr: unknown[] | number = codes
            ? ["match", ["get", "traj"], codes, base, 0]
            : base;
          let circleColor: unknown[];
          switch (colorMode) {
            case 1: circleColor = streetTree3epochSpeciesColorExpr(); break;
            case 2: circleColor = streetTree3epochDiameterColorExpr(); break;
            case 3: circleColor = streetTree3epochHeightColorExpr(); break;
            default: circleColor = streetTree3epochTrajColorExpr();
          }
          return {
            "circle-color": circleColor,
            "circle-opacity": opExpr,
            // 隨 zoom 漸變基準 × 倍率 + 1.5px 下限（同 streetTreesTaipeiDiff；
            // zoom 表達式只能在最外層，倍率在 JS 端算進各 stop）。
            "circle-radius": ["interpolate", ["linear"], ["zoom"],
              5, Math.max(1.5, 1 * radiusMult),
              9, Math.max(1.5, 1.8 * radiusMult),
              12, Math.max(1.5, 3 * radiusMult),
              14, Math.max(1.5, 4.5 * radiusMult),
            ],
            "circle-stroke-width": 0,
          };
        },
      },
    ],
  },
  // 行道樹全國分佈（PMTiles，210,436 點：台北 92,033 + 台中 118,403；z5-11 均勻抽稀、z13+ 全量）：
  // 樹種前 10 大 categorical 染色（預設），可切換胸徑/樹高（欄位 dbh_cm/height_m 與 3epoch 層同
  // → 直接沿用其 expr，分級與顏色照抄 streetTreeColors 跨層可比）與城市二色（台北藍/台中橙）。
  // 城市篩選走 opacity 歸零（同 protectedTreesNational cityIdx 做法）。
  // >100k 密集層 → 半徑基準 + 倍率 + 1.5px 下限照抄 streetTreesTaipeiDiff/3epoch 同款 paint。
  {
    id: "streetTreesNational",
    sourceUrl: "./urban/street_trees_national.pmtiles",
    sourceId: "street-trees-national",
    pmtiles: { sourceLayer: "street_trees_national", minzoom: 5, maxzoom: 14 },
    rebuildOnParamChange: ["streetTreesNationalOpacity", "streetTreesNationalRadius", "streetTreesNationalColorModeIdx", "streetTreesNationalCityIdx"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (_isDark, p) => {
          const base = p?.streetTreesNationalOpacity ?? 0.7;
          const radiusMult = p?.streetTreesNationalRadius ?? 1;
          const colorMode = p?.streetTreesNationalColorModeIdx ?? 0; // 0=species 1=diameter 2=height 3=city
          const cityIdx = p?.streetTreesNationalCityIdx ?? 0;        // 0=全部 1=台北 2=台中
          const city = cityIdx > 0 ? STREET_TREE_NATIONAL_CITIES[cityIdx - 1]?.value : undefined;
          const opExpr: unknown[] | number = city
            ? ["case", ["==", ["get", "city"], city], base, 0]
            : base;
          let circleColor: unknown[];
          switch (colorMode) {
            case 1: circleColor = streetTree3epochDiameterColorExpr(); break; // 欄位同 dbh_cm
            case 2: circleColor = streetTree3epochHeightColorExpr(); break;   // 欄位同 height_m
            case 3: circleColor = streetTreeNationalCityColorExpr(); break;
            default: circleColor = streetTreeNationalSpeciesColorExpr();
          }
          return {
            "circle-color": circleColor,
            "circle-opacity": opExpr,
            // 隨 zoom 漸變基準 × 倍率 + 1.5px 下限（同 streetTreesTaipeiDiff/3epoch；
            // zoom 表達式只能在最外層，倍率在 JS 端算進各 stop）。
            "circle-radius": ["interpolate", ["linear"], ["zoom"],
              5, Math.max(1.5, 1 * radiusMult),
              9, Math.max(1.5, 1.8 * radiusMult),
              12, Math.max(1.5, 3 * radiusMult),
              14, Math.max(1.5, 4.5 * radiusMult),
            ],
            "circle-stroke-width": 0,
          };
        },
      },
    ],
  },
  // 台北人行道樹穴（PMTiles，56,720 MultiPolygon，z11 起有 tile；個別樹穴僅數 m²，z15+ 才看得清）：
  // pit_type 二色 fill（樹穴綠 / 花圃黃）+ 同色細 outline（同 aquaculturePonds fill+line 面層慣例）；
  // 類型篩選走 opacity 歸零（fill 與 line 共用 opExpr，篩掉的類型輪廓一併隱藏）。
  {
    id: "treePitsTaipei",
    sourceUrl: "./urban/tree_pits_taipei.pmtiles",
    sourceId: "tree-pits-taipei",
    pmtiles: { sourceLayer: "tree_pits_taipei", minzoom: 11, maxzoom: 16 },
    rebuildOnParamChange: ["treePitsTaipeiOpacity", "treePitsTaipeiTypeIdx"],
    layers: [
      {
        suffix: "fill", type: "fill",
        paint: (_isDark, p) => {
          const base = p?.treePitsTaipeiOpacity ?? 0.55;
          const typeIdx = p?.treePitsTaipeiTypeIdx ?? 0; // 0=全部 1=樹穴 2=花圃
          const pitType = typeIdx > 0 ? TREE_PIT_TYPES[typeIdx - 1]?.name : undefined;
          return {
            "fill-color": treePitTypeColorExpr(),
            "fill-opacity": pitType ? ["case", ["==", ["get", "pit_type"], pitType], base, 0] : base,
          };
        },
      },
      {
        suffix: "line", type: "line",
        paint: (_isDark, p) => {
          const base = p?.treePitsTaipeiOpacity ?? 0.55;
          const typeIdx = p?.treePitsTaipeiTypeIdx ?? 0;
          const pitType = typeIdx > 0 ? TREE_PIT_TYPES[typeIdx - 1]?.name : undefined;
          // outline 比填色略實（min(1, base+0.2)），低填色透明度時仍可辨邊界
          const lineOp = Math.min(1, base + 0.2);
          return {
            "line-color": treePitTypeColorExpr(),
            "line-width": 0.5,
            "line-opacity": pitType ? ["case", ["==", ["get", "pit_type"], pitType], lineOp, 0] : lineOp,
          };
        },
      },
    ],
  },
  // GBA 全台 3D 建物輪廓（vector PMTiles，152 萬棟本島，z8-16；z13-16 逐棟原值、
  // z8-12 為 tippecanoe tiny-polygon 合併近似（只當建成區紋理，不可逐棟分析，extrusion
  // 因此 minzoom 鎖 13）；height 100% 有值 float，
  // src=osm 為 OSM 志願者繪製、其餘為 GBA AI 推估；CC BY-NC 4.0，署名見 LegendPanel）：
  // 四種顯示模式 modeIdx 0=高度 6 級分級（fill）1=資料來源二色（fill）2=3D 立體（fill-extrusion，
  // 沿用高度色階）3=夜景燈光（fill，深底暖橘/白發光，height 越高越亮，橘白交錯，建議搭深色底圖）。
  // suffix fill/extrusion 兩層永遠都在，靠 paint 把非當前模式那層的 opacity
  // 壓成 0（純 JS 常數，非 data-driven，fill-extrusion-opacity 合法）── 不用 layout.visibility
  // 切換，因為 rebuildOnParamChange 的 wasHidden 還原邏輯是整組 suffix 共用同一顆布林值，
  // 若靠 visibility 做「模式互斥顯示」會被誤判成使用者關閉整層而遭覆寫（見 overlayManager.ts）。
  // 高度門檻篩選：兩 suffix 共用 filter [">=",["get","height"],min]（函式形式，見
  // OverlayLayerSpec.filter），不能走 opacity 歸零法，因 fill-extrusion-opacity 不支援
  // data-driven 表達式；filter 靠 rebuildOnParamChange 整層重建才能把新門檻值烤進去。
  {
    id: "buildingsGba",
    sourceUrl: "./urban/buildings_3d_taiwan.pmtiles",
    sourceId: "buildings-gba",
    pmtiles: { sourceLayer: "buildings", minzoom: 8, maxzoom: 16 },
    rebuildOnParamChange: ["fill", "extrusion"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        filter: (p) => [">=", ["get", "height"], p?.buildingsGbaMinHeight ?? 0],
        paint: (_isDark, p) => {
          const modeIdx = p?.buildingsGbaModeIdx ?? 0; // 0=高度 1=來源 2=3D 3=夜景燈光
          const op = p?.buildingsGbaOpacity ?? 0.75;
          return {
            "fill-color":
              modeIdx === 3 ? buildingNightLightColorExpr()
              : modeIdx === 1 ? buildingSrcColorExpr()
              : buildingHeightColorExpr(),
            // 3D 模式：z<13 extrusion 不存在（minzoom 鎖 13），fill 用 zoom step 當平面後備；
            // z13+ 壓 0 交棒給 extrusion（zoom 表達式合法，非 data-driven）
            "fill-opacity": modeIdx === 2 ? ["step", ["zoom"], op, 13, 0] : op,
          };
        },
      },
      {
        suffix: "extrusion",
        type: "fill-extrusion",
        minzoom: 13,
        filter: (p) => [">=", ["get", "height"], p?.buildingsGbaMinHeight ?? 0],
        paint: (_isDark, p) => {
          const modeIdx = p?.buildingsGbaModeIdx ?? 0;
          const opacity = modeIdx === 2 ? (p?.buildingsGbaOpacity ?? 0.75) : 0; // 非 3D 模式壓 0 隱藏
          return {
            "fill-extrusion-color": buildingHeightColorExpr(),
            "fill-extrusion-height": ["coalesce", ["get", "height"], 3],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": opacity,
          };
        },
      },
    ],
  },
  // 都市紋理網格（vector PMTiles，全台 500m 格，145,119 格，z5-12；六欄 100% 有值：
  // bld_count 棟數/avg_height 平均高度 m/total_vol 總量體 萬m³/built_pct 建蔽率%/
  // canopy_pct 樹冠覆蓋%/gg_index 灰綠指數 −100~100；CC BY-NC 4.0 雙署名見 LegendPanel）：
  // 六種顯示模式 modeIdx 0-5（單一 fill sublayer，SSOT 見 urbanFormGridTypes.ts），
  // 純靠 paint 表達式隨 modeIdx 切換 fill-color/fill-opacity ── 同 streetTreesTaipei3epoch
  // 的 paint-function 機制，不需 rebuildOnParamChange（setPaintProperty 可直接 diff 套用
  // 新的 step expression，不像 buildingsGba 高度門檻篩選要動 filter）。
  // 0 值格淡出：bld_count/avg_height/total_vol/built_pct 四個「建物衍生」欄位 =0 代表
  // 格內無建物（多數 cell，median 皆 0），用 opacity 淡出避免蓋掉底圖；canopy_pct/gg_index
  // 分佈廣泛非零，不淡出（見 urbanFormGridTypes.ts zeroFade 註解）。
  {
    id: "urbanFormGrid",
    sourceUrl: "./urban/urban_form_grid_500m.pmtiles",
    sourceId: "urban-form-grid",
    pmtiles: { sourceLayer: "urban_form", minzoom: 5, maxzoom: 12 },
    layers: [
      {
        suffix: "fill",
        type: "fill",
        paint: (_isDark, p) => {
          const modeIdx = p?.urbanFormGridModeIdx ?? 5; // 預設 5=灰綠指數
          const base = p?.urbanFormGridOpacity ?? 0.55;
          return {
            "fill-color": urbanFormGridColorExpr(modeIdx),
            "fill-opacity": urbanFormGridOpacityExpr(modeIdx, base),
          };
        },
      },
    ],
  },
  // 都市計畫土地使用分區（vector PMTiles，北市 15,518 + 新北 34,190，z6-15；WGS84 MultiPolygon，
  // tippecanoe -y 10 欄全保留，上游 handoff urban-zoning.md）：zone_category 9 類跨市統一分色
  // （SSOT 見 urbanZoningTypes.ts），fill + 細邊界 line 兩 sublayer。分類篩選走 per-layer filter
  // 函式（同 buildingsGba；idx 0=全部 1..9 單類 → 未選中的分區被濾除而非淡化），故
  // rebuildOnParamChange 收 ["fill","line"] 兩 suffix（收參數名會靜默失效，見
  // .claude/pitfalls/2026-07-16-rebuildonparamchange-suffix-not-param.md）。line-opacity 跟主 opacity
  // 連動 ×0.6；line-width z10 0.3px → z15 1px 內插（zoom 只在最外層 interpolate）。
  {
    id: "urbanZoningTaipei",
    sourceUrl: "./urban/urban_zoning_taipei.pmtiles",
    sourceId: "urban-zoning-taipei",
    pmtiles: { sourceLayer: "urban_zoning_taipei", minzoom: 6, maxzoom: 15 },
    rebuildOnParamChange: ["fill", "line"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        filter: (p) => {
          const idx = p?.urbanZoningTaipeiCategoryIdx ?? 0; // 0=全部 1..9=單一分類
          const cat = idx > 0 ? URBAN_ZONING_CATEGORIES[idx - 1]?.value : undefined;
          // zone_raw="nan" 的 4 筆是規劃範圍框（meta-polygon 非分區面），不渲染不點擊；上游 drop 前的防禦（UZ-5）
          const notMeta = ["!=", ["get", "zone_raw"], "nan"];
          return ["all", notMeta, cat ? ["==", ["get", "zone_category"], cat] : ["has", "zone_category"]];
        },
        paint: (_isDark, p) => ({
          "fill-color": urbanZoningColorExpr(),
          "fill-opacity": p?.urbanZoningTaipeiOpacity ?? 0.5,
        }),
      },
      {
        suffix: "line",
        type: "line",
        filter: (p) => {
          const idx = p?.urbanZoningTaipeiCategoryIdx ?? 0;
          const cat = idx > 0 ? URBAN_ZONING_CATEGORIES[idx - 1]?.value : undefined;
          const notMeta = ["!=", ["get", "zone_raw"], "nan"];
          return ["all", notMeta, cat ? ["==", ["get", "zone_category"], cat] : ["has", "zone_category"]];
        },
        paint: (_isDark, p) => ({
          "line-color": urbanZoningColorExpr(),
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 15, 1],
          "line-opacity": (p?.urbanZoningTaipeiOpacity ?? 0.5) * 0.6,
        }),
      },
    ],
  },
  {
    id: "urbanZoningNewTaipei",
    sourceUrl: "./urban/urban_zoning_newtaipei.pmtiles",
    sourceId: "urban-zoning-newtaipei",
    pmtiles: { sourceLayer: "urban_zoning_newtaipei", minzoom: 6, maxzoom: 15 },
    rebuildOnParamChange: ["fill", "line"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        filter: (p) => {
          const idx = p?.urbanZoningNewTaipeiCategoryIdx ?? 0; // 0=全部 1..9=單一分類
          const cat = idx > 0 ? URBAN_ZONING_CATEGORIES[idx - 1]?.value : undefined;
          return cat ? ["==", ["get", "zone_category"], cat] : ["has", "zone_category"];
        },
        paint: (_isDark, p) => ({
          "fill-color": urbanZoningColorExpr(),
          "fill-opacity": p?.urbanZoningNewTaipeiOpacity ?? 0.5,
        }),
      },
      {
        suffix: "line",
        type: "line",
        filter: (p) => {
          const idx = p?.urbanZoningNewTaipeiCategoryIdx ?? 0;
          const cat = idx > 0 ? URBAN_ZONING_CATEGORIES[idx - 1]?.value : undefined;
          return cat ? ["==", ["get", "zone_category"], cat] : ["has", "zone_category"];
        },
        paint: (_isDark, p) => ({
          "line-color": urbanZoningColorExpr(),
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 15, 1],
          "line-opacity": (p?.urbanZoningNewTaipeiOpacity ?? 0.5) * 0.6,
        }),
      },
    ],
  },

  // ── 🏟️ 運動場館 Sports（靜態 CDN geojson，走 ./sports/）──
  // 5 sublayer 共用 sports-venues source（sourceId 相同 → 只 fetch 一次），靠 config.filter 分 layer 隸屬類。
  // circle：category 27 類 match 分色 + area_sqm log 點大小（NULL fallback 固定半徑）+ open_status="不對外" 淡化。
  ...SPORTS_LAYERS.map((meta) => sportsVenueOverlay(meta)),

  // ── 🎭 文化 Culture（靜態 GeoJSON 點，走 ./culture/）──
  // 文化設施（787 點）：facility_type 6 類 match 分色；分類篩選走 per-layer filter 函式
  // （同 buildingsGba；idx 0=全部 1..6 單類 → 未選中的點被濾除而非淡化）。半徑 z6 4px → z12 8px × 倍率。
  // ⚠️ 金門點（lon 118.25 起）不得被任何 lon 假設濾掉——本層 filter/paint 皆不涉經度。
  {
    id: "culturalFacilities",
    sourceUrl: "./culture/cultural_facilities_national.geojson",
    sourceId: "culture-facilities",
    // rebuildOnParamChange 收 layer suffix（同 buildingsGba），filter 變更才會整層重建
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle", type: "circle",
        filter: (p) => {
          const idx = p?.culturalFacilitiesTypeIdx ?? 0; // 0=全部 1..6=單一類型
          const type = idx > 0 ? CULTURAL_FACILITY_TYPES[idx - 1]?.name : undefined;
          return type ? ["==", ["get", "facility_type"], type] : ["has", "facility_type"];
        },
        paint: (isDark, p) => {
          const opacity = p?.culturalFacilitiesOpacity ?? 0.9;
          const radiusMult = p?.culturalFacilitiesRadius ?? 1;
          return {
            "circle-color": culturalFacilityColorExpr(),
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, Math.max(1, 4 * radiusMult), 12, Math.max(1, 8 * radiusMult)],
            "circle-opacity": opacity,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 14, 1],
            "circle-stroke-opacity": opacity * 0.7,
          };
        },
      },
    ],
  },
  // 地方文化館（252 點）：type 5 類 match 分色；分類篩選走 per-layer filter 函式（idx 0=全部 1..5）。
  {
    id: "culturalMuseums",
    sourceUrl: "./culture/local_cultural_museums_national.geojson",
    sourceId: "culture-museums",
    // rebuildOnParamChange 收 layer suffix（同 buildingsGba），filter 變更才會整層重建
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle", type: "circle",
        filter: (p) => {
          const idx = p?.culturalMuseumsTypeIdx ?? 0; // 0=全部 1..5=單一類型
          const type = idx > 0 ? CULTURAL_MUSEUM_TYPES[idx - 1]?.name : undefined;
          return type ? ["==", ["get", "type"], type] : ["has", "type"];
        },
        paint: (isDark, p) => {
          const opacity = p?.culturalMuseumsOpacity ?? 0.9;
          const radiusMult = p?.culturalMuseumsRadius ?? 1;
          return {
            "circle-color": culturalMuseumColorExpr(),
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, Math.max(1, 4 * radiusMult), 12, Math.max(1, 8 * radiusMult)],
            "circle-opacity": opacity,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 14, 1],
            "circle-stroke-opacity": opacity * 0.7,
          };
        },
      },
    ],
  },
  // 藝文活動（6,121 點）：進行中（start_date ≤ 今日）暖橙 / 未開始（> 今日）冷藍二色 case；
  // 狀態篩選走 per-layer filter 函式（idx 0=全部 1=進行中 2=未開始，同用 cultureTodayStr 比較）。
  {
    id: "artsEvents",
    sourceUrl: "./culture/arts_events_national.geojson",
    sourceId: "culture-events",
    // rebuildOnParamChange 收 layer suffix（同 buildingsGba），filter 變更才會整層重建
    rebuildOnParamChange: ["circle"],
    layers: [
      {
        suffix: "circle", type: "circle",
        filter: (p) => {
          const idx = p?.artsEventsStatusIdx ?? 0; // 0=全部 1=進行中 2=未開始
          const today = cultureTodayStr();
          if (idx === 1) return ["<=", ["get", "start_date"], today];
          if (idx === 2) return [">", ["get", "start_date"], today];
          return ["has", "start_date"];
        },
        paint: (isDark, p) => {
          const opacity = p?.artsEventsOpacity ?? 0.85;
          const radiusMult = p?.artsEventsRadius ?? 1;
          const today = cultureTodayStr();
          return {
            "circle-color": ["case", ["<=", ["get", "start_date"], today], ARTS_EVENT_ONGOING_COLOR, ARTS_EVENT_UPCOMING_COLOR],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, Math.max(1, 3 * radiusMult), 12, Math.max(1, 6 * radiusMult)],
            "circle-opacity": opacity,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 14, 0.8],
            "circle-stroke-opacity": opacity * 0.6,
          };
        },
      },
    ],
  },
  // 表演場館（857 點）：單色紫；半徑 ∝ √event_count（sqrt(1)=1→rMin，sqrt(101)≈10.05→rMax；
  // 純綁場次量不隨 zoom 變，同 farmRadius 慣例）。金門點同不涉經度假設。
  {
    id: "performingVenues",
    sourceUrl: "./culture/performing_venues_national.geojson",
    sourceId: "culture-venues",
    rebuildOnParamChange: ["performingVenuesOpacity", "performingVenuesRadius"],
    layers: [
      {
        suffix: "circle", type: "circle",
        paint: (isDark, p) => {
          const opacity = p?.performingVenuesOpacity ?? 0.85;
          const radiusMult = p?.performingVenuesRadius ?? 1;
          return {
            "circle-color": PERFORMING_VENUE_COLOR,
            "circle-radius": [
              "interpolate", ["linear"],
              ["sqrt", ["max", ["to-number", ["get", "event_count"], 1], 1]],
              1, 3 * radiusMult,
              10.05, 14 * radiusMult,
            ],
            "circle-opacity": opacity,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 14, 1],
            "circle-stroke-opacity": opacity * 0.7,
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

  // ── 全台樹冠高度（raster PNG PMTiles，Meta/WRI 2020 10m，z7-12）──
  // 顏色已預烤進 PNG（Greens 色帶，低植被端半透明）；mapbox-pmtiles 依 header
  // tile type 自動切 raster 模式，z13+ 靠 Mapbox raster overzoom 拉伸。
  // raster layer 不允許 source-layer → pmtiles 不填 sourceLayer。
  {
    id: "canopyHeight",
    sourceUrl: "./forestry/canopy_height_taiwan.pmtiles",
    sourceId: "canopy-height",
    pmtiles: { minzoom: 7, maxzoom: 12 },
    layers: [
      {
        suffix: "raster", type: "raster",
        paint: (_isDark, p) => ({
          "raster-opacity": p?.canopyHeightOpacity ?? 0.7,
        }),
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
              "oil_refinery", "#F97316",
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

  // ── 急診壅塞 er_hospital（59 家）──
  // 顏色由 properties.level（loader 依 wait_general_cnt 預算 smooth/light/congested/severe/nodata）決定。
  // 色值 = erCongestionTypes.ts 的 ER_LEVEL_COLORS（inline 對齊 nuclear 風格）。
  // wait_icu_cnt>0（has_icu=1）→ 白色 circle-stroke ring（不改 fill 主色）。
  {
    id: "erHospital",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "er-hospital",
    dynamicData: true,
    rebuildOnParamChange: ["erHospitalOpacity"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (isDark, params) => {
          const o = params?.erHospitalOpacity ?? 0.85;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 6, 12, 11,
            ],
            "circle-color": [
              "match", ["get", "level"],
              "smooth", "#22c55e",
              "light", "#facc15",
              "congested", "#f97316",
              "severe", "#ef4444",
              "nodata", "#6b7280",
              "#6b7280",
            ],
            "circle-opacity": o,
            "circle-stroke-width": [
              "match", ["get", "has_icu"], 1, 2.2, 0.8,
            ],
            "circle-stroke-color": [
              "match", ["get", "has_icu"],
              1, "#ffffff",
              isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
            ],
          };
        },
      },
    ],
  },

  // ── 📚 北市圖即時座位 librarySeats（6 分館聚合，當下快照）──
  // 顏色由 properties.free_ratio（空位率 0=滿→1=全空）interpolate；
  // all_closed=1（全區休館）→ 灰。資料由 useLibrarySeatsLayer 從
  // get_tpml_seat_current() branch 聚合後 setData（6 點 → 半徑固定偏大 + 白描邊）。
  {
    id: "librarySeats",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "library-seats",
    dynamicData: true,
    rebuildOnParamChange: ["librarySeatsOpacity"],
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.librarySeatsOpacity ?? 0.9;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, 8, 12, 14,
            ],
            "circle-color": [
              "case",
              ["==", ["get", "all_closed"], 1], "#6b7280",
              [
                "interpolate", ["linear"], ["get", "free_ratio"],
                0, "#ef4444",
                0.5, "#f59e0b",
                1, "#22c55e",
              ],
            ],
            "circle-opacity": o,
            "circle-stroke-width": 1.6,
            "circle-stroke-color": "#ffffff",
          };
        },
      },
    ],
  },

  // ── 🅿️ 停車 路邊 parkingOnstreet（hybrid v1 當下快照）──
  // 一個 source 依 geometry-type 拆兩 render 層：
  //   fill（台北 Polygon）→ availability_rate=null → 中性藍灰依 total_spaces 表容量
  //   circle（新北/台中 Point）→ availability_rate 空位率染色（綠=空位多 / 紅=滿）
  // 資料由 useParkingLayer 從 get_parking_segments_current() setData。
  {
    id: "parkingOnstreet",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "parking-onstreet",
    dynamicData: true,
    layers: [
      {
        suffix: "fill",
        type: "fill",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: (isDark, params) => {
          const o = params?.parkingOnstreetOpacity ?? 0.6;
          return {
            "fill-color": neutralCapacityColorExpr() as unknown as string,
            "fill-opacity": o,
            "fill-outline-color": isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)",
          };
        },
      },
      {
        suffix: "circle",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: (isDark, params) => {
          const o = params?.parkingOnstreetOpacity ?? 0.6;
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 7],
            "circle-color": availabilityColorExpr() as unknown as string,
            "circle-opacity": o,
            "circle-stroke-width": 0.8,
            "circle-stroke-color": isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)",
          };
        },
      },
    ],
  },

  // ── 🅿️ 停車 場外 parkingOffstreet（hybrid v1 當下快照）──
  // circle 空位率染色（綠→紅）+ circle-radius 隨 total_spaces（大場大圓）
  // + circle-stroke-color 依 source_category（city / tourism / freeway_service_area）分類。
  // 資料由 useParkingLayer 從 get_parking_lots_current() setData。
  {
    id: "parkingOffstreet",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "parking-offstreet",
    dynamicData: true,
    layers: [
      {
        suffix: "circle",
        type: "circle",
        paint: (_isDark, params) => {
          const o = params?.parkingOffstreetOpacity ?? 0.9;
          // 半徑隨 total_spaces（log 尺標，兩端 clamp）：小場小圓、大場大圓
          const radius = (zoom6: number, zoom13: number) => [
            "interpolate", ["linear"],
            ["log10", ["max", ["to-number", ["get", "total_spaces"], 1], 1]],
            Math.log10(5), zoom6,
            Math.log10(1000), zoom13,
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, radius(3, 8),
              13, radius(6, 18),
            ],
            "circle-color": availabilityColorExpr() as unknown as string,
            "circle-opacity": o,
            "circle-stroke-width": 1.4,
            "circle-stroke-color": sourceCategoryRingExpr() as unknown as string,
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
            "circle-color": "#F97316",
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
            "circle-color": "#F97316",
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
            "fill-color": "#F97316",
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
            "line-color": "#F97316",
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

  // ── BASE MAP（PMTiles 來自 taipei-gis-analytics SSOT，~406MB 走 S3/base_map → Volume）──
  //   行政邊界 3 層、等高線 2 層（25k 精度 10m / dtm20 全臺）、OSM 可駕駛道路 1 層
  //   全部預設 OFF；attr 全保留供 popup（見 featureInfo/baseMapPanels.tsx）
  {
    id: "countyBoundary",
    sourceUrl: "./base_map/county_boundary.pmtiles",
    sourceId: "base-county-boundary",
    pmtiles: { sourceLayer: "county_boundary", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line", "fill"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        minzoom: 4,
        paint: () => ({
          "fill-color": "#4b5563",
          "fill-opacity": 0,
          "fill-outline-color": "rgba(0,0,0,0)",
        }),
      },
      {
        suffix: "line",
        type: "line",
        minzoom: 4,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.countyBoundaryWidth ?? 1;
          return {
            "line-color": isDark ? "#9ca3af" : "#374151",
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8 * w, 8, 1.4 * w, 12, 2.4 * w],
            "line-opacity": params?.countyBoundaryOpacity ?? 0.85,
          };
        },
      },
    ],
  },
  {
    id: "townshipBoundary",
    sourceUrl: "./base_map/township_boundary.pmtiles",
    sourceId: "base-township-boundary",
    pmtiles: { sourceLayer: "township_boundary", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line", "fill"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        minzoom: 8,
        paint: () => ({
          "fill-color": "#6b7280",
          "fill-opacity": 0,
          "fill-outline-color": "rgba(0,0,0,0)",
        }),
      },
      {
        suffix: "line",
        type: "line",
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.townshipBoundaryWidth ?? 1;
          return {
            "line-color": isDark ? "#94a3b8" : "#4b5563",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5 * w, 11, 1.0 * w, 14, 1.8 * w],
            "line-opacity": params?.townshipBoundaryOpacity ?? 0.75,
          };
        },
      },
    ],
  },
  {
    id: "villageBoundary",
    sourceUrl: "./base_map/village_boundary.pmtiles",
    sourceId: "base-village-boundary",
    pmtiles: { sourceLayer: "village_boundary", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line", "fill"],
    layers: [
      {
        suffix: "fill",
        type: "fill",
        minzoom: 11,
        paint: () => ({
          "fill-color": "#9ca3af",
          "fill-opacity": 0,
          "fill-outline-color": "rgba(0,0,0,0)",
        }),
      },
      {
        suffix: "line",
        type: "line",
        minzoom: 11,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (isDark, params) => {
          const w = params?.villageBoundaryWidth ?? 1;
          return {
            "line-color": isDark ? "#cbd5e1" : "#6b7280",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4 * w, 14, 0.9 * w, 17, 1.6 * w],
            "line-opacity": params?.villageBoundaryOpacity ?? 0.65,
          };
        },
      },
    ],
  },
  // ── 等高線 25k（elevation_m；精度 10m，~21% 全臺覆蓋）──
  //   主等高線 100m 倍數加粗、500m 倍數更粗。欄名 elevation_m 與 dtm20 的 elev_m 不同。
  {
    id: "contour25k",
    sourceUrl: "./base_map/contour_25k.pmtiles",
    sourceId: "base-contour-25k",
    pmtiles: { sourceLayer: "contour_25k", minzoom: 8, maxzoom: 14 },
    rebuildOnParamChange: ["line"],
    layers: [
      {
        suffix: "line",
        type: "line",
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.contour25kWidth ?? 1;
          return {
            "line-color": "#8B4513",
            "line-width": [
              "*",
              w,
              ["case",
                ["==", ["%", ["coalesce", ["get", "elevation_m"], 0], 500], 0], 1.4,
                ["==", ["%", ["coalesce", ["get", "elevation_m"], 0], 100], 0], 0.9,
                0.4,
              ],
            ],
            "line-opacity": params?.contour25kOpacity ?? 0.7,
          };
        },
      },
    ],
  },
  // ── 等高線 DTM20（elev_m；精度 20m，全臺完整。欄名 elev_m 是 Shapefile 10 字限制縮寫）──
  {
    id: "contourDtm20",
    sourceUrl: "./base_map/contour_dtm20.pmtiles",
    sourceId: "base-contour-dtm20",
    pmtiles: { sourceLayer: "contour_dtm20", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line"],
    layers: [
      {
        suffix: "line",
        type: "line",
        minzoom: 9,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.contourDtm20Width ?? 1;
          return {
            "line-color": "#a16207",
            "line-width": [
              "*",
              w,
              ["case",
                ["==", ["%", ["coalesce", ["get", "elev_m"], 0], 500], 0], 1.2,
                ["==", ["%", ["coalesce", ["get", "elev_m"], 0], 100], 0], 0.7,
                0.3,
              ],
            ],
            "line-opacity": params?.contourDtm20Opacity ?? 0.55,
          };
        },
      },
    ],
  },
  // ── OSM 快速道路（PMTiles 含 motorway+trunk，但前端只渲染 trunk＝真．快速道路）──
  //   國道（motorway）已由 highways layer 從 national_highway.pmtiles 渲染，
  //   兩者來源不同會視覺重疊 → 這裡 filter 掉 motorway，只留 trunk / trunk_link。
  {
    id: "osmExpressway",
    sourceUrl: "./base_map/osm_expressway.pmtiles",
    sourceId: "base-osm-expressway",
    pmtiles: { sourceLayer: "osm_expressway", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line"],
    layers: [
      {
        suffix: "line",
        type: "line",
        minzoom: 6,
        filter: ["in", ["get", "highway"], ["literal", ["trunk", "trunk_link"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.osmExpresswayWidth ?? 1;
          return {
            "line-color": "#FF8C00",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", w, 0.8],
              10, ["*", w, 2.2],
              14, ["*", w, 4.5],
            ],
            "line-opacity": params?.osmExpresswayOpacity ?? 0.9,
          };
        },
      },
    ],
  },
  // ── OSM 可駕駛道路（55 萬 edges，highway 分級分色）──
  //   motorway 橘 / trunk 紅橙 / primary 黃 / secondary 灰 / tertiary 淺灰 / 其餘細淺灰
  {
    id: "osmRoadDrive",
    sourceUrl: "./base_map/osm_road_drive.pmtiles",
    sourceId: "base-osm-road",
    pmtiles: { sourceLayer: "osm_road_drive", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["line"],
    layers: [
      {
        suffix: "line",
        type: "line",
        minzoom: 5,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: (_isDark, params) => {
          const w = params?.osmRoadDriveWidth ?? 1;
          // z5 顯示開關（預設 0 = z<8 不顯示）— 給用戶看全台路網密度時主動開
          const z5Reveal = params?.osmRoadDriveZ5Reveal ?? 0;
          const baseOp = params?.osmRoadDriveOpacity ?? 0.85;
          // 依 highway 分色（catalog: motorway+link 6.9k / trunk 4.2k / primary 16k / secondary 13k / tertiary 37k / others）
          const colorExpr: unknown[] = [
            "match", ["get", "highway"],
            ["motorway", "motorway_link"], "#fb923c",
            ["trunk", "trunk_link"], "#f87171",
            ["primary", "primary_link"], "#fcd34d",
            ["secondary", "secondary_link"], "#9ca3af",
            ["tertiary", "tertiary_link"], "#d4d4d4",
            "#e5e7eb",
          ];
          const widthExpr: unknown[] = [
            "interpolate", ["linear"], ["zoom"],
            10, ["*", w, ["match", ["get", "highway"],
              ["motorway", "motorway_link"], 1.4,
              ["trunk", "trunk_link"], 1.2,
              ["primary", "primary_link"], 1.0,
              ["secondary", "secondary_link"], 0.7,
              ["tertiary", "tertiary_link"], 0.5,
              0.25,
            ]],
            14, ["*", w, ["match", ["get", "highway"],
              ["motorway", "motorway_link"], 4.0,
              ["trunk", "trunk_link"], 3.2,
              ["primary", "primary_link"], 2.6,
              ["secondary", "secondary_link"], 1.8,
              ["tertiary", "tertiary_link"], 1.2,
              0.6,
            ]],
            17, ["*", w, ["match", ["get", "highway"],
              ["motorway", "motorway_link"], 8.0,
              ["trunk", "trunk_link"], 6.5,
              ["primary", "primary_link"], 5.2,
              ["secondary", "secondary_link"], 3.6,
              ["tertiary", "tertiary_link"], 2.4,
              1.2,
            ]],
          ];
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "line-color": colorExpr as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "line-width": widthExpr as any,
            // z<8 用 z5Reveal 控制（0=隱形，1=baseOp）；z≥8 永遠用 baseOp
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "line-opacity": [
              "interpolate", ["linear"], ["zoom"],
              5, baseOp * z5Reveal,
              7.9, baseOp * z5Reveal,
              8, baseOp,
            ] as any,
          };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 警政司法民防 17 layer（資料來自 /police_justice/，扁平 dataset/ 子目錄）
  // 13 靜態 GeoJSON + 3 PMTiles + 1 動態 RPC
  // ═══════════════════════════════════════════════════════════════

  // ── 警政 4 layer ──
  {
    id: "policeStation",
    sourceUrl: "./police_justice/police_stations/police_stations_20260626.geojson",
    sourceId: "police-station",
    rebuildOnParamChange: ["policeStationOpacity", "policeStationScale"],
    // 按 facility_subtype 階層分大小 + 深淺：
    //   headquarters (5)        → 最大、最深藍（警政署）
    //   police_dept (27)        → 大、深藍（縣市警察局）
    //   precinct (163)          → 中、中藍（分局）
    //   substation (1,541)      → 小、淺藍（派出所，量最多）
    //   specialized (298)       → 中、紅色（專業警隊：交通/刑事/保警，視覺突出）
    //   security / other (62)   → 最小、灰
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.policeStationScale ?? 1;
        const op = p?.policeStationOpacity ?? 0.85;
        // 半徑用 (zoom × subtype tier) 二維插值：subtype 帶 baseRadius factor
        const radiusFactor: unknown[] = [
          "match", ["get", "facility_subtype"],
          "headquarters", 1.7,
          "police_dept", 1.4,
          "precinct", 1.15,
          "specialized", 1.0,
          "security", 0.75,
          "substation", 0.7,
          "other", 0.6,
          0.7,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 2, radiusFactor]],
            10, ["*", s, ["*", 4, radiusFactor]],
            14, ["*", s, ["*", 7, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "facility_subtype"],
            "headquarters", "#0a1e6b",   // 最深藍
            "police_dept", "#1e3a8a",
            "precinct", "#1e40af",
            "substation", "#3b82f6",     // 淺藍
            "specialized", "#dc2626",     // 紅色突顯（專業警隊）
            "security", "#475569",        // 灰藍
            "other", "#64748b",
            "#1e40af",
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": [
            "match", ["get", "facility_subtype"],
            "headquarters", 1.2,
            "police_dept", 1,
            "precinct", 0.8,
            0.5,
          ] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "womenChildWarning",
    sourceUrl: "./police_justice/women_child_warning/women_child_warning_20260626.geojson",
    sourceId: "women-child-warning",
    rebuildOnParamChange: ["womenChildWarningOpacity", "womenChildWarningScale"],
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.womenChildWarningScale ?? 1;
        const op = p?.womenChildWarningOpacity ?? 0.9;
        return {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3 * s, 14, 7 * s] as unknown as number,
          "circle-color": "#ec4899",
          "circle-stroke-color": "#fff", "circle-stroke-width": 0.8,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "speedCamera",
    sourceUrl: "./police_justice/speed_cameras/speed_cameras_20260626.geojson",
    sourceId: "speed-camera",
    rebuildOnParamChange: ["speedCameraOpacity", "speedCameraScale"],
    // 顏色按 subtype（4 類）：general 紅 / freeway 暗紅 / red_light 玫紅 / railway 黃
    // 大小按 limit_kph：限速越低=越嚴=圈越大（30km/h 學校區最醒目，110 國道最小）
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.speedCameraScale ?? 1;
        const op = p?.speedCameraOpacity ?? 0.85;
        // limit_kph 字串轉數字後分級 factor
        const limitFactor: unknown[] = [
          "step", ["coalesce", ["to-number", ["get", "limit_kph"]], 60],
          1.5,   // < 30：學校區/巷弄
          30, 1.4,
          40, 1.2,
          50, 1.0,
          60, 0.9,
          70, 0.85,
          90, 0.75,
          100, 0.7,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            8, ["*", s, ["*", 2, limitFactor]],
            12, ["*", s, ["*", 4, limitFactor]],
            16, ["*", s, ["*", 6, limitFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "facility_subtype"],
            "speed_camera_freeway", "#7f1d1d",
            "red_light_camera", "#fb7185",
            "railway_crossing_camera", "#facc15",
            "#dc2626",  // speed_camera_general
          ] as unknown as string,
          "circle-stroke-color": "#fff", "circle-stroke-width": 0.4,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "speedZoneSegment",
    sourceUrl: "./police_justice/speed_zone_segments/speed_zone_segments_20260626.geojson",
    sourceId: "speed-zone-segment",
    rebuildOnParamChange: ["speedZoneSegmentOpacity", "speedZoneSegmentWidth"],
    layers: [{
      suffix: "line", type: "line",
      paint: (_isDark, p) => {
        const w = p?.speedZoneSegmentWidth ?? 1;
        const op = p?.speedZoneSegmentOpacity ?? 0.85;
        return {
          "line-color": "#b91c1c",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5 * w, 14, 4 * w] as unknown as number,
          "line-opacity": op,
        };
      },
    }],
  },

  // ── 司法矯正 4 layer ──
  {
    id: "court",
    sourceUrl: "./police_justice/courts/courts_20260626.geojson",
    sourceId: "court",
    rebuildOnParamChange: ["courtOpacity", "courtScale"],
    // 按 court_type 6 階層：supreme 最大深紫 → district 小淺紫
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.courtScale ?? 1;
        const op = p?.courtOpacity ?? 0.9;
        const radiusFactor: unknown[] = [
          "match", ["get", "court_type"],
          "supreme", 1.7,
          "high", 1.35,
          "admin", 1.2,
          "ipc", 1.15,
          "juvenile_family", 1.15,
          "district", 0.85,
          0.85,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 3, radiusFactor]],
            10, ["*", s, ["*", 6, radiusFactor]],
            14, ["*", s, ["*", 9, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "court_type"],
            "supreme", "#4c1d95",       // 最深紫（最高法院）
            "high", "#6d28d9",
            "admin", "#7c3aed",          // 高等行政
            "ipc", "#a855f7",            // 智財商業
            "juvenile_family", "#c084fc",
            "district", "#c4b5fd",       // 淺紫（地方法院）
            "#7c3aed",
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["match", ["get", "court_type"], "supreme", 1.4, "high", 1.1, 0.8] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "prosecutorsOffice",
    sourceUrl: "./police_justice/prosecutors_offices/prosecutors_offices_20260626.geojson",
    sourceId: "prosecutors-office",
    rebuildOnParamChange: ["prosecutorsOfficeOpacity", "prosecutorsOfficeScale"],
    // 按 pros_type 3 階：supreme 最深紫 / high 中 / district 淺
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.prosecutorsOfficeScale ?? 1;
        const op = p?.prosecutorsOfficeOpacity ?? 0.9;
        const radiusFactor: unknown[] = [
          "match", ["get", "pros_type"],
          "supreme", 1.7,
          "high", 1.3,
          "district", 0.9,
          0.9,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 3, radiusFactor]],
            10, ["*", s, ["*", 5, radiusFactor]],
            14, ["*", s, ["*", 8, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "pros_type"],
            "supreme", "#581c87",
            "high", "#7e22ce",
            "district", "#c084fc",
            "#a855f7",
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["match", ["get", "pros_type"], "supreme", 1.4, "high", 1.0, 0.7] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "correctionalFacility",
    sourceUrl: "./police_justice/correctional_facilities/correctional_facilities_20260626.geojson",
    sourceId: "correctional-facility",
    rebuildOnParamChange: ["correctionalFacilityOpacity", "correctionalFacilityScale"],
    // 按 facility_type 5 類，大小反映「收容強度」、顏色區隔機關性質
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.correctionalFacilityScale ?? 1;
        const op = p?.correctionalFacilityOpacity ?? 0.9;
        const radiusFactor: unknown[] = [
          "match", ["get", "facility_type"],
          "prison", 1.5,            // 監獄（最大）
          "detention", 1.2,         // 看守所
          "drug_rehab", 0.95,       // 戒治所
          "juvenile_obs", 0.85,     // 少觀所
          "correction_school", 1.0, // 矯正學校
          0.9,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 3, radiusFactor]],
            10, ["*", s, ["*", 6, radiusFactor]],
            14, ["*", s, ["*", 10, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "facility_type"],
            "prison", "#111827",         // 監獄 — 最深鐵灰
            "detention", "#374151",      // 看守所 — 深灰
            "drug_rehab", "#7c3aed",     // 戒治所 — 紫
            "juvenile_obs", "#0ea5e9",   // 少觀所 — 藍
            "correction_school", "#0d9488", // 矯正學校 — 青綠（教育）
            "#374151",
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["match", ["get", "facility_type"], "prison", 1.2, "detention", 1.0, 0.7] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "courtJurisdiction",
    sourceUrl: "./police_justice/court_jurisdictions/court_jurisdictions.pmtiles",
    sourceId: "court-jurisdiction",
    pmtiles: { sourceLayer: "court_jurisdictions", minzoom: 0, maxzoom: 10 },
    rebuildOnParamChange: ["courtJurisdictionOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill",
        paint: (_isDark, p) => ({
          "fill-color": "#c4b5fd",
          "fill-opacity": p?.courtJurisdictionOpacity ?? 0.18,
        }),
      },
      {
        suffix: "line", type: "line",
        paint: () => ({
          "line-color": "#7c3aed",
          "line-width": 0.8,
          "line-opacity": 0.7,
        }),
      },
    ],
  },

  // ── 治安態勢 5 layer ──
  {
    id: "crimeAreaMonthly",
    sourceUrl: "./police_justice/crime_area_monthly/crime_area_monthly.pmtiles",
    sourceId: "crime-area-monthly",
    pmtiles: { sourceLayer: "crime_area_monthly", minzoom: 0, maxzoom: 12 },
    rebuildOnParamChange: ["crimeAreaMonthlyOpacity"],
    layers: [
      {
        suffix: "fill", type: "fill",
        paint: (_isDark, p) => ({
          "fill-color": [
            "interpolate", ["linear"], ["coalesce", ["to-number", ["get", "total_events"]], 0],
            0, "#fef2f2",
            100, "#fca5a5",
            500, "#ef4444",
            1500, "#991b1b",
            5000, "#450a0a",
          ] as unknown as string,
          "fill-opacity": p?.crimeAreaMonthlyOpacity ?? 0.55,
        }),
      },
      {
        suffix: "line", type: "line",
        paint: () => ({ "line-color": "#7f1d1d", "line-width": 0.3, "line-opacity": 0.5 }),
      },
    ],
  },
  {
    id: "theftTaoyuan",
    sourceUrl: "./police_justice/theft_points_taoyuan/theft_points_taoyuan_20260626.geojson",
    sourceId: "theft-taoyuan",
    rebuildOnParamChange: ["theftTaoyuanOpacity", "theftTaoyuanScale"],
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.theftTaoyuanScale ?? 1;
        const op = p?.theftTaoyuanOpacity ?? 0.8;
        return {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2 * s, 14, 4 * s, 17, 7 * s] as unknown as number,
          "circle-color": [
            "match", ["get", "case_type"],
            "住宅竊盜", "#f59e0b",
            "汽車竊盜", "#fb923c",
            "機車竊盜", "#fbbf24",
            "自行車竊盜", "#fde047",
            "#f59e0b",
          ] as unknown as string,
          "circle-stroke-color": "#fff", "circle-stroke-width": 0.3,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "trafficAccidentYearly",
    sourceUrl: "./police_justice/traffic_accident_yearly/traffic_accident_yearly_20260626.geojson",
    sourceId: "traffic-accident-yearly",
    rebuildOnParamChange: ["trafficAccidentYearlyOpacity", "trafficAccidentYearlyScale"],
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.trafficAccidentYearlyScale ?? 1;
        const op = p?.trafficAccidentYearlyOpacity ?? 0.85;
        return {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2 * s, 12, 4 * s, 16, 7 * s] as unknown as number,
          "circle-color": "#fb7185",
          "circle-stroke-color": "#fff", "circle-stroke-width": 0.4,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "accidentTaipei",
    sourceUrl: "./police_justice/accident_taipei_dots/accident_taipei_dots_20260626.geojson",
    sourceId: "accident-taipei",
    rebuildOnParamChange: ["accidentTaipeiOpacity", "accidentTaipeiScale"],
    layers: [{
      suffix: "circle", type: "circle", minzoom: 10,
      paint: (_isDark, p) => {
        const s = p?.accidentTaipeiScale ?? 1;
        const op = p?.accidentTaipeiOpacity ?? 0.7;
        return {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.2 * s, 14, 2.5 * s, 17, 5 * s] as unknown as number,
          "circle-color": [
            "match", ["get", "case_class"],
            "1", "#dc2626",
            "2", "#fda4af",
            "#fda4af",
          ] as unknown as string,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "a1AccidentRealtime",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: "a1-accident-realtime",
    dynamicData: true,
    rebuildOnParamChange: ["a1AccidentRealtimeOpacity", "a1AccidentRealtimeScale"],
    // 30 天滾動 + age 分桶：
    //   當天 (<24h)：大圈 + 雙層漣漪 halo（鮮紅 #ef4444）
    //   一週 (24~168h)：中圈 + 單層光暈（紅 #dc2626）
    //   30 天 (168~720h)：小點 + 淡（暗紅 #7f1d1d）
    // ripple_phase 0~1 週期 3s（由 hook 每 60s 重餵時計算）讓當天事故脈動
    layers: [
      // 外層漣漪：只有當天事故顯示
      {
        suffix: "ripple-outer", type: "circle",
        paint: (_isDark, p) => {
          const s = p?.a1AccidentRealtimeScale ?? 1;
          const op = p?.a1AccidentRealtimeOpacity ?? 0.95;
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, ["case", ["<", ["get", "age_hours"], 24], 14, 0]],
              10, ["*", s, ["case", ["<", ["get", "age_hours"], 24], 24, 0]],
              14, ["*", s, ["case", ["<", ["get", "age_hours"], 24], 36, 0]],
            ] as unknown as number,
            "circle-color": "#ef4444",
            "circle-blur": 1,
            "circle-opacity": [
              "case",
              ["<", ["get", "age_hours"], 24],
              ["*", 0.3, op],
              0,
            ] as unknown as number,
          };
        },
      },
      // 內層光暈：當天 (full) / 一週 (淡)
      {
        suffix: "halo", type: "circle",
        paint: (_isDark, p) => {
          const s = p?.a1AccidentRealtimeScale ?? 1;
          const op = p?.a1AccidentRealtimeOpacity ?? 0.95;
          // age 分桶 radius factor
          const ageRadiusFactor: unknown[] = [
            "step", ["get", "age_hours"],
            1.2,        // < 24h
            24, 0.7,    // 24~168h
            168, 0.4,   // 168~720h
            720, 0,     // > 720h 不顯示
          ];
          // age 分桶 color
          const ageColor: unknown[] = [
            "step", ["get", "age_hours"],
            "#ef4444",
            24, "#dc2626",
            168, "#7f1d1d",
          ];
          // age 分桶 opacity
          const ageOpacity: unknown[] = [
            "step", ["get", "age_hours"],
            0.45,
            24, 0.25,
            168, 0.12,
            720, 0,
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, ["*", 6, ageRadiusFactor]],
              10, ["*", s, ["*", 12, ageRadiusFactor]],
              14, ["*", s, ["*", 20, ageRadiusFactor]],
            ] as unknown as number,
            "circle-color": ageColor as unknown as string,
            "circle-blur": 0.6,
            "circle-opacity": ["*", op, ageOpacity] as unknown as number,
          };
        },
      },
      // 主圈：所有 (< 720h) 都顯示，分桶大小 + 色
      {
        suffix: "circle", type: "circle",
        paint: (_isDark, p) => {
          const s = p?.a1AccidentRealtimeScale ?? 1;
          const op = p?.a1AccidentRealtimeOpacity ?? 0.95;
          const ageRadiusFactor: unknown[] = [
            "step", ["get", "age_hours"],
            1.4,        // 當天最大
            24, 0.85,   // 一週
            168, 0.5,   // 30 天
            720, 0,
          ];
          const ageColor: unknown[] = [
            "step", ["get", "age_hours"],
            "#ef4444",
            24, "#dc2626",
            168, "#7f1d1d",
          ];
          return {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              6, ["*", s, ["*", 3, ageRadiusFactor]],
              10, ["*", s, ["*", 5, ageRadiusFactor]],
              14, ["*", s, ["*", 8, ageRadiusFactor]],
            ] as unknown as number,
            "circle-color": ageColor as unknown as string,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": [
              "step", ["get", "age_hours"],
              1,
              24, 0.6,
              168, 0.3,
            ] as unknown as number,
            "circle-opacity": op,
          };
        },
      },
    ],
  },

  // ── 廉政移民海巡 4 layer ──
  {
    id: "investigationBureau",
    sourceUrl: "./police_justice/investigation_bureau/investigation_bureau_20260626.geojson",
    sourceId: "investigation-bureau",
    rebuildOnParamChange: ["investigationBureauOpacity", "investigationBureauScale"],
    // 調查局 29 筆名稱含「處」(縣市調查處 10 個) vs「站」/其他單位 (19 個)
    // 用 name 末字判：「處」=縣市調查處，較大；其他=站/室/組
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.investigationBureauScale ?? 1;
        const op = p?.investigationBureauOpacity ?? 0.9;
        // mapbox 沒有 string contains，用 slice(-1) 取 name 末字
        const radiusFactor: unknown[] = [
          "case",
          ["==", ["slice", ["get", "name"], -1], "處"], 1.35,
          0.9,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 3, radiusFactor]],
            10, ["*", s, ["*", 5, radiusFactor]],
            14, ["*", s, ["*", 8, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "case",
            ["==", ["slice", ["get", "name"], -1], "處"], "#064e3b",  // 縣市調查處 — 深綠
            "#0f766e",  // 站/其他 — 中綠
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["case", ["==", ["slice", ["get", "name"], -1], "處"], 1.1, 0.7] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "antiCorruptionOffice",
    sourceUrl: "./police_justice/anti_corruption_offices/anti_corruption_offices_20260626.geojson",
    sourceId: "anti-corruption-office",
    rebuildOnParamChange: ["antiCorruptionOfficeOpacity", "antiCorruptionOfficeScale"],
    // central (中央 43) 比 local (地方 23) 大
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.antiCorruptionOfficeScale ?? 1;
        const op = p?.antiCorruptionOfficeOpacity ?? 0.9;
        const radiusFactor: unknown[] = [
          "match", ["get", "level"],
          "central", 1.35,
          "local", 0.85,
          0.9,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 2.5, radiusFactor]],
            10, ["*", s, ["*", 5, radiusFactor]],
            14, ["*", s, ["*", 7, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "level"],
            "central", "#134e4a",   // 中央 — 深青
            "local", "#5eead4",     // 地方 — 淺青
            "#14b8a6",
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["match", ["get", "level"], "central", 1.0, 0.5] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "immigrationOffice",
    sourceUrl: "./police_justice/immigration_offices/immigration_offices_20260626.geojson",
    sourceId: "immigration-office",
    rebuildOnParamChange: ["immigrationOfficeOpacity", "immigrationOfficeScale"],
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.immigrationOfficeScale ?? 1;
        const op = p?.immigrationOfficeOpacity ?? 0.9;
        return {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3 * s, 10, 5 * s, 14, 8 * s] as unknown as number,
          "circle-color": "#0ea5e9",
          "circle-stroke-color": "#fff", "circle-stroke-width": 0.8,
          "circle-opacity": op,
        };
      },
    }],
  },
  {
    id: "coastGuardStation",
    sourceUrl: "./police_justice/coast_guard_stations/coast_guard_stations_20260626.geojson",
    sourceId: "coast-guard-station",
    rebuildOnParamChange: ["coastGuardStationOpacity", "coastGuardStationScale"],
    // 252 巡防隊（密、小、淺）/ 17 海洋分署（稀、大、深）
    layers: [{
      suffix: "circle", type: "circle",
      paint: (_isDark, p) => {
        const s = p?.coastGuardStationScale ?? 1;
        const op = p?.coastGuardStationOpacity ?? 0.85;
        const radiusFactor: unknown[] = [
          "match", ["get", "facility_subtype"],
          "ocean_pier", 1.5,
          "patrol_station", 0.85,
          0.9,
        ];
        return {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["*", s, ["*", 2.5, radiusFactor]],
            10, ["*", s, ["*", 4, radiusFactor]],
            14, ["*", s, ["*", 7, radiusFactor]],
          ] as unknown as number,
          "circle-color": [
            "match", ["get", "facility_subtype"],
            "ocean_pier", "#0c4a6e",      // 海洋分署 — 深海藍
            "patrol_station", "#38bdf8",  // 巡防隊 — 淺海藍
            "#0284c7",
          ] as unknown as string,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["match", ["get", "facility_subtype"], "ocean_pier", 1.1, 0.4] as unknown as number,
          "circle-opacity": op,
        };
      },
    }],
  },

  // ── 警察覆蓋分析 isochrone × 3 layer（4 變體合進 1 PMTiles，paint case 切 mode/minutes）──
  // 每個 combined PMTiles 含 walk/drive × 2 minutes，feature 帶 mode + minutes property
  // paint case expression 按目前 mode/minutes 顯示 / 隱藏（不符合的 fill-opacity = 0）
  // overlap_count step expression: 1 站淺紅 → 20+ 站深紫紅
  ...(["policeIsoSubstation", "policeIsoPrecinct", "policeIsoCityDept"] as const).map((id) => {
    const tier = id === "policeIsoSubstation" ? "substation"
      : id === "policeIsoPrecinct" ? "precinct" : "police_dept";
    const sourceId = id === "policeIsoSubstation" ? "police-iso-substation"
      : id === "policeIsoPrecinct" ? "police-iso-precinct" : "police-iso-city-dept";
    const sourceLayer = `police_iso_${tier}`;
    const defaultMinutesNum = id === "policeIsoSubstation" ? 5 : id === "policeIsoPrecinct" ? 15 : 30;
    return {
      id,
      sourceUrl: `./police_justice/isochrone/police_iso_${tier}_combined.pmtiles`,
      sourceId,
      pmtiles: { sourceLayer, minzoom: 0, maxzoom: 14 },
      // paint 內讀 p?.${id}Mode_drive / Minutes_num，select 改了 params → paint diff → rebuild
      rebuildOnParamChange: ["fill", "line"],
      layers: [
        {
          suffix: "fill", type: "fill" as const,
          paint: (_isDark: boolean, p: Record<string, number | undefined> | undefined) => {
            const modeDrive = p?.[`${id}Mode_drive`] ?? 0;
            const minutesNum = p?.[`${id}Minutes_num`] ?? defaultMinutesNum;
            const baseOp = p?.[`${id}Opacity`] ?? 0.5;
            return {
              "fill-color": [
                "step", ["coalesce", ["to-number", ["get", "overlap_count"]], 0],
                "#fef2f2",
                1, "#fee2e2",
                2, "#fca5a5",
                3, "#f87171",
                5, "#ef4444",
                8, "#dc2626",
                12, "#991b1b",
                20, "#7f1d1d",
              ] as unknown as string,
              "fill-opacity": [
                "case",
                ["all",
                  // mode == drive ? mode_drive_num==1 : mode_drive_num==0
                  ["==",
                    ["case", ["==", ["get", "mode"], "drive"], 1, 0],
                    modeDrive,
                  ],
                  ["==", ["to-number", ["get", "minutes"]], minutesNum],
                ],
                baseOp,
                0,
              ] as unknown as number,
            };
          },
        },
        {
          // line layer 改成「只畫最外緣輪廓」效果：極低 opacity + 細 — 視覺幾乎無，避免內部 ring 同心圓感
          suffix: "line", type: "line" as const,
          paint: (_isDark: boolean, p: Record<string, number | undefined> | undefined) => {
            const modeDrive = p?.[`${id}Mode_drive`] ?? 0;
            const minutesNum = p?.[`${id}Minutes_num`] ?? defaultMinutesNum;
            return {
              "line-color": "#7f1d1d",
              "line-width": 0.15,
              "line-opacity": [
                "case",
                ["all",
                  ["==", ["case", ["==", ["get", "mode"], "drive"], 1, 0], modeDrive],
                  ["==", ["to-number", ["get", "minutes"]], minutesNum],
                ],
                0.08,  // 從 baseOp*0.6 (~0.3) 降到 0.08
                0,
              ] as unknown as number,
            };
          },
        },
      ],
    };
  }),

  // ── 民防避難（PMTiles，z≥7 才顯示避免擠爆）──
  {
    id: "civilDefenseShelter",
    sourceUrl: "./police_justice/civil_defense_shelters/civil_defense_shelters.pmtiles",
    sourceId: "civil-defense-shelter",
    pmtiles: { sourceLayer: "civil_defense_shelters", minzoom: 0, maxzoom: 14 },
    rebuildOnParamChange: ["civilDefenseShelterOpacity", "civilDefenseShelterScale"],
    layers: [{
      suffix: "circle", type: "circle", minzoom: 7,
      paint: (_isDark, p) => {
        const s = p?.civilDefenseShelterScale ?? 1;
        const op = p?.civilDefenseShelterOpacity ?? 0.7;
        return {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 0.6 * s, 10, 1.2 * s, 14, 2.5 * s, 17, 5 * s] as unknown as number,
          "circle-color": [
            "match", ["get", "subtype"],
            "一般住宅", "#64748b",
            "公共設施", "#0ea5e9",
            "機關", "#7c3aed",
            "#64748b",
          ] as unknown as string,
          "circle-opacity": op,
        };
      },
    }],
  },

  // ══════════════════════════════════════════════════════════════════
  //  環境污染 POLLUTION（PMTiles，來自 taipei-gis-analytics environment/pollution_source）
  //  ⚠️ 語意紅線：EMS_S_01 列管 ≠ 污染源。標籤用「污染潛勢設施」。
  //  filter（介質 / 年份 / 模式）走專屬 hook 的 setFilter；此處不設 rebuildOnParamChange
  //  以免 rebuild 洗掉 setFilter（比照 gasCoverage / realEstate）。opacity/大小走 paint diff。
  // ══════════════════════════════════════════════════════════════════

  // 污染潛勢設施（介質 × 嚴重度）— 一點一次渲染，色 = max_sev
  {
    id: "pollutionFacility",
    sourceUrl: "./geo/pollution_facilities.pmtiles",
    sourceId: "pollution-facility",
    pmtiles: { sourceLayer: "pollution_facilities", minzoom: 0, maxzoom: 14 },
    layers: [{
      suffix: "circle",
      type: "circle",
      minzoom: 0,
      paint: (_isDark, p) => {
        const s = p?.pollutionFacilityScale ?? 1;
        const op = p?.pollutionFacilityOpacity ?? 0.8;
        return {
          "circle-color": SEVERITY_COLOR_EXPR as unknown as string,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            0, ["*", s, ["+", 0.7, ["*", 0.35, ["coalesce", ["to-number", ["get", "max_sev"]], 0]]]],
            5, ["*", s, ["+", 1.2, ["*", 0.7, ["coalesce", ["to-number", ["get", "max_sev"]], 0]]]],
            11, ["*", s, ["+", 2.5, ["*", 1.3, ["coalesce", ["to-number", ["get", "max_sev"]], 0]]]],
            14, ["*", s, ["+", 4, ["*", 2, ["coalesce", ["to-number", ["get", "max_sev"]], 0]]]],
          ] as unknown as number,
          "circle-opacity": op,
          "circle-stroke-width": ["case", [">=", ["coalesce", ["to-number", ["get", "max_sev"]], 0], 3], 0.8, 0] as unknown as number,
          "circle-stroke-color": "#ffffff",
          "circle-blur": 0.15,
        };
      },
    }],
  },

  // 污染裁處事件（重大亮點）— 色 = event_medium；大小 = penalty_money；filter 由 severity_event 切出
  {
    id: "pollutionPenaltyCritical",
    sourceUrl: "./geo/pollution_penalties.pmtiles",
    sourceId: "pollution-penalty",
    pmtiles: { sourceLayer: "pollution_penalties", minzoom: 5, maxzoom: 14 },
    layers: [{
      suffix: "critical-circle",
      type: "circle",
      minzoom: 5,
      filter: PENALTY_CRITICAL_FILTER,
      paint: (_isDark, p) => {
        const s = p?.pollutionPenaltyScale ?? 1;
        const op = p?.pollutionPenaltyOpacity ?? 0.75;
        return {
          "circle-color": PENALTY_MEDIUM_COLOR_EXPR as unknown as string,
          // 大小 ∝ 罰鍰：以 log10(penalty_money) 為主軸，**全 zoom（含拉到全台 z5）都反映金額**。
          // moneyR = 依 log10 罰鍰映射基礎半徑（1萬→~2px．．．4億→~11px），再乘 zoom 微幅放大 + 使用者 scale。
          //   moneyLog: 4(1萬)→3(3萬)→…→8.65(4.4億)；clamp 於 [3,9] 對應 [2,11]px。
          "circle-radius": (() => {
            const moneyR: unknown[] = [
              "interpolate", ["linear"],
              ["log10", ["max", 10, ["coalesce", ["to-number", ["get", "penalty_money"]], 10]]],
              3, 2,   // ≤1千
              4, 3,   // 1萬
              5, 4.5, // 10萬
              6, 6.5, // 100萬
              7, 8.5, // 1千萬
              9, 11,  // ≥1億
            ];
            // Mapbox 規則：["zoom"] 必須是 paint property 的 top-level step/interpolate input；
            // 因此不要把 zoom interpolate 包進 ["*", ...]，否則整層 addLayer 會失敗。
            return [
              "interpolate", ["linear"], ["zoom"],
              5, ["*", s, 0.85, moneyR],
              10, ["*", s, 1.1, moneyR],
              14, ["*", s, 1.6, moneyR],
            ] as unknown as number;
          })(),
          "circle-opacity": op,
          "circle-stroke-width": [
            "case",
            ["any",
              ["==", ["coalesce", ["to-number", ["get", "is_continuous"]], 0], 1],
              ["==", ["coalesce", ["to-number", ["get", "is_stop_order"]], 0], 1],
            ],
            1.2,
            0.7,
          ] as unknown as number,
          "circle-stroke-color": "#fee2e2",
          "circle-blur": 0.08,
        };
      },
    }],
  },

  // 污染裁處事件（一般背景）— high + normal，淡色小點，與重大層分 toggle
  {
    id: "pollutionPenaltyGeneral",
    sourceUrl: "./geo/pollution_penalties.pmtiles",
    sourceId: "pollution-penalty",
    pmtiles: { sourceLayer: "pollution_penalties", minzoom: 5, maxzoom: 14 },
    layers: [{
      suffix: "general-circle",
      type: "circle",
      minzoom: 5,
      filter: PENALTY_GENERAL_FILTER,
      paint: (_isDark, p) => {
        const s = p?.pollutionPenaltyScale ?? 1;
        const op = p?.pollutionPenaltyOpacity ?? 0.75;
        return {
          "circle-color": PENALTY_MEDIUM_COLOR_EXPR as unknown as string,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            5, ["*", s, ["case", ["==", ["get", "severity_event"], "high"], 1.8, 0.9]],
            10, ["*", s, ["case", ["==", ["get", "severity_event"], "high"], 2.6, 1.4]],
            14, ["*", s, ["case", ["==", ["get", "severity_event"], "high"], 4.0, 2.2]],
          ] as unknown as number,
          "circle-opacity": [
            "case",
            ["==", ["get", "severity_event"], "high"], op * 0.45,
            op * 0.28,
          ] as unknown as number,
          "circle-stroke-width": 0,
          "circle-blur": 0.25,
        };
      },
    }],
  },

  // 污染裁處事件（移動污染）— 車輛排煙 / 空品維護區等，預設關閉
  {
    id: "pollutionPenaltyMobile",
    sourceUrl: "./geo/pollution_penalties.pmtiles",
    sourceId: "pollution-penalty",
    pmtiles: { sourceLayer: "pollution_penalties", minzoom: 5, maxzoom: 14 },
    layers: [{
      suffix: "mobile-circle",
      type: "circle",
      minzoom: 5,
      filter: PENALTY_MOBILE_FILTER,
      paint: (_isDark, p) => {
        const s = p?.pollutionPenaltyScale ?? 1;
        const op = p?.pollutionPenaltyOpacity ?? 0.75;
        return {
          "circle-color": PENALTY_SEVERITY_COLORS.mobile,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            5, ["*", s, 0.9],
            10, ["*", s, 1.5],
            14, ["*", s, 2.6],
          ] as unknown as number,
          "circle-opacity": op * 0.55,
          "circle-stroke-width": 0,
          "circle-blur": 0.18,
        };
      },
    }],
  },

  // 污染場址（S4 確認污染）— 深色方形觀感（circle + stroke），可選只看列管中
  {
    id: "pollutionSite",
    sourceUrl: "./geo/pollution_sites.pmtiles",
    sourceId: "pollution-site",
    pmtiles: { sourceLayer: "pollution_sites", minzoom: 0, maxzoom: 14 },
    layers: [{
      suffix: "circle",
      type: "circle",
      minzoom: 0,
      paint: (_isDark, p) => {
        const s = p?.pollutionSiteScale ?? 1;
        const op = p?.pollutionSiteOpacity ?? 0.9;
        return {
          // 仍列管（is_active=1）用亮紅描邊突顯，已解除用灰
          "circle-color": ["case", ["==", ["coalesce", ["to-number", ["get", "is_active"]], 0], 1], "#dc2626", "#6b7280"] as unknown as string,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            0, ["*", s, 1.2],
            5, ["*", s, 2],
            11, ["*", s, 4],
            14, ["*", s, 7],
          ] as unknown as number,
          "circle-opacity": op,
          "circle-stroke-width": 1.2,
          "circle-stroke-color": ["case", ["==", ["coalesce", ["to-number", ["get", "is_active"]], 0], 1], "#fecaca", "#9ca3af"] as unknown as string,
          "circle-blur": 0.1,
        };
      },
    }],
  },
];
