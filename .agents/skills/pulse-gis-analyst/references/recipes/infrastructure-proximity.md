# 基礎設施鄰近盤點（空間）

**適用**：「電廠／變電所周邊有哪些關鍵設施」「找出同時靠近 ≥2 個某類設施的地點」。

**工具鏈**（`pulse_sql`；已驗證模板，多來源×多受體 1–3km 約 260×38,000 點對，<1.5 秒）
```sql
WITH energy AS (
  SELECT row_number() OVER () AS energy_id, kind, name, g FROM (
    SELECT 'power_plant' AS kind, plant_name AS name, geom_3826 AS g FROM ds_energy_power_plants WHERE geom_3826 IS NOT NULL
    UNION ALL
    SELECT 'ehv_substation', name, geom_3826 FROM ds_energy_osm_substations
    WHERE geom_3826 IS NOT NULL AND (voltage LIKE '%161000%' OR voltage LIKE '%345000%')
  )
),
targets AS (
  SELECT row_number() OVER () AS target_id, kind, name, g FROM (
    SELECT 'hospital' AS kind, address AS name, geom_3826 AS g FROM ds_poi_medical WHERE geom_3826 IS NOT NULL
    UNION ALL SELECT 'school', school_name, geom_3826 FROM ds_education_schools WHERE geom_3826 IS NOT NULL
  )
),
pairs AS (SELECT t.target_id, t.kind, t.name, e.energy_id FROM targets t JOIN energy e ON ST_DWithin(t.g, e.g, 3000))
SELECT kind, target_id, name, count(DISTINCT energy_id) AS n_nearby FROM pairs GROUP BY 1, 2, 3 HAVING count(DISTINCT energy_id) >= 2
```
`row_number() OVER ()` 包在最外層 SELECT（而非各 UNION 分支內）才不會撞號；DISTINCT 不能直接用在 geometry 欄位上，一定要先給整數 id。多來源／多受體都用同一套「先編號、再 DWithin、再 count(DISTINCT id)」模式，可套用到任何「找同時靠近 N 個 X 的 Y」問題。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：OSM 來源的變電所／電塔等資料常有欄位缺值（例如 voltage 只標一部分），會低估總數；「醫療設施」若用 `ds_poi_medical` 含所有院所而非僅醫院，需說明；距離是直線，非電磁暴露或風險範圍。

**變體：地震震央 × 周邊設施**（`ds_hazards_earthquake_events_cwa`，20260926 起有）——把 `energy` 換成 `WHERE report_type = 'catalog' AND magnitude >= 5`（同一物理地震常同時出現在 catalog／significant／local 三種 report_type，只取 catalog 才不會重複計數；已於 questionBank Q27 驗證），半徑用 20km 篩「受影響設施」而非電磁鄰近。⚠️ 震央距離不是震度：同樣 20km 半徑因地質、方向、深度不同，實際搖晃程度可能差很大；倉庫目前沒有村里／鄉鎮級的實際震度資料（PGA／震度圖），只能做曝光篩選，不能回答「哪裡搖得最劇烈」。

**停止**：各受體類別的「3km 內設施數」與「同時靠近 ≥2 來源」數 ＋ 前幾筆範例。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換半徑（1km／3km 分層）？要不要換成全國逐縣市盤點？要不要把命中設施列出來放地圖？
