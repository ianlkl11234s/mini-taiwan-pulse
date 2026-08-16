# Backlog — 監看模式分割版面

> 編號 `MS-*`。dock 版的待辦在 [`../monitor-grid-static/backlog.md`](../monitor-grid-static/backlog.md)（`MG-*`）。

## 已完成

- ~~**MS-1 窄版座標待用戶重排**~~ → 2026-08-16 用戶沙盒定稿並貼回（見 changelog 二版）。

## P3

- **MS-7 沙盒沒有同步二版座標**
  `sandbox-split.html` 的 `DEFAULT_LAYOUT` 仍是初版（全鏈路打通用的預設值），
  與 `MONITOR_LAYOUT_SPLIT` 已不一致。下次要重排時，先把現行座標貼進沙盒的匯入框
  再開始拖（沙盒有匯入功能，不必改檔）；或把 `DEFAULT_LAYOUT` 更新成二版。
  不阻塞使用，但「按重設為預設」會拿到舊版。

- **MS-8 沙盒不模擬真實內容高度**
  二版貼回時踩到：`alertBoard` h5 / `hotZones` h4 在沙盒看起來沒問題，
  上站才發現內容溢出（實測需 264 / 234px）。沙盒的 widget 只是示意方塊。
  低成本改善：把 5 個固定高 widget 的「實測最小 h」寫進沙盒，低於就亮警告。

- **MS-2 清單 ↔ 地圖連動**
  2026-08-15 明確拍板**先不做**（「只要能同步顯示就好」）。真要做的話最小起手式是
  點新聞/警訊 → `onSelectLocation` → `flyTo`（既有通道已接好，只差在 split 下值不值得自動飛）。
  反向（點地圖篩清單）成本高很多，需要新的 store slot。

- **MS-3 split 模式下自動開啟監看相關圖層**
  同上，2026-08-15 拍板不做（「好像也不用」）。若之後要做，注意別覆寫用戶手動的圖層選擇。

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
