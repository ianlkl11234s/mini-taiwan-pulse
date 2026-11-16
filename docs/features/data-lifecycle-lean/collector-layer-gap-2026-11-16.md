# 收集器 × 前端消費缺口盤點（2026-11-16，唯讀）

## 方法與證據來源
- 收集器清單：data-collectors `origin/main` 的 `config/cross_layer_map.yaml`（104 筆，collector→Supabase 表→S3 前綴→deployment）、`collectors/registry.py`、`docs/EXTERNAL_COLLECTORS.md`。
- 「正在跑」：正式 DB 唯讀查（`BEGIN READ ONLY`＋`transaction_read_only=on` 斷言、statement_timeout）
  - `metadata.collector_status.last_success_at`（94 個收集器有心跳列）
  - 每張輸出表 `max(time_column)`（time_column 依 `config/realtime_tables.yaml`）
  - 候選表近 24 小時筆數（`count(*) where time >= now()-24h`）
  - 查詢時間：DB now = 2026-11-16 06:51 UTC
- 消費端：mini `origin/develop` 的 `src/ server/ public/ deploy/ scripts/`（排除測試）`git grep -w` 表名；再用 DB `pg_proc.prosrc`／`pg_views.definition` 找讀該表的 RPC／view，grep RPC／view 名；交叉比對 `docs/features/general-analysis/layer-freshness-live-map.json`。派生表鏈（例如 `temperature_grids → temperature_frames_daily → get_temperature_frames`）以 freshness map 補足。
- 間接消費：MCP 倉庫（mini-pulse-gis-mcp 只讀 R2 倉庫，不直讀 live 表）＋ pulse-data `registry/*.yaml`。
- 共用表的收集器已確認不被篩掉：`earthquake_catalog`（前端 earthquakeLoader 用 catalog 算 24h 活動量）、`road_event_planned`（`get_road_events_day` 不分 source）、颱風 jma／jtwc／cwa 三源（typhoonTracksLoader 全讀）。
- 限制：RPC 追蹤只做一層，派生鏈靠 freshness map 與個別手動追（tra_train、freeway_vd）；pg_cron 內嵌 SQL、mini 以外的站（mini-cctv-tw 等）未查；「(a)」計數用寬鬆 grep（含 manifest 註解命中），屬約數。
- 原始中間檔（collectors.json、dbres.json 等）只存在當時 session 暫存區，未進 repo。

## 主表 A：(c) 完全沒人讀（收集器在跑、表有新資料，前端／MCP 倉庫都沒讀）

| 收集器 | 資料內容 | 輸出位置 | 最新資料 (UTC) | 每日量級 | 判定沒接的證據 | 圖層建議 |
|---|---|---|---|---|---|---|
| `weather`（pulse-host，60 分） | 氣象署自動站逐時觀測（氣溫、雨量、風、濕度…）約 876 站 | `live.weather_observations`（歷史）、`live.weather_current`；S3 `weather/archives/` | obs collected 11-16 06:26；current observed 06:00 | 約 2.3 萬列／日（24h 實測 22,776）；current 876 列 | `weather_current`／`weather_observations` 及 public 同名 view 在 src 0 命中；DB 只有 `manage_all_partitions` 參照，沒有任何 get_* RPC；`weatherStations` 圖層是靜態 `./geo/weather_stations.geojson`，popup（`WeatherStationPanel`）只顯示站點屬性，描述寫「點擊看該站即時觀測」但實際沒有接；pulse-data `weather.yaml` 只是 phase0 草稿 | 把 `weatherStations` 改成即時測站點（顏色＝氣溫、popup 顯示最新觀測＋24h 走勢）；或做「即時風向風速箭頭」層 |
| `launch`（pulse-host，15 分輪替） | 全球火箭發射排程、發射事件、發射台 | `live.launches`（163 列）、`live.launch_events`（32）、`live.launch_pads`（240）；view `public.launches_upcoming`、`public.launch_pads_all`；S3 `launch/archives/` | launches 06:50、events 06:35 | upsert 型：24h 更新 123／26／101 列（總量小） | 三表與兩個 view 在 src 0 命中（只有 `scripts/audit/weekly/collect_supabase.sh`）；`satelliteCatalogLoader` 的 launch 欄位來自 UCS 衛星目錄，不是這幾張表；MCP／pulse-data 0 命中 | 「全球發射台＋即將發射」點圖層（倒數、火箭、任務），可掛在衛星主題；監看面板也可加「近 7 天發射」卡 |
| `jma_forecast`（pulse-host，720 分） | 日本 56 府縣天氣預報（短期／週間）＋早期注意情報 | `live.jma_forecasts`（14 萬列）、`live.jma_forecast_probabilities`；view `public.jma_forecasts_latest`、`public.jma_forecast_probabilities_latest`；S3 `jma_forecast/archives/` | 11-16 02:52 | 約 7,300 列／日（4,222＋3,074） | 表名、view 名在 src 0 命中；`jmaLiveLoaders.ts` 只讀 AMeDAS／警報／季節／WBGT 觀測；pulse-data 無 `jma_forecast.yaml` | 日本府縣預報分區面量圖（明日天氣圖示／降雨機率），與既有 JMA 警報層同區塊 |
| `wra_drought_alert`（pulse-host，事件驅動） | 水利署水情燈號（各區供水警戒） | `public.drought_alert_current`（2 列）、`drought_alert_history`（2 列）；RPC `public.get_drought_alert_latest`；S3 `wra_drought_alert/archives/` | 收集器心跳 11-16 04:14；表內最新 fetched_at 2026-05-15（hash 未變不寫，屬預期） | 幾乎 0（只在公告變動時寫） | 表名、`get_drought_alert_latest` 在 src 0 命中（"drought" 只出現在 NCDR 示警說明文字） | 供水分區燈號面量圖（綠／黃／橙／紅），併入水資源主題；量小、乾季才有意義 |
| `tra_static`（pulse-host，每日） | 台鐵車站、路線、站序、車種、當日時刻表原始 JSON | 只寫 S3 `tra_static/archives/`（無 DB 表、`heartbeat_without_writer`） | 心跳 11-16 04:14 | 每日 1 包 | S3 封存前端不讀；台鐵圖層走 `rail_timetable`→`reference.daily_schedules`；`tra_static` 在 src 0 命中 | 不建議新圖層；它是備援正本，可考慮讓 rail_timetable 不足時從這裡補，或評估停掉以省 TDX 配額（**未確認**是否有離線 pipeline 在讀 S3） |

