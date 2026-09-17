import {
  COMPANY_DENSITY_COLORS, COMPANY_DENSITY_STOPS, COMPANY_GRID_NULL_COLOR,
  companyGridAreaKm2, COMPANY_INDUSTRY_MID_OPTIONS, type CompanyGridScale,
} from "./businessRegistryTypes";

export const COMPANY_DEMOGRAPHICS_SCALES = [
  {
    value: "450", label: "450 m", shortLabel: "450m",
    sourceId: "business-registry-company-demographics-grid-450",
    sourceUrl: "./business_registry/company_demographics_grid_450m_202608.pmtiles",
    sourceLayer: "company_demographics_grid", minzoom: 4, maxzoom: 13,
    areaScale: { value: "1" } as CompanyGridScale,
  },
  {
    value: "1500", label: "1.5 km", shortLabel: "1.5km",
    sourceId: "business-registry-company-demographics-grid-1500",
    sourceUrl: "./business_registry/company_demographics_grid_1500m_202608.pmtiles",
    sourceLayer: "company_demographics_grid", minzoom: 4, maxzoom: 12,
    areaScale: { value: "2" } as CompanyGridScale,
  },
] as const;

export const COMPANY_INDUSTRY_GROUPS = [
  { value: "primaryUtilities", label: "農林漁牧、資源與公用", color: "#2a9d8f", codes: validCodes(1, 6).concat(validCodes(35, 39)) },
  { value: "manufacturing", label: "製造業", color: "#e76f51", codes: rangeCodes(8, 34) },
  { value: "constructionRealEstate", label: "營建與不動產", color: "#f4a261", codes: validCodes(41, 43).concat(validCodes(67, 68)) },
  { value: "wholesaleRetail", label: "批發零售", color: "#457b9d", codes: rangeCodes(45, 48) },
  { value: "transport", label: "運輸倉儲", color: "#22d3ee", codes: rangeCodes(49, 54) },
  { value: "accommodationFood", label: "住宿餐飲", color: "#e9c46a", codes: rangeCodes(55, 56) },
  { value: "information", label: "資訊通訊媒體", color: "#b78af7", codes: rangeCodes(58, 63) },
  { value: "finance", label: "金融保險", color: "#3a86ff", codes: rangeCodes(64, 66) },
  { value: "professional", label: "專業與支援服務", color: "#d62878", codes: rangeCodes(69, 82) },
  { value: "publicOther", label: "教育照顧休閒與其他", color: "#6a994e", codes: validCodes(83, 96) },
  { value: "unknown", label: "行業中類缺失／未對應", color: "#94a3b8", codes: [] },
] as const;

/** 多選主導類別同量與必要欄位缺失分開呈現；真實零筆由透明色表示。 */
export const COMPANY_INDUSTRY_TIE_COLOR = "#e5e7eb";
export const COMPANY_INDUSTRY_MISSING_COLOR = "#475569";
export const COMPANY_INDUSTRY_ZERO_COLOR = "rgba(0,0,0,0)";

function rangeCodes(start: number, end: number): string[] {
  return validCodes(start, end);
}

function validCodes(start: number, end: number): string[] {
  const valid = new Set<string>(COMPANY_INDUSTRY_MID_OPTIONS.map((option) => option.value));
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index).padStart(2, "0"))
    .filter((code) => valid.has(code));
}

const GROUP_BY_VALUE = new Map(COMPANY_INDUSTRY_GROUPS.map((group) => [group.value, group]));

export function companyIndustryFields(mask: number, midCode?: string): string[] {
  if (midCode) return [`i_${midCode}`];
  const fields: string[] = [];
  COMPANY_INDUSTRY_GROUPS.forEach((group, index) => {
    if ((mask & (1 << index)) === 0) return;
    if (group.value === "unknown") fields.push("i_unknown");
    else fields.push(...(GROUP_BY_VALUE.get(group.value)?.codes.map((code) => `i_${code}`) ?? []));
  });
  return fields;
}

export function companyIndustryGroupLabels(mask: number): string[] {
  return COMPANY_INDUSTRY_GROUPS.filter((_, index) => (mask & (1 << index)) !== 0).map((group) => group.label);
}

export function companyIndustryGroupIndexForMid(midCode: string): number | undefined {
  const index = COMPANY_INDUSTRY_GROUPS.findIndex((group) => (group.codes as readonly string[]).includes(midCode));
  return index >= 0 ? index : undefined;
}

function companyIndustryGroupSumExpr(index: number): unknown[] {
  const group = COMPANY_INDUSTRY_GROUPS[index];
  if (!group) return ["literal", -1];
  return companyDemographicsSumExpr(group.value === "unknown"
    ? ["i_unknown"]
    : group.codes.map((code) => `i_${code}`));
}

/**
 * 已選群組中「筆數最多」者的固定色，不以色深暗示筆數。
 * 同量、缺欄位與真實 0 各走獨立分支，避免把 unknown / 0 誤畫成某一產業。
 */
