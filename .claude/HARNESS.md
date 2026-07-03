# HARNESS — 本專案的 Claude Code 運作系統

> 這份是「**我的 Claude Code harness 怎麼組起來、怎麼維護**」的操作手冊。
>
> 與相鄰文件的分工：
> - [`FRAMEWORK.md`](./FRAMEWORK.md) = **可移植的記憶框架** spec（搬去別的專案照抄用）
> - [`../CLAUDE.md`](../CLAUDE.md) = **規則層**（不變的開發規則）
> - **本檔** = **這台機器上這個專案的 harness 全景 + 維運節奏**（含 hook / MCP / Codex 鏡像，FRAMEWORK.md 不涵蓋的部分）
>
> 最後校準：2026-07-03

---

## 0. 一分鐘心智模型

harness = 「每次開 session 自動載入記憶 → 開發中用一組 GIS 專用工具 → 收工用 `/wrap-up` 把學到的寫回記憶」的閉環，外掛 4 個 MCP server 補強。分 6 層：

```
┌─ L0 規則層      CLAUDE.md（+ docs/development-rules.md…）── 不變規則，人維護
├─ L1 開場注入    .claude/memory/load-session.sh (SessionStart hook) ── 每 session 自動
├─ L2 記憶層      .claude/memory/ 9 檔 + pitfalls/ + /wrap-up ── 跨 session 狀態，半自動
├─ L3 工具層      commands/ + agents/ + skills/ ── GIS 圖層生命週期
├─ L4 MCP 層      codebase-memory / dev-orchestrator / graphiti / pencil ── 全域註冊
└─ L5 Codex 鏡像  .codex/hooks.json + AGENTS.md ── 讓 Codex CLI 共用同一套記憶
```

**維護心法**：L0/L2 是你天天在動的、L1/L3 很少動、L4 要注意「索引會腐化 / 服務會掛」、L5 是 L0+L1 的複本（改一邊要想到另一邊）。

---

## 1. L1 — 開場注入 hook

| 項目 | 內容 |
|---|---|
| 觸發 | SessionStart（`.claude/settings.json`，Claude 端）+ `.codex/hooks.json`（Codex 端，同一支腳本） |
| 腳本 | `.claude/memory/load-session.sh` |
| 做什麼 | 用 `python3`（不依賴 jq）產 JSON：STATUS 取檔頭+最新段（≤8k 字元）、BACKLOG/PRINCIPLES 只給標題索引+行號、加 `docs/features/` 索引，塞進 `additionalContext` |
| 設計重點 | 舊版全文 inline ≈25k tokens → 新版 ~6k 字元，**省 >90% context**，每段有上限防膨脹 |

**怎麼驗證它還活著**：開新 session，看開場有沒有出現「Mini Taiwan Pulse — Session 記憶已載入」那段。沒出現 → 檢查 `settings.json` hook 設定或 `load-session.sh` 執行權限。

**維護**：STATUS 內容由 `/wrap-up` 維護，腳本本身幾乎不用動。若 memory 檔改名/搬位置，要同步改腳本裡的路徑。

---

## 2. L2 — 記憶層（框架核心）

9 檔 + pitfalls + 專案專屬檔。完整規則見 [`FRAMEWORK.md §3`](./FRAMEWORK.md)。**這裡只講維運**：

| 檔 | 更新時機 | 維護規則 |
|---|---|---|
| STATUS | 每次 `/wrap-up` | **rewrite**，只留當下 |
| BACKLOG | 有新 idea / 關舊項 | 加 P0~P3 / 搬「已完成」 |
| PRINCIPLES | 達成新共識 | 衝突時新覆蓋舊，舊搬 INCIDENTS |
| PLAYBOOKS | 流程做過 ≥2 次 | 標號 PB-xx |
| GLOSSARY | 遇新術語 | — |
| INCIDENTS / REFLECTIONS | 修好 bug / 反省 | **只 append，絕不改舊條目** |
| DATA_SCOPE（專屬） | 資料量變動 | 數字要 `wc -l`/grep 驗證，不單信對話 |
| pitfalls/ | INCIDENTS 太長時 | long-form archive |

**腐化訊號**（見到就代表系統沒在用）：STATUS「上次更新 >7 天」、BACKLOG 全 P3、REFLECTIONS 無新條目。

---

