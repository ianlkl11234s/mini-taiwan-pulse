# 日本宗教設施三源圖層

> **Slug**：`jp-religion-layers`
> **狀態**：dev
> **Owner**：mini-taiwan-pulse
> **上線日期**：待 release
> **相關 PR**：待建立

## 一句話說明

在「世界 World」rail tab 提供 GSI、OpenStreetMap、Wikidata 三個彼此獨立的原始點層。

## 圖層

| layer key | 類型 | 資料源 | 筆數 | 預設 |
|---|---|---|---:|---|
| `jpReligionGsi` | circle | PMTiles | 167,037 | off |
| `jpReligionOsm` | circle | GeoJSON | 71,040 | off |
| `jpReligionWikidata` | circle | GeoJSON | 37,154 | off |

三源不可直接融合或加總：來源涵蓋不同且 OSM 採 ODbL。每層皆可調整透明度與點位大小。

## 關鍵檔案

- 契約／色票：`src/data/jpReligionTypes.ts`
- Loader：`src/data/jpReligionLoader.ts`
- Hook：`src/hooks/useJpReligionLayers.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/religionPanels.tsx`

## 資料契約

見 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/jp-religion-layers.md`。

## 相關文件

- [Backlog](./backlog.md)
- [Changelog](./changelog.md)
- [開發規則](../../development-rules.md)
