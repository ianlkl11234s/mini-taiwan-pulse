# 第二輪回答（Fable r2）

`gw/`＝`gateway/services/research-gateway/`。

## 1. 推送通道：長輪詢＋wake（維持）

延遲：事件落在瀏覽器長輪詢掛著時，gateway 立即回＝½ RTT（≈20 ms）；落在兩次輪詢的空窗（≈1 RTT）則下一輪開頭即取到，最壞多 1 RTT（≈40 ms）。WSS 推送同為 ½ RTT。差 0-40 ms，在 render 300-1500 ms 前可忽略。query 今日已是長輪詢（`QueryResponder.ts:95` 健康時零間隔），Codex 的「2 秒輪詢」不存在；真正代價只在 command：sync 3 s（`connectionReliability.ts:20`）與 agent status 1.5 s（`relayClient.ts:261`）。補 wake（`relay-service.mjs:560,584-588,603-608,617-619`；waiter 已依 studyId `:445-465`）＋`/commands/status` 帶 waitMs 即可。

WSS 多出：(a) gateway 零依賴（`gw/package.json` 無 dependencies），Node 無內建 WS server → 加 `ws` 或手寫 upgrade；`server.mjs:212-239` 的 Request/Response adapter 不涵蓋 upgrade，等於第二個 server；(b) 連線↔session 綁定、心跳、重連退避、離線期訊息緩衝的狀態模型；(c) nginx `:30-45` 無 `proxy_http_version 1.1`／Upgrade，`:38` 12 s read timeout 會砍閒置連線；Zeabur 邊緣 WS 支援與 idle timeout 未查證；(d) 背景分頁：長輪詢鏈不靠 timer（`QueryResponder.ts:93-95`）已避開節流。同等延遲、多三個子系統。

## 2. 結果傳輸：PUT 落 volume＋同源 GET（維持）

- 重整：`scene.results` 只記 resultId（`relay-service.mjs:30,93`），而 `loadWarehouseResult` 還需 sha256／featureCount／style／label（`warehouseResultImport.ts:21-29,106,110`）。檔在 volume 時可還原，**前提**是 gateway 把 import 參數（`relay-service.mjs:273-280` 已驗過）與檔一起存，且瀏覽器套用 scene 前先匯入——否則 `MainMapConnection.tsx:711-720` 的 1 s watchdog 會清掉 scene 列了但本地沒有的結果。記憶體轉送＋ACK 即丟則重整必失、須 MCP 重傳。
- 重播：`replace:false` 累積至 8 筆（`showResult.ts:38`）、單次 3 筆（`:37`）。Codex「每 session 18 MiB」把引擎**每筆**預算（`engine.ts:573`；`fitPresentationBudget` 以 resultId 為單位）當每 session，第二筆大結果就被擋；瀏覽器實際每筆 24 MiB／總 96 MiB（`resultStore.ts:9-10`）。
- 記憶體：主機 available ≈2.5 GB，落盤 RSS 平；記憶體轉送＝18 MiB×在途數。
- 實作量：`server.mjs:219-223` 分流成 `pipeline(incoming, createWriteStream)`＋hash 約 30 行；GET 近乎原樣搬 `vite.config.ts:404-414`；瀏覽器接縫 `researchAnalysisSession.ts:542` 已留 `fetchImpl`。WSS binary 要改 `loadWarehouseResult` 介面收 ArrayBuffer。
- 清理：隨 study 7 天（`sqlite-store.mjs:9`）與 revoke 刪檔，每 study 配額對齊瀏覽器總量 96 MiB（`resultStore.ts:9`）。

## 3. 部署：獨立服務（維持；sidecar 可行但耦合）

