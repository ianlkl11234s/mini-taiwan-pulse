# 時間持續性：連續週期偵測（因果前置）

**適用**：「同一個地方連續好幾週都上新聞」「有沒有持續發生（而不是單次爆量）的熱點」。是 [change-over-time](change-over-time.md)「前後差多少」之外的另一種時間模式：找**連續不中斷**的區段，不是單純比較兩個時間點。

**工具鏈**（`pulse_sql`；gaps-and-islands 技巧：週序號減去分組內排名，結果相同者即為連續段）
```sql
WITH weekly AS (SELECT DISTINCT admin_code, date_trunc('week', published_ts)::DATE AS wk
                FROM ds_intel_digest_news_events WHERE is_event AND length(admin_code) = 8),
idx AS (SELECT admin_code, wk, (date_diff('day', DATE '2000-01-03', wk) / 7)::INT AS wk_num,
               row_number() OVER (PARTITION BY admin_code ORDER BY wk) AS rn FROM weekly),
streaks AS (SELECT admin_code, wk_num - rn AS streak_id, count(*) AS weeks, min(wk) start_wk, max(wk) end_wk
            FROM idx GROUP BY 1, 2)
SELECT admin_code, weeks, start_wk, end_wk FROM streaks WHERE weeks >= 3 ORDER BY weeks DESC
```
`wk_num - rn` 是關鍵：同一鄉鎮連續的週，週序號每次 +1、排名（rn）也每次 +1，兩者差值不變，形成同一組；一旦斷週，差值就跳號，自然分段。换成「日」或「月」只要把 `date_trunc`／`date_diff` 的單位一起換。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：`admin_code` 長度不是 8 碼的是縣市層級代理點，無法對到鄉鎮，需另外算筆數說明排除了多少；連續段涵蓋到資料窗口起訖點時（例如整個資料期間都連續），代表的是「資料起點」而非「近期新爆發」，要先確認資料涵蓋起始日再解讀為熱點。

**停止**：連續 ≥N 週的鄉鎮數 ＋ 前 10 筆（含起訖週）。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：要不要換成連續日／連續月？門檻要不要提高到 ≥4 週？要不要排除涵蓋整個資料窗口的段（代表持續背景值而非事件）？
