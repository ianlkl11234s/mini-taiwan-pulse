# Backlog — 路況 road-congestion

> 本檔只保留目前 residual；實作細節與已完成驗收見 [handoff.md](./handoff.md) 與 [changelog.md](./changelog.md)。
> changelog 仍記錄 branch 尚未 PR／push，release 狀態先以 `verifying` 表示。

## Release blocker / verifying

- [ ] **RC-1 · `verifying`**：確認 migration 285、`road_congestion_highway.pmtiles` S3 asset、PR/merge 與 production HTTP/browser evidence。
  - Outcome：正式環境能取得 PMTiles 與 day RPC，路況圖層不會因 gitignored asset 缺失而 404。
  - Next action：核對 branch/PR、S3 HEAD/checksum、HTTP Range 與 browser 四級染色；以 tsc/test、無 404、popup 可點為 acceptance。

## Decision needed

- [ ] **RC-2**：決定是否保留前端「最新可得快照」clamp，或改成嚴格 slot 語意。
  - Outcome：使用者看到的時間與資料延遲語意一致，不在 backlog 中把既有取捨誤當 bug。
  - Next action：owner 選定產品語意；若改嚴格 slot，移除 loader `lastPopulatedSlot` 與 hook clamp 並補 browser evidence。

## Product enhancement

- [ ] **RC-3**：v2 擴充市區路況（桃園／台中／台南／基隆／宜蘭）及速度欄位 popup。
  - Outcome：從省道全國骨架擴充到城市路網，並讓 popup 可解讀速度。
  - Next action：先驗各城市幾何品質與欄位覆蓋，再另開 PMTiles/source-layer 與 UI 變更。

## Tech debt / conditional

- [ ] **RC-4**：觀察每日 refresh 掃描量；資料成長後再做 refresh 分段。
  - Trigger：refresh 時間、row count 或 timeout 超過現有安全門檻。
  - Outcome：避免 pre-aggregate refresh 由可接受延遲退化成 OOM/timeout。
  - Acceptance：分段 refresh 的耗時、錯誤率與資料完整率有前後對照。

## 已完成（歷史，不列入 active）

- [x] v1 省道路況 PMTiles + feature-state 染色、288 槽解碼、hit layer、popup、圖例與 browser 驗收 — 見 [changelog.md](./changelog.md)。
