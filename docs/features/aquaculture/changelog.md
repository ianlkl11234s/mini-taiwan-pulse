# Changelog — 養殖漁業 Aquaculture

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-12 — （同分支續作）衛星層上游擴欄跟進（5 → 8 欄）

- 上游 pmtiles 換版（重跑偵測 +expand 宜蘭/花蓮縱谷/臺中海線 + 假陽性過濾湖泊/純光電/山影）：視覺層 6,094 面（source 8,333）/ 3.3MB；keep 8 欄 = 原契約 5 欄（detect_id/area_ha/in_osm/county/tile_id）+ 抽檢 3 欄（`nlsc_code` / `nlsc_name` / `solar_symbiotic`）。sourceLayer `aquaculture_water_satellite` / z5–14 / 原 5 欄不變，向下相容。
- `AquacultureWaterSatellitePanel` popup 擴充（`src/components/featureInfo/fisheryPanels.tsx`）：
  - 加「土地使用（NLSC 113年）」列 — 顯示 `nlsc_name（nlsc_code）` 如「水產養殖（0102）」，name 99.3% 覆蓋，空值 Row 自動隱藏。
  - `solar_symbiotic=true` 加「漁電共生」列（amber `#fbbf24`）— 此面在光電案場內但官方認定水產養殖或有魚塭證據而保留。
- 契約測試盤點：repo 內無任何測試枚舉 fishery 欄位（deployContract 只掃部署 plumbing、layerConsistency 只掃 layer key）→ 欄位契約 SSOT 在 `handoff.md`（已 5→8 更新），測試零改動。
- 驗收：`npx tsc -b` exit 0；`pnpm test` 190/190 passed。
- 狀態：未 commit、未 push。

---

## （pending 日期） — PR #（pending） `（pending）`（feat/aquaculture-layers，追加衛星偵測層 + 湖泊/埤塘層）

- **新增 `aquacultureWaterSatellite` 衛星偵測養殖水體圖層**（掛既有「養殖漁業 Aquaculture」分組，公開、預設關）：
  - PMTiles fill+line（`public/fishery/aquaculture_water_satellite.pmtiles`，sourceLayer `aquaculture_water_satellite`, z5–14），5,095 面（Sentinel-2 + RandomForest，ODbL 衍生）。
  - `in_osm` 分兩色：`false`（OSM 漏標候選，本圖層核心價值）用醒目橘 `#ff5722`；`true`（與 OSM 逐口重疊）用低調灰藍 `#78909c`，跟 OSM ponds 的青色 `#26c6da` 明確區隔。
  - popup 顯示 area_ha / county / 狀態（OSM 已標 / OSM 漏標候選），誠實標註「10m blob 非逐口輪廓，含少量假陽性」。
- **新增水資源主題 `lakesPondsOsm` 湖泊/埤塘圖層**（掛「水資源 Water」→「面 / 線」分組，公開、預設關）：
  - PMTiles fill+line（`public/water_resources/lakes_ponds_osm.pmtiles`，sourceLayer `lakes_ponds_osm`, z5–14），52,314 面（OSM natural=water）。
  - `water` 分類 4 色（pond `#4fc3f7` / lake `#1e88e5` / reservoir `#00acc1` / basin `#7e57c2`）。
  - **靜態 filter 預設濾掉 `overlaps_aquaculture=true`**（39.1% 與魚塭圖層重疊，避免視覺打架）；本專案 `OverlayConfig.filter` 為 build-time 靜態機制、無現成 runtime toggle 慣例，故採「寫死預設濾掉」，於圖例/popup 註明。
  - 獨立 feature 文件：`docs/features/water-resources/README.md`。
- **改動檔案**：`src/types/index.ts`、`src/map/overlayRegistry.ts`、`src/hooks/useMapInteraction.ts`、`src/hooks/useTransportParams.ts`、`src/components/LegendPanel.tsx`、`src/components/sidebar/layerCatalog.ts`、`src/components/IconRailSidebar.tsx`、`src/data/upstreamRegistry.ts`、`src/components/featureInfo/registry.tsx`、`src/components/featureInfo/fisheryPanels.tsx`（衛星層 panel）、`src/components/featureInfo/waterPanels.tsx`（湖泊/埤塘 panel）。
- **部署契約**：`nginx.conf` 新增 `location /water_resources/`；`pull-deploy-assets.sh` 新增 water_resources mkdir + sync；`upload-deploy-assets.sh` 補 `aquaculture_water_satellite.pmtiles` 進 `FISHERY_FILES` + 新增 water_resources glob 上傳段。`fishery/` 目錄已被 ponds 接線覆蓋，衛星層免改 nginx/pull。
- **上游**：`taipei-gis-analytics`（分支 `feat/aquaculture-pmtiles`）新增 `pipelines/fishery/aquaculture_water_satellite/`（01_detect → 02_export → 03_pmtiles）+ `pipelines/water_resources/lakes_ponds_osm/`（01_download → 02_clean → 03_pmtiles）。兩份 pmtiles 已複製到前端 `public/fishery/` / `public/water_resources/`。
- **四鐵則**：opacity slider ✅（`aquacultureWaterSatelliteOpacity` / `lakesPondsOsmOpacity`）／圖例 ✅（`AquacultureLegend` 擴充 2 row + 新 `LakesPondsLegend`）／popup ✅（`AquacultureWaterSatellitePanel` / `LakesPondsPanel`）／dropdown N/A。
- **驗收**：`npx tsc -b` exit 0；`pnpm test` **190/190 passed**（`deployContract` / `layerConsistency` / `featureInfo registry` / `upstreamRegistry` 皆綠，新 layer 自動涵蓋無需手改 baseline）。Browser 未本輪重新截圖（沿用既有 overlay 接線模式）。
- Breaking：無。
- 狀態：**未 commit、未 push**；PR / squash hash pending。

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
