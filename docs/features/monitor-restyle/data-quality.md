# 監看模式 Split 版面：各格資料品質盤點

> 查詢時間：2026-09-30 23:10（台灣時間；正式庫 `now() AT TIME ZONE 'Asia/Taipei'` = 23:09:57）
> 做法：讀程式碼 + 正式庫唯讀 SQL（只用 SELECT、有界聚合或 LIMIT、statement_timeout 15s）。「實測」表示有對應 SQL 或 curl 結果；「推斷」表示從程式碼或定義推得。
> 範圍：`src/components/intel/monitor/monitorSplitLayout.ts` 的 `MONITOR_LAYOUT_SPLIT` 共 24 格。接線位置在 `MonitorPanel.tsx:567-662`。
> 停更、下架、`?? 0` 影響顯示這三類結論，主 agent 都重跑 SQL 或讀原始碼複驗過（見文末 §所用 SQL 的「複驗」欄）。

## 橫向結論（先讀這段）

1. **傳輸狀態不等於來源新鮮度。** `MonitorDataStatus.tsx` 和 `useIntelPollingQuery.ts` 只分 `unknown / ready / error / denied`。只要 RPC 成功回應，就算上游已停更好幾週，也會顯示成 `ready`。hook 沒有任何「lastSuccessAt 多久算 stale」的門檻。所以有沒有過期提示，完全看各元件自己有沒有寫判斷。
2. **自帶來源過期判斷的格子只有 5 格：** foodPriceBoard（>3 天）、prison（>7 天）、isrSatellitePasses（>36h／>48h）、internetHealth（DB 端 `stale_after_seconds`）、radiation（站級 `is_stale`）。newsFeed 家族算半格：只在「當天結果為空，且最新定位日落後超過 1 天」時才報錯。
3. **其餘 18 格沒有來源過期提示。**
4. **正在壞的格子：**
   - airportPax 停更 2.5 天。
   - prison 上游停更 138 天。
   - 公衛登革熱來源已下架。另外流感與腸病毒延到 W37，落後 3 週。
   - situationOverview 的壓力指數是前端 bug，**永遠顯示「更新中斷」**。
   - lightning 的 CWA 來源疑似 09-27 起停更。

## 總表

