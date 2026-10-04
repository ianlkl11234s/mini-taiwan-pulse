# Changelog — 人口統計

## 2026-10-04（村里）

- 加入村里 20 層（戶籍人口 4、年齡結構 12、原住民 4），只有 115 年 8 月一期 × `VILLAGE_NLSC_1150817`；作為既有群組列的「村里」選項，從其他期別切入時落到 11508。builder 改讀 `village-statistics-recipes.json`（只收 demographics 村里 recipe，依 dataset 插在縣市／鄉鎮之後）。
- 邊界中文名：`VILLAGE_NLSC_1150817`、`VILLAGE_SEGIS_112`；村里 disclosure 內的代碼改顯示中文；來源總覽補村里界線來源。
- 勞動 `statsLaborVillageIncomeMedian` 改指 `village-income-median-112-segis112` × `VILLAGE_SEGIS_112`（7,604/7,748）；圖例維持現行 8 階固定門檻。
- delivery 測試：村里另以 `output/village-statistics-preview` 增量包驗證（人口 20 selectors、勞動村里 1 selector）。

## 2026-10-04（P3–P6）

- 加入人口動態（30）、遷徙（14）、原住民（8）、外來人口（13）共 65 層；群組 21 列。
- 年初累計改標「115 年 1–8 月累計」、獨立成列；可正可負指標用 PuOr 雙向色階。
- 「資料可用狀態」代碼加白話說明（CURRENT／STALE／PARTIAL）。
- P6 來源卡依 data.gov.tw 頁標示 OGDL v1；其餘 RIS 維持「授權條款待確認」。

## 2026-10-04

- 新增 `demographics` statistics family：戶籍人口 8 層＋年齡結構 24 層（縣市／鄉鎮），9 群組列。
- DEV preview `VITE_DEMOGRAPHICS_STATISTICS_PREVIEW`／`DEMOGRAPHICS_STATISTICS_PREVIEW_PORT`（預設 3763）。
- `statisticsPeriodLabel`：period_start＝period_end 時顯示「日期（時點）」。
- 本地 browser QA：單層、期別切換、原始／比例、缺值斜線＋圖例、來源總覽、390×844、全關；代表值臺北市 11412 65+ 24.18%。
