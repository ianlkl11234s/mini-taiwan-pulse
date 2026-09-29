# 統一視覺化函式庫與 Agent 分析呈現

> Agent 分析結果在地圖、面板與分享卡片上的統一長相與行為。2026-09-27～29 完成批次 1–4 與分析卡連結。

## 權威文件

| 文件 | 內容 |
|---|---|
| [DECISIONS.md](./DECISIONS.md) | 四輪設計定案（配色、地圖元件、互動細節、小圖表／時間／分析卡）與所有色碼 |
| [PLAN.md](./PLAN.md) | 架構決定（共用規格 SSOT、註冊表、契約測試）與分工 |
| [CARD-LINK.md](./CARD-LINK.md) | 分析卡連結規格：流程、拍板、授權閘門、payload、migration 414／415 |
| [BACKLOG.md](./BACKLOG.md) | 延後項目與下一步 |

互動設計稿：配色＋元件 https://claude.ai/artifact/VkQypJspPdwvsQu4CHqsYg ；細節 https://claude.ai/artifact/MFZiW5dKjnXz4xDojVq2cM ；小圖表／時間／分析卡 https://claude.ai/artifact/EbnEbehA7AbdkTiMEfSwqT

## 程式碼地圖

| 範圍 | mcp（mini-pulse-gis-mcp） | mini（本 repo） |
|---|---|---|
| 共用規格 SSOT | `src/warehouse/vizSpec.json`（**唯一可改處**） | `src/research/contracts/viz-spec.json`＋`.sha256`（位元組相同副本，`vizSpecContract.test.ts` 鎖住） |
| 樣式註冊表（10 種） | `src/warehouse/resultStyle.ts` `STYLE_REGISTRY`／`STYLE_KINDS` | `src/research/warehouseResultStyle.ts` `WAREHOUSE_STYLE_RENDERERS` |
| 數字格式（「萬」） | `src/warehouse/vizFormat.ts` | `src/research/vizFormat.ts` |
| 色盲驗證 | `src/warehouse/vizSpec.test.ts` | — |
| 地圖安裝／互動 | — | `analysisResultOverlay.ts`、`analysisResultHover.ts`、`analysisResultStack.ts`、`analysisPlaybackStore.ts` |
| 圖例／小圖表 | — | `AnalysisLegendSection.tsx`、`WarehouseStyleLegend.tsx`、`src/research/charts/` |
| 分析卡 | `cardPayload.ts`、`publishGate.ts`、`publishAllowlist.json`、`pulse_publish_card` | `card.html`、`src/card/`、`src/lib/analysisCardApi.ts` |
| 使用須知（Agent 必讀口徑） | `src/warehouse/datasetUsageNotes.json` | — |
| Agent 回答規則 | MCP instructions 開頭三條（`src/research/server.ts`） | `.agents/skills/pulse-gis-analyst/SKILL.md`「回答格式」 |
| 回歸測試 | `eval/agent-regression/`（README 有三次成績與 backlog） | — |

改規格的順序：先改 mcp `vizSpec.json` → 複製到 mini 並更新 `.sha256` → 兩邊契約測試綠燈。新增樣式 kind 時兩邊 key 集合要一致。

## 本機 Agent 測試環境

- 正式路徑：`mini-taiwan-pulse/.worktrees/analysis-prod/{mini,mcp}`（detached，Claude 的 MCP 與 skill 都指向這裡）。**mini／mcp 合併後要手動更新**：`git -C analysis-prod/<repo> fetch && git -C analysis-prod/<repo> checkout --detach origin/<master|main>`，mcp 再 `npm run build`；之後在 Claude Code 用 `/mcp` 重連 pulse-research 才會吃到新版（重連後 wh-* 結果會清空）。
- 研究 gateway（8794）：`cd .worktrees/research-streamline/gateway && ( nohup node ../runtime/start-v03-gateway.mjs > ../runtime/gateway-8794.log 2>&1 & )`；程式碼是 gis-platform 的 worktree，gateway 改動後要更新該 worktree 並重啟。
- 前端（3734，gateway 只接受這個 origin）：`cd .worktrees/analysis-prod/mini && ( PULSE_RESEARCH_GATEWAY_ORIGIN=http://127.0.0.1:8794 nohup npx vite --host 127.0.0.1 --port 3734 --strictPort > ../runtime/vite-3734.log 2>&1 & )`；`analysis-prod/mini/.env` 是指向主 repo `.env` 的 symlink。
- 兩者用雙層括號背景啟動才不會隨 Claude session 關閉。停止時只 kill 對應 PID（`lsof -tiTCP:3734 -sTCP:LISTEN`），不要 pkill。
- 開 vite 的除錯**不要 curl 轉譯後的原始碼模組**（會把 VITE_* 金鑰內嵌印出）。

## 回歸測試

`cd .worktrees/analysis-prod/mcp && npm run eval:agent -- --model sonnet`（每題開一個 headless Claude Code，走訂閱登入；約 11 分鐘）。離線重算舊 run：`--recheck <runDir>`。成績與待辦見 mcp `eval/agent-regression/README.md`。
