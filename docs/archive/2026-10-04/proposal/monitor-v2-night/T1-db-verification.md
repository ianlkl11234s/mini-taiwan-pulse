# T1 — Supabase realtime 表資料新鮮度驗證

> 查驗時間基準：`now()` = **2026-07-07 23:25:49+00**（UTC；台北時間 2026-07-08 07:25）
> 方式：`psql "$SUPABASE_DB_URL"` 直連，全程 read-only（僅 `SELECT` / `information_schema` / `pg_get_functiondef`），無任何寫入或 DDL。

## 總結

**幾乎所有 realtime 表都活著**，跟原本預期「電力三表可能斷流」的假設不同 —— 電力三表（`power_system_status` / `power_generation_unit` / `power_region_demand`）目前皆新鮮（最新資料在 6–16 分鐘內），因此「PowerCard 資料源頭需回推」這個分支任務**不成立**，不用另尋餵資料的表。

唯一發現的斷流是 **`public.drought_alert_current`（乾旱燈號）**：最新 `updated_at` 停在 **2026-05-15**，距今已 53 天，明顯超出任何合理的監測週期，判定 🔴 疑似斷流，建議查 collector 排程或直接比對水利署來源站是否真的 53 天沒有燈號異動。

其餘主題（水資源四表、空品、急診、航班、地震、颱風、閃電、輻射）全部 ✅ 新鮮，皆可直接做 widget，不需要重啟 collector。有 3 個表落在「2× 間隔」的邊界附近（`power_generation_unit`/`power_region_demand`/`river_water_level`/`rain_gauge_readings` 約 16 分鐘 vs 10 分鐘間隔的 20 分鐘門檻、`air_quality_observations` 86 分鐘 vs 120 分鐘門檻、`er_hospital_status` 25 分鐘 vs 30 分鐘門檻）——仍在活著判定內，但建議之後排程檢查時多留意這幾個是否有變慢的趨勢。

## 表格

| 表 | 最新寫入時間 | 距今 | 判定 | 備註 |
|---|---|---|---|---|
| `realtime.power_system_status` (observed_at) | 2026-07-07 23:20:00+00 | ~6 分鐘 | ✅ 活 | 間隔 10min，門檻 20min |
| `realtime.power_generation_unit` (observed_at) | 2026-07-07 23:10:00+00 | ~16 分鐘 | ✅ 活 | 間隔 10min，門檻 20min（偏邊界） |
| `realtime.power_region_demand` (observed_at) | 2026-07-07 23:10:00+00 | ~16 分鐘 | ✅ 活 | 同上 |
| `realtime.reservoir_status` (snapshot_at) | 2026-07-07 23:00:00+00 | ~26 分鐘 | ✅ 活 | 間隔 60min，門檻 120min |
| `realtime.river_water_level` (observed_at) | 2026-07-07 23:10:00+00 | ~16 分鐘 | ✅ 活 | 間隔 10min，門檻 20min（偏邊界） |
| `realtime.rain_gauge_readings` (observed_at) | 2026-07-07 23:10:00+00 | ~16 分鐘 | ✅ 活 | 同上 |
| `realtime.groundwater_level_readings` (observed_at) | 2026-07-07 22:30:00+00 | ~56 分鐘 | ✅ 活 | 間隔 60min，門檻 120min |
| `public.drought_alert_current` (updated_at) | 2026-05-15 09:30:52+00 | **~53 天** | 🔴 疑似斷流 | 僅 2 筆（新竹/台中皆綠燈），`published_date`=2026-04-27；無明確收集週期規範，但 53 天無任何更新明顯異常，建議查 collector cron 或直接比對水利署來源頁是否真的長期無燈號異動 |
| `realtime.air_quality_observations` (observed_at) | 2026-07-07 22:00:00+00 | ~86 分鐘 | ✅ 活 | 間隔 60min，門檻 120min（偏邊界，快到門檻） |
| `realtime.er_hospital_status` (observed_at) | 2026-07-07 23:01:00+00 | ~25 分鐘 | ✅ 活 | 間隔 15min，門檻 30min（偏邊界） |
| `realtime.flight_positions` (collected_at) | 2026-07-07 23:25:08+00 | ~40 秒 | ✅ 活 | 間隔 5min，非常新鮮 |
| `realtime.earthquake_events` (occurred_at) | 2026-07-07 04:47:11+00 | ~18.6 小時 | ✅ 活 | 事件驅動，數天內有資料即算活 |
| `realtime.typhoon_positions` (collected_at) | 2026-07-07 22:42:36+00 | ~43 分鐘 | ✅ 活 | 目前有活躍颱風 TC2611（バービー/Bavi）；`MAX(valid_at)` 會跑到 2026-07-12，那是路徑**預報**時間點（未來），不是收集延遲，判斷新鮮度請用 `collected_at` 而非 `valid_at` |
| `realtime.lightning_events` (strike_time) | 2026-07-07 23:12:16+00 | ~13 分鐘 | ✅ 活 | 名目間隔 1min，但無雷雨期本來就會長時間無新事件，13 分鐘空窗屬正常現象，非斷流訊號 |
| `realtime.nuclear_radiation_measurements` (observed_at) | 2026-07-07 23:15:25+00 | ~10 分鐘 | ✅ 活 | 間隔 15min，門檻 30min |

