-- ═══════════════════════════════════════════════════════════════════
-- 【提案・未 apply・待 owner 拍板】
-- 壓力指數的 disaster alert signal 套用「群組時效門檻」
--
-- 目標 repo：gis-platform（改 migration 207 建立的
--            realtime.compute_signal_levels() 之 DISASTER ALERT 段）
-- 對應前端：mini-taiwan-pulse src/data/alertRules.ts（同一組門檻）
-- 撰寫：W5 Phase 2，2026-08-13
-- ═══════════════════════════════════════════════════════════════════
--
-- ## 為什麼要改（實測證據，2026-08-13）
--
-- W5 Phase 2 原本的題目是「警報進壓力指數」。查證後發現**它早就在裡面**了
-- （migration 207 的 `v_alert`，disaster 權重 0.20），但算法是：
--
--     SELECT CASE WHEN COUNT(*) FILTER (WHERE severity='Extreme') > 0 THEN 100
--                 WHEN COUNT(*) FILTER (WHERE severity='Severe')  > 0 THEN 80
--                 ... END
--       FROM realtime.disaster_alerts
--      WHERE expires > NOW();
--
-- `expires > NOW()` 就是側邊列表灌量的同一個判準。打線上 RPC 實測：
--
--     get_pressure_index_now() → composite 28.0
--     per_signal = {"alert": 80.0, "er": 45.0, "flight": 50.0, "road": 39.0, ...}
--
-- alert=80 × 權重 0.20 = 16 分，佔 composite 28 的 **57%**。而支撐這個 80 的是
-- 「藤枝國家森林遊樂區 - 休園」（severity=Severe、expires 落在 2027 年）——
-- 也就是說**這個 signal 會全年釘在 80**，等於一個常數，完全喪失指標意義。
-- 今天恰好也有 2 則高溫 Severe，但它們過期後 alert 仍會是 80。
--
-- ## 改法
--
-- 只在既有 CASE 前面加一道 fresh 過濾，語意與前端 alertRules.ts 完全一致：
--   - 氣象／水文／交通：維持原樣（颱風同一 identifier 可連掛數日，加門檻會在
--     事件進行中把它藏起來）
--   - 民生（停水等）：72h
--   - 安全環境 + 未列舉的新類型：48h（與 migration 211 的 `ELSE 'safety'` 對齊）
-- 另補齊 211 已有、207 漏掉的兩個排除：urgency='Past'、系統測試／名單型 event_term。
--
-- ## 影響預估（用今天的資料試算）
--
--   改前：alert = 80（藤枝休園撐著）
--   改後：alert = 80（今日 2 則高溫 Severe，age 2.5h/16.8h → 仍 fresh，理應計入）
--   高溫今日 17:00 過期後 —— 改前仍是 80，改後降為 20（只剩 Minor 級的停水／
--   海洋污染中仍 fresh 者），composite 由 28 降至約 16。
--
-- ## 尚未決定（要 owner 拍板的部分）
--
-- (a) 只改 fresh 過濾（本檔做法，最小改動），還是順便把「最高 severity」
--     改成「severity + 件數」的混合分？後者更能反映「同時 20 則 Moderate」
--     這種廣度壓力，但會改變既有 baseline，vs_baseline / vs_1h_ago 要重算。
-- (b) 門檻值要不要跟前端共用一份設定（目前是兩邊各寫一份、靠註解互指）。
--
-- ## 套用步驟（拍板後）
--
--   1. 把下方 CREATE OR REPLACE 併進 gis-platform 的新 migration（編號接續）
--      —— 本檔只改 DISASTER ALERT 一段，其餘 signal 原文照抄，不要只跑片段
--   2. psql 套用後手動跑一次 SELECT realtime.compute_pressure_index('disaster');
--   3. 打 get_pressure_index_now() 確認 per_signal.alert 有變動
--   4. 觀察一天，確認 vs_baseline 沒有被斷層污染
-- ═══════════════════════════════════════════════════════════════════

