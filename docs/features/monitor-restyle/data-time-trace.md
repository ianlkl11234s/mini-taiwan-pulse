# 監看模式標題列「資料時間」溯源：5 格

> 查詢時間：2026-10-01 13:02（台灣時間；正式庫 `now()` = 05:02:35Z）。唯讀 SQL（SELECT、`max()`／`count()`／LIMIT，statement_timeout 15s）。
> 「實測」= 有 SQL 結果；「程式碼」= 讀原始碼得出。以下時間一律換成台灣時間。
> 行號以 2026-10-01 本 worktree 為準（工作區有平行 session 的未提交改動，行號可能再漂移）。
> 選時間的優先序：觀測時間 > 發布時間 > 收集時間。

## 總結

| 格 | 上游有的時間 | RPC 目前回傳 | 建議標題列時間 | 要不要改 RPC |
|---|---|---|---|---|
| radiation | `observed_at`（台電 CSV「日期時間」＝**觀測時間**）、`updated_at`（collector 寫入時間）、history 有 `collected_at` | **有**，站級 `observed_ts` | 非 stale 站的 `max(observed_ts)`（觀測時間） | **不用**，前端把 `observed_ts` 聚合進 `NuclearSummary` 即可 |
| timeline | 事件 `published_ts`（**發布時間**；約 18% 是收集時間代填）、`news_events.created_at`（入庫）、`news_events_daily.refreshed_at`（彙整時間）；警報疊層有 `sent`／`effective`／`collected_at` | 事件 `published_ts` **有**；`refreshed_at`、`created_at` **沒有**；`get_alert_series_24h` **完全不回時間** | 最新一則事件的 `published_ts`（發布時間） | 主時間**不用**改；要顯示彙整時間或警報時間才需改 RPC |
| hotZones | 同 timeline 新聞 | 同上 | 同上 | 同上 |
| triage | 同 timeline 新聞 | 同上 | 同上 | 同上 |
| hazardStrip | 無。2 個 video_id 寫死在前端，**不在** `live.yt_live_current` | 無 loader | 不顯示資料時間，改顯示「LIVE」或人工確認日 | 要接資料時間得先改 collector（加頻道）＋前端，不只改 RPC |

---

## 1. radiation 環境輻射

**前端**
- `src/data/nuclearLoader.ts:15-23`：`NuclearStation` 已有 `observed_ts: number`（unix 秒）和 `is_stale`。
- `nuclearLoader.ts:25-33`：`fetchNuclearStatusUncached()` 呼叫 RPC `get_nuclear_radiation_status`。
- `nuclearLoader.ts:221-238`：`NuclearSummary` **沒有任何時間欄位**；`summariseNuclear()`（:240-266）聚合時把 `observed_ts` 丟掉了。
- `nuclearLoader.ts:269`：`fetchNuclearSummary()` 只是 `summariseNuclear(await fetchNuclearStatus())`。
- 使用處：`src/components/intel/monitor/HazardCards.tsx:511-519` `RadiationCard` 的 `summaryQuery`。

**RPC**：`gis-platform/migrations/215_nuclear_radiation_status_rpc.sql`，現行版本在 `312_move_realtime_to_live.sql:2253-2270`。
`RETURNS TABLE(station_id, station_name, dose_usvh, is_stale, observed_ts BIGINT, lon, lat)`，`observed_ts = EXTRACT(EPOCH FROM observed_at)`，讀 `live.nuclear_radiation_stations`。

**資料表**（`184_realtime_nuclear_radiation.sql`，實測 information_schema 相符）
- `live.nuclear_radiation_stations`：`observed_at`（觀測時間）、`updated_at`（collector 最近一次 upsert 時間）。
- `live.nuclear_radiation_measurements`（history）：`observed_at`、`collected_at`。

