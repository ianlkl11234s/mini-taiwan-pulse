---
name: wrap-up
description: 只在使用者明確要求 session 收尾、整理專案記憶、或 commit memory 時使用。不因一般任務完成、狀態報告或程式碼 commit 自動觸發。
---

# Wrap-up v2

把本 session 收成可審查、可接手、不誤報 release 狀態的 checkpoint。
Wrap-up 只處理記憶與收尾 commit；不因此取得 upload、deploy、push、merge 或資料變更授權。

## 1. Gather：先定義 scope

先用對話與工具記錄建立 **scope ledger**：

- touched repos，每個 repo 的 current branch、upstream、intended base、`git status`。
- 本 session 的 commit range；比較 intended base，不假設 base 名為 `master`。
- external systems 與真實 side effects：object storage、DB/migration、deploy platform、CDN、PR。
- 非本 session 的 dirty files 或 commits；標示後保留，不代為整理。

然後讀 `.claude/memory/README.md` 的 routing。依本 session 事件**選讀**可能要更新的 memory；
選中的檔案要讀完，但不固定讀 9 檔，也不整包讀 `.claude/memory/`。

證據只來自本 session 對話、repo 現況、實際命令與已維護文件。不跨 session 臆測，不把 commit message 當 runtime 證明。

## 2. Release truth matrix

只要本 session 碰到 artifact 或 release，固定用下列順序記錄每個 release unit：

| build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|

每格只能是 `done` / `failed` / `blocked` / `unknown` / `not run` / `N/A`，並附最小可核對證據。
`unknown` 只用於證據不足、無法判定真實狀態；已知卡點用 `blocked`，尚未執行用 `not run`。

- 上游完成不等於下游完成；`upload ≠ deploy ≠ browser verified`。
- upload 後要分開記 readback（checksum / size / metadata）。
- 自動測試記指令、範圍與結果；不把 tsc/unit tests 寫成視覺驗收。
- browser 或 network 工具不可用時寫 `blocked`，不改用代碼推斷補勾。
- 非 release 任務可省略此矩陣。

### Contradiction gate

若對話、git、feature docs、memory 或 external state 相互衝突：

1. 先列出衝突與影響，用當下可得的第一手證據核對。
2. 無法解決就保留 `blocked` / `unknown`，不為收尾而選好看的答案。
3. 在矛盾澄清前，不將相關項目寫成 done，不進入 Apply。

## 3. Analyze 與 routing

依 `memory/README.md` 的當前定義分流，不為了「全更」而碰無關檔案。

- `STATUS.md`：rewrite，只保留當前 touched repos、release truth、blockers 與下一步。
- `DATA_SCOPE.md`：數字必須直接從 canonical data、DB query、artifact metadata、`wc`/parser 或同等第一手來源驗證；不單信對話摘要或舊文件。
- `BACKLOG.md`：每個未完成項都要有 blocker、next step 與 acceptance criteria；不以「待處理」結案。
- `INCIDENTS.md` / `REFLECTIONS.md`：append-only；沒有新證據不回寫舊條目。
- `PRINCIPLES.md`：新舊原則衝突時，明確取代舊原則並留演進原因。
- `PLAYBOOKS.md`：只記已重複實證的流程。單次做法放 feature docs 或 reflection。

收尾必須留下 **next-session entry**：目標 repo/branch、當前 blocker、第一個可執行步驟、驗收條件。

## 4. Draft 與 Confirm

先只回報：

1. scope ledger 摘要。
2. release truth matrix（若適用）。
3. memory 變更總表：每檔一行、一句摘要（≤20 字）。
4. 衝突、未完成項、next-session entry 與不應碰的檔案。

不 dump 完整 diff、markdown 全文或每個 edit 片段。問：**全採用 / 看某檔細節 / skip 某檔？**
使用者確認前不編輯 memory，不 stage，不 commit。

## 5. Apply 與 atomic commits

只在 Confirm 後套用核准項目：

1. 編輯前重讀目標檔；保留 unrelated dirty changes。
2. 若同一 target memory file 已含非本 session 或平行 session hunks，path-scoped commit 無法隔離；立即停止並請使用者協調，不得代為 commit 整檔。
3. Commit 前先記錄並列出 `git diff --cached --name-only` 的 cached path set，辨識並保留 unrelated pre-staged paths；不要求整個 staging area clean。
4. 每個 memory 檔做 path-scoped diff-check 與 `git add <exact-path>`，再用 `git commit --only -m "..." -- <exact-path>` 建立一檔一個 atomic commit。禁用 `git add -A`。
5. commit 訊息用 `memory: <action> <file> (<summary>)`，不加假 co-author 或模型身分。
6. pre-commit hook 失敗時，commit 尚未產生：修正後重跑**同一個 commit**，不新開 fix commit，不 amend 不存在的 commit。
7. `STATUS.md` 最後提交。
8. 結束時只確認 target memory paths 已 clean，並列出仍保留的 unrelated staged 與 dirty state。

## Push 邊界

不自動 push。最後顯示 current branch、upstream 與 ahead/behind，單獨詢問 push 授權。
只提示 current branch 的明確 refspec（例如 `git push origin HEAD:<current-branch>`），
不寫死 `master`/`main`，不把 push 授權延伸成 PR、merge 或 deploy 授權。
