# Changelog — 監看模式分割版面

## 初版（2026-08-15，分支 `feat/monitor-split-dock`）

給監看模式加第三種呈現 `split`：Monitor 只佔畫面右半邊，左半邊維持主站原樣
（真實地圖 + rail + Layers + 時間軸）。

### 新增

- **`src/components/intel/monitor/monitorSplitLayout.ts`**（SSOT）
  `MonitorMode` 型別、`MONITOR_SPLIT_DOCK`（8 個幾何參數）、`MONITOR_LAYOUT_SPLIT`（窄版 20 格）、
  `MONITOR_SPLIT_HIDDEN` / `MONITOR_SPLIT_VISIBLE_LAYOUT`。
- **`docs/features/monitor-split/sandbox-split.html`**（2086 行，vanilla JS 零依賴）
  左半假主站（56px rail + Layers 面板 + 台灣輪廓 + 時間軸，隨參數即時變形）、
  右半真拖曳 grid。`STORE_KEY = mtp-monitor-split-sandbox-v1`。
  內建三道護欄：左右欄尾段對齊檢查、重疊檢查、dock 實寬低於 stack 斷點時紅字警告。

### 改動

- **`MonitorPanel.tsx`**
  - `wall: boolean` → `mode: MonitorMode`，受控 prop（`mode` / `onModeChange`），
    比照本檔既有 `filter` 的「有 prop 以 prop 為準」寫法。不傳 → 內部 state、預設 `dock`，**舊行為不變**
  - 幾何加 split 分支（`left: (1-widthPct)*100%`、`height:"auto"`、樣式沿用 dock 的圓角邊框）
  - 新增 `@keyframes monitorSlideIn`（split 由右側進場，dock 維持 `monitorRise`）
  - 佈局樹改成兩份模組層常數（`monitorTree` / `monitorTreeSplit`），render 與 `isStacked` 依 mode 選；
    split 用自己的 `stackBreakpointPx`（640）—— 全站原值 1100 若沿用，880px 的 dock 會一開就堆疊
  - header「Wall mode」單按鈕 → Dock / Split / Wall 三段切換
  - 高度拖曳只在 `dock` 啟用（原本是 `!wall`）
- **`IconRailSidebar.tsx`**
  - 新 `PanelRight` icon（世界 World 之後）＝ split 入口，active 樣式沿用 `RailIcon`
  - 浮動面板外殼的 `width` / `maxHeight` 在 `compactLayers` 時改讀常數檔（70vh → 45vh）
- **`App.tsx`**
  - `monitorMode` state；右上角 Monitor 按鈕開 `dock`、rail icon 開 `split`，兩者互斥
  - split 開啟走同一套開啟衛生（關 Intel Panel / 關衛星主控台）
  - 選配地圖視野讓位（`mapPaddingRight` 預設 0 = 不動；帶 no-op guard 免空跑 easeTo）

### 測試

`monitorPacking.test.ts` 既有 6 條未動，新增 4 條 split 斷言：
無互卡退化網格、任兩格不重疊、y≥25 後左右欄 `max(y+h)` 相等（皆為 74）、
頂層 rows 末節點是 `cols` 且子節點寬度為 `[6,6]`（守住尾段不被切成全寬區塊）。

## 四版（2026-08-16）— 災害四卡加歷史趨勢柱狀圖

四張災害卡（颱風／輻射／落雷／地震）各加一段迷你柱狀圖：**柱高 = 量、柱色 = 強度**。
視覺公式借共機卡的 `TrendRow`，是站上唯一同時編碼「量 + 強度」的既有樣式；
折線類只能表現一個維度。共用元件 `HazardTrendBars.tsx`（主題語意留在卡片，元件不認識任何主題）。

⚠️ 沿用共機卡踩過的雷：柱高是 `height: %`，父層必須有**確定高度**。四張卡都是
`fit:"content"`，寫成 `flex: 1` 柱子會全塌成 0。

| 卡 | 柱高 | 柱色 | 資料來源 |
|---|---|---|---|
| 地震 | 當日次數 | 當日最大規模（沿用既有 `magColor()` 分級） | 直查 `earthquake_events`，前端 bucket 成台北日 |
| 颱風 | 逐觀測點風速 kt | CWA 強度分級（熱帶性低氣壓／輕／中／強烈） | 複用 `fetchTyphoonPoints()`（地圖圖層本來就在抓），**零新查詢** |
| 落雷 | 當日次數 | 相對多寡（有雷日的 p50/p90） | **`get_lightning_daily`（migration 348，未 apply）** |
| 輻射 | 當日全站平均 | 絕對水位（自然背景 0.072／警戒 0.2 µSv/h） | **`get_nuclear_radiation_daily`（migration 348，未 apply）** |

### 幾個實作決定

- **颱風不用氣壓當柱高**：實測 Hernan 那 10 個觀測點的 `center_pressure` 上游整段是 null，
  拿它畫是一片空圖；`max_wind_kt` 才有值。
- **落雷用相對分位、輻射用絕對閾值**：落雷要回答的是「今天算多嗎」（相對），
  輻射要回答的是「有沒有離開自然背景」（絕對）。分位只拿**有落雷的日子**算 ——
  乾季一連好幾天 0 會把中位數壓成 0，任何一點雷都跳成偏多。
- **輻射缺日補 null 不補 0**：0 µSv/h 物理上不會發生，畫成 0 會誤導；柱狀圖畫成灰樁。
- **趨勢與快照分開輪詢**：同一張表但聚合方式不同，且趨勢跨日才變，沒必要綁同一次請求。
- 颱風時間標籤不能用 `toLocaleString("sv-SE", {month,day,hour})` —— 只給月日時會吐成
  日/月（實測 8/13 顯示 `13/08`），要從完整的 `YYYY-MM-DD HH:mm:ss` 切。

