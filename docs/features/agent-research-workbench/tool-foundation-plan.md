# 跨圖層、新聞與消息的通用 Tools 規劃

> 理想 GIS 分析的能力缺口、里程碑、可解問題與持續監看總表，見 [gis-analysis-roadmap.md](./gis-analysis-roadmap.md)；淺白互動說明見 [gis-analysis-roadmap-guide.html](./gis-analysis-roadmap-guide.html)，工程版流程見 [gis-analysis-roadmap-interactive.html](./gis-analysis-roadmap-interactive.html)。

日期：2026-09-11。2026-09-13 更新：**最小runtime foundation與三類pilot readback完成**。P1與有真實pilot可驗收的P2基本操作已完成；S3 manifest/disk cache及尚無真實adapter的進階operation維持明確待辦，未完成項不得宣稱可用。

本輪分析 baseline：Pulse worktree `b1a811586c4411991456314a905226febe5f5818`。盤點登記、接線與 adapter，不宣稱所有遠端資料可取得、授權已確認或正式站健康；未掃 S3、未執行 Supabase 查詢、未下載圖層資料。完整逐層清單見 [inventory](inventory/)，另保留舊 chat 與 research MCP 的能力界線。

## 已確認的協作方向（2026-09-11）

本節為使用者確認的架構方向，後續協作以此為基準；下方狀態欄記錄已完成與仍待實作的項目，沒有真實adapter或驗收證據者仍只算提案。若與先前以圖層開關為中心的說明不同，以本節為準。

**核心：datasetId → analysis → resultId；layer 是可選的顯示出口。**

```text
S3／Supabase／Twinkle Hub／其他來源
                  ↓
共用資料入口：來源、版本、欄位、geometry、權限、快取
                  ↓
      ┌───────────┴───────────┐
      ↓                       ↓
  既有圖層展示       選研究範圍／時間／條件 → 分析與計算
                              ↓
                    結果資料：點／線／面／表格／指標
                              ↓
                     同一張 Mini Taiwan Pulse 地圖
                     按需要再開啟其他背景圖層
```

### 已決定

- 分析不依賴先開圖層，也不限於現有layer catalog；可使用沒有地圖呈現、沒有座標或外部來源的資料。
- 優先使用保留血緣、經基本整理的分析資料；保留原始來源以利追溯，不每次重下載／重清理，也不把顯示用簡化或聚合資料當完整原始觀測。
- 研究可只取必要空間範圍、期間與欄位；處理後的結果獨立呈現，不必開啟整個來源圖層。
- 工作台是研究狀態與結果的容器，最終整合於Mini Taiwan Pulse同一地圖。當前優先工作為tools與資料底層，暫不擴充控制台表單或聊天UI。
- 每次研究應能保留問題、輸入版本、條件、方法／程式、結果及限制，供重算與比較。這是後續目標，不代表持久化已完成。
- Twinkle Hub列為可接入來源；其實際介面、資料識別碼、時間／位置、授權與成本待確認，不宣稱已接通。
- 原配對、revision、圖層控制、附近查詢繼續沿用；layerKey工具可保留為相容入口，底層能力逐步轉向dataset/result references。

### 分工

|元件|責任|
|---|---|
|MCP tools／executor|有界取得、篩選、計算、結果驗證與呈現；落實權限與成本上限|
|Skill／recipe|問題釐清、方法選擇、分析順序、語意檢查、驗收與解釋；不承擔安全強制執行|
|本地Agent|理解問題、組合tools、必要時寫Python、查外部證據與形成結論|
|工作台|顯示研究範圍、結果、來源與狀態，供檢查、調整與比較|

### 下次實作的最小切片

