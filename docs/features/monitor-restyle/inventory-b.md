# 監看模式 restyle 盤點 B（split 版，10 格＋MonitorPanel 共用框）

> 唯讀盤點，未改任何程式。檔案路徑省略前綴 `src/components/intel/monitor/`，行號以 worktree `monitor-restyle`（branch `feat/monitor-restyle`）現況為準。
> 規格依據：`docs/design-system/spec.md` §3.13（字級 7 階 9/10/11/12/13/18/22）、§5.1（H2 標頭）、§6.1（標籤中文、不用 uppercase）、§6.3（不印內部識別碼）、§6.4/6.5（缺值「—」、null 不當 0）。
> 「字級字面值」只統計 `fontSize: <數字>` 形式；`big ? 22 : 14` 這類三元未計入，數量為下限。

## 0. 共通背景（讀各格前先知道）

- **實際寬度**：split 面板寬 = 視窗 46%（`monitorSplitLayout.ts:49-58`，`widthPct 0.46`、`stackBreakpointPx 640`）。內容層套 `zoom: 1.15`（`MonitorPanel.tsx:831-836`，`monitorLayout.ts:82`）。1920 視窗實寬約 849，邏輯寬約 738；w6 格約 364 邏輯 px、w12 約 738。`gridRef` 量到的實寬 < 640 就整個改單欄堆疊（`MonitorPanel.tsx:512-513, 837-855`），約等於視窗 < 1465 時成立。
- **這 10 格 split 全部是 `fit: "content"`**（`monitorSplitLayout.ts:123-136`）：`h` 只決定欄內順序與 guillotine 拆解，不是高度（`monitorSplitLayout.ts:17-18`、`MonitorPanel.tsx:133, 136`）。實際高度 = 內容高度，沒有任何固定 px 高的格子。
- **兩個「密集卡 zoom」**：PlaBoard（`PlaBoard.tsx:50`）、VesselZoneCard（`VesselZoneCard.tsx:217`）各再套 `zoom: 1.12`（`MONITOR_DENSE_CARD_ZOOM`，`monitorLayout.ts:98`），總倍率約 1.29。其他 8 格沒有。這是造成跨卡字級視覺差的最大單一原因之一。
- **`MonitorDataStatus`**（`MonitorDataStatus.tsx:5-19`）：傳輸狀態列，`fontSize: 10` 字面值、`FONT_CJK`、`palette.textMuted`；`ready` 時不渲染。**位置不固定**：有的放在卡片框外、SectionLabel 之上（ISR `:319`、TraDelay `:65-66/81-82`、Telecom `:412`、Prison／Situation／Power 在 MonitorPanel widget 層 `:628/649-651/655`），有的放在框內（AirportPax `:78`、ER `:70-72`、PlaBoard `:63-65`）。

---

## 1. MonitorPanel 共用框現況

### 1.1 外殼（`MonitorPanel.tsx:668-691`）
| 項目 | 現況 | 備註 |
|---|---|---|
| 位置 | split：`left = (1-0.46)*100%`、`top 56`、`right 14`、`bottom 14`（`:672-675`） | 來自 `MONITOR_SPLIT_DOCK` |
| 背景 | `rgba(8,9,13,0.86)`（wall 為 `rgba(6,7,11,0.97)`）`:677` | 手寫 rgba，非 `SURFACE.*` token |
| 邊框 | `:680` `borderTop` + `:681` `border` 同時寫；後者覆蓋前者，`borderTop` 為死碼 | `COLORS.panelBorder` |
| 圓角／陰影 | `RADIUS.xl`（8）、`ELEVATION.dock`（`:682, 686`） | token |
| 模糊 | `blur(18px)`（`:678-679`）；spec §5.30 其他浮層為 12~14 | 數值不一 |
| 動畫 | split `monitorSlideIn`、其餘 `monitorRise`（`:687-689`） | keyframes 內嵌在 `:860-897` |

### 1.2 標頭列（`:693-814`）——**不在 zoom 內**
- 容器：`padding: "8px 14px"`、`borderBottom: panelBorder`、`gap 10`（`:695-700`）；dock 模式才有拖曳把手（`:709-718`）。
- 標題群：icon 15px accent ＋「監看模式」`FONT_SIZE.lg`(13) 700 `#fff`（`:726`，字面 `#fff`）＋**英文大寫**「MONITOR」`FONT_DATA` xs `letterSpacing 2.5px`（`:729-735`）＋**英文大寫**「BETA」徽章：手寫 `rgba(255,152,0,0.16)`／`rgba(255,152,0,0.45)`（與 `COLORS.statusWarnSoft/Border` 同值卻沒引用，`:738-741`），`presBreathe` 呼吸動畫（`:743`）。
- 副標：`今日 N 則 · SITUATIONAL AWARENESS`（`:762`）：`FONT_DATA` sm、`textFaint`，**英文大寫**；是 header 唯一可壓縮項（`:750-761`）。
- 右側：三顆模式鈕「Dock／Split／Wall」**英文**（`:98-102, 766-794`）`FONT_SIZE.base`、`padding 5px 11px`、`RADIUS.lg`、active 用 accentFaint，inactive 背景 `rgba(255,255,255,0.05)` 手寫；「退出」文字鈕（`:796-813`）而非 spec §5.1 的 24×24 X icon 鈕（且無 `aria-label`）。
- 對不齊 hack：各子項 `marginTop: isWall ? 0 : 4`（`:722, 758, 765, 805`）。
- **與 spec §5.1 H2 標頭的差異**：spec 為 padding `10px 14px`、eyebrow 9px 中文 letterSpacing 1.4、標題 13px bold、X 關閉鈕；此處 padding `8px 14px`、無 eyebrow、英文大寫副標、文字「退出」、標題群字母間距 2.5。

### 1.3 捲動容器與格子殼
- 捲動層 `padding: "14px 16px 18px"`、`overflowY: auto`（`:819-826`）；內層 `zoom 1.15` + `flex column gap 10`（`MONITOR_GRID_GAP`，`monitorLayout.ts:105`）。
- **格子殼完全沒有框**（`:127-140`）：`className="mtp-scroll mtp-monitor-cell"`，只設 `minWidth/minHeight 0`、`flex column`、`fit ? height:auto, overflow:visible : 固定高 + overflow:auto`。**沒有 padding、border、radius、背景、標題**。`.mtp-monitor-cell > * { flex: 1 0 auto; min-height: 0 }`（`:864`）讓 widget 根節點撐滿格子。
- 結論：**卡片框、標題、padding 全部由各 widget 自己畫**，MonitorPanel 不提供共用卡片框元件。這是所有不一致的結構性根因。
- 等高規則（`:149-175`）：`cols` 的子項「全是單一 widget」才 `alignItems: stretch` + 子層 `display:flex` + widget cell `flex: 1 1 0%`（`fillWidth`，`:122, 135`）；只要混有 `rows` 就 `start`。我負責的格子中只有 **prison | airportPax**（皆 w6）落在此規則內；其餘 8 格皆 w12 單欄獨佔一列，不適用等高。
- 堆疊模式（`:837-855`）：每格 `width:100%`、`fit` 則 `height:auto`、`flexShrink 0`；順序依 (y,x)。
- 格內 widget 根節點要自己 `gridColumn: "1 / -1"`（PowerCard `:66`、SituationOverview `:199`、RipeTimelineView `:246` 殘留此寫法）——這是 12 欄 grid 時代的遺留，在 flex 殼內無效。

---

## 2. 總表

