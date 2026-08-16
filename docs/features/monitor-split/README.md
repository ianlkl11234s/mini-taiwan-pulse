# 監看模式分割版面（Split Dock）

> **Slug**：`monitor-split`
> **狀態**：dev（待驗收）
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：#XX（待補）

## 一句話說明

給監看模式加**第三種呈現 `split`**：Monitor 只佔畫面右半邊，左半邊維持主站原樣
（真實 Mapbox 地圖 + icon rail + Layers 面板 + 底部時間軸），達成「地圖與戰情同屏」。

## 為什麼

原本兩種呈現都會把地圖蓋掉：

| mode | 幾何 | 問題 |
|---|---|---|
| `dock`（原 `wall=false`） | `left:64 / right:14 / bottom:14 / height:62vh` | 地圖只剩上緣一條 |
| `wall`（原 `wall=true`） | `left:0 / top:0 / bottom:0` | 幾乎全屏，地圖全沒了 |

站台從 GIS 退化成純儀表板。但主站預設視角的台灣本島本來就偏畫面左側，
**右半邊是一大片空海域** —— 那塊留白正好夠放整組監看 widget。

`split` 就是把 Monitor 收進那片留白：左半邊照舊可操作圖層、看地圖，右半邊同時盯戰情。

## 三種模式並存

`MonitorMode = "dock" | "wall" | "split"`（定義在 `src/components/intel/monitor/monitorSplitLayout.ts`）。

- 舊的 `wall: boolean` state 已改成 `mode`，`dock` 為預設，**舊行為完全不變**
- MonitorPanel 走**受控 prop**（`mode` / `onModeChange`），比照本檔既有的 `filter` 寫法：
  有 prop 以 prop 為準，沒傳則用內部 state
- 兩個入口：
  - 右上角「Monitor」按鈕 → 開 `dock`（原行為）
  - **左側 rail 新 icon「監測模式」** → 開 `split`
  - panel header 內的三段切換可隨時互換

## 佈局來源

窄版座標與幾何參數**由分割版面沙盒拖曳定稿後匯出**，不是手算的。
要改版面 → 回沙盒拖完重新匯出、整段覆蓋 `monitorSplitLayout.ts` 的
`MONITOR_SPLIT_DOCK` 與 `MONITOR_LAYOUT_SPLIT`，**不要**在 `MonitorPanel.tsx` 裡手調。

沙盒原始碼就在本目錄：[`sandbox-split.html`](./sandbox-split.html)。
比照 `monitor-grid-static` 的教訓（沙盒只活在 artifact 上結果漂掉兩個版本），
**改沙盒一律先改這份 repo 檔案再發布**。

- localStorage key：`mtp-monitor-split-sandbox-v1`
  （**不可**沿用 `monitor-grid-static` 沙盒的 `mtp-monitor-sandbox-v3` —— widget 結構不同，
  舊快照會把新格子塞成 (0,0)）
- 畫布規格沿用：`cols=12` / `rowHeight=40px` / `gap=10px`

## 窄版特有的兩條鐵則

右半 dock 實寬約 880px（dock 模式是 1800px），欄寬砍半，所以**不與 `MONITOR_LAYOUT` 共用座標**。
另外兩條規則沙盒已內建護欄，但貼回前值得再核一次：

**1. 任何一段兩欄結構，左右必須同時結束**（最後一格的 `y+h` 相等）

若一欄先結束，剩下的區域只有另一欄 → guillotine（`monitorPacking.ts`）會在那裡切出
**貫穿全寬的橫切線**，該區塊就不再是「某一欄」而是撐滿 12 欄的獨立區塊。
同一個雷在 dock 版踩過，記在 `monitorLayout.ts:100-104`。

現行定稿的上半是兩欄（左 newsFeed+triage、右 timeline→alertBoard→hotZones），
**兩欄同止於 y17**；y17 以下是刻意的全寬縱向流，不受這條約束。
`monitorPacking.test.ts` 用寬度守恆（cols 子寬總和 = 自身寬、rows 子節點佔滿整欄寬）
通用守門，不寫死特定 y 值。