1. ✅ 定義DatasetDescriptor與ResultEnvelope，先確認grain、geometry role、時間、source/version、access及budget。
2. ✅ 做共用query executor與第一個點資料adapter；analysis入口不要求來源layer已開啟。
3. ✅ raw新聞／消息及exact-release統計adapter、time window、evidence與null/suppression契約完成；2026-09-13 已由配對環境取得真實RPC／固定release receipt。新聞當日合法0筆只證明該selector，不代表沒有其他日期事件。
4. ✅ result reference、基本analysis operations與最多4組actual Point呈現；學校沿用既有學制分色，舊nearby範圍仍只畫虛線圈。
5. 🟡 短效access plan、query/source-version cache receipt與一次性materialize已完成；S3 manifest/disk cache與進階GIS operations依真實資料需求後續註冊。

驗收以真實問題帶動：未開來源layer也可完成有界查詢；無geometry消息仍能列出；相同輸入與方法可重現；多組結果可比較；超成本／未授權／缺資料明確回報。附近不等於受影響，相關不等於因果。

## 0. 盤點數量與快照

- Research worktree：476個唯一key（452顯式＋24recipe），466有catalog引用、10未分組/orphan。
- 原工作目錄包含未提交變更：496個key，另增日本旅宿／保護／遺產18層與工商分析2層；未整合進research branch。
- 接線類別（research）：GeoJSON 129、PMTiles 90、dynamic 52、custom 205。不是geometry分類或遠端可用率。
- 消息相關loader另有28個唯一RPC名稱（29處呼叫）；它們不是28個已提供給MCP的工具。
- 完整逐層清單：[476層](inventory/layers.md)、[原工作檔20層差異](inventory/layer-original-diff.md)。

## 1. 結論與工具邊界

通用的單位應是 dataset／record／event／geometry／result，而不是畫面 layer。多個圖層可引用同一資料集；一個事件可有多個地點；一篇新聞不是一個獨立災害；一個圖上群聚點也不是一筆原始事件。

沿用 18 個 research MCP tools 的連線、revision、查詢 receipt 與地圖控制。擴充既有 search/describe/read/nearby，避免為學校、醫院、污染各造一套方法。原有 browser chat tools 尚未等同於 research MCP，應將可用邏輯抽成共用 executor 後再接線，不能只增加 tool 名稱。

工具是穩定、有界、可驗證的能力；多步調查是 recipe；特殊模型由本地 Agent 使用 Python 完成。先不提供正式站任意 SQL、任意 Python、任意 URL fetch 或無界 bucket listing。

## 2. 資料族群與共用操作

|資料族群|代表內容|最小共用操作|必保留語意|
|---|---|---|---|
|設施／POI 點|學校、醫療、公共服務、能源或污染設施|read、filter、nearest、within_distance、group_by|校區與機構不同；污染設施不等於污染觀測或排放量|
|線與網路|河流、道路、鐵路、電纜、航線|intersects、distance、clip；有拓撲才 routing|示意線不等於可通行網路；河流流向不能靠畫面猜|
|面與行政區|水庫、保護區、災害範圍、統計邊界|within、intersects、spatial_join、area|真實邊界 vs 代表點；邊界版本、投影、重疊計數|
|行政統計／格網|人口、農業、區域統計|exact selector、aggregate、join、ratio、rank|統計期、分母、suppression、完整度；禁止把全鄉人口當圈內人口|
|感測觀測／時間序列|AQI、雨量、水位、電力等|time range、latest、resample、baseline comparison|站點 vs 觀測、單位、時區、缺測、採樣頻率|
|移動軌跡|航班、船舶、列車、衛星|entity history、time slice、dwell、crossing|插值／預測 vs 真實觀測，軌跡缺口|
|新聞／事件／消息|國內新聞、全球發布事件、AI 候選|text filter、time window、event identity、source links、spatial eligibility|報導量 vs 事件量，發布 vs 發生 vs available_at，精度與撤回|
|警報／通知|地震、天氣、淹水、交通、維生、安全|active_at、history、affected-area join|生效／到期／取消；active endpoint 不代表完整歷史|
|監測指標／面板|壓力、升溫、來源健康、食品價格、市場等|read_series、compare_baseline、quality|衍生分數的權重與基期，不混成觀測實測值|
|raster／DEM／影像／3D|地形、影像、視覺化結果|sample、zonal_stats；後續 profile/slope|解析度、NoData、垂直基準；shader 顏色不是測量值|

