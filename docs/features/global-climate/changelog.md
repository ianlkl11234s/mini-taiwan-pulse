# Global Climate Changelog

## 2026-07-02 — feat/global-climate-ux（GC-3/4/5/6）

- 風場改速度色階（`climateRamps.ts` 色階 SSOT，App 渲染與圖例共用）
- 風/海流/沙塵補圖例（LEGEND_REGISTRY + layerConsistency ratchet baseline 移除）
- click 讀值 popup（`climateFieldSampler.ts` UV 取樣 → `ClimateFieldPanel`：風速/風向/流速/流向）
- 粒子調校（wind trail 22 / ocean trail 20）+ App.tsx 過時 stub 註解修正
- feature 資料夾建立（本夾）
- PR #：（待補）squash hash：（待補）

## 2026-07-02 — GC-2 烤圖排程化 + 遞送

- data-collectors PR #26：`ClimateBakeCollector`（每 6h）自動烤 texture 上 deploy-assets/climate/，取代手動 extract_climate_uv.py；選檔改 f000 實況（修「風場顯示 +5 天預報」）
- 前端遞送（feat/global-climate-ux）：`refresh-climate.sh` + entrypoint 背景迴圈每 6h re-sync climate（免前端重啟）；wind/currents/dust PNG 帶 `?v=valid_at` 破瀏覽器快取
- public/climate/ 同步為最新實況（wind 7/2 00Z / currents 7/4 / dust 7/1）

## 2026-07-02 — data-collectors PR #24

- 雲端缺依賴修正（xarray/netCDF4/cfgrib/eccodes/cdsapi/copernicusmarine）→ GFS/CMEMS/CAMS 三支 collector 上 Zeabur 可跑
- CMEMS bbox 台灣 9°×8° → 西太平洋 60°×45°

## 2026-06-29 — 首版（master f5e6776 / a8d28e7）

- hybrid globe drape + WebGL2 粒子線雙層渲染（wind/currents）
- CAMS 沙塵 raster、USGS 全球地震、JMA/JTWC 颱風軌跡
