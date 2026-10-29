/**
 * 英國第 5 波自然與林業 7 層（C054 保護區、C097 海洋保護區、C113 林地 NFI、C114 森林遊憩、C115 步道、
 * X002 開放進入地、C093 樹木保護）：類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/{environment,marine,forestry,urban_open_space}/gb_*.md`
 * 與 `docs/topic-research/united_kingdom_opendata/waves/w5/layer-plan.md`（2026-10-29 逐一重讀授權頁）。
 *
 * 色票沿用台灣同語意圖層（資料色，spec §3.16）：
 *   國家公園＝nationalParks #15803d；SSSI／國家級保留區＝natureReserves #166534、wildlifeProtectedAreas #65a30d；
 *   海洋保護區＝marineWildlifeAreas #0d9488（青綠系）；
 *   林地＝forestCompartments #15803d；森林遊憩＝forestRecreation #65A30D、指標＝forestTrailSigns #84CC16；
 *   國家步道＝hikingTrails #d62728；受保護樹木＝protectedTreesNational #00695c。
 *   「暫時無林木」用中性灰（不畫成森林綠）。
 */

export const GB_NATURE_FETCHED_AT = "2026-10-29";
export const GB_NATURE_OGL_V3 = "Open Government Licence v3.0";

// ─────────────────────────── C054 保護區 gbProtectedAreas ───────────────────────────

export const GB_PROTECTED_AREAS_COLOR = "#166534";
export type GbDesignation = "national_park" | "aonb" | "nsa" | "sssi" | "nnr" | "sac" | "spa" | "ramsar";
/** 類別組：景觀（大面積，最下層、淡填色）／國內法保護區／國際指定。 */
export type GbDesignationGroup = "landscape" | "domestic" | "international";
export interface GbDesignationDef { value: GbDesignation; group: GbDesignationGroup; color: string; count: number }
/** 宣告順序＝圖例順序；繪製時景觀類在最下層（fill-sort-key）。 */
export const GB_DESIGNATIONS: readonly GbDesignationDef[] = [
  { value: "national_park", group: "landscape", color: "#15803d", count: 15 },
  { value: "aonb", group: "landscape", color: "#4ade80", count: 47 },
  { value: "nsa", group: "landscape", color: "#a3e635", count: 40 },
  { value: "sssi", group: "domestic", color: "#166534", count: 7031 },
  { value: "nnr", group: "domestic", color: "#65a30d", count: 400 },
  { value: "sac", group: "international", color: "#2563eb", count: 666 },
  { value: "spa", group: "international", color: "#0ea5e9", count: 289 },
  { value: "ramsar", group: "international", color: "#06b6d4", count: 154 },
];
export const GB_DESIGNATION_FALLBACK_COLOR = "#94a3b8";
/** 景觀類只畫淡填色＋外框（大面積，不蓋住下面的保護區）。 */
export const GB_LANDSCAPE_FILL_FACTOR = 0.35;
/** 「類別」選項：all＝全部、其餘只顯示該組。 */
export type GbDesignationFilter = "all" | GbDesignationGroup;
export const GB_DESIGNATION_FILTERS: readonly GbDesignationFilter[] = ["all", "landscape", "domestic", "international"];

export function gbDesignation(value: unknown): GbDesignationDef | undefined {
  return GB_DESIGNATIONS.find((d) => d.value === value);
}

