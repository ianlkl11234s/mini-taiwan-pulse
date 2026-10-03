# 正式站連線方案 r1（Fable）

路徑基底：`GIS/mini-taiwan-pulse/.worktrees/analysis-prod/`，`gw/`＝`gateway/services/research-gateway/`。

## 0. 事實修正

- 瀏覽器查詢輪詢健康時無間隔（`QueryResponder.ts:95` 立即續 poll），2 s 只是失敗退避；command 拾取延遲來自 sync 3 s（`connectionReliability.ts:20`；README 寫 2 s 已過時）。
- Node：`gw/package.json:1` engines `>=22.13`，「≥23.10」過時；nginx 映像 `apk nodejs` 是否夠須在映像內 `node -e "require('node:sqlite')"` 驗。
- 結果上限：MCP 簡化預算 18 MiB（`engine.ts:573,1893-1923`）、瀏覽器 24 MiB（`researchAnalysisSession.ts:28`）。
- core 工具組不含瀏覽器 dataset 工具（`toolsets.ts:12-24`），`pulse_find_data` 只搜倉庫（`:31`）→ owner-only 本機資料對 core 路徑無用。

## 1. 架構

| 候選 | 結果傳輸 | 關鍵優劣 |
|---|---|---|
| **A 經 gateway（推薦）** | MCP 串流 PUT→gateway volume→瀏覽器同源 GET | 單一通道、同源同驗證、任何瀏覽器可用；多一趟台北↔東京（典型 <0.5 s） |
| B R2 預簽 URL | MCP PUT R2，瀏覽器 GET | gateway 禁 URL 入瀏覽器（`relay-service.mjs:273-280`）、要清理規則、兩個外部跳點 |
| C 瀏覽器直抓本機 MCP | 0 雲端跳點 | 只限同一台 Mac；Chrome PNA/LNA 預檢與提示、Safari 擋 mixed content；多 MCP 程序撞 port |

A 的接線縫：
- MCP：`showResult.ts:187` present 後、`:190` import 前加 `relay.uploadResult`；body＋sha256 已在 `engine.ts:1965-1969` 產出。
- gateway：新增 `/agent/results/<id>` 串流上傳——分流點在 `server.mjs:219-223` 的 `for await` 整段 body 進記憶體迴圈（`handle()` 收到的已是緩衝好的 Request），並繞過 `:213-215` 10 s timer、`/browser/results/<id>` GET（`:83` 非 POST 一律 405、`:66-68` 回應 32 KiB 上限須繞過）。state 只存 `{resultId,sha256,bytes,expiresAt}`＋import 參數（label／featureCount／style，重整還原要用），位元組落 volume——state 是單一 JSON blob 4 MiB 且每筆交易整份重寫（`sqlite-store.mjs:5,94-107,172-192`）。import 時 gateway 比對 sha256 再轉給瀏覽器。
- 瀏覽器：`warehouseResultImport.ts:100` 改 `/api/research/v1/browser/results/…` 並帶 Bearer；`researchAnalysisSession.ts:542` 已收 `fetchImpl?` 但 `MainMapConnection.tsx:427` 沒傳，token 在 `bridgeClient.ts:33`。
- nginx：`nginx.conf:36` `client_max_body_size 32k` → 上傳 location 另開 24m。

gateway 部署：獨立 Zeabur 服務（gis-platform 自帶 Dockerfile `node:22-alpine`＋volume），`PULSE_RESEARCH_HOST=0.0.0.0`（`server.mjs:196` 允許），`nginx.conf:31` upstream 改私網主機名（Zeabur 命名待確認）；trusted proxy 只收單一 IP（`:198`），站主一人可留空、接受 callerIp＝nginx IP。sidecar（`entrypoint.sh:29`、`Dockerfile:20-29` 樣板）代價是跨 repo 複製 gateway 程式。

配對：把 dev autopair 機制（`pairing-service.mjs:109-135` 列分頁免碼領取、`:160-161` 接手；`ResearchConnection.tsx:201-236` 待命 pairing）提升到真實帳號：owner 登入後在面板一次鑄 90 天 agent token（hash 入 state，綁 accountId），MCP 以 `PULSE_RESEARCH_AGENT_TOKEN` 呼叫 `/agent/tabs`→`/agent/bind`，session 結構沿用（`relay-service.mjs:473-484` 已綁 accountId＋tabId）。免碼、免短語、重整自動重綁；瀏覽器 `/studies/revoke` 可撤。本機 dev 與正式同一流程（vite 只留 `1312-1313` 代理）。

owner-only 本機資料：不移植。core 不用；full 工具組的瀏覽器 dataset 標 HOLD。日後要搬走 `nginx.conf:59-80` 的 8796 私有 sidecar。

面板：`App.tsx:2041,2301` 的 `import.meta.env.DEV` 改「researchAuth 有 session 或 `?agent=1`」。

## 2. 延遲預算

Mac↔東京 RTT≈40 ms；Supabase 從東京 X ms（區域未知，部署後在容器量 `time_connect`）。

