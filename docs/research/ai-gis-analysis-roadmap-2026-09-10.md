# AI GIS 分析現況與下一步藍圖

日期：2026-09-10。狀態：歷史研究與方案演進。

> 最新規格以 [Agent Research Workbench v1](../features/agent-research-workbench/spec.md) 為準。已選定本地 Codex、第一版正式站短效配對、獨立研究畫布與本地資料快取；下文的「先 local bridge、正式站後做」及第一版線上執行器安排已被新規格取代。本研究中的現況數字為當次 checkout 證據，不代表之後主線或 production。

本次以本地原始碼、兩個外部專案原始碼與官方文件為依據。Pulse checkout：`617f1dcb117e72738dde85f0cf0ab19281661432`。沒有登入 production 驗收、讀取私人 bucket 清單、查詢正式 DB 或帳單；下列「已有」指原始碼實作，部署狀態另列。

## 1. 結論

網站已經有「AI 地圖助手＋有限的資料分析」，下一步應補「可搜尋的分析資料目錄＋有成本上限的分析服務」，沿用目前 ChatPanel 和 map bridge。

建議第一個產品交付是：點地圖 → 查 500 公尺／1 公里周邊 → 顯示分類、最近設施、來源與資料時間 → 可追問。這個查詢本身不需要 LLM；AI 負責理解問題、選工具、解釋有證據的結果。

S3 可以是最完整的保存層，但檔案存在、可以搜尋、可以直接分析，是三個不同狀態。保留完整原始檔，另外準備可查詢的 GeoParquet／索引，不必把所有歷史資料灌回 Supabase。

## 2. 網站目前做到哪裡

| 能力 | 原始碼現況 | 主要限制／證據 |
|---|---|---|
| BYOK AI 問答 | 已有，瀏覽器直連供應商，最多 10 步 tool loop | `src/chat/agent.ts:86`、`src/chat/providers.ts`；不是通用後端 agent |
| 操作地圖 | 5 個 tools：`set_layers`、`all_layers_off`、`fly_to`、`jump_to_place`、`highlight_point` | `src/chat/tools/mapTools.ts:19` |
| 找圖層／來源 | `list_layers`、`search_layers`、`get_layer_details` | `src/chat/tools/catalogTools.ts:84`；圖層目錄不等於 S3 全資料目錄 |
| 統計與找最近點 | `query_dataset` 支援 count/groupBy/filterEq/filterContains/nearest | `src/chat/tools/dataTools.ts:31`；22 個靜態點位 dataset 白名單，非所有 layer |
| 人口交叉分析 | `rank_by_population` | 點所在 H3 格人口排序；不是服務圈人口、人口密度或任意 AOI 人口 |
| 動態／目錄查詢 | `call_rpc`，10 個白名單 RPC | `src/chat/tools/rpcTools.ts:18`；不能任意 SQL 或掃所有資料表 |
| 消防／警察／醫療可達性 | 有預先計算的圖層展示 | `src/map/fireIsochroneLayerFactory.ts`、`medicalIsochroneLayerFactory.ts`、`src/chat/systemPrompt.ts:24`；不能替任意起點即時計算 |
| 外部 MCP 操作地圖 | 相鄰 server 已有 3 tools；網站 client 保留於未合流分支 | `feat/mini-pulse-gis-mcp` 的 `96cbbbb69de22e9283ac156a3e181caefc412813` 含 `src/agentBridge/`，目前 master 沒有這段接線；並非已上線公開分析 API |
| 通用點選周邊面板 | 尚未找到統一流程 | 最近點已有演算法，可沿用概念；仍缺半徑、跨資料集、完整性與 UI 接線 |
| 任意 AOI 疊合／時間比較／動態路網 | 未找到統一可呼叫的分析服務 | 既有專題成果不能推論為通用工具 |
| 搜尋私人 S3／跨 S3-Supabase 分析 | 未找到統一入口 | 目前檔案載入／archive／catalog 分散 |

目前 Chat 有 11 個註冊工具（5 地圖＋3 目錄＋3 資料）。22 個 dataset 與 10 個 RPC 是本次按程式碼 entry 計數；BYOK README 還寫 13 個 dataset，已落後。舊 WorldMonitor 研究曾寫 Pulse「零 agent 介面」，也不能當成今天的狀態。

現有 nearest 使用 Haversine 直線距離（`geojsonQuery.ts:207`）；首次查詢會下載整份白名單 GeoJSON 再在瀏覽器記憶體計算（同檔 `:23`）。回傳截斷有助控制 LLM token，但不能降低已發生的完整下載或 DB 工作量。這是擴大資料量前必須改進的地方。

現有 prompt 已具備語意防線：不杜撰數字、查目錄後才開圖層、樣本不能推論比例、等時圈不是即時計算。應延伸這份基礎。另應把「查不到就重試」改為依錯誤狀態決策：有效零筆可以停止，禁止為了找出非零答案一直改問題。