- repo 邊界：mini `Dockerfile:8` `COPY . .` 只見 mini；gateway 在 gis-platform（PROD-HOME.md:9）。sidecar 需 submodule／CI 複製／搬程式。
- Node：需求 `>=22.13`（`gw/package.json:1`）非 23.10；Codex「Node 24＋nginx runtime」要換正式網站底層映像，炸射面是整站。獨立服務自選映像，問題消失。
- 重啟：gateway 隨協定常改；獨立重啟不動 nginx 與 `entrypoint.sh:31-42` 資產 pull。
- trusted proxy：`server.mjs:197-198` 收逗號分隔的個別 IP、不收 CIDR；nginx 容器 IP 不固定就留空→callerIp＝nginx IP，單站主可接受。
- Codex 的 `/data/research-gateway/`：sync 無 `--delete`（`pull-deploy-assets.sh:42`）、nginx 僅特定前綴 `root /data`（`nginx.conf:141-176`）不外露，可行；仍須 0700＋同 uid 子目錄（`sqlite-store.mjs:37-52`）。
- 獨立服務唯一未驗項：Zeabur 私網主機名格式。

## 4. 配對：長效 agent token（維持）

- Codex「MCP 重啟要求新碼」：MCP 是每個 Claude Code session 一支 stdio 程序（PROD-HOME.md:13）→ 每 session 手抄碼＋短語，違反「連線盡可能快」。
- Codex「HttpOnly resume cookie」：nginx `:34` 清 Cookie，gateway 只認 `Bearer`（`auth.mjs:123`）；且重整 resume 已存在——`ResearchConnection.tsx:18-25` sessionStorage 存 study/pairing，`:103-153` 以 `browserStatus` 恢復；brief「重整要重配」只在 session 過期時成立。cookie 是多餘層。
- token 設計：gateway 只存 hash（同 `pairing-service.mjs:166`）、綁 accountId、90 天、面板可列可撤；token 只在 bind 用，之後仍發 30 分／8 小時 session（`:13-14`），日常請求不帶長效秘密。bind 只綁 `browserSeenAt` 45 s 內活躍的 study（`relay-service.mjs:528,555,686`；dev 的 `polledAt` 只在 isDev 才寫，`pairing-service.mjs:141`，不可當正式錨點）→ 外洩者在站主未開站時無事可做，開站時面板顯示裝置標籤。MCP 端放 0600 檔、env 給路徑，不內嵌 `.claude.json`。
- 本機同流程：本機 gateway 以真實 Supabase 登入＋`ALLOW_LOOPBACK` 起，鑄一次 token；測試用 `server.mjs:41` 既有 verifier 注入；刪三處 autopair 旗標。

## 5. Codex 事實錯誤／遺漏

1. Node ≥23.10 → `>=22.13`（`gw/package.json:1`）。
2. 「QueryResponder 2 秒輪詢」→ 健康時零間隔（`QueryResponder.ts:95`）。
3. 「command 現況 1.5-3 s」低估：core 模式等 ready（`server.ts:399,411`→`sceneSync.ts:73`），含 render 約 2.7-4.5 s。
4. 「每 session 18 MiB」→ 每筆（`engine.ts:573`）。
5. resume cookie 與 `nginx.conf:34`／`auth.mjs:123` 衝突，且 resume 已存在。
6. 漏：core 工具組不含瀏覽器 dataset（`toolsets.ts:12-24`），owner-only 分期非上線前提。
7. 漏：Supabase 驗證在 query 關鍵路徑兩次（`server.mjs:136,141`）；WSS「連線驗一次」能解，HTTP 以 token hash 快取同樣解。

## 修正後推薦

1. 長輪詢＋wake、合併 `/browser/wait`；WSS 延後。
2. MCP 串流 PUT 落 volume、瀏覽器同源 GET，重整自動還原。
3. 獨立 Zeabur 服務＋nginx upstream 私網；私網不可用才退回 sidecar（DB 放 `/data` 0700 子目錄）。
4. 長效 agent token＋短效 session；刪 autopair 與 code/phrase；本機同流程。
5. 採納 Codex 兩點：不做 owner-only prod 相容層；結果超限明確失敗不靜默。
