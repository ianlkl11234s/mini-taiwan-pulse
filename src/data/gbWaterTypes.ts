/**
 * 英國第 3 波水資源／海岸 5 層（C099 河川、C098 水文測站、C101 防洪設施、C102 海岸侵蝕、C095 浴場）：
 * 類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/water_resources/gb_*.md`、`marine/gb_bathing_waters.md`
 * （2026-10-29 逐一打開授權頁）。
 *
 * 色票沿用台灣同語意圖層：
 *   河川＝waterRivers（暗 #38bdf8／淡 #0284c7）、運河＝waterCanals #a78bfa；
 *   水位站＝riverLevel #22d3ee、雨量站＝rainGauge #3b82f6；
 *   堤防＝waterLevees 琥珀 #f59e0b、海岸護岸＝seawallZones 青綠系；
 *   浴場水質＝beachWaterQuality（優良 #0891b2／普通 #f59e0b／不宜親水 #dc2626）；
 *   北愛侵蝕風險 Low／Moderate／High＝土壤液化潛勢 低／中／高（YlOrRd 三階）。
 */
import type { LineTier } from "../map/mapStyleScale";

export const GB_WATER_FETCHED_AT = "2026-10-29";
export const GB_OGL_V3 = "Open Government Licence v3.0";

export type GbNation = "England" | "Scotland" | "Wales" | "Northern Ireland";

// ─────────────────────────── C099 河川 gbRivers ───────────────────────────

export const GB_RIVERS_COLOR = "#38bdf8";
export const GB_RIVERS_COLOR_LIGHT = "#0284c7";
export const GB_RIVERS_CANAL_COLOR = "#a78bfa";
/** 湖中連接段（form=lake）淡化倍率。`fictitious` 欄位為 false 或 null，不使用。 */
export const GB_RIVERS_FADED_FACTOR = 0.45;

export type GbRiverForm = "inlandRiver" | "tidalRiver" | "lake" | "canal";
export interface GbRiverFormDef { value: GbRiverForm; width: LineTier; canal: boolean; faded: boolean }
/** 大不列顛（OS Open Rivers）`form` 4 類；宣告順序＝圖例順序。 */
export const GB_RIVER_FORMS: readonly GbRiverFormDef[] = [
  { value: "inlandRiver", width: "thin", canal: false, faded: false },
  { value: "tidalRiver", width: "standard", canal: false, faded: false },
  { value: "canal", width: "thin", canal: true, faded: false },
  { value: "lake", width: "thin", canal: false, faded: true },
];

/** 北愛（DAERA）Strahler 1–7 三段線寬。 */
export const GB_RIVER_STRAHLER_BANDS: readonly { min: number; max: number; width: LineTier }[] = [
  { min: 1, max: 2, width: "thin" },
  { min: 3, max: 4, width: "standard" },
  { min: 5, max: 7, width: "emphasis" },
];

export const GB_RIVERS_OS_ATTRIBUTION = "Contains OS data © Crown copyright and database right 2026";
export const GB_RIVERS_NI_ATTRIBUTION = "DAERA NIEA, contains OSNI information licensed under OGL v3.0";
export const GB_RIVERS_OS_URL = "https://api.os.uk/downloads/v1/products/OpenRivers";
export const GB_RIVERS_NI_URL = "https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/Rivers_Strahler_Ranking/FeatureServer/0";
export const GB_RIVERS_VERSION = "OS Open Rivers 2026-10／DAERA Strahler";

// ─────────────────────────── C098 水文測站 gbHydroStations ───────────────────────────

export const GB_HYDRO_COLOR = "#22d3ee";
export type GbHydroKind = "level" | "rainfall" | "flow" | "other";
export interface GbHydroKindDef { value: GbHydroKind; color: string; count: number }
export const GB_HYDRO_KINDS: readonly GbHydroKindDef[] = [
  { value: "level", color: "#22d3ee", count: 4658 },
  { value: "rainfall", color: "#3b82f6", count: 1335 },
  { value: "flow", color: "#2dd4bf", count: 239 },
  { value: "other", color: "#94a3b8", count: 15 },
];
/** `kind` 為 null（來源未標觀測參數，14 站）。 */
export const GB_HYDRO_UNTAGGED_COLOR = "#64748b";
/** `precision=os_grid_ref_1000m`（多為地下水位站）：位置只到 1 公里方格中心 → 空心點。 */
export const GB_HYDRO_GRID_PRECISION = "os_grid_ref_1000m";
export const GB_HYDRO_POINT_COUNT = 6261;

export const GB_HYDRO_EA_ATTRIBUTION = "Contains Environment Agency data licensed under the Open Government Licence v3.0";
export const GB_HYDRO_SEPA_ATTRIBUTION = "Contains SEPA data licensed under the Open Government Licence";
export const GB_HYDRO_EA_URL = "http://environment.data.gov.uk/flood-monitoring/id/stations";
export const GB_HYDRO_SEPA_URL = "https://timeseries.sepa.org.uk/KiWIS/KiWIS";

// ─────────────────────────── C101 防洪設施 gbFloodDefenceAssets ───────────────────────────

