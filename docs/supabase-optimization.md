# Supabase RPC Pre-aggregate Pattern

> 處理大型時序 / 高運算 RPC 的標準 pattern。任何 RPC 響應 > 1s 或回傳 > 10k rows 都必須套用。**先讀 §0 DB 效能鐵則（R1–R4）**：前端只讀預算結果、預算表要登記讀者、排程只算增量、監控不掃表。
>
> 2026-10-16 校正：`realtime` schema 已併入 `live`（ADR-0010／migration 312），範本內表名改用 `live.*`；pg_cron 現行頻率是 today 每 30 分並錯開分鐘、yesterday 每日一次（2026-04-09 IO 事故後降頻，migration 302 起拆成兩個 job）；cron 內日期一律用台北時區。

## 0. DB 效能鐵則（2026-11-09 減量大掃除後設立，正本）

> 背景：2026-11-09 唯讀盤點（pg_stat_statements 約 3.5 天）發現 DB 每天約 140 GB 磁碟讀、400 GB temp 寫。最貴的幾項都不是「資料多」，而是**沒人讀的表一直在算、讀的人卻自己現場重算、排程每 30 分鐘把整天重做一次、監控自己在掃表**。修正：gis-platform #220（mig 518–520）、#221（mig 526–531）；data-collectors #188／#189。
> 舊規則「RPC >1s 或 >10k rows 必套 pre-aggregate」只寫在文件、沒有檢查會擋，所以本節每條都附「誰來擋」。

| | 鐵則 | 誰來擋 |
|---|---|---|
| **R1** | 前端只讀預先算好的結果：上線前量冷快取耗時，目標 <300 ms，硬上限 1 s | 上線前 `/check-rpc`（layer-onboarding Step 1）；上線後 data-collectors 每週體檢列「前端 RPC 平均 >1 秒」 |
| **R2** | 每張預算表都要有登記的讀者（哪支 RPC、哪個圖層）；沒有讀者就不准建，讀者撤掉就停排程 | gis-platform CI `lint_migration_efficiency.py` L2；每週體檢列「預算表沒人讀」 |
| **R3** | 排程只算增量：比每小時密的 refresh 一律 `refresh_<x>_incremental`，整天全量只允許夜間一次（`refresh-<x>-yesterday`）當安全網；頻率不可快於資料實際更新 | gis-platform CI L1；每週體檢列「單一 SQL 每天磁碟讀 >1 GB」 |
| **R4** | 監控不可掃資料表：用收集器自己記的時間或輕量狀態表 | data-collectors handbook `operations.md` §8；code review |
| R5 | 收集器批次寫入用固定形狀 SQL（每張表一種 queryid）；2026-11-12 由建議升為必須 | data-collectors handbook `operations.md` §8 |

### R1 前端只讀預先算好的結果

- **規則**：前端（anon／authenticated）呼叫的 RPC 只做「讀預算表＋小範圍補尾巴」，不在請求時對原始時序表做整天聚合、`ST_Union`、多層相關子查詢。上線前量**冷快取**耗時：目標 <300 ms，超過 1 s 不准上線（anon 的 statement_timeout 是 3 s，平均 2 秒多就會在尖峰被取消、面板空白）。
- **冷快取怎麼量**：Supabase 不能清 cache，所以「冷」定義為 `EXPLAIN (ANALYZE, BUFFERS)` 輸出裡有 `shared read`（從磁碟讀）的那次。做法：用 `/check-rpc` 對**最大參數**（最長時間窗、整天、最多站）跑一次，換一個最近沒人查過的日期或範圍再跑一次，取較慢的 Execution Time，並記下 `shared read` blocks（×8 KB＝磁碟讀量）。只量到全部 `shared hit` 的數字不算數。
- **實例**：
  - `get_youbike_h3_snapshots` 每次從原始 `youbike_snapshots` 重算整天，平均 **12.0 s**；旁邊明明有 `youbike_h3_daily` 卻沒接上。mig 519 改讀 daily 表＋只補最後一格 → 0.12–0.27 s。
  - `get_airport_hourly_pax` 每次現場加總約 139 萬列（平均 1.46 s、冷讀約 120 MB、每天約 13 GB 讀）。mig 518 改讀每批彙總小表 → <1 ms。
  - `get_alert_series_24h` 的 CTE 被 inline 進 144 格相關子查詢，每次對 `disaster_alerts` 全表掃 144 次（2.35 s）。mig 526 加 `MATERIALIZED` → 16.6 ms。
  - `get_typhoon_proximity_daily` 逐筆算 geography 距離（平均 2.7 s）。mig 527 做逐日結果表 → 約 0.15 s。
