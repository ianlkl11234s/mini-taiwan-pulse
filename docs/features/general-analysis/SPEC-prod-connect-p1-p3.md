# SPEC：正式站連線 P1–P3＋AG-1 介面契約與分 repo 任務

> 日期：2026-10-03。上游文件：[PLAN-prod-connect-20261003.md](./PLAN-prod-connect-20261003.md)、ADR-0017（`.gis-agent-system/decisions/0017-pulse-agent-prod-connect.md`）、討論紀錄 [archive/prod-connect-20261003/](./archive/prod-connect-20261003/)。
> 本檔是 P1（結果通道）、P2（快路徑）、P3（token 配對）、AG-1（map_context 摘要）的**介面契約唯一出處**。三個 repo 的 worker 依 §2 實作，不得自行改契約；需要改時回報主 agent。
> 延遲數字凡標「估」者皆未實測。

## 0. 讀法與基準版本

| repo | 本檔行號依據 | 路徑 |
|---|---|---|
| gateway（gis-platform，private） | `origin/main` 2178cd5（含 #136） | `services/research-gateway/` |
| MCP（mini-pulse-gis-mcp，private） | `origin/main` fd47e9f | `.worktrees/analysis-prod/mcp/` |
| mini（mini-taiwan-pulse，public） | `master` a58bd61d | 根目錄 |

名詞：
- **session**：MCP 與某分頁（study）之間的短效租約（閒置 30 分、硬上限 8 小時，`pairing-service.mjs:13-14`）。
- **agent token**：站主在面板產生的長效憑證（30 天），只用來 `/agent/tabs`、`/agent/bind` 換 session。
- **result entry**：gateway 上一筆分析結果檔＋其 import 參數，生命週期綁 session。
- **活躍分頁**：`study.browserSeenAt` 在 45 秒內的 study（瀏覽器長輪詢每次進來都會更新）。

## 1. 已定決策與本規格補定的細節

已定（使用者 2026-10-03）：見任務說明 1–4，不重抄。本規格補定、需要知道的取捨：

| # | 補定 | 理由 |
|---|---|---|
| D1 | 結果上傳採**兩步**：`POST /agent/results/declare`（JSON，帶 import 參數）→ `PUT /agent/results/{uploadId}`（原始位元組） | gateway `maxHeaderSize` 16 KiB（`server.mjs:213`），compare／choropleth style 可能超過，import 參數不能放 header；多一趟 RTT（約 0.2–0.3 s，估） |
| D2 | P1 **保留** `import_warehouse_result` query（契約不變），gateway 在 query 入列時檢查結果已上傳且 sha256 相符 | 減少契約變動；之後可改成「scene 指令直接觸發匯入」再省一趟（列入 §12） |
| D3 | 新 state map（`agentTokens`、`results`）放**第二張表 `state_ext`**，舊 `state` 表格式不變 | 現行 `decodeState` 要求 map 數完全相等（`sqlite-store.mjs:116`），放同一 payload 會讓回退版開機即 `STATE_CORRUPT` |
| D4 | 瀏覽器長輪詢 `/browser/wait` 的 hold 為 20 s；agent 端 `waitMs` 上限 15 s、MCP 實送 ≤10 s | timeout 鏈見 §2.8 |
| D5 | `/browser/sync` 保留（`StudyController.recover`、暫停按鈕用），**不再作為迴圈**；`/browser/query` 在清理階段刪 | 合併的是「迴圈」，單次讀取仍需要 |
| D6 | P3 合併／部署順序例外：**gateway → mini → MCP** | MCP token 綁定需要「登入就自動建 study 並長輪詢」的分頁，這只有 mini P3 後才存在 |
| D7 | session 撤銷帶原因；被其他 agent 接手（displaced）或站主中斷（owner_revoked）後 MCP **不自動搶回**，閒置過期才自動重綁 | 避免兩個 Claude Code session 互搶同一分頁 |
| D8 | study 保留期：從未綁過 agent 的 study 2 小時、其餘最後活動後 24 小時（現行一律 7 天） | P3 每個登入分頁都會自動建 study，7 天會撐爆 4 MiB state |
| D9 | 研究登入改 `localStorage`（storageKey 不變 `pulse-research-auth-v1`） | 見 §6 P3 取捨 |

## 2. 介面契約（SSOT）

### 2.1 共通規則

- 前綴 `/api/research/v1`；同源；`Cache-Control: private, no-store`；錯誤一律 `{"error":{"code":"..."}}`。
- 三種 Authorization：
  - 瀏覽器：`Bearer <Supabase access token>`；測試身分下 `Bearer test-local`（§2.6）。
  - agent session：`Research <credential>`，credential 符合 `/^[A-Za-z0-9_-]{43}$/`（`relay-service.mjs:473`）。
  - agent token：`Agent <token>`，token 符合 `/^pat_[A-Za-z0-9_-]{43}$/`；**只**接受於 `/agent/tabs`、`/agent/bind`。其他端點帶 `Agent` 一律 `AUTH_REQUIRED`。
- 除 §2.3 的 PUT／GET 外，其餘端點仍是 POST＋`application/json`、請求 ≤32 KiB（`server.mjs:11,24-25`）。URL 不可帶 query string（`server.mjs:81`），ID 放 path。
- **形狀相容規則（rollout 期間）**：
  - R1：`StudyState`、`BrowserSessionStatus`、command receipt、query receipt 的鍵**不得增減**——mini `bridgeClient.ts:98,103-106` 用 `exactObject` 嚴格比對，舊前端會判 `INVALID_RESPONSE`。新資訊只放新端點的外層 envelope（例如 `/browser/wait` 的 `agent`）。
  - R2：gateway 舊版對 `/commands/status` 是 `exact(body,['commandId'])`（`server.mjs:171`）、`/agent/query-status` waitMs ≤1000（`relay-service.mjs:669`）。MCP P2 只能在 gateway P2 部署後合併。
  - R3：新錯誤碼必須同時登記三處（§2.2），否則 MCP `errorCode()` 會把未知 409 誤判成 `PAIRING_PENDING`、410 誤判成 `SESSION_EXPIRED`（`relayClient.ts:537-544`）。

### 2.2 錯誤碼總表

| code | HTTP | 出現端點 | gateway `statuses`（server.mjs:21） | MCP `ACCEPTED_GATEWAY_CODES`（relayClient.ts:67-72） | mini 處理 |
|---|---|---|---|---|---|
| `RESULT_TOO_LARGE` | 413 | declare | 已有 | 已有 | — |
| `STUDY_RESULT_QUOTA` | 413 | declare | 新增 | 新增 | — |
| `RESULT_STORAGE_FULL` | 507 | declare | 新增 | 新增 | — |
| `LENGTH_REQUIRED` | 411 | PUT | 新增 | 新增 | — |
| `RESULT_SIZE_MISMATCH` | 400 | PUT | 新增 | 新增 | — |
| `RESULT_SHA_MISMATCH` | 400 | PUT | 新增 | 新增 | — |
| `UPLOAD_NOT_FOUND` | 404 | PUT | 新增 | 新增 | — |
| `UPLOAD_EXPIRED` | 410 | PUT | 新增 | 新增（否則被當 SESSION_EXPIRED） | — |
| `RESULT_NOT_UPLOADED` | 409 | `/agent/query`（import_warehouse_result） | 新增 | 新增（否則被當 PAIRING_PENDING） | — |
| `RESULT_NOT_FOUND` | 404 | GET 結果、meta 的 missing 不算錯 | 新增 | — | 匯入失敗→`WAREHOUSE_RESULT_UNAVAILABLE`，不觸發斷線 |
| `SESSION_DISPLACED` | 409 | 所有 `Research` 端點 | 新增 | 新增 | — |
| `SESSION_EXPIRED` | 410 | 所有 `Research` 端點（未知 credential） | 新增 | 已有 | — |
| `TOKEN_REVOKED` | 401 | `/agent/tabs`、`/agent/bind`；token 被撤銷的 session | 新增 | 新增 | 面板 |
| `TOKEN_EXPIRED` | 401 | `/agent/tabs`、`/agent/bind` | 新增 | 新增 | 面板 |
| `TOKEN_LIMIT` | 409 | `/agent-tokens/create` | 新增 | — | 面板顯示「已達 10 個，請先撤銷」 |
| `TOKEN_NOT_FOUND` | 404 | `/agent-tokens/revoke` | 新增 | — | 面板 |
| `TAB_NOT_ACTIVE` | 409 | `/agent/bind` | 新增 | 新增 | — |
| `TEST_IDENTITY_UNSAFE` | 啟動失敗 | configuration | — | — | — |

