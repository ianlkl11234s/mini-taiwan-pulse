# Backlog — 急診壅塞 er_hospital

> 目前只保留仍可執行的 residual；完整實作與 PR 歷史見 [`changelog.md`](./changelog.md)。

## Active work（進行中／待辦）

- [ ] **ER-1** · `data-governance` · P2 · `waiting_external`：補 taipei-gis-analytics catalog 條目，讓 `upstreamRegistry` 的 `library`/ER dataset 從 `pulse_only` 升為 `verified`。Next action：上游建立 catalog doc 並回填 registry；Acceptance：上游 commit、registry test 綠。
- [ ] **ER-2** · `data-health` · P2 · `verifying`：確認 `inform` Y/N 旗標語意（目前 v1 只展示，不作紅燈條件）。Next action：累積至少一個月與來源狀態對照；Acceptance：語意證據與決策紀錄。
- [ ] **ER-3** · `data-health` · P2 · `verifying`：急救責任醫院名單變動時核對 GeoJSON join 命中率與兩家座標 override。Next action：下一次名單/資產更新時讀 loader 未命中 log；Acceptance：59 家命中率、override 清單與 browser popup 對帳。

## Decision needed

- 暫無；`inform` 在證據完成前不得升格為紅燈條件。

## Conditional / triggered later

- ER-3 只在急救責任醫院名單或座標快照更新時觸發；平時不列 release gate。

## Completed / historical（已完成／歷史）

- ERCard 全醫院分區網格、24h/14d summary 與 browser 驗收已完成，詳見 [`changelog.md`](./changelog.md)（PR #91）。

## Explicitly not planned（明確不做）

- 暫無。
