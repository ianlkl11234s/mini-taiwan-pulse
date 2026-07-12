# 水資源 Water Resources（湖泊 / 埤塘）

> **Slug**：`water-resources`（水資源既有圖層原分散在 `layerCatalog.ts` 的「水資源 Water」主題，本檔案是該主題下新增
> `lakesPondsOsm` 圖層的最小文件；既有 `waterBasins` / `waterReservoirs` 等點/線圖層無獨立 feature 文件，沿用 STATUS.md）
> **狀態**：dev（已驗證，未 push）
> **Owner**：migu
> **上線日期**：（pending）
> **相關 PR**：（pending）
> **Branch**：`feat/aquaculture-layers`

## 一句話說明

全台湖泊/埤塘/池塘面圖層（OSM `natural=water`，52,314 面），補政府端「僅 129 座官方水庫」的缺口。掛在 Layers 側欄「水資源 Water」主題「面 / 線」分組，**公開（非 owner-gated）**，預設關。

## 圖層 / 元件

| layer key | 名稱 | 類型 | 資料源 | 顏色 | 筆數 | minzoom |
|---|---|---|---|---|---|---|
| `lakesPondsOsm` | 湖泊 / 埤塘 | PMTiles fill+line | `public/water_resources/lakes_ponds_osm.pmtiles`（sourceLayer `lakes_ponds_osm`, z5–14, keep_attrs osm_id/osm_type/name/water/area_ha/overlaps_aquaculture/overlaps_wra_reservoir） | `water` 分類 4 色：pond `#4fc3f7` / lake `#1e88e5` / reservoir `#00acc1` / basin `#7e57c2` | 52,314（OSM, ODbL） | pmtiles 原生 z5，靜態 filter 濾掉 overlaps_aquaculture |

## 樣式決策

- **`water` 欄位 4 分類分色**（pond/lake/reservoir/basin），fill+line 皆用 `["match", ["get","water"], ...]`。
- **靜態 filter 預設濾掉 `overlaps_aquaculture=true`**（39.1%、20,459 筆與 `aquaculturePonds` 圖層重疊，避免視覺打架）。本專案的 `OverlayConfig.filter` 是 build-time 靜態機制（layer 建立時套用一次，非 runtime 可切換），且掃過現有 codebase 沒有「輕量 boolean filter toggle」的既有慣例可套（僅 `usePollutionLayers.ts` 等重量級 dedicated hook 才有 runtime `setFilter`），故採「寫死預設濾掉」而非新增 toggle UI，於圖例/popup 註明「已濾掉與魚塭圖層重疊者」。
- 不與 `waterReservoirs`（129 座官方水庫）UNION：授權（ODbL vs OGDL）與粒度不同，兩者並存不合併去重。

## 關鍵檔案

- Overlay：`src/map/overlayRegistry.ts`（`lakesPondsOsm`，fill+line + 靜態 filter）
- Popup：`src/hooks/useMapInteraction.ts` + `src/components/featureInfo/waterPanels.tsx`（`LakesPondsPanel`）+ `src/components/featureInfo/registry.tsx`
- Opacity slider：`src/hooks/useTransportParams.ts`（`lakesPondsOsmOpacity`）
- Legend：`src/components/LegendPanel.tsx`（`LakesPondsLegend`）+ `LEGEND_REGISTRY`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + `SECTIONS`「水資源 Water」→「面 / 線」分組）+ `src/components/IconRailSidebar.tsx`（`Waves` icon）
- Types：`src/types/index.ts`（`LayerVisibility` 加 `lakesPondsOsm`；`FeatureInfo["layerType"]` / `ExpandableLayerKey` 同步）
- Upstream registry：`src/data/upstreamRegistry.ts`

## 資料契約摘要

- **座標系統**：WGS84
- **欄位**：`osm_id` / `osm_type`（識別，未在前端顯示）、`name`（popup，僅 4.4% 有值，空值自動隱藏）、`water`（popup + 分色，pond/lake/reservoir/basin）、`area_ha`（popup）、`overlaps_aquaculture`（filter 硬依賴，boolean）、`overlaps_wra_reservoir`（未在前端使用）。
- **⚠️ 硬依賴**：sourceLayer 名 `lakes_ponds_osm` 改名 → source 掛不上；`overlaps_aquaculture` 改型別（如 0/1 字串化）→ filter 表達式失效變成全部顯示（含重疊魚塭者）。
- **授權**：OSM ODbL，不可與政府資料 UNION，attribution 需保留「© OpenStreetMap contributors」。
- 完整上游契約：`../../../taipei-gis-analytics/docs/data-catalog/water_resources/lakes_ponds_osm.md`

## 已知不對稱 / 待決

- **部署方式未定**：11.3MB pmtiles 進 git 版控 vs gitignore + S3（`upload-deploy-assets.sh` 已備 S3 路徑，走 `water_resources/` 子前綴）— 待用戶決定。
- **屬性極稀疏**：僅 4.4% 有 `name` → popup 多顯示分類色塊 + 面積，非 bug。
- **狀態**：已驗證，**未 commit / 未 push**；PR / squash hash pending。

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/data-catalog/water_resources/lakes_ponds_osm.md`
- 同一輪新增的姊妹圖層（衛星偵測養殖水體）：[../aquaculture/](../aquaculture/)
- 開發規則：`../../development-rules.md`