MCP 端本地碼（不經 gateway）：`AGENT_TOKEN_MISSING`、`AGENT_TOKEN_FILE_INSECURE`、`AGENT_TOKEN_INVALID`、`NO_ACTIVE_TAB`、`CHOOSE_TAB`、`SESSION_SUSPENDED`；`showFailureHint`（`showResult.ts:76-88`）要有對應白話提示。

### 2.3 P1 結果通道

#### POST `/agent/results/declare`（Research）

```json
// request
{ "resultId": "wh-12", "sha256": "<64 hex>", "bytes": 1834221,
  "label": "台北車站周邊 500 公尺", "featureCount": 214, "style": { "kind": "choropleth", "...": "..." } }
// 200
{ "uploadId": "<32 hex>", "maxBytes": 1834221, "expiresAt": 1759480000000 }
```
- 驗證：`resultId`/`sha256`/`label`/`featureCount`/`style` 沿用 `validateQuery('import_warehouse_result')` 的規則（`relay-service.mjs:273-280`，style 不合 → `INVALID_RESULT_STYLE`）；`bytes` 整數 1..25,165,824（24 MiB），超過 → `RESULT_TOO_LARGE`。
- session 必須有效、study 未暫停（`SESSION_PAUSED`）。
- 配額（宣告時預留）：每 study 所有 live entry（complete＋未過期 pending）總和＋本筆 ≤ 96 MiB（同 session 同 resultId 的舊 entry 不計，因將被取代）→ 否則 `STUDY_RESULT_QUOTA`；每 session ≤16 筆；全域 ≤ `PULSE_RESEARCH_RESULTS_MAX_BYTES`（預設 512 MiB）→ 否則 `RESULT_STORAGE_FULL`。
- `expiresAt`＝now＋120 s，逾時未完成的 pending 由 sweep 刪。
- 限流：計入 `agent:<sessionId>` 600/分（`server.mjs:117`）。

#### PUT `/agent/results/{uploadId}`（Research）

- Header：`Content-Type: application/geo+json`、`Content-Length` 必填且等於宣告 `bytes`（缺 → `LENGTH_REQUIRED`，不符 → `RESULT_SIZE_MISMATCH`）。不接受 chunked。
- gateway **串流落盤**：`<resultsDir>/<uploadId>.part`（`open 'wx'`、0600），邊收邊算 sha256；收完 bytes 與 sha 皆相符才 fsync→rename 為 `<uploadId>.geojson`，並寫 `<uploadId>.meta.json`（0600，內容＝declare 的 `{resultId, sha256, bytes, label, featureCount, style?}`），再以交易標記 entry `complete`；若同 session 同 resultId 有舊 entry，同一交易移除舊 entry，commit 後刪舊檔。任一失敗刪 `.part`。
- 計時：整段 90 s；15 s 無資料即中止。
- `uploadId` 必須屬於同一 session；已 complete 再 PUT → 200 回同一 receipt，不讀 body（直接關連線）。
- 200：`{ "resultId": "wh-12", "sha256": "...", "bytes": 1834221, "stored": true }`
- 錯誤：`UPLOAD_NOT_FOUND`、`UPLOAD_EXPIRED`、`RESULT_SIZE_MISMATCH`、`RESULT_SHA_MISMATCH`、`SESSION_REVOKED`／`SESSION_DISPLACED`／`SESSION_EXPIRED`、`BODY_TOO_LARGE`。

#### GET `/browser/results/{studyId}/{tabId}/{resultId}`（Bearer）

- path 文法：`studyId` `/^[a-f0-9]{32}$/`；`tabId` `/^[A-Za-z0-9._-]{1,128}$/`（mini 產生的是 UUID，`ResearchConnection.tsx:305`）；`resultId` `/^wh-[0-9]{1,6}$/`。瀏覽器拿到 `wh-3:point` 這類 id（`warehouseResultImport.ts:92-94`）時要先去掉 `:` 之後的字尾。
- 授權：`owner(principal, studyId, tabId)`（`relay-service.mjs:467-471`）；找該 study 目前唯一的 live session，再找 `(sessionId, resultId)` 的 complete entry。
- 200：串流檔案；`Content-Type: application/geo+json`、`Content-Length`、`X-Result-Sha256`、no-store、nosniff。**瀏覽器以 import 參數的 sha256 驗證，不信 header**。
- 錯誤（JSON）：`RESULT_NOT_FOUND` 404、`STUDY_DENIED` 403、`AUTH_REQUIRED` 401。HEAD → 405。
- 計時 60 s；計入 `browser:<accountId>` 600/分。

#### POST `/browser/results/meta`（Bearer）

```json
// request
{ "studyId": "<32 hex>", "tabId": "<uuid>", "resultIds": ["wh-3", "wh-5"] }   // 1..8 個，base id
// 200（回應上限 288 KiB，同 QUERY_TRANSPORT_LIMIT）
{ "results": [ { "resultId": "wh-3", "sha256": "...", "bytes": 120034, "label": "...", "featureCount": 40, "style": null } ],
  "missing": ["wh-5"] }
```

#### `/agent/query` 的 `import_warehouse_result` 入列檢查

`querySubmit`（`relay-service.mjs:642-666`）對此 operation 額外要求：同 session 有 `resultId` 的 complete entry 且 `sha256`、`featureCount` 相同，否則 `RESULT_NOT_UPLOADED`。query 的 args 與 browser 回傳格式**不變**。

#### 生命週期（sweep）

- entry 判死：session 不存在、`revoked`、`expiresAt`／`hardExpiresAt` 已過；或 pending 且 `expiresAt` 已過。
- sweep＝一個交易移除死 entry 並回傳 uploadId 清單，commit 後刪 `.geojson`／`.meta.json`／`.part`；接著掃目錄，**任何不在索引內的檔案（孤兒）一律刪**。
- 觸發：啟動時、每 60 s（unref timer）、以及以下動作的交易 commit 後立即：`/disconnect`、`/studies/revoke`、`/agent/bind`（接手）、`/agent-tokens/revoke`、declare 取代舊 entry。
- `cleanupState` 會無聲刪掉過期 session（`sqlite-store.mjs:136`），所以 sweep 必須把「session 不存在」當死。

### 2.4 P2 快路徑

#### POST `/browser/wait`（Bearer）——取代瀏覽器 3 s sync 迴圈與 `/browser/query` 迴圈

```json
// request
{ "studyId": "...", "tabId": "...", "knownVersion": "a1b2c3d4e5f60718", "inFlightRequestId": null,
  "acceptQueries": true, "waitMs": 20000 }
// 200（回應上限 288 KiB，同 QUERY_TRANSPORT_LIMIT：snapshot 與 query args 各可達 32 KiB）
{ "version": "0f1e2d3c4b5a6978",
  "snapshot": { /* 與 /browser/sync 回傳的 StudyState 完全同形 */ },
  "request": null,               // 或 BrowserQuery：{requestId, operation, args, expiresAt}，同 /browser/query
  "agent": { "deviceLabel": null } }
```
- `version`＝`sha256(JSON(snapshot)+JSON(agent))` 前 16 hex。envelope **不放** session 到期時間：`relay.agent()` 每次 agent 請求都改寫 `expiresAt`（`relay-service.mjs:482`），放進來會讓 heartbeat（15 s）與每個 MCP 呼叫都喚醒瀏覽器、長輪詢永遠 hold 不住。面板要顯示到期時間時讀 `/browser/status`。
- 進入時更新 `browserSeenAt`、執行 `expire()`。立即回傳的條件：(a) `acceptQueries` 且有可交付的 pendingQuery（未暫停、session 有效、`requestId !== inFlightRequestId`），或 (b) `version !== knownVersion`。否則在 `min(waitMs, 20000)` 內等 wake，被喚醒就重新判斷，逾時回目前狀態。
- `acceptQueries:false`（/lab 頁面沒有 query handler）時永不回 request，避免空轉。
- 只呼叫一次 `owner()`（現行 `/browser/query` 在 `server.mjs:141` 等待後又驗一次，刪）。
- `agent.deviceLabel`：P2 時恆為 `null`；P3 起取 live session 的 `deviceLabel`。

#### POST `/commands/status`（Research）

`{ "commandId": "...", "waitMs": 10000 }`（`waitMs` 選填 0..15000）。receipt 狀態為 `ready`／`error`／`conflict` 立即回，否則等 wake 直到逾時，回最新 receipt。回應形狀不變。

#### POST `/agent/query-status`（Research）

`waitMs` 上限 1000 → 15000（`relay-service.mjs:669`），其餘不變。

#### wake 規則

