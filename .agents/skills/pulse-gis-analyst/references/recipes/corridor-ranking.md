# 路線沿線排名（空間）

**適用**：「台北哪條公車經過最多學校」「哪條路線沿線醫療資源最多」。

**工具鏈**（`pulse_sql`；已驗證模板，<1 秒）
```sql
WITH area AS (SELECT geom FROM boundaries_county WHERE area_code = '63000'),
routes AS (SELECT RouteName, geom_3826 AS g FROM ds_transportation_bus
           WHERE City = '臺北市' AND ST_GeometryType(geom) = 'LINESTRING'),
targets AS (SELECT s._row_id, s.geom_3826 AS g FROM ds_education_schools s, area a WHERE ST_Within(s.geom, a.geom))
SELECT RouteName AS route, count(DISTINCT targets._row_id) AS hits
FROM routes JOIN targets ON ST_DWithin(routes.g, targets.g, 200)
GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10
```
上地圖用 [buffer-overlay](buffer-overlay.md) 的模板畫第一名的環域與命中點。

**必帶但書**：環域是直線距離，不是站牌步行範圍；同一路線去回程合併計算；路線長的自然經過多，必要時補「每公里命中數」。

**停止**：前 10 名表＋第一名上地圖。

**追問**：要不要改成每公里命中數？要不要改看只停靠 400 公尺內站牌的學校？要不要換成醫療或長照？
