# .claude/memory/

Mini Taiwan Pulse 專案記憶系統。有接手需求時從這裡選讀，結束時透過 `/wrap-up` 更新。

> **經驗總集（主題導覽）**：[`docs/LESSONS.md`](../../docs/LESSONS.md)——踩坑、best practice、網站哲學、小實驗依主題整理，每條連回本目錄或 docs 的正本。想知道「這類事以前學到什麼」先看它；新教訓先寫正本，再到 LESSONS.md 加一行。

## 單一入口（2026-11-08 起）

mini-taiwan-pulse 是整個 Pulse 生態系的總 PM，現況只看三份，各司其職：

| 層 | 檔案 | 放什麼 |
|---|---|---|
| 專案層 | [`docs/PROJECTS.md`](../../docs/PROJECTS.md) | 一列一專案；上半部只放「進行中／待拍板」，已上線待收尾、暫停、構想摺疊在 `<details>`；開頭「現在最該注意」＝有期限的事（日期排序）＋本週進行中 |
| 任務層 | [BACKLOG.md](BACKLOG.md) | 一列一個可關閉的 ID，依主題群分段（A 正式站目視包 … N 模擬實驗），每列標 Tier（底線／北極星／內容／待討論） |
| 發版層 | [STATUS.md](STATUS.md) | 只留最近一次發版 checkpoint；舊段在 `docs/archive/<日期>/STATUS-history.md` |

**開場讀法**：先讀 PROJECTS 上半部 → 需要細節才查 BACKLOG 對應主題群 → STATUS 只看最近發版。`.gis-agent-system` 只放 ADR（`decisions/`）與跨 repo 計畫書（`projects/<slug>/`），不放進度。

**已停更的狀態文件**（不要再更新，也不要從它們判斷現況）：

| 文件 | 改看 |
|---|---|
| `.gis-agent-system/orchestrator/SESSION_BOARD.md` | `docs/PROJECTS.md` |
| `.gis-agent-system/OPEN_QUESTIONS.md` | PROJECTS 待拍板列／BACKLOG `待討論` tier |
| `.gis-agent-system/roadmap/status/release-queue.md` | `CHANGELOG.md`＋STATUS |
| `.gis-agent-system/roadmap/status/backlog.md` | 本目錄 BACKLOG.md |
| `.gis-agent-system/roadmap/status/ai-mcp.md` | `.gis-agent-system/roadmap/status/agent-analysis-runbook.md`＋BACKLOG I 群 |

（這些檔在另一個 repo，本 repo 只記錄停更；它們本身的封存標記另行處理。）

## 檔案總覽

### 核心檔

| 檔案 | 用途 | 更新時機 |
|---|---|---|
| [STATUS.md](STATUS.md) | 最近一次發版 checkpoint | 每次發版 |
| [BACKLOG.md](BACKLOG.md) | 任務層待辦（依主題群分段、每列標 Tier） | 新任務／完成項目（完成移到已關閉並附證據） |
| [DATA_SCOPE.md](DATA_SCOPE.md) | 資料盤點（Supabase / 靜態 GeoJSON / S3） | 新資料上線後 |
| [PRINCIPLES.md](PRINCIPLES.md) | 不用再溝通的預設 | 新共識產生時 |
| [PLAYBOOKS.md](PLAYBOOKS.md) | 固定流程 SOP | 重複流程定型時 |
| [GLOSSARY.md](GLOSSARY.md) | 術語與代碼對照 | 遇到新術語時 |
| [INCIDENTS.md](INCIDENTS.md) | 踩坑 + 教訓（append-only） | 遇到問題並解決後 |
| [REFLECTIONS.md](REFLECTIONS.md) | Session 反省（append-only） | 每次 `/wrap-up` |

## Backlog SSOT 與 lifecycle

