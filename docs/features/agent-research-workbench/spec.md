# Agent Research Workbench — v1 規格

> **歷史 v1 規格（2026-09-10）**：本文件仍是當時 Research Workbench 產品方向的設計證據，不是目前 23-tool 地圖探索能力或發布狀態的 SSOT。現在請從 [探索能力計劃](./exploration-capabilities-plan.md) 進入；來源能力契約與新增圖層規則見 [分析能力 onboarding](./analysis-capability-onboarding.md)。

版本：v1.0-draft · 整理日期：2026-09-10

狀態：使用者已選定產品方向並授權隔離 worktree 開工；實作進度與驗收見 [handoff.md](./handoff.md)。本規格描述完整 v1 目標，不代表所有功能已實作、上線或付費額度已核准。以下「必須」是 v1 驗收要求；數值標示「初始預設」者為可調整的工程建議。

本文件是本功能的規格 SSOT，取代[研究稿](../../research/ai-gis-analysis-roadmap-2026-09-10.md)中的第一版順序與架構選擇；研究稿保留現況證據與外部專案研究。功能 slug：`agent-research-workbench`。

## 1. 已確認方向

1. 使用者開本地 **Codex**，它負責研究規劃與 Python 分析；Claude Code 相容性留後續驗收。
2. 控制的是**正式 HTTPS 網站**，第一版就使用短效配對＋站方 relay，不把 production 配對延到第二階段。
3. 同一網站新增獨立研究入口 `/lab`（目標路由），沿用地圖底層，預設只有底圖。既有一般瀏覽／BYOK Chat 不改成研究模式。
4. 研究側欄呈現連線、範圍、步驟、資料、成果與來源；第一版指令從 Codex 輸入，側欄不另跑 LLM。
5. Agent 可將處理後的資料回傳為暫存點／線／面／格網及表格，選擇性加入既有參考圖層。不是只開既有圖層。
6. 本地 workspace 留存資料快取、清理成品、Python、研究紀錄與成果；後續研究可重用，缺多少補多少。
7. S3、Supabase、R2 經共同資料目錄探索；先支援少量有契約的資料，不能宣稱全站資料皆可分析。
8. 沿用共用工具／契約，未來可接 hosted agent；v1 不建立線上 agent 或遠端通用 Python 平台。

## 2. 使用流程與完成定義

使用者開 `/lab` → 登入 → 建立一次性配對碼 → 本地 Codex 透過 MCP 提出連線 → 網站確認 → 選區／選點 → Codex 查目錄 → 優先查本地資料 → 必要時估價取得缺片 → 本地 Python 分析 → 驗證成果 → 傳回網站 → 等呈現完成 → Codex 取得畫面並檢查 → 交付有來源的方法與結論。

v1 成功案例：同一區域中的設施計數及每平方公里密度，與另一區作相容比較；至少一次真正使用 **S3-only 的可分析資料**。第二次同資料版本、同查詢範圍重跑時，沒有重複下載資料 payload，並在側欄顯示重用量。Metadata／授權驗證仍可能有請求費，不稱為完全零網路或零成本。

空白研究畫布、分析輸入和最終結果分開。已渲染點數不是總數；來源缺漏時不能把零筆當成沒有設施。

## 3. 邏輯架構與既有基礎

```text
本地 Codex
  ├─ MCP local companion ── HTTPS/WSS ── 站方 session relay ── HTTPS/WSS ── /lab
  │    ├─ 本地資料索引與檔案                                                  │
  │    ├─ 有界資料取得 → catalog / data gateway → S3 / Supabase / R2            │
  │    └─ 驗證結果 → 私有成果上傳 → scoped artifact reference ─────────────────┘
  └─ 本地 Python：讀研究工作區的明確輸入 → 檔案成果
```

Relay 處理操作、狀態與進度，不轉送完整資料集；大成果走有大小限制的私有 artifact API。網站不直接讀本機磁碟，也不需要對本地開放 inbound port。MCP 是工具介面，API 是共用後端；兩者不各自維護分析邏輯。

