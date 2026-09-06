# 原子提交與回滾對照

2026-09-06。使用者明確要求「依據分組 commit，不能覆蓋也不能丟失相關改動」。此輪只整理提交，不推送、不合併、不部署或套正式 migration。

## 提交單元

| 組別 | repo | commit | 範圍 | 提交驗證 |
|---|---|---|---|---|
| 01 | mini-taiwan-pulse | `0de64be` | AI 缺值／截斷樣本語意 | 型別＋24 tests |
| 02 | mini-taiwan-pulse | `6609b9e` | AI 執行引擎延後載入 | 型別＋4 tests |
| 03 | mini-taiwan-pulse | `d041515` | Embed metadata／renderer 邊界 | 型別＋52 passed／1 skipped |
| 04 | mini-taiwan-pulse | `f736321` | 帳號 tier 隔離與寫入重試 | 型別＋7 tests |
| 05 | mini-taiwan-pulse | `08c4e3a` | 共用搜尋與會員保存完整接線 | 型別＋24 tests |
| 06 | gis-platform | `79d8744` | 上游私有表 migration／RLS／配額與測試 | SHA256 與已通過 PG17 驗收的 migration 一致 |
| 07 | mini-taiwan-pulse | 本文件首次新增的 commit | 審計／交付／提交與回滾證據 | JSON、文件連結、staged diff |

上游 06 先於前端 05 提交，維持 DB 契約先行；列號對應使用者核准的分組，不代表跨 repo 的時間順序。文件組 commit subject 為 `docs: record foundation audit and atomic delivery evidence`，可用 `git log --diff-filter=A -- docs/audit/foundation-2026-09-06/evidence/atomic-commits.md` 找到確切 hash。

## 沒有遺失或覆蓋的檢查

- 提交前先備份 55 個變更檔，包含未追蹤檔；另存 `git diff --binary`、index diff、原 HEAD 與 SHA256 manifest。備份位於 `/private/tmp/pulse-foundation-review-20260906/pre-commit-backup-20260906`，不含 ignored env、node_modules 或大型圖資。
- 所有 stage 都指定檔案。App 的 AI import 先由 HEAD 產生單行變更 blob，只寫 Git index；完整工作檔中的會員接線沒有被暫時覆寫。
- 前端 01–05 每次均以 `git write-tree` 從暫存區匯出 source/config 快照做 `npx tsc -b` 及對應測試，不依賴未提交的會員檔案。
- Embed 快照初次少帶兩份原有 export test fixture，出現 ENOENT；補入該 staged tree 的腳本後，52 passed／1 skipped。沒有為了過測試修改產品程式。
- 提交整理沒有修改任何程式碼／SQL；僅更新 4 份文件的 commit 狀態、新增本對照文件。原始文件版本保留在提交前備份；其他原檔逐一比對 SHA256。
- 全站上一輪驗收為 119 files／1,145 passed／3 skipped、TypeScript 與 build 通過。這次程式／SQL內容不變，因此不將這次逐組測試冒充重新跑過全站 browser。

## 回滾規則與證據

已在 `/private/tmp` 的獨立 Git index，將前端 05→04→03→02→01、上游 06 反向套用；每一步的 tree 都與原 commit 的 parent tree 完全相同。這項驗證沒有改動真實 worktree、index 或分支。

前端有相依關係：完整退回時，先回滾文件，再按會員接線 → Auth → Embed → AI 延後載入 → AI 語意修正倒序處理。`git revert` 是後續需要時才執行的動作；目前沒有對真實分支做 revert。不要對共享、仍有未提交工作的位置用 reset/clean 取代。

上游 commit 的 Git 回滾只移除 SQL 檔案，**不代表還原已套用的資料庫**。正式 migration 407 目前未套用；未來若已上線，先停會員寫入／回退前端，保留私人表與使用者資料，不能因回滾程式而 DROP TABLE。

兩個分支：

- 前端：`codex/project-foundation-member-audit-20260906`，base `44f85e6`。
- 上游：`codex/member-private-storage-20260906`，base `ceabc82`。

既有原工作目錄與其未提交改動均未納入本輪 commit。新 worktree 的 commit 儲存在各原 repo 的 Git object store，由上述分支保留。
