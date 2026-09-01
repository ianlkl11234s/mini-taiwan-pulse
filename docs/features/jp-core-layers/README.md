# 日本 Japan rail tab + 核心圖層

> **Slug**：`jp-core-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：dev（Batch 1 程式碼完成、tsc + 963 測試綠；待瀏覽器目視驗收 + commit）
> **Owner**：migu
> **上線日期**：YYYY-MM-DD（待定）
> **相關 PR**：#（待開）

## 一句話說明

新增「日本 Japan」側邊欄 rail tab（clone「世界 World」tab 模式），把日本圖層集中一處，打開 tab 時自動 flyTo 日本；本輪前端接線，資料層上游已 production ready。

## 圖層 / 元件（本輪 Batch 1：7 層）

| 名稱（layer key） | 類型 | 資料源 | group | 狀態 |
|---|---|---|---|---|
| jpAdminPrefecture（都道府県界 47） | polygon fill+line | PMTiles（public/world/）| 行政區 | ✅ 接線完成 |
| jpAdminBoundaries（市区町村界 1,905） | polygon fill+line | PMTiles | 行政區 | ✅ |
| jpStations（車站 9,046，含運量） | point circle | GeoJSON | 交通 | ✅ |
| jpAirports（機場 108） | polygon fill+line | GeoJSON | 交通 | ✅ |
| jpReligionGsi / Osm / Wikidata | point circle / PMTiles | 既有（搬 tab）| 宗教 | ✅ 從「世界」tab 搬入 |

**遞延（不在本輪）**：jpRailways（14MB，評估轉 PMTiles）、jpSchools（需轉點 PMTiles）、jpPopulationMesh1km（49MB 走 S3 + 觸點 #20）。見 [backlog.md](./backlog.md)。

## 關鍵檔案

- 資料檔：`public/world/jp_admin_boundaries.pmtiles`、`_prefecture.pmtiles`、`jp_stations.geojson`、`jp_airports.geojson`（git-tracked，走 nginx `/world/` dist fallback，免 S3）
- Loader：`src/data/jpStationsLoader.ts`、`src/data/jpAirportsLoader.ts`
- Hook：`src/hooks/useJpAdminLayers.ts`、`useJpStationsLayer.ts`、`useJpAirportsLayer.ts`（宗教沿用 `useJpReligionLayers.ts`）
- Host：`src/layers/hosts/japanHosts.tsx` + `layers/layerHookRegistry.tsx`
- Popup：`src/components/featureInfo/japanPanels.tsx` + `featureInfo/registry.tsx`
- Catalog / tab 外殼：`src/components/sidebar/layerCatalog.ts`（`JAPAN_THEME_TITLE` / `JAPAN_TAB_THEME_TITLES` / `JAPAN_THEME`）、`src/components/IconRailSidebar.tsx`（rail 按鈕 `JapanGlyph` + 面板）
- auto-flyTo：`src/map/cameraPresets.ts`（`JAPAN_CAMERA`）+ `src/App.tsx`（`onJapanOpen`，含自動開縣界底圖）
- click 順序：`src/map/gisClickRegistry.ts`（點層在前、面層在後）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`。

## 相關 backlog / changelog

看 [backlog.md](./backlog.md)、[changelog.md](./changelog.md)。

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`
- 既有宗教層：`docs/features/jp-religion-layers/`
- 開發規則（20 觸點）：`../../development-rules.md` §4
