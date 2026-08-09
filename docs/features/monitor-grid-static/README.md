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

座標**由排版沙盒拖曳定稿後匯出**，不是手算的。
要改版面 → 回沙盒拖完重新匯出、覆蓋 `MONITOR_LAYOUT`，**不要**在 `MonitorPanel.tsx` 裡手調。

沙盒原始碼就在本目錄：[`sandbox.html`](./sandbox.html)（= artifact
<https://claude.ai/code/artifact/f5d75312-41b8-4480-9458-e9e2bf98738e> 的來源）。
**改沙盒一律改這份再發布**——2026-08-02～08-10 期間沙盒只活在 artifact 上、repo 沒有副本，
結果漂掉兩個版本（缺 `foodPriceBoard`、rowHeight 用浮動值）。

畫布規格：`cols=12` / `rowHeight=40px` / `gap=10px`（沙盒 `ROW_H` 與 `MONITOR_GRID_ROW_HEIGHT` 綁死）。

九版（2026-08-10）座標。`fit` 欄見下方「高度怎麼決定」：

| id | 元件 | x,y | w×h | fit |
|---|---|---|---|---|
| `newsFeed` | `NewsFeedPanel` | 0,0 | 4×12 | |
| `alertBoard` | `alerts/AlertBoard` | 4,0 | 3×7 | |
| `timeline` | `TimelineDock`（含內嵌 AlertsTrack） | 7,0 | 5×9 | |
| `hotZones` | `HotspotsWidget` | 4,7 | 3×5 | |
| `triage` | `TriageWidget` | 7,9 | 5×3 | |
| `situationOverview` | `SituationOverview` | 0,12 | 5×5 | ✅ |
| `liveWall` | `LiveWall` | 5,12 | 7×14 | ✅ |
| `taiex` | `PressureRing` 的 `TwseTicker` | 0,17 | 5×3 | ✅ |
| `situationCards` | `SituationCards` | 0,20 | 5×3 | ✅ |
| `plaBoard` | `PlaBoard` | 0,23 | 5×13 | ✅ |
| `hazardStrip` | `HazardWatchStrip` | 5,26 | 7×8 | ✅ |
| `powerCard` | `PowerCard` | 5,34 | 7×14 | ✅ |
| `erCongestion` | `ERCard` | 0,36 | 5×15 | ✅ |
| `foodPriceBoard` | `FoodPriceBoard` | 5,48 | 7×12 | ✅ |
| `prison` | `PrisonCard` | 0,51 | 2×4 | ✅ |
| `airportPax` | `AirportPaxCard` | 2,51 | 3×6 | ✅ |

## 高度怎麼決定（九版起）

x / w / 前後順序仍然由座標決定，**高度分兩種**：

- `fit: "content"`（表上打 ✅，多為資訊卡）：**高度跟著內容走**，不留白、不格內捲，
  下方 widget 順勢下移。這類 widget 的 `h` **不是高度**，只是拆解與排序用的佔位值。
- 沒標的（新聞 Feed／警報／時間軸／熱區／信號分級）：吃 `h` 當固定高、超出格內捲。
  清單類必須固定高，否則會被幾百筆內容拉成無限長。

做法是 `monitorPacking.ts` 把座標**拆成欄／列巢狀結構**（guillotine 切割）：
找一條沒有 widget 跨過的切線 → 縱向切＝並排的欄（x/w 保留）、橫向切＝上下堆疊（順序保留），
欄內用 flex 直向流。CSS grid 的列是跨欄共用的，做不到「這格長高、下面的推下去」，所以才要拆。
兩種切線都找不到的區塊（風車形互卡）會退回原本的固定列高網格，只影響那一小塊
（`monitorPacking.test.ts` 有守）。

實測效果：`erCongestion` 1163px 完整展開（原本格內捲 423px）、`powerCard` 690→241px、
`situationOverview` 240→191px，死白全部消失。

`histogram`（`HourlyHistogramWidget`）在 `MONITOR_HIDDEN`，不渲染。

改完座標後跑一次逐格比對（沙盒 restored preset vs `MONITOR_LAYOUT`），避免兩邊再漂：
把 `<script>` 區塊抽出成 `.js`，比對 `L("id", x, y, w, h)` 與 `{ i: "id", x, y, w, h }` 兩組值。

## 關鍵檔案

- 佈局 SSOT：`src/components/intel/monitor/monitorLayout.ts`
- 排版沙盒（本目錄）：[`sandbox.html`](./sandbox.html)
- 網格容器 + widget 接線：`src/components/intel/monitor/MonitorPanel.tsx`
- 新抽離元件：`NewsFeedPanel.tsx` / `HotspotsWidget.tsx` / `HourlyHistogramWidget.tsx` / `TriageWidget.tsx`
- 已刪除：`IndicatorPanel.tsx`（widget 全部上網格後成為 orphan）

## 已知取捨

- **`fit` widget 內的圖表要寫死高度**。父層沒有固定高 → `flex:1` 分不到東西，
  高度只剩 `minHeight`。PLA 趨勢柱狀圖 190px、食品走勢圖 140px 都是**開實機量過**才定的
  （量法：`document.querySelectorAll('[data-widget]')` 逐格比 `scrollHeight` 與 `clientHeight`），
  不要照行高估算。
- **帶 `viewBox` 的 `<svg>` 在 flex 容器裡會自己算高度**（寬 × 內建長寬比），
  實測把食品價格卡撐到 253px 爆格。走勢圖的 svg 一律 `position:absolute` 退出高度計算。
- **`y` 對 `fit` widget 只是同欄排序**。`erCongestion` 實際渲染 1163px 而非 `h15` 的 740px，
  其下的 `prison` / `airportPax` 實際位置與宣告的 `y=51` 不同 —— 這是預期行為，
  沙盒匯出的座標仍以宣告值為準（兩邊逐格比對照樣過）。
- 每個 cell 帶 `data-widget="<id>"`，量測／除錯時直接選得到。

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
