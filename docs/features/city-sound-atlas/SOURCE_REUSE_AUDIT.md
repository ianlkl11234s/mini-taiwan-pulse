# SOURCE_REUSE_AUDIT — 既有資料與程式能否複用（Phase 0）

> 查核日：2026-11-11（臺北）。查核方式：讀 mini 原始碼、`pg_get_functiondef` 讀正式 DB 的 RPC 定義、唯讀查表（`BEGIN READ ONLY`，有 LIMIT 或聚合）。
> 基準 SHA：`origin/develop` = `dda9caa0`（#1007 合併）；`origin/master` = `79ebefdc`；本分支 `feat/city-sound-atlas-mvp` 從 `dda9caa0` 分出，**未 push**。
> 計畫書 §2 的「既有資料與可直接複用的程式位置」逐項對照如下。主計劃 01（前一次 handoff）不在手上，以擴充計畫為準。

## 1. 總表

| 家族 | Loader／RPC | 欄位與粒度 | Supabase 保留 | S3 正本 | 健康度（2026-11-11 實查） | 結論 |
|---|---|---|---|---|---|---|
| 飛機 | `airspaceLoader.fetchAirspaceDayArrow` → `get_flight_trails(target_date date)` → `live.flight_trails_daily` | 每航班一列；`trail`＝`lat,lng,alt,ts;…`，點距中位數 300 秒；`day`＝**臺北日**，實際涵蓋前一日 23:00～隔日 01:00 | 7 天（`cleanup_flight_trails_daily(7)`，表內現有 11-03～11-11） | `trails/flights/<D>.json.gz`（同列形，每日 02:00 匯出） | 正常，11-08 5,705 架、11-09 5,493 架 | **可直接複用**；高度單位混用，見 §2 |
| 雷 | `lightningLoader.fetchLightningDay(dateKey, source)` → `get_lightning_day(date_key text, p_source text default 'taipower')` → `live.lightning_events` | 每次落雷一列：`event_id bigint`、`strike_ts`（unix 秒）、`intensity_ka`、`strike_type`（0 雲對地／1 雲中）、`lon`、`lat`；依臺北日切 | 7 天（`cleanup_lightning_events(7)`） | `lightning_cwa/archives/<D>.tar.gz`（每 5 分鐘一個 json）、`lightning_events/archives/<D>.tar.gz`（台電，每 30 分鐘一個 json）；**檔名日期＝收集時間的臺北日** | cwa：表內只有 11-06 兩筆；taipower：11-04～11-10 共 27 筆；jma 1,856 筆（只涵蓋日本，不用） | **可複用**；必須逐源記 health，見 §3 |
| 雨 | `rainGaugeLoader.fetchRainGaugeDay(dateKey)` → `get_rain_gauge_day(target_date date)` → `live.rain_gauge_readings` | `DISTINCT ON (station_id, date_trunc('hour', observed_at))` 取每小時**最後一筆**：每站每小時一列；`precipitation_10min／1hr／3hr／24hr`（mm） | 30 天（表內現有 10-12 起） | 無逐筆正本快照（本次場景快照補上 10-24、11-08、11-09 三天的裁切） | 正常；臺北 11-09 有 197 站×24 小時；`precipitation_10min` 臺北站多為 NULL | **可複用**；只能做每小時粒度 |
| 垃圾車 | `wasteScheduleLoader.fetchWasteScheduleDay(cities, dow)` → 靜態快照 `/static-rpc/get_waste_schedule_day_<dow>_<分組>.json`（＝`public.get_waste_schedule_day` 原樣輸出） | 每路線一列，`stops` 含 `arrival_sec／departure_sec`；臺北星期欄位全空 → RPC 當每日 | 表 `spatial.waste_schedule_day_agg` 無保留期（靜態表） | 靜態快照在 R2 | **`refreshed_at` 全部在 2026-07-22 22:45～22:48，之後未刷新**（20 城、15,685 列） | **可複用但標 stale**；班表是週期資料，本身不過期，但路線異動不會反映 |
| 時間 | `src/state/timeStore.ts` | `getTime()`／`subscribeThrottled()`／`subscribeDate()` | — | — | — | UI 接線用（W2） |

RPC 定義是 2026-11-11 用 `pg_get_functiondef` 從正式 DB 讀出的現行版本（不是 migration 檔的歷史版本）；`get_lightning_day` 的雙源參數來自 gis-platform `338_lightning_dual_source.sql`。

## 2. 飛機：高度單位混用與 FlightScene 既有 bug

- `trail` 的 alt 直接串 `live.flight_positions.altitude`，**兩個收集器單位不同**（data-collectors `storage/supabase_writer.py` 1098–1146 行，W0 查核）：
  - FR24 zone（`flight_id` 8 位 hex）→ **英尺**
  - OpenSky（`flight_id` 6 位 hex）→ **公尺**（baro，缺時 geo）
