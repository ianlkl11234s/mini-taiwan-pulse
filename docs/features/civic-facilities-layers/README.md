# 公共設施圖層批次（civic-facilities-layers）

> **Slug**：`civic-facilities-layers`（上游 handoff slug 為 `public-facilities`，見 handoff.md 說明）
> **狀態**：wired + verified（接線完成，browser 驗收 8/8 PASS 2026-07-17；PR 待開）
> **Owner**：migu
> **上線日期**：待定（PR 未開）
> **相關 PR**：待開

## 一句話說明

公共設施 8 圖層批次：郵局 / i郵箱 / 活動中心（部分縣市）/ 機關便民據點 / 公共圖書館 / 社福中心 / 公有市場 / 公廁，全放 sidebar「基礎建設 Infrastructure > 公共設施」子群（接在既有 schools / convenienceStores 後）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | n | 色 / icon | 狀態 |
|---|---|---|---|---|---|
| postOffices | point | GeoJSON `public/civic_facilities/post_offices_national.geojson` | 1,278 | `#d32f2f` / Mail | ✅ 驗收 PASS |
| iPostBoxes | point | GeoJSON `public/civic_facilities/ibox_national.geojson` | 2,345 | `#ef6c00` / PackageCheck | ✅ 驗收 PASS |
| communityCenters | point | GeoJSON `public/civic_facilities/community_centers_national.geojson`（partial coverage 8 縣市） | 1,794 | `#26a69a` / Users | ✅ 驗收 PASS |
| govServiceOffices | point | GeoJSON `public/civic_facilities/gov_service_offices_national.geojson`（type 3 分色） | 702 | `#8d6e63` / Landmark | ✅ 驗收 PASS |
| publicLibraries | point | GeoJSON `public/culture/public_libraries_national.geojson` | 634 | `#5c6bc0` / BookOpen | ✅ 驗收 PASS |
| welfareCenters | point | GeoJSON `public/civic_facilities/welfare_centers_national.geojson` | 157 | `#ec407a` / HeartHandshake | ✅ 驗收 PASS |
| retailMarkets | point | GeoJSON `public/poi/public_retail_markets_national.geojson` | 731 | `#66bb6a` / ShoppingBasket | ✅ 驗收 PASS |
| publicToilets | point | GeoJSON `public/environment/public_toilets_national.geojson`（minzoom 11 zoom-gate + grade 4 級分色） | 13,281 | `#7e57c2` / Toilet | ✅ 驗收 PASS |

全 8 層皆為靜態 GeoJSON，走 `overlayRegistry` glow+circle 樣板；預設關；每層 opacity + scale 雙 slider + click popup。

## 關鍵檔案

- Overlay：`src/map/overlayRegistry.ts`（8 層樣板定義，含 govServiceOffices type 分色、publicToilets zoom-gate + grade 分色）
- Catalog：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + 「公共設施」子群 8 key；檔頭主題註解 14→22 已順手修正）
- Icon：`src/components/IconRailSidebar.tsx`
- 控制面板：`src/hooks/useTransportParams.ts`（opacity + scale slider）
- 點擊互動：`src/hooks/useMapInteraction.ts`
- Popup panels：`src/components/featureInfo/infraPanels.tsx` + `registry.tsx`
- Legend：`src/components/LegendPanel.tsx`（govServiceOffices type 圖例、publicToilets grade 圖例）
- 型別：`src/types/index.ts`（`LayerVisibility` 8 key）
- 資料來源歸屬：`src/data/upstreamRegistry.ts`（8 個 datasetId 全 HIGH）
- Chat 工具：`src/chat/tools/datasets.ts`
- Deploy 契約：`nginx.conf` + `scripts/deploy/pull-deploy-assets.sh`（補 `civic_facilities/` / `environment/` / `poi/` 三個子目錄）
- 一致性測試：`src/components/sidebar/__tests__/layerConsistency.test.ts`（6 個單色層進 `BASELINE_NO_LEGEND`）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/public-facilities.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

無。
