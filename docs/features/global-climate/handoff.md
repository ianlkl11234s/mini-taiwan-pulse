# Global Climate — 跨 repo 資料契約（下游反向引用）

> 上游 SSOT：`taipei-gis-analytics/docs/systems/global_climate_tic.md` +
> `taipei-gis-analytics/docs/data-catalog/global_climate/`（6 dataset .md）。
> ⚠️ 2026-07-02 時上游 `docs/handoff/` 尚無 global-climate 條目，狀態欄仍標 planned — 待同步為 shipped。

## 前端硬依賴

### 1. UV texture 契約（windField / oceanCurrents）

- 路徑：`public/climate/{wind10m,currents}_latest.{png,json}`（扁平檔名契約；S3 `deploy-assets/climate/` 同步）
- PNG RGBA 編碼：**R=u、G=v、B=0、A=valid mask**（≥128 有效）；由 `scripts/preprocess/extract_climate_uv.py` 產出
- meta JSON 必含欄位：`width` `height` `u_min` `u_max` `v_min` `v_max` `bbox`；選用：`dataset` `valid_at`（click popup 顯示資料時刻用）
- bbox 經度跨度 > 300° → 前端視為全球場（經度 wrap）

### 2. 沙塵 raster 契約（dustForecast）

- `public/climate/dust_latest.png`：預烤棕色色階 + alpha mask（色階 stops 見 `extract_climate_uv.py` 與 `src/map/climateRamps.ts` DUST_BAKE_STOPS，兩處需同值）
- meta JSON：`bbox` 定位四角

### 3. Supabase 表（earthquakesGlobal / typhoonTracks）

- `public.earthquakes_global`（view，migration 261）：`event_id, mag, place, observed_at, depth_km, geom`
- `public.typhoon_positions`：`storm_id, source('jma'|'jtwc'), valid_at, point_type('observed'|'forecast'), advisory_number, name_local, name_en, center_lat, center_lon, center_pressure, max_wind_kt`

## 上游 collector 對應

| 前端 layer | collector（data-collectors） | 落點 |
|---|---|---|
| windField | `global_climate_noaa_gfs`（每日） | S3 GRIB2 → 烤圖 |
| oceanCurrents | `global_climate_cmems`（每日） | S3 NetCDF → 烤圖 |
| dustForecast | `global_climate_cams`（每日） | S3 NetCDF → 烤圖 |
| earthquakesGlobal | `global_climate_usgs_earthquake`（每時） | Supabase 直寫 |
| typhoonTracks | `global_climate_jma_typhoon`（3h）+ `global_climate_jtwc`（6h） | Supabase 直寫 |

雲端依賴修正：data-collectors PR #24（xarray/cfgrib/eccodes/cdsapi/copernicusmarine + CMEMS bbox 西太平洋）。
