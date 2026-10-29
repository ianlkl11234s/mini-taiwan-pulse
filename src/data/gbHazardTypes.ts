/**
 * 英國第 9 波災害地質 5 層（C067 GeoSure 地質災害易發性、C069 山崩紀錄、C072 氡氣指示圖／加馬劑量率、C066 地震目錄）：
 * 類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。授權原句與筆數驗算見 taipei-gis-analytics
 * `docs/data-catalog/hazards/gb_geosure_hex.md`、`gb_landslides.md`、`gb_radon_atlas.md`、`gb_earthquakes.md`、
 * `docs/data-catalog/energy/gb_gamma_dose.md` 與 `docs/topic-research/united_kingdom_opendata/waves/w9/layer-plan.md`（2026-10-29）。
 *
 * 色票沿用台灣同語意圖層（資料色，spec §3.16），不自訂新色：
 *   GeoSure 易發性 低／中／顯著＝台灣土壤液化潛勢 低／中／高三階色（SOIL_POTENTIAL_CLASSES；同第 3 波北愛海岸風險線）。
 *     ⚠️ GeoSure 不是液化：只借三階順序色，文字一律寫「地質災害易發性」。
 *   山崩紀錄點＝台灣年度全島崩塌地色（LANDSLIDE_LAYER_COLORS.landslideAnnual）；BGS 已複核實心、未複核空心。
 *   氡氣 6 級：設計規範沒有六級災害序列 token；1 km 方格屬網格（map-layers G-3），借網格色盤 YlOrBr 重取樣 6 階
 *     （暗淡兩版隨底圖切換，K-4）。借色，待使用者確認。
 *   加馬劑量率＝台灣環境輻射（nuscGammaRadiation）的 SEQ.education 四階；單位 µGy/h（不換算成 µSv/h）。
 *   地震＝spec §3.15 earthquake 語意色 #ff3b30（台灣 earthquakes 同色）；儀器記錄實心、歷史地震空心環，不另借第二色。
 *     半徑依規模，沿用日本地震 JMA_QUAKE_RADIUS_STOPS。
 */
import { SOIL_POTENTIAL_CLASSES } from "./soilLiquefactionTypes";
import { LANDSLIDE_LAYER_COLORS } from "./landslideTypes";
import { STATISTICS_SEQUENTIAL_SCHEMES as SEQ } from "./statisticsVisuals";
import { paletteRamp, resampleRamp } from "../map/palettes";

export const GB_HAZARD_FETCHED_AT = "2026-10-29";
/** BGS 資料集頁原文只寫「Open Government Licence」（未標版本），照原文。 */
export const GB_BGS_OGL = "Open Government Licence";
export const GB_DESNZ_OGL_V3 = "Open Government Licence v3.0";

// ─────────────────────────── C067 GeoSure 地質災害易發性 gbGroundStability ───────────────────────────

export const GB_GEOSURE_ATTRIBUTION = "BGS GeoSure 5 km hex grid (Version 8) © UKRI (British Geological Survey) — Contains OS data © Crown copyright 2020; Open Government Licence";
export const GB_GEOSURE_URL = "https://www.bgs.ac.uk/datasets/bgs-geosure-5-km-hex-grid/";
export const GB_GEOSURE_TILE_ZOOM = { minzoom: 4, maxzoom: 11 } as const;
export const GB_GEOSURE_MINZOOM = 5;

