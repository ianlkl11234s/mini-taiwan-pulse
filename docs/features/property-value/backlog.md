# Backlog — 房地產總市值 property-value

> 本 feature 原本只有 [handoff.md](./handoff.md)，本檔只登記該 handoff 明確留下的 current residual；契約細節仍以 handoff 與上游 SSOT 為準。

## Release / deployment verifying

- [ ] **PV-1 · `verifying`**：確認四份 PMTiles 已上 production `deploy-assets/urban/`，且 `property_value_admin.json` 可由正式站取得。
  - Outcome：建物估值、三尺度網格與縣市摘要在 production 可載入，不把本地檔案存在誤當上線證據。
  - Next action：核對 S3 HEAD/checksum、HTTP Range 與 browser 三尺度／兩模式；以無 404、popup/legend 正常為 acceptance。

## Decision needed / cleanup

- [ ] **PV-2**：決定是否移除已無前端引用的 `buildings_3d_taiwan.pmtiles`（本地與 S3，約 194MB）。
  - Outcome：避免舊磚佔用 S3/Volume，並維持單一 buildingsGba 資料來源。
  - Next action：先以 `rg`/部署 manifest 確認零引用，再由 owner 明確核准後執行可復原的移除；未核准前不得刪除。

## Conditional / scheduled

- [ ] **PV-3**：實價新季度快照重跑後，更新 PMTiles、上傳 S3，並重新檢查 breaks/3D anchors。
  - Trigger：上游季度資料或人口年度資料更新。
  - Outcome：地圖維持最新快照，且色階／高度不因分佈漂移而誤導。
  - Acceptance：五個產物 checksum、三尺度總量對帳；必要時只更新 `PROPERTY_VALUE_SCALES` 或 per-capita breaks。

## 已完成（歷史，不列入 active）

- [x] BuildingsGba 換磚、三尺度 Value Grid、總市值／人均模式與誠實度限制 — 見 [handoff.md](./handoff.md) Changelog.