### 部分表沒人讀（收集器本身已接圖層，只是某張輸出表沒被用）
| 收集器 | 沒人讀的表 | 量級 | 備註／建議 |
|---|---|---|---|
| `freeway_vd` | `live.freeway_vd_traffic`（1 分鐘 VD 車流） | 約 47 萬列／日 | 圖層只讀 `freeway_sections*`→`freeway_congestion_daily`；VD 原始值經 `live.compute_signal_levels`→`compute_pressure_index` 進監看面板壓力指數（(b)），另被 analytics 數位孿生離線用。可做「國道偵測器流量」點層 |
| `satellite` | `live.satellite_positions`、`satellite_current` | 約 30 萬列／日 | 衛星層用 TLE 在前端推算；這兩表只有 view／`sync_isr_satellite_registry_from_live` 用。可考慮降頻或縮保留期 |
| `earthquake` | `live.tsunami_alerts`（84 列，事件驅動，最新 10-24） | 0／日 | 前端 tsunami 只出現在靜態警報臺層；可在地震層加海嘯報告標註 |
| `env_jp_wbgt` | `live.env_jp_wbgt_forecasts` | 季外 0 | 觀測有接，預報沒接；季節外（10-21 後）不寫 |
| `jma_quake` | `live.jma_tsunami_reports` | 事件驅動 | 地震、火山有接，海嘯情報沒接 |
| `cwa_marine_observation` | `live.marine_observation_quarantine` | 數百列／日 | 異常值隔離表，本就不該上圖 |
| `cems_stack_monitoring`／`water_effluent_monitoring`／`nusc_gamma_radiation` | `*_readings`／`*_measurements` 歷史表 | 數萬～十萬列／日 | 前端只讀 `*_current`；歷史表有進 pulse-data（倉庫），屬 (b) 正常 |
| `yt_live_video_resolver` | `live.yt_live_history` | 約 3,700 列／日 | 只讀 current；history 無人讀 |
| ledger 類 | `aisstream_ingest_*`、`internet_health_source_runs`、`intel.global_event_collector_*`、`gfw_hourly_publish_runs`、`animal_*_runs` | — | 監控用 ledger，不應上圖，不算缺口 |

## 主表 B：(b) 只被監看面板間接使用（沒有地圖圖層）

