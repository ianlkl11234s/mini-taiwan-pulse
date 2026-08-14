# Vessel Watch — 特殊船舶

台灣周邊海域的海警／海巡／科研船／軍艦 AIS 位置與軌跡，**永久保留**。

- **完整設計與決策紀錄**：[`docs/proposal/vessel-watch-layer.md`](../../proposal/vessel-watch-layer.md)（SSOT）
- **上線日**：2026-08-12（資料層與前端圖層同日完成）
- **圖層位置**：情勢 Situation → 軍事（`plaActivity` 隔壁）

## 這層在解什麼問題

`live.ship_positions` 只留 21 天就滾掉，但海警／海巡這類船正是最值得長期觀察的。
實測這類船只佔全量 AIS 的 **0.38%**，獨立存一年約 162 萬筆 / 300–500MB → 永久保留完全可行。

## 兩張表

| 表 | 角色 |
|---|---|
| `live.vessel_watch_registry` | **名冊**：一船一列。規則欄位（`rule_class`）每週掃描覆寫；人工欄位（`confirmed_class` / `note` / `is_excluded`）掃描永不觸碰 |
| `live.vessel_watch_positions` | **軌跡**：只進不出，永久保留。每小時 pg_cron 從母表撈 |

有效分類 = `COALESCE(confirmed_class, rule_class)`。

## 搭配圖層：領海界線（`maritimeBoundary`）

在「底圖 Base Map → 海域界線」，內政部 98 年公告的領海基線 / 12 浬領海 / 24 浬鄰接區 / 26 個基點。
355KB PMTiles（`public/base_map/maritime_boundary.pmtiles`），24 浬用虛線區分法律地位。
色票 SSOT `src/data/maritimeBoundaryTypes.ts`。

它跟本 feature 是同一個敘事的兩半——**船在哪** ＋ **哪條線**。
⚠️ PMTiles 不進 git，部署前必跑 `scripts/deploy/upload-deploy-assets.sh`（見 backlog VW-8）。

## 為什麼不做「歷史模式」

2026-08-13 一度實作把圖層接進 `appMode === "historical"`，做完發現方向錯誤，已 revert。原因：

1. **即時模式本來就沒有回溯下限** —— `useTimeline.shiftDate` 無 clamp，日期選擇器可直接跳到任何一天，
   而且那條路上還有歷史模式沒有的東西：完整圖層清單、日內時間軸（船會動）、popup
2. **歷史模式沒有圖層清單** —— 切過去之後 sidebar 的搜尋框與 toggle 都不見了，
   使用者根本無法在那裡開關圖層
3. **粒度不對** —— 歷史模式是給跨年度資料設計的（民國 104–115 共 12 年 slider），
   半年資料拖一格就跳過整個月

→ 判準：**要不要進歷史模式，前提是資料得跨年**。本層不跨年，即時模式的日期切換已完全夠用。

## 前端

- 純 Mapbox `circle` + `line`，**零 Three.js**（`ships` 已佔用 ShipScene，PRINCIPLES §L828）
- 軌跡走 `MultiLineString`，**超過 60 分鐘無訊號即切段** —— 不切會畫出橫跨海峽的虛構航跡（實測 59% 的船需要切段）
- 船隨時間軸移動：依 `currentTime` 在軌跡上插值（gap-aware）。
  **不可改用 `utils/interpolation` 的 `interpolatePosition`** —— 那支不看兩點相隔多久，
  跨訊號中斷時會讓船緩慢飄過台灣海峽（實測最大間隔 67 小時）
- 兩個門檻用途不同：`TRAIL_GAP_SEC`(1h) 決定線斷不斷；`STALE_SEC`(3h) 決定船點淡不淡化。
  後者太嚴會讓整層都是淡的（任一時刻只有 20~33 艘在岸基覆蓋內，但 3 天視窗有 150+ 艘）
- 12 類色票 SSOT：`src/data/vesselWatchTypes.ts`

## 維運

```bash
# 每週掃描（更新名冊 + 印待人工確認清單）
python3 data-collectors/scripts/scan_vessel_registry.py

# 只看待審清單不掃描
python3 data-collectors/scripts/scan_vessel_registry.py --report-only
```

審完在 psql 標記：
```sql
UPDATE live.vessel_watch_registry SET confirmed_class='中國海警', confirmed_at=now() WHERE mmsi='413xxxxxx';
UPDATE live.vessel_watch_registry SET is_excluded=true, note='台灣民間拖船', confirmed_at=now() WHERE mmsi='416xxxxxx';
```

## ⚠️ 命名地雷

`HAIXUN`「海巡」是**中國海事局**的船，跟**台灣海巡署**（MID 416）完全兩回事。
任何顯示一律寫全稱，不可只寫「海巡」。

## 誠實限制

- AIS 是自願廣播：中國／台灣海軍艦艇基本靜默，這層看到的是公務船、科研船、他國過境軍艦
- `ship_type` 為船方自報，會錯也會漏 → 分類是推斷不是官方認定
- 取樣稀疏（每艘約 15 分鐘一筆、離岸即斷）→ 禁用任何平滑插值
