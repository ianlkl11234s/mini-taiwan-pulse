---
name: supabase-optimize
description: 為 Supabase RPC 產生 pre-aggregate pattern SQL 範本。當響應時間 > 1s、rows > 10k、或含 string_agg/ST_Union 時使用。依照 Mini Taiwan Pulse 專案的「普通 table + per-day refresh function + pg_cron + 薄 RPC」架構產生完整 SQL，含 advisory lock、cleanup、cron 排程。
---

# Supabase Pre-aggregate Pattern Generator

依照 Mini Taiwan Pulse 專案規則產生 pre-aggregate SQL。完整 pattern 說明見 `docs/supabase-optimization.md`。

## 何時使用

符合 **任一** 條件：
- 響應時間 > 1 秒
- 回傳 > 10,000 rows
- 含 `string_agg` / `ST_Union` / 複雜 JOIN
- 看到 pooler 2min timeout（Supabase Supavisor 強制）

## 輸入

使用前請確認收集：
1. **RPC 名稱** (例：`get_ship_trails`)
2. **原始大表** (例：`realtime.ship_positions`)
3. **分組維度** (例：`(day, mmsi)`)
4. **聚合欄位** (例：`string_agg(...)`)
5. **時間欄位** (例：`collected_at`)
6. **是否需要 ±1h overlap**（跨日 timeline 銜接）
7. **Cron 頻率** (通常 `*/10 * * * *`，溫度資料 `*/30`)
8. **Cleanup 保留天數** (通常 7)

## 產生的 SQL 區塊

1. **Table 定義**（普通 table，不是 MV）
2. **Refresh function**（含 `pg_advisory_xact_lock` + `SET statement_timeout TO '0'`）
3. **Cleanup function**
4. **RPC rewrite**（薄 SELECT，`SET statement_timeout TO '60s'`，`GRANT EXECUTE` TO anon）
5. **pg_cron 排程**（refresh today + yesterday；cleanup 每日 18:00 UTC）
6. **Backfill 指令**
7. **PostgREST schema reload** (`NOTIFY pgrst, 'reload schema'`)
8. **驗證指令**

## 範本結構

詳見 `data-collectors/docs/sql/matview_*.sql`，有 10 個現成範本可參考：
- `matview_ship_trails.sql` — per-day trail aggregation with ±1h overlap
- `matview_flight_trails.sql` — 同上，含 altitude filter
- `matview_freeway_congestion.sql` — 含 JOIN 靜態 sections
- `matview_youbike_h3.sql` — 含 resolution 維度
- `matview_temperature_frames.sql` — per-observed_at aggregation
- `matview_temperature_dates.sql` — 全量 cache（非 per-day）
- `matview_disaster_alerts.sql` — 預存 ST_Union 幾何
- `reference_temperature_grid.sql` — 靜態 reference 表
- `cwa_imagery_rpcs.sql` — 批次 RPC pattern

## 執行流程

1. 讀取最接近的範本檔案
2. 依用戶需求改 table schema、GROUP BY、聚合函式
3. 產出到 `data-collectors/docs/sql/matview_<new>.sql`
4. 告知用戶執行指令：
   ```bash
   psql "$SUPABASE_DB_URL" -f data-collectors/docs/sql/matview_<new>.sql
   psql "$SUPABASE_DB_URL" -c "SELECT public.refresh_<new>_daily(d::date) FROM generate_series(current_date - 6, current_date, '1 day') d;"
   psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';"
   ```
5. 驗證：
   ```bash
   time psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM public.get_<new>_day(current_date);"
   psql "$SUPABASE_DB_URL" -c "SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-<new>') ORDER BY start_time DESC LIMIT 3;"
   ```
6. 更新 `docs/supabase_rpc_audit.md`

## 關鍵檢查點（產生 SQL 時必含）

- [ ] Refresh function 有 `pg_advisory_xact_lock(hashtext('refresh_xxx:' || target_day::text))`
- [ ] Refresh function 屬性 `SET statement_timeout TO '0'`
- [ ] RPC function 屬性 `SET statement_timeout TO '60s'`（payload 傳輸）
- [ ] RPC 有 `GRANT EXECUTE ... TO anon, authenticated`
- [ ] PK 包含 `day` + 分組 key
- [ ] 有 `CREATE INDEX xxx_day_idx ON xxx (day)`
- [ ] Time window 用 `+08` timezone literal（非 naive timestamp）
- [ ] cron 排程 refresh **today AND yesterday**（跨日延遲資料）
- [ ] cleanup 排程 `0 18 * * *` UTC（= 02:00 Taipei）
- [ ] 檔案 header 有動機說明（Before → After 效能數字）

## 禁止

- ❌ 用 `MATERIALIZED VIEW`（一次 REFRESH 會撞 pooler 2min timeout）
- ❌ 跳過 advisory lock（cron + 手動 call 會 race）
- ❌ 假設 `SET statement_timeout = 0` 對前端 pooler 連線有效（只有 pg_cron 例外）
