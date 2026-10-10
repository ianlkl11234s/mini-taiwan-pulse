# Backlog — <feature-name>

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

使用表格；每列至少包含 `ID / Category / Priority / State / Outcome / Next action / Acceptance`。

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| XX-1 | product | P1 | ready | <完成後可觀察結果> | <下一個可執行動作> | <可驗證證據> |

## Decision needed

只放需要 owner 拍板的選項；拍板後移回 Active work，或移至 Conditional / triggered later。

| ID | Decision | Options / trade-off | Decision owner | Next action after decision |
|---|---|---|---|---|
| XX-2 | <待決問題> | <選項與代價> | <owner> | <拍板後動作> |

## Conditional / triggered later

只有尚未觸發、但未來仍需執行的工作；必須填 `Trigger`，不可放入當期 active queue。

| ID | Category | Priority | State | Trigger | Next action | Acceptance |
|---|---|---|---|---|---|---|
| XX-3 | data-health | P2 | conditional | <日期／外部事件> | <觸發後動作> | <關閉證據> |

## Verifying

只放程式或資料已存在、但尚缺明確證據的項目；補齊 Acceptance 後移至已完成或退回 Active work。

| ID | Category | Priority | State | Missing evidence | Next action | Acceptance |
|---|---|---|---|---|---|---|
| XX-4 | release | P1 | verifying | <缺少的證據> | <補證據> | <通過條件> |

## Completed / historical（已完成／歷史）

只留一行結果、日期、PR/commit 或 canonical changelog 連結；長篇過程放 `changelog.md`。

- [x] **XX-5**：<結果> — YYYY-MM-DD，PR #NN / commit `<sha>`；詳見 [`changelog.md`](./changelog.md)

## Explicitly not planned（明確不做）

- **XX-6**：<項目> — <決定與原因>；若未來重啟，請新增 trigger 與 owner，不要重新勾回歷史項。