/** popup footer：依 `source` 欄挑機關署名（layer-plan 清理版句子）。 */
export const GB_PROTECTED_SOURCES: Readonly<Record<string, string>> = {
  "Natural England": "© Natural England copyright. Contains Ordnance Survey data © Crown copyright and database right 2024.",
  NatureScot: "© NatureScot, Contains Ordnance Survey data © Crown copyright and database right (2023)",
  "Scottish Government": "© Scottish Government, contains Ordnance Survey data © Crown copyright and database right 2026.",
  "Natural Resources Wales": "Contains Natural Resources Wales information © Natural Resources Wales and Database Right. All rights Reserved. Contains Ordnance Survey Data. Ordnance Survey Licence number AC0000849444. Crown Copyright and Database Right.",
  "DAERA / NIEA": "Contains public sector information licensed under the Open Government Licence v3.0 (DAERA / NIEA)",
};
/** popup footer 連結：`<nation>:<designation>`（catalog doc 各來源表）。 */
export const GB_PROTECTED_SOURCE_URLS: Readonly<Record<string, string>> = {
  "England:sssi": "https://www.arcgis.com/home/item.html?id=f10cbb4425154bfda349ccf493487a80",
  "England:sac": "https://www.arcgis.com/home/item.html?id=e4142658906c498fa37f0a20d3fdfcff",
  "England:spa": "https://www.arcgis.com/home/item.html?id=e6ee43be14554663b0a80bb42aa4e671",
  "England:ramsar": "https://www.arcgis.com/home/item.html?id=13b5f06edc88471db479b49b4ac04a43",
  "England:nnr": "https://www.arcgis.com/home/item.html?id=ab7bfd86f5b347df8d47fc9bfab80caf",
  "England:national_park": "https://www.arcgis.com/home/item.html?id=d333c7529754444894e2d7f5044d1bbf",
  "England:aonb": "https://www.arcgis.com/home/item.html?id=6f2ad07d91304ad79cdecd52489d5046",
  "Scotland:sssi": "https://www.arcgis.com/home/item.html?id=b243da0bc2164849b80f9c8b347edd18",
  "Scotland:sac": "https://www.arcgis.com/home/item.html?id=7e07a1bb1e294d109c40d2327e3c316d",
  "Scotland:spa": "https://www.arcgis.com/home/item.html?id=bc43e7d54a9a49c1a5e72d00a8b7c84e",
  "Scotland:ramsar": "https://www.arcgis.com/home/item.html?id=d7c76ec074a04de69f7e917eab247822",
  "Scotland:nnr": "https://www.arcgis.com/home/item.html?id=3d9110a3aa874a18b30aea6a69015013",
  "Scotland:national_park": "https://www.spatialdata.gov.scot/geonetwork/srv/eng/catalog.search#/metadata/af0755a1-2841-4d51-8b16-c95fd921908b",
  "Scotland:nsa": "https://www.spatialdata.gov.scot/geonetwork/srv/eng/catalog.search#/metadata/13396739-7602-4428-85fd-95a5d7e208a1",
  "Wales:sssi": "https://datamap.gov.wales/layers/inspire-nrw:NRW_SSSI",
  "Wales:sac": "https://datamap.gov.wales/layers/inspire-nrw:NRW_SAC",
  "Wales:spa": "https://datamap.gov.wales/layers/inspire-nrw:NRW_SPA",
  "Wales:ramsar": "https://datamap.gov.wales/layers/inspire-nrw:NRW_RAMSAR",
  "Wales:nnr": "https://datamap.gov.wales/layers/inspire-nrw:NRW_NNR",
  "Wales:national_park": "https://datamap.gov.wales/layers/inspire-nrw:NRW_NATIONAL_PARK",
  "Wales:aonb": "https://datamap.gov.wales/layers/inspire-nrw:NRW_AONB",
  "Northern Ireland:sssi": "https://www.opendatani.gov.uk/dataset/areas-of-special-scientific-interest",
  "Northern Ireland:sac": "https://www.opendatani.gov.uk/dataset/special-areas-of-conservation",
  "Northern Ireland:spa": "https://www.opendatani.gov.uk/dataset/special-protection-areas",
  "Northern Ireland:ramsar": "https://www.opendatani.gov.uk/dataset/ramsar-sites",
  "Northern Ireland:nnr": "https://www.opendatani.gov.uk/dataset/national-nature-reserves",
  "Northern Ireland:aonb": "https://www.opendatani.gov.uk/dataset/areas-of-outstanding-natural-beauty",
};

// ─────────────────────────── C097 海洋保護區 gbMarineProtectedAreas ───────────────────────────