（所有目標表皆存在，schema 位置：15 張在 `realtime.*`，`drought_alert_current` 在 `public.*`；另外 `public.earthquake_events`/`public.flight_positions`/`public.typhoon_positions` 也存在同名 view/表，本次驗證讀的是 `realtime.*` 底層表。）

## `get_power_dashboard` 源頭分析

```sql
CREATE OR REPLACE FUNCTION public.get_power_dashboard()
 RETURNS jsonb LANGUAGE sql STABLE AS $function$
  WITH latest_status AS (
    SELECT observed_at, curr_load_mw, curr_util_rate,
           fore_maxi_sply_capacity_mw AS supply_capacity_mw,
           fore_peak_dema_load_mw     AS peak_load_mw,
           fore_peak_resv_capacity_mw AS reserve_capacity_mw,
           fore_peak_resv_rate        AS reserve_rate_pct,
           fore_peak_resv_indicator   AS reserve_indicator,
           fore_peak_hour_range       AS peak_hour_range,
           real_hr_maxi_sply_capacity_mw AS realtime_supply_capacity_mw
    FROM realtime.power_system_status
    ORDER BY observed_at DESC LIMIT 1
  ),
  latest_region_ts AS (
    SELECT MAX(observed_at) AS ts FROM realtime.power_region_demand
  ),
  latest_regions AS (
    SELECT region, generation_mw, consumption_mw, observed_at
    FROM realtime.power_region_demand
    WHERE observed_at = (SELECT ts FROM latest_region_ts)
  )
  SELECT jsonb_build_object(
    'status',  (SELECT to_jsonb(s) FROM latest_status s),
    'regions', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.region), '[]'::jsonb) FROM latest_regions r)
  );
$function$
```

**只讀兩張表**：`realtime.power_system_status`（取最新一筆整體負載/備轉容量）+ `realtime.power_region_demand`（取最新時間戳的各區發用電）。**完全沒有用到 `realtime.power_generation_unit`**（機組層級燃料別發電資料）。

因為 `power_system_status`、`power_region_demand` 兩表本次驗證都是新鮮的（分別 ~6 分鐘、~16 分鐘前），所以 PowerCard 目前資料源頭正常，不需要額外回推替代餵資料表。`power_generation_unit` 本身也新鮮（~16 分鐘前），只是這支 RPC 沒用到它 —— 若前端有機組明細 widget，那會是走另一支 RPC 或前端另外查詢，值得之後確認一下是否真的有被消費，若沒有則屬於「備而不用」的表。
