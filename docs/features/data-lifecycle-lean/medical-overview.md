# 日本醫療低縮放顯示

預設 adaptive 模式在 zoom < 8 顯示 hash-pinned z6 GeoJSON 格網的中心聚合圓點與計數；Navii 依 `record_kind`、H17 依 `service_type` 篩選後，將可見分類加總為每格一個數字。中心由格網 polygon bbox 派生，不是設施座標、服務範圍或唯一機構計數。

zoom ≥ 8 才掛載原始 PMTiles，並保留既有點位 click handler。使用者可選「完整點位」，讓 PMTiles 在任何 zoom 掛載。兩種 source 互斥：轉換、All Off 與 style 重建時均移除不用 source/layer，避免只隱藏卻保留 Range 請求。

aggregate 僅接受同一 `current.json` → immutable catalog 版本中 allowlist 的 `aggregate_path`；讀取前後驗 bytes / SHA-256，並驗 FeatureCollection、z6 polygon、分類欄位與 mapped 總數。失敗維持明確 error，不當成空資料。

格網暫不提供 click popup；它呈現的是已映射來源列的格網計數，不能推論服務範圍、唯一機構數或即時可接診狀態。

醫療與長照同時顯示時，以中性小圓點標示格網中心、類別標籤以螢幕左右偏移分開，分別標示「醫療」「長照」，避免同一格網的兩種口徑互相遮住。只開一類時標籤回到格網中心。偏移不改來源 geometry；醫療與長照使用可讀的淡紅／淡黃字色，類別文字與計數口徑不依賴顏色辨識，多分類仍明示加總。
