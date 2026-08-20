-- ============================================================
-- Migration 367: get_prison_population_window() 改錨定 max(observed_date)
--                + 新增 public.get_prison_population_summary()
-- ============================================================
-- 【1】改錨定 = 必要（時間軸能不能長期活著的關鍵）
-- 【2】get_prison_population_summary = 選配（比照 336 的 get_food_price_summary，
--       只是把區間增減／峰谷搬到 DB 算，前端自己算也行；不想要就刪掉第 2 段）
-- ⚠️ 提案，**尚未 apply**。migration 需 user 拍板（CLAUDE.md 鐵則）。
--    編號 367 = gis-platform/migrations/ 現有最大 366 (vessel_zone_daily) + 1。
--
-- 背景（2026-08-20 調查）：
--   上游 prisonmuseum.moj.gov.tw/jqw_pub/today.xml 自 2026-05-16 起停止發布，
--   內容永遠停在 115/05/15。DB 因此只有 1 筆 row（observed_date=2026-05-15）。
--   歷史可從 jqw_pub/mjac.zip 回填 2,501 天（2019-04-18 ~ 2026-05-15）。
--
-- 問題：migration 264 的 window 錨在 `now()`：
--     WHERE observed_date >= (now() AT TIME ZONE 'Asia/Taipei')::date - p_days
--   上游不恢復的話，回填完 p_days=365 只看得到 215 天，且每天少一天，
--   約 2027-05-15 之後整張卡會變空 —— 明明 DB 有 7 年資料。
--
--   本專案既有慣例（336_food_price_rpc.sql get_food_price_daily）就是錨 max()：
--     WHERE trade_date >= (SELECT max(trade_date) FROM ...) - p_days
--   264 是唯一的例外。本 migration 把它拉齊。
--
-- 取捨（apply 前請確認）：
--   錨 max() = 「最後 N 天有資料的日子」，上游死掉時卡片仍看得到完整趨勢，
--   但**不會再因為資料變舊而變空** → 前端必須自己顯示 observed_date 標示資料截止日，
--   否則使用者會誤以為是今天的數字。PrisonCard 已經在標題印 observed_date，OK。
--
-- 驗證（apply 後跑）：
--   SELECT count(*), min(observed_date), max(observed_date)
--     FROM public.get_prison_population_window(365);
--   BEGIN; SET LOCAL ROLE anon;
--     SELECT count(*) FROM public.get_prison_population_window(365);
--     SELECT * FROM public.get_prison_population_summary(365);
--   ROLLBACK;
--
-- 套用：psql "$SUPABASE_DB_URL" -f 367_prison_population_window_anchor.sql
-- 回滾：⚠️ **不要**重新套 264_rpc_prison_population_window.sql —— 該檔內文寫的是
--       `FROM realtime.prison_population_daily`，而 schema 已被 312_move_realtime_to_live.sql
--       搬到 live.*，照套會指向不存在的表。用下面這段（= apply 前 pg_get_functiondef 的實況）：
--
--   CREATE OR REPLACE FUNCTION public.get_prison_population_window(p_days integer DEFAULT 30)
--    RETURNS TABLE(observed_date date, total_inmates integer, male_inmates integer,
--                  female_inmates integer, approved_capacity integer, over_capacity_pct numeric,
--                  new_in_count integer, new_out_count integer)
--    LANGUAGE sql STABLE
--    SET statement_timeout TO '10s'
--    SET search_path TO 'public', 'pg_temp'
--   AS $function$
--       SELECT observed_date, total_inmates, male_inmates, female_inmates,
--              approved_capacity, over_capacity_pct, new_in_count, new_out_count
--       FROM live.prison_population_daily
--       WHERE observed_date >= ((now() AT TIME ZONE 'Asia/Taipei')::date - make_interval(days => p_days))
--       ORDER BY observed_date DESC;
--   $function$;
--
--       + DROP FUNCTION IF EXISTS public.get_prison_population_summary(INTEGER);
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. 日序列：錨定 max(observed_date)，回傳升冪（前端畫趨勢圖直接用）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_prison_population_window(
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    observed_date     DATE,
    total_inmates     INTEGER,
    male_inmates      INTEGER,
    female_inmates    INTEGER,
    approved_capacity INTEGER,
    over_capacity_pct NUMERIC,
    new_in_count      INTEGER,
    new_out_count     INTEGER
)
LANGUAGE sql
STABLE
SET statement_timeout TO '10s'
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT
        p.observed_date,
        p.total_inmates,
        p.male_inmates,
        p.female_inmates,
        p.approved_capacity,
        p.over_capacity_pct,
        p.new_in_count,
        p.new_out_count
    FROM live.prison_population_daily p
    WHERE p.observed_date >= (
            SELECT max(x.observed_date) FROM live.prison_population_daily x
          ) - make_interval(days => GREATEST(p_days, 1))
    ORDER BY p.observed_date DESC;
