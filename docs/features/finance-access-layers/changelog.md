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
- PR #692（base develop），merge 63853f3d，2026-10-24。

## 2026-10-24 · G10 延伸接線

- 新 `financeAccessExt` 統計家族 10 層：工商普查金融及保險業場所單位（35 行業依來源階層排序）、金融卡類交易縣市分佈（預設金融卡交易、各交易類型自有色階、非實體通路比重入圖例）、壽險業分公司／通訊處（臺中市兩列合計，修正 handoff 過期的 missing 說法）、金融卡特約商店鄉鎮（預設每萬人排除集中登記）。builder 加 `fractional`／`dim_order`／`nonphysical`。
- 2 個點層（build-atlas-public.py → public/finance/）：證券期貨據點（類型多選＋隱藏自營部門）、保險公司與保險代理人（類型多選）；popup 定位精度、名冊資料日；補 atlasFinanceCoord／Precision／TownBasis 新代碼英日文。
- 測試：計數（recipe 165、selector 17,795、visuals 705／717、golden 1315）、靜態檔欄位契約、statisticsText 第二批加 G10 延伸。
- PR #696（base develop），merge 76511375，2026-10-25。owner-local `layerRegistryCoverage`：12 個新 key 尚待 pulse-data 登記。

## 2026-10-25 · G10 外幣接線

- 1 個點層 `postOfficeFxCounters`（build-atlas-public.py → public/finance/post_office_fx_cash_counters.geojson，git 追蹤隨 dist）：單色、透明度／大小 2 控件；popup 固定顯示「郵局經辦，非外幣收兌處」；補 atlasFinanceCoord `post_5950_same_office` 與 atlasOrg `chunghwaPost` 英日文。
- 測試：golden 1316、靜態檔欄位契約、NO_HOOK_LEDGER。
