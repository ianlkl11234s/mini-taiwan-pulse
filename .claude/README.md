# .claude/ — Mini Taiwan Pulse 協作目錄

## 結構

```
.claude/
├── README.md              # 本檔（索引）
├── FRAMEWORK.md           # ⭐ 可移植的記憶系統說明書
├── memory/                # ⭐ 專案記憶系統（Session 開頭必讀）
│   ├── README.md          # 記憶索引 + SOP
│   ├── STATUS.md          # 當前進度
│   ├── BACKLOG.md         # 待辦
│   ├── DATA_SCOPE.md      # 資料盤點（Supabase / GeoJSON / S3）
│   ├── PRINCIPLES.md      # 預設 / 原則
│   ├── PLAYBOOKS.md       # 固定流程
│   ├── GLOSSARY.md        # 術語表
│   ├── INCIDENTS.md       # 踩坑紀錄（append-only）
│   └── REFLECTIONS.md     # Session 反省（append-only）
├── skills/
│   └── wrap-up/
│       └── SKILL.md       # ⭐ Session 收尾 + memory atomic commit
├── agents/                # （既有）
├── commands/              # （既有 slash commands）
└── pitfalls/              # Long-form 事件紀錄（INCIDENTS 的 archive）
    ├── 2026-04-07-empty-ships-flights.md
    └── 2026-04-22-mapbox-load-once-fired.md
```

## 閱讀順序（新 session 開頭）

1. `memory/STATUS.md` → 知道上次結束在哪
2. `memory/BACKLOG.md` → 看優先級
3. `memory/PRINCIPLES.md` → 避免重開溝通
4. 必要時查 `memory/DATA_SCOPE` / `PLAYBOOKS` / `GLOSSARY`
5. **不變規則**在專案根 [../CLAUDE.md](../CLAUDE.md)

## Session 結束

喊 `/wrap-up` → skill 自動 5 階段更新 memory 並 atomic commit。

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
  遷移到 v2（9 檔 `memory/` + FRAMEWORK + /wrap-up skill）。
  舊檔已刪除，內容重新分類到 INCIDENTS / REFLECTIONS / PRINCIPLES / PLAYBOOKS。
