# 崩塌 Landslide

> **Slug**：`landslide`（analytics topic：`hazards`／landslide pipeline）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：見 changelog.md

## 一句話說明

把崩塌相關的四組資料接上地圖：縣市崩塌統計、大規模崩塌潛勢區與影響範圍、省道歷史災情、年度全島崩塌地。

## 圖層

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| 崩塌筆數（`statsLandslideCountCounty`） | 縣市 choropleth | R2 statistics `landslide_area_county` | ✅ |
| 崩塌面積（`statsLandslideAreaCounty`） | 縣市 choropleth | R2 statistics `landslide_area_county` | ✅ |
| 治山防災工程總經費（`statsSlopeWorksCostCounty`） | 縣市 choropleth | R2 statistics `slope_treatment_works_county` | ✅ |
| 水土保持災害總損失（`statsSwcDisasterLossCounty`） | 縣市 choropleth | R2 statistics `swc_disaster_loss_county` | ✅ |
| 崩塌地處理面積（`statsSlopeWorksCollapsedLandCounty`） | — | R2 已有，recipe `enabled:false` | ⛔ 不上地圖（疑混單位離群值） |
| 大規模崩塌潛勢區（`landslideDodAreas`） | polygon | `public/hazards/landslide_dod_areas.geojson`（git） | ✅ |
| 大規模崩塌影響範圍（`landslideDodImpact`） | polygon | `public/hazards/landslide_dod_impact.geojson`（git） | ✅ |
| 省道歷史災情（`highwayDisasterHistory`） | point | `public/hazards/highway_disaster_history.pmtiles`（git，5.5MB） | ✅ |
| 年度全島崩塌地（`landslideAnnual`） | polygon | `hazards/landslide_annual_swcb_20261006.pmtiles`（S3 deploy-assets，107MB） | ✅ |

## 關鍵檔案

- 統計：`scripts/statistics/build_landslide_statistics_recipes.py` → `src/data/landslideStatisticsRecipes.{json,catalog.json,ts}`
- 靜態前處理：`scripts/preprocess/build-landslide-public.py`
- 類型／色票／篩選：`src/data/landslideTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（`LANDSLIDE_OVERLAYS`）；點擊：`src/map/gisClickRegistry.ts`
- Popup：`src/components/featureInfo/landslidePanels.tsx`；Legend：`src/components/legend/landslideLegends.tsx`
- 部署：`scripts/deploy/upload-deploy-assets.sh`（hazards 年度崩塌地 immutable 段）

## 資料限制（UI 都有標）

- 崩塌面積 2016→2017 推測有系列斷點；2019 年面積由 m² 換算；年度數字不一定反映當年颱風。
- 水土保持災害損失缺 2011–2018 與 2021 年，單位推定千元（來源未標示）。
- 治山防災工程早年只列部分縣市，未列顯示「未列」不是 0。
- 省道歷史災情 2018 年起通報筆數暴增約 10 倍，疑為通報制度改變；2026 為不完整年度。
- 年度全島崩塌地只有 2017／2018／2023／2024；2024 為 V2 版，與縣市統計 2024 不一致；z10 以下不顯示（低縮放切片遺漏小面）。

## 資料契約摘要

看 [handoff.md](./handoff.md)。