export type GbGeoHazard = "landslides" | "shrink_swell" | "compressible_ground" | "collapsible_deposits" | "running_sand" | "soluble_rocks";
/** 宣告順序＝選單順序；第一個（山崩）為預設。counts＝Low／Moderate／Significant 格數（catalog doc）。 */
export const GB_GEO_HAZARDS: readonly { value: GbGeoHazard; label: string; counts: readonly [number, number, number] }[] = [
  { value: "landslides", label: "山崩", counts: [2_026, 1_510, 692] },
  { value: "shrink_swell", label: "脹縮土", counts: [2_896, 945, 392] },
  { value: "compressible_ground", label: "可壓縮地層", counts: [3_704, 1, 528] },
  { value: "collapsible_deposits", label: "可塌陷沉積物", counts: [4_190, 22, 21] },
  { value: "running_sand", label: "流沙", counts: [3_874, 189, 170] },
  { value: "soluble_rocks", label: "可溶岩（溶蝕）", counts: [3_837, 176, 282] },
];
export const GB_GEO_HAZARD_VALUES: readonly GbGeoHazard[] = GB_GEO_HAZARDS.map((h) => h.value);
export function gbGeoHazardFromIdx(idx: number): GbGeoHazard {
  return GB_GEO_HAZARD_VALUES[Math.trunc(idx)] ?? "landslides";
}
export function gbGeoHazard(value: unknown) {
  return GB_GEO_HAZARDS.find((h) => h.value === value);
}

export type GbSusceptibility = "Low" | "Moderate" | "Significant";
const soilColor = (value: string) => SOIL_POTENTIAL_CLASSES.find((c) => c.value === value)!.color;
/** 宣告順序＝圖例順序（低 → 顯著）。 */
export const GB_SUSCEPTIBILITY: readonly { value: GbSusceptibility; color: string }[] = [
  { value: "Low", color: soilColor("low") },
  { value: "Moderate", color: soilColor("medium") },
  { value: "Significant", color: soilColor("high") },
];
export const GB_GEOSURE_COLOR = GB_SUSCEPTIBILITY[2]!.color;
export function gbSusceptibility(value: unknown) {
  return GB_SUSCEPTIBILITY.find((s) => s.value === value);
}

// ─────────────────────────── C069 山崩紀錄 gbLandslide ───────────────────────────

export const GB_LANDSLIDE_ATTRIBUTION = "Contains British Geological Survey materials copyright NERC 2026 (Open Government Licence); BGS National Landslide Database (index data)";
export const GB_LANDSLIDE_URL = "https://www.bgs.ac.uk/datasets/national-landslide-database/";
export const GB_LANDSLIDE_SERVICE_URL = "https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer/2";
export const GB_LANDSLIDE_TILE_ZOOM = { minzoom: 5, maxzoom: 12 } as const;
export const GB_LANDSLIDE_MINZOOM = 7;
export const GB_LANDSLIDE_COLOR = LANDSLIDE_LAYER_COLORS.landslideAnnual;
export const GB_LANDSLIDE_COUNT = 18_699;
/** grid_checked_by_bgs：Y 已依原文獻複核位置（實心）／N、U 未複核（空心）。 */
export const GB_LANDSLIDE_CHECKED = { checked: 15_591, unchecked: 2_944 + 164 } as const;
export const GB_LANDSLIDE_HOLLOW_STROKE = 1.5;

// ─────────────────────────── C072 氡氣指示圖 gbRadon ───────────────────────────

export const GB_RADON_ATTRIBUTION = "Indicative Atlas of Radon (GB v3; NI v1) © UKRI (British Geological Survey) and UK Health Security Agency — Contains OS data © Crown copyright 2020; Open Government Licence";
export const GB_RADON_URL = "https://www.bgs.ac.uk/datasets/radon-data-indicative-atlas-of-radon/";
export const GB_RADON_TILE_ZOOM = { minzoom: 5, maxzoom: 10 } as const;
export const GB_RADON_MINZOOM = 5;
/** radon_class 1–6：住宅超過氡行動水平的估計比例；counts＝格數（catalog doc）。 */
export const GB_RADON_CLASSES: readonly { value: number; band: string; count: number }[] = [
  { value: 1, band: "<1%", count: 112_127 },
  { value: 2, band: "1–3%", count: 46_584 },
  { value: 3, band: "3–5%", count: 23_420 },
  { value: 4, band: "5–10%", count: 30_465 },
  { value: 5, band: "10–30%", count: 30_324 },
  { value: 6, band: "≥30%", count: 14_126 },
];
export const GB_RADON_PALETTE_ID = "YlOrBr";
/** 6 階（低 → 高）；暗底越高越亮、淡底越高越深（色盤庫規則）。 */
export function gbRadonColors(isDark: boolean): string[] {
  return resampleRamp(paletteRamp(GB_RADON_PALETTE_ID, isDark) ?? [], GB_RADON_CLASSES.length);
}
export const GB_RADON_COLOR = gbRadonColors(true)[3]!;
export function gbRadonClass(value: unknown) {
  return GB_RADON_CLASSES.find((c) => c.value === Number(value));
}