| 格子 | 來源（RPC → 表 → collector → 機關） | 上游頻率 | 前端輪詢 | 最近資料時間 | 過期門檻 | 缺值畫法 | 判定 |
|---|---|---|---|---|---|---|---|
| newsFeed | `get_news_events_day_clustered_v2`、`get_news_trending` → `live.news_events_daily`／`news_events_hourly_county_cat` → `news_events.py`（RSS＋LLM）→ 中央社、ETtoday、Google News | collector 10 分；pg_cron 30 分 | 60s | 事件 22:47，daily refreshed 22:41（實測） | 僅在結果空且落後 >1 天時報錯 | 無 NULL 問題 | 新鮮 |
| timeline | 同 newsFeed，另疊 `get_alert_series_24h` | 同上 | 60s | 同上（實測） | 同 newsFeed | 同上 | 新鮮 |
| alertBoard | `get_alert_summary`＋`get_alert_series_24h` → `live.disaster_alerts` → `ncdr_alerts` → NCDR CAP | 15 分；cron 30 分 | 60s | 生效 22:18，collected 23:09（實測） | 無 | **series 失敗或未載入時畫 24 格全 0** | 新鮮 |
| hotZones | 同 newsFeed | 同上 | 60s | 同上（實測） | 同 newsFeed | **「熱度倍數」是用筆數合成的假值** | 新鮮（倍數是合成值） |
| triage | 同 newsFeed | 同上 | 60s | 同上（實測） | 同 newsFeed | NULL severity／relevance 當 0 級計入（今天沒有 NULL） | 新鮮 |
| liveWall | `get_yt_live_videos` → `live.yt_live_current` → `yt_live_video_resolver.py` → YouTube Data API | 5 分 | 10 分 | updated 23:06（實測） | 無，只顯示 `last_error` | 沒有 video_id 的頻道不進選單（PTS 整台消失） | 新鮮 |
| hazardStrip | 寫死 2 個 YouTube video_id，沒有 loader | 人工維護 | — | oembed 回 200（實測），是否直播中未驗 | 無存活偵測 | — | 不適用（人工維護） |
| typhoon | `typhoons_active` view（24h）＋`get_typhoon_proximity_daily` → `live.typhoon_positions` → `jma_typhoon.py`／`jtwc.py` → JMA、JTWC | 180／360 分 | 30 分 | JMA 20:00，JTWC 14:00（實測） | 只有 view 的 24h 窗 | `storms_nearby ?? 0`；「沒有颱風」和「collector 壞了」分不出來 | 新鮮 |
| radiation | `get_nuclear_radiation_status`＋`_daily` → `live.nuclear_radiation_stations` → `nuclear_radiation.py` → 台電 opendata | 15 分 | 5 分／趨勢 30 分 | 51 站最新 23:05；白砂、貓鼻頭 2 站 stale（實測） | 站級 `is_stale`（DB） | 趨勢缺日畫 null 灰樁 | 新鮮（個別站停更） |
| lightning | `get_lightning_day(source='cwa')`＋`get_lightning_daily` → `live.lightning_events` → `lightning_cwa.py` → CWA O-A0039-001 | 5 分 | 5 分／趨勢 30 分 | **CWA 最新 09-27 18:22**；台電源 09-28~30 每天還有 1–2 筆（實測） | 無 | **`count ?? 0` 讓「今日尚無落雷」和停更長得一樣** | **疑似停更（CWA）** |
| earthquake | `public.earthquake_events` view → `live.earthquake_events` → `earthquake.py` → CWA 有感地震 | 15 分 | 15 分 | 最新 09-30 13:00（實測） | 無，只有相對時間 | magnitude／depth `?? 0`（近 200 筆沒有 NULL）；「無事件」和「讀取失敗」可以區分 | 新鮮 |
| foodPriceBoard | `get_food_price_summary`／daily → `analytics.food_price_index_daily` → analytics `08_supabase.py`（本機 launchd 06:00）←`live.food_price_daily`←`food_prices.py` → 農業部 | 日（T+1） | 60 分 | 指數到 09-29（EPI 09-28），原料到 09-30（實測） | **>3 天警示** | `devPct ?? 0` 只用來判斷方向 | 新鮮（排程依賴 Mac 開機） |
| taiex | `get_market_index_now`／`_daily` → `live.market_index_current` → `twse_market_index` → 證交所 MIS | 1 分 | 60s／日線 10 分 | 09-30 13:33 收盤值（實測） | **無，只顯示 HH:MM、不顯示日期** | 空列回 index=0，被 `index>0` 擋掉 | 新鮮 |
| situationCards | `get_public_health_weekly` → `live.public_health_weekly` → HiCloud VM `cdc_public_health_weekly_vm`（週四 11:00）→ 疾管署 od.cdc.gov.tw | 週 | 30 分 | 流感／腸病毒 W37（collected 09-24）；**登革熱 W32（collected 08-13）**（實測） | 無，只顯示「截至 W37」 | **yoy 缺值 → RPC 與前端雙重補 0，畫成「+0%」** | 流感／腸病毒延遲；**登革熱：來源已下架** |
| prison | `get_prison_population_window(365)` → `live.prison_population_daily` → `correctional_daily_snapshot` → 矯正署 today.xml | 標稱日更 | 30 分 | **observed_date 2026-05-15**；collected_at 每天刷新（實測） | **>7 天警示「上游已 N 天未更新」** | null 會被過濾 | **停更（上游停更 138 天）** |
| airportPax | `get_airport_hourly_pax`（24h 窗）→ `live.border_airport_snapshot` → `immigration_apis_airport`（HiCloud VM）→ 移民署 APIS | 60 分 | 5 分 | **TPE 09-28 04:07**；RMQ／TSA 09-25 16:07（實測） | **無** | `\|\| 0` 之後過濾 `>0`，不會畫成 0 | **停更約 2.5 天（collector 端）** |
| powerCard | `get_power_dashboard`／`get_ssot_facility_output_24h`／`get_power_daily_trend` → `live.power_*` → `power_taipower` → 台電 | 10 分 | 5／10／30 分 | 三張表都到 22:50（實測）；09-25 只有 4 筆快照 | **無**（時間只有 HH:MM） | `?? 0` 只用來算比例 max | 新鮮 |
| erCongestion | `get_er_hospital_latest`／`_24h_all`／`get_er_wait_total_14d` → `live.er_hospital_*` → `er_hospital_realtime` → 健保署 | 15 分 | 5 分 | 最新 23:00，59 院（實測）；**09-25~28 整段斷；北市聯醫一院停在 08-28** | **無**（沒用到 `observed_ts`） | null 列為「無資料」 | 部分停更（未標示） |
| situationOverview | 壓力：`get_pressure_index_now` → `live.pressure_index_now`（cron 每小時 :23）；來源健康：`get_source_health` → `live.source_health` | 1h／10 分 | 60s | 壓力 updated 22:23；來源健康 27/29 ok（實測） | 無 | `vs_baseline`／`vs_1h_ago ?? 0` | **壓力指數前端 bug，永遠「更新中斷」**；來源健康新鮮 |
| plaBoard | `get_pla_severity_daily`／`_situation_summary`／`_kind_summary` → `live.pla_activity_daily` → `pla_activity_daily.py` → 國防部 | 30 分（實際是日報） | 30 分 | report_date 09-29（實測，屬正常節奏） | 無 | 逐日 null 顯示「—」；摘要的 `?? 0` 影響小 | 新鮮 |
| vesselZone | `get_vessel_zone_daily` → `live.vessel_zone_daily`（cron :20）←`vessel_watch_positions`←`ship_ais.py`（HiCloud VM）→ 航港局 AIS | 10 分／cron 1h | 30 分 | day 09-30；positions 23:00（實測） | 無 | **`fillDays` 把沒列的日子補 0 艘；`r.ships ?? 0`** | 新鮮（但停更會被畫成「無船」） |
| isrSatellitePasses | `get_isr_satellite_passes_daily` → `analytics.isr_satellite_passes_daily` → `satellite_passes_daily.py`（TLE＋SGP4） | 日（cron :17 refresh） | 30 分 | 完整日 09-29，computed 09-30 21:36（實測） | **計算 >36h 或完整日 >48h** | 明標「不以 0 代替」 | 新鮮 |
| traDelay | `get_tra_delay_summary`／`_trains` → `analytics.tra_*_daily` → pg_cron `refresh-tra-delay-yesterday`（01:56）←`live.train_positions`（TDX） | 日（T+1） | 60 分 | service_date 09-29，refreshed 09-30 01:56（實測）；覆蓋約 85% | 無明確門檻，只顯示 serviceDate＋覆蓋率 | `Number(x ?? 0)`，下游過濾 `observedTrains>0` | 新鮮 |
| internetHealth | `get_internet_health_status` → `live.internet_health_current` → `ripe_atlas_internet_health`／`ripe_ris_live`（另有 IODA、Cloudflare）→ RIPE NCC | 5 分 | 5 分 | RIPE 23:10；Cloudflare 停在 21:30（實測） | **DB `stale_after_seconds`；缺欄位一律當 stale** | stale 或缺值當 unknown | 新鮮（Cloudflare 子源延遲） |