之前的網站 bridge 保留於 `feat/mini-pulse-gis-mcp`，commit `96cbbbb69de22e9283ac156a3e181caefc412813`，不在研究時的 master `617f1dcb117e72738dde85f0cf0ab19281661432`。相鄰 `mini-pulse-gis-mcp` 有 3 個 map tools。這是既有程式基礎，不是當前正式站連線證據。

重用其中 protocol/controller 的概念與必要程式，改接 relay transport；不把 loopback WebSocket 直接 tunnel 到公網。整合在隔離 worktree 進行，先看 diff，不整包合併舊分支。上線前需重新確認當前主線。

## 4. 正式站配對與生命週期

### Study 與 snapshot

網站登入後由服務端建立不可猜測的 studyId，記錄 ownerAccountId、createdAt、stateVersion；禁止以 client 自報 ID 建立資源擁有權。Session、artifact、acquisition、snapshot 的存取須同時滿足 owner account 與 session scope；v1 不支援跨帳號共編。

Study metadata／scene snapshots 初始遠端保留 7 天，僅包含參數、artifact refs 與來源摘要，不包含本地絕對路徑或原始資料。分頁關閉只結束控制租約；遠端 study 仍依 TTL 留存，但重新控制須再配對。刪除 study 撤銷所有控制並刪除遠端 refs／成果；不自動刪本地 workspace。遠端 metadata 到期後可從本地 study manifest 建立新的 server study，不能冒用舊 session。

Snapshot restore 必須先核對每個 artifact 的狀態、owner 和當前權限，以 expectedRevision 套用；缺少成果時可還原底圖／視角，缺層明示 `PARTIAL_RESTORE`，不得聲稱完整還原。

### 身分與配對

- 網站使用既有登入身分；v1 限經服務端核准的試辦帳號。若既有登入 token 的服務端驗證尚不足，必須補齊，不以藏按鈕代替 ACL。
- 登入分頁建立 pairing request：綁 account、studyId、tabId 和 capability scope。
- 初始預設：8 位無歧義隨機字元，5 分鐘有效；每 request 最多 5 次失敗，另設 IP／帳號／裝置節流。配對碼不能當長期 bearer token，不放 URL／分析log。
- Companion 提出 code 和 device label，網站顯示申請者標籤及比對短語，**使用者在網站確認後**才換發高熵 session credential。label 是聲明，不是已驗證的裝置身份。
- Code 原子單次消耗；過期、重放、已使用都拒絕。Credential 初始預設 30 分鐘；有效租約內可重連，到期／撤銷後重新配對。不使用無限期自動續租。
- Credential 僅保存在 companion 記憶體；網站登入憑證不交給 Agent。MCP tool 結果不得回傳 credential、signed URL、S3 key 或 service-role key。
- 初始 scope：讀取本次狀態、操作研究畫布、呈現有權限成果；資料 ACL／成本 approval／本地留存許可另行判定。

### 命令、衝突與取消

每個命令包含 `protocolVersion, sessionId, studyId, tabId, commandId, expectedRevision, expiresAt`。Mutation 使用 compare-and-set revision；手動操作會增加 revision，舊命令拒絕並要求重新讀取。

區分 `accepted → applied → ready`；ready 回報 loading/error/timeout 及 sceneRevision。命令 ack 不是載入成功。重送同 commandId 不重複套用／計費；重連取得新 snapshot，不自動重放逾期操作。

一個 tab 同時只允許一個 Agent 操作租約；多分頁必須指定 tabId。初始 heartbeat 15 秒、45 秒未收到標記 disconnected。關閉分頁撤銷該分頁控制；本地研究檔案保留。重新開頁需再配對，從本地成果恢復，不假裝 browser scene 永久存在。

