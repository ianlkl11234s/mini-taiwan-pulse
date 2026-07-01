# Imagery（雷達 / 衛星 / 雨量柵格 timeline）

> **Slug**：`imagery`
> **狀態**：✅ shipped（2026-06-10 修完 StrictMode disposedRef 坑 + migration 160 抽稀 RPC）
> **Owner**：migu
> **上線時分支**：master (`d85f5be` + gis-platform migration 160)
> **memory 時點**：2026-06-10

## 一句話說明

雷達 / 衛星 / 雨量柵格三種 raster 圖層的 timeline 歷史播放，前端策略依資料源 cadence 差異客製（雷達歷史抽稀 30min、雨量不設過舊門檻）。

## 圖層 / 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| 雷達 raster | raster tile timeline | CWA O-A0058-005（10min cadence，DB 自 2026-04-07 起完整保留） | ✅ 歷史用 `p_step_minutes=30` 抽稀 |
| 衛星 raster | raster tile timeline | CWA O-C0042-004（10min cadence） | ✅ |
| 雨量柵格 | raster tile timeline | IoW `precipitation_raster_frames`（1h 產品每 1~2h 一張、24h 產品約一天一張） | ✅ 不設過舊門檻 |

## 資料源特性（決定前端策略）

- **雷達 / 衛星**：10min cadence，DB 完整保留自 2026-04-07 起。雷達 frame 變大（avg ~630KB，單日 ~90MB base64）
  - 歷史日：`p_step_minutes=30` 抽稀（~32MB）
  - 今天：全解析度滾動 24h
- **雨量柵格**：來源發布**不規律** — 1h 產品每 1~2h 一張、**24h 產品約一天一張**；collector 自 2026-06-05 才開始收
  - 前端**不可設「過舊隱藏」門檻**（會把 24h 產品永遠隱藏）
  - 顯示「不晚於當前時間的最近一張」即可
  - 載入窗前推 48h margin

## 關鍵檔案

- Hook / Loader 位置：未在 memory 明列（TBD — 對照 `src/hooks/`、`src/data/` 找 imagery/radar/rain 相關）
- 相關 RPC：migration 160（`p_step_minutes` 抽稀 RPC）
- 相關記憶：[[feedback_dynamic_layer_principle]]（timeStore 訂閱規則）

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/imagery.md`（尚未建，待補）。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 相關文件

- 全站 memory：`~/.claude/projects/.../memory/imagery-layers-timeline.md`
- 相關 memory：`~/.claude/projects/.../memory/feedback_dynamic_layer_principle.md`（timeStore 訂閱）
