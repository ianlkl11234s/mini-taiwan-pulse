# Backlog — 監看模式分割版面

> 編號 `MS-*`。dock 版的待辦在 [`../monitor-grid-static/backlog.md`](../monitor-grid-static/backlog.md)（`MG-*`）。

## Completed / historical（已完成／歷史）

- ~~**MS-1 窄版座標待用戶重排**~~ → 2026-08-16 用戶沙盒定稿並貼回（見 changelog 二版）。

## Active work（進行中／待辦）

- **MS-9 split 在 1440 以下會退化成單欄堆疊**（2026-08-16 code review 提出，**刻意不修**）
  現行預設（`widthPct 0.46` / `stackBreakpointPx 640`）的翻轉點約 1496px：
  1920→GRID 835 ✅、1600→688 ✅、1440→614 ⚠️堆疊、1280→541 ⚠️堆疊。
  在筆電上看 split 會拿到一長條單欄，而不是設計的兩欄上半。
  **為什麼先不改**：座標是用戶 2026-08-16 在沙盒定稿的，改 `widthPct` 或降斷點都會
  動到那個決定；且主要使用情境是 1862px 桌機。要修的話兩條路 ——
  `widthPct` 提到 ≥0.48（1440 也能兩欄），或斷點降到 ≤600（但 2 欄各不到 300px 很擠）。
  完整數字與翻轉點推導見 README「堆疊判定的比較基準」。

## Tech debt / conditional backlog

- **MS-11 dock 版的災害四卡沒跟著調整**
  split 版已把颱風卡獨立一列（它有上下兩排趨勢圖，比其他三張高）。dock 版
  （`monitorLayout.ts`）仍是 2×2，颱風與地震同列 → 等高規則會把地震拉到颱風的
  高度、底下留白。不影響功能，dock 也不是目前主要使用的模式，但看起來會有點空。
  要修就比照 split：颱風獨立一列 w7，其餘三卡一列拆 3+2+2。

- **MS-10 `layersWidth` 目前是 no-op**
  `MONITOR_SPLIT_DOCK.layersWidth` = 288 恰好等於 `IconRailSidebar` 的 `PANEL_WIDTH`，
  所以 compact 分支現在只有 `maxHeight`（70vh→45vh）真的生效。不是 bug ——
  值從常數檔來，沙盒改值就會生效；但讀 code 的人會以為寬度有變。

- **MS-7 沙盒沒有同步二版座標**
  `sandbox-split.html` 的 `DEFAULT_LAYOUT` 仍是初版（全鏈路打通用的預設值），
  與 `MONITOR_LAYOUT_SPLIT` 已不一致。下次要重排時，先把現行座標貼進沙盒的匯入框
  再開始拖（沙盒有匯入功能，不必改檔）；或把 `DEFAULT_LAYOUT` 更新成二版。
  不阻塞使用，但「按重設為預設」會拿到舊版。

- **MS-8 沙盒不模擬真實內容高度**
  二版貼回時踩到：`alertBoard` h5 / `hotZones` h4 在沙盒看起來沒問題，
  上站才發現內容溢出（實測需 264 / 234px）。沙盒的 widget 只是示意方塊。
  低成本改善：把 5 個固定高 widget 的「實測最小 h」寫進沙盒，低於就亮警告。

## Explicitly not planned（目前決定不做）

- **MS-2 清單 ↔ 地圖連動**
  2026-08-15 明確拍板**先不做**（「只要能同步顯示就好」）。真要做的話最小起手式是
  點新聞/警訊 → `onSelectLocation` → `flyTo`（既有通道已接好，只差在 split 下值不值得自動飛）。
  反向（點地圖篩清單）成本高很多，需要新的 store slot。

- **MS-3 split 模式下自動開啟監看相關圖層**
  同上，2026-08-15 拍板不做（「好像也不用」）。若之後要做，注意別覆寫用戶手動的圖層選擇。

## Conditional / triggered later

- **MS-4 `mapPaddingRight` 實際需不需要**
  預設 0（不動視野）。2026-08-16 加了 `MONITOR_SPLIT_CAMERA` 自動定位後，
  進 split 已直接飛到「台灣落在左半」的視角，padding 更沒有必要 —— 觀察一陣子若確定用不到就移除。

- **MS-5 底部時間軸與 split dock 的重疊**
  `TimelineControls` 是 `bottom:16 / left: sidebarWidth+16 / width:340`，錨定左下，
  理論上與右半 dock 不打架。但視窗窄（< 1280）時可能碰到，未實測。
  `HistoricalTimeline`（歷史模式）同樣未測。

- **MS-6 兩份沙盒的維護成本**
  `monitor-grid-static/sandbox.html` 與 `monitor-split/sandbox-split.html` 各一份、
  widget 清單重複。新增 widget 要改兩處。目前判斷「兩份各自單純」優於「一份多 preset」，
  若之後 widget 增減頻繁再重估。