## 3. L3 — 工具層（GIS 圖層生命週期）

| 類型 | 名稱 | 用途 |
|---|---|---|
| command | `/new-layer <name>` | 產新 layer 完整骨架（走強制順序 7 步）+ 觸發 layer-onboarding |
| command | `/check-rpc <name>` | 對 RPC 跑 EXPLAIN，判斷要不要套 pre-aggregate |
| command | `/handoff <slug>` | 產跨 repo commit 對照表 |
| agent | `layer-creator` | `/new-layer` 背後的骨架產生器（含 LAYER_COLORS + tsc -b） |
| skill | `layer-onboarding` | layer 上線**驗收** SOP + UX baseline |
| skill | `supabase-optimize` | 產 pre-aggregate pattern SQL 範本 |
| skill | `three-3d-component` | Three.js×Mapbox 立體圖層接線手冊 |
| skill | `accessibility-analysis` / `service-coverage` | 服務可達性分析（同一實作，兩個觸發口吻） |
| skill | `wrap-up` | 收尾 + 寫回記憶（見下節） |

**維護**：新增/改 layer 一律先跑 `layer-onboarding` skill（P0 規則）。skill 若某次漏抓事，照 FRAMEWORK.md「Skill 自我優化」回頭改 SKILL.md。

---

## 4. L4 — MCP 層（4 個 server）

全部註冊在**全域** `~/.claude.json` 頂層（跨專案共用），專案本身**沒有** `.mcp.json`。

| Server | 型態 | 現況 | 幫你做什麼 |
|---|---|---|---|
| **codebase-memory-mcp** | stdio | ✅ 在用，9 repo 全索引 | 程式碼知識圖譜：`search_graph`/`get_code_snippet`/`trace_path`（詳見 §4.1） |
| **dev-orchestrator** | stdio | ✅ 可用 | 用對話啟停本地 12 個開發專案（PM2 + 埠位分配）：`start_project`/`get_project_logs`… |
| **pencil** | stdio | ✅ 可用 | 讀寫 `.pen` 設計檔 |
| **graphiti-memory** | sse (localhost:8000) | ⚠️ **有註冊沒服務**（Docker 未開、8000 拒連） | Zep Graphiti temporal KG memory；目前沒在跑（見 §5 體檢 F4） |

### 4.1 codebase-memory-mcp — 怎麼用才不被騙

**它是「程式碼接線圖」，不是「專案故事」**——跟 L2 記憶層互補，見 §6 記憶分工。

| 用途 | 工具 | 信任度 | 備註 |
|---|---|---|---|
| 找符號 / 有哪些函式 / 找實作 | `search_graph(query=…)` | ⭐⭐⭐ | 取代 grep 開場，回精確行號 |
| 拿某符號原始碼 | `get_code_snippet(qn)` | ⭐⭐⭐ | 省 context |
| 架構總覽 / 模組分群 | `get_architecture` | ⭐⭐⭐ | Leiden 分群看真實模組邊界 |
| 追頂層函式/class method 的 caller | `trace_path(mode=calls)` | ⭐⭐ | 大致可信 |
| 追**物件字面量 store/registry 方法**的 caller | `trace_path` | ⭐ **會漏邊** | 見下方 ⚠️ |
| 跨 repo 資料契約鏈 | `trace_path(mode=cross_service)` | — | **需先建跨 repo 邊**（見 §5 F3） |

> ⚠️ **已證實的限制**：`timeStore` / `chatStore` / `loadingRegistry` / `overlayRegistry` 這類 `export const store = { method(){} }` 物件字面量，呼叫端寫 `store.method(...)`，圖譜的 CALLS 邊**連不回內部方法節點**。實測 `trace_path(subscribeThrottled, inbound)` 回 0 callers，但 grep 有 20+ 個真實呼叫散在 18 個 hook。
> **鐵則：改這類扇出核心前，空 caller ≠ 沒 caller，關鍵處務必 grep 複核。**

### 4.2 索引維護節奏（⚠️ 最容易忘）

圖譜是快照，**程式碼一直在變、圖譜不會自己更新**。`detect_changes` 只看 git 工作區有沒有未提交漂移，**不**檢查「commit 後圖譜落後了沒」。

