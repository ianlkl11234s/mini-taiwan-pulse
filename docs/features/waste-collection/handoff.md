# Handoff — 垃圾清運（下游視角）

> **狀態**：shipped（見 [README.md](./README.md)）；契約內容最後查證 **2026-10-17**
> **查證基準**：mini-taiwan-pulse 本 worktree；gis-platform `origin/main`（7df0de9）；data-collectors `origin/main`（7c94bee）。
> **上游 SSOT**：垃圾清運沒有單一的 `taipei-gis-analytics/docs/handoff/` 契約檔（未查到）；資料來源研究見本資料夾 [research/progress.md](./research/progress.md)、[research/survey.md](./research/survey.md)，GPS 端點實打驗證見 analytics 的 `docs/topic-research/waste-management/api-validation.md`（collector 程式註解引用，本次未開檔核對）。
> 本檔只放前端接線與跨 repo 契約的簡表，逐欄位細節以 migration 為準。

## 1. 資料來源、授權、更新頻率、涵蓋範圍

| 資料 | 來源 | 更新頻率 | 涵蓋 |
|---|---|---|---|
| 垃圾車即時 GPS | 高雄 `openapi.kcg.gov.tw`、新北 `data.ntpc.gov.tw`、臺南 `soa.tainan.gov.tw` 三家政府開放資料端點（`collectors/waste_positions.py` 的 `ENDPOINTS`） | 每 2 分鐘輪詢（`config.py` 註解「對齊 NTPC 官方 2 分頻率」）；台灣時間 01:00–06:00 跳過（`WASTE_POSITIONS_QUIET_HOURS` 預設 `01-06`） | 僅高雄、新北、臺南三城 |
| 表定路線／停靠點（`waste_collection_stops` / `_routes`） | 環境部 hwms.moenv.gov.tw 全國垃圾車路線網（22 縣市、3,991 路線、308K unified stops，見 research/progress.md） | 靜態，無自動排程（301 migration 註明「靜態資料，不設 cron」） | 22 縣市；高雄、新北另有路線 LineString，其餘城市沿路網為推算（OSRM） |
| 處理設施 `waste_facilities` | 多來源，popup 以 `source_url` 連回原始資料 | 靜態 | 約 4,609 筆、10 類（075 migration 註解） |
| 投放點 `waste_disposal_points` | `source` 欄：utmap／tnepb_kml／osm（status.md 2026-05-08 紀錄） | 靜態 | 約 13,751 筆、7 類（076 註解） |
| 清潔隊 `waste_cleaning_squads` | 欄位含 `source`／`source_url` | 靜態 | 約 359 筆、23 縣市（253 註解）；status.md 的「1,106 隊」為較早數字 |
| 授權 | 未查到各來源的明確授權文字；依專案政策「來源頁沒寫授權照常上線、來源卡標授權待確認」處理 | - | - |

### 座標與缺值語意（重要）

- **GPS 座標是來源原始 WGS84 點**，非推算。`status` 由 collector 依 `location` 字串關鍵字（停車場／區隊／清潔隊／車隊）判成 `parked`，其餘為 `collecting`，因此 `collecting` 不保證真的在收運。
- **經 TGOS 補座標的表定停靠點，位置是門牌地理編碼推得的**（hwms 原始資料缺經緯度；哪些城市／筆數靠 TGOS、哪些本來就有座標，逐城比例未查到）。TGOS 回傳為 TWD97（EPSG:3826），需轉 WGS84（research/progress.md、phase-1-handoff.md）。地址對不到或對到門牌中心都可能與實際停車點有偏差，使用者端不得當成精確停靠位置。
- 表定動畫的車輛位置是依時刻表在 stops 之間做**直線插值**推算（`WasteScheduleScene.ts`，v1 stops-as-polyline，會穿越建物與水域），並非實測，也不是沿路網；OSRM 沿路網整合是 BL-17（[`research/schedule-osrm-plan.md`](./research/schedule-osrm-plan.md)），尚未實作。`schedule_inferred` 欄位標記該路線的時刻是否為推斷（301 migration 的 RPC 回傳）。
- 設施投放點若 `geometry IS NULL`，RPC 直接排除（未地理編碼者不回傳）。
- 無 GPS 的城市（含臺北）不顯示即時車；「未涵蓋」不等於沒有垃圾車。

