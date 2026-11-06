/**
 * 日本第二輪（2026-11-06，layer-mapping-r2 C057／C105／X009）四層的色、類別、出典單一資料源：
 * overlayRegistry（paint／filter）、layerParamsSpec（類別多選、年份）、圖例、說明框都從這裡 import。
 *
 * - jpNaturalParkAreas2015：国土数値情報 A10 自然公園地域 2015 年度。只有三個區分（自然公園地域外圍／特別地域／特別保護地区），
 *   **沒有公園名稱與国立・国定・都道府県立種別**（來源 SHP／GML 皆無）；三區分巢狀重疊，依 level 由外而內疊畫。
 * - jpNationalParksMoe：環境省 国立公園区域等 GIS データ（令和7年4月，35 園），ZONE 7 類。
 * - jpWildlifeProtectionMoe：環境省 国指定鳥獣保護区区域等 GIS データ（令和7年4月，347 面），依指定区分上色。
 * - jpDid：国土数値情報 A16 人口集中地区 1995–2015 五期，一期一檔（年份 select 換檔，同淹水情境）。
 *
 * 配色：類別色取站上既有色值（Tailwind 系），自然公園三區分用綠系由淺到深；国立公園 ZONE 依環境省地図慣例
 * （特別保護地区紅→第1種橙→第2種黃→第3種黃綠→普通綠、海域公園藍、未定灰）。DID 人口密度為序位分級（F-3），用 viridis 4 級。
 * 產製：taipei-gis-analytics pipelines/world/{jp_natural_park_areas_ksj_2015,jp_national_parks_moe_r7,jp_wildlife_protection_areas_moe_r7,jp_did_ksj}。
 */
import { paletteRamp, resampleRamp } from "../map/palettes";
import { JP_NATURE_R2_LAYER_COLORS } from "./jpNatureR2Colors";

// ── 自然公園地域 A10 2015 ─────────────────────────────────────
export const JP_NATURAL_PARK_AREAS_URL = "./world/jp_natural_park_areas_ksj_2015.pmtiles";
export const JP_NATURAL_PARK_AREAS_POINTS_URL = "./world/jp_natural_park_areas_ksj_2015_points.pmtiles";
export const JP_NATURAL_PARK_AREAS_COLOR = JP_NATURE_R2_LAYER_COLORS.jpNaturalParkAreas2015;
export const JP_NATURAL_PARK_LEVELS = [
  { value: "1", zh: "自然公園地域（外圍）", ja: "自然公園地域", color: "#a3e635" },
  { value: "2", zh: "特別地域", ja: "特別地域", color: "#22c55e" },
  { value: "3", zh: "特別保護地區", ja: "特別保護地区", color: "#15803d" },
] as const;
export const JP_NATURAL_PARK_AREAS_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A10-2015.html";
export const JP_NATURAL_PARK_AREAS_ATTRIBUTION = "「国土数値情報（自然公園地域データ）2015年度」（国土交通省）を加工して作成 · CC BY 4.0（岡山県は非商用）";
export const JP_NATURAL_PARK_AREAS_LICENSE = "CC BY 4.0（一部制限：岡山県のみ非商用）";
export const JP_NATURAL_PARK_AREAS_DATA_AS_OF = "2015 年度（各縣原始資料年度 2002–2014）";

// ── 国立公園 環境省 令和7年4月 ─────────────────────────────────
export const JP_NATIONAL_PARKS_MOE_URL = "./world/jp_national_parks_moe_r7.pmtiles";
export const JP_NATIONAL_PARKS_MOE_POINTS_URL = "./world/jp_national_parks_moe_r7_points.pmtiles";
export const JP_NATIONAL_PARKS_MOE_COLOR = JP_NATURE_R2_LAYER_COLORS.jpNationalParksMoe;
export const JP_NATIONAL_PARK_ZONES = [
  { value: "特別保護地区", zh: "特別保護地區", color: "#dc2626" },
  { value: "第1種特別地域", zh: "第 1 種特別地域", color: "#f97316" },
  { value: "第2種特別地域", zh: "第 2 種特別地域", color: "#facc15" },
  { value: "第3種特別地域", zh: "第 3 種特別地域", color: "#84cc16" },
  { value: "普通地域", zh: "普通地域", color: "#15803d" },
  { value: "海域公園地区", zh: "海域公園地區", color: "#0ea5e9" },
  { value: "区分未定", zh: "區分未定", color: "#9ca3af" },
] as const;
export const JP_NATIONAL_PARKS_MOE_SOURCE_URL = "http://gis.biodic.go.jp/webgis/sc-026.html?kind=nps";
export const JP_NATIONAL_PARKS_MOE_ATTRIBUTION = "出典：環境省「国立公園区域等に関するGISデータ」（令和7年4月）を加工して作成 · 利用条件未確認";
export const JP_MOE_GIS_LICENSE = "利用條件未確認（不適用生物多様性センター PDL1.0；資料頁連不上）";
export const JP_MOE_GIS_DATA_AS_OF = "2025-04（令和7年4月）";