使用者可暫停、撤銷、取消資料 job。暫停立即阻止新的畫布 mutation；取消停止後續 gateway I/O 與受 companion 管理的工作。Codex 自己用 shell 啟動的 Python 未必能被網站終止，UI 必須寫明「已停止網站操作；本地程式可能仍執行」，不得顯示所有工作已停止。

## 5. 研究畫布與成果契約

### 畫布

`/lab` 使用獨立 study state，預設底圖，可加 AOI／選取點、最多 3 個初始可見參考圖層。研究操作不得切換一般瀏覽頁的圖層狀態。每次呈現都有 snapshot；restore 只恢復該 study，遵循 revision，避免蓋掉使用者剛做的編輯。

研究結果由一個共用 renderer/host 管理，命名空間 `analysis:<studyId>:<artifactId>`；每一份結果不新增永久 layer key。共用 host 實作時仍依專案註冊方式和 layer-onboarding 驗收，不以「動態結果」逃過 loading、opacity、legend、popup、select。清除時移除 source/layers/listeners，style reload 可重建。

v1 支援 GeoJSON Point／LineString／Polygon 及對應 Multi 類型，以及 JSON 表格；格網用 polygon＋metrics。CRS 上圖為 EPSG:4326，座標順序 lng/lat；不接受任意 HTML、JS、SVG、Mapbox expression 或自訂 URL。樣式只能選白名單 preset 和有界參數。

### 分析成果包

```text
schemaVersion / artifactId / studyId / createdAt
inputs[]: datasetId / assetVersion / checksum / queryScope / observedAt
method: name / version / parameters / scriptHash / environmentRef / seed?
geometry: fileRef / crs / featureCount / bbox / checksum / bytes
metrics[]: name / value / unit / numerator / denominator / status
quality: executionStatus / freshness / coverage / exclusions / truncated
sourceRefs[] / licenseRefs[] / accessPolicy / limitations[]
```

Metric 與 quality 的機械檢查條件：

- `metric.status = valid | partial | unknown | suppressed | undefined | not_comparable | error`；valid 為有限數值，unknown/suppressed/undefined/not_comparable/error 的 value 必須 null。partial 可有數值，但必須限定計算範圍與原因，UI 不得當完整結果。
- `metric.status=valid` 必須對該 metric 的明確 spatial/time scope 有 complete coverage，不只對零值如此；partial/unknown coverage 的非零數值也只能標 partial／unknown。若縮小範圍才能完整計算，必須寫入縮小後的 metric scope，並與原 requested AOI 並列，不能宣稱原範圍完整。
- `freshness` 含 status（fresh/stale/unknown/not_applicable）、evaluatedAt、observedAt、sourceVersion、thresholdPolicyRef；缺 observedAt 或適用 freshness policy 時為 unknown。多輸入先逐一保留，再以 stale 優先、其次 unknown、其餘適用輸入皆 fresh 才為 fresh；所有輸入不適用才為 not_applicable。歷史固定版本可在其時間範圍內有效，但不得顯示為今日最新。
- Ratio 的 numerator/denominator 帶獨立 value/status/unit；分母 ≤0 或非 valid 時，ratio 不得 valid。Suppressed 原始值與可反推的分子／分母不得傳出。
- `coverage.status = complete | partial | none | unknown`，附 requested/covered 的 spatial refs、time intervals、資料版本與有效輸入數。`exclusions` 按 missing_geometry／invalid_geometry／missing_value／duplicate／outside_scope 列計數，未知計數用 null。
- `executionStatus = succeeded | partial | failed | cancelled` 與 freshness 分開；成功執行不代表完整 coverage。只有所宣告統計範圍 complete 且足以判斷缺值時，metric 才能為 valid 的 0；不能以無 geometry 或空讀取推得零。
- `display.truncated` 與 `analysis.complete` 分開；展示抽樣不改變全量 metric。所有單位、status 與 coverage predicate 寫入 result.schema.json 的 invariant tests；validators 能檢查契約一致性，不能證明任意 Python 沒有捏造數值，方法數值仍需基準測試與 evidence review。