| 時機 | 動作 |
|---|---|
| 大改結構後（新增/刪除/改名檔案或函式） | `index_repository(repo_path, mode="moderate")` 重建 |
| 要靠 `trace_path` 做影響分析前 | 先確認索引夠新（近期有重建過） |
| 純改函式內部、沒動結構 | 可不重建 |
| PR review 想看 blast radius | `detect_changes(since="HEAD~N")` 看 impacted_symbols |

- mode：`fast`（快，無語義邊）/ `moderate`（**日常推薦**）/ `full`（含相似+語義邊，最慢）
- 目前已把「session 有動結構就提醒重建」寫進 `/wrap-up`（見 §5 F1）

---

## 5. 開發模式體檢（2026-07-03）

盤點時實測發現，依優先級：

| # | 發現 | 影響 | 建議 | 狀態 |
|---|---|---|---|---|
| **F1** | codebase-memory 缺 re-index 節奏，圖譜會靜默腐化 | 中 | `/wrap-up` 收尾加「動了結構就提醒重建」 | ✅ 已實作 |
| **F2** | `trace_path` 對物件字面量 store 漏 caller 邊 | 中 | 文件化為已知限制 + grep 後盾鐵則（§4.1） | ✅ 已文件化 |
| **F3** | 9 repo 全索引，但**跨 repo 邊未建**，`/handoff` 仍純手動 | 高（機會） | 跑 `index_repository(mode="cross-repo-intelligence", target_projects=["*"])` 建 CROSS 邊 → `trace_path(cross_service)` 可半自動化 handoff | ⏸️ 待你點頭（較重的運算） |
| **F4** | graphiti-memory 有註冊沒服務，每 session 可能靜默嘗試連線失敗 | 低 | **二選一**：(a) 真要用→開 Docker+Neo4j 起服務；(b) 不用→從 `~/.claude.json` 移除註冊。已有兩套可用記憶，graphiti 目前冗餘 | ⏸️ 待你決定（動全域設定） |
| **F5** | Codex 鏡像（`.codex/hooks.json`、`AGENTS.md`）與 `.claude/settings.json`、`CLAUDE.md` 重複 | 低 | 改一邊要想到另一邊；長期可讓 AGENTS.md 只當指標 | 📝 文件化 |
| **F6** | MCP 全走全域、專案無 `.mcp.json`，harness 不 self-contained | 低 | 單人開發 OK；要可複製/團隊共享再加 per-project `.mcp.json` | 📝 文件化 |

---

## 6. 「記憶」系統分工（最容易搞混，務必分清）

你現在同時有 **4 種**「記憶」，各記不同東西、互不取代：

| 系統 | 記什麼 | 形式 | 誰維護 | 現況 |
|---|---|---|---|---|
| `.claude/memory/` | **意圖/決策/狀態/踩坑**（why、做到哪） | 人寫的散文 | 你 + `/wrap-up` | ✅ 主力 |
| codebase-memory-mcp | **程式碼結構**（誰呼叫誰、資料怎麼流） | 可查詢的 call/import 圖 | 自動解析（需手動重建） | ✅ 在用 |
| 全域 `~/.claude/.../memory/` | **跨專案偏好/工具** | 散文 | 你 | ✅ 在用 |
| graphiti-memory | temporal 知識圖譜（事件時序記憶） | Neo4j KG | 需起服務 | ⚠️ 沒在跑 |

**判斷樹**：問「這個專案為什麼這樣做」→ `.claude/memory/`；問「這段程式碼接到哪」→ codebase-memory；跨專案通則 → 全域。

---

## 7. 例行維護 checklist

**每個 session 收工（`/wrap-up` 已涵蓋大部分）**
- [ ] 記憶寫回 9 檔、atomic commit
- [ ] 若本 session 動了程式碼結構 → 重建 codebase-memory 索引

**每週/每次大改後**
- [ ] `list_projects` 確認 9 repo 索引還在
- [ ] 相關 repo 大改過 → `index_repository(mode="moderate")` 重建
- [ ] STATUS「上次更新 >7 天」？→ 系統可能沒在用，檢查

**改 harness 本身時**
- [ ] 改 SessionStart hook / memory 路徑 → 同步 `.codex/hooks.json`
- [ ] 改 CLAUDE.md 規則 → 想想 `AGENTS.md` 要不要跟
- [ ] 新增 memory 專屬檔 → 更新 `.claude/README.md` + `load-session.sh` 索引
