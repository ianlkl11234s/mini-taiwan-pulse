# 全球氣候 Global Climate

> **Slug**：`global-climate`
> **狀態**：dev（前端 5 層已上 master；模式場資料活水 2026-07-02 起接通）
> **Owner**：migu
> **上線日期**：2026-06-29（首版粒子渲染進 master）
> **相關 PR**：data-collectors #24（雲端依賴修正）、mini-taiwan-pulse feat/global-climate-ux

## 一句話說明

對標 Windy / earth.nullschool 的全球氣候可視化：風場/海流粒子動畫、沙塵 raster、
全球地震與颱風軌跡，並支援 click 地圖讀值（風速/風向/流速/流向）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `windField` | 粒子動畫（WebGL2 線 + canvas drape 雙層） | `public/climate/wind10m_latest.png`（NOAA GFS 0.25° 全球） | ✅ |
| `oceanCurrents` | 粒子動畫（同引擎 + ocean mask） | `public/climate/currents_latest.png`（CMEMS 1/12° 西太平洋 100-160°E × 0-45°N） | ✅ |
| `dustForecast` | raster overlay | `public/climate/dust_latest.png`（CAMS duaod550 東亞，預烤棕色階） | ✅ |
| `earthquakesGlobal` | circle | Supabase `earthquakes_global`（USGS hourly） | ✅ |
| `typhoonTracks` | line + point | Supabase `typhoon_positions`（JMA + JTWC） | ✅ |

## 關鍵檔案

- 粒子引擎：`src/map/climateParticleLineLayer.ts`（高 zoom WebGL2 線）+ `src/hooks/useClimateCanvasParticleLayer.ts`（低 zoom globe drape）
- 色階 SSOT：`src/map/climateRamps.ts`（App 渲染與 LegendPanel 圖例共用）
- Click 讀值：`src/data/climateFieldSampler.ts`（UV texture 前端雙線性取樣）→ `useMapInteraction.ts` fallback → `ClimateFieldPanel`
- Panels：`src/components/featureInfo/globalClimatePanels.tsx`
- 烤圖腳本：`scripts/preprocess/extract_climate_uv.py`（S3 原檔 → UV PNG + meta JSON）
- 上游 collectors：`data-collectors/collectors/global_climate/`（6 支，plan-misty-fog 2026-06-28）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游規劃 SSOT：`taipei-gis-analytics/docs/systems/global_climate_tic.md`
+ `taipei-gis-analytics/docs/data-catalog/global_climate/`。

## UX 四鐵則

| 鐵則 | windField | oceanCurrents | dustForecast | earthquakesGlobal | typhoonTracks |
|---|---|---|---|---|---|
| 透明度 slider | ✅ | ✅ | ✅ | ✅ | ✅ |
| 圖例 | ✅（速度色階） | ✅（流速色階） | ✅（AOD 相對色階） | ✅ | ✅ |
| click popup | ✅（UV 取樣讀值） | ✅（UV 取樣讀值） | —（預烤 raster 數值不可逆，見 backlog GC-2b） | ✅ | ✅ |
| dropdown | 不適用 | 不適用 | 不適用 | 不適用 | 不適用 |

## 已知限制

- 三個模式場皆為單張 `_latest` 快照，尚無預報時間序列（GC-8）
- 海流僅西太平洋、沙塵僅東亞（GC-7 擴域）
- 前端 PNG 由 `extract_climate_uv.py` 手動烤，尚未排程化（GC-2）
- 沙塵 popup 讀值做不到：PNG 為預烤色階，需改烤數值通道（GC-2b）
