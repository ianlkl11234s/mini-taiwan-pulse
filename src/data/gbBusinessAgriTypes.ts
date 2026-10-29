/**
 * 英國第 12 波 5 層（C029 公司登記 gbCompanies、C030 製造業 gbManufacturing、C051 殯葬設施 gbFuneral、
 * C106 養殖場 gbAquaculture、C108 土壤母質 gbSoilParentMaterial）：類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/business_registry/gb_companies.md`、`funeral/gb_funeral.md`、
 * `fishery/gb_aquaculture.md`、`agriculture/gb_soil_parent_material.md` 與 `docs/topic-research/united_kingdom_opendata/waves/w12/layer-plan.md`（2026-10-29）。
 *
 * 色票沿用台灣同語意圖層（資料色，spec §3.16），不自訂新色：
 *   公司登記＝台灣 companyPoints；製造業＝台灣 manufacturingCompanyPoints（單色，依家數分 5 級半徑，比照英國站客流 P-8）。
 *   火葬場＝台灣殯葬設施「火化場」類別色；葬儀社＝台灣 funeralOperators（禮儀業者）。
 *   養殖：魚類（多為海上箱網）＝台灣 aquacultureCageNet；放養釣魚場（淡水池）＝台灣 aquaculturePonds（魚塭）；
 *     北愛貝類許可水域＝台灣 aquacultureZone（養殖區）；貝類養殖台灣沒有同類，借台灣養殖漁業整合的「產量」色（借色，待確認）。
 *     狀態比照英國棕地（#757）同色、填色強度分級：現役實心、暫停營運同色空心、已註銷灰色空心（P-9）。
 *   土壤深度 5 級＝色盤庫 bilbao（褐色系序列色，比照英國氡氣用色盤庫）；NA＝缺值斜線（F-3）。
 */
import { FUNERAL_FACILITY_TYPES, FUNERAL_LAYER_COLORS } from "./funeralTypes";
import { FACILITY_STATUS_PAINT_COLORS } from "../map/layerPaintColors";
import { paletteRamp, resampleRamp } from "../map/palettes";

export const GB_W12_FETCHED_AT = "2026-10-29";
export const GB_W12_OGL_V3 = "Open Government Licence v3.0";
export const GB_W12_ODBL = "ODbL 1.0";
/** 已註銷／未載明（中性灰，同台灣設施狀態 fallback）。 */
export const GB_W12_FALLBACK_COLOR = FACILITY_STATUS_PAINT_COLORS.fallback;
export const GB_W12_HOLLOW_STROKE = 1.5;

// ─────────────────────────── C029／C030 公司登記 gbCompanies／gbManufacturing ───────────────────────────

/** Companies House 不是 OGL：public register 無再利用限制、須註明來源；郵遞區號定位用 ONSPD（OGL v3）。 */
export const GB_COMPANIES_ATTRIBUTION = "Source: Companies House, Free Company Data Product (snapshot 2026-10-01) · Contains OS data © Crown copyright and database right 2026; Contains Royal Mail data © Royal Mail copyright and database right 2026; Source: Office for National Statistics licensed under the Open Government Licence v.3.0";
export const GB_COMPANIES_LICENSE = "Companies House public register (no re-use restrictions, source must be acknowledged); ONSPD under OGL v3.0";
export const GB_COMPANIES_URL = "https://download.companieshouse.gov.uk/en_output.html";
export const GB_COMPANIES_SNAPSHOT = "2026-10-01";
export const GB_COMPANIES_TILE_ZOOM = { minzoom: 5, maxzoom: 12 } as const;
export const GB_COMPANIES_MINZOOM = 6;
export const GB_COMPANIES_COLOR = "#2563eb";
export const GB_MANUFACTURING_COLOR = "#f97316";
/** 2026-10-29 成品：2,835 個郵遞區號 district、5,493,067 家；製造業（SIC section C）229,621 家（137 區為 0，不畫）。 */
export const GB_COMPANIES_DISTRICTS = 2_835;
export const GB_COMPANIES_TOTAL = 5_493_067;
export const GB_MANUFACTURING_TOTAL = 229_621;
export const GB_MANUFACTURING_DISTRICTS = 2_835 - 137;
/** `top_postcode_share` 超過此值＝大量公司登記在同一郵遞區號（代辦登記地址）。 */
export const GB_COMPANIES_AGENT_SHARE = 0.5;

