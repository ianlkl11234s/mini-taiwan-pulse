/** Japan water assets stay source-separated. A station registry is not a water-quality observation. */
export const JP_WATER_LAYER_KEYS = [
  "jpWaterDams", "jpWaterLakes", "jpWaterSupplyFacilities", "jpWaterSupplyAreas",
  "jpWaterSewerFacilities", "jpWaterRivers", "jpWaterGroundwaterSites", "jpWaterNilimDams",
  "jpWaterAgriculturalPonds", "jpWaterFloodHazard", "jpWaterLocalPipes", "jpWaterLocalFacilities",
  "jpWaterQualityStations", "jpWaterLevelStations",
] as const;

export type JpWaterLayerKey = typeof JP_WATER_LAYER_KEYS[number];
export type JpWaterFormat = "geojson" | "pmtiles";
export type JpWaterGeometryRole = "point" | "line" | "polygon" | "raster";
export type JpWaterLocalArchive = "water" | "extra-water";

/** Prevent stale URL/local state from mounting restricted research assets in production. */
export function jpWaterLocalResearchEnabled(isDev = import.meta.env.DEV): boolean {
  return isDev;
}

/** Facility categories preserve how each label was obtained; supply fallback is intentionally explicit. */
export const JP_WATER_FACILITY_CATEGORIES = [
  { value: "water_treatment_plant", label: "淨水場", color: "#06b6d4", group: "supply" },
  { value: "water_pump_station", label: "泵場", color: "#14b8a6", group: "supply" },
  { value: "chlorination_facility", label: "滅菌／消毒設施", color: "#f59e0b", group: "supply" },
  { value: "management_facility", label: "管理設施", color: "#8b5cf6", group: "supply" },
  { value: "distribution_reservoir", label: "配水池／配水場", color: "#3b82f6", group: "supply" },
  { value: "intake_or_source_facility", label: "取水／水源設施", color: "#22c55e", group: "supply" },
  { value: "unclassified_supply_facility", label: "上水道設施（未分類）", color: "#94a3b8", group: "supply" },
  { value: "sewer_pump_station", label: "下水道泵場", color: "#1d4ed8", group: "sewer" },
  { value: "sewage_treatment_plant", label: "下水處理場／淨化中心", color: "#a855f7", group: "sewer" },
  { value: "unclassified_sewer_facility", label: "下水道設施（未分類）", color: "#64748b", group: "sewer" },
] as const;

export type JpWaterFacilityCategory = typeof JP_WATER_FACILITY_CATEGORIES[number];

/** Only these keys have a release asset allowlisted for the current frontend. */
export const JP_WATER_RELEASED_LAYER_KEYS = [
  "jpWaterLakes", "jpWaterLocalFacilities", "jpWaterQualityStations", "jpWaterLevelStations",
] as const satisfies readonly JpWaterLayerKey[];

/** DEV-only, local PMTiles. Never add them to the public release allowlist. */
export const JP_WATER_LOCAL_PMTILES_LAYER_KEYS = [
  "jpWaterDams", "jpWaterRivers", "jpWaterSupplyFacilities", "jpWaterSupplyAreas", "jpWaterSewerFacilities",
  "jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds",
] as const satisfies readonly JpWaterLayerKey[];

export const JP_WATER_LOCAL_PMTILES_CONTRACT: Record<JpWaterLocalArchive, { fileName: string; bytes: number; sha256: string }> = {
  water: { fileName: "water.pmtiles", bytes: 85597875, sha256: "dd82b5f53b95e544182c11400dc6dac17a8455bab150b0509df909c1848737da" },
  "extra-water": { fileName: "extra-water.pmtiles", bytes: 31656052, sha256: "e41775f0ae3d33c04866896b0002002d20338937d11f124c51461017409a5bf9" },
};