**Collector**（`data-collectors/collectors/nuclear_radiation.py`）
- 上游台電 CSV（`d525001/001.csv`）原生就有「日期時間」欄（`YYYYMMDDTHHMMSS`，台北時區），`:103` 解析成 `observed_at`。所以**上游有真正的觀測時間**。
- `:115` `is_stale = (collected_at - observed_at) > 30min`，是 collector 寫入時算好的布林值。
- `storage/supabase_tables.py:648-667`：current 表 upsert，並設 `current_touch_updated_at: True`，所以 `updated_at` 是每次寫入時的 `now()`。

**實測**
- stations：`max(observed_at)` = 12:53:49，`max(updated_at)` = 12:55:51，51 站中 2 站 stale；排除 stale 站後 `max(observed_at)` 仍是 12:53:49。
- 49 站在 1 小時內有觀測。2 個 stale 站（t26101、t26102）的 `updated_at` 停在 09-07 14:25，`observed_at` 分別是 08-10 和 09-07，推測上游 CSV 已不再列出這兩站。
- measurements：`max(collected_at)` = 12:55:50，比最新觀測晚約 2 分鐘。

**結論**
- (a) 觀測時間 `observed_at`（台電給的）、寫入時間 `updated_at`／`collected_at`（collector）。
- (b) RPC 有回傳站級 `observed_ts`，但 `NuclearSummary` 聚合時丟掉了。
- (c) 用**非 stale 站的 `max(observed_ts)`**，標「觀測」。不要用全部站的 `min`，會被兩個停報站拖回 8 月。若想強調全國一致性，可另附「49/51 站」。
- (d) **純前端**：`summariseNuclear()` 多算一個 `observed_max_ts`（只算 `!is_stale` 的站），不用改 RPC。

## 2–4. timeline／hotZones／triage（新聞事件）

**前端**
- `src/data/newsEventsLoader.ts:38-52`：`ClusterEvent.published_ts`（unix 秒）；`RawCluster.latest_published_ts`（:31）。`fetchNewsEventsDayClusters()` 在 :233-256 呼叫 `get_news_events_day_clustered_v2`。
- `src/components/intel/monitor/MonitorPanel.tsx:333-358` `loadClusters`：`lastSuccessAt: Date.now()`（:358）是**瀏覽器拿到回應的時間**，不是資料時間。
- `MonitorPanel.tsx:465` 起 `allEventsToday`（依 published_ts 降序）；`newsDerived` 在 :601；timeline :645（另吃 `alertSeries`）、triage :659、hotZones :660。三格共用同一份 `clustersQuery`。
- `src/data/alertsLoader.ts:262-280`：`get_alert_series_24h` 只回 `{group, h, count}`。
- 前端另外已在載 `get_source_health`（`src/data/intelLoaders.ts:31-70`，`useMonitorDashboardData.ts` 的 `sourceHealth`），每個 RSS feed 有 `last_success_at`。

**RPC**
- `get_news_events_day_clustered_v2`（`165_news_events_clustered_rpc_v2.sql`，現行版本在 `312_move_realtime_to_live.sql:2073-2130`）：讀 `live.news_events_daily`，回傳 `latest_published_ts` 與 events jsonb（每則含 `published_ts`）。**沒有 `refreshed_at`，也沒有 `created_at`**。
- `get_alert_series_24h`（`211_monitor_alert_rpcs.sql:293`，現行版本在 `312…:1058-1130`）：用 `live.disaster_alerts` 的 `COALESCE(effective, sent, onset)` 和 `live.earthquake_events.occurred_at` 算今日 24 小時 × 6 類的計數矩陣，**不輸出任何時間戳**。

