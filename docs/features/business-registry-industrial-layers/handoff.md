# Handoff — A1/A2/A3/A5/A6（下游視角）

## 上游 SSOT

- `taipei-gis-analytics/docs/handoff/factory-locations.md`
- `taipei-gis-analytics/docs/handoff/industrial-park-boundaries.md`
- `taipei-gis-analytics/docs/handoff/park-memberships.md`
- `taipei-gis-analytics/docs/handoff/regulated-facilities.md`
- `taipei-gis-analytics/docs/handoff/industrial-park-comparison.md`

## 已 staged immutable assets

| layer | asset | bytes | features | SHA-256 |
|---|---|---:|---:|---|
| A1 | `public/business_registry/factory_locations_202606.pmtiles` | 11,861,336 | 90,652 | `efe9e7c543bb3905eca646a6fc121383bdc3a1095d93c5778b2ef4ce41be0630` |
| A2 | `public/industrial_zone/industrial_park_boundaries_20260818.pmtiles` | 699,366 | 215 | `3956ee1d232293102a34e26a9f1bfacbc9bcccbe859631a0350a929cb05b93ad` |
| A5 | `public/business_registry/regulated_facilities_20260818.pmtiles` | 13,099,677 | 80,732 | `01bd113e218efd3fd6ffbe684ed7f4236d40bae3498bbde7bbeb5e30a1428147` |
| A6 | `public/business_registry/industrial_park_comparison_20260818.pmtiles` | 584,998 | 215 | `211776fe7e0d307438ab64985cb48c78c74c937228e432436ba8646ba5711ee1` |

四檔均為 source-layer 同名、archive z5–14；A1/A5 前端 z11 gate。assets 為 gitignored staging，本輪未 upload/deploy。

## 語意與 coverage

- A1 是 202606 生產中工廠登記。100,624 active records 中 90,652 有可發布座標，9,972 misses 不可當作不存在。
- A2 是 215 個產業園區 polygon，明確不含科學園區；不得用 A3 membership 推測 geometry。
- A5 只稱「列管設施」。127,795 active records 中 80,732 有座標，47,063 misses 不可當 outside；列管身分不等於事件、裁罰或風險等級。
- A5 公司資本額若顯示，標成 202608 snapshot。
- A6 僅用實際欄位切換 `factory_count`、`company_count`、`company_capital_total_sum`；另發布 `company_capital_nonnull_count` 供 popup 對帳。公司資本額是 202608 snapshot，不是 current。
- A6 的 factory 分母為 100,624，座標可觀測 90,652、miss 9,972；company 分母為 186,054，座標可觀測 184,944、miss 1,110。指標受 geocode coverage bias 影響。
- A6 的 `0` 只表示沒有可定位且落入 polygon 的觀測實體，不證明園區內沒有公司或工廠。215 polygons 不含科學園區，A3 science membership 不混入空間內外判定。

## A3 assertion contract（不建 layer）

- `park_membership_assertions_20260818.csv`：1,505 rows，SHA `78b72880edfe71fa4810efe300a60a5db67fbe35691db2a5c33f800fb9a0d098`。
- `park_membership_by_uniform_no_20260818.csv`：1,124 rows，SHA `017cc9ede8646718e6b5cc7fc565060624c78ae3c305fee01c625b7c2b3c0fc2`。
- 三個 flag 不得合併成 `is_in_park`；本版尚未接成 A1/B1 filter，且不 stage CSV 到 public。

## A6 PMTiles 契約

- source-layer：`industrial_park_comparison`
- fields：`park_id`、`park_name`、`county`、`area_ha`、`factory_count`、`company_count`、`company_capital_nonnull_count`、`company_capital_total_sum`
- 三種視覺指標只使用實際欄位；science membership 仍維持 A3 assertion contract，不混入 polygon inside/outside。
