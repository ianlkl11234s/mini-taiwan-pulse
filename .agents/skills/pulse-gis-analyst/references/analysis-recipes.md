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
3. 確認 key cardinality。缺 key、版本不相容、many-to-many 不明或需未支援 point-in-polygon 時停止。
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
