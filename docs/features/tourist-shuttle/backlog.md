# Backlog — 台灣好行 tourist-shuttle

> 本檔只保留目前 residual；v1 接線與 replay 驗收見 [changelog.md](./changelog.md)。
> changelog 仍記錄 feature 與急診共用 branch 且未 PR／push，release 狀態先標 `verifying`。

## Release blocker / verifying

- [ ] **TS-1 · `verifying`**：確認 route JSON、migration 284、PR/merge 與 production asset 狀態。
  - Outcome：正式環境能取得 `tourist_shuttle_routes.json`，即時與 replay 不因 S3 缺檔而空白或 404。
  - Next action：核對 route JSON S3 HEAD/checksum、production HTTP 與 browser live/replay；以 100% route join、無 console error、四鐵則為 acceptance。

## Data quality / correctness

- [ ] **TS-2**：加入 GPS 點與 route shape 距離 gate；超過約 500m 時 fallback 原始點或隱藏。
  - Outcome：route_uid 級幾何錯配時不沿錯線瞬移或抖動。
  - Next action：先在 BusEngine 建立可觀測的距離分佈與 fallback fixture，再以 replay browser 驗收。

## Decision needed / product enhancement

- [ ] **TS-3**：評估 sub-route 級精準幾何。
  - Outcome：多子線路線不再只能挑最長子線，位置故事更精準。
  - Next action：先驗 TDX Tourism/Bus/Shape 是否穩定提供 `SubRouteUID`；確認後才重出 route JSON 與改 resolve key。

## Conditional / tech debt

- [ ] **TS-4**：重新核對 `upstreamRegistry` 沿用 `bus_realtime` dataset id 的合理性。
  - Trigger：catalog/registry 要區分台灣好行資料集，或上游 dataset id 發生變更。
  - Outcome：資料治理名稱與實際來源一致，不影響目前渲染路徑。
  - Acceptance：上游 handoff、catalog 與前端 registry 三方 id 一致。

## 已完成（歷史，不列入 active）

- [x] v1 `touristShuttleLive` 接線、564 台 live、replay 與 100% route join browser 驗收 — 見 [changelog.md](./changelog.md)。
