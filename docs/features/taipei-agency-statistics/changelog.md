# Changelog — 臺北市局處統計 Taipei City Agencies

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-23 — 英日文與目錄按需載入 PR #674（merge c120ff0c，2026-10-23）

- 11 層圖層名補英日文（`layers.json`），另補群組名（`enum.statGroup`）、產業中類 27 項與建造類別 4 項（`enum.statDim`／`enum.statDimValue`）、位置口徑 4 句、發布機關 2 個、授權 3 句、小群組「臺北市 12 區（月）」與「水質與污水」、圖例缺值列 2 句（atlas 缺值列改走 `enum.statLegendNote`，查不到維持中文）；`statisticsText.test.ts` 加本家族外文不混中文檢查
- 目錄按需載入：catalog 不再帶 release_options（2,719,486 → 40,438 bytes），9,696 個 exact selector 改由 `statisticsRecipeDetails` 的 `taipeiAgency` 家族在開圖層／期別選單時 dynamic import（照 agri／social PF-7 前例）；首屏 preload JS raw 11,146,226 → 9,408,973、gzip 2,275,844 → 2,182,664；按需 chunk raw 3,674,491／gzip 165,838

---

## 2026-10-23 — 分類調整 PR #671（merge ba41a6b1，2026-10-23）

- 臺北市局處統計 11 層不再自成一類，Statistics 分頁與 Layers 完整目錄都依主題併入各自縣市版所在主題（環境與資源／工作與所得／住宅與不動產等）；只改分類位置，不動資料、recipes 內容、layer key、色階、圖例

---

## 2026-10-23 — 首批 PR #664（merge 00c1ca70，2026-10-23；尚未部署正式站）

- Statistics 新主題「臺北市局處統計」11 層（5 個鄉鎮 dataset、9,696 個 exact selector）：資源回收、垃圾清運、污水接管普及率兩口徑、登記工廠家數（合計／產業中類）、核發使用執照五指標
- 只涵蓋臺北市 12 區，其他鄉鎮以缺值斜線＋「未涵蓋」圖例呈現；圖例逐行 disclosure（12 區加總≠全市、污水口徑斷點與縣市版不同、使照逐張計＋建築面積非樓地板、工廠「-」＝0）
- 共用層：atlas 圖例「各維度組合各有一組門檻」改為只在 recipe 真有 `by_dimension` 時顯示（既有家族不受影響，本家族產業別／建造類別共用一組門檻）
- 瀏覽器驗收（dev server、headed Chrome）：資源回收、污水普及率、工廠產業別三層，臺北 12 區上色、新北斜線未涵蓋、圖例說明齊全
