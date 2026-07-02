# Data Scope

**最後更新**：2026-05-25（農業 +公司登記 3 類）

盤點專案持有的資料範圍：Supabase DB、前端靜態 GeoJSON、S3 deploy-assets。
更新時機：新 collector 上線 / 新 seed 跑完 / 新前端圖層接入後。

## 水資源 — 時序（Supabase realtime schema）

| 表 | 粒度 | 筆數 / 覆蓋 | 時間深度 |
|---|---|---|---|
| `realtime.reservoir_status` | 每小時 | 40 座水庫（37 有即時） | 2026-04-17+（~5 天）|
| `realtime.reservoir_daily_ops` | 每日 09:30 | 40 座 | 2026-04-18+（~4 天）|
| `realtime.rain_gauge_readings` | 10 分鐘 | 1,310 站 | 2026-04-19+（~3 天，525k 筆）|
| `realtime.river_water_level` | 10 分鐘 | 373 站 | **2025-12-14+（~4 個月！）** |
| `realtime.groundwater_level_readings` | 每小時 | 786 站 | 2026-04-20+（~2 天）|
| `realtime.iot_wra_measurements` | 10 min（每 60min collector 取 6 筆）| **2,800 站 / 7 類型** | 2021-04+（5 年；7 天 retention by migration 062）|
| `realtime.iot_wra_latest` (063 預聚合) | refresh 10 min | ~4k rows = 站 × 測項 | 跟 measurement 同步 |
| `realtime.iot_wra_daily` (063 預聚合) | refresh 20 min today+yesterday | ~4k rows × 7 天，timeline 字串編碼 | 7 天保留 |

> 最長歷史是河川水位（~4 個月）+ iot_wra（5 年但只保 7 天）。其他 collectors 今年 4 月才開跑。
> **iot_wra collector 已停 groundwater 子端點**（2026-04-26，跟 old 95% 重複；iot_wra.py L42 已 comment）。

## 水資源 — 靜態（Supabase public + reference）

| 表 | 筆數 | 幾何 | 前端用 |
|---|---|---|---|
| `public.water_reservoirs` | 40 | lat/lng | ✅ water_reservoirs.geojson |
| `public.reservoir_storage` | 129 | MultiPolygon | ✅ water_reservoirs.geojson（蓄水範圍） |
| `public.dam_weirs_wra` | 98 | Point | ✅ water_dams.geojson |
| `public.water_facilities` | 待盤點 | Point | ✅ water_facilities.geojson |
| `public.water_monitoring_stations` | 待盤點 | Point | ✅ water_monitor_stations.geojson |
| `public.irrigation_canals` | 宜蘭完整+OSM | LineString | ✅ water_canals.geojson |
| `public.river_lines` | 2,015 | LineString（含 2,445km outlier）| ✅ water_rivers.geojson |
| `public.river_polygons` | 待盤點 | MultiPolygon | ✅ water_river_polygons.geojson |
| `public.river_basins` | 116 | MultiPolygon | ✅ water_basins.geojson |
| `public.flood_hazard_zones` | **17,303** | MultiPolygon | ⚠ 前端只用單情境 650mm（BL-4 待升級多情境） |
| `public.river_levees` | **4,223** | MultiLineString | ❌ **DB 有前端無**（BL-1）|
| `public.water_protection_zones` | **107** | MultiPolygon | ❌ **DB 有前端無**（BL-2）|
| `public.groundwater_zones` | **21** | MultiPolygon | ❌ **DB 有前端無**（BL-3）|
| `public.water_resource_zones` | 4 | MultiPolygon | ❌ 邊際效益低（僅 4 分區）|
| `public.water_structures` | OSM 稀疏 | Geometry | ❌ 資料不夠好 |
| `public.river_stations` | **0** | — | ❌ **空表**（警戒水位 seed 缺）|
| `reference.reservoir_geometry` | 98（49 有 compare_id，15 有淤積）| Point+淤積欄位 | RPC 驅動 |
| `reference.reservoir_watershed` | 80（53 有 compare_id） | MultiPolygon | RPC 驅動 |

## 水資源 — RPC（public schema，前端入口）

| RPC | Migration | 用途 | 效能 |
|---|---|---|---|
| `get_reservoir_status_latest()` | 047 | 全庫最新水位/蓄水率 | |
| `get_reservoir_status_day(date)` | 047/056 | 當日每小時時序 | |
| `get_reservoir_timeseries(id, from, to)` | 047/056 | 單庫歷史 | |
| `get_reservoir_context(compare_id)` | 052 | 一站式 JSON：水庫+狀態+集水區+河網 | ~219ms |
| `get_reservoir_watershed_rivers(compare_id)` | 053 | 集水區內完整河網（ST_Intersection） | 1.5~2s |
| `get_rain_gauge_latest()` | 054 | 雨量站最新 | 160ms |
| `get_rain_gauge_timeseries(id, from, to)` | 054 | 雨量站歷史 | |
| `get_rain_gauge_day(date)` | 057 | 當日每小時 | 398ms / 19k 筆 |
| `get_river_water_level_latest()` | 055 | 河川水位最新 | 64ms |
| `get_river_water_level_timeseries(id, from, to)` | 055 | 河川水位歷史 | |
| `get_river_water_level_day(date)` | 057 / **060b** | 當日每站每小時 1 筆（降頻避 20K cap）| ~200ms / **~8k 筆** |
| `get_groundwater_latest()` | 058 / **060** | 地下水井最新 + delta_24h | ~500ms / ~762 筆 |
| `get_groundwater_day(date)` | 058 / **060** | 當日每站每小時 1 筆（降頻避 20K cap）| ~300ms / **~16.5k 筆** |
| `get_groundwater_timeseries(id, from, to)` | 058 | 單井歷史區間（panel 預留）| |
| `get_iot_wra_latest(station_type)` | 061 / **063** | iot_wra 每站每測項最新 + delta_since_day_start | ~50ms / 直讀 latest 表 |
| `get_iot_wra_day(date, station_type)` | **063** | iot_wra 當日 timeline（字串編碼，每小時 1 timepoint）| ~100ms / ~4k rows |
| `get_iot_wra_timeseries(uuid, from, to)` | 061 | iot_wra 單站歷史區間 | |
| `reservoir_situation_v` (view) | 022/056 | 蓄水率 + alert_level（分母用 current_capacity） | |

