# SOURCE_EXPANSION_AUDIT — 計畫 §4 外部來源查核表

> 查核日：2026-11-11。範圍：**只做文件查核，沒有對外部 API 做 HTTP 實測**。
> 「狀態」欄：
> - **已在收（實查）**＝本次查表確認有近期資料（落雷、雨量；航跡見 SOURCE_REUSE_AUDIT）。
> - **已有收集器**＝`data-collectors/collectors/registry.py` 有登記、讀過收集器檔頭的端點與欄位，但**沒有查表確認目前仍在啟用、有新資料**。
> - **已確認（文件）**＝讀過 repo 內既有研究文件或收集器，端點存在，但未為聲景重新實測。
> - **未實測**＝只有計畫書列的入口，授權、欄位、歷史可得性都還要查。
> 授權欄：臺灣政府開放資料多採「政府資料開放授權條款第 1 版」，但**每個資料集要以當次頁面文字為準**，表內未逐一核對者一律寫「待查」。

## 1. 查核表

| 代號 | 主題 | 入口 | 授權 | 狀態 | 粒度／更新 | 需新 collector？ | 主要障礙 | 建議優先 |
|---|---|---|---|---|---|---|---|---|
| A02 | 航班時刻／狀態 | TDX https://tdx.transportdata.tw/（航空 FIDS）；移民署 APIS | 待查 | APIS **已有收集器**（`immigration_apis_airport.py`：桃園、松山入境、臺中、高雄等 8 端點，免金鑰）；TDX FIDS 未實測 | 班次級；APIS 為入出境人數，不是航班時刻 | TDX FIDS 要新 collector；APIS 不需 | 班表不生成飛行路徑，只能校正起降時刻與辨識起降階段；時區、延誤、航班號 join | P1-中（先用來標「起降階段」） |
| — | 航空噪音方法 | FAA AEDT https://aedt.faa.gov/ | 不適用（方法參考） | 未實測（方法參考） | — | 否 | 不代表能免費取得機型聲學參數；不得以機型代碼直接生 dBA | 研究文件，不實作 |
| N02 | 氣象署落雷 | https://opendata.cwa.gov.tw/ | 待查 | **已在收（實查）**（`lightning_cwa.py`，每 5 分鐘，S3 `lightning_cwa/archives/`） | 事件級，時間只到分鐘 | 否 | 近期極稀疏（11-04 起 Supabase 只 2 筆）；`event_id` 超過 2^53 | 已用 |
| N02 | 台電落雷 | https://data.gov.tw/dataset/61139 | 待查 | **已在收（實查）**（`lightning_events.py`，每 30 分鐘，S3 `lightning_events/archives/`） | 事件級，秒 | 否 | loader 註解說 07-10 起回空，但 11 月實查有資料 → 註解過時 | 已用 |
| N01 | 雨量站 | https://opendata.cwa.gov.tw/ | 待查 | **已在收（實查）**（`rain_gauge_realtime.py`） | 10 分鐘觀測；RPC 只給每小時 | 否 | 10 分鐘量與 1 小時量不可混；臺北 10min 約 30% NULL 且語意可疑；Supabase 30 天 | 已用；要更細可另做 10 分鐘 RPC（需 migration，本版不做） |
| N01 | 雷達／QPE | 氣象署 O-A0058-005、QPESUMS | 待查 | 未實測；既有 `precipitation_raster.py`（水利署 IoT 累積雨量 **PNG**）**已有收集器** | PNG 426m×773m | 數值 QPE 需新 collector | **著色 PNG 不可反推毫米**；要找正式數值格點 | P1-中（填補雨量站稀疏處） |
| N03 | 風 | 氣象署即時觀測 https://data.gov.tw/dataset/9178（O-A0001-001） | 待查 | **已有收集器**（`weather.py`，O-A0001-001 全測站逐時） | 逐時，站點 | 否 | 站高、城市遮蔽；風速≠聲級 | P2（W5 自然聲景） |
| N04 | 海象 | https://data.gov.tw/dataset/122138 | 待查 | **已有收集器**（`cwa_marine_observation.py`：O-B0076 站點＋O-B0075 48h 讀數；`marine_observation.py`） | 逐時，浮標／測站 | 否 | 需海岸類型；近岸衰減；站點稀疏 | P2（W5） |
| N05 | 河川水位 | 水利署 https://data.gov.tw/dataset/25768 | 待查 | **已有收集器**（`river_water_level.py`，每 10 分鐘，免金鑰） | 10 分鐘，站點 | 否 | 水位≠流量≠聲音 | P2（W5，研究性） |
| W01 | 臺北清運 | https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae | 待查 | 已確認（文件）：班表已在 `spatial.waste_collection_stops`；**星期欄位全空** | 停點表定 | 否（但要刷新） | 星期缺值；表 07-22 後未刷新 | P0（回官方查星期規則） |
| W01 | 新北清運 | https://data.ntpc.gov.tw/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8 | 待查 | 已確認（文件）：新北有星期欄位（`,` 分隔） | 停點＋每週清運日 | 否 | 一般／資收／廚餘欄位分開 | 已用 |
| W01 | 新北垃圾車 GPS | https://data.ntpc.gov.tw/datasets/28ab4122-60e1-4065-98e5-abccb69aaca6 | 待查 | **已有收集器**（`waste_positions.py`：高雄／新北／臺南 GPS；Supabase 7 天） | 即時點位 | 否 | TTL、定位精度、GPS 不更新；停點間不可直線補 | P1-高（GPS 驗證過的移動聲源） |
| C01 | 臺北工程 | https://data.taipei/dataset/detail?id=c208dabd-2da0-4e6d-8dbd-a004b9782b0a | 待查 | 未實測；相關：`road_event_planned.py`（TDX RoadEvent 預告事件，含施工排程）**已有收集器** | 事件級，有 ExpireTime | 臺北工程資料集需新 collector；TDX 預告事件不需 | 核准≠正在施工；工時；地理精度 | P1-中（MVP-B，W4 計畫內） |
| T01 | 車流 | TDX VD | 待查 | **已有收集器**（`vd.py` 臺北／新北市區、`freeway_vd.py` 國道） | 5 分鐘／60 秒 | 否 | VD 空間覆蓋、路段匹配 | P1-高（MVP-B，W4 計畫內） |
| R01 | 鐵道 | TDX 時刻表 | 待查 | **已有收集器**（`rail_timetable.py` 台鐵＋高鐵每日歸檔；前端已有列車引擎） | 班次 | 否 | 地下段要排除；隔音設施未知 | P0（MVP-B，W4） |
| E01 | 藝文活動 | 文化部 https://data.gov.tw/dataset/6478 | 待查 | 未實測 | 活動級 | 是 | 室內外、實際場次、地點精度 | P2 |
| E01 | 集會遊行 | 警政署 https://data.gov.tw/dataset/11307 | 待查 | 未實測 | 活動級，文字地點 | 是 | 文字地點解析、是否實際舉行 | P2（需解析地點，風險高） |
| O01 | OSM 營業時間 | https://wiki.openstreetmap.org/wiki/Key:opening_hours | ODbL（需標示 OSM 貢獻者） | 未實測 | POI | 否（OSM 匯出） | 營業≠戶外發聲；缺失率；ODbL 授權需標示 | P3 |
| E04 | 城市事件 | TDX 交通、臺北 EOC、雙北事件 handoff | 待查 | 部分已在收（`road_event_live.py`）；119 無明確 API | 事件級 | 視來源 | 授權、隱私、位置精度；119 保持停用 | P3（只當候選提示） |

## 2. 建議優先序

1. **MVP-B（W4，已在計畫）**：鐵道（地面／高架，排除地下段）→ 市區 VD 車流 → TDX 預告事件（施工）。三者都已有收集器（啟用狀態待查表確認），不需新 collector。
2. **垃圾車資料修補**：臺北星期規則回官方確認、`waste_schedule_day_agg` 刷新；新北 GPS 驗證移動聲源。
3. **雨的空間解析度**：找正式數值 QPE（不是 PNG），或新增 10 分鐘雨量 RPC（需 migration，須使用者拍板）。
4. **自然聲景（W5）**：風、海象、河川水位皆已有收集器（啟用狀態待確認），只需模型研究文件。
5. **活動類（E01／E04／O01）**：要新 collector＋地點解析，最後做。

## 3. 本次沒做、要做時的步驟

每個「未實測」來源上線前：查當次授權文字 → 取一筆真實樣本確認欄位與時間基準（UTC／臺北）→ 確認歷史可得性（能否回補）→ 決定是否需新 collector（走 gis-data-onboard skill 與 ADR-0026 §5 決策樹）。