| 格 | 元件 | split 寬/列 | 外框 | 標題列 | 主數字 | 圖表 | 缺值處理 | 手寫 hex／rgba | 字級字面值（非 7 階或散值） |
|---|---|---|---|---|---|---|---|---|---|
| prison | PrisonCard | w6，與 airportPax 並列（等高） | 有：SectionLabel＋框 | 「司法矯正 · INMATES」（中英混、SectionLabel 內 uppercase） | xxl(22) FONT_DATA 700 | 共用 `TimeseriesSparkline`（gapSec 3 天） | **較好**；但 null 時綠燈（`:54`） | 5 hex／2 rgba | 0（全 token） |
| airportPax | AirportPaxCard | w6 | 有 | 「機場入出境 · BORDER PAX 24H」 | sm(10) 700 | 共用 `TimeseriesSparkline` ×2（入／出各一張，gapSec 2h） | 0 視為缺格剔除（`:31-32`） | 6 hex／3 rgba | 0 |
| powerCard | PowerCard | w12 | 有：主框＋3 個次框（不同 padding/bg） | 「能源 · POWER GRID」＋次標 `UNIT OUTPUT`（xs 英文）＋ SectionLabel×2 | 22（三元字面）／14 | `Sparkline`（PressureRing）×14 廠＋`TimeseriesSparkline`×2＋CSS bar | 多處混用（見 §3.3） | 3 hex／11 rgba | 10×5、10.5、11、13×2、8.5×2、9×6 |
| erCongestion | ERCard | w12 | 有 | 「急診壅塞 · ER CONGESTION 24H」＋框內 `ER WAIT ·`、`14D TREND ·`（英文 xs） | 20／14 字面 | `Sparkline` ×N 院＋`TimeseriesSparkline`×1＋CSS bar | 見 §3.4 | 2 hex／6 rgba | 10、10.5、11、14、20、8.5、9×6 |
| situationOverview | SituationOverview | w12 | 有：`Widget`（padding 15 覆蓋）＋自繪標題（複製 SectionLabel） | 「戰情概覽 · PRESSURE INDEX」 | 環 40（`PressureRing.tsx:66`）／ MiniStat xxl | SVG 270° 環＋CSS bar（抽屜） | 非 ready 用 50 定色（`:188`） | 2 hex／3 rgba | 8.5×2、9.5、（環內 40、7.5） |
| plaBoard | PlaBoard | w12，**額外 zoom 1.12** | 有 | 「共機擾台 · PLA SITUATION BOARD」＋框內 `SEVERITY`／`RowLabel`（英文 xs） | 30／22 字面 | **手刻 CSS 柱狀圖**（190px 高）＋CSS bar×3 | 最完整的 null 區分，但 3 處 `?? 0/1`（見 §3.5） | **15 hex／13 rgba（最多）** | 10×2、22、30、8.5×2、9×5、9.5×3 |
| vesselZone | VesselZoneCard | w12，**額外 zoom 1.12** | **無框、無 SectionLabel** | 內嵌 12px/600 CJK「特殊船舶接近帶」（無色條） | 無主數字（11px 摘要句） | 共用 `HazardTrendBars`×5（合併＋四分帶）＋CSS bar | 0 艘畫成灰樁（`:189`，語意反） | 4 hex／0 rgba | 10×3、11×2、12、9×2（**全部字面、零 token**） |
| isrSatellitePasses | IsrSatellitePassCard | w12 | 有 | 「中國 ISR 衛星 · TERRITORIAL PASS MONITOR」 | 28 字面 | 共用 `HazardTrendBars` | **最嚴謹**（七態 display kind） | 7 hex／1 rgba | 28、8.5×2、9×6 |
| traDelay | TraDelayBoard | w12 | **無框**；根 `<div>` 無 padding | `SectionLabel`「TRA DELAY」（純英文、預設 accent 色條） | lg(13) 三格 Stat | **手刻 SVG 三線圖**（`preserveAspectRatio none`、無軸） | 分母 0 斷線；無軸標 | 1 hex／1 rgba | 0（全 token） |
| internetHealth | TelecomStatusCard | w12 | 有：外框邊色隨狀態 `${statusColor}55`＋內層 3 種卡 | SectionLabel「RIPE NCC 網路觀察 · NETWORK OBSERVATION」＋框內 `OBSERVATION ONLY · BASELINE BUILDING` | md(12) 小計 | 共用 `TimeseriesSparkline`（雙線 IPv4/IPv6，h 142） | 良好（空白不是 0） | 3 hex／6 rgba | 0（全 token）但大量英文 |

---

## 3. 逐格盤點

### 3.1 prison — `PrisonCard.tsx`
1. **split 尺寸**：`x0 y61 w6 h5 fit:content`（`monitorSplitLayout.ts:123`）；高度 = 內容；與 airportPax 並列 → `allLeaf` 等高 stretch（`MonitorPanel.tsx:149-175`），無固定 px。
2. **外框**：widget 自畫（`:85-93`）：`RADIUS.xl`、`1px panelBorder`、背景 `linear-gradient(160deg, rgba(124,58,237,0.06), rgba(255,255,255,0.012))`（紫調）、`padding 12px 14px`、內部 `gap 8`；外層 `gap 10`（`:83`）。
3. **標題列**：`SectionLabel`（`PressureRing.tsx:326-344`：3×12 色條＋`FONT_DATA` sm `letterSpacing 1.5px` `textTransform: uppercase` textDefault）文字「司法矯正 · INMATES」（`:84`，色 `COLORS.accent`）。框內第二標題：狀態點 11px（發光 `boxShadow`）＋「全國在監 (日期)」`FONT_CJK` md(12) 700 textStrong（`:94-102`）。無更新時間欄、無右側資訊；日期塞在標題括號內。來源字放底部 xs（`:171-175`）。
4. **數值列**：主數字 `FONT_DATA` xxl(22) 700 textStrong＋「人」sm textMuted（`:107-110`）；男/女 sm（`:112-114`）；容額／超收率／當日入出 xs（`:116-122`）。超收率色 `#fb7185`（手寫）。無「變化量」。單位「人」緊貼數字右側 marginLeft 4（與 spec §6.2「中文單位前補空白」不同）。
5. **圖表**：共用 `TimeseriesSparkline`（`:150-160`）`height 64`、`lineColor "#a78bfa"`（手寫）、`gapSec 3 天`、`showTooltip`、`compactYAxis`；有 90D／1Y 切換鈕（`:132-146`，`FONT_DATA` xs、`padding 2px 7px`、`RADIUS.sm`）。元件內軸標 8px 固定字面（`TimeseriesSparkline.tsx:365,479`）。
6. **缺值／過期**：`fmt` 缺值回「—」（`:32-35`）；停更 >7 天（`STALE_WARN_DAYS`）燈轉灰（`:53-54`）、底部 `⚠ 上游已 N 天未更新` 用 `#fbbf24` 手寫色（`:171-174`）；單點顯示「趨勢待回補」說明（`:163-169`）；`gapSec` 斷線避免連成假平穩（`:148-149`）。⚠ **`latest === null` 時 `isStale=false`、`isOver=false` → `dotColor="#10b981"` 綠燈**（`:51-54`），標題顯示「資料載入中」卻亮綠燈。`Number(overPct) > 0`（`:42`）只影響色、不補 0。
7. **共用／手刻**：共用 SectionLabel、TimeseriesSparkline；手寫 hex：`#ef4444/#10b981/#fb7185/#a78bfa/#fbbf24`；`fontSize` **全走 `FONT_SIZE` token**（9 次）——10 格中 token 化程度最高之一。

### 3.2 airportPax — `AirportPaxCard.tsx`
1. **split**：`x6 y61 w6 h5 fit:content`（`:124`），與 prison 等高並列。
2. **外框**：`:43-51` 同 Prison 模板，漸層改天藍 `rgba(14,165,233,0.06)`，padding/gap 同。
3. **標題列**：SectionLabel「機場入出境 · BORDER PAX 24H」（`:42`，accent）。框內**沒有第二標題列**，首列是機場 tab（`:52-69`，`FONT_CJK` sm、`padding 3px 8px`、`RADIUS.sm`，active 用手寫 `#0ea5e9`/`rgba(14,165,233,0.18)`）；tab 文字「桃園 TPE」中英並列。
4. **數值列**：`24h 入 / 24h 出` sm，色 `#10b981` / `#fb7185`（手寫），數字 `FONT_DATA` 700（無獨立大字級，`:70-77`）。沒有與昨日／上一窗的變化量。
5. **圖表**：入、出各一張 `TimeseriesSparkline`（`:90-91`）`height 70`、`gapSec 2h`、`showTooltip`，線色 `#10b981`／`#fb7185`；**兩張各自 Y 軸**（不共用，不可比）。
6. **缺值**：
   - ⚠ `:31` `pick(r) || 0` 後 `.filter(p => p.v > 0)`（`:29-32`）：註解稱「v=0 視為缺格剔除，避免聚合假 0」。等於把**真實 0** 也丟掉；`gapSec 2h` 會把連續幾小時的 0 顯示成斷線而非 0。
   - ⚠ `:36-37` `sumIn/sumOut` 用過濾後序列加總；`hasReadableData` 為真但序列空時顯示「0」（`:72, 75`）——等於把缺資料加總成 0。
   - 載入中：`query.status === "unknown"` 顯示「載入中…」置中 sm（`:79-82`）；空：「無資料（border_airport_snapshot 未涵蓋此機場）」xs（`:83-86`）⚠ 印出內部表名（§6.3）。
   - 來源行「來源：移民署 APIS（每小時 / get_airport_hourly_pax）」（`:94-96`）⚠ 印出 RPC 名。
7. **共用／手刻**：共用 SectionLabel、TimeseriesSparkline、MonitorDataStatus（框內，與 Prison 的框外位置不同）；6 hex 手寫。字級全 token。

