export const JP_TOURISM_LAYER_KEYS = [
  "jpAccommodationCanonical", "jpAccommodationJta", "jpAccommodationLocal", "jpAccommodationOsm",
  "jpNaturalParksNational", "jpNaturalParksQuasiNational", "jpNaturalParksPrefectural",
  "jpNatureConservationArea", "jpPrimitiveNatureEnvironmentArea", "jpNatureConservationSpecialDistrict",
  "jpWildlifeProtectionNational", "jpWildlifeSpecialProtectionDistrict", "jpWildlifeSpecialProtectionDesignatedArea",
  "jpWorldHeritageCultural", "jpWorldHeritageNatural", "jpWorldNaturalHeritageHistorical",
  "jpRamsarSites", "jpMarineEbsaCoastal",
] as const;

export type JpTourismLayerKey = typeof JP_TOURISM_LAYER_KEYS[number];

export const JP_TOURISM_COLORS: Record<JpTourismLayerKey, string> = {
  jpAccommodationCanonical: "#f97316",
  jpAccommodationJta: "#fb923c",
  jpAccommodationLocal: "#fdba74",
  jpAccommodationOsm: "#38bdf8",
  jpNaturalParksNational: "#15803d",
  jpNaturalParksQuasiNational: "#22c55e",
  jpNaturalParksPrefectural: "#86efac",
  jpNatureConservationArea: "#0f766e",
  jpPrimitiveNatureEnvironmentArea: "#115e59",
  jpNatureConservationSpecialDistrict: "#2dd4bf",
  jpWildlifeProtectionNational: "#7c3aed",
  jpWildlifeSpecialProtectionDistrict: "#a855f7",
  jpWildlifeSpecialProtectionDesignatedArea: "#d8b4fe",
  jpWorldHeritageCultural: "#d97706",
  jpWorldHeritageNatural: "#16a34a",
  jpWorldNaturalHeritageHistorical: "#65a30d",
  jpRamsarSites: "#0891b2",
  jpMarineEbsaCoastal: "#2563eb",
};

export const JP_TOURISM_FILTER_LAYER_IDS: Partial<Record<JpTourismLayerKey, string>> = {
  jpNaturalParksNational: "jp_natural_parks_national",
  jpNaturalParksQuasiNational: "jp_natural_parks_quasi_national",
  jpNaturalParksPrefectural: "jp_natural_parks_prefectural",
  jpNatureConservationArea: "jp_nature_conservation_area",
  jpPrimitiveNatureEnvironmentArea: "jp_primitive_nature_environment_area",
  jpNatureConservationSpecialDistrict: "jp_nature_conservation_special_district",
  jpWildlifeProtectionNational: "jp_wildlife_protection_national",
  jpWildlifeSpecialProtectionDistrict: "jp_wildlife_special_protection_district",
  jpWildlifeSpecialProtectionDesignatedArea: "jp_wildlife_special_protection_designated_area",
  jpWorldHeritageCultural: "jp_world_heritage_cultural",
  jpWorldHeritageNatural: "jp_world_heritage_natural",
  jpRamsarSites: "jp_ramsar_sites",
  jpMarineEbsaCoastal: "jp_marine_ebsa_coastal",
};

export const JP_RAMSAR_GEOMETRY_FILTERS = [
  { label: "名稱命中 10", value: "name_match" },
  { label: "低精度中心點 44", value: "degraded" },
  { label: "全部 54", value: "all" },
] as const;