同一 dataset 可以屬於多類；分類不是強制互斥。renderer 類型也不能作為 geometry 或分析能力的證明。

## 3. 新聞、消息與監測：實際盤點

### 國內新聞

證據：`src/data/newsEventsLoader.ts`、`newsEventTypes.ts`、`src/components/intel/IntelPanel.tsx`。

- `get_news_event_dates` 與 `get_news_events_day_clustered_v2` 按日及 relevance/eventsOnly/severity 讀取；未設定 Supabase 時地圖入口另有靜態 fallback。
- 一個 Feature 是鄉鎮 cluster，原始 `events[]` 含 id、title、summary、category、source、url、published_ts、confidence、gis_relevance、severity、is_event。
- 預設過濾為 relevance=3、eventsOnly=true、severity=1。因此「目前畫面新聞」不是所有新聞。
- 類別：事故、治安、災害、交通、健康、政策、其他。沒有證據顯示已有全文語意向量檢索，不能將 summary 當完整文章。
- 新 tools 應從 raw events 與明確 cluster grain 讀取，不能把 cluster 最新新聞欄位複製給整批事件，不能直接對鄉鎮代表座標做精確 500 m 事件計數。
- 現有 display conversion 把部分 null confidence/severity 轉成 0（約105、114行）；分析 adapter 需保留 raw null。這是接線風險，並非本輪已修復。

### 全球消息／事件

證據：`src/data/globalEventsLoader.ts`、`globalSituationFeedLoader.ts`。

- 發布事件：`get_global_event_places_current`、`get_global_event_places_window`；候選：`get_global_event_candidates_window`。
- 已有 eventId/versionId/eventPlaceId、published/archived/superseded/retracted、event_point/city_center/country_center、isProxy、precision、locationLineage、sourceUrls、AI assessment、availableAt 等語意。
- 未定位消息仍可出現在 feed；不能因沒有 geometry 而在文字查詢消失。地圖只呈現合格 geometry 子集，應回報 omittedFromMap 數與原因。
- feed 會按 eventId 去重、優先有座標並排除 mapSuppressed；這是顯示選擇，不是完整 source observations。
- 今天是滾動24h，歷史日期是台灣日界；工具需明示時間欄位與 asOf，避免歷史查詢洩漏未來才取得的版本。

### 警報與消息面板外資料

證據：`src/data/alertsLoader.ts`、`disasterAlertLoader.ts`、`intelLoaders.ts`。

|資料入口|底層讀取證據|適合的通用能力|
|---|---|---|
|警報摘要／清單／序列|get_alert_summary、get_active_alerts、get_alert_series_24h|query_records(kind=alert)、active_at、read_series|
|新聞來源健康|get_source_health|get_data_quality，檢查lag/last_success，而非推定零事件|
|新聞升溫|get_news_trending|compare_baseline，保留cnt/baseline_avg/surge_ratio|
|壓力與訊號|get_pressure_index_now、get_signals_timeline|read_series，保留權重與指標定義|
|市場|get_market_index_now、get_market_index_daily|read_series、baseline|
|共機活動／情勢|get_pla_activity_latest/range、get_pla_severity_daily、get_pla_situation_summary、get_pla_kind_summary|有界時間查詢、group_by|
|影片消息|get_yt_live_videos|查metadata/來源連結，不代表有影片內容辨識或逐字稿|
|公衛週資料|get_public_health_weekly|週粒度資料讀取，不可冒充即時|
|食品價格|get_food_price_daily、get_food_price_summary|read_series，保留low_coverage|
|船舶區域統計|get_vessel_zone_daily|區域時間彙總，非逐船位置|
|台鐵延誤|get_tra_delay_summary、get_tra_delay_trains|read_series與紀錄篩選|

