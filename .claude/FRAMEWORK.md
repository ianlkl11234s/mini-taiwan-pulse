# Self-Evolving Project Memory Framework

一個給 Claude Code 專案使用的、會自我反省與持續優化的記憶系統。

> 本文是可移植的說明書（**只講記憶框架**）。在新專案複製這個框架時，照這份做即可。
>
> 本專案這台機器上的**完整 harness**（SessionStart hook / 4 個 MCP server / Codex 鏡像 / 維運節奏）另見 [`HARNESS.md`](./HARNESS.md)——那些是機器/專案特定、不隨框架搬移的部分。

---

## 1. 為什麼需要這個系統

### 問題
- Claude Code 每個 session 重啟就失憶，context window 有限
- 全域 memory（`~/.claude/...`）夠大但跨專案，容易被其他專案污染、或長期腐化
- 純 `CLAUDE.md` 只適合放「不變規則」，放狀態會很快過期卻又改不動

### 解法
把記憶**分層**：

| 層 | 位置 | 性質 | 變動頻率 |
|---|---|---|---|
| 全域 | `~/.claude/.../memory/` | 跨專案 / 用戶偏好 | 低 |
| 規則 | `<project>/CLAUDE.md` | 不變規則（程式風格、流程） | 低 |
| **狀態** | `<project>/.claude/memory/` | **變動狀態 + 反省 + backlog** | **高** |
| 長文 | `<project>/.claude/pitfalls/` | 事件的 long-form archive | 低 |

**核心設計決策**：
1. **狀態層 commit 進 git** — 跨機器、跨會話、有 history
2. **README 路由＋單一職責** — 核心記憶與專案特定檔都在 `memory/README.md` 登記，不維護固定總數
3. **Atomic commit + `memory:` prefix** — git log 可追「記憶如何演進」
4. **append-only 的反省檔 + 每次 rewrite 的 STATUS** — 既保留歷史又保持清爽
5. **`/wrap-up` skill 自動收尾** — Claude 自己反省、自己 commit

---

## 2. 目錄結構

```
<project>/
├── CLAUDE.md                      # 不變規則（build 檢查、程式風格）
└── .claude/
    ├── README.md                  # .claude/ 目錄索引
    ├── FRAMEWORK.md               # 本檔（可移植說明書）
    ├── memory/                    # ⭐ 狀態層
    │   ├── README.md              # 記憶索引 + Session SOP
    │   ├── STATUS.md              # 當前進度（每次 rewrite）
    │   ├── BACKLOG.md             # 待辦（P0/P1/P2/P3）
    │   ├── PRINCIPLES.md          # 預設 + 決策（不用再溝通）
    │   ├── PLAYBOOKS.md           # 固定流程 SOP（做過 ≥2 次才寫）
    │   ├── GLOSSARY.md            # 術語表
    │   ├── INCIDENTS.md           # 踩坑 + 教訓（append-only）
    │   ├── REFLECTIONS.md         # Session 反省（append-only）
    │   └── <PROJECT_SPECIFIC>.md  # 例：DATA_SCOPE.md / API_CONTRACTS.md
    ├── skills/
    │   └── wrap-up/
    │       └── SKILL.md           # ⭐ 收尾 + 自我反省 skill
    └── pitfalls/                  # long-form archive（INCIDENTS 的長文）
```

---

## 3. 檔案職責與更新規則

### `STATUS.md` — 當下狀態（每次 rewrite）
- 本次 session 做了什麼、下一步是什麼
- 等用戶執行的動作（check list）
- 累計狀態快照（可從其他檔摘要過來）

**更新時機**：每次 `/wrap-up` 必 rewrite，**只保留當下**。

### `BACKLOG.md` — 待辦
- 表格：`ID | 優先級 | 項目 | 狀態 | Blocker/備註`
- 優先級：P0 阻塞 / P1 規劃期 / P2 穩定後 / P3 nice-to-have
- 下方保留「已完成（近期 10 筆）」區

**更新時機**：想到新 idea、完成舊項目時。

### `PRINCIPLES.md` — 不用再溝通的預設
- 專案層：預設日期、語言、時區
- 技術慣例：指令、工具、shell 風格
- 行為原則：Claude 自律規則（例：「不盲信 memory」）

