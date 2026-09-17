import type { ExpressionSpecification } from "mapbox-gl";

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

export interface JpAccommodationCategory {
  value: string;
  label: string;
  labelJa: string;
  color: string;
}

/** Canonical 與 OSM 共用的顯示分類；原始 facility_type / accommodation_type 仍保留。 */
export const JP_ACCOMMODATION_CATEGORIES = [
  { value: "hotel", label: "飯店", labelJa: "ホテル", color: "#ef4444" },
  { value: "ryokan", label: "旅館", labelJa: "旅館", color: "#f97316" },
  { value: "simple_lodging", label: "簡易宿所", labelJa: "簡易宿所", color: "#f59e0b" },
  { value: "guest_house", label: "民宿／Guest house", labelJa: "ゲストハウス", color: "#eab308" },
  { value: "hostel", label: "青年旅館", labelJa: "ホステル", color: "#22c55e" },
  { value: "apartment", label: "公寓式住宿", labelJa: "アパートメント", color: "#06b6d4" },
  { value: "motel", label: "汽車旅館", labelJa: "モーテル", color: "#3b82f6" },
  { value: "resort", label: "度假村", labelJa: "リゾート", color: "#8b5cf6" },
] as const satisfies readonly JpAccommodationCategory[];

export const JP_ACCOMMODATION_UNKNOWN_CATEGORY = {
  value: "unknown", label: "未知／缺值", labelJa: "不明", color: "#94a3b8",
} as const;

export const JP_ACCOMMODATION_CATEGORY_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "facility_category"],
  ...JP_ACCOMMODATION_CATEGORIES.flatMap((category) => [category.value, category.color]),
  JP_ACCOMMODATION_UNKNOWN_CATEGORY.color,
] as unknown as ExpressionSpecification;

export const JP_ACCOMMODATION_DENSITY_COLORS = [
  "#fff7ed", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#c2410c", "#7c2d12",
] as const;
export const JP_ACCOMMODATION_DENSITY_LAYER_COLOR = JP_ACCOMMODATION_DENSITY_COLORS[4];
export const JP_ACCOMMODATION_DENSITY_STOPS = [1, 2, 4, 8, 16, 32, 64] as const;

export interface JpAccommodationDensityScale {
  value: "450" | "1500";
  label: string;
  shortLabel: string;
  sourceId: string;
  sourceUrl: string;
  sourceLayer: "jp_accommodation_density";
  minzoom: 0;
  maxzoom: 14;
}

export const JP_ACCOMMODATION_DENSITY_SCALES: readonly JpAccommodationDensityScale[] = [
  {
    value: "450", label: "450 公尺", shortLabel: "450m",
    sourceId: "jp-accommodation-density-450",
    sourceUrl: "./world/jp_accommodation_density_450m_20260910.pmtiles",
    sourceLayer: "jp_accommodation_density", minzoom: 0, maxzoom: 14,
  },
  {
    value: "1500", label: "1.5 公里", shortLabel: "1.5km",
    sourceId: "jp-accommodation-density-1500",
    sourceUrl: "./world/jp_accommodation_density_1500m_20260910.pmtiles",
    sourceLayer: "jp_accommodation_density", minzoom: 0, maxzoom: 14,
  },
] as const;

export function resolveJpAccommodationDensityScale(index: number): JpAccommodationDensityScale {
  return JP_ACCOMMODATION_DENSITY_SCALES[index]
    ?? (JP_ACCOMMODATION_DENSITY_SCALES[0] as JpAccommodationDensityScale);
}

export const JP_ACCOMMODATION_DENSITY_COLOR_EXPRESSION: ExpressionSpecification = [
  "step", ["to-number", ["get", "n_records"], 0],
  JP_ACCOMMODATION_DENSITY_COLORS[0],
  ...JP_ACCOMMODATION_DENSITY_STOPS.slice(1).flatMap((stop, index) => [
    stop, JP_ACCOMMODATION_DENSITY_COLORS[index + 1],
  ]),
] as unknown as ExpressionSpecification;

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
