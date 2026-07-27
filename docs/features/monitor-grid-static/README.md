# 監看模式靜態 12 欄網格

> **Slug**：`monitor-grid-static`
> **狀態**：dev（待驗收）
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：#XX（待補）

## 一句話說明

把監看模式 header 以下的手寫 flex 結構（TimelineDock 全寬 → News Feed 40% + IndicatorPanel 兩欄 → 底部三卡）
改成**單一可捲動的 12 欄 CSS grid**，14 個 widget 依排版沙盒定稿座標擺位。

## 為什麼

原本的三段式 flex 把版面決策綁死在 JSX 巢狀結構裡：widget 的位置、寬度、先後順序全靠
`width: "40%"` / `flex: 1` / `gridColumn: "1 / -1"` 這類散落各處的樣式互相牽制，
調一格就要動好幾層容器，而且「哪個 widget 在哪」沒有任何地方看得出來。

改成靜態網格後：

- **版面 = 資料**。座標集中在 `src/components/intel/monitor/monitorLayout.ts` 一份陣列，
  要搬 widget 只改座標，不動 JSX。
- **widget = 獨立元件**。IndicatorPanel 這個「右欄容器」消失，每個 widget 直接掛在格子上，
  不再有「內嵌在容器裡所以只能待在右邊」的限制。
- **沙盒可迭代**。座標格式刻意相容 react-grid-layout 的 `layout` 陣列，
  之後要換版面就回沙盒拖一拖、匯出覆蓋，不用改程式。

## 佈局來源

座標**由排版沙盒拖曳定稿後匯出**（2026-07-26），不是手算的。
要改版面 → 回沙盒拖完重新匯出、覆蓋 `MONITOR_LAYOUT`，**不要**在 `MonitorPanel.tsx` 裡手調。

畫布規格：`cols=12` / `rowHeight=40px` / `gap=10px`。

| id | 元件 | x,y | w×h |
|---|---|---|---|
| `newsFeed` | `NewsFeedPanel` | 0,0 | 4×9 |
| `alertBoard` | `alerts/AlertBoard` | 4,0 | 3×9 |
| `histogram` | `HourlyHistogramWidget` | 7,0 | 5×6 |
| `timeline` | `TimelineDock`（含內嵌 AlertsTrack） | 7,6 | 5×7 |
| `triage` | `TriageWidget` | 0,9 | 4×4 |
| `hotZones` | `HotspotsWidget` | 4,9 | 3×4 |
| `situationOverview` | `SituationOverview` | 0,13 | 5×6 |
| `liveWall` | `LiveWall` | 5,13 | 7×10 |
| `situationCards` | `SituationCards` | 0,19 | 5×4 |
| `hazardStrip` | `HazardWatchStrip` | 0,23 | 5×4 |
| `powerCard` | `PowerCard` | 5,23 | 7×6 |
| `erCongestion` | `ERCard` | 0,27 | 5×6 |
| `prison` | `PrisonCard` | 0,33 | 2×4 |
| `airportPax` | `AirportPaxCard` | 2,33 | 3×6 |

## 關鍵檔案

- 佈局 SSOT：`src/components/intel/monitor/monitorLayout.ts`
- 網格容器 + widget 接線：`src/components/intel/monitor/MonitorPanel.tsx`
- 新抽離元件：`NewsFeedPanel.tsx` / `HotspotsWidget.tsx` / `HourlyHistogramWidget.tsx` / `TriageWidget.tsx`
- 已刪除：`IndicatorPanel.tsx`（widget 全部上網格後成為 orphan）

## 已知取捨

- **格子會自己捲動**。`gridAutoRows` 固定 40px，但 `LiveWall` 是 2×2 的 16:9 磚，
  實際高度隨欄寬變動，固定 row span 無法在所有視窗寬度下剛好裝下。
  因此 cell 用 `overflow: auto` + 子節點 `flex: 1 0 auto`：內容比格子矮就撐滿，比格子高就格內捲動，
  **既不裁切也不壓到下一列**。2000×1300 實測 14 格中 11 格剛好、
  `liveWall` / `situationCards` / `hazardStrip` 3 格會格內捲動。
- **`IndicatorPanel` 的「今日累計 N 則」footer 隨容器一起移除**。header 已有「今日 N 則」，不重複。
- `SituationOverview` / `SituationCards` / `PowerCard` 根節點殘留的 `gridColumn: "1 / -1"`
  在新的 cell（flex 容器）裡失效但無害，刻意不動，以免和未合併的 registry 分支衝突。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關文件

- 未合併參考分支：`feat/monitor-grid-layout`（react-grid-layout 可配置版，本次未採用）
- widget 抽離參考 commit：`46218e5`
- 開發規則：`../../development-rules.md`
