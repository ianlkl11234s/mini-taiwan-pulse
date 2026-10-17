# 設計題：本機 Claude Code 連上 Zeabur 正式站的 Pulse 地圖（Agent v2 正式化）

## 使用者要求
- 架構盡可能乾淨、簡單；寧可根本解、不要暫時解。
- 連線與反應速度盡可能快（配對、每次地圖動作、結果上圖都要快）。
- 只有站主一人使用（Supabase 登入、email 白名單）。
- 可接受不算小的架構調整。

## 現況（程式碼最新版在 GIS/mini-taiwan-pulse/.worktrees/analysis-prod/{mini,mcp,gateway}）
元件：
- MCP（本機 stdio，mcp/src/research/relayClient.ts）→ HTTPS POST → research-gateway（gateway/services/research-gateway/server.mjs，Node 內建 SQLite 狀態，純 POST 輪詢）← 瀏覽器（mini/src/research/StudyController.ts、QueryResponder.ts、bridgeClient.ts，同網域 `/api/research/v1`）。
- 分析引擎 DuckDB 在 MCP 行程內（mcp/src/warehouse/engine.ts），資料是本機快取的 GeoParquet（R2 正本）。
- 結果上圖：MCP 把結果 GeoJSON 寫到本機 `runtime/warehouse-results/<file>`，經 relay 下指令給瀏覽器，瀏覽器 fetch `/__warehouse-results/<file>`（vite dev middleware，mini/vite.config.ts:392-420，apply:"serve"，正式 build 沒有）→ mini/src/research/warehouseResultImport.ts:100。結果最大可達數 MB（瀏覽器端上限 24 MiB，MCP 會自動簡化）。
- 大量 `/__local-research-owner-only/*`、`/__local-research-*` 資料也只在 vite dev middleware（vite.config.ts:264-840），讀本機檔。
- gateway 每個瀏覽器請求都打 Supabase `/auth/v1/user` 驗 JWT，無快取（auth.mjs:112-120）。
- 瀏覽器查詢輪詢：long-poll 最多 4.5s（server.mjs:42,138）＋輪與輪間隔 2s（QueryResponder.ts:8）。MCP query-status waitMs 1000（relayClient.ts:295）。
- 本機 dev autopair（三處旗標、loopback only）讓配對免授權；正式流程：登入 → 網頁 8 碼 → Agent pulse_pair_session → 網頁確認短語 → 30 分鐘 session；重新整理要重配。
- 前端 Agent 面板正式 build 寫死關閉：mini/src/App.tsx:2041、2301（`import.meta.env.DEV`）。`/lab` 研究工作台在正式 build 內（vite.config.ts:1295）。
- 正式站 nginx 已把 `/api/research/v1` 轉到容器內 127.0.0.1:8790（mini/nginx.conf:29-44），但容器 entrypoint（mini/scripts/deploy/entrypoint.sh:29）沒啟動 gateway；gateway 無 Dockerfile。gateway 需要 Node ≥23.10（node:sqlite）；網站 Dockerfile 用 `apk add nodejs`（mini/Dockerfile:28）。
- Zeabur 主機：Akamai Tokyo 4 vCPU／8GB，同機跑正式網站、收集器等；記憶體偏緊。另有文件 mini/docs/features/general-analysis/zeabur-cloud-engine-option.md（雲端 DuckDB 引擎選項，尚未執行）。
- 使用者人在台灣，本機 Mac；Supabase 區域未確認。

## 要回答
1. 建議架構（含「結果怎麼從本機 MCP 到正式站瀏覽器」、gateway 怎麼部署、配對怎麼做到快又安全、owner-only 本機資料怎麼處理）。至少比較 2–3 個候選，給一個推薦。
2. 延遲預算：每次地圖動作／查詢／結果上圖的 RTT 分解，哪裡可砍（輪詢 vs SSE/WebSocket、JWT 快取、結果直傳 vs 物件儲存）。
3. 刪掉什麼可以讓系統更簡單（例如是否可移除 dev autopair 特例、是否本機與正式走同一條路）。
4. 分階段計畫、每階段驗收、風險。
請具體到檔案與元件，不要泛論。唯讀，不要改任何檔案，不要讀 .env 值。