### 3.3 powerCard — `PowerCard.tsx`（＋`powerCardData.ts`）——**多指標卡 #1**
1. **split**：`x0 y66 w12 h11 fit:content`（`:125`）；根節點多寫 `gridColumn: "1 / -1"`（`:66`，遺留）。
2. **外框**：**四種框並存**：
   - 主框 `:70-78`：`RADIUS.xl`、panelBorder、綠調漸層 `rgba(34,197,94,0.06)`、padding `12px 14px`、gap 11。
   - 4 區迷你格 `:130-135`：`RADIUS.md`、`rgba(255,255,255,0.03)` 背景、`borderSoft`、padding `6px 8px`。
   - KPI 條 `:166-172`：`RADIUS.lg`、`rgba(255,255,255,0.02)`、padding `8px 12px`。
   - 廠區/趨勢 3 個次框 `:234-241, 296-305, 341-350`：`RADIUS.xl`、panelBorder、背景 `rgba(255,255,255,0.02)`、padding `11px 14px`、gap 9；**次框與主框的漸層、padding（14 vs 11）不同**。
   - 廠格 `PlantSparkRow :426-432`：`RADIUS.md`、`rgba(255,255,255,0.025)`、padding `5px 7px`（與 ER 的 HospitalCell 同寫法，各自複製）。
3. **標題列**：SectionLabel「能源 · POWER GRID」（`:67`）；主框首列＝燈號點 11px 發光（`RESERVE_INDICATOR_COLORS`）＋燈號文字 md(12) 700 ＋右側觀測時間膠囊 `HH:mm`（`fontSize 8.5`、`rgba(255,255,255,0.05)`，`:91-99`）——**本次 10 格中唯一有「右側更新時間膠囊」的卡**（非本次範圍的 TAIEX `PressureRing.tsx:145-152` 也有同款）。次框標題：`UNIT OUTPUT · N 廠 24h`（`FONT_DATA` xs、`letterSpacing 1.2`、**英文大寫**，`:244-246`，非 SectionLabel）；趨勢兩框標題用 SectionLabel（`:306, 352`）。**同一張卡內有三種標題寫法**。
4. **數值列**：`Stat`（`:394-411`）：大 22／小 14（三元字面，非 token；22 恰為 xxl、14 非階）、`FONT_DATA` 700 `#fff`（字面 `#fff` 非 `textStrong`）；label 10 字面 `FONT_CJK` textMuted；單位 9 字面 `FONT_DATA` textFaint，「MW」英文單位在 `%`/MW 之間不一致（「%」緊貼、「MW」分離）。KPI 條數字 13 字面 `#fff`。廠格數字 10、單位 8.5、負載率 9 700。**變化量：無**（沒有 vs 昨日）。
5. **圖表**：
   - **14 廠迷你折線**：`Sparkline`（`PressureRing.tsx:239-324`，SVG、w48 h18，strokeWidth 1.4、opacity .85、x 依「第幾點」等距而非時間、無軸無刻度、hover 走 `useChartTooltip` 且可 `labelAt` 標 HH:mm，`PowerCard.tsx:456-469`）。線色 = `loadRateColor(rate)`（`powerCardData.ts:148-154`，手寫 `#9ca3af/#ef4444/#f97316/#22c55e/#64aaff`，依負載率分四色＝**折線顏色本身是狀態指示**）。
   - **30 天備轉率**：`TimeseriesSparkline` 單線、`fillArea`、h64、`gapSec 1.5 天`（`:314-323`）。
   - **30 天供電能力 vs 尖峰負載**：`TimeseriesSparkline` 雙線（主線 `statusLive`、`extraSeries` `statusWarn`）、共用 MW Y 軸、`compactYAxis`、`gapSec`（`:362-374`）。**圖例**是卡片自製 `TrendLegendDot`（6px 圓點＋`FONT_DATA` 9px，`:380-392`），放在標題列右側；備轉率單線圖無圖例、也沒有 `seriesLabel`。
   - **區域用電**：純 CSS 4px bar（`:144-156`）；**燃料結構**：6px 堆疊 CSS bar＋5 個 5px 圖例點（`:189-228`），`fuelColorOf`（`energyLoader.ts:904`）。
   - 區別多線：只靠顏色（綠 vs 橘）＋標題右側圖例＋tooltip（`seriesLabel`/`extraSeries.label`）；hover 時有垂直虛線＋圓點（`TimeseriesSparkline.tsx:544-549`）。
6. **缺值／過期／暫停／受影響**：
   - **狀態背景色帶：無**。卡片不因 `status`/過期/機組出力 denied 改變背景、邊框（只有燈號點顏色＋文字）。
   - 載入／權限／失敗：`MonitorDataStatus` ×3（`MonitorPanel.tsx:649-651`）＋機組出力專屬三態文案「需登入後檢視／暫時無法取得／等待…」（`:248-255`，`dayStatus` prop，是 **10 格中少見的 denied 區分**）。
   - ✔ `fmtMW`/備轉率/plant `—`（`:40-43, 106, 446`）。
   - ⚠ `powerCardData.ts:42` `pct: mw != null ? … : 0`：缺區用 0 寬度 bar（數字仍是「—」，僅視覺上像 0）。
   - ⚠ `powerCardData.ts:36-39` `regionMap[r] ?? 0` 只用於取 max；`PowerCard.tsx:63` `r.mw ?? 0` 只用於 tooltip 分母（占比）——缺區被當 0 進占比分母，但不顯示為 0。
   - ⚠ **`PowerCard.tsx:457` `data={spark.length ? spark : [0,0]}`**：無序列的廠畫出貼底水平線（等同畫 0）。
   - ⚠ `powerCardData.ts:107-110` 全國合計：某廠在某時點沒有值時直接當 0 加（`totalByTs.get(ts) ?? 0) + mw`），`peakMW`／「當前合計」是**下限**，卡片沒有標示；`peakMW > 0` 才顯示整條 KPI（`:164`）。
   - ⚠ 30 天趨勢：`max_supply_mw`/`peak_load_mw` 型別為非 null number（`energyLoader.ts:72-73`），`PowerCapacityVsLoad30d` 不過濾（`:331-338`）；`snap_cnt`（collector 當日斷線指標，`energyLoader.ts:75`）**沒有被使用**，低快照日仍畫成正常點。備轉率單線有過濾 null（`:289`）。
   - 缺口：`gapSec 1.5 天` 斷線（`:38`）。
7. **共用／手刻**：共用 SectionLabel、Sparkline、TimeseriesSparkline、`useChartTooltip`；手寫 `#fff`、11 處 rgba、4 個 `loadRateColor` hex；字級 10/10.5/11/13/8.5/9 字面共約 17 處。

### 3.4 erCongestion — `ERCard.tsx`（＋`erCardData.ts`）——**多指標卡 #2**
1. **split**：`x0 y77 w12 h11 fit:content`（`:126`）。
2. **外框**：主框 `:58-66`：紅調漸層 `rgba(239,68,68,0.06)`、padding `12px 14px`、gap 10（Power 為 11）；全台摘要列 `:187-193`：`RADIUS.lg`、`rgba(255,255,255,0.03)`、padding `6px 10px`；醫院格 `HospitalCell :138-144` 同 PlantSparkRow 寫法（複製）。**只有一層大框**（Power 是一主框＋三次框）。
3. **標題列**：SectionLabel「急診壅塞 · ER CONGESTION 24H」（`:57`）＋框內再一行 `ER WAIT · N 院 24h 等一般病床`（`FONT_DATA` xs 英文大寫、`letterSpacing 1.2`，`:67-69`）——**與 SectionLabel 重複的第二標題**；分區標題「北部／中部…」11px 700＋`N 院`＋`Σ N 等床`（9px）＋迷你比例條＋分隔線（`:86-101`）；14 天圖標題 `14D TREND · 全台等床`（9 字面、英文，`:259-261`）。無狀態點、無更新時間。
4. **數值列**：全台等床 20 字面 `#fff` tabular-nums（`:196-204`，20 非階）；單位「人」9px；醫院格數字 14 字面（`:159`，非階）＋色＝`erCongestionColor`（`ER_LEVEL_COLORS` 手寫 `#22c55e/#facc15/#f97316/#ef4444/#6b7280`，`erCongestionTypes.ts:27-33`），單位「等床」8.5。**無變化量**。
5. **圖表**：
   - 逐院迷你折線 `Sparkline` w40 h18（`:167-175`），線色=當前壅塞級別色；無軸；hover 標 HH:mm（`fmtHm`，`:126-130`）。
   - 14 天趨勢 `TimeseriesSparkline` h64 `fillArea` `lineColor "#fb7185"`（手寫）`showTooltip`，**沒有 `gapSec`**（`:267`）→ 缺桶會被連線。
   - 全台／區摘要：CSS 6px 堆疊比例條＋色點圖例（`:209-249`）、4px 80px 迷你條（`:280-296`）。**指示方式：顏色四級（紅橘黃綠）＋文字級別＋有無資料計數**。