表格型成果可無 geometry，但必須明示 `not_applicable`；無 geometry 的資料不能合成座標。初始上傳限制：每包未壓縮最多 5 MiB、10,000 features、200,000 vertices、單列文字欄位最多 2 KiB；這些是輸出限制，不代替來源讀取上限。超出時本地保留全量，選擇產生有明確標記的聚合展示版，不能無聲截斷。

兩端驗證 schema、大小、有限數值、geometry validity、bbox、單位、來源與權限；簽名 URL 不任意 fetch。GeoJSON 中的文字只作 text，不能執行。表格與圖層引用同一 artifact version。

Relay/gateway 不信任 Agent 自報的 accessPolicy：來源 input refs 必須解析到本次合法 acquisition receipt，結果繼承最嚴格的來源限制。v1 僅允許有 receipt 的資料或明確標示的 synthetic fixture 上傳；任意本地外部檔案先不支援。

成果為私有，驗證後才能顯示；初始遠端 TTL 24 小時，可提前刪除。不進 public CDN bucket。短效下載授權初始 60 秒；撤銷不能收回已下載的 bytes，若要求立即失效需走可逐次驗權 proxy。已發布成果不自動分享，也不新增永久網站圖層。

Artifact lifecycle：`uploading → validating → ready | rejected`，ready 可轉 expired/deleted。過期 read 回 `ARTIFACT_EXPIRED`（刪除回 not-found/denied，避免洩漏其他帳號存在性），不提供舊 URL。已在瀏覽器載入的成果需顯示到期狀態並停止使用；離線／已另存副本不能保證遠端收回。

本地 results 的持久留存與遠端 24 小時 TTL 是不同儲存政策。恢復過期成果時，本地先驗 hash，重新核對來源 receipt／當前 ACL／retain policy，再經有界上傳產生新的 artifact version；snapshot 引用顯式更新，不自動重新下載原始資料。若權限或來源政策不再允許，保留失效提示，不重傳。

### 視覺回讀

`inspect_view` 回 visible layers、loading/errors、AOI、bbox、revision、展示筆數與是否抽樣。`capture_view` 取得同 revision 的畫面；初始最大邊 1600 px、4 MiB，只捕捉研究畫布與圖例，不帶配對／金鑰／其他 UI。Capture pipeline 必須實測 Mapbox/WebGL capture 的可用性；失敗回 `CAPTURE_UNAVAILABLE`，不可回黑畫面當成功。與資產載入完成／截圖期間 revision 變動時重試有上限。

## 6. 本地 workspace 與重用

由 companion 管理，使用者明確選擇根目錄與是否留存。Browser 只能傳 dataset/artifact ID，不能指定本機任意路徑。拒絕 path traversal／symlink 逃出根目錄，避免刪改其他專案。

```text
PulseWorkspace/
├─ workspace.json                       # schemaVersion、容量與留存政策；無憑證
├─ cache-index.sqlite                    # 權限域、版本、片段、狀態、大小
├─ datasets/<access-scope>/<dataset-id>/<version>/
│  ├─ manifest.json                      # coverage/time/columns/CRS/hash/bytes
│  ├─ parts/<content-hash>.parquet        # 或原始格式；不強制假稱已是 Parquet
│  └─ prepared/<recipe-hash>/             # 有版本的清理／格式轉換成品
├─ studies/<study-id>/
│  ├─ study.json                         # 問題、AOI、pin 的輸入 refs
│  ├─ analysis.py
│  ├─ environment.lock                   # Python/套件版本
│  ├─ evidence.json                      # 假說、方法、排除、檢查
│  ├─ events.jsonl                       # 有界進度事件，無 secrets/推理內文
│  └─ results/                           # 全量成果＋上圖展示版
└─ tmp/                                 # 尚未完成／驗證的下載
```

### Acquisition receipt 契約

