# 集中區／熱點（空間＋關聯）

**適用**：「哪裡特別集中」「X 的熱點在哪」「哪些村里特別多」。

**工具鏈**（`pulse_sql`；已驗證模板）
```sql
-- 行政單位密度（每平方公里）
SELECT t.name, count(*) AS n, round(count(*) / (ST_Area(any_value(t.geom_3826)) / 1e6), 2) AS per_km2
FROM ds_education_cram_schools c JOIN boundaries_town t ON ST_Within(c.geom, t.geom)
GROUP BY t.area_code, t.name ORDER BY per_km2 DESC LIMIT 10;
-- 1 公里網格計數
SELECT floor(ST_X(geom_3826) / 1000) AS gx, floor(ST_Y(geom_3826) / 1000) AS gy, count(*) AS n
FROM ds_education_cram_schools WHERE geom_3826 IS NOT NULL GROUP BY 1, 2 ORDER BY n DESC LIMIT 10;
```
網格要上地圖時，用 `ST_Transform(ST_MakeEnvelope(gx*1000, gy*1000, gx*1000+1000, gy*1000+1000), 'EPSG:3826', 'EPSG:4326', always_xy := true)` 產生格子面。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：本配方只做「密度排名」，只能說「相對集中」而不是「統計顯著熱點」；要嚴謹檢定（z 值、顯著性）換用 [hotspot-gi-star](hotspot-gi-star.md)（Getis-Ord Gi*，目前仍未做全域 Moran's I）；換格子大小或行政單位，結果可能改變（MAUP）；計數未標準化時只是在畫人口分佈。

**停止**：前 10 區＋一張密度地圖（面或格）。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換格子大小確認結果穩定？要不要改成人均？要不要跟另一個變數比對（→ [area-correlation](area-correlation.md)）？