- **檢查**：`/check-rpc <name>`（冷快取兩次）；PR 描述附 Execution Time 與 shared read。上線後每週一 data-collectors 體檢會把「前端 RPC 平均 >1 秒」列進日報 🟡。

### R2 每張預算表都要有登記的讀者

- **規則**：建 `*_daily`／`_hourly`／`_agg`／`_preagg`／`_batch`／`_latest`／`_summary` 這類預算表時，同一支 migration 在 `CREATE TABLE` 正上方寫 `-- reader: <RPC 名>（<圖層 key>）`，而且那支 RPC 要真的讀這張表。沒有讀者就不建；前端撤掉讀者時，同一支 migration 把 refresh 排程停掉。
- **實例**：`youbike_h3_daily` 每 30 分鐘從原始表重算整天（每天約 5.1 GB 讀），DB 內除了 refresh／cleanup 之外**沒有任何讀者**，前端 RPC 反而自己重算（見 R1）。最貴的 cron 在做沒人讀的表，而讀的 RPC 又違反 R1，兩個問題互相掩蓋。
- **檢查**：gis-platform CI L2 會擋新增或修改的 migration 裡沒有 `reader:` 的預算表（豁免 `-- lint: not-preagg <理由>`，給收集器直寫的原始日表）。上線後每週體檢從 `cron.job` 找 refresh 寫入的表，列出「沒有前端函式讀它」或「讀者一週 0 次呼叫」的表。

### R3 排程只算增量

- **規則**：
  - 比每小時密的 refresh 一律呼叫 `refresh_<x>_incremental(...)`，只處理新進的時間桶（水位＝表裡最後一格或上次寫入時間，往前留 2 格重疊自癒）。
  - 整天全量只允許夜間一次：`refresh-<x>-yesterday`（台北 01:00–02:00，`refresh_<x>(today - 1)`），當晚到資料的安全網。
  - 頻率不可快於資料實際更新；來源沒有新批時函式要先比水位直接 RETURN。
- **實例**：
  - YouBike、停車每 30 分鐘 DELETE 當天、從原始表重算整天，越晚越貴（各約 4–5 GB 讀／天）。mig 519、520 改增量 → 每次 <1 千 buffers。
  - 示警當日表每 30 分鐘把 36 則警報的 `ST_Union` 全部重做（6.7 s）。mig 528 依 `src_hash` 只處理新／變更的警報 → 無變動時約 25 ms。
  - IoT、軌跡讀者極少（3.5 天 0–18 次）卻每 30 分鐘重算，mig 529、530 降成每小時。
  - ISR 衛星名冊只在新發射時才變卻每小時同步，mig 531 改每日。
- **檢查**：gis-platform CI L1 擋「分鐘欄超過一個值、command 的 `refresh_*` 不是 `_incremental`」的 `cron.schedule`／`cron.alter_job`（豁免 `-- lint: full-refresh-ok <理由>`，例：函式本身只算最近 3 小時）。命名慣例與 lint 細節見 gis-platform `.claude/CLAUDE.md` §DB 效能鐵則。

### R4 監控不可掃資料表

- **規則**：判斷「有沒有新資料」用收集器自己記的寫入時間或輕量狀態表；不可每輪對資料表做 `max(time)`／`count(*)`，也不可每輪呼叫會掃表的 RPC。需要讀 DB 的監控只查統計檢視（`pg_stat_*`）與系統目錄，唯讀、設 `statement_timeout`、有 `LIMIT`，PR 寫實測成本。
- **實例**：停更檢查每 15 分鐘呼叫 `health_snapshot`（對一百多張表各取 `max()`），重演了 2026-09-04 的 Disk IO 事故（每天約 1.7 GB 讀）。data-collectors #188／#189 改成零 DB 讀取。
- **檢查**：data-collectors handbook `docs/handbook/operations.md` §8；code review。每週體檢本身也照 R4：數字用 `pg_stat_statements(false)`（約 7 ms、零 temp），查詢文字只在需要時取一次。

### R5 收集器寫入用固定形狀 SQL