> **PostgREST db-max-rows=20000 cap** — 2026-04-25 兩次踩到（groundwater 78K、river 44K 原始）。
> 新 RPC 預估 rows > 15K 一律套 DISTINCT ON hourly 降頻（PRINCIPLES / PB-08）。

## 廢棄物 — 時序（Supabase realtime schema）

| 表 | 粒度 | 筆數 / 覆蓋 | 時間深度 |
|---|---|---|---|
| `spatial.waste_positions_realtime` | 每 2 分鐘（高雄、台南）/ 每日整批（新北凍結式）| 高雄 ~330 車/天 / 台南 ~183 車/天 / 新北 ~12 車 | 7 天 retention（migration 070）|
| `realtime.waste_trails_matched_daily` | 每 5 分鐘 collector 跑 OSRM 寫入 | 高雄 5/4-5/9 共 ~2,000 rows / ~1,100 vehicle-days / avg confidence 0.74 | 7 天 retention（migration 074 cron 04:18）|
| `realtime.waste_match_attempts` | 每 trip 嘗試後寫一筆 | ~3,280 attempts（5/4-5/9）/ 46% success / 54% fail (NoMatch / low confidence) | 7 天 retention（migration 075 cron 04:20）|

## 廢棄物 — 靜態（Supabase spatial schema）

| 表 | 筆數 | 幾何 | 用途 |
|---|---|---|---|
| `spatial.waste_collection_stops` | **77,125（5/10 更新）** | Point | 停運點（高雄 32K / 新北 27K / 宜蘭 12K / 臺北 4K / 基隆 2K）|
| `spatial.waste_collection_routes` | **2,048**（高雄 1399 / 新北 649） | LineString | 路線（北/基/宜 0% 待 OSRM 補 — BL-17）|
| `spatial.waste_facilities` | 16 / 463 待 geocode | Point | 焚化爐/掩埋場/轉運站 |
| `spatial.waste_disposal_points` | 待盤點 | Point | 大型廢棄物清除點（migration 068）|

### Schedule routes 5 城分布（dow=4 週四）

| 城 | schedule routes | route LineString 覆蓋 |
|---|---|---|
| 高雄市 | 360 | 99.6%（752/755 全城）|
| 新北市 | 579 | 100%（649 條）|
| 臺北市 | 187 | **0%**（待 OSRM 補）|
| 基隆市 | 63 | **0%**（待 OSRM 補）|
| 宜蘭縣 | 75 | **0%**（待 OSRM 補）|
| **合計 dow=4** | **1,281** | 1401 / 1283 = **109%** 過半 |

## 廢棄物 — RPC（public schema）

| RPC | Migration | 用途 | 效能 |
|---|---|---|---|
| `get_waste_current(cities)` | 069 | 每車最新 30 分內 GPS | < 1s |
| `get_waste_routes(city)` | 069 | 路線 LineString | < 1s |
| `get_waste_stops(city)` | 069 | 停運點 | < 1s |
| `get_waste_facilities()` | 069 | 焚化爐/掩埋場 | < 1s |
| `get_waste_trails(cities, since_min)` | 071 | 近 N 分鐘 trail（含去噪 + stop snapping） | 105ms |
| `get_waste_trails_day(date, cities)` | 072 | 整日 trail（timeline 字串編碼） | < 1s |
| **`get_waste_trails_matched_day(date, cities)`** | **074** | OSRM matched 整日 polyline + progress timeline | < 1s |
| **`get_waste_schedule_day(cities, dow)`** | **079** | 表定時刻表（grouped per-route，stops JSONB array）| < 2s |

> ⚠ migration 079 用 grouped JSONB 結構（per-route 一筆 row，stops JSONB array），
> 避 PostgREST 20K row cap。flat row 設計 39K rows 會被切到 20K，林口/臺北/高雄
> 整片資料丟失。詳見 PRINCIPLES「Supabase PostgREST 20K cap」+ PB-13。

## 廢棄物 — 跨 repo 部署

