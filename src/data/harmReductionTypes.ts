/**
 * 減害服務 5 層（清潔針具／替代療法與藥癮戒治／愛滋自我篩檢通路／愛滋篩檢與指定醫療／毒品危害防制中心）
 * 的分類、色票與 Mapbox filter SSOT —— manifest / overlay / legend / popup 四邊共用。
 *
 * 色票是資料語意色（design-system spec §3.16），刻意不進 designTokens。
 */
import { allMultiSelectBitmask, multiSelectFilter, selectedMultiSelectValues } from "./multiSelectMapbox";

export const HARM_REDUCTION_COLORS = {
  harmReductionNeedle: "#0d9488",
  harmReductionTreatment: "#7c3aed",
  harmReductionHivSelftest: "#e11d48",
  harmReductionHivTesting: "#db2777",
  harmReductionPreventionCenters: "#d97706",
} as const;

// ── 清潔針具：一點可有多類服務，任一勾選的服務存在即顯示 ──
export const NEEDLE_SERVICE_OPTIONS = [
  { value: "education", label: "衛教諮詢站", flag: "has_education_station", is24h: "education_is_24h" },
  { value: "vending", label: "針具自動服務機", flag: "has_vending_machine", is24h: "vending_is_24h" },
  { value: "return_bin", label: "針具回收桶", flag: "has_return_bin", is24h: "return_bin_is_24h" },
] as const;

// ── 替代療法與藥癮戒治 ──
export const TREATMENT_CATEGORY_OPTIONS = [
  { value: "substitution_treatment", label: "替代治療", color: "#7c3aed" },
  { value: "designated_drug_treatment", label: "指定藥癮戒治", color: "#2563eb" },
  { value: "satellite_dosing_point", label: "衛星給藥點", color: "#c084fc" },
] as const;

// ── 愛滋自我篩檢通路（欄位 channel）──
export const SELFTEST_CHANNEL_OPTIONS = [
  { value: "vending_machine", label: "自動服務機", color: "#e11d48" },
  { value: "physical_outlet", label: "實體通路", color: "#fb7185" },
] as const;

/** 實體通路的場所類型（outlet_type）—— 只進 popup，不分色 */
export const SELFTEST_OUTLET_TYPE_LABELS: Record<string, string> = {
  public_health: "衛生局／所",
  pharmacy: "藥局",
  medical: "醫療院所",
  ngo_or_community: "民間團體／社區據點",
};

// ── 愛滋篩檢與指定醫療 ──
export const HIV_TESTING_CATEGORY_OPTIONS = [
  { value: "anonymous_testing", label: "匿名篩檢", color: "#db2777" },
  { value: "designated_hospital", label: "指定醫事機構", color: "#0284c7" },
  { value: "designated_pharmacy", label: "指定藥局", color: "#16a34a" },
  { value: "lgbtq_health_center", label: "多元性別健康中心", color: "#f59e0b" },
] as const;

const valuesOf = (options: readonly { value: string }[]) => options.map((option) => option.value);

export const NEEDLE_SERVICE_VALUES = valuesOf(NEEDLE_SERVICE_OPTIONS);
export const TREATMENT_CATEGORY_VALUES = valuesOf(TREATMENT_CATEGORY_OPTIONS);
export const SELFTEST_CHANNEL_VALUES = valuesOf(SELFTEST_CHANNEL_OPTIONS);
export const HIV_TESTING_CATEGORY_VALUES = valuesOf(HIV_TESTING_CATEGORY_OPTIONS);

/** 給 layerParamsSpec 的 options（只要 value／label） */
export const toParamOptions = (options: readonly { value: string; label: string }[]) =>
  options.map(({ value, label }) => ({ value, label }));

export function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? (value == null ? "" : String(value));
}

/** 分類 → 色的 Mapbox match 表達式 */
export function categoryColorExpression(
  property: string,
  options: readonly { value: string; color: string }[],
): unknown[] {
  return ["match", ["get", property], ...options.flatMap((option) => [option.value, option.color]), "#94a3b8"];
}

/**
 * 清潔針具 filter：勾選的服務類型「任一」存在即顯示；
 * only24h=1 時改成「勾選的服務類型中，任一為 24 小時」（`*_is_24h` 為 null 視為非 24 小時）。
 */
export function needleServiceFilter(
  mask = allMultiSelectBitmask(NEEDLE_SERVICE_VALUES),
  only24h = 0,
): unknown[] {
  const selected = selectedMultiSelectValues(mask, NEEDLE_SERVICE_VALUES);
  if (selected.length === 0) return ["==", ["get", "name"], "__multi_select_none__"];
  const options = NEEDLE_SERVICE_OPTIONS.filter((option) => selected.includes(option.value));
  return ["any", ...options.map((option) => only24h === 1
    ? ["all", ["==", ["get", option.flag], true], ["==", ["get", option.is24h], true]]
    : ["==", ["get", option.flag], true])];
}

export function treatmentCategoryFilter(mask = allMultiSelectBitmask(TREATMENT_CATEGORY_VALUES)): unknown[] {
  return multiSelectFilter("category", mask, TREATMENT_CATEGORY_VALUES);
}

export function selftestChannelFilter(mask = allMultiSelectBitmask(SELFTEST_CHANNEL_VALUES)): unknown[] {
  return multiSelectFilter("channel", mask, SELFTEST_CHANNEL_VALUES);
}

export function hivTestingCategoryFilter(mask = allMultiSelectBitmask(HIV_TESTING_CATEGORY_VALUES)): unknown[] {
  return multiSelectFilter("category", mask, HIV_TESTING_CATEGORY_VALUES);
}

/**
 * 座標精度 → popup 文字。只有 google_approximate／approximate／interpolated 類明說「推估」；
 * cached（離線地址快取）上游沒有另標精度，誠實寫「精度未另標」而不是說成門牌精確。
 */
export function harmReductionPrecisionLabel(precision: unknown): string {
  switch (precision) {
    case "exact":
    case "google_exact":
      return "門牌地址定位";
    case "cached":
      return "地址比對定位（精度未另標）";
    case "interpolated":
    case "google_interpolated":
      return "位置為推估（門牌內插）";
    case "approximate":
    case "google_approximate":
      return "位置為推估（路段或區域概略位置）";
    case "google_place_manual":
      return "依機構名稱查得位置（人工核對）";
    default:
      return precision == null ? "" : String(precision);
  }
}

export function isEstimatedPrecision(precision: unknown): boolean {
  return precision === "interpolated" || precision === "google_interpolated"
    || precision === "approximate" || precision === "google_approximate";
}