export const GB_MPA_COLOR = "#0d9488";
export type GbMpaType = "mcz" | "ncmpa" | "drmpa";
export const GB_MPA_TYPES: readonly { value: GbMpaType; color: string }[] = [
  { value: "mcz", color: "#0d9488" },
  { value: "ncmpa", color: "#14b8a6" },
  { value: "drmpa", color: "#5eead4" },
];
/**
 * 英格蘭 HPMA（Highly Protected Marine Area）授權 HOLD 不收；但上游切片的 NE MCZ 檔內含 3 筆
 * （site_code UKEHPMA001–003），前端以 site_code 前綴濾掉，待資料 worker 上游移除。
 */
export const GB_MPA_HPMA_CODE_PREFIX = "UKEHPMA";
export const GB_MPA_SOURCES: Readonly<Record<string, { attribution: string; url: string }>> = {
  Opendata_NE: { attribution: "© Natural England copyright. Contains Ordnance Survey data © Crown copyright and database right 2023.", url: "https://www.arcgis.com/home/item.html?id=82bf811005484412a75c438738d51f82" },
  SNH_Maps: { attribution: "© NatureScot 2023, Contains Ordnance Survey data © Crown copyright and database right. All rights reserved , License No. EK001-20140401. Not to be used for Navigation", url: "https://www.arcgis.com/home/item.html?id=0fb8cf7077604d7fa7c9367559befd7b" },
  DAERA_OpenContent: { attribution: "DAERA Environment, Marine and Fisheries Group; contains Ordnance Survey of Northern Ireland information licensed under the Open Government Licence v3.0.", url: "https://www.arcgis.com/home/item.html?id=9ede5d8bb1b540b4b75cf27a144ed465" },
};
export const GB_MPA_DRMPA_URL = "https://www.arcgis.com/home/item.html?id=8d4020701ae64c1bbfc4b36eef3c6b5e";

// ─────────────────────────── C113 林地 gbWoodland ───────────────────────────

export const GB_WOODLAND_COLOR = "#15803d";
export type GbWoodlandGroup = "broadleaved" | "conifer" | "young" | "cleared";
export interface GbWoodlandGroupDef { value: GbWoodlandGroup; color: string; types: readonly string[] }
/** NFI `forest_type` 14 值合併成 4 組；宣告順序＝圖例順序。 */
export const GB_WOODLAND_GROUPS: readonly GbWoodlandGroupDef[] = [
  { value: "broadleaved", color: "#22c55e", types: ["Broadleaved", "Mixed mainly broadleaved", "Coppice", "Coppice with standards"] },
  { value: "conifer", color: "#15803d", types: ["Conifer", "Mixed mainly conifer"] },
  { value: "young", color: "#bef264", types: ["Young trees", "Low density", "Shrub", "Assumed woodland"] },
  { value: "cleared", color: "#94a3b8", types: ["Felled", "Ground prep", "Windblow", "Failed"] },
];
/** 北愛 `kind=ni_priority_habitat`（DAERA 優先棲地林地，非 NFI 普查）：獨立一色。 */
export const GB_WOODLAND_NI_COLOR = "#65a30d";
export const GB_WOODLAND_FALLBACK_COLOR = "#64748b";
export const GB_WOODLAND_NI_KIND = "ni_priority_habitat";
/** layer-plan 建議 7；瀏覽器實測 z7 全英視角平移單幀最長 2.4 秒（z8 0.5 秒），改 z8 起。 */
export const GB_WOODLAND_MINZOOM = 8;

export function gbWoodlandGroup(forestType: unknown): GbWoodlandGroupDef | undefined {
  return typeof forestType === "string" ? GB_WOODLAND_GROUPS.find((g) => g.types.includes(forestType)) : undefined;
}

export const GB_WOODLAND_FC_ATTRIBUTION = "© Forestry Commission copyright. Contains Ordnance Survey data © Crown copyright and database right 2026.";
export const GB_WOODLAND_NI_ATTRIBUTION = "DAERA (OpenDataNI), Open Government Licence v3.0";
export const GB_WOODLAND_FC_URL = "https://www.arcgis.com/home/item.html?id=2620d81bd55846b295d980020574e042";
export const GB_WOODLAND_NI_URL = "https://www.opendatani.gov.uk/dataset/priority-habitats-woodland2";