`RelayService` 的 `queryWaiters`（`relay-service.mjs:443-465`）一般化為 `waiters`（依 studyId），任何會改變 snapshot、receipt 或 pending 狀態的交易 commit 後 `wake(studyId)`：`submit`、`ack`、`report`、`manual`、`pause`、`disconnect`、`/studies/revoke`、`querySubmit`（已有，`:664`）、`browserQueryResult`（已有，`:691`）、P3 的 `bind`。等待端一律「先註冊 waiter→重讀→不滿足才等」，防漏喚醒。

#### Supabase JWT 短效快取

`owner()`（`server.mjs:88-108`）在 `rejectExhausted` 之後查快取：key＝`sha256(Authorization header)`，值＝`{accountId, until}`，`until = min(now + PULSE_RESEARCH_AUTH_CACHE_MS, JWT exp×1000)`（該 env 範圍 0..60000，預設 60000，0＝關閉快取）（exp 只拿來縮短，不作驗證依據）；只快取驗證成功者；最多 256 筆 LRU；不存原 token。代價：撤銷／登出最多 60 s 才生效。

### 2.5 P3 token 配對

#### 瀏覽器端（Bearer）

| 端點 | request | 200 | 錯誤／限制 |
|---|---|---|---|
| POST `/agent-tokens/create` | `{"label":"Claude Code"}`（1..40 字，無控制字元） | `{"tokenId":"<32 hex>","token":"pat_…","label":"…","createdAt":…, "expiresAt":…}`（token 只出現這一次） | 每帳號 active ≤10（`TOKEN_LIMIT`）；10 次／5 分 |
| POST `/agent-tokens/list` | `{}` | `{"tokens":[{"tokenId","label","createdAt","expiresAt","lastUsedAt":number|null,"activeSessions":0}]}` | — |
| POST `/agent-tokens/revoke` | `{"tokenId":"…"}` | `{"revoked":true}` | 非本帳號或不存在 → `TOKEN_NOT_FOUND`；連帶撤銷該 token 建立的所有 session（原因 `token_revoked`）並 sweep |

`expiresAt`＝createdAt＋30 天。

#### agent 端（`Agent <token>`）

**POST `/agent/tabs`** `{}` →
```json
{ "tabs": [ { "studyId": "…", "tabLabel": "3F9A", "lastSeenMs": 1200, "createdAt": 1759…, "paused": false, "agent": "none" } ] }
```
- 只列 `ownerAccountId === token.accountId` 且活躍（`browserSeenAt` 45 s 內）的 study；依 lastSeen 新到舊；≤20 筆。
- `tabLabel`＝tabId 去非英數後前 4 碼大寫；`agent` ∈ `none`｜`self`（live session 的 tokenId 是這把）｜`other`。
- 更新 token `lastUsedAt`；token 已撤銷 → `TOKEN_REVOKED`，過期 → `TOKEN_EXPIRED`，不明 → `AUTH_REQUIRED`。限流 `token:<tokenId>` 60/分。

**POST `/agent/bind`** `{"studyId":"…","deviceLabel":"Claude-macbook"}`（deviceLabel `/^[A-Za-z0-9._ -]{1,80}$/`）→ 與現行 `/pairings/exchange` 同形：
```json
{ "sessionId": "…", "studyId": "…", "tabId": "…", "credential": "<43>", "capabilities": ["study:read","study:mutate"],
  "expiresAt": …, "hardExpiresAt": … }
```
- 檢查：study 屬於 token 帳號（否則 `STUDY_DENIED`）、活躍（否則 `TAB_NOT_ACTIVE`）、未暫停（否則 `SESSION_PAUSED`）。
- 效果：同 study 其他 live session 一律撤銷，原因 `displaced`；新 session 記 `tokenId`、`deviceLabel`；sweep；wake。限流 20 次／5 分／token。

#### session 撤銷原因與 agent 端錯誤碼

`relay.agent()`（`relay-service.mjs:472-485`）找不到 live session 時依紀錄回碼：

| 狀況 | code | MCP 行為 |
|---|---|---|
| credential 不存在（含已被 cleanup 刪掉的過期 session） | `SESSION_EXPIRED` 410 | 自動重綁（同 study 仍活躍則綁回同一個） |
| `revokedReason: displaced` | `SESSION_DISPLACED` 409 | 停用自動綁定（suspended），直到使用者呼叫 `pulse_pair_session` |
| `owner_revoked`（面板「中斷 Agent」／`/studies/revoke`） | `SESSION_REVOKED` 401 | suspended |
| `token_revoked` | `TOKEN_REVOKED` 401 | 停止，提示重新產生 token 並 `npm run token:save` |
| `disconnect`（MCP 自己斷） | `SESSION_REVOKED` 401 | 不重綁 |

撤銷的 session 紀錄保留到其 `expiresAt`（≤30 分），之後變成「不存在」→ 走 `SESSION_EXPIRED`。已知邊界：被接手的舊 Claude Code session 閒置 30 分後再被使用，會自動搶回分頁（§12）。

#### MCP 自動接上流程

1. 任何需要 session 的工具呼叫（含 `pulse_get_session`）若無 active 且未 suspended：讀 token 檔→`/agent/tabs`。
2. 0 個分頁 → `NO_ACTIVE_TAB`（提示：打開並登入 Pulse 網頁、保持分頁開著）；1 個 → bind；多個 → 若本程序上次綁的 studyId 在清單中就綁回，否則 `CHOOSE_TAB`（附 tabLabel 清單）。
3. `pulse_pair_session { tab?: string }`：清除 suspended；有 `tab` 就綁那個 tabLabel（可接手 `agent:"other"`）；無 `tab` 時同步驟 2（多分頁回 `choose_tab`）。輸出 `{ state: "active"|"choose_tab"|"no_tab", sessionId?, studyId?, tabId?, tabLabel?, tabs?: [{tabLabel,lastSeenMs,agent}], message? }`。
4. `pulse_get_session` 輸出 `{ state: "unpaired"|"active", ... }`，移除 `waiting_confirmation`／`pairingId`／`phrase`。

### 2.6 本機測試身分（loopback-only）

- gateway：`PULSE_RESEARCH_TEST_IDENTITY=1`。啟動守門沿用 DEV_AUTOPAIR 的形狀（`server.mjs:185-203`）：host 必須 `127.0.0.1`、`PULSE_RESEARCH_ORIGINS` 全部是 loopback `http:`、不可設 trusted proxy，否則丟 `TEST_IDENTITY_UNSAFE` 拒絕啟動；此時 pilot allowlist 與 Supabase 設定改為選填。
- `owner()`：`header === 'Bearer test-local'` 且 `isLoopbackIp(callerIp)` → `{verified:true, accountId:'test-local'}`；非 loopback → `AUTH_REQUIRED`。Origin 已由現有 allowlist 檢查（`server.mjs:78`），因此非 loopback origin 會被拒。**限流照常開**（不像 dev autopair 關閉）。
- 測試 token 由腳本呼叫**同一個** `/agent-tokens/create`（帶 `Bearer test-local`）產生，協定與正式完全相同；不另開鑄造路徑。
- 依賴：vite 代理 `changeOrigin:false`（`vite.config.ts:1313`），瀏覽器請求經代理後 socket 仍是 127.0.0.1。
- mini：`VITE_RESEARCH_TEST_IDENTITY=1` 且 `import.meta.env.DEV` 才生效；正式 build 中 `test-local` 字樣必須被 dead-code 移除（§6 驗收 grep）。

### 2.7 AG-1：`map_context` 擴充

在 `map_context` 現有回傳（mini `MainMapConnection.tsx:403`）**新增**兩鍵，其餘不動：

