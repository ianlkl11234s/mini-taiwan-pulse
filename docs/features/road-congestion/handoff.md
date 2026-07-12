# Handoff — 路況 road_congestion（下游視角）

> 契約定義在 gis-platform migration `285_road_congestion_daily.sql` + PMTiles pipeline。
> 幾何 PMTiles pipeline：`taipei-gis-analytics/pipelines/transportation/road/06_export_highway_congestion_pmtiles.sh`

## 上游 handoff 摘要

- 資料源：TDX Road/Traffic/Live/Highway（`collectors/road_congestion.py`，5 分鐘）
- 即時表 `realtime.road_sections_live`（分區）+ `road_sections_current`；幾何 `reference.road_sections_geometry`
- pre-aggregate `realtime.road_congestion_daily`（每段一列 288 字元 timeline，7 天保留）
- RPC（public，anon）：
  - `get_road_congestion_day(target_date date)` → `section_uid, section_id, timeline`（288 char：'1'-'4'=level, '-'=無資料，5min 槽 Asia/Taipei 對齊）
  - `get_road_congestion_dates()` → `day, sections`
- PMTiles `public/road/road_congestion_highway.pmtiles`（source-layer `road_congestion_highway`，promoteId `section_uid`，keep_attrs section_uid+section_id）

## 前端接線位置

- Loader：`src/data/roadCongestionLoader.ts`（RPC + 288 解碼 slotIndexAt/levelFromChar）
- Hook：`src/hooks/useRoadCongestionLayer.ts`（PMTiles vector source + promoteId + feature-state 染色 + hit 層 + timeStore）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + 即時監控 §）
- Popup：`src/components/featureInfo/roadPanels.tsx`（RoadCongestionPanel）

## 硬依賴欄位（改一定爆）

- `section_uid` — PMTiles promoteId + RPC join 鍵（feature-state 染色）；**PMTiles 與 RPC 的 section_uid 必須逐字相符**（皆 `highway_` 前綴）
- `timeline` 288 字元格式 + 5min 槽 + Asia/Taipei 對齊 — 解碼不變量
- PMTiles source-layer name `road_congestion_highway`

## 上游改動 → 下游要跟改

| 上游改動 | 下游動作 |
|---|---|
| 幾何表新增/改段 | 重跑 06 script 重出 PMTiles + 上傳 S3 |
| refresh 頻率改 | 前端 clamp 延遲假設要調 |
| 加 city v2 | 出 city PMTiles + loader source='city' |

## 已知不對稱

- refresh 落後當下 ~15-18 分鐘（pre-aggregate 固有）→ 前端 clamp 到最新可得快照。
- PMTiles 6818 段 vs 即時 6658 段（幾何全集 > 當天有資料段）→ 無 timeline 的段染灰。