// ─────────────────────────── C114 森林遊憩 gbForestRecreation ───────────────────────────

export const GB_RECREATION_COLOR = "#65A30D";
export type GbRecreationCategory = "signage" | "furniture" | "built" | "play" | "art" | "misc";
export const GB_RECREATION_CATEGORIES: readonly { value: GbRecreationCategory; color: string; count: number }[] = [
  { value: "furniture", color: "#65A30D", count: 2882 },
  { value: "built", color: "#f59e0b", count: 1138 },
  { value: "play", color: "#ec4899", count: 652 },
  { value: "art", color: "#a855f7", count: 541 },
  { value: "misc", color: "#94a3b8", count: 3165 },
  { value: "signage", color: "#84CC16", count: 12637 },
];
/** `category=null`（威爾斯 NRW 只有代碼、無公開對照表）。 */
export const GB_RECREATION_UNCLASSIFIED_COLOR = "#64748b";
/** 指標與步道標 12,637 點：z12 起才畫，其餘類別 z10 起。 */
export const GB_RECREATION_SIGNAGE_MINZOOM = 12;
export const GB_RECREATION_MINZOOM = 10;
export const GB_RECREATION_SOURCES: Readonly<Record<string, { attribution: string; url: string }>> = {
  "Forestry England": { attribution: "Contains, or is based on, information supplied by the Forestry Commission. © Crown copyright and database right 2026 Ordnance Survey AC0000814847", url: "https://www.arcgis.com/home/item.html?id=83afc7ed8cf84140b3e6eefc004073ca" },
  "Natural Resources Wales": { attribution: "Contains Natural Resources Wales information © Natural Resources Wales and Database Right. All rights Reserved.", url: "https://datamap.gov.wales/layers/inspire-nrw:NRW_GB_RECREATION_POINTS" },
};

// ─────────────────────────── C115 步道 gbTrails ───────────────────────────

export const GB_NATIONAL_TRAIL_COLOR = "#d62728";
export type GbTrailCategory = "walking" | "cycling" | "equestrian" | "multi" | "other";
export interface GbTrailCategoryDef { value: GbTrailCategory; color: string; raw: readonly string[] }
/** 公有林步道 `category`（只有 Forestry England 有）；蘇格蘭、威爾斯 null → 「未分類」。 */
export const GB_TRAIL_CATEGORIES: readonly GbTrailCategoryDef[] = [
  { value: "walking", color: "#f97316", raw: ["Walking"] },
  { value: "cycling", color: "#3b82f6", raw: ["Cycling"] },
  { value: "equestrian", color: "#a16207", raw: ["Equestrian Routes"] },
  { value: "multi", color: "#a855f7", raw: ["Multi User Trails"] },
  { value: "other", color: "#94a3b8", raw: ["Wild Trails", "Miscellaneous Routes", "Forest Drives"] },
];
export const GB_TRAIL_UNCLASSIFIED_COLOR = "#facc15";
export const GB_NATIONAL_TRAIL_MINZOOM = 6;
export const GB_FOREST_ROUTE_MINZOOM = 10;
/** `status` 這幾種要在 popup 標出（非官方或暫時）。 */
export const GB_TRAIL_FLAG_STATUSES: readonly string[] = ["Permanent - Unofficial", "Seasonal - Unofficial", "Temporary"];

export function gbTrailCategory(raw: unknown): GbTrailCategoryDef | undefined {
  return typeof raw === "string" ? GB_TRAIL_CATEGORIES.find((c) => c.raw.includes(raw)) : undefined;
}