## 每格細節

### newsFeed／timeline／triage／hotZones（新聞家族）
- **載入流程：**
  - `MonitorPanel.tsx:293-323` 的 `loadClusters` 呼叫 `newsEventsLoader.ts:233`（`get_news_events_day_clustered_v2`），每 60s 輪詢一次（`:320`）。
  - 「升溫排行」走 `intelLoaders.ts:91` 的 `get_news_trending`（`useMonitorDashboardData.ts:26`）。
  - timeline、triage、hotZones 經 `newsDerived()`（`MonitorPanel.tsx:561-564`）共用同一份 `allEventsToday`，要等 `clustersQuery.lastSuccessAt` 不為 null 才渲染。
- **過期判斷：** `isNewsEventSourceStale`（`newsEventsLoader.ts:172-183`，toleranceDays=1）只在「當天 0 筆」時觸發。如果當天上午有資料、下午停更，或切到有舊資料的日期，都偵測不到。
- **triage：** `TriageWidget.tsx:96-97` 把 NULL 的 severity／gis_relevance 當 0 級。今天實測沒有 NULL。
- **hotZones：** `HotspotsWidget.tsx:35` 的 `surge = 1 + n*0.28` 是用筆數推出來的，但畫面上標成「熱度倍數 ×」（`:63`、`:143-150`）。真正的倍數 `get_news_trending.surge_ratio` 沒有接上。這不是資料缺值，但**畫面上呈現的是合成值**。

