# 常見分析配方

配方是預設最短路徑，不取代 tool schema。每一步只使用前一步已驗證的 ID、欄位與 receipt；query/analysis 依序執行。

## 行政區或類別統計

1. `pulse_describe_dataset`：確認 group field 為來源欄位或有版本的 crosswalk，並確認 record grain。
2. `pulse_query_records`：套用明確 city/time/bbox/filter；projection 包含 key、group field、必要 measure 與 geometry。
3. `pulse_aggregate_records`：count/distinct/sum/mean/min/max；缺少有效數值時不得把 sum 變成零。
4. `pulse_get_data_quality`：回報 null、exclusions、coverage 與 source receipt。
5. `pulse_get_analysis_result`：用 limit/offset 分頁；使用者要求全部才讀到 nextOffset 為 null。

稱為「來源紀錄數」，除非 descriptor 與 key uniqueness 足以證明為獨立實體。

## 最近與範圍內資料

1. 取得可引用的中心座標；找不到命名地點時不可用目前地圖中心偷代。
2. `query_records` 取得完整 bounded resultId；回傳頁的 limit 不得被誤認為 session 保存的完整筆數。
3. `spatial_query` 使用 `nearest` 或 `within_distance`、數字座標、radiusM/limit。
4. 回報 Haversine 直線距離、跨行政區可能性、geometry exclusions 與 receipt。

目前不是步行／道路可達性、服務範圍或行政區 containment。

## 兩份資料 join 與比率

1. 分別 describe，確認 grain、coverage、time/version、key type 與 null semantics。
2. 分別 query 並取得 resultId；不要先用中文 label 猜 join。
3. 確認 key cardinality。缺 key、版本不相容、many-to-many 不明或需尚未通過資格的空間匹配 時停止。
4. `join_records` 使用已驗證 key；檢查 unmatched 與 row expansion。
5. `calculate_metric` 明確 numerator/denominator；分母為零或 null 不得產生普通數字。
6. quality/result paging/receipt。

## 時間序列

1. 確認 time field、frequency、timezone、snapshot/revision 與 stale semantics。
2. `read_series` 後先做 quality；缺期不能補零。
3. `compare_series` 只比較相容 grain/unit/frequency。
4. 基期為零、來源中斷或 schema change 時停止百分比解讀。

## 地圖呈現

資料分析與地圖呈現分開：

1. 讀 `get_result_bounds` 與目前 map/study revision。
2. 若有正式 result presentation tool，呈現後等待 ready 並 readback。
3. 若只有 `set_layers`，只能說完整來源圖層已開啟；不可聲稱只顯示 resultId 的篩選結果。
4. fit bounds 是取景，不是過濾或資料完整性證據。


## 有界幾何分析

以 live schema 為準：`query_records → line_buffer → surface_intersection → measure_geometry → get_result_bounds` 可合成一個 plan。只執行問題需要的步驟，不為取得已存在的 summary 再做 measure/get_analysis_result；品質資訊不足時才另查 quality/evidence。

- 每個輸入必須是完整單一 actual/derived、spatialAnalysisEligible feature；`limit=1` 不會把多筆材料截成單筆。
- `line_buffer(resultId, radiusM)` 接 LineString/MultiLineString，半徑 1–500m 可小數。Turf local AEQD、round 16 arc steps；不是路網或步行服務區。
- `surface_intersection(leftResultId, rightResultId)` 接面；只輸出有面積部分，線／點接觸回空面不能解讀為完全不接觸。
- `measure_geometry(resultId)` 接線或面，球面估計 m／m²，無可顯示 geometry，不具工程測量精度。
- 本島 envelope [119.5,21.8,122.1,25.5]、合計輸入最多 1600 頂點／0.5° span、輸出最多 8000 頂點／1MiB；拓樸與來源追蹤另有預算。以實際錯誤停止，不自行簡化或修補。
- 用 descriptor/來源 feature 名稱辨識輸入，回報來源精度、時間未知、完整覆蓋與排除；derived 不提升原始資料精度。面可續接既有點位 within/intersects。
- partial plan 只續未完成步驟；geometry/budget 錯誤不得原樣重試。重新載入導致 result 遺失時才重取必要來源。
- 有結果才 collection+framing、wait、map_context；空交集據實報告，不把 measure 的無 geometry 當地圖失敗。