```json
{
  "bounds": [121.4801, 25.0102, 121.5603, 25.0711],
  "visibleSummary": {
    "basis": "rendered_viewport",
    "note": "只統計目前畫面範圍內已畫出的圖徵；圖磚未載完時可能偏少",
    "truncated": false,
    "layers": [
      { "layerKey": "rainGauge", "label": "即時雨量", "status": "ok", "featureCount": 86, "capped": false,
        "topAreas": { "level": "town", "field": "TOWNNAME", "items": [ { "name": "信義區", "count": 12 } ] },
        "max": { "field": "rain_1h", "value": 42.5, "name": "象山站", "lngLat": [121.5761, 25.0270] } },
      { "layerKey": "satelliteImagery", "status": "not_applicable", "reason": "raster" }
    ]
  }
}
```
- `bounds`：`map.getBounds()`，四捨五入 5 位，`[west,south,east,north]`。
- 每層演算法（純函式 `src/research/visibleSummary.ts`，接受最小 map 介面以利測試）：
  1. 取 `visibleLayerKeys` 前 10 層（超過則 `truncated:true`）。
  2. 由 `LAYER_MANIFEST[layerKey].source`（單一或陣列）取 `kind ∈ {geojson,pmtiles,supabase}` 的 `sourceId`；全部是 `custom` → `not_applicable`/`custom_renderer`。
  3. style 中 `source` 屬於這些 sourceId 且 visibility≠none 的圖層；全是 `raster`/`hillshade` → `not_applicable`/`raster`；無 → `not_applicable`/`no_style_layer`。
  4. `queryRenderedFeatures({layers})`，以 `source|sourceLayer|feature.id`（無 id 時用第一個座標＋properties 的穩定雜湊）去重；最多處理 5000 筆（超過 `capped:true`）。0 筆 → `status:"no_rendered_features"`。
  5. 地區：屬性欄位依序找鄉鎮 `["TOWNNAME","townname","town","town_name","鄉鎮市區","TOWN"]`，≥50% 圖徵有值才用；否則找縣市 `["COUNTYNAME","countyname","county","county_name","縣市","COUNTY"]`；都沒有 → `topAreas:null`。前 5 名依 count 由多到少。**不做反向地理編碼**。
  6. 最大值欄位：只取該 style 圖層 paint 中第一個 data-driven `["get", field]`（依序看 `circle-radius`、`circle-color`、`fill-color`、`fill-extrusion-height`、`heatmap-weight`、`line-width`、`line-color`、`icon-size`）；找不到或值非有限數 → `max:null`。**不得猜欄位**。位置取點座標或幾何第一個座標；名稱欄位依序 `["name","名稱","title","NAME"]`，字串截 60 字。
  7. 整體時間預算 150 ms，超過的層標 `status:"skipped_budget"`。
- 大小：必須通過 gateway `validResult`（每容器 ≤100 項、字串 ≤32 KiB、深度 ≤12、整體 ≤256 KiB；`relay-service.mjs:435-441`）。10 層約 6 KB（估）。

### 2.8 timeout 鏈

| 環節 | 位置 | 現值 | 新值 |
|---|---|---|---|
| gateway 每請求計時器 | `server.mjs:215` | 全部 10 s | 一般 10 s；`/browser/wait` 25 s；`/commands/status`、`/agent/query-status` 20 s；PUT 90 s（15 s 無資料中止）；GET 60 s |
| Node `requestTimeout` | `server.mjs:213` | 10 s | 100 s（實際由上列計時器控）；`headersTimeout` 10 s 不變 |
| 瀏覽器 hold | `server.mjs:42-43,138-141` | 4.5 s（驗證 ≤5 s） | `/browser/wait` ≤20 s，前端送 20000 |
| agent waitMs 上限 | `relay-service.mjs:669` | 1000 | 15000（query-status、commands/status） |
| MCP 一般請求 | `relayClient.ts:64` | 5 s | 5 s；長輪詢請求＝waitMs＋5 s；PUT 60 s |
| MCP query | `relayClient.ts:292,295` | 期限 25 s、waitMs 1000 | 期限 25 s、waitMs＝min(10000, 剩餘−500) |
| MCP 等 ready | `relayClient.ts:256-261` | 期限 20 s、每 1.5 s 輪詢 | 期限＝min(20 s, 呼叫端 capMs)；waitMs＝min(10000, 剩餘−500)；刪 `delay(1500)` |
| core 模式上限 | `sceneSync.ts:13,34-52` | cap 8000／poll 400 | 不變，但 `waitCommandReady` 把剩餘 cap 傳進 `waitSceneReady`，避免逾時後請求還掛著 |
| bridge | `bridgeClient.ts:3` | 8 s | 一般 8 s；`/browser/wait` 27 s；GET 結果 30 s |
| 瀏覽器失敗退避 | `QueryResponder.ts:8-20`、`connectionReliability.ts:16-22` | 2–8 s（背景 10 s）；sync 3 s | 退避值不變，移到 BrowserChannel；3 s 固定 sync 刪 |
| nginx 一般 | `nginx.conf:42` | `proxy_read_timeout 12s` | 30 s |
| nginx 上傳 | 新 location | — | `client_max_body_size 24m`、`proxy_request_buffering off`、read/send 90 s |
| nginx 下載 | 新 location | — | read 60 s |
| Cloudflare 邊緣 | — | 約 100 s | 不可調 |
| 瀏覽器活躍窗 | `relay-service.mjs:555,656` | 45 s | 不變 |
| MCP heartbeat | `relayClient.ts:369` | 15 s | 不變 |

必須成立的不等式（測試要斷言數值）：
1. hold 20 s ＜ gateway 計時器 25 s ＜ bridge wait 逾時 27 s ＜ nginx 30 s ＜ Cloudflare 100 s。
2. MCP waitMs ≤10 s，＋5 s ＝15 s ≤ gateway 計時器 20 s ＜ nginx 30 s。
3. hold 20 s ＜ 活躍窗 45 s（每次 wait 進入都刷新 `browserSeenAt`）。
4. MCP 送出的 waitMs ≤ 呼叫端剩餘 cap。
5. 上傳 18 MiB 在 ≥2 Mbps 上行約 75 s ＜ 90 s（估）；更慢會明確逾時失敗。

### 2.9 端點存續表

| 端點 | 現在 | P1 | P2 | P3 | 清理階段 |
|---|---|---|---|---|---|
| `/browser/sync` | 迴圈 | 迴圈 | 單次（recover／暫停） | 單次 | 保留 |
| `/browser/query` | 迴圈 | 迴圈 | mini 不再用 | — | **刪** |
| `/browser/status` | 恢復用 | 同 | 同 | 同 | 保留 |
| `/pairings*`、`/dev/pairings*` | 用 | 用 | 用 | mini／MCP 不再用 | **刪** |
| `/studies`、`/studies/revoke` | 用 | 同 | 同 | 同 | 保留 |
| `/agent/results/*`、`/browser/results/*` | — | 新增 | 同 | 同 | 保留 |
| `/browser/wait` | — | — | 新增 | 同 | 保留 |
| `/agent-tokens/*`、`/agent/tabs`、`/agent/bind` | — | — | — | 新增 | 保留 |

清理階段＝mini P3 與 MCP P3 都上線後的 gateway PR（§4.4）。

## 3. gateway state 結構

- 表 `state`（不變）：`studies`、`pairings`、`sessions`、`rates`（`sqlite-store.mjs:6`）。清理階段 `pairings` 只會是空 map，**不從 STATE_MAPS 拿掉**，保持回退相容。
- 新表 `state_ext(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)`：`agentTokens`、`results`。與 `state` 在同一個 `BEGIN IMMEDIATE` 交易讀寫（`sqlite-store.mjs:172-192`），各自 4 MiB 上限、同樣的 `isPlainJson` 檢查。交易回呼拿到 `{studies,pairings,sessions,rates,agentTokens,results}`；`MemoryPairingStore`（`pairing-service.mjs:27-42`）同步加兩個 map。舊版 gateway 不讀 `state_ext`，可直接回退。
- 記錄形狀：

```text
agentTokens[tokenHash] = { tokenId, accountId, label, createdAt, expiresAt, lastUsedAt|null, revoked, revokedAt|null }
results[`${sessionId}:${resultId}`] = { uploadId, sessionId, studyId, resultId, sha256, bytes, featureCount, label,
                                        hasStyle, state: "pending"|"complete", createdAt, uploadExpiresAt }
sessions[credentialHash] += { tokenId|null, deviceLabel|null, revokedReason|null }   // 舊欄位不變
```
- **結果位元組與 style 不進 state**（style 在 `<uploadId>.meta.json`）。
- 結果目錄：`path.join(dirname(PULSE_RESEARCH_STORE), 'results')`，啟動時建立 0700；檔案 0600；沿用 `sqlite-store.mjs:37-64` 的「無 symlink、同 uid」檢查。正式為 `/data/research-gateway/results/`（`zbpack.json` 已建父目錄 0700）。
- `cleanupState`（`sqlite-store.mjs:134-143`）新增：
  - token：`expiresAt` 已過刪；已撤銷者在 `revokedAt`＋24 h 後刪。
  - study：無 live session 且 `max(createdAt, browserSeenAt, lastBoundAt)` 早於 24 h 前刪；從未綁過（無 `lastBoundAt`）且 `browserSeenAt` 早於 2 h 前刪；7 天硬上限保留。
  - receipt 修剪（在 sweep 中做）：`history`／`queryHistory` 中屬於已死 session 的 receipt 移除。安全性：`submit` 對他 session 的 commandId 本就回 `COMMAND_ID_REUSED`，死 session 無法再送指令；pending 已在撤銷時取消。
- 測試：30 個 idle study＋10 個各 1024 receipts 的 live study，`encodeState` <4 MiB；保留規則與修剪各有單元測試；舊 4-map payload＋無 `state_ext` 的 DB 可正常開啟（回退後再升級的情境）。

