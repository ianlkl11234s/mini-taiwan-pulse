# 噪音／聲響六圖層

> **Slug**：`noise-layers`
> **狀態**：dev（本機接線；未 commit、未 push、未 deploy）
> **Owner**：mini-taiwan-pulse
> **上線日期**：待 release
> **相關 PR**：尚未建立

## 一句話說明

以六個獨立圖層呈現官方聲音樣本、公民科學格網、法定管制區／航空里別、噪音裁處與聲音照相清單，保留各資料的測量、法律及定位語意，**不合成單一噪音分數**。

## 圖層

| layer key | 類型 | 發布資產 | baseline | 預設 |
|---|---|---|---:|---|
| `officialNoiseMonitoring` | point GeoJSON | `public/environment/official_noise_monitoring.geojson` | 426 features／320 站；415 可畫 | off |
| `noiseCaptureGrid` | polygon PMTiles | `public/environment/noise_capture_grid.pmtiles` | 1 km／500 m／250 m = 1／1／3 格 | off |
| `noiseControlZones` | polygon PMTiles | `public/environment/noise_control_zones.pmtiles` | 臺中 4 類 polygon | off |
| `aviationNoiseZones` | polygon GeoJSON | `public/environment/aviation_noise_zones.geojson` | 桃園／高雄 76 村里 | off |
| `noiseEnforcementEvents` | point PMTiles | 重用 `public/geo/pollution_penalties.pmtiles` | noise subset 29,661 事件 | off |
| `soundCameraLocations` | point GeoJSON | `public/environment/sound_camera_locations.geojson` | 333 清單；267 可畫、66 pending | off |

`noiseCaptureGrid` 只有一個 toggle 與一個 PMTiles source，依 zoom 互斥顯示 1,000 m、500 m、250 m 三種 source-layer。`noiseEnforcementEvents` 不建立第二份 noise 專屬資產。

## 使用者必須看見的限制

- 官方測站的 dB 是各地方來源「最近實際觀測日往前 29 天」內實際回報樣本的聲能平均，不是完整連續月均值或法規達標率；`day`／`evening`／`night` 單選，預設 `day`，且保留 `unavailable` 測站。
- NoiseCapture 是高度稀疏的 provisional 公民科學觀測；留白不代表安靜或 0 dB，品質門檻不可因格數少而放寬。
- 一般噪音管制區 v1 只有臺中；類別不是實測聲音大小。
- 航空噪音區是法定村里 membership join，不是 DNL 實測等噪音線；v1 只有桃園、高雄。
- 裁處點表示官方裁處事件，不是 dB 觀測。
- 聲音照相清單不代表即時啟用狀態；66 筆 pending 不以行政區中心補位。

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- 參數規格：`src/data/layerParamsSpec.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/noisePanels.tsx`、`src/components/featureInfo/registry.tsx`
- 契約測試：`src/data/__tests__/noiseLayersContract.test.ts`

## 資料契約與工作紀錄

- [下游 handoff](./handoff.md)
- [Backlog](./backlog.md)
- [Changelog](./changelog.md)
- [上游 SSOT](../../../../taipei-gis-analytics/docs/handoff/noise-layers.md)
- [開發規則](../../development-rules.md)
