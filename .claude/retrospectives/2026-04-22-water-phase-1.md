# 2026-04-22 — 水資源 Phase 1（水庫互動 + 3D 水位計）

## TL;DR
完成水庫「點開看到一切」整鏈路（後端 RPC → 前端 context 疊層 → 集水區河網 → 3D 水位計）。最大教訓：Three.js / Mapbox custom layer 這種**視覺層代碼 `tsc -b` 通過 ≠ 能動**，而 `map.once('load', attach)` 在 load event 已觸發後**永不執行**這個經典坑吃掉了大半 debug 時間。

## 範圍
- **Branch**：`feat/water-resources`
- **涉及專案**：mini-taiwan-pulse（前端）+ gis-platform（migration 053）
- **完成 commit**：`24c022c`、`06bfba5` (mini-taiwan-pulse)，`168a3d8` (gis-platform)
- **相關檔案**：
  - 後端：`migrations/053_reservoir_watershed_rivers_rpc.sql`、`scripts/export/export-water-static.sh`
  - 前端 loader：`src/data/reservoirContextLoader.ts`、`reservoirStatusLoader.ts`
  - 前端 hook：`src/hooks/useReservoirContextLayer.ts`、`useReservoirStatusLayer.ts`、`useMapInteraction.ts`
  - Three.js：`src/three/ReservoirScene.ts`、`src/map/reservoirCustomLayer.ts`
  - 整合：`src/App.tsx`、`src/components/FeatureInfoPanel.tsx`、`src/map/overlayRegistry.ts`
  - 文件：`docs/water-resources-status.md`

## 成果
- [x] `scripts/export/export-water-static.sh` 讓 water_dams/water_reservoirs.geojson 帶 `compare_id`
- [x] 點擊水庫 → 動態疊層（集水區 polygon + 集水區內河網）
- [x] panel 擴充：蓄水率大字 + 警示燈號 + 淤積率 + 空間關聯 + 基本屬性
- [x] migration 053：`get_reservoir_watershed_rivers` 用 ST_Intersection 繞過 river_lines 的 2,445 km outlier
- [x] Three.js 3D 水位計（雙 InstancedMesh：空殼 + 內水），容量編碼基座半徑、蓄水率編碼水高、警示色
- [x] 砍舊圖層（光球 + 靜態 pillar），保留蓄水範圍 poly + 壩體節點
- [x] 刪掉壞掉的 water_reservoir_pillars.geojson（檔頭 SET\n bug）

## 做得好（持續）

- ✓ **分階段規劃 Phase 1a / 1b / 1c 並每段都跑 tsc -b**：
  避免一次改 20 檔才發現編譯壞掉。每段驗證 → 下一段。

- ✓ **動手前先調查上游資料結構**：
  Phase 1b 前先查 `public.river_lines` 發現 max_length = 2,445 km 的 outlier
  MultiLineString。如果沒查就照原本 KNN 邏輯寫，部署後才會發現「全台都亮」bug。

- ✓ **status doc 作為工作 checkpoint**：
  `docs/water-resources-status.md` 讓中斷 session 回來能 5 分鐘接上。
  這機制這次 session 有實際發揮作用。

- ✓ **遇到卡點就停下來問使用者選路**：
  Phase 1a 遇到 geojson 沒有 compare_id 時，列 A/B 方案讓使用者選，
  而不是自己選一個走下去後才發現走錯路。

- ✓ **一開始用 ST_Intersection 順序錯（slow 10-30s）時立即優化**：
  把 Simplify 從 intersect 前移到 intersect 後，實測 10-20x 提速。
  沒有放著「能動就好」。

## 需要改善

### P0 — 下次必改

- ❌ **Mapbox custom layer 的 `map.once('load', attach)` 陷阱**
  - **症狀**：使用者 toggle 水庫 on，console log 顯示 scene 建好、RPC 37 筆回來、
    rebuild 跑完，但**沒有** `[ReservoirLayer] onAdd` log，畫面上沒有 cylinder。
  - **根因**：我寫 `if (map.isStyleLoaded()) attach(); else map.once('load', attach)`。
    當 hook useEffect 跑時，style 可能剛好在某個短暫的 `isStyleLoaded() = false` 狀態
    （imagery 正在更新、source 在 swap），但 `load` event **早就 fire 過了**，
    `map.once('load', ...)` 不會被二次觸發 → attach 永不執行。
  - **改善方向**：custom layer 掛載一律用 **polling 重試模式**，不要依賴 `once('load')`：
    ```ts
    const tryAttach = () => {
      if (map.isStyleLoaded()) attach();
      else setTimeout(tryAttach, 200);
    };
    ```
    或用 `map.on('styledata', ...)` 每次 style 更新檢查。
  - **Lessons 對應**：已升級到 `.claude/lessons.md` P0.1，
    並寫成 pitfalls `.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`

