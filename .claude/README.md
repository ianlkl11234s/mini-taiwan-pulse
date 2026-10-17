# .claude/ — Mini Taiwan Pulse 協作目錄

## 結構（2026-10-16 更新，只列一層）

```
.claude/
├── README.md        # 本檔（索引）
├── FRAMEWORK.md     # 可移植的記憶系統說明書
├── HARNESS.md       # Claude／Codex harness 分層（hooks、skills、MCP）
├── settings.json    # SessionStart（memory/load-session.sh）、PostToolUse（hooks/manifest-guard.sh）
├── memory/          # 專案記憶（路由表見 memory/README.md）
├── pitfalls/        # 事件長文（INCIDENTS 的 long-form），開工前用關鍵字搜
├── skills/          # 專案 skills（layer-onboarding、wrap-up、weekly-audit…，以 ls 為準）
├── commands/        # slash commands（/new-layer、/check-rpc、/handoff）
├── agents/          # 子代理定義（layer-creator）
└── hooks/           # hook 腳本
```

經驗總集（給人與 agent 的主題導覽）：[`docs/LESSONS.md`](../docs/LESSONS.md)。

## 什麼時候讀什麼（與 CLAUDE.md「Session 記憶迴圈」一致）

- SessionStart hook 只給一句短路由，**不預載** STATUS／BACKLOG／PRINCIPLES。
- 有接手需求才依 [`memory/README.md`](./memory/README.md) 選讀相關檔、相關段落。
- 似曾相識的 bug 先搜 [`pitfalls/`](./pitfalls/)；不變規則在專案根 [../CLAUDE.md](../CLAUDE.md)。

## Session 結束

喊 `/wrap-up` → skill 依 `memory/README.md` routing 選讀，先做 scope/evidence/release truth 對帳並等使用者確認，再做 path-scoped atomic memory commits；不因收尾自動 push/deploy。

## 分層原則

| 層級 | 位置 | 性質 |
|---|---|---|
| 規則 | `CLAUDE.md`（專案根） | 不變規則（build 檢查、程式風格、強制順序） |
| 狀態 | `.claude/memory/` | 變動狀態、待辦、反省 |
| 長文 | `.claude/pitfalls/` | 重大事件的詳細紀錄 |
| Skills | `.claude/skills/` | 可 user-invocable 的工作流程 |

## 相關

- 標竿實作：`../plan-art/.claude/` — 同套框架首次落地的 Flight Arc 專案
- 上游資料：`../data-collectors/.claude/` — 收集端協作筆記
- 規格：`./FRAMEWORK.md` — 本框架可移植說明書

## 遷移紀錄

- 2026-04-23：從 v1（散檔 `lessons.md` + `principles.md` + `retrospectives/`）
  遷移到分類式 `memory/` + FRAMEWORK + /wrap-up skill。
  舊檔已刪除，內容重新分類到 INCIDENTS / REFLECTIONS / PRINCIPLES / PLAYBOOKS（pitfall 內殘留的 `lessons.md` 引用已於 2026-10-16 改指 PRINCIPLES）。
- 2026-08-19：/wrap-up 升級 v2，memory roster 改由 `memory/README.md` 路由，不再固定總數；收尾新增 selective reads、release truth matrix、contradiction gate 與 path-scoped Git。
- 2026-10-16：目錄樹改為一層、閱讀順序改為按需（對齊 CLAUDE.md）；新增 `docs/LESSONS.md` 經驗總集入口。
