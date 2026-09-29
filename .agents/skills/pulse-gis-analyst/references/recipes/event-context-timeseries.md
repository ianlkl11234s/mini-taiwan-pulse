# 事件 × 新聞時間對齊（因果前置）

**適用**：「X（船舶／演習／設施活動）出現的頻率跟新聞報導量是不是同步」「哪一個先動」。與 [area-correlation](area-correlation.md) 的差別是軸換成**時間週期**而非**空間區域**；與 [news-persistence](news-persistence.md) 的差別是這裡要對齊**兩個獨立序列**算相關，不是找單一序列的連續段。

**工具鏈**（`pulse_sql`；已驗證模板，週序列 + 領先落後 ±1 週，<1 秒；已於 questionBank Q28 驗證）
```sql
WITH bounds AS (
  -- 只取兩序列收集窗口的重疊段；窗口外補 0 會把「沒收集」當成「沒發生」
  SELECT greatest(n.wk_start, e.wk_start) AS wk_start, least(n.wk_end, e.wk_end) AS wk_end
  FROM (SELECT date_trunc('week', min(published_ts))::DATE AS wk_start, date_trunc('week', max(published_ts))::DATE AS wk_end FROM ds_intel_digest_news_events) AS n,
       (SELECT date_trunc('week', min(day))::DATE AS wk_start, date_trunc('week', max(day))::DATE AS wk_end FROM ds_maritime_ccg_vessel_zone_daily) AS e
),
weeks AS (SELECT unnest(generate_series(bounds.wk_start, bounds.wk_end, INTERVAL 7 DAY))::DATE AS wk FROM bounds),
event_week AS (
  SELECT date_trunc('week', day)::DATE AS wk, sum(ships) AS activity_n
  FROM ds_maritime_ccg_vessel_zone_daily GROUP BY 1
),
news_week AS (
  SELECT date_trunc('week', published_ts)::DATE AS wk, count(*) AS news_n
  FROM ds_intel_digest_news_events
  WHERE is_event AND (title LIKE '%關鍵字1%' OR title LIKE '%關鍵字2%')
  GROUP BY 1
),
joined AS (
  SELECT weeks.wk, coalesce(event_week.activity_n, 0) AS activity_n, coalesce(news_week.news_n, 0) AS news_n
  FROM weeks LEFT JOIN event_week ON event_week.wk = weeks.wk LEFT JOIN news_week ON news_week.wk = weeks.wk
),
lagged AS (
  SELECT wk, activity_n, news_n,
         LAG(news_n) OVER (ORDER BY wk) AS news_prev_wk,
         LEAD(news_n) OVER (ORDER BY wk) AS news_next_wk
  FROM joined
)
SELECT count(*) AS overlap_weeks,
       round(corr(activity_n, news_n), 3) AS corr_lag0,
       round(corr(activity_n, news_prev_wk), 3) AS corr_newsLeadsActivity_1wk,
       round(corr(activity_n, news_next_wk), 3) AS corr_activityLeadsNews_1wk
FROM lagged
```
三個關鍵設計：
1. **`weeks` 用 `generate_series` 而非直接 `GROUP BY`／`JOIN`**：事件表若只在「有偵測到」時才有一列（例如 `ds_maritime_ccg_vessel_zone_daily` 沒有 ships=0 的列），直接 `JOIN` 會把「這週真的是 0」的週整週剔除，稀釋分母、讓相關係數失真。用 `generate_series` 撐出完整週序列、`COALESCE(...,0)` 補零，才不會把「沒紀錄」跟「沒發生」混在一起——但也要在但書講清楚兩者仍分不開。週序列的起訖取**兩序列收集窗口的交集**（`greatest` 起點、`least` 終點）：只用其中一邊的窗口，另一邊在它收集期外的週會被補成 0，憑空造出「活動＝0」而偏移相關係數。
2. **領先落後用 `LAG`／`LEAD` window function，不用日期算術位移 join**：`wk - INTERVAL 7 DAY` 之類的日期算術在有缺週時容易對不齊；`LAG`／`LEAD` 保證按實際排序後一格一格位移，且 `corr()` 會自動跳過位移後產生的 `NULL`（頭尾各少一筆），統計上才正確。
3. **關鍵字用 `OR` 展開在 `WHERE ... LIKE` 裡**，不要合成單一 regex；每個關鍵字命中率差很多時（例如地名關鍵字常撈到大量不相關地方新聞），拆開分別算一次命中數，才能判斷哪個關鍵字在稀釋訊號。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：這是時間上的共同出現（co-occurrence），**不是因果**；相關強弱與顯著性是兩回事：|r| < 0.4 只能說「弱相關」，要不要說「不顯著」得看重疊週數 n（例如以 t = r·√(n−2)/√(1−r²) 或 Fisher z 信賴區間判斷，並一併報 n），且週序列有自相關、實際有效樣本更少；無論強弱都不要暗示因果方向；兩序列的資料窗口長度常不一致（例如新聞資料起點晚於事件資料），要先報告實際重疊週數，重疊 <20 週時明講統計檢定力低；地名／機構關鍵字（例如「金門」）常撈到大量無關新聞，稀釋相關性，需要時另跑一次更窄的關鍵字組合比對訊噪比；事件表若是稀疏列（缺列＝0 還是缺列＝沒收集，無法從資料本身分辨）要在答案裡講清楚。

**停止**：重疊週數、lag -1/0/+1 三個相關係數、（可選）分組後的相關係數 ＋ 週序列表本身供覆核。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要把關鍵字拆開分別算一次看訊噪比？要不要換成分組（例如分艙／分縣市）各自算相關？要不要把重疊窗口外的單邊序列也畫出來看長期趨勢？
