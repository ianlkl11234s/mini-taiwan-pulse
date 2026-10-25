# Changelog — 死因統計 Mortality Statistics

## 2026-10-24 · 接線（G20）

分支 `feat/g20-mortality-layers`（自 `origin/develop`，worktree `.worktrees/g20-mortality`）。

- 新增 `scripts/statistics/build_mortality_statistics_recipes.py`，產出 `src/data/mortalityStatisticsRecipes.{json,catalog.json,ts}`：6 層、3,863 selector。
- `statisticsRecipeDetails.ts`／`atlasStatisticsRecipes.ts`：按需載入家族從 taipeiAgency 泛化成 `ATLAS_LAZY_FAMILIES`。
- i18n 英日文：層名、群組、死因 43 值、性別、圖例說明 12 則、位置口徑。
- 測試：`mortalityStatisticsContract.test.ts`（新）、statisticsText 外文不混中文、golden／inventory 重產。

## 2026-10-24 · 開 PR

- PR #689（base develop），merge c0a20ee1，2026-10-24。
