# Handoff — 都市形態 Urban Form（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/gba_canopy_frontend.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：`taipei-gis-analytics/data/processed/urban_composite/buildings_3d_gba/buildings_3d_taiwan.pmtiles`
  （複製進本 repo `public/urban/buildings_3d_taiwan.pmtiles`，139.8MB，**不進 git**，走 S3 deploy-assets）
- 更新頻率：`lifecycle: yearly`（見上游 `_manifest.json`）
- 座標系統：WGS84
- 資料量：152 萬棟本島（**不含外島**：澎湖/金馬未涵蓋，上游待補）
- source-layer：`buildings`；vector PMTiles z13–16

## 前端接線位置

- SSOT 色票/分級：`src/data/buildingsGbaTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（`id: "buildingsGba"`）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + SECTIONS 都市開放空間分區）

## 硬依賴欄位（改一定爆）

- `height`（float，公尺）— fill/fill-extrusion 染色分級、`fill-extrusion-height`、高度門檻 filter、
  popup 高度/估算樓層，**上游保證 100% 有值**（本檔各處未寫缺值 fallback UI，只在色階函式內部有
  `<=0 → 灰` 防呆）
- `src`（string，`"osm"` 或其他如 `"ours2"`）— 資料來源二色模式染色 + popup 資料來源標籤，前端把
  「非 osm 一律視為 GBA AI 推估」，若上游未來新增第三種 src 值，前端顯示不會壞（match 表達式仍
  fallback 到 GBA 紫色），但語意會不精確，需回頭跟上游確認新 src 值代表什麼

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| `src` 欄位新增第三種值（非 osm/GBA AI） | `buildingsGbaTypes.ts` 的 `BUILDING_SRC_LABELS`/`buildingSrcColorExpr` 要加分支 |
| 補外島（澎湖/金馬）圖磚 | 確認 z13-16 tile 範圍涵蓋外島 bbox，無需改前端程式（PMTiles 自動涵蓋新範圍） |
| 授權從 CC BY-NC 4.0 變更 | `BUILDINGS_GBA_ATTRIBUTION`（`buildingsGbaTypes.ts`）+ 本 README 的授權敘述都要跟改 |

## 已知不對稱

- 上游 handoff 原文把此圖層規劃給 **mini-taiwan-terrain**（3D 立體房子專案），本次改為直接上線在
  **mini-taiwan-pulse**（依實際指派任務），故沿用同一份 PMTiles，但前端接線位置與上游文件描述的
  maplibre 範例程式碼不同（本專案是 mapbox-gl + pmtiles protocol，overlayRegistry 架構）。
- 上游把「filter 支援 fill-extrusion」視為理所當然（POC demo 直接寫死 paint），未提及
  `fill-extrusion-opacity` 不支援 data-driven 表達式的限制；本專案為此把
  `OverlayLayerSpec.filter` 擴充成函式形式（見 README.md「額外」段），純前端架構調整，
  不影響資料契約本身。
