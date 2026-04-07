# Claude 協作筆記 — Mini Taiwan Pulse

此資料夾收錄與 Claude Code 協作時累積的專案知識、踩過的坑、運作原則。

## 結構

```
.claude/
├── README.md              # 本檔案，索引
├── principles.md          # 專案運作原則 / 慣例
└── pitfalls/              # 過往踩過的坑（按日期 + 主題命名）
    └── YYYY-MM-DD-<主題>.md
```

## 文件清單

### 原則 & 慣例
- [principles.md](principles.md) — 前端開發、Supabase 整合、時區處理慣例

### Pitfalls

| 日期 | 主題 | 摘要 |
|------|------|------|
| 2026-04-07 | [Timeline 看不到船舶/航班](pitfalls/2026-04-07-empty-ships-flights.md) | 表面是「沒資料」，根因是 data-collectors 有 +8h 時區 bug + Zeabur 當機，最後從 S3 全量回補 |

## 相關文件

- 專案根目錄的 [`CLAUDE.md`](../CLAUDE.md) — 技術棧、Supabase 連線、資料流速覽
- [data-collectors 的 .claude/](../../data-collectors/.claude/) — 資料來源端的協作筆記（含時區 bug 的詳細記錄）
