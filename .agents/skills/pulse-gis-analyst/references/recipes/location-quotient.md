# 產業／設施集中度：區位商數 LQ（關聯）

**適用**：「哪個鄉鎮住宿業／餐飲業特別密集」「哪裡是觀光聚落」「某類設施是不是集中在特定地方」——比單純密度排名多一層：LQ 把「鄉鎮占比」除以「全國占比」，排除掉鄉鎮本身規模大小的干擾。

**工具鏈**（`pulse_sql`；已驗證模板，130 萬筆公司登記 × 368 鄉鎮空間 join，約 6 秒）
```sql
WITH towns AS (SELECT area_code, name, geom_3826 AS g FROM boundaries_town),
cat AS (
  SELECT t.area_code, c.industry_code_mid AS industry, count(*) AS n
  FROM ds_business_registry_company_stock c JOIN towns t ON ST_Within(c.geom_3826, t.g)
  WHERE c.geom_3826 IS NOT NULL AND c.industry_code_mid IN ('55', '56') GROUP BY 1, 2
),
total AS (
  SELECT t.area_code, count(*) AS n FROM ds_business_registry_company_stock c JOIN towns t ON ST_Within(c.geom_3826, t.g)
  WHERE c.geom_3826 IS NOT NULL GROUP BY 1
),
national AS (SELECT industry_code_mid AS industry, count(*) AS n FROM ds_business_registry_company_stock WHERE geom_3826 IS NOT NULL AND industry_code_mid IN ('55', '56') GROUP BY 1),
national_total AS (SELECT count(*) AS n FROM ds_business_registry_company_stock WHERE geom_3826 IS NOT NULL)
SELECT t.name AS township, cat.industry, cat.n AS industry_n, total.n AS total_n,
       round((cat.n::DOUBLE / total.n) / (nat.n::DOUBLE / nt.n), 2) AS lq
FROM cat JOIN towns t ON t.area_code = cat.area_code
JOIN total ON total.area_code = cat.area_code
JOIN national nat ON nat.industry = cat.industry
JOIN national_total nt ON true
WHERE total.n >= 50 AND cat.n >= 5
ORDER BY cat.industry, lq DESC
```
行業用 `industry_code_mid`（2 碼中類，代碼表在 `ds_business_registry_industry_codebooks`，例如 55=住宿業、56=餐飲業）；門檻 `total.n >= 50` 排除公司總數太少的鄉鎮（否則 1-2 家就能讓 LQ 爆表），`cat.n >= 5` 排除該行業樣本太小的組合。實測（住宿業，code 55）：LQ 最高的鄉鎮是六龜區（61.4）、仁愛鄉（58.9）、魚池鄉（57.4）、烏來區（56.4）、和平區（43.8）——全部是已知觀光聚落（六龜、清境、日月潭、烏來、谷關），可作觀光壓力代理指標。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：LQ 只看**相對**集中度，不是絕對規模，要跟 `industry_n`／`total_n` 一起看才不會誤讀（小鄉鎮少數幾家也可能衝高 LQ，門檻已排除極端小樣本但仍需並列 n）；`industry_code_mid` 是登記地址對應的中類代碼，同代碼底下仍可能混雜不同業態的公司；地址是**登記地址**非必然等於實際營業地（`addr_mismatch` 欄位可查兩者是否不同）。

**停止**：目標行業 Top 10 LQ 鄉鎮 ＋ 各自的 `industry_n`／`total_n` ／ LQ 值。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換行業（零售／製造／批發）？要不要跟觀光景點或住宿密度疊圖交叉驗證？要不要換更細的公司資本額網格（`ds_business_registry_company_capital_grid`）看城鎮內部分布？