6. **缺值**：
   - ✔ `wait == null` → 數字「—」、`nodata` 灰（`:160`）；`buildErSummary` null 不計入 total、另列 `無資料 N`（`erCardData.ts:101-110`、`ERCard.tsx:244-248`）。
   - ⚠ **`ERCard.tsx:168` `data={hasSpark ? cell.spark : [0,0]}`** 與 Power 同：無序列畫貼底線（且 `showTooltip` 關閉）。
   - ⚠ `erCardData.ts:51-54` 把 `p[3] == null` 的點**直接剔除**再交給 `Sparkline`（等距 index 軸）→ 缺的小時被壓縮掉、看不出斷線（與 Sparkline 自己支援 null 斷線的能力矛盾，`PressureRing.tsx:217` 註解）；`ERCard.tsx:41-53` 為此另複製一份過濾邏輯維持 hover 時間對齊（重複實作）。
   - ⚠ 14 天趨勢 `trend14d.slice(1)`（`:38`）：無條件丟首桶；無 gap 斷線。
   - 載入中/空：`groups.length === 0` → 「資料載入中…」或「尚無急診觀測資料」sm textFaint（`:78-81`）；三條 `MonitorDataStatus`（`:70-72`）。14 天圖 `spark.length === 0` → 「載入中…」置中（`:262-266`，即使是空資料也顯示「載入中」）。
   - 來源行「來源：衛福部 急診即時訂閱（get_er_hospital_latest / 24h_all）」（`:117-119`）⚠ 印 RPC 名。
   - **狀態背景：無**。
7. **共用／手刻**：共用 SectionLabel、Sparkline、TimeseriesSparkline、tooltip；手寫 `#fb7185`、`#fff`、6 rgba；字級字面 12 處（10/10.5/11/14/20/8.5/9×6）。

### 3.5 plaBoard — `PlaBoard.tsx`——**多指標卡 #3**
1. **split**：`x0 y92 w12 h12 fit:content`（`:128`）；**`zoom 1.12`**（`:50`）→ 有效倍率約 1.29；根節點 `minHeight 0`。
2. **外框**：`:52-61`：紅調漸層 `rgba(239,68,68,0.06)`、padding `12px 14px`、gap 11，`flex:1; minHeight:0`。內部各區塊無框，只有 `RowLabel`（xs 英文標籤＋1px 分隔線，`:414-423`）。
3. **標題列**：SectionLabel「共機擾台 · PLA SITUATION BOARD」色 **`#ff6b6b`**（手寫，`:51`，其他卡用 accent 或主題色）；頭部嚴重度塊：`SEVERITY` xs 英文 → 中文級別 22 字面 700（`:109-115`）；各分區 `RowLabel` 為英文大寫＋中文混雜「120D TREND · 架次（柱）／越中線（疊色）· 灰=解析失敗」「空域方位 · …」。沒有狀態點；日期區間 `reportDate 0600 ~ periodEnd 0600` 9.5px（`:135-137`）當作「更新時間」。
4. **數值列**：架次主數字 **30 字面** `#fff` 700（`:131`，無對應 token）；單位「架次」base；AxisBar 右側 `value 單位 · p百分位` 9.5px 固定寬 66 右對齊（`:177-179`）；級別色塊使用 `${color}66/14` 字串拼接 alpha（`:105`）。**變化量：以「百分位」取代**（p75/p90 刻度線）。
5. **圖表**：
   - **手刻 CSS 柱狀圖**（`TrendRow :246-283`）：高 190 固定（`:246`，flex 會塌縮，見註解 `:212-215`）、`gap 1`、柱高 = 架次/本區間最大值、柱色 = `PLA_LEVEL_COLORS` 五級（`intelLoaders.ts:551-553`，`#34d399/#94a3b8/#fbbf24/#fb923c/#ef4444`）、疊 `rgba(0,0,0,0.42)` 暗層表示「越中線」。**沒有 Y 軸刻度**，只在下方印「本區間 中位／最高」文字（`:284-295`）；X 軸僅首末日期 8.5px。hover：`useChartTooltip`。
   - 另一套柱狀圖 `HazardTrendBars` 存在（其檔頭自承借自 PlaBoard TrendRow），PlaBoard 本身卻**沒有改用它**，兩者並行（≈ 重複實作）。
   - AxisBar（百分位條 7px，`:159-182`）、ZoneRow／KindRow（6px 條，`:340, 394`）、時間切換鈕 120D/90D/30D/7D（`:220-240`，紅調 active）。
   - **指示方式**：五級色（與 ISR 的五級色**完全同色系**但各自複製常數）＋中文級別＋「雙軸共振」徽章。
6. **缺值**：
   - ✔ 明確區分 `sorties === null`（灰短樁＋tooltip「解析失敗」，`:249-257`）與 0（1px 底線，`:274`）；頭部 `day.sorties ?? "—"`。
   - ⚠ **`:156` `const p = pct ?? 0`**：百分位缺失時 bar 寬 0 且色走 `p >= 50 … : "#34d399"`（綠＝低段），但文字顯示 `p—`；視覺上等同「最低段」。
   - ⚠ **`:90-92` `day.level ?? 1`**：`level === null` 時 label/color 有正確退為「資料未解析」/灰，但 `lv` 仍是 1，`band` 文字（`:94-98`）會印出「`< p50 架次`」（像是低段）。
   - ⚠ **`:260` `d.level ?? 1`**：level null 但 sorties 有值的柱被畫成等級 1 色。
   - ⚠ `:259` `d.crossedMedian ? … : 0`：null 與 0 同為「無疊層」（tooltip 才區分「—」）。
   - ⚠ `:205-206` 全為 null 時 `stats.max/p50 = 0`，尾行會印「中位 0 · 最高 0 架次」。
   - 載入／空：`!latest || !summary` → 「資料載入中…」或「尚無可用共機態勢資料」sm（`:66-69`）。無過期提示（沒有「資料落後 N 天」）。
   - 誠實標註文字較長（`:76-79`、`:406-408`）。
7. **共用／手刻**：只共用 SectionLabel、tooltip；**15 hex／13 rgba 手寫**（`#ef4444/#fb923c/#fbbf24/#94a3b8/#34d399/#ff8080/#ff6b6b/#a78bfa/#60a5fa/#c4b5fd` 等）；字級字面 10×2/22/30/8.5×2/9×5/9.5×3，另有多處未以 `fontSize` 寫出的 `width: 62/66/54/44/30` 固定欄寬（密集卡 zoom 存在的理由，`monitorLayout.ts:91-96`）。

### 3.6 vesselZone — `VesselZoneCard.tsx`——**多指標卡 #4**
1. **split**：`x0 y104 w12 h10 fit:content`（`:130-131`）；**`zoom 1.12`**（`:217`）。
2. **外框**：**無框**：根 `div` 只有 `flex column gap 8` + `fontFamily: FONT_CJK`（`:217`），沒有 border/背景/padding，也沒有 SectionLabel。視覺上與相鄰 PlaBoard（有框）接在一起時像是「標題列懸空」。**10 格中唯二無框（與 traDelay）**。
3. **標題列**：行內標題「特殊船舶接近帶」12px 600（`:221-223`，`fontWeight 600` 而非其他卡的 700；無色條）＋最深分帶徽章 pill（`ZONE_COLORS[level]` 底 `22`/邊 `55` 字串拼 alpha，`RADIUS.pill`，10px，`:226-237`）＋摘要句 `日期 · N 艘 · 最近 X 浬` 11px FONT_DATA（`:238-240`）。**無 eyebrow、無英文標籤（10 格中唯一全中文）**。
4. **數值列**：**沒有獨立大數字**；最大艘數僅在 footer「單日最高 N 艘」（8px，`HazardTrendBars.tsx:162-168`）與摘要句。單位「艘」「浬」緊貼；`fmtDist` 負值顯示「線內 X 浬」。
5. **圖表**：共用 `HazardTrendBars` ×5：1 張合併（h52，柱色＝最深分帶 4 級色 `#fbbf24/#fb923c/#ef4444/#b91c1c`，`:56`）＋4 張分帶（各 h34、單色、**各自比例尺，跨帶高度不可比**，`:296-326`）；`HazardTrendBars` 標題 8.5px、軸標 8px 字面（`HazardTrendBars.tsx:90, 162`）；hover `useChartTooltip`（點柱）。分類出現天數 CSS 6px 條（`:329-355`）。**指示方式**：色＝分帶深度，footer 文字給數字，沒有獨立圖例色塊（標題 caption 文字「柱／色」說明）。
6. **缺值／過期**：
   - ⚠ **`:144-168` `fillDays`**：資料庫沒有的日子一律補成 `ships: 0`，註解主張「沒有列＝當天沒有船（真的 0，不是缺資料）」——是**假設**而非證據；collector 停擺或 AIS 斷訊的日子也會被畫成 0。
   - ⚠ **`:189` `value: a.ships || null` 與 `:304` `value: n || null`**：反向錯置——**真實 0 艘被傳成 `null`**，`HazardTrendBars` 對 null 畫「灰樁」且 tooltip 標題列寫「**無資料**」（`HazardTrendBars.tsx:104-117`），只靠 `note` 補「無船進入接近帶」。與元件自己的契約（`:27` null＝無資料、0＝真的 0）正好相反；而 `HazardTrendBars` 對 0 本來就有 1.5% 底線可用。
   - ⚠ `:106` `r.ships ?? 0`；`:300,311,312` `byZone.get(zone) ?? 0` 亦同。
   - 載入／空：`latest` 為空時 `status==="unknown"`→「資料載入中…」；`ready`→「N 天內無觀測紀錄」；其他→「資料暫不可用」（`:243-245`）；`hasReadableData` 為假時整塊圖區以「不以空資料推斷未出現特殊船舶。」取代（`:356-358`）。
   - 無過期（stale）提示。無狀態背景色帶。
   - 誠實限制 9px（`:364-366`）。
