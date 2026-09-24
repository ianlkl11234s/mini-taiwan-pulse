# N2：OSM 海纜登陸站 research dataset

## 可註冊證據

- 固定前端資產：`public/geo/landing_stations.geojson`，58 筆有效 EPSG:4326 Point，SHA-256 `ec6646f1ab45623c6f5dd0b074582f806572a7223934bed172ff06221da35927`。
- 上游 catalog：`taipei-gis-analytics/docs/data-catalog/infrastructure/submarine_cable.md`；來源是 OSM `telecom=cable_landing_station` 的 Point 或 Overpass center，ODbL 1.0、`© OpenStreetMap contributors`、2026-08-18 snapshot。
- 幾何 grain：11 筆 `node_coordinates` 註冊為 actual Point dataset；47 筆 `overpass_center` 註冊為 proxy Point dataset。全數保留 `coord_qc_status`；center 不可用於 bbox 或 nearest，也不等於設施入口、工程位置或埋設線位。

## 範圍與限制

- 兩個 dataset 都是同一固定來源的 selection（11/58 與 47/58），不是全球登陸站母體；`coverage_note=incomplete_crowdsourced`，空白區域不表示無設施。
- `fetched_at` 是來源取得時間，沒有觀測期或即時營運狀態；`status=unknown` 不得轉為可用／停用判定。
- 不與海纜線、營運商、cable count 做完整性或因果推論；查詢結果只保留每筆 OSM provenance。
