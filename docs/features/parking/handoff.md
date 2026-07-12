# Handoff — 停車 parking（下游視角）

> 契約定義在 gis-platform migration `286_parking_ref_tables.sql`（參考表）+ `287_parking_current_rpcs.sql`（join RPC）。
> 座標 collector：`data-collectors/collectors/parking_ref.py`（月更手動，灌 spatial.*_ref）。

## 上游 handoff 摘要

- 即時可用性：`realtime.parking_segments_current`（路邊）+ `realtime.parking_lots_current`（場外）— **無座標**
- 靜態座標 ref：`spatial.parking_segments_ref`（台北有 POLYGON geom）+ `spatial.parking_lots_ref`（點）
- RPC（public，anon，SECURITY DEFINER 讀 realtime+spatial）：
  - `get_parking_segments_current()` → segment_id/city/segment_name/lon/lat/**geom(台北 POLYGON GeoJSON, 其餘 null)**/total_spaces/available_spaces/**availability_rate(台北 null)**/full_status/charge_status/space_types
  - `get_parking_lots_current()` → car_park_uid/car_park_name/source_category/sub_category/lon/lat/address/car_park_type/ev_charging/total_spaces/available_spaces/availability_rate/full_status/charge_status/space_types

## 前端接線位置

- Loader：`src/data/parkingLoader.ts`（兩 RPC + geom 分流 FeatureCollection + 色階 helper）
- Hook：`src/hooks/useParkingLayer.ts`（fill 台北 polygon + circle 新北台中/場外，當下快照不接 timeStore）
- Overlay：`src/map/overlayRegistry.ts`（geometry-type filter 拆層）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS ×2 + 交通 §停車 Parking）
- Popup：`src/components/featureInfo/parkingPanels.tsx`

## 硬依賴欄位（改一定爆）

- `segment_id` / `car_park_uid` — join ref 表鍵（座標來源）；car_park_uid = `authority_code_car_park_id`
- `geom`（台北路邊）/ `lon`,`lat`（其餘）— 前端 geometry-type 分流依據
- `availability_rate` null（台北路邊）→ 中性色分流訊號；guard 即時 available=-1

## 上游改動 → 下游要跟改

| 上游改動 | 下游動作 |
|---|---|
| 補 phase-2 城市座標（各府開放資料）| collector 加來源 + ref 表灌入，前端自動多點 |
| TDX 靜態欄位改名 | parking_ref collector mapper 調整 |
| 即時表 join 鍵格式變 | ref 表 PK + RPC USING 同步 |

## 已知不對稱

- **座標覆蓋率天生 <100%**：TDX 即時 vs 靜態是兩套獨立資料集、母體不一致。inner join 只回有座標的段/場，無座標者不渲染。
- 台北路邊 available 全 -1（僅容量無即時空位）→ 中性色；其餘城市走空位率綠紅。