| 收集器 | 資料內容 | 輸出位置 | 最新資料 (UTC) | 每日量級 | 證據 | 圖層建議 |
|---|---|---|---|---|---|---|
| `tra_train`（pulse-host，2 分） | 台鐵列車即時位置／誤點 | `live.train_positions`（留 7 天）；S3 `tra_train/archives/` | 11-16 06:49 | 約 9 萬列／日 | 鏈：`train_positions`→view `analytics.tra_positions_source`→`analytics.refresh_tra_delay_daily`→RPC `get_tra_delay_summary`／`get_tra_delay_trains`，前端只在 `intelLoaders.ts`，唯一使用者 `TraDelayBoard.tsx`（監看）；台鐵地圖層用時刻表 `daily_schedules` | 在台鐵列車層加「即時誤點著色」或「實際位置 vs 時刻表」對照；或誤點熱點站點層 |
| `food_prices`（HiCloud VM，每日） | 農業部菜／魚／肉／蛋批發價 | `live.food_price_daily`（25.6 萬列）＋analytics `food_price_index_daily` | collected 11-13 16:53（交易日 T+1、週末停，屬預期） | 約 1.2 萬列／交易日 | 只有 `FoodPriceBoard.tsx`＋`intelLoaders.ts` | 批發市場點層（各市場當日主要品項價格／漲跌） |
| `twse_market_index`（pulse-host） | 台股加權指數 tick | `live.market_index_tick`、`market_index_current` | 11-16 06:50 | 約 280 列／日 | 只有 MonitorPanel／PressureRing（`get_market_index_now`、`get_market_index_daily`） | 非空間資料，維持監看卡即可 |
| `cdc_public_health_weekly`（HiCloud VM，週四） | 疾管署每週疫情（類流感、腸病毒、腹瀉…） | `live.public_health_weekly` | 11-12 03:00（每週一次，正常） | 約 1,300 列／週 | 只有 `useMonitorDashboardData`→`get_public_health_weekly`（監看卡） | 縣市別週疫情面量圖（資料若含縣市欄位；**未確認**欄位粒度） |
| `yt_live_video_resolver`（pulse-host，5 分） | YouTube 新聞直播 videoId | `live.yt_live_current`、`yt_live_history` | 11-16 06:50 | 3,700 列／日 | 只有 `LiveWall.tsx` | 非空間，維持監看 |
| `cloudflare_radar`、`ioda_internet_health`、`ripe_atlas_internet_health`、`ripe_ris_live`（pulse-host，5 分） | 台灣網路健康（流量、斷線、BGP） | `live.internet_health_*` | 11-16 06:50 | 約 5,500 列／日（observations） | `internetHealthLoader.ts` 只被 `TelecomStatusCard.tsx` 引用；layerManifest 無對應層 | 縣市／ASN 網路健康面量圖或海纜登陸站狀態層（資料多為全國或 ASN 粒度，空間化需設計） |
| `global_climate_cams`／`cmems`／`noaa_gfs`（pulse-host，每日） | 全球大氣化學／海洋／風場模式網格 | `live.global_climate_grids`；S3 各自 archives | 11-16 04:16 | 約 50–100 列／日 | 前端不讀表；由 `global_climate_bake` 烤成 `deploy-assets/climate/*` PNG（S3 head：frames/manifest.json 11-16 04:18、wind10m／dust_latest 04:16，bake 確認在跑），風場／海流／沙塵層讀這些 → 間接已接圖層，**不是缺口**（列此僅供參考） | — |

註：`immigration_apis_airport`（機場入出境）除監看卡外，機場圖層 popup（`infraPanels.tsx`）也讀，歸 (a)。

## 次表：停用或停更
| 收集器 | 狀態 | 證據 |
|---|---|---|
| `vd`、`ship_tdx`、`flight_fr24`、`waste_match`、`parking_ref`、`foursquare_poi`、`gfw_vessel_presence` | cross_layer_map `enabled:false`／deployment disabled | gfw 四張表 0 列；`spatial.parking_*_ref` 最後 2026-07-10；`reference.foursquare_poi` 表不存在 |
| `correctional_daily_snapshot`（VM） | 暫停：上游 2026-05-15 後未更新 | `live.prison_population_daily` 最新 11-07；前端 `PrisonCard`（監看）仍讀 |
| `air_ticket_radar`（外部 openAB，非本 repo） | 寫入端已停 | `air_tickets.fare_offers` 最新 2026-09-08 |
| `env_jp_wbgt` | 季節外（04-29～10-21） | 最新 10-21 15:58，屬預期 |
| `animal_shelter_outcomes`／`pressure`／`veterinary_clinics`／`licensed_pet_businesses`／`protection_offices`（VM） | 月／季／年頻，最新 10-23 | 屬排程內；已有圖層 |
| `earthquake_shakemap_grid` | 心跳正常，但表**目前 0 列**（原因未確認：可能保留期清掉、或上游 event_time 守門一直沒寫） | `live.earthquake_shakemap_grid` max=NULL、n_live_tup=0；前端 earthquakeReplay 有讀 → 重播時網格震度會空，**建議另查** |
| `npa_traffic_accident_a1` | 心跳正常（今日 9,453 筆處理），但 `traffic_accidents_a1.collected_at` 最新 11-09 | 可能是 upsert DO NOTHING 不推進時間，或上游一週無新 A1；**未確認** |
| `global_climate_bake`、`gfw_hourly_publish` | `collector_status` 無心跳列，但產出正常：S3 `deploy-assets/climate/frames/manifest.json` 11-16 04:18；`gfw_hourly_publish_runs` 11-16 00:30 | 兩者都有圖層在讀，非缺口 |

## 已接上（a）
啟用中收集器 96 個（cross_layer_map enabled=true，含 correctional 以外的 VM 收集器）。扣掉 (c) 5 個、(b) 純監看 9 個（tra_train、food_prices、twse、cdc、yt_live、網路健康 4 支）後剩 82 個：其中約 79 個至少有一張表被圖層直接讀（含 popup、事件重播、衍生表鏈；immigration_apis_airport 算在這裡），3 個（CAMS／CMEMS／GFS）經 climate_bake 間接供圖層。

## 附錄：全部收集器清單（步驟 1）

