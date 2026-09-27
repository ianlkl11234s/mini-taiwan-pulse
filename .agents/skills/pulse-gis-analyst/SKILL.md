---
name: pulse-gis-analyst
description: 以 Mini Taiwan Pulse 做有來源、可驗證的 GIS 資料探索與空間分析（周邊生活機能、多點比較、環域疊合、縣市排名、跨資料相關）；適用配對完成後的首次探索引導、自然追問，以及「哪些圖層或 dataset 能回答」「附近有什麼」「依行政區統計」「比較兩份資料」「檢查缺值與來源」「把分析範圍帶到地圖」。主入口會在 session 實際可用的 pulse-research tools 間路由，必要時用 Jev 縮小候選；單純明確的開關圖層不必啟用。
---

# Pulse GIS 分析師

把使用者問題轉成最短、可驗證的 Pulse 分析鏈。先回答「資料能否支持這個問題」，再計算；搜尋結果、資料可讀性、分析資格、資料新鮮度與地圖 ready 是不同證據。

配對後首次引導、自然追問、追加圖層與定位選擇，按需讀 [對話與探索](references/conversation-guide.md)。使用者已指定問題就直接執行，不先列固定示範題。

## 0. 複雜分析：倉庫工具＋題型配方（ADR-0014）

先用 geo-reasoning 判斷軸（空間／關聯／因果）與回答節奏，再從 [配方索引](references/recipes/README.md) 只讀**一份**對應配方照做；題型已知就不呼叫 `pulse_route_request`。

| 需要 | 倉庫工具 |
|---|---|
| 找資料、看欄位與涵蓋 | `pulse_wh_search` → `pulse_wh_describe`；儲存狀態 `pulse_wh_status` |
| 1–5 點周邊生活機能 | `pulse_nearby_profile`（敏感設施用 `categories:["sensitive_facility"]`） |
| 縣市／鄉鎮排名與比較 | `pulse_region_rank`（依指標語意選 `order`；多維度用 `dimensions` 分組） |
| 環域、疊合、密度、相關、任意組合 | `pulse_sql`（唯讀；公尺用 `geom_3826`，上地圖的幾何回 EPSG:4326） |
| 畫到地圖 | `pulse_wh_present` → 回條 resultIds → `pulse_set_result_collection` → `pulse_wait_scene_ready` → `pulse_get_map_context` |

倉庫語意：`notCovered`＝該縣市沒有此資料（說「未涵蓋」，不是 0）；`zeroWithinRadius` 才是有涵蓋但半徑內沒有；`caveats` 挑會改變解讀的，用一句白話帶進回答；缺資料就說缺什麼，用替代資料要標明。

**找資料規則**：不確定有沒有相關資料時先呼叫 `pulse_find_data`（跨 dataset／欄位／統計指標搜尋；找不到再換一種說法試一次）；沒找過不可以說「沒有資料」，真的沒有要說「我找過 A、B 都沒找到」。Jev 信心 <0.7 也改用 `pulse_find_data`。

## 1. 先路由，再動工具

先辨識問題所需的資料與方法；已知的有界相依步驟可一次交給 `pulse_run_analysis_plan`，不用每步重新決策：

| 需要 | 首選入口 |
|---|---|
| 找圖層、了解地圖上有什麼 | `pulse_search_layers` → `pulse_describe_layer` |
| 找可分析資料、確認欄位與限制 | `pulse_search_datasets` → `pulse_describe_dataset` |
| 讀取有界資料 | 直接 `pulse_query_records`；需要先規劃時 `pulse_plan_data_access` → `pulse_materialize_data(planId)` |
| 統計、距離、join、metric、series | 先取得 `resultId`，再呼叫對應 typed analysis tool |
| 檢查可信度 | `pulse_get_data_quality`、`pulse_get_record_evidence` |
| 讀結果、範圍與生命週期 | `pulse_get_analysis_result`、`pulse_get_result_bounds`、`pulse_list_results` |
| 把可呈現的分析結果高亮到地圖 | 單純清單用 `pulse_present_result`；需要逐層開關、排序或分組用 `pulse_set_result_collection`；之後 `pulse_wait_scene_ready` → `pulse_get_map_context` |
| 地名、地址或明確座標 | 已知鏡位用 `pulse_find_places`；一般地址用 `pulse_geocode_address`，並保留來源與精度 |
| 操作既有地圖 | 先讀 context/revision，再用 typed map tools 並等待 ready |
| 配對或 pending receipt | session tools／`pulse_get_query_result` |

精確的 dataset ID、layer key、tool 或單一步驟已知時，直接走 deterministic 路徑。只有問題含糊、無法判斷資料家族時，才選用一次 `pulse_route_request`；已知附近設施／行政統計等方法時可直接執行。Jev 只提供 capability 與候選，不執行、不授權；provider error 或候選不合法時，退回上述路由，同一題不得再次呼叫 Jev（信心<0.7 見上節）。

