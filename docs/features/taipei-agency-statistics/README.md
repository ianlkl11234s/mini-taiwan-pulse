# 臺北市局處統計 Taipei City Agencies

> **Slug**：`taipei-agency-statistics`（analytics `docs/topic-research/taipei_agency_statistics/`）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：#664（merge 00c1ca70；見 changelog.md）

## 一句話說明

把臺北市局處公務統計的 5 個鄉鎮層 dataset（環保局垃圾清運／資源回收、衛工處污水接管、產業局工廠登記、建管處使用執照；臺北市 12 區 × 月）接上 Statistics，做成 11 個分區 choropleth。資料已在 Supabase 與 R2 統計 CDN（analytics PR #195），本批只動前端，不重發 R2。

## 放在哪裡

| 位置 | 內容 |
|---|---|
| Statistics 分頁 | 不再自成一類（2026-10-23 分類調整）：資源回收、垃圾清運併入「環境與資源」的「廢棄物與回收」；污水接管併入「水質與污水」；工廠家數併入「工作與所得」；使用執照併入「住宅與不動產」（後兩者各開小群組「臺北市 12 區（月）」） |
| Layers 完整目錄 | 各併入「資源回收統計」「廢棄物統計」「水質與污水統計」「工作與所得」「住宅存量與使用」，皆在小群組「臺北市 12 區（月）」 |
| 資料檔 | `src/data/taipeiAgencyStatisticsRecipes.json`（交付 SSOT，含 `delivery` 收據）＋`.catalog.json`（首屏目錄）＋`taipeiAgencyStatisticsRecipes.ts`（key 順序） |
| 產生器 | `scripts/statistics/build_taipei_agency_statistics_recipes.py`（讀 analytics `docs/handoff/taipei-agency-statistics-recipes.json` 與每個 release bundle 逐一核對）→ `npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts` |

接法同治安統計：用 atlas recipe 型別當一個家族掛進 `atlasStatisticsRecipes.ts` 的 `FAMILIES`，loader、期別白名單、連動選單、圖例、說明・來源、資料來源總覽、目錄都走 atlas 共用路徑。

## 圖層（11）

| layer key | 指標（indicator） | 單位 | 色階（淺→深＝低→高，固定門檻） | 期別 |
|---|---|---|---|---|
| `statsTaipeiResourceRecyclingTownship` | 各區清潔隊資源回收量 `resource_recycling_tonnes` | 公噸 | 環境 BuPu；250／350／450／550 | 94-01～115-09 |
| `statsTaipeiGarbageCollectedTownship` | 各區清潔隊清運垃圾量 `garbage_collected_tonnes` | 公噸 | 環境 BuPu；2000／2500／3000／3500 | 92-01～115-09 |
| `statsTaipeiSewerRatePublicTownship` | 門牌戶數接管普及率（公共污水下水道）`…_public_from_10805` | % | 公用事業 GnBu；70／80／85／90 | 108-05～115-09（月底累計） |
| `statsTaipeiSewerRateLegacyTownship` | 門牌戶數接管普及率（舊公式，含自設專用）`…_incl_dedicated_to_10804` | % | 同上 | 100-01～108-04 |
| `statsTaipeiFactoryCountTownship` | 登記工廠家數（合計）`factory_count_total` | 家 | 工作與所得；5／10／50／100 | 92-02～115-09（缺 12 期） |
| `statsTaipeiFactoryCountByIndustryTownship` | 登記工廠家數（依產業中類）`factory_count_by_industry` | 家 | 同上；1／3／10／25（0 自成一級）；預設 26 電子零組件 | 96-01～115-09 |
| `statsTaipeiUsagePermitCountTownship` | 核發使用執照件數（合計）`permit_count_total` | 件 | 住宅 Oranges；1／2／3／5 | 2001-01～2026-09 |
| `statsTaipeiUsagePermitCountByBuildTypeTownship` | 核發使用執照件數（依建造類別）`permit_count_by_build_type` | 件 | 同上；預設「新建」 | 同上 |
| `statsTaipeiUsagePermitBuildingCountTownship` | 核發使用執照棟數 `building_count` | 棟 | 同上 | 同上 |
| `statsTaipeiUsagePermitHouseholdCountTownship` | 核發使用執照戶數 `household_count` | 戶 | 1／25／75／150 | 同上 |
| `statsTaipeiUsagePermitBuildingAreaTownship` | 核發使用執照建築面積 `building_area` | 平方公尺 | 1／300／1000／3000 | 同上 |

門檻依最近 24 個月 12 區 observed 值分布取整，跨月固定（`delivery.breaks_basis`）；污水普及率依 layer-plan 用固定百分比區間。

交付 18 個鄉鎮 recipe，只接 layer-plan 建議上色的 11 個。沒上圖的 7 個（污水接管的分子分母戶數：公共、專用、自設處理設施 × 新舊分類，加門牌總戶數）layer-plan 寫「不上色、只在彈窗顯示」，atlas 形狀沒有彈窗專用指標，本批不做；資料仍在 DB 與分析倉庫。公車 5 個縣市層 dataset（30 recipe）照指示不做地圖。

## 呈現規則

