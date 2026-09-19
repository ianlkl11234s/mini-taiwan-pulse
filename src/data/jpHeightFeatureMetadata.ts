import { getLoadedJpHeightCatalog } from "./jpHeightCatalog";

/** Join shared shard provenance only at click time; keep original per-feature differences. */
export function enrichJpHeightFeature(sourceId: string, properties: Record<string, unknown>): Record<string, unknown> {
  const loaded = getLoadedJpHeightCatalog();
  if (!loaded || loaded.status === "unavailable") return properties;
  const regionId = typeof properties.region_id === "string"
    ? properties.region_id : sourceId.slice(sourceId.indexOf("--") + 2);
  const region = loaded.catalog.regions.find((candidate) => candidate.id === regionId)
    ?? (!sourceId.includes("--") ? loaded.catalog.regions.find((candidate) => candidate.id === "tokyo-shinjuku") : undefined);
  const asset = properties.cell_size_m != null ? region?.grid : region?.buildings;
  if (!asset) return properties;
  return {
    jp_region_label: region?.label,
    source_year: asset.sourceYear,
    height_method: asset.heightMethod,
    geometry_method: asset.geometryMethod,
    attribution: asset.attribution,
    license: asset.license,
    coverage: asset.coverage,
    ...properties,
  };
}
