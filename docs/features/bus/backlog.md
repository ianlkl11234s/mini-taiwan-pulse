# Backlog — bus

> memory 時點 2026-04-14。Live+Replay progress-based 架構完成。全台擴展待做。

## 進行中

- 暫無

## 待辦（全台擴展要點，詳見 `docs/bus-layer-design.md` §6）

- [ ] **BUS-lazy-load-routes**：路線 JSON 預估 60~100MB → 考慮 lazy load by city
- [ ] **BUS-city-enum**：擴充 `BusCity` enum + `useBusLayer` `cities` prop
- [ ] **BUS-max-instances**：`MAX_INSTANCES` 可能要升到 10k~20k
- [ ] **BUS-city-filter-progress**：`ensureProgressPaths` 加 city 過濾減少重複工作
- [ ] **BUS-preprocess-script**：預處理腳本待建 `scripts/preprocess/build_bus_routes.py`

## 已完成（近期）

- [x] **BUS-progress-arch**：改 progress-based 時間軸 — commit `b3bef73`
- [x] **BUS-fade-race**：淡入淡出（B+C 方案，60s 頭尾）+ 修復路線載入 race — commit `bc4b3e9`
- [x] **BUS-replay-segmentation**：`buildProgressPath` 預計算 `(ts, progress, tripId)` + trip segmentation
- [x] **BUS-live-jump-reject**：Live progress 跳躍偵測 + `rejectStreak` 防卡住
- [x] **BUS-shader-alpha**：BusScene 用 `onBeforeCompile` 注入 per-instance `aAlpha`
- [x] **BUS-race-fix**：`addCityRoutes` 尾部呼叫 `ensureProgressPaths()` 補建

## 已放棄 / 延後

- 暫無

## 已記錄的坑

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

## TBD

- memory 時點距今 78 天，實際是否已擴到全台、預處理腳本是否已建 — 待用戶確認