- [BACKLOG.md](BACKLOG.md) 只負責全站排序，依主題群分段（規則與群清單見該檔檔頭）：正式站目視包、Zeabur 收尾、資料保留、資安、collector 健康、舊路徑撤除、開發系統、台灣／多國圖層、Agent、前端技術債、產品舊決策、內容、文件衛生、模擬實驗。
- **2026-11-09 起待辦只有一個家**：未完成工作一律寫進 [BACKLOG.md](BACKLOG.md)（可附 feature 文件連結當細節）。舊的 `docs/features/<slug>/backlog.md` 已讀過、仍有效的項目搬進 BACKLOG 後整份封存到 `docs/archive/2026-11-09/`；feature 資料夾保留 README／changelog／handoff 等脈絡文件，不再新開 backlog.md。
- Priority 與 State 分開：Priority 只比較現在可執行工作；State 使用 `ready` / `in_progress` / `blocked` / `waiting_external` / `conditional` / `verifying`，併入別列的用 `merged`（白名單就這 7 個，`scheduled` 這類改寫成 `conditional`＋not_before）。
- `conditional` 必填 trigger 或 `not_before`、owner 與觸發後第一個 action；未觸發前不當成 P0/P1 active work。
- 完成項從表格移到 BACKLOG 檔尾「已關閉」，只留一行證據（PR、版號、讀回或使用者確認）；詳細過程仍在 feature `changelog.md`、release notes 或 git history，核心 backlog 不保留長篇歷史。已放棄方案移 decision record / archive，不留在 active queue。
- 每個 ID 全專案唯一；同一工作只能有一個 primary home，其他檔案只用 link 引用。

### 入口文件自動檢查（`npm run check:entry-docs`，2026-11-10 起）

`scripts/dev/check-entry-docs.mjs` 檢查 PROJECTS 與 BACKLOG 不互相矛盾；`npm run check` 與 CI（`entry-docs` job，只動 `.claude/**` 的 PR 也會跑）都會執行。範圍：PROJECTS 從開頭到「## 已結案」；BACKLOG 從開頭到第一個「## 已關閉」（之後全算已關閉段，不檢查）。

| 規則 | 內容 |
|---|---|
| `closed-id` | PROJECTS 表格的「下一步」「正本」「BACKLOG」三欄引用的 ID 若只在 BACKLOG 已關閉段 → 紅。已完成的事寫在「做到哪」欄，或不寫 ID。縮寫（`SEC-3／4`、`DEV-2～6`、`VP-1～VP-13`）會展開比對。FB 列 Item 內〔slug〕後的原 ID（例 FB-023 的 BC-3）算未關閉。 |
| `unknown-id` | 「BACKLOG」欄、其他欄「BACKLOG 」字樣之後（到「；」為止）、以及「下一步」欄以「ID：」開頭的子句，引用了 BACKLOG 查無的 ID → 紅（要先開列）。 |
| `deadline` | 「有期限的事」表的期限早於今天（Asia/Taipei）且該列沒有結果標記 → 紅。期限取格內第一個日期（改期時新日期寫在前、原日期放括號）：`~2026-11-12～14` 取 14 日、`2027-03 前`／`約 2027-05` 取月底、`持續留意` 不檢查。**結果標記**寫在該列任一格：`〔結果 YYYY-MM-DD：一句結果〕`；〔待確認〕不算結果。處理方式三選一：寫結果、改期（期限欄寫新日期並註明原日期與理由）、刪列。 |
| `state` | BACKLOG 未關閉段的 State 必須在上面的 7 個白名單內。 |
| `link` | 兩檔未關閉段的 markdown 相對連結（`[…](路徑)`）必須指向 repo 內存在的檔；連到 repo 外（`../../../.gis-agent-system/…` 這類跨 repo 路徑）與純文字路徑不檢查。 |
| `archive-link` | PROJECTS「正本」欄不得連到 `docs/archive/`（封存檔不是正本）。BACKLOG FB 列的「原檔」連 archive 是刻意的，不受此限。 |

**豁免**（確實需要時才用）：在該行加 `<!-- entry-docs-ignore <規則名>: <理由> -->`，理由必填，沒寫理由本身就會報錯。測試：`src/test/checkEntryDocs.test.ts`（fixture 字串，不讀真檔）；指定日期重跑：`node scripts/dev/check-entry-docs.mjs --today YYYY-MM-DD`。

### 專案特定／選讀檔

| 檔案 | 用途 | 讀寫時機 |
|---|---|---|
| FORESTRY_GROUP_STATUS.md | 林業圖層 campaign（2026-06）歷史狀態 | **已歸檔（2026-10-16）**，見 [`docs/archive/2026-10-16/`](../../docs/archive/2026-10-16/)；campaign 已完成，不再更新 |
| PMTILES_STATUS.md | PMTiles 批次轉換（2026-06）歷史狀態 | **已歸檔（2026-10-16）**，見 [`docs/archive/2026-10-16/`](../../docs/archive/2026-10-16/)；現況以 `find public -name '*.pmtiles'` 為準 |

`README.md` 是 routing SSOT，`load-session.sh` 是輕量注入工具，都不算需要每次 wrap-up 更新的 memory 內容。新增專案特定檔時，只需在本表登記用途與讀寫條件，不維護固定檔案總數。