多個 loader 為顯示便利將非陣列收斂成空陣列。新分析入口必須區分 INVALID_RESPONSE／EMPTY／DENIED／ERROR，不可直接把展示 fallback 當分析成功。

## 4. 建議工具表面：少量 families，嚴格 operation schema

以下新增名稱為提案，省略 pulse_ 前綴。不要將本表解讀成已註冊工具；每個 operation 有獨立 discriminated schema，不是一個自由文字「幫我分析」黑盒。

|Family／tools|主要輸入 → 輸出|階段|狀態（2026-09-12）|
|---|---|---|---|
|search_datasets / describe_dataset|query/kind/capability → datasetId、layerRefs、fields、grain、geometry、time、source、access、supportedOperations|P1；現有 search_layers/describe_layer 沿用alias|✅ 已註冊；4個pilot dataset|
|query_records|datasetId、select、typed filters、time field/window、spatial constraint、cursor → resultRef、page、total/exclusions/truncation|P1；read_layer兼容入口|✅ typed filter、time window、offset page、完整session resultId；空間條件由後續spatial_query組合|
|spatial_query|dataset/result refs、nearest/within_distance/intersects/within、distance model → matching rows + distances/relationships|P1點；P2線面；nearby為alias|✅ actual Point的nearest/within_distance；⏳線面predicate待真實adapter|
|aggregate_records|inputRef、groupBy、count/distinct/sum/mean/min/max、明確grain → tableRef|P1基本；P2跨資料|✅ null-safe基本彙總；無有效數值的sum為null|
|join_records|left/right refs、key或spatial predicate、cardinality policy → resultRef+unmatched/duplicated counts|P2|✅ key join、one-to-one/one-to-many與null key排除；⏳spatial join|
|calculate_metric|inputRef、allowlisted arithmetic expression、unit、denominator/coverage policy → metric/tableRef|P2；禁止eval/任意code|✅ ratio/difference；缺值保留、零分母拒絕|
|read_series / compare_series|dataset/entity、time interval、resolution、baseline、aggregation → seriesRef + missing windows|P2|✅ stored result的UTC日／週count/sum/mean與baseline比較；缺period／baseline=0明示|
|get_data_quality|dataset/resultRef → freshness、coverage、geometry eligibility、source lag、known limits|P1；unknown保留|✅ result品質、null、exclusions、source receipt；未宣稱不存在的source lag|
|get_record_evidence|record/eventRef、version/asOf → source observations/URLs、dedup/group關係、撤回狀態|P1新聞；不憑空產生「佐證」|✅ 回傳stored record與其source receipt；未另抓外部佐證|
|plan_data_access / materialize_data|dataset+query+budget → plan/hash/bytes/cache；approved plan → bounded local artifact receipt|P2；S3索引與cache先行|🟡 短效plan、硬限制、未知cost與一次性materialize已完成；S3 partition index／disk artifact待有manifest後接|
|present_result / list_results / remove_result|scoped resultRef+style/visibility+revision → map receipt|P1多圈；P2任意合法衍生geometry/table|✅ session scope、TTL/capacity、最多4組actual Point transient layers與revision receipt；非空間表保留為table result|
|fit_bounds|bounds/resultRefs、padding → camera receipt|P1；沿用既有camera executor|✅ get_result_bounds＋revision-controlled fit_bounds|
|inspect_map / capture_map|viewport/layerRefs → visible feature sample／受控截圖artifact、相機與載入狀態|P2；視覺驗收用，不作全量統計|🟡 map_context已有camera/layers/loading；capture沿用本地Agent瀏覽器，未另開MCP截圖傳輸|
|run_analysis / get_analysis_result / cancel_analysis|allowlisted registered operation+input refs+budget → jobRef/status/artifacts|P2長任務；P3專業分析|🟡 get_analysis_result已完成；尚無需背景執行的registered long operation，因此不建立假job/cancel|

未來專業 operations：cluster（DBSCAN等與單位）、spatial_autocorrelation（明確鄰接／空間權重）、raster_sample/zonal_statistics、terrain_profile/slope、network_reachability、track_dwell/crossing。按真實資料與驗收需求逐步註冊，初期不需要為每種演算法增加一個獨立 MCP 名稱。