// ── 国指定鳥獣保護区 環境省 令和7年4月 ──────────────────────────
export const JP_WILDLIFE_MOE_URL = "./world/jp_wildlife_protection_areas_moe_r7.pmtiles";
export const JP_WILDLIFE_MOE_POINTS_URL = "./world/jp_wildlife_protection_areas_moe_r7_points.pmtiles";
export const JP_WILDLIFE_MOE_COLOR = JP_NATURE_R2_LAYER_COLORS.jpWildlifeProtectionMoe;
export const JP_WILDLIFE_CATEGORIES = [
  { value: "集団渡来地", zh: "集團渡來地", color: "#0ea5e9" },
  { value: "集団繁殖地", zh: "集團繁殖地", color: "#f59e0b" },
  { value: "希少鳥獣生息地", zh: "稀少鳥獸棲息地", color: "#a855f7" },
  { value: "大規模生息地", zh: "大規模棲息地", color: "#22c55e" },
] as const;
export const JP_WILDLIFE_MOE_SOURCE_URL = "http://gis.biodic.go.jp/webgis/sc-026.html?kind=nwp";
export const JP_WILDLIFE_MOE_ATTRIBUTION = "出典：環境省「国指定鳥獣保護区区域等に関するGISデータ」（令和7年4月）を加工して作成 · 利用条件未確認";

// ── 人口集中地区 DID A16 ─────────────────────────────────────
export const JP_DID_YEARS = ["1995", "2000", "2005", "2010", "2015"] as const;
export const JP_DID_DEFAULT_YEAR = "2015";
export const jpDidUrl = (year: string) => `./world/jp_did_ksj_${year}.pmtiles`;
export const JP_DID_COLOR = JP_NATURE_R2_LAYER_COLORS.jpDid;
/** DID 個數（合併多部分後）與人口合計，pipeline QA 實算（qa.json） */
export const JP_DID_COUNTS: Record<(typeof JP_DID_YEARS)[number], number> = { 1995: 1534, 2000: 1507, 2005: 1494, 2010: 1499, 2015: 1478 };
/** 人口密度切點（人/km²）：DID 定義下限 4,000；<6k（含 DID 定義下限 4k 與早年未達 4k 者）、6k–8k、8k–10k、≥10k */
export const JP_DID_DENSITY_CUTS = [6000, 8000, 10000] as const;
export const JP_DID_DENSITY_LABELS = ["<6,000", "6,000–8,000", "8,000–10,000", "≥10,000"] as const;
export const JP_DID_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A16-v2_3.html";
export const jpDidAttribution = (year: string) => `「国土数値情報（人口集中地区データ）${year}年」（国土交通省）を加工して作成 · 商用可（平成7年以降）`;
export const JP_DID_LICENSE = "国土数値情報 利用規約（平成7年以降：商用可）";

export function jpDidRamp(isDark: boolean): string[] {
  return resampleRamp(paletteRamp("viridis", isDark)!, JP_DID_DENSITY_LABELS.length);
}

/** 人口密度 = population / area_km2（DID 依定義 ≥4,000 人/km²；五期面積皆有值，分母只防 0） */
export function jpDidDensityColorExpr(isDark: boolean): unknown[] {
  const colors = jpDidRamp(isDark);
  const density = ["/", ["to-number", ["get", "population"], 0], ["max", ["to-number", ["get", "area_km2"], 0], 0.0001]];
  const expr: unknown[] = ["step", density, colors[0]];
  JP_DID_DENSITY_CUTS.forEach((c, i) => expr.push(c, colors[i + 1]));
  return expr;
}

