# Handoff — 監看模式靜態 12 欄網格（下游視角）

> **無上游 handoff。** 版面重構是純前端；十版新增的災害監看四卡也**沒有新資料源、
> 沒有新 RPC、沒有 migration**——全部打既有的 view / RPC / 表，
> 因此 `taipei-gis-analytics/docs/handoff/` 不需要開對應檔。

## 資料契約

widget → 資料來源對照（十版四張災害卡在表末）：

| widget | 資料來源 | 頻率 |
|---|---|---|
| `newsFeed` / `histogram` / `triage` / `hotZones` / `timeline` | `fetchNewsEventsDayClusters`（timeStore 日期訂閱） | 換日重抓 |
| `alertBoard` | `fetchAlertSummary` / `fetchAlertSeries24h` | 60s |
| `situationOverview` | `fetchPressureIndex` / `fetchMarketIndex` / `fetchSourceHealth` / `fetchNewsTrending` | 60s |
| `situationCards` | `fetchPlaActivity` / `fetchPublicHealthWeekly` | 30min / 每週 |
| `powerCard` | `fetchPowerDashboard` / `fetchPowerGeneration24h` | 5min / 10min |
| `prison` | `get_prison_population_window` | 30min |
| `erCongestion` | `fetchErHospitalLatest`（ERCard 內部） | 5min |
| `airportPax` | `fetchAirportHourlyPax`（AirportPaxCard 內部） | 卡片內部 |
| `liveWall` / `hazardStrip` | `fetchLiveVideos` 等（元件內部） | 10min |
| `typhoon` | `fetchTyphoonSummary`（`public.typhoons_active` view） | 30min |
| `earthquake` | `fetchEarthquakeSummary`（`earthquake_events` 最新 20 + 24h count） | 15min |
| `radiation` | `fetchNuclearSummary`（`get_nuclear_radiation_status` 純聚合） | 5min |
| `lightning` | `fetchLightningSummary`（`get_lightning_day`，cwa 主 / taipower 斷供偵測） | 5min |

## 前端接線位置

- 佈局 SSOT：`src/components/intel/monitor/monitorLayout.ts`
- 網格容器 + widget id → 節點對照：`src/components/intel/monitor/MonitorPanel.tsx`

## 上游改動 → 下游要跟改的觸發點

上游若動到上表任一 RPC，觸發點在對應的 loader。目前唯一有待辦的是：

- **台電落雷復供**（BACKLOG DS-01/03）：`get_lightning_day(p_source:'taipower')` 自
  2026-07-10 起端點 200 但永遠回空。復供後落雷卡的「台電源 上游斷供中」會自動變回
  當日筆數（`fallbackCountDay > 0` 即切換），不需要改碼；若要把主來源改回台電，
  改 `lightningLoader.MONITOR_LIGHTNING_SOURCE` 一個常數即可。
- **`public.typhoons_active` 若補上 `valid_at` 上界**：前端的未來日期防線
  （`pickActiveTyphoon` 的 `FUTURE_TOLERANCE_SEC`）可留著當保險，不必移除。

## 已知不對稱

- 未合併分支 `feat/monitor-grid-layout` 走的是 react-grid-layout + widget registry
  的「可配置畫布」路線；本次刻意選了靜態網格。兩者共用 `46218e5` 抽出的 widget 元件，
  若日後要接回 registry 路線，`monitorLayout.ts` 的座標格式已相容其 `layout` 陣列。