## 4. gateway 任務（gis-platform `services/research-gateway/`）

共通驗收：`node --test *.test.mjs` 全綠；`node --check *.mjs`。不改 `zbpack.json`。

### 4.1 P1 結果通道

| 檔 | 接縫 | 要做 |
|---|---|---|
| 新 `result-store.mjs` | — | `ResultStore({dir, store, clock, maxBytes})`：`declare`、`upload(incoming, …)`（串流落盤＋sha）、`openForBrowser`、`meta`、`sweep`、目錄安全檢查 |
| `sqlite-store.mjs` | `:5-9`、`:90-128`、`:145-192` | `state_ext` 表、交易合併兩份 payload、舊 DB 相容 |
| `server.mjs` | `:10-21` | 新常數、`statuses` 補 §2.2 的 P1 碼 |
| | `:81-83` | JSON 路由仍只收 POST；PUT／GET 由下列串流分流處理 |
| | `:120-175` | 加 `/agent/results/declare`、`/browser/results/meta`（responseLimit 288 KiB） |
| | `:212-239` | **在 `for await` 緩衝迴圈（`:219-223`）之前**依 method＋path 分流到 `handle.stream(incoming, outgoing, {callerIp})`，不經 `response()` 的 32 KiB 上限（`:66-68`）；改為每路由計時器（§2.8）；`requestTimeout` 100 s |
| | `:241-251` | `main()` 建 `ResultStore`、啟動 sweep（啟動一次＋60 s interval，`unref`） |
| `relay-service.mjs` | `:642-666` | import 入列檢查 `RESULT_NOT_UPLOADED` |
| | `:633-641` | `disconnect` 後觸發 sweep（以回傳旗標讓 server 呼叫，或注入 callback） |
| `pairing-service.mjs` | `:171-191` | `revoke` 後觸發 sweep；session 標 `revokedReason:'owner_revoked'` |
| | `:68` | `createStudy` 的 tabId 驗證收緊為 `/^[A-Za-z0-9._-]{1,128}$/`（GET path 要用；mini 本來就產生 UUID） |

新增測試：`result-store.test.mjs`（宣告配額三層、PUT 大小／sha 不符刪 `.part`、重複 PUT 冪等、取代舊 entry 刪舊檔、session 撤銷／過期／不存在→sweep 刪檔、孤兒檔刪除、symlink 目錄拒絕）；`server.test.mjs`（24 MiB＋1 → 413、缺 Content-Length → 411、GET 串流 Content-Length 正確且繞過 32 KiB、path 文法錯誤 → 404、PUT 期間不吃記憶體：以 20 MiB 串流檢查 RSS 增量 <8 MiB）；`relay-service.test.mjs`（import 未上傳→409）；`sqlite-store.test.mjs`（`state_ext`、舊 DB 相容）。

### 4.2 P2 快路徑

| 檔 | 接縫 | 要做 |
|---|---|---|
| `relay-service.mjs` | `:443-465` | `queryWaiters`→`waiters`，`wait(studyId, ms)`／`wake(studyId)` |
| | `:540-622`、`:623-641` | submit／manual／ack／report／pause／disconnect commit 後 `wake` |
| | `:566-575` | `status(credential,{commandId,waitMs})` 長輪詢 |
| | `:668-684` | waitMs 上限 15000 |
| | 新 | `browserWait(principal, body)`（§2.4），version 計算 |
| `server.mjs` | `:42-43` | `queryWaitMs` 驗證改為 `browserWaitMaxMs`（預設 20000，上限 20000） |
| | `:134-145` | `/browser/query` 保留給舊前端，但刪 `:141` 的第二次 `owner()` |
| | `:171` | `exact(body,['commandId','waitMs'],['commandId'])` |
| | 新 route | `/browser/wait`（responseLimit 288 KiB） |
| | `:88-108` | JWT 快取（§2.4） |
| `auth.mjs` | `:112` 之後 | 匯出 `createCachedVerifier(verify, {ttlMs, max, clock})` |
| `pairing-service.mjs` | `:171-191` | revoke 後 wake |

新增測試：wake 對每個事件都能喚醒 `/browser/wait` 與 `/commands/status`；「註冊→重讀」防漏喚醒；`inFlightRequestId` 不重複交付、`acceptQueries:false` 不交付；hold 逾時回同 version；agent heartbeat（`/session`）與 MCP 的 `/state` 讀取**不會**喚醒或改變 version；JWT 快取命中不呼叫 verifier、60 s 後再驗、失敗不快取、超過 256 筆 LRU；timeout 常數不等式（§2.8 第 1、2 條）。

### 4.3 P3 token 配對＋測試身分

| 檔 | 接縫 | 要做 |
|---|---|---|
| 新 `agent-token-service.mjs` | — | create／list／revoke、listTabs、bind（session 發放沿用 `pairing-service.mjs:163-168` 的形狀與 TTL） |
| `server.mjs` | `:86-87` | 解析 `Agent ` scheme；`/agent/*` 限流 `token:<tokenId>` |
| | `:120-175` | 5 個新 route |
| | `:184-210` | `PULSE_RESEARCH_TEST_IDENTITY` 與守門 |
| | `:88-94` | 測試身分分支 |
| | `:243-247` | 測試身分時允許無 Supabase 設定；啟動 log 註明 |
| `relay-service.mjs` | `:472-485` | 依 `revokedReason` 回 §2.5 錯誤碼；未知 credential → `SESSION_EXPIRED` |
| | `:498-502` | wait envelope 的 `agent.deviceLabel` |
| `sqlite-store.mjs` | `:134-143` | token／study 保留規則（§3） |
| 新 `scripts/mint-test-token.mjs` | — | `--origin http://127.0.0.1:<port> --out <file>`：以 `Bearer test-local` 呼叫 `/agent-tokens/create`，0600 寫檔，不印 token |

新增測試：token 只存 hash（state 內找不到明文）、30 天到期、10 個上限、撤銷連帶撤 session＋sweep；tabs 只列本帳號 45 s 內活躍分頁；bind 接手→舊 session `SESSION_DISPLACED`；四種撤銷原因的回碼；`Agent` token 打其他端點 → 401；測試身分非 loopback → 401、守門四種錯誤設定拒絕啟動；保留規則。

### 4.4 清理階段（mini P3＋MCP P3 都上線後）

刪除：`server.mjs` `DEV_BROWSER_TOKEN`（`:17-20`）、dev 限流豁免（`:51-52,60`）、`:91-94`、`/dev/*`（`:161-166`）、`PULSE_RESEARCH_DEV_AUTOPAIR` 設定（`:185-203` 中 dev 部分、`:243-247`）、`/pairings*` route（`:122-126`）、`/browser/query`（`:134-145`）；`pairing-service.mjs` 的 `DEV_*`（`:15-20`）、`isDev`、`requestPairing`～`exchange`（`:76-170`）、`revoke` 中 pairings 迴圈（`:188`）；`dev-autopair.test.mjs` 整檔；`pairing-service.test.mjs` 相應案例。README 由主 agent 改。

## 5. MCP 任務（`.worktrees/analysis-prod/mcp`）

共通驗收：`npm run typecheck && npm test && npm run build`。

### 5.1 P1

| 檔 | 接縫 | 要做 |
|---|---|---|
| `src/warehouse/engine.ts` | `:227-232`、`:1955-1971` | `PresentReceipt` 加 `bytes`（`Buffer.byteLength(body)`）；檔案照寫（本機舊前端相容） |
| `src/research/relayClient.ts` | `:67-72` | 補 P1 錯誤碼 |
| | `:428-453` | `request()` 加選填 `timeoutMs`；新 `uploadResult(receipt)`：declare →`PUT` 以 `fs.openAsBlob(path)` 當 body（自動帶 Content-Length、從磁碟串流），逾時 60 s |
| `src/research/showResult.ts` | `:14,16` | `ShowRelay` 加 `uploadResult`、`ShowStep` 加 `"upload"` |
| | `:187-191` | present 後、import 前上傳；失敗回 `shown:false, step:"upload"` |
| | `:76-88` | 新碼白話提示（`STUDY_RESULT_QUOTA`：「地圖上暫存的結果太多，先用 replace 清掉舊結果」等） |
| `src/research/server.ts` | `pulse_wh_present`（約 `:700-704`） | 同樣先上傳再 import |

測試：`relayClient.test.ts`（declare→PUT 順序、Content-Length、錯誤碼映射，含 409/410 不被誤判）；`server.test.ts`／showResult 相關（上傳失敗 step=upload、成功時 import 參數與 declare 一致）。

### 5.2 P2（gateway P2 部署後才合併）

