# Backlog — civic-facilities-layers

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號要一致（CF 系列）。

## 進行中

（無）

## 待辦

- [ ] **CF-2**：`publicLibraries` 與文化設施層（`culturalFacilities` typeId=K「特色圖書館」）實體重疊去重 — 上游未實作（見 handoff §已知不對稱），需館名 + 縣市/鄉鎮比對，待上游或前端整合階段處理
- [ ] **CF-3**：`publicToilets` pulse 版僅 4 欄（`name/county/grade/type2`）做不了無障礙篩選 — 需回頭擴充上游 `pipelines/environment/public_toilets/07_export.py` 的 `pulse_props_keys` 補 `address`/各類間數/`diaper_any`，才能做「找無障礙廁所」類篩選
- [ ] **CF-4**：`welfareCenters` 資料時點固定 2023-04，來源已 3.5 年未更 — 人工監控，待上游評估是否有更新版可重跑
- [ ] **CF-5**：`iPostBoxes` `payment_method` 部分為空字串 — 若日後 popup 要顯示付費方式，需先確認上游是否補得齊

## 已完成（近期）

- [x] **CF-1**：browser 逐層驗收 8/8 PASS（2026-07-17）— 8 層 toggle / opacity+scale slider / click popup / 圖例（govServiceOffices 3 類、publicToilets 4 級）/ 公廁 zoom-gate（z9 無點、z12 有點）全過
- [x] **CF-0**：公共設施 8 圖層接線（郵局/i郵箱/活動中心/機關便民據點/公共圖書館/社福中心/公有市場/公廁）— commits `7e16edd` + `6e7f02e`，2026-07-17，PR 待開；tsc 0 錯 / 190 tests 全綠

## 已放棄 / 延後

（無）
