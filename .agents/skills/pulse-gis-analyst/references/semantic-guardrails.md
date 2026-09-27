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

結論在內部分成 observed、derived、source-stated、unknown；外部網路背景與 Pulse dataset receipt 分開引用；不同年份或 grain 不強行比較。

## 守門結果怎麼講給使用者聽

上面的檢查是給 Agent 做的，不是逐條念給使用者。只有會改變答案的那一條才寫出來，用一句白話放在相關句子旁（「小提醒：」），不集中成限制大段：

| 內部語意 | 講給使用者 |
|---|---|
| null／missing／notCovered | 「這裡沒有資料，不是 0。」 |
| derived（自行推算） | 「這個數字是從村里資料推算的，不是官方直接公布。」 |
| 關聯結果 | 「一起出現，不代表誰造成誰。」 |
| proxy／geocoded 座標 | 「位置是用地址推估的，差幾十公尺很正常。」 |
| 直線距離 | 「這是直線距離，實際走路會再遠一點。」 |
| unknown 且會改變結論 | 一句話說做不到，並給替代做法：「產量目前沒資料；可以先看收成面積。」 |

## 行政統計、座標格式與面資料讀取（逐字自 SKILL.md §3 搬出，2026-09-26）

行政統計須先核對 values 的 `boundary_version`、level、immutable boundary manifest 與 `area_code` join；這只證明行政代碼可連接，不證明 geometry 是原始精度。公開統計邊界目前標為 generalized，只能呈現及按代碼做數值比較，不能用於點歸屬或線面交叉。空間分析須另外使用已驗證原始 bytes、CRS 與精度的 eligible 邊界；即使 boundary_version 同名也不可略過 SHA 與 geometry gate。每個結果同時保留 values 與 boundary 兩份 receipt；boundary 有但 observation 缺席的行政區仍保留為 `missing`，不可從地圖消失或補零。

所有 EPSG:4326 center 都必須是數字 tuple `[longitude, latitude]`；不得把 URL、DOM 或 JSON 中讀到的座標字串直接傳給 spatial/map tools。

面資料的 `query_records` 預設應在 `select` 排除 `geometry`，除非使用者明確需要讀取原始座標。瀏覽器儲存的 `resultId` 仍保留完整 materialized geometry，可繼續做 spatial analysis 與地圖呈現；`select` 只縮小傳回 Agent 的 rows。空間 join 的 readback 使用小 `limit`，但計算仍以儲存內的完整 result 為準。點與行政面並用時，優先查詢不內嵌 geometry 的全部面值、將點 spatial join 到面，再依命中的 `area_code` 查一筆可呈現邊界。
