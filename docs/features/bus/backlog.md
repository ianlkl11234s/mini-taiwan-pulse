# Backlog — bus

> memory 時點 2026-04-14。Live+Replay progress-based 架構完成。全台擴展待做。

## Active work（進行中／待辦）

- 暫無；Live+Replay progress-based 架構已完成。

## Product / platform backlog（全台擴展；詳見 `docs/bus-layer-design.md` §6）

- [ ] **BUS-lazy-load-routes** · `tech-debt` · P2 · `ready`：路線 JSON 預估 60–100MB，評估按城市 lazy load；Next action：以現行資產與首屏載入時間建立 baseline；Acceptance：各城市切換無重複下載且 browser/性能 evidence 可讀。
- [ ] **BUS-city-enum** · `product` · P2 · `ready`：擴充 `BusCity` enum 與 `useBusLayer.cities`；Next action：列出目標城市與資料契約；Acceptance：目標城市可切換、tsc/test 綠。
- [ ] **BUS-max-instances** · `tech-debt` · P2 · `verifying`：`MAX_INSTANCES` 是否需升至 10k–20k；Next action：用全台資料量與 FPS/記憶體實測後決定；Acceptance：測試矩陣與 owner decision。
- [ ] **BUS-city-filter-progress** · `performance` · P2 · `ready`：`ensureProgressPaths` 加 city 過濾以減少重複工作；Next action：先以 profiler 確認重複成本；Acceptance：同資料集 CPU/時間改善且 replay 不回歧。
- [ ] **BUS-preprocess-script** · `tech-debt` · P2 · `ready`：建立 `scripts/preprocess/build_bus_routes.py`；Next action：先固定輸入/輸出 schema；Acceptance：可重跑產出與 checksum。

## Decision needed

- 暫無；若全台擴展前改變資料格式或城市清單，先補 decision record。

## Conditional / triggered later

- **全台擴展** · `conditional`：Trigger：owner 確認目標城市與資料供應；觸發後依上列順序執行 lazy load → enum → preprocess。

## Completed / historical（已完成／歷史）

- [x] **BUS-progress-arch**：改 progress-based 時間軸 — commit `b3bef73`
- [x] **BUS-fade-race**：淡入淡出（B+C 方案，60s 頭尾）+ 修復路線載入 race — commit `bc4b3e9`
- [x] **BUS-replay-segmentation**：`buildProgressPath` 預計算 `(ts, progress, tripId)` + trip segmentation
- [x] **BUS-live-jump-reject**：Live progress 跳躍偵測 + `rejectStreak` 防卡住
- [x] **BUS-shader-alpha**：BusScene 用 `onBeforeCompile` 注入 per-instance `aAlpha`
- [x] **BUS-race-fix**：`addCityRoutes` 尾部呼叫 `ensureProgressPaths()` 補建

## Explicitly not planned（明確不做）

- 暫無

## Historical notes（歷史坑；不視為 active item）

- **Race 症狀**：重新整理後 console 見 `(0 with progressPath)`，車穿越河面/建築
- **Race 根因**：18MB JSON 解析比 Supabase RPC 慢 → ingestTrails 先跑 → mergedRoutes 空 → progressPath 全沒建 → 走 Catmull-Rom fallback（不 snap）
- **Race 修法**：`ensureProgressPaths()` 在 `addCityRoutes` 結尾呼叫，retry 未解析的 routeKey 和未建的 progressPath
- **驗證 log**：
  ```
  [Bus] ingestTrails: N → N (0 with progressPath)
  [Bus] Loaded X route shapes for City
  [Bus] ensureProgressPaths: resolved X routeKey, built X progressPath
  ```
- **教訓**：一次性 pre-compute 一定要處理依賴資料晚到，不能依賴呼叫順序