7. **共用／手刻**：共用 HazardTrendBars；**字級 100% 字面值**（10×3/11×2/12/9×2，`FONT_SIZE` 零引用，檔頭只 import `RADIUS`）；`#` 4 hex；`fontWeight 600` 與他卡 700 不一致。

### 3.7 isrSatellitePasses — `IsrSatellitePassCard.tsx`——**多指標卡 #5**
1. **split**：`x0 y114 w12 h8 fit:content`（`:132`）；無額外 zoom。
2. **外框**：SectionLabel＋框（`:320-329`）：背景 `rgba(255,255,255,0.02)`（無漸層，與 Prison/Airport/ER/Pla 的主題漸層不同）、padding **`11px 13px`**（他卡 12/14，Power 次框 11/14）、gap 9。根 `fontFamily: FONT_CJK`（`:318`）。
3. **標題列**：SectionLabel「中國 ISR 衛星 · TERRITORIAL PASS MONITOR」色 `#a78bfa`（手寫，`:320`）；框內首列為主數字或狀態句（`:330-346`）；無狀態點、無更新時間欄（時間資訊塞在底部診斷格，`:465-478`）。
4. **數值列**：主數字 **28 字面** `#fff` 700（`:333`；Pla 30、Power 22、ER 20、Prison 22 token，五卡五種大數字字級）；「次過境」base；`日期 · N 顆不重複衛星` sm。變化量：「↑ 高於中位數／↓ 低於中位數／＝ 等於」文字＋色（`MEDIAN_DIRECTION_LABEL`、`latestLevelColor`，`:249-253, 387-391`），**10 格中唯一以「與中位數比」取代變化量且附位階 pill**。
5. **圖表**：共用 `HazardTrendBars`（`:428-436`）h74、色＝本區間相對位階五級（`ISR_PASS_LEVEL_COLORS`，`:55-57`，**與 PlaBoard `PLA_LEVEL_COLORS` 同色階但獨立常數**）；圖例自製（`:438-463`：6px 圓點＋標籤＋門檻值，8.5px）；切換鈕 7D／…（`:353-376`，與 Prison/Vessel 同款但各自複製：`fontSize 9`、`padding 2px 7px`、`RADIUS.sm`）。`HazardTrendBars` 對**缺日不補、不留空位**（`buildIsrPassBars` 只給有列的日子，`:91-112`）→ X 軸壓縮、缺日在圖上看不出來（僅文字「可呈現日 N/M」）；而 VesselZone 是補 0，兩卡對「缺日」處理相反。
6. **缺值**：**10 格中最嚴謹**。
   - 七態 `IsrLatestDisplayKind`（loading/error/empty/stale/unknown_freshness/incomplete/ready，`:21-28, 66-89`）＋對應文案「… · 不以 0 代替」（`:219-226`）；stale/error 用 `statusWarn` 色。
   - `passCount === 0` 只有在 `scopeCoverageComplete === true` 才呈現為 0（`:98-99`），否則為 null「非 0」。
   - 分位數排除 null 保留 0（`:131-166`）；樣本 < 8 天不分級（`:53, 156`）。
   - ⚠ 但：底部診斷格直接印英文欄位名 `latest_valid_day / computed_at / scope_coverage / china_isr_census / coverage_complete / freshness / registry_reviewed`（`:471-477`）；文案 `latest_valid_day`（`:361` title）——違反 §6.3、§6.1；`ISR_PASSES_DEFAULT_REGION · ISR_PASSES_DEFAULT_TIER_MODE` 常數直接印（`:484`，可能是內部代碼）。
   - 告警色帶：`latestLevel === 4` 時出現橘紅 `role="status"` 警示塊（`:411-425`：`${color}12` 背景＋`${color}55` 邊）——**10 格中唯一「依狀態出現背景色塊」的提示**。
7. **共用／手刻**：共用 SectionLabel、HazardTrendBars；`#` 7 hex；字級 28/8.5×2/9×6 字面，另 3 次走 token。

### 3.8 traDelay — `TraDelayBoard.tsx`——**多指標卡 #6**
1. **split**：`x0 y122 w12 h8 fit:content`（`:134-135`）；無額外 zoom。
2. **外框**：**無框**：兩個 return 根皆為無樣式 `<div>`（`:63, 79`）；只有 Stat 小格有 `borderSoft` 框（`:316-320`，`RADIUS.sm`、`rgba(255,255,255,0.02)`、padding `6px 8px`）。間距全靠 `marginBottom 10/8`（`:85, 112, 258`），不是 `gap`。
3. **標題列**：`SectionLabel`「TRA DELAY」（`:64, 80`）——**純英文、無中文**、預設色（accent），不像其他卡有「中文 · ENGLISH」。無來源／更新時間列，日期與覆蓋率在最底部 xs 小字（`:167-177`）。
4. **數值列**：三個 Stat（`:85-105`）：主數字 **`FONT_SIZE.lg`(13)** `FONT_DATA` **無 fontWeight**（`:326`；他卡主數字多為 700、20~30px）——**數字最小、無粗體**，是這 10 格中「主數字視覺重量最弱」的一張；小標 xs、副標 xs；單位「′」（分鐘符號）緊貼。變化量：無；色＝`delayColor`（statusLive/`#eab308`/statusWarn/statusErr，`:37-43`）。
5. **圖表**：**手刻 SVG 三線圖**（`DelayTrendChart :201-310`）：`viewBox 0 0 100 46`、`preserveAspectRatio="none"`、`vectorEffect non-scaling-stroke`、strokeWidth 1.2；三線 accent／statusWarn／statusErr；**沒有 Y 軸刻度、沒有 X 軸標、沒有資料點圓點、沒有垂直指示線**（hover 只有浮層，`:231-255`）；僅在標題右側印「上緣 N%」（`:264`，以 `max` 對齊、最小 0.05）。圖例：`8×2` 色塊＋文字 xs（`:295-305`）。**未使用 `TimeseriesSparkline`**（該元件支援多線、軸、hover、gap）。X 軸以「第幾個有 observedTrains 的日子」等距（`:205, 213`），缺班表日（`nearDestTrains = 0`）斷線但**佔位**；`observedTrains = 0` 的日子整個被濾掉（壓縮）。
6. **缺值**：
   - ✔ `nearDestTrains = 0` → `null` → 斷線，註解明寫「不可用 0 代入」（`:207-209, 216-224`）；tooltip 對缺班表日顯示「無資料」＋原因（`:238-245`）；標題列印出「N 天缺班表」（`:264`）。
   - ✔ 平均誤點／最大誤點 null → 「—」（`:94, 101`）。
   - ⚠ `:150` `{t.maxDelayMin ?? "—"}′` 缺值會印成「—′」。
   - ⚠ 主數字取「最後一個 `nearDestTrains > 0` 的日子」（`:54-59`），最新日缺班表時**靜默退回較早一天**，僅在最底 xs 小字顯示 `serviceDate`（`:170`）；主數字區沒有日期標示，讀者易當成「今天」。
   - 空狀態：`!latest` → 「尚無台鐵誤點資料」或「資料載入中…」sm（`:61-72`）；`DelayTrendChart` 有效點 < 2 → 整張圖 `return null`（`:206, 229`，無說明）。
   - **受影響／過期色帶：無**；只有 `delayedPct >= 15` 讓主數字轉 statusWarn（`:90`）。
