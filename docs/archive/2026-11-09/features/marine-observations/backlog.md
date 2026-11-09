> **已封存 2026-11-09**（原路徑 `docs/features/marine-observations/backlog.md`）：讀過後仍有效的未完成項目已搬進 [`.claude/memory/BACKLOG.md`](../../../../../.claude/memory/BACKLOG.md)（各主題群，附回本檔連結；已完成／過時／查不到證據的列在「已關閉（2026-11-09 封存清單清理）」段（使用者 2026-11-09 確認；併入者記在目標列））。本檔保留原文，不再更新。

# Backlog

- [x] CWA 與 ISOHE source-specific toggles、loader、layer、legend、popup/history 接線。
- [x] Network-specific freshness 與 source status 視覺語意。
- [x] Missing／invalid／vertical datum 契約測試。
- [x] 本地 unit、typecheck、build、production RPC smoke 與 browser 驗收。
- [x] 多指標 popup 與展開圖例的 viewport overflow 回歸。
- [ ] Push／PR／merge／deploy：blocked，等待 owner 另外授權；下一步從 `codex/marine-observations-cwa-isohe` push 明確 refspec，驗收條件為 CI 通過、正式站兩層可獨立操作且 popup/history 無 RPC 或 Mapbox 錯誤。
