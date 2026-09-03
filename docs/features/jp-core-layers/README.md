# 日本 Japan rail tab + 核心圖層

> **Slug**：`jp-core-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：Batch 1 已 merge 進 master（PR #199 / `632a7d2`）；**Batch 2 遞延三層程式碼完成**（`npx tsc -b` 綠、98 檔 990 測試綠、瀏覽器實測過），PR 待開、🔴 人口網格待 owner 上傳 S3
> **Owner**：migu
> **上線日期**：YYYY-MM-DD（待定）
> **相關 PR**：#199（Batch 1）／#201（遞延交辦文件）／Batch 2 待開（分支 `feat/jp-deferred-layers`）

## 一句話說明

新增「日本 Japan」側邊欄 rail tab（clone「世界 World」tab 模式），把日本圖層集中一處，打開 tab 時自動 flyTo 日本；本輪前端接線，資料層上游已 production ready。

## 圖層 / 元件（**9 層**現況）

> **「9 層」的計數基準**＝上游 handoff 的**資料集**數（`jp_admin_boundaries` / `jp_stations` / `jp_airports` /
> `jp_railways` / `jp_schools` / `jp_population_mesh_1km` / `jp_religion_{gsi,osm,wikidata}`）。
> 前端 **layer key 共 10 個**——行政區的縣界與市界是同一資料集切出的兩支 PMTiles、各自一個 key。
>
> 日本 tab 現有五個主題：**行政區 / 交通 / 教育 / 人口 / 宗教**
> （`JAPAN_TAB_THEME_TITLES = ["行政區","交通","教育","人口","宗教"]`）。

### Batch 1（7 個 layer key，2026-09-01，PR #199 已 merge）

| 名稱（layer key） | 類型 | 資料源 | group | 狀態 |
|---|---|---|---|---|
| jpAdminPrefecture（都道府県界 47） | polygon fill+line | PMTiles（public/world/）| 行政區 | ✅ 接線完成 |
| jpAdminBoundaries（市区町村界 1,905） | polygon fill+line | PMTiles | 行政區 | ✅ |
| jpStations（車站 9,046，含運量） | point circle | GeoJSON | 交通 | ✅ |
| jpAirports（機場 108） | polygon fill+line | GeoJSON | 交通 | ✅ |
| jpReligionGsi / Osm / Wikidata | point circle / PMTiles | 既有（搬 tab）| 宗教 | ✅ 從「世界」tab 搬入 |

### Batch 2（3 個 layer key，2026-09-02，遞延三層落地）

| layer key | 資料檔（`public/world/`） | 大小 | 供應路徑 | 主題／群組 | 圖例 | popup 欄位 |
|---|---|---|---|---|---|---|
| **jpRailways**<br>日本鐵道路線 | `jp_railways.pmtiles`<br>21,933 段・z4–12<br>source-layer `jp_railways` | 4.86MB<br>(5,093,949 B) | **git-track**<br>（nginx `/world/` → `@dist` fallback，免 S3）| 交通 ／ **線**（新群組）| ✅ 事業者種別 5 色 | `line_name`（標題）/ `operator` / `operator_type` / `railway_category` |
| **jpSchools**<br>日本學校 | `jp_schools.pmtiles`<br>56,807 點・z4–11<br>source-layer `jp_schools` | 16.5MB<br>(17,303,011 B) | **git-track**（同上）| **教育**（新主題）／ 點位 | ✅ `school_class` 13 類（兩欄）| `name`（標題）/ `school_class` / `administrator` / `closed_status` / `address` |
| **jpPopulationMesh1km**<br>日本人口網格 | `jp_population_mesh_1km.pmtiles`<br>176,896 格・z4–11<br>source-layer `jp_population_mesh_1km` | 48.6MB<br>(50,998,171 B) | 🔴 **S3**<br>（`.gitignore` 單檔 + `upload-deploy-assets.sh` world 區塊；**尚未上傳**）| **人口**（新主題）／ 面 | ✅ choropleth，隨 9 模式切換<br>（含「未公開（遮罩）」列）| `id`（標題）+ `pop_{2020,2030,2040,2050,2070}` + `ratio65_{2030,2040,2050,2070}`（9 欄一次列完，不隨模式變）|

三層的資料坑（學校配方變更、`ratio65=0` 是隱私遮罩、年份不連續）與瀏覽器實測數字見 [changelog.md](./changelog.md) Batch 2 段。

## 關鍵檔案

- 資料檔（git-track，走 nginx `/world/` dist fallback，免 S3）：`public/world/jp_admin_boundaries.pmtiles`、`_prefecture.pmtiles`、`jp_stations.geojson`、`jp_airports.geojson`、`jp_railways.pmtiles`、`jp_schools.pmtiles`
- 資料檔（走 S3）：`public/world/jp_population_mesh_1km.pmtiles` — `.gitignore` 單一檔名 + `scripts/deploy/upload-deploy-assets.sh` 的「🌍 世界 World 大檔」區塊
- Loader：`src/data/jpStationsLoader.ts`、`src/data/jpAirportsLoader.ts`（三個新層無 loader，hook 自建 PMTiles source）
- 色票／級距 SSOT：`src/data/jpStationTypes.ts`、`jpRailwayTypes.ts`、`jpSchoolTypes.ts`、`jpPopulationMeshModes.ts`
- Hook：`src/hooks/useJpAdminLayers.ts`、`useJpStationsLayer.ts`、`useJpAirportsLayer.ts`、`useJpRailwaysLayer.ts`、`useJpSchoolsLayer.ts`、`useJpPopulationMeshLayer.ts`（宗教沿用 `useJpReligionLayers.ts`）
- Host：`src/layers/hosts/japanHosts.tsx` + `layers/layerHookRegistry.tsx`
- Popup：`src/components/featureInfo/japanPanels.tsx` + `featureInfo/registry.tsx`
- Catalog / tab 外殼：`src/components/sidebar/layerCatalog.ts`（`JAPAN_THEME_TITLE` / `JAPAN_TAB_THEME_TITLES` / `JAPAN_THEME`）、`src/components/IconRailSidebar.tsx`（rail 按鈕 `JapanGlyph` + 面板）
- auto-flyTo：`src/map/cameraPresets.ts`（`JAPAN_CAMERA`）+ `src/App.tsx`（`onJapanOpen`，含自動開縣界底圖）
- click 順序：`src/map/gisClickRegistry.ts`（**點層 → 線層 → 面層；面層之間再依「小面 → 大面」**：人口網格 → 市界 → 縣界）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`。

## 相關 backlog / changelog

看 [backlog.md](./backlog.md)、[changelog.md](./changelog.md)。

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`
- 既有宗教層：`docs/features/jp-religion-layers/`
- 開發規則（20 觸點）：`../../development-rules.md` §4
