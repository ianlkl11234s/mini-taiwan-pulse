# 三種視覺模式完整對照

> SKILL §1 的展開。挑模式時用這張表。

| 維度 | **Mode A** 路網染色 | **Mode B** Polygon 沿路網 | **Mode C** Hex / Grid |
|---|---|---|---|
| **回答的問題** | 「最近 X 幾 km」 | 「X 的服務範圍是哪一片」 | 「沙漠在哪 / 跨服務疊圖」 |
| **視覺類比** | 血管圖（沿路網細線）| 等高線（半透明色塊）| 馬賽克（格點熱圖）|
| **演算法** | multi-source dijkstra → edge band | per-station ego_graph / OSRM /table → concave_hull → union | per-cell nearest_node + dijkstra |
| **單位** | OSM edge（LineString）| Polygon / MultiPolygon | H3 cell / 1km grid |
| **既有實作** | `taiwan_nearest_distance.py` | `fetch-fire-isochrones.py` / `10_walking_isochrone_3min.py` | `medical/isochrone/grid_accessibility.py` |
| **路網來源** | osmnx / pyrosm / OSRM | osmnx ego_graph | osmnx + bbox grid |
| **跑全台時長** | ~10 min（osmnx 順）| 分縣 ~30 min | ~1-2 h |
| **PMTiles 大小** | ~5 MB / bucket | ~10 MB / county / interval | ~5-10 MB |
| **適合 POI** | 開車能到的（加油 / 充電 / 服務區）| 站為單位看服務範圍（消防 / 醫療 / 救援）| 跨服務疊圖 / 沙漠 indicator |
| **不適合** | 步行 POI / 不沿路網 | 超多站（hull 計算貴）| 細緻路網語意 |
| **疊圖容易度** | 中（line 疊 line 易混）| 低（polygon 互相覆蓋）| **高**（hex id 一致）|
| **Popup 內容** | dist_m + band | 服務範圍說明 | cell count + nearest dist |
| **z 最佳區間** | z6-12（再縮小看不清細線）| z6-11 | z6-12 |
| **更新頻率** | 半年（路網變化慢）| 半年 | 半年 |
| **算法穩定度** | ✅ 100%（dijkstra 確定）| ⚠️ concave_hull alpha 參數需調 | ✅ 確定 |

---

## 何時三種都做？

跨服務分析時混搭。例：

**「醫療沙漠 ∩ EV 孤島 ∩ 火災密集」三角分析**
- Mode C hex 底圖：跨服務聚合「最危險區域」染深紅
- Mode A line 疊：放大時看主要道路染色
- Mode B polygon outline：標示「消防 5min 可達邊界」

---

## 切換模式不換 POI 的成本

| 情境 | 動到的層 | 成本 |
|---|---|---|
| 模式 A → B（加 polygon hull）| 加 hull 算法 step | ~1 day |
| 模式 A → C（加 hex 聚合）| 加 hex polyfill step | ~0.5 day |
| 模式 B → A（換成沿路網）| 全改 pipeline | ~1-2 day |

→ **第一次接 POI 時花時間選對 mode，後續改 mode 不划算**。