/** Natural England 句的 `[year]` 是來源授權頁原文佔位，照抄不自行填年份。 */
export const GB_TRAIL_SOURCES: Readonly<Record<string, { attribution: string; url: string }>> = {
  "Natural England": { attribution: "© Natural England copyright. Contains Ordnance Survey data © Crown copyright and database right [year].", url: "https://www.arcgis.com/home/item.html?id=6a67e9afbcb646549be437fbff12d6ed" },
  "Forestry England": { attribution: "Contains, or is based on, information supplied by the Forestry Commission. © Crown copyright and database right 2026 Ordnance Survey AC0000814847", url: "https://www.arcgis.com/home/item.html?id=c1b69c1180d1455b84409bcd8b0abeb3" },
  "Forestry and Land Scotland": { attribution: "Contains public sector information licensed under the Open Government Licence v3.0. (Forestry and Land Scotland)", url: "https://www.arcgis.com/home/item.html?id=ec0710139a764ed4b46fc802f07308b5" },
  "Natural Resources Wales:national_trail": { attribution: "Contains Natural Resources Wales information © Natural Resources Wales and Database Right. All rights Reserved. Contains Ordnance Survey Data. Ordnance Survey Licence number AC0000849444. Crown Copyright and Database Right.", url: "https://datamap.gov.wales/layers/inspire-nrw:NRW_NATIONAL_TRAIL" },
  "Natural Resources Wales": { attribution: "Contains public sector information licensed under the Open Government Licence v3.0. (Natural Resources Wales)", url: "https://datamap.gov.wales/layers/inspire-nrw:NRW_GB_RECREATION_ROUTES" },
};

export function gbTrailSource(props: Record<string, unknown>) {
  const src = typeof props.source === "string" ? props.source : "";
  return GB_TRAIL_SOURCES[`${src}:${String(props.route_class)}`] ?? GB_TRAIL_SOURCES[src];
}

// ─────────────────────────── X002 開放進入地 gbOpenAccessLand ───────────────────────────

export const GB_OPEN_ACCESS_COLOR = "#ca8a04";
export type GbAccessType = "open_country" | "common_land" | "dedicated";
export const GB_ACCESS_TYPES: readonly { value: GbAccessType; color: string; flag: "oc" | "rcl" | "s16"; count: number }[] = [
  { value: "open_country", color: "#ca8a04", flag: "oc", count: 31049 },
  { value: "common_land", color: "#65a30d", flag: "rcl", count: 15789 },
  { value: "dedicated", color: "#0891b2", flag: "s16", count: 1196 },
];
export const GB_OPEN_ACCESS_SOURCES: Readonly<Record<string, { attribution: string; url: string }>> = {
  "Natural England": { attribution: "© Natural England copyright. Contains Ordnance Survey data © Crown copyright and database right 2024.", url: "https://www.arcgis.com/home/item.html?id=6ce15f2cd06c4536983d315694dad16b" },
  "Natural Resources Wales": { attribution: "Contains Natural Resources Wales information © Natural Resources Wales and Database Right. All rights Reserved. Contains Ordnance Survey Data. Ordnance Survey Licence number AC0000849444. Crown Copyright and Database Right.", url: "https://datamap.gov.wales/layers/inspire-nrw:NRW_OPEN_COUNTRY_2014" },
};
export const GB_OPEN_ACCESS_NRW_COMMON_URL = "https://datamap.gov.wales/layers/inspire-nrw:NRW_COMMON_LAND_2014";

// ─────────────────────────── C093 樹木保護 gbTreeProtection ───────────────────────────

