# Handoff — addiction-statistics（下游視角）

> **上游 SSOT**：`taipei-gis-analytics/docs/handoff/addiction-statistics-frontend.md`（第三輪見 §9）＋`docs/handoff/addiction-statistics-recipes.json`
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：R2 `https://data.itsmigu.com/statistics/v1`（`current.json` → manifest；第三輪 live manifest `5f6d76b4…`），前端只走 R2，不 proxy 本機 bundle
- 規模（2026-10-06 第三輪）：8 dataset、78 recipes（enabled 74、disabled 4）、313 exact selector（全數在 R2 manifest 核對過）
- 邊界：縣市 `COUNTY_MOI_1140318`、鄉鎮 `TOWN_MOI_1140318`、地檢署轄區 `PROSECUTOR_DISTRICT_TOWN_MOI_1140318_v1`（level `prosecutor_district`，22 面，`area_code`＝`PD_xxx`）；geometry 依 manifest `geometries[]` 的 boundary_version＋level 載入，不寫死 sha
- 座標系統：WGS84

## 前端接線位置

- 交付 → 前端：`scripts/statistics/build_addiction_statistics_recipes.py --recipes <analytics>/docs/handoff/addiction-statistics-recipes.json --processed <analytics>/data/processed` → `src/data/addictionStatisticsRecipes.json` → `npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts`
- Recipes／群組／圖例狀態：`src/data/addictionStatisticsRecipes.ts`（`ADDICTION_ENABLED_STATISTICS_KEYS` 順序＝sidebar 順序）
- Loader：`src/data/regionalStatisticsLoader.ts`（`StatisticsLevel` 含 `prosecutor_district`）
- Popup：`src/components/featureInfo/regionalStatisticsPanel.tsx`（`area_code` 以 `PD_` 開頭時改標「地檢署轄區」並列涵蓋縣市）
- Legend／說明：`src/components/sidebar/StatisticsDetails.tsx`；邊界中文名：`src/data/statisticsLabels.ts`
- 契約測試：`src/data/__tests__/addictionStatisticsContract.test.ts`

## 硬依賴欄位（改一定爆）

- recipe：`layer_key`、`enabled`、`dataset_id`、`indicator_id`、`level`、`boundary_version`、`unit`、`release_options`、`default_release`、`breaks`、`pair_raw_key`、`display_priority`
- builder 的 `PRESENTATION` 與交付 `layer_key` 必須集合相等，否則 builder 直接中止
- R2 geometry（地檢署轄區）：`area_code`、`area_name`（地檢署全銜）、`counties`、`township_count`（popup 用）
- observation `status`：`observed`／`missing`／`not_applicable`／`suppressed`，非 observed 一律不上數值色

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 新增 recipe | builder `PRESENTATION`（服務據點走 `SERVICE_CATEGORIES`）、`ADDICTION_ENABLED_STATISTICS_KEYS`、`statisticsVisuals.ts` 的 `ADDICTION_KEY_ICONS`、契約測試數字、golden fixture |
| release 換版（更正版） | 重跑 builder；契約測試的 selector 期望值 |
| 新 boundary type | `StatisticsLevel`、`LEVEL_LABELS`、`BOUNDARY_VERSION_LABELS`＋`BOUNDARY_CODE`、`layerManifest.ts` 的 `ADDICTION_LEVEL_QUALIFIERS`、`statisticsDataSources.ts` 層級名 |
| 新 `display_priority` 組合 | primary 層排在 secondary 前面（sidebar 先出現、群組 lead） |
| 新非數值狀態 | builder `DATASETS` 的 status 圖例文字 |

## 已知不對稱

- 地檢署轄區層（primary）自成一列「地檢署毒品案件新收（22 地檢署轄區）」，排在原「地檢署毒品案件新收」縣市列（secondary，14 署＋8 縣市不適用）前面；兩列各自切換 5 個指標。沒有合成同一列，是為了不改動既有縣市列的選單（golden 只新增）。
- R2 catalog card 的 `default_release_id` 仍指舊版（publisher 限制）；前端照 recipes 的 whitelist，不讀 catalog default。
- 統計 popup 下方「資料來源・來源資訊待補」是 regionalStatistic popup 的既有行為（縣市層同樣），來源揭露在 popup 的「來源」列與 Statistics 說明・來源卡。
