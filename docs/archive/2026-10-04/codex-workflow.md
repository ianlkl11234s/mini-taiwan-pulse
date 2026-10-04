# Codex × Claude Code 雙 Agent 工作流手冊

> Mini Taiwan Pulse 專案內，如何把 OpenAI Codex CLI 當成 Claude Code 的「第二意見 / 執行小弟」。
>
> 更新日期：2026-05-14 · 本機 codex 版本：0.41.0

## TL;DR — 三種用法選一個就好

| 場景 | 用什麼 | 一句話 |
|---|---|---|
| **想在 Claude Code 內直接 `/codex:review` 或 `/codex:rescue`** | 官方 plugin `codex-plugin-cc` | 最省力，slash commands 自動接好 |
| **想讓 Claude 主動呼叫 Codex 跑某段任務** | `codex exec`（從 Bash 內） | 彈性最大，可平行、可塞 stdin、可拿 JSON |
| **想完全脫離 Claude，獨立讓 Codex 處理一整包工作** | `codex` TUI 或 `codex cloud exec` | 適合大型重構、敢放手的任務 |

---

## 0. 兩個工具的定位差異（先搞懂再用）

| | Claude Code | Codex CLI |
|---|---|---|
| **安全邊界** | application 層 hooks | kernel 層（macOS Seatbelt / Linux Landlock+seccomp）|
| **強項** | 多檔案脈絡、長 session、互動推理 | 沙箱嚴格、適合 review 不信任的 patch、cloud 平行委派 |
| **弱點** | 沙箱靠 hooks，可繞 | session 脈絡較短、互動較單調 |
| **規格檔** | `CLAUDE.md` | `AGENTS.md`（本專案已有）|

**實戰心得**（社群歸納）：兩者抓到的 bug 不同集合。安全性 review、架構腦力激盪這種「需要第二雙眼睛」的場景，**雙跑覆蓋率明顯較高**。日常 feature 開發單用 Claude 就夠，不必每次都喊 Codex。

---

## 1. 安裝與認證

### 1.1 Codex CLI 本身

```bash
# 已安裝（0.41.0），如需更新：
npm install -g @openai/codex

# 首次登入（擇一）
codex login                          # ChatGPT OAuth（互動）
echo "$OPENAI_API_KEY" | codex login # API key（給 CI / 自動化用）

# 確認
codex --version
```

### 1.2 Codex Plugin for Claude Code（選用，但推薦）

在 Claude Code TUI 內輸入：

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

裝完會多出這些 slash commands：

| 指令 | 作用 |
|---|---|
| `/codex:review` | 對目前未 commit 的變更跑 Codex code review |
| `/codex:adversarial-review` | 對抗式 review：質疑設計、壓力測試假設 |
| `/codex:rescue <task>` | 把任務丟給 Codex subagent（支援 `--background` / `--wait` / `--resume` / `--fresh` / `--model`）|
| `/codex:status` | 列出本 repo 的 Codex jobs |
| `/codex:result <id>` | 看完成的 Codex job 結果 |
| `/codex:cancel <id>` | 取消背景 job |
| `/codex:setup --enable-review-gate` | 開啟 Stop hook：Claude 每次停下前自動觸發一次 Codex review |

> ⚠️ **Review Gate 慎用**：開了之後 Claude 每個回合結束都會被 Codex 攔截審查，token 用量會明顯上升。建議只在重要 PR 前手動 `/codex:review`，不要常駐 gate。

---

## 2. 直接從 Bash 內委派（Claude 主動呼叫）

當你（用戶）跟我（Claude）說「請 Codex 幫忙看一下這段」或「叫 Codex 跑 X 任務」時，我會走這條：

### 2.1 核心指令：`codex exec`

```bash
codex exec "<prompt>"                                 # 一次性執行，最終訊息進 stdout
codex exec --json "<prompt>"                          # JSONL 事件流，方便 parse
codex exec -o result.md "<prompt>"                    # 最終訊息寫入檔案
codex exec --output-schema schema.json "<prompt>"     # 強制結構化輸出
codex exec --sandbox workspace-write "<prompt>"       # 允許改檔案（預設 read-only）
codex exec --sandbox danger-full-access "<prompt>"    # 全開（CI / isolated only）
codex exec --model gpt-5.5 "<prompt>"                 # 指定模型
codex exec --search "<prompt>"                        # 啟用即時 web search
codex exec resume <SESSION_ID> "<follow-up>"          # 接續上次 session
codex exec --last "<follow-up>"                       # 接續最近一次 session
```

### 2.2 三個專案內最實用的 pattern

#### A. 對抗式 Review（腦力激盪 / 找盲點）

```bash
# 把當前 diff 給 Codex 質疑
git diff master...HEAD | codex exec --sandbox read-only \
  "你是嚴格的 senior reviewer，請質疑此 diff 的設計選擇與潛在風險，特別注意：
   1) Supabase RPC 是否會撞 2min pooler timeout
   2) 動態圖層是否誤把 currentTime 放進 useEffect deps
   3) 新 layer 是否漏補 LAYER_COLORS（tsc 會炸）
   只列前 5 大問題，按嚴重度排序。"
```

#### B. 委派執行（已確定要做的、單純的工作）