由 gateway 簽發／保存並可依 ID 驗證，Agent 自報 receipt 不可信。至少含 `receiptId, principalAccountId, organizationId?, entitlementVersion, policyVersion, revocationEpoch, datasetId, immutableAssetRefs[{version,checksum,bytes}], normalizedQuery, issuedAt, usageValidUntil, retentionPolicy, retainUntil?, acquisitionId`。Raw→prepared→result 使用 input hash chain，prepared 檔案不會取得比 raw 更寬的權限。

Cache access-scope 由 account/org 授權域及 policyVersion 派生；私人資料不可因 checksum 相同就跨帳號命中。Online 每次重用和上傳核對 revocation／entitlement；跨 study 重用可參照既有 receipt，但須服務端重新授權本次 study，不重新計費下載 payload。Offline 僅在 receipt 明確允許持久離線使用且未過 usageValidUntil／retainUntil 時可供 companion 重用；未知撤銷狀態需標示，不承諾立即離線撤銷。

`no_download` 不得產生本地 payload，v1 本地分析回不支援；若日後提供遠端聚合需另立 operation。Receipt 不含 signed URL／credential。

### 快取身分與命中條件

Key 至少包含 access scope、dataset ID、immutable asset version、format/schema version、片段清單或規範化 query 範圍／時間／欄位。Prepared key 再含 input hashes、recipe/code hash、參數及影響結果的套件版本。相同 S3 key 的內容可能改，不能只靠檔名；ETag 不一律當 SHA-256。

命中必須同時滿足：版本與 hash 合法、檔案存在、所需範圍／時間／欄位被完整覆蓋、狀態為 verified、留存及使用權限允許。Subset 從快取取出時仍做精確 predicate；缺片只下載缺片，不能把未覆蓋範圍當零。動態 Supabase 查詢以取得時的 snapshot/receipt 和 query 作版本；cache 年齡不等於觀測時間。

下載使用 tmp→大小/hash 驗證→atomic rename→transaction 更新 index；同一 key in-flight dedupe＋file lock。崩潰、部分檔、磁碟滿不得登記 verified；重啟對帳，損壞重取前仍檢查成本。

### 更新、固定版本與清理

- 研究預設 pin 已取得的版本，確保重算；新建研究由 manifest 檢查可用版本。發現新版先標示，不能偷偷改進行中研究的輸入。
- 初始建議共用快取上限 5 GiB，第一次啟用時可改；並非預先授權下載 5 GiB。保留至少 1 GiB 磁碟餘裕，下載前檢查預估大小與 quota。
- 只自動 LRU 清理未 pin、未被開啟研究引用、非 in-flight 的 verified cache。容量不夠時停下並指出可清理項目，不刪研究程式與 results；受保護檔案也計入磁碟使用量。
- study/result 預設保留直到使用者刪除。禁用持久化時資料放本次 ephemeral workspace，結束／逾期依設定清理；正常刪除不宣稱安全抹除。
- 權限政策可為 persist_allowed／session_only／no_download。登出或撤銷停止新的服務端存取與上傳；本地工具不得繼續重用被判定撤銷的私人 cache。已下載副本無法靠遠端保證消失，需提供清除功能與清楚說明。
- 離線僅能讀符合留存政策的本地 pin 資料，不宣稱已知上游最新；離線不可能控制正式網站。

## 7. MCP 工具與服務 API

下列名稱為待實作契約。工具以 capability groups 按需探索，不把完整 dataset schema 塞進每次 context。