- **只涵蓋臺北市 12 區**：其他 356 個鄉鎮沒有 observation，地圖以缺值斜線呈現，圖例第一行「只涵蓋臺北市 12 區；其他縣市鄉鎮為未涵蓋，不是 0」，缺值列寫「未涵蓋（…不是 0）」。建築面積（136 格）與棟數（1 格）在臺北市內也有缺值，這兩層缺值列寫「未涵蓋或無資料」。loader 沒有「未涵蓋」專用狀態（`source_not_covered` 只給 labor），不另加特例。
- **圖例逐行說明**（`legend.notes`，英日文 `enum.statLegendNote.*`）：
  - 垃圾：12 區加總不等於全市清運量（區隊量含巨大垃圾、不含回運垃圾量，全市另計直屬隊等）；垃圾與回收都「依清運責任區統計，不等於居民產生量」。
  - 污水：月底累計、分母＝民政局門牌總戶數；108 年 5 月起公式與分類改變，拆成兩個口徑（兩層）不可串接；與縣市版「公共污水下水道用戶接管普及率」口徑不同（縣市版臺北市約 100%，衛工處門牌基準 113-12 為 82.8%）。
  - 工廠：「-」＝0 家（真零）；缺 12 個月不補前月；92–95 年只有合計；產業分項 96-01 起。
  - 使用執照：一張計 1 件、跨區或無地址（約 0.64%）不計入；件數逐張計，95 年起比主計處年表多 6～21%；核發不等於完工入住或新增供給；建築面積是投影面積、不是總樓地板面積。
- **期別**：`roc_year`／`month` 留在每個 option 的 dimensions（CDN selector 身分），但不宣告成使用者維度，所以只有「資料期別」一個下拉（產業別、建造類別多一個維度）。`industry_name` 跟著 `industry_code` 走。月資料期別顯示沿用共用格式（`2026-09-01 — 2026-09-30`；月底累計為「2026-09-30（時點）」）。
- 原始數／比例：本家族沒有衍生比例（普及率是來源發布值，`derived: false`），群組選單標「指標」。
- 共用圖例「各維度組合各有一組門檻」原本只看有沒有維度；本家族產業別、建造類別共用同一組門檻，所以改成 recipe 真有 `by_dimension` 才顯示（既有家族都有 `by_dimension`，文字不變）。
- 時間軸：同所有統計家族，以「期別」下拉切月份，不接全域時間軸。

## 未解事項

- 使用執照月值很小（每區每月常 0–10 件），layer-plan 建議的「近 12 個月累計」視圖需要前端加總，本批未做。
- 污水分子分母戶數只在 DB／倉庫，前端沒有彈窗專用指標的機制。
- 月資料期別下拉有 89～309 項，沒有「年→月」兩段式選單。
- ~~首屏體積~~：2026-10-23 已改按需載入（見下「目錄按需載入」）。切換產業的耗時未另外優化。

## 英日文（2026-10-23）

圖層名在 `src/i18n/locales/{en,ja}/layers.json`（`layer.<key>`，照治安前例手寫，不由產生器出）；群組名 `enum.statGroup`、維度與選項 `enum.statDim.industry_code`／`build_type` 與 `enum.statDimValue.<維度>.<值>`、位置口徑 `enum.statLocationBasis`、機關 `enum.statPublisher`（環保局、產業局走通用機關規則）、授權 `enum.statLicense`、小群組 `theme.*`。日文沿用既有「台北市」寫法；`飲料製造業`、`家具製造業` 日文與中文同形，也登記在表裡。檢查在 `src/i18n/__tests__/statisticsText.test.ts`「臺北市局處統計外文介面不混中文」。

## 目錄按需載入（2026-10-23）

- `STATISTICS_RECIPE_CATALOG_SPECS` 的 taipeiAgency 改 `keepReleaseOptions: false, periodCount: true`：catalog 只帶 `release_summary`（selector 數、`period_count`），40 KB。首屏「N 個已交付期別」頻率字串改讀 `period_count`，與舊算法同值（`enum.statFrequency` 譯文不動）。
- 完整交付 JSON 由 `statisticsRecipeDetails.ts` 的 `taipeiAgency` 家族 dynamic import（loadingRegistry「載入臺北市局處統計配方明細」）。atlas 共用接點用 `atlasRecipeReleaseOptions(recipe)` 讀 selector：其他 atlas 家族照舊讀目錄，本家族讀明細，未載入丟 `STATISTICS_RECIPE_DETAILS_NOT_LOADED`。
- 觸發點與 agri／social 相同：loader（開圖層）、連動選單（`statisticsLinkedSelect`）、說明・來源（`StatisticsDetails`）、群組切換（`medicalStatisticsSelection`）。未開啟時期別選單維持「尚未載入」，開啟後明細未到顯示「載入中」。
- 量測（`npm run build`）：首屏 preload 的 `statisticsText-*.js` raw 4,671,263 → 2,933,632、gzip 446,405 → 353,075；preload JS 合計 raw 11,146,226 → 9,408,973、gzip 2,275,844 → 2,182,664；按需 chunk `taipeiAgencyStatisticsRecipes-*.js` raw 3,674,491／gzip 165,838（含 `delivery` 收據，照 agri 前例載完整交付檔）。

## 分類調整（2026-10-23）

原本獨立的「臺北市局處統計」主題移除，改依主題放到各自全國縣市版旁邊。位置由 recipe 欄位決定（`data_theme`＝Layers 完整目錄主題、`tab_theme`＝Statistics 分頁主題、`subgroup`＝小群組、選填 `tab_group`＝Statistics 分頁要併入的既有小群組）；`layerCatalog.ts` 的 `foldAtlasDataThemes`／`mergeAtlasGroups` 負責併入同名主題與群組。圖層 key、資料、色階、圖例皆未變。