驗證：本次執行 `dataQuery.test.ts`、`mapTools.test.ts`、`layerDetails.test.ts`，3 檔 33 tests 通過。僅為本地 unit evidence；不證明 LLM 金鑰、production CSP、遠端資產或 RPC 可用。BYOK 文件標示 shipped，但本次未重驗正式站。

## 3. 兩個專案能借鏡什麼

### WorldMonitor

研究 checkout：`df2ac7daf76cd4f287e5b505509abdcb672e40aa`。

它有服務端 MCP、瀏覽器 WebMCP、工具文件和 agent skills。GIS 相關工具包括 `get_population_exposure`、`get_signal_convergence`、`get_focal_points`、`simulate_infrastructure_cascade`；另有 `get_country_risk`、`get_country_coverage`、`get_natural_disasters`、`analyze_situation` 等資料與研判入口。這是「特定領域資料＋固定分析方法」的工具集，不代表任意 GIS 運算平台。[官方工具參考](https://www.worldmonitor.app/docs/mcp-tools-reference)

值得採用的設計：按需 `describe_tool`、輸入／輸出 schema、資料 freshness、摘要輸出、工具權重／配額，以及把 UI 操作和資料查詢分開。摘要或 JMESPath projection 主要節省輸出與 token，不能直接當成來源掃描成本上限。[工具參考](https://www.worldmonitor.app/docs/mcp-tools-reference)

瀏覽器工具設計可用於 map state、圖層／面板切換、定位與搜尋；Pulse 應沿用自己的 MapBridge／revision 機制，避免新增另一套地圖狀態。領域 skills 適合做「問題 → 工具順序 → 方法限制 → 結果解釋」的短 recipe。[WebMCP](https://www.worldmonitor.app/docs/webmcp)、[Agent Skills](https://www.worldmonitor.app/docs/agent-skills)

推薦移植順序：工具契約與來源狀態 → 成本／摘要 → 主題分析 recipes → 經過校準的暴露與事件聚合。基礎設施連鎖影響和風險分數放後期，必須先有台灣適用的依賴關係及方法驗證，不能直接套外部評分。

實際方法核對（本次 checkout 原始碼，並未呼叫付費工具）：

| Tool／模組 | 原始碼中的實作 | 對 Pulse 的取捨 |
|---|---|---|
| `get_signal_convergence` | 四 feeds、1° cell、24 小時聚合，預設至少 3 domains；可加點與半徑篩選 | 適合區域事件聚集；1° 太粗，不能拿來判斷街區周邊 |
| `get_population_exposure` | events/point/countries 模式，以鄰近優先國家的 centroid density 與半徑估算；註明是 ranking signal | 不沿用為精確人口；Pulse 應選明確年份的本地人口格網及估算方法 |
| `simulate_infrastructure_cascade` | curated graph 上 BFS，沿路徑計算容量影響；空 source_id 可先查 catalog | 可借 discovery→simulation 流程；需另外建立可信的在地 graph |
| `analyze_situation` | 呼叫 deduct-situation endpoint，25 秒 timeout，返回 confidence/signals/provider/model | 可借結構化研判結果；唯讀仍可能消耗模型費用 |

前三者見 [analysis-tools.ts](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/registry/analysis-tools.ts) 的 212、455、672 行起；研判見 [rpc-tools.ts](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/registry/rpc-tools.ts#L2747)。固定 registry 分 CACHE/RPC/NLP/SOURCE，每工具要求 output byte budget；可借顯式宣告的模式，不把輸出預算誤當來源讀取預算。[registry](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/registry/index.ts)、[types](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/types.ts)

原始碼授權為 AGPL-3.0；本提案採設計參考、自行實作。若後續要複製模組，另外核對該檔授權及使用方式。[專案授權](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/LICENSE)

### monolith-terrain

研究 checkout：`f95b3bb47c826e88ac0330548278e1ba124ec276`。

這是 Three.js 地形展示，未找到 LLM、MCP、tool registry 或空間查詢 API。`src/dem.js` 提供 `loadDem`／`sampleDem`：讀公開 S3 Terrarium tiles、解碼高度、建立高度格網並插值；`terrain.js` 與 HUD 呈現等高線、設色、標高及鏡頭效果。[DEM 程式](https://github.com/kaolti/monolith-terrain/blob/f95b3bb47c826e88ac0330548278e1ba124ec276/src/dem.js)

可借的是「讓分析結果好懂」的視覺呈現，以及局部 DEM 取樣概念。坡度、剖面、視域仍需另做分析工具與精度驗證；shader 的坡面設色不能當測量值。程序地形模式含虛構地名；真實模式有另外處理，不能把程序場景混入真實 GIS 證據。[標示程式](https://github.com/kaolti/monolith-terrain/blob/f95b3bb47c826e88ac0330548278e1ba124ec276/src/labels.js)

MIT 程式授權與 DEM 原始資料 attribution 分開保留。地形呈現列後期，不是完成「點一下看周圍」的前置需求。

## 4. 目標架構

```mermaid
flowchart TD
  Click[點選地圖／選範圍] --> Request[結構化 AnalysisRequest]
  Chat[既有 BYOK Chat] --> Tools[型別化 tools]
  MCP[既有 MCP 的新增分析 adapter] --> Tools
  Tools --> Request
  Request --> Gateway[驗證身分／範圍／可用資料]
  Catalog[統一資料目錄＋語意定義] --> Gateway
  Gateway --> Plan[固定 query plan＋成本估計]
  Plan --> Gate[預算保留／必要時使用者確認]
  Gate --> Engine[Analytics 執行器]
  Engine --> DB[Supabase public RPC／PostGIS]
  Engine --> Lake[S3 分區 GeoParquet]
  Engine --> CDN[R2 已發布統計／靜態快照]
  Engine --> Result[有來源的 AnalysisResult]
  Result --> UI[周邊卡片／地圖結果／AI 解說]
```

責任落點：analytics 擁有分析契約、語意定義與運算；gis-platform 擁有認證入口、DB RPC、job／用量帳本；Pulse 擁有 UI 與工具 adapter；collectors 延伸現有 manifest 產出；MCP 只加薄 adapter，不再做第二套演算法。圖示是邏輯分工，第一版不必拆成多個新服務。

保留 BYOK 瀏覽器直連的既有行為。瀏覽器用登入 token 呼叫分析 API；S3 credential／DB 高權限 key 留服務端。回給 LLM 的摘要與樣本可能送到使用者選擇的供應商，必須以資料 access policy 過濾，並在 UI 說明。

## 5. S3 要如何被找到與分析

先建「資料資產索引」，從現有 `master_catalog.sqlite`、`manifest_writer.py`、processed manifests、S3 archive/snapshot manifests 與 layer mapping 整合。不是在每次問答時 LIST 全 bucket，也不以網站 layer 清單作為所有資料的上限。

| 保存型態 | 搜尋後的狀態 | 執行方式 |
|---|---|---|
| 已驗證 public RPC | queryable | 有界參數＋spatial index／預聚合 |
| S3 已分區 GeoParquet | queryable（需驗證 schema/coverage） | 明確檔案清單、欄位選取、bbox／時間裁切、精確幾何判斷 |
| 小型靜態 GeoJSON | queryable | 第一版沿用；需 bytes／版本／coverage |
| R2 統計 snapshot | queryable for declared operations | 沿用 exact selectors、boundary version 與 immutable artifacts |
| PMTiles | displayable；分析能力另宣告 | 畫面 picking 可用；正式全量計數應找上游原始幾何／分析成品 |
| JSON/CSV.gz/tar.gz 備份 | preparation_required | 估算完整讀取／解壓成本後做一次性轉換，不能承諾 predicate pushdown |
| 冷儲存／未就緒物件 | retrieval_required 或 unavailable | 按實際 storage class 估價；GLACIER_IR 可即時讀但有取回成本，不等於所有 Glacier 都可即時 |
| 尚未下載的 catalog metadata | discovery_only | 可說找到來源，不能回資料統計 |

DuckDB 支援 S3 與 Parquet 欄位／filter pushdown，適合首版服務端執行器候選；仍需先按 manifest 選分區，不能假設任意空間 predicate 都會省掃描。`LIMIT 20` 只限制結果，不能保證只讀 20 筆。[S3 支援](https://duckdb.org/docs/current/core_extensions/httpfs/s3api)、[Parquet](https://duckdb.org/docs/current/data/parquet/overview)

建議分區依資料特性選國家／地區／日期，再保存 object bbox、time range、bytes、row count、schema、checksum/version。發布時增量更新索引；定期 reconciliation 另訂掃描範圍與預算。過渡期未入索引的資產回 `unindexed`，不稱 S3 沒資料。

跨庫查詢先各自裁切／聚合，再合併小結果。相同來源同時存在 S3 與 Supabase 時，以 dataset version、stable feature/event ID 去重；禁止把歷史快照與目前表直接相加。時間欄位須區分 observed_at、ingested_at 與 published_at。

## 6. 建議工具清單

下列是新增介面提案，不是目前可用工具；既有 map tools 保留。

| 階段 | Tool | 輸入／結果 |
|---|---|---|
| P1 | `search_datasets` | query、bbox、time、capability → 可見資料集與 queryable 狀態，含 S3-only |
| P1 | `describe_dataset` | dataset_id → 欄位、geometry、coverage、時間、授權、方法限制 |
| P1 | `plan_analysis` | operation、dataset_ids、AOI、time、metric → 固定 plan_id/hash、版本、估價、理由 |
| P1 | `run_analysis` | plan_id、server-issued authorization → 執行已核准計畫；operation 先只有 nearby／nearest |
| P1 | `get_analysis_result` | job_id → pending/success/partial/error、結果與來源 |
| P2 | `summarize_area` | polygon/admin_id、指標 → 區域摘要、完整性、分母 |
| P2 | `compare_periods` | 同一定義的兩個時間窗 → 差異、可比性檢查 |
| P2 | `intersect_layers` | 有界 AOI、兩資料集 → 疊合結果、面積或關聯規則 |
| P3 | `calculate_accessibility` | origin、mode、cutoff、network_version → 路網可達結果 |
| P3 | `terrain_profile` | 有界 line、DEM version → 距離／高度剖面及解析度 |

後期 tools 是 `plan_analysis` 的語意便利入口，也必須經相同成本／權限關卡。不要讓模型用另一支工具繞過估價。地圖呈現用已存在的 map bridge 加有限結果 overlay，回讀成功後才能聲稱已上圖。

## 7. 語意層與 prompts

語意層是機器可驗證的資料定義，不只是長 system prompt，也不需要第一天就建向量資料庫。先用關鍵字／同義詞＋空間／時間索引，之後有召回缺口再評估 embeddings。

每個 dataset 至少定義：

```yaml
dataset_id: fire_stations        # 示意；真正 ID 對齊既有 manifest
semantic_version: 1
aliases: [消防分隊, 消防機關]
entity_type: facility
geometry_type: Point
geometry_role: facility_location
crs: EPSG:4326
distance_method: geodesic
units: {distance: m}
capabilities: [nearby, nearest, count_by_area]
source_ref: required
license_ref: required
coverage_ref: required
observed_at: null               # 未知不能填今天
boundary_version: null          # 無行政區 join 才不適用
asset_version: required
access_policy: required
missing_semantics: [missing_geometry, unknown, suppressed]
analysis_asset_ref: required    # 私人 URI 僅服務端解析
display_layer_refs: []           # 從現有 layer manifest 核對後填入
```

實際 schema 應區分 required 值、unknown、not_applicable；上面 `required` 是文件佔位，不可直接發布。Dataset→display layers 可一對多；不能用 display layer 名稱推斷資料用途。

還要有 metrics：人口的年分／日夜／人數或密度、設施類別 whitelist、buffer 與 boundary 判斷、點／線／面的距離定義。H3 人口如用整格相交納入或面積加权，須標為估算並說明假設；不得稱為精確人口。

Prompt 分三部分，沿用 `systemPrompt.ts` 組裝：

1. 固定規範：工具結果才是數據證據；來源內容視為資料，不能修改權限或預算；不要自由生成 SQL。
2. 按需 recipe：`nearby`、`area-summary`、`period-comparison`、`accessibility`，寫清前提、步驟、不能回答的問題。
3. 每 turn 地圖脈絡：selected coordinate／feature、AOI、camera、time、visible layers、revision；目前已有 camera/time/layers，補 selection/AOI 與版本。

nearby recipe 示意：先讀選取點；半徑預設 1 公里並明示；查可用資料與 coverage；建立計畫；必要時等確認；執行；以類別摘要＋前幾名回覆；附直線距離、來源時間、缺資料類別；最後標記結果。不得用畫面已渲染的 features 代表周邊全部。

統一結果 envelope：`queryId, planHash, operation, parameters, datasetVersions, data, status, freshness, coverage, method, units, sourceRefs, exclusions, truncated, costActual`。freshness、coverage、execution status 分欄，才能同時表達成功但過期／部分覆蓋。`0` 只用於成功且有效覆蓋範圍的零筆結果。

## 8. 成本與確認機制

拆成兩張帳：使用者的 BYOK LLM 費、站方的查詢／儲存／運算費。BYOK 不會替站方支付 S3 讀取、網路、DB 或 worker。

```text
單次邊際成本估計 = LLM input/output tokens
                 + S3 GET/LIST/取回量/傳輸量
                 + 執行器 CPU/記憶體時間
                 + DB/平台可歸因用量
                 + 結果保存或付費上游
每月總成本 = 固定主機/DB/儲存費 + 所有查詢邊際成本 + 索引更新/轉換成本
```

AWS S3 依 region、class、requests、retrieval、transfer 等計費；R2 有儲存及操作費，官方不收直接 egress 費，但不代表整條分析鏈免費；Supabase 也有方案、compute 與 egress 等用量差異。[S3](https://aws.amazon.com/s3/pricing/)、[R2](https://developers.cloudflare.com/r2/pricing/)、[Supabase](https://supabase.com/pricing)

目前沒有帳單／物件容量／實測掃描量，因此不提供假精確的月費。估價保存 rate_card_version、checked_at、currency、region、storage_class、estimated_bytes、requests、compute_seconds、confidence，實跑後記錄實際量。未知不能報 $0；顯示無法估價並要求縮小範圍或先完成有界 metadata 檢查。

建議試辦限制（討論稿，不代表已同意的付費額度）：單次最多 5 datasets、50 MiB 來源讀取、15 秒執行、100 筆顯示、20 筆送 LLM；每人每日／站方每月另設總額。大檔需先準備分析成品，不要默默突破上限。

| 類型 | 行為 |
|---|---|
| 已同意額度內的小查詢／cache hit | 自動執行，顯示用量即可 |
| 跨較長時間、大範圍、首次轉換或超門檻 | 顯示可核對的計畫再確認 |
| 未知 storage class、估價失效、無權限、硬總額耗盡 | 不執行；給縮小範圍或補資料選項 |

確認卡須顯示：「分析哪些資料、範圍與時間、為何用 S3、預估讀取量與費用區間、最多允許花費、預期結果」。按鈕：執行本次／縮小範圍／取消。LLM 不能自己產生有效 approval。

技術上綁定 user、plan hash、asset versions、金額上限和到期時間，server 驗證並原子保留預算，防並行累加突破。重試使用 idempotency key；取消停止後續 I/O，已發生的費用仍入帳。approval 不替代 ACL。

bytes 上限必須由受控 object reader／worker 實際計量與中止，DB 使用 statement timeout、行數／AOI／分區限制及適當 index；不能只靠 prompt 或 LIMIT。若執行器不能可靠控制 I/O，就先用明確整檔 bytes 的保守上界或拒絕執行。BYOK 帳單以供應商實際費用為準，UI 可估 token、限制步數與輸出，不能宣稱能硬封鎖供應商全帳戶支出。

## 9. 完整預計檔案結構（本功能範圍）

`[E]` 已存在、`[M]` 擬修改既有檔、`[N]` 擬新增。這是目標藍圖，沒有建立下列程式骨架。P1 先做 nearby 所需檔案，P2/P3 再展開 operators/recipes；不是一次產生所有空檔。

```text
GIS/
├─ mini-taiwan-pulse/
│  ├─ src/chat/
│  │  ├─ agent.ts                         [M] 保留 BYOK loop，補分析工具
│  │  ├─ systemPrompt.ts                  [M] 組裝 rules/recipe/selection
│  │  ├─ types.ts                         [M] MapBridge 的 AOI/selection 契約
│  │  ├─ prompts/
│  │  │  └─ analysisRules.ts              [N] UI/LLM 共用結果解釋限制
│  │  └─ tools/
│  │     ├─ registry.ts                   [M] 註冊薄 adapter
│  │     ├─ catalogTools.ts               [M] 保留圖層查詢
│  │     ├─ dataTools.ts                  [M] 逐步轉向共同分析契約
│  │     ├─ datasets.ts                   [M] 後續由 catalog 產生相容清單
│  │     ├─ mapTools.ts                   [E]
│  │     ├─ rpcTools.ts                   [E]
│  │     ├─ analysisTools.ts              [N] search/describe/plan/run/result
│  │     └─ __tests__/analysisTools.test.ts [N]
│  ├─ src/analysis/
│  │  ├─ contracts.generated.ts           [N] 由 analytics schema 產生
│  │  ├─ client.ts                        [N] auth/abort/plan/job API
│  │  └─ resultToMap.ts                   [N] 有界結果 → map features
│  ├─ src/components/analysis/
│  │  ├─ NearbyPanel.tsx                  [N] 無 LLM 也可使用
│  │  ├─ AnalysisResult.tsx               [N] 來源/coverage/結果
│  │  └─ CostConfirmation.tsx             [N] 使用者確認卡
│  ├─ src/hooks/useNearbyAnalysis.ts       [N] 點選/半徑/取消
│  ├─ src/state/analysisStore.ts           [N] plan/job/result UI 狀態
│  ├─ src/App.tsx                         [M] 選點與面板入口
│  └─ docs/features/ai-gis-analysis/
│     ├─ README.md                       [N] 狀態與使用方式
│     └─ handoff.md                      [N] 上游契約、驗收證據
├─ taipei-gis-analytics/
│  ├─ src/manifest_writer.py              [M] 兼容擴充分析 metadata
│  ├─ src/analysis/
│  │  ├─ contracts/
│  │  │  ├─ dataset.schema.json           [N] 語意／storage capability
│  │  │  ├─ request.schema.json           [N] 範圍/方法/限制
│  │  │  ├─ plan.schema.json              [N] 版本/成本/authorization
│  │  │  └─ result.schema.json            [N] 結果與血緣
│  │  ├─ catalog.py                       [N] metadata→可用資產查詢
│  │  ├─ planner.py                       [N] 固定 operation→query plan
│  │  ├─ executor.py                      [N] timeout/取消/用量
│  │  ├─ adapters/
│  │  │  ├─ s3_parquet.py                 [N] 明確 object list／有界讀取
│  │  │  ├─ supabase_rpc.py               [N] typed RPC adapter
│  │  │  └─ snapshot.py                   [N] 既有 R2/小 GeoJSON
│  │  ├─ operators/
│  │  │  ├─ nearby.py                     [N/P1]
│  │  │  ├─ area_summary.py               [N/P2]
│  │  │  ├─ temporal_compare.py           [N/P2]
│  │  │  ├─ intersection.py               [N/P2]
│  │  │  ├─ accessibility.py              [N/P3]
│  │  │  └─ terrain_profile.py            [N/P3]
│  │  └─ cost.py                         [N] rate card＋保守估價
│  ├─ config/analysis/
│  │  ├─ datasets/*.yaml                  [N] 資料定義，引用既有 manifest
│  │  ├─ metrics.yaml                     [N] 指標/單位/分母
│  │  ├─ synonyms.yaml                    [N] 中英文詞彙
│  │  ├─ recipes/*.yaml                   [N] nearby/area/time/accessibility
│  │  └─ budgets.example.yaml             [N] 示意政策，無實際秘密
│  ├─ scripts/analysis/
│  │  ├─ build_asset_index.py             [N] 已有 manifests 增量整合
│  │  ├─ prepare_query_assets.py          [N] 明確來源轉 GeoParquet
│  │  └─ generate_client_contracts.py      [N] frontend/MCP types
│  ├─ tests/analysis/
│  │  ├─ test_nearby.py                   [N] 邊界/CRS/缺 geometry
│  │  ├─ test_catalog.py                  [N] S3-only/重複/不可查
│  │  ├─ test_budget.py                   [N] 估價/取消/硬上限
│  │  └─ fixtures/                       [N] 小型可重現資料
│  └─ docs/handoff/ai-gis-analysis.md      [N] 上游契約 SSOT
├─ gis-platform/
│  ├─ services/analysis-api/              [N] 首版薄 API/可與 worker 同部署
│  │  ├─ app.py                          [N] search/describe/plan/jobs/result
│  │  ├─ auth.py                         [N] 登入 token＋dataset ACL
│  │  ├─ budget_gate.py                   [N] server approval/保留/扣帳
│  │  ├─ jobs.py                         [N] idempotency/取消/狀態
│  │  └─ tests/                          [N] auth/budget/concurrency
│  └─ migrations/
│     ├─ <next>_analysis_jobs_usage.sql    [N] 實作時才配置 migration 編號
│     └─ <next>_analysis_nearby_rpc.sql    [N] 需要 DB backend 才新增
├─ data-collectors/
│  └─ storage/
│     ├─ s3.py                           [M] 沿用寫入/驗證流程
│     └─ analysis_manifest.py            [N] 發布 metadata，不加問答期掃描
└─ mini-pulse-gis-mcp/
   └─ src/tools/
      ├─ mapTools.ts                     [E] 原有 3 個地圖 tools
      ├─ analysisTools.ts                [N/P2] 同一 API 的薄封裝
      └─ index.ts                        [M]
```

實作前依每個 repo 規則確認服務目錄；上列 `services/analysis-api` 為提案，沒有假設目前已有該服務。跨 repo contract 綁版本，不複製獨立維護的 schema。動態結果若成為正式 layer，另走 layer-onboarding 的 manifest、params、loading、opacity／legend／popup／select 驗收。

## 10. 分期與驗收

| 階段 | 可看到的成果 | 完成條件 |
|---|---|---|
| P0 資料與預算契約 | 挑出 3–5 個試辦資料集，列來源/資產/可查狀態/成本 | 至少一個 S3-only dataset；不能只拿 Supabase 假裝完成 S3；費率與未知清楚 |
| P1 點選周邊 | 地圖點一下，不用 key 也能看 1 公里周邊；既有 Chat 能追問同一結果 | 本地 fixture 精確比對；Supabase 和 S3 都有受限查詢 readback；空值/錯誤/範圍邊界/超額/取消通過；桌機與手機 browser 驗收 |
| P2 有證據的問答 | 搜資料、區域摘要、時間比較、MCP 共用 API | 同一 query plan 的 UI/AI/MCP 結果一致；來源可追；樣本不冒充全量；版本不可比明確拒絕 |
| P3 專業 GIS | 路網、人口暴露、DEM 剖面 | 每種方法有基準資料、誤差/限制、執行成本量測；分開上線 |

P1 可以選消防、學校、醫院、公廁等候選，但最終依實際 asset 品質挑選。S3-only 試辦集必須在 P0 驗證，不預先假定哪份一定 queryable。點／半徑相交採地表距離，不能用經緯度度數當公尺；polygon 使用原始 geometry，不能拿 centroid 冒充邊界。

快取 key 至少含 user/access scope、operation、AOI、time、dataset/semantic/method versions；不同授權不共用私人結果。不得為了 cache hit 無聲移動查詢點。production release 另附 API/資產/權限/browser readback，build 或 unit tests 不代替這些證據。

需使用者決定的產品事項：試辦每月站方總額、單次需確認金額、是否維持純 BYOK、私人資料可否送指定 LLM。建議先維持 BYOK，先做低成本點選周邊，保留大查詢的逐次確認；本次研究不要求先拍板才完成規劃。

## 11. 討論補充：以網站作為 Agent 的研究工作台

使用者的新目標超過問答：Agent 要能自己找候選資料、嘗試疊圖、觀察畫面、提出假說、寫 Python 計算、檢查結果，再把可解釋的內容放回網站。本節調整優先順序：先驗證本地研究閉環，再把同一能力產品化。前述 P0 資料契約與成本邊界仍然需要。

### 11.1 找到之前的實作了

本次 Git 歷史核對：`feat/mini-pulse-gis-mcp` 與本地保存的 `origin/feat/mini-pulse-gis-mcp` 指向 `96cbbbb69de22e9283ac156a3e181caefc412813`（2026-08-17）。該版包含 `src/agentBridge/{protocol,browserClient,mapController,config}.ts`、tests 與 App 接線；不是目前 master 的 ancestor。沒有執行 fetch，因此 remote-tracking ref 不當成遠端即時狀態。

目前相鄰 MCP server 使用 stdio＋loopback WebSocket＋共用長 token；沒有一次性配對碼、畫面擷取工具或完整分析結果注入。schema 中的 resultOverlay 只是契約，不能當成 renderer 完成。

先前留下的本地 E2E 成功紀錄屬於那次開發環境，今天未重跑端到端驗證。整合時應在隔離 worktree 挑出必要變更並適配現有 master，保護目前其他 session 的改動。

### 11.2 建議選擇：本地先行，共用核心

白話分工：Claude Code 是研究員、網站是研究桌、Python／GIS 是計算工具、資料目錄是圖書館索引。研究員在哪裡執行，不需要決定資料一定搬去哪裡。

「本地 Agent」通常是本地程式負責編排；模型推論仍可能在供應商雲端，並非離線或沒有費用。它可以遠端做 S3 旁的分析，也可以把有界資料片段帶到本地 Python。先用成熟 Agent 的規劃、寫程式和排錯能力，驗證哪些研究流程真的有用。

「線上」也不等於比較笨。Claude Agent SDK 提供與 Claude Code 共用的 agent loop、tools 和 context management，可於服務端執行；差別是你要承擔隔離、登入、任務恢復、配額與營運。它與單純呼叫模型的 Client SDK 不同。[官方 Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)

MCP 與 API 可包住同一份能力，不是二選一。Claude Code 支援本地 stdio 和遠端 MCP 連接；第一版沿用現有 local bridge，當需要操控正式 HTTPS 網站或跨裝置時再加 session relay。[官方 MCP](https://code.claude.com/docs/en/mcp)

### 11.3 配對碼的實際意思

它代表「允許這個 Agent 操作這個分頁」，不是把網站帳號、所有資料或付費權限交給 Agent。

建議正式站模式：網站和本地 MCP 都向站方服務建立對外 TLS 連線；使用者在登入頁建立一次性短效 code，本地送出 code 後，網站顯示連線申請並確認。伺服器交換成不可猜測的 session-scoped credential，不把短 code 當長期密碼。綁定 account、tab、可操作能力與到期時間，支援撤銷、rate limit、多分頁明確選擇。避免把現有 loopback port 直接暴露上網。

session 配對與資料 ACL、成本 approval 分開判定；不把 service-role key、S3 secret 或網站登入 cookie 放進 MCP 輸出。正式 HTTPS 網頁直連 loopback 另有瀏覽器/CSP/本地網路限制，不能只改 allowlist 就宣稱可用。

命令有 commandId、expectedRevision、ack、actualState；「命令接受」不等於「圖層已載入」。新增 `wait_scene_ready` 回傳載入成功／失敗／逾時，capture 綁定同一 revision。使用者手動改圖後，Agent 應重新觀察，避免覆蓋新的視角。

### 11.4 真正的研究循環

1. **定題**：把「這裡是不是很多」變成區域、時間、設施種類、比較對象與度量。
2. **找資料**：先找 3–5 個相關 dataset，檢查下載／geometry／時間／coverage，不把所有 layer 塞進 prompt。
3. **試畫面**：保留地理背景，每次 1 個主要比較＋少量輔助，等載入後擷取畫面。記錄可見圖層和被隱藏項目。
4. **提假說**：例如「A 區點很多，可能因人口也較多」，標記探索線索。
5. **計算**：在同一年、同一邊界，對 A 與 B 算每平方公里／每萬人，或選適當聚集方法。
6. **反證**：檢查人口、面積、coverage 差異；換合理尺度／比較區看看結論是否穩定。保留試過但不支持的假說。
7. **呈現**：把新指標生成暫存圖層、表格與來源卡，必要時再調鏡頭確認讀得懂。
8. **收束**：回答已支持的發現、無法確認的部分、方法與限制；達到問題或預算上限即可結束，允許「沒有發現」。

視覺只負責發現線索與檢查呈現。點大小、zoom、clustering、抽樣、缺漏、顏色閾值都可能造成假象；正式計數回原始資料。`inspect_view` 的 rendered count 僅是呈現診斷，不是全資料分母。

### 11.5 Python 要給多少自由

前一版只規劃固定 operators，對這次研究目標不夠。建議兩軌：常見的 buffer、spatial join、count、ratio、density、cluster diagnostic 用經驗證工具；新問題允許 Agent 寫 Python，但放在隔離的 analysis workspace／受控 runner，僅載入事先核准且固定版本的資料片段。

探索 runner 不給生產寫入權、任意 credential 或自由下載權，限制 network、CPU、memory、時間與 output bytes；需要新資料再走相同 catalog／成本關卡。保留 script、參數、seed、套件版本、input checksums、排除資料與方法說明。結果只有通過 schema／geometry／單位檢查後才上圖。這不會阻止 Agent 研究，只是讓任意程式與正式資料分開。

若使用者自己啟動的 Claude Code 原本已有 shell／雲端 credential，本網站工具無法約束它繞過 MCP 的行為。硬預算承諾只覆蓋受控 gateway／runner；試辦應給研究工作區有限的資料與權限，不假裝 MCP 可以控制整台電腦。

### 11.6 「聚集」與「密度」怎麼避免亂算

| 問題 | 計算 | 必須知道的前提 |
|---|---|---|
| 點是否聚成幾團 | DBSCAN 等探索性分群 | eps 的距離單位、min_samples、投影與 coverage；分到群不等於統計顯著 |
| 一格高值旁邊是否也是高值 | Moran's I／局部空間關聯 | 同尺度空間單位、鄰接權重、變數定義、檢定與多重比較處理 |
| 是否比別處密集 | count / km² | 比較範圍、面積定義、geometry 的面積計法一致 |
| 對人口是否偏多 | count / population × 10,000 | 年份、日夜人口／居住人口、coverage 與小分母 |
| 人均綠地 | green_area_m² / population | 綠地分類、重疊去重、公共可用性與人口一致 |

DBSCAN 是分群工具；Moran's I 是對空間單位變數與 weights 定義的空間自相關量，含 permutation 選項。實作時固定版本與參數，再選符合問題的比較基準。[DBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html)、[Moran's I](https://pysal.org/esda/v2.9.0/source/generated/esda.Moran.html)

分母 0 或未知回 undefined／unknown，不能補成 0；不要平均各區比率冒充全區比率，應用相容的分子分母加總後計算。反覆試很多圖層／半徑，只挑出一張顯著圖會誤導；記錄試驗清單與事先選擇的主要度量，探索後的發現要另外驗證。空間相近不等於因果。

### 11.7 三種污染，三個對策

- **畫面污染**：太多圖層互相蓋住 → 每次試一個假說，暫存 scene，可還原使用者工作狀態，結果獨立於原始圖層。
- **context 污染**：大量工具與欄位淹沒模型 → 短目錄搜尋，再按需讀 dataset／tool／recipe；先不用全量 embeddings。
- **資料污染**：重複來源、僅部分縣市、假精度座標、時間不齊 → 每一組分析輸入需 quality report。現有 whitelist 是存取限制，不等於所有資料都完成分析 QA；目前不足以宣稱全站已經過濾乾淨。

### 11.8 最小閉環與新增檔案責任

下一個里程碑不是「多加 100 個 tools」，而是完整做一次：「選取一區 → 看三份候選資料 → 查局部原始資料 → 算一個可靠比較 → 把結果即時上圖 → 同一份證據支持結論」。

在第 9 節的目錄結構上補：

```text
mini-taiwan-pulse/src/agentBridge/   # 從 96cbbbb6 整合並適配，先不重寫
  browserClient.ts / mapController.ts / protocol.ts / config.ts
  sceneReadiness.ts                 # 新：命令完成與資料載入分開
  viewInspection.ts                # 新：狀態診斷＋可視範圍
  resultOverlay.ts                 # 新：暫存分析成果與清除／還原
mini-taiwan-pulse/src/components/analysis/
  AgentSessionPanel.tsx             # 新：連線、暫停、撤銷、可見步驟
  EvidencePanel.tsx                 # 新：方法、來源、支持／不支持
mini-pulse-gis-mcp/src/tools/
  viewTools.ts                      # 新：ready/inspect/capture adapter
  analysisTools.ts                  # 新：與網頁共用分析 API
  resultTools.ts                    # 新：有界成果呈現與回讀
taipei-gis-analytics/src/analysis/
  sandbox_runner.py                 # 新：探索性 Python；與固定 operators 並存
  artifact_validator.py             # 新：結果 geometry/schema/units 檢查
  evidence.py                       # 新：假說、輸入、結果與限制紀錄
gis-platform/services/analysis-api/
  session_relay.py                  # 後續：正式站配對與命令轉送
  pairing.py                        # 後續：單次配對與撤銷
```

工具名稱均為提案。新能力還要測試：多分頁不串台、過期 command 不套用、資料未 ready 不分析、畫面 capture 對上 revision、惡意／超大成果拒絕、使用者能暫停、來源失敗不變零、取消後不再派生計費工作。第一版研究成果是 session 暫存物件，不自動新增永久 layer、發布或修改原始資料。

正式產品化時再做 hosted agent、多租戶 runner、checkpoint／reconnect、任務保存。若沒有可重現且有用的本地研究結果，先不投入完整線上 agent 平台。
