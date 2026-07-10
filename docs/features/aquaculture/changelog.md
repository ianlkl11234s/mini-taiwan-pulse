# Changelog — 養殖漁業 Aquaculture

> 逐 PR 變更紀錄。最新在上。

---

## （pending 日期） — PR #（pending） `（pending）`（feat/aquaculture-layers，初版接線）

- **新增養殖漁業 3 個 Polygon 圖層**（掛「農業 Agriculture」下新分組「養殖漁業 Aquaculture」，公開、預設全關）：
  - `aquaculturePonds` 逐口魚塭 — PMTiles fill+line（`public/fishery/aquaculture_ponds_osm.pmtiles`，sourceLayer `aquaculture_ponds_osm`, z5–14），15,241 面（OSM, ODbL），青 `#26c6da`，顯示 minzoom 9。
  - `aquacultureZone` 養殖漁業生產區 — GeoJSON fill+line（`aquaculture_production_zone.geojson`, 589KB），62 面（MOA E01 / datagov:56684），綠 `#66bb6a`。
  - `aquacultureCageNet` 海上箱網 — GeoJSON fill+line（`aquaculture_cage_net.geojson`, 20KB），42 面（datagov:127504，澎湖海域為主），靛 `#5c6bc0`。
- **改動 13 檔**：
  - 接線 10：`src/types/index.ts`、`src/map/overlayRegistry.ts`、`src/hooks/useMapInteraction.ts`、`src/components/featureInfo/fisheryPanels.tsx`（新）、`src/components/featureInfo/registry.tsx`、`src/hooks/useTransportParams.ts`、`src/components/LegendPanel.tsx`、`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS 新分組）、`src/components/IconRailSidebar.tsx`（Fish icon）、`src/data/upstreamRegistry.ts`。
  - 部署契約 3：`nginx.conf`（加 `location /fishery/`）、`scripts/deploy/pull-deploy-assets.sh`（mkdir + fire catch-all `--exclude "fishery/*"` + fishery sync）、`scripts/deploy/upload-deploy-assets.sh`（`FISHERY_FILES` 區塊）。原因：前端一旦引用 `./fishery/*`，`deployContract.test.ts` 要求 fishery 進 nginx + pull 契約（防「林班事件」大檔 404）。
- **上游**：`taipei-gis-analytics`（分支 `feat/aquaculture-pmtiles`）新增 `pipelines/fishery/aquaculture_ponds_osm/03_pmtiles.py`（tippecanoe v2.79.0 出 3.1MB pmtiles），複製至前端 `public/fishery/`。生產區 / 箱網 geojson 此前為孤兒檔，本次才接線。
- **四鐵則**：opacity slider ✅ / 圖例（`AquacultureLegend` + `LEGEND_REGISTRY`）✅ / popup（`fisheryPanels` 3 panel）✅ / dropdown N/A（無子分類選項）。
- **驗收**：`npx tsc -b` exit 0；`pnpm test` 190/190 passed（含 deployContract fishery 契約 + layerConsistency 圖例）；browser（localhost:3721, z12 雲嘉南）ponds 2,400 面 / zone 28 面 / cageNet 澎湖 41 面、popup 面積 1.08 ha、console 0 error、pmtiles HEAD 200 / Range 206。
- Breaking：無。
- 狀態：**未 commit、未 push**（過夜先不 push）；PR / squash hash pending；部署方式（pmtiles 進 git vs S3）待用戶決定。
</content>
