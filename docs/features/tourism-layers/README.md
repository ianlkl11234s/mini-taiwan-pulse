# 觀光 Tourism（12 圖層）

> **Slug**：`tourism-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：dev
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：—

## 一句話說明

新開「觀光 Tourism」主題分組，一次接上觀光署/文資局/地調所等 12 個全國靜態圖層：景點（含 2024 遊客人次熱度模式）、旅宿（四類篩選 + zoom-gate）、觀光活動（三態時間篩選）、餐飲、文化資產、宗教百景、露營場、觀光工廠、遊樂園、溫泉露頭（點+面）、國家風景區。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| tourAttractions | point | GeoJSON（D volume, 6,070 點） | 🔧 |
| tourHotSprings | point | GeoJSON（C git, 150） | 🔧 |
| tourHotSpringZones | polygon | GeoJSON（C git, 16 面，僅北市） | 🔧 |
| tourScenicAreas | polygon | GeoJSON（C git, 12 面） | 🔧 |
| tourHeritage | point | GeoJSON（C git, 2,894） | 🔧 |
| tourReligion | point | GeoJSON（C git, 100） | 🔧 |
| tourEvents | point | GeoJSON（C git, 828，三態時間篩選） | 🔧 |
| tourFactories | point | GeoJSON（C git, 158） | 🔧 |
| tourAmusementParks | point | GeoJSON（C git, 26） | 🔧 |
| tourCamping | point | GeoJSON（C git, 1,737） | 🔧 |
| tourHotels | point | GeoJSON（D volume, 15,654，全 zoom 常駐低 zoom 縮點） | 🔧 |
| tourRestaurants | point | GeoJSON（D volume, 3,688） | 🔧 |

## 關鍵檔案

- 靜態檔：`public/tourism/*.geojson`（9 檔 C 類進 git；attractions/hotels/restaurants 3 檔 D 類走 S3 volume）
- Overlay：`src/map/overlayRegistry.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`（THEMES「觀光 Tourism」+ LAYER_COLORS + SECTIONS）
- Legend：`src/components/LegendPanel.tsx`
- 部署：`scripts/deploy/upload-deploy-assets.sh` / `pull-deploy-assets.sh` / `nginx.conf`（tourism 段）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/tourism-layers.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- gis-platform migration 307（tourism schema 15 表，store-of-record，前端不讀）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/tourism-layers.md`
- 開發規則：`../../development-rules.md`