7. **共用／手刻**：只共用 SectionLabel、tooltip；字級**全走 token**（13 次）；1 hex（`#eab308`）。是「用 token 但視覺最弱」的代表。

### 3.9 situationOverview — `SituationOverview.tsx`
1. **split**：`x0 y88 w12 h4 fit:content`（`:127`）；根 `gridColumn: "1 / -1"`（`:199`，遺留）。
2. **外框**：`Widget`（`PressureRing.tsx:346-361`：`RADIUS.xl`、panelBorder、`rgba(255,255,255,0.022)`、padding 13、flex column）被覆蓋：`padding: 15`、背景改 `linear-gradient(150deg, ${level.soft}, rgba(255,255,255,0.012) 46%)`（**漸層色隨壓力等級變**）、展開時 border 變 `${level.color}66`（`:197-204`）。**Widget 是唯一共用卡片框元件，但 10 格中只有這格在用**。emergency 級多一層 `inset boxShadow` 脈動（`:205-213`）＝**10 格中唯二的「依狀態整卡發光」**（另一為 ISR 級 4 警示塊）。
3. **標題列**：**自繪**（`:214-230`，複製 SectionLabel 結構但 `marginBottom 13`、沒有 `textTransform uppercase`、色條隨等級色）：「戰情概覽 · PRESSURE INDEX」`FONT_DATA` sm、`letterSpacing 1.5` ＋右側「10 訊號加權 0–100」xs。
4. **數值列**：環內分數 **40 字面**（`PressureRing.tsx:66`）、級別 lg(13) 700 色、英文 `level.en` **7.5px**（`:76`，全站最小字級之一）；`MiniStat`（`:14-43`）：英文 label 8.5px（EVENTS／SEVERE ≥3／SOURCES）在上、數字 xxl(22) `FONT_DATA` 700 `#fff`、中文單位 sm 在右——**英文 eyebrow＋中文單位倒置**；變化量 `CompareLine`（`PressureRing.tsx:85-102`）：`↗+N`／`↘N` 符號＋md 700，**漲＝`statusWarn` 橘、跌＝`statusLive` 綠**（與 TAIEX 的台股慣例漲紅跌綠**相反**，`PressureRing.tsx:117`）。
5. **圖表**：SVG 270° 環（r=52、stroke 9、`rotate(135deg)`、`drop-shadow` 發光、dasharray 過渡 .6s，`PressureRing.tsx:14-83`）；抽屜：`PressureDrawer`（`:46-171`）`1fr 1fr` 格、每列 7px CSS bar＋`×權重`＋分數，色 `pressureLevel(s.raw).color`；四級圖例 9.5px。
6. **缺值／過期／暫停**：
   - ⚠ **`:188` `pressureLevel(status === "ready" ? smoothedScore : 50)`**：非 ready 時拿**捏造的 50** 決定卡片漸層色、邊框、脈動與色條——讀者看到的是「中等」等級的背景。
   - ✔ 環內數字非 ready/stale 時顯示「—」、文字「受限／中斷／未知」、色灰（`PressureRing.tsx:50, 70-78`）；`stale`（error 且有舊值）用 `muted` 與「最後成功值 · vs 基準」字樣（`:267-268`）——**10 格中最完整的 stale 文案**。
   - ⚠ `MonitorPanel.tsx:62-64, 290` `EMPTY_PRESSURE.composite = 0`、`smoothed` 初值 0 → 環 `val` 在 loading 時以 0 畫（顯示「—」但弧長為 0）；僅 ready 之後才有真值。
   - MiniStat：`totalEvents ?? "—"`、`sourceHealthAvailable ? … : "—"`（`:274-282`）；`(severeCount ?? 0) > 0` 只決定色，不顯示 0。
   - 抽屜空時顯示「⚠ 尚無 signal 細節（後端未回 per_signal）」（`:60`）⚠ 印內部欄位名 `per_signal`（§6.3）。
7. **共用／手刻**：共用 Widget、PressureRing、CompareLine、tooltip；自繪標題；`fontSize` 字面 8.5×2/9.5；`PressureRing` 內 40/7.5。

### 3.10 internetHealth — `TelecomStatusCard.tsx`
1. **split**：`x0 y130 w12 h4 fit:content`（`:136`；實際是全卡中最高者之一，h4 僅為順序用）。`RipeTimelineView` 根仍寫 `gridColumn: "1 / -1"`（`:246`）。
2. **外框**：最複雜的巢狀：外框（`:368`）`borderColor = ${statusColor}55`（**邊框色隨狀態：RIPE 青 `#22d3ee` 或 textDim**——與 Prison/Airport/ER/Pla 固定 panelBorder 不同）、青調漸層 `145deg`（Prison 等為 160deg，角度也不同）、padding `12px 14px`、內部 `display:grid auto-fit minmax(min(100%,250px),1fr)` gap 14；兩張 `MeasurementCard`：`RADIUS.xl`、**`borderMid`**、背景 **`rgba(2,8,23,0.32)`**（深藍黑，非白 alpha）padding `11px 12px`（`:125-131`）；時間軸框：`borderMid`、`rgba(2,8,23,0.42)`、padding 12（`:246`）。**三層、三種底色、兩種邊框色**。
3. **標題列**：SectionLabel「RIPE NCC 網路觀察 · NETWORK OBSERVATION」（`:367`，色 `RIPE_CYAN`）＋框內狀態列：狀態點 12px（`:372`，無發光；他卡 11px 發光）＋狀態文字 lg(13) 700（`:373`）＋下方 `OBSERVATION ONLY · BASELINE BUILDING` xs 英文大寫 `letterSpacing 1.6`（`:375`）＋指標列 `FRESH METRICS／REPORTING FEEDS／LAST RIPE UPDATE`（xs 英文大寫、數字 md，`:379-381`）。卡內標題 `RIPE Atlas／RIPE RIS Live` 用 `FONT_DATA` base 粗體（`:134`）、`CURRENT／PARTIAL／BASELINE／STALE／UNAVAILABLE／NO DATA` 英文狀態字（`:117-121, 137`）。**10 格中英文標籤密度最高**。
4. **數值列**：`FRESH METRICS N/14` md bold（`:379`）；量測值 sm 粗體（`measurementValue`：比例 `X.X%`、`X.X ms`，單位緊貼，非 §6.2 的「字母開頭單位前補空白」）；每格附 `FRESH · probes=…`、`…前 · confidence …` 兩行 xs（`:160-167`），`confidence` 原文英文欄位值直接印。無變化量。
5. **圖表**：共用 `TimeseriesSparkline`（`:288-299`）h **142**（他卡 64~74）、`fillArea`、`timeDomain` 明示、`gapSec = bucketSeconds*1.5`、IPv4 青 `#22d3ee`＋IPv6 紫 `#a78bfa`（`extraSeries`，**雙線以色＋圖例＋ tooltip label 區分**，圖例為 `9×2` px 色塊＋文字，`:303-305`，與 Power 的圓點圖例、TraDelay 的 8×2 色塊、ISR 的 6px 圓點各不同）；切換器：range 按鈕（`:253-260`，青色 active、`RADIUS.md`）、來源 tab（底線式，`:266-273`）、指標 `<select>`（`:277`，背景手寫 `#09101d`，`minHeight 27`）——**同一張卡內 3 種切換樣式**；與 Prison/Vessel/ISR 的時間窗切換鈕（`RADIUS.sm`、accentFaint active）不同。
6. **缺值／過期／暫停**：**僅次於 ISR 的嚴謹**。
   - `toSparkline` 只取 `state === "ready" && value != null` 的點（`:204-212`）＋`gapSec` 斷線，空白不補 0；空狀態「這段期間尚無可畫的 X；空白不是 0，也不代表異常」（`:286`）；`loading`／`error` 各有專屬文案（`:284-285`，error 用 statusWarn）；`truncated`「回傳達上限，圖表不完整」statusErr（`:310`）；`partial`「含缺口／部分資料」（`:309`）；`coverageLabel` 顯示覆蓋率（`:214-216, 306-307`）。
   - 單值：`measurementValue` null → 「—」（`:80-85`）；`measurementStateLabel`：「RIB 基準建立中」「PARTIAL」「UNAVAILABLE」（`:95-101`，statusWarn，**中英混**）；`freshness === "stale"` 的數字降為 textFaint（`:152`）。
   - 失敗：`phase === "error"` 時狀態點/文字轉 textDim、外框邊色轉 textDim（`:361-362`）並在說明列寫「傳輸成功或舊資料都不等於 CURRENT」（`:363`）——**邊框色隨狀態變化算是 10 格中最接近「暫停/受影響背景提示」的做法，但只改邊色、不改背景**。
   - 暫停/受影響背景色帶：**無**。
