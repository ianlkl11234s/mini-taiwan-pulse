-- ============================================================
-- PENDING migration（草稿，未套用）：補齊 7 張未登記 live 時序表的 retention
--   + 補強 check_retention_coverage() 的「未登記表」盲點
--
-- 來源：2026-09-01 Supabase 儲存稽核。發現 7 張 live 時序表從建表起無任何
--       retention（不在 metadata.retention_policies、也無 cleanup cron），
--       合計 ~4.1GB 且持續成長；check_retention_coverage() 因只看
--       「分區母表未登記」與「已登記 delete 表無 cron」而完全漏掉它們。
--
-- retention_days 決策：逐表以「前端/RPC 實際回看窗口」為下限 + margin
--   （見 README.md 對照表）。全部經實測確認下限 << 設定值，不會弄壞現有卡。
--
-- ⚠️ 套用前置檢查（DB 唯讀者無法代做，須有權限者確認）：
--   1. 取號並移至 gis-platform/migrations/NNN_live_retention_unregistered_tables.sql
--      （本工作區有平行 session 搶號，取號當天再定，勿預先佔號 — 見 BACKLOG PR-1 教訓）
--   2. 確認清理 procedure 現名為 live.cleanup_rows_batched（312 已將 282 的
--      realtime.cleanup_rows_batched 搬至 live；317 佐證 body 用 live.%I）。
--      若現況不同請對應調整 CALL 目標 schema。
--   3. 首次執行會刪大量 backlog（border_airport ~10M 列、river ~5.9M 列多數過期）；
--      cleanup_rows_batched 預設每晚上限 50000×200=1000 萬列，backlog 大者會
--      分數晚清完（282 設計如此，可接受）。急需一次清完可臨時調高 p_max_batches。
--   4. DELETE 只標記 dead tuples、不還磁碟給 OS；本檔尾已加 VACUUM ANALYZE cron
--      讓空間可重用。要「一次性縮小實體檔」需另跑 VACUUM FULL / pg_repack
--      （避開台灣餐期 10:00-20:00，見 README 桶 3）。
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- A. 6 張數值時序表：登記 retention + 排 cleanup cron
--    （純數值觀測，刪舊資料無不可逆損失風險）
-- ────────────────────────────────────────────────────────────
INSERT INTO metadata.retention_policies (table_name, kind, retention_days, name_format, time_column, note) VALUES
  ('border_airport_snapshot',   'delete', 7,  'YYYYMMDD', 'collected_at',
     '2026-09-01 稽核補；get_airport_hourly_pax 前端固定回看 24h，下限 1d → 設 7d margin'),
  ('river_water_level',         'delete', 14, 'YYYYMMDD', 'observed_at',
     '2026-09-01 稽核補；pulse+info 共用，rangeDays 下拉 clamp 1~7d，下限 7d → 設 14d margin'),
  ('road_events_current',       'delete', 3,  'YYYYMMDD', 'collected_at',
     '2026-09-01 稽核補；前端不直讀（用 road_events 歷史表），僅內部 compute_signal_levels 讀 24h/30min 窗；本表已有 app 端刪 expire<now，此為對「無 expire 殘留」的兜底'),
  ('taipei_sewer_measurements', 'delete', 7,  'YYYYMMDD', 'observed_at',
     '2026-09-01 稽核補；RPC 最長回看 24h，下限 1d → 設 7d margin'),
  ('taipei_pumb_status',        'delete', 7,  'YYYYMMDD', 'observed_at',
     '2026-09-01 稽核補；RPC 最長回看 24h，下限 1d → 設 7d margin'),
  ('er_hospital_status',        'delete', 30, 'YYYYMMDD', 'observed_at',
     '2026-09-01 稽核補；get_er_wait_total_14d 需 14d（LIMIT 336=14×24），下限 14d → 設 30d margin')
