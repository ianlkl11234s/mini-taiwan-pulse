/**
 * PF-7：統計配方「同步目錄」派生規則（唯一實作）。
 *
 * 交付的完整配方 JSON（`agriStatisticsRecipes.json`／`socialStatisticsRecipes.json`）仍是 SSOT，
 * 但其中 `release_options` 等大欄位只在開統計圖層／切換期別／研究查詢時才需要，改為 dynamic import。
 * 首屏需要的名稱、群組、圖例、來源與期別摘要由本檔從同一份 SSOT 派生成 `*.catalog.json`：
 * - 產生：`npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts`
 * - 一致性：`src/data/__tests__/statisticsRecipeCatalog.test.ts` 以本函式重算並比對已提交的 catalog。
 * 本檔不得 import 任何配方 JSON，避免把明細拉回首屏。
 */

export interface StatisticsReleaseRef {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
}

export interface StatisticsReleaseSummary {
  /** `release_options.length`（含未公開者；公開與否仍由執行期 release 清單交集決定）。 */
  count: number;
  /** `release_options[0]`（交付原始順序的第一筆，不是最新期）；沒有選項時為 null。 */
  first: StatisticsReleaseRef | null;
  /** 只有選項帶 `dimensions.education_stage` 時才存在；latest 依 period_end、period_start 由新到舊穩定排序。 */
  education_stages?: Record<string, { count: number; latest: StatisticsReleaseRef }>;
}

type ReleaseOptionLike = { release_id: string; period_start: string; period_end: string; dimensions: Record<string, string> };
type RecipeLike = { release_options: readonly ReleaseOptionLike[] } & Record<string, unknown>;
type RecipeDocumentLike = { recipes: readonly RecipeLike[] } & Record<string, unknown>;

/** 只保留 exact selector 身分，不帶 bundle_path／coverage／health 等明細欄位。 */
function releaseRef(option: ReleaseOptionLike): StatisticsReleaseRef {
  return { release_id: option.release_id, period_start: option.period_start, period_end: option.period_end, dimensions: option.dimensions };
}

export function summarizeStatisticsReleaseOptions(options: readonly ReleaseOptionLike[]): StatisticsReleaseSummary {
  const summary: StatisticsReleaseSummary = { count: options.length, first: options[0] ? releaseRef(options[0]) : null };
  const byStage = new Map<string, ReleaseOptionLike[]>();
  for (const option of options) {
    const stage = option.dimensions.education_stage;
    if (typeof stage !== "string") continue;
    byStage.set(stage, [...(byStage.get(stage) ?? []), option]);
  }
  if (byStage.size > 0) {
    summary.education_stages = Object.fromEntries([...byStage].map(([stage, stageOptions]) => {
      const latest = [...stageOptions].sort((a, b) => b.period_end.localeCompare(a.period_end) || b.period_start.localeCompare(a.period_start))[0]!;
      return [stage, { count: stageOptions.length, latest: releaseRef(latest) }];
    }));
  }
  return summary;
}

/**
 * 目錄 = 完整文件去掉 `omitRecipeKeys`（預設連 release_options 一起移除，並加上 release_summary）。
 * `keepReleaseOptions`（PF-10 勞動）：release_options 首屏就要用且很小，原樣保留、不加 summary，只去掉 omitRecipeKeys。
 */
export function deriveStatisticsRecipeCatalog(
  document: RecipeDocumentLike,
  omitRecipeKeys: readonly string[],
  generatedFrom: string,
  options: { keepReleaseOptions?: boolean } = {},
): Record<string, unknown> {
  const omit = new Set(options.keepReleaseOptions ? omitRecipeKeys : ["release_options", ...omitRecipeKeys]);
  return {
    ...document,
    catalog_generated_from: generatedFrom,
    catalog_generator: "src/data/statisticsRecipeCatalog.ts via scripts/statistics/build_statistics_recipe_catalogs.ts",
    recipes: document.recipes.map((recipe) => ({
      ...Object.fromEntries(Object.entries(recipe).filter(([key]) => !omit.has(key))),
      ...(options.keepReleaseOptions ? {} : { release_summary: summarizeStatisticsReleaseOptions(recipe.release_options) }),
    })),
  };
}

/**
 * 各家族從目錄移到明細的欄位；目錄與明細一致性測試共用這份設定。
 * - agri／social：明細（release_options 等）由 statisticsRecipeDetails 依家族 dynamic import。
 * - labor（PF-10）：release_options 首屏即用（STATISTICS_RECIPES 的 frequency／dimensions）故保留；
 *   `fragment_context` 是交付紀錄，前端執行期無讀取者，只留在交付 JSON（SSOT），不進 bundle。
 * - environment：同 labor 保留 release_options（STATISTICS_RECIPES 預設 dimensions 與期別白名單首屏即用）；
 *   `delivery`（breaks 依據、raw SHA、coverage 收據）只留在交付 JSON。
 * - demographics：同 labor 保留 release_options；`fragment_context`／`source_fragment` 是交付收據，只留在交付 JSON。
 * - addiction：同 environment 保留 release_options；`delivery`（breaks 依據、觀察狀態計數、raw SHA 收據）只留在交付 JSON。
 * - landslide：同 addiction 保留 release_options；`delivery`（觀察狀態計數、raw SHA 收據）只留在交付 JSON。
 * - comparison 不拆：172/188 筆只有 1 個 release_option，改 summary 反而更大；其餘欄位首屏皆需要。
 */
export const STATISTICS_RECIPE_CATALOG_SPECS = [
  { family: "agri", source: "src/data/agriStatisticsRecipes.json", catalog: "src/data/agriStatisticsRecipes.catalog.json", omitRecipeKeys: [], keepReleaseOptions: false },
  { family: "social", source: "src/data/socialStatisticsRecipes.json", catalog: "src/data/socialStatisticsRecipes.catalog.json", omitRecipeKeys: ["fragment_context"], keepReleaseOptions: false },
  { family: "labor", source: "src/data/laborStatisticsRecipes.json", catalog: "src/data/laborStatisticsRecipes.catalog.json", omitRecipeKeys: ["fragment_context"], keepReleaseOptions: true },
  { family: "environment", source: "src/data/environmentStatisticsRecipes.json", catalog: "src/data/environmentStatisticsRecipes.catalog.json", omitRecipeKeys: ["delivery"], keepReleaseOptions: true },
  { family: "demographics", source: "src/data/demographicsStatisticsRecipes.json", catalog: "src/data/demographicsStatisticsRecipes.catalog.json", omitRecipeKeys: ["fragment_context", "source_fragment"], keepReleaseOptions: true },
  { family: "addiction", source: "src/data/addictionStatisticsRecipes.json", catalog: "src/data/addictionStatisticsRecipes.catalog.json", omitRecipeKeys: ["delivery"], keepReleaseOptions: true },
  { family: "landslide", source: "src/data/landslideStatisticsRecipes.json", catalog: "src/data/landslideStatisticsRecipes.catalog.json", omitRecipeKeys: ["delivery"], keepReleaseOptions: true },
] as const;
