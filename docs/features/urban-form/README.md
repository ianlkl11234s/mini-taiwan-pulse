# 都市形態 Urban Form

> **Slug**：`urban-form`（與 taipei-gis-analytics handoff `gba_canopy_frontend.md` 對應建物段一致）
> **狀態**：dev（tsc/test 全綠，未開 PR）
> **Owner**：migu_cheng
> **上線日期**：（待 PR merge）
> **相關 PR**：（待開）

## 一句話說明

全台 3D 建物輪廓（GlobalBuildingAtlas + OSM 融合，152 萬棟本島）：可切換「高度 6 級分級」
「資料來源二色」「3D 立體」三種顯示模式，並提供高度門檻篩選（只看 ≥ X 公尺）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| buildingsGba | polygon（fill + fill-extrusion 雙 suffix） | PMTiles（`public/urban/buildings_3d_taiwan.pmtiles`） | ✅ |

Scope 說明：本 feature 目前只涵蓋「建物輪廓」單一圖層。上游 handoff 中提到、但**尚未接線**的
「網格統計層」（例如建物密度/樓層分布網格聚合）留在 [backlog.md](./backlog.md) 待規劃。

## 關鍵檔案

- SSOT 色票/分級：`src/data/buildingsGbaTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（`id: "buildingsGba"`，suffix `fill` + `extrusion`）
- Catalog：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS 都市開放空間分區）
- Icon：`src/components/IconRailSidebar.tsx`
- 參數：`src/hooks/useTransportParams.ts`（`buildingsGbaModeIdx` / `buildingsGbaMinHeight` / `buildingsGbaOpacity`）
- Legend：`src/components/LegendPanel.tsx`（`BuildingsGbaLegend`）
- Popup：`src/components/featureInfo/urbanPanels.tsx`（`BuildingsGbaPanel`）+ `src/components/featureInfo/registry.tsx`
- Click 註冊：`src/hooks/useMapInteraction.ts`
- 跨 repo 對照：`src/data/upstreamRegistry.ts`
- **額外（非標準 8 步）**：`src/map/overlayManager.ts` — 為了讓「高度門檻」slider 能把當下值烤進
  `filter`（`fill-extrusion-opacity` 不支援 data-driven，不能走既有 opacity 歸零篩選法），把
  `OverlayLayerSpec.filter` 從純陣列擴充成「陣列 or 函式」，並在 rebuild 偵測的 paint snapshot
  裡併入 filter 指紋（否則只改 minHeight、paint 沒變時偵測不到要 rebuild）。這是本 repo第一個
  param-driven filter 案例，細節見 handoff.md。

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/gba_canopy_frontend.md`
（該檔同時涵蓋建物 3D 與樹冠高度兩份產出；樹冠已在 forestry 主題的 `canopyHeight` layer 上線）。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- 無（未動資料契約，僅前端接線）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/gba_canopy_frontend.md`
- 開發規則：`../../development-rules.md`