| 組 | 工具 | 主要輸入／行為 |
|---|---|---|
| 連線 | `pair_session`、`get_session`、`disconnect_session` | code 僅用配對；回狀態與 scope，不回 secret |
| 畫布 | `get_study_state`、`apply_scene`、`wait_scene_ready` | study/tab/revision；state mutation 僅研究畫布 |
| 觀察 | `inspect_view`、`capture_view` | revision-aware；capture 回 image content |
| 資料 | `search_datasets`、`describe_dataset` | 關鍵字/AOI/time/capability；S3-only 也可發現 |
| 本地 | `inspect_local_assets` | 命中／缺片／版本／留存狀態，bounded summary |
| 取得 | `plan_acquisition`、`acquire_data` | planId/hash 綁物件版本、最大bytes、已確認預算；本地命中先去除 |
| 成果 | `validate_result`、`present_result`、`remove_result` | 相對 study 檔案→驗證→上傳→呈現，需 acquisition receipts |
| 研究 | `record_step` | 有界使用者可見進度與方法摘要，不上傳內部思考過程 |

原始資料不直接作巨大 tool response。`acquire_data` 回 study-relative refs、欄位／coverage 摘要供本地 Python 讀；companion 保存 URL/credential，勿輸出給模型。來源 raw 中的文字一律當資料，不允許改寫規則、工具或權限。

API logical endpoints（版本前綴 `/api/research/v1`）：

```text
POST /studies                   GET /studies/:id
DELETE /studies/:id              POST /studies/:id/snapshots
POST /studies/:id/restore        POST /receipts/:id/authorize-reuse
POST /pairings                  POST /pairings/claim
POST /pairings/:id/approve       DELETE /sessions/:id
GET  /sessions/:id/events        POST /sessions/:id/commands
GET  /datasets                  GET  /datasets/:id
POST /acquisition-plans         POST /acquisitions
GET  /acquisitions/:id           DELETE /acquisitions/:id
POST /cost-approvals             POST /artifacts
GET  /artifacts/:id              DELETE /artifacts/:id
```

Events 可用 WSS 或 SSE，實作選定一種並寫 integration contract，不同機制不各做一份狀態。所有入口服務端驗證 account/scope/resource ownership；cost approval endpoint 僅網站使用者操作，不接受 Agent 自批。

共同錯誤碼：`COST_GUARD_UNAVAILABLE, ARTIFACT_EXPIRED, PARTIAL_RESTORE, AUTH_REQUIRED, PAIRING_EXPIRED, SESSION_REVOKED, REVISION_CONFLICT, SOURCE_UNAVAILABLE, COVERAGE_INSUFFICIENT, BUDGET_CONFIRMATION_REQUIRED, BUDGET_EXCEEDED, CACHE_INVALID, DISK_QUOTA_EXCEEDED, RESULT_INVALID, CAPTURE_UNAVAILABLE`。重試有界，錯誤不得轉空陣列成功。

## 8. 分析、語意與成本

v1 支援點的範圍計數、地表最近距離、count/km²；取得相容人口資料後才允許每萬人或面積/人。面積使用合適投影／geodesic 方法，不用經緯度度數平方。點在邊界採 covers，重疊比較區以明示規則處理。不同來源同一設施保留 stable ID／crosswalk 去重依據，不僅按座標合併。

固定規範＋按需 recipes＋dataset schema：定義問題、AOI、時間、分母、coverage、單位、來源、版本、可比較性與停止條件。未知／suppressed／無 geometry 與有效零值分開。樣本／粗化僅用於展示，正式 metric 用完整合格輸入；混合資料集的 population 年份不符要阻止或明示限定。

Codex 可寫 Python 探索，但網站只接受驗證過的成果。v1 不宣稱本機安全沙箱：Agent 的 shell 權限由使用者的 Codex 環境控制。若沒有可驗證的資源監控，不承諾能硬限制該 shell 的 CPU／memory；可硬限制的是 gateway I/O 和 artifact upload。進階 DBSCAN／Moran's I 等先列後續，不把分群當顯著、不以疊圖推論因果。

成本分帳：模型由使用者的 Codex 方案／帳戶承擔；站方負責 relay、data gateway、私有成果保存等。以本地重用減少來源讀取，但準備資料／metadata lookup／上傳仍可能有成本。

初始技術預設：每 plan ≤5 datasets、50 MiB 新下載、每 study ≤3 可見參考層；查詢耗時與結果上限由 backend 實際執行，不能只用 LIMIT／prompt。大檔先做受限準備或請求明確例外。

