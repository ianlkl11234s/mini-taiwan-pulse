# Changelog — 人口統計

## 2026-10-04

- 新增 `demographics` statistics family：戶籍人口 8 層＋年齡結構 24 層（縣市／鄉鎮），9 群組列。
- DEV preview `VITE_DEMOGRAPHICS_STATISTICS_PREVIEW`／`DEMOGRAPHICS_STATISTICS_PREVIEW_PORT`（預設 3763）。
- `statisticsPeriodLabel`：period_start＝period_end 時顯示「日期（時點）」。
- 本地 browser QA：單層、期別切換、原始／比例、缺值斜線＋圖例、來源總覽、390×844、全關；代表值臺北市 11412 65+ 24.18%。