### alertBoard
- `alertsLoader.ts:162`（summary）、`:262`（series 24h）。
- `MonitorPanel.tsx:457-460`：series 讀不到時，改用 `emptySeries()`（`alertsLoader.ts:300`）畫 24 格全 0。上方雖然有「警報歷史 · 更新中斷」，但**圖本身呈現為 0 線**。
- `AlertBoard.tsx:470-471` 的 `?? 0` 只作用在缺分組，影響小。

### situationOverview
- **壓力指數 bug（主 agent 已複驗）：**
  - `intelLoaders.ts:179` 要求 `row.asof != null`。
  - 正式庫 `get_pressure_index_now()` 回傳欄位是 `(composite, level, weight_mode, per_signal, vs_baseline, vs_1h_ago, updated_at)`，**沒有 `asof`**。
  - 結果是每次都回 error「壓力指數尚無有效觀測值」。
- **per_signal：** 實際是物件（例如 `{"er":65,"aqi":43.3,...}`），`asArray`（`intelLoaders.ts:24`）會把它轉成 []。就算修好 asof，signal 細節仍會是空的。
- **排程不一致：** 正式庫 cron `compute-pressure-index` 是 `23 * * * *`（每小時），和 migration 302 的 `*/15` 不一致。
- **來源健康：** 29 個 feed 中 27 ok、1 lagging、1 degraded（ltn local.xml 403）。它只反映 RSS 抓取，不含 LLM 標註。

### taiex
- `intelLoaders.ts:252-292`；`PressureRing.tsx:109`（日線 10 分）、`:116`（`index>0` 擋 0）、`:151`（只顯示 HH:MM）。
- collector 如果停好幾天，畫面會一直顯示舊的收盤值，而且看不出日期。

### situationCards（公衛週報）
- `intelLoaders.ts:497-531`。RPC 只取所有疾病中最近 4 個 ISO 週，所以登革熱（停在 W32）被**靜默濾掉**，卡片上直接消失，沒有「來源已下架」的說明。
- `SituationCards.tsx:130` 的註解「目前 RPC 只回登革熱」已經過時。
- **yoy 被畫成 0：** RPC `210_monitor_kpi_rpcs.sql` 在去年同期缺值時回 0；前端 `intelLoaders.ts:521` 又 `Number(r.yoy ?? 0)`。結果畫面顯示「↑+0% vs 去年同期」（`SituationCards.tsx:8`、`:62-66`）。
- **週次落後：** 目前是 W40，最新資料 W37。下次 VM 排程是 10-01（週四）。

### internetHealth
- `internetHealthLoader.ts:1128-1143`；`TelecomStatusCard.tsx:405`（5 分）、`:440`（缺 `is_stale` 欄位時視為 stale）。
- loader 檔頭（`:9`）明文規定 stale 或缺列只能是 unknown。這是全版面處理得最完整的一格。

### liveWall／hazardStrip
- **liveWall：** `intelLoaders.ts:493`、`LiveWall.tsx:303`（10 分）、`:209-213`（只顯示 last_error）。PTS、CNA、ERA 目前處於 `search_cooldown`，沒有 video_id。PTS 沒有 fallback，整台從選單消失，也沒有提示。
- **hazardStrip：** `HazardWatchStrip.tsx:24-35` 寫死 video_id，沒有任何存活檢查。直播結束後會一直停在失效畫面。

### typhoon／earthquake／radiation／lightning（`HazardCards.tsx`）
- **typhoon：** `typhoonTracksLoader.ts:453`、`:531`、`:542`（`storms_nearby ?? 0`）。卡片 `HazardCards.tsx:303`。
- **earthquake：** `earthquakeLoader.ts:34,104,177`；`:121-122` 的 magnitude／depth `?? 0`（目前沒有 NULL）；`:49` 有同型寫法，推斷是圖層用。「無地震紀錄」和「查詢失敗」有分開的畫面。
- **radiation：** `nuclearLoader.ts:29`；由 DB 判定站級 `is_stale`，`summariseNuclear` 會排除 stale 站，顯示 reporting/total。趨勢缺日用灰樁 null（`HazardCards.tsx:540`）。
- **lightning：** `lightningLoader.ts:165-`；`count ?? 0` 導致 `countDay=0` 時顯示「今日尚無落雷」（`HazardCards.tsx:625,646`）。
  - CWA 最新一筆是 09-27 18:22。台電源 09-28、29、30 各有 2、1、1 筆，所以不是「整個台灣都沒雷」。CWA collector 需要另外檢查（主 agent 已複驗）。
  - 台電源註解寫「2026-07-10 起永遠回空」，已經過時。

