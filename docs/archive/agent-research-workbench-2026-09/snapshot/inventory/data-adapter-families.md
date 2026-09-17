# Data adapter families evidence

盤點範圍是代表性 loader/hooks/contracts；刻意不重複 `layerManifest`，也不盤點 `globalEvents` 新聞。

## 統計與農業 regional

- `src/data/regionalStatisticsLoader.ts:6-20,199-290` 定義的 grain 是 `dataset_id × indicator_id × area_level × dimensions × release_id`；觀測列以 `area_code` 對行政區 boundary 的 Polygon/MultiPolygon join，沒有把統計值假裝成設施點或 centroid。`period_start/period_end`、`boundary_version`、source/health、SHA/bytes 與 observations 必須同時通過，`observed` 才能有數值；其他狀態保留 `null` 並寫入 `status/source_token`。來源預設 immutable R2/CDN `current.json → manifest → hash artifact + geometry`（22-23、77-94、179-197），開發時另有明確的 agriculture preview route（110-178）。
- `src/data/agriStatisticsRecipes.ts:4-39,57-75,90-123` 顯示農業/林業/漁業/畜牧是 exact release tuple 白名單；目前 24 個 enabled layer keys（57-65），既有層只作 index reference，不重複發布（70-71）。`release_options` 同時約束期間、維度、邊界版本與單位；部分資料另有 semantics sidecar，不能把 suppressed/not-reported/observed-zero 合併。
- 可共用操作：catalog/releases → exact selector → values/source/health → boundary join；release fallback 只在 recipe 明確允許時發生。缺口：這仍是 statistics 專用 adapter，未抽成所有行政統計共用的 generic schema；資料邊界與統計參考邊界的雙版本語意須持續由 recipe 維護。

## 動態 sensor / time series

- `src/data/microSensorsLoader.ts:18-67,75-94`：Supabase `get_micro_sensors_latest`，grain 是 device/station × 最新 `observed_at`，幾何 Point（lon/lat），PM/溫度/濕度可各自為 null；5 分鐘快取。未來 hourly replay 尚未存在（註解 1-5）。
- `src/data/rainGaugeLoader.ts:5-20,23-73` 與 `src/data/riverLevelLoader.ts:5-18,20-65` 共用「latest/day/timeseries」模式：RPC 取當日 hourly snapshot，依 `station_id × observed_at`，Point 幾何；rain 有 10min/1h/3h/24h precipitation，river 有 water level/check result。一次抓全天供 timeline，再由 `timeStore.subscribeThrottled` 切片（rain 17-20）。單站 sparkline 則另查 N 小時 RPC。兩者均 10 分鐘 keyed cache。
- `src/data/temperatureLoader.ts:9-27,45-125` 是 CWA 0.03° regular grid，不是點測站：`rows × cols`、land flat indices，`time × land-cell values`（溫度 ×10 整數）；RPC `get_temperature_dates/grid_info/frames`，10 分鐘 cache。可共用的是日期解析、整日 frame、timeStore 回放；不可把 grid cell 當 station point。缺口：各 loader 的 null、單位與時間 bucket 仍是各自介面，沒有統一 observation adapter。

## 航跡 / 軌跡

- `src/data/gfwHourlyTracksLoader.ts:22-78,116-160,188-205`：GFW 每日分片來源（dev local manifest，production unified CDN root）；grain 是 vessel × segment，GeoJSON LineString coordinates 必須與 `observed_times` 一一對齊、嚴格 UTC 且遞增；`approximate=true`、source_dataset 與 point count 是契約欄位。另有 frame node（track/vessel × observed epoch）供時間播放。
- `src/data/gfwV4SpatialTracksLoader.ts:1-32,43-90`：schema-4 immutable release；每 bucket 1 個 daily PMTiles、24 個 hourly frame PMTiles、16 個 detail bucket（每 bucket 另有 metadata/sha/bytes/content encoding）。Worker/GPU 取 immutable URL，避免每 tick `GeoJSON.setData`；`semantic_counts` 只作 ledger metadata。`src/three/GfwV4TrackScene.ts:18-35,59-70,158-190` 以 viewport bounds cull，點是聚合 heads、線是 trails，Three.js shared Mapbox context + fixed GPU buffers。
- `src/data/plaTracksLoader.ts:5-15,25-53,90-160` 是國防部示意活動區，不是精確航跡：grain 是 report date × shape，幾何 Polygon；range RPC 一次取多日後前端 filter，`needsReview` 預設排除；`sorties=null` 表示解析失敗，不是 0（45-53）。缺口：GFW 線、GFW v4 frames、PLA polygon 的 identity/time/precision 不能用單一 track schema 取代。