export interface GbCountBucket { min: number; radius: number }
/** 依 district 公司總數分 5 級半徑（p25≈470、p50≈1,250、p90≈4,000、p99≈11,000）。 */
export const GB_COMPANIES_BUCKETS: readonly GbCountBucket[] = [
  { min: 0, radius: 3 },
  { min: 500, radius: 4.5 },
  { min: 2_000, radius: 6.5 },
  { min: 5_000, radius: 9 },
  { min: 20_000, radius: 12 },
];
/** 依 district 製造業家數分 5 級半徑（p25≈24、p50≈58、p90≈170、p99≈380）。 */
export const GB_MANUFACTURING_BUCKETS: readonly GbCountBucket[] = [
  { min: 1, radius: 3 },
  { min: 25, radius: 4.5 },
  { min: 100, radius: 6.5 },
  { min: 250, radius: 9 },
  { min: 1_000, radius: 12 },
];

/** SIC 2007 section A–U（popup 前 5 大產業）。 */
export const GB_SIC_SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"] as const;
export type GbSicSection = (typeof GB_SIC_SECTIONS)[number];

/** 前 n 大 SIC section（只列 >0）。 */
export function gbTopSicSections(props: Record<string, unknown>, n = 5): { section: GbSicSection; count: number }[] {
  return GB_SIC_SECTIONS
    .map((section) => ({ section, count: Number(props[`c_${section}`]) }))
    .filter((s) => Number.isFinite(s.count) && s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

// ─────────────────────────── C051 殯葬設施 gbFuneral ───────────────────────────

export const GB_FUNERAL_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
export const GB_FUNERAL_URL = "https://www.openstreetmap.org/copyright";
export const GB_FUNERAL_OSM_TIME = "2026-10-29T06:58Z";
export const GB_FUNERAL_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export type GbFuneralKind = "crematorium" | "funeral_directors";
/** 宣告順序＝圖例順序；火葬場 z6 起、葬儀社 z10 起。counts＝2026-10-29 成品筆數。 */
export const GB_FUNERAL_KINDS: readonly { value: GbFuneralKind; color: string; minzoom: number; count: number }[] = [
  { value: "crematorium", color: FUNERAL_FACILITY_TYPES.find((t) => t.value === "crematorium")!.color, minzoom: 6, count: 314 },
  { value: "funeral_directors", color: FUNERAL_LAYER_COLORS.funeralOperators, minzoom: 10, count: 3_033 },
];
export const GB_FUNERAL_COLOR = GB_FUNERAL_KINDS[0]!.color;
export const GB_FUNERAL_COUNT = 3_347;
export const GB_FUNERAL_BY_NATION = { England: 2_806, Scotland: 328, Wales: 143, "Northern Ireland": 70 } as const;
export function gbFuneralKind(value: unknown) {
  return GB_FUNERAL_KINDS.find((k) => k.value === value);
}

// ─────────────────────────── C106 養殖場 gbAquaculture ───────────────────────────

export const GB_AQUACULTURE_ATTRIBUTION = "Contains information from Scottish Government (Marine Scotland) licensed under the Open Government Licence v3.0. · DAERA Aquaculture Licences (OGL v3.0)";
export const GB_AQUACULTURE_SOURCES = {
  sco_marine_directorate: { org: "Scottish Government (Marine Scotland) — Aquaculture: Finfish and shellfish farms (including fishery sites)", url: "https://www.spatialdata.gov.scot/geonetwork/srv/eng/catalog.search#/metadata/Marine_Scotland_FishDAC_1249" },
  ni_daera: { org: "DAERA — Aquaculture Licences Open Data", url: "https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/AquacultureLicenceOpenData/FeatureServer/0" },
} as const;
export const GB_AQUACULTURE_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const GB_AQUACULTURE_MINZOOM = 6;
export type GbAquacultureKind = "finfish" | "shellfish" | "fishery_site" | "shellfish_licence";
/** 宣告順序＝圖例順序。counts＝2026-10-29 成品筆數（全部狀態）。 */
export const GB_AQUACULTURE_KINDS: readonly { value: GbAquacultureKind; color: string; count: number }[] = [
  { value: "finfish", color: "#5c6bc0", count: 1_178 },
  { value: "shellfish", color: "#ffa726", count: 946 },
  { value: "fishery_site", color: "#26c6da", count: 950 },
  { value: "shellfish_licence", color: "#66bb6a", count: 55 },
];
export const GB_AQUACULTURE_COLOR = GB_AQUACULTURE_KINDS[0]!.color;
export function gbAquacultureKind(value: unknown) {
  return GB_AQUACULTURE_KINDS.find((k) => k.value === value);
}
export type GbAquacultureStatus = "active" | "licensed" | "inactive" | "deregistered";
/** 狀態：現役（active、北愛 licensed）實心；暫停營運同色空心淡填；已註銷（租約已退）灰色空心。 */
export const GB_AQUACULTURE_STATUSES: readonly { value: GbAquacultureStatus; fill: number; hollow: boolean; neutral: boolean; count: number }[] = [
  { value: "active", fill: 1, hollow: false, neutral: false, count: 1_558 },
  { value: "licensed", fill: 1, hollow: false, neutral: false, count: 55 },
  { value: "inactive", fill: 0.15, hollow: true, neutral: false, count: 502 },
  { value: "deregistered", fill: 0, hollow: true, neutral: true, count: 1_014 },
];
export function gbAquacultureStatus(value: unknown) {
  return GB_AQUACULTURE_STATUSES.find((s) => s.value === value);
}
/** 「狀態」選單：0 現役（預設）、1 暫停營運、2 已註銷、3 全部。順序＝params encode。 */
export const GB_AQUACULTURE_VIEWS = ["current", "inactive", "deregistered", "all"] as const;
export type GbAquacultureView = (typeof GB_AQUACULTURE_VIEWS)[number];
export function gbAquacultureView(idx: number): GbAquacultureView {
  return GB_AQUACULTURE_VIEWS[Math.trunc(idx)] ?? "current";
}
/** 物種／設施欄是「 ; 」串接、開頭常有空項：拆開、去空白、丟空值。 */
export function gbSplitList(value: unknown): string[] {
  if (value == null) return [];
  return String(value).split(";").map((s) => s.trim()).filter(Boolean);
}

// ─────────────────────────── C108 土壤母質 gbSoilParentMaterial ───────────────────────────

export const GB_SOIL_ATTRIBUTION = "Contains British Geological Survey materials © UKRI 2026 (OGL v3.0)";
export const GB_SOIL_URL = "https://www.bgs.ac.uk/datasets/soil-parent-material-model/";
export const GB_SOIL_TILE_ZOOM = { minzoom: 5, maxzoom: 12 } as const;
export const GB_SOIL_MINZOOM = 6;
export const GB_SOIL_COUNT = 35_466;
export type GbSoilDepth = "SHALLOW" | "INTERMEDIATE-SHALLOW" | "INTERMEDIATE" | "DEEP-INTERMEDIATE" | "DEEP";
/** 土層深度 5 級（淺 → 深＝色階低 → 高）；NA 379 面另畫缺值斜線。counts＝2026-10-29 成品面數。 */
export const GB_SOIL_DEPTHS: readonly { value: GbSoilDepth; count: number }[] = [
  { value: "SHALLOW", count: 7_088 },
  { value: "INTERMEDIATE-SHALLOW", count: 4_111 },
  { value: "INTERMEDIATE", count: 2_913 },
  { value: "DEEP-INTERMEDIATE", count: 1_231 },
  { value: "DEEP", count: 19_744 },
];
export const GB_SOIL_NA_COUNT = 379;
export const GB_SOIL_PALETTE_ID = "bilbao";
/** 5 階（淺 → 深）；暗底越深越亮、淡底越深越暗（色盤庫規則）。 */
export function gbSoilDepthColors(isDark: boolean): string[] {
  return resampleRamp(paletteRamp(GB_SOIL_PALETTE_ID, isDark) ?? [], GB_SOIL_DEPTHS.length);
}
export const GB_SOIL_COLOR = gbSoilDepthColors(true)[2]!;
export function gbSoilDepthIndex(value: unknown): number {
  return GB_SOIL_DEPTHS.findIndex((d) => d.value === value);
}
