# Changelog — 金融服務據點與可及性

## 2026-10-24 · 接線（G10）

- `financeAccess` 統計家族 11 層（financeAccessStatisticsRecipes.json／catalog／ts），放 Statistics「財稅與消費」新小群組「金融服務可及性」；金融欠缺鄉鎮兩級門檻與 0 說明。
- 2 個點層（build-atlas-public.py → public/finance/）：ATM 裝設點（PMTiles＋低縮放熱區、機構類別多選、輪椅／語音開關）、金融機構總分支機構（GeoJSON、類別多選）；popup 定位精度與警示、圖例、i18n 英日文。
- 測試：計數（recipe 155、selector 16,620、visuals 695／707、golden 1303）、靜態檔欄位契約、statisticsText 第二批檢查。

## 2026-10-24 · 開 PR

- PR #690（base develop，G23／G16／G10 三群合一）；merge 後補 merge hash。