新聞文字搜尋先採可證明的關鍵字與結構欄位查詢。語意搜尋是後續獨立能力，需先有索引、embedding版本、召回驗收與成本方案；不能僅在 tool 名稱上宣稱 semantic。

## 5. 必備的資料與結果契約

DatasetDescriptor：datasetId、layerRefs[]、kind、recordGrain、primaryKey、fields(type/unit/nullMeaning/enum)、geometry(type/crs/precision/role)、timeFields(role/timezone)、coverage、license、versions、accessPolicy、supportedOperations、adapterId。

角色必須可區分：observation/event/article/entity/place/admin_statistic/cluster；geometry role=actual/proxy/centroid/generalized/none。能力來自已驗證 adapter，不從 layer label 自動推斷。

ResultEnvelope：resultId、queryHash、input versions/receipt refs、executionStatus、coverage、freshness、sourceRefs、method/parameters、units、countGrain、excludedByReason、displayTruncated、analysisComplete、cost(bytes scanned/downloaded/requests/cacheHit)、expiresAt。large rows 留 artifact；tool 回摘要+page/ref。

新聞額外保留 occurredAt/publishedAt/observedAt/availableAt、event identity、source observation identity、location eligibility、lifecycle與AI assessment。publishedAt 不能默認當發生時間；來源數不等於獨立佐證數。

視覺檢查可沿用本地Agent browser能力；若加capture_map，截圖需scoped且不夾帶憑證。rendered features可能經cluster、tile裁切與zoom簡化，僅能判讀畫面，不可作總量分析。

地圖呈現與資料查詢分開。範圍圈不會過濾原始 layer；要只顯示符合紀錄，需明確 result layer，保留類別分色與原始欄位。網頁不要接受任意外部URL或本地絕對路徑作為 resultRef。

## 6. 執行與資安

- Browser 負責畫面狀態、互動及小型已允許資料；local Agent 負責本地計算；gateway 負責權限、配對、預算與指令；analytics 放canonical分析契約與方法。
- S3是資產保存層，先查manifest/index，讀必要partition/Range。回傳50筆不等於只掃50筆。
- planDataAccess明列estimatedScanBytes、downloadBytes、requests、cache reuse、costKnown、requiresApproval及硬上限；未知費率不能聲稱免費。超範圍重新計畫與確認。
- cache以source version/checksum+query+method version為鍵；receipt記錄取得時間與來源時間；TTL與stale狀態分開；logout/revocation不得重新授權私有快取。
- 身份與權限同時綁dataset、result、study/session；所有local path規範化並拒symlink escape；敏感憑證只留受控端，禁止從tool回傳。
- 新聞、metadata、網頁文字都是不可信資料，不當指令執行；引用URL不得觸發內網／file讀取。來源取回需allowlist與重新導向檢查。
- filter欄位/operator allowlist、AST深度、rows/bytes/time上限；取消必須停止下游讀取，不僅停止輪詢。
- 不把城市代理點混進近距離GIS計算；不把無資料、被拒絕、無geometry或過期資料變成0。

## 7. 可組合 recipes 與驗收

|問題|組合|通過條件|
|---|---|---|
|兩地附近有什麼學校／醫療？|discover→query→spatial→aggregate→present|至少兩個不同dataset共用executor；source/hash/距離一致；兩圈獨立|
|這區最近發生哪些事？|discover(kind=event)→query time/text→evidence→spatial eligibility→present|保留無定位消息清單；cluster不當事件；代理點拒絕精確半徑計數|
|污染是否比別處多？|query(污染定義與期間)→aggregate→metric→compare|排放量/站點觀測/設施數分開；時期與分母一致；unknown不為零|
|可能影響哪些學校／水庫？|explicit affected-area→spatial join→evidence→present|附近只稱可能接近；空污需風場等模型、水污需流域/流向，單純buffer不能稱影響範圍|
|新聞升溫是真的嗎？|read_series→get_data_quality→compare→evidence|來源停機/增加、重複報導、基期為零、候選與發布版本皆有處理|
|本地已有資料還要下載嗎？|plan→cache receipt→materialize if needed|hash版本命中不重下載；過期/私有撤權/成本超限明確可驗收|

