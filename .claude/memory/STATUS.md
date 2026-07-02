# Status

**最後更新**：2026-07-02 凌晨（PI-1 完全收尾：區界斷裂 + 山區偏移 2 bugs 修好 + sidebar 分區調位）
**mini-taiwan-pulse head**：`67c869c` on `feat/power-plant-glow`（本 session 7 memory commits，STATUS 是第 8 個）— ⚠️ **不在 master**，session start 時 master head 是 `0eb4137`；bloom 相關 commits 已在此 feat branch
**taipei-gis-analytics head**：`a44f6f3`（pipeline 5 檔新增，**未 push**）
**gis-platform head**：無變動

## 本 session 完成（2026-07-01 晚 → 2026-07-02 凌晨）

**用戶定向**：處理 BACKLOG PI-1（3 修法擇一），做完後補上山區意外 bug，最後 sidebar 分區微調。

### A. PI-1 區界斷裂 — 真根因不是 bbox 截斷（改正 2026-07-01 錯誤診斷）

- **原本推薦修法 A**（bbox +0.15° overlap）→ 用戶 push「這次確定嗎」→ 檢查 `15_run_by_region.sh` 才發現 5 區 bbox 早已有 40km overlap → 前提就錯了
- **真根因**：每區獨立 `compute_overlap_count + dissolve` → `16_merge_regions.py` 只 concat → 同片區疊層多份不同 count fragments → 前端色塊接不上
- **對照測試**：10 顆桃竹 + 10 顆嘉南 station。OLD 8 features / count [(1,2),(2,2),(3,2),(4,2)] vs NEW 4 features / count [(1,1),(2,1),(3,1),(4,1)]
- **修法**：`10_police_isochrone.py` 拆兩段（`--polys-only` raw + `dissolve_polys_to_final` 全域）+ `16_merge_regions.py` concat 5 區 raw → dedup by entity_id → 全域 dissolve
- **全台跑**（walk + drive）Stage 1 ~90 min → Stage 2/3/4 ~15 min

### B. 山區 station polygon 偏移 — 用戶 push 才找到的第 2 bug

- 用戶截圖榮興/泰崗看不到 polygon → 我第一次說「山區半徑天然小」→ 用戶 push「請你再好好的確認一下」
- 診斷：榮興 polygon centroid 偏移 station 5306m > drive 5min radius 2739m，polygon 跑到隔壁山谷
- **真根因**：`taiwan-drive.osm.pbf` osmium 過濾掉 residential/service/track → 深山派出所附近沒 drive 節點 → `ox.nearest_nodes()` 找 3-5 km 外的節點 → ego_graph 從錯位置展開
- **修法**：`station_polygon()` 加 500m 閾值 + fallback 圓 buffer at **station 座標**（非 node 座標）
- **drive-only 補跑**（7 min，drive PBF 小）→ 掃全台「polygon 不含 station」raw features 從 100+ → 23（<1.5%）

### C. Sidebar 分區調位

`layerCatalog.ts`：「警察覆蓋分析」從獨立大類（POLICE COVERAGE）降級成「執法治安 LAW & ORDER」下的第 2 個子群（緊接「警政」後）。大類計數 0/17 → 0/20。

### D. 部署

- 3 個 combined PMTiles 上 S3：`s3://migu-gis-data-collector/deploy-assets/police_justice/isochrone/`（substation 11MB / precinct 2.7MB / police_dept 1.1MB）
- Dev server 硬連結 `mini-taiwan-pulse/public/police_justice/isochrone/` 同步

## 產物

**taipei-gis-analytics `a44f6f3`（未 push）**：`pipelines/police_justice/isochrone/` 5 檔（10 主 / 15 分區 sh / 16 全域 dissolve / 20 combined / 25 tippecanoe）。詳 PLAYBOOKS PB-24。

**mini-taiwan-pulse 本 session**：
- 7 memory commits（見 REFLECTIONS 表）
- 1 未 commit：`src/components/sidebar/layerCatalog.ts` sidebar 調位
- 副產物：`public/geo/station_points.geojson` 有 M 標，可能 dev server 副作用（獨立於本 session 工作）

## 待辦

- **PI-2**（P3）：離島 60 顆 substation 無 isochrone（澎湖 27 / 金門 6 / 馬祖 3 / 綠島 1 / 恆春 2 / 本島邊界 3）
- **PS-1**（P3）：police_stations upstream geocode bug（綠島分駐所座標 26.22 位於馬祖）
- **Push 決策**：本 session 都在 `feat/power-plant-glow` branch 上；taipei-gis-analytics `a44f6f3` 也未 push。需用戶決定：
  1. `feat/power-plant-glow` 是否含 bloom + memory + sidebar 三批不同 scope commits，要不要拆
  2. taipei-gis-analytics 何時 push（有本地 3 天工作 + memory + pipeline）

## 上一個 session（2026-06-29 ~ 07-01）

見前一版 STATUS 已 memory commit `cac1a66`：警政司法 17 layer + 警察 isochrone × overlap_count 全台 5 區跑完 → dissolve by count + PI-1 記待辦。

---

_本 session 8 memory commits_：`d6582a9 d52724b f6901c4 c06351b 670f02c b3c3fdd 67c869c` + 本檔