**資料表**（`162_news_events.sql`、`164_news_events_relevance.sql`；實測 information_schema 相符）
- `live.news_events`：`published_ts`（發布時間）、`created_at DEFAULT now()`（入庫時間，也就是收集時間）。
- `live.news_events_daily`：`published_ts`、`refreshed_at DEFAULT now()`。`refresh_news_events_daily()` 每次都 DELETE＋INSERT 整天，所以 `refreshed_at` 就是最近一次彙整時間（整天的列都是同一個值）。不帶 `created_at`。
- pg_cron `refresh-news-events` 實測排程是 `11,41 * * * *`（每 30 分，由 `302_refresh_cron_detangle.sql` 改過；164 寫的每 10 分已過時）。
- `live.source_health`：`last_success_at`、`last_attempt_at`、`updated_at`（RSS 抓取時間）。
- `live.disaster_alerts`：`sent`、`effective`、`onset`、`expires`、`fetched_at`、`collected_at`。

**Collector**（`data-collectors/collectors/news_events.py`）
- 上游是 RSS。`_entry_published_iso()`（:487-493）取 `published_parsed`，沒有就取 `updated_parsed`。**兩者都沒有時，用 `datetime.now()` 代填**，這時 published_ts 其實是收集時間。
- 寫入欄位見 `storage/supabase_tables.py:521-533`；`created_at` 由 DB default 填。

**實測**
- `news_events`（近 2 天）：`max(published_ts)` = 12:56:32.08，`max(created_at)` = 12:59:13；近 24h 2,100 筆中 **382 筆（約 18%）的 published_ts 帶小數秒**。feedparser 的 struct_time 沒有小數秒，所以這 382 筆就是 now() 代填的收集時間（推斷）。剛提到的最新一筆也屬於這類。入庫減發布的中位數是 929 秒（約 15 分）。
- `news_events_daily`：今日 304 筆，`max(published_ts)` = 12:11:42，`refreshed_at` = 12:41:00（下次 13:11）。**RPC 看到的最新事件比原始表落後約 45 分**，這是 30 分鐘 cron 造成的。
- `source_health`：29 個 feed，`max(last_success_at)` = 12:57:43。
- `disaster_alerts`：`max(sent)` = 12:50:56，`max(collected_at)` = 12:56:48。

**結論**
- (a) 發布時間 `published_ts`（RSS pubDate；約 18% 是收集時間代填）、收集時間 `news_events.created_at`、彙整時間 `news_events_daily.refreshed_at`、RSS 抓取時間 `source_health.last_success_at`。新聞沒有「觀測時間」這種概念，發布時間就是最接近事件的時間。
- (b) RPC 回傳 `published_ts`（事件級）和 `latest_published_ts`（cluster 級）。`refreshed_at`、`created_at` 沒回傳。警報 series 不回任何時間。
- (c) 三格都用**最新一則事件的 `published_ts`**，標「最新事件 HH:MM」。
  - 要從 **`clusters`（未經前端類別／縣市篩選）**取 max，不要從 `allEventsToday` 取，不然切到冷門縣市時「資料時間」會倒退，看起來像停更。RPC 層的 relevance／severity 篩選仍會影響結果，這點可接受，或另外說明。
  - 跟回放無關：scrub 時這個值不該跟著 playback 移動。
  - 但書：最新一則可能是代填的收集時間，而且比原始表晚最多約 45 分。所以這個時間的語意是「已上圖的最新事件」，不是「新聞收集到幾點」。
  - 若想顯示「收集到幾點」，前端現成可用的是 `sourceHealth` 各 feed 的 `max(last_success_at)`（RSS 抓取時間）。但那只代表 RSS 有抓到，不保證 LLM 分類與 daily 彙整已完成，不建議當主時間。
- (d) 主時間**不用改 RPC**，前端已拿得到。以下兩項需要改 RPC（gis-platform migration，須使用者拍板）：
  - 想顯示「彙整於 HH:MM」：在 v2 加回傳欄 `refreshed_at`，或另開輕量 RPC 讀 `max(refreshed_at)`。
  - timeline 的警報疊層想要自己的時間：`get_alert_series_24h` 加回傳 `max(COALESCE(effective, sent, onset))` 或 `max(collected_at)`。否則標題列只標新聞時間，並在圖例註明警報疊層是「今日逐時」。

