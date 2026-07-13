# 行道樹變化 Street Tree Diff（台北）

> **Slug**：`street_trees_taipei_diff`（與 `taipei-gis-analytics/docs/handoff/street_trees_taipei_diff.md` 一致）
> **狀態**：dev（本地接線完成，未 push）
> **Owner**：migu
> **上線日期**：（pending）
> **相關 PR**：（pending）

## 一句話說明

台北市行道樹 2024/11 基準 vs 現在的「三狀態變化」點圖層：存續（persisted）/ 消失（disappeared）/ 新增（appeared）。掛在 Layers 側欄「環境氣候 Environment」主題下新分組「都市開放空間 Urban Open Space」，公開（非 owner-gated），預設關閉。

## 圖層 / 元件（🌳 都市開放空間分組，1 layer，預設關）

| layer key | 名稱 | 類型 | 資料源 | 顏色 | 筆數 | zoom |
|---|---|---|---|---|---|---|
| `streetTreesTaipeiDiff` | 行道樹變化 | PMTiles circle | `public/urban/street_trees_taipei_diff.pmtiles`（sourceLayer `street_trees_taipei_diff`, z5–14） | `status` 三色：`#2e7d32` 綠（persisted）/ `#e53935` 紅（disappeared）/ `#9ccc65` 淺綠（appeared） | 99,527 點 | pmtiles 原生 z5–14 |

> 單一 circle layer；`status` 用 `match` 分三色；`renumber_suspect=true`（真 boolean）用透明度降 0.35 倍避免誤讀為真消失/新增。狀態篩選 select（全部 / 只看消失 / 只看變動）走 opacity 篩選（filter 靜態，只 paint 隨 param 重算，仿 aquacultureWaterSatellite 信心層級慣例）。

## 資料路由（前端 CDN 靜態，不打 Supabase）

- **前端（用戶讀）→ CDN 靜態，走 `public/urban/`**：
  - `streetTreesTaipeiDiff` → `street_trees_taipei_diff.pmtiles`（3.1MB，向量磚）
- **無 Supabase、無 RPC**（同 fishery/agriculture 靜態面資料那一層）。
- 部署走 **D 類（≥2MB PMTiles）**，新 group `urban/`：`.gitignore` 排除 + upload/pull/nginx 三處已接（見 handoff.md）。

## 渲染參數

- 單 circle layer：`circle-color` 依 `status` match 三色；`circle-opacity` 用 `case` 判 `renumber_suspect` 降透明 + status 篩選；`circle-radius` 隨 zoom `interpolate`（z5=1 → z14=4.5），避免低 zoom 糊成一片。
- 控制項：狀態 select（all/disappeared/changed，編成 idx 進 paint）+ 透明度 slider（預設 0.7）。
- 預設關閉（`false`，未列入 `useLayerVisibility` 的 `DEFAULT_ON` → 自動派生 false）。

## 關鍵檔案

- Overlay：`src/map/overlayRegistry.ts`（`streetTreesTaipeiDiff` OverlayConfig，circle）
- Catalog：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + THEMES「環境氣候」→「都市開放空間」子分組）
- Icon：`src/components/IconRailSidebar.tsx`（`TreePine`）
- 參數：`src/hooks/useTransportParams.ts`（opacity slider + status select）
- Legend：`src/components/LegendPanel.tsx`（`StreetTreesTaipeiDiffLegend` + `LEGEND_REGISTRY`）
- Popup：`src/hooks/useMapInteraction.ts` + `src/components/featureInfo/urbanPanels.tsx`（`StreetTreesTaipeiDiffPanel`）+ `registry.tsx`
- Upstream registry：`src/data/upstreamRegistry.ts`
- Types：`src/types/index.ts`（`LayerVisibility` / `ExpandableLayerKey` / `FeatureInfo` 三處加 key）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/street_trees_taipei_diff.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。
