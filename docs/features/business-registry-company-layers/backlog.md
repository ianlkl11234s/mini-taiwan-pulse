# Backlog — 公司登記 B1/B2/B3/A4

## 待辦

- [ ] deploy 並做 production Range Request / 404 smoke test。
- [ ] All Off 後逐層瀏覽器驗收：z4–11 overview → z12 detail、B1/A4 shared sources、B2 三尺度 × 三指標、company name popup/legend/暗色底圖。
- [ ] 後續若產品需要，再評估 `categories` A–J/Z exact-token multi-select；本版不為此自創多選架構，也不複製 11 層。
- [ ] 202609 artifact 到位時改用新 dated filename，不覆寫 202608 asset。

## 已完成

- [x] upload r2 detail / overview / 三尺度 / B3 companion contract 6 個 immutable assets，並逐檔完成 SHA-256、size 與 metadata 讀回驗證。
- [x] B1/A4 shared overview/detail sources、zoom split、company name popup、capital_q 固定色與 A4 exact filter。
- [x] B2 150m / 450m / 1.5km 手動切換、三指標與 null median neutral。
- [x] B3 r2 companion contract：89 行業、縣市、資本額分位、設立年、所有 boolean/tri-state flags，並與 B1 r2 的 `company_name` 欄位對齊。
- [x] manifest/sidebar/params/overlay/click/popup/legend/deploy/static/PMTiles contracts。
- [x] 新 assets 本機實檔 checksum / source-layer / feature-count ratchet，86/86 PMTiles 通過。