未設定金額預算時，僅允許本地 verified cache／synthetic fixture；新的可計費取得必須在網站顯示物件／範圍／bytes／估價區間／上限並獲本次確認，不能將「願意試作」當成不限額。未知估價不能回 $0。每筆 approval 綁 account、plan hash、版本、費率版本、到期與最大量，原子保留預算，重試不重複扣帳，終止後結算已用量。

Approval／acquisition 帳本：每次 `acquire_data` 帶 stable idempotencyKey，服務端綁 account＋immutable plan＋reservationId；同 key 不同 plan 拒絕。狀態為 reserved→running→settled/cancelled/failed，approval 單次消耗、原子保留帳戶總額，並行取得不能共用一份額度重複花費。

每個 object／range 有 byte/request cap，所有可承諾硬限的來源流量經 gateway 受控 reader，讀取中計量與中止；若只給直連 signed URL 而無可驗證的 I/O 控制，不能宣稱提供相同硬限。取消／部分失敗仍結算已發生來源請求及傳輸量，釋放未使用 reservation；含 retries 的 gateway bytes 與實際供應商 billable bytes 分欄（後者未知可稍後 reconciliation）。幣值是有版本費率的估計，服務商最後帳單為準；估計與量測差距不得靜默當零。

v1 新計費 acquisition 的准入條件：gateway 受控 reader 或同等可驗證的 provider cap 已就緒；否則 plan 回 `COST_GUARD_UNAVAILABLE`，即使使用者確認預算也不能以降級文案執行無上限讀取。本地 verified cache／synthetic fixture 不受這個下載准入限制。

Website 不能控制 Codex 繞過 gateway 自行用其他 credential 下載的成本。禁止作超出實際可控範圍的硬預算承諾。

## 9. 檔案責任與完整目標結構

下列為本功能目標，非已建立程式。`E→M` 既有需整合／修改；`N` 新增；`D` 由契約產生。新增服務路徑在實作前依 repo 現況確認，不假設已存在。

```text
mini-taiwan-pulse/
  docs/features/agent-research-workbench/spec.md            本文件
  src/agentBridge/                                        E→M（feature branch）
    protocol.ts / config.ts / browserClient.ts / mapController.ts
    relayTransport.ts / sceneReadiness.ts / viewInspection.ts / capture.ts  N
  src/research/
    ResearchApp.tsx / studyStore.ts / resultOverlay.ts / resultValidator.ts N
    contracts.generated.ts                                D
  src/components/research/
    SessionPanel.tsx / PairingPanel.tsx / ResearchSidebar.tsx              N
    DatasetPanel.tsx / ResultPanel.tsx / EvidencePanel.tsx / CostCard.tsx  N
  src/research/__tests__/                                  N
  <existing entry/router>                                 E→M（/lab 入口）
mini-pulse-gis-mcp/
  src/tools/mapTools.ts                                   E→M
  src/tools/{session,view,data,workspace,result}Tools.ts    N
  src/relay/client.ts                                     N
  src/workspace/{config,index,cache,download,retention}.ts N
  src/contracts.generated.ts                              D
  src/**/__tests__/                                       N
  docs/codex-setup.md                                     N（實際安裝＋回讀）
taipei-gis-analytics/
  src/manifest_writer.py                                  E→M（兼容擴充）
  src/analysis/contracts/                                 N（canonical schemas）
    dataset.schema.json / acquisition.schema.json / result.schema.json
  config/analysis/{datasets,metrics,recipes}/              N
  src/analysis/{catalog,prepare_assets,validate_result}.py N
  tests/analysis/                                         N
  docs/handoff/agent-research-workbench.md                 N

gis-platform/
  services/research-gateway/                              N（薄服務）
    app / auth / pairing / sessions / commands / budget / artifacts
    adapters/{s3,supabase,r2} / tests
  migrations/<next>_research_sessions_and_receipts.sql     N（編號實作時配置）
  docs/research-gateway-deployment.md                      N

data-collectors/
  storage/s3.py                                           E→M（需要時擴充 receipt）
  storage/analysis_manifest.py                            N（需要時）
```

