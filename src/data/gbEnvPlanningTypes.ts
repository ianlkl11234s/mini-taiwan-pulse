/**
 * 英國第 11 波環境與規劃 6 層（C005 規劃限制區、C031 棕地登記冊、C086 回收點、C087 廢棄物處理許可、
 * C092 污染排放申報（只上蘇格蘭 SEPA）、C090 策略噪音地圖）：類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/base_map/gb_planning_constraints.md`、
 * `industrial_zone/gb_brownfield.md`、`waste_management/gb_recycling_points.md`、`waste_management/gb_waste_permits.md`、
 * `environment/gb_pollution_inventory.md`、`environment/gb_noise.md` 與 `docs/topic-research/united_kingdom_opendata/waves/w11/layer-plan.md`（2026-10-29）。
 *
 * 色票沿用台灣同語意圖層（資料色，spec §3.16），不自訂新色：
 *   規劃限制：保育區＝台灣都市計畫「保護保育」；綠帶＝非都市土地「山坡地保育區」（同屬保護類，淡填色）；
 *     Article 4 指令區台灣沒有同類，借都市計畫「公共設施」色（借色，待確認）。
 *   棕地：棕地登記冊是「適合住宅開發的已開發土地」名冊，借都市計畫「住宅」色（借色，待確認）；
 *     許可狀態比照英國公有地標售（#754）同色、填色強度分級，不另造狀態色（K-3）。
 *   回收中心＝台灣 wfRecycling（處理設施 › 回收廠）；回收桶・回收點＝台灣 wdRecyclingContainer（投放點）。
 *   廢棄物許可＝台灣 WASTE_FACILITY_COLORS.transfer_station（英國許可場址以轉運／處理為主；借色，待確認）；
 *     主管機關只用篩選區分（設計規範沒有機關色語意）。
 *   污染排放＝台灣 pollutionFacility（環境污染 › 申報工廠）；有申報排放實心、申報皆無空心（資料編碼描邊 P-9）。
 *   噪音 Lden 5 帶＝台灣 NoiseCapture 噪音格網的 dB 色階（NOISE_CAPTURE_COLOR_EXPR），取各帶中點 dB 的色。
 */
import { URBAN_ZONING_CATEGORIES } from "./urbanZoningTypes";
import { NON_URBAN_ZONING_CODES } from "./nonUrbanZoningTypes";
import { WASTE_FACILITY_COLORS } from "./wasteFacilityColors";
import { NOISE_CAPTURE_COLOR_EXPR } from "./noiseTypes";
import { FACILITY_STATUS_PAINT_COLORS } from "../map/layerPaintColors";
import { resampleRamp } from "../map/palettes";

export const GB_ENV_FETCHED_AT = "2026-10-29";
export const GB_ENV_OGL_V3 = "Open Government Licence v3.0";
export const GB_ENV_ODBL = "ODbL 1.0";
/** 未載明／其他（中性灰，同台灣設施狀態 fallback）。 */
export const GB_ENV_FALLBACK_COLOR = FACILITY_STATUS_PAINT_COLORS.fallback;
export const GB_ENV_HOLLOW_STROKE = 1.5;

const urbanColor = (value: string) => URBAN_ZONING_CATEGORIES.find((c) => c.value === value)!.color;
const nonUrbanColor = (code: string) => NON_URBAN_ZONING_CODES.find((c) => c.code === code)!.color;

// ─────────────────────────── C005 規劃限制區 gbPlanningConstraints ───────────────────────────

export const GB_PLANNING_ATTRIBUTION = "England: © Historic England 2026; © Crown copyright and database right 2026; Contains Ordnance Survey data © Crown copyright and database right 2026 (Planning Data, Open Government Licence v3.0) · Scotland: Contains Historic Environment Scotland and Ordnance Survey data © Historic Environment Scotland - Scottish Charity No. SC045925 © Crown copyright and database right 2026 · Wales: DataMapWales (Open Government Licence)";
export const GB_PLANNING_SOURCES = {
  planning_data: { org: "Planning Data (MHCLG) — © Historic England 2026; © Crown copyright and database right 2026; Contains Ordnance Survey data © Crown copyright and database right 2026", url: "https://www.planning.data.gov.uk/dataset/conservation-area" },
  hes: { org: "Contains Historic Environment Scotland and Ordnance Survey data © Historic Environment Scotland - Scottish Charity No. SC045925 © Crown copyright and database right 2026", url: "https://inspire.hes.scot/AtomService/DATA/ca_scotland.zip" },
  datamapwales: { org: "Welsh Government — DataMapWales conservation_areas_wales", url: "https://datamap.gov.wales/layers/geonode:conservation_areas_wales" },
} as const;
export const GB_PLANNING_SOURCE_URLS = {
  conservation_area: "https://www.planning.data.gov.uk/dataset/conservation-area",
  article_4: "https://www.planning.data.gov.uk/dataset/article-4-direction-area",
  green_belt: "https://www.planning.data.gov.uk/dataset/green-belt",
} as const;
export const GB_PLANNING_TILE_ZOOM = { minzoom: 4, maxzoom: 13 } as const;
export const GB_PLANNING_MINZOOM = 8;

