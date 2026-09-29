# 村里服務缺口：可及性 gap + 受影響人口（空間）

**適用**：「哪些村里的老人在長照／醫療機構 1 公里內沒有覆蓋」「特定族群的服務缺口在哪、影響多少人」——與 [buffer-overlay 的涵蓋率變體](buffer-overlay.md) 不同之處：這裡要**列出**缺口村里與人口，不只算一個涵蓋率 %。

**工具鏈**（`pulse_sql`；已驗證模板，7,973 村里 × 長照+醫療兩來源 ST_DWithin，約 1.2 秒）
```sql
WITH villages AS (
  SELECT VILLCODE, COUNTYNAME, TOWNNAME, VILLNAME, "人口數" AS pop, "65歲以上人口數" AS pop65, ST_Centroid(geom_3826) AS c
  FROM ds_demographics_village_comprehensive_extended WHERE geom_3826 IS NOT NULL AND "人口數" >= 50
),
ratio AS (
  SELECT *, percent_rank() OVER (PARTITION BY COUNTYNAME ORDER BY pop65 / pop) AS county_pctl FROM villages
),
facility AS (
  SELECT geom_3826 AS g FROM ds_welfare_ltc_institutions WHERE geom_3826 IS NOT NULL
  UNION ALL SELECT geom_3826 FROM ds_poi_medical WHERE geom_3826 IS NOT NULL
)
SELECT r.COUNTYNAME AS county, count(*) AS gap_villages
FROM ratio r WHERE r.county_pctl >= 0.9 AND NOT EXISTS (SELECT 1 FROM facility f WHERE ST_DWithin(r.c, f.g, 1000))
GROUP BY 1 ORDER BY 2 DESC
```
先用 `percent_rank() OVER (PARTITION BY 縣市)` 篩出**縣市內**高齡比例前段（跨縣市直接比 raw ratio 會被城鄉基期差異蓋掉）；再用 `NOT EXISTS` + `ST_DWithin` 判斷缺口。多來源設施（長照＋醫療）用 `UNION ALL` 併成一個 `facility` CTE 一次判斷，不要對每個來源各查一次再取交集。實測（`ds_welfare_ltc_institutions` + `ds_poi_medical`，1000m）：全國 7,973 村里中有 443 個落在「縣市內高齡前 10% 且 1km 內無設施」，新北市（77）、臺南市（56）最多。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：距離是村里**幾何中心點**（centroid）到最近設施點的直線距離，非村里人口分布重心、非路網；`ds_poi_medical` 是醫事機構全量（含診所），非僅急重症醫院，若題目要「醫院」需另篩 `facility_kind`／`category`；`人口數 >= 50` 排除極小樣本村里避免比例噪音，但仍會漏掉真正無人居住的邊界村里。

**停止**：缺口村里數（依縣市）＋人口最多前幾筆樣本（含高齡比例 %）。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要把長照拆成住宿型／社區型／居家型分別看？要不要疊到地圖看空間分布？要不要換成鄉鎮層級涵蓋率 %（見 buffer-overlay 涵蓋率變體，兩者可互相驗證）？
