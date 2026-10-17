/**
 * 減害服務圖層（第一批 5 層：清潔針具／替代療法與藥癮戒治／愛滋自我篩檢通路／愛滋篩檢與指定醫療／
 * 毒品危害防制中心；第二批 9 層：酒癮治療／PrEP／網路成癮／更生保護／戒菸／反毒藥局／保險套／
 * 治療性社區／酒駕肇事事故）的分類、色票與 Mapbox filter SSOT —— manifest / overlay / legend / popup 四邊共用。
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
  harmReductionAlcohol: "#b45309",
  harmReductionPrep: "#c026d3",
  harmReductionInternetAddiction: "#4f46e5",
  harmReductionAftercare: "#475569",
  harmReductionSmokingCessation: "#65a30d",
  harmReductionAntiDrugPharmacies: "#ea580c",
  harmReductionCondomOutlets: "#0ea5e9",
  harmReductionTherapeuticCommunities: "#15803d",
  harmReductionDuiCrashes: "#dc2626",
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

// ── 愛滋篩檢與指定醫療 ──
export const HIV_TESTING_CATEGORY_OPTIONS = [
  { value: "anonymous_testing", label: "匿名篩檢", color: "#db2777" },
  { value: "designated_hospital", label: "指定醫事機構", color: "#0284c7" },
  { value: "designated_pharmacy", label: "指定藥局", color: "#16a34a" },
  { value: "lgbtq_health_center", label: "多元性別健康中心", color: "#f59e0b" },
] as const;

// ══════════ 第二批（2026-10-06）══════════

// ── 酒癮治療與酒駕酒癮評估機構：一機構可同時具多種身分，任一勾選身分成立即顯示 ──
export const ALCOHOL_SERVICE_OPTIONS = [
  { value: "designated", label: "酒癮治療指定機構", flag: "is_alcohol_designated" },
  { value: "subsidy", label: "酒癮治療費用補助方案", flag: "in_subsidy_program" },
  { value: "dui_assessment", label: "酒駕酒癮評估", flag: "is_dui_assessment" },
] as const;

// ── PrEP 服務醫院：公費／自費可並存 ──
export const PREP_FUNDING_OPTIONS = [
  { value: "public", label: "公費 PrEP", flag: "public_funded" },
  { value: "self_paid", label: "自費 PrEP", flag: "self_paid" },
] as const;

// ── 網路成癮治療資源（service_type 為上游依機構名稱規則分類，非官方分類）──
export const INTERNET_SERVICE_TYPE_OPTIONS = [
  { value: "醫療院所", label: "醫療院所", color: "#4f46e5" },
  { value: "心理諮商所", label: "心理諮商所", color: "#0891b2" },
  { value: "其他", label: "其他（基金會、輔導中心等）", color: "#94a3b8" },
] as const;

// ── 戒菸服務機構 ──
export const SMOKING_FACILITY_OPTIONS = [
  { value: "hospital", label: "醫院", color: "#15803d" },
  { value: "clinic", label: "診所", color: "#65a30d" },
  { value: "pharmacy", label: "藥局", color: "#ca8a04" },
  { value: "health_center", label: "衛生所", color: "#0d9488" },
] as const;

// ── 保險套販售點 ──
export const CONDOM_OUTLET_OPTIONS = [
  { value: "vending_machine", label: "自動販賣機", color: "#0ea5e9" },
  { value: "pharmacy_retail", label: "藥局販售", color: "#2563eb" },
] as const;

// ── 酒駕肇事事故（PMTiles；year_roc 在切片內是字串）──
export const DUI_CLASS_OPTIONS = [
  { value: "A1", label: "A1 類（24 小時內死亡）", color: "#dc2626" },
  { value: "A2", label: "A2 類（受傷或 24 小時後死亡）", color: "#f97316" },
] as const;

export const DUI_YEAR_OPTIONS = [107, 108, 109, 110, 111, 112, 113, 114].map((year) => ({
  value: String(year), label: `${year} 年（${year + 1911}）`,
}));

export const DUI_BASIS_OPTIONS = [
  { value: "primary", label: "事故主要肇因為酒駕" },
  { value: "party_level_only", label: "僅個別當事者肇因為酒駕" },
] as const;

const valuesOf = (options: readonly { value: string }[]) => options.map((option) => option.value);

export const NEEDLE_SERVICE_VALUES = valuesOf(NEEDLE_SERVICE_OPTIONS);
export const TREATMENT_CATEGORY_VALUES = valuesOf(TREATMENT_CATEGORY_OPTIONS);
export const SELFTEST_CHANNEL_VALUES = valuesOf(SELFTEST_CHANNEL_OPTIONS);
export const HIV_TESTING_CATEGORY_VALUES = valuesOf(HIV_TESTING_CATEGORY_OPTIONS);
export const ALCOHOL_SERVICE_VALUES = valuesOf(ALCOHOL_SERVICE_OPTIONS);
export const PREP_FUNDING_VALUES = valuesOf(PREP_FUNDING_OPTIONS);
export const INTERNET_SERVICE_TYPE_VALUES = valuesOf(INTERNET_SERVICE_TYPE_OPTIONS);
export const SMOKING_FACILITY_VALUES = valuesOf(SMOKING_FACILITY_OPTIONS);
export const CONDOM_OUTLET_VALUES = valuesOf(CONDOM_OUTLET_OPTIONS);
export const DUI_CLASS_VALUES = valuesOf(DUI_CLASS_OPTIONS);
export const DUI_YEAR_VALUES = valuesOf(DUI_YEAR_OPTIONS);
export const DUI_BASIS_VALUES = valuesOf(DUI_BASIS_OPTIONS);

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

/** boolean flag 多選：勾選項目「任一」flag 為 true 即顯示；全關回傳恆假 filter。 */
export function flagAnyFilter(
  options: readonly { value: string; flag: string }[],
  mask = allMultiSelectBitmask(options),
): unknown[] {
  const selected = selectedMultiSelectValues(mask, valuesOf(options));
  if (selected.length === 0) return ["==", ["get", "name"], "__multi_select_none__"];
  return ["any", ...options.filter((option) => selected.includes(option.value))
    .map((option) => ["==", ["get", option.flag], true])];
}

