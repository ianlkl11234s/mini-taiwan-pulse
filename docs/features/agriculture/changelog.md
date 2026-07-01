# Changelog — agriculture

最新在上。

---

## 2026-05-25（feat/fire-rescue，未指定 commit）— 農企業登記 3 層

- 新增 `agriRetail`（37,430 點，桃紅）/ `agriProduceWholesale`（22,843 點，靛藍）/ `agriWholesaleMarket`（53 點，鮮黃）到 AGRICULTURE 區
- 機制走 `overlayRegistry.ts`（宣告式，比照 fireHydrants）而非 `agricultureLayerFactory.ts` — MapView 完全不用改，generic overlay loop 自動處理 visibility/theme/params
- 顏色/標籤 SSOT：新增 `src/data/agriCompanyTypes.ts`（`AGRI_COMPANY_TYPES`）供 legend + popup 共用
- UX 四鐵則：opacity + scale slider ✅、3 色合併圖例 `AgriCompanyLegend`（依可見性篩）✅、click popup `AgriCompanyPanel`（公司名稱/統編/負責人/地址/資本額/狀態，bracket notation 讀中文欄位）✅、控制項僅 2 個不需 dropdown ✅
- 改動檔（7 檔 + UX）：`types/index.ts`（ExpandableLayerKey + FeatureInfo.layerType + LayerVisibility 各 3 key）、`overlayRegistry.ts`（3 entry）、`layerCatalog.ts`（LAYER_COLORS + SECTIONS）、`IconRailSidebar.tsx`（LAYER_ICONS：ShoppingCart/Truck/Warehouse — **隱藏 exhaustive Record，漏了 tsc TS2739**）、`useLayerVisibility.ts`、`useTransportParams.ts`（state + overlayParams + deps + getControls）、`LegendPanel.tsx`、`useMapInteraction.ts`（GIS_LAYERS）、`FeatureInfoPanel.tsx`、新增 `agriCompanyTypes.ts`
- 資產走 `public/agriculture/`（gitignored → S3）；**未做 trim**，總計 ~34MB 在 style.load eager 載入
- 驗證：tsc 綠、dev 起得來、3 資產 HTTP 200；⏳ browser 驗收 / S3 / Supabase import / commit 待做

## 2026-05-23（feat/water-extensions）— Phase 3 Batch 1 六層 + 132 作物 dropdown

三 atomic commits：

- **`9bc0e5c`** factory + asset gitignore — `agricultureLayerFactory.ts` 加 6 ensure/update + helper `ensureSimplePolyLayer`
- **`f8a4ecc`** types/visibility/sidebar/params 接線 — 6 keys + LAYER_COLORS + LAYER_ICONS + AGRICULTURE rows + select dropdown 分支（options > 6 改用原生 `<select>`）+ 132 作物對照
- **`7d3092b`** MapView 啟動 — `ensureAllAgricultureLayers` + `updateAllAgricultureLayers` 接到 style.load/load + 兩個 useEffect

關鍵設計：

- **132 作物 dropdown**：`SelectConfig.options.length > 6` 時兩個 sidebar 都改用原生 `<select>`（保留 ≤6 的 button 列）
- **crop_name_zh 清洗**：從 parquet 抽 `crop_layer_id` + `crop_name_zh`，剝除「適栽性等級分布圖」尾綴；6 筆 `(unmatched)` 用 nameEn 兜底（aspara/bigatem/macada/malabar/marush/passion/snapbea/vegetsoy）
- **PMTiles 走 gitignore**：215MB 走 S3 `upload-deploy-assets.sh`，比照 `public/geo/water_*.geojson`
- **mapbox-pmtiles 共用 SourceType**：6 個 PMTiles layer 共用同一個 `registerSourceTypeOnce()`

驗證：tsc 綠、dev 起得來、6 資產 HTTP 206/200、`crop_suitability_132.parquet` 132 unique `crop_layer_id` 確認；⏳ browser 驗收 / 132 作物切換測試 / S3 待做
