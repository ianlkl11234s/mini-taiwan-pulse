# Backlog — 水資源 water-resources

> 本 feature 的細節留在 [README.md](./README.md)；本檔只保留已驗證但尚未完成 release 的 residual。

## Release blocker / verifying

- [ ] **WR-1 · `verifying`**：確認 `lakesPondsOsm` 的 PR、merge/push 與 production asset 狀態。
  - Outcome：52,314 面湖泊／埤塘正式可載入，且不把 README 的 dev 狀態誤當 shipped。
  - Next action：核對 branch/PR、PMTiles S3/HTTP Range、browser map/legend/popup；以無 404、ODbL attribution 與 aquaculture overlap filter 正常為 acceptance。

## Decision needed

- [ ] **WR-2**：決定 11.3MB PMTiles 採 git 版控，或採 `water_resources/` S3 deploy-assets。
  - Outcome：部署成本、可追溯性與 repo 大小取捨有明確 owner 決策。
  - Next action：owner 選定一種路徑；若走 S3，補 manifest/checksum 與 pull/upload evidence。

## Data quality / UX validation

- [ ] **WR-3**：驗證靜態 `overlaps_aquaculture` filter、四類 `water` 分類覆蓋與稀疏 `name` popup 的真實表現。
  - Outcome：湖泊／魚塭不重疊誤讀，分類缺值不會靜默變成錯色。
  - Next action：以產物統計與 browser all-off→single-layer、邊界 zoom、popup/legend 驗收；若欄位型別漂移標 `verifying`。

## 已完成（歷史，不列入 active）

- [x] 前端接線、52,314 面 PMTiles、四類分色與預設排除魚塭重疊 — 見 [README.md](./README.md)。
