# 工廠、列管設施與產業園區

> **Slug**：`business-registry-industrial-layers`  
> **狀態**：A1 overview 已 upload 並讀回驗證；deploy / browser smoke 待完成
> **上線日期**：待授權

## 圖層

| layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `factoryLocations`（A1） | z4–10 1.5km 計數概覽，z11+ 個別 Point | overview + detail PMTiles | 🟡 uploaded / deploy pending |
| `industrialParkBoundaries`（A2） | Polygon | PMTiles | 🟡 uploaded / deploy pending |
| `regulatedFacilities`（A5） | Point，z11+ | PMTiles | 🟡 uploaded / deploy pending |
| `industrialParkComparison`（A6） | Polygon | PMTiles | 🟡 uploaded / deploy pending |

A3 是無 geometry 的 membership assertion contract，不建立假 map layer。完整契約見 [handoff.md](./handoff.md)。

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- Legend：`src/components/LegendPanel.tsx`
- Params：`src/data/layerParamsSpec.ts`