Recipe（domain prompt）解釋問題釐清、合適方法、停止條件、輸出限制；不把因果判斷硬編進通用工具。LLM外部查證可沿用Agent的browser/search能力，結果以證據refs納入。

## 8. 建議檔案結構（未建立實作骨架）

```text
mini-taiwan-pulse/src/research/
  discovery.ts              # 保留，對接dataset descriptors
  nearbyData.ts             # 逐步改用共用query adapter
  bridgeClient.ts           # 保留typed transport
  MainMapConnection.tsx     # 保留map adapter
  adapters/                 # browser可用的薄入口，不搬資料引擎到App
mini-pulse-gis-mcp/src/research/
  server.ts                 # 薄tool registration，保留現有alias
  relayClient.ts            # 保留
  workspace.ts              # 擴充有版本receipt/cache，非任意磁碟存取
  tools/                    # 依family分組，隨實作才拆
 gis-platform/services/research-gateway/
  pairing-service.mjs       # 保留
  relay-service.mjs         # 保留revision/receipt
  datasets/                 # dataset/asset能力與access映射
  query/                    # plan、adapter routing、budget
 taipei-gis-analytics/src/analysis/
  contracts/                # canonical schema/validation，保留
  operations/               # 空間、表格、時序、raster；有需要才建
  recipes/                  # 方法規範與可重現examples
```

不要另建一份手寫layer registry；由既有manifest/catalog產生layerRefs，僅補它沒有的analysis metadata。先做一個GeoJSON點adapter＋一個raw新聞adapter＋一個統計adapter驗收，即可及早暴露通用化漏洞。

## 9. 兩個外部專案的對照

詳細固定SHA證據：[外部工具盤點](inventory/external-tools-review.md)。本輪重新查看GitHub首頁，實作分析採已保留的固定checkout，不聲稱固定快照是最新版本。

|參考|實際能力|Pulse採用方式|
|---|---|---|
|WorldMonitor registry / describe_tool|schema、source freshness、摘要、projection、工具分類|按能力探索與有界回傳；不要一次把所有圖層資料送進context|
|get_news_intelligence / search_intel_history|新聞結構查詢與已建索引的歷史語意搜尋|前者映射query_records+evidence；後者先補索引才可提供|
|get_signal_convergence|1-degree grid與24h跨訊號共現|借操作分層；台灣近距離需自訂適當尺度、時間對齊與基期|
|get_population_exposure|粗粒度人口近似|不採用其country centroid近似計算500m人口；使用可驗證格網/面積權重或明確拒絕|
|simulate_infrastructure_cascade|seeded網路上的情境傳播|後期registered scenario operation，必標模型假設與非觀測|
|analyze_situation|LLM敘事研判|放recipe與Agent，不當GIS計算真值|
|monolith-terrain loadDem/sampleDem|Terrarium解碼、局部DEM與bilinear sampling|後期raster/terrain adapter參考；不是現成MCP或GIS分析引擎|

