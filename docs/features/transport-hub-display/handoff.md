# Handoff — 交通場站顯示模式

## 下游資料契約

| Asset | Geometry | 硬依賴欄位 | 目前範圍 |
|---|---|---|---|
| `public/geo/station_polygons.geojson` | Polygon | `system_id`, `name` | THSR 12、TRA 32 |
| `public/geo/station_points.geojson` | Point | `system_id`, `name`, `color` | TRA 212、捷運/輕軌 291 |
| `public/geo/port_polygons.geojson` | Polygon | `name`, `port_class`, `county`, `source` | 277 |
| `public/geo/airports.geojson` | Polygon / MultiPolygon | `name` | 16 |

## 語意邊界

- 點位模式是顯示用派生 geometry：Polygon 取主面的面心，feature properties 原樣保留，不回寫靜態 asset。
- MultiPolygon 取面積最大的部件，避免代表點落在分離面之間。
- 非 Polygon geometry 不會被轉換或補值。
- 捷運只有 Point，所以 UI 不把 buffer 或推定範圍稱為「實際範圍」。
- 港口著色直接反映原始 `port_class`；未知分類使用灰色，不歸入既有類別。

## 上游改動時的下游動作

| 上游改動 | 下游動作 |
|---|---|
| `port_class` 新增或更名 | 同步 `PORT_CLASSES`、Legend、資料守門測試 |
| 補入捷運真實站體 Polygon | 先驗證 lineage/覆蓋率，再開啟 Polygon 選項 |
| 站體 geometry 改為 Point | 不可透過 centroid transform 猜測，需重定顯示契約 |
