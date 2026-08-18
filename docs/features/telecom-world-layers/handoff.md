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
- 海纜／登陸站目前以台灣周邊資料為主；IXP 為全球資料。

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