### 實測

地震 14 根柱（窗內 8 天有震、共 9 次、最大 M5.2 是 8/15 那根紅柱）、颱風 10 根柱；
輻射／落雷 0 根柱（RPC 未上線，loader 安靜回 `[]`，卡片維持原高度不破版）。
`tsc -b` exit 0、43 檔 599 測試全綠。

## 三版（2026-08-16）— 警訊整合六卡固定 3×2

`AlertBoard.tsx:398-405` 的六個分類卡原本是 `repeat(auto-fit, minmax(82px, 1fr))`，
欄數隨容器寬浮動 —— split dock 的 413px 容器排成 **5+1**、stack 模式的寬容器更排成一長排。
六個分類是固定的一組，改 `repeat(3, minmax(0, 1fr))` 固定 3×2 才讀得出「兩排各三類」。

實測：split 每欄 134px、dock 每欄 144px，兩模式都是 3 欄 2 列且高度零溢出
（split 290px / dock 340px 皆剛好）。最窄使用情境是手機 stack（容器約 360px → 每欄 116px），
仍大於原本的 82px 下限。

## 二版（2026-08-16）— 用戶沙盒定稿佈局

版面結構整個換掉：從「上半三段兩欄 ＋ 下半長段兩欄」改成
**「上半兩欄（止於 y17）＋ 下半全寬縱向流」**。窄欄放不下的影像牆／趨勢圖改走全寬（~835px）。

- 上半：左 `newsFeed`(h14) + `triage`(h3)；右 `timeline`(h6) → `alertBoard`(h6) → `hotZones`(h5)
- 下半全寬：`liveWall` → `hazardStrip` → 災害四卡（改一列四格 w3，不再 2×2）→ `foodPriceBoard`
  → `taiex`|`situationCards` → `prison`|`airportPax` → `powerCard` → `erCongestion`
  → `situationOverview` → `plaBoard`

### 貼回後實測抓到並修正

沙盒匯出的原始值 `alertBoard` h5(240px) / `hotZones` h4(190px) **內容放不下**
（實測需 264 / 234px），警訊整合的六宮格數字會溢出卡片外。
依用戶選擇補高：`alertBoard` h5→6、`hotZones` h4→5，左欄 `newsFeed` h12→14 跟著補 2 列
維持兩欄同止（y15→y17），下半全部 y +2。修正後 5 個固定高格子實測全部零溢出。

**沙盒不模擬真實內容高度**（backlog MG-1 已知限制）→ 拖完一定要回站上目視固定高那 5 格。

### 測試斷言調整

原「y≥25 左右兩欄尾段 max(y+h) 相等」與「y25 以下是單一 cols(6,6)」兩條，
前提是「下半為長段兩欄」，新佈局以全寬為主 → 前提消失（且 w12 的格子會被誤算進左欄）。
改成三條通用不變量：拆解後 widget 不重不漏、cols/rows 寬度守恆（這條才是「尾段變全寬」
的真正守門）、上半拆成 cols(6,6)。測試數 598 → 599。

## 初版追加（2026-08-16，用戶實機定值）

- **`MONITOR_SPLIT_CAMERA`**：進入 split 自動飛到 `23.6111, 122.6936 / z7.3 / pitch 0 / bearing 0`
  （台灣整島落在左半可視區）。只在進入那一刻飛一次、退出不還原、`autoFrame: false` 可關。
  實測命中值與目標完全一致。

### 修正（同批，驗收時抓到）

- **沙盒的堆疊警告基準錯誤**：原本拿「面板寬」比 `stackBreakpointPx`，但 app 的 `isStacked`
  量的是 grid 容器 contentRect 寬 = 面板寬 − 34（左右 padding 32 ＋ 邊框 2）。
  邊界寬度下沙盒綠燈、正式站卻堆疊。已改成顯示 `DOCK 寬 · GRID 寬` 並以 GRID 判定。
- 假台灣輪廓重畫（原本是水滴形，判斷不出面板遮擋）。

### 驗收

- `npx tsc -b` exit 0
- `npm test` 43 檔 598 通過
- 沙盒 `DEFAULT_LAYOUT` 與 `MONITOR_LAYOUT_SPLIT` 逐格比對一致（20/20）
- 瀏覽器實測（1920 視窗）：split 左半地圖可操作、右半 3 個欄邊界（左欄／右欄／災害四卡 2×2）、
  右上按鈕列與左下時間軸皆未被蓋；Layers 面板 486px = 0.45vh；
  dock（left64/w1842/h670）與 wall（left0/top0）兩個舊模式無回歸
- **多寬度實測**：1920 → GRID 835 ✅ 2 欄；1600 → 688 ✅ 2 欄；**1440 → 614 ⚠️ 單欄堆疊**
  （翻轉點約 1496px，見 README）。1440 屬現行預設值的已知行為，非 bug——用戶重排時可調
- 沙盒 roundtrip：匯出 → 擾動（`newsFeed` w6→5、`widthPct` 0.46→0.52）→ 匯入 → 值與滑桿同步生效
- 沙盒護欄：蓄意把 `foodPriceBoard` h5→4 破壞左右對齊，正確報「左欄止於 y74、右欄止於 y73」

### 已知未決

- 窄版座標是「打通用」預設值，待用戶開沙盒重排（`backlog.md` MS-1）
- 三段切換標籤目前是英文 `Dock / Split / Wall`；split 按鈕借用 `MICON.grid`
  （既有 icon 集無更貼切者）
