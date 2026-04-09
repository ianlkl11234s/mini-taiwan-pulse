# Supabase RPC Pre-aggregate Pattern

> 處理大型時序 / 高運算 RPC 的標準 pattern。任何 RPC 響應 > 1s 或回傳 > 10k rows 都必須套用。

## 為什麼要做

Supabase Supavisor pooler **強制覆寫** `statement_timeout = 2min`，且 anon role default timeout 3s。原始做法（直接 GROUP BY + aggregate 大表）會：
- 打到 pooler 2min timeout
- 對 anon role 撞 3s timeout
- 受 planner stats stale 影響嚴重（錯 plan 會慢 10x+）

## Pattern 架構

```
原始大表 (realtime.xxx_positions, 百萬列)
    ↓ (per-day refresh function，pg_cron 每 10 分鐘)
預聚合 table (realtime.xxx_daily, PK=(day, key))
    ↓ (薄 SELECT RPC，毫秒級)
前端 RPC call
```

**4 個組件**：
1. **普通 table**（不是 MATERIALIZED VIEW，一次 build 會 sort 爆炸）
2. **per-day refresh function**（DELETE + INSERT 一天，含 `pg_advisory_xact_lock`）
3. **cleanup function**（`0 18 * * *` UTC 清超過 7 天）
4. **pg_cron 排程**（`*/10 * * * *` refresh today + yesterday）

## SQL 範本

全部存在 `../data-collectors/docs/sql/matview_*.sql`，直接複製套用。

```sql
-- 1) Table
CREATE TABLE realtime.xxx_daily (
    day date NOT NULL,
    key text NOT NULL,  -- mmsi / flight_id / etc.
    ...aggregated cols...,
    refreshed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (day, key)
);
CREATE INDEX xxx_daily_day_idx ON realtime.xxx_daily (day);

-- 2) Refresh function（務必含 advisory lock）
CREATE OR REPLACE FUNCTION public.refresh_xxx_daily(target_day date)
RETURNS integer LANGUAGE plpgsql
SET statement_timeout TO '0'
AS $$
DECLARE inserted_count integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('refresh_xxx_daily:' || target_day::text));
    DELETE FROM realtime.xxx_daily WHERE day = target_day;
    INSERT INTO realtime.xxx_daily (...)
    SELECT ... FROM realtime.xxx_source
    WHERE collected_at >= (target_day::text || ' 00:00:00+08')::timestamptz
      AND collected_at <  ((target_day + 1)::text || ' 00:00:00+08')::timestamptz
    GROUP BY ...;
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END; $$;

-- 3) Cleanup
CREATE OR REPLACE FUNCTION public.cleanup_xxx_daily(keep_days int DEFAULT 7)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
    DELETE FROM realtime.xxx_daily WHERE day < (current_date - keep_days);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END; $$;

-- 4) 薄 RPC（簽名不變，前端零改動）
CREATE OR REPLACE FUNCTION public.get_xxx_day(target_date date)
RETURNS TABLE(...)
LANGUAGE sql STABLE
SET statement_timeout TO '60s'  -- payload 傳輸可能 > 3s
AS $$
    SELECT ... FROM realtime.xxx_daily WHERE day = target_date ORDER BY ...
$$;

GRANT EXECUTE ON FUNCTION public.get_xxx_day(date) TO anon, authenticated;

-- 5) pg_cron 排程
SELECT cron.schedule('refresh-xxx', '*/10 * * * *',
    $$SELECT public.refresh_xxx_daily(current_date); SELECT public.refresh_xxx_daily(current_date - 1);$$);
SELECT cron.schedule('cleanup-xxx', '0 18 * * *',
    $$SELECT public.cleanup_xxx_daily(7);$$);
```

## 關鍵坑（必讀）

### 1. Pooler 2 分鐘 timeout 不能繞
- `SET statement_timeout = 0` 在 psql session 無效（pooler 覆寫）
- `ALTER ROLE postgres SET statement_timeout = 0` 對 pooler 連線無效
- **唯一例外**：`pg_cron` 是 DB 內 background worker，**不經 pooler**，吃 role default

### 2. 慢 query 先看 plan，不要急著加 timeout
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT ...;
ANALYZE realtime.xxx_source_YYYYMMDD;  -- 更新統計
```
常見是 planner 選錯 plan（global Sort 爆炸 vs Merge Append + index stream），換 plan 後可能從 2min timeout 降到 11s。

### 3. RPC function 必須加 `SET statement_timeout TO '60s'`
大 payload（> 10MB）傳輸時間可能超過 anon 3s default，function 屬性覆寫對 RPC 有效。

### 4. Concurrent refresh race condition
cron 跑 refresh 同時手動 call 會撞 unique constraint。解法：function 開頭 `pg_advisory_xact_lock(hashtext('refresh_xxx:' || target_day::text))`。

### 5. PostgREST schema cache
function 簽名改變後必須 `NOTIFY pgrst, 'reload schema';`，否則前端會拿到 stale schema。

### 6. 檔名叫 `matview_*` 是歷史包袱
原本想用 MATERIALIZED VIEW，實測 sort 爆炸改成普通 table，檔名沒改。**實際是普通 table**。

## 已套用的 RPC 一覽

| RPC | Before → After | SQL |
|---|---|---|
| `get_ship_trails` | timeout → 123ms | `matview_ship_trails.sql` |
| `get_flight_trails` | timeout → 126ms | `matview_flight_trails.sql` |
| `get_freeway_congestion_day` | 60s → 302ms | `matview_freeway_congestion.sql` |
| `get_youbike_h3_snapshots` | 6.4s → 82ms | `matview_youbike_h3.sql` |
| `get_temperature_frames` | 551ms → 107ms | `matview_temperature_frames.sql` |
| `get_temperature_dates` | 1.9s → 72ms | `matview_temperature_dates.sql` |
| `get_temperature_grid_info` | 1.08s → 269ms | `reference_temperature_grid.sql` |
| `get_disaster_alerts_day` | **13.2s → 110ms** | `matview_disaster_alerts.sql` |
| `get_cwa_imagery_frames_batch` | Failed → 57MB/1.7s | `cwa_imagery_rpcs.sql`（批次 RPC）|

## 套用流程 Checklist

- [ ] 用 `EXPLAIN (ANALYZE, BUFFERS)` 確認現況是 plan 問題還是真的資料量爆炸
- [ ] 複製最接近的 `matview_xxx.sql` 範本
- [ ] 改 table schema / GROUP BY 維度
- [ ] `psql "$SUPABASE_DB_URL" -f docs/sql/matview_xxx.sql`
- [ ] Backfill 7 天：`SELECT public.refresh_xxx(d::date) FROM generate_series(current_date - 6, current_date, '1 day') d;`
- [ ] `NOTIFY pgrst, 'reload schema';`
- [ ] 前端測 loading 時間（應該是百毫秒級）
- [ ] 確認 cron 有跑：`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
- [ ] 加進 audit 報告：`docs/supabase_rpc_audit.md`
