# Changelog — tree-layers

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-15 — PR #（待開）

- 一次新增 7 個樹木圖層：protectedTreesNational / riversideTreesTaipei / parksTaipei（GeoJSON 點層）、streetTreesTaipei3epoch / streetTreesNational（PMTiles 點層）、treePitsTaipei（PMTiles 面層）、canopyHeight（raster PMTiles）
- 新增 `src/data/urbanOpenSpaceTypes.ts` 色票/選項 SSOT
- overlayManager 支援 raster PMTiles（`pmtiles.sourceLayer` 改 optional）
- 上游轉檔：street_trees_national.pmtiles（z5-14，1MB/磚 cap）、tree_pits_taipei.pmtiles（z11-16 無損）
- Breaking：無（全部新增，預設關閉）
