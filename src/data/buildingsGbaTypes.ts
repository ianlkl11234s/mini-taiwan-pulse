/**
 * GBA 全台 3D 建物輪廓（GlobalBuildingAtlas + OSM 融合，152 萬棟）的
 * 顏色、分級單一真實來源。
 * 給 overlayRegistry 配色（fill-color / fill-extrusion-color 表達式）、
 * LegendPanel 圖例、featureInfo popup Title 三處共用（同 urbanOpenSpaceTypes.ts 慣例）。
 *
 * 屬性：height（公尺 float，100% 有值）、src（"osm" = OSM 志願者繪製，其餘如 "ours2" = GBA AI 推估）。
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
  const val: unknown[] = ["to-number", ["get", "height"], 0]; // null → 0 → 判為缺值
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

/** 顯示模式 select 選項；index 對齊 overlayRegistry 讀的 buildingsGbaModeIdx */
export const BUILDINGS_GBA_MODES = [
  { label: "高度分級", value: "0" },
  { label: "資料來源", value: "1" },
  { label: "3D 立體", value: "2" },
] as const;

// 圖例必掛署名（CC BY-NC 4.0，禁商用）
export const BUILDINGS_GBA_ATTRIBUTION = "© GlobalBuildingAtlas (TUM) · Zhu et al. 2025 · CC BY-NC 4.0";