**1b. 固定高 widget 的 `h` 是實際高度**（`h*40 + (h-1)*10` px），不夠會讓內容溢出或格內捲。
實測需求：`alertBoard` 264px（h6=290 ✓；h5=240 會讓六宮格數字溢出卡片外）、
`hotZones` 234px（h5=240 ✓）、`timeline` 290px（h6）、`triage` 140px（h3）。
沙盒**不模擬真實內容高度**，拖完務必回站上目視這 5 個格子。

**2. `fit:"content"` 的 widget 不吃 `h` 當高度**

`h` 只決定欄內順序與拆解結果。20 個 widget 裡除了
`newsFeed` / `alertBoard` / `timeline` / `hotZones` / `triage` 這 5 個固定高，其餘全是 `fit`。
沙盒的 UI 有區分（固定高實線框、fit 虛線框），拖高度時別誤以為是真高度。

## 幾何參數（`MONITOR_SPLIT_DOCK`）

| 參數 | 預設 | 說明 |
|---|---|---|
| `widthPct` | 0.46 | dock 寬度佔視窗比例（1920 → 約 883px） |
| `top` | 56 | 上緣留白 —— **讓開右上角按鈕列**（App.tsx 那排 `top:16` 的即時/歷史·Share·Capture·Monitor·AI） |
| `right` / `bottom` | 14 / 14 | 邊距，比照 dock 模式 |
| `layersMaxVh` | 0.45 | split 開啟時 Layers 浮動面板高度上限（原 70vh），縮短以免擋住台灣本島 |
| `layersWidth` | 288 | 同上，寬度（原值不變，需要更窄再調） |
| `stackBreakpointPx` | 640 | 窄於此退化單欄堆疊。**比較基準是 grid 容器內寬，不是面板寬** —— 見下方 |
| `mapPaddingRight` | 0 | 地圖視野右側 padding。0 = 不動視野（台灣本來就偏左，dock 蓋不到）。真的擋到才調 |

## 自動定位（`MONITOR_SPLIT_CAMERA`）

進入 split 的那一刻把鏡頭飛到 `23.6111, 122.6936 / z7.3 / pitch 0 / bearing 0`，
讓台灣整島落在左半可視區。

- 中心刻意偏東（122.69°E，本島東方外海）：dock 佔掉右半邊，鏡頭若擺在本島上會被蓋掉一半
- **只在進入的那一刻飛一次** —— effect deps 只有開關與模式，之後手動平移縮放不會被拉回
- **退出 split 不還原**視角（刻意；退出時多半是要接著看地圖）
- `autoFrame: false` 可整個關掉，保留使用者當下視角
- ⚠️ `center` 是 `[lon, lat]`，與站台左上角除錯列的 `lat, lon` 顯示順序相反

### ⚠️ 堆疊判定的比較基準：GRID 寬，不是 DOCK 寬

`isStacked` 量的是**可捲動 grid 容器的 contentRect 寬**（ResizeObserver），
而那個容器有 `padding: 14px 16px 18px`（左右各 16）＋ 面板 1px 邊框 ×2：

```
GRID 實寬 = 面板寬 − 34 = widthPct × 視窗寬 − right − 34
```

沙盒的狀態列同時顯示 `DOCK 寬 · GRID 寬`，**警告燈以 GRID 為準**。
拿面板寬去比 `stackBreakpointPx` 會樂觀 34px，邊界寬度下沙盒顯示綠燈、正式站卻堆疊。

現行預設（`widthPct 0.46` / `right 14` / `stackBreakpointPx 640`）的實測結果：

| 視窗寬 | 面板寬 | GRID 寬 | 結果 |
|---|---|---|---|
| 1920 | 869 | 835 | ✅ 2 欄 |
| 1600 | 722 | 688 | ✅ 2 欄 |
| 1440 | 648 | 614 | ⚠️ **單欄堆疊** |

**翻轉點約 1496px**。要讓 1440 也維持兩欄，把 `widthPct` 調到 ≥0.48 或 `stackBreakpointPx` 降到 ≤600
（後者要留意：欄寬 <600 時 2 欄每欄不到 300px，內容會很擠）。