export type GbPlanningConstraint = "conservation_area" | "article_4" | "green_belt";
/** 宣告順序＝圖例與選單順序；fill＝填色強度倍率（綠帶面大，淡填色只當範圍提示）。counts＝2026-10-29 成品筆數。 */
export const GB_PLANNING_CONSTRAINTS: readonly { value: GbPlanningConstraint; color: string; fill: number; count: number }[] = [
  { value: "conservation_area", color: urbanColor("conservation"), fill: 1, count: 11_002 },
  { value: "article_4", color: urbanColor("public_facility"), fill: 1, count: 7_544 },
  { value: "green_belt", color: nonUrbanColor("AF"), fill: 0.4, count: 181 },
];
export const GB_PLANNING_COLOR = GB_PLANNING_CONSTRAINTS[0]!.color;
/** 保育區各地筆數（Article 4、綠帶只有英格蘭）。 */
export const GB_CONSERVATION_BY_NATION = { England: 9_801, Scotland: 670, Wales: 531 } as const;
/** 「類別」選單：0 保育區（預設）、1 Article 4、2 綠帶、3 全部。 */
export const GB_PLANNING_VIEWS: readonly (GbPlanningConstraint | "all")[] = ["conservation_area", "article_4", "green_belt", "all"];
export function gbPlanningView(idx: number): GbPlanningConstraint | "all" {
  return GB_PLANNING_VIEWS[Math.trunc(idx)] ?? "conservation_area";
}
export function gbPlanningConstraint(value: unknown) {
  return GB_PLANNING_CONSTRAINTS.find((c) => c.value === value);
}

// ─────────────────────────── C031 棕地登記冊 gbBrownfield ───────────────────────────

export const GB_BROWNFIELD_ATTRIBUTION = "© Crown copyright and database right 2026 (Planning Data brownfield-land, Open Government Licence v3.0)";
export const GB_BROWNFIELD_URL = "https://www.planning.data.gov.uk/dataset/brownfield-land";
export const GB_BROWNFIELD_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const GB_BROWNFIELD_MINZOOM = 9;
export const GB_BROWNFIELD_COLOR = urbanColor("residential");
export const GB_BROWNFIELD_COUNT = 30_303;

export type GbBrownfieldStatus = "permissioned" | "pending" | "not_permissioned" | "completed" | "other";
/**
 * 宣告順序＝圖例與選單順序。同色、填色強度依許可進度（比照公有地標售）：
 * 已許可實心 → 審議中半實心 → 未許可同色空心；已完成、其他、未載明為灰色空心（不畫成未許可）。
 * counts＝2026-10-29 成品筆數（other 含 null 1,050 筆）。
 */
export const GB_BROWNFIELD_STATUSES: readonly { value: GbBrownfieldStatus; fill: number; hollow: boolean; neutral: boolean; count: number }[] = [
  { value: "permissioned", fill: 1, hollow: false, neutral: false, count: 18_397 },
  { value: "pending", fill: 0.55, hollow: false, neutral: false, count: 841 },
  { value: "not_permissioned", fill: 0.15, hollow: true, neutral: false, count: 9_655 },
  { value: "completed", fill: 0, hollow: true, neutral: true, count: 157 },
  { value: "other", fill: 0, hollow: true, neutral: true, count: 203 + 1_050 },
];
/** 「許可狀態」選單：0 全部，1..5 依 GB_BROWNFIELD_STATUSES 順序。 */
export const GB_BROWNFIELD_VIEWS: readonly (GbBrownfieldStatus | "all")[] = ["all", ...GB_BROWNFIELD_STATUSES.map((s) => s.value)];
export function gbBrownfieldView(idx: number): GbBrownfieldStatus | "all" {
  return GB_BROWNFIELD_VIEWS[Math.trunc(idx)] ?? "all";
}
/** permission_status 原值 → 圖例類別（null／其他字串歸 other）。 */
export function gbBrownfieldStatus(value: unknown) {
  const v = typeof value === "string" ? value : "other";
  return GB_BROWNFIELD_STATUSES.find((s) => s.value === v) ?? GB_BROWNFIELD_STATUSES[4]!;
}
export type GbBrownfieldOwnership = "public" | "not_public" | "mixed" | "unknown";
export const GB_BROWNFIELD_OWNERSHIP: readonly GbBrownfieldOwnership[] = ["public", "not_public", "mixed", "unknown"];

