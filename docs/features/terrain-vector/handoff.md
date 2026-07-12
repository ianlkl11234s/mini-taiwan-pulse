# Handoff — terrain-vector（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/terrain-vector.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：
  - S3 `deploy-assets/base_map/slope_vector.pmtiles`（16 MB, source-layer=`slope`, z5–12）
  - S3 `deploy-assets/base_map/aspect_vector.pmtiles`（16 MB, source-layer=`aspect`, z5–12）
- 更新頻率：靜態（DTM 更新或調 RES 時上游手動重跑 → 覆蓋同名 → 上 S3）
- 座標系統：WGS84
- 資料量：slope 65,617 polygon / aspect 108,719 polygon
- class 0（海域 / nodata）已在上游濾除，前端不會收到

（完整契約 → 上游 handoff）

## 前端接線位置

- Hook：`src/hooks/useSlopeVectorLayer.ts` / `src/hooks/useAspectVectorLayer.ts`（各自管 addSource/addLayer + feature-state 染色；無獨立 loader，PMTiles 直載）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` slopeVector `#fc8d59` / aspectVector `#ff7f00` + `SECTIONS`）
- 圖例：`src/components/LegendPanel.tsx`
- Popup：`src/hooks/useMapInteraction.ts` + `src/components/featureInfo/baseMapPanels.tsx` + `registry.tsx`
- 透明度：`src/hooks/useTransportParams.ts`
- 來源標記：`src/data/upstreamRegistry.ts`
- 接線：`src/App.tsx` + `src/types/index.ts`（`LayerVisibility`）+ `src/components/IconRailSidebar.tsx`

## 硬依賴欄位（改一定爆）

| PMTiles | source-layer | 欄位 | 值域 | 前端用途 |
|---|---|---|---|---|
| slope_vector | `slope` | `slope_class` | int 1–6 | feature-state 染色 + 圖例 + popup 分級中文 |
| aspect_vector | `aspect` | `aspect_class` | int 1–9 | feature-state 染色 + 圖例 + popup 方位中文 |

- `slope_class` 值義：1=<5% / 2=5-15% / 3=15-30% / 4=30-40% / 5=40-55% / 6=>55%
- `aspect_class` 值義：1=N 2=NE 3=E 4=SE 5=S 6=SW 7=W 8=NW，9=平地

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 改 source-layer 名（`slope`/`aspect`） | hook 的 `source-layer` 要同步改，否則整層消失 |
| 改欄位名 / 值域（`slope_class`/`aspect_class`） | 染色表達式 + 圖例 + popup 對照全要改 |
| 調 RES（polygon 數 / 檔案變大） | 檢查前端載入 / minzoom 是否要調 |
| apply migration 289（③ H3 上線） | 才可接 RPC `get_h3_terrain`；未 apply 前不要接 |
| 檔名 / 欄位不變、僅重出 | 前端無需改，S3 覆蓋即生效 |

## 已知不對稱

- 上游 raster [[slope]]/[[aspect]]（uint8 量化 COG）與本向量分級圖層**是兩套產物**：raster 版精確值可查、向量版只給分級。前端已移除舊 PNG raster 版，改用向量版；若日後要「精確坡度數值查詢」需回頭接 raster 或上游 ② `terrain_zonal`。
- ③ `h3_terrain` / RPC `get_h3_terrain` 在上游已備 parquet + migration 289，但**下游尚未接、migration 未 apply**（見 backlog TV-1）。
- aspect 平地閾值（slope<5°）與 slope class 1（<5% ≈ 2.862°）定義相容但非等值，跨層疊圖比對時留意。