## 2. DB 表契約（gis-platform）

| 表 | 用途 | 寫入者／來源 | 保留 |
|---|---|---|---|
| `spatial.waste_positions_realtime` | GPS 原始點，append-only。欄位：city、vehicle_no、route_id、status（collecting/returning/parked/offline/unknown）、geometry、observed_at、source_url、ingested_at（065） | data-collectors `waste_positions`（跑在 HiCloud VM，Zeabur 端須維持 `WASTE_POSITIONS_ENABLED=false`，否則雙寫）；`storage/supabase_tables.py` 的 `upsert_strategy` 為 `do_nothing` | 每天 04:00 UTC 刪 7 天前，04:30 UTC VACUUM（070） |
| `live.waste_trails_daily` | 每車每日軌跡 timeline 預先彙總 | `public.refresh_waste_trails_daily(target_day)` 由 pg_cron 觸發（073／302） | `cleanup_waste_trails_daily` 預設保留 7 天 |
| `live.waste_trails_matched_daily` | OSRM map-matching 後的沿路網軌跡（polyline、timeline、confidence） | data-collectors `waste_match`（074） | 預設保留 7 天 |
| `live.waste_match_attempts` | matching 嘗試紀錄（避免 NoMatch 死循環） | `waste_match` | 預設保留 7 天（075_waste_match_attempts） |
| `spatial.waste_collection_stops` / `_routes` | 表定停靠點／路線 | taipei-gis-analytics 匯入（一次性＋手動重跑） | 靜態 |
| `spatial.waste_schedule_day_agg` | 表定 RPC 的預先彙總（7 個 dow × route） | `spatial.refresh_waste_schedule_day_agg(dow)`，手動 | 靜態 |
| `spatial.waste_facilities`、`spatial.waste_disposal_points`、`spatial.waste_cleaning_squads` | 設施／投放點／清潔隊 | analytics 匯入 | 靜態 |

註：`realtime.waste_*` 已於 312 migration 整批搬到 `live` schema；舊文件（status.md、073／074 檔頭）仍寫 `realtime.`。`spatial.waste_positions_realtime` 沒有搬。

## 3. RPC 契約（前端只經 `public.*`，禁打 `spatial.*` / `live.*`）

權限：以下**讀取型 RPC 皆 `GRANT EXECUTE ... TO anon, authenticated`**（301 版另含 service_role、cloud_agent_ro）。維護函式（refresh／cleanup）已於 317 migration `REVOKE ... FROM PUBLIC, anon, authenticated`，僅 postgres 可呼叫。

| RPC | 參數 | 回傳欄位 | 時間／量級限制 |
|---|---|---|---|
| `get_waste_current(p_cities text[] default null)` | 城市陣列 | vehicle_no, city, route_id, status, lat, lng, observed_at | 只回近 30 分鐘；每車最新一筆；`statement_timeout` 30s（069） |
| `get_waste_trails(p_cities text[], p_since_minutes int default 60)` | 城市、回看分鐘 | vehicle_no, city, route_id, timeline(text), point_count | 回看分鐘數**無上限 clamp**（071 以 `NOW() - p_since_minutes` 直接過濾，前端 live 傳近 60 分鐘）；含去噪（速度 >60 km/h 剔除）與 80m 停靠點吸附。312 後的現行本體未逐行核對（未查到） |
| `get_waste_trails_day(p_target_date date, p_cities text[] default null)` | 台灣日期 | vehicle_no, city, route_id, timeline, point_count | 讀 `live.waste_trails_daily`，只有保留的 7 天內有資料；30s |
| `get_waste_trails_matched_day(p_target_date date, p_cities text[] default null)` | 同上 | vehicle_no, city, route_id, trip_id, segment_seq, polyline(jsonb), timeline, point_count, confidence | 讀 `live.waste_trails_matched_daily`；`point_count >= 2`；30s |
| `get_waste_schedule_day(p_cities text[] default null, p_dow int default null)` | 城市、星期（0=Sun..6=Sat） | city, route_id, route_name, vehicle_type, schedule_inferred, stops(jsonb) | dow 0–6 讀預先彙總（約 0.6s）；其他值走即時重算 fallback（前端不觸發，原約 48s）；60s（301） |
| `get_waste_stops(p_city text default null)` | 單一城市 | id, city, district, stop_name, route_id, route_name, arrival_time, departure_time, vehicle_type, village, lat, lng | 069 版；建議帶 city（全表量級大）。081 另補 seq（本次未逐欄核對現行簽名） |
| `get_waste_routes(p_city text default null)` | 單一城市 | route_id, route_name, city, district, vehicle_type, coords(jsonb) | 僅高雄／新北有路線資料；前端目前未呼叫（未查到 consumer） |
| `get_waste_facilities(p_types text[] default null)` | 設施類型 | id, city, facility_name, facility_type, operator, address, capacity_tpd, status, start_year, source_url, lat, lng | 全量約 800KB；只回已地理編碼者（075；252 另有 coastal 調整，本次未逐行核對） |
| `get_waste_facility_counts()` | - | facility_type, n | - |
| `get_waste_disposal_points(p_cities text[], p_types text[])` | 皆可 null | id, city, district, point_type, point_name, address, operator, accepts_categories(text[]), source, source_url, lat, lng | 全量約 4MB（076） |
| `get_waste_disposal_point_counts()` | - | point_type, source, n | - |
| `get_waste_cleaning_squads(p_cities text[] default null)` | 城市 | id, city, district, squad_name, address, phone, jurisdiction, source, source_url, lat, lng | 只回有座標者；15s（253） |

