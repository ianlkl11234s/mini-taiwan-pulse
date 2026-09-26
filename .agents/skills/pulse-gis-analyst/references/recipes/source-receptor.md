# 污染源 × 受體盤點（空間＋關聯）

**適用**：「污染裁罰／列管設施周圍有沒有學校、河川、保護區」「整體盤點有幾處」。

**工具鏈**（`pulse_sql`；已驗證模板，約 6 秒）
```sql
WITH f AS (SELECT _row_id, geom_3826 AS g FROM ds_hazards_toxic_chemical_facilities WHERE geom_3826 IS NOT NULL),
near_school AS (SELECT DISTINCT f._row_id FROM f JOIN ds_education_schools s ON ST_DWithin(f.g, s.geom_3826, 500)),
river AS (SELECT geom_3826 AS g FROM ds_water_resources_river_infrastructure_wra
          WHERE ST_GeometryType(geom) IN ('LINESTRING','MULTILINESTRING') AND geom_3826 IS NOT NULL),
near_river AS (SELECT DISTINCT f._row_id FROM f JOIN river r ON ST_DWithin(f.g, r.g, 300))
SELECT count(*) AS sources,
       count(*) FILTER (WHERE _row_id IN (SELECT _row_id FROM near_school)) AS with_school,
       count(*) FILTER (WHERE _row_id IN (SELECT _row_id FROM near_river)) AS with_river,
       count(*) FILTER (WHERE _row_id IN (SELECT _row_id FROM near_school) AND _row_id IN (SELECT _row_id FROM near_river)) AS with_both
FROM f
```
換來源表（裁罰、列管設施）或受體表（保護區面用 `ST_Intersects`）時先 `pulse_wh_describe`。再依縣市彙總找集中區。

**必帶但書**：來源點多為地址地理編碼的參考點；「半徑內」不是污染傳播或暴露；裁罰是歷史事件，不代表現況仍違規；河川資料含堤防等線，必要時只取河道線。

**停止**：總數、各受體命中數、兩者皆有的數量＋前幾個縣市。

**追問**：兩者皆有的點要不要列出並上地圖？要不要按縣市排名？要不要只看近 3 年？
