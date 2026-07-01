# Handoff — bus（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/bus.md`（尚未建，待補）
>
> 契約細節看上游，本檔只放前端接線簡表。

## 上游摘要

- 產物：
  - Supabase RPC（Live poll + Replay 分頁）
  - 路線 shape JSON（18MB，Live 車輛 progress 依賴）
- 預處理腳本：**待建** `scripts/preprocess/build_bus_routes.py`
- 座標：WGS84
- 資料量：全台擴展路線 JSON 預估 60~100MB

## 前端接線位置

- 主邏輯：`src/engines/BusEngine.ts`（~700 行）
- 渲染：`src/three/BusScene.ts`（InstancedMesh + shader alpha via `onBeforeCompile`）
- Loader：`src/data/busLoader.ts`
- Hook：`src/hooks/useBusLayer.ts`（Live poll + Replay LRU）

## 硬依賴欄位（改一定爆）

- 路線 shape：LineString 幾何 — `interpolateOnLineString` 從 `progress ∈ [0,1]` 生成位置
- 車輛 trail：`ts` / `progress`（或原始位置轉出）/ `tripId` / `routeKey`
- `routeKey` — `progressPath` 對照的 key（若改名或型別，`ensureProgressPaths` 立爆）

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 加新城市（超出 `BusCity` enum） | 擴充 enum + `useBusLayer.cities` prop + lazy load |
| 路線 shape 幾何改動 | `progressPath` 重建；車量大時可能要調 `MAX_INSTANCES` |
| 改 RPC 分頁 / poll 頻率 | Live poll cadence + Replay LRU 大小可能要調 |
| trail 頻率變高 | `TRIP_GAP_SECONDS = 900` / `MAX_ANOMALY_SPEED_KMH = 80` 可能要調 |

## 已知不對稱

- 上游 `docs/handoff/bus.md` **尚未建** — 路線 shape 產出流程、`routeKey` 定義都散在其他文件
- 全台擴展前 `MAX_INSTANCES` 上限、路線 JSON 是否切檔 by city — memory 只列「要點」未定案
- 預處理腳本 `scripts/preprocess/build_bus_routes.py` **尚未建**

## TBD

- memory 距今 78 天，實際上線範圍（全台？多城？）— 待用戶確認
- 上游是誰負責產路線 shape JSON（taipei-gis-analytics / data-collectors / mini-taipei-v3?）