7. **共用／手刻**：共用 SectionLabel、TimeseriesSparkline；3 hex（`#22d3ee/#a78bfa/#09101d`）＋6 rgba；字級**全 token**（29 次）但文案大量英文與內部欄位名。

---

## 4. 多指標卡（供電／急診／共機／特殊船舶／ISR／台鐵）並排比較

### 4.1 折線／圖形怎麼畫
| 卡 | 主要圖形 | 實作 | X 軸依據 | Y 軸／刻度 | hover |
|---|---|---|---|---|---|
| Power | 14 廠迷你折線＋2 張 30 天折線＋CSS bar | `Sparkline`（index 等距）＋`TimeseriesSparkline` | 迷你＝第幾點；大圖＝時間 | 迷你：無；大圖：Y 刻度＋X 6/12/18 tick | 迷你 tooltip 標 HH:mm；大圖垂直虛線＋圓點 |
| ER | 逐院迷你折線＋14 天折線＋CSS bar | `Sparkline`＋`TimeseriesSparkline` | 同上 | 同上 | 同上 |
| PLA | 手刻 CSS 柱狀（190px）＋CSS bar | 自寫 div 柱 | 日序等距 | **無刻度**，只印首末日期與「中位/最高」文字 | tooltip |
| Vessel | 柱狀×5 | `HazardTrendBars` | 日序等距（補滿日曆日） | 無刻度，footer 印最高值 | tooltip（點柱） |
| ISR | 柱狀×1 | `HazardTrendBars` | 日序等距（**不**補缺日） | 無刻度，footer 印最高值 | tooltip |
| TraDelay | 三折線 | 手刻 SVG path | 日序等距（濾掉 observed=0 的日子） | 無刻度，只印「上緣 N%」 | tooltip（整條 svg，無指示線） |
| Telecom | IPv4/IPv6 雙線 | `TimeseriesSparkline` | 時間（timeDomain） | Y 刻度＋X tick | 同大圖 |

→ **同樣是「時間序列」卻有 5 種實作**（Sparkline、TimeseriesSparkline、HazardTrendBars、PLA 手刻柱、TraDelay 手刻 SVG）。軸標／刻度從「有完整 Y/X」到「完全沒有」。圖高：Power/ER/Prison 64、Airport 70、ISR 74、Vessel 52/34、PLA 190、TraDelay 46、Telecom 142。

### 4.2 多條線怎麼區分／圖例／指示點
- **Power 供電 vs 負載**：兩色（statusLive／statusWarn）＋標題右側 `TrendLegendDot`（6px 圓點，9px）；備轉率單線無圖例。
- **TraDelay 三線**：三色（accent／statusWarn／statusErr）＋圖例下置 `8×2` 色塊＋xs 文字（**線型圖例＝橫線，Power 為圓點**）。
- **Telecom 雙線**：青／紫＋`9×2` 色塊圖例（置底）＋tooltip `seriesLabel`；若 IPv4 無資料自動換 IPv6 為主線（`:238-240`）。
- **Airport 入/出**：拆成兩張圖、各自 Y 軸（不共用）。
- **Vessel 分帶**：拆成 4 張單色柱圖（各自比例尺）。
- **PLA/ISR**：單維柱，色＝分級（五級同色階、常數各自一份）。
- **指示點（狀態燈）**：Prison 11px 發光點；Power 11px 發光點；Telecom 12px 無發光；PLA 用色塊＋文字；ER、Vessel、ISR、TraDelay 無狀態點（靠 pill/顏色文字）。大小 11/12 不一致、發光不一致。

### 4.3 缺值：斷線 vs 連成 0 vs 壓縮
| 卡 | 缺格處理 | 判定 |
|---|---|---|
| Prison | `gapSec 3 天` 斷線 | 斷線 |
| Airport | 0 與 null 都剔除再 `gapSec 2h` 斷線 | 斷線，但吃掉真 0；加總把缺資料加成 0 |
| Power | 大圖 `gapSec` 斷線；迷你 `[0,0]` 補貼底線；KPI 合計缺點當 0 | 混合 |
| ER | 迷你：**剔除 null 壓縮**＋`[0,0]`；14 天圖無 gap → **連線** | 壓縮／連線 |
| PLA | null＝灰樁、0＝底線，分開 | 最佳 |
| Vessel | 缺日補 0，0 又被當 null 畫灰樁 | **混淆** |
| ISR | null＝灰樁；缺日不補、不留位 | 好，但缺日看不到 |
| TraDelay | 分母 0 斷線佔位；`observed=0` 壓縮 | 好（無軸） |
| Telecom | 只取 ready 點＋`gapSec` 斷線＋coverage | 好 |

### 4.4 暫停／受影響／告警「背景提示」
- **整卡背景/邊框隨狀態變化**：SituationOverview（漸層＋邊框＋emergency inset 脈動，但非 ready 時用假 50）、Telecom（僅邊框色 `${statusColor}55`）。
- **局部色塊警示**：ISR（level 4 才出現的 `role="status"` 橘紅塊）、PLA（SEVERITY 色塊＋「雙軸共振」徽章）、Prison（文字轉 `#fbbf24`＋燈轉灰）。
- **只有文字＋`MonitorDataStatus`**：Airport、ER、Vessel、TraDelay、Power（機組出力有 denied/error 文案）。
- **沒有任何「資料過期」視覺**：Power（僅燈號點）、ER、PLA、Vessel、TraDelay（僅回退日期小字）。
- 傳輸狀態列 `MonitorDataStatus` 是**唯一跨卡統一的提示元件**，但擺放位置（框內／框外）不統一。

---

## 5. 把缺值畫成 0／假值的位置清單（彙整）

| # | 位置 | 行為 | 嚴重度 |
|---|---|---|---|
| 1 | `PowerCard.tsx:457` | 無序列廠 `data=[0,0]` → 貼底水平線 | 中（畫出假線） |
| 2 | `ERCard.tsx:168` | 同上（醫院無序列） | 中 |
| 3 | `VesselZoneCard.tsx:144-168`（`fillDays`） | 無資料日一律補 `ships:0`，聲稱「真的 0」無證據 | 高（無法分辨停擺與無船） |
| 4 | `VesselZoneCard.tsx:189, 304` | 真 0 艘以 `|| null` 傳成「無資料」灰樁（語意反向） | 高（null/0 互換） |
| 5 | `SituationOverview.tsx:188` | 非 ready 用 `50` 決定卡片等級色、邊框、脈動 | 高（捏造等級） |
| 6 | `PlaBoard.tsx:156` | `pct ?? 0` → 百分位缺失畫成 0 寬綠條 | 中 |
| 7 | `PlaBoard.tsx:90-92, 94-98` | `level ?? 1` → level null 仍印「< p50 架次」 | 中 |
| 8 | `PlaBoard.tsx:260` | `level ?? 1` → level null 的柱用等級 1 色 | 低 |
| 9 | `PlaBoard.tsx:205-206` | 全 null 時印「中位 0 · 最高 0 架次」 | 低 |
| 10 | `PlaBoard.tsx:259` | `crossedMedian` null 與 0 同為無疊層 | 低 |
| 11 | `AirportPaxCard.tsx:31-32` | `|| 0` + 過濾 `>0` → 吃掉真 0；斷線代替 0 | 中 |
| 12 | `AirportPaxCard.tsx:36-37, 72, 75` | 空序列加總顯示「0」 | 中 |
| 13 | `powerCardData.ts:107-110` | 合計缺點當 0 → peak／當前合計為下限且未標示 | 中 |
| 14 | `powerCardData.ts:42` | 缺區 `pct:0`（寬度 0，數字「—」） | 低 |
| 15 | `PowerCard.tsx:63`、`powerCardData.ts:38` | `?? 0` 僅進占比分母／max | 低 |
| 16 | `PrisonCard.tsx:51-54` | `latest=null` 時綠燈（正常假象） | 中 |
| 17 | `erCardData.ts:51-54` | 剔除 null 點導致缺口被壓縮（不是 0 但隱藏缺口） | 中 |
| 18 | `ERCard.tsx:267`（無 `gapSec`）＋`:38` | 14 天圖缺桶連線 | 中 |
| 19 | `PowerCard.tsx:331-338` | 30 天供電／負載不過濾、不使用 `snap_cnt` 標低快照日 | 低 |
| 20 | `TraDelayBoard.tsx:54-59` | 最新日缺班表靜默退回前一日；主數字區無日期 | 低 |
| 21 | `MonitorPanel.tsx:62-64, 290` | `EMPTY_PRESSURE.composite=0`、`smoothed` 初值 0（僅由 status 閘門擋住） | 低（依賴閘門） |

