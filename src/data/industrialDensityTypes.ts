import { COMPANY_DENSITY_COLORS, COMPANY_DENSITY_STOPS, COMPANY_GRID_NULL_COLOR } from "./businessRegistryTypes";

/** 同一格只加總該來源的 records；三種 grain 不合併。 */
export const INDUSTRIAL_DENSITY_DATASETS = [
  { key: "factoryDensityGrid", stem: "factory_density", snapshot: "202606", label: "生產中工廠密度", datasetId: "factory_locations" },
  { key: "manufacturingCompanyDensityGrid", stem: "manufacturing_company_density", snapshot: "202608", label: "製造業公司登記密度", datasetId: "manufacturing_company_points" },
  { key: "regulatedFacilityDensityGrid", stem: "regulated_facility_density", snapshot: "20260818", label: "列管設施密度", datasetId: "regulated_facilities" },
] as const;
export type IndustrialDensityKey = (typeof INDUSTRIAL_DENSITY_DATASETS)[number]["key"];

export function industrialDensitySources(key: IndustrialDensityKey) {
  const dataset = INDUSTRIAL_DENSITY_DATASETS.find((item) => item.key === key)!;
  return ([1500, 450] as const).map((size) => ({
    kind: "pmtiles" as const,
    sourceId: `business-registry-${dataset.stem.replace(/_/g, "-")}-${size}`,
    url: `./business_registry/${dataset.stem}_${size}m_${dataset.snapshot}.pmtiles`,
    sourceLayer: "business_density_grid", minzoom: 0, maxzoom: 14,
    size,
  }));
}

export function industrialDensityColorExpr(): unknown[] {
  const value = ["get", "density_per_km2"];
  const step: unknown[] = ["step", value, COMPANY_DENSITY_COLORS[0]];
  for (let i = 1; i < COMPANY_DENSITY_STOPS.length; i++) step.push(COMPANY_DENSITY_STOPS[i], COMPANY_DENSITY_COLORS[i]);
  return ["case", ["all", ["==", ["typeof", value], "number"], [">=", value, 0]], step, COMPANY_GRID_NULL_COLOR];
}