| 動作 | 今日 | 改後 | 砍在哪 |
|---|---|---|---|
| 配對 | 人工抄碼＋短語 20-60 s | 2 RTT ≈0.1 s | token bind |
| set_camera／layers（core 模式等 ready：`server.ts:399,411`→`sceneSync.ts:13,73`；full 模式不等 ≈0.1 s） | `/state` 40＋`/commands` 40＋sync 拾取平均 1500（max 3000）＋X＋render 300-1500＋ack/report 2×(40+X)＋status 輪詢平均 750（`relayClient.ts:261`）≈2.7-4.5 s | ≈0.5-1.8 s（render 主導） | submit/ack/report 加 wake（`relay-service.mjs:560,591-622` 無 wake，僅 `:664` 有；waiter 已按 studyId `:445-465`）；`/commands/status` 加 waitMs；JWT 快取 |
| query | submit 40＋喚醒後再 owner() X（`server.mjs:136,141`）＋exec＋result 40+X＋status 40 ≈0.2 s＋exec＋2X | ≈0.16 s＋exec | JWT 快取（`auth.mjs:122` 每次打 `/auth/v1/user`）：token hash 記 ≤60 s |
| show_result | present（本機 DuckDB 0.05-2 s）＋import query＋command＋map_context ≈present＋3-5 s | present＋傳輸＋≈1.2 s | 同上；0.3 MB 結果傳輸 <0.3 s，18 MiB 約 3 s |

輪詢 vs 推送：長輪詢＋wake 已存在（`relay-service.mjs:445-465`），擴到 command 只需把瀏覽器 sync 與 query 兩迴圈合為 `/browser/wait` 回 `{request,snapshot}`（`bridgeClient.ts:142-146` exactObject、QueryResponder、`StudyController.receive` 兩端同改）；SSE/WebSocket 需 nginx Upgrade＋連線狀態模型，延後。timeout 連鎖：agent waitMs cap 1000（`relay-service.mjs:669`）最多提到 3000，受 `relayClient.ts:64` 5 s 限；`bridgeClient.ts:3` 8 s、`nginx.conf:38` 12 s、`relayClient.ts:292` 25 s、`QueryResponder.ts:14` 互鎖不動。

## 3. 可刪

- dev autopair 三處旗標與分支：`server.mjs:17-20,91-94,161-166,185-203`；`pairing-service.mjs:15-20,51,57,109-135,160-161`；`relayClient.ts:84-186,338-346,443,554-558`；`devAutopair.ts`；`ResearchConnection.tsx:155-236`。
- code＋phrase 流程（`pairing-service.mjs:76-170`、`server.ts:447-459`）→ token bind 取代。
- vite 中介層：`serveWarehouseResults` 392-419；`/__local-research*`、`/research` sidecar 357-390、429-1215（約 850 行）。
- 瀏覽器 3 s sync 迴圈（`ResearchConnection.tsx:238-283`）併入長輪詢；MCP `waitSceneReady` 1.5 s 輪詢（`relayClient.ts:253-264`）。
- README「Node 23.10+」「每 2 秒 sync」。
- `/lab` 若主地圖面板為唯一入口可退出 build（`vite.config.ts:1295`）。

## 4. 分階段

| 階段 | 做什麼 | 驗收 | 風險 |
|---|---|---|---|
| P0 部署 | gateway Dockerfile＋volume＋env（ORIGINS＝正式網域、pilot email）、nginx upstream、Supabase OAuth redirect 加正式網域、面板改 auth 門 | 正式站登入→舊碼配對→`pulse_set_camera` 動地圖、`map_context` 回傳；映像內 `node:sqlite` 可載入。**預期失敗**：show_result／show_nearby（`/__warehouse-results` 在正式站 404 或 SPA fallback→`warehouseResultImport.ts:104,106` 丟 UNAVAILABLE／SHA_MISMATCH），P1 緊接 | volume 父目錄須 0700＋同 uid＋祖先無 symlink（`sqlite-store.mjs:37-52`），entrypoint 要 `mkdir -m 0700`；主機記憶體緊，gateway RSS 約 60-100 MB |
| P1 結果經 gateway | 上傳／下載路由、串流落盤、nginx 24m、瀏覽器帶 token、刪 vite 中介層 | `pulse_show_result` 正式站顯示且 sha256 相符；18 MiB <5 s；撤銷後檔案清除 | 磁碟配額：每 study ≤8×24 MiB，revoke／到期清理 |
| P2 快路徑 | JWT 快取（若 `/auth/v1/.well-known/jwks.json` 有金鑰則改本機驗簽，Supabase 完全離開熱路徑；`auth.mjs:148` email 檢查改走 `PILOT_ACCOUNTS`）、command wake、status 長輪詢、waitMs 3000 | `timing`（`relayClient.ts:281`）顯示 query <0.3 s＋exec；set_camera <1.5 s | Supabase 中斷時快取撐 60 s 後 503；背景分頁 15 s 節流不變 |
| P3 token 配對 | 鑄 token UI、`/agent/tabs`、`/agent/bind`，刪 autopair 與 code/phrase，本機 dev 同流程 | 新 session 首次工具呼叫 <1 s 綁上；重整自動重綁；瀏覽器撤銷後 agent 15 s 內斷（`relayClient.ts:369`） | token 外洩＝可控站主地圖：檔案 0600、90 天到期、可撤 |
| P4 清理 | owner-only dataset 標 HOLD、`/lab` 去留、文件 | `npm test`、`tsc -b` 綠 | — |