### foodPriceBoard
- `intelLoaders.ts:826,831`；`FoodPriceBoard.tsx:76`（>3 天）、`:111`（警示文案）、`:134,205`（low_coverage 退回前一交易日）；`:255,290` 的 `devPct ?? 0` 只用來判斷方向。
- RPC 視窗以 `max(trade_date)` 為錨，所以停更時仍會畫滿 180 點，要靠 `:76` 的判斷補救。
- 08-21 文件記錄的「停更 19 天」已經恢復。剩下的風險是：指數 pipeline 由本機 launchd `com.gis.foodprice_index` 驅動，正式庫 `cron.job` 裡沒有 food 排程。launchd 是否仍載入未以 `launchctl` 確認，是從資料到 09-29 反推的。

### prison
- `prisonLoader.ts:14`；`PrisonCard.tsx:16`（`STALE_WARN_DAYS=7`）、`:45-51`、`:173`（「上游已 N 天未更新」）。趨勢以序列最後一天為錨，所以畫面不會變空。
- 上游 `today.xml` 回 200，但 Last-Modified 是 2026-05-15，內容日期是 115/05/15。
- `collected_at` 每天都會刷新，**用 collected_at 判斷新鮮度的監控會誤判為新鮮**。
- 在監 RPC 的視窗錨點修正仍只存在 `docs/proposal/monitor-tweaks-2026-08-21/prison_population_window_anchor.PENDING.sql`，尚未套用。gis-platform 的 `369_*` 其實是台鐵誤點表，不是這支 RPC。
- 正式庫 `get_prison_population_window(365)` 仍以 `now()` 為錨：08-21 回 214 筆，**今天回 174 筆，已經在逐日縮水**，推估約 2027-05 會變空。

### airportPax
- `airportPaxLoader.ts:10`；`AirportPaxCard.tsx:22-26`（5 分）、`:31`（`pick(r) || 0` 之後 `.filter(v>0)`）。
- RPC `262_rpc_airport_hourly_pax.sql` 只看 `collected_at >= now()-24h`。停更超過 24h 後，視窗變成全空，只會顯示空狀態，**沒有「上游停在 X 時」的提示**。
- 移民署 APIS 端點回 200，上游本身還活著，推斷是 HiCloud VM 上的 collector 停了（未查 VM）。

### powerCard
- `energyLoader.ts:64,88,160`；`useMonitorDashboardData.ts:24-27`；`powerCardData.ts:38`（`regionMap[r] ?? 0` 只用來算比例 max，缺區域的 mw 仍是 null，見 `:40`）、`:66`（`observedHHMM` 不含日期）；`PowerCard.tsx:63` 的 `|| 1` 是防止除以 0。

### erCongestion
- `erHospitalLoader.ts:111,161,174`；`ERCard.tsx:25-27`（5 分）；`erCardData.ts:106`（null 列為「無資料」，另計 noData）。
- `observed_ts` 雖然有從 RPC 回來，但 ERCard／erCardData 都沒有用到。北市聯醫（0101090517）停在 08-28 16:31，仍被當成最新快照顯示。
- 14 天趨勢只有 225/336 個小時桶，09-25~28 斷線的那段沒有補點。

