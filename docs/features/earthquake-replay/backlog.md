# Earthquake Replay — Backlog

## Active work（進行中／待辦）

| ID | Category | Priority | State | Next action |
|---|---|---|---|---|
| EQ-1 | product | P2 | ready | 事件累積至 100+ 時評估分頁/篩選 |
| EQ-5 | product | P2 | ready | 接 `tsunami_alerts` badge 與 WarningArea/TsuStation popup；先確認 optional schema |
| EQ-2 | data-health | P2 | verifying | 首次出現 moment_tensor A 解時核對 A 優先 fallback R |
| EQ-3 | tech-debt | P3 | conditional | 若沙灘球鋸齒影響閱讀，再評估 SVG path |
| EQ-4 | data-health | P3 | conditional | autovacuum 觀察，不主動改 RPC |

## Decision needed

- 暫無。

## Explicitly not planned（本輪刻意不做）

- 事件選取自動 flyTo：目前全景動畫語意足夠，使用者反映找不到震央時再重開。
- 既有 earthquakes popup 直接銜接回放：目前未證明需求，避免新增跨元件通道。

## Historical notes（歷史盤點細節；上方分類是目前 SSOT）
| # | 項目 | 備註 |
|---|---|---|
| 1 | 海嘯註記 | `tsunami_alerts`（80 筆，2023 起）尚未接；可在事件清單/回放加海嘯 badge + WarningArea/TsuStation popup（注意兩種子結構 optional chaining） |
| 2 | 選事件自動 flyTo 震央 | 本次刻意不做（預設全景可看完整動畫）；若用戶反映找不到震央再加 |
| 3 | 既有 earthquakes ripple ↔ 回放銜接 | 規劃時的構想：earthquakes popup 加「回放這起」按鈕直接開回放；本次未做 |
| 4 | 沙灘球 SVG 平滑化 | 目前 raster 掃描 + RLE 矩形，有鋸齒；可改解析節面曲線路徑（功能無礙，純美觀） |
| 5 | moment_tensor A 修訂解驗證 | 庫內目前全是 R 快解；首次出現 A 解時驗證「A 優先 fallback R」實際行為 |
| 6 | town_intensity autovacuum 觀察 | 該表從未 vacuum，RPC 的 Index Only Scan 有 Heap Fetches 736；autovacuum 跑過自動歸零，無需動作，僅記錄 |
| 7 | 回放事件累積後的清單 UX | 事件數成長到 100+ 時考慮分頁/篩選（規模門檻、只看 Tier A） |
