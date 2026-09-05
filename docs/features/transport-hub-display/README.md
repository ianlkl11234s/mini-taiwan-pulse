# 交通場站顯示模式

> **Slug**：`transport-hub-display`
> **狀態**：`dev`
> **最後更新**：2026-09-05
> **相關 PR**：無

## 一句話說明

高鐵站、台鐵站、港口與機場可在原本的實際範圍 Polygon 與遠距離易讀的 Mapbox 點位間切換；港口依原始 `port_class` 分類著色。

五個場站圖層皆預設使用 Mapbox 點位；有真實面資料的圖層仍可手動切回 Polygon。

## 圖層行為

| Layer key | Polygon 模式 | 點位模式 | 原始資料處理 |
|---|---|---|---|
| `stationsTHSR` | 12 站體範圍 | 由同一批 Polygon 派生面心 | 不另造站點 |
| `stationsTRA` | 32 個大站範圍，小站點保留 | 32 大站面心 + 212 小站（z<10 overview、z>=10 原 detail） | 不補齊不存在的站體面 |
| `stationsMetro` | 不提供 | 原始站點（z<10 overview、z>=10 原 detail） | Polygon 選項停用並標示無面資料 |
| `ports` | 277 個港區範圍 | 由同一批 Polygon 派生面心 | 依 `port_class` 著色，缺值/新類別回灰 |
| `airports` | 16 個機場範圍 | 由同一批 Polygon 派生面心 | 不影響燈塔圖層 |

## 關鍵檔案

- 模式與港口分類：`src/data/transportHubTypes.ts`
- 參數與 Toggle：`src/data/layerParamsSpec.ts`
- Mapbox layer：`src/map/overlayRegistry.ts`
- Polygon 派生點：`src/map/overlayManager.ts`
- Manifest / Legend / Popup：`src/data/layerManifest.ts`、`src/components/LegendPanel.tsx`、`src/components/featureInfo/infraPanels.tsx`

## 資料契約

看 [handoff.md](./handoff.md)。本次僅使用已有靜態 GeoJSON，沒有新增 collector、DB 或假造範圍。