ON CONFLICT (table_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- B. aqi_imagery_frames：登記但「不排 cron」（資料損失風險，仿 282 的 uswg 暫緩）
--    此表是 base64 影像、目前無 R2 副本（AR-11f 未做）、上游大概率不留檔。
--    登記列使 coverage check 持續提醒；cleanup cron 待下列其一成立才另行 schedule：
--      (a) AR-11f 完成 R2 雙寫（比照 cwa 的 image_key IS NOT NULL 防呆），或
--      (b) owner 明確接受「丟失 >14d 的 AQI frame」。
--    兩案的一次性 SQL 見 README 附錄。
-- ────────────────────────────────────────────────────────────
INSERT INTO metadata.retention_policies (table_name, kind, retention_days, name_format, time_column, note) VALUES
  ('aqi_imagery_frames', 'delete', 14, 'YYYYMMDD', 'observed_at',
     '2026-09-01 稽核補；base64 影像無 R2 副本，cron 暫緩（見 README）：待 AR-11f R2 雙寫或 owner 接受影像損失後再 schedule。前端 useAqiImageryLayer 僅回看 24h，14d 為比照 cwa 之保守值')
ON CONFLICT (table_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- C. 排程 6 支 cleanup cron（台北 06:00~06:25 離峰；避開既有 19-21 UTC 批次）
--    UTC 22:00 = 台北 06:00。逐支 CALL live.cleanup_rows_batched(表, 時間欄, 天數)。
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE j TEXT;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'cleanup-border-airport-snapshot','cleanup-river-water-level','cleanup-road-events-current',
    'cleanup-taipei-sewer-measurements','cleanup-taipei-pumb-status','cleanup-er-hospital-status',
    'vacuum-audit-20260901-tables'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN PERFORM cron.unschedule(j); END IF;
  END LOOP;
END $$;

SELECT cron.schedule('cleanup-border-airport-snapshot', '0 22 * * *',
  $$CALL live.cleanup_rows_batched('border_airport_snapshot', 'collected_at', 7);$$);
SELECT cron.schedule('cleanup-river-water-level',       '5 22 * * *',
  $$CALL live.cleanup_rows_batched('river_water_level', 'observed_at', 14);$$);
SELECT cron.schedule('cleanup-road-events-current',     '10 22 * * *',
  $$CALL live.cleanup_rows_batched('road_events_current', 'collected_at', 3);$$);
SELECT cron.schedule('cleanup-taipei-sewer-measurements','15 22 * * *',
  $$CALL live.cleanup_rows_batched('taipei_sewer_measurements', 'observed_at', 7);$$);
SELECT cron.schedule('cleanup-taipei-pumb-status',      '20 22 * * *',
  $$CALL live.cleanup_rows_batched('taipei_pumb_status', 'observed_at', 7);$$);
SELECT cron.schedule('cleanup-er-hospital-status',      '25 22 * * *',
  $$CALL live.cleanup_rows_batched('er_hospital_status', 'observed_at', 30);$$);

-- DELETE 後讓空間可重用（不還 OS，但可被後續 INSERT 覆用）
SELECT cron.schedule('vacuum-audit-20260901-tables',    '40 22 * * *',
  $$VACUUM ANALYZE live.border_airport_snapshot, live.river_water_level,
                   live.road_events_current, live.taipei_sewer_measurements,
                   live.taipei_pumb_status, live.er_hospital_status;$$);

-- ────────────────────────────────────────────────────────────
-- D. 補強 check_retention_coverage()：加第 (iii) 分支，抓「未登記的大 live 表」
--    根治盲點——今後任何 live 非分區表 >100MB 又不在註冊表，daily_report 會現形，
--    不再默默長大（本次 7 張就是這樣漏掉的）。回傳型別不變，合約相容。
--    ⚠️ 套用後 daily_report 可能新增列出 iot_wra_measurements（有專屬 cron 於 062、
--       但不在註冊表）——屬正確的治理提醒，可另行補登記或接受提醒。
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION metadata.check_retention_coverage()
RETURNS TABLE (table_name TEXT, issue TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    -- (i) realtime/live 分區母表不在 retention 註冊表
    SELECT c.relname::text,
           'partitioned table not in metadata.retention_policies'::text
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('realtime','live')
      AND NOT EXISTS (SELECT 1 FROM metadata.retention_policies rp
                      WHERE rp.kind = 'partition' AND rp.table_name = c.relname)
    UNION ALL
    -- (ii) delete 路線表查無對應 active cleanup cron
    SELECT rp.table_name,
           'no active pg_cron cleanup job references this table'::text
    FROM metadata.retention_policies rp
    WHERE rp.kind = 'delete' AND rp.retention_days IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM cron.job j
                      WHERE j.active AND j.command LIKE '%cleanup_rows_batched%'
                        AND j.command LIKE '%' || rp.table_name || '%')
    UNION ALL
    -- (iii) 【新增】未登記的大 live 表（非分區/非分區子表）→ 隱形洩漏守門
    SELECT c.relname::text,
           'live base table > 100MB not in metadata.retention_policies (verify lifecycle)'::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'live'
      AND c.relkind = 'r'
      AND c.relispartition = false
      AND c.relname !~ '_[0-9]{8}$'
      AND c.relname !~ '_[0-9]{4}_[0-9]{2}_[0-9]{2}$'
      AND pg_total_relation_size(c.oid) > 100 * 1024 * 1024
      AND NOT EXISTS (SELECT 1 FROM metadata.retention_policies rp
                      WHERE rp.table_name = c.relname);
$$;

GRANT EXECUTE ON FUNCTION metadata.check_retention_coverage() TO service_role;

COMMIT;

-- ============================================================
-- 附錄：road_sections_live 縮短 retention（選配，見 README「road_sections 優化」）
--   前端只讀日聚合 road_congestion_daily，原始表 7 天可安全縮短：
--   UPDATE metadata.retention_policies SET retention_days = 2,
--          note = note || ' | 2026-09-01 縮 7→2（前端只用日聚合）'
--   WHERE table_name = 'road_sections_live';
--   （即生效，下次 cleanup-expired-partitions 依註冊表清理）
-- ============================================================
