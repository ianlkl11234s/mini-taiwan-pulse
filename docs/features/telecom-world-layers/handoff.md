# Handoff — 世界通訊圖層（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/telecom-world-layers.md`

## 上游 handoff 摘要

- 產物：`public/geo/internet_exchange_points.geojson`
- 更新頻率：prototype 快照；建議季度更新
- 座標系統：WGS84 / EPSG:4326
- 資料量：892 個 Active IXP 點位（893 原始列；1 缺座標排除；2 筆交換 lat/lon 並標記）
- 授權：PCH CC BY-NC-SA 3.0

## 前端接線位置

- Overlay：`src/map/overlayRegistry.ts`
- UI toggle：`src/components/sidebar/layerCatalog.ts`
- Manifest：`src/data/layerManifest.ts`
- Popup：`src/components/featureInfo/infraPanels.tsx`

## 硬依賴欄位（改一定爆）

- `region` — 五洲區分色與 legend
- `participants` — 點半徑
- `name`, `city`, `country` — popup 主資訊
- `coord_qc_status` — 座標修復揭露
- `source_org`, `license` — popup attribution

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| `region` 值域新增或改名 | 更新 `telecomTypes.ts` 色票與 legend |
| `participants` 改為非數字字串 | 更新 Mapbox `to-number` fallback |
| 授權或 attribution 改變 | 更新 popup、legend 與本文件 |
| GeoJSON 超過 5MB | 改走 PMTiles 並補 deploy contract |

## 已知不對稱

- IXP 是公開目錄位置，不代表機房入口、基地台或服務覆蓋。
- 各 layer 的證據層級不同：官方站點、crowd geometry、量測節點、效能格網不可合併解讀。

## OSM 海纜與登陸站世界概覽

- 產物：`public/geo/submarine_cables.geojson`（104 線）、`public/geo/landing_stations.geojson`（58 點）
- 上游：OpenStreetMap strict telecom tags；海纜 geometry 依 OSM ID 接 OpenInfraMap z2 generalized tiles
- 授權：ODbL 1.0；介面必須保留 `© OpenStreetMap contributors`
- 排除：power cable；19 個 strict OSM way 未出現在 z2 tiles，故沒有公開 geometry
- 語意：crowd/incomplete global overview，不是完整海纜清冊、實際埋設位置、工程圖或即時營運狀態

硬依賴欄位：

- `osm_type`, `osm_id`, `source_id`, `name`, `operator`, `owner`, `status`
- `cable_type=crowd_telecom`, `coverage_note=incomplete_crowdsourced`
- `geometry_source` — 海纜 popup 揭露 z2 generalized geometry
- `cable_names`, `cable_count` — 登陸站可選關聯資訊
- `source`, `source_url`, `osm_url`, `license`, `attribution`, `fetched_at`, `query_hash`, `raw_tags`

舊 TeleGeography 資產已被替換；免費互動地圖不等於 raw geocoded API 可再散布，未取得
書面授權前不得回退舊檔或用歷史 pipeline 更新 public asset。

## ANFR 5G 3500 官方無線站點概覽

- 產物：`public/geo/anfr_wireless_sites.geojson`
- 上游：ANFR Cartoradio Open Data，Licence Ouverte / Open Licence 2.0
- 範圍：`5G NR 3500` 且 `Techniquement opérationnel`
- 資料量：49,336 antenna/system records → 33,761 個 `SUP_ID`；前端為 SHA-256 穩定抽樣 8,000 點
- 更新頻率：官方 weekly；目前為 2026-08-18 prototype 快照
- 供應方式：檔案納入 Git，走 nginx `/geo/` 的 dist fallback；超過 5 MB 時須改 PMTiles 或 zoom gating

硬依賴欄位：

- `sup_id` — popup 識別
- `operators` — 分色與 popup；陣列第一值作 primary operator
- `technologies`, `systems`, `statuses` — 範圍與狀態揭露
- `record_count` — 同一支撐點聚合的原始紀錄數
- `source`, `license`, `coord_qc_status` — attribution 與品質契約

此層是官方公開點位的瀏覽器概覽抽樣，不是法國完整基地臺清冊，也不代表精確機房邊界。若上游改成全制式、全狀態或全量資料，必須同步修改 layer label、legend、popup 抽樣聲明與 golden fixture。

## OSM 通訊候選點概覽

