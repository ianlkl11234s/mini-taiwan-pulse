# 都市形態 Urban Form

> **Slug**：`urban-form`（與 taipei-gis-analytics handoff `gba_canopy_frontend.md` 對應建物段一致）
> **狀態**：dev（tsc/test 全綠，未開 PR）
> **Owner**：migu_cheng
> **上線日期**：（待 PR merge）
> **相關 PR**：（待開）

## 一句話說明

全台 3D 建物輪廓（GlobalBuildingAtlas + OSM 融合，152 萬棟本島）：可切換「高度 6 級分級」
「資料來源二色」「3D 立體」三種顯示模式，並提供高度門檻篩選（只看 ≥ X 公尺）。
另加「都市紋理網格」：全台 500m 網格（145,119 格），把建物量體統計與樹冠灰綠比合成六指標
choropleth（棟數密度/平均高度/總量體/建蔽率/樹冠覆蓋/灰綠指數，預設灰綠指數）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| buildingsGba | polygon（fill + fill-extrusion 雙 suffix） | PMTiles（`public/urban/buildings_3d_taiwan.pmtiles`） | ✅ |
| urbanFormGrid | polygon（單一 fill sublayer） | PMTiles（`public/urban/urban_form_grid_500m.pmtiles`） | ✅ |

Scope 說明：本 feature 涵蓋「建物輪廓」+「都市紋理網格」兩個圖層，皆衍生自同一組 GBA
建物 + Meta 樹冠上游資產。

## 關鍵檔案（buildingsGba）

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

## 關鍵檔案（urbanFormGrid）

- SSOT 色票/分級/模式：`src/data/urbanFormGridTypes.ts`（六模式 `URBAN_FORM_GRID_MODES`，
  每模式含 field/bands/zeroFade）
- Overlay：`src/map/overlayRegistry.ts`（`id: "urbanFormGrid"`，單一 `fill` suffix；不設
  `rebuildOnParamChange`，全靠 paint 表達式隨 modeIdx 切換，同 streetTreesTaipei3epoch 機制）
- Catalog：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS 都市開放空間分區）
- Icon：`src/components/IconRailSidebar.tsx`（lucide `LayoutGrid`）
- 參數：`src/hooks/useTransportParams.ts`（`urbanFormGridModeIdx` 預設 5=灰綠指數 /
  `urbanFormGridOpacity` 預設 0.55；6 選項 select 觸發原生 dropdown）
- Legend：`src/components/LegendPanel.tsx`（`UrbanFormGridLegend`，依 modeIdx 切分級 + 雙署名）
- Popup：`src/components/featureInfo/urbanPanels.tsx`（`UrbanFormGridPanel`，六值全列）+
  `src/components/featureInfo/registry.tsx`
- Click 註冊：`src/hooks/useMapInteraction.ts`
- 跨 repo 對照：`src/data/upstreamRegistry.ts`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：
- buildingsGba：`taipei-gis-analytics/docs/handoff/gba_canopy_frontend.md`
  （該檔同時涵蓋建物 3D 與樹冠高度兩份產出；樹冠已在 forestry 主題的 `canopyHeight` layer 上線）
- urbanFormGrid：`taipei-gis-analytics/docs/handoff/urban-form-grid.md`
  （建物 + 樹冠合成的 500m 網格，六欄 choropleth）

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- 無（未動資料契約，僅前端接線）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/gba_canopy_frontend.md`
- 開發規則：`../../development-rules.md`