- ❌ **視覺層代碼沒預先加 diagnostic log，debug 時才補**
  - **症狀**：使用者截圖「cylinder 看不到」→ 我才開始加 log → 再 hard reload → 找到 bug。
    這個循環花了至少 2 輪截圖 + 修改（~30 min）。
  - **根因**：`tsc -b` 通過後我就宣布完成了，沒有思考「tsc 管編譯正確性，不管 runtime
    是否真的畫出來」。Mapbox custom layer + Three.js scene 從 mount → attach → render
    是**多層非同步 gate**，任何一層壞掉都只會表現為「什麼都沒發生」。
  - **改善方向**：寫 WebGL / Three.js / Mapbox custom layer 時，**預設在關鍵 checkpoint
    加 `console.log`**，不要等 debug 才補。checkpoint 至少包含：
    - hook mount effect（+ visible / map ready 狀態）
    - RPC 返回（+ 筆數 / 第一筆 sample）
    - scene.setStatuses（+ input count）
    - scene.rebuild（+ output mesh count + 第一個 instance 的 position/scale）
    - custom layer onAdd
    - custom layer render 第 1/60/120 次
    功能驗證後再決定要不要拔（建議保留，頻率低不吵）。
  - **Lessons 對應**：已升級到 `.claude/lessons.md` P0.2

### P1 — 應該改

- ⚠ **一次改 8+ 檔才跑 tsc 和瀏覽器實測**：Phase 1c 把 loader / scene / custom
  layer / hook / interaction / overlayRegistry / App.tsx 一次寫完才驗證。
  修完 tsc 以為沒事，結果 runtime 不動。建議：每 3-4 檔做一次 smoke test
  （可以是 tsc + 簡單 console.log 驗 hook 被呼叫）。

- ⚠ **複雜 layer 動手前沒完整複製既有 pattern**：StationPillarScene +
  stationPillarCustomLayer 已經是 template，但我只看了 render / pick 部分就動手，
  沒有看 `onAdd` 時機跟 map ready 狀態的關係。既有 pattern 其實也沒做 polling
  （他們一樣用 once('load')），但因為他們跟著 `addAllLayers` 在 handleMapReady
  時 attach，style 保證 ready，不會踩我這個坑。我是獨立 hook 所以踩到。
  **下次做新 Three.js layer**，先問自己：是否該塞進 `useThreeJsLayers` 的
  `addAllLayers` 統一管理，還是獨立？獨立就要處理自己的 attach 時機。

- ⚠ **UI slider 被孤兒**：`球透明度 / 光暈 / 大小 / 3D 高度` 這幾條 slider 原本
  drive ② 光球 + ③ 靜態 pillar 的 paint。我砍了那兩個圖層，但 slider 繼續存在
  於 LayerSidebar 且一半失效（只有「3D 高度」實際 drive 新 Three.js scene）。
  下次砍圖層時 checklist：grep 圖層相關 paint expression → 檢查是否被某 slider
  的 overlayParams key 參照 → 決定 slider 去留。

### P2 — 可以改

- slider「球透明度 / 光暈 / 大小」已無效，應該從 `useTransportParams.ts`
  的 reservoir controls 拔掉。（留到下次 session 清）
- `[ReservoirLayer] render #N` 每 60 frame 印一次，可能過於吵雜。可以改用
  `DEBUG_RESERVOIR` env flag 控制。

## Action Items

- [x] 升級 P0.1 (mapbox load once) 到 `.claude/lessons.md`
- [x] 升級 P0.2 (視覺層預先加 log) 到 `.claude/lessons.md`
- [x] 寫 pitfall：`.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md`
- [ ] 下次 session 清 P2：拔掉失效 slider、考慮 DEBUG flag 控制 log
- [ ] 下次繼續做 Phase 2（雨量 / 河川水位 RPC + 前端，見 `docs/water-resources-status.md`）
- [ ] 水庫 `water_reservoirs.geojson` polygon 現在 toggle 開啟全台亮的視覺問題還沒解（使用者 2026-04-22 觀察）— 考慮 dim 非 active 水庫

## 下次 session 開頭該做的事

1. 讀 `.claude/lessons.md`（P0 規則，2 條）
2. 讀 `.claude/retrospectives/INDEX.md` 看最近 3 份 retro
3. 讀 `docs/water-resources-status.md` 看 Phase 進度
4. 若繼續水資源，下一步在 `Phase 2 — 雨量 + 河川水位 RPC`
