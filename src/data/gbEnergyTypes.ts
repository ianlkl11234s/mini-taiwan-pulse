/**
 * 英國第 6 波能源 6 層（C079 電廠 DUKES、C081 再生能源 REPD、C080 電網 OSM（線＋變電所）、C082 加油站 OSM、
 * C083 離岸油氣田 NSTA）：類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/energy/gb_*.md`
 * 與 `docs/topic-research/united_kingdom_opendata/waves/w6/layer-plan.md`（2026-10-29 逐一重讀授權頁）。
 *
 * 色票沿用台灣能源主題同語意（資料色，spec §3.16）：
 *   燃料別＝`FUEL_COLORS`（energyLoader，台灣電廠燃料色）；抽蓄借用其「儲能 storage」色。
 *   電壓分級＝台灣 osmPowerLines 345／161／69 kV／未標電壓 4 色；英國 275–400／132／33–66 kV 依序對應，
 *     <33kV 比照台灣「配電線」：同 33–66 色、細線、淡化。
 *   施工中＝台灣規劃中設施 `FACILITY_STATUS_PAINT_COLORS.construction` 描邊（P-9 資料編碼描邊）。
 *   加油站＝台灣 gasStationCanonical；油田＝燃油 oil、氣田＝天然氣 natural_gas、凝結油田＝LNG 接收站色（液態天然氣）。
 */
import { FACILITY_STATUS_PAINT_COLORS, FOSSIL_PAINT_COLORS } from "../map/layerPaintColors";
import { FUEL_COLORS, FUEL_FALLBACK_COLOR } from "./energyLoader";

export const GB_ENERGY_FETCHED_AT = "2026-10-29";
export const GB_ENERGY_OGL_V3 = "Open Government Licence v3.0";
export const GB_ENERGY_ODBL = "ODbL 1.0";
export const GB_ENERGY_FALLBACK_COLOR = FUEL_FALLBACK_COLOR;

const fuel = (key: string) => FUEL_COLORS[key] ?? FUEL_FALLBACK_COLOR;

/** 來源字串常見的空值寫法（上游 CSV 轉出時留下的字面值）一律視為缺值。 */
export function gbEnergyText(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return /^(none|nan|nat|null|\?)$/i.test(s) ? "" : s;
}

// ─────────────────────────── C079 電廠 gbPowerPlants ───────────────────────────

export const GB_POWER_PLANTS_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0: DUKES 2026 Table 5.11 Power stations in the United Kingdom, May 2026 (DESNZ)";
export const GB_POWER_PLANTS_URL = "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes";
export type GbFuelGroup = "gas" | "nuclear" | "oil" | "bioenergy" | "hydro" | "pumped_hydro" | "wind_onshore" | "wind_offshore" | "solar";
/** 宣告順序＝圖例順序；count＝DUKES 5.11（2026-05）座數。 */
export const GB_FUEL_GROUPS: readonly { value: GbFuelGroup; color: string; count: number }[] = [
  { value: "gas", color: fuel("natural_gas"), count: 52 },
  { value: "nuclear", color: fuel("nuclear"), count: 5 },
  { value: "oil", color: fuel("oil"), count: 17 },
  { value: "bioenergy", color: fuel("bioenergy"), count: 20 },
  { value: "hydro", color: fuel("hydro"), count: 125 },
  { value: "pumped_hydro", color: fuel("storage"), count: 4 },
  { value: "wind_onshore", color: fuel("wind"), count: 444 },
  { value: "wind_offshore", color: fuel("offshore_wind"), count: 52 },
  { value: "solar", color: fuel("solar"), count: 645 },
];
export const GB_POWER_PLANTS_COLOR = fuel("natural_gas");
/** 裝置容量分級（MW）：layer-plan 建議 <10／10–100／100–1,000／≥1,000；半徑沿用台灣電廠 `CAPACITY_RADIUS`。 */
export const GB_CAPACITY_BANDS: readonly { min: number; radius: number; label: string }[] = [
  { min: 0, radius: 3, label: "<10" },
  { min: 10, radius: 4.5, label: "10–100" },
  { min: 100, radius: 7, label: "100–1,000" },
  { min: 1000, radius: 11, label: "≥1,000" },
];

export function gbFuelGroup(value: unknown) {
  return GB_FUEL_GROUPS.find((g) => g.value === value);
}

// ─────────────────────────── C081 再生能源 gbRenewables ───────────────────────────

export const GB_RENEWABLES_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0: Renewable Energy Planning Database (DESNZ), July 2026";
export const GB_RENEWABLES_URL = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract";
export type GbTechGroup = "solar" | "wind_onshore" | "storage" | "bioenergy" | "hydro" | "wind_offshore" | "geothermal" | "other";
/**
 * `tech_group` 10 值；台灣沒有氫能、海洋能的色，這兩類併入「其他」色（圖例同一列寫明）。
 * 宣告順序＝圖例順序。
 */
export const GB_TECH_GROUPS: readonly { value: GbTechGroup; color: string; raw: readonly string[] }[] = [
  { value: "solar", color: fuel("solar"), raw: ["solar"] },
  { value: "wind_onshore", color: fuel("wind"), raw: ["wind_onshore"] },
  { value: "wind_offshore", color: fuel("offshore_wind"), raw: ["wind_offshore"] },
  { value: "storage", color: fuel("storage"), raw: ["storage"] },
  { value: "bioenergy", color: fuel("bioenergy"), raw: ["bioenergy"] },
  { value: "hydro", color: fuel("hydro"), raw: ["hydro"] },
  { value: "geothermal", color: fuel("geothermal"), raw: ["geothermal"] },
  { value: "other", color: fuel("other"), raw: ["hydrogen", "marine", "other"] },
];
export const GB_RENEWABLES_COLOR = fuel("solar");
export function gbTechGroup(value: unknown) {
  return GB_TECH_GROUPS.find((g) => g.raw.includes(String(value)));
}

