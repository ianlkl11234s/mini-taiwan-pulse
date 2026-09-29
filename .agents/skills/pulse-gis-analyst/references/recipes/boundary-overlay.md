# 邊界交叉與面疊合統計（空間）

**適用**：「這條河穿越幾個鄉鎮、總長多少」「淹水潛勢面積占比最高的前幾個行政區」。

**工具鏈**（`pulse_sql`；線穿越用 `ST_Intersects` 計數 + `ST_Length(ST_Intersection(...))` 算長度；面疊合用 `ST_Area(ST_Intersection(...))`）
```sql
-- 「這條河」穿越幾個鄉鎮：河道線沒有河名，指定河川要用有 river_name 的河川區域面。
-- 先用 river_name LIKE '%淡水%' 查出確切河名，再用等號鎖定，否則會把全國河川一起算。
WITH river AS (SELECT ST_Simplify(geom_3826, 10) g FROM ds_water_resources_river_infrastructure_wra
               WHERE river_name = '淡水河' AND geom_3826 IS NOT NULL),
towns AS (SELECT area_code, ST_Simplify(geom_3826, 10) g FROM boundaries_town)
SELECT count(DISTINCT t.area_code) towns_crossed, round(sum(ST_Area(ST_Intersection(r.g, t.g)))/1e6, 2) river_area_km2
FROM river r JOIN towns t ON ST_Intersects(r.g, t.g);
-- 全國河道線穿越鄉鎮數＋總長（全部河道線，不是單一河川；排除同表的堤防線，ST_Simplify 加速，長度誤差約 1%）
WITH line AS (SELECT ST_Simplify(geom_3826, 10) g FROM ds_water_resources_river_infrastructure_wra
              WHERE ST_GeometryType(geom) IN ('LINESTRING','MULTILINESTRING') AND levee_type IS NULL AND geom_3826 IS NOT NULL),
towns AS (SELECT area_code, ST_Simplify(geom_3826, 10) g FROM boundaries_town)
SELECT count(DISTINCT t.area_code) towns_crossed, round(sum(ST_Length(ST_Intersection(l.g, t.g)))) total_length_m
FROM line l JOIN towns t ON ST_Intersects(l.g, t.g);
-- 面疊合占比（示範雙北，全國同模板逾時風險見下方但書）
WITH towns AS (SELECT area_code, name, geom_3826 g, ST_Area(geom_3826)/1e6 km2 FROM boundaries_town WHERE substr(area_code,1,5) IN ('63000','65000')),
poly AS (SELECT geom_3826 g FROM ds_water_resources_flood_hazard_wra WHERE scenario='flood_500mm_24hr' AND county IN ('臺北市','新北市'))
SELECT t.name, round(sum(ST_Area(ST_Intersection(p.g, t.g)))/1e6/t.km2*100, 1) pct
FROM towns t JOIN poly p ON ST_Intersects(p.g, t.g) GROUP BY 1, 2, t.km2 ORDER BY pct DESC LIMIT 10
```
先用非空間欄位（例如 `county` 名稱、`city` 代碼）把兩邊都縮到同範圍再做 `ST_Intersects`／`ST_Intersection`，比先全國 join 再篩快一個數量級。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：水利署河道線圖資沒有河名，單一河川只能用河川區域面回答「穿越幾個鄉鎮／區域面積」，**沒有該河的線長**，不要拿全國河道線總長充當；全國規模「多邊形 × 多邊形」`ST_Intersection` 極慢，實測全國河川×鄉鎮線長查詢未簡化要 18 秒（逼近 20 秒逾時），面疊合全國會逾時，**面疊合預設先縮到 1–2 個縣市**，要全國需分批查詢；`ST_Simplify` 是幾何近似，精細分析（例如法定重疊面積）不可用簡化結果。

**停止**：穿越行政區數＋河川區域面積（單一河川）或總長（全國河道線），或占比排名前 10。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換成全國分縣市批次跑？要不要換淹水情境（雨量／時長）？要不要把疊合結果畫在地圖上？
