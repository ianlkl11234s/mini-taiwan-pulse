# Supabase RPC 盤點報告 (2026-04-09)

> 目的：在 `get_ship_trails` / `get_flight_trails` 解掉 60s timeout 後，系統性盤點其他 RPC，找出下一個可能爆 timeout 的對象，套用同樣的 pre-aggregate + statement_timeout 防禦 pattern。
>
> 方法：只讀 `pg_proc` metadata + function definition，搭配 CLAUDE.md 的資料量估算，**未跑任何聚合 query**。

## 摘要

- 總共盤點 **20 個 RPC**（含 2026-04-10 新增公車 3 個）
- 🔴 高風險 **2 個**（需要比照 ship/flight 做 pre-aggregate table）
- 🟡 中風險 **3 個**（可觀察、先加 statement_timeout 或 index）
- 🟢 低風險 **15 個**（matview/pre-agg/單次查表/小資料，現況 OK）

最該動手的 top 3：
1. `get_youbike_h3_snapshots` — 每日 ~36 萬筆即時 JOIN + 2 層 GROUP BY
2. `get_freeway_congestion_day` — 每日全表 `string_agg(... ORDER BY)` 聚合
3. `get_temperature_frames` — 每日 `string_agg(... ORDER BY grid_lat, grid_lng)` 容易走 sort

---

## 詳細表格

| # | RPC | 呼叫位置 | 底層 table | 參數 | 聚合 | 全表 ORDER BY | statement_timeout | 回傳預估 | 分類 | 風險 | 建議 |
|---|-----|---------|-----------|------|------|---------------|-------------------|----------|------|------|------|
| 1 | `get_ship_trails` | shipLoader.ts:81 | `realtime.ship_trails_daily` | `target_date` | 無（已 pre-agg） | 無 | ✅ 60s | ~27MB | ② 現況 OK | 🟢 | 已完成修復 |
| 2 | `get_flight_trails` | airspaceLoader.ts:75 | `realtime.flight_trails_daily` | `target_date` | 無（已 pre-agg） | 無 | ✅ 60s | ~2MB | ② 現況 OK | 🟢 | 已完成修復 |
| 3 | `get_youbike_h3_snapshots` | youbikeH3Loader.ts:49 | `realtime.youbike_snapshots` + `reference.station_h3_mapping` | `target_date,h3_resolution` | `SUM`+`AVG`+`jsonb_agg` 兩層 GROUP BY + JOIN | 有隱含排序 | ✅ 30s | 中（96 × N cells jsonb） | ① **matview 候選** | 🔴 | Pre-aggregate 成 `realtime.youbike_h3_daily(day, resolution, time_key, cells)` + pg_cron refresh |
| 4 | `get_freeway_congestion_day` | freewayLoader.ts:84 | `realtime.freeway_sections` + `freeway_sections_current` | `target_date` | `string_agg(... ORDER BY collected_at)` + GROUP BY section_id | 是（per-group sort） | ✅ 60s | 中～大（依日 sections×snapshots） | ① **matview 候選** | 🔴 | Pre-aggregate 成 `realtime.freeway_congestion_daily(day, section_id, timeline, geom, ...)` + 每 10 分 refresh today |
| 5 | `get_temperature_frames` | temperatureLoader.ts:68 | `realtime.temperature_grids` (~61 萬/月) | `target_date` | `string_agg(round(temp) ORDER BY grid_lat, grid_lng)` + GROUP BY observed_at | 有（per-frame lat,lng 排序） | ✅ 30s | 中（每 frame ~1000 cells text） | ① matview 候選 | 🟡 | 先確認 `(observed_at, grid_lat, grid_lng)` index 存在；若 planner 走 global sort 就 pre-agg 成 `temperature_frames_daily` |
| 6 | `get_disaster_alerts_day` | disasterAlertLoader.ts:73 | `realtime.disaster_alerts` + `spatial.township_boundaries`/`boundaries` | `target_date` | `ST_Union` GROUP BY identifier + `ST_SimplifyPreserveTopology` | 有 ORDER BY effective/sent | ✅ 30s | 小～中 | ② 現況 OK，但 | 🟡 | 若 alert 量變大，township/county union 會是 hotspot；加 `(msg_type, effective, expires)` 複合 index，或 materialise 成 daily |
| 7 | `get_temperature_grid_info` | temperatureLoader.ts:67 | `realtime.temperature_grids` | `target_date` | `DISTINCT` + ORDER BY | 有 | ✅ 10s | 小 (~1000 rows) | ② 現況 OK | 🟡 | 超短 timeout (10s)，若 planner 不佳會直接失敗；建議改查 `reference.temperature_grid_cells` 靜態表（grid 基本不變） |
| 8 | `get_cwa_imagery_list` | cwaImageryLoader.ts:57 | `realtime.cwa_imagery_frames` | `dataset_ids[], since` | 無 | ORDER BY (dataset_id, observed_at) | ❌ 無 | 小 | ② 現況 OK | 🟢 | 確認 `(dataset_id, observed_at)` index 存在即可 |
| 9 | `get_cwa_imagery_frame` | cwaImageryLoader.ts:101 | `realtime.cwa_imagery_frames` | `dataset_id, observed_at` | 無（base64 encode） | 無 | ❌ 無 | 單張圖（~100KB~MB） | ② 現況 OK | 🟢 | 主鍵查詢，OK |
| 10 | `get_ship_dates` | shipLoader.ts:66 | `public.mv_ship_dates` | — | matview | 無 | ❌ 無 | <1KB | ② 現況 OK | 🟢 | — |
| 11 | `get_flight_dates` | airspaceLoader.ts:60 | `public.mv_flight_dates` | — | matview | 無 | ❌ 無 | <1KB | ② 現況 OK | 🟢 | — |
| 12 | `get_freeway_dates` | freewayLoader.ts:39 | `public.mv_freeway_dates` | — | matview | 無 | ❌ 無 | <1KB | ② 現況 OK | 🟢 | — |
| 13 | `get_youbike_h3_dates` | youbikeH3Loader.ts:36 | `public.mv_youbike_h3_dates` | — | matview | 無 | ❌ 無 | <1KB | ② 現況 OK | 🟢 | — |
| 14 | `get_disaster_alert_dates` | disasterAlertLoader.ts:63 | `public.mv_disaster_alert_dates` | — | matview | 無 | ❌ 無 | <1KB | ② 現況 OK | 🟢 | — |
| 15 | `get_temperature_dates` | temperatureLoader.ts:51 | `realtime.temperature_grids` | — | `COUNT(DISTINCT) + GROUP BY to_char(...)` **全表掃描** | 無 | ✅ 30s | 小 | ② 現況 OK，但 | 🟡 | **不是 matview**！隨 temperature_grids 成長會越來越慢，建議改 `mv_temperature_dates` 比照 ship/flight |
| 16 | `get_h3_demographics_yearly` | h3Loader.ts:207 | `spatial.h3_demographics_yearly` | `target_year, target_resolution` | 無 | 無 | ❌ 無 | 中（~6.5 萬 rows/year 之內） | ④ 小查表 | 🟢 | 確認 `(year, resolution)` index 存在 |
| 17 | `get_h3_demographics_years` | h3Loader.ts:228 | `spatial.h3_demographics_yearly` | — | `COUNT(*) GROUP BY year,resolution` | 無 | ❌ 無 | <1KB | ④ 小查表 | 🟢 | 資料小，OK |
| 18 | `get_bus_current_taipei` | busLoader.ts:42 | `realtime.bus_current` | — | 無（直讀 upsert 表） | 無 | ❌ 無 | ~100KB（~5700 rows） | ② 現況 OK | 🟢 | Live polling 每 30s，直讀小表 |
| 19 | `get_bus_trails` | busLoader.ts:97 | `realtime.bus_trails_daily` | `target_date` | 無（已 pre-agg） | 無 | ✅ 60s | ~8-15MB（~5200 buses） | ② 現況 OK | 🟢 | 5 分鐘降采樣 pre-aggregate，32s refresh |
| 20 | `get_bus_dates` | busLoader.ts:84 | `realtime.bus_trails_days_summary` | — | 無（summary 表） | 無 | ✅ 60s | <1KB | ② 現況 OK | 🟢 | — |

