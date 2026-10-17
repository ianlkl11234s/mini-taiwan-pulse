# 日本警察設施（jp-police-facilities）

> **狀態**：shipped（前端 [PR #224](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/224) 於 2026-09-07 合併；正式站瀏覽器驗收（未查到），backlog 註明正式發布另案）

## 一句話說明

Japan 分類「治安 → 點位」下的全日本警察設施圖層（本部／警察署／交番／駐在所，共 13,195 個有座標點）；預設 off，位置為約略值者以橘框＋警語標示。

## 圖層與 runtime 路徑

- layer key：`jpPoliceFacilities`（`src/data/layerManifest.ts`），datasetId `jp_police_facilities`
- 型別與色票：`src/data/jpPoliceFacilityTypes.ts`
- 資料：靜態 PMTiles `public/world/jp_police_facilities.pmtiles`（source-layer `jp_police_facilities`，z5–14，z15+ overzoom）
- 接線：manifest → params spec（opacity／scale／設施類型）→ layerHookRegistry 掛載，無 GeoJSON loader、無 DB／collector

## 資料來源

警察庁（NPA）名冊負責設施清單、国土地理院（GSI）負責位置。上游 SSOT：`taipei-gis-analytics/docs/handoff/jp-police-facilities.md`（上游 [PR #82](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/82) 已合併）。

## 驗收

`npx tsc -b`、Vitest、本機瀏覽器（z5／z14／z16 overzoom、popup、篩選）已通過，細節見 handoff。

## 資料夾內文件

- [handoff.md](./handoff.md)：上游契約（SHA-256、欄位依賴、degraded 語意）、接線方式與本機驗收紀錄
- [changelog.md](./changelog.md)：2026-09-07 的接線、全縮放保留完整點位、PR 整合
- [backlog.md](./backlog.md)：本次範圍核對清單；正式發布不在範圍內
