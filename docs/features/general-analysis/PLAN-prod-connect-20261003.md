# 計畫：本機 Claude Code 連上正式站（2026-10-03，使用者確認採用）

> 討論紀錄：[archive/prod-connect-20261003/](./archive/prod-connect-20261003/)（設計題、Codex r1/r2、Fable r1/r2）。決策：ADR-0017（`.gis-agent-system/decisions/0017-pulse-agent-prod-connect.md`）。
> 文中延遲數字都是**估算**，不是實測。

## 目標

- 本機 Claude Code（MCP stdio）直接控制 Zeabur 正式站的地圖，結果能上圖。
- 架構乾淨：本機與正式走**同一條路**，刪掉 dev autopair 特例。
- 快：連線免抄碼；每次地圖動作與查詢砍掉固定輪詢等待。

## 架構（兩位審查者一致的部分）

```
本機 MCP（DuckDB + GeoParquet 留本機）
   │ HTTPS：agent token bind → 短效 session；長輪詢 + wake；結果 PUT
   ▼
Zeabur「research-gateway」獨立服務（Node ≥22.13，SQLite + 結果檔放 volume 0700）
   ▲ 私網
正式站 nginx /api/research/v1 → gateway
   ▲ 同源
瀏覽器：/browser/wait 長輪詢收指令與查詢；結果同源 GET 驗 sha256
```

| 項目 | 決定 | 理由 |
|---|---|---|
| 分析引擎 | 留本機，不搬雲端 DuckDB | 主機記憶體緊；本機最快 |
| 推送 | 既有長輪詢補 wake，瀏覽器 sync＋query 合併為 `/browser/wait`；`/commands/status` 加 waitMs | 與 WebSocket 估計只差 0–40 ms；不需新依賴、nginx Upgrade、連線狀態模型。實測 P95 不達標才改 WSS |
| 結果傳輸 | MCP 串流 PUT 到 gateway volume，瀏覽器帶 Bearer 同源 GET；gateway 一併保存 import 參數（label／featureCount／style／sha256） | 重整可還原；不經 R2，少一跳與簽名 URL |
| 結果保留 | **綁 session lease**：session 到期或撤銷即刪；每筆 18 MiB、每 study 96 MiB；超限明確失敗 | 不變成雲端資料庫（Codex 顧慮），session 內重整仍可還原（Fable 需求） |
| gateway 部署 | 獨立 Zeabur 服務，nginx upstream 改私網；私網不可用才退 sidecar | gateway 在 gis-platform、網站在 mini，sidecar 要跨 repo 複製；獨立重啟不碰網站 |
| owner-only 本機資料 | 不搬上正式站；full 工具組的瀏覽器 dataset 標 HOLD | core 工具組不用它們 |
| 登入驗證 | gateway 對 Supabase JWT 做 token-hash 快取（≤60 s）或改 JWKS 本機驗簽 | 現在 query 關鍵路徑上有兩次 Supabase 往返 |

## 配對方式：長效 agent token（2026-10-03 確認）

- 面板產生一次 token，之後每個 Claude Code session 自動接上當前分頁，**免碼**。
- gateway 只存 hash、綁帳號；只能接上 45 秒內有活動（瀏覽器在輪詢即算）的分頁；面板顯示裝置並可一鍵撤銷；token 只在 bind 用，日常請求帶短效 session。
- 待 P3 細定：效期（30／90 天）、存放（macOS Keychain 或 0600 檔，不放 `.claude.json`）。
- P3 要驗：Chrome 省記憶體／省電模式凍結背景分頁時，45 秒視窗是否會擋住；若會，再放寬或改為「請切回分頁」後等待。

## Zeabur 部署事實（2026-10-03 查證）

- 同 project `project-69a3b5eb07e6de1869be6e28`（mini-tw-pulse），網站服務 `mini-taiwan-pulse`（內網 `mini-taiwan-pulse.zeabur.internal:8080`），正式網域 `https://mini-taiwan-pulse.itsmigu.com`。
- gateway 服務 `research-gateway`（service id `6ac0c94c5401b61f118840a9`），用 `zeabur deploy` 從 gis-platform `services/research-gateway` 上傳建置；同 project 內網應為 `research-gateway.zeabur.internal:8080`（PREBUILT_V2 預期 8080）。
- gis-platform、mini-pulse-gis-mcp 都是 private repo；mini-taiwan-pulse 是 public。
- ⚠️ `zeabur variable create` 執行後會印出整個服務的變數值；祕密（`SUPABASE_ANON_KEY`）一律在 Console 設定。
- zbpack（Node 24）會忽略上傳目錄裡的 Dockerfile；啟動指令改寫在 `zbpack.json`（gis-platform 分支 `feat/research-gateway-zeabur`）。

### P0 進度（2026-10-03）