export const alcoholServiceFilter = (mask?: number) => flagAnyFilter(ALCOHOL_SERVICE_OPTIONS, mask);
export const prepFundingFilter = (mask?: number) => flagAnyFilter(PREP_FUNDING_OPTIONS, mask);

export function internetServiceTypeFilter(mask = allMultiSelectBitmask(INTERNET_SERVICE_TYPE_VALUES)): unknown[] {
  return multiSelectFilter("service_type", mask, INTERNET_SERVICE_TYPE_VALUES);
}

export function smokingFacilityFilter(mask = allMultiSelectBitmask(SMOKING_FACILITY_VALUES)): unknown[] {
  return multiSelectFilter("facility_type", mask, SMOKING_FACILITY_VALUES);
}

export function condomOutletFilter(mask = allMultiSelectBitmask(CONDOM_OUTLET_VALUES)): unknown[] {
  return multiSelectFilter("outlet_type", mask, CONDOM_OUTLET_VALUES);
}

/** 酒駕事故：類別 × 年份 × 酒駕判定口徑三組多選取交集。 */
export function duiCrashFilter(
  classMask = allMultiSelectBitmask(DUI_CLASS_VALUES),
  yearMask = allMultiSelectBitmask(DUI_YEAR_VALUES),
  basisMask = allMultiSelectBitmask(DUI_BASIS_VALUES),
): unknown[] {
  return ["all",
    multiSelectFilter("accident_class", classMask, DUI_CLASS_VALUES),
    multiSelectFilter("year_roc", yearMask, DUI_YEAR_VALUES),
    multiSelectFilter("dui_cause_basis", basisMask, DUI_BASIS_VALUES),
  ];
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
    case "google_place":
      return "依機構名稱查得位置";
    case "nhi_tgos":
      return "依健保特約機構登記地址定位（TGOS）";
    case "nhi_google":
      return "依健保特約機構登記地址定位（Google）";
    case "source":
      return "座標由資料來源提供";
    default:
      return precision == null ? "" : String(precision);
  }
}

export function isEstimatedPrecision(precision: unknown): boolean {
  return precision === "interpolated" || precision === "google_interpolated"
    || precision === "approximate" || precision === "google_approximate";
}
