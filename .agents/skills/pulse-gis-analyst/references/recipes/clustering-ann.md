# 點群聚程度：最近鄰指數 ANN（關聯）

**適用**：「這些點是集中還是分散」「哪個縣市的畜牧場／工廠特別群聚」。是 [hotspot-density](hotspot-density.md)（找熱點在哪）的反面：ANN 給的是「整體群聚程度」一個數，不是熱點位置。

**工具鏈**（`pulse_sql` 算每點的最近鄰距離；Clark-Evans R 與 z 留給呼叫端算）
```sql
WITH pts AS (SELECT _row_id AS id, 縣市 AS grp, geom_3826 AS g FROM ds_agriculture_livestock_ranch
             WHERE geom_3826 IS NOT NULL AND _source_file = 'data/processed/agriculture/livestock_ranch/livestock_ranch_points_enriched_20260705.geojson'),
nn AS (SELECT a.id, a.grp, min(ST_Distance(a.g, b.g)) d FROM pts a JOIN pts b ON a.grp = b.grp AND a.id <> b.id GROUP BY 1, 2),
agg AS (SELECT grp, count(*) n, avg(d) mean_nn_m FROM nn GROUP BY 1 HAVING count(*) >= 10),
area AS (SELECT name, ST_Area(geom_3826)/1e6 km2 FROM boundaries_county)
SELECT agg.grp, agg.n, agg.mean_nn_m, area.km2 FROM agg JOIN area ON area.name = agg.grp
```
呼叫端算：`期望值 = 0.5*sqrt(面積m² / n)`；`R = 實際平均最近鄰距離 / 期望值`（R<1 偏群聚、R>1 偏分散）；`SE = 0.26136*sqrt(面積m²) / n`；`z = (實際 - 期望) / SE`，`z < -1.96` 視為顯著群聚（p<0.05）。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：同組內自 join 成本是 O(n²)，單組超過數千點會變慢，先確認組內數量（`GROUP BY grp HAVING count(*)>=10` 可先篩掉太小的組不必算）；面積用縣市總面積近似，未扣除都市／海域等不可能出現該點位的區域，期望值可能被高估，ANN 只適合**同類面積基準**下的縣市間相對比較，不是絕對群聚强度。`ds_agriculture_livestock_ranch` 同時混了新舊快照與 raw/enriched 檔（40,467 列對應僅 13,087 個相異證號），**務必先 `SELECT _source_file, count(*) GROUP BY 1` 確認去重欄位**，不篩 `_source_file` 會把同一批場重複算 2–3 次。

**停止**：各組 n、平均最近鄰距離、ANN 指數、z 值＋顯著群聚的組別清單。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換成全國不分組直接算一次？要不要排除離島／極端值後重算？要不要疊圖看群聚點的空間位置？