### plaBoard／vesselZone／isrSatellitePasses／traDelay
- **plaBoard：** `intelLoaders.ts:638,671,697`；`:655`、`:688-692` 的 `Number(r[k] ?? 0)` 只作用在摘要與機型表。
- **vesselZone：** `intelLoaders.ts:868`；`VesselZoneCard.tsx:144-165` 的 `fillDays` 註解明寫「沒有列的日子代表當天沒有船（真的 0，不是缺資料）」。這個假設只在 AIS 與 cron 都正常時才成立；上游一停就會畫成 0 艘。`:106` 的 `r.ships ?? 0` 也有影響：09-26~29 有 NULL 列（09-29 有 2 筆）。
- **isrSatellitePasses：** `isrSatellitePassesLoader.ts:196`、`deriveIsrPassFreshness`（約 `:120`）；`IsrSatellitePassCard.tsx:221-225`。
- **traDelay：** `intelLoaders.ts:979-994`（`Number(x ?? 0)`）、`:1003,1042`；`TraDelayBoard.tsx:53-55`（取最後一個 `nearDestTrains>0` 的日子）、`:170-172`、`:205`、`:242`。

## 把缺值畫成 0 的位置（依影響排序）

| 位置 | 影響 |
|---|---|
| `VesselZoneCard.tsx:144-165` `fillDays` + `:106` `ships ?? 0` | 上游停更會顯示成「無船進入接近帶」 |
| `lightningLoader.ts` `count ?? 0` → `HazardCards.tsx:625,646` | 停更會顯示成「今日尚無落雷」（目前 CWA 疑似就是這樣） |
| `210_monitor_kpi_rpcs.sql` yoy→0 + `intelLoaders.ts:521` | 公衛卡「+0% vs 去年同期」 |
| `MonitorPanel.tsx:457-460` `emptySeries()` | 警報 24h 圖在失敗時畫成 0 線 |
| `typhoonTracksLoader.ts:542` `storms_nearby ?? 0` | 沒有觀測的日子顯示為 0 顆 |
| `TriageWidget.tsx:96-97` | NULL 被當 0 級（目前沒有 NULL） |
| `HotspotsWidget.tsx:35` | 不是補 0，但「熱度倍數」是合成值 |
| 影響小或已被擋掉 | `earthquakeLoader.ts:121-122`、`intelLoaders.ts:189-190,655,688-692,979-994`、`AirportPaxCard.tsx:31`、`powerCardData.ts:38`、`FoodPriceBoard.tsx:255,290`、`intelLoaders.ts:263`（被 `index>0` 擋） |

## 所用 SQL

全部是唯讀 SELECT，透過 `PGOPTIONS='-c statement_timeout=15000' psql "$SUPABASE_DB_URL"` 在 subshell 執行，連線字串沒有輸出。「複驗」表示主 agent 自己重跑過。