$$;

COMMENT ON FUNCTION public.get_prison_population_window(INTEGER) IS
    '全國每日在監人數 N 天時序（live.prison_population_daily）。'
    '窗口錨定 max(observed_date) 而非 now()——上游 prisonmuseum 自 2026-05-16 停更，'
    '錨 now() 會讓卡片隨時間變空。前端必須顯示 observed_date 標示資料截止日。'
    '排序 DESC，rows[0] 即最新一筆（相容既有 PrisonCard 呼叫）。';

-- ------------------------------------------------------------
-- 2. 摘要：給卡片一行「相對區間變化」，省得前端自己算
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_prison_population_summary(
    p_days INTEGER DEFAULT 365
)
RETURNS TABLE (
    latest_date        DATE,
    latest_total       INTEGER,
    latest_over_pct    NUMERIC,
    earliest_date      DATE,
    earliest_total     INTEGER,
    delta_total        INTEGER,
    delta_pct          NUMERIC,
    peak_date          DATE,
    peak_total         INTEGER,
    trough_date        DATE,
    trough_total       INTEGER,
    day_count          INTEGER,
    data_age_days      INTEGER
)
LANGUAGE sql
STABLE
SET statement_timeout TO '10s'
SET search_path TO 'public', 'pg_temp'
AS $$
    WITH w AS (
        SELECT p.observed_date, p.total_inmates, p.over_capacity_pct
        FROM live.prison_population_daily p
        WHERE p.total_inmates IS NOT NULL
          AND p.observed_date >= (
                SELECT max(x.observed_date) FROM live.prison_population_daily x
              ) - make_interval(days => GREATEST(p_days, 1))
    ),
    lo AS (SELECT * FROM w ORDER BY observed_date ASC  LIMIT 1),
    hi AS (SELECT * FROM w ORDER BY observed_date DESC LIMIT 1),
    pk AS (SELECT * FROM w ORDER BY total_inmates DESC, observed_date DESC LIMIT 1),
    tr AS (SELECT * FROM w ORDER BY total_inmates ASC,  observed_date DESC LIMIT 1)
    SELECT
        hi.observed_date,
        hi.total_inmates,
        hi.over_capacity_pct,
        lo.observed_date,
        lo.total_inmates,
        hi.total_inmates - lo.total_inmates,
        ROUND(100.0 * (hi.total_inmates - lo.total_inmates)
              / NULLIF(lo.total_inmates, 0), 2),
        pk.observed_date, pk.total_inmates,
        tr.observed_date, tr.total_inmates,
        (SELECT count(*)::int FROM w),
        ((now() AT TIME ZONE 'Asia/Taipei')::date - hi.observed_date)::int
    FROM hi, lo, pk, tr;
$$;

COMMENT ON FUNCTION public.get_prison_population_summary(INTEGER) IS
    '全國在監人數區間摘要（最新／區間起點／增減／峰谷／天數／資料落後天數）。'
    'data_age_days = 今天 - latest_date，> 7 表示上游停更，前端應標示「資料截止」。';

GRANT EXECUTE ON FUNCTION public.get_prison_population_window(INTEGER)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_prison_population_summary(INTEGER) TO anon, authenticated;

COMMIT;
