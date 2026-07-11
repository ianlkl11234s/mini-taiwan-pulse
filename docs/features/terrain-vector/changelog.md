# Changelog — terrain-vector

> 逐 PR / commit 變更紀錄。最新在上。

---

## 2026-07-11 — `f648f8d` `9a59066` `5e0554a`（已 S3 部署 + push）

- **`f648f8d` feat(terrain)**：新增坡度 / 坡向向量分級圖層（`slopeVector` / `aspectVector`）
  - 資料源：S3 `deploy-assets/base_map/{slope_vector,aspect_vector}.pmtiles`（各 16 MB），上游從 NLSC 20m DTM 用 GDAL 重算 → 建管六級坡（slope_class 1-6）/ 8 方位+平地（aspect_class 1-9）→ tippecanoe。
  - 前端硬依賴：source-layer `slope` / `aspect`，屬性 `slope_class` / `aspect_class`。
  - feature-state 依 class 染色 + 圖例 + click popup。
- **`9a59066` fix(terrain)**：坡度 / 坡向 legend 標題 / 註腳補淺色主題（`useLegendTheme`）。
- **`5e0554a` feat(sidebar)**：Layers 搜尋欄 + **移除舊 raster PNG 坡度 / 坡向**（改用向量版）。
- **部署**：PMTiles 上 S3 `deploy-assets/base_map/`（前端 gitignored CDN 遞送）；三 commit 已 push。
- **Breaking**：移除舊 PNG 圖層 key（前端內部，不影響上游契約）。
- **Migration needed**：無（純 CDN 靜態）；③ H3 層 migration 289 未 apply、前端未接。