來源：[WorldMonitor analysis registry](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/registry/analysis-tools.ts)、[MCP registry](https://github.com/koala73/worldmonitor/blob/df2ac7daf76cd4f287e5b505509abdcb672e40aa/api/mcp/registry/index.ts)、[monolith DEM](https://github.com/kaolti/monolith-terrain/blob/f95b3bb47c826e88ac0330548278e1ba124ec276/src/dem.js)。WorldMonitor AGPL-3.0、monolith MIT，設計借鑑不等於直接搬移程式；各資料來源授權另計。

## 10. 現有37個research MCP tools對照

- 連線：pulse_pair_session、pulse_get_session、pulse_disconnect_session、pulse_get_study_state。
- 探索／讀取：pulse_search_layers、pulse_describe_layer、pulse_read_layer、pulse_get_map_context、pulse_find_places、pulse_query_nearby、pulse_get_query_result。
- Dataset tools：pulse_search_datasets、pulse_describe_dataset、pulse_query_records、pulse_plan_data_access、pulse_materialize_data。
- Result/analysis：pulse_spatial_query、pulse_aggregate_records、pulse_join_records、pulse_calculate_metric、pulse_read_series、pulse_compare_series、pulse_get_data_quality、pulse_get_record_evidence、pulse_get_analysis_result、pulse_get_result_bounds、pulse_list_results、pulse_remove_result。
- 地圖：pulse_apply_scene、pulse_set_layers、pulse_set_camera、pulse_present_nearby、pulse_present_result、pulse_fit_bounds、pulse_wait_scene_ready。
- 本地：pulse_validate_result、pulse_inspect_local_assets。

程式：mini-pulse-gis-mcp/src/research/server.ts。共用 executor 已有 schools、medical hospitals、raw news events、exact-release paddy statistics 四個 pilot adapter；舊 read_layer／nearby仍僅schools。medical hospitals在本worktree缺S3管理資產，adapter存在不等於本地可讀。find_places只是具名鏡位；present_nearby是舊單圈入口，present_result可獨立呈現最多4組actual Point result；validate_result仍是synthetic-only，沒有任意結果上傳；本地資產工具不是完整disk cache。

既有browser chat另有22個dataset與10個RPC白名單，見[adapter盤點](inventory/data-adapter-families.md)。這些是可重用的既有入口，不是18個research tools已取得的能力。

## 11. 檢查與本輪交付界線

2026-09-13 最小runtime foundation已完成並留在本地commit，未push／未上線。canonical schema、共用executor、四個pilot adapter、result session、P1/P2基本分析、data access plan與result presentation已接通。目前Codex task以本地Agent配對完成discovery／query／nearby／presentation；另以source build的MCP SDK host驗證完整37項tool schema及 datasetId→resultId→analysis resultId→地圖呈現與fit bounds。Browser回報ready revision 2，並讀回1組／9筆點位的可存取摘要；SDK host驗收不冒充另一個自然語言Codex task。

三類真實pilot證據：學校資產4,315筆，以臺北車站座標1公里直線半徑得到9筆並依學制聚合為3／2／1／3；2026-09-12新聞selector合法回傳0筆且有RPC checksum，proxy geometry被拒絕做精確空間分析；水田統計固定release為368／368鄉鎮、STALE、總和158,701.13公頃。這些是本地配對readback，不是production健康或資料最新性證明；學校／新聞license仍為unknown，行政統計的observed 0與null狀態保持分離。

實作優先順序：
1. ✅ DatasetDescriptor與capability discovery，不再將「圖層存在」等同「可查詢」。
2. ✅ typed query_records＋GeoJSON點adapter，重用既有schools入口。
3. ✅ raw新聞／消息adapter、時間／grain／precision驗收，無geometry仍可查。
4. ✅ exact-release統計adapter、aggregate、key join、metric與null/suppression負向測試。
5. ✅ 多組result、list/page/remove、result bounds、fit_bounds及revision-controlled呈現；只接受session內actual Point result。
6. 🟡 版本／query hash cache receipt與access plan已完成；S3 partition index與disk materialization須等實際manifest契約。長任務、raster、network、cluster與spatial join維持後續registered operation，不以空殼tool冒充完成。

本地驗收：`public/education/schools.geojson`實讀2,504,719 bytes、SHA-256 `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`，4,315/4,315為合法Point，code與school_level皆無缺值。這只證明該工作樹資產，不替代新聞RPC、統計R2或production readback。

測試recipe以合成資料驗證邊界，再用授權真實樣本驗收；不能只驗工具回應成功。新聞記事數與事件數、發布與發生時間、proxy座標、suppression與零、重複join、cache過期與撤權都需負向案例。
