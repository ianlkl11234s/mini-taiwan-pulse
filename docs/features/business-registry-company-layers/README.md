# 公司登記點位、網格與篩選

> **Slug**：`business-registry-company-layers`  
> **狀態**：r2 assets 已 upload 並讀回驗證；deploy / browser smoke 待完成
> **上線日期**：待授權

## 一句話說明

以同一份 202608 公司登記快照提供低倍率全已定位 records 概覽、可點擊個別公司、三尺度資本額網格與前端篩選；不宣稱即時或目前營業狀態。

## 圖層 / 元件

| layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `companyPoints` | z4–11 1.5km 計數概覽，z12+ 個別 Point | overview + detail PMTiles | 🟡 uploaded / deploy pending |
| `manufacturingCompanyPoints` | z4–11 製造業計數概覽，z12+ 個別 Point | 與 B1 共用兩個 sources | 🟡 uploaded / deploy pending |
| `companyCapitalGrid` | 150m / 450m / 1.5km Polygon | 三份 PMTiles，手動切換 | 🟡 uploaded / deploy pending |

B3 是 `companyPoints` 的 params/filter 契約，不另建 11 個 layer；companion asset 固定為 `company_filters_202608_r2.json`。B1/A4 共用 overview 與 detail sources；概覽只傳輸格網計數，不在 z4 下載 65 萬個含名稱 feature。

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- 視覺與 filter SSOT：`src/data/businessRegistryTypes.ts`
- Params：`src/data/layerParamsSpec.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- 契約：[handoff.md](./handoff.md)
