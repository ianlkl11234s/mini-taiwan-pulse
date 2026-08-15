# Global Climate Changelog

## 2026-08-14 — fix/global-layers-timeline（五圖層時間軸修復）

三個獨立根因，一次收掉。上游 data-collectors PR #48 同批。

**颱風軌跡（TY-3）**：loader `ascending:true` + `limit(5000)` 在表長到 23,541 筆後，
升冪取前 5000 = 取最舊那批 → 窗凍結在 06-14~07-06，畫面永遠是 7 月的 Bavi/Maysak。
改近 14 天下界 + `now+7d` 上界（擋 8/31 JTWC 壞列）；`ACTIVE_WINDOW_SEC` 基準從
「資料內最大觀測時間」改成每點帶 `[valid_ts, valid_until)` 區間，t=now 自動退化成牆鐘。
接 timeStore 只 `setFilter` 不 `setData`。新增 `dataTick`（map 先就緒、資料後到是常態路徑）。

**全球地震（新增 select）**：原本註解自陳「不接 timeline filter」，裸 `limit(2000)` 只露 11.6 天
（DB 有 46 天，丟掉 76%）。改日期窗查詢（錨點是 timeline 選定日非掛鐘 now）+ `keyedThunkCache`；
照抄 `useEarthquakeLayer` 的 post/pre/ripple 三窗 + RAF 擴散圈（data-driven expression，
一次 `setPaintProperty` 服務全部震央）。新增「回溯」select：僅當日/3/7/14(預設)/30 天。
修 `setData` 被 `isStyleLoaded()` 擋掉且無重試（切大天數時約一半地震靜默消失）→ 150ms 有界重試。

**幀選取容差（GC-8 相關）**：`pickNearestFrame` 原本無距離上限，本機幀停在 7/24 時
時間軸拉到 8 月任何一天都 clamp 到同一張 —— 這是「換日期不會變」的直接成因。
加 `FRAME_PICK_TOLERANCE_MS = 18h`（daily 幀最壞合法距離 12h + 50% 緩衝），超窗回 `null`
並清 `climateFrameStore` + 重置 `currentKey`。沙塵接 timeStore 換幀（三態 fallback：
無 frames 維持單張常駐，絕不隱藏）。

**上游同批（PR #48）**：`global_climate_grids` 三支源改 `do_update` —— 唯一鍵
`(dataset_id, observed_at)` 配 `DO NOTHING` 讓舊 cycle 的 f120 佔位、新 cycle 的 f000
被靜默拒絕（近 14 天 lt=0 零筆），GC-2 修過的「預報冒充實況」因此回歸。
另 USGS feed 改 `all_day`（修 8 個 1.1~1.32h 漏抓空洞）、沙塵烤固定 sqrt 色階 + 時間序列幀。

驗證：`tsc -b` exit 0、`npm test` 43 files / 594 tests 全綠、browser 四圖層端到端過
（Nangka 光圈位置正確、地震 ripple 半徑 18.3→49.8→65.9、風場換日期實抓對應幀、沙塵 fallback 完好）。

⚠️ 未做：歷史回填（`data-collectors/scripts/backfill_climate_f000.py` 已入庫，dry-run 過，
41 筆待 upsert，user 決定先不執行）→ 過去 14 天窗口需等 collector 逐日累積。

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
