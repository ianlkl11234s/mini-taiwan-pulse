# Changelog — civic-facilities-layers

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-18 — PR #74 merged（squash `8682d57`）

- PR #74 squash merge 進 master，branch 已刪；以下為 branch 內容紀錄。

## 2026-07-17 — branch `feat/civic-facilities-layers`（commits `7e16edd` + `6e7f02e`）

- `6e7f02e` feat(civic-facilities)：公共設施批次 2/2 — 圖書館/社福/市場/公廁 4 圖層
  - 公廁 13,281 點：minzoom 11 zoom-gate（照 fireHydrants 前例）+ grade 4 級分色 + 圖例
  - 社福 popup 標注「資料時點 2023-04」揭露時效性
  - deployContract：nginx.conf + pull-deploy-assets.sh 補 `environment/` + `poi/` 子目錄契約
  - 全接觸點鏡像批次 1（`7e16edd`）模式
- `7e16edd` feat(civic-facilities)：公共設施批次 1/2 — 郵局/i郵箱/活動中心/機關據點 4 圖層
  - overlayRegistry 靜態 geojson 樣板（glow+circle）×4；機關據點 type 3 分色 + 圖例
  - 活動中心 label 標注（部分縣市）揭露 8 縣市 partial coverage
  - 全接觸點：types / LAYER_COLORS / THEMES / icon / params（opacity+scale）/ popup / upstreamRegistry / chat datasets
  - deployContract：nginx.conf + pull-deploy-assets.sh 補 `civic_facilities/` 子目錄契約
  - layerCatalog 檔頭註解 14 主題 → 22 主題七段敘事帶（補 PR #72 漏更）
- 驗收：tsc 0 錯 / 190 tests 全綠；agent-browser 逐層驗收 **8/8 PASS**（All Off 後單層開，逐層驗 點渲染/顏色/popup 欄位/雙 slider；govServiceOffices 3 類與 publicToilets 4 級圖例正確；communityCenters label 含「部分縣市」；welfareCenters footer 日期正確；publicToilets zoom-gate 生效 z9→0 點 / z12→2,566 點）
- Breaking：無

