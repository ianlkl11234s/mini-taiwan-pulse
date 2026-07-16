# 藝文文化圖層批次（culture-layers）

> **Slug**：`culture-layers`（與 taipei-gis-analytics handoff 一致）
> **狀態**：shipped
> **Owner**：migu
> **上線日期**：2026-07-17
> **相關 PR**：#72（squash `47c5af2`）

## 一句話說明

文化部藝文資料首批 5 圖層：全國文化設施 / 地方文化館 / 藝文活動場次（滾動窗）/ 表演場館，加上北市圖 6 分館即時座位（10min 輪詢），新開 sidebar「文化 Culture」主題。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| culturalFacilities | point | GeoJSON `public/culture/cultural_facilities_national.geojson`（787，facility_type 6 類分色） | ✅ |
| culturalMuseums | point | GeoJSON `public/culture/local_cultural_museums_national.geojson`（252，type 5 類分色） | ✅ |
| artsEvents | point | GeoJSON `public/culture/arts_events_national.geojson`（6,121 場次，進行中/未開始兩色，today 注入 paint） | ✅ |
| performingVenues | point | GeoJSON `public/culture/performing_venues_national.geojson`（857，半徑∝√event_count） | ✅ |
| librarySeats | point（realtime） | RPC `get_tpml_seat_current` / `get_tpml_seat_24h`（29 區聚合 6 分館，5min 輪詢） | ✅ |

## 關鍵檔案

- 色票 SSOT：`src/data/cultureTypes.ts`
- Realtime loader：`src/data/librarySeatsLoader.ts`
- Realtime hook：`src/hooks/useLibrarySeatsLayer.ts`
- Overlay：`src/map/overlayRegistry.ts`（4 靜態 + librarySeats 空殼 source `dynamicData: true`）
- Popup panels：`src/components/featureInfo/culturePanels.tsx`
- Catalog：`src/components/sidebar/layerCatalog.ts`（新主題「文化 Culture」）
- Legend：`src/components/LegendPanel.tsx`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/culture-layers.md`。

重點：4 靜態檔 **git 管理不走 S3**（全 <3MB；arts_events 2.8MB 略超 2MB 建議線，沿用 sports 9MB 前例）；`is_closed=true` 必須顯示「休館中」不能顯示 0 空位。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

無。