| 元件 | Repo / 位置 | 用途 |
|---|---|---|
| `waste_positions` collector | data-collectors/collectors/waste_positions.py | 抓政府 GPS API 寫 spatial 表 |
| `waste_match` collector | data-collectors/collectors/waste_match.py | 跑 OSRM /match 寫 realtime 表 |
| osrm-taiwan service | [github.com/ianlkl11234s/osrm-taiwan](https://github.com/ianlkl11234s/osrm-taiwan) | OSRM HTTP server (Zeabur, agent_test) |
| osrm-proxy service | [github.com/ianlkl11234s/osrm-proxy](https://github.com/ianlkl11234s/osrm-proxy) | nginx Bearer token gateway (Zeabur public) |
| 前端 layer | mini-taiwan-pulse/src/hooks/useWasteLayer.ts | replay 優先讀 matched，fallback v1 GPS trail |

## 農業（public/agriculture/，2026-05-23 上線）

PMTiles + GeoJSON，由 S3 deploy-assets 管理（**.gitignore 排除**，~215MB）。
資料源：`taipei-gis-analytics/data/processed/agriculture/`。

| 檔案 | 大小 | layer name | 來源 dataset | rows | minzoom | keep_attrs（PMTiles）|
|---|---:|---|---:|---:|---:|---|
| `ftw_fields_2025.pmtiles` | 102 MB | `fields` | FTW | 386,829 | 5-14 | `confidence_mean` |
| `soil_map_national.pmtiles` | 27 MB | `soil` | 25539 | 57,646 | 6-13 | 圖幅名稱/地區/調查區/土類/土系/土型/表土質地/坡度相 |
| `soil_fertility_grid_250m.pmtiles` | 31 MB | `soil_fertility` | 112848 | 134,998 | 8-14 | pH_H2O/OM_OMU/CEC/M3_P/M3_K |
| `crop_suitability_132.pmtiles` | 74 MB | `crop_suitability` | 7294 | 833,086 | 6-13 | crop_layer_id/crop_name_zh/crop_name_en/kind/kind_label |
| `leisure_farm_zones_2025.pmtiles` | 0.4 MB | `leisure_farm_zones` | 9809 | 109 | 6-13 | 休區名/LANAME/KeyCode/AA45/AA46 |
| `rural_regen_communities_2025.pmtiles` | 2.4 MB | `rural_regen_communities` | 176846 | 1,109 | 7-13 | 社區名/計畫名/縣市/鄉鎮/村里/分署/核定時/計畫年/NOTE |
| `agriculture_pois.geojson` | 0.3 MB | (GeoJSON 直 fetch) | 177247+245+246 | 840 | — | row_id/poi_type/poi_name/source_dataset_id/TOWNID/AA45/AA46/lon/lat |
| `agri_retail_companies.geojson` | 21 MB | (overlayRegistry geojson) | 45618 | 37,430 | 8 | business_type/公司名稱/負責人/公司地址/資本總額/公司狀態/統一編號/lon/lat |
| `produce_wholesale_companies.geojson` | 13 MB | (overlayRegistry geojson) | 蔬果批發 | 22,843 | 8 | 同上 |
| `agri_wholesale_market_companies.geojson` | 31 KB | (overlayRegistry geojson) | 批發市場 | 53 | 6 | 同上 |

### Layer key 對應（LayerVisibility）
- `agriculture` = FTW 田區（既有，不接 click，僅 confidence）
- `agriSoil` = 全台土壤分類
- `agriSoilFertility` = 土壤肥力 250m 網格（6 metric 著色切換）
- `agriLeisureFarmZones` = 休閒農業區
- `agriRuralRegen` = 農村再生社區
- `agriCropSuitability` = 132 種作物適栽
- `agriPOI` = 三合一 POI（休農場 / 田媽媽 / 特色農旅）
- `agriRetail` / `agriProduceWholesale` / `agriWholesaleMarket` = 農企業登記 3 類（2026-05-25 加，
  business_type 區分：retail / produce_wholesale / wholesale_market；共 60,326 點 / ~34MB
  eager 載入）。Supabase 目標表 `spatial.agri_business_registrations`（overwrite）。
  **走 overlayRegistry 非 agricultureLayerFactory**（大型 geojson 散點比照 fireHydrants）。
  失敗清單 `taipei-gis-analytics/data/intermediate/tgos/agri_companies/_geocode_failed.csv`（562 筆查無座標）

### 重要踩坑

- **PMTiles `keep_attrs` 漏欄位 = 前端 panel 空白**：tippecanoe 預設只保留 `-y` 指定欄位
  （所有其他屬性丟掉）。要前端 click popup 顯示什麼，
  `taipei-gis-analytics/pipelines/agriculture/_batch_download/06_export_frontend.py` 的
  `keep_attrs` 必須先有，重出後手動 `cp` 到 `public/agriculture/`
- **soil_fertility 多數 grid CEC/M3_P/M3_K = 0 不是真零**：134K 網格中許多只測 pH + OM，
  CEC/M3 系列是「未測」。前端統一視 0 為灰色「無資料」，避免誤導
- **作物適栽 132 種 zh 名 8 筆 "(unmatched)"**：aspara/bigatem/macada/marush/malabar/passion/snapbea/vegetsoy，
  dropdown 退化用 en 名兜底

## 前端靜態 GeoJSON（public/geo/）

```
water_basins.geojson           流域 polygon（已顯示）
water_rivers.geojson           河川 line（已顯示）
water_river_polygons.geojson   寬河道 polygon（已顯示）
water_canals.geojson           灌溉渠道（已顯示）
water_dams.geojson             壩體點位（已顯示，帶 compare_id）
water_reservoirs.geojson       水庫蓄水範圍 polygon（已顯示，帶 compare_id）
water_facilities.geojson       水利設施（已顯示）
water_monitor_stations.geojson 監測站（已顯示）
water_flood_extreme.geojson    650mm/24h 淹水潛勢（已顯示，單情境）
```

其他專案靜態 GeoJSON（非水資源）：`airports.geojson`、`port-polygons.geojson`、
`station-points-*.geojson`、`bike-stations-*.geojson`、`weather-stations.geojson`、
`submarine-cables.geojson` 等。

## 3D 視覺元件（Three.js scenes）

| Scene | 物件類型 | 資料源 | Active 事件 |
|---|---|---|---|
| `FlightScene` | 3,000+ 飛機 InstancedMesh | OpenSky 空域快照 | timeline 切日 |
| `RailScene` | 多組列車 Mesh | `reference.daily_schedules` | 時刻表 cycle |
| `BusScene` | 公車 InstancedMesh | TDX + trails matview | timeline 驅動 |
| `ReservoirScene` | 40 水位計（shell + water）+ 點選後雙排日柱 | `get_reservoir_status_day` + `get_reservoir_timeseries` | click reservoir |
| `StationPillarScene` | 車站 / 機場 / 港口光柱 | `station_pillars.json` 靜態 | 永遠亮 |

## WRA OpenData 盤點（27 筆類別）

已接入：7 筆（25776 / 32726 / 45501 / 129474 / 32727 / 41568 / 13795）
Phase 3 候選：4 筆（129475/6 敏感區、36695 枯旱、58343 洩洪）
非空間候選：36696 水權統計（補「用水」缺口）

詳見 `docs/water-opendata-catalog.md`。

## S3 對應路徑

- Bucket：`migu-gis-data-collector`（ap-southeast-2）
- 前端靜態 GeoJSON 走 `deploy-assets` prefix
- 扁平檔名契約，不要改路徑
- 上傳腳本：`scripts/deploy/upload-deploy-assets.sh`

## 環境變數

| 變數 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 前端 |
| `VITE_DATA_SOURCE=supabase` | 啟用 Supabase（否則用 Pulse API）|
| `SUPABASE_SERVICE_ROLE_KEY` | 腳本用（禁止進 bundle）|
| `SUPABASE_DB_URL` / `DATABASE_URL` | psql 直連 |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | 非預設 AWS credentials |

## 資料新鮮度警示

- 水庫 collector 4 月才開跑 → 想做「過去一年水位變化」類分析需要補年報（WRA 32728）或等累積
- `river_stations` 空表 → 警戒水位視覺化阻塞中（W001）
- 淤積資料只有北區 15 筆 → 需 WRA 公告全台後重跑 `seed_reservoir_sediment.py`
- `water_structures` OSM 稀疏 → 缺 WRA 官方權威清單

## 農業 — 靜態（2026-06-02 +農路圖 + 國土綠網分區圖）

| 檔（public/agriculture/） | 筆數 | 幾何 | 前端層 | 備註 |
|---|---|---|---|---|
| farm_roads.geojson (33MB) | 8,678 | LineString | `farmRoads` | 農路；NAME/County/Town/Lenth；minzoom 8；單色線 |
| eco_network_zones.geojson (8.8MB) | 12 | MultiPolygon | `ecoNetworkZones` | 國土綠網 12 地理分區（北/南及恆春/東北/東/澎湖/綠島/蘭嶼/西北/西南/西/金門/馬祖）；Zone 12 色 + 圖例；Area_ha |

> 來源 `taipei-gis-analytics/data/raw/agriculture/`（WGS84，免轉）。走既有 agriculture 部署鏈：
> gitignore → upload-deploy-assets.sh AGRI_FILES → S3 `deploy-assets/agriculture/` → pull 整夾 sync → nginx `/agriculture/`。

## 衛星 SPACE（2026-06-13 上線，PR #10）

走 `gis-platform` Supabase 同步管線。**無新 migration、無新 collector**——重用
satellite-art 既有 4 個物件：

| Supabase 物件 | 內容 | 用途 |
|---|---|---|
| `satellite_classified` view | 67k 衛星基本資料 + TLE + UCS country/category | 載入清單 + 即時 SGP4 |
| `satellite_catalog` (reference) | UCS 詳細：發射場/火箭/COSPAR/承包商/質量/壽命 | Phase B 百科卡 |
| `satellite_maneuvers` MV | 每 2h refresh，prev/curr TLE delta，分 4 型（ALT/PLANE/SHAPE/NOMINAL）| Phase A 變軌警報 |
| `satellite_tle_history` | 每顆 ~289 條歷史 TLE（Yaogan 12 自 2011 起累積）| Phase C 變軌前後對比 |

**前端篩選結果**（cache 6h on localStorage key `v3-grouped`）：
- 中國 351 顆（country=China + category in (military, earth_obs)）名稱 regex 拆 4 群：
  - Yaogan 遙感 101 · Jilin 吉林 36 · Gaofen 高分 30 · 中國其他 ~184（TJS/北斗/Shiyan/餘）
- 台灣 15 顆（country=Taiwan + 名稱保底 `FORMOSAT*` / `TRITON*` 補 UCS country=null 漏網之魚）：
  FORMOSAT 3×5 / FS-5 / FS-7×6 / **FS-8A NORAD 66666**（2025-10）/ **TRITON 58017** / IRIS-C

**TLE 更新鏈**：data-collectors 每 2h 從 Space-Track（非 CelesTrak — 後者對瀏覽器 403）。
30 天 epoch 過濾自動剔除 decay / 失追衛星。

**前端 layer key**：satellitesYaogan / satellitesJilin / satellitesGaofen /
satellitesChinaOther / satellitesTaiwan（全預設關，視效能與用戶習慣決定）。

## 新聞事件 — 時序（Supabase realtime schema，2026-06-13/14）

- `realtime.news_events`（主表，每篇新聞 1 列）
  - 欄位：source / url / url_norm UNIQUE / title / summary / category / location_name / county / admin_code / published_ts / confidence / title_simhash bigint / geom Point4326（由 BEFORE INSERT trigger 補）
  - v2 新增：gis_relevance smallint / severity smallint / is_event boolean（皆 NULLable 向後相容）
  - 索引：published_ts / url_norm unique / created_at / (published_ts, gis_relevance, severity)

- `realtime.news_events_daily`（per-day pre-aggregate，前端 RPC 讀這裡）
  - 同主表欄位 + lon / lat double precision + refreshed_at
  - 索引：(day, id) PK / (day, gis_relevance, severity)
  - refresh function：`public.refresh_news_events_daily(date)` 含 advisory lock + work_mem '64MB'
  - pg_cron job 56：`1,11,21,31,41,51 * * * *`（10min 一輪 today+yesterday 循序）

**RPC 簽名（4 個薄 RPC）**：
- `public.get_news_events_day(date)` — v1 flat list（保留向後相容）
- `public.get_news_events_day_clustered(date)` — v1 cluster 版
- `public.get_news_events_day_clustered_v2(date, min_gr int=2, require_event bool=true, min_sev int=0)`
  - 回 lon/lat/county/location_name/event_count/latest_category/latest_published_ts/**max_severity**/**max_gis_relevance**/events jsonb
- `public.get_news_event_dates()` — 日期清單 + event_count

**Collector 資料源**（data-collectors `collectors/news_events.py`）：
- 29 feeds：CNA ×3（feedburner）/ 自由 ×3 / ETtoday / Google News geo ×22 縣市
- 每 10 分鐘一輪（NEWS_EVENTS_INTERVAL=10）
- LLM：Gemini Flash-Lite，BATCH_SIZE=15
- 月成本實測 ~$3-4（穩態，cache 命中後）

**累積量**（2026-06-13 實測 24h）：
- 入庫量約 1,500-1,800/天（v2 + 10min 提速後待觀察）
- 有座標 ~55%、鄉鎮級 ~30%、縣市級 ~25%
- gis_relevance 分布（v2 抽樣 36 則）：0=14 / 1=10 / 2=8 / 3=4
- critical 級（gr=3 + sev≥2）約 4-8 則/天

---

## 能源 ENERGY（2026-06-19 加 — v1.0~v1.3.5 上線 PR #23 + #10）

### 來源
- 上游 collector：`../taipei-gis-analytics/pipelines/energy/`
- HANDOFF doc：`../taipei-gis-analytics/docs/topic-research/energy/MINI_TAIWAN_PULSE_HANDOFF.md`
- Supabase project：`utcmcikhvxnohbxchbrs`（gis-platform）
- 上線分組：sidebar `ENERGY · 能源`（4 layer）

### 22 表（全在 public + realtime + analytics 三 schema）

| 性質 | 表 | 筆數 | 已接 layer? |
|---|---|---:|---|
| **主圖 VIEW** | `public.all_power_plants_v` | **10,665** | ✅ 電廠 layer 1 |
| 台電大廠 | `public.power_plants` | 22 | 在 VIEW 內 |
| 核電廠 | `public.nuclear_plants` | 4 | 在 VIEW 內（標 retired）|
| 民營 IPP | `public.ipp_thermal_plants` | 9 | 在 VIEW 內 |
| 離島電網 | `public.island_power_grid` | 14 | 在 VIEW 內，海纜 LineString 沒接（E-D）|
| 化石燃料設施 | `public.fossil_fuel_infrastructure` | 9 | 在 VIEW 內 |
| 離岸風 polygon | `public.offshore_wind_zones` | 36 | 在 VIEW（centroid）但 polygon 沒接（E-D）|
| OSM 風機 | `public.osm_wind_turbines` | 812 | 在 VIEW 內，獨立 toggle 沒接（E-D）|
| OSM 光電 | `public.osm_solar_farms` | 734 | 在 VIEW 內，獨立 toggle 沒接（E-D）|
| OSM 綜合電廠 | `public.osm_power_plants` | 513 | 在 VIEW 內，獨立 toggle 沒接（E-D）|
| 再生案場（全國）| `public.renewable_permits` | 8,195 | 在 VIEW 內（TGOS 98.1% geocoded）|
| 再生案場（北市）| `public.renewable_permits_taipei` | 438 | 在 VIEW，分色沒接（E-D）|
| 地熱潛能 | `public.geothermal_potential` | 27 | 無座標，KPI 卡（E-F）|
| 地熱井 | `public.geothermal_wells` | 36 | 在 VIEW，3D cone 沒接（E-D）|
| **變電所** | `public.osm_substations` | **785** | ✅ layer 5 |
| 高壓電塔 | `public.osm_power_towers` | **26,589** | 沒接（E-C 用戶 priority）|
| 高壓線路 | `public.osm_power_lines` | **2,305** | 沒接（E-C 用戶 priority）|
| 配電變壓器 | `public.osm_transformers` | 102 | 沒接（OSM 稀疏，台電 506k 量大）|
| OSM 充電 | `public.osm_charging_stations` | 306 | 沒接（E-E 補社區型）|
| OSM 加油站 | `public.osm_gas_stations` | 2,212 | 沒接（E-E 主用）|
| 政府加油站 | `public.gas_stations` | 573 | 沒接（E-E 對照，不可 UNION OSM）|
| **充電站** | `public.ev_charging_stations` | **3,060** | ✅ layer 6 |
| 電桿（低壓）| `public.power_poles` | **2,959,326** | 沒接（E-E 必走 PMTiles 1.4GB raw）|
| 縣市風力統計 | `public.county_wind_stats` | 211 | 沒接（E-F KPI）|
| 縣市生質統計 | `public.county_biomass_stats` | 188 | 沒接（E-F KPI）|
| 縣市小水力 | `public.county_small_hydro_stats` | 188 | 沒接（E-F KPI）|
| 光電月發電（站時序）| `analytics.solar_daily_generation` | 3,992 | 沒接（E-F 月趨勢）|
| 落雷即時 | `realtime.lightning_events` | 32,912 / 24h | **已接** v2 Phase B（feat/energy-v2-A b7d6154，5~360 min slider）|
| 落雷日聚合 | `analytics.lightning_daily_summary` | 動態 | 沒接（E-F KPI）|
| **三本柱燈號** | `realtime.power_system_status` | 1,843 (10min × 約 13 天) | ✅ HUD（v1.1 留 hooks 給 monitor E-A）|
| **區域用電** | `realtime.power_region_demand` | 7,352 | ✅ region bars（v1.1 留 hooks 給 monitor E-A）|
| **機組即時** | `realtime.power_generation_unit` | 376,790 (7 天 retention) | ✅ 3D beam layer 4 |
| 核安站當下 | `realtime.nuclear_radiation_stations` | 51 | **已接** v2 Phase B（feat/energy-v2-A b7d6154，5 階分級含 stale）|
| 核安站歷史 | `realtime.nuclear_radiation_measurements` | 動態 | 沒接（E-B per-station sparkline）|
| 核安日聚合 | `analytics.nuclear_radiation_daily` | 動態 | 沒接（E-F）|

### 8 個 RPC（gis-platform migrations 212~219，全 merged 進 main）

| Migration | RPC | 用途 |
|---|---|---|
| 212 | `get_power_dashboard()` | 燈號 + 4 區 一次拉（HUD + region bars）|
| 213 | `get_power_plants_with_output()` | 10,665 POI 含 retired flag |
| 214 | `get_lightning_recent(min)` | 落雷時窗（**已接** v2 Phase B）|
| 215 | `get_nuclear_radiation_status()` | 51 核安站當下（**已接** v2 Phase B）|
| 216 | `get_osm_substations()` + `get_ev_charging_stations()` | 兩 slim POI |
| 217 | `get_power_plants_at(ts)` + `get_power_plant_output_24h(name)` | timeline + popup sparkline |
| 218 | `get_power_generation_at(ts)` | beam slim 14 廠 ~3 KB |
| 219 | `get_power_generation_24h()` | 24h 全部 14 廠 × ~144 ts ~45 KB |

### 核電廠現況（2026-06）

**全國無核反應爐發電**：核一 2019-07 退役、核二 2023-03 退役、核三 2025-05 退役、核四從未商轉（2014 封存 / 2022 解體燃料外送）。213 RPC `status='retired'` + `status_note` 標示。

當下 fuel mix（2026-06-18 11:30 實測）：燃氣 12,169 / 燃煤 6,193 / 民營燃氣 5,943 / 太陽能 2,407 / 民營燃煤 2,156 / 汽電共生 1,959 / 風力 1,903 / 水力 1,083 / 儲能 742 / 燃料油 193 / 其他再生 41 MW。

### 14 廠對應「機組」（unit_prefix LIKE plant_core 規則）

大潭、台中、通霄、興達、林口、大林、南部、明潭、協和、卓蘭、和平、谷關（22 廠裡 14 個有對應機組）。其餘 8 廠（大甲溪 / 大觀 / 萬大 / 萬大 / 等水力分廠 + 外部購電聚合）沒對到 — 視覺上「廠在地、無柱」。

## 化石燃料 14 layer（2026-06-21 加 — 本 session）

走 `public.get_fossil_fuel_layers()` RPC（gis-platform migration 242），UNION 6 個 `energy.*` 表 → 14 layer 分類，總 ~5,420 features：

| Layer | Bucket | 站數 | Geometry |
|---|---|---|---|
| 加油站 中油 | `gas_station_cpc` | 2,023 | Point |
| 加油站 台塑 | `gas_station_fpcc` | 350 | Point |
| 加油站 台糖 | `gas_station_taisugar` | 86 | Point |
| 加油站 其他/私營 | `gas_station_other` | 698 | Point |
| 加油站 SSOT canonical | `gas_station_canonical` | 3,053 | Point |
| LPG 分裝/儲存場 | `lpg_subpackaging` | 107 | Point |
| LPG 加氣站/瓦斯行 | `lpg_retailers` | 1,185 | Point |
| LNG 接收站 | `lng_terminal` | 7 | Point |
| 天然氣主幹線 | `pipeline_gas` | 11 | LineString |
| 油氣管線 OSM | `pipeline_oilgas` | 10 | LineString |
| 煉油 / 化工廠 | `industrial_refinery` | 98 | Polygon + halo |
| 油氣儲槽 | `industrial_storage_tank` | 72 | Polygon + halo |
| 火力廠 polygon | `industrial_power_plant` | 26 | Polygon + halo |
| 煤炭碼頭 | `coal_terminal` | 4 | Point |

EXPLAIN ANALYZE 86ms，無需 pre-aggregate。

## 加油站 / EV 30km 路網可達 5 PMTiles（2026-06-22 加）

走本機 osmnx + multi_source_dijkstra（避開 Overpass mirror 卡），全台主要路網 motorway-tertiary（**34,396 nodes / 75,622 edges**）：

| PMTiles | Bucket | Sources（站數）| Reach |
|---|---|---|---|
| `taiwan_cpc_nearest.pmtiles` | CPC 中油 | 1,988 | 99% |
| `taiwan_fpcc_nearest.pmtiles` | 台塑 | 350（+31 雙品牌）| 98% |
| `taiwan_taisugar_nearest.pmtiles` | 台糖 | 86（+73 雙品牌 → 6.5×）| 59% |
| `taiwan_other_nearest.pmtiles` | 私營 whitelist | 292（過 374 false positive）| 97% |
| `taiwan_all_gas_nearest.pmtiles` | 全加油站 | 2,612（過 false positive）| 99% |
| `taiwan_ev_nearest.pmtiles` | EV 充電 | 3,028 | 99% |

5 個 ~5 MB（總 ~25 MB），存 `public/coverage/`。資料模型「每 OSM edge 染最近 source 的路網距離 5 級色階」（0-5/5-10/10-20/20-30/>30 km）。半年更新一次。

Pipeline：`taipei-gis-analytics/scripts/road_isochrone/taiwan_nearest_distance.py`（osmnx + Overpass + tippecanoe）。Multi-bucket + whitelist 兩鐵則套用案例。

Bonus: `taiwan_other_nearest.pmtiles` 已備但前端尚未接第 6 個 layer（暫存）。

## 加油站品牌分布（DB 盤點）

| 分類 | 數量 | 備註 |
|---|---|---|
| 三大品牌 | 2,355 | 中油 + 台塑/Formosa + 台糖 |
| 已知私營（whitelist 命中）| 291 | 山隆/速邁樂/台亞/西歐/統一精工/Smile/7-Eleven/含「加油站」字樣 |
| 其他 41455 商業司登記（false positive）| 374 | 「XX 股份有限公司」型，多半非加油站 |
| 無名 | 33 | brand 也是 unknown |
| **雙品牌站** | **104** | 中油+台糖 72 + 中油+台塑 31 + 台塑+台糖 1 |

## 警政司法民防體系（2026-06-29~07-01 上線；`taipei-gis-analytics/data/processed/police_justice/`）

### 22 dataset 分佈

| 類 | 數 | 前端 |
|---|---|---|
| 機構 POI（含 airports 早存在） | 11 | 10 layer 上線（cctv_poi 桃園 skip — 已有 mini-cctv-tw 獨立站）|
| 事件 點/線 | 4 | 全上線 |
| Polygon / 大量 POI | 4 | civil_defense_shelters / crime_area_monthly / court_jurisdictions 3 PMTiles 上線；police_districts 自製 KNN v1 tier=3 暫緩 |
| Realtime Supabase | 3 | prison_population_daily → Monitor PrisonCard（⚠ collector 沒跑 1 row / 2026-05-15）；border_airport_snapshot → Monitor AirportPaxCard + AirportPanel 24h 折線；traffic_accidents_a1 → a1AccidentRealtime 30 天滾動漣漪 |

### 前端 17 GIS layer 上線

- 警政 4：policeStation(2065 分 6 階層) / womenChildWarning(185) / speedCamera(2056 分 4 subtype + limit_kph 分大小) / speedZoneSegment(25 LineString)
- 司法矯正 4：court(35 分 6 階) / prosecutorsOffice(29 分 3 階) / correctionalFacility(51 分 5 類) / courtJurisdiction(22 MultiPolygon PMTiles)
- 治安態勢 5：crimeAreaMonthly(368 Polygon PMTiles) / theftTaoyuan(1423) / trafficAccidentYearly(1600) / accidentTaipei(22918) / a1AccidentRealtime(rpc_a1_by_bbox 30 天滾動)
- 廉政移民海巡 4：investigationBureau(29 name 末字分級) / antiCorruptionOffice(66 central/local) / immigrationOffice(25) / coastGuardStation(269 patrol/pier)
- 民防避難 1：civilDefenseShelter(62,695 PMTiles z≥7)

### 3 Supabase RPC（`gis-platform/migrations/262-264`）

- `get_airport_hourly_pax(airport, hours)` — border_airport_snapshot 按小時 in/out/transit pax
- `get_a1_accidents_by_bbox(bbox, days=30)` — realtime.traffic_accidents_a1 DISTINCT ON 每事故一筆
- `get_prison_population_window(days=30)` — 全國每日總計時序（薄 SELECT wrapper）

### 3 個 police_justice PMTiles（S3 `deploy-assets/police_justice/`）

civil_defense_shelters(3.4M) / crime_area_monthly(2.3M) / court_jurisdictions(295K)

## 警察 isochrone × overlap_count（2026-07-01 上線）

- 3 層級 × 2 mode × 2 分鐘 = 12 變體 → 3 個 combined PMTiles
- `police_iso_substation_combined.pmtiles` 11M（walk 5/10 + drive 5/10 全台 1504 站）
- `police_iso_precinct_combined.pmtiles` 3.0M（walk 15/30 + drive 15/30 全台 163 站）
- `police_iso_police_dept_combined.pmtiles` 278K（walk 30/60 + drive 30/60 全台 32 站）
- feature 數 dissolve 後：substation 334 / precinct 168 / police_dept 72
- 走本機 PBF（`taipei-gis-analytics/data/raw/osm/taiwan-latest.osm.pbf` 309MB）+ osmium tags-filter（drive 16MB / walk 58MB）
- **分 5 區跑**（bbox 邊界未 overlap → PI-1 邊界斷裂待修）

## 動態 Collector 基礎設施（data-collectors repo）

**7 個現役 collector**（`../data-collectors/collectors/`）：

| Collector | 資料來源 | 間隔 | S3 前綴 |
|---|---|---|---|
| ship_ais.py | 航港局 AIS | 10 min | `ship_ais/` |
| flight_opensky.py | OpenSky Network | 5 min | `flight_opensky/` |
| tra_train.py | TDX 台鐵即時 | 2 min | `tra_train/` |
| youbike.py | TDX YouBike | 15 min | `youbike/` |
| weather.py | CWA 氣象站 | 60 min | `weather/` |
| temperature.py | CWA 溫度網格 | 60 min | `temperature/` |
| freeway.py | TDX 國道壅塞 | 10 min | `freeway/` |

**正常量參考**：ship ~800K records/day、flight ~34K records/day → 若前端顯示 0 且對應 collector S3 前綴無新檔 = collector 當機（非前端 bug）

## S3 Bucket 結構（`s3://migu-gis-data-collector/`）

```
├── deploy-assets/       # 部署用（upload-deploy-assets.sh，含 base_map/coverage/ 等子目錄）
├── flight-arc/          # FR24 匯出（前端 fallback，legacy）
├── ship-data/           # 船舶匯出（前端 fallback，legacy）
├── rail-data/           # 軌道 bundle（前端 fallback）
├── ship_ais/            # 原始 AIS 快照（collector 直寫）
├── flight_opensky/      # OpenSky 空域快照 + archives/
├── tra_train/           # 台鐵即時位置
├── youbike/             # YouBike 車位
├── weather/             # 氣象觀測
├── temperature/         # 溫度網格
└── freeway/             # 國道壅塞
```

**S3 base URL**：`https://migu-gis-data-collector.s3.ap-southeast-2.amazonaws.com`

## 前端載入策略層級

1. **動態時序**（ship / airspace / trails 類）→ Supabase RPC（`get_xxx_trails`）
2. **靜態運具參考**（rail 時刻表）→ Supabase PostgREST（`reference.daily_schedules`）
3. **H3 / 溫度 / 靜態 GeoJSON** → 本地 JSON → S3 fallback
4. **大型 line/polygon** → PMTiles（S3 `deploy-assets/coverage/*.pmtiles`）

## 飛機資料雙軌（歷史脈絡）

- **方式 A（legacy）**：FR24 官方 API → `fetch-flights.ts` → `public/aviation_data.json` → S3 `flight-arc/`（完整軌跡）
- **方式 B（現役，2026-03 起）**：`data-collectors flight_opensky.py` → S3 → pulse-api sync → DuckDB → Arrow IPC API → 前端 `airspaceLoader.ts`

方式 B 是空域快照（非完整軌跡）取代 FR24，用於降低成本 + 提高涵蓋。

**Long-form** collector pipeline 與 legacy 指令：`~/.claude/projects/.../memory/_archive/data-pipeline.md`

## 全球氣候 GLOBAL CLIMATE（2026-07-02 上線）

**data-collectors `collectors/global_climate/` 7 collector**（plan-misty-fog）：
- 向量（純 Supabase）：`usgs_earthquake`（全球地震 hourly → `realtime.earthquakes_global`）/ `jma_typhoon`（3h）+ `jtwc`（6h）→ `realtime.typhoon_positions`（source 區分）
- 模式場（S3 原檔 + Supabase digest `realtime.global_climate_grids`）：`noaa_gfs`（全球 0.25° 風場/氣壓/噴流）/ `cmems`（西太→廣域 90-180E×-15-55N 海流/SST/波浪）/ `cams`（東亞沙塵/PM）— 每日
- `climate_bake`（第 7，每 6h）：讀 Supabase 最新 f000 → 烤 RGBA PNG/raster → `deploy-assets/climate/{wind10m,currents,dust}_latest.{png,json}`

**雲端注意**：CMEMS/CAMS 需 env 憑證 + requirements 需 xarray/cfgrib/cdsapi/copernicusmarine + Dockerfile libeccodes0（見 INCIDENTS 2026-07-02）。CMEMS subset 必帶時間範圍。

**前端遞送**：`/climate/*.png` 由 nginx 從 `/data/climate/` 服務；`entrypoint.sh` 背景迴圈每 6h re-sync `deploy-assets/climate/`（refresh-climate.sh）；PNG 帶 `?v=valid_at` 破快取。

**前端 5 layer**（`docs/features/global-climate/`）：windField / oceanCurrents（WebGL instanced 粒子線，全 zoom）/ dustForecast（raster）/ earthquakesGlobal（circle）/ typhoonTracks（線+點+現在位置圈，JMA/JTWC 資料源選擇器）。
