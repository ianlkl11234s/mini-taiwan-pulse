# Global Climate Changelog

## 2026-07-02 — feat/global-climate-ux（GC-3/4/5/6）

- 風場改速度色階（`climateRamps.ts` 色階 SSOT，App 渲染與圖例共用）
- 風/海流/沙塵補圖例（LEGEND_REGISTRY + layerConsistency ratchet baseline 移除）
- click 讀值 popup（`climateFieldSampler.ts` UV 取樣 → `ClimateFieldPanel`：風速/風向/流速/流向）
- 粒子調校（wind trail 22 / ocean trail 20）+ App.tsx 過時 stub 註解修正
- feature 資料夾建立（本夾）
- PR #：（待補）squash hash：（待補）

## 2026-07-02 — data-collectors PR #24

- 雲端缺依賴修正（xarray/netCDF4/cfgrib/eccodes/cdsapi/copernicusmarine）→ GFS/CMEMS/CAMS 三支 collector 上 Zeabur 可跑
- CMEMS bbox 台灣 9°×8° → 西太平洋 60°×45°

## 2026-06-29 — 首版（master f5e6776 / a8d28e7）

- hybrid globe drape + WebGL2 粒子線雙層渲染（wind/currents）
- CAMS 沙塵 raster、USGS 全球地震、JMA/JTWC 颱風軌跡
