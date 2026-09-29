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

**必帶但書**（自查用，讀 [geo-reasoning 陷阱](../../../geo-reasoning/references/frameworks.md)；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：區域相關不等於個體關係（生態謬誤）；換成鄉鎮可能改變結果（MAUP）；相關不是因果，先想第三變數（都市化程度常同時驅動兩者）。|r| < 0.1 就說「幾乎沒有線性關係」。

**停止**：一個相關係數＋樣本數＋一句解讀；需要時一張雙變量地圖。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換鄉鎮尺度看是否一致？要不要控制都市化（只比都會區）？要不要交給 why-drill skill 往下挖原因？

**二元分組變體**（例如「淹水潛勢區內 vs 區外房價差多少」，不是連續變數相關）：用 `ST_Intersects` 標記 in/out 兩組，按行政區分層各自算中位數再比較差異方向，取代 `corr()`；一樣要檢查「全市合併 vs 各區分層」方向是否一致（辛普森悖論）。全國規模的點×面 `ST_Intersects` 逾時風險高，先用非空間欄位（`city`／`county`）縮到同縣市再做空間 join。點資料的二元分組（例如「村里中心 1.2km 內有無球場」→ 買賣單價中位數差，按行政區分層）改用 `ST_DWithin` 判 `EXISTS` 當 boolean 標籤，再照同樣邏輯分組比較（實測台北＋新北村里 vs 房價，多數行政區「有球場」中位數較高，但三芝／五股／八里等區反向，屬 PARTIAL：直線代理非路網等時圈）。

**密度型相關變體**（例如「鄉鎮宗教設施每萬人密度與老化指數的相關」）：分子分母都先在村里層級 `sum()` 到鄉鎮再相除（老化指數＝ `sum(65歲以上人口數) / sum(0-14歲人口數) * 100`，不要對村里既有的老化指數直接 `avg()`），再用 `corr()` 分別算合併與縣市分層兩個版本。實測（宗教設施＝寺廟＋教會＋其他宗教場所，365 個鄉鎮）：合併 r=0.71，19 個縣市分層全部同號（0.14～0.93），**未觀察到辛普森反轉**——分層檢查不保證會找到悖論，沒找到也要照實回報。