---

## 高風險項目詳解

### 🔴 1. `get_youbike_h3_snapshots`
**為什麼高風險**
- 底層 `realtime.youbike_snapshots` ~219 萬筆/6 天 ≈ **36 萬筆/日**
- 每次呼叫都要做：
  1. 全天範圍掃描
  2. JOIN `reference.station_h3_mapping`（每 station × resolution）
  3. 按「每 15 分鐘 × h3_index」GROUP BY 算 fullness/avg_total
  4. 再按 time_key GROUP BY 聚成 `jsonb_agg`
- Planner 一旦選錯 plan（類似 ship_trails 走 global sort 的狀況），很容易撞 30s timeout
- timeline 回放每次切日都重算一次

**建議處理**
- 建 `realtime.youbike_h3_daily(day date, resolution smallint, time_key text, cells jsonb, PRIMARY KEY(day, resolution, time_key))`
- 寫 `refresh_youbike_h3_daily(target_date, resolution)` 帶 advisory lock
- pg_cron 每 15 分鐘 refresh `today + yesterday`（對齊資料到達頻率）
- RPC 改成 `SELECT time_key, cells FROM realtime.youbike_h3_daily WHERE day = $1 AND resolution = $2`

**難度**：中（有 2 個 resolution，cron 要多跑一次；JOIN 邏輯不變）

### 🔴 2. `get_freeway_congestion_day`
**為什麼高風險**
- 對 `realtime.freeway_sections` 做每日全範圍掃描，`string_agg(... ORDER BY collected_at)` per section → 每個 section 都要內部 sort
- 國道 sections 量級（1~2k） × 每 5 分鐘 1 筆 ≈ 每日 30~60 萬筆，和 temperature 同級
- 現在已經設 60s，表示曾經逼近
- 每 10 分鐘 timeline 切換都會重跑

