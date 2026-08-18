# 工廠、列管設施與產業園區

> **Slug**：`business-registry-industrial-layers`  
> **狀態**：staging（A1/A2/A5/A6）  
> **上線日期**：待授權

## 圖層

| layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `factoryLocations`（A1） | Point，z11+ | PMTiles | 🟡 staging |
| `industrialParkBoundaries`（A2） | Polygon | PMTiles | 🟡 staging |
| `regulatedFacilities`（A5） | Point，z11+ | PMTiles | 🟡 staging |
| `industrialParkComparison`（A6） | Polygon | PMTiles | 🟡 staging |

A3 是無 geometry 的 membership assertion contract，不建立假 map layer。完整契約見 [handoff.md](./handoff.md)。

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- Legend：`src/components/LegendPanel.tsx`
- Params：`src/data/layerParamsSpec.ts`
