# Bus（公車 Live + Replay）

> **Slug**：`bus`
> **狀態**：shipped（progress-based 架構 + fade in/out + race 修復完成）
> **Owner**：migu
> **上線時分支**：master（`b3bef73` + `bc4b3e9`）
> **memory 時點**：2026-04-14

## 一句話說明

用「route progress」而非「位置」當狀態變數，讓公車在 Live 與 Replay 兩模式下沿路網幾何、順暢淡入淡出、不切角。

## 圖層 / 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| bus (Live) | 3D InstancedMesh + shader alpha | Supabase RPC poll | ✅ |
| bus (Replay) | 3D InstancedMesh，`buildProgressPath` 預計算 `(ts, progress, tripId)` | RPC + LRU cache | ✅ |

## 關鍵檔案

- 主邏輯（~700 行）：`src/engines/BusEngine.ts`
- 渲染 + shader alpha：`src/three/BusScene.ts`（`onBeforeCompile` 注入 per-instance `aAlpha`）
- RPC 包裝：`src/data/busLoader.ts`
- Hook：`src/hooks/useBusLayer.ts`（Live poll + Replay LRU）
- 完整架構文件：[`docs/bus-layer-design.md`](../../bus-layer-design.md)

## 核心設計

- **狀態變數 = route progress**，位置永遠由 `interpolateOnLineString` 從 progress 生成 → 幾何上保證沿路線、不切角
- **Fade in/out（B+C 方案）**：trail 頭尾 60s 淡入淡出；跨 trip 前半淡出停 p1、後半淡入停 p2；Live 新車淡入
- **Live progress 跳躍偵測** + `rejectStreak` 防卡住
- **Replay trip segmentation**：`TRIP_GAP_SECONDS = 900`

## 關鍵常數（`BusEngine.ts` 頂部）

- `TRIP_GAP_SECONDS = 900`
- `TRIP_BACKWARD_THRESHOLD = 0.3`
- `MIN_BACKWARD_TOLERANCE = 0.02`
- `MAX_ANOMALY_SPEED_KMH = 80`
- `MAX_CONSECUTIVE_REJECTS = 3`
- `FADE_SECONDS = 60`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/bus.md`（尚未建，待補）。

## 相關 backlog

看 [backlog.md](./backlog.md) — 全台擴展要點。

## 相關文件

- 全站 memory：`~/.claude/projects/.../memory/bus-replay-smoothing-status.md`
- 設計文件：`docs/bus-layer-design.md`