| 收集器 | 中文名 | 執行位置 | 頻率(分) | Supabase 表（最新時間 UTC） | S3／R2 前綴 | 心跳 last_success | 分類 |
|---|---|---|---|---|---|---|---|
| `youbike` | YouBike 站點 | pulse_host | 15 | live.youbike_snapshots（2026-11-16 06:50）; live.youbike_current（2026-11-16 06:50） | youbike/archives/ | 2026-11-16 06:51 | (a) |
| `bus` | 雙北公車位置 | pulse_host | 2 | live.bus_positions（2026-11-16 06:49）; live.bus_current（2026-11-16 06:49） | bus/archives/ | 2026-11-16 06:53 | (a) |
| `bus_intercity` | 公路客運位置 | pulse_host | 2 | live.bus_intercity_positions（2026-11-16 06:50）; live.bus_intercity_current（2026-11-16 06:50） | bus_intercity/archives/ | 2026-11-16 06:54 | (a) |
| `vd` | 車輛偵測器（舊） | disabled | 5 | — | — | 無心跳列 | 停用 |
| `freeway_vd` | 國道車流 | pulse_host | 10 | live.freeway_sections（2026-11-16 06:49）; live.freeway_sections_current（2026-11-16 06:49）; live.freeway_vd_traffic（2026-11-16 06:49） | freeway_vd/archives/ | 2026-11-16 06:49 | (a) |
| `parking` | 路邊停車格 | pulse_host | 15 | live.parking_segments_availability（2026-11-16 06:50）; live.parking_segments_current（2026-11-16 06:50） | parking/archives/ | 2026-11-16 06:50 | (a) |
| `tra_train` | 台鐵列車位置 | pulse_host | 2 | live.train_positions（2026-11-16 06:49） | tra_train/archives/ | 2026-11-16 06:53 | (b) 監看 |
| `tra_static` | 台鐵靜態資料 | pulse_host | 1440 | — | tra_static/archives/ | 2026-11-16 04:14 | (c) |
| `rail_timetable` | 軌道時刻表 | pulse_host | 240 | reference.daily_schedules（2026-11-16 04:14） | rail_timetable/archives/ | 2026-11-16 04:14 | (a) |
| `ship_tdx` | 船舶位置（TDX，舊） | disabled | 2 | — | — | 無心跳列 | 停用 |
| `ship_ais` | 船舶 AIS 位置 | hicloud_vm | 10 | live.ship_positions（2026-11-16 06:50）; live.ship_current（2026-11-16 06:50） | ship_ais/archives/ | 2026-11-16 06:50 | (a) |
| `cwa_marine_observation` | 海象觀測 | pulse_host | 15 | reference.marine_observation_stations（2026-11-16 06:48）; live.marine_observation_readings（2026-11-16 06:48）; live.marine_observation_current（2026-11-16 06:48）; live.marine_observation_quarantine（2026-11-16 06:37） | cwa_marine_observation/archives/ | 2026-11-16 06:52 | (a) |
| `isohe_port_marine` | 港口海象 | hicloud_vm | 10 | reference.marine_observation_stations（2026-11-16 06:48）; live.marine_observation_readings（2026-11-16 06:48）; live.marine_observation_current（2026-11-16 06:48） | isohe_port_marine/archives/ | 無心跳列 | (a) |
| `aisstream` | AISStream 船舶串流 | pulse_host | 1 | live.aisstream_ingest_runs（2026-11-16 04:16）; live.aisstream_archive_manifests（2026-11-16 06:17）; live.aisstream_position_observations（2026-11-16 06:50）; live.aisstream_vessel_current（2026-11-16 06:50）; live.aisstream_ingest_health（2026-11-16 06:49） | aisstream/raw/v1/ | 2026-11-16 06:54 | (a) |
| `gfw_vessel_presence` | GFW 每日船舶（舊） | disabled | 1440 | live.gfw_vessel_presence_runs（—）; live.gfw_vessel_presence_archive_manifests（—）; live.gfw_vessel_presence_snapshots（—）; live.gfw_vessel_presence_current（—） | — | 無心跳列 | 停用 |
| `gfw_hourly_publish` | GFW 逐時船舶發布 | pulse_host | 1440 | live.gfw_hourly_publish_runs（2026-11-16 00:30） | deploy-assets/global-maritime/gfw-hourly/ | 無心跳列 | (a) |
| `flight_fr24` | 航班位置（FR24） | disabled | 5 | live.flight_positions（2026-11-16 06:49）; live.flight_trails（—） | flight_fr24/archives/ | 無心跳列 | 停用 |
| `flight_fr24_zone` | 航班位置（FR24 區域） | pulse_host | 5 | live.flight_positions（2026-11-16 06:49） | flight_fr24_zone/archives/ | 2026-11-16 06:50 | (a) |
| `flight_opensky` | 航班位置（OpenSky） | pulse_host | 5 | live.flight_positions（2026-11-16 06:49） | flight_opensky/archives/ | 2026-11-16 06:54 | (a) |
| `weather` | 氣象觀測 | pulse_host | 60 | live.weather_observations（2026-11-16 06:26）; live.weather_current（2026-11-16 06:00） | weather/archives/ | 2026-11-16 06:26 | (c) |
| `temperature` | 溫度網格 | pulse_host | 60 | live.temperature_grids（2026-11-16 06:22） | temperature/archives/ | 2026-11-16 06:22 | (a) |
| `cwa_satellite` | 氣象署衛星雲圖 | pulse_host | 10 | live.cwa_imagery_frames（2026-11-16 06:40） | cwa_satellite/archives/ | 2026-11-16 06:49 | (a) |
| `earthquake` | 地震報告 | pulse_host | 15 | live.earthquake_events（2026-11-16 04:39）; live.earthquake_station_obs（2026-11-16 04:49）; live.tsunami_alerts（2026-10-24 03:44） | earthquake/archives/ | 2026-11-16 06:49 | (a) |
| `earthquake_catalog` | 地震目錄 | pulse_host | 1440 | live.earthquake_events（2026-11-16 04:39） | earthquake_catalog/archives/ | 2026-11-16 04:14 | (a) |
| `earthquake_town_intensity` | 鄉鎮震度 | pulse_host | 15 | live.earthquake_town_intensity（2026-11-16 00:10） | earthquake_town_intensity/archives/ | 2026-11-16 06:48 | (a) |
| `earthquake_shakemap_grid` | 震度網格圖 | pulse_host | 15 | live.earthquake_shakemap_grid（—） | earthquake_shakemap_grid/archives/ | 2026-11-16 06:47 | (a) |
| `earthquake_moment_tensor` | 震源機制解 | pulse_host | 30 | live.earthquake_moment_tensor（2026-11-16 00:11） | earthquake_moment_tensor/archives/ | 2026-11-16 06:48 | (a) |
| `ncdr_alerts` | 災害示警 | pulse_host | 15 | live.disaster_alerts（2026-11-16 06:47） | ncdr_alerts/archives/ | 2026-11-16 06:47 | (a) |
| `cloudflare_radar` | 網路健康（Cloudflare） | pulse_host | 5 | live.internet_health_source_runs（2026-11-16 06:50）; live.internet_health_observations（2026-11-16 06:50）; live.internet_health_current（2026-11-16 06:50）; live.internet_health_incidents（—） | cloudflare_radar/archives/ | 2026-11-16 06:50 | (b) 監看 |
| `ioda_internet_health` | 網路健康（IODA） | pulse_host | 5 | live.internet_health_source_runs（2026-11-16 06:50）; live.internet_health_observations（2026-11-16 06:50）; live.internet_health_current（2026-11-16 06:50）; live.internet_health_incidents（—） | ioda_internet_health/archives/ | 2026-11-16 06:50 | (b) 監看 |
| `ripe_atlas_internet_health` | 網路健康（RIPE Atlas） | pulse_host | 5 | live.internet_health_source_runs（2026-11-16 06:50）; live.internet_health_observations（2026-11-16 06:50）; live.internet_health_current（2026-11-16 06:50） | ripe_atlas_internet_health/archives/ | 2026-11-16 06:52 | (b) 監看 |
| `ripe_ris_live` | 網路路由（RIPE RIS） | pulse_host | 5 | live.internet_health_source_runs（2026-11-16 06:50）; live.internet_health_observations（2026-11-16 06:50）; live.internet_health_current（2026-11-16 06:50） | ripe_ris_live/raw/v1/ | 2026-11-16 06:55 | (b) 監看 |
| `news_events` | 新聞事件 | pulse_host | 20 | live.news_events（2026-11-16 06:51） | news_events/archives/ | 2026-11-16 06:51 | (a) |
| `global_events` | 全球事件（GDELT） | pulse_host | 60 | intel.global_event_collector_batches（—）; intel.global_event_collector_run_receipts（2026-11-16 06:23）; intel.global_event_candidate_observations（2026-11-16 06:23） | global_events/handoff/ | 2026-11-16 06:23 | (a) |
| `satellite` | 衛星位置 | pulse_host | 120 | live.satellite_positions（2026-11-16 06:19）; live.satellite_current（2026-11-16 06:19）; live.satellite_tle（2026-11-16 06:19）; live.satellite_tle_history（2026-11-16 06:19） | satellite/archives/ | 2026-11-16 06:20 | (a) |
| `launch` | 火箭發射 | pulse_host | 15 | live.launches（2026-11-16 06:50）; live.launch_events（2026-11-16 06:35）; live.launch_pads（2026-11-16 04:50） | launch/archives/ | 2026-11-16 06:50 | (c) |
| `air_quality` | 空氣品質 | pulse_host | 60 | live.air_quality_observations（2026-11-16 06:25）; live.air_quality_current（2026-11-16 06:00） | air_quality/archives/ | 2026-11-16 06:25 | (a) |
| `air_quality_imagery` | 空品影像 | pulse_host | 60 | live.aqi_imagery_frames（2026-11-16 06:12） | air_quality_imagery/archives/ | 2026-11-16 06:19 | (a) |
| `air_quality_microsensors` | 空品微型感測器 | pulse_host | 5 | live.micro_sensor_readings（2026-11-16 06:47） | air_quality_microsensors/archives/ | 2026-11-16 06:53 | (a) |
| `water_reservoir` | 水庫水情 | pulse_host | 60 | live.reservoir_status（2026-11-16 06:00） | water_reservoir/archives/ | 2026-11-16 06:28 | (a) |
| `water_reservoir_daily_ops` | 水庫每日營運 | pulse_host | 1440 | live.reservoir_daily_ops（2026-11-15 00:00） | water_reservoir_daily_ops/archives/ | 2026-11-16 04:14 | (a) |
| `river_water_level` | 河川水位 | pulse_host | 10 | live.river_water_level（2026-11-16 06:40） | river_water_level/archives/ | 2026-11-16 06:50 | (a) |
| `rain_gauge_realtime` | 雨量站 | pulse_host | 10 | live.rain_gauge_readings（2026-11-16 06:40） | rain_gauge_realtime/archives/ | 2026-11-16 06:50 | (a) |
| `groundwater_level` | 地下水位 | pulse_host | 60 | live.groundwater_level_readings（2026-11-16 06:20） | groundwater_level/archives/ | 2026-11-16 06:20 | (a) |
| `wra_drought_alert` | 旱災水情燈號 | pulse_host | 43200 | public.drought_alert_history（2026-05-15 09:30）; public.drought_alert_current（2026-05-15 09:30） | wra_drought_alert/archives/ | 2026-11-16 04:14 | (c) |
| `iot_wra` | 水利署 IoT 感測 | pulse_host | 10 | live.iot_wra_measurements（2026-11-16 06:40） | iot_wra/archives/ | 2026-11-16 06:50 | (a) |
| `uswg` | 水利署淹水感測 | pulse_host | 10 | live.uswg_measurements（2026-11-16 07:00） | uswg/archives/ | 2026-11-16 06:51 | (a) |
| `road_event_live` | 即時路況事件 | pulse_host | 5 | live.road_events（2026-11-16 06:49）; live.road_events_current（2026-11-16 06:49） | road_event_live/archives/ | 2026-11-16 06:49 | (a) |
| `road_event_planned` | 道路施工計畫 | pulse_host | 720 | live.road_events（2026-11-16 06:49）; live.road_events_current（2026-11-16 06:49） | road_event_planned/archives/ | 2026-11-16 04:15 | (a) |
| `waste_positions` | 垃圾車位置 | hicloud_vm | 2 | spatial.waste_positions_realtime（2026-11-16 06:49） | waste_positions/archives/ | 2026-11-16 06:54 | (a) |
| `cdc_public_health_weekly` | 疾管署每週疫情 | hicloud_vm | 10080 | live.public_health_weekly（2026-11-12 03:00） | cdc_public_health_weekly/archives/ | 2026-11-12 03:00 | (b) 監看 |
| `waste_match` | 垃圾車路線比對 | disabled | 5 | — | waste_match/archives/ | 無心跳列 | 停用 |
| `er_hospital_realtime` | 急診壅塞 | pulse_host | 15 | live.er_hospital_status（2026-11-16 06:45）; live.er_hospital_current（2026-11-16 06:45） | er_hospital_realtime/archives/ | 2026-11-16 06:50 | (a) |
| `power_taipower` | 台電供電 | pulse_host | 10 | live.power_system_status（2026-11-16 06:40）; live.power_generation_unit（2026-11-16 06:30）; live.power_region_demand（2026-11-16 06:30） | power_taipower/archives/ | 2026-11-16 06:51 | (a) |
| `foursquare_poi` | Foursquare 地點 | disabled | 43200 | reference.foursquare_poi（—） | foursquare_poi/archives/ | 無心跳列 | 停用 |
| `correctional_daily_snapshot` | 矯正機關收容人數 | disabled | 1440 | live.prison_population_daily（2026-11-07 03:15） | correctional_daily_snapshot/archives/ | 2026-11-07 03:15 | 停用 |
| `animal_adoption` | 動物認領養 | hicloud_vm | 1440 | live.animal_adoption_snapshot_runs（2026-11-16）; live.animal_adoption_snapshots（2026-11-16）; live.animal_adoption_current（2026-11-15 16:53）; analytics.animal_adoption_daily（2026-11-16） | animal_adoption/archives/ | 2026-11-15 16:53 | (a) |
| `animal_shelter_outcomes` | 收容所成果月報 | hicloud_vm | 43200 | live.animal_shelter_outcome_runs（2026-10-23）; live.animal_shelter_outcomes（2026-10-23） | animal_shelter_outcomes/archives/ | 2026-10-23 04:46 | (a) |
| `animal_shelter_pressure` | 收容壓力月報 | hicloud_vm | 43200 | live.animal_shelter_outcome_runs（2026-10-23）; live.animal_shelter_outcomes（2026-10-23） | animal_shelter_pressure/archives/ | 2026-10-23 04:46 | (a) |
| `animal_veterinary_clinics` | 動物醫院 | hicloud_vm | 259200 | live.animal_welfare_point_runs（2026-10-23）; live.animal_welfare_point_snapshots（2026-10-23） | animal_veterinary_clinics/archives/ | 2026-10-23 04:46 | (a) |
| `animal_licensed_pet_businesses` | 寵物業者 | hicloud_vm | 525600 | live.animal_welfare_point_runs（2026-10-23）; live.animal_welfare_point_snapshots（2026-10-23） | animal_licensed_pet_businesses/archives/ | 2026-10-23 04:46 | (a) |
| `animal_protection_offices` | 動保處 | hicloud_vm | 129600 | live.animal_welfare_point_runs（2026-10-23）; live.animal_welfare_point_snapshots（2026-10-23） | animal_protection_offices/archives/ | 2026-10-23 04:46 | (a) |
| `global_climate_bake` | 全球氣候烤圖 | pulse_host | 360 | — | deploy-assets/climate/frames/ | 無心跳列 | (a) |
| `global_climate_cams` | 全球空品模式（CAMS） | pulse_host | 1440 | live.global_climate_grids（2026-11-16 04:15） | global_climate_cams/archives/ | 2026-11-16 04:16 | (a) 間接（bake） |
| `global_climate_cmems` | 全球海洋模式（CMEMS） | pulse_host | 1440 | live.global_climate_grids（2026-11-16 04:15） | global_climate_cmems/archives/ | 2026-11-16 04:17 | (a) 間接（bake） |
| `global_climate_jma_typhoon` | 颱風路徑（日本氣象廳） | pulse_host | 1440 | live.typhoon_positions（2026-11-16 00:14） | global_climate_jma_typhoon/archives/ | 2026-11-16 04:15 | (a) |
| `global_climate_jtwc` | 颱風路徑（JTWC） | pulse_host | 1440 | live.typhoon_positions（2026-11-16 00:14） | global_climate_jtwc/archives/ | 2026-11-16 04:15 | (a) |
| `global_climate_noaa_gfs` | 全球氣象模式（GFS） | pulse_host | 1440 | live.global_climate_grids（2026-11-16 04:15） | global_climate_noaa_gfs/archives/ | 2026-11-16 04:16 | (a) 間接（bake） |
| `global_climate_usgs_earthquake` | 全球地震（USGS） | pulse_host | 60 | live.earthquakes_global（2026-11-16 06:16） | global_climate_usgs_earthquake/archives/ | 2026-11-16 06:16 | (a) |
| `immigration_apis_airport` | 機場出入境人數 | hicloud_vm | 60 | live.border_airport_snapshot（2026-11-16 06:07） | immigration_apis_airport/archives/ | 2026-11-16 06:07 | (a) |
| `lightning_events` | 落雷 | pulse_host | 1440 | live.lightning_events（2026-11-15 21:46） | lightning_events/archives/ | 2026-11-16 06:47 | (a) |
| `npa_traffic_accident_a1` | A1 死亡車禍 | pulse_host | 720 | live.traffic_accidents_a1（2026-11-09 08:03） | npa_traffic_accident_a1/archives/ | 2026-11-16 04:15 | (a) |
| `nuclear_radiation` | 核設施輻射 | pulse_host | 15 | live.nuclear_radiation_measurements（2026-11-16 06:50）; live.nuclear_radiation_stations（2026-11-16 06:48） | nuclear_radiation/archives/ | 2026-11-16 06:48 | (a) |
| `parking_offstreet` | 停車場剩餘車位 | pulse_host | 15 | live.parking_lots_availability（2026-11-16 06:48）; live.parking_lots_current（2026-11-16 06:48） | parking_offstreet/archives/ | 2026-11-16 06:48 | (a) |
| `parking_ref` | 停車靜態座標 | disabled | 43200 | spatial.parking_segments_ref（2026-07-10 12:16）; spatial.parking_lots_ref（2026-07-10 12:16） | — | 無心跳列 | 停用 |
| `pla_activity_daily` | 共機動態 | pulse_host | 1440 | live.pla_activity_daily（2026-11-16 06:47） | pla_activity_daily/archives/ | 2026-11-16 06:47 | (a) |
| `pla_tracks_vectorize` | 共機航跡向量化 | pulse_host | 1440 | spatial.pla_tracks（—）; live.pla_activity_items（—）; spatial.pla_tracks_runs（2026-11-16 02:51） | pla/track_charts/ | 2026-11-16 04:15 | (a) |
| `precipitation_raster` | 雨量柵格 | pulse_host | 120 | live.precipitation_raster_frames（2026-11-16 06:29） | precipitation_raster/archives/ | 2026-11-16 06:29 | (a) |
| `road_congestion` | 道路壅塞 | pulse_host | 5 | live.road_sections_live（2026-11-16 06:51）; live.road_sections_current（2026-11-16 06:51） | road_congestion/archives/ | 2026-11-16 06:51 | (a) |
| `satellite_passes_daily` | 衛星過境預報 | pulse_host | 1440 | — | satellite_passes_daily/archives/ | 2026-11-16 04:15 | (a) |
| `tourist_shuttle` | 觀光接駁車 | pulse_host | 2 | live.tourist_shuttle_positions（2026-11-16 06:51）; live.tourist_shuttle_current（2026-11-16 06:51） | tourist_shuttle/archives/ | 2026-11-16 06:55 | (a) |
| `twse_market_index` | 台股指數 | pulse_host | 1440 | live.market_index_tick（2026-11-16 05:33）; live.market_index_current（2026-11-16 06:50） | twse_market_index/archives/ | 2026-11-16 06:54 | (b) 監看 |
| `wic_evacuate` | 臺北疏散門 | pulse_host | 10 | live.taipei_evacuate_status（2026-11-16 06:40） | wic_evacuate/archives/ | 2026-11-16 06:49 | (a) |
| `wic_pumb` | 臺北抽水站 | pulse_host | 10 | live.taipei_pumb_status（2026-11-16 06:46） | wic_pumb/archives/ | 2026-11-16 06:51 | (a) |
| `wic_sewer` | 臺北下水道水位 | pulse_host | 10 | live.taipei_sewer_measurements（2026-11-16 06:49） | wic_sewer/archives/ | 2026-11-16 06:50 | (a) |
| `yt_live_video_resolver` | YouTube 直播 | pulse_host | 5 | live.yt_live_history（2026-11-16 06:50）; live.yt_live_current（2026-11-16 06:50） | yt_live_video_resolver/archives/ | 2026-11-16 06:55 | (b) 監看 |
| `tpml_seat` | 北市圖座位 | pulse_host | 10 | live.tpml_seat_status（2026-11-16 06:47）; live.tpml_seat_current（2026-11-16 06:47） | tpml_seat/archives/ | 2026-11-16 06:47 | (a) |
| `food_prices` | 農產品批發價 | hicloud_vm | 1440 | live.food_price_daily（2026-11-13 16:53） | food_prices/archives/ | 2026-11-15 16:53 | (b) 監看 |
| `lightning_cwa` | 落雷（氣象署） | pulse_host | 5 | live.lightning_events（2026-11-15 21:46） | lightning_cwa/archives/ | 2026-11-16 06:51 | (a) |
| `nusc_gamma_radiation` | 環境輻射 | pulse_host | 15 | live.nusc_gamma_measurements（2026-11-16 06:40）; live.nusc_gamma_stations（2026-11-16 06:49） | nusc_gamma_radiation/archives/ | 2026-11-16 06:49 | (a) |
| `water_effluent_monitoring` | 放流水監測 | pulse_host | 60 | live.water_effluent_readings（2026-11-16 06:25）; live.water_effluent_current（2026-11-16 06:51） | water_effluent_monitoring/archives/ | 2026-11-16 06:51 | (a) |
| `cems_stack_monitoring` | 煙道排放監測 | pulse_host | 60 | live.cems_stack_readings（2026-11-16 05:00）; live.cems_stack_current（2026-11-16 06:26） | cems_stack_monitoring/archives/ | 2026-11-16 06:26 | (a) |
| `cwa_uv_daily` | 紫外線日最大值 | pulse_host | 720 | live.cwa_uv_daily（2026-11-16 04:15） | cwa_uv_daily/archives/ | 2026-11-16 04:15 | (a) |
| `jma_amedas` | 日本 AMeDAS 氣象站 | pulse_host | 10 | live.jma_amedas_current（2026-11-16 06:46）; live.jma_amedas_observations（2026-11-16 06:06） | jma_amedas/archives/, weather-obs/jma/amedas/ | 2026-11-16 06:46 | (a) |
| `jma_warnings` | 日本警報・注意報 | pulse_host | 720 | live.jma_warning_events（2026-11-16 06:44） | jma_warnings/archives/ | 2026-11-16 06:44 | (a) |
| `jma_quake` | 日本地震・海嘯・火山 | pulse_host | 1440 | live.jma_quake_reports（2026-11-16 04:34）; live.jma_tsunami_reports（2026-11-06 10:56）; live.jma_volcano_warnings（2026-11-04 01:03） | jma_quake/archives/ | 2026-11-16 04:34 | (a) |
| `jma_seasonal` | 日本季節觀測 | pulse_host | 1440 | live.jma_phenology_observations（2026-11-16 05:18）; live.jma_snowcap（2026-11-10 00:28）; live.jma_snowcap_status（2026-11-16 05:00）; live.jma_rainy_season（2026-10-12 08:09） | jma_seasonal/archives/ | 2026-11-16 06:18 | (a) |
| `jma_raster` | 日本氣象網格圖 | pulse_host | 60 | live.weather_raster_frames（2026-11-16 06:22）; live.weather_raster_daily（2026-11-16 01:10） | jma_raster/archives/, weather-raw/jma/, weather-daily/jma/, weather-grid/jma/ | 2026-11-16 06:17 | (a) |
| `jma_ocean_env` | 日本海洋環境網格 | pulse_host | 60 | live.weather_raster_frames（2026-11-16 06:22）; live.weather_raster_daily（2026-11-16 01:10） | jma_ocean_env/archives/, weather-raw/jma/sst_him/, weather-grid/jma/sst_him/, we | 2026-11-16 06:22 | (a) |
| `jma_lightning` | 日本落雷 | pulse_host | 1440 | live.lightning_events（2026-11-15 21:46） | jma_lightning/archives/ | 2026-11-15 21:51 | (a) |
| `jma_forecast` | 日本天氣預報 | pulse_host | 720 | live.jma_forecasts（2026-11-16 02:52）; live.jma_forecast_probabilities（2026-11-16 02:52） | jma_forecast/archives/ | 2026-11-16 02:52 | (c) |
| `env_jp_wbgt` | 日本熱中症指數 | pulse_host | 120 | live.env_jp_wbgt_observations（2026-10-21 15:58）; live.env_jp_wbgt_forecasts（2026-10-21 15:58） | env_jp_wbgt/archives/ | 2026-10-21 15:58 | (a) |
| `global_climate_cwa_typhoon` | 颱風路徑（氣象署） | pulse_host | 1440 | live.typhoon_positions（2026-11-16 00:14） | global_climate_cwa_typhoon/archives/ | 2026-11-16 06:24 | (a) |
| `global_climate_ncdr_typhoon_routes` | 颱風預報（NCDR 多國） | pulse_host | 1440 | live.typhoon_agency_forecasts（2026-11-11 15:26） | global_climate_ncdr_typhoon_routes/archives/ | 2026-11-16 06:47 | (a) |
