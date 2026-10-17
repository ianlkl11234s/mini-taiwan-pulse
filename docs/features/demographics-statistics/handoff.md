# Handoff — 人口統計（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/household-registration-population-frontend.md`、`population-age-structure-frontend.md`（含 recipes／boundaries JSON）。本檔只記前端接線差異。

- 收錄：只收 `enabled: true`（P0–P6 縣市＋鄉鎮 97 recipes、620 exact selectors）；各 dataset handoff 的村里 recipes 仍 HOLD。村里 20 recipes 改由 `docs/handoff/village-statistics-recipes.json` 提供（只 11508 × `VILLAGE_NLSC_1150817`；同檔的勞動村里 recipe 不收，由 `laborStatisticsRecipes.json` 手動對齊）。
- 本地預覽根：analytics `output/demographics-statistics-preview/cdn/v1`（`assemble_demographics_preview.py` 合併；artifact／geometry 逐位元組複製、SHA 不變，只有合併 manifest 為新檔）。不是可發布的全量 manifest。
- 村里：analytics `output/village-statistics-preview/cdn/v1`（增量包，2 geometry＋21 artifact）已於 2026-10-04 增量發布到 production（manifest `f8cdd6bb…`，7 geometries／5,505 selectors）；瀏覽器驗證直接用 production CDN。舊 demographics DEV preview route 看不到村里層，不再需要。
- 正式發布：須另行授權，以增量方式合入線上全量 manifest、沿用線上 geometry（`COUNTY_MOI_1140318` 3feeca87…、`TOWN_MOI_1140318` 80749d60…），不得上傳本地重序列化 geometry。

## 加入 P3–P6（vital_events／migration／indigenous／foreign_origin）

1. analytics：`assemble_demographics_preview.py` 參數加上新 slug，重產預覽。
2. pulse：`scripts/statistics/build_demographics_statistics_recipes.py` 的 `HANDOFFS` 加 slug → 執行 builder → `npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts`。
3. `demographicsStatisticsRecipes.ts` 的 `DEMOGRAPHICS_ENABLED_STATISTICS_KEYS` 補 key（contract test 會擋漏）。
4. 視需要在 `GROUP_SPECS` 加群組列（未列者自動一指標一群組）、`INDICATOR_NOTES` 加口徑說明、`statisticsVisuals.ts` `DEMOGRAPHICS_ICONS` 加 icon（未列者用 Users）。
5. 更新測試計數（statisticsVisuals、layerGoldenSnapshot、contract），重生 layer-golden 並逐行 review。
