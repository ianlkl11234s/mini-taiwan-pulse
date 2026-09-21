import { SOCIAL_ENABLED_STATISTICS_RECIPES, type SocialRecipe } from "../data/socialStatisticsRecipes";
import { loadRegionalStatistics } from "../data/regionalStatisticsLoader";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import { createAdminStatisticsAdapter } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

type RegionalStatisticsLoader = typeof loadRegionalStatistics;

export function socialStatisticsDatasetId(recipe: Pick<SocialRecipe, "layer_key">): string {
  // A source dataset can expose multiple indicators.  The manifest layer key is
  // the stable, already-unique identity for one exact research selector family.
  return `regional-statistics:${recipe.layer_key}`;
}

function valueSemantics(recipe: SocialRecipe) {
  return {
    ...DEFAULT_VALUE_SEMANTICS,
    null: "由 status、source_status 與 source_token 區分 missing、suppressed、not_reported；null 絕不等於零。",
    suppressed: `來源標記為 suppressed 時 value 必為 null；${recipe.legend.not_reported_label} 也不得補零。`,
    zero: "僅 status=observed 且 value=0 才是觀測到的零值。",
    stale: "release health=STALE 表示歷史快照；可讀取但不可描述為現況。",
  };
}

export function socialStatisticsDescriptor(recipe: SocialRecipe): DatasetDescriptor {
  return {
    schemaVersion: "pulse-dataset/0.1",
    datasetId: socialStatisticsDatasetId(recipe),
    label: recipe.label,
    description: `${recipe.group}／${recipe.subgroup}的 ${recipe.level} 行政統計。${recipe.disclosure ?? "數值必須和 release、status 與行政邊界版本一起解讀。"}`,
    layerRefs: [recipe.layer_key],
    kind: "admin_statistic",
    recordGrain: "admin_statistic",
    primaryKey: ["release_id", "area_code"],
    fields: [
      { name: "release_id", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "indicator_id", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "layer_key", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "level", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "area_name", type: "string", nullable: true, nullMeaning: "同版邊界未提供名稱屬性時為 null；不得由 area_code 猜測。", unit: null },
      { name: "indicator_name", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "unit", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "value", type: "number", nullable: true, nullMeaning: "由 status、source_status、source_token 區分 suppressed、not_reported 或 missing；不得轉為零。", unit: recipe.unit },
      { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "source_status", type: "string", nullable: true, nullMeaning: "來源未另提供狀態。", unit: null },
      { name: "source_token", type: "string", nullable: true, nullMeaning: "observed 數值通常沒有原始缺值符號。", unit: null },
      { name: "period_start", type: "datetime", nullable: false, nullMeaning: null, unit: null },
      { name: "period_end", type: "datetime", nullable: false, nullMeaning: null, unit: null },
      { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "boundary_sha256", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "boundary_resource", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
      { name: "dimensions", type: "json", nullable: false, nullMeaning: null, unit: null },
      { name: "inputs", type: "json", nullable: true, nullMeaning: "來源未提供組成輸入或衍生值明細。", unit: null },
    ],
    geometry: {
      type: "MultiPolygon", crs: "EPSG:4326", role: "actual",
      precision: recipe.boundary_semantics ?? "同版 immutable 行政邊界，依 area_code 精確 join；Polygon 正規化為單一 part 的 MultiPolygon。",
      spatialAnalysisEligible: true,
    },
    timeFields: [
      { name: "period_start", role: "period_start", timezone: "Asia/Taipei" },
      { name: "period_end", role: "period_end", timezone: "Asia/Taipei" },
    ],
    coverage: JSON.stringify(recipe.release_options.map(option => ({ release_id: option.release_id, coverage: option.coverage }))),
    license: "unknown; consult the exact regional-statistics release provenance before redistribution",
    valueSemantics: valueSemantics(recipe),
    versions: recipe.release_options.map(option => ({ versionId: option.release_id, observedAt: option.period_end, availableAt: null, checksumSha256: null, mutable: false })),
    source: {
      publisher: "regional-statistics-cdn-v1 registered publisher(s)",
      reference: `regional-statistics://${recipe.dataset_id}/${recipe.indicator_id}/${recipe.layer_key}`,
      lineage: `exact recipe whitelist (${recipe.layer_key}) -> immutable release artifact -> status-aware administrative values -> immutable ${recipe.boundary_version} boundary joined by area_code`,
    },
    access: boundedAccess({
      mode: "public", method: "statistics_snapshot",
      fields: ["release_id", "dataset_id", "indicator_id", "layer_key", "level", "area_code", "area_name", "indicator_name", "unit", "value", "status", "source_status", "source_token", "period_start", "period_end", "boundary_version", "boundary_sha256", "boundary_resource", "geometry", "dimensions", "inputs"],
      filters: ["release_id", "dataset_id", "indicator_id", "layer_key", "level", "area_code", "status", "source_status", "boundary_version"],
      timeFields: ["period_start", "period_end"], maxRowsPerQuery: 100, maxScanRows: 10_000, maxResponseBytes: 1024 * 1024,
    }),
    supportedOperations: ["query_records", "aggregate"],
    adapterId: "regional-statistics-recipe-v1",
  };
}

function valueReceipt(recipe: SocialRecipe, releaseId: string, source: Record<string, unknown>): SourceReceipt {
  const checksum = typeof source.raw_sha256 === "string" && /^[0-9a-f]{64}$/.test(source.raw_sha256) ? source.raw_sha256 : null;
  return {
    sourceId: `regional-statistics:${recipe.layer_key}`,
    version: releaseId,
    acquiredAt: new Date().toISOString(),
    checksumSha256: checksum,
    reference: `regional-statistics://${recipe.dataset_id}/${recipe.indicator_id}/${recipe.layer_key}/${releaseId}`,
  };
}

function boundaryReceipt(recipe: SocialRecipe, resource: string, sha256: string): SourceReceipt {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("STATISTICS_BOUNDARY_CONTRACT_MISMATCH");
  return {
    sourceId: `regional-statistics-boundary:${recipe.boundary_version}:${recipe.level}`,
    version: recipe.boundary_version,
    acquiredAt: new Date().toISOString(),
    checksumSha256: sha256,
    reference: resource,
  };
}

function asMultiPolygon(geometry: GeoJSON.Geometry | null): GeoJSON.MultiPolygon {
  if (!geometry) throw new Error("STATISTICS_BOUNDARY_CONTRACT_MISMATCH");
  if (geometry.type === "MultiPolygon") return geometry;
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  throw new Error("STATISTICS_BOUNDARY_CONTRACT_MISMATCH");
}

/**
 * Compiles every enabled social-statistics recipe into a separate descriptor.
 * A dataset has exactly one indicator/layer identity; releaseId is the only
 * caller-controlled selector, and its dimensions remain recipe-whitelisted.
 */
export function createSocialStatisticsAdapters(
  recipes: readonly SocialRecipe[] = SOCIAL_ENABLED_STATISTICS_RECIPES,
  loader: RegionalStatisticsLoader = loadRegionalStatistics,
): QueryAdapter[] {
  return recipes.map(recipe => {
    const descriptor = socialStatisticsDescriptor(recipe);
    return createAdminStatisticsAdapter(descriptor, async (parameters, signal) => {
      const release = recipe.release_options.find(option => option.release_id === parameters.releaseId);
      if (!release) throw new Error("RELEASE_NOT_ALLOWED");
      const result = await loader({
        datasetId: recipe.dataset_id,
        indicatorId: recipe.indicator_id,
        level: recipe.level,
        dimensions: release.dimensions,
        releaseId: release.release_id,
        layerKey: recipe.layer_key,
        label: recipe.label,
        includeHealth: true,
        allowReleaseFallback: false,
      }, signal);
      if (result.values.release.release_id !== release.release_id
        || result.values.release.dataset_id !== recipe.dataset_id
        || result.values.release.indicator_id !== recipe.indicator_id
        || result.values.area_level !== recipe.level
        || result.values.release.boundary_version !== recipe.boundary_version
        || result.geometryManifest.boundary_version !== recipe.boundary_version
        || result.geometryManifest.level !== recipe.level) throw new Error("STATISTICS_RELEASE_CONTRACT_MISMATCH");
      const featuresByCode = new Map<string, GeoJSON.Feature>();
      for (const feature of result.features) {
        const code = feature.properties?.area_code;
        if (typeof code !== "string" || featuresByCode.has(code)) throw new Error("STATISTICS_BOUNDARY_CONTRACT_MISMATCH");
        featuresByCode.set(code, feature);
      }
      if (result.values.observations.some(observation => !featuresByCode.has(observation.area_code))) {
        throw new Error("STATISTICS_BOUNDARY_CONTRACT_MISMATCH");
      }
      return {
        // The loader materializes every same-version boundary, including areas
        // with no observation.  Keep them as explicit `missing` polygons so a
        // choropleth's coverage is not confused with its observed values.
        rows: result.features.map(feature => {
          const properties = feature.properties;
          const areaCode = properties?.area_code;
          const indicatorName = properties?.indicator_name;
          const unit = properties?.unit;
          const status = properties?.status;
          const value = properties?.value;
          if (typeof areaCode !== "string" || typeof indicatorName !== "string" || typeof unit !== "string"
            || typeof status !== "string" || properties?.boundary_version !== recipe.boundary_version
            || (status === "observed" ? typeof value !== "number" || !Number.isFinite(value) : value !== null)) {
            throw new Error("STATISTICS_BOUNDARY_CONTRACT_MISMATCH");
          }
          const areaName = properties?.area_name;
          return {
          release_id: result.values.release.release_id,
          dataset_id: recipe.dataset_id,
          indicator_id: recipe.indicator_id,
          layer_key: recipe.layer_key,
          level: recipe.level,
          area_code: areaCode,
          area_name: typeof areaName === "string" ? areaName : null,
          indicator_name: indicatorName,
          unit,
          value,
          status,
          source_status: typeof properties?.source_status === "string" ? properties.source_status : null,
          source_token: typeof properties?.source_token === "string" ? properties.source_token : null,
          period_start: result.values.release.period_start,
          period_end: result.values.release.period_end,
          boundary_version: result.values.release.boundary_version,
          boundary_sha256: result.geometryManifest.sha256,
          boundary_resource: result.geometryManifest.resource,
          geometry: asMultiPolygon(feature.geometry),
          dimensions: release.dimensions,
          inputs: properties?.inputs && typeof properties.inputs === "object" ? properties.inputs : null,
        };
        }),
        source: valueReceipt(recipe, release.release_id, result.sources),
        sourceRefs: [boundaryReceipt(recipe, result.geometryManifest.resource, result.geometryManifest.sha256)],
        coverage: JSON.stringify(result.health?.coverage ?? release.coverage),
        freshness: release.health === "CURRENT" ? "current" : release.health === "STALE" ? "stale" : "unknown",
        rowsScanned: Math.max(result.values.total, result.features.length),
      };
    });
  });
}
