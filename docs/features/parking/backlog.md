# Backlog — 停車 parking

> 本檔只保留目前 residual；已完成的 timeline 回放留在 [changelog.md](./changelog.md)。
> 2026-08-19 整理時，changelog 仍描述 feature branch 尚未 PR／push，故 release 狀態先標為 `verifying`。

## Release blocker / verifying

- [ ] **PK-1 · `verifying`**：確認 Batch 3 hybrid v1（含 timeline 回放）的 PR、merge 與 production asset 狀態。
  - Outcome：確認正式環境確實載入 migration 288、前端 day RPC 與停車資料，不把舊的「未 PR」紀錄誤當現況。
  - Next action：核對 branch/PR、production HTTP 與 browser replay；以 tsc/test、兩種模式可渲染及無 404 作 acceptance。

## Data quality / coverage

- [ ] **PK-2**：補 phase-2 座標覆蓋（台北／基隆場外、新北／台中路邊）。
  - Outcome：減少即時表與靜態 reference 無法 join 而不渲染的停車段／場。
  - Next action：盤點各地方政府資料源與 join coverage，先產 coverage report，再決定新增 collector/ref source。

## Decision needed

- [ ] **PK-3**：確認 `car_park_type` 是否需要正式 codebook；目前 RPC 以 `source_category` 回傳，並非 TDX raw enum。
  - Outcome：popup、圖例與後續分析不會把來源分類誤讀成官方停車場類型。
  - Next action：取得 TDX 欄位定義；若無穩定 codebook，明確保留 `source_category` 命名並補文件。

## Conditional / scheduled later

- [ ] **PK-4**：將 `parking_ref` 從手動改為月更排程。
  - Trigger：確認 phase-2 reference schema 與資料源穩定、且 owner 願意承擔月更成本。
  - Outcome：座標 ref 不再因手動漏跑而逐月變 stale。
  - Acceptance：排程成功紀錄、join coverage 未下降、失敗時有告警與可回滾快照。

## 已完成（歷史，不列入 active）

- [x] Batch 3 hybrid v1（含台北 polygon／其他城市點層、可得性配色）— 見 [changelog.md](./changelog.md)。
- [x] Timeline 回放（PK5/PK6，migration 288 + day RPC + browser replay）— 見 [changelog.md](./changelog.md)。
