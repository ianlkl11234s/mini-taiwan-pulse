# perf-lifecycle — 圖層生命週期效能（切主題不重抓、關閉圖層不建 source）

> **狀態**：active（交接文件已寫；P1／P2 是否完成未查到合併紀錄）
> **相關 PR**：#464（render lifecycle）、#471、#475（R3b）——皆為前置的效能改造，見 [perf-audit-2026-09-30](../../audit/perf-audit-2026-09-30.md)

## 一句話說明

讓「切暗／淡主題、改透明度」只改樣式、不重抓資料；開站時只為可見圖層建資料來源，其餘第一次打開才建。

## 主要檔案

- `src/map/overlayManager.ts`：`addAllOverlays()` 開站建立全部 overlay（P2 的改造對象）。
- `src/hooks/use*Layer.ts`：各圖層 hook（P1 要把「抓資料」與「樣式」effect 拆開）。
- 相關 commit（已在 git log）：`4f4b40e4`（R3b 樣式更新不重建資料）、`8e96bfcb`（隱藏 overlay 略過主題／參數更新，顯示時再套用，2026-10-01）。

## 資料夾內文件

| 文件 | 用途 |
|---|---|
| [handoff-theme-refetch-lazy-overlays.md](./handoff-theme-refetch-lazy-overlays.md) | 給 Codex 的交接：P1 切主題不重抓資料、P2 關閉的圖層不建 source，含量測方法與驗收條件 |

交接文件提到的 `P2-design.md` 在此資料夾**未查到**。

## 驗收方式

依交接文件：量測 fetch／`setData`／`addLayer`／`removeLayer` 次數（純樣式變更應為 0）；P2 需證明全開時圖層順序與現況一致；`npx tsc -b`、`npx vitest run`。

## 相關文件

- [perf-audit-2026-09-30](../../audit/perf-audit-2026-09-30.md)（上一輪效能審計）
- [development-rules.md](../../development-rules.md) §8（動態圖層時間訂閱）
