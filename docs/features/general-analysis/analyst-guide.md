# 通用分析工作流手冊

本手冊使用目前 paired Pulse research MCP 的既有工具與同一個 browser session 結果。資料家族不明時搜尋，首次使用或來源版本改變時用 `pulse_describe_dataset` 確認資料粒度、geometry eligibility、來源、license、期間、單位、coverage 與必要參數；不要從圖層是否可見推論資料可算。

## 共同規則

靜態Point的 `record_id` 是固定來源SHA＋列序的衍生識別，不是官方機構代碼；需要跨版本join時另驗證來源業務鍵。

- `resultId` 是本 session 的可重用資料結果；先讀取一次，後續空間篩選、彙整、比較與呈現都引用它。過期、撤銷或 locked 後重新查，不猜測或沿用舊值。
- 有 `pending` receipt 時用回傳的 `requestId` 以 `pulse_get_query_result` 繼續讀取。不要重送同一讀取、重播已完成步驟或平行送多筆相依 query。
- `query_records` 的 `limit` 是顯示頁大小；回傳 `totalMatched`、`returned`、`displayTruncated`、`analysisComplete`、`excludedByReason` 與 source receipt。回答分母時說明是查詢 filters/bbox/time 內、有合格 geometry 的 records，並保留被排除數。
- `null`、`missing`、`suppressed`、`not_reported`、`unknown`、`STALE`、來源失敗與 observed `0` 各自保留。零筆結果只代表本次資料、條件與方法沒有選到，不能證明現實不存在。
- 分析完把要看的結果一次以 `pulse_set_result_collection` 設定順序、group 和 visibility（最多 8 個）；需要取景先取得結果 bounds，再在同次 collection 傳 `framing`，避免另外重複 fit。接著 `pulse_wait_scene_ready`，再以 `pulse_get_map_context`／`pulse_get_study_state` 確認 revision、ready 與 `resultPresentation`。accepted/applied、camera bounds 或 feature count 都不是可見結果的證明；使用者已手動移圖或要求保留視角時不強制 framing。

## 1. 附近資料

適用問題：某中心附近有哪些合格 Point records；這是直線距離查詢，不是步行可達。

1. 以 `pulse_geocode_address` 或 `pulse_get_map_context` 取得中心；地址結果要保留 exact/interpolated/no-match 狀態。
2. `pulse_query_records` 指定 `datasetId`、`select`、必要 filters/time 與有界 `bbox`、`limit`，取得 `resultId`。先以 `pulse_describe_dataset` 確認 Point 是 `actual` 且 eligible。
3. `pulse_spatial_query` 用 `predicate:"within_distance"`、`resultId`、`center:[lng,lat]`、`radiusM`。結果的 `distanceM` 是 WGS84 地表直線距離。
4. 先使用已有receipt的總數、exclusions與來源時間；只有缺特定品質證據才補 `pulse_get_data_quality`。需要按類別計數才用 `pulse_aggregate_records`。

不要把行政區整體統計分攤到半徑內，也不要把不同來源的 place records 直接當成容量、機構數或服務品質。

## 2. 區域比較

適用問題：同一可比較統計指標在明確行政區、期間與版本下的差異。

1. `pulse_describe_dataset` 確認 indicator、unit、area level、boundary version、period 和 required selector，例如 `releaseId`。
2. `pulse_query_records` 以相同 release、filters 與 area codes 取得分子 `resultId`；若要標準化，另取得同期、同 boundary 的分母 `resultId`。
3. `pulse_compare_regions` 使用 `resultId`、`areaCodes`、`baselineAreaCode`，只有分母契約一致時才帶 `denominatorResultId` 和 `per`。
4. 回報 raw value、unit、期間、boundary、缺值／抑制與比較狀態；不把 `generalized` 行政統計 Polygon 當成可供精確點面分析的實際邊界。

## 3. 疊圖與環域

適用問題：合格 Point 對實際或已驗證 derived Polygon 的空間關係，或 Line 的有界 buffer／面交集。

1. 分別 `pulse_query_records` 取得每個 input，檢查 Point/Line/Polygon 的 role、precision、CRS、來源與時間。proxy、generalized、ineligible geometry 停在 HOLD。
2. 需要顯示用直線圈時用 `pulse_create_analysis_scope(center, radiusM, label)`；它明示不是步行等時圈，也不可當 authoritative analysis area。
3. Point 對面用 `pulse_spatial_query(pointResultId, areaResultId, predicate)`。`within` 排除邊界；只有題意明確把邊界算入才用 `intersects`，並說明邊界規則。
4. 需要「每個面內有多少點」才用 `pulse_aggregate_by_area`；其分母是每個輸入面與此次 Point result，不是人口或未讀取的完整世界。

5. 線環域用 `spatial_query` 的 `line_buffer(resultId, radiusM)`；面交集用 `surface_intersection(leftResultId, rightResultId)`；度量用 `measure_geometry(resultId)`。遵守當前schema與頂點/拓樸預算，超限不以偷偷簡化或截斷通過。

每次說明 result lineage、未匹配／多重匹配、comparison budget 與 derived geometry 的方法。不要用 buffer 或面交集推論道路旅行時間、服務品質或因果關係。

## 4. 單一起點步行 coverage

適用問題：一個明示同意外傳座標的起點，在固定步行模型和分鐘門檻下可到達哪些合格設施。

1. 先確認起點與 consent。呼叫 `pulse_walking_isochrone`：`center:[lng,lat]`、遞增 `contoursMinutes`、`provider:"valhalla"`、`externalConsent:true`。
2. 只有 `status:"READY"` 才使用其指定分鐘 contour 的 `resultId`；它是 derived MultiPolygon，保留 Valhalla graph version、tileset 時間、costing、warning 與「模型非實測」限制。
3. `pulse_query_records` 讀取一種已確認 actual/eligible Point 設施，以可解釋 bbox/filter/time 建立候選 `resultId`；再用 `pulse_spatial_query` 的 `within` 對選定 contour 篩選。這個 coverage 分母是候選結果的完整 materialized records，不是全市設施、人口、床位或服務能力。
4. 回報 `matchedPoints`、`unmatchedPoints`、query `totalMatched` 與 `excludedByReason`；缺 geometry、面外、未連通、來源無資料不可合併。`within` 不計邊界；必要時另跑 `intersects` 並標示差異。

`HOLD` 或 `UNAVAILABLE` 時停止：不可用直線半徑、Haversine 或合成圓替代 walking isochrone。即使 READY，若 `snapDistanceM`、`disconnected` 或 graph checksum 為 unknown/null，也要保留該限制；面外不等於不可步行，面內也不是保證實際通行或營運中。
