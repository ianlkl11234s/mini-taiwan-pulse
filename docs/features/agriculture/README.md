# Agriculture（農業）

> **Slug**：`agriculture`
> **狀態**：dev（Phase 3 Batch 1 + 農企業 3 層 wiring 完成，尚未 browser 視覺驗收 / S3 部署 / Supabase import）
> **Owner**：migu
> **上線時分支**：Phase 3 Batch 1 於 `feat/water-extensions`；農企業 3 層於 `feat/fire-rescue`
> **memory 時點**：2026-05-23（phase3-batch1）+ 2026-05-25（business layers）

## 一句話說明

把土壤/肥力/休農區/農村再生/132 作物適栽性/農業 POI + 農企業登記（零售/蔬果批發/批發市場）整合到 sidebar 的 **AGRICULTURE** 分區，讓用戶跨圖層看農業地景。

## 圖層清單（Phase 3 Batch 1 = 6 層 + 農企業 = 3 層，共 9 個 key）

### Phase 3 Batch 1（2026-05-23）

| Layer key | 類型 | 資料源 | 大小 | 顏色 | minzoom | 狀態 |
|---|---|---|---|---|---|---|
| `agriSoil` | polygon (PMTiles) | 25539 全台土壤分類 | 24MB | #8d6e63 棕 | 6 | ✅ wire 完 |
| `agriSoilFertility` | polygon (PMTiles) | 112848 土壤肥力 250m | 14MB | #00897b teal | 8 | ✅ wire 完 |
| `agriLeisureFarmZones` | polygon (PMTiles) | 9809 休農區 | 0.35MB | #66bb6a 淺綠 | 6 | ✅ wire 完 |
| `agriRuralRegen` | polygon (PMTiles) | 176846 農村再生 | 1.6MB | #ffb74d 橘 | 7 | ✅ wire 完 |
| `agriCropSuitability` | polygon (PMTiles) | 7294 132 作物 | 78MB | step by `kind` 4 級（綠→紅） | 6 | ✅ wire 完（132 作物 dropdown） |
| `agriPOI` | point (GeoJSON) | 177247 + 245 + 246 散點 | 0.3MB | match by `poi_type` 三色 | - | ✅ wire 完 |

### 農企業登記（2026-05-25）— 同指向 `spatial.agri_business_registrations`，用 `business_type` 區分

| Layer key | business_type | 點數 | 顏色 | minzoom | 狀態 |
|---|---|---|---|---|---|
| `agriRetail` | retail | 37,430 | #e91e63 桃紅 | 8 | ✅ wire 完 |
| `agriProduceWholesale` | produce_wholesale | 22,843 | #3f51b5 靛藍 | 8 | ✅ wire 完 |
| `agriWholesaleMarket` | wholesale_market | 53 | #ffd600 鮮黃 | 6 | ✅ wire 完 |

## 關鍵檔案

- Layer factory（前 6 層走 factory）：`src/data/agricultureLayerFactory.ts`（ensure/update helpers + `ensureSimplePolyLayer`）
- Overlay registry（農企業 3 層走宣告式 registry）：`src/map/overlayRegistry.ts`
- Types SSOT：`src/data/fireTypes.ts` 慣例類比 → 農企業改 `src/data/agriCompanyTypes.ts`（`AGRI_COMPANY_TYPES`，legend + popup 共用）
- Sidebar catalog：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS AGRICULTURE 區）
- Icons：`IconRailSidebar.tsx` LAYER_ICONS（農企業用 ShoppingCart / Truck / Warehouse — **這是隱藏的 exhaustive Record，漏了 tsc TS2739**）
- Legend：`LegendPanel.tsx` → `AgriCompanyLegend` sub-component（依可見性篩選）
- Popup：`FeatureInfoPanel.tsx` → `AgriCompanyPanel`（欄位用 bracket notation 讀中文 `props["公司名稱"]`）
- Interaction：`useMapInteraction.ts` GIS_LAYERS
- 部署資產目錄：`public/agriculture/`（gitignored，走 S3 `upload-deploy-assets.sh`）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/agriculture.md`（未建，待補）。
上游 handoff doc（已存在）：`taipei-gis-analytics/docs/topic-research/agriculture/FRONTEND_HANDOFF.md`

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 相關文件

- 全站 memory：`~/.claude/projects/.../memory/agriculture-phase3-batch1.md`、`.../agriculture-business-layers.md`
- 上游來源資料：`taipei-gis-analytics/data/processed/agriculture/`
- 失敗清單：`taipei-gis-analytics/data/intermediate/tgos/agri_companies/_geocode_failed.csv`（562 筆查無座標）
