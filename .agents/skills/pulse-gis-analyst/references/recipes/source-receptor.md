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
換來源表或受體表時先 `pulse_wh_describe`：
- 污染裁罰 `ds_environment_pollution_penalties`（414,904 筆；建議 `penalty_year >= 2023`，並排除 `geocode_precision = 'address_osm'` 的補位座標；`event_medium`／`transgress_type` 可分類）。
- 保護區面 `ds_marine_wildlife_protected_areas`：用 `ST_Intersects(ST_Buffer(f.g, 1000), w.geom_3826)`。
- 全國 2023 年後裁罰約 9.4 萬筆 × 學校／河川／保護區約 14 秒；先縮到縣市或期間可更快。再依縣市彙總找集中區。
- 水源保護區（水質水量保護區）面 `ds_water_resources_water_source_protection_areas`（107 面，2026-09-26 store 起有；`ST_Within` 判內、`ST_DWithin(..., 1000)` 判 1km 緩衝內）；全國 2023 年後裁罰落在保護區內約 3%、1km 內約 5%（見 questionBank Q15），新竹縣／新竹市／苗栗縣佔比明顯高於六都。此表**只有面**，沒有保護區等級／管制內容欄位，只能判斷「有無疊合」，管制強度需另查法規。
- 換成連續距離（例如「最近距離的分佈」而非「N 公尺內有沒有」）：把 `ST_DWithin` 換成 `min(ST_Distance(...))` 分組後配 `quantile_cont(d, 0.25/0.5/0.75)` 算四分位；同樣先依縣市或分組再算，避免混進不同密度地區。
- 事故點 × 設施（例如 A1 事故 300m 內有沒有學校）也是同一套模板：來源換成事故表、受體換成設施表，命中後用 `boundaries_county` 空間 join 依縣市彙總，再算命中率（`count(*) FILTER (...) * 100.0 / count(*)`）。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：來源點多為地址地理編碼的參考點；「半徑內」不是污染傳播或暴露；裁罰是歷史事件，不代表現況仍違規；河川資料含堤防等線，必要時只取河道線。

**停止**：總數、各受體命中數、兩者皆有的數量＋前幾個縣市。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：兩者皆有的點要不要列出並上地圖？要不要按縣市排名？要不要只看近 3 年？
