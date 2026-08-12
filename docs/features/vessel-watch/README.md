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

## 前端

- 純 Mapbox `circle` + `line`，**零 Three.js**（`ships` 已佔用 ShipScene，PRINCIPLES §L828）
- 軌跡走 `MultiLineString`，**超過 60 分鐘無訊號即切段** —— 不切會畫出橫跨海峽的虛構航跡（實測 59% 的船需要切段）
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