export const JP_WATER_LOCAL_LAYER_ASSET = {
  jpWaterDams: { archive: "water", sourceLayer: "dams" },
  jpWaterRivers: { archive: "water", sourceLayer: "rivers" },
  jpWaterSupplyFacilities: { archive: "water", sourceLayer: "supply" },
  jpWaterSupplyAreas: { archive: "water", sourceLayer: "supply_areas" },
  jpWaterSewerFacilities: { archive: "water", sourceLayer: "sewer" },
  jpWaterGroundwaterSites: { archive: "extra-water", sourceLayer: "groundwater" },
  jpWaterNilimDams: { archive: "extra-water", sourceLayer: "nilim" },
  jpWaterAgriculturalPonds: { archive: "extra-water", sourceLayer: "agri" },
} as const satisfies Record<typeof JP_WATER_LOCAL_PMTILES_LAYER_KEYS[number], { archive: JpWaterLocalArchive; sourceLayer: string }>;

export function jpWaterSelectionIdentity(layerType: string, sourceId: unknown): {
  sourceLayer: string; assetSha256: string; selectionId: string;
} | null {
  const item = JP_WATER_LOCAL_LAYER_ASSET[layerType as keyof typeof JP_WATER_LOCAL_LAYER_ASSET];
  if (!item || sourceId == null || String(sourceId).trim() === "") return null;
  const assetSha256 = JP_WATER_LOCAL_PMTILES_CONTRACT[item.archive].sha256;
  return {
    sourceLayer: item.sourceLayer,
    assetSha256,
    selectionId: `${item.sourceLayer}:${String(sourceId)}:${assetSha256}`,
  };
}

export const JP_WATER_LAYER_CONTRACT: Record<JpWaterLayerKey, {
  geometryRole: JpWaterGeometryRole; sourceYear: string; sourceLabel: string; historical: boolean; publicDistribution: boolean;
}> = {
  jpWaterDams: { geometryRole: "point", sourceYear: "2014", sourceLabel: "國土數値情報 W01 ダム", historical: true, publicDistribution: false },
  jpWaterLakes: { geometryRole: "polygon", sourceYear: "2005", sourceLabel: "國土數値情報 W09 湖沼", historical: true, publicDistribution: true },
  jpWaterSupplyFacilities: { geometryRole: "point", sourceYear: "2010", sourceLabel: "國土數値情報 P21 上水道関連施設", historical: true, publicDistribution: false },
  jpWaterSupplyAreas: { geometryRole: "polygon", sourceYear: "2010", sourceLabel: "國土數値情報 P21 給水区域", historical: true, publicDistribution: false },
  jpWaterSewerFacilities: { geometryRole: "point", sourceYear: "2012", sourceLabel: "國土數値情報 P22 下水道関連施設", historical: true, publicDistribution: false },
  jpWaterRivers: { geometryRole: "line", sourceYear: "2006–2009", sourceLabel: "國土數値情報 W05 河川流路", historical: true, publicDistribution: false },
  jpWaterGroundwaterSites: { geometryRole: "point", sourceYear: "來源未註", sourceLabel: "GSJ 地下水・湧水・河川地点", historical: false, publicDistribution: false },
  jpWaterNilimDams: { geometryRole: "point", sourceYear: "來源未註", sourceLabel: "NILIM ダム位置", historical: false, publicDistribution: false },
  jpWaterAgriculturalPonds: { geometryRole: "point", sourceYear: "2026-03", sourceLabel: "MAFF 農業用ため池", historical: false, publicDistribution: false },
  jpWaterFloodHazard: { geometryRole: "raster", sourceYear: "來源服務未註固定快照", sourceLabel: "GSI 洪水浸水想定（最大規模）", historical: false, publicDistribution: true },
  jpWaterLocalPipes: { geometryRole: "line", sourceYear: "source-specific", sourceLabel: "半田市 水道管路", historical: false, publicDistribution: false },
  jpWaterLocalFacilities: { geometryRole: "point", sourceYear: "source-specific", sourceLabel: "高松市 水道施設", historical: false, publicDistribution: true },
  jpWaterQualityStations: { geometryRole: "point", sourceYear: "2024", sourceLabel: "環境省 水質測定地点台帳", historical: true, publicDistribution: true },
  jpWaterLevelStations: { geometryRole: "point", sourceYear: "unknown (station registry undated)", sourceLabel: "横浜市 水位観測所", historical: false, publicDistribution: true },
};