排程（pg_cron，名稱／時間見各 migration）：`refresh-waste-trails`（073 初版 `12,32,52 * * * *`，302 改版後為每小時 :07/:37 並新增 `refresh-waste-trails-yesterday`，以後者為準）；`waste-positions-cleanup-daily` 04:00 UTC；`cleanup-waste-trails` 04:12；`cleanup-waste-matched-trails` 04:18；`cleanup-waste-match-attempts` 04:20。

### 去重（migration 458 與 collectors #148）

- 問題：VM 每 2 分鐘輪詢，來源回傳最近 N 分鐘 GPS，同一點被抓 2–4 次；最近 24 小時重複率臺南約 59.8%、新北 1.3%、高雄 0.1%，合計 27%（458 檔頭，2026-10-15 實測）。
- data-collectors **#148**（2026-10-15 合併）：VM writer 改用不指定 conflict target 的 `INSERT ... ON CONFLICT DO NOTHING`，`supabase_tables.py` 的 `waste_positions` 同步為 `do_nothing`（`upsert_key = city,vehicle_no,observed_at`）。索引建好前後都能寫入。
- gis-platform **458**（`origin/main` 已有檔，本機落後 checkout 看不到）：`CREATE UNIQUE INDEX CONCURRENTLY uq_waste_positions_realtime_vehicle_obs ON (city, vehicle_no, observed_at)`。**必須 collector 部署後才能套用**；套用前要先清既有重複（附錄 A）。是否已套用到正式庫：**（未查到，不連 DB）**。
- 454 migration 另刪除 `idx_waste_realtime_geom`（gist，窗內 0 次使用）；400 補了 `idx_waste_positions_realtime_observed`。

## 4. 前端接線

- Loader：`src/data/wasteLoader.ts`（`get_waste_current`、`get_waste_stops`、`get_waste_trails`、`get_waste_trails_day`、`get_waste_trails_matched_day`、`get_waste_facilities`、`get_waste_disposal_points`、`get_waste_cleaning_squads`；後三者走 `staticRpc`）、`src/data/wasteScheduleLoader.ts`（`get_waste_schedule_day`）
- Hook：`useWasteLayer`（live 近 60 分鐘、60s 輪詢；replay 整日優先讀 matched，無資料或失敗退回 GPS trail）、`useWasteScheduleLayer`（訂閱 `timeStore.subscribeDate` 取 dow，不把 currentTime 放進 deps）、`useWasteFacilityLayer`、`useWasteDisposalPointLayer`、`useWasteCleaningSquadLayer`（開啟才抓、之後永久 cache）
- Manifest layer key（`src/data/layerManifest.ts`）：`wasteTruck`（dataClass D，Three.js）、`wasteSchedule`、`wasteScheduleNote`、`wasteCleaningSquads`、`wasteStopsStatic`（pmtiles `./geo/waste_stops_static_20260930.pmtiles`，source-layer `waste_stops`，minzoom 6／maxzoom 14）、`wdClothes`、`wdMixed`、`wdRecyclingContainer`、`wdBattery`
- 聊天工具：`src/chat/tools/rpcTools.ts` 允許呼叫 `get_waste_facility_counts`、`get_waste_disposal_point_counts`

