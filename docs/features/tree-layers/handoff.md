# Handoff — tree-layers（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/tree-layers.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：`taipei-gis-analytics/data/processed/urban_open_space/*`（6 個 dataset）+ `forestry/canopy_height_meta/`；前端快照在 `public/urban/` 與 `public/forestry/`
- 更新頻率：半動態（樹籍調查資料，資料更新時手動重出）
- 座標系統：WGS84（已驗證全部）
- 資料量：6,544 / 10,917 / 2,917 / 105,675 / 210,436 / 56,720 筆 + raster 850 tiles

（完整契約 → 上游 handoff）

## 前端接線位置

- 色票/選項 SSOT：`src/data/urbanOpenSpaceTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（7 層皆走 registry，無獨立 loader/hook）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS）
- Popup：`src/components/featureInfo/urbanPanels.tsx` + `registry.tsx`
- 上游來源註記：`src/data/upstreamRegistry.ts`（7 筆，目前 `catalog_missing`，待上游補 data-catalog）

## 硬依賴欄位（改一定爆）

- `street_trees_national`：`city`（taipei/taichung 篩選+染色）、`species`、`dbh_cm`、`height_m`
- `street_trees_taipei_3epoch`：`traj`（7 值字串，軌跡染色+篩選）、`status_2224`/`status_2426`（popup，含 `absent` 第 4 值）
- `protected_trees_national`：`estimated_age_years`（染色，可 null）、`dbh_m`（半徑）、`city`（8 城篩選，注意是「嘉義縣」非嘉義市）
- `riverside_trees_taipei`：`species`（top-10 染色）、`park_name`（30 座篩選）
- `tree_pits_taipei`：`pit_type`（值恰為「樹穴」「花圃」二字串，染色+篩選）
- `parks`：`category`（7 類染色）、`area_sqm`（半徑對數縮放）
- PMTiles `source-layer` 名 = tippecanoe `-l`：`street_trees_national` / `street_trees_taipei_3epoch` / `tree_pits_taipei`

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 重出 PMTiles 改 zoom 範圍 | overlayRegistry pmtiles minzoom/maxzoom 同步 |
| 樹種 top-10 排名變動 | `urbanOpenSpaceTypes.ts` 樹種色票重排 |
| 新增城市（protected/national） | 篩選 select options + 城市色票補 |
| canopy 重出 512px tile | 無需改（mapbox-pmtiles 自動讀 header） |
| 上游剔除 lat/lon 冗餘欄瘦身 | 無需改（前端未依賴） |

## 已知不對稱

- 全國行道樹 PMTiles z5-11 有 1MB/磚抽稀（上游 decision-log 門檻），與台北 diff 層「全 zoom 全點」策略不同；z13+ 才是全量
- canopy PMTiles header center 是壞值（-93,23），前端不得依賴（bounds 正確）
- mapbox-pmtiles 內部 tileSize 寫死 512，canopy 實際 256px tile，顯示解析度略軟一檔
- 上游 data-catalog 尚未建這 7 個 dataset 的條目（upstreamRegistry 標 `catalog_missing`）