**更新時機**：達成新共識時。衝突時新覆蓋舊，舊的搬去 INCIDENTS。

### `PLAYBOOKS.md` — 固定 SOP
- 標號 `PB-01` / `PB-02` / ...
- Step-by-step 指令清單
- 規則：**同一操作做過 ≥ 2 次**才寫進來

**更新時機**：流程定型時、或 PRINCIPLES 新增時同步更新相關 PB。

### `GLOSSARY.md` — 術語表
- 外部 API 術語（含 credit 計價、rate limit）
- 代碼對照（例：ICAO 前綴、region 分類）
- 專案自造詞（例：runway-buffer fallback）

**更新時機**：遇到新術語時。

### `INCIDENTS.md` — 踩坑（append-only）
- 格式：`## YYYY-MM-DD 標題` → 現象 / 根因 / 對策
- 長文存 `.claude/pitfalls/` 後這裡放摘要 + link

**更新時機**：遇到 bug 並修好後。**絕對不刪**（歷史價值）。

### `REFLECTIONS.md` — Session 反省（append-only）
- 格式：`## YYYY-MM-DD 標題` → What worked / What didn't / Next-time rules / Memory 產出
- 每次 `/wrap-up` 追加

**更新時機**：每次 `/wrap-up`。**絕對不刪**。

### 專案專屬檔（可選）
依專案性質加。範例：

| 專案類型 | 建議檔名 |
|---|---|
| 資料處理 | `DATA_SCOPE.md`（本 GIS 專案用的） |
| API 整合 | `API_CONTRACTS.md` |
| 前端產品 | `FEATURES.md` |
| Library | `PUBLIC_API.md` |

---

## 4. `/wrap-up` Skill — 自我反省迴圈

收尾 skill 是整個系統的核心運作機制。位置：`.claude/skills/wrap-up/SKILL.md`

### v2 流程

1. **README routing**：先讀 `memory/README.md`，以當下 roster 判斷核心檔與專案特定檔。
2. **Selective reads**：用 `STATUS` 最新區段與 `BACKLOG` / `PRINCIPLES` 標題索引做初步路由；確定要寫回的檔後，編輯前完整讀該檔。不整包讀 `memory/`。
3. **Scope**：建立 scope ledger，明列 touched repos 的 current branch、upstream、intended base、commit range、worktree 狀態、external side effects 與 out-of-scope dirty files / commits。
4. **Evidence**：以對話、當前 repo 現況、path-scoped git status/diff/log、測試與 artifact 證據驗證完成宣稱；數字依來源用 manifest、query、feature count、checksum 或 line count，commit message 不當 runtime 證明。
5. **Release matrix**：涉及 artifact 或 release 時，每個 release unit 依 build、contract/wire、stage、upload、readback、pull、deploy、HTTP、browser 分開記錄；每格只能是 `done` / `failed` / `blocked` / `unknown` / `not run` / `N/A` 並附證據。`unknown` 只限證據不足、無法判定真實狀態；已知卡點用 `blocked`，尚未執行用 `not run`。非 release 任務可省略。
6. **Contradiction**：對話、memory、git 或 artifact 衝突時，列出各自證據與未解點，不自行抹平。
7. **Draft**：給使用者「檔案／變動類型／證據／一句摘要」的總表；被要求時才展開單檔草稿。
8. **Confirm**：使用者明確選擇全採用、看細節或 skip 後才寫回。
9. **Atomic**：commit 前先記錄 `git diff --cached --name-only` 的 cached path set，辨識並保留 unrelated pre-staged paths。每個已核准 memory path 先做 path-scoped diff-check 與 `git add <exact-path>`，再用 `git commit --only -m "..." -- <exact-path>` 建立一檔一個 `memory:` commit，`STATUS` 最後；不用 `git add -A`，不 amend、不 push。若同一 target memory file 混有平行 session hunks，path-scoped commit 無法隔離；必須停止並請使用者協調，不得整檔代 commit。hook 失敗且 commit 未產生時，修正後重跑同一 commit。
10. **Closeout**：只確認 target memory paths clean，並列出仍保留的 unrelated staged 與 dirty state；留下 next-session entry（repo/branch、blocker、第一個可執行步驟、驗收條件），並回報 current branch/upstream/ahead-behind 與 release matrix 未竟事項。push/PR/deploy 仍要另行授權。

