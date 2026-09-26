# 熱點顯著性 Getis-Ord Gi*（空間＋關聯）

**適用**：「哪裡是統計上顯著的熱點，不只是密度高」「z 值多少才算熱點」。是 [hotspot-density](hotspot-density.md)「僅密度排名」的升級版，但仍非全域 Moran's I 檢定，且僅示範單一縣市範圍（見下方但書）。

**工具鏈**（`pulse_sql`；已驗證模板，臺北市 1km 網格約 620 格 <1.5 秒）
```sql
WITH area AS (SELECT geom_3826 AS g FROM boundaries_county WHERE area_code = '63000'),
bbox AS (SELECT ST_XMin(g) minx, ST_YMin(g) miny, ST_XMax(g) maxx, ST_YMax(g) maxy FROM area),
dims AS (SELECT minx, miny, cast(ceil((maxx-minx)/1000) AS INT) ncols, cast(ceil((maxy-miny)/1000) AS INT) nrows FROM bbox),
pts AS (SELECT a.geom_3826 g FROM ds_environment_traffic_accident a, area t WHERE a.accident_category='A1' AND ST_Within(a.geom_3826, t.g)),
cell AS (SELECT cast(floor((ST_X(g)-minx)/1000) AS INT) col, cast(floor((ST_Y(g)-miny)/1000) AS INT) row FROM pts, dims),
grid AS (SELECT c.col, r.row FROM dims, generate_series(0, dims.ncols-1) c(col), generate_series(0, dims.nrows-1) r(row)),
counts AS (SELECT g.col, g.row, count(a.col) x FROM grid g LEFT JOIN cell a ON a.col=g.col AND a.row=g.row GROUP BY 1,2),
stats AS (SELECT count(*) n, avg(x) xbar, avg(x*x)-avg(x)*avg(x) var_pop FROM counts),
neigh AS (SELECT c1.col, c1.row, sum(c2.x) s1, count(*) w FROM counts c1 JOIN counts c2
          ON c2.col BETWEEN c1.col-1 AND c1.col+1 AND c2.row BETWEEN c1.row-1 AND c1.row+1 GROUP BY 1,2)
SELECT col, row, (s1 - stats.xbar*w) / (sqrt(stats.var_pop) * sqrt((stats.n*w - w*w)::DOUBLE/(stats.n-1))) AS gi_star
FROM neigh, stats WHERE (s1 - stats.xbar*w) / (sqrt(stats.var_pop) * sqrt((stats.n*w - w*w)::DOUBLE/(stats.n-1))) > 2.58
```
`grid` 一定要含 0 值格（在 bbox 內用 `generate_series` 產生完整網格，`LEFT JOIN` 補 0），否則全域平均 X̄ 會被高估、Gi* 失真。二元權重 w（3×3 含自身）時 Σw² = Σw，公式可簡化成上面這樣。

**必帶但書**：邊緣格鄰域格數 <9，z 值偏保守；只示範單一縣市（全國網格＋鄰域自join規模會爆炸，見下方追問）；z > 2.58 ≈ p<0.01（雙尾），z > 1.96 ≈ p<0.05；仍是二元鄰接權重，未做距離衰減。

**停止**：顯著熱點格數（z 門檻）＋ 前 5 格座標與 z 值。

**追問**：要不要放寬到 z>1.96？要不要換縣市或換成全國分縣市各跑一次？要不要疊圖看熱點格對應哪些行政區？