## 災害四卡的歷史趨勢

四張卡（颱風／輻射／落雷／地震）各有迷你柱狀圖，共用 `HazardTrendBars`：
**柱高 = 量、柱色 = 強度**（視覺公式借共機卡的 `TrendRow`，站上唯一同時編碼兩個
維度的既有樣式）。主題語意留在卡片，元件不認識任何主題。

| 卡 | 窗 | 柱高 | 柱色 | 資料 |
|---|---|---|---|---|
| 地震 | 14D | 當日次數 | 最大規模（沿用 `magColor()`） | 直查 `earthquake_events`，前端 bucket |
| 輻射 | 14D | 全站平均劑量 | 絕對水位（自然背景 .072／警戒 .2） | `get_nuclear_radiation_daily`（348） |
| 落雷 | 14D | 當日次數 | 相對多寡（有雷日 p50/p90） | `get_lightning_daily`（348，**必須傳 `p_source='cwa'`**） |
| 颱風 | **45D** | 上排：接近程度（越近越高）<br>下排：1000km 內顆數 | 距離分級／顆數分級 | `get_typhoon_proximity_daily`（349+350） |

幾個容易踩回去的決定：

- **颱風看 45 天、其餘 14 天**：颱風是季節性事件，14 天窗常整片空白；其餘三者是
  天天有數字的連續量。
- **颱風柱高刻意反轉**（`1500 − 距離`）：直接用距離當柱高的話，颱風在地球另一邊時
  柱子最高，與「該不該緊張」正好相反。
- **落雷用相對分位、輻射用絕對閾值**：前者回答「今天算多嗎」，後者回答「有沒有
  離開自然背景」。落雷分位只拿**有雷的日子**算 —— 乾季連續 0 會把中位數壓成 0。
- **颱風卡獨立一列**：它有兩排圖比別人高，同列的話等高規則會把其他三張一起拉高。
- **颱風柱可點**，展開當天每一顆（不只最近那顆）。

⚠️ **並排卡片等高**：`renderMonitorNode` 的 `cols` 節點在「子項全是單一 widget」時
用 `stretch`，有巢狀欄則維持 `start` —— 下半左右兩大欄長度差 500px，全域拉平會讓
短的那欄拖一大片空白。

⚠️ **split 下右側浮層要讓位**：事件 popup／AQI 切換器／LEGEND 那一疊與全域 LOADING
指示器都錨在畫面右緣，split 時要推到 dock 左邊（`calc(widthPct% + right + 12px)`），
否則會被面板蓋掉或壓在上面。

## 檔案

| 檔案 | 角色 |
|---|---|
| `src/components/intel/monitor/monitorSplitLayout.ts` | **SSOT**：`MonitorMode` 型別 + 窄版座標 + 幾何參數（沙盒貼上目標） |
| `src/components/intel/monitor/MonitorPanel.tsx` | 三種 mode 的幾何分支、依 mode 選佈局樹、header 三段切換 |
| `src/components/IconRailSidebar.tsx` | rail 新 icon 入口 + Layers 面板 compact |
| `src/App.tsx` | `monitorMode` state、兩個入口的互斥、選配的地圖 padding |
| `docs/features/monitor-split/sandbox-split.html` | 排版沙盒（座標唯一產生方式） |
| `src/components/intel/monitor/HazardTrendBars.tsx` | 災害四卡共用的迷你柱狀圖（柱高=量、柱色=強度、可點） |
| `src/lib/taipeiDay.ts` | 台北曆日 helper + 逐日補零（四支 loader 共用） |
| `../gis-platform/migrations/348..350` | 落雷／輻射／颱風的逐日 RPC（**皆已 apply**） |

## 相關

- [`../monitor-grid-static/`](../monitor-grid-static/) — dock 版的 12 欄網格重構，本功能的地基
  （`monitorPacking.ts` guillotine 拆解、`fit:"content"` 高度政策、沙盒工作流都源自那次）
