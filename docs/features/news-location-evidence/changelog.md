# Changelog — 新聞地點證據與事件關聯 POC

> 逐 PR 變更紀錄。最新在上。

## 2026-09-28 — local POC start

- 建立跨 `data-collectors`、`gis-platform`、`mini-taiwan-pulse` 的隔離 worktree／branch。
- 固定 location scope、status、precision、role 與 relation semantics。
- 限定為 shadow schema、離線／fixture 測試與未接 production 的 UI 元件。
- Breaking：無；migration 尚未套用。

## 2026-09-28 — default-off Monitor slice

- 新增 `VITE_NEWS_LOCATION_EVIDENCE_POC=true` 的明確 opt-in；production/default 不掛載、不請求 POC RPC。
- POC loading/error 獨立於 legacy clustered-news query，未改 layout registry、map 點或 fly-to。
- rollback 為移除或關閉環境變數後重新建置；不涉及 schema、資料或 legacy rollback。
- 本機 browser readback：flag off 時 POC 不出現；flag on 且 RPC 缺少時，POC 顯示獨立錯誤，而既有 News Feed 仍持續顯示資料。

## 2026-09-28 — offline evidence checkpoint

- 新增 collector 純離線 evaluator；只讀本地 JSONL，輸出 `/tmp` report，不讀 DB、network、API key，也不進 collector write path。
- 重跑既有三組 45 列樣本後發現 10 個 URL 重複，實際只有 35 個 unique article identity；因此不能視為三組互不重複 gold set，NLE-4 維持未完成。
- 保守規則輸出 20 筆 accepted、25 筆 unresolved；accepted 只有 country／county，尚無 point precision。這是 coverage／manual-review evidence，不是 accuracy。
- 同 identity 重複列不再建立 article self-relation；不同 identity 的同稿才可進 `same_story_candidate`。
