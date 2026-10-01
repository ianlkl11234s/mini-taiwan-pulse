# Changelog — environment-statistics

## 2026-10-02 — 第二階段：SSOT 重產、四個靜態水質圖層、瀏覽器驗收

- 以 analytics `docs/handoff/environment-statistics-recipes.json` 重產 recipe：37 層、224 releases、1,018 selectors，release_id／unit／default／breaks／dimension 與前一版完全一致；位置口徑改用上游較保守的文字，資料限制補上參考縣界句。產生器同時接受 handoff 與 frontend_recipes 兩種 schema；handoff 的 `enabled: false` 不採用（見 handoff）。
- 新增 4 個一般 GIS 圖層（環境氣候 Environment →「水質與污水 Water Quality」）：`riverRpiStations`、`waterQualityStations`、`sewageTreatmentPlants`、`drinkingWaterProtectionZones`。資產放 `public/environment/`（隨 dist，nginx `/environment/` 已有 dist fallback）；色票與 filter 在 `src/data/environmentLayerTypes.ts`。
- 四鐵則：透明度＋大小滑桿、RPI 等級／測站類型原生 select、四個圖例、四個 popup（自帶人類可讀來源 footer）。
- 瀏覽器（cmux WKWebView 1440×900、390×844）：四個靜態層渲染與 popup、「<」低於偵測極限、無讀值中空點、位置不確定污水廠；R2 已有資料，5 個統計層正常上色，期別／細項切換、原始↔每萬人保留同期同細項、每列管設施 2024 拒絕切換並提示；console 0 error。
## 2026-10-02 — 本地 frontend wiring（production R2 待發布）

- 新增 37 個環境統計 layer key、1,018 個 exact selector；家族 `environment` 加入 recipe catalog 規格。
- 接線：`regionalStatisticsRecipes`、`statisticsLayerRegistry`、`layerManifest`、`layerParamsSpec`（透明度）、`types`、`statisticsVisuals`、`statisticsDataSources`（原始／衍生來源卡）、`LegendPanel`、`regionalStatisticsLoader`、`StatisticsDetails`、`regionalStatisticsPanel`、`medicalStatisticsGroups`／`medicalStatisticsSelection`、`layerCatalog`。
- Statistics details 新增環境家族的「資料期別」＋「細項」雙 select；細項標籤由 recipe 的 dimension options 派生，不顯示來源 token。
- 8 組原始數／比例 toggle＋1 組公害陳情頻率原表「指標」toggle。
- 自來水不合格二元圖例；環境 BuPu／公用事業 GnBu。
- 測試：新增 `environmentStatisticsContract.test.ts`（9）；更新 statisticsVisuals（345/357）、statisticsTabCatalog、layer golden（851）、StatisticsDetails。
