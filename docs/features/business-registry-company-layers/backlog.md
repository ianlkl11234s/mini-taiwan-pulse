# Backlog — 公司登記 B1/B2/B3/A4

## Active work（進行中／待辦）

- [x] **BR-C-DEMOGRAPHICS** · `implementation` · P1：登記產業分布與公司年齡結構；完整母體 450m / 1.5km 聚合、多選產業、年齡指標、圖例 / popup、本地桌機瀏覽器驗收完成；發布另列。

- [ ] **BR-C-RELEASE** · `release` · P1 · `ready`：deploy 並做 production Range Request / 404 smoke test；Acceptance：各 immutable asset HTTP 200、Range、checksum/metadata。
- [ ] **BR-C-BROWSER** · `verification` · P1 · `verifying`：All Off 後逐層瀏覽器驗收（z4–11 overview → z12 detail、shared sources、B2 三尺度×三指標、popup/legend/暗色底圖）；Acceptance：逐層 evidence matrix。

## Decision needed

- **BR-C-CATEGORIES** · `research` · P3：產品若需要才評估 `categories` A–J/Z exact-token multi-select；不在本版自創多選架構或複製 11 層。Owner 拍板後另開實作項。

- **BR-C-INDUSTRY-LQ** · `analysis` · P2：單一登記產業相對全台集中度，需整合固定版 nationwide metadata 與小母數門檻；本版先提供密度多選。

## Conditional / triggered later

- **BR-C-202609** · `release` · P2 · `conditional`：Trigger：202609 artifact 到位；Next action：使用新 dated filename 更新 manifest/checksum，不覆寫 202608 asset；Acceptance：新檔 checksum 與舊檔可並存。

## Completed / historical（已完成／歷史）

- [x] upload r2 detail / overview / 三尺度 / B3 companion contract 6 個 immutable assets，並逐檔完成 SHA-256、size 與 metadata 讀回驗證。
- [x] B1/A4 shared overview/detail sources、zoom split、company name popup、capital_q 固定色與 A4 exact filter。
- [x] B2 150m / 450m / 1.5km 手動切換、三指標與 null median neutral。
- [x] B3 r2 companion contract：89 行業、縣市、資本額分位、設立年、所有 boolean/tri-state flags，並與 B1 r2 的 `company_name` 欄位對齊。
- [x] manifest/sidebar/params/overlay/click/popup/legend/deploy/static/PMTiles contracts。
- [x] 新 assets 本機實檔 checksum / source-layer / feature-count ratchet，86/86 PMTiles 通過。

- ✅ 2026-09-18：工廠、製造業公司、列管設施全台原點取消聚合與抽稀；各新增可獨立開關的 1.5km／450m 密度層。最低點位 zoom 實解計數、網格加總、六層 browser 可視驗證完成；LOCAL_ONLY，未部署。
