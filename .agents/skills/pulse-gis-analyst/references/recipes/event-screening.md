# 事件周邊敏感設施篩查（空間）

**適用**：「這些新聞事件周圍有沒有學校／托嬰／長照」「事件點附近有什麼敏感機構」。

**先看座標精度**（`pulse_wh_describe` 的 `precisionClass`）：
- 事件是**精確點**：`pulse_nearby_profile({points, radiusM: 300–500, categories:["sensitive_facility"]})`，批次用 `pulse_sql` 的 `ST_DWithin(e.geom_3826, f.geom_3826, R)`。
- 事件是**行政區代理點**（`ds_intel_digest_news_events` 就是，precision=`proxy`）：半徑沒有意義，改成「同鄉鎮內有幾個敏感設施」：
```sql
WITH ev AS (SELECT admin_code, count(*) AS events FROM ds_intel_digest_news_events
            WHERE is_event AND published_ts >= TIMESTAMP '2026-08-27' AND length(admin_code) = 8 GROUP BY 1),
sens AS (SELECT t.area_code, count(*) AS facilities FROM (
           SELECT geom FROM ds_education_schools UNION ALL SELECT geom FROM ds_education_kindergartens
           UNION ALL SELECT geom FROM ds_welfare_childcare_centers UNION ALL SELECT geom FROM ds_welfare_elderly_care_homes) f
         JOIN boundaries_town t ON ST_Within(f.geom, t.geom) GROUP BY 1)
SELECT t.name, ev.events, coalesce(sens.facilities, 0) AS sensitive_facilities
FROM ev JOIN boundaries_town t ON t.area_code = ev.admin_code LEFT JOIN sens ON sens.area_code = ev.admin_code
ORDER BY ev.events DESC LIMIT 10
```
`admin_code` 只有 5 碼的是縣市層級，只能到縣市，不列入鄉鎮比對並說明筆數。

**必帶但書**（自查用；對使用者只挑 1–2 句改白話「小提醒：」，不帶表名欄位代號）：命中只代表「在半徑內」，不代表受影響；事件座標常是地址或行政區代理點，說明精度；新聞事件時間與設施資料時間不同。

**停止**：命中事件清單（前 10）＋總數；不逐筆描述未命中者。

**追問**（素材：從結果挑一個，照 SKILL「回答格式」改寫成一兩句問句，不照抄成清單）：命中最多的事件要不要放大看？要不要只看兒少類設施？要不要改成「事件 → 最近設施距離」分佈？

> 新聞事件：2026-09-26 自 live.news_events 唯讀匯出 81,310 筆有座標者（鄉鎮代理點約四成，其餘只到縣市）；需要更新時重跑匯出並 `update_store.py --only news_events`。
