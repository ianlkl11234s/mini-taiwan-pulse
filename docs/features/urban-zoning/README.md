# 都市計畫土地使用分區（urban-zoning）

> **Slug**：`urban-zoning`（與 taipei-gis-analytics handoff 一致）
> **狀態**：dev
> **Owner**：migu
> **上線日期**：TBD
> **相關 PR**：TBD

## 一句話說明

北市 + 新北官方都市計畫使用分區 polygon（住宅/商業/工業/農業/綠地/公設/交通/保護/其他 9 類統一分色），掛「底圖 Base Map」主題新 group「土地使用分區 Zoning」（官方參考底圖，非分析產物；上游 topic-research 原始目標即底圖層）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| urbanZoningTaipei | polygon (PMTiles z6-15) | `public/urban/urban_zoning_taipei.pmtiles`（15,518，S3 管理） | dev |
| urbanZoningNewTaipei | polygon (PMTiles z6-15) | `public/urban/urban_zoning_newtaipei.pmtiles`（34,190，S3 管理） | dev |

## 關鍵檔案

- 色票 SSOT：`src/data/urbanZoningTypes.ts`（9 類 zone_category）
- Overlay：`src/map/overlayRegistry.ts`（fill + line 雙 spec，pmtiles sourceLayer 各自對應）
- Popup：`src/components/featureInfo/urbanPanels.tsx`（兩 key 共用 UrbanZoningPanel）
- Catalog：`src/components/sidebar/layerCatalog.ts`（底圖 Base Map > 土地使用分區）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/urban-zoning.md`。

重點：PMTiles 走 S3（gitignored，upload 腳本 urban glob 已涵蓋）；`zone_category` 9 值是分色/篩選硬依賴；新北官方站 TLS 憑證問題在上游 pipeline 層處理。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

無（來源決策見上游 `docs/topic-research/urban_zoning_polygon/_status.md`）。
