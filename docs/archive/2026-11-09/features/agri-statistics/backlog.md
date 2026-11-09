> **已封存 2026-11-09**（原路徑 `docs/features/agri-statistics/backlog.md`）：讀過後仍有效的未完成項目已搬進 [`.claude/memory/BACKLOG.md`](../../../../../.claude/memory/BACKLOG.md)（各主題群，附回本檔連結；已完成／過時／查不到證據的列在「已關閉（2026-11-09 封存清單清理）」段（使用者 2026-11-09 確認；併入者記在目標列））。本檔保留原文，不再更新。

# Progress — agri-statistics

- [x] 24 層 frontend wiring、3 層保持停用、2 既有 key 索引。
- [x] 2,748 exact selectors／boundaries 與154檔 SHA 驗證。
- [x] 桌面全部24層與手機各來源代表層 UI 驗收。
- [x] TypeScript、build、完整 tests 與最後聚焦 tests。
- [x] GitHub [PR #227](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/227) squash merge：`0f8bed5e8c8d1f7fd8de5310127d50b8dadd3e49`。
- [x] 正式 API 50 releases／sidecar／boundary 發布。
- [x] 正式匿名 API、完整資料與 geometry hash readback。
- [x] production RUNNING，桌面24層與手機各來源代表層線上驗收。
- [x] catalog 索引與 frontend 載入加速已部署；畜禽覆蓋率單位修正。

詳細證據見 [README](../../../../features/agri-statistics/README.md) 與 [browser acceptance](../../../../features/agri-statistics/evidence/browser-acceptance.json)。

正式證據：[production browser](../../../../features/agri-statistics/evidence/browser-production.json)、[readback](../../../../features/agri-statistics/evidence/production-readback-published.json)、[deployment](../../../../features/agri-statistics/evidence/zeabur-final.json)。