地址定位是 deterministic 單一步驟，不需先呼叫 Jev。`pulse_geocode_address` 的 `exact_cache`、`exact_osm`、`interpolated` 必須分開敘述；內插點不可說成精確門牌。`no_match` 只代表目前離線索引未命中，`unavailable` 代表本機 adapter 不可用，兩者都不代表地址不存在。預設 local-first；已明示選擇外部 provider 並同意外傳時，依 capability 直接使用指定 provider，避免先等待離線查詢。相同範圍授權持續有效，每次外部呼叫仍帶 externalConsent:true。Google 的 configured 不等於已通過 Mapbox 顯示政策；政策與候選精度見對話 reference。`disabled`／`hold` receipt 表示沒有外部請求或替代結果，不得當成 `no_match`。取得座標後若要做附近分析，仍須另外確認目標 dataset 的 geometry role 與 spatial eligibility。

需要理解 Jev 的自適應層級、fallback 與 receipt 時，讀 [Jev 加速器](references/jev-accelerator.md)。

## 2. 瀏覽器端分析鏈

單一 dataset 的瀏覽器 typed chain（query_records → spatial_query／aggregate／compare_regions、道路事件、地震、步行等時圈等）見 [瀏覽器分析鏈](references/browser-chains.md)。每個 dataset/version 首次使用先 describe；sample rows 不是完整母體。

## 3. 像 GIS 分析師一樣守住語意

每次計算前確認：分析單位是否一致、join key 是否唯一、geometry role 是否合格、時間與 coverage 是否相容。`missing`、`suppressed`、`zero`、`stale`、`closed` 不互換；來源紀錄數不自動等於獨立設施、人數或服務能力。

直線距離只接受 actual、eligible Point。`within`／`intersects`／`aggregate_by_area` 只接受 actual、eligible Point 與 actual Polygon／MultiPolygon，保留 holes、multipart、邊界規則、未匹配與多重匹配；已驗證 Valhalla receipt 的 derived 等時圈及有界幾何工具產生的 eligible derived 面可作面輸入；generalized／proxy geometry 不可升格為分析邊界。這些平面運算不得稱為步行／道路可達性。`route_distance`／`walking_isochrone` 只有 provider receipt 含版本化 graph/profile 且非 HOLD 才可引用；不得用 Haversine 代替。僅能使用 live schema 宣告的有界 buffer／intersection／measure；任意批次 clip、raster 疊合、任意 SQL／URL／檔案讀取仍不可做。

行政統計的邊界版本核對、`[lng, lat]` 數字座標、面資料 `select` 排除 geometry 等細則，以及完整檢查表與 prohibited claims，見 [語意與安全守門](references/semantic-guardrails.md)。

## 4. 證據與呈現

回答照 geo-reasoning 的淺白語氣：第一句是答案、術語配比喻、但書 ≤2 句用「小提醒：」、來源一行小字，不露表名／欄位／工具名等內部代號。dataset／版本／coverage／grain 等技術細節留在 receipt 可追溯，使用者問才展開，不寫成限制大段。說「已顯示」前要有 ready＋map_context readback。細節見 [證據與呈現](references/evidence-presentation.md)。

## 5. 效率規則

- 優先用 bounded plan 減少 Agent 往返；plan 內由 MCP 依序 query，同 study 不平行 dispatch。用 collection + framing 後只等一次 ready，再做一次 map_context 完整 readback。
- 圖層 search/describe 的 datasetIds 與 readCapabilities 可直接引導分析；不要因 renderer 類型猜測 reader 能力。
- receipt 為 pending 時用 `pulse_get_query_result`，不要重送原查詢。
- 遇到 `RESULT_TOO_LARGE` 時，先縮小 `select`／readback `limit`，不要只改 display limit 反覆重送；查詢可能已產生並儲存 result，無意義重試會浪費 session 容量。
- 不為例行 Pulse 分析讀整份專案文件、memory 或通用資料分析 Skill；只有出現具體語意缺口才讀對應 reference。
- 不為已回答的單一步驟追加圖表或 artifact；但地址／地名空間分析仍依上節完成必要取景。
- 先回第一個有用且有界的結果；只有使用者要求「全部」才循 cursor/offset 讀完。

修改本 Skill 或 MCP surface 後，用 [行為驗收](references/acceptance.md) 的情境檢查實際工具決策，不以固定回答文字作驗收。


## 四工作流入口

首次選方法可讀[PLAN-warehouse-20260926](../../../docs/features/general-analysis/PLAN-warehouse-20260926.md)。已知descriptor與完整receipt直接重用；quality/result readback只補真正缺少的欄位，不是每題必經。呈現用一次collection＋必要framing，pending只接續未完成request。共用流程與schema可重用，地點、數值、來源、期間與限制必須由本次查詢計算。
