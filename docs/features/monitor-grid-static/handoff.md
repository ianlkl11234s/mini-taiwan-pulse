# Handoff — 監看模式靜態 12 欄網格（下游視角）

> **無上游 handoff。** 本次是純前端版面重構：沒有新資料源、沒有新 RPC、
> 沒有欄位或產物路徑變動，因此 `taipei-gis-analytics/docs/handoff/` 不需要開對應檔。

## 資料契約

不變。所有 widget 沿用重構前既有的 loader / RPC / 輪詢頻率，一行未動：

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

## 前端接線位置

- 佈局 SSOT：`src/components/intel/monitor/monitorLayout.ts`
- 網格容器 + widget id → 節點對照：`src/components/intel/monitor/MonitorPanel.tsx`

## 上游改動 → 下游要跟改的觸發點

無。上游若之後真的動到上表任一 RPC，觸發點在對應的 loader，與本次網格改造無關。

## 已知不對稱

- 未合併分支 `feat/monitor-grid-layout` 走的是 react-grid-layout + widget registry
  的「可配置畫布」路線；本次刻意選了靜態網格。兩者共用 `46218e5` 抽出的 widget 元件，
  若日後要接回 registry 路線，`monitorLayout.ts` 的座標格式已相容其 `layout` 陣列。
