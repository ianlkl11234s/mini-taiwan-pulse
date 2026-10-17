# Handoff — landslide（下游視角）

> **上游 SSOT**：taipei-gis-analytics `docs/data-catalog/hazards/{landslide_area_county,landslide_dod_areas,landslide_dod_impact,highway_disaster_history,landslide_annual_swcb}.md` 與各 dataset `_manifest.json`。
> analytics `docs/handoff/` 目前沒有 landslide 專檔（2026-10-06 查無），本檔只反向引用 data-catalog。

## 上游產物

| 產物 | analytics 路徑 | 前端交付 |
|---|---|---|
| 縣市統計 3 dataset／5 indicator／102 release | `data/processed/hazards/{landslide_area_county,slope_treatment_works_county,swc_disaster_loss_county}/releases/*.json`；recipes `output/landslide/statistics-recipes.json` | R2 `statistics/v1`（manifest 672bf8cb…，102/102 selector 對上）→ `build_landslide_statistics_recipes.py` |
| 大規模崩塌潛勢區／影響範圍 | `data/processed/hazards/landslide_dod_{areas,impact}/*_20261006.geojson` | `build-landslide-public.py` → `public/hazards/*.geojson` |
| 省道歷史災情 | `data/processed/hazards/highway_disaster_history/highway_disaster_history_20261006.geojson` | 同腳本 → `public/hazards/highway_disaster_history.pmtiles`（z5–12，逐 zoom 16,163 點） |
| 年度全島崩塌地 | `data/processed/hazards/landslide_annual_swcb/landslide_annual_swcb_20261006.pmtiles`（layer `landslide_annual`） | 原檔複製 → S3 `deploy-assets/hazards/`（sha256 70af26c1…，107,476,430 B） |

## 硬依賴欄位（改一定爆）

- 統計：release_id／period／boundary `COUNTY_MOI_1140318` 為 exact whitelist；dataset_id／indicator_id／unit（筆、公頃、元、千元）。
- 潛勢區／影響範圍：`year_roc`（數字，年度篩選）、`risk`（高／中／低）、`feature_id`、`dwelling_count`／`total_res`。
- 省道：`category_sub`（腳本分 8 族，未知值直接中止）、`year`（數字）、`feature_id`。
- 年度崩塌地：`year`（2017／2018／2023／2024）、`area_ha`、`slope`（度）、`min_dtm`（公尺，-32767＝缺）、`image_date`。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 統計新年度 release | 重跑 build script + `build_statistics_recipe_catalogs.ts`，契約測試的筆數跟改 |
| 損失單位經機關確認 | build script 改 `swcDisasterLoss` 的 extra disclosure／display note |
| 新潛勢區年度版（116） | `landslideTypes.ts DOD_YEARS`、腳本 nid 由 manifest 自動帶 |
| 省道新 category_sub | 腳本 `HIGHWAY_GROUPS` 與 `landslideTypes.ts HIGHWAY_CATEGORY_GROUPS` |
| 年度崩塌地新年份 | 新日期檔名重上 S3（immutable，不覆寫舊檔）、`ANNUAL_YEARS`、manifest url |