| 檔 | 接縫 | 要做 |
|---|---|---|
| `relayClient.ts` | `:253-264` | `waitSceneReady(commandId, capMs?)` 改長輪詢（§2.8），刪 `delay(1500)` |
| | `:287-300` | waitMs 公式 |
| `sceneSync.ts` | `:34-52` | 把剩餘 cap 傳給 `waitSceneReady` |

測試：送出的 waitMs 與 per-request 逾時符合 §2.8；cap 到時不留懸掛請求；`sceneSync.test.ts` 更新。可選（量測後再決定，不在本規格必做）：`waitForNoPendingCommand` 的 `/state` 預讀可改用上一個 receipt 的 revision 樂觀送出。

### 5.3 P3（mini P3 上線後合併）

| 檔 | 接縫 | 要做 |
|---|---|---|
| 新 `src/research/agentToken.ts` | — | 讀 `PULSE_RESEARCH_AGENT_TOKEN_FILE`（預設 `~/.config/pulse-research/agent-token`）：lstat 非 symlink、一般檔、`mode & 0o077 === 0`、uid 相同，否則 `AGENT_TOKEN_FILE_INSECURE`；格式不符 `AGENT_TOKEN_INVALID`；每次 bind 重讀（存新 token 不必重開） |
| `relayClient.ts` | 刪 `:45-47,77,84-91,102-121,123-186,188-207,210-212,302-336,340-346,443,554-558` | 刪 dev autopair 與配對碼流程 |
| | 新 | `listTabs()`、`bind(studyId)`、§2.5 自動接上與 suspended 規則；deviceLabel＝`PULSE_RESEARCH_DEVICE_LABEL` 或 `Claude-<hostname 清理後>` |
| `server.ts` | `:447-463` | `pulse_pair_session`／`pulse_get_session` 新 schema（§2.5） |
| `toolsets.ts` | `:31-32` | 兩工具的 core 描述改寫（自動接上、多分頁時用 tab 選） |
| `showResult.ts` | `:73,77` | 未連線提示改為「請打開並登入 Pulse 網頁；尚未存 token 請在面板產生並執行 npm run token:save」 |
| 新 `scripts/save-agent-token.mts`＋`package.json` `"token:save"` | — | stdin 非 TTY 讀 stdin，否則 `pbpaste`；trim、驗格式；目錄 0700、暫存檔 `wx` 0600 後 rename；只印路徑，不印 token |
| `eval/agent-regression/run.mts` | `:188-201` | 等分頁改打 `/agent/tabs`（讀同一 token 檔） |
| `plugins/pulse-analyst/skills/pulse-conductor/SKILL.md` | `:50-52` | §配對 改寫：工具回 `NO_ACTIVE_TAB`／`CHOOSE_TAB`／`SESSION_SUSPENDED` 時各一句怎麼請使用者處理 |
| `docs/research-local-tools.md`、`README.md` | env 表 | 加 token 相關 env、刪 DEV_AUTOPAIR |
| 刪 `src/research/devAutopair.test.ts` | — | — |

測試：`agentToken.test.ts`（權限、symlink、格式、重讀）；`relayClient.test.ts`（0／1／多分頁、上次 study 優先、四種撤銷碼的自動重綁或 suspended、token 撤銷後 heartbeat 15 s 內清 active）；`server.test.ts`（新 schema）。

### 5.4 AG-1（可與 P1 平行）

- `toolsets.ts:40`：`pulse_get_map_context` 描述加「回傳 bounds 與 visibleSummary（每個開啟圖層在目前畫面內的筆數、前 5 名地區、最大值與位置）」。
- `server.ts:551`（full 工具組描述）同步一句。
- `pulse-layers/SKILL.md:16,22-24`：第 5 步改為開圖層後讀 `visibleSummary`；回答第二句講一個現象，用摘要的數字並註明「目前畫面範圍」；`status` 非 `ok` 時不編數字（raster／custom 改講畫面看得到的事）；`featureCount:0` 且 `tilesSettled:false` → 等 1–2 秒再讀一次。
- `pulse-conductor/SKILL.md:14`：同步一句。
- MCP 不驗 `map_context` 欄位（原樣轉交），無程式改動。

## 6. mini 任務（mini-taiwan-pulse）

共通驗收：`npx tsc -b`、`npm test`（含 `designSystemGuard`；**不可**跑 `design:baseline` 抬基準）、`npm run build && ! grep -rE "test-local|__warehouse-results" dist/`。

### 6.1 AG-1（先做；與 P1/P2 同檔，見 §7）

- 新 `src/research/visibleSummary.ts`＋`src/research/__tests__/visibleSummary.test.ts`（§2.7 每條規則一個案例：custom、raster、去重、capped、鄉鎮→縣市→null、paint `get` 欄位、無欄位 `max:null`、預算、`validQueryResultData` 通過）。
- `MainMapConnection.tsx:400-404`：`result` 加 `bounds`、`visibleSummary`。

### 6.2 P1

| 檔 | 接縫 | 要做 |
|---|---|---|
| `bridgeClient.ts` | `:3-5`、`:35-50` | `fetchResult(studyId,tabId,resultId)`（GET、24 MiB 上限、30 s）、`resultsMeta(...)`（288 KiB） |
| `warehouseResultImport.ts` | `:4-9,96-106` | `loadWarehouseResult(args, fetchText: (resultId) => Promise<string>)`；刪 `warehouseResultFileName`（`:17-19`）並更新其測試 |
| `researchAnalysisSession.ts` | `:542-545` | `importWarehouseResult(args, fetchText)` |
| `MainMapConnection.tsx` | `:429-432` | 傳入 `id => context.client.fetchResult(context.studyId, context.tabId, id)` |
| | `:239-258` | `render()` 在 `:258 mapPresentable` 之前：找出 `scene.results` 中本地沒有的 base id → `resultsMeta` → 逐筆 `importWarehouseResult`（上限 20 s）；`missing` 或失敗的 item 從 scene 移除並顯示「上次的分析結果已過期」，其餘照常呈現。理由：1 s watchdog（`:711-721`）只在 `setResultCollection` 之後才啟動，在此之前匯入完成就不會被清。`revision === 0` 分支（`:250-253`）不受影響：重整後恢復的 study revision 必 >0 |
| `vite.config.ts` | `:8`、`:392-419`、`:1244` | 刪 `serveWarehouseResults` 與 import |
| `nginx.conf` | `:29-49` 之後 | 新增兩個 location（較長 `^~` 前綴優先；prefix location **不繼承** `proxy_pass`，每個新 location 都要重複 `:33-48` 的 `include /etc/nginx/research-resolver.conf;`、`set $research_gateway …;`、`proxy_pass http://$research_gateway;`、Authorization／X-Real-IP／X-Forwarded-For／Cookie 四行 header、no-store／nosniff、`access_log off`，否則會掉到 SPA fallback）：`^~ /api/research/v1/agent/results/`（`client_max_body_size 24m`、`proxy_request_buffering off`、read/send 90 s，其餘 header 規則同現有）、`^~ /api/research/v1/browser/results/`（read 60 s） |

測試：`warehouseResultImport.test.ts`（注入 fetchText、sha 不符、筆數不符）；`researchAnalysisSession.test.ts`；`bridgeClient.test.ts`（GET 超過 24 MiB 中止、401/404 碼）；新 `__tests__/warehouseResultRestore.test.ts`（缺 id→meta→匯入；部分 missing 被移除；`wh-3:point` 去字尾）。

### 6.3 P2

| 檔 | 接縫 | 要做 |
|---|---|---|
| 新 `src/research/browserChannel.ts` | — | 在 `onConnection` 之後才啟動（恢復路徑 `ResearchConnection.tsx:128-129` 先 `onState` 後 `onConnection`，controller／handler 在 `MainMapConnection.tsx:361-366` 才建好），第一輪 `knownVersion:null` 立即取得 snapshot。handler 只在 `queryResult` POST 成功或 request 過期後才清 `inFlightRequestId`（POST 失敗時保留，下一輪仍可拿到同一 request，由 QueryResponder 的 `last` 快取重送結果）。單一 `/browser/wait` 迴圈：snapshot 變了交 `onState`；有 request 交 `queryHandler.handle(request)`（不 await），下一輪帶 `inFlightRequestId`；失敗退避沿用 `queryPollDelay`／`nextPollDelay`；auth／expired 分類照 `connectionReliability.ts` |
| `bridgeClient.ts` | 新方法 | `wait(...)`、`isWaitEnvelope`（snapshot 用既有 `isStudyState`）、`BRIDGE_WAIT_TIMEOUT_MS = 27_000`、wait 的 `maxResponseBytes` 288 KiB |
| `QueryResponder.ts` | `:74-101,102-153` | 拿掉 poll 迴圈，改 `handle(request)`＋`inFlightRequestId()`；結果整形（`:22-71`）不變 |
| `StudyController.ts` | `:16-23,27-33,84-86,102-104` | 保存最後收到的 snapshot；`busy`／`interacting` 結束時以它重跑 `receive`（長輪詢不會重送同版本） |
| `ResearchConnection.tsx` | `:238-283` | 輪詢 effect 改啟動 BrowserChannel；新 prop `queryHandler?`；/lab（`ResearchApp.tsx:171`）不傳 → `acceptQueries:false` |
| `MainMapConnection.tsx` | `:361-366,732` | QueryResponder 改為 handler，經 prop 傳給 ResearchConnection |
| `nginx.conf` | `:42` | 30 s |