## 5. 硬依賴欄位（改一定爆）

- `get_waste_trails*` 的 `timeline`（text，由 `parseWasteTimeline` 解析）、`point_count`
- matched 的 `polyline`、`segment_seq`、`trip_id`（沿路網插值）
- 表定 RPC 的 `stops`(jsonb)、`schedule_inferred`
- 設施 `facility_type`、投放點 `point_type`（餵 `WASTE_FACILITY_COLORS`／`WASTE_DISPOSAL_COLORS` 與 sub-toggle 分流）
- 投放點 `accepts_categories`、`source`、`source_url`（FeatureInfoPanel chips／權威度 badge／連結）
- `city` 字串（`高雄市`／`臺南市`）；collector 的 `CITY_NAMES` 與前端城市篩選須一致

## 6. 跨 repo 改動順序（上游先動）

1. taipei-gis-analytics：hwms／TGOS ETL 與匯入腳本（表定資料）
2. data-collectors：collector 程式改動先部署（`waste_positions` 在 HiCloud VM 上以 scp 更新，不是 Zeabur；`waste_match` 預設 `WASTE_MATCH` 關閉，啟用需 OSRM 服務與 `OSRM_TOKEN` 環境變數）
3. gis-platform：migration（**依賴 collector 的 migration，如 458，須在 collector 之後**）；表定資料更新後手動重跑 `spatial.refresh_waste_schedule_day_agg` 7 個 dow
4. mini-taiwan-pulse：前端接線，PR 到 `develop`

## 7. 上游改動 → 下游要跟改

| 上游改動 | 下游動作 |
|---|---|
| 新增 GPS 城市 | collector `ENDPOINTS`／`CITY_NAMES`、前端城市篩選、`WASTE_MATCH_CITIES`；表定資料新城上線前先照 research/schedule-data-quirks.md 的 checklist |
| 表定 stops 更新 | 重跑 schedule agg；重做 `waste_stops_static_*.pmtiles`（檔名含日期，manifest URL 為契約） |
| 改 `get_waste_*` 回傳欄位 | 同步 `wasteLoader.ts` 型別與 `layerGoldenExtract`／manifest 測試 |
| 改 trail 保留天數（7 天） | 回放日期選擇範圍 |
| 新增設施／投放點類型 | `wasteFacilityColors.ts`、sub-toggle、圖例 |

## 8. 已知問題與不一致

- status.md「最後更新 2026-05-06」，之後的實作（071–076、301、312、458）多散在進度紀錄；任務清單中仍有「migration 069 待用戶執行」「#9 overlayRegistry 三靜態 layer 推下個迭代」等已過時項目。
- status.md 與 073／074 檔頭仍寫 `realtime.waste_*`，現行在 `live`（312）。
- status.md 稱 get_waste_facilities「16 筆」「463 筆待 geocode」，現行為約 4,609 筆（075）。
- status.md Backlog 的「P0 OSRM map-matching 待做」其實已有 074／075 與 `waste_match` collector；但 `WASTE_MATCH` 在 `config.py` 預設 `False`，正式環境是否啟用：**（未查到）**。
- `get_waste_trails` 的 `p_since_minutes` 無上限，且函式 timeout 為自設值，屬 anon 可呼叫的昂貴 RPC，新增或改寫時要在函式內 clamp。
- 075 有兩個同號 migration（`075_waste_facilities_full_rpc.sql` 與 `075_waste_match_attempts.sql`）。
- 臺南 GPS 資料重複率高（458 前），既有 `waste_trails_daily` 的臺南軌跡點約重複 2.5 倍；458 的附錄 B 說明重算方式，是否已重算：**（未查到）**。
- 舊的殘留 key `wasteRoute`／`wasteStop`（無 consumer）已於 2026-10-17 移除；清運點位請用 `wasteStopsStatic`。