## Session 開頭 SOP（給未來的 Claude）

> 2026-10-16 對齊 CLAUDE.md「Session 記憶迴圈」：SessionStart hook 只給短路由，**不預載**；以下是有接手需求時的選讀順序，只讀與本次 scope 相關的檔與段落。

1. 接續上次工作 → `docs/PROJECTS.md` 上半部（進行中／待拍板、現在最該注意）；最近一次發版看 `STATUS.md`
2. 要排優先級或查單一任務 → `BACKLOG.md` 對應主題群
3. 動手前想確認既有共識 → `PRINCIPLES.md` 相關段（或先看 `docs/LESSONS.md` 找主題）
4. 必要時查 `DATA_SCOPE` / `PLAYBOOKS` / `GLOSSARY`；似曾相識的 bug 搜 `../pitfalls/`
5. **不變規則**在專案根 [../../CLAUDE.md](../../CLAUDE.md)

## Session 結束 SOP（wrap-up v2）

使用者喊 `/wrap-up` 時觸發同名 skill，詳見 `.claude/skills/wrap-up/SKILL.md`：

1. **README routing**：先讀本檔，確認核心檔、選讀檔與寫回邊界，不靠固定檔案數。
2. **Selective reads**：用 `STATUS` 最新區段、`BACKLOG` / `PRINCIPLES` 標題索引做初步路由；確定要寫回的檔後，編輯前完整讀該檔。不整包讀 `memory/`，也不讀與本 session 無關的選讀檔。
3. **Scope**：建立 scope ledger，列出 touched repos 的 current branch、upstream、intended base、commit range、worktree 狀態，external side effects，以及必須保留的平行 session dirty files / commits。
4. **Evidence**：用對話、當前 repo 現況、path-scoped status/diff/log、測試、checksum／manifest／query 等第一手證據驗證數字與完成宣稱；commit message 不等於 runtime 證明。
5. **Release matrix**：只要涉及 artifact 或 release，對每個 release unit 依 `build / contract/wire / stage / upload / readback / pull / deploy / HTTP / browser` 分開對帳；每格只能是 `done` / `failed` / `blocked` / `unknown` / `not run` / `N/A` 並附證據。`unknown` 只限證據不足、無法判定真實狀態；已知卡點用 `blocked`，尚未執行用 `not run`。非 release 任務可省略。
6. **Contradiction**：memory、git、artifact 或 release state 互相衝突時，先列出證據與未解決點，不自行用單一來源覆寫。
7. **Draft**：只提出「檔案／變動類型／證據／一句摘要」的可審核總表；使用者要求時才展開單檔草稿。
8. **Confirm**：使用者明確選擇全採用、查看細節或 skip 哪些檔後，才寫回與 commit。
9. **Atomic**：commit 前先記錄 `git diff --cached --name-only` 的 cached path set，辨識並保留 unrelated pre-staged paths。每個已核准 `.claude/memory/<file>` 先做 path-scoped diff-check 與 `git add <exact-path>`，再用 `git commit --only -m "..." -- <exact-path>` 建立一檔一個 `memory:` commit，`STATUS` 最後；不用 `git add -A`、不 amend、不 push。若同一 target memory file 混有平行 session hunks，path-scoped commit 無法隔離；必須停止並請使用者協調，不得整檔代 commit。hook 失敗而 commit 未產生時，修正後重跑同一 commit。
10. **Closeout**：只確認 target memory paths clean，並列出仍保留的 unrelated staged 與 dirty state；留下 next-session entry（repo/branch、blocker、第一個可執行步驟、驗收條件）。回報 current branch/upstream/ahead-behind 與 release matrix 未竟事項；push/PR/deploy 需另行授權。

Release matrix 的最小格式：

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| `<artifact / service / page>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` | `<state + evidence>` |

## 記憶腐化檢查

- `INCIDENTS` / `REFLECTIONS` 只 append，不刪除
- `STATUS` 每次重寫，只保留當下狀態
- `PRINCIPLES` 衝突時：新原則覆蓋舊，舊的搬去 `INCIDENTS` 記錄演進
- `/wrap-up` 跑完第 10 次後，回頭掃 `DATA_SCOPE` 是否過期

## 分層（雙 memory 系統分工）