測試：`browserChannel.test.ts`（版本未變不重送、request 交付且帶 inFlight、無 handler 送 acceptQueries:false、401 停止、退避）；`QueryResponder.test.ts`、`StudyController.test.ts`（忙碌時收到的 snapshot 在 idle 後重放）、`researchConnectionRecovery.test.ts` 更新；timeout 常數不等式。

### 6.4 P3

| 檔 | 接縫 | 要做 |
|---|---|---|
| `authClient.ts` | `:12` | `window.localStorage`；`authClient.test.ts` 改斷言 localStorage |
| 新 `src/research/testIdentity.ts` | — | `TEST_IDENTITY = import.meta.env.DEV && import.meta.env.VITE_RESEARCH_TEST_IDENTITY === "1"`、`TEST_BROWSER_TOKEN = "test-local"` |
| `ResearchConnection.tsx` | 重寫 `:16-25,50-59,155-236,287-347` | 登入（或測試身分）後自動 `createStudy`→取 lease→BrowserChannel；存 `{studyId,tabId,userId}`；面板顯示分頁代號、Agent 狀態（`agent.deviceLabel`）、暫停／恢復、「中斷 Agent」（`/studies/revoke` 後自動建新 study）；刪配對碼 UI、`begin`、`copyPairing`、`approve`、dev 兩個 effect |
| 新 `AgentTokenSection.tsx` | — | 產生（label 預設 Claude Code）→只顯示一次＋複製鍵＋提示「在 MCP 目錄執行 `pbpaste | npm run token:save`」；列表（label、建立、到期、最後使用）＋撤銷 |
| `bridgeClient.ts` | `:17-18,36-39,92-93` | 刪配對型別、方法、guard；加 token 三個方法 |
| 刪 `devAutopair.ts`、`devAutopair.test.ts` | — | — |
| `ResearchApp.tsx` | `:171` | 配合新 props（/lab 仍可登入、看狀態） |

UI 遵守 `docs/design-system/spec.md` §8 checklist。測試：`researchConnectionRecovery.test.ts`（自動建 study、重整恢復、中斷後重建）、新 `AgentTokenSection.test.tsx`（token 只顯示一次、撤銷）、`bridgeClient.test.ts`。

localStorage 取捨（寫進 PR 描述）：
- 好處：一次登入跨分頁、跨重開都在；P3「免碼自動接上」的前提是分頁已登入，sessionStorage 會讓每個新分頁都要重登。
- 代價：refresh token 留在瀏覽器設定檔直到登出；XSS 可讀性與 sessionStorage 相同（都可被 JS 讀）；共用電腦風險較高（站主單人裝置可接受）。
- 多分頁同時 refresh：supabase-js 2.101.1 以 navigator.locks 協調，不會互相作廢 refresh token。
- 既有 sessionStorage 內的登入不搬，升級後需重登一次；storageKey 與主站會員登入分開不變。

## 7. 共用契約檔所有權與平行規則

- 本檔 §2 是唯一契約；JSON 範例即標準樣本，各 repo 測試照抄，不另建跨 repo fixture。
- **只有主 agent 可改**：`docs/features/agent-research-workbench/bridge-contract.md`、gateway `README.md` 契約段、`PROD-HOME.md`、`STATUS.md`、本檔、`mcp-warehouse-styles.fixture.json`、MCP `src/research/contracts/*`。worker 回報「需要改什麼」。
- worker prompt 必須寫：工作區有不是你改的檔案屬於平行 session，不要碰、不要 revert、不要替它 commit。
- 同檔不可平行寫：mini `MainMapConnection.tsx` 被 AG-1、P1、P2 共用，`ResearchConnection.tsx` 被 P2、P3 共用 → mini 由**一個 worker 依序**做 AG-1→P1→P2→P3（每階段一個 PR）。gateway `server.mjs`／`relay-service.mjs`、MCP `relayClient.ts` 同理各一個 worker 依序。
- 可平行：三個 repo 的 worker 可同時開工（契約已定）；MCP 的 AG-1 skill 文字可隨 P1 一起或獨立。
- 型別重複：MCP `relayClient.ts:3-31` 與 mini `bridgeClient.ts:7-26` 各自維護同義型別，本次新增欄位依 §2 各自實作，整合時由主 agent 以 e2e 驗一致。

## 8. 合併與部署順序

| 階段 | 順序 | 說明 |
|---|---|---|
| P1 | gateway → MCP → mini | 舊前端在本機仍走 vite 中介層（MCP 仍寫本機檔），正式站在 mini P1 上線前本來就畫不上 |
| P2 | gateway → MCP → mini | R2：MCP 帶 waitMs 必須等 gateway P2 部署 |
| P3 | gateway → **mini** → MCP（例外） | D6；mini P3 上線到 MCP P3 合併之間，本機舊 MCP 的配對碼流程無分頁可配（新前端沒有配對碼 UI）→ 兩者同一天合併 |
| AG-1 | mini 與 MCP 任意順序 | mini 先上時舊 skill 忽略新欄位；skill 先上時欄位缺就照舊讀回 |
| 清理 | gateway（最後） | §4.4 |

每個 PR 的 push／merge、每次部署都需使用者拍板（GIS CLAUDE.md 鐵則）。

## 9. 整合測試腳本規格

位置：擴充 `scratchpad/bench/bench.mjs` 為 `scratchpad/bench/e2e-prod-connect.mjs`（沿用其 stdio MCP client 與從 `~/.claude-migu/.claude.json` 讀 `pulse-research` env 的做法，刪掉 DEV_AUTOPAIR 相關 env）。

### 9.1 本機模式 `node e2e-prod-connect.mjs local`

1. 預檢：8797、3736 未被占用（被占用就停下報錯，不殺）；在 `/private/tmp/…/e2e-<ts>/`（用 `/private/tmp` 不用 `/tmp`，避免 symlink 祖先被拒）建 0700 目錄。
2. 起 gateway（gis-platform 已合併版本的乾淨 checkout）：env `PULSE_RESEARCH_TEST_IDENTITY=1`、`PULSE_RESEARCH_HOST=127.0.0.1`、`PULSE_RESEARCH_PORT=8797`、`PULSE_RESEARCH_ORIGINS=http://127.0.0.1:3736`、`PULSE_RESEARCH_ALLOW_LOOPBACK=1`、`PULSE_RESEARCH_STORE=<dir>/research.sqlite`。記 PID。
3. 起 vite（mini 已合併版本）：`PULSE_RESEARCH_GATEWAY_ORIGIN=http://127.0.0.1:8797 VITE_RESEARCH_TEST_IDENTITY=1 npx vite --host 127.0.0.1 --port 3736 --strictPort`。記 PID 與其父程序。**禁止 curl vite 轉譯後模組**（會印出 VITE_* 金鑰）；健康檢查只打 `/api/research/v1/`（期望 405）。
4. 鑄 token：`node services/research-gateway/scripts/mint-test-token.mjs --origin http://127.0.0.1:8797 --out <dir>/agent-token`。
5. 開無頭瀏覽器：`agent-browser --session e2e-pc --args "--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl" open http://127.0.0.1:3736/`；`eval` 驗 webgl2 為 true（否則 close 重開，見 memory `agent-browser-mapbox-verify`）。以 token 輪詢 `/agent/tabs` 直到出現分頁（≤30 s）。
6. 起 MCP（`analysis-prod/mcp/dist/research/index.js`）：`PULSE_RESEARCH_ORIGIN=http://127.0.0.1:8797`、`PULSE_RESEARCH_ALLOW_LOOPBACK=1`、`PULSE_RESEARCH_AGENT_TOKEN_FILE=<dir>/agent-token`、`PULSE_TOOLSET=core`。
7. 動作與檢查（每項記耗時）：
   - `bind_first_call`：第一個 `pulse_get_session` 回 active（目標 <1 s）。
   - `set_camera`、`set_layers`、`map_context` 各 6 次（沿用 bench 的兩個地點與 `rainGauge`）；AG-1 已上線時檢查 `bounds`、`visibleSummary.layers` 存在。
   - `show_nearby` 3 次（台北車站 500 m 等），`shown:true`；`<dir>/results/` 至少 1 個 `.geojson`。
   - `reload_restore`：`agent-browser eval "location.reload()"`，計時到 `pulse_get_map_context` 的 `resultPresentation.resultIds` 再次包含上一步的 id（≤15 s）。
   - `displace`：腳本以同 token 自己 `/agent/bind` 同一分頁 → MCP 下一個呼叫回 `SESSION_SUSPENDED`（gateway 碼 `SESSION_DISPLACED`）；且 MCP 舊 session 的結果檔被刪。
   - `upload_18mib`：腳本用自己的 session declare＋PUT 一個 18 MiB 合成 FeatureCollection，再以 `Bearer test-local` GET 驗 sha（目標 <5 s，估）。
   - `revoke`：`/agent-tokens/list`→`/agent-tokens/revoke`；計時到腳本 session 收到 `TOKEN_REVOKED`，以及 `<dir>/results/` 為空（≤5 s）。