export const GB_FLOOD_DEFENCE_COLOR = "#f59e0b";
export type GbFloodDefenceClass = "embankment" | "wall" | "gate" | "coastal" | "natural" | "other";
export interface GbFloodDefenceClassDef { value: GbFloodDefenceClass; color: string; types: readonly string[]; faded: boolean }
/**
 * `defence_type` 26 值（tilestats 全集）合併成 5 類＋其他。`group=natural`（天然高地）不看 defence_type，一律歸「天然高地」淡化。
 * 宣告順序＝圖例順序。
 */
export const GB_FLOOD_DEFENCE_CLASSES: readonly GbFloodDefenceClassDef[] = [
  { value: "embankment", color: "#f59e0b", types: ["Embankment", "embankment", "Embankment (Reservoir)", "Engineered High Ground", "Bridge Abutment", "Spillway"], faded: false },
  { value: "wall", color: "#ea580c", types: ["Wall", "Wall (Reservoir)", "Quay", "Promenade", "seawall"], faded: false },
  { value: "gate", color: "#e879f9", types: ["Flood Gate", "Demountable", "Demountable Defence"], faded: false },
  { value: "coastal", color: "#14b8a6", types: ["riprap", "sloped gabions", "Beach", "Barrier Beach", "Dune", "Dunes", "Cliff"], faded: false },
  { value: "natural", color: "#94a3b8", types: ["Natural High Ground", "High Ground"], faded: true },
  { value: "other", color: "#64748b", types: ["other", "uncertain", "recent need to check"], faded: false },
];
export const GB_FLOOD_DEFENCE_NATURAL_FACTOR = 0.5;

export function gbFloodDefenceClass(props: Record<string, unknown>): GbFloodDefenceClassDef | undefined {
  if (props.group === "natural") return GB_FLOOD_DEFENCE_CLASSES.find((c) => c.value === "natural");
  const type = typeof props.defence_type === "string" ? props.defence_type : "";
  return GB_FLOOD_DEFENCE_CLASSES.find((c) => c.types.includes(type));
}

export const GB_FLOOD_DEFENCE_EA_ATTRIBUTION = "© Environment Agency copyright and/or database right 2020. All rights reserved.";
export const GB_FLOOD_DEFENCE_NRW_ATTRIBUTION = "Contains Natural Resources Wales information licensed under the Open Government Licence v3.0";
export const GB_FLOOD_DEFENCE_DC_ATTRIBUTION = "© Dynamic Coast, © NatureScot, © Scottish Government; Contains OS data © Crown copyright and database right";
export const GB_FLOOD_DEFENCE_EA_URL = "https://environment.data.gov.uk/dataset/8e5be50f-d465-11e4-ba9a-f0def148f590";
export const GB_FLOOD_DEFENCE_NRW_URL = "https://datamap.gov.wales/layers/geonode:nrw_flood_defence_locations/metadata_detail";
export const GB_FLOOD_DEFENCE_DC_URL = "https://www.spatialdata.gov.scot/geonetwork/srv/api/records/c1dce8e0-70c9-4b76-9dd3-65e7590803db";

// ─────────────────────────── C102 海岸侵蝕 gbCoastalErosionRisk ───────────────────────────

export const GB_COASTAL_EROSION_COLOR = "#fb923c";
/** 期別：`long`＝2105／2100（預設）、`short`＝2055／2050、`both`＝兩期都畫（短期疊在上）。 */
export type GbErosionPeriod = "long" | "short" | "both";
export const GB_EROSION_PERIODS: readonly GbErosionPeriod[] = ["long", "short", "both"];
export const GB_EROSION_LONG_YEARS = [2100, 2105] as const;
export const GB_EROSION_SHORT_YEARS = [2050, 2055] as const;

export interface GbErosionZoneDef { nation: Exclude<GbNation, "Northern Ireland">; year: number; period: "short" | "long"; color: string }
/** 三地方法不同 → 各用一個色相，短期深、長期淺；不做跨地統一色階。宣告順序＝圖例順序。 */
export const GB_EROSION_ZONES: readonly GbErosionZoneDef[] = [
  { nation: "England", year: 2055, period: "short", color: "#ea580c" },
  { nation: "England", year: 2105, period: "long", color: "#fdba74" },
  { nation: "Wales", year: 2055, period: "short", color: "#db2777" },
  { nation: "Wales", year: 2105, period: "long", color: "#f9a8d4" },
  { nation: "Scotland", year: 2050, period: "short", color: "#7c3aed" },
  { nation: "Scotland", year: 2100, period: "long", color: "#c4b5fd" },
];
export const GB_EROSION_FALLBACK_COLOR = "#94a3b8";

export type GbErosionRisk = "Low" | "Moderate" | "High";
/** 北愛 2019 高階風險評估（線，非投影）：沿用土壤液化潛勢 低／中／高 三階色。 */
export const GB_EROSION_RISKS: readonly { value: GbErosionRisk; color: string }[] = [
  { value: "High", color: "#f03b20" },
  { value: "Moderate", color: "#feb24c" },
  { value: "Low", color: "#ffeda0" },
];