```bash
# 例：把某個 loader 加上 loadingRegistry 包裝
codex exec --sandbox workspace-write -o codex-result.md \
  "在 src/data/xxxLoader.ts 的所有 supabase.rpc() 呼叫外面，
   依照 src/data/freewayLoader.ts 的範例包 loadingRegistry start()/complete()。
   完成後跑 npx tsc -b 確認沒錯。"

# 我（Claude）會讀 codex-result.md 拿到結論，再決定下一步
```

#### C. 平行 Second Opinion（重要決策時）

我可以同時讓 Codex 跟 Explore subagent 用不同角度看同一份 code：

```bash
# Background 跑 Codex 評估
codex exec --json "請評估 docs/supabase-optimization.md 提出的 cron 策略，
                   有沒有更好的替代方案？" > /tmp/codex-opinion.jsonl &

# 同時間我自己用 Plan agent 規劃
# 兩邊產出回來後我綜合
```

### 2.3 從 stdin 餵東西進去

非常實用，常配 `git diff` / `npm test` / `psql`：

```bash
# 測試失敗時請 Codex 摘要 + 提修法
npm test 2>&1 | codex exec "摘要這份測試輸出的失敗原因，並提出最小修正"

# 把長日誌交給 Codex 抽結論
psql "$SUPABASE_DB_URL" -c "EXPLAIN (ANALYZE, BUFFERS) SELECT ..." \
  | codex exec "判讀此 EXPLAIN，找出最大瓶頸與索引建議"
```

---

## 3. Sandbox 模式速查

| 模式 | 可讀 | 可寫 | 用途 |
|---|---|---|---|
| `read-only`（預設） | ✅ | ❌ | Review、分析、不動原始碼 |
| `workspace-write` | ✅ | ✅（限工作目錄）| 委派改檔案的任務 |
| `danger-full-access` | ✅ | ✅（全機）| **避免**，僅限 CI / 隔離容器 |

> ⚠️ 預設一律 read-only。要 Codex 改檔案時才升 `workspace-write`，而且**完成後我會 `git diff` 給你看**再決定要不要 keep。

---

## 4. 這個專案的具體建議用法

### 4.1 Mini Taiwan Pulse 適合委派給 Codex 的任務

✅ **適合委派**：
- 新 Layer 樣板生成（已有 `/new-layer` skill，但 Codex 可做更廣的橫向 refactor）
- 把舊 loader 從靜默 `.then()` 改成 `loadingRegistry`（規則明確，重複性高）
- `EXPLAIN ANALYZE` 結果判讀（純文字推理，read-only）
- 對抗式 review：跨檔案 consistency check、找 perf 反模式
- TypeScript 型別錯誤批次修（`npx tsc -b` 報一堆時）

❌ **不適合委派**：
- 需要看 Mapbox / Three.js 視覺效果的 UI 任務（Codex 沒瀏覽器）
- 涉及 timeStore / 動態時間訂閱的細節（這是專案級慣例，脈絡長）
- Supabase migration 跨 repo 改動（會跨 `../gis-platform`，沙箱會擋）

### 4.2 推薦工作流（給用戶下指令時的關鍵字）

| 你說 | 我做 |
|---|---|
| 「叫 Codex review 這個 diff」 | `git diff` → `codex exec --sandbox read-only` |
| 「請 Codex 幫忙做 X（任務明確）」 | `codex exec --sandbox workspace-write -o /tmp/codex.md` → 讀結果 → git diff 給你看 |
| 「Codex 跟你各給一個版本比較」 | 我規劃方案 A，平行委派 Codex 給方案 B，最後並排 |
| 「找 Codex 質疑這個設計」 | `codex exec` 加上對抗式 prompt（見 §2.2 A）|
| 「Codex 看一下這份 EXPLAIN」 | `psql ... | codex exec` |

### 4.3 AGENTS.md 維護建議

專案已有 `AGENTS.md`（內容大致同步 `CLAUDE.md`）。建議：

- 不要兩份 100% 重複，反而難維護
- `AGENTS.md` 可以只放 **Codex 特別需要強化的點**（例如：「Codex 你看 diff 時請特別注意 §4 cron 規則」）
- `CLAUDE.md` 保持完整版，`AGENTS.md` 用 include / 連結指回去

---

## 5. 常見坑

1. **Codex exec 預設 read-only**：以為它沒做事，其實是沙箱擋住。改檔案要明確加 `--sandbox workspace-write`。
2. **`--json` 是 JSONL 不是 JSON**：每行一個事件，要 `jq -s` 或逐行 parse。
3. **Codex 不知道 timeStore 慣例**：第一次委派時要把 `CLAUDE.md` 第 6 點貼進 prompt，或叫它先讀 `docs/development-rules.md`。
4. **Pooler 2min timeout 不會自動傳遞**：Codex 跑 SQL 委派時記得提醒，否則它可能寫出會 timeout 的 query。
5. **Review Gate 開了會放大 token 帳單**：詳見 §1.2 警告。
6. **`danger-full-access` 不要在本機開**：會跑遍家目錄。要全開請進 Docker / VM。

---

## 6. 參考連結

- [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) — Claude Code 用的官方 plugin
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference) — 所有指令旗標
- [Non-interactive mode](https://developers.openai.com/codex/noninteractive) — `codex exec` 完整文件
- [Workflows](https://developers.openai.com/codex/workflows) — 官方 recipe 集
- [Subagents](https://developers.openai.com/codex/subagents) — Codex 內部 subagent 機制
- [Codex vs Claude Code 比較](https://blakecrosley.com/blog/codex-vs-claude-code-2026) — 社群實戰心得
