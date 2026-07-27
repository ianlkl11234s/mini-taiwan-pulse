# Changelog — 監看模式靜態 12 欄網格

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-07-26 — PR #90 `3888014`

> 同 PR 後續三 commit：沙盒佈局 v2-v4 迭代（histogram 因與時間軸資料重複進 MONITOR_HIDDEN）、
> TimelineDock / HourlyHistogramWidget / AlertBoard 內容隨格高 flex 展開、
> <1100px 單欄堆疊響應式（cell 必設 flexShrink:0，見 PB-30）。

- 新增 `monitorLayout.ts`：排版沙盒定稿的 12 欄座標（14 widget）+ `hidden` 過濾，
  格式相容 react-grid-layout `layout` 陣列。
- `MonitorPanel.tsx` header 以下改為單一可捲動 CSS grid
  （`repeat(12, minmax(0,1fr))` / `gridAutoRows: 40px` / `gap: 10px`），
  由 layout 陣列 map 出 cell；移除原本的 TimelineDock 全寬 → body row → 底部三卡三段式 flex。
- 抽出 `NewsFeedPanel.tsx`（原 MonitorPanel 內嵌的 News Feed 欄）。
- 抽出 `HotspotsWidget.tsx` / `HourlyHistogramWidget.tsx` / `TriageWidget.tsx`
  （照未合併分支 commit `46218e5` 原樣搬移，計算邏輯 `rankHotspots` / `bucketByHour` / `tri` 隨元件走）。
- 刪除 `IndicatorPanel.tsx`：widget 全部上網格後不再有人引用。
- Header（拖曳把手 / Wall mode / 退出）、面板高度拖拉、wall mode 定位、
  所有資料 fetch / RPC / 輪詢頻率一律未動；PR #89 的 sparkline 與機場卡修正未觸碰。
- Breaking：無（純前端版面重構，無資料契約變動）