// ─────────────────────────── C086 回收點 gbRecyclingCentres ───────────────────────────

export const GB_RECYCLING_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
export const GB_RECYCLING_URL = "https://www.openstreetmap.org/copyright";
export const GB_RECYCLING_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
/** 回收中心（量少）z7 起、回收桶 z9 起。 */
export const GB_RECYCLING_CENTRE_MINZOOM = 7;
export const GB_RECYCLING_CONTAINER_MINZOOM = 9;
export const GB_RECYCLING_OSM_TIME = "2026-10-29T06:20Z";
export type GbRecyclingKind = "centre" | "container";
export const GB_RECYCLING_KINDS: readonly { value: GbRecyclingKind; color: string; count: number }[] = [
  { value: "centre", color: WASTE_FACILITY_COLORS.recycling_plant!, count: 1_547 },
  { value: "container", color: "#84cc16", count: 11_412 },
];
export const GB_RECYCLING_COLOR = GB_RECYCLING_KINDS[0]!.color;
export const GB_RECYCLING_BY_NATION = { England: 9_702, Scotland: 2_271, Wales: 700, "Northern Ireland": 286 } as const;
export function gbRecyclingKind(value: unknown) {
  return GB_RECYCLING_KINDS.find((k) => k.value === value);
}

// ─────────────────────────── C087 廢棄物處理許可 gbWastePermits ───────────────────────────

export const GB_WASTE_PERMITS_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const GB_WASTE_PERMITS_MINZOOM = 8;
export const GB_WASTE_PERMITS_COLOR = WASTE_FACILITY_COLORS.transfer_station!;
export type GbWasteAuthority = "Environment Agency" | "SEPA" | "NIEA";
export const GB_WASTE_AUTHORITIES: readonly {
  value: GbWasteAuthority; count: number; attribution: string; url: string; license: string;
}[] = [
  {
    value: "Environment Agency", count: 7_040,
    attribution: "Contains Environment Agency information © Environment Agency and/or database right",
    url: "https://www.data.gov.uk/dataset/environmental-permitting-regulations-waste-sites1",
    license: "Environment Agency Conditional Licence",
  },
  {
    value: "SEPA", count: 935,
    attribution: "© Scottish Environment Protection Agency",
    url: "https://map.sepa.org.uk/server/rest/services/Open/Utility_and_Governmental_Services/MapServer/416",
    license: "Open Government Licence",
  },
  {
    value: "NIEA", count: 736,
    attribution: "Contains public sector information licensed under the Open Government Licence v3.0 (DAERA / NIEA)",
    url: "https://www.opendatani.gov.uk/dataset/authorised-waste-sites-treatment-storage",
    license: GB_ENV_OGL_V3,
  },
];
export const GB_WASTE_PERMITS_ATTRIBUTION = GB_WASTE_AUTHORITIES.map((a) => a.attribution).join(" · ");
/** 「主管機關」選單：0 全部，1..3 依 GB_WASTE_AUTHORITIES 順序。 */
export const GB_WASTE_AUTHORITY_VIEWS: readonly (GbWasteAuthority | "all")[] = ["all", ...GB_WASTE_AUTHORITIES.map((a) => a.value)];
export function gbWasteAuthorityView(idx: number): GbWasteAuthority | "all" {
  return GB_WASTE_AUTHORITY_VIEWS[Math.trunc(idx)] ?? "all";
}
export function gbWasteAuthority(value: unknown) {
  return GB_WASTE_AUTHORITIES.find((a) => a.value === value);
}
/** SEPA 發證日 1970-01-01 是上游佔位值，視為未載明。 */
export const GB_WASTE_ISSUED_PLACEHOLDER = "1970-01-01";
export const GB_NIEA_SNAPSHOT = "2021-02";

