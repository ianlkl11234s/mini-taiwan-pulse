# 颱風：氣象署風圈＋各國預報 Typhoon CWA wind radii & agency forecasts

> **Slug**：`typhoon-cwa-ncdr`（analytics topic：`typhoon_tracks`；Roadmap 第一批 G02 方向 A＋B）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：#638
> **規格 SSOT**：analytics `docs/topic-research/typhoon_tracks/layer-plan.md`（另有 `_status.md`、`PLAN.md`、`registry-spec.yaml`）；欄位以 gis-platform `migrations/476_typhoon_cwa_wind_radii_agency_forecasts.sql` 為準

## 一句話說明

既有「颱風軌跡」加上交通部中央氣象署（CWA）來源與 7／10 級風圈、70% 機率圈，同一颱風在 JMA／JTWC／CWA 依 `storm_key` 畫成一個、預報只畫最新一版；新增「各國颱風預報」圖層，畫 NCDR 彙整的五家預報路徑。

## 圖層

| 名稱（layer key） | 來源 | 讀取端點 | 出典 |
|---|---|---|---|
| 颱風軌跡（`typhoonTracks`，既有，擴充） | JMA／JTWC／CWA | view `public.typhoon_positions`（14 天窗）；Monitor 卡 `public.typhoons_active` | 気象庁／JTWC／交通部中央氣象署 |
| 各國颱風預報（`typhoonAgencyForecasts`，新） | NCDR multityroute KML（collector 入庫） | view `public.typhoon_agency_forecasts`（14 天窗） | 國家災害防救科技中心（NCDR） |

## 行為

- **來源選單**：全部／JMA／JTWC／CWA（`typhoonSourceIdx` encode `["all","jma","jtwc","cwa"]`，既有 index 不變，舊分享連結不受影響）。
- **同一颱風畫一個**：loader 先算每個 storm×source 的颱風層級鍵（該來源任一列非 null 的 `storm_key`，TD 階段也歸到命名後的鍵），同鍵只把優先序最高的來源標 `primary`。「全部」模式 filter `primary == true`；`storm_key` 為 null 的不硬配、照畫。前端優先序 **CWA＞JMA＞JTWC**：CWA 是唯一帶風圈與機率圈的來源，主軌跡同源才對得上；DB 接近度 RPC 用 JMA＞CWA＞JTWC 是為了跨年代一致（CWA 2026-10 才開始收）。
- **預報只畫最新一版**：每個 storm×source 只留 `max(advisory_number)` 的 forecast 列（修正舊版把各版同一 valid_ts 平均成質心）。
- **風圈**：CWA 觀測點的 `wind_radii` 四象限各畫 90° 弧（缺象限退回 `all`／`gale_radius_km`），7 級黃、10 級紅；半徑 NULL 不畫。與「現在位置」光圈同一個 `[valid_ts, valid_until)` 區間，跟時間軸走；不受 primary 限制。JMA 預報點的 `storm_warning_area` 是暴風警戒域、不是暴風半徑，不畫。
- **70% 機率圈**：最新一版預報點、currentTime 之後的才畫（藍虛線）。
- **彈窗**：加「出典」（交通部中央氣象署／気象庁／JTWC）、風速口徑（CWA／JMA 10 分鐘平均、JTWC 1 分鐘平均）、最大陣風、7／10 級半徑、70% 機率半徑。點風圈也會開同一個彈窗。
- **各國颱風預報**：五家各一色（`src/data/typhoonTypes.ts`），線＋6 點，終點標「機構 發佈時間」（如 `CWA 10/18 02`）；圖例列每家目前顯示那一版的發佈時間。時間軸回放：每版帶 `[valid_from, valid_until)`，`valid_until`＝同家下一版 `issued_at`，最新版撐 36 小時（颱風消散後不永久掛著）。`storm_key` 為 null 的照畫、彈窗寫「未對上颱風」。
- **Monitor 颱風卡**：`pickActiveTyphoon` 聚合鍵改 `storm_key`（null 才退回名稱），保留 500 km 同系統檢查；名稱優先取 CWA 中文名。

## 未做

- `twn100.kml`（台灣外海 100 km 警戒線）轉靜態 GeoJSON：layer-plan 列為建議，本 PR 未做。
- `typhoon_storms` view 前端不查（anon 查詢 57014 timeout，view 內有 correlated subquery）；`typhoons_active.storm_key` 已足夠。

## 檔案

- `src/data/typhoonTracksLoader.ts`、`src/hooks/useTyphoonTracksLayer.ts`（擴充）
- `src/data/typhoonAgencyForecastsLoader.ts`、`src/hooks/useTyphoonAgencyForecastsLayer.ts`（新）
- `src/data/typhoonTypes.ts`（來源出典、風速口徑、五家色票 SSOT）
- 測試：`src/data/__tests__/typhoonCwaNcdr.test.ts`