## 5. hazardStrip 災防觀測

**前端**：`src/components/intel/monitor/HazardWatchStrip.tsx:30-43` 的 `HAZARD_CHANNELS` 寫死兩個 video_id：`KyT4qSK8lJo`（台灣地震監視）和 `ADZTiqEGT8g`（台灣颱風論壇，2026-07-26 人工換過，見檔頭註解 :10-14）。沒有 loader，也不呼叫任何 RPC。`MonitorPanel.tsx:687`。

**能否接 `live.yt_live_current`**
- RPC `get_yt_live_videos`（`209_realtime_yt_live_videos.sql`，現行版本在 `312…:4096-4106`）回傳 `observed_at`、`updated_at`。
- 但 collector `yt_live_video_resolver.py:66-82` 的 `CHANNELS` 只有 13 家新聞台，不含這兩個頻道。實測 `yt_live_current` 共 13 列，`video_id IN ('KyT4qSK8lJo','ADZTiqEGT8g')` 的筆數是 **0**。
- 就算接上，`yt_live_current.observed_at` 是 collector 每輪的收集時間（`:493` `observed_at = collected_iso`）；實測 13 台同為 12:59:54，`updated_at` 12:59:55。它代表「最近一次確認直播狀態的時間」，不是直播內容本身的資料時間。

**結論**
- (a) 上游**沒有**任何時間欄位。唯一相關的是人工確認日（檔頭註解 2026-07-26）。
- (b) 沒有 RPC。
- (c) 直播畫面本身就是即時的，標題列不應硬塞資料時間，建議顯示「LIVE／直播」。若要誠實揭露維護狀態，可標「頻道人工確認 2026-07-26」。
- (d) 若要有「最近確認直播中 HH:MM」，需要兩步，且都要使用者拍板：
  1. data-collectors：把兩個頻道加進 `CHANNELS`（handle、channel_id 須先解出）。會多用 YouTube API 配額，search 有每日 80 次的上限。
  2. 前端改讀 `get_yt_live_videos`。

  RPC 不用改，現有回傳欄位已足夠。

---

## 所用 SQL（摘要，皆唯讀）

```sql
SET statement_timeout=15000;
-- 欄位存在性
SELECT table_name, column_name, data_type FROM information_schema.columns
 WHERE table_schema='live' AND table_name IN ('nuclear_radiation_stations','news_events_daily','news_events','yt_live_current','source_health') ... LIMIT 60;
-- radiation
SELECT max(observed_at), max(updated_at), count(*), count(*) FILTER (WHERE is_stale),
       max(observed_at) FILTER (WHERE NOT COALESCE(is_stale,false)) FROM live.nuclear_radiation_stations;
SELECT max(observed_at), max(collected_at) FROM live.nuclear_radiation_measurements WHERE observed_at > now()-interval '1 day';
-- news
SELECT day, count(*), max(published_ts), max(refreshed_at) FROM live.news_events_daily WHERE day >= today-1 GROUP BY day LIMIT 3;
SELECT max(published_ts), max(created_at), percentile_cont(0.5) ... FROM live.news_events WHERE published_ts > now()-interval '2 days';
SELECT count(*) FILTER (WHERE extract(microseconds from published_ts)::int % 1000000 <> 0), count(*) FROM live.news_events WHERE created_at > now()-interval '1 day';
SELECT jobname, schedule FROM cron.job WHERE jobname ILIKE '%news%' LIMIT 5;
SELECT count(*), max(last_success_at) FROM live.source_health;
SELECT max(sent), max(effective), max(collected_at) FROM live.disaster_alerts WHERE sent > now()-interval '3 days';
-- yt
SELECT handle, observed_at, updated_at, is_live FROM live.yt_live_current ORDER BY handle LIMIT 20;
SELECT count(*) FROM live.yt_live_current WHERE video_id IN ('KyT4qSK8lJo','ADZTiqEGT8g');
```
