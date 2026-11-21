# Pulse Agent 分析：入口指標

> **本頁不再記錄進度。** 現況與下一步：`.gis-agent-system/roadmap/status/ai-mcp.md`（「Agent 分析能力迭代」段）；架構與工具清單：[ARCHITECTURE](../agent-research-workbench/ARCHITECTURE.md)；工具數：[mcp-tool-count.json](../agent-research-workbench/mcp-tool-count.json)（由 `scripts/research/count-mcp-tools.mjs` 產生）；圖層可分析狀態：[layer-status-summary.md](./layer-status-summary.md)；回歸測試分數：mini-pulse-gis-mcp `eval/agent-regression/README.md`。
> 2026-10-04 以前的能力表、指標、待辦已封存：[STATUS-20261004.md](../../archive/2026-11-21/features/general-analysis/STATUS-20261004.md)（其中的數字不是現況）。

## 從這裡開始

**想用（讓 Agent 幫你分析）**
1. 啟動本機環境：照 [PROD-HOME.md](./PROD-HOME.md)「啟動與停止」開 8794 gateway 與 3734 前端（兩個都在跑才跳過；檢查：`lsof -iTCP:3734 -sTCP:LISTEN` 與 `lsof -iTCP:8794 -sTCP:LISTEN` 都要有輸出，只有 3734 在跑時配對與分析 API 仍會失敗；也可用 PROD-HOME 的健康檢查）。
2. 正式用法：開 `https://mini-taiwan-pulse.itsmigu.com` 登入，面板產生 token，`pbpaste | npm run token:save`（在 `analysis-prod/mcp`），Agent 第一次動地圖時自動接上分頁；多個分頁會請你選。本機測試改用測試身分（見 PROD-HOME），不用登入。
3. 直接用白話問，例如「台北車站 800 公尺內有什麼」「各縣市 A1 事故率排名」「把這個做成卡片」。

**想改（開發）**
1. 先讀本頁「東西在哪」，找到要改的 repo。
2. 一律開自己的 worktree，不在主 checkout 或 `analysis-prod` 裡改。
3. PR → CI 綠燈 → 一般 merge（不可 squash）→ 照 [PROD-HOME.md](./PROD-HOME.md)「更新」同步 `analysis-prod`，mcp 有改要在 Claude Code `/mcp` 重連。
4. 改了 Agent 的回答或資料口徑，跑一次回歸測試（見「指標」）比對分數。

## 東西在哪

| 東西 | 位置 |
|---|---|
| 前端、skill、設計文件 | repo **mini-taiwan-pulse**（本 repo）：`src/research/`、`src/card/`、`.agents/skills/pulse-gis-analyst/`、`docs/features/` |
| Agent 工具（MCP）、倉庫引擎、樣式計算、回歸測試 | repo **mini-pulse-gis-mcp**：`src/research/server.ts`、`src/warehouse/`、`eval/agent-regression/` |
| 研究 gateway、分析卡資料表 | repo **gis-platform**：`services/research-gateway/`、`migrations/414_*`、`415_*` |
| 本機正式環境 | `mini-taiwan-pulse/.worktrees/analysis-prod/{mini,mcp,gateway,runtime}`（不屬於任何 repo 的收納位置）→ [PROD-HOME.md](./PROD-HOME.md) |
| 架構決策 | [ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md) |

權威文件：

| 主題 | 文件 |
|---|---|
| 倉庫架構與契約 | [PLAN-warehouse-20260926.md](./PLAN-warehouse-20260926.md) |
| 第三輪（覆蓋度、問題庫、等時圈、語氣）完整紀錄 | [PLAN-round3-20260927.md](./PLAN-round3-20260927.md) |
| 視覺化、面板圖表、分析卡 | [viz-library/README.md](../viz-library/README.md)（DECISIONS、PLAN、CARD-LINK、BACKLOG） |
| 本機正式環境與上雲準備 | [PROD-HOME.md](./PROD-HOME.md) |
| 問題庫題綱 | [question-bank-backlog-20260927.md](../../archive/2026-11-09/features/general-analysis/question-bank-backlog-20260927.md) |
| Agent 回歸測試 | mcp `eval/agent-regression/README.md` |
| UI 規範（面板、popup、token） | [ui-consistency-audit handoff](../ui-consistency-audit-20260927/handoff.md)、`docs/design-system/` |