8. 輸出：每動作 `{n,min,p50,p95,max}`（ms）＋檢查 pass/fail，寫 `scratchpad/bench/e2e-<ts>.json` 並印表；任何檢查失敗 exit 1。
9. 收尾：依記下的 PID 依序結束 MCP、`agent-browser --session e2e-pc close`、vite（含父程序）、gateway。**不用 pkill**（會殺到 gis-up 的 dev server）。

### 9.2 正式模式 `node e2e-prod-connect.mjs prod`

不起服務；用預設 token 檔與正式 origin；使用者在自己的瀏覽器登入並開著分頁。只跑 `bind_first_call`、`set_camera`、`set_layers`、`map_context`、`show_nearby`；`reload_restore` 改為提示使用者按 Enter 後手動重整；`revoke` 改為提示使用者在面板撤銷後確認 15 s 內斷線。輸出格式同上，供與 PLAN P0 表比較。

## 10. 部署步驟與 env

### gateway
1. PR 合併到 gis-platform `main`（需拍板）。
2. 從**乾淨的已合併版本**部署，不從有未提交改動的 worktree：
   ```sh
   git -C gis-platform fetch origin
   git -C gis-platform worktree add --detach /private/tmp/gw-deploy-<sha> origin/main
   cd /private/tmp/gw-deploy-<sha>/services/research-gateway
   zeabur deploy --service-id 6ac0c94c5401b61f118840a9
   ```
3. 看 log 出現 `Research gateway started`；外部驗：`POST /api/research/v1/studies` → 401；P1 後 `GET /api/research/v1/browser/results/<32hex>/x/wh-1` → 401（不是 405）。
4. **不要執行 `zeabur variable create`**（會印出全部變數值）；祕密只在 Console 設。部署後移除暫時 worktree。

### MCP
合併後：`git -C .worktrees/analysis-prod/mcp pull && npm --prefix .worktrees/analysis-prod/mcp run build`；重開 Claude Code（MCP 隨 session 啟動）。P3 首次：面板產生 token →在 MCP 目錄 `pbpaste | npm run token:save`。

### mini
合併 master 即自動部署（含 nginx.conf）。驗：正式站 `show_nearby` 上圖；重整後結果仍在。

### env（只列 key）

| 服務 | 新增 | 移除 |
|---|---|---|
| gateway（正式） | `PULSE_RESEARCH_RESULTS_MAX_BYTES`（選填，預設 512 MiB）、`PULSE_RESEARCH_AUTH_CACHE_MS`（選填，0..60000，預設 60000） | `PULSE_RESEARCH_DEV_AUTOPAIR`（正式本來就沒設） |
| gateway（本機測試） | `PULSE_RESEARCH_TEST_IDENTITY`（**正式不可設**） | 同上 |
| MCP | `PULSE_RESEARCH_AGENT_TOKEN_FILE`（選填）、`PULSE_RESEARCH_DEVICE_LABEL`（選填） | `PULSE_RESEARCH_DEV_AUTOPAIR` |
| mini | `VITE_RESEARCH_TEST_IDENTITY`（只在 DEV 生效） | `VITE_RESEARCH_DEV_AUTOPAIR` |

本機 `.claude.json`／Codex `config.toml` 的 pulse-research env 要刪 DEV_AUTOPAIR；`PROD-HOME.md` 本機啟動段由主 agent 改寫（gateway 改用測試身分或真實登入）。

## 11. 風險與回退

| 風險 | 緩解 | 回退 |
|---|---|---|
| state 結構變更讓回退版開不起來 | D3：新 map 在 `state_ext`，舊版忽略 | 重新 `zeabur deploy` 前一版 origin/main；token／結果索引在回退期間不可用，結果檔變孤兒，再升級時 sweep 清掉 |
| 上傳卡在 Cloudflare／nginx | 24m location、request buffering off；e2e 正式模式驗 18 MiB | mini revert nginx 段；MCP 上傳失敗回 `shown:false` 不靜默 |
| volume 磁碟滿 | 全域上限＋每 study 96 MiB＋lease 綁定刪檔＋孤兒清理 | 調低 `PULSE_RESEARCH_RESULTS_MAX_BYTES` |
| 長輪詢被某一層提早切斷 | §2.8 不等式有測試；失敗退避 | gateway 調 `browserWaitMaxMs`（不需前端改） |
| Chrome 省記憶體模式凍結背景分頁 → 45 s 外，agent 接不上 | `NO_ACTIVE_TAB` 提示「請切回分頁」 | P3 驗收時人工測；必要時放寬活躍窗（拍板） |
| token 外洩＝可控站主地圖 | 只存 hash、30 天、可撤、只能接活躍分頁、面板顯示裝置；0600＋uid 檢查 | 面板撤銷 |
| study 變多撐爆 4 MiB | D8 保留規則＋receipt 修剪＋測試 | `STATE_TOO_LARGE` fail closed；刪 sqlite 重來（只失去配對） |
| 舊前端遇到新 gateway 欄位 | R1 規則 | — |
| JWT 快取延後撤銷 | ≤60 s | 設 `PULSE_RESEARCH_AUTH_CACHE_MS=0` 關閉快取 |

MCP 回退：revert 合併 commit → pull＋build。mini 回退：revert merge commit（自動部署）。順序反向：先 mini、再 MCP、最後 gateway。

## 12. 需要拍板

1. **P3 順序例外**（gateway → mini → MCP，且 mini P3 與 MCP P3 同日合併）。
2. **同一把 token 的第二個 Claude Code session 會自動接手唯一分頁**：§2.5「1 個分頁就 bind」不分 `agent` 狀態，新 session 第一個工具呼叫就接手並刪掉舊 session 的結果檔。替代：只在 `agent:"none"` 時自動綁，已被綁（`self`／`other`）回 `CHOOSE_TAB`，要接手須明確 `pulse_pair_session`。
3. **lease 綁 session 的後果**：新 Claude Code session 接手分頁（或 8 小時硬上限後重綁）會刪掉前一個 session 的結果檔；畫面上已匯入的結果仍在，但之後重整無法還原。替代：結果改綁 `(study, token)`。
4. **被接手的舊 session 閒置 30 分後再使用會自動搶回**（`SESSION_EXPIRED` 自動重綁）。替代：MCP 程序內記住「曾被接手」直到 `pulse_pair_session`。
5. **study 保留期縮短**（未綁 2 h、其餘 24 h；原 7 天）。
6. **P1 保留 import query 往返**（每次上圖多一趟，正式站約 0.3–1 s，估）；之後可讓 scene 指令直接觸發匯入，但屬契約變更。
7. **AG-1 前 5 名地區只靠圖徵屬性欄位**，沒有鄉鎮／縣市欄的圖層回 `topAreas:null`（不做反向地理編碼）。
8. `/browser/sync` 保留作單次讀取（D5），與「sync 併入長輪詢」字面不同，但迴圈已合併。

## 13. 拍板結果（2026-10-03，主 agent 依使用者「全部自己開始」授權決定）

1. 採 P3 順序例外（gateway → mini → MCP，同日）。
2. 採原案：同 token 新 session 自動接手唯一分頁。
3. 採原案：結果 lease 綁 session。
4. **採替代案**：被接手的舊 session 不自動搶回；MCP 程序記住「已被接手」，直到使用者明確呼叫 `pulse_pair_session`。
5–8. 採原案。

執行方式調整：每個 repo 一條分支、每階段一個 commit（不逐階段開 PR）；三 repo 完成後由主 agent 本機整合（§9 e2e），通過後依 §8 順序部署。