做得好的對照：PlaBoard `sorties` null/0 分離（`:249-274`）、ISR 全套七態＋「不以 0 代替」、TraDelay 分母 0 斷線、Telecom 空白不是 0、Prison `gapSec` 斷線。

---

## 6. 跨格不一致點總結

### 6.1 外殼／框（最嚴重，結構性）
1. **MonitorPanel 不提供卡片框**（`:127-140` 格子殼無任何視覺樣式），每卡自繪。10 格中：有框 8、**無框 2（vesselZone、traDelay）**、其中只有 1 格用了共用 `Widget`（situationOverview）。
2. **框內規格各抄各的**：padding 12/14（Prison/Airport/Power 主框/ER/Pla/Telecom）、11/13（ISR）、11/14（Power 次框）、15（Situation）、13（Widget 預設）；gap 8/9/10/11/14；背景＝主題色 160deg 漸層（Prison 紫、Airport 藍、Power 綠、ER／Pla 紅）vs `rgba(255,255,255,0.02)`（ISR、Power 次框）vs 隨狀態漸層（Situation）vs 深藍 `rgba(2,8,23,…)`（Telecom 內層）；邊框 panelBorder／borderMid／`${statusColor}55`。
3. **標題列四種寫法**：SectionLabel（7 格，且內含 `uppercase`，違反 §6.1）、自繪複製版（Situation）、行內 12px/600（Vessel）、純英文 `TRA DELAY`（TraDelay）；另外 Power／ER／Telecom 在框內還有第二層英文 eyebrow（`UNIT OUTPUT`、`ER WAIT`、`OBSERVATION ONLY…`），與 SectionLabel 重複。**無任何一格符合 spec §5.1 的「中文 eyebrow 9px ＋ 13px bold 標題」。**
4. **狀態點**：Prison/Power 11px 發光、Telecom 12px 無發光、其餘無。
5. **更新時間/來源**：Power 右上膠囊、Prison 括號日期、Pla 區間、ISR 底部診斷格、TraDelay 底部小字、ER／Airport 來源行；位置與語氣（有的「來源：…」有的無）不一。
6. **MonitorDataStatus 擺放位置**框內／框外不一。
7. **密集卡 zoom** 只套在 PlaBoard、Vessel，使兩卡有效字級 ≈ 1.29×，緊鄰的 ISR（無 zoom）相對縮小，造成同一縱向流中字級忽大忽小。

### 6.2 文字與 token
1. **字級**：非 7 階字面值遍布：8／8.5／9.5／10.5／14／20／28／30／40／7.5；VesselZoneCard **零 token**；token 最乾淨的是 Prison、Airport、TraDelay、Telecom（但後兩者視覺最弱/最雜）。主數字 6 種：Prison 22(token)、Power 22/14、ER 20/14、Pla 30、ISR 28、TraDelay 13、Situation 環 40＋MiniStat 22。
2. **字重**：Vessel 標題 600；其餘 700；TraDelay 主數字無字重。
3. **英文／大寫**：SectionLabel 內建 `textTransform: uppercase`；Power `UNIT OUTPUT`、ER `ER WAIT`／`14D TREND`、Pla `SEVERITY`／`120D TREND`、Situation `EVENTS/SEVERE ≥3/SOURCES`、Telecom `FRESH METRICS`／`CURRENT`／`PARTIAL`…、TraDelay 標題純英文、MonitorPanel header `MONITOR`／`BETA`／`SITUATIONAL AWARENESS`／`Dock/Split/Wall`。
4. **§6.3 內部識別碼外露**：Airport（`border_airport_snapshot`、`get_airport_hourly_pax`）、ER（`get_er_hospital_latest / 24h_all`）、ISR（`latest_valid_day`、`computed_at`、`scope_coverage`、`china_isr_census`、`coverage_complete`、`freshness`、`registry_reviewed`、`ISR_PASSES_DEFAULT_*`）、Situation（`per_signal`）、Telecom（`confidence`、`probes=`、`BGP messages=`）。
5. **手寫色**：PlaBoard 15 hex／13 rgba；同一「五級色階」在 Pla（`PLA_LEVEL_COLORS`）、ISR（`ISR_PASS_LEVEL_COLORS`）、`ER_LEVEL_COLORS`、`RESERVE_INDICATOR_COLORS`、`loadRateColor` 五處各有一份近似但不相同的 hex；`COLORS.statusWarnSoft/Border` 已有卻在 header BETA 徽章手寫同值。
6. **漲跌色相反**：CompareLine 漲橘跌綠（`PressureRing.tsx:92`）vs TAIEX 漲紅跌綠。
7. **單位寫法**：Prison 「22 人」（marginLeft 4）、Power `MW` 分離、Telecom `%`/`ms` 緊貼，均與 §6.2「字母／中文單位前補空白」不一致。

### 6.3 圖表
- 同為時間序列有 5 種實作（見 §4.1）；軸標、tooltip 指示線、Y 軸比例尺政策（各自、本區間最大、分帶獨立、三線共用）不一致；圖高 34~190 不等。
- 時間窗切換控制 5 款：Prison/Vessel/ISR（`9px`、`RADIUS.sm`、accentFaint）、Pla（紅色 active、`RADIUS.md`、`9px letterSpacing .6`）、Telecom range（青色、`RADIUS.md`）＋來源 tab（底線式）＋原生 `<select>`、Airport tab（`FONT_CJK` sm、`#0ea5e9`）。
- 缺日處理：Vessel 補 0、ISR 不補不留位、TraDelay 斷線佔位、Prison/Power/Telecom 時間軸斷線（見 §4.3）。
- 圖例：Power 圓點、TraDelay 橫線色塊、Telecom 橫線色塊（9×2）、ISR 圓點＋門檻、Vessel 無圖例。

---

## 7. 可當共用基礎的既有元件

| 元件 | 位置 | 可用於 | 備註／限制 |
|---|---|---|---|
| `Widget` | `PressureRing.tsx:346-361` | 卡片框基底 | 目前只有 Situation 使用；padding 13、背景 `rgba(255,255,255,0.022)`；需補 accent 漸層／狀態邊框 props |
| `SectionLabel` | `PressureRing.tsx:326-344` | 標題列 | 內含 `uppercase`（與 §6.1 衝突，要先改）；已被 7 格使用，改一處全卡同步 |
| `MonitorDataStatus` | `MonitorDataStatus.tsx` | 傳輸狀態列 | 已 10 格共用；`fontSize: 10` 字面、`palette` 取色，需統一位置 |
| `TimeseriesSparkline` | `../../TimeseriesSparkline.tsx` | 所有時間序列折線 | 已支援 `gapSec` 斷線、`extraSeries` 雙線、`timeDomain`、`fillArea`、tooltip＋指示線；**可取代 TraDelay 手刻 SVG、ER 14 天圖補 `gapSec`**；軸字 8px 固定字面 |
| `Sparkline` | `PressureRing.tsx:239-324` | 迷你折線 | null 會斷線、孤點畫圓；目前呼叫端都先剔除 null 或補 `[0,0]`，未發揮此能力；x 為 index 等距 |
| `HazardTrendBars` | `HazardTrendBars.tsx` | 「量＋強度」柱狀 | null＝灰樁、0＝1.5% 底線的契約最清楚；**PlaBoard TrendRow 可改用它**；字級 8／8.5 字面 |
| `useChartTooltip`／`fmtChartValue` | `../../ChartHoverTooltip` | hover 浮層 | 全站已共用 |
| `CompareLine`／`PressureRing` | `PressureRing.tsx` | 變化量行／環形 gauge | 漲跌色語意需定案 |
| `COLORS`／`FONT_SIZE`／`RADIUS`／`ELEVATION` | `intelTokens.ts`、`designTokens.ts` | token | `FONT_SIZE` 7 階已足；缺的是「圖內軸標 8px」「大數字 28/30/40」的對應 |
| ISR 的 `deriveIsrLatestDisplay`＋`DISPLAY_LABEL` 模式 | `IsrSatellitePassCard.tsx:66-89, 219-226` | 缺值／過期／錯誤文案範本 | 可抽成跨卡「載入／空／錯誤／過期」顯示契約 |
| `MONITOR_DENSE_CARD_ZOOM` | `monitorLayout.ts:98` | 現行字級補丁 | 改成統一 token 後可移除 |

### 沒有可重用但值得抽的缺口（僅列事實，不建議實作）
- 卡片框（漸層主題色／狀態邊框／padding／gap）
- 「更新時間＋來源」footer（spec §5.3 F2 已有 popup 版，監看卡無對應）
- 圖例（圓點／橫線）
- 時間窗切換鈕（5 款並存）
- 五級色階常數（PLA／ISR／ER／Power／loadRate）
- 「載入中／無資料／更新中斷／過期」四態占位