## PMTiles / GeoJSON / raster / 3D

- `src/map/pmtilesSourceType.ts:1-33` 將 Mapbox PMTiles source type 冪等註冊並檢查套件常數；`src/embed/maplibreAdapters.ts:4-45` 顯示 MapLibre 另用 `pmtiles://` protocol，`sourceLayer` 有無決定 vector/raster，其餘 overlay manager 邏輯共用。GeoJSON 是一般 source；靜態 dataset chat 明確只收「點狀 GeoJSON」，PMTiles 不可直接 fetch 查詢（`src/chat/tools/datasets.ts:1-7`）。
- `src/data/rasterProbeSampler.ts:7-17,39-112` 只有 urbanHeat/canopyHeight 可從像素還原物理值；其他 raster 是已上色影像，popup 應為 null。依 alpha 判斷 nodata，urban heat R/G 解碼 ΔT/LST，canopy R 解碼公尺；maxzoom 往下退並以 PMTiles tile range 取樣。缺口：不可對所有 raster 泛化數值 popup。
- 3D adapter 目前以 Three.js CustomLayer 共用 Mapbox GL context、Mercator 座標、opacity/theme 與 budget；GFW v4 scene 另有 viewport cull/aggregation。缺口是各 scene 的輸入模型與時間控制仍分散，沒有統一的 3D data adapter。

## 警報

- `src/data/disasterAlertLoader.ts:12-44,70-143`：NCDR CAP `realtime.disaster_alerts`，按 date RPC，grain 是 alert identifier；時間為 effective/sent/onset 到 expires，幾何可能 null，保留 `area_desc`。`src/data/alertsLoader.ts:29-70,162-283` 將 NCDR + CWA 地震聚合成 group × active alert 與 group × hour（24h series），RPC `get_alert_summary/get_active_alerts/get_alert_series_24h`，TTL 25 秒/5 分鐘；access denied、error、ready 有明確狀態。缺口：聚合 active alert 介面沒有 geometry，地震 county 是從 location description 解析，不能視為原生行政欄位。

## Chat tools 邊界

- `src/chat/tools/dataTools.ts:33-176` 只有 `query_dataset`、`rank_by_population`、`call_rpc` 三個 data tools；前兩者查靜態白名單 GeoJSON 點，操作為 count/groupBy/filterEq/filterContains/nearest 或 H3 population rank；call_rpc 不允許 LLM 產 SQL。
- 以原始宣告計數：`src/chat/tools/datasets.ts:15-158` 22 個 static dataset allowlist；`src/chat/tools/rpcTools.ts:17-93` 10 個 RPC allowlist。這些是瀏覽器內的 Supabase anon RPC / static GeoJSON adapters，不是 research MCP；RPC 結果另經 loading registry 與 capToolResult（rpcTools.ts:95-117）。

## 跨家族可共用操作與缺口

可共用邊界是 loading registry、TTL/keyed cache、source/status/error/denied、明確時間欄位、GeoJSON conversion、timeStore subscription、PMTiles immutable URL 與 provenance readback。不可共用的是 grain/geometry：行政統計 polygon join、sensor point、regular grid、vessel LineString、PLA Polygon、CAP geometry/null、raster pixel physical value、Three GPU frame 各有不同語意。現況沒有一個能安全涵蓋所有家族的 universal adapter；若新增跨家族查詢，需先保留 source lineage、precision、null/suppression/zero、time semantics 與 geometry contract。
