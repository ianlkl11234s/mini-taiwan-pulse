/**
 * 崩塌主題 4 層（大規模崩塌潛勢區／影響範圍、省道歷史災情、年度全島崩塌地）的分類、色票與
 * Mapbox filter SSOT —— manifest／overlay／legend／popup 四邊共用。
 * 色票是資料語意色（design-system spec §3.16），刻意不進 designTokens。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step。
 */
import { allMultiSelectBitmask, selectedMultiSelectValues } from "./multiSelectMapbox";

export const LANDSLIDE_LAYER_COLORS = {
  landslideDodAreas: "#b45309",
  landslideDodImpact: "#c2410c",
  highwayDisasterHistory: "#a16207",
  landslideAnnual: "#92400e",
} as const;

// ── 大規模崩塌潛勢區／影響範圍：年度版本（民國年）與風險等級 ──

/** 年度版本 111–115（逐年增加處數，非同一組；跨年比較用 lslno_old）。預設最新 115。 */
export const DOD_YEARS = [111, 112, 113, 114, 115] as const;
export const DOD_DEFAULT_YEAR = 115;
export const DOD_YEAR_OPTIONS = DOD_YEARS.map((year) => ({ value: String(year), label: `${year} 年版（${year + 1911}）` }));

/** 來源 risk 分級（高／中／低；無數值警戒值）。 */
export const DOD_RISK_OPTIONS = [
  { value: "高", label: "高風險", color: "#b91c1c" },
  { value: "中", label: "中風險", color: "#ea580c" },
  { value: "低", label: "低風險", color: "#facc15" },
] as const;
export const DOD_RISK_VALUES = DOD_RISK_OPTIONS.map((option) => option.value);
export const DOD_RISK_MISSING_COLOR = "#94a3b8";

export function dodRiskColorExpr(): unknown[] {
  return ["match", ["get", "risk"], ...DOD_RISK_OPTIONS.flatMap((option) => [option.value, option.color]), DOD_RISK_MISSING_COLOR];
}

/** 年度篩選：idx 對應 DOD_YEARS；未給（或越界）時用預設 115 年版，避免五個年度版本疊在一起。 */
export function dodYearFilter(idx: number | undefined): unknown[] {
  const year = DOD_YEARS[idx ?? DOD_YEARS.indexOf(DOD_DEFAULT_YEAR)] ?? DOD_DEFAULT_YEAR;
  return ["==", ["get", "year_roc"], year];
}

export function dodRiskColor(value: unknown): string {
  return DOD_RISK_OPTIONS.find((option) => option.value === value)?.color ?? DOD_RISK_MISSING_COLOR;
}

// ── 省道歷史災情（PMTiles；category_group 由 build-landslide-public.py 依 category_sub 分 8 族）──

export const HIGHWAY_CATEGORY_GROUPS = [
  { value: "rockfall", label: "落石", color: "#a16207" },
  { value: "slope_failure", label: "邊坡坍方・路基流失", color: "#c2410c" },
  { value: "debris_flow", label: "土石流阻斷", color: "#7c2d12" },
  { value: "precautionary_closure", label: "預警性封閉", color: "#7c3aed" },
  { value: "flooding", label: "淹水", color: "#0284c7" },
  { value: "structure_damage", label: "橋梁・設施損毀", color: "#be185d" },
  { value: "traffic_incident", label: "交通事故", color: "#475569" },
  { value: "other", label: "其他", color: "#94a3b8" },
] as const;
export const HIGHWAY_CATEGORY_VALUES = HIGHWAY_CATEGORY_GROUPS.map((option) => option.value);

/** 通報年份 2014–2026（2026 至 10/04，不完整年度）。 */
export const HIGHWAY_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
export const HIGHWAY_YEAR_OPTIONS = HIGHWAY_YEARS.map((year) => ({ value: String(year), label: year === 2026 ? "2026（至 10/04）" : String(year) }));
export const HIGHWAY_YEAR_VALUES = HIGHWAY_YEAR_OPTIONS.map((option) => option.value);

export function highwayCategoryColorExpr(): unknown[] {
  return ["match", ["get", "category_group"], ...HIGHWAY_CATEGORY_GROUPS.flatMap((option) => [option.value, option.color]), "#94a3b8"];
}

/** 類別 × 年份多選；year 在切片內是數字，以 to-string 比對選項字串。全關＝不顯示。 */
export function highwayDisasterFilter(
  categoryMask = allMultiSelectBitmask(HIGHWAY_CATEGORY_VALUES),
  yearMask = allMultiSelectBitmask(HIGHWAY_YEAR_VALUES),
): unknown[] {
  const categories = selectedMultiSelectValues(categoryMask, HIGHWAY_CATEGORY_VALUES);
  const years = selectedMultiSelectValues(yearMask, HIGHWAY_YEAR_VALUES);
  return ["all",
    ["in", ["get", "category_group"], ["literal", categories]],
    ["in", ["to-string", ["get", "year"]], ["literal", years]],
  ];
}

export function highwayCategoryLabel(value: unknown): string {
  return HIGHWAY_CATEGORY_GROUPS.find((option) => option.value === value)?.label ?? "其他";
}

export function highwayCategoryColor(value: unknown): string {
  return HIGHWAY_CATEGORY_GROUPS.find((option) => option.value === value)?.color ?? "#94a3b8";
}

// ── 年度全島崩塌地（農水署；107MB PMTiles，source-layer landslide_annual）──

/** 只有這 4 年；2019–2022 未納入、2016 以前為林業署另一口徑未納入。預設 2024（V2 版）。 */
export const ANNUAL_YEARS = [2017, 2018, 2023, 2024] as const;
export const ANNUAL_DEFAULT_YEAR = 2024;
export const ANNUAL_YEAR_OPTIONS = ANNUAL_YEARS.map((year) => ({ value: String(year), label: year === 2024 ? "2024（V2 版）" : String(year) }));
/** z6–z9 切片會遺漏小面（z6 少約 20%），z10 起 143,511 面完整 → 圖層 z<10 不顯示。 */
export const ANNUAL_MIN_ZOOM = 10;
/** 缺值哨兵：min_dtm = -32767 表示 DTM 無值。 */
export const ANNUAL_DTM_NODATA = -32767;
export const ANNUAL_MISSING_YEARS_NOTE = "只有 2017、2018、2023、2024 四年：2019–2022 未納入，2016 以前為林業署另一口徑未納入。";
export const ANNUAL_V2_NOTE = "2024 為 V2 版（影像 2024-12～2025-05），與縣市統計的 2024 數字不一致。";
export const ANNUAL_ZOOM_NOTE = "放大到 10 級以上才顯示（低縮放會遺漏小面）。";

export function annualYearFilter(idx: number | undefined): unknown[] {
  const year = ANNUAL_YEARS[idx ?? ANNUAL_YEARS.indexOf(ANNUAL_DEFAULT_YEAR)] ?? ANNUAL_DEFAULT_YEAR;
  return ["==", ["get", "year"], year];
}