- 產物：`public/geo/osm_communication_sites.geojson`
- 上游：OpenStreetMap / Overpass；只收 mapped communication candidates，非官方清冊
- 範圍：全球區域抽樣（`query_region` 保留每筆查詢區域）；不宣稱全球完整
- 授權：ODbL；介面標示 `© OpenStreetMap contributors`
- 資料量：916 個真實候選點，涵蓋 Johannesburg、London、New York、São Paulo、Singapore、Toronto 六個區域；不是全球完整清冊

硬依賴欄位：

- `site_kind` — mobile/radio/television/microwave/general 分色與 legend
- `communication_types` — popup；接受 array 或分號字串
- `osm_type`, `osm_id`, `source_id` — OSM 識別
- `relevance`, `query_region` — 候選／抽樣限制揭露
- `source`, `source_url`, `license`, `attribution`, `fetched_at`, `raw_tags` — provenance

## RIPE Atlas 連線量測節點

- 產物：`public/geo/ripe_atlas_probes.geojson`
- 上游：RIPE Atlas public probe metadata；完整快照 13,534 點，前端為 `SHA-256(probe_id)` 穩定抽樣 3,000 點（147 國、239 個 Anchor）。
- 座標：WGS84 / EPSG:4326；RIPE Atlas 座標已模糊化，介面以 80–400m 揭露，不回推精確位置。
- 使用限制：資料具有 volunteer bias；介面限定 research use，商業使用需另取 RIPE NCC／資料來源許可。
- attribution：`© RIPE NCC`；popup 不呈現 IP、prefix 或其他網路識別細節。

硬依賴欄位：

- `probe_id`, `country_code`, `country_name` — popup 識別與國家
- `status_id`, `status_name`, `is_anchor` — 狀態／Anchor 分色
- `last_connected`, `status_since`, `total_uptime` — 連線狀態
- `coord_qc_status`, `location_obfuscation_m` — 座標品質與模糊化揭露
- `source`, `source_url`, `terms_url`, `usage_note`, `attribution`, `retrieved_at` — provenance／使用限制

## Ookla 網路效能格網（行動／固定）

- 產物：`public/geo/ookla_{mobile,fixed}_global.geojson`（全球 z6+z8+z10 合檔）、`public/geo/ookla_tw_z14.pmtiles`、`public/geo/ookla_tw_z16.pmtiles`（台灣兩級，各含 mobile／fixed 兩個 source layer）。
- 上游：Ookla Speedtest Global Internet Performance Maps 2026 Q1（z16 原生 tile，赤道 610.8 m）。
- 資料量：全球 z6 751／893 格、z8 6,483／7,565 格、z10 51,356／62,208 格；台灣 z14 4,784／5,133、z16 原生 23,881／28,028。行動／固定依序列出；速度與延遲按 `tests` 加權。
- 四層皆為 overlay-only Polygon，下載速度 `avg_d_kbps` 驅動色階；透明度另乘 `OOKLA_TESTS_ALPHA_EXPR`，讓整季只有個位數測試的格不與數萬次的等權。
- 全球層一份 GeoJSON 同時裝 z6、z8 與 z10，靠 `z` 屬性 filter 手動切（「解析度」select）—— `sourceUrl` 是 config 的固定字串，合檔才能讓切換不必重建 source。
- 台灣層同一個 layer key 掛兩個 config（`waterReservoirs` 先例）：z14 sublayer `maxzoom: 15`、z16 sublayer `minzoom: 15`。**兩個界線缺一就 double-render** —— PMTiles source 的 maxzoom 只擋 tile 請求，不擋 MapLibre overzoom 續畫。
- 欄位（`--slim`）：`coarse_quadkey`, `avg_d_kbps`, `avg_u_kbps`, `avg_lat_ms`, `tests`, `devices`, `tile_count`（原生 z16 省略，恆為 1）, `z`（僅全球層）。整層常數移到 `OOKLA_GRID_META`，不再逐格重複。
- popup 分 `ooklaMobileGrid`／`ooklaFixedGrid`：slim 移除了 `service_type`，popup 型別本身成為 service 的載體。
- `devices` 是 z16 tile device counts 加總，未跨 tile 去重，不代表 cell unique devices。
- 使用限制：Speedtest 使用者樣本，不是 coverage map；空格不代表沒有網路。Ookla 2026-04-16 起更新支援地區，俄羅斯／伊朗本輪無量體 —— 空白格有兩種成因。
- 授權：CC BY-NC-SA 4.0，非商業使用、相同方式分享；PMTiles 以 tippecanoe `-A` 帶 attribution（地圖右下常駐），popup／legend 另保留 `© Ookla` 與商標聲明。
- 靜態 asset 已納入 Git，走 nginx `/geo/` dist fallback；完整原始 Parquet 不進前端 repo。
