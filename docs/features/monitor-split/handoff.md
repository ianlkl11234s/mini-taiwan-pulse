# Handoff — 監看模式分割版面

## 上游

**無上游 handoff** —— 純前端呈現層改動，不新增任何資料源、不動 RPC、不動 Supabase schema。

split 模式渲染的 20 個 widget 與 dock 模式**完全同一組元件、同一組資料來源**，
只是換一套座標與容器幾何。widget → 資料來源的對照表請看
[`../monitor-grid-static/handoff.md`](../monitor-grid-static/handoff.md)，本功能不重抄。

## 下游

無。這是應用層末端。

## 會影響本功能的上游變動

| 上游變動 | 對本功能的影響 | 要做什麼 |
|---|---|---|
| 新增 / 移除 Monitor widget | `MonitorWidgetId` union 改變 | **兩套佈局都要補座標**：`MONITOR_LAYOUT`（dock）與 `MONITOR_LAYOUT_SPLIT`（split）。只補一邊 → 另一邊該 widget 不渲染。兩份沙盒也各自要加 widget 定義 |
| `monitorPacking.ts` 的 guillotine 演算法調整 | 窄版拆解結果可能改變 | 跑 `monitorPacking.test.ts`，特別是 split 那組結構斷言 |
| Layers 面板（`IconRailSidebar` 的 `LayersPanel`）改版 | compact 尺寸可能破版 | 確認 `compactLayers` 分支下的 `layersWidth` / `layersMaxVh` 仍合用 |
| 右上角按鈕列高度改變 | `MONITOR_SPLIT_DOCK.top`（56）可能不夠讓位 | 回沙盒調 `top` 重新匯出 |

## 契約備註

`MonitorPanel` 的 `mode` / `onModeChange` 是**選配 prop**（受控模式，比照既有 `filter`）。
不傳 → 用內部 state、預設 `dock`，舊呼叫端行為不變。測試與未來的其他嵌入情境可直接沿用。
