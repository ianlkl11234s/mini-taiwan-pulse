# Backlog — 共同登記地址

## Active work（進行中／待辦）

- [ ] **BR-B4-VERIFY** · `release` · P1 · `verifying`：完成瀏覽器 All Off 單層驗收（tsc + 631 tests 已綠）。Acceptance：All Off、單層 toggle、popup/legend 與 z 範圍 browser evidence。

## Release / scheduled backlog

- [ ] **BR-B4-RELEASE** · `release` · P1 · `ready`：部署並做 production smoke test；Next action：取得部署授權後執行；Acceptance：HTTP 200、Range、checksum/metadata 讀回。
- [ ] **BR-B4-NEXT** · `release` · P2 · `conditional`：202609 artifact 到位後以新 dated filename 更新 URL 與 checksum；Trigger：2026-09 成品可用；Acceptance：新檔 checksum、舊檔不被覆寫、manifest 更新。

## Decision needed

- 暫無；部署授權是外部 release gate，不是產品決策。

## Completed / historical（已完成／歷史）

- [x] **BR-B4-UPLOAD**：上傳 `common_registration_addresses_202608_r2.geojson`，並完成 SHA-256、size 與 metadata 讀回驗證；r1 已 upload 但不是本版依賴。
- [x] **BR-B4-DATA**：接收並驗證 202608_r2 GeoJSON 四欄契約與 checksum — 2026-08-18。
- [x] **BR-B4-WIRE**：manifest / sidebar / params / threshold filter / legend / popup / click / deploy contract 本機接線 — 2026-08-18。

## Explicitly not planned（明確不做）

- 無。
