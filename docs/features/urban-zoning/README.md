# 都市計畫土地使用分區（urban-zoning）

> **Slug**：`urban-zoning`（與 taipei-gis-analytics handoff 一致）
> **狀態**：shipped
> **Owner**：migu
> **上線日期**：2026-07-17（都計 2 層）／2026-08-02（非都市分區）
> **相關 PR**：#73（squash `54b7f17`）、#（非都市分區待補）

## 一句話說明

北市 + 新北官方都市計畫使用分區 polygon（住宅/商業/工業/農業/綠地/公設/交通/保護/其他 9 類統一分色），掛「底圖 Base Map」主題新 group「土地使用分區 Zoning」（官方參考底圖，非分析產物；上游 topic-research 原始目標即底圖層）。

2026-08-02 加入**非都市土地使用分區**（68,220 面 / 18 縣市，區域計畫法 11 種法定分區）——
與上面兩層互補：那兩層是「都市計畫區**內**」，本層是「非都市土地」，合起來才是全國土地使用拼圖。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| urbanZoningTaipei | polygon (PMTiles z6-15) | `public/urban/urban_zoning_taipei.pmtiles`（15,518，S3 管理） | ✅ |
| urbanZoningNewTaipei | polygon (PMTiles z6-15) | `public/urban/urban_zoning_newtaipei.pmtiles`（34,190，S3 管理） | ✅ |
| nonUrbanZoning | polygon (PMTiles z5-14) | `public/urban/non_urban_zoning.pmtiles`（68,220 / 37.5MB，S3 管理） | ✅ |

## 關鍵檔案

- 色票 SSOT：`src/data/urbanZoningTypes.ts`（都計 9 類 zone_category）
  + `src/data/nonUrbanZoningTypes.ts`（非都市 11 碼 zone_code，刻意與都計同色系對齊）
- Overlay：`src/map/overlayRegistry.ts`（fill + line 雙 spec，pmtiles sourceLayer 各自對應）
- Popup：`src/components/featureInfo/urbanPanels.tsx`（都計兩 key 共用 UrbanZoningPanel；
  非都市另有 NonUrbanZoningPanel，因欄位是 zone_code/county/town 而非 zone_short/plan_level）
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
