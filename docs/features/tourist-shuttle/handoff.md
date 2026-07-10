# Handoff — 台灣好行 tourist_shuttle（下游視角）

> 契約定義在 gis-platform migration `284_tourist_shuttle_rpcs.sql` + route JSON pipeline。
> 中游 route JSON pipeline：`taipei-gis-analytics/pipelines/transportation/bus/08_build_tourist_shuttle_routes.py`

## 上游 handoff 摘要

- 資料源：TDX `/v2/Tourism/Bus/RealTimeByFrequency/TaiwanTrip`（`collectors/tourist_shuttle.py`，2 分鐘）
- 表：`realtime.tourist_shuttle_current`（564 台）+ `realtime.tourist_shuttle_positions`（分區 7 天）+ `realtime.tourist_shuttle_trails_daily`（預聚合 30 天）
- RPC（public，anon）：
  - `get_tourist_shuttle_current()` 無參數 → `plate_numb, route_uid, sub_route_uid, route_name(=sub_route_name), taiwan_trip_name, operator_id, direction, bus_lat, bus_lng, speed, collected_at`
  - `get_tourist_shuttle_trails(target_date date)` → `plate_numb, direction, route_uid, sub_route_uid, route_name, operator_id, trail`
  - `get_tourist_shuttle_dates()` → `day, records, buses`
- 路線幾何：`public/bus/tourist_shuttle_routes.json`（key=`{route_uid}_{direction}`，命中率 100%）

## 前端接線位置

- Loader：`src/data/touristShuttleLoader.ts`（current/trails/dates + route JSON fetch）
- Hook：`src/hooks/useTouristShuttleLayer.ts`（重用 `BusEngine`，Live 30s poll + Replay LRU + timeStore）
- Scene：`useThreeJsLayers.ts` `addTouristShuttleLayer`（id `tourist-shuttle-3d`）→ `createBusLayer`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + 交通 §即時運具）
- Popup：`useMapInteraction.ts` `pickBus` 分支（重用 bus tooltip）

## 硬依賴欄位（改一定爆）

- `route_uid` + `direction` — resolveRouteKey 對 route JSON key（`{route_uid}_{direction}`）
- `bus_lat` / `bus_lng` — BusPosition 座標（migration 已別名 lat/lng → bus_lat/bus_lng）
- `trail` 字串格式 `"lat,lng,unix_ts;..."` — BusEngine parseTrail
- route JSON 的 `coords/cumDist/totalDist/stopProgress` — progress 投影不變量

## 上游改動 → 下游要跟改

| 上游改動 | 下游動作 |
|---|---|
| 好行新增路線 | 重跑 `08_build_tourist_shuttle_routes.py` 更新 route JSON |
| refresh cron 改頻率 | Replay 資料密度變，timeStore 節流可能要調 |
| 走 sub_route_uid v2 幾何 | BusEngine resolveRouteKey 改吃 sub_route_uid + route JSON 重出 |

## 已知不對稱

- v1 route JSON 是 route_uid 級（多子線挑最長）；即時 feed 有 sub_route_uid 但 v1 未用於幾何配對。
