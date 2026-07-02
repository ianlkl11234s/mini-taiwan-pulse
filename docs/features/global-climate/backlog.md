# Global Climate Backlog（GC 系列）

> 2026-07-02 盤點後建立。Phase 0 = 資料活水；Phase 1 = 視覺/UX；Phase 2 = 覆蓋/時間；Phase 3 = 交互故事。

## Phase 0 — 資料活水

- [x] **GC-1** Zeabur 開啟 GFS/CMEMS/CAMS collector — 環境變數已設 + data-collectors PR #24 補依賴（requirements.txt + Dockerfile eccodes），2026-07-02 merge
- [x] **GC-2** 烤圖排程化：data-collectors 新增 `ClimateBakeCollector`（每 6h，讀 f000 實況場，取代手動 extract_climate_uv.py）→ deploy-assets/climate/。前端遞送：entrypoint 背景迴圈每 6h re-sync climate（`refresh-climate.sh`）+ PNG 帶 `?v=valid_at` 破快取。順帶修「風場是 +5 天預報」→ 改當下實況。(data-collectors PR #26 + mini-taiwan-pulse feat/global-climate-ux)
- [ ] **GC-2b** 沙塵改烤「數值通道」texture（現為預烤色階，數值不可逆 → popup 讀值做不到）
- [x] **GC-3** 文件補齊：本 feature 資料夾 + App.tsx 過時 stub 註解修正 + BACKLOG 條目

## Phase 1 — 視覺 / UX（feat/global-climate-ux）

- [x] **GC-4** 風場改速度色階（藍→青→綠→黃→橘→紅→紫紅，0-30 m/s）+ 風/海流/沙塵三層補圖例（`climateRamps.ts` SSOT，LEGEND_REGISTRY + ratchet baseline 移除）
- [x] **GC-5** click 讀值 popup：`climateFieldSampler.ts` 前端 UV 雙線性取樣 → `ClimateFieldPanel`（風速/風向/流速/流向 + 資料時刻）
- [x] **GC-6** 粒子調校：wind trail 18→22 / alpha 0.62→0.66；ocean trail 16→20 / alpha 0.58→0.62（browser 驗收後可再調）

## Phase 2 — 覆蓋與時間（等 collector 跑穩）

- [x] **GC-7（海流）** CMEMS bbox 擴廣域 90-180E x -15-55N（data-collectors PR #27）；PNG 1081x841 / 597KB。CAMS bbox 擴域仍 open（`cams.py` 東亞 → 更廣）
- [x] **GC-6b 效能** Canvas drape（全球視角）改分色桶批次繪製：stroke 呼叫 O(粒子數)→O(24)、消除每顆粒子字串運算 → 高粒子數不再卡頓。WebGL 高 zoom 路徑仍為逐幀 CPU 積分+上傳（若高 zoom 也卡再優化）
- [ ] **GC-8** GFS 預報時間序列：leadtime 0/24/48/72/96/120hr 烤 6 張 texture 接 timeStore 播放（守動態圖層時間訂閱鐵則）

## Phase 3 — 交互故事

- [ ] **GC-9** Quick wins：PRMSL 等壓線 / 250hPa 噴流 / SST / 波浪（collector 已抓、前端零接線）
- [ ] **GC-10** 颱風作戰室 preset（軌跡 + 風場 + 等壓線 + 雲圖；對應 worldmonitor-taiwan-vision D-1）
- [ ] **GC-11** 海流 × 船舶軌跡疊圖分析