Analytics 擁有 dataset/acquisition/result 語意契約；MCP repo 擁有 transport 協定與本地 cache 格式，Pulse/gateway 使用版本化 shared contract，不手抄不相容副本。Gateway 可用既有適合 runtime 實作，不能為了檔案樹再建第二套身分或資料系統。Collector 無須為 v1 強制改動，已有可靠 manifests 就先使用。

## 10. 實作順序與必過驗收

| 階段 | 交付 | 通過條件 |
|---|---|---|
| A 契約＋畫布 | 共同 schema、研究入口、固定 fixture 呈現 | 點線面／表格、loading/legend/opacity/popup/select；驗證拒絕超大／惡意結果；無一般頁狀態污染 |
| B 正式站配對 | gateway/relay＋本地 Codex MCP | 真實 HTTPS 站、單次碼、確認、到期／重放拒絕、跨帳號／分頁隔離、撤銷與 reconnect；非 localhost 替代 |
| C 本地資料重用 | workspace＋catalog＋有界取得 | 冷快取下載與第二次 payload 0 bytes、缺片補取、hash 損毀、schema 改版、pin／新版、低磁碟與鎖競爭 |
| D 分析回傳 | 本地 Python→receipt驗證→私有artifact→renderer | 一份 S3-only＋一份另一入口資料完成有界研究；數值／單位對 fixture；零分母/缺geometry/coverage不冒充0 |
| E 視覺與中斷 | inspect/capture＋側欄＋還原 | 同 revision readiness/capture、Codex實際取得image、黑畫面拒絕、使用者改圖衝突、取消/還原不串台 |

正式站整合驗收必須由本地 **Codex 實際工具呼叫**完成，不只由測試 client 模擬。桌機與手機研究頁皆驗證無橫向溢出；本地 Agent 可仍在桌機。合成資料只驗程式，不冒充 S3 live readback。

測試證據分開：schema/unit、gateway integration、local cache I/O bytes、Codex MCP invocation、production auth/headers/asset readback、browser readiness/capture、方法數值。第一次試辦也必須走私有成果權限；不能為了 demo 放公開 bucket。

驗收紀錄需包含 sourceRevision/sourceDirty、部署版本、studyId、plan/receipt/artifact hashes、來源版本／coverage、實際讀取 bytes、查詢時間、用量、截圖；不保存配對 secrets 或完整私有資料於公開文件。

## 11. v1 不包含與開工前查核

不包含：網站內 hosted agent、任意遠端 SQL／JS、全站所有來源自動可分析、即時路網、因果推論、永久圖層發布、跨裝置本地資料同步、雲端通用 Python 執行器。來源授權、coverage 與缺值要求不因試辦降低。

實作時仍需查核但不影響本次規格完成：正式網域與 `/lab` routing/CSP、既有 auth 的 verifier、relay 可部署 runtime、private artifact storage、試辦帳號、可分析 S3-only 資料及 immutable manifest、實際 rate card。發現既有服務可用就重用，不能把尚未查核項目宣稱已部署。

使用者首次啟用時決定：本地根目錄／容量／留存開關；新計費資料取得按 plan 確認或設定額度。本次不填入帳單未知數字，不代選實際 bucket、不申請或變更雲端資源。

## 12. 本次規格覆核

已覆核並補齊 study ownership／restore、receipt 與跨研究 cache 授權、metric 狀態 invariant、遠端 TTL 與本地成果重傳、費用 reservation／idempotency 五項契約。再覆核補齊 valid 的 scope 完整性、freshness 狀態合成、新計費取得的成本控制准入條件。此為文件與設計覆核，尚無相應實作測試通過宣稱。
