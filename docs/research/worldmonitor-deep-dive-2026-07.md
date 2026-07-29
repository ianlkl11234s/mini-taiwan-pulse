# worldmonitor 深度對標（2026-07-25）— 架構盤點 × OSINT 差距 × Backlog 提案

> 對標：[koala73/worldmonitor](https://github.com/koala73/worldmonitor) @ HEAD `72c2cd7`（v2.10.0），shallow clone 原始碼實測，非僅讀文件。
>
> 前作：[`docs/proposal/worldmonitor-taiwan-vision.md`](../proposal/worldmonitor-taiwan-vision.md)（2026-06-15，UX/產品視角）。本文不重複前作，聚焦四個前作未覆蓋面向：**架構工程、統計情報方法論、MCP agent 介面、OSINT 生態系整合**。
>
> 方法：4 個平行研究 agent（2×Opus 逐檔實測 worldmonitor、2× 盤點自家生態系），主模型整合驗收。文中 worldmonitor 檔案路徑皆為該 repo 相對路徑。

---

## 0. 一句話結論

**兩個系統互為鏡像**：worldmonitor 是「情報方法論已上線、但資料根基淺」（Redis 當資料庫、CII 趨勢 3 天蒸發、7 套偵測器各自為政）；我們是「資料根基深、但情報方法論未點火」（sentinel 引擎已造好未排程、警報層空白、零 agent 介面）。

我們的三個真差距全都是「材料齊備、缺點火」：
1. **sentinel 偵測閉環沒有每日排程**（runner 只實跑過一次，9 個 unverified 候選）
2. **警報層空白**（L6 驗證協議 + L7 分級警報全缺，唯一警報是維運日報）
3. **零 agent 介面**（無 MCP、無對外 API；worldmonitor 的 MCP 是 production 級）

反過來，worldmonitor 花兩個月燒掉一條 R2 遷移路線也買不回來的東西——**歷史時序 + PostGIS 空間查詢 + replay**——我們已經有了。方向不是變成它，是把它的「方法論紀律」嫁接到我們的「資料深度」上。

---

## 1. worldmonitor 是什麼（實測濃縮）

- **規模**：~75 萬行 TS monorepo（src 217k / server 59k / scripts 144k / convex 46k / tests 287k）；56 圖層、105 panel、281 proto、946 測試檔、569 RSS feed、156 支 seed script、23 個 CI workflow。
- **開發模式**：單人（Elie Habib）+ AI agent 艦隊的 compound engineering。`AGENTS.md` 是 agent 進入點（防平行 session 互撞、明文「merge 權不可委派」）；`CONCEPTS.md` 固化 20+ 自創術語（Vacuous Guard / Mutation Proof / The Lever Test）；`docs/solutions/` 29 篇帶 YAML frontmatter 的解法庫供 agent 檢索；程式碼 928 處 issue 引用、全庫僅 16 個 TODO。
- **儲存哲學**：**主線情報資料無關聯式資料庫，Upstash Redis 就是 SSOT**。CII 趨勢 TTL 3 天；其他歷史全靠上游 provider 回傳陣列切片。是純現況感知系統，回答不了「上個月如何」。代價：Redis 帳單 $800/月、13 億 commands，近兩個月的 KV/R2 架構震盪全為了逃這筆 egress 稅。
- **Compute placement**：Vercel Edge（176 檔 API，35 個 proto gateway）＋ Railway（11,721 行單檔 `ais-relay.cjs` + seed crons）＋ Upstash Redis（SSOT）＋ Cloudflare Worker（KV 就近吐 bootstrap、500ms hedge race）＋ Tauri 桌面（Node sidecar 動態載入 api/ handler）＋ Convex（38 表，只裝用戶/金流/通知，與情報資料零交集）。
- **6 variants 真相**：web 端是**單一 full build + runtime hostname 分流**，不是 6 次建置；`src/config/variants/` 有 1,361 行無人引用的死 config，連 AGENTS.md 都在把貢獻者導向死檔。
- **渲染真相**：不是「dual engine」，是**三套獨立 renderer**（deck.gl 7,803 行 god file / globe.gl / d3+SVG 降級），每個圖層原則上要寫三遍，漂移靠 `deckGLOnly` flag 遮掩。Three.js 完全被 globe.gl 封裝，**沒有自寫任何 Three scene**。

---

## 2. 差距矩陣

### 2.1 worldmonitor 領先（我們的真差距）

| # | 面向 | worldmonitor 現況 | 我們現況 |
|---|---|---|---|
| G1 | **異常偵測上線運行** | 7 套偵測器實跑中（Welford baseline、EMA threat、thermal escalation、chokepoint、radiation…），雖各自為政 | sentinel 設計更好（宣告式 `detectors.yaml`、7 態 verdict）但**未排程、跑過一次** |
| G2 | **警報管線** | signal→alert 8 道閘門、6 管道投遞（Telegram/Slack/Discord/Email/Webhook/Push）、per-user 規則、VTEC coalesceKey 去重 | **空白**。唯一警報是 Telegram 維運日報（infra 健康，非情報） |
| G3 | **綜合指數** | CII（31 國）+ CRI（196 國，有 AUC backtest + 外部效標驗證）| 無任何跨域綜合評分 |
| G4 | **Agent-native 介面** | MCP 41 tools（OAuth+PKCE+DCR、MCP Apps 10 widgets、6h production smoke）、OpenAPI 196 ops、3 語言手寫 SDK、CLI、`.well-known` 發現面 + llms.txt + 25 支 agent-skills | 零 MCP、零對外 API（僅 Supabase `cloud_agent_ro` 唯讀角色雛形） |
| G5 | **來源可信度制度** | 522 筆 provenance 三維標註（tier × type × propaganda risk）、fail-closed、評分權重含 sourceTier | TRUST_CHAIN 6 級 + Admiralty/ICD 203 已入 topic-cycle skill，但**未系統性套用到 sentinel 與每則主張** |
| G6 | **Client-side 計算** | Web Worker + Transformers.js/ONNX（4 模型）+ IndexedDB 向量庫 | 零 worker、零 client ML（grep 驗證） |
| G7 | **快取/韌性細膩度** | 96 個 circuit breaker（IndexedDB 持久化）、全層 stale-if-error、in-flight coalescing + fetcher timeout 保險絲、atomicPublish + seed-meta 新鮮度 + 15 分鐘 CI 巡檢 | CDN 快照 + 併發上限 8 + retry 已做；無 breaker、無 stale-on-error、無 production 定時探針 |
| G8 | **文件數字防漂移** | `docs/generated/stats.json` 由程式碼推導 + `docs:check` CI 強制（56/105/281 實測全對；散文段落才失準） | `layerConsistency` 測試擋圖例，但文件數字（303 層等）靠手寫 |
| G9 | **注意力/事件流 UX** | NEW/glow/badge、Cmd+K、layer presets、share link、snapshot 回放 7 天 | 前作提案 A1~C 全未動工（Event Feed / Presets / Cmd+K / share link） |

### 2.2 我們領先（worldmonitor 買不回來的）

| # | 面向 | 我們 | worldmonitor |
|---|---|---|---|
| A1 | **歷史時序 + 空間 DB** | Supabase/PostGIS 318 migrations、`analytics` 永久日聚合、跨源 SQL join、timeStore replay 引擎 | Redis TTL，CII 趨勢 3 天蒸發；無空間索引；回答不了任何歷史問題 |
| A2 | **感測密度（台灣單一國家）** | 50 張即時表：22 城公車 2min、AIS 10min（152 萬筆/2天）、落雷 1min、1,999 站淹水感知器、51 站核輻射、北市下水道/抽水站 10min | API 聚合器，無 ground sensor 網；GPS jamming 其實只是消費 gpsjam.org 現成 CSV |
| A3 | **官方 ground truth 錨定** | pla_activity_daily（國防部通報）、satellite_passes_daily、regulations.yaml 強制引法規原文 | 純訊號推斷，無權威基準 |
| A4 | **驗證品質** | topic-cycle 四官對抗 + canary 假邊盲測 5/5 全中、anomaly 7 態 verdict、audit_log 機讀時間線 | 無事件實體（事件被 RPOP 即蒸發）；corroboration **前後端定義互相矛盾**（前端拿文章篇數當來源數）；69.5% 來源 provenance 未經人工審 |
| A5 | **渲染架構健康度** | 單一 Mapbox 引擎 + 16 CustomLayer + 21 Three scene，7 步 SOP + tsc 型別強制 + layerConsistency 測試 | 三套 renderer 重複稅、7,803 行 buildLayers god file、panel 三處手動接線 |
| A6 | **統計層架構** | `detectors.yaml` 宣告式集中（method/params/baseline 一處宣告） | 7 套偵測器各寫一份 stdDev、同一組評分權重複製 4 份且比例不一致 |
| A7 | **規模與資料目錄** | 303 圖層/24 主題；master_catalog 73,900 筆 + 8 維標籤，可做負空間分析（「這議題台灣還缺什麼資料」本身即情報） | 56 圖層（panel 105 是另一維度優勢）；無資料目錄概念 |
| A8 | **中文/在地** | 29 個台灣 RSS + Gemini 地名抽取已上線 | 569 feed 中**台灣原生中文來源為零**、GDELT 硬寫 `sourcelang:eng`、4 個 browser ML 模型全英文、瀏覽器端 Jaccard 對中文標題恆為 0 |

---

## 3. 可借鑒清單（按投資報酬排序）

### 3.1 情報方法論（OSINT 軌核心）

1. **U4 cap — 規則框住 LLM 輸出**（`server/worldmonitor/news/v1/list-feed-digest.ts:112`）⭐ 第一順位。確定性規則先出保底答案，LLM 只能在 ±2 級籠子裡微調；全庫 27 萬行只有 10 檔直呼 LLM，**沒有任何核心分數由 LLM 產生**。移植：sentinel verdict 升級路徑加等價約束——LLM 只能推進相鄰狀態，不能一步跳 `confirmed`。
2. **`shared/story-identity.js` dual-view hashed vector 聚類** ⭐ 直接可搬。word token + bigram + char 4-gram + **非 ASCII char bigram**（中文天然可用）、signed FNV-1a 進 512 維、兩視角 cosine 取 min、union-find 分群。零依賴、確定性、µs 級。閾值 0.615 需用台灣新聞標注 pair set 重校準。這是 news_events 從「單則分類」升級到「跨源同故事聚類 → 多源互證」的鑰匙。
3. **Provenance 三維標註 + fail-closed**（`shared/source-provenance-declarations.ts`）：tier × type × propaganda risk（+stateAffiliated+knownBiases），未審來源預設「不得視為獨立新聞」。正好對應台灣的官媒/統戰媒體/內容農場光譜。前車之鑑：它 69.5% 來源從未人工審過——標註制度要配審核節奏。
4. **CRI 四級 imputation taxonomy**：`stable-absence / unmonitored / source-failure / not-applicable` 各配 certainty 權重；**缺值從分子分母同時剔除，不硬塞 0**。台灣開放資料缺值語意極分歧（沒測站 vs 測站壞 vs 還沒上傳 vs 不適用），這是現成框架。
5. **CRI 的 AUC backtest 框架**：凍結已知結果標注集（台灣可用：停水停電、空品紅害日、登革熱疫情週、颱風災損）對指數算 AUC 設 gate——把指數變成**可證偽預測器**。對照 CII 自承「editorial, not empirical」且 2 個月 v1→v8，沒驗證的指數就是這個下場。
6. **digest cooldown 分類表**（`scripts/lib/digest-cooldown-decision.mjs`）：按內容類型給 cooldown floor（critical 動態 4h／持續敘事 24h／智庫分析 7 天）+ 明確 re-allow 條件（+5 sources / new fact / severity 變化）。worldmonitor 自己還卡在 shadow mode，我們可以直接讓它上線。
7. **coalesceKey 穩定事件族 key**：NWS VTEC 四元組刻意丟掉 action，讓 NEW/CON/CAN 收斂成同一把 key。直接類比 NCDR 告警/水情公告的 NEW/UPDATE/CANCEL。
8. **Coverage ledger**（`list-feed-digest.ts:1526`）：每輪記錄 itemsIngested / itemsServed / 每個 gate 的丟棄數——回答「我的過濾器默默吃掉了什麼」。進 sentinel `run_log` 成本極低。
9. **Evidence bundle ≠ conclusion**：不發布結論標籤，發布證據包 + classifierVersion + confidence，badge 只是證據的便利視圖並隨 freshness 衰減。與 mini-taiwan-osint「研判與資料分離」哲學同構，可制度化。

### 3.2 Agent 介面（Dashboard → API → Tool → Agent 演化路徑）

10. **MCP 架構範本**：`describe_tool` token 節流（tools/list 回壓縮版，展開才給全 schema，且免配額）、discovery 面匿名開放（tools/list/prompts/resources 不設牆，兩起 production incident 換來的教訓）、28/41 工具只是讀預先算好的 key（sub-second）——對應我們就是「MCP tool = 讀 Supabase RPC/analytics 表」，天然合拍。
11. **MCP Apps 殼/資料分離**：HTML 殼靜態零資料免配額，資料由 host 走計費的 tools/call 再 postMessage 注入；CSP 全 inline、textContent 渲染。10 個 widget 可直接當 Pulse Index / Event Feed 卡片的範本。
12. **`.well-known` 發現面**：agent-card.json（A2A）、server-card、llms.txt（含「When NOT to use」段落）、25 支 agent-skills SKILL.md。成本低、讓生態系對 agent 可發現。

### 3.3 工程紀律

13. **`docs/generated/stats.json` + CI `docs:check`**：會漂移的數字（圖層數/panel 數）由程式碼推導、CI 強制、禁止手改。它文件品質最高的部分就是這裡，失準全集中在沒被 stats 覆蓋的散文。
14. **Vacuous Guard / Mutation Proof 概念**：「斷言否定命題的守門會 fail open，檢查得越少看起來越綠」；新守門要先故意弄壞被保護物、看守門變紅、再還原。適合直接收進 PRINCIPLES.md 測試紀律。
15. **fetcher timeout 保險絲**（`server/_shared/redis.ts:437-490`）：有 request coalescing 的地方，一個永不 settle 的 fetcher 會永久毒化該 key。我們的 `loaderCache`/`staticRpc` 值得對照檢查。
16. **circuit breaker + stale-on-error**：96 個 breaker、IndexedDB 持久化、`live|cached|unavailable` 三態對 UI 暴露。我們的 Supabase loader 目前失敗就是失敗，颱風天（流量尖峰+最需要可用性）值得有降級路徑。

### 3.4 不要學的（反面教材）

- ❌ **三套 renderer 並存**：我們單引擎 + SOP 是對的，堅持。
- ❌ **Redis 當主資料庫 + TTL 時序**：它為此付出 $800/月 + 兩個月架構震盪；PostGIS 存完整時序不是包袱，是護城河。
- ❌ **Panel 三處手動接線**：我們的 layerCatalog 型別強制（漏 key 即 tsc error）是更好的解。
- ❌ **7 套各寫一份 stdDev**：堅持 `detectors.yaml` 宣告式 + 補共用 `_stats.py`。
- ❌ **前端 ASCII Jaccard**（中文恆 0）、**英文 ML 模型**、**GDELT `sourcelang:eng`**：全部不可搬。
- ❌ **149 個「斷言原始碼文字」的測試**：那是它防 agent 回歸的權宜；我們有 tsc + 行為測試，不要退化。
- ❌ **無事件實體的警報**（TTL 到期同一件事重推）：sentinel 的 7 態 verdict 已經更好，別退化成無狀態。
- ⚠️ **最諷刺的教訓**：它寫得最嚴謹的演算法（CUSUM changepoint、指數平滑預測、Cronbach's α）全是**零生產呼叫的死碼**，生產跑的是手刻「×2 倍數」。方法論的敵人不是不會寫，是沒有接線與驗證的紀律。

---

## 4. Backlog 提案（待用戶拍板取捨）

編號 `WM-*` 避免與現有系列（AR/BC/OG/BL/GC/NE/MO/AI/E/CV/RE/BM）衝突。**落點 repo** 標明歸屬；跨 repo 者依鐵則先開 upstream handoff。

### 第一優先：點火已造好的引擎（全在 taipei-gis-analytics）

| # | 項目 | 內容 | 規模 |
|---|---|---|---|
| WM-1 | **sentinel 每日排程閉環** | `aggregate_baseline.py` + `run_detectors.py` 上每日 cron（G2 gate 需用戶拍板）。21 天 retention 下不排程 = 系統持續失憶，這是全生態系最高槓桿的一步 | 小（引擎已造好） |
| WM-2 | **U4 cap 進 verdict 升級路徑** | triage(sonnet)/escalate(opus) 只能把 anomaly 推進相鄰狀態；LLM 永遠不能一步到 `confirmed` | 小 |
| WM-3 | **共用 `_stats.py`** | Welford 數值穩定實作 + z-score/EMA 集中一處，detectors 只宣告參數 | 小 |
| WM-4 | **coverage ledger 進 run_log** | 每輪偵測記錄各 gate 丟棄數，防 Vacuous Guard | 小 |

### 第二優先：警報層從 0 到 1（taipei-gis-analytics + .gis-agent-system）

| # | 項目 | 內容 | 規模 |
|---|---|---|---|
| WM-5 | **coalesceKey 事件族 key** | NCDR/水情/地震公告的 NEW/UPDATE/CANCEL 收斂同 key；為 anomaly 表補穩定事件族 id | 小 |
| WM-6 | **cooldown 分類表 + re-allow 條件** | 按 detector 類型給 cooldown floor；re-allow = 新源佐證/新事實/severity 變化 | 中 |
| WM-7 | **兩段式分級警報**（ADR-0005 D5 pending 項） | sentinel confirmed → Discord #intel：先機讀卡片、升級才 @人。學 WM 的 sensitivity 分檔 + fail-closed | 中 |

### 第三優先：情報方法論深化（跨 analytics / data-collectors / osint）

| # | 項目 | 內容 | 規模 |
|---|---|---|---|
| WM-8 | **來源 provenance 三維標註** | 對 29 個新聞 RSS + 主要 collector 來源建 tier × type × propaganda-risk 表，與 TRUST_CHAIN 合流；fail-closed 預設 | 中 |
| WM-9 | **story-identity 移植 + 多源互證** | 移植 `shared/story-identity.js`（中文 ready），news_events 跨源同故事聚類；corroboration = distinct source 數（學後端定義，避開它前端的分母錯誤）。閾值用台灣標注 pair set 重校準 | 中大 |
| WM-10 | **鄉鎮級 Pulse/Instability Index** | CII 概念換粒度：368 鄉鎮市區或 H3 res-7/8；結構脆弱度（人口密度/高齡化/淹水潛勢）+ 即時訊號。**必須走 CRI 驗證路線**：四級 imputation taxonomy + 台灣歷史事件 AUC backtest，不做 editorial 係數 | 大 |
| WM-11 | **校準迴圈**（capability map 紅區） | 警報/研判的事後對錯追蹤表 + 定期回顧；配 ICD 203 估計性語言 | 中 |

### 第四優先：Agent 介面（Dashboard → Intelligence Platform 的關鍵一躍）

| # | 項目 | 內容 | 規模 |
|---|---|---|---|
| WM-12 | **MCP server v0** | 把現有 public RPC / analytics 聚合 / intel cards 包成 10~15 個 read-only MCP tools（`get_taiwan_pulse`、`get_news_events`、`get_reservoir_status`、`get_pla_activity`、`search_catalog`…）。學 describe_tool 節流 + freshness resource + discovery 免配額。落點建議獨立小服務或 gis-platform edge | 中大 |
| WM-13 | **`.well-known` 發現面** | llms.txt + server-card + agent-skills（catalog-search 等 skill 本身就是現成素材） | 小 |
| WM-14 | **MCP Apps widgets** | Pulse Index / Event Feed 卡片渲染進 agent 對話（殼/資料分離範本照抄） | 中（依賴 WM-10/12） |

### 第五優先：pulse 前端（承接前作 vision doc，順序仍有效）

前作 §7 起手順序不變：**Presets → Event Feed → Pulse Index panel → AI Brief → 颱風模式**，全部不需新資料。本次補充兩點修正：
- AI Brief 必須套 U4 cap 原則（規則先出保底摘要骨架，LLM 只潤語意層）
- Event Feed 的事件實體直接掛 sentinel anomaly 7 態 verdict，不要另造無狀態 feed（WM-5 的事件族 key 是前置）

### 隨手做（工程紀律，mini-taiwan-pulse）

| # | 項目 | 規模 |
|---|---|---|
| WM-15 | stats.json + `docs:check`：圖層/主題/RPC 數由程式碼推導進 CI | 小 |
| WM-16 | Vacuous Guard / Mutation Proof 收進 PRINCIPLES.md 測試紀律 | 極小 |
| WM-17 | `loaderCache`/`staticRpc` 對照檢查 fetcher timeout 保險絲 | 小 |
| WM-18 | Supabase loader 加 stale-on-error 降級（先從 Monitor Mode 訊號類開始，颱風天可用性） | 中 |

---

## 5. 與前作（2026-06-15 vision doc）的關係

- **不變**：「缺的不是資料，是情報層」的總判斷、提案 A~D 與起手順序全部仍有效（一個半月過去 Event Feed/Presets/Pulse Index/AI Brief 仍未動工）。
- **升級**：前作把 CII 當黑盒抄目標；本次實測發現 CII 是無驗證的 editorial 係數（v1→v8 震盪），**該抄的是 CRI 的驗證框架**（imputation taxonomy + AUC gate）。
- **新增**：前作完全沒碰的三塊——sentinel 閉環（第一優先）、MCP agent 介面（第四優先）、來源可信度制度（WM-8）——本次補齊，且都以 OSINT 生態系（mini-taiwan-osint / sentinel / intel_digest）為主軸而非 pulse 前端。
- **總評修正**：外界評價把 worldmonitor 捧為「World State Runtime」，實測後更精確的說法是：**它的工程紀律（drift guard、production 探針、fail-closed、postmortem 文化）遠強於它的統計嚴謹度**。該抄的是紀律與誠實，不是演算法——而我們的 sentinel 在偵測器架構與事件生命週期設計上其實已經領先，只是引擎沒點火。