-- ── 提案片段：realtime.compute_signal_levels() 的 DISASTER ALERT 段 ──
-- （原文見 gis-platform/migrations/207_realtime_signals_hourly.sql 的
--   `-- DISASTER ALERT: 取最高 severity` 區塊，整段替換成下面這段）

    -- DISASTER ALERT: 取最高 severity（只算「仍在時效內」的）
    -- Minor=20 / Moderate=50 / Severe=80 / Extreme=100
    --
    -- 時效門檻按群組分開設，與前端 src/data/alertRules.ts 同一組值：
    --   氣象／水文／交通 → 不設門檻（事件型，解除即 expire；颱風連掛數日仍應算）
    --   民生             → 72h（停水多為預告型工程公告）
    --   安全環境 + 未列舉 → 48h（海洋污染 expires 常在 2~9 個月後）
    SELECT CASE
             WHEN COUNT(*) FILTER (WHERE severity = 'Extreme')  > 0 THEN 100
             WHEN COUNT(*) FILTER (WHERE severity = 'Severe')   > 0 THEN 80
             WHEN COUNT(*) FILTER (WHERE severity = 'Moderate') > 0 THEN 50
             WHEN COUNT(*) FILTER (WHERE severity = 'Minor')    > 0 THEN 20
             ELSE 0
           END
      INTO v_alert
      FROM realtime.disaster_alerts
     WHERE (expires IS NULL OR expires > NOW())
       -- 與 migration 211 get_active_alerts 對齊的兩道排除
       AND COALESCE(urgency, '') <> 'Past'
       AND event_term NOT IN ('地震', '消防安全檢查重大不合格場所', 'ncdrSystemTest')
       -- 群組時效門檻
       AND CASE
             WHEN event_term IN (
                    -- weather
                    '雷雨', '降雨', '強風', '高溫', '低溫', '濃霧', '颱風', '海嘯',
                    -- flood
                    '淹水', '淹水感測', '水庫放流', '河川高水位', '區排警戒',
                    '土石流及大規模崩塌', '枯旱預警',
                    -- transit
                    '道路封閉', '鐵路事故', '捷運營運', '高速公路路況事件'
                  ) THEN TRUE
             WHEN event_term IN ('停水', '電力中斷', '行動電話中斷', '停班停課')
                  THEN COALESCE(sent, effective, onset) > NOW() - INTERVAL '72 hours'
             ELSE COALESCE(sent, effective, onset) > NOW() - INTERVAL '48 hours'
           END;
    v_alert := COALESCE(v_alert, 0);

-- ── 驗證用查詢（唯讀，可直接在 psql 跑，不改任何東西）──
-- 改前 / 改後的 alert 分數對照：
--
-- WITH base AS (
--   SELECT event_term, severity, sent, effective, onset, expires, urgency
--     FROM realtime.disaster_alerts
--    WHERE (expires IS NULL OR expires > NOW())
--      AND COALESCE(urgency,'') <> 'Past'
--      AND event_term NOT IN ('地震','消防安全檢查重大不合格場所','ncdrSystemTest')
-- )
-- SELECT
--   MAX(CASE severity WHEN 'Extreme' THEN 100 WHEN 'Severe' THEN 80
--                     WHEN 'Moderate' THEN 50 WHEN 'Minor' THEN 20 ELSE 0 END) AS alert_before,
--   MAX(CASE severity WHEN 'Extreme' THEN 100 WHEN 'Severe' THEN 80
--                     WHEN 'Moderate' THEN 50 WHEN 'Minor' THEN 20 ELSE 0 END)
--     FILTER (WHERE CASE
--       WHEN event_term IN ('雷雨','降雨','強風','高溫','低溫','濃霧','颱風','海嘯',
--                           '淹水','淹水感測','水庫放流','河川高水位','區排警戒',
--                           '土石流及大規模崩塌','枯旱預警',
--                           '道路封閉','鐵路事故','捷運營運','高速公路路況事件') THEN TRUE
--       WHEN event_term IN ('停水','電力中斷','行動電話中斷','停班停課')
--            THEN COALESCE(sent, effective, onset) > NOW() - INTERVAL '72 hours'
--       ELSE COALESCE(sent, effective, onset) > NOW() - INTERVAL '48 hours' END) AS alert_after
-- FROM base;