| 項目 | 狀態 |
|---|---|
| 建立 Zeabur 服務 `research-gateway` | done（`zeabur deploy`，未綁 GitHub、未綁公開網域） |
| 非祕密變數 ORIGINS／PILOT_EMAILS／HOST／PORT／STORE | done |
| `SUPABASE_URL`／`SUPABASE_ANON_KEY` | done：使用者於 Console 設定；log 出現 `Research gateway started`（09:41Z） |
| volume 掛載 `/data` | done：ext4，`/data/research-gateway` 0700、sqlite 0600；容器 Node v24.21.0 |
| 網站容器→內網 gateway | done：從 mini-taiwan-pulse 容器 POST `research-gateway.zeabur.internal:8080/api/research/v1/studies` 回 401（未登入，符合預期） |
| 重啟後配對資料保留 | not run |
| 網站 nginx upstream、面板閘門 | done：mini #506 merged（e9191fab），gis-platform #136 merged（2178cd56）；新 pod 10:06Z 啟動，外部 POST `/api/research/v1/studies` 回 401 |
| 正式站配對＋地圖指令 | done：站主登入 → 研究登入 → 配對碼＋短語 → 6 輪 set_camera／set_layers／map_context 全部成功 |

### P0 效能量測（2026-10-03，bench.mjs，每項 6 次，中位數〔最小–最大〕）

| 動作 | 本機（無頭瀏覽器、軟體算繪） | 正式站（使用者瀏覽器） |
|---|---|---|
| 配對（貼碼到按確認） | 免授權 1.0 s | 12.5 s（含人工確認） |
| set_camera（含等畫面 ready） | 4.6 s（3.1–4.6） | 4.7 s（2.9–6.4） |
| get_map_context（查詢往返） | 0.09 s（0.03–1.3） | 0.96 s（0.77–1.25） |
| set_layers（含等 ready） | 1.6 s（1.5–4.7） | 4.8 s（3.0–5.4） |

- 網路底噪：台灣經 Cloudflare 新加坡節點（cf-ray SIN）進 Zeabur，ping 150 ms；同一連線上的請求連靜態小檔都要 0.17–0.37 s。gateway 內網一跳可忽略。
- 查詢慢 10 倍：一次查詢約 4 趟外網往返（MCP 送出、瀏覽器被喚醒、瀏覽器回傳、MCP 取結果），瀏覽器每趟還要向 Supabase 驗一次登入。
- 指令慢：瀏覽器每 3 秒才 sync 一次拿指令、MCP 每 1.5 秒查一次 ready。P2 的 wake、狀態長輪詢、JWT 快取正好對準這三處。

## 分階段

順序遵守「上游先動」：gateway（gis-platform）→ MCP → mini。

### P-1 開工前查（不改程式）
- ~~Zeabur 私網主機名格式~~：已確認 `<service>.zeabur.internal:8080`。
- Supabase 專案區域與東京出發的 RTT（決定 JWT 快取要不要提前）。
- Supabase OAuth redirect 白名單含正式網域。
- 正式 build 有注入 `VITE_SUPABASE_*`。

### P0 部署，不改協定
- gis-platform：gateway Dockerfile（`node:22-alpine`）、volume 0700 同 uid、env（ORIGINS＝正式網域、pilot email、STORE 路徑、HOST=0.0.0.0）。**不設** DEV_AUTOPAIR／ALLOW_LOOPBACK。
- mini：nginx upstream 改私網；`App.tsx:2041,2301` 的 `import.meta.env.DEV` 改成站主登入才顯示面板。
- 驗收：正式站登入 → 舊配對碼流程 → `pulse_set_camera` 動地圖、`map_context` 有回。**預期失敗**：show_result／show_nearby（結果通道還沒做），不算 bug。
- 🔴 部署 gateway、設 env、nginx 改動上線需你批准。

### P1 結果通道
- gateway：`/agent/results/<id>` 串流 PUT 落盤＋sha256、`/browser/results/<id>` GET；session 到期／撤銷刪檔；nginx 上傳 location `client_max_body_size 24m`。
- MCP：`showResult.ts` present 後 upload，再送 import。
- mini：`warehouseResultImport.ts:100` 改打 gateway 並帶 token（`researchAnalysisSession.ts:542` 已留 fetchImpl）；scene 套用前先匯入，避免 1 秒 watchdog 清掉結果。刪 vite `/__warehouse-results` 中介層。
- 驗收：正式站 show_result／show_nearby 上圖且 sha256 相符；18 MiB 結果 <5 s（估）；撤銷後檔案消失。