**建議處理**
- 完全照 ship/flight trails pattern：
  - `realtime.freeway_congestion_daily(day, section_id, timeline text, geom text, section_name, road_name, direction_label, PRIMARY KEY(day, section_id))`
  - `refresh_freeway_congestion_daily(target_date)`（advisory lock）
  - pg_cron 10 分鐘 refresh today + yesterday
- RPC 降為薄 SELECT，可把 statement_timeout 降回預設

**難度**：低（純抄 ship_trails pattern，schema 最單純）

---

## 中風險項目補充

### 🟡 `get_temperature_frames`
- `string_agg(... ORDER BY grid_lat, grid_lng)` 在每個 observed_at group 內排序，理論上 index `(observed_at, grid_lat, grid_lng)` 能 covering
- 先查 index，若已存在且 planner 有走，現況 OK
- 若未來 temperature_grids 超過 1 個月（CLAUDE.md 說目前 ~61 萬筆/月），逼近時再 pre-agg

### 🟡 `get_temperature_dates`
- **沒用 matview**，是直接對 `temperature_grids` 做 `GROUP BY to_char(observed_at)` + `COUNT(DISTINCT)`，全表掃
- 現況 ~61 萬筆還撐得住 30s，但成長曲線一旦拉開就會崩
- 低成本修法：比照 `mv_ship_dates` 建 `mv_temperature_dates`，pg_cron 刷新

### 🟡 `get_temperature_grid_info`
- 10s timeout 極短，`DISTINCT (grid_lat, grid_lng)` 雖小但吃掃描
- Grid 幾乎是靜態的（CWA 0.03° 固定格點），建議改成靜態參考表一次寫入、RPC 純 SELECT

### 🟡 `get_disaster_alerts_day`
- 目前靠 `ST_Union` + `ST_SimplifyPreserveTopology` 動態算幾何，alert 量小還行
- 若颱風/地震事件期間 alerts 暴增，township_geoms CTE 會變貴
- 短期：加 `(msg_type, effective, expires)` 複合 index；長期：daily materialise

---

## 可複製的修復 pattern（源自 ship/flight trails）

```sql
-- 1. Pre-aggregate 成普通 table（非 matview，避免 REFRESH 鎖全表）
CREATE TABLE realtime.<name>_daily (
  day date NOT NULL,
  <key cols>,
  <payload text/jsonb>,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (day, <key cols>)
);
CREATE INDEX ON realtime.<name>_daily (day);

-- 2. Per-day refresh function + advisory lock 防並發
CREATE OR REPLACE FUNCTION realtime.refresh_<name>_daily(target_date date)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_try_advisory_xact_lock(hashtext('<name>_daily'), target_date - DATE '2020-01-01');
  DELETE FROM realtime.<name>_daily WHERE day = target_date;
  INSERT INTO realtime.<name>_daily (...)
  SELECT ... FROM realtime.<source>
  WHERE collected_at >= ... AND collected_at < ...;
END $$;

-- 3. pg_cron 每 10 分鐘刷新 today + yesterday
SELECT cron.schedule('refresh-<name>-daily', '*/10 * * * *', $$
  SELECT realtime.refresh_<name>_daily((now() AT TIME ZONE 'Asia/Taipei')::date);
  SELECT realtime.refresh_<name>_daily(((now() AT TIME ZONE 'Asia/Taipei') - INTERVAL '1 day')::date);
$$);

-- 4. RPC 改薄 SELECT + 保留 statement_timeout 當護欄
CREATE OR REPLACE FUNCTION public.get_<name>(target_date date)
RETURNS TABLE(...) LANGUAGE sql STABLE
SET statement_timeout TO '60s'
AS $$
  SELECT ... FROM realtime.<name>_daily WHERE day = target_date
$$;
```

要點：
- 用普通 table 而非 matview → refresh 只動單日、不鎖全表
- statement_timeout 設在 function level（anon role 預設 3s 會直接 reject 大 payload）
- pg_cron 同時 refresh today+yesterday 避開跨日 race
- 若遇到 planner stats stale 走錯 plan，記得 `ANALYZE` 目標表或加 composite index 引導

---

## 建議優先處理順序

1. **`get_freeway_congestion_day`** — 結構最像 ship/flight trails，抄 pattern 最快，1 個 function + 1 個 table + 1 個 cron。
2. **`get_youbike_h3_snapshots`** — 資料量最大、邏輯最複雜，影響 YouBike timeline 體驗，值得投資。注意 `resolution` 是第二個維度。
3. **`get_temperature_dates`** — 低成本收益，加個 matview `mv_temperature_dates` 即可，防範 temperature_grids 成長後崩潰。
4. **`get_temperature_frames`** — 先驗 index 與實際 plan，若沒事就放著；若觀察到偶爾超時再 pre-agg。
5. **`get_temperature_grid_info`** — 順手改成靜態 grid 參考表，一勞永逸。
6. **`get_disaster_alerts_day`** — 目前量小，先加觀測，颱風季前再處理。

其餘 10 個 RPC 屬於 matview dates 查詢或單點小查表，維持現狀即可。