export function gbErosionZoneDef(props: Record<string, unknown>): GbErosionZoneDef | undefined {
  return GB_EROSION_ZONES.find((z) => z.nation === props.nation && z.year === Number(props.horizon_year));
}

export const GB_EROSION_SOURCES: Readonly<Record<GbNation, { attribution: string; url: string; version: string }>> = {
  England: {
    attribution: "© Environment Agency copyright and/or database right 2025. All rights reserved.",
    url: "https://environment.data.gov.uk/dataset/9fede91f-5acd-4fd2-9bd8-98153fa3c2ff",
    version: "EA NCERM 2024（SMP＋70th）",
  },
  Wales: {
    attribution: "Contains Natural Resources Wales information © Natural Resources Wales and Database Right. All rights Reserved.",
    url: "https://datamap.gov.wales/layergroups/geonode:nrw_ncerm",
    version: "NRW NCERM 2023（SMP）",
  },
  Scotland: {
    attribution: "© Scottish Government, © Dynamic Coast, © Historic Environment Scotland, © NatureScot, © St Andrews Links Trust, © University of Glasgow © Ordnance Survey, Crown copyright [and database rights] 2023 OS 100017908",
    url: "https://www.spatialdata.gov.scot/geonetwork/srv/api/records/89c0e02e-d8da-4eb2-a450-187b012547df",
    version: "Dynamic Coast FutureCoast（高排放）",
  },
  "Northern Ireland": {
    attribution: "DAERA, licensed under the Open Government Licence v3.0",
    url: "https://admin.opendatani.gov.uk/dataset/ni-coastal-erosion-high-level-risk-appraisal",
    version: "DAERA 2019",
  },
};
export const GB_EROSION_SHORT_ATTRIBUTION = "© Environment Agency 2025 / © Natural Resources Wales / © Dynamic Coast, NatureScot, Scottish Government et al. / DAERA (OGL v3.0)";

// ─────────────────────────── C095 浴場 gbBathingWaters ───────────────────────────

export const GB_BATHING_COLOR = "#0891b2";
export type GbBathingClass = "Excellent" | "Good" | "Sufficient" | "Poor" | "unassessed";
export interface GbBathingClassDef { value: GbBathingClass; raw: readonly string[]; color: string }
/** 水質分級（好→差）。`Unclassified`／`un-assessed` 合併為「未評」；北愛 null 另列「無分級資料」（空心，不是差）。 */
export const GB_BATHING_CLASSES: readonly GbBathingClassDef[] = [
  { value: "Excellent", raw: ["Excellent"], color: "#0891b2" },
  { value: "Good", raw: ["Good"], color: "#5eead4" },
  { value: "Sufficient", raw: ["Sufficient"], color: "#f59e0b" },
  { value: "Poor", raw: ["Poor"], color: "#dc2626" },
  { value: "unassessed", raw: ["Unclassified", "un-assessed"], color: "#94a3b8" },
];
/** classification 為 null（北愛 DAERA 來源未附分級）：空心點的描邊色。 */
export const GB_BATHING_NO_CLASS_STROKE = "#94a3b8";
export const GB_BATHING_DESIGNATED_COUNT = 699;

export function gbBathingClass(value: unknown): GbBathingClassDef | undefined {
  return typeof value === "string" ? GB_BATHING_CLASSES.find((c) => c.raw.includes(value)) : undefined;
}

export const GB_BATHING_SOURCES: Readonly<Record<string, { attribution: string; url: string }>> = {
  EA: { attribution: "© Environment Agency copyright and/or database right 2015. All rights reserved.", url: "https://environment.data.gov.uk/dataset/fb8da72f-4938-4100-ac91-d9b8438ffd4c" },
  NRW: { attribution: "Contains public sector information licensed under the Open Government Licence v3.0 (Natural Resources Wales)", url: "https://datamap.gov.wales/layers/geonode:nrw_bathing_waters/metadata_detail" },
  SEPA: { attribution: "SEPA — Open Government Licence", url: "https://map.sepa.org.uk/server/rest/services/Open/Environmental_Monitoring/MapServer/2" },
  DAERA: { attribution: "DAERA Marine and Fisheries Division; contains OSNI information licensed under OGL v3.0", url: "https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/BathingWatersDirectiveProtectedAreas/FeatureServer/0" },
};

/** 地圖 source attribution（右下角）。 */
export const GB_WATER_MAP_ATTRIBUTION = {
  rivers: `${GB_RIVERS_OS_ATTRIBUTION} / ${GB_RIVERS_NI_ATTRIBUTION}`,
  hydro: `${GB_HYDRO_EA_ATTRIBUTION} / ${GB_HYDRO_SEPA_ATTRIBUTION}`,
  flood: "© Environment Agency 2020 / © Natural Resources Wales / © Dynamic Coast, NatureScot, Scottish Government (OGL v3.0)",
  erosion: GB_EROSION_SHORT_ATTRIBUTION,
  bathing: "© Environment Agency 2015 / Natural Resources Wales / SEPA / DAERA (OGL v3.0)",
} as const;