### P2 快路徑
- gateway：submit／ack／report 補 wake；`/commands/status` 支援 waitMs；JWT 快取或 JWKS。
- mini：sync＋query 合併為 `/browser/wait`。
- **timeout 鏈約束**：agent waitMs 上限最多 3000（受 `relayClient.ts:64` 5 s）、`bridgeClient.ts:3` 8 s、`nginx.conf:38` 12 s、`relayClient.ts:292` 25 s 互鎖，改任一處要整條核對。
- 驗收：用 receipt `timing` 量，query <0.3 s＋計算、set_camera <1.5 s（估，現況約 2.7–4.5 s）。

### P3 配對（依你選的 A／B）
- A：面板產生／列出／撤銷 token；gateway `/agent/tabs`、`/agent/bind`；MCP 讀 Keychain 或檔案。刪三處 dev autopair 旗標、配對碼＋短語流程；本機 gateway 也走真實登入同流程，測試用既有 verifier 注入。
- 驗收：新 Claude Code session 第一個工具呼叫 <1 s 接上；重整自動重接；撤銷後 15 s 內斷線。

### P4 驗收與清理
- `eval:agent --live-map` 對正式站跑分層題庫，維持 12/13 以上；人工目視 show_nearby。
- 正式 bundle 不含 local URL；full 工具組 owner-only dataset 標 HOLD；`/lab` 去留；更新 PROD-HOME、README。
- 🔴 每個 PR 的 push／merge、每次部署需你批准。

## 風險

- Zeabur 私網、volume 權限（`sqlite-store.mjs:37-52` 要 0700＋同 uid）是 P0 最可能起不來的點。
- 主機記憶體約 2.5 GB available；gateway 預估 60–100 MB RSS，結果落盤不吃記憶體。
- token 外洩＝能控制你的地圖（只在你開著站時）；靠撤銷、效期、裝置顯示限制。

## 與 AG-1 的關係

AG-1 只改 `MainMapConnection.tsx` 的 map_context 回傳與 pulse-layers skill，和本計畫的通道改動不重疊，可以先做或平行。

## P1–P3 進度（2026-10-03）

P1 結果通道、P2 快路徑、P3 token 配對已上線；P4（正式站驗收）待使用者 token。AG-1 未達標。介面契約見 [SPEC-prod-connect-p1-p3.md](./SPEC-prod-connect-p1-p3.md)。

### Release truth

| 格 | 狀態 | 證據 |
|---|---|---|
| build／合併 | done | gis-platform #137（`9a4feaf8`）、mini #512（`547cad42`）、MCP #35（`232b0c78`） |
| contract | done | SPEC §2；本機 e2e 13 項全過（`e2e-prod-connect.mjs local`，無頭瀏覽器） |
| stage（本機 analysis-prod） | done | 三個 worktree 已切到上述版本；8794 改測試身分 |
| deploy | done | Zeabur `research-gateway` 新 pod 2026-10-03 12:36:52Z；正式站以 `fd943f3e`（含 #512）部署，新 pod 12:43:09Z |
| HTTP（正式站、未登入） | done | 新端點 401；`/pairings/claim` 404（已移除）；上傳路徑放行 2 MB（410）；一般路徑 100 KB 回 413 |
| browser（正式站登入後） | not run | 待使用者在面板產生 token 並 `token:save` |
| 正式站量測 | not run | 待 token；只有改版前 P0 數字 |
| MCP 重連 | not run | Claude Code 需 `/mcp` 重連 |
| AG-1 | 未達標 | 見下 |

### 數字（本機 e2e，改版前後同環境）

| 項目 | 改版前 | 改版後 |
|---|---|---|
| set_camera | 4.6 s | 1.7 s |
| set_layers | 1.6 s | 0.16 s |
| map_context | 88 ms | 13 ms |
| token 接上 | — | 55 ms |
| 重整還原 | — | 5.5 s |
| 18 MiB 上傳 | — | 151 ms |

正式站 P0（改版前）：set_camera 4.7 s、map_context 0.96 s、set_layers 4.8 s。網路經 Cloudflare 新加坡節點，ping 150 ms，同連線請求 0.17–0.37 s。正式站改版後的數字尚未量。

### AG-1

分層題庫（本機新版、sonnet、live-map，run `2026-10-03T14-06-22-320Z`）：13/13，上圖、動靜、語氣 100%，$3.04、555 s。但 AG-1 未達標：L01–L04 的圖層都是自繪（`visibleSummary` 回 `custom_renderer`），回答第二句只能說讀不到數字；L01、L03 鏡頭移動各一次 SCENE_ERROR。後續 PR `feat/ag1-layer-data-summary`（自繪圖層用圖層資料做摘要、修 SCENE_ERROR）進行中。

### 待辦

1. 使用者在正式站面板產生 token，`pbpaste | npm run token:save`（在 `analysis-prod/mcp`）。
2. 跑 `e2e-prod-connect.mjs prod` 與正式站量測，補上本節數字。
3. Claude Code `/mcp` 重連 pulse-research。
4. AG-1 PR 合併後，重跑分層題庫確認 L01–L04。