| 層級 | 位置 | 性質 | 什麼進來 |
|---|---|---|---|
| **全域 auto-memory** | `~/.claude/projects/.../memory/` | 個人偏好 + 跨 session WIP status | `feedback_*.md`（用戶偏好，長期）；`<feature>-status.md`（in-flight WIP，功能上線後歸檔） |
| **規則** | `CLAUDE.md`（本 repo） | 不變規則、程式風格 | 開發鐵則、目錄慣例、Git workflow |
| **狀態框架** | `.claude/memory/`（本 repo，跟 commit） | 專案本體：pattern / 事件 / 術語 / backlog | 本檔列出的核心檔＋按任務選讀的專案特定檔 |
| **長文** | `.claude/pitfalls/` | 事件 long-form archive | 具體 incident 的完整 postmortem |
| **Feature 文件** | `docs/features/<slug>/` | 單一 feature 完整脈絡 | README + changelog + handoff（待辦一律進 BACKLOG） |
| **專案總表（現況入口）** | [`docs/PROJECTS.md`](../../docs/PROJECTS.md) | 做到一半的專案總覽（一列一專案，只放指標） | 狀態、Tier、下一步、正本連結；收尾時更新 |
| **跨 repo SSOT** | `taipei-gis-analytics/docs/{handoff,adr}/` | 資料契約 + 決策紀錄 | Handoff（下游要接的） + ADR（決策） |

### 分工判斷樹

新記憶進來時問自己：

1. **是不是「這次要用完就丟」？** → 不用寫，直接做事
2. **是不是「一個 feature 的脈絡」？** → `docs/features/<slug>/`
3. **是不是「跨 repo 的資料契約 / 架構決策」？** → `taipei-gis-analytics/docs/{handoff,adr}/`
4. **是不是「全站規則、多 feature 共用」？** → `.claude/memory/PRINCIPLES.md` 或 `CLAUDE.md`
5. **是不是「踩坑事件的長文分析」？** → `.claude/pitfalls/YYYY-MM-DD-*.md`
6. **是不是「個人偏好 / WIP 短期 status」？** → 全域 `~/.claude/projects/.../memory/`
7. **是不是「專案狀態改變」？** → `docs/PROJECTS.md` 該列；**發版 checkpoint** → `.claude/memory/STATUS.md`

### 歷史清理原則

- 全域 `~/.claude/projects/.../memory/` 中 `<feature>-status.md` 型檔案 → **功能上線後**把仍有用的內容併入 `docs/features/<slug>/README.md` 或 `changelog.md`，記憶檔搬到 `_archive/`（不刪，見下節）
- 全域 `feedback_*.md` → 若是 P0 級規則應該搬進 `PRINCIPLES.md`；純個人習慣可留全域

### 每月記憶整理（2026-11-09 使用者拍板）

使用者原則：「原始資料不要刪，可能之後還可以有缺漏可以去補」；任何項目不可自動砍。每月一次（或使用者說「整理記憶／文件」時）依序做：

1. **備份**：個人 memory 目錄整份 `cp -p` 到 `memory/_archive/originals-<YYYYMMDD>/`（含 `ctx-handoff.md`、所有 `*-status-ref.md`、`MEMORY.md`；data-collectors 的 ctx-handoff 放子資料夾）。
2. **status-ref**：逐檔對照 [`docs/PROJECTS.md`](../../docs/PROJECTS.md) 與 [BACKLOG.md](BACKLOG.md)（讀 `origin/develop` 版）。已上線結案 → 搬 `_archive/`、檔首加一行歸檔原因與正本，MEMORY.md 改成歸檔表一行；進行中 → 精簡成「狀態一句＋正本連結＋只存在這裡的使用者決定」。不確定的保留原狀。
3. **ctx-handoff**：保持 `## 記憶`／`## 規則` 結構與 `[project]`／`[reference]`／`[user]`／`[feedback]` 前綴（由 shark-tank mod 解析）。合併重複、已被正本完整收錄的改成一行指標、更新過時狀態；規則合併同義條、每條「根據」留 2–3 條代表。寫回前確認背景 mod 沒有同時追加。
4. **功能文件待辦**：`docs/features/**` 若又長出待辦清單，仍有效的搬進 BACKLOG 對應主題群（標 Tier、附原檔連結），原檔封存到 `docs/archive/<日期>/`（連結一併改）。
5. **〔待勾選〕**：已完成但查不到證據、過時、過小的項目，不自行關閉，列進 BACKLOG「待勾選」段讓使用者勾。
6. MEMORY.md 每行一個指標；最後在 PROJECTS「最後盤點」與 journal 留一行。

詳見可移植框架說明：[../FRAMEWORK.md](../FRAMEWORK.md)
