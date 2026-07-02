# Status

**最後更新**：2026-07-02（全球氣候整包上線 + 颱風軌跡修正/增強 + 分支大整合）
**mini-taiwan-pulse head**：`master` 乾淨、與 origin/master 同步（3 乾淨 PR 併入：#42 climate / #43 bloom / #44 police）
**data-collectors head**：`main`，4 PR 已 merge（#24 依賴 / #25 CMEMS 爆量 / #26 bake collector / #27 CMEMS bbox）
**gis-platform head**：無變動

## 本 session 完成（2026-07-02）

用戶定向：盤點全球氣候搜集與顯示 → 對標 Windy/nullschool → 一路做到資料活水、視覺、效能、颱風，最後整理分支。

### A. 全球氣候資料活水（data-collectors，4 PR）
- 盤點發現：env `_ENABLED` 都設了但 GFS/CMEMS/CAMS 沒資料 → **requirements 缺 xarray/cfgrib/cdsapi/copernicusmarine + Dockerfile 缺 libeccodes0**（PR #24）
- CMEMS subset 沒帶時間範圍 → 擴域後單檔 18.7GB 爆量、container 重啟循環（PR #25 修，刪 S3 ~70GB 廢檔）
- `climate_bake` collector（第 7，每 6h）：讀 f000 實況 → 烤 PNG → deploy-assets（PR #26，順修「風場其實是 +5 天預報」）
- CMEMS bbox 擴廣域 90-180E×-15-55N（PR #27）

### B. 前端全球氣候（PR #42，GC-2~7 + 6b/c/d）
- GC-2 遞送：entrypoint 每 6h re-sync climate + PNG ?v=valid_at
- GC-4/5/6：風場速度色階 + 三層圖例 + click UV 讀值 popup + 粒子調校
- GC-6b/c/d 效能：Canvas drape 分色桶批次 / WebGL **instanced rendering** + 快取 mercator（上傳 -87%）/ 移除低 zoom drape（mercator 非 globe）+ zoom 自適應密度

### C. 颱風軌跡（PR #42，TY-1~6）
- TY-1：修 loader 欄位 `center_pressure`→`center_pressure_hpa`（圖層本來全空的元凶）
- TY-4/5/6：現在位置黃圈（活躍颱風，48h 門檻濾舊）/ 跳點斷線修 Mekkhala X（JMA preTyphoon 時間戳碰撞）/ 預測藍虛線 vs 實際紫實線 / 資料源選擇器（全部/JMA/JTWC）/ 同時刻點質心去重
- 確認 Bavi=TC2611/wp0926、TC2610=Ten 是同一實體雙機構

### D. 分支大整合（PB-25）
- 混亂的 `feat/power-plant-glow`（bloom + 派出所 sidebar + memory）拆乾淨
- 3 乾淨 PR 併回 master：**#42 climate / #43 bloom / #44 police wrapup**
- 本地清理：刪除已整合 + stale 分支（energy-v2/aviation-drone/staging 確認 content 已在 master）；只剩 master + 2 worktree 分支（member-auth / drone-fix，未動）

## 待辦（詳 BACKLOG）
- **GC-2b**（P2）：沙塵改烤數值通道供 popup 讀值
- **GC-7 CAMS**（P2）：CAMS bbox 擴域（海流 CMEMS 已擴）
- **GC-8**（P2）：GFS 預報時間序列接 timeStore（Windy 式播放）
- **GC-9**（P2）：PRMSL 等壓線 / 250hPa 噴流 / SST / 波浪 quick wins（collector 已抓、前端零接線）
- **TY-2**（P3）：JMA 強度資料缺（需另接來源）
- **PI-2 / PS-1**（P3，前一 session）：離島 substation 無 isochrone / 綠島座標 bug

## 上一個 session（2026-07-01 → 02 凌晨）
PI-1 派出所 isochrone 區界斷裂 + 山區偏移 2 bugs 修好 + sidebar 分區調位。詳 INCIDENTS 2026-07-01/02 + PLAYBOOKS PB-24。

---

_本 session memory commits_：INCIDENTS / PRINCIPLES / REFLECTIONS / GLOSSARY / DATA_SCOPE / PLAYBOOKS PB-25 / BACKLOG + 本檔
