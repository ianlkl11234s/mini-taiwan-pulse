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
2. **分類 9 個檔** — 每種資訊一個檔，單一職責
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

### 5 階段流程

1. **Gather**（並行）
   - Read memory/ 全部
   - `git log origin/master..HEAD` + `git log -20 --oneline`
   - `git status`
   - 回顧本 session 對話：用戶要求 / 動作 / 卡點 / 糾正次數

2. **Analyze** — 事件分類到對應 memory 檔

    | 事件 | 寫到哪 |
    |---|---|
    | 做完功能 / 抓完資料 | STATUS + 專案專屬檔 |
    | 新待辦 | BACKLOG (add) |
    | 完成待辦 | BACKLOG (close) |
    | 新決策 / 預設 | PRINCIPLES |
    | 重複流程定型 (≥ 2 次) | PLAYBOOKS |
    | 新術語 | GLOSSARY |
    | Bug 並修好 | INCIDENTS (append) |
    | 反省 | REFLECTIONS (append) |

3. **Draft** — 產出**總表**（變動類型 + 摘要）+ 每個變動的實際 diff

4. **Confirm** — 問用戶：全採用 / 修哪幾個 / skip 哪些

5. **Atomic Commit** — 每檔一個 commit，訊息：
    ```
    memory: <動詞> <檔名> (<1 句摘要>)
    ```
    STATUS 放最後 commit（避免引用未 commit 的變動）。不自動 push。

### 關鍵原則

| 原則 | 為什麼 |
|---|---|
| **Read first** | Edit 工具需要精確 old_string |
| **驗證數字** | DATA_SCOPE 的數量要 `wc -l` 驗證不單信對話摘要 |
| **INCIDENTS / REFLECTIONS 只 append** | 歷史有價值 |
| **STATUS 每次 rewrite** | 只要當下 |
| **不 amend commit** | pre-commit hook 失敗就開新 commit |
| **不修 CLAUDE.md** | 那是規則層，/wrap-up 不動 |
| **不跨 session 臆測** | 只看 session 對話 + git log + memory |

### Skill 自我優化

這個 skill 自己會被 REFLECTIONS 檢討。若某次 `/wrap-up` 漏抓事件、訊息風格不好，應：
1. 在該次 REFLECTIONS 記下
2. 回頭修 `SKILL.md`（加新規則 / 改流程）
3. 下次 `/wrap-up` 照新規則跑

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

### Step 3：填 9 個 memory 檔初始內容

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
| Commit 訊息語言 | `SKILL.md` Stage 5 模板 |

### 反模式（不要做）

- ❌ 把 session 任務清單放進 memory（那是 Task / Plan 的責任）
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

- **v1.0（2026-04-23）** — 初版。9 檔 + `/wrap-up` 5 階段 + atomic commit。首 session 實測後產生 2 條 next-time rules（預先寫 REFLECTIONS 會重複、STATUS 每 session 至少 rewrite 一次）。

