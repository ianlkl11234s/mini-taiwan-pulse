# Backlog — civic-facilities-layers

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號要一致（CF 系列）。

## Active work（進行中／待辦）

（無）

## Data quality / product backlog

- [ ] **CF-2** · `data-health` · P2 · `waiting_external`：`publicLibraries` 與文化設施 typeId=K 重疊去重；Next action：上游提供館名＋縣市/鄉鎮比對欄位；Acceptance：重疊清單與去重規則可重跑。
- [ ] **CF-3** · `product` · P2 · `waiting_external`：擴充 public toilets 欄位以支援無障礙篩選；Next action：上游補 `address`/各類間數/`diaper_any` 後重出；Acceptance：欄位契約、篩選測試與 browser popup。
- [ ] **CF-4** · `data-health` · P2 · `conditional`：welfareCenters 仍為 2023-04 快照。Trigger：上游出現更新版；Next action：核對來源日期後重跑；Acceptance：日期、checksum、HTTP 200。
- [ ] **CF-5** · `data-health` · P3 · `conditional`：iPostBoxes `payment_method` 空值。Trigger：產品決定在 popup 顯示付費方式且上游補齊；Next action：先做空值比例與契約核對；Acceptance：空值策略與 popup browser 驗收。

## Completed / historical（已完成／歷史）

- [x] **CF-1**：browser 逐層驗收 8/8 PASS（2026-07-17）— 8 層 toggle / opacity+scale slider / click popup / 圖例（govServiceOffices 3 類、publicToilets 4 級）/ 公廁 zoom-gate（z9 無點、z12 有點）全過
- [x] **CF-0**：公共設施 8 圖層接線 — PR #74 squash `8682d57` 已合併；browser 8/8 PASS（2026-07-18）。

## 已放棄 / 延後

（無）