- 三個場景快照內：臺北 11/9 1,262 架中 785 架是英尺、477 架是公尺；沒有第三種 id。
- 聲景引擎依 `flight_id` 判斷（`aviationAdapter.altitudeUnitForFlightId`），其他格式回 `unknown`、只算 2D、不給潛勢（T05）。高度基準（MSL／AGL、氣壓／幾何）未與地形校正，斜距附 note。
- **FlightScene 既有 bug（不在本分支修）**：`src/three/FlightScene.ts` 163–164、333 行把 `a[2]` 直接傳給 `utils/coordinates.toMercator(lat, lng, altMeters)`，第三個參數語意是公尺；FR24 的英尺值因此被當公尺，3D 航跡高度約放大 3.28 倍，且和 OpenSky 航班高度不一致。顏色門檻 `MAX_ALT = 13000`（135 行）也假設公尺。需另開 BACKLOG 修。
- 缺口：`flightRowsToFlights` 以 30 分鐘切段；快照內 >30 分鐘的間隔在臺北 11/9 有 771 個（多是同 id 不同趟），10–30 分鐘的 267 個。引擎段內 >10 分鐘不內插、段間回 unknown，不以直線補軌跡（計畫 §2 風險 4）。

## 3. 雷：台電落雷現況與「空≠沒雷」

- `src/data/lightningLoader.ts` 84、136 行註解寫「台電源自 2026-07-10 起端點活著但永遠回空」，Monitor 卡片因此以 cwa 為主（143 行）。**這個結論已過時**：2026-11-11 實查，`live.lightning_events` 的 taipower 在 11-04～11-10 有 27 筆，S3 archive 10-24 有 9 筆；反而 cwa 近期很稀疏（表內只有 11-06 兩筆，10-24 全台 3 筆）。
- 聲景引擎因此兩源都讀（`THUNDER.sources = ["cwa","taipower"]`），每源各自 `ok／empty／error`；loader 檔頭註解與 Monitor 主來源要不要改，留給使用者決定（不在本分支改 `src/data`）。
- `get_lightning_day` 的 `p_source` 預設是 `'taipower'`；p_source=null 會兩源加總（loader 304 行註解），聲景一律指定來源。
- cwa 的 `strike_time` 只到**分鐘**（S3 樣本 `15:07:00+00:00`），延遲計算與跨源 ±1 秒 possible-link 對 cwa 沒有意義。
- cwa 的 `event_id` 是 18 位數（例 `455525717468717829`），**超過 2^53**，JS `JSON.parse`／supabase-js 會失真；adapter 以 `source+event_id` 去重，理論上可能誤併。既有 RPC 路徑同樣有此問題，場景快照另附 `event_id_str`。

## 4. 雨：粒度

- RPC 每站每小時一筆（取該小時最後一筆觀測），`bucket_at` 為小時起點。adapter 用 `precipitation_1hr`（過去 1 小時累積 mm）當 mm/h 代理，`[bucket_at, bucket_at+1h)` 代表該筆。
- `precipitation_10min` 單位是 mm/10min，臺北近期多 NULL（臺北 11/9 快照 2,710 列中 819 列 NULL），**不與 1hr 混用**。
- 雷達：`precipitation_raster`（水利署 IoT PNG）與 CWA 雷達都是著色影像，不可反推毫米雨量（T10），本版不用。

## 5. 垃圾車

- 只用表定停點；`wasteScheduleLoader` 檔頭（5 城現況）＋ gis-platform 079 檔頭：高雄、新北、宜蘭、基隆有星期欄位；臺北星期全空被 RPC 當每日 → 聲景標 `weekday_unknown`，預設回 unknown（計畫 §2 風險 2）。其餘城市 `weekday_unverified`（以 inferred 候選顯示）。
- 停點之間的視覺直線不是路網，不沿線發聲（風險 3）。即時 GPS（`waste_positions`：高雄／新北／臺南）本版不用。
- 表 2026-07-22 後未刷新：班表本身是週期資料，聲景照用，但在 UI 與 DATA_QUALITY 標 stale。

## 6. 其他計畫 §2 列項（本版不接）

| 項目 | 現況 | 本版 |
|---|---|---|
| `rain_radar` | 只有展示用著色影像 | 不用（T10） |
| `rail` | `railScheduleLoader`／列車引擎可用；地下段需排除 | MVP-B（W4） |
| `news_candidate` | 發布時間≠事件時間、位置多為行政區代表點 | 不當聲源 |
| `election_event` | 站主限定、位置概略 | 不接 |
| `noise_validation` | `docs/features/noise-layers/` | 只當驗證對照，不當聲源 |

## 7. 最小真實樣本（Phase 0 gate）

三個場景快照即為真實樣本（見 DATA_QUALITY_REPORT）：飛機含高度（ft／m 兩種都有）、雨量（每小時）、落雷（和平 11/8 一筆台電）、垃圾車（不進快照，由既有靜態快照提供）。無 blocker；cwa 落雷近期稀疏，列為資料限制而非通過。
