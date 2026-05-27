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
