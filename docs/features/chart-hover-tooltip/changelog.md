# changelog — 圖表 hover tooltip

> 套用進度請改看 `backlog.md`；這裡只記基礎設施本身的變更。

## 2026-08-18 — 基礎設施上線（未 PR）

- 新增 `src/components/ChartHoverTooltip.tsx`：`useChartTooltip()` hook + `fmtChartValue()` +
  `computeTooltipPlacement()`（純函式）。DOM portal 浮層路線，理由見 README「為什麼是 DOM portal 浮層」。
- 新增 `src/components/__tests__/chartHoverTooltip.test.ts`：10 個純函式測試
  （邊界翻轉 4 種情境 + 視窗掃描 + 數值格式化）。
- 示範套用（用 `TimeseriesSparkline` 既有的 `showTooltip`，**沒有動 Sparkline 本身**）：
  - `ERCard.tsx` `ErWaitTrend14d` — 14 天等床趨勢（每小時粒度，用預設 `datetime` 格式）
  - `AirportPaxCard.tsx` — 入境／出境兩張圖，另加 `seriesLabel` 區分
- `fmtChartValue` 整數保持整數（實測 `0.00 次` 違和後修）。
