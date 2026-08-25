# 世界通訊圖層 Telecom World Layers

> **Slug**：`telecom-world-layers`
> **狀態**：dev
> **Owner**：GIS workspace
> **上線日期**：2026-08-18（prototype）

## 一句話說明

在「世界」rail tab 提供獨立的通訊大群，以真實點線資料呈現全球網路骨幹與互連節點。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `submarineCables` | line | OSM strict tags＋OpenInfraMap z2 generalized geometry | ✅ 104-line global crowd overview |
| `landingStations` | point | OSM `telecom=cable_landing_station` | ✅ 58-point global crowd overview |
| `internetExchangePoints` | point | PCH Active IXP GeoJSON | ✅ prototype |
| `anfrWirelessSites` | point | ANFR Cartoradio GeoJSON | ✅ prototype |
| `osmCommunicationSites` | point | OpenStreetMap / Overpass GeoJSON | ✅ 916-point regional prototype |
| `ripeAtlasProbes` | point | RIPE Atlas public probe metadata | ✅ 3,000-point global overview |
| `ooklaMobilePerformance` | polygon | Ookla Speedtest 2026 Q1 global grid（z6／z10 可切） | ✅ 52,107 cells |
| `ooklaFixedPerformance` | polygon | Ookla Speedtest 2026 Q1 global grid（z6／z10 可切） | ✅ 63,101 cells |
| `ooklaMobileTaiwan` | polygon | Ookla 台灣細格 PMTiles（z14 → z16 原生） | ✅ 4,784 / 23,881 cells |
| `ooklaFixedTaiwan` | polygon | Ookla 台灣細格 PMTiles（z14 → z16 原生） | ✅ 5,133 / 28,028 cells |

## 關鍵檔案

- 資料型別／色票：`src/data/telecomTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Manifest：`src/data/layerManifest.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/infraPanels.tsx`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/telecom-world-layers.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/telecom-world-layers.md`
- 開發規則：`../../development-rules.md`
