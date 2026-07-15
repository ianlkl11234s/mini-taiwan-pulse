# 都市樹木資源圖層（tree-layers）

> **Slug**：`tree-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：shipped（程式已合併；資料檔待 S3 deploy-assets 上傳 TL-1）
> **Owner**：migu
> **上線日期**：2026-07-15
> **相關 PR**：#70

## 一句話說明

把 taipei-gis-analytics 樹木研究（street_tree_removal 專題）產出的 7 個資料集一次接上地圖：全國行道樹、三時點軌跡、受保護樹木、河濱喬木、樹穴面域、樹冠高度 raster、台北公園，補齊既有 streetTreesTaipeiDiff 之外的完整都市樹木圖譜。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 筆數 | 狀態 |
|---|---|---|---|---|
| protectedTreesNational | point | GeoJSON `urban/protected_trees_national.geojson` (3.4MB) | 6,544 | ✅ |
| riversideTreesTaipei | point | GeoJSON `urban/riverside_trees_taipei.geojson` (4.5MB) | 10,917 | ✅ |
| parksTaipei | point | GeoJSON `urban/parks_taipei.geojson` (1.1MB) | 2,917 | ✅ |
| streetTreesTaipei3epoch | point | PMTiles `urban/street_trees_taipei_3epoch.pmtiles` (15MB, z5-14) | 105,675 | ✅ |
| streetTreesNational | point | PMTiles `urban/street_trees_national.pmtiles` (32MB, z5-14) | 210,436 | ✅ |
| treePitsTaipei | polygon | PMTiles `urban/tree_pits_taipei.pmtiles` (3.7MB, z11-16) | 56,720 | ✅ |
| canopyHeight | raster | PMTiles `forestry/canopy_height_taiwan.pmtiles` (93MB, PNG z7-12) | — | ✅ |

前 6 層在側欄「都市開放空間 Urban Open Space」；canopyHeight 在「林業 Forestry · 分區」。全部預設關閉（DEFAULT_ON 僅保留既有 streetTreesTaipeiDiff）。

## 關鍵檔案

- 色票/選項 SSOT：`src/data/urbanOpenSpaceTypes.ts`（本 feature 新增，各層共用）
- Overlay：`src/map/overlayRegistry.ts`（PMTiles/GeoJSON 皆走 registry，無獨立 loader/hook）
- Raster PMTiles 支援：`src/map/overlayManager.ts`（`pmtiles.sourceLayer` 改 optional，raster 自動走 mapbox-pmtiles raster 模式）
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/urbanPanels.tsx` + `registry.tsx`
- 轉檔（上游）：`taipei-gis-analytics/pipelines/urban_open_space/`

## 設計要點

- **跨層視覺可比**：胸徑/樹高分級與顏色照抄 `streetTreeColors.ts` 階梯；樹種共通者沿用同色
- **3epoch traj 7 色**：111 持續 / 110·100 消失系 / 011·001 新增系 / 101·010 波動系
- **全國行道樹低 zoom 抽稀**：z5-11 每磚 cap 1MB（依 street_tree_removal decision-log 門檻），z13+ 全量 21 萬點零損失
- select 一律轉 Idx 數字進 overlayParams（專案鐵則）；篩選用 opacity 歸零法

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/tree-layers.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- 無

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/tree-layers.md`
- 上游規格書：`../../../taipei-gis-analytics/docs/topic-research/street_tree_removal/tree-layers-prompt.md`
- 開發規則：`../../development-rules.md`
