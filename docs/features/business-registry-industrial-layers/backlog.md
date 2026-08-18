# Backlog — 工廠、列管設施與產業園區

## 待辦

- [ ] A3：產品確認篩選語意後，將三個 assertion flags 分開接到既有點層；不得合成 `is_in_park`。
- [ ] All Off 瀏覽器驗收 A1/A2/A5/A6：z10→z11 gate、popup、暗色底圖、polygon 點擊與 A6 指標切換。
- [ ] 取得授權後 upload/deploy，驗 production Range Request 與 `/industrial_zone/` 供應鏈。

## 已完成

- [x] A1/A2/A5/A6 immutable staging、manifest/sidebar/params/overlay/click/popup/legend。
- [x] A1/A5 coverage 與中性語意；A2 明示不含科學園區。
- [x] A3 無 geometry，不建立 map layer，只保存 assertion contract 與後續篩選邊界。
- [x] business_registry / industrial_zone deploy 與 PMTiles contract ratchet。
- [x] A6 只用實際三指標，明示 geocode coverage bias、零值限制與科學園區邊界。
