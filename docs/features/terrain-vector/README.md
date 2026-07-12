# Terrain Vector（坡度 / 坡向分級向量）

> **Slug**：`terrain-vector`（與 `taipei-gis-analytics/docs/handoff/terrain-vector.md` 一致）
> **狀態**：shipped
> **Owner**：migu
> **上線日期**：2026-07-11
> **相關 commit**：`f648f8d` `9a59066` `5e0554a`（已 S3 部署 + push）

## 一句話說明

把全臺地形從「PNG 底圖」升級為**可點選、可染色、可篩選的向量分級圖層** — 坡度依台灣建管六級坡（開發限制判斷）、坡向依 8 方位 + 平地（日照 / 光電 / 適栽），並移除舊的 raster PNG 版。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `slopeVector`（坡度分級 Slope 6級） | polygon（PMTiles, feature-state 染色） | S3 `deploy-assets/base_map/slope_vector.pmtiles`, source-layer=`slope` | ✅ |
| `aspectVector`（坡向分級 Aspect 8向） | polygon（PMTiles, feature-state 染色） | S3 `deploy-assets/base_map/aspect_vector.pmtiles`, source-layer=`aspect` | ✅ |

**移除**：舊 raster PNG 坡度 / 坡向圖層（commit `5e0554a`）— 由本向量版取代。

**上游附帶（未接前端）**：
- ② `terrain_zonal`（AOI 地形統計工具，on-demand，無前端）
- ③ `h3_terrain`（H3 res8 地形指標 + migration 289）— **未 apply，前端未接**（見 backlog）

## UX 四鐵則落點

| 鐵則 | 落點 |
|---|---|
| 1. 透明度 slider | `src/hooks/useTransportParams.ts`（slopeVector / aspectVector opacity） |
| 2. 分類 ≥2 → 圖例 | `src/components/LegendPanel.tsx`（slope 6 級色階 + aspect 9 類方位色環） |
| 3. 可選取 → click popup | `src/hooks/useMapInteraction.ts` + `src/components/featureInfo/baseMapPanels.tsx` + `registry.tsx`（點面顯示 class 中文） |
| 4. select ≥4 → dropdown | 不適用（本為 toggle 圖層，分級以 catalog `expandable` 子項呈現，無 select 控制項） |

## 關鍵檔案

- Hook：`src/hooks/useSlopeVectorLayer.ts` / `src/hooks/useAspectVectorLayer.ts`（各自管 addSource/addLayer + feature-state 染色；PMTiles 直載，無獨立 loader）
- Catalog：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` slopeVector `#fc8d59` / aspectVector `#ff7f00` + `SECTIONS` 分區）
- Legend：`src/components/LegendPanel.tsx`
- Popup：`src/components/featureInfo/baseMapPanels.tsx` + `src/components/featureInfo/registry.tsx` + `src/hooks/useMapInteraction.ts`
- Opacity：`src/hooks/useTransportParams.ts`
- 來源標記：`src/data/upstreamRegistry.ts`
- 接線：`src/App.tsx` + `src/types/index.ts`（`LayerVisibility` 加 key）+ `src/components/IconRailSidebar.tsx`

## 資料流

```
NLSC 20m DTM (taipei-gis-analytics 本機)
  → GDAL 重算 slope/aspect → 分級 → sieve → polygonize → tippecanoe PMTiles
  → S3 deploy-assets/base_map/{slope_vector,aspect_vector}.pmtiles
  → 前端 useSlopeVectorLayer / useAspectVectorLayer 直載 PMTiles source
  → feature-state 依 slope_class(1-6) / aspect_class(1-9) 染色
  → LegendPanel 圖例 + click popup 顯示分級中文
```

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/terrain-vector.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- （無）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/terrain-vector.md`
- 上游 catalog：`../../../taipei-gis-analytics/docs/data-catalog/base_map/{slope_vector,aspect_vector}.md`
- 開發規則：`../../development-rules.md`
