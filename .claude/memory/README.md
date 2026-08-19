# .claude/memory/

Mini Taiwan Pulse 專案記憶系統。Session 開頭讀這裡，結束時透過 `/wrap-up` 更新。

## 檔案總覽

### 核心檔

| 檔案 | 用途 | 更新時機 |
|---|---|---|
| [STATUS.md](STATUS.md) | 當前進度、下一步 | 每次 session 結束 |
| [BACKLOG.md](BACKLOG.md) | 待辦清單（P0/P1/P2/P3） | 新 idea / 完成項目 |
| [DATA_SCOPE.md](DATA_SCOPE.md) | 資料盤點（Supabase / 靜態 GeoJSON / S3） | 新資料上線後 |
| [PRINCIPLES.md](PRINCIPLES.md) | 不用再溝通的預設 | 新共識產生時 |
| [PLAYBOOKS.md](PLAYBOOKS.md) | 固定流程 SOP | 重複流程定型時 |
| [GLOSSARY.md](GLOSSARY.md) | 術語與代碼對照 | 遇到新術語時 |
| [INCIDENTS.md](INCIDENTS.md) | 踩坑 + 教訓（append-only） | 遇到問題並解決後 |
| [REFLECTIONS.md](REFLECTIONS.md) | Session 反省（append-only） | 每次 `/wrap-up` |

### 專案特定／選讀檔

| 檔案 | 用途 | 讀寫時機 |
|---|---|---|
| [FORESTRY_GROUP_STATUS.md](FORESTRY_GROUP_STATUS.md) | 林業圖層 campaign 歷史狀態 | 只有當次 scope 涉及該 campaign 才讀／更新 |
| [PMTILES_STATUS.md](PMTILES_STATUS.md) | PMTiles 批次轉換歷史狀態 | 只有當次 scope 涉及該 campaign 才讀／更新 |

`README.md` 是 routing SSOT，`load-session.sh` 是輕量注入工具，都不算需要每次 wrap-up 更新的 memory 內容。新增專案特定檔時，只需在本表登記用途與讀寫條件，不維護固定檔案總數。

## Session 開頭 SOP（給未來的 Claude）

1. 讀 `STATUS.md` → 知道現況、上次結束點
2. 掃 `BACKLOG.md` → 知道待辦優先級
3. 查 `PRINCIPLES.md` → 避免重開溝通已定案的事
4. 必要時查 `DATA_SCOPE` / `PLAYBOOKS` / `GLOSSARY`
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
| **Feature 文件** | `docs/features/<slug>/` | 單一 feature 完整脈絡 | README + backlog + changelog + handoff |
| **跨 repo SSOT** | `taipei-gis-analytics/docs/{handoff,adr}/` | 資料契約 + 決策紀錄 | Handoff（下游要接的） + ADR（決策） |

### 分工判斷樹

新記憶進來時問自己：

1. **是不是「這次要用完就丟」？** → 不用寫，直接做事
2. **是不是「一個 feature 的脈絡」？** → `docs/features/<slug>/`
3. **是不是「跨 repo 的資料契約 / 架構決策」？** → `taipei-gis-analytics/docs/{handoff,adr}/`
4. **是不是「全站規則、多 feature 共用」？** → `.claude/memory/PRINCIPLES.md` 或 `CLAUDE.md`
5. **是不是「踩坑事件的長文分析」？** → `.claude/pitfalls/YYYY-MM-DD-*.md`
6. **是不是「個人偏好 / WIP 短期 status」？** → 全域 `~/.claude/projects/.../memory/`
7. **是不是「當週動態」？** → `.claude/memory/STATUS.md`

### 歷史清理原則

- 全域 `~/.claude/projects/.../memory/` 中 `<feature>-status.md` 型檔案 → **功能上線後**應該併入 `docs/features/<slug>/README.md` 或 `changelog.md`，然後全域 memory 檔可以刪
- 全域 `feedback_*.md` → 若是 P0 級規則應該搬進 `PRINCIPLES.md`；純個人習慣可留全域

詳見可移植框架說明：[../FRAMEWORK.md](../FRAMEWORK.md)