export function companyIndustryDominantColorExpr(mask: number, midCode?: string): unknown[] {
  if (midCode) {
    const groupIndex = companyIndustryGroupIndexForMid(midCode);
    const color = groupIndex === undefined ? COMPANY_INDUSTRY_MISSING_COLOR : COMPANY_INDUSTRY_GROUPS[groupIndex]!.color;
    return ["let", "value", companyDemographicsSumExpr([`i_${midCode}`]), ["case",
      ["<", ["var", "value"], 0], COMPANY_INDUSTRY_MISSING_COLOR,
      ["==", ["var", "value"], 0], COMPANY_INDUSTRY_ZERO_COLOR,
      color,
    ]];
  }

  const selected = COMPANY_INDUSTRY_GROUPS.map((_, index) => index).filter((index) => (mask & (1 << index)) !== 0);
  if (selected.length === 0) return ["literal", COMPANY_INDUSTRY_ZERO_COLOR];
  const bindings: unknown[] = selected.flatMap((index) => [`g${index}`, companyIndustryGroupSumExpr(index)]);
  const vars = selected.map((index) => ["var", `g${index}`]);
  const total: unknown[] = vars.length === 1 ? vars[0]! : ["+", ...vars];
  const maximum: unknown[] = vars.length === 1 ? vars[0]! : ["max", ...vars];
  const ties: unknown[] = selected.length === 1 ? ["literal", 1] : ["+", ...vars.map((value) => ["case", ["==", value, ["var", "maximum"]], 1, 0])];
  // Mapbox 的同一層 let binding 彼此不可引用；total / maximum / ties 必須巢狀綁定。
  return ["let", ...bindings, ["let", "total", total, ["let", "maximum", maximum, ["let", "ties", ties, ["case",
    ["any", ...vars.map((value) => ["<", value, 0])], COMPANY_INDUSTRY_MISSING_COLOR,
    ["==", ["var", "total"], 0], COMPANY_INDUSTRY_ZERO_COLOR,
    [">", ["var", "ties"], 1], COMPANY_INDUSTRY_TIE_COLOR,
    ...selected.flatMap((index) => [["==", ["var", `g${index}`], ["var", "maximum"]], COMPANY_INDUSTRY_GROUPS[index]!.color]),
    COMPANY_INDUSTRY_MISSING_COLOR,
  ]]]]];
}

function numericField(field: string): unknown[] {
  return ["==", ["typeof", ["get", field]], "number"];
}

/** 任一選取欄位缺失即回負 sentinel；真實 0 仍可參與加總，絕不 coalesce 成 0。 */
export function companyDemographicsSumExpr(fields: readonly string[]): unknown[] {
  if (fields.length === 0) return ["literal", -1];
  const values = fields.map((field) => ["get", field]);
  const sum = values.length === 1 ? values[0]! : ["+", ...values];
  return ["case", ["all", ...fields.map(numericField)], sum, -1];
}

export function companyDemographicsDensityColorExpr(value: unknown[], scale: (typeof COMPANY_DEMOGRAPHICS_SCALES)[number]): unknown[] {
  const density: unknown[] = ["/", value, companyGridAreaKm2(scale.areaScale)];
  const step: unknown[] = ["step", density, COMPANY_DENSITY_COLORS[0]];
  for (let index = 1; index < COMPANY_DENSITY_STOPS.length; index++) step.push(COMPANY_DENSITY_STOPS[index], COMPANY_DENSITY_COLORS[index]);
  return ["case", [">=", value, 0], step, COMPANY_GRID_NULL_COLOR];
}

export const COMPANY_AGE_BINS = [
  ["age_0_2", "0–2 年"], ["age_3_5", "3–5 年"], ["age_6_10", "6–10 年"],
  ["age_11_20", "11–20 年"], ["age_21_plus", "21 年以上"],
] as const;

export function companyAgeValueExpr(modeIdx: number): unknown[] {
  if (modeIdx === 1) return ["case", numericField("age_median"), ["get", "age_median"], -1];
  return ["case", ["all", numericField("age_recent"), numericField("age_known"), [">", ["get", "age_known"], 0]], ["/", ["get", "age_recent"], ["get", "age_known"]], -1];
}

export const COMPANY_AGE_RECENT_STOPS = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7] as const;
export const COMPANY_AGE_MEDIAN_STOPS = [0, 2, 5, 10, 20, 35, 55] as const;
export const COMPANY_AGE_COLORS = ["#fef3c7", "#fde68a", "#fbbf24", "#f97316", "#ea580c", "#c2410c", "#7c2d12"] as const;

export function companyAgeColorExpr(modeIdx: number): unknown[] {
  const value = companyAgeValueExpr(modeIdx);
  const stops = modeIdx === 1 ? COMPANY_AGE_MEDIAN_STOPS : COMPANY_AGE_RECENT_STOPS;
  const step: unknown[] = ["step", value, COMPANY_AGE_COLORS[0]];
  for (let index = 1; index < stops.length; index++) step.push(stops[index], COMPANY_AGE_COLORS[index]);
  return ["case", [">=", value, 0], step, COMPANY_GRID_NULL_COLOR];
}
