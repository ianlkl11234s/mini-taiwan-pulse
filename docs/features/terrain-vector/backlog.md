# Backlog — terrain-vector

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號盡量一致（TV-*）。

## 進行中

- （無）

## 待辦

- [ ] **TV-1**：③ migration `gis-platform/migrations/289_h3_terrain.sql` apply 決策 — apply 後匯入 `output/analysis/h3_terrain/h3_terrain_res8.parquet`（56,376 cells）並前端接 RPC `public.get_h3_terrain(target_resolution)`；或維持不上線。待用戶決定值不值得為 H3 地形指標開新表。
- [ ] **TV-2**：解析度精細化評估 — 目前 RES=100m 降採樣平滑化、低估陡度（slope class 1 面積約佔 30% 陸地）。若要更銳利可降 RES（代價 polygon 數暴增、PMTiles 變大），需權衡前端載入。
- [ ] **TV-3**：② `terrain_zonal`（AOI 地形統計）目前僅上游 on-demand 工具，尚無前端入口。若日後要「框一塊地看平均坡度 / 幾成超過 30°」再評估接線。

## 已完成（近期）

- [x] **TV-0a**：坡度 / 坡向向量分級圖層上線 — commit `f648f8d`, 2026-07-11
- [x] **TV-0b**：legend 淺色主題修補 — commit `9a59066`, 2026-07-11
- [x] **TV-0c**：Layers 搜尋欄 + 移除舊 PNG raster 坡度 / 坡向 — commit `5e0554a`, 2026-07-11
- [x] **TV-0d**：切 style 重掛（PMTiles source 於 style 切換後重新掛載）— 已修

## 已放棄 / 延後

- （無）

> 註：TDX 真實時刻表等其他線與本 feature 無關，不列入此 backlog。