Release matrix 最少要有：

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|

### 關鍵原則

| 原則 | 為什麼 |
|---|---|
| **README first，選擇性讀取** | roster 會演進；全讀 memory 會浪費 context 並把無關歷史帶入判斷 |
| **證據先於 memory** | 數字與 release state 要用相符的 manifest/query/test/checksum/git 證據驗證 |
| **INCIDENTS / REFLECTIONS 只 append** | 歷史有價值 |
| **STATUS 每次 rewrite** | 只要當下 |
| **Path-scoped Git** | 只 commit 使用者核准的 memory 檔；不要求整棵 worktree clean，不把平行 session 變更帶入 |
| **不跨 session 臆測** | 對話、git、memory 與 artifacts 要互相印證；衝突未解時誠實保留 |

### Skill 自我優化

這個 skill 自己會被 REFLECTIONS 檢討。若某次 `/wrap-up` 漏抓事件、訊息風格不好，應：
1. 在該次 REFLECTIONS 記下證據與改善方向
2. 把 skill 改動列為另案，取得明確授權後才修 `SKILL.md`
3. 下次 `/wrap-up` 驗證新版是否解決原問題

**這就是「自我演進」的機制**：系統在每次使用中校準自己。

---

## 5. 在新專案設置（5 分鐘）

### Step 1：建立目錄骨架

```bash
cd /path/to/new-project
mkdir -p .claude/memory .claude/skills/wrap-up .claude/pitfalls
```

### Step 2：複製本框架檔

```bash
cp /path/to/this-project/.claude/FRAMEWORK.md .claude/FRAMEWORK.md
cp /path/to/this-project/.claude/skills/wrap-up/SKILL.md .claude/skills/wrap-up/SKILL.md
```

### Step 3：建立核心 memory 檔與 routing README

用以下**最小模板**起手，內容隨 session 演進：

<details>
<summary><code>.claude/memory/README.md</code></summary>

```markdown
# .claude/memory/

<專案名> 專案記憶系統。Session 開頭讀這裡，結束時用 `/wrap-up` 更新。

| 檔案 | 用途 |
|---|---|
| STATUS.md | 當前進度 |
| BACKLOG.md | 待辦 |
| PRINCIPLES.md | 不用再溝通的預設 |
| PLAYBOOKS.md | 固定 SOP |
| GLOSSARY.md | 術語 |
| INCIDENTS.md | 踩坑（append-only）|
| REFLECTIONS.md | Session 反省（append-only）|

詳見 ../FRAMEWORK.md
```
</details>

<details>
<summary><code>.claude/memory/STATUS.md</code></summary>

```markdown
# Status

**最後更新**：YYYY-MM-DD（session：初始化）

## 本次 session 完成
- 建立 .claude/memory/ 記憶系統

## 等用戶執行
- （暫無）

## 下一步候選
見 BACKLOG.md
```
</details>

<details>
<summary><code>.claude/memory/BACKLOG.md</code></summary>

```markdown
# Backlog

P0 阻塞 / P1 規劃期 / P2 穩定後 / P3 nice-to-have

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| B001 | P? | <第一個待辦> | open | |

## 已完成（近期 10 筆）
- YYYY-MM-DD ✅ 建立記憶系統
```
</details>

<details>
<summary><code>.claude/memory/PRINCIPLES.md</code></summary>

```markdown
# Principles

不用再重複溝通的預設。新增原則時註明日期。

## 專案預設
- 回應語言：<繁體中文 / English>
- <其他預設>

## 技術慣例
- （隨 session 累積）

## 行為原則（Claude 自律）
- **不盲信 memory**：涉及資料存否類判斷，先 Grep / Read 驗證
- **改上游 pipeline → 下游全查**：grep -r 所有消費端
```
</details>

<details>
<summary><code>.claude/memory/PLAYBOOKS.md</code></summary>

```markdown
# Playbooks

固定流程 SOP。規則：做過 ≥ 2 次才寫進來。

---

## PB-01 <待填>
```
</details>

