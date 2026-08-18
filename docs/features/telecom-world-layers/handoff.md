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
