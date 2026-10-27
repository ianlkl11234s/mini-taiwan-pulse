# Supabase RPC Pre-aggregate Pattern

> 處理大型時序 / 高運算 RPC 的標準 pattern。任何 RPC 響應 > 1s 或回傳 > 10k rows 都必須套用。
>
> 2026-10-16 校正：`realtime` schema 已併入 `live`（ADR-0010／migration 312），範本內表名改用 `live.*`；pg_cron 現行頻率是 today 每 30 分並錯開分鐘、yesterday 每日一次（2026-04-09 IO 事故後降頻，migration 302 起拆成兩個 job）；cron 內日期一律用台北時區。

## 為什麼要做

Supabase Supavisor pooler **強制覆寫** `statement_timeout = 2min`，且 anon role default timeout 3s。原始做法（直接 GROUP BY + aggregate 大表）會：
- 打到 pooler 2min timeout
- 對 anon role 撞 3s timeout
- 受 planner stats stale 影響嚴重（錯 plan 會慢 10x+）

## Pattern 架構

```
原始大表 (live.xxx_positions, 百萬列)
    ↓ (per-day refresh function，pg_cron：today 每 30 分錯開分鐘、yesterday 每日一次)
預聚合 table (live.xxx_daily, PK=(day, key))
    ↓ (薄 SELECT RPC，毫秒級)
前端 RPC call
```

**4 個組件**：
1. **普通 table**（不是 MATERIALIZED VIEW，一次 build 會 sort 爆炸）
2. **per-day refresh function**（DELETE + INSERT 一天，含 `pg_advisory_xact_lock`）
3. **cleanup function**（`0 18 * * *` UTC 清超過 7 天）
4. **pg_cron 排程**（today 與 yesterday **拆成兩個 job**：today 定期 refresh，yesterday 每日一次；分鐘要和其他 job 錯開，見 `data-collectors/docs/sql/cron_throttle.sql` 與 §7）

## 權限慣例（2026-10 定案，新函式／新表必寫）

**為什麼要寫**：2026-10 起 gis-platform 已收回 `public` schema 的 default privileges，新建的函式、表、view **不會再自動開放給 `anon`**。漏寫 GRANT，前端呼叫會回 `permission denied`；反過來，cron／內部函式若沒有 REVOKE，`PUBLIC` 預設的 EXECUTE 會讓任何人都能用公開的 anon key 呼叫。

| 物件 | 寫法 |
|---|---|
| 給前端呼叫的 RPC | `REVOKE EXECUTE ON FUNCTION public.f(<參數型別>) FROM PUBLIC;`<br>`GRANT EXECUTE ON FUNCTION public.f(<參數型別>) TO anon, authenticated;` |
| cron／refresh／cleanup 等內部函式 | `REVOKE EXECUTE ON FUNCTION public.f(<參數型別>) FROM PUBLIC, anon, authenticated;`（不 GRANT 給任何前端角色） |
| 前端直接讀的表／view | `GRANT SELECT ON <schema>.t TO anon, authenticated;`（只給 SELECT，不給 INSERT／UPDATE／DELETE） |
| `SECURITY DEFINER` 函式 | 一律加 `SET search_path = ''`（或明列需要的 schema，例如 `SET search_path = public, pg_temp`），函式內表名寫完整 `schema.table` |
| 有時間範圍或天數參數的函式 | 在函式內 clamp 上下限，例：`LEAST(GREATEST(p_days, 1), 30)`、`end_ts - start_ts` 超過上限就截斷；不能只靠前端傳合理值 |

函式簽名要寫完整參數型別（例：`public.get_xxx_day(date)`），GRANT／REVOKE 才會套到對的 overload。

## SQL 範本

全部存在 `../data-collectors/docs/sql/matview_*.sql`，直接複製套用（舊範本可能還沒有下方的 REVOKE／GRANT，照本節補上）。

