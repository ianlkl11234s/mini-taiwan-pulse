# Changelog — tree-layers

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-24 — PR #83 `caef2ec`

- **canopyHeight v2（解糊）**：上游 pipeline 由預烤 Greens PNG 改單通道高度編碼 RGBA（R=G=B=公尺, A=nodata mask, 512px, z13≈20m）；前端改 mapbox `raster-color` 動態上色（`raster-color-mix` 取 R×6.375、0–40m 綠色階）+ `raster-resampling: nearest`。舊 38m/z12/256px → ~20m/512px，放大不再被 over-zoom + mapbox-pmtiles 512 假設額外抹軟。→ 解決 **TL-4**。
- **canopyGiants（新圖層）**：🌲 樹冠巨木 GeoJSON 7,823 點，依離道路距離 `dist_access_m` 分級染色（circle）；五處接線 + 分析文件 `docs/features/tree-layers/canopy-accessibility/`。
- 上游 catalog：analytics `docs/data-catalog/forestry/canopy_height_meta.md` 補齊（原標「待補」）。
- ⚠️ 部署（G012）：canopyHeight 80MB pmtiles 走 gitignore（`canopy_height_*.pmtiles`）+ S3/Volume，未上則 prod 404；canopyGiants geojson 在 git，prod 直接可用。

---

## 2026-07-15 — PR #70 `34b8fd5`

- 一次新增 7 個樹木圖層：protectedTreesNational / riversideTreesTaipei / parksTaipei（GeoJSON 點層）、streetTreesTaipei3epoch / streetTreesNational（PMTiles 點層）、treePitsTaipei（PMTiles 面層）、canopyHeight（raster PMTiles）
- 新增 `src/data/urbanOpenSpaceTypes.ts` 色票/選項 SSOT
- overlayManager 支援 raster PMTiles（`pmtiles.sourceLayer` 改 optional）
- 上游轉檔：street_trees_national.pmtiles（z5-14，1MB/磚 cap）、tree_pits_taipei.pmtiles（z11-16 無損）
- Breaking：無（全部新增，預設關閉）