```sql
-- 基準時間（複驗）
SELECT now() AT TIME ZONE 'Asia/Taipei';

-- airportPax（複驗）
SELECT max(collected_at) AT TIME ZONE 'Asia/Taipei' FROM live.border_airport_snapshot
 WHERE collected_at > now()-interval '10 days';
-- 另：依機場分群 max(collected_at)、近 10 天每日快照數

-- prison（複驗）
SELECT max(observed_date), max(collected_at) AT TIME ZONE 'Asia/Taipei' FROM live.prison_population_daily;
SELECT count(*) FROM get_prison_population_window(365);
SELECT pg_get_functiondef('public.get_prison_population_window'::regproc);

-- 公衛（複驗）
SELECT disease_code, max(iso_year*100+iso_week), max(collected_at) AT TIME ZONE 'Asia/Taipei'
  FROM live.public_health_weekly GROUP BY 1 LIMIT 10;
SELECT * FROM public.get_public_health_weekly();

-- 壓力指數（複驗）
SELECT pg_get_function_result('public.get_pressure_index_now'::regproc);
SELECT updated_at, composite, level, per_signal FROM live.pressure_index_now WHERE id=1;

-- lightning（複驗）
SELECT source, max(strike_time) AT TIME ZONE 'Asia/Taipei', count(*) FROM live.lightning_events
 WHERE strike_time > now()-interval '10 days' GROUP BY 1 LIMIT 5;
SELECT source, (strike_time AT TIME ZONE 'Asia/Taipei')::date d, count(*) FROM live.lightning_events
 WHERE strike_time > now()-interval '5 days' GROUP BY 1,2 ORDER BY 2,1 LIMIT 20;
-- 另：analytics.lightning_daily_summary 依 source 取最新日

-- 新聞
SELECT max(published_ts), count(*) FROM live.news_events WHERE published_ts > now()-interval '3 days';
SELECT day, count(*) FROM live.news_events_daily WHERE day >= current_date-3 GROUP BY 1;
SELECT max(refreshed_at) FROM live.news_events_daily;
SELECT max(hour) FROM live.news_events_hourly_county_cat WHERE hour > now()-interval '3 days';
SELECT count(*) FROM public.get_news_events_day_clustered_v2('2026-09-30', 2, true, 0);
SELECT status, count(*) FROM public.get_source_health() GROUP BY 1;

-- 警報
SELECT max(effective), max(collected_at) FROM live.disaster_alerts WHERE collected_at > now()-interval '5 days';
SELECT * FROM public.get_alert_summary();

-- 台股
SELECT observed_at, is_market_open, index_value FROM live.market_index_current ORDER BY observed_at DESC LIMIT 3;

-- 網路健康
SELECT * FROM live.internet_health_current WHERE entity_id='TW';
SELECT DISTINCT ON (source) source, status, finished_at FROM live.internet_health_source_runs
 WHERE finished_at > now()-interval '3 days' ORDER BY source, finished_at DESC;

-- 災害
SELECT max(updated_at) FROM live.yt_live_current;
SELECT source, max(valid_at), max(collected_at) FROM live.typhoon_positions GROUP BY 1;
SELECT count(*) FROM public.typhoons_active;
SELECT max(occurred_at) FROM live.earthquake_events;
SELECT count(*), count(*) FILTER (WHERE is_stale), max(observed_at), min(observed_at) FROM live.nuclear_radiation_stations;
SELECT max(obs_date) FROM analytics.nuclear_radiation_daily;

-- 情報
SELECT max(target_day), max(computed_at) FROM analytics.isr_satellite_passes_daily;
SELECT max(day), count(*) FILTER (WHERE ships IS NULL) FROM live.vessel_zone_daily WHERE day > current_date-7;
SELECT max(collected_at) FROM live.vessel_watch_positions WHERE collected_at > now()-interval '2 days';
SELECT * FROM get_pla_severity_daily(120) ORDER BY 1 DESC LIMIT 4;

-- 統計／交通
SELECT indicator, max(trade_date) FROM analytics.food_price_index_daily WHERE trade_date > current_date-60 GROUP BY 1;
SELECT max(trade_date), max(collected_at) FROM live.food_price_daily WHERE trade_date > current_date-30;
SELECT max(service_date), max(refreshed_at), count(*) FROM analytics.tra_delay_summary_daily;
SELECT max(collected_at) FROM live.train_positions WHERE collected_at > now()-interval '1 day';
SELECT max(observed_at), count(*) FROM live.power_system_status WHERE observed_at > now()-interval '2 days';
SELECT count(*) FROM live.power_generation_unit WHERE observed_at > now()-interval '1 day';
SELECT min(observed_at), max(observed_at) FROM live.er_hospital_current;
SELECT hosp_id, observed_at FROM live.er_hospital_current WHERE observed_at < now()-interval '1 hour' LIMIT 5;
SELECT (observed_at AT TIME ZONE 'Asia/Taipei')::date, count(*), count(DISTINCT date_trunc('hour', observed_at))
  FROM live.er_hospital_status WHERE observed_at > now()-interval '15 days' GROUP BY 1 ORDER BY 1 LIMIT 20;

-- 排程
SELECT jobname, schedule FROM cron.job WHERE jobname ILIKE ANY (ARRAY['%news%','%pressure%','%vessel%','%isr%','%tra%','%alert%']) LIMIT 30;
```

說明：「複驗」以外的 SQL 由三個唯讀 worker 執行，欄位名依它們的回報整理，可能與實際欄位名有小差異（例如 `index_value`、`finished_at` 是示意寫法）。外部檢查另外用 curl 讀了三個公開端點：矯正署 `today.xml` 的標頭、移民署 APIS `-I`、YouTube oembed，都沒有帶任何金鑰。

## 未驗證項目
- 壓力指數「永遠中斷」是從程式碼與 RPC 回傳欄位推得，沒有開瀏覽器確認畫面。
- airportPax、CWA 落雷停更的原因沒有查 HiCloud VM 或 Zeabur 日誌。
- hazardStrip 的兩支影片是否正在直播沒有驗證。
- 本機食品指數的 launchd 是否仍載入沒有用 `launchctl` 確認。
