# 語意與安全守門

## 每次分析前

- Dataset：canonical ID、grain、primary/candidate key、schema、units。
- Geometry：type、role、CRS、precision、spatialAnalysisEligible。
- Source：publisher/reference、provenance、license/status、version/time。
- Coverage：地理與時間範圍、是否完整來源、已知 exclusions。
- Missingness：null、missing、suppressed、zero、stale、closed 的個別定義。
- Access：guest/owner、tier、release/DEV gate、revocation 狀態。
- Limits：supported operations、rows/bytes/cost、bbox/time/projection、pagination。

任何會實質改變結論的欄位或 policy 為 unknown 時，停止該步分析；不要套預設值補齊。

## Join gate

- 相同文字欄位名稱不代表相同語意。
- 行政區中文名稱不是穩定 key；優先使用相同版本的正式代碼。
- Point 只有座標但沒有行政區欄位時，不能在未登記 boundary adapter 下自行歸屬。
- 報告 unmatched、null key、duplicate key、join cardinality 與 join 前後筆數。

## 空間 gate

- 實際 Point 可做已支援的 Haversine nearest/within-distance。
- generalized/proxy/cluster/label coordinate 不得用於精確距離。
- PMTiles/raster/polygon 沒有 sidecar 或 adapter 時，不因能顯示就宣稱可讀取分析。
- bbox 是矩形篩選；不是行政界線、服務範圍或可達性。

## 禁止升級的說法

- 紀錄多 → 服務較好、需求較高或人口較多。
- 點位密 → 覆蓋完整或可達性較佳。
- catalog entry → 資料已載入、最新、有授權或 production healthy。
- null → 0；suppressed → 0；沒有 snapshot → 關閉或不存在。
- ready receipt → browser 已清楚呈現完整資料。

結論分成 observed、derived、source-stated、unknown。外部網路背景與 Pulse dataset receipt 分開引用；不同年份或 grain 不強行比較。
