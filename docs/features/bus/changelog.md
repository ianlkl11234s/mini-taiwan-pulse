# Changelog — bus

最新在上。

---

## 2026-04-14 — `bc4b3e9` feat(bus): 淡入淡出 + 修復路線載入 race

- **Fade in/out（B+C 方案）**：
  - trail 頭尾 60s 淡入淡出（`FADE_SECONDS = 60`）
  - 跨 trip 前半淡出停 p1、後半淡入停 p2
  - Live 新車淡入
  - BusScene 用 `onBeforeCompile` 注入 per-instance `aAlpha`
- **Race 修復**：`addCityRoutes` 尾部呼叫 `ensureProgressPaths()` 補建，retry 未解析的 routeKey 和未建的 progressPath
- **Live 穩定性**：progress 跳躍偵測 + `rejectStreak` 防卡住
- **Replay**：`buildProgressPath` 預計算 `(ts, progress, tripId)` + trip segmentation

## 2026-04（早於 04-14） — `b3bef73` feat(bus): 改為 progress-based 時間軸

- 狀態變數從「位置」換成「route progress」
- 位置永遠由 `interpolateOnLineString` 產生 → 幾何上保證沿路線、不切角
