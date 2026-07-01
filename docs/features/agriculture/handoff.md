# Handoff — agriculture（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/agriculture.md`（尚未建，待補）
> 上游現有 handoff doc（Phase 3 用）：`taipei-gis-analytics/docs/topic-research/agriculture/FRONTEND_HANDOFF.md`
>
> 本檔只放前端接線簡表。契約細節看上游。

## 上游摘要

### Phase 3 Batch 1（6 層）

- 產物：`public/agriculture/*.pmtiles` + `agriPOI.geojson`（gitignored，走 S3 `upload-deploy-assets.sh`）
- 座標：WGS84
- 資料量：24MB + 14MB + 0.35MB + 1.6MB + 78MB + 0.3MB ≈ 118MB PMTiles + 0.3MB GeoJSON
- 上游來源目錄：`taipei-gis-analytics/data/processed/agriculture/`

### 農企業 3 層

- 產物：`public/agriculture/*_companies.geojson`（gitignored → S3）
- 上游 SSOT：`taipei-gis-analytics/data/processed/agriculture/{agri_retail_companies,produce_wholesale_companies,agri_wholesale_market_companies}/`（parquet + geojson + manifest）
- 目標 Supabase table：`spatial.agri_business_registrations`（overwrite，manifest 已註明），走 gis-data-onboard SOP
- 資料量：37,430 + 22,843 + 53 點；20.9MB + 13.1MB + 30KB ≈ 34MB 全部 eager load

## 前端接線位置

### Phase 3 Batch 1（走 factory 機制）

- Layer factory：`src/data/agricultureLayerFactory.ts`（6 ensure/update + `ensureSimplePolyLayer` helper）
- MapView 啟動：`ensureAllAgricultureLayers` + `updateAllAgricultureLayers` 接到 style.load/load + 兩個 useEffect
- Types / visibility：`types/index.ts`、`useLayerVisibility.ts`
- Sidebar：`layerCatalog.ts`（AGRICULTURE 區）、LAYER_COLORS、LAYER_ICONS
- Params：`useTransportParams.ts`（select dropdown `options.length > 6` 改原生 `<select>`）
- 資產：`public/agriculture/*.pmtiles`（gitignored）

### 農企業 3 層（走 overlayRegistry 宣告式機制）

- Registry：`src/map/overlayRegistry.ts`（3 entry）— MapView 完全不用改
- SSOT：`src/data/agriCompanyTypes.ts`（`AGRI_COMPANY_TYPES`，legend + popup 共用）
- Legend：`LegendPanel.tsx` → `AgriCompanyLegend`
- Popup：`FeatureInfoPanel.tsx` → `AgriCompanyPanel`
- Interaction：`useMapInteraction.ts` GIS_LAYERS
- Icons：`IconRailSidebar.tsx` LAYER_ICONS（ShoppingCart / Truck / Warehouse — **exhaustive Record，漏了 tsc TS2739**）

## 硬依賴欄位（改一定爆）

### PMTiles keep_attrs（Phase 3 Batch 1）

- `agriCropSuitability`：`kind` — step paint 4 級（綠→紅）
- `agriPOI`：`poi_type` — match 三色

### 農企業 geojson 欄位

- `business_type` — 區分 retail / produce_wholesale / wholesale_market（同表 3 層 filter 依據）
- popup 中文欄位（bracket notation）：`公司名稱` / `統編` / `負責人` / `地址` / `資本額` / `狀態`

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 加新作物（132 → N） | `crop_layer_id` 對照更新；`options.length > 6` 分支已處理原生 `<select>` |
| 改 `business_type` enum | overlayRegistry filter + `AGRI_COMPANY_TYPES` 同步 |
| 改 `poi_type` 值 | `agriPOI` match 表對齊 |
| 農企業 geojson 上游 trim（座標精度 / 冗欄位） | 前端無需改（fetcher 不硬鎖精度），但 legend/popup 欄位對齊 |
| 加新縣市（如高雄 fireHydrants 慣例類比） | LAYER_COLORS 檢查 domain |

## 已知不對稱

- 上游尚未建 `docs/handoff/agriculture.md`（現在用的是 `docs/topic-research/agriculture/FRONTEND_HANDOFF.md`）— 下次同步時要建 SSOT
- 農企業 3 層前端資產 eager 載入 34MB，上游未 trim；共識是「瘦身要在上游做，不要前端偷偷分叉 artifact」
- 農企業 3 層都指向同 Supabase table `spatial.agri_business_registrations`，但 Supabase 匯入尚未做（前端目前吃 geojson 靜態檔）
- 農企業 3 層是否已 commit / push、Phase 3 Batch 1 三 commit 是否 push — memory 未講清楚

## TBD

- 上游 handoff SSOT `docs/handoff/agriculture.md` 何時建
- Supabase table `spatial.agri_business_registrations` 上線後前端要不要改吃 RPC（現在直接吃 geojson）