// ─────────────────────────── C072 加馬劑量率 gbRadiation ───────────────────────────

export const GB_GAMMA_ATTRIBUTION = "Department for Energy Security and Net Zero — Ambient gamma radiation dose rates across the UK (RREMS fixed monitors, August 2026); Contains public sector information licensed under the Open Government Licence v3.0";
export const GB_GAMMA_URL = "https://www.gov.uk/government/publications/ambient-gamma-radiation-dose-rates-across-the-uk";
export const GB_GAMMA_TILE_ZOOM = { minzoom: 4, maxzoom: 12 } as const;
export const GB_GAMMA_MINZOOM = 4;
export const GB_GAMMA_COUNT = 83;
export const GB_GAMMA_PERIOD = "2026-08";
export const GB_GAMMA_UNIT = "µGy/h";
/** dose_mean 分級（µGy/h）：upper＝上限（不含），最後一級無上限；色＝台灣環境輻射 SEQ.education 1–4 階。 */
export const GB_GAMMA_CLASSES: readonly { upper: number | null; color: string }[] = [
  { upper: 0.10, color: SEQ.education.colors[1]! },
  { upper: 0.12, color: SEQ.education.colors[2]! },
  { upper: 0.14, color: SEQ.education.colors[3]! },
  { upper: null, color: SEQ.education.colors[4]! },
];
export const GB_GAMMA_COLOR = SEQ.education.colors[3]!;
export const GB_GAMMA_MISSING_STROKE = "#94a3b8";
export function gbGammaColor(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return GB_GAMMA_CLASSES.find((c) => c.upper == null || value < c.upper)!.color;
}

// ─────────────────────────── C066 地震目錄 gbEarthquakes ───────────────────────────

export const GB_QUAKE_ATTRIBUTION = "Contains British Geological Survey materials copyright NERC 2026 (Open Government Licence); BGS UK earthquake catalogue (historical & instrumentally recorded)";
export const GB_QUAKE_URL = "https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer";
export const GB_QUAKE_TILE_ZOOM = { minzoom: 4, maxzoom: 11 } as const;
/** 規模 <2 的儀器記錄（多數）z7 起才畫；其他（含規模未知、歷史地震）z4 起。 */
export const GB_QUAKE_MINOR_MINZOOM = 7;
export const GB_QUAKE_MINOR_BELOW = 2;
/** spec §3.15 earthquake 語意色（＝台灣 earthquakes）。 */
export const GB_QUAKE_COLOR = "#ff3b30";
export const GB_QUAKE_DATA_END = "2024-09-02";
export const GB_QUAKE_COUNTS = { total: 7_116, instrumental: 6_664, historical: 452, offshore: 1_409, unknownMagnitude: 5 } as const;
export const GB_QUAKE_YEARS = { instrumental: "1970–2024", historical: "1382–1969" } as const;
/** 圖例的規模級距（代表值算半徑）。 */
export const GB_QUAKE_MAG_BANDS: readonly { label: string; at: number }[] = [
  { label: "<2", at: 1.5 }, { label: "2–3", at: 2.5 }, { label: "3–4", at: 3.5 }, { label: "4–5", at: 4.5 }, { label: "≥5", at: 5.5 },
];
export const GB_QUAKE_HOLLOW_STROKE = 1.5;
