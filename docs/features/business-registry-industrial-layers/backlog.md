# Backlog — 工廠、列管設施與產業園區

## Active work（進行中／待辦）

- [ ] **BR-I-A3** · `product` · P1 · `waiting_external`：產品確認篩選語意後，將三個 assertion flags 分開接到既有點層，不合成 `is_in_park`；Acceptance：語意 decision、filter test、popup evidence。
- [ ] **BR-I-BROWSER** · `verification` · P1 · `verifying`：All Off 瀏覽器驗收 A1/A2/A5/A6（overview/detail、popup、暗色底圖、polygon click、A6 指標）；Acceptance：逐層 evidence matrix。
- [ ] **BR-I-RELEASE** · `release` · P1 · `ready`：deploy 並驗 production Range Request 與 `/industrial_zone/` 供應鏈；Acceptance：HTTP 200/Range、checksum/metadata。

## Decision needed

- A3 的篩選語意由產品 owner 拍板；在拍板前不可把三個 assertion flags 合併成新欄位。

## Conditional / triggered later

- 暫無。

## Completed / historical（已完成／歷史）

- [x] upload A1 overview immutable asset，並完成 SHA-256、size 與 metadata 讀回驗證（A1 detail / A2 / A5 / A6 舊 assets 亦已 upload）。
- [x] A1/A2/A5/A6 immutable staging、manifest/sidebar/params/overlay/click/popup/legend。
- [x] A1 z4–10 全已定位 records 計數概覽 + z11+ detail；overview checksum/source-layer/count ratchet。
- [x] A1/A5 coverage 與中性語意；A2 明示不含科學園區。
- [x] A3 無 geometry，不建立 map layer，只保存 assertion contract 與後續篩選邊界。
- [x] business_registry / industrial_zone deploy 與 PMTiles contract ratchet。
- [x] A6 只用實際三指標，明示 geocode coverage bias、零值限制與科學園區邊界。