export const GB_TREE_PROTECTION_COLOR = "#00695c";
export type GbTreeCategory = "tpo_zone" | "tpo_tree" | "ancient_woodland";
export const GB_TREE_CATEGORIES: readonly { value: GbTreeCategory; color: string; count: number }[] = [
  { value: "tpo_zone", color: "#26a69a", count: 111388 },
  { value: "tpo_tree", color: "#00695c", count: 260029 },
  { value: "ancient_woodland", color: "#4d7c0f", count: 130991 },
];
export const GB_ANCIENT_WOODLAND_MINZOOM = 9;
export const GB_TPO_MINZOOM = 12;
/** TPO 只含參與 Planning Data 試辦的英格蘭地方規劃機關（範圍面 85、單株 74 個機關）。 */
export const GB_TPO_ZONE_ORGS = 85;
export const GB_TPO_TREE_ORGS = 74;
/** 古老林地 `aw_status` 原值（三地格式不同）→ 中文類別；查不到對照（如威爾斯 AWP）只顯示原文。 */
export type GbAncientWoodlandStatus = "asnw" | "paws" | "restored" | "unknown" | "longEstablished" | "otherRoy" | "deleted";
export const GB_AW_STATUS: Readonly<Record<string, GbAncientWoodlandStatus>> = {
  ASNW: "asnw",
  "Ancient Semi Natural Woodland": "asnw",
  "Ancient (of semi-natural origin)": "asnw",
  PAWS: "paws",
  "Plantation on Ancient Woodland Site": "paws",
  "Restored Ancient Woodland Site": "restored",
  "Ancient Woodland Site of Unknown Category": "unknown",
  "Long-Established (of plantation origin)": "longEstablished",
  "Other (on Roy map)": "otherRoy",
  "Ancient Semi Natural Woodland Deleted": "deleted",
  "Plantation on Ancient Woodland Site Deleted": "deleted",
};
/** Natural England／NatureScot 句的 `[Year]`、`(year)` 為來源授權頁原文佔位，照抄不自行填年份。 */
export const GB_TREE_SOURCES: Readonly<Record<string, { attribution: string; url: string }>> = {
  "Planning Data (MHCLG)": { attribution: "© Crown copyright and database right 2026", url: "https://www.planning.data.gov.uk/dataset/tree-preservation-zone" },
  "Natural England": { attribution: "© Natural England [Year]; © Crown Copyright and database rights [year]. Ordnance Survey AC0000851168; © 2015 Getmapping plc and Bluesky International Ltd; © Woodland Trust; © Forest Commission; Contains, or is based on, information supplied by the Forestry Commission. © Crown copyright and database right [Year] Ordnance Survey [100021242]; © and database right Crown copyright and Landmark Information Group Ltd. All rights reserved [year]; © Ancient Tree Hunt", url: "https://www.arcgis.com/home/item.html?id=a14064ca50e242c4a92d020764a6d9df" },
  NatureScot: { attribution: "© Scottish Natural Heritage Contains Ordnance Survey data © Crown copyright and database right (year)", url: "https://www.arcgis.com/home/item.html?id=f51238bf8c8f4f859831c9a6ebd2598b" },
  "Natural Resources Wales": { attribution: "Contains Natural Resources Wales information © Natural Resources Wales and Database Right. All rights Reserved. Contains Ordnance Survey Data. Ordnance Survey Licence number AC0000849444. Crown Copyright and Database Right.", url: "https://datamap.gov.wales/layers/inspire-nrw:NRW_ANCIENT_WOODLAND_INVENTORY_2021" },
};
export const GB_TPO_TREE_URL = "https://www.planning.data.gov.uk/dataset/tree";

/** 地圖 source attribution（右下角）。 */
export const GB_NATURE_MAP_ATTRIBUTION = {
  protected: "© Natural England / © NatureScot / © Scottish Government / © Natural Resources Wales / DAERA NIEA; contains OS data © Crown copyright (OGL v3.0)",
  mpa: "© Natural England / © NatureScot / DAERA; contains OS data © Crown copyright (OGL v3.0). Not to be used for navigation",
  woodland: `${GB_WOODLAND_FC_ATTRIBUTION} / ${GB_WOODLAND_NI_ATTRIBUTION}`,
  recreation: "© Crown copyright and database right 2026 Ordnance Survey AC0000814847 (Forestry Commission) / © Natural Resources Wales",
  trails: "© Natural England / Forestry Commission / Forestry and Land Scotland / Natural Resources Wales; contains OS data © Crown copyright (OGL v3.0)",
  openAccess: "© Natural England copyright 2024 / © Natural Resources Wales; contains OS data © Crown copyright (OGL v3.0)",
  tree: "© Crown copyright and database right 2026 (Planning Data) / © Natural England / © NatureScot / © Natural Resources Wales (OGL v3.0)",
} as const;
