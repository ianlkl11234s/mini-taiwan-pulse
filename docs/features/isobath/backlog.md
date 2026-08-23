# Backlog — 海底等深線 Isobath

> 本 feature 的唯一細節 SSOT。核心 `.claude/memory/BACKLOG.md` 只保留索引。

## 欄位規約

每一筆 active item 都要能回答「現在能做什麼」；狀態與優先級分開，不要用 P0/P1 代替狀態。

| 欄位 | 必填內容 |
|---|---|
| Category | `release` / `product` / `validation` / `tech-debt` / `data-health` / `security` / `research` / `decision` / `conditional` / `docs` |
| Priority | `P0` 緊急 production incident 或無替代路徑的 release/security gate、`P1` 當期、`P2` 已規劃、`P3` 機會型；不用優先級代替 State |
| State | `ready` / `in_progress` / `blocked` / `verifying` / `waiting_external` / `conditional` |
| Outcome | 完成後可觀察到的結果 |
| Next action | 下一個可直接執行的動作；不可只寫「追蹤」 |
| Acceptance | 關閉證據：test、HTTP、browser、rows、checksum 等 |
| Trigger | 僅 `conditional` 必填，寫清楚日期或外部事件 |
| Canonical context | handoff、README、proposal 或上游文件連結 |

## Active work（進行中／待辦）

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| ISO-1 | release | P1 | waiting_external | `public/base_map/gebco_isobath.pmtiles` 落地，圖層可實際渲染 | 等上游 agent 產出 pmtiles 並放進 `public/base_map/` | browser 開圖層看得到等深線與分帶色塊 |
| ISO-2 | docs | P2 | blocked | 上游 handoff 文件雙向校對完成 | 上游補 `taipei-gis-analytics/docs/handoff/gebco_isobath.md` 後對照本 feature 的 handoff.md 修正差異 | 兩份文件的欄位契約一致 |

## Decision needed

（無）

## Conditional / triggered later

（無）

## Verifying

| ID | Category | Priority | State | Missing evidence | Next action | Acceptance |
|---|---|---|---|---|---|---|
| ISO-3 | validation | P1 | verifying | pmtiles 落地前無法在瀏覽器實際檢視 fill/line 疊放順序、配色三模式、opacity 控件是否符合預期 | pmtiles 落地後用 agent-browser 開站驗證 4 個控件與 popup | 三種配色模式視覺正確、toggle 能開關分帶填色且不誤關整層、popup 顯示水深/深度區間正確 |

## Completed / historical（已完成／歷史）

- [x] **ISO-0**：前端接線（manifest / overlayRegistry / params / legend / popup / sidebar）全數完成，`npx tsc -b` 與 `npm test` 通過 — 2026-08-23，feat/isobath 分支（未合併）；詳見 [`changelog.md`](./changelog.md)

## Explicitly not planned（明確不做）

（無）
