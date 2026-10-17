-- ⚠️ 檔名刻意不帶編號（2026-08-22 起）。
--
-- 這份 migration 已經讓號三次：367 被 public_health_weekly 去重佔用、
-- 368 被 religion PII revoke 佔用、369 被 tra_delay_daily 佔用。
-- 本工作區長期有平行 session，只要它一天沒 apply，任何預先取的號都會再被搶走。
--
-- **要 apply 的那一天才取號**：
--   ls gis-platform/migrations/ | grep -E '^[0-9]{3}_' | sort | tail -1
-- 拿到當前最大編號 +1，再把本檔複製過去改名。
-- （repo 已有 358→366 的痛苦重編前例，commit 1bffc0a。）
--
-- 狀態：**尚未 apply**，等用戶拍板。詳見同目錄 README「仍待拍板」段。

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
