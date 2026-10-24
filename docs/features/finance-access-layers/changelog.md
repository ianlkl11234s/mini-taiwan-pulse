# Changelog — 金融服務據點與可及性

## 2026-10-24 · 接線（G10）

- `financeAccess` 統計家族 11 層（financeAccessStatisticsRecipes.json／catalog／ts），放 Statistics「財稅與消費」新小群組「金融服務可及性」；金融欠缺鄉鎮兩級門檻與 0 說明。
- 2 個點層（build-atlas-public.py → public/finance/）：ATM 裝設點（PMTiles＋低縮放熱區、機構類別多選、輪椅／語音開關）、金融機構總分支機構（GeoJSON、類別多選）；popup 定位精度與警示、圖例、i18n 英日文。
- 測試：計數（recipe 155、selector 16,620、visuals 695／707、golden 1303）、靜態檔欄位契約、statisticsText 第二批檢查。

## 2026-10-24 · 開 PR

- PR #690（base develop，G23／G16／G10 三群合一），merge 444ab425，2026-10-24。

## 2026-10-24 · 二元旗標圖例

- `statsFinanceUnderserved`（值只有 0／1）圖例改為兩級「不在名單／列入名單」：atlas recipe 新增 `legend.method: "binary"`＋`binary_labels`（breaks 固定 `[1]`），builder `build_roadmap_batch2_statistics_recipes.py` 以 `binary=` 選項產生並驗證值域只有 0／1；圖例走 `atlasBinaryLegendRows`，不顯示「淺 → 深」與門檻區間。移除「圖例『2 以上』一級不會出現」的權宜註解。其他 10 層不變。
- 測試：atlasStatisticsContract（binary 層兩級、其他層仍 2–4 門檻）、statisticsText 第二批檢查加 binary_labels 英日文。