- `execute_values(..., page_size=1000)` 每批列數不同 → 每種列數一個 `queryid`。2026-11-09 pg_stat_statements 有 4,977 筆（上限 5,000），其中 4,371 筆、232 MB 是收集器的多列 INSERT；Supabase 的 exporter 每分鐘讀全文排序，每次約 230 MB temp，換算**每天約 400 GB temp 寫**，也把低頻語句的統計擠掉。
- 做法：`INSERT ... SELECT * FROM unnest(%s::text[], ...)` 或 `json_populate_recordset`，每張表一種 SQL。
- **2026-11-12 升為必須**：pulse-host（data-collectors #192／#193）與 VM（#194）改完、11-09 重置後 78 小時實測，pg_stat_statements 查詢文字由 233 MB 降到 5 MB、2,929 筆、沒有再擠掉語句。還沒改的兩支低頻寫入見 BACKLOG SBE-6。

## 為什麼要做

Supabase Supavisor pooler **強制覆寫** `statement_timeout = 2min`，且 anon role default timeout 3s。原始做法（直接 GROUP BY + aggregate 大表）會：
- 打到 pooler 2min timeout
- 對 anon role 撞 3s timeout
- 受 planner stats stale 影響嚴重（錯 plan 會慢 10x+）

## Pattern 架構

```
原始大表 (live.xxx_positions, 百萬列)
    ↓ (refresh：today 走 *_incremental 只算新進時間桶、yesterday 夜間全量一次；§0 R3)
預聚合 table (live.xxx_daily, PK=(day, key))
    ↓ (薄 SELECT RPC，毫秒級)
前端 RPC call
```

**4 個組件**：
1. **普通 table**（不是 MATERIALIZED VIEW，一次 build 會 sort 爆炸）
2. **refresh function 兩支**：全量 `refresh_<x>(day)`（DELETE + INSERT 一天，含 `pg_advisory_xact_lock`，給夜間 yesterday 與手動回補）＋增量 `refresh_<x>_incremental(day)`（只算新進時間桶，給白天高頻 job；範本 gis-platform mig 519／520）
3. **cleanup function**（`0 18 * * *` UTC 清超過 7 天）
4. **pg_cron 排程**（today 與 yesterday **拆成兩個 job**：today 呼叫 `_incremental`、頻率不快於資料更新，yesterday 夜間全量一次；分鐘要和其他 job 錯開，見 `data-collectors/docs/sql/cron_throttle.sql` 與 §7）
5. **讀者登記**：`CREATE TABLE` 正上方 `-- reader: <RPC>（<圖層>）`，RPC 真的讀這張表（§0 R2）

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
| `get_airport_hourly_pax` | 1.46s → <1ms | gis-platform mig 518（2026-11-09）|
| `get_youbike_h3_snapshots` | 12.0s → 0.12–0.27s（改讀 daily 表）| gis-platform mig 519（2026-11-09）|
| `get_alert_series_24h` | 2.35s → 16.6ms | gis-platform mig 526（2026-11-09）|
| `get_typhoon_proximity_daily` | 0.6–2.7s → ~0.15s | gis-platform mig 527（2026-11-09）|

## 套用流程 Checklist

- [ ] 用 `EXPLAIN (ANALYZE, BUFFERS)` 確認現況是 plan 問題還是真的資料量爆炸
- [ ] 預算表 `CREATE TABLE` 上方有 `-- reader:`，而且前端那支 RPC 真的改讀這張表（§0 R2）
- [ ] 白天的 cron 呼叫 `_incremental`，全量只在夜間 yesterday（§0 R3）；`python3 scripts/lint_migration_efficiency.py migrations/<新檔>.sql`（gis-platform）通過
- [ ] 複製最接近的 `matview_xxx.sql` 範本
- [ ] 改 table schema / GROUP BY 維度
- [ ] `psql "$SUPABASE_DB_URL" -f docs/sql/matview_xxx.sql`
- [ ] Backfill 7 天：`SELECT public.refresh_xxx(d::date) FROM generate_series(current_date - 6, current_date, '1 day') d;`
- [ ] `NOTIFY pgrst, 'reload schema';`
- [ ] `/check-rpc` 量冷快取（有 `shared read` 的那次）：<300 ms，硬上限 1 s（§0 R1）；前端測 loading 時間
- [ ] 確認 cron 有跑：`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
- [ ] 加進 audit 報告：`docs/audit/supabase-rpc-audit-2026-04-09.md`
