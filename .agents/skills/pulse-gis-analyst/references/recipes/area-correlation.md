# 區域相關（關聯，可能延伸因果）

**適用**：「公車站多的地方房價比較高嗎」「X 和 Y 有沒有關係」。

**工具鏈**（`pulse_sql`，以村里或鄉鎮為單位；已驗證模板）
```sql
WITH x AS (SELECT v.area_code, count(*) AS n
           FROM ds_transportation_bus_by_city b JOIN boundaries_village v ON ST_Within(b.geom, v.geom) GROUP BY 1),
     y AS (SELECT area_code, value FROM stats_observations
           WHERE indicator = 'village_comprehensive_income_median' AND status = 'observed')
SELECT count(*) AS areas, corr(coalesce(x.n, 0), y.value) AS r, corr(ln(1 + coalesce(x.n, 0)), y.value) AS r_log
FROM y LEFT JOIN x USING (area_code)
```
點資料要先除以面積或人口再比（密度），否則只是在畫「大村里」。房價用 `ds_real_estate_merged_points` 且 **只取 `type = 'sale'`**（`rental` 的單價是租金）；公司用 `ds_business_registry_company_points_analysis`。房價的 `city` 是英文代碼（`taipei`、`newtaipei`、`taichung`…），要篩縣市時優先用 `boundaries_county` 空間篩選，不用中文比對。

**必做兩個檢查**（2026-09-26 實例：全國合併時公車站密度 vs 房價 r = −0.29，但縣市內中位數是 +0.12）：
1. **縣市內再算一次**：在 SELECT 加 `substr(area_code, 1, 5) AS county` 後 `GROUP BY county` 算 `corr`；全國與縣市內方向相反時，以縣市內為準並說明（辛普森悖論）。
2. **資料覆蓋**：算每縣市「0 筆的村里比例」；超過一半代表資料缺漏（例：`bus_by_city` 在臺北、新北大多沒有站牌），這些縣市不解讀。

**必帶但書**（讀 [geo-reasoning 陷阱](../../../geo-reasoning/references/frameworks.md)）：區域相關不等於個體關係（生態謬誤）；換成鄉鎮可能改變結果（MAUP）；相關不是因果，先想第三變數（都市化程度常同時驅動兩者）。|r| < 0.1 就說「幾乎沒有線性關係」。

**停止**：一個相關係數＋樣本數＋一句解讀；需要時一張雙變量地圖。

**追問**：要不要換鄉鎮尺度看是否一致？要不要控制都市化（只比都會區）？要不要交給 why-drill skill 往下挖原因？