export type GbStatusGroup = "operational" | "construction" | "consented" | "in_planning" | "not_proceeding" | "decommissioned";
/**
 * 「審查階段」選項＝互斥的檢視（預設只看運轉中＋施工中，其餘階段各自一個選項）。
 * 設計規範沒有「審查階段」的顏色語意，所以階段只用篩選區分；唯一的視覺編碼是施工中描邊（沿用台灣規劃中設施）。
 */
export const GB_STATUS_VIEWS: readonly { value: string; groups: readonly GbStatusGroup[] }[] = [
  { value: "built", groups: ["operational", "construction"] },
  { value: "consented", groups: ["consented"] },
  { value: "in_planning", groups: ["in_planning"] },
  { value: "not_proceeding", groups: ["not_proceeding"] },
  { value: "decommissioned", groups: ["decommissioned"] },
];
export const GB_STATUS_COUNTS: Readonly<Record<GbStatusGroup, number>> = {
  operational: 3130, construction: 454, consented: 5948, in_planning: 2349, not_proceeding: 2700, decommissioned: 32,
};
export const GB_CONSTRUCTION_STROKE = FACILITY_STATUS_PAINT_COLORS.construction;
export function gbStatusView(idx: number) {
  return GB_STATUS_VIEWS[idx] ?? GB_STATUS_VIEWS[0]!;
}

// ─────────────────────────── C080 電網 gbPowerLines／gbSubstations ───────────────────────────

export const GB_OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const GB_OSM_URL = "https://www.openstreetmap.org/copyright";
export type GbVoltageClass = "transmission_275_400" | "hv_132" | "sub_transmission_33_66" | "distribution_lt33" | "unknown";
/**
 * 沿用台灣 osmPowerLines 電壓色（345 #1AB6D9／161 #62D9AD／69 #468BA6／未標 #DFE0DC）；
 * width＝線寬倍率（台灣 345 kV 3、161 kV 1.8、69 kV 1.2、未標 1），radius＝變電所半徑。
 */
export const GB_VOLTAGE_CLASSES: readonly { value: GbVoltageClass; color: string; width: number; opacity: number; radius: number }[] = [
  { value: "transmission_275_400", color: "#1AB6D9", width: 3, opacity: 1, radius: 6.5 },
  { value: "hv_132", color: "#62D9AD", width: 1.8, opacity: 1, radius: 4.5 },
  { value: "sub_transmission_33_66", color: "#468BA6", width: 1.2, opacity: 1, radius: 3 },
  // 比照台灣「配電線」：同色、更細、淡化
  { value: "distribution_lt33", color: "#468BA6", width: 0.6, opacity: 0.55, radius: 2 },
  { value: "unknown", color: "#DFE0DC", width: 0.8, opacity: 0.7, radius: 2 },
];
export const GB_POWER_LINES_COLOR = "#62D9AD";
export const GB_SUBSTATIONS_COLOR = "#1AB6D9";
/** 低縮放只收 ≥132kV（資料切片設定）：線 z4–8、變電所 z4–9。 */
export const GB_LINES_FULL_ZOOM = 9;
export const GB_SUBSTATIONS_FULL_ZOOM = 10;
export function gbVoltageClass(value: unknown) {
  return GB_VOLTAGE_CLASSES.find((v) => v.value === value);
}

// ─────────────────────────── C082 加油站 gbFuelStations ───────────────────────────

export const GB_FUEL_STATION_COLOR = FOSSIL_PAINT_COLORS.gasStationCanonical;
/** `fuel_*` 只有值為 "yes" 才列出（"no"、數字、null 都不列）；全部沒標時顯示「OSM 未標油品」。 */
export const GB_FUEL_TYPES = [
  "fuel_diesel", "fuel_octane_95", "fuel_octane_98", "fuel_e10", "fuel_lpg", "fuel_hgv_diesel", "fuel_adblue", "fuel_cng", "fuel_hydrogen",
] as const;
export type GbFuelType = (typeof GB_FUEL_TYPES)[number];

// ─────────────────────────── C083 離岸油氣田 gbOilGasFields ───────────────────────────

/** NSTA User Agreement 指定原句（不可改寫）。 */
export const GB_NSTA_ATTRIBUTION = "Contains information provided by the North Sea Transition Authority and/or other third parties.";
export const GB_NSTA_LICENSE = "NSTA Open User Licence";
export const GB_NSTA_URL = "https://open-data-ukcs-transition.hub.arcgis.com/datasets/ba711a4be08449329a871d37ae910735_0";
export type GbFieldType = "OIL" | "GAS" | "COND";
export const GB_FIELD_TYPES: readonly { value: GbFieldType; color: string; count: number }[] = [
  { value: "OIL", color: fuel("oil"), count: 252 },
  { value: "GAS", color: fuel("natural_gas"), count: 183 },
  { value: "COND", color: FOSSIL_PAINT_COLORS.lngTerminal, count: 43 },
];
export const GB_OIL_GAS_COLOR = fuel("oil");
/** 生產中的油氣田填色較深，其他狀態（停產、除役後、擱置等）淡化。 */
export const GB_FIELD_PRODUCING = "PRODUCING";
export const GB_FIELD_INACTIVE_FACTOR = 0.4;
/** NSTA `discovery_date` 有 6 筆 1970-01-01（epoch 0 佔位），視為缺值。 */
export function gbFieldYear(value: unknown): string {
  const s = gbEnergyText(value);
  if (!s || s.startsWith("1970-01-01")) return "";
  return s.slice(0, 4);
}