<details>
<summary><code>.claude/memory/GLOSSARY.md</code></summary>

```markdown
# Glossary

## 專案術語
- （隨 session 累積）
```
</details>

<details>
<summary><code>.claude/memory/INCIDENTS.md</code></summary>

```markdown
# Incidents（append-only）

格式：`## YYYY-MM-DD 標題` → 現象 / 根因 / 對策。

只 append，不改舊條目。

<!-- 追加新事件 -->
```
</details>

<details>
<summary><code>.claude/memory/REFLECTIONS.md</code></summary>

```markdown
# Reflections（append-only）

每次 /wrap-up 追加。格式：What worked / What didn't / Next-time rules / Memory 產出。

<!-- 追加新反省 -->
```
</details>

### Step 4：決定專案專屬檔

依專案性質加一個，例：
- 資料處理 → `DATA_SCOPE.md`
- API 整合 → `API_CONTRACTS.md`
- 前端產品 → `FEATURES.md`

### Step 5：更新 `.claude/README.md`

指向新結構（可從本專案 copy 當模板）。

### Step 6：首次 commit

```bash
git add .claude/
git commit -m "feat: scaffold .claude/memory/ framework"
```

### Step 7：試跑 `/wrap-up`

第一次跑 skill 可能沒太多東西可記，這沒關係——系統會隨後續 session 積累。

---

## 6. 客製化方向

### 專案差異

| 調整項 | 建議 |
|---|---|
| 回應語言 | `PRINCIPLES.md` 第一行寫死 |
| `SKILL.md` 觸發詞 | 加入該專案團隊常用說法 |
| 專案專屬檔 | 見 Step 4 |
| Commit 訊息語言 | `SKILL.md` Atomic phase 模板 |

### 反模式（不要做）

- ❌ 把 session 任務清單放進 memory（那是 Task / Plan 的責任）
- ❌ 每次全讀 `memory/` 所有檔或維護固定檔案總數（違反 README routing 與 progressive disclosure）
- ❌ INCIDENTS / REFLECTIONS 修改歷史條目（毀掉學習軌跡）
- ❌ 所有變動合併成一個 commit（失去 `memory:` atomic 的追蹤價值）
- ❌ `/wrap-up` 自動 push（用戶必須有 review 機會）
- ❌ PRINCIPLES 寫成「大概 / 通常 / 建議」（原則要明確）
- ❌ PLAYBOOKS 只做過 1 次就寫（沒定型的流程寫了會誤導）

### 成熟度指標（多久會長穩？）

- **第 1~3 次 session**：框架骨架還空，/wrap-up 產出少，正常
- **第 4~10 次**：PRINCIPLES + INCIDENTS 開始填滿，Claude 行為穩定性明顯提升
- **第 10 次後**：PLAYBOOKS 開始成形，反覆任務變成純執行
- **腐化訊號**：STATUS 顯示「上次更新 >7 天」、BACKLOG 全是 P3、REFLECTIONS 沒新條目 → 可能系統沒在用

---

## 7. 進階：多專案共用

### 全域層放什麼？
- 跨專案通用偏好（繁體中文、Python/pip 指令）
- 跨專案可復用工具（agent-browser、ffmpeg 模板）

### 專案層放什麼？
- 該專案特有的 principles / data / playbooks

### FRAMEWORK.md 放哪？
本檔本身是 **meta spec**，每個專案 `.claude/FRAMEWORK.md` 各有一份（可微量客製）。也可在全域層放一份 canonical 版本，各專案 link 過去。

---

## 8. 本框架的版本紀錄

追本框架自身的演進（在 REFLECTIONS 和 SKILL.md 之外）：

- **v2.0（2026-08-19）** — 改為 README routing＋selective reads，新增 scope/evidence/release matrix/contradiction/closeout；Git 改為 branch-aware、path-scoped，不再假設固定 memory 檔案數或 `master`。
- **v1.0（2026-04-23）** — 初版採固定 roster／舊版 Gather→Analyze→Draft→Confirm→Commit，已由 v2.0 取代。首 session 實測後產生 2 條 next-time rules（預先寫 REFLECTIONS 會重複、STATUS 每 session 至少 rewrite 一次）。
