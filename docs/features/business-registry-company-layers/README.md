# 公司登記點位、網格與篩選

> **Slug**：`business-registry-company-layers`  
> **狀態**：staging  
> **上線日期**：待授權

## 一句話說明

以同一份 202608 公司登記快照提供公司點位、製造業公司點位、150m 聚合網格與前端篩選；不宣稱即時或目前營業狀態。

## 圖層 / 元件

| layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `companyPoints` | Point，z12+ | PMTiles | 🟡 staging |
| `manufacturingCompanyPoints` | Point，z12+ | 與 B1 共用 PMTiles、`is_manufacturing=1` | 🟡 staging |
| `companyCapitalGrid` | 150m Polygon | PMTiles | 🟡 staging |

B3 是 `companyPoints` 的 params/filter 契約，不另建 11 個 layer。B1/A4 共用 `business-registry-company-points` source，避免重複載入。

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- 視覺與 filter SSOT：`src/data/businessRegistryTypes.ts`
- Params：`src/data/layerParamsSpec.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- 契約：[handoff.md](./handoff.md)

