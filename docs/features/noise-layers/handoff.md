# Handoff — 噪音／聲響六圖層（下游視角）

> **上游 SSOT**：[`taipei-gis-analytics/docs/handoff/noise-layers.md`](../../../../taipei-gis-analytics/docs/handoff/noise-layers.md)
>
> 本檔只記前端接線與 release truth；完整欄位、來源 lineage、更新 SOP 與資料 QA 以上游 handoff 為準。

## 上游產物與前端來源

| layer key | 前端資產 | MapLibre contract | baseline |
|---|---|---|---:|
| `officialNoiseMonitoring` | `public/environment/official_noise_monitoring.geojson` | GeoJSON；不可帶 `source-layer`；z7–18 | 426 features／320 站；415 geometry |
| `noiseCaptureGrid` | `public/environment/noise_capture_grid.pmtiles` | 單一 source；`noise_capture_1000m` z7–10、`noise_capture_500m` z11–12、`noise_capture_250m` z13–15 | 1／1／3 格，5/5 provisional |
| `noiseControlZones` | `public/environment/noise_control_zones.pmtiles` | `source-layer=noise_control_zones`；archive z6–15 | 臺中 4 polygon |
| `aviationNoiseZones` | `public/environment/aviation_noise_zones.geojson` | GeoJSON；不可帶 `source-layer`；z6–15 | 桃園／高雄 76 polygon |
| `noiseEnforcementEvents` | `public/geo/pollution_penalties.pmtiles` | **既有** source；`source-layer=pollution_penalties`；filter `event_medium=noise` | 29,661 events |
| `soundCameraLocations` | `public/environment/sound_camera_locations.geojson` | GeoJSON；不可帶 `source-layer`；filter `is_renderable=true`；z9–18 | 333 清單；267 geometry、66 null |

座標系統為 WGS84。五個新 dataset 的 SSOT 留在上游 processed path；Pulse `public/` 是發布副本。`sound_camera_locations_pending.csv` 不是前端資產。

## 前端接線位置

- Manifest／sidebar 派生：`src/data/layerManifest.ts`
- 參數：`src/data/layerParamsSpec.ts`
- Source／style layers：`src/map/overlayRegistry.ts`
- Sidebar：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup／點擊：`src/components/featureInfo/noisePanels.tsx`、`src/components/featureInfo/registry.tsx`、`src/map/gisClickRegistry.ts`
- Static／PMTiles／registry contract：`src/data/__tests__/noiseLayersContract.test.ts`

六層皆為 registry-driven 靜態 overlay，不新增 loader、Supabase migration 或 collector。NoiseCapture 是一個 layer key／toggle，不因三個 style layer 變成三個使用者圖層。

## 前端硬依賴摘要

- 官方測站：`station_id`、`period_type`、`laeq_window_db`、`window_start`／`window_end`、`sample_count`、`active_days`／`window_days`／`active_day_ratio`、`freshness_status`、`source_dataset_id`、`spatial_precision`。
- NoiseCapture：`scale_m`、`laeq_energy_db`、`measure_seconds`、`track_count`、`active_days`、量測日期範圍、`freshness_class`、`quality_tier`、`is_provisional`。
- 管制區：`zone_class`、`legal_version`、`effective_year_roc`、`announcement_no`、`spatial_precision`、`geometry_repaired`、來源欄位。
- 航空里別：`zone_levels`、`display_zone_level`、`legal_unit`、`effective_date`、`spatial_precision`、`is_measured_contour`、來源欄位。
- 裁處事件：`event_medium`、裁處日期／對象／事實／法條／罰鍰、`severity_event`、`geocode_precision`；noise filter 不得移除。
- 聲音照相：原始地址／路段、`spatial_precision`、`spatial_validation_status`、`is_renderable`、`equipment_status`、來源欄位。

## 空值、時間與語意

- 官方 11 筆 null geometry 不渲染但保留總數；`unavailable`／null dB 顯示「無已驗資料」，不顯示 0。`period_type` 單選預設 `day`，filter 必須同時保留 unavailable。
- 官方值是最近可用 30 日窗內**實際回報樣本**的聲能平均；popup 顯示 sample/window/coverage/freshness，legend 不稱完整月均或達標判定。
- NoiseCapture 目前僅 5 格且全部 provisional；固定 attribution 為 `NoiseCapture / Noise-Planet contributors`，授權 ODbL-1.0／DbCL-1.0，留白不解讀成安靜或 0 dB。
- `noiseControlZones` v1 只有臺中；`geometry_repaired=true` 只表示 topology repair，不是推估法定邊界。
- `aviationNoiseZones` 是公告村里 membership join；`effective_date=null` 顯示「來源未明載」，不補日期；不是 DNL contour 或村里內均一聲級。
- `noiseEnforcementEvents` 是裁處，不是 dB 觀測；legend 只解釋事件／罰鍰。
- Camera 的 road-segment／fuzzy 仍須顯示定位精度；66 pending 保留在來源說明但不畫、不補 centroid，清單也不代表即時運作。

## 上游變動時的下游觸發點

| 上游改動 | 下游動作 |
|---|---|
| 五個 snapshot／公告資產更新 | 整檔替換對應 public 副本，對帳 count、SHA、PMTiles metadata、contract tests 與 browser |
| NoiseCapture source-layer 或 zoom gate 改名 | 先同步 handoff，再更新 manifest/overlay；保持三尺度互斥與單一 toggle/source |
| 官方 period／freshness 欄位或值域改變 | 同步 period filter、default、legend、popup null fallback 與 contract baseline |
| 新縣市加入管制區／航空區／camera | 更新 coverage 文案、分類 domain、feature bounds browser case；不可用假 geometry 補覆蓋 |
| pollution penalties snapshot 更新 | 沿用既有污染月度發布流程；對帳 `event_medium=noise`，不可新增 noise 專屬 PMTiles |

## Release truth（2026-08-28）

| gate | current truth |
|---|---|
| 上游 processed assets／QA | complete；以上游 handoff 2026-08-27 baseline 為準 |
| Pulse 五個新發布副本 | copied in isolated worktree；三個 GeoJSON 已 commit，兩個 PMTiles 依既有忽略／資產發布流程管理；尚未 push／deploy |
| frontend contract wiring | complete in isolated worktree；六層 registry／source／style／sidebar／legend／popup／filter 已接線 |
| unit／tsc | pass；focused 52 tests，full 748 passed／1 skipped（66 files），`npx tsc -b` pass |
| asset readback | local counts／SHA 對帳與三個 PMTiles `verify` pass；localhost HTTP readback pass |
| localhost browser acceptance | complete at `127.0.0.1:3722`；3721 為另一 worktree，未干擾 |
| commit | complete；local feature commit 已建立 |
| PR／push | not run；未獲授權 |
| deploy／production readback／browser | not run；未獲授權 |

localhost 驗收必須從 All Off 逐層開啟、移到實際資料 bounds，至少覆蓋：嘉義 fresh 官方站與 historical／unavailable 對照、NoiseCapture z10/z11/z13 尺度交棒、臺中四類、桃園／高雄航空里別、臺南／彰化 camera precision；同時檢查 legend、popup、filter 與 console。

本次 localhost 證據已覆蓋：嘉義 fresh、苗栗 historical、臺北 unavailable；高雄 NoiseCapture z10／z11／z13 的 1000／500／250 m 互斥交棒；臺中第三類管制區；桃園航空里別；彰化 road-segment 與臺南 fuzzy camera；臺北噪音裁處事件。六層均由 All Off 後實際切換，並檢查 legend、popup、period／precision filter；browser console error／warn 為 0。
