/**
 * GBA 全台 3D 建物輪廓（GlobalBuildingAtlas + OSM 融合，152 萬棟）的
 * 顏色、分級單一真實來源。
 * 給 overlayRegistry 配色（fill-color / fill-extrusion-color 表達式）、
 * LegendPanel 圖例、featureInfo popup Title 三處共用（同 urbanOpenSpaceTypes.ts 慣例）。
 *
 * 屬性（2026-07-27 起改吃 `buildings_value_taiwan.pmtiles`，欄位隨上游改名）：
 *   `h`   公尺 float 高度（舊磚叫 `height`；-999 = 缺值 sentinel，台北 101 已覆寫 508.0）
 *   `f`   int 樓層估計（= h÷3.2，上游算好的，不要自己再除）
 *   `v`   int 估值 **萬元**、`ps` str 價格來源 g/n/t/c、`nm` int 非市場 0/1 —— 見 propertyValueTypes.ts
 *   `src` str（"osm" = OSM 志願者繪製，其餘如 "ours2"/"clsm" = GBA AI 推估；此欄未改名）
 * 授權 CC BY-NC 4.0，署名見 BUILDINGS_GBA_ATTRIBUTION（圖例必掛）。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（見 streetTreeColors.ts 註）。
 */

export interface BuildingHeightBand {
  /** 該級上界（不含）；最後一級為 null（無上界） */
  max: number | null;
  color: string;
  label: string;
}

// 高度 6 級（RdYlBu 反轉，低→高：藍→紅）；高度 100% 有值，理論上不會落到缺值分支
export const BUILDING_HEIGHT_BANDS: BuildingHeightBand[] = [
  { max: 7,    color: "#4575b4", label: "< 7 m" },
  { max: 15,   color: "#91bfdb", label: "7–15 m" },
  { max: 24,   color: "#e0f3f8", label: "15–24 m" },
  { max: 50,   color: "#fee090", label: "24–50 m" },
  { max: 100,  color: "#fc8d59", label: "50–100 m" },
  { max: null, color: "#d73027", label: "≥ 100 m" },
];

const BUILDING_HEIGHT_MISSING_COLOR = "#9e9e9e";

/** 高度分級 step：缺值/<=0 → 灰；否則依 6 級 band break 上色（同 streetTreeColors 的 bandStepColorExpr 慣例） */
export function buildingHeightColorExpr(): unknown[] {
  const val: unknown[] = ["to-number", ["get", "h"], 0]; // null → 0 → 判為缺值（-999 sentinel 亦然）
  const step: unknown[] = ["step", val, BUILDING_HEIGHT_BANDS[0]!.color];
  for (let i = 1; i < BUILDING_HEIGHT_BANDS.length; i++) {
    step.push(BUILDING_HEIGHT_BANDS[i - 1]!.max as number, BUILDING_HEIGHT_BANDS[i]!.color);
  }
  return ["case", ["<=", val, 0], BUILDING_HEIGHT_MISSING_COLOR, step];
}

/** 高度分級色（純 JS 版，供 featureInfo popup Title 上色，不進 mapbox 表達式） */
export function buildingHeightBandColor(height: number): string {
  if (!Number.isFinite(height) || height <= 0) return BUILDING_HEIGHT_MISSING_COLOR;
  for (const band of BUILDING_HEIGHT_BANDS) {
    if (band.max === null || height < band.max) return band.color;
  }
  return BUILDING_HEIGHT_BANDS[BUILDING_HEIGHT_BANDS.length - 1]!.color;
}

// 資料來源二色（value 對齊 PMTiles src 欄位值；"osm" = OSM 志願者繪製，其餘 = GBA AI 推估）
export const BUILDING_SRC_COLORS = {
  osm: "#1b9e77",
  other: "#7570b3",
} as const;

export const BUILDING_SRC_LABELS: { value: "osm" | "other"; label: string; color: string }[] = [
  { value: "osm", label: "OpenStreetMap", color: BUILDING_SRC_COLORS.osm },
  { value: "other", label: "GBA AI 推估", color: BUILDING_SRC_COLORS.other },
];

/** 來源：src === "osm" → 綠青，其餘（GBA AI 推估）→ 紫 */
export function buildingSrcColorExpr(): unknown[] {
  return ["match", ["get", "src"], "osm", BUILDING_SRC_COLORS.osm, BUILDING_SRC_COLORS.other];
}

// 夜景燈光模式：深色底圖上模擬城市夜空。height 越高 → 越亮越白（低樓層暗暖橘、高樓層爆白），
// 以 height 小數位做確定性 pseudo-random 分流，約 1/3 建物走白光家族、其餘走暖橘家族 → 橘白交錯（偏白）。
// Mapbox fill 無 additive blending，靠深底 + 明亮暖白色階近似 bloom 觀感（非真光暈）。
// 兩組 6 段色階皆隨 height 由暗轉亮，對齊「樓層越高光越亮」語意。
const NIGHT_WARM_RAMP: [number, string][] = [
  [0, "#2a1505"],
  [8, "#7a3d12"],
  [18, "#c46220"],
  [35, "#ff9838"],
  [70, "#ffd59a"],
  [140, "#fff4e2"],
];
const NIGHT_WHITE_RAMP: [number, string][] = [
  [0, "#43392a"],
  [8, "#807763"],
  [18, "#c6bea8"],
  [35, "#ece7d8"],
  [70, "#fbf9f2"],
  [140, "#ffffff"],
];

function nightRampExpr(h: unknown[], ramp: [number, string][]): unknown[] {
  const e: unknown[] = ["interpolate", ["linear"], h];
  for (const [stop, color] of ramp) e.push(stop, color);
  return e;
}

/** 夜景燈光 fill-color：橘/白雙家族依 h 由暗轉亮，pseudo-random 交錯（⚠️ 不含 ["zoom"]） */
export function buildingNightLightColorExpr(): unknown[] {
  const h: unknown[] = ["to-number", ["get", "h"], 0];
  // round(h*10) mod 3 == 0 → 白光家族（約 1/3，偏白），其餘暖橘；高度小數位讓相鄰建物散開
  const bucket: unknown[] = ["%", ["round", ["*", h, 10]], 3];
  return ["case", ["==", bucket, 0], nightRampExpr(h, NIGHT_WHITE_RAMP), nightRampExpr(h, NIGHT_WARM_RAMP)];
}

/** 夜景燈光圖例色帶（低→高，代表暖橘→暖白爆光；白光家族僅點綴不另列） */
export const BUILDING_NIGHT_LEGEND: { color: string; label: string }[] = [
  { color: "#7a3d12", label: "低樓層 · 暖橘微光" },
  { color: "#ff9838", label: "中樓層 · 橘光" },
  { color: "#fff4e2", label: "高樓層 · 暖白" },
  { color: "#ffffff", label: "超高層 · 白熱交錯" },
];

/** 顯示模式 select 選項；index 對齊 overlayRegistry 讀的 buildingsGbaModeIdx */
export const BUILDINGS_GBA_MODES = [
  { label: "高度分級", value: "0" },
  { label: "資料來源", value: "1" },
  { label: "3D 立體", value: "2" },
  { label: "夜景燈光", value: "3" },
  { label: "估值", value: "4" },
] as const;

// 圖例必掛署名（CC BY-NC 4.0，禁商用）
export const BUILDINGS_GBA_ATTRIBUTION = "© GlobalBuildingAtlas (TUM) · Zhu et al. 2025 · CC BY-NC 4.0";