// ─────────────────────────── C092 污染排放申報（只上蘇格蘭 SEPA）gbPollutionInventory ───────────────────────────

export const GB_POLLUTION_ATTRIBUTION = "© Scottish Environment Protection Agency (SPRI, Open Government Licence)";
export const GB_POLLUTION_URL = "http://map.sepa.org.uk/atom/SEPA_SPRI_Air_Releases.atom";
export const GB_POLLUTION_LICENSE = "Open Government Licence";
export const GB_POLLUTION_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const GB_POLLUTION_MINZOOM = 7;
export const GB_POLLUTION_COLOR = "#f97316";
export const GB_POLLUTION_YEAR = 2017;
/** SEPA SPRI 1,450 場址：任一途徑（空氣／水體）申報有排放 905、已申報途徑皆無排放 545。 */
export const GB_POLLUTION_COUNTS = { total: 1_450, released: 905, none: 545 } as const;

// ─────────────────────────── C090 策略噪音地圖 gbNoise ───────────────────────────

export const GB_NOISE_ATTRIBUTION = "© Department for Environment, Food & Rural Affairs copyright and/or database right 2023 (Strategic Noise Mapping Round 4, Open Government Licence) · © Scottish Government, contains Ordnance Survey data © Crown copyright and database right 2024 (Open Government Licence) · Welsh Government DataMapWales (Open Government Licence)";
export const GB_NOISE_SOURCES = {
  defra_round4_wcs_50m: { org: "© Department for Environment, Food & Rural Affairs copyright and/or database right 2023", url: "https://environment.data.gov.uk/dataset/562c9d56-7c2d-4d42-83bb-578d6e97a517" },
  scotland_round4_50m: { org: "© Scottish Government, contains Ordnance Survey data © Crown copyright and database right 2024", url: "https://map.sepa.org.uk/atom/noise/Noise_Road_LDEN_Major.zip" },
  datamapwales_mrd_lden_2017: { org: "Welsh Government — DataMapWales mrd_lden_2017", url: "https://datamap.gov.wales/layers/inspire-wg:mrd_lden_2017" },
} as const;
export const GB_NOISE_TILE_ZOOM = { minzoom: 5, maxzoom: 12 } as const;
export const GB_NOISE_MINZOOM = 9;
export type GbNoiseSource = "road" | "rail";
export const GB_NOISE_SOURCE_VIEWS: readonly GbNoiseSource[] = ["road", "rail"];
export const GB_NOISE_SOURCE_COUNTS: Readonly<Record<GbNoiseSource, number>> = { road: 119_914, rail: 21_652 };
export function gbNoiseSourceView(idx: number): GbNoiseSource {
  return GB_NOISE_SOURCE_VIEWS[Math.trunc(idx)] ?? "road";
}

/** 台灣 NoiseCapture dB 色階（45–85 dB 每 10 dB 一停點）重取樣到每 2.5 dB，取各 Lden 帶中點 dB 的色。 */
const NOISE_RAMP = (NOISE_CAPTURE_COLOR_EXPR.slice(3) as unknown[]).filter((_, i) => i % 2 === 1) as string[];
const NOISE_RAMP_MIN_DB = Number(NOISE_CAPTURE_COLOR_EXPR[3]);
const NOISE_RAMP_STEP = 2.5;
const NOISE_FINE = resampleRamp(NOISE_RAMP, (NOISE_RAMP.length - 1) * (10 / NOISE_RAMP_STEP) + 1);
const noiseColorAt = (db: number) => NOISE_FINE[Math.round((db - NOISE_RAMP_MIN_DB) / NOISE_RAMP_STEP)]!;
/** band_min_db 五帶（Lden dB(A)）：label 為圖例文字。 */
export const GB_NOISE_BANDS: readonly { min: number; label: string; color: string }[] = [
  { min: 55, label: "55–59.9", color: noiseColorAt(57.5) },
  { min: 60, label: "60–64.9", color: noiseColorAt(62.5) },
  { min: 65, label: "65–69.9", color: noiseColorAt(67.5) },
  { min: 70, label: "70–74.9", color: noiseColorAt(72.5) },
  { min: 75, label: "≥75", color: noiseColorAt(77.5) },
];
export const GB_NOISE_COLOR = GB_NOISE_BANDS[2]!.color;
export function gbNoiseBand(value: unknown) {
  const v = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(v)) return undefined;
  return GB_NOISE_BANDS.find((b) => b.min === v);
}
