# 食物可及性缺口：便利商店（空間，限台北市範圍資料）

**適用**：「哪些村里買不到超商」「食物沙漠在哪」。方法與 [elderly-care-access](elderly-care-access.md) 相同（村里中心 `NOT EXISTS` + `ST_DWithin`），差別只在半徑與設施來源，這裡直接套用。

**工具鏈**（`pulse_sql`；已驗證模板，456 個村里 × 3,719 個便利商店點，<200ms）
```sql
WITH villages AS (
  SELECT TOWNNAME, VILLNAME, "人口數" AS pop, ST_Centroid(geom_3826) AS c
  FROM ds_demographics_village_comprehensive_extended WHERE COUNTYNAME = '臺北市' AND geom_3826 IS NOT NULL
),
stores AS (SELECT geom_3826 AS g FROM ds_poi_taipei_poi_integrated WHERE category = 'convenience_store' AND geom_3826 IS NOT NULL),
gap AS (SELECT v.* FROM villages v WHERE NOT EXISTS (SELECT 1 FROM stores s WHERE ST_DWithin(v.c, s.g, 500)))
SELECT TOWNNAME, VILLNAME, pop FROM gap ORDER BY pop DESC LIMIT 20
```
500m 約步行 6-7 分鐘，是常用的「日常採買可及」門檻代理。實測：台北市 456 個村里中 46 個（10.1%）中心 500m 內無便利商店，合計影響約 18.7 萬人（占台北市人口 251 萬的 7.5%），人口最多的缺口村里在南港區舊莊里（8,792 人）、文山區萬興里（8,374 人）等山區／邊緣行政區。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：`ds_poi_taipei_poi_integrated` 只覆蓋**台北市**，非全國（全國超商 pipeline `docs/data-registry.yaml` 有登記但尚未產出落地，見 batch2-feasibility.md §6）；`category = 'convenience_store'` 只含 7-11／全家等便利商店，沒有獨立的超市或傳統市場資料源，不能就此稱「食物沙漠」全貌，只能說「便利商店可及性缺口」。

**停止**：缺口村里數／人口／占台北市人口比例＋人口最多前幾筆樣本。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要先補全國超商資料再擴大到六都？要不要疊加超市／傳統市場一起看？要不要換成鄉鎮層級涵蓋率 %（見 buffer-overlay 涵蓋率變體）？
