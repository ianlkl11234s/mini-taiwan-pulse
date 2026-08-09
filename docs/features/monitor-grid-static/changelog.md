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

## 2026-08-10 — 八版：TAIEX 拆板 + 圖表加高（待 PR）

- **沙盒原始碼進 repo**：`docs/features/monitor-grid-static/sandbox.html`
  （原本只活在 artifact 上，兩個版本沒同步 → 缺 `foodPriceBoard`、rowHeight 用 36–44 浮動值
  而非實機固定 40px）。沙盒改為 v8 / `STORE_KEY` v3，restored preset 與 `MONITOR_LAYOUT` 逐格對齊。
- **TAIEX 拆成獨立 widget `taiex`**（`0,17,5×3`）：`SituationOverview` 移除 `market` / `panelOpen`
  兩個 prop 與內嵌的 `TwseTicker`，改由 `MonitorPanel` 直接掛；日線 sparkline `150×24 → 360×48`
  （上限 360 是 grid 模式最窄容器 1100px 時 w5 格內可用寬）。概覽左欄改 `flex:1` 吃滿騰出的橫向空間。
- **`PlaBoard`**：120 天趨勢柱狀圖由固定 54px 改 `flex:1 / minHeight 110`（實機量到約 190px）；
  空域方位（4 列）與侵擾方式（5 列）由兩欄改單欄——條長度是唯一比較基準，兩欄會腰斬。
  `h 15 → 13`（其餘區塊固定高約 450px，剩下全歸柱狀圖）。
- **`FoodPriceBoard`**：`SPARK_H 34 → 52` 且走勢圖改 `flex:1` 吃剩餘高度（實機約 141px）；
  `h 9 → 12`。修掉一個 flex 陷阱：帶 `viewBox` 的 svg 會用「寬 × 內建長寬比」自算高度
  （實測 253px 撐爆格子）→ 改 `position:absolute` 退出高度計算。
- 左欄 y 全面下移（`taiex` +3、`plaBoard` 起點 20→23）；右欄未動。
- Breaking：無（純前端版面 + 元件內部樣式，無資料契約變動）。

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