```sql
-- 1) Table
CREATE TABLE live.xxx_daily (
    day date NOT NULL,
    key text NOT NULL,  -- mmsi / flight_id / etc.
    ...aggregated cols...,
    refreshed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (day, key)
);
CREATE INDEX xxx_daily_day_idx ON live.xxx_daily (day);

-- 2) Refresh function（務必含 advisory lock）
CREATE OR REPLACE FUNCTION public.refresh_xxx_daily(target_day date)
RETURNS integer LANGUAGE plpgsql
SET statement_timeout TO '0'
AS $$
DECLARE inserted_count integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('refresh_xxx_daily:' || target_day::text));
    DELETE FROM live.xxx_daily WHERE day = target_day;
    INSERT INTO live.xxx_daily (...)
    SELECT ... FROM live.xxx_source
    WHERE collected_at >= (target_day::text || ' 00:00:00+08')::timestamptz
      AND collected_at <  ((target_day + 1)::text || ' 00:00:00+08')::timestamptz
    GROUP BY ...;
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END; $$;

-- 內部函式：只給 cron／postgres 跑，收回所有前端角色的執行權
REVOKE EXECUTE ON FUNCTION public.refresh_xxx_daily(date) FROM PUBLIC, anon, authenticated;

-- 3) Cleanup（keep_days 在函式內 clamp：負數或 0 不能把整張表刪光）
CREATE OR REPLACE FUNCTION public.cleanup_xxx_daily(keep_days int DEFAULT 7)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
    DELETE FROM live.xxx_daily
    WHERE day < ((now() AT TIME ZONE 'Asia/Taipei')::date - GREATEST(keep_days, 1));
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.cleanup_xxx_daily(int) FROM PUBLIC, anon, authenticated;

-- 4) 薄 RPC（簽名不變，前端零改動）
CREATE OR REPLACE FUNCTION public.get_xxx_day(target_date date)
RETURNS TABLE(...)
LANGUAGE sql STABLE
SET statement_timeout TO '30s'  -- 預設 30s；payload > 10MB 才放到 60s（見關鍵坑 3）
AS $$
    SELECT ... FROM live.xxx_daily WHERE day = target_date ORDER BY ...
$$;

-- 給前端的 RPC：先收回 PUBLIC，再明確開給 anon／authenticated（見「權限慣例」）
REVOKE EXECUTE ON FUNCTION public.get_xxx_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_xxx_day(date) TO anon, authenticated;
-- 本 RPC 不是 SECURITY DEFINER，會以呼叫者身分讀 live.xxx_daily → 該表也要給讀取權（只給 SELECT）
GRANT SELECT ON live.xxx_daily TO anon, authenticated;

-- 5) pg_cron 排程
-- today：每 30 分，<m> 是 0–29 的偏移分鐘，必須和其他 refresh job 錯開（不要全落在 00/30，見 cron_throttle.sql）
SELECT cron.schedule('refresh-xxx', '<m>,<m+30> * * * *',
    $$SELECT public.refresh_xxx_daily((now() AT TIME ZONE 'Asia/Taipei')::date);$$);
-- yesterday：昨日資料不再變動，每日一次（17:xx UTC = 台北 01:xx），分鐘同樣錯開
SELECT cron.schedule('refresh-xxx-yesterday', '<m> 17 * * *',
    $$SELECT public.refresh_xxx_daily((now() AT TIME ZONE 'Asia/Taipei')::date - 1);$$);
-- ⚠️ cron 內禁用 current_date（DB session 是 UTC，台北 00:00–08:00 會漏 refresh 今天；2026-06-17 事故，migration 208）
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
ANALYZE live.xxx_source_YYYYMMDD;  -- 更新統計
```
常見是 planner 選錯 plan（global Sort 爆炸 vs Merge Append + index stream），換 plan 後可能從 2min timeout 降到 11s。

### 3. RPC function 必須明寫 `SET statement_timeout`
anon default 只有 3s，function 屬性覆寫對 RPC 有效。現行慣例（2026-10-16 盤 gis-platform migrations：`'30s'` 約 110 處、`'60s'` 約 55 處）：
- 一般薄 RPC：`'30s'`
- 大 payload（> 10MB，傳輸可能超過數秒）：`'60s'`
- refresh function／cron：`'0'`（不經 pooler，見坑 1）

### 4. Concurrent refresh race condition
cron 跑 refresh 同時手動 call 會撞 unique constraint。解法：function 開頭 `pg_advisory_xact_lock(hashtext('refresh_xxx:' || target_day::text))`。

### 5. PostgREST schema cache
function 簽名改變後必須 `NOTIFY pgrst, 'reload schema';`，否則前端會拿到 stale schema。

### 6. 檔名叫 `matview_*` 是歷史包袱
原本想用 MATERIALIZED VIEW，實測 sort 爆炸改成普通 table，檔名沒改。**實際是普通 table**。

### 7. refresh function 的 OOM 守則（2026-04-10 bus trails OOM 教訓）
- WHERE + ORDER BY **必須有對應索引**（缺索引＝全表 sort＝OOM）：`(id_column, collected_at)` 複合索引＋`(collected_at)` 單欄索引；常用條件（如 city）考慮 partial index
- today 與 yesterday（date-1）**拆成兩個 cron job**（2026-07-23 起，`gis-platform/migrations/302_refresh_cron_detangle.sql`）：today job 每 30 分並錯開分鐘偏移，yesterday 另設獨立每日一次 job（`refresh-*-yesterday`，17:xx UTC = 台北 01:xx）。昨日資料不再變動，不必每輪重算；舊做法「同一 job 循序跑」會自我重疊、卡 1-2 小時而引發 Disk IO 死亡螺旋（見 data-collectors `.claude/pitfalls/2026-07-23-disk-io-cron-spiral.md`）
- 聚合用 `MAX()` 而非 `mode()`（後者需額外 sort）
- 加 `SET work_mem TO '64MB'` 減少 disk spill
- cron 排程錯開分鐘（見 `data-collectors/docs/sql/cron_throttle.sql`）

### 8. pg_cron 的日期一律用台北時區（2026-06-17 教訓，7 dataset 全空）
- **禁用** `current_date`／`CURRENT_DATE` 在 `cron.schedule` 內；**必用** `(now() AT TIME ZONE 'Asia/Taipei')::date`
- 原因：DB session timezone＝UTC，台北 00:00–08:00 那 8 小時 UTC 還停在昨天 → cron 從不 refresh 台北今天。修法見 `gis-platform/migrations/208_fix_cron_taipei_tz.sql`
- Code review：`cron.schedule(...)` 內看到 `current_date` 一律改掉

> Disk IO 後續（2026-09／10 三輪優化、pg_stat_io 量測口徑）正本在 gis-platform `docs/research/`（例：`2026-10-12-disk-io-round2.md`），本 repo 只在 BACKLOG 留 DIO-* 指標。

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
- [ ] 加進 audit 報告：`docs/audit/supabase-rpc-audit-2026-04-09.md`
