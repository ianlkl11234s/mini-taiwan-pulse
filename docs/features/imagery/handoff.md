# Handoff — imagery（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/imagery.md`（尚未建，待補）
>
> 契約細節看上游，本檔只放前端接線簡表。

## 上游摘要

- 產物：Supabase RPC（gis-platform migration 160 抽稀簽名）
- 資料源：
  - 雷達：CWA O-A0058-005（10min cadence，DB 自 2026-04-07 保留）
  - 衛星：CWA O-C0042-004（10min cadence）
  - 雨量柵格：IoW `precipitation_raster_frames`（collector 自 2026-06-05）
- 座標：WGS84 raster tile
- 資料量：雷達 avg ~630KB/frame，單日 ~90MB base64（歷史抽稀 30min → ~32MB）

## 前端接線位置

- Hook / Loader：memory 未點名（TBD — 查 `src/hooks/`、`src/data/` 對照 imagery/radar/rain 相關檔）
- RPC：migration 160 抽稀簽名（`p_step_minutes`）
- 時間源：透過 `timeStore`（見 [[feedback_dynamic_layer_principle]]）

## 硬依賴欄位（改一定爆）

- 雷達 / 衛星 RPC：`p_step_minutes` 參數 — 前端歷史日必傳 30，今天不傳（全解析度 24h）
- 雨量：`frame_ts`（顯示「不晚於當前的最近一張」邏輯依賴）
- Frame payload：base64 encoded raster（前端解碼作 raster tile）

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 改 RPC 簽名 | **必 `DROP` 舊簽名再 CREATE**（否則 ambiguous 300）；前端呼叫對齊 |
| 改 cadence（10min → N） | 抽稀策略調整（歷史日抽稀比例） |
| 雷達 frame 變得更大 | 抽稀更激進 / lazy load 分段 |
| 雨量 collector 補歷史 | 前端 48h margin 可調小 |
| 加新 raster 產品 | 加新 hook / overlay 條目 |

## 已知不對稱

- 上游 `docs/handoff/imagery.md` **尚未建**
- 雨量 collector 起始日期 2026-06-05，之前的日期是「無資料」還是「未收集」— 前端目前僅「顯示最近一張」，不區分
- 雷達歷史 vs 今天用不同策略（抽稀 vs 全解析度） — 是否有邊界日切換的坑（跨日重載時？）未在 memory 記錄

## TBD

- 前端 hook / loader 檔案實際名字
- 雨量柵格 legend / 標尺（memory 未提）
- 三 raster 是否用同一個 RPC 或分開
