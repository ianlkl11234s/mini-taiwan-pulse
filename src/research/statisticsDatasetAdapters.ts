import { SOCIAL_ENABLED_STATISTICS_RECIPES, type SocialRecipe } from "../data/socialStatisticsRecipes";
import { loadRegionalStatisticsValues } from "../data/regionalStatisticsLoader";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import { createAdminStatisticsAdapter } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

type RegionalValuesLoader = typeof loadRegionalStatisticsValues;

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
      { name: "value", type: "number", nullable: true, nullMeaning: "由 status、source_status、source_token 區分 suppressed、not_reported 或 missing；不得轉為零。", unit: recipe.unit },
      { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "source_status", type: "string", nullable: true, nullMeaning: "來源未另提供狀態。", unit: null },
      { name: "source_token", type: "string", nullable: true, nullMeaning: "observed 數值通常沒有原始缺值符號。", unit: null },
      { name: "period_start", type: "datetime", nullable: false, nullMeaning: null, unit: null },
      { name: "period_end", type: "datetime", nullable: false, nullMeaning: null, unit: null },
      { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "dimensions", type: "json", nullable: false, nullMeaning: null, unit: null },
      { name: "inputs", type: "json", nullable: true, nullMeaning: "來源未提供組成輸入或衍生值明細。", unit: null },
    ],
    geometry: { type: "none", crs: null, role: "none", precision: recipe.boundary_semantics ?? "數值紀錄沒有 geometry；呈現時必須使用同版行政邊界 join。", spatialAnalysisEligible: false },
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
      lineage: `exact recipe whitelist (${recipe.layer_key}) -> immutable release artifact -> status-aware administrative values; boundary ${recipe.boundary_version} is a separate display join`,
    },
    access: boundedAccess({
      mode: "public", method: "statistics_snapshot",
      fields: ["release_id", "dataset_id", "indicator_id", "layer_key", "level", "area_code", "value", "status", "source_status", "source_token", "period_start", "period_end", "boundary_version", "dimensions", "inputs"],
      filters: ["release_id", "dataset_id", "indicator_id", "layer_key", "level", "area_code", "status", "source_status", "boundary_version"],
      timeFields: ["period_start", "period_end"], maxRowsPerQuery: 100, maxScanRows: 10_000,
    }),
    supportedOperations: ["query_records", "aggregate"],
    adapterId: "regional-statistics-recipe-v1",
  };
}

function receipt(recipe: SocialRecipe, releaseId: string, source: Record<string, unknown>): SourceReceipt {
  const checksum = typeof source.raw_sha256 === "string" && /^[0-9a-f]{64}$/.test(source.raw_sha256) ? source.raw_sha256 : null;
  return {
    sourceId: `regional-statistics:${recipe.layer_key}`,
    version: releaseId,
    acquiredAt: new Date().toISOString(),
    checksumSha256: checksum,
    reference: `regional-statistics://${recipe.dataset_id}/${recipe.indicator_id}/${recipe.layer_key}/${releaseId}`,
  };
}

/**
 * Compiles every enabled social-statistics recipe into a separate descriptor.
 * A dataset has exactly one indicator/layer identity; releaseId is the only
 * caller-controlled selector, and its dimensions remain recipe-whitelisted.
 */
export function createSocialStatisticsAdapters(
  recipes: readonly SocialRecipe[] = SOCIAL_ENABLED_STATISTICS_RECIPES,
  loader: RegionalValuesLoader = loadRegionalStatisticsValues,
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
        || result.values.release.boundary_version !== recipe.boundary_version) throw new Error("STATISTICS_RELEASE_CONTRACT_MISMATCH");
      return {
        rows: result.values.observations.map(observation => ({
          release_id: result.values.release.release_id,
          dataset_id: recipe.dataset_id,
          indicator_id: recipe.indicator_id,
          layer_key: recipe.layer_key,
          level: recipe.level,
          area_code: observation.area_code,
          value: observation.value,
          status: observation.status,
          source_status: observation.source_status ?? null,
          source_token: observation.source_token ?? null,
          period_start: result.values.release.period_start,
          period_end: result.values.release.period_end,
          boundary_version: result.values.release.boundary_version,
          dimensions: release.dimensions,
          inputs: observation.inputs ?? null,
        })),
        source: receipt(recipe, release.release_id, result.sources),
        coverage: JSON.stringify(result.health?.coverage ?? release.coverage),
        freshness: release.health === "CURRENT" ? "current" : release.health === "STALE" ? "stale" : "unknown",
        rowsScanned: result.values.total,
      };
    });
  });
}
