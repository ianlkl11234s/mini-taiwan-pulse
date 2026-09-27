# 環域／疊合並上地圖（空間）

**適用**：「畫出這條路線 200 公尺範圍」「這個範圍和保護區重疊多少」「把結果畫在地圖上」。

**工具鏈**（`pulse_sql`；公尺運算用 `geom_3826`，**回傳的幾何必須轉回 EPSG:4326**）
```sql
WITH route AS (SELECT ST_Union_Agg(geom_3826) AS g FROM ds_transportation_bus
               WHERE City = '臺北市' AND RouteName = '671' AND ST_GeometryType(geom) = 'LINESTRING'),
corridor AS (SELECT ST_Buffer(g, 200) AS g FROM route)
SELECT '671 路 200m 環域' AS name, ST_Transform(corridor.g, 'EPSG:3826', 'EPSG:4326', always_xy := true) AS geom FROM corridor
UNION ALL
SELECT s.school_name AS name, s.geom FROM ds_education_schools s, corridor WHERE ST_Intersects(s.geom_3826, corridor.g)
```
面積重疊：`ST_Area(ST_Intersection(a.geom_3826, b.geom_3826))`（平方公尺）。

**涵蓋率變體**（例如「國小 800m 環域涵蓋多少比例的村里」）：用中心點而非整個面判斷是否落在環域內，`count(DISTINCT covered.area_code) * 100.0 / count(DISTINCT all.area_code)`；環域一律是直線距離的代理，不是路網等時圈，答案要標 PARTIAL 並註明。若題目要**列出**缺口村里與受影響人口，不只算一個 %，改用 [elderly-care-access](elderly-care-access.md) / [food-access](food-access.md) 的 `NOT EXISTS` 模板。要真的路網可達（不接受直線代理）就改用 [isochrone-access](isochrone-access.md)（`pulse_isochrone`）。

**呈現**：`pulse_wh_present(resultId)` → 回條內的 `wh-N:polygon`／`wh-N:point` → `pulse_set_result_collection`（面在下、點在上，framing 用結果範圍）→ `pulse_wait_scene_ready` → `pulse_get_map_context` 讀回 effective visible IDs 才說「已顯示」。

**必帶但書**：環域是直線；結果超過 5,000 個 feature 要先縮小；`RESULT_NOT_WGS84` 代表忘了轉座標。

**追問**：要不要換半徑比較？要不要把重疊面積依縣市加總？
