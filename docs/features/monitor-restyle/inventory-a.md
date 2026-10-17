# 監看模式 split 版面盤點 A（14 格）

> 唯讀盤點，產出日 2026-09-30，分支 feat/monitor-restyle。範圍：newsFeed、timeline、alertBoard、hotZones、triage、liveWall、hazardStrip、typhoon、radiation、lightning、earthquake、foodPriceBoard、taiex、situationCards。
> 行號以本 worktree 當下檔案為準。`M` = `src/components/intel/monitor/`，`A` = `src/components/intel/alerts/`，`D` = `src/data/`。
> 「未實測」＝只讀 code 推論，沒開瀏覽器。規格依 `docs/design-system/spec.md` §3.13（字級 7 階 9/10/11/12/13/18/22）、§6.1（中文標籤、不 uppercase）、§6.2（單位空白）、§6.5（null 不當 0）。

## 0. 共通機制（先讀這段，下面不重複）

| 項目 | 事實 | 位置 |
|---|---|---|
| 外殼不畫卡片框 | MonitorPanel 每格只是 `.mtp-monitor-cell`（flex column、`minWidth:0`、`minHeight:0`），**卡片框由各元件自己畫**，沒有共用「Card」外框 | `M/MonitorPanel.tsx:123-140` |
| 固定高 vs 內容撐 | 無 `fit` → 高度 = `h*40 + (h-1)*10` px、`overflow:auto`；`fit:"content"` → `height:auto`、`overflow:visible`（內容溢出不裁切也不捲，直接壓到下一格）。`fit:content` 的 `h` 在 split 只影響 guillotine 切線順序，不決定高度 | `M/MonitorPanel.tsx:133-137`；常數 `M/monitorLayout.ts:103,105`（列高 40、gap 10） |
| 子層撐滿 | `.mtp-monitor-cell > * { flex:1 0 auto; min-height:0 }`：元件根節點會長到格高（固定高格）或被 stretch（並排等高列） | `M/MonitorPanel.tsx:864` |
| 並排等高 | `cols` 且子項全是單一 widget → `alignItems:stretch` ＋ 每格 `flex:1 1 0%`。split 內符合的列：radiation｜lightning｜earthquake、taiex｜situationCards（及不在本批的 prison｜airportPax） | `M/MonitorPanel.tsx:150-173` |
| 內容縮放 | 內容層整體 `zoom:1.15`；實寬 835px（1920 視窗）→ 邏輯 726px；w6 格 = (726-10)/2 = **358 邏輯 px** | `M/MonitorPanel.tsx:827-836`、`M/monitorLayout.ts:82`；dock 寬 `M/monitorSplitLayout.ts:50`（widthPct 0.46） |
| 堆疊模式 | dock 實寬 < 640px 改單欄，依 (y,x) 排序、fit 格 auto、其餘固定高 | `M/MonitorPanel.tsx:512-513,837-855`；`monitorSplitLayout.ts` `stackBreakpointPx: 640` |
| `newsDerived` 包裝 | timeline／triage／hotZones 首次成功前整格只剩 `MonitorDataStatus` 一行文字（格內沒有卡片框、固定高仍保留） | `M/MonitorPanel.tsx:561-564` |
| `MonitorDataStatus` | 只在 `status !== "ready"` 時渲染一行 10px `textMuted`「{label} · 讀取中/更新中斷/無權限讀取」，error 且曾成功 → 加「保留舊資料，最後成功讀取 …」 | `M/MonitorDataStatus.tsx:8-19`（`fontSize:10` 手寫、`padding:"4px 0"`） |

### split 座標總表（`M/monitorSplitLayout.ts:103-122`）

| id | x | y | w | h | fit | 高度來源 |
|---|---|---|---|---|---|---|
| newsFeed | 0 | 0 | 6 | 14 | 固定 | 690px（14*40+13*10） |
| timeline | 6 | 0 | 6 | 6 | 固定 | 290px |
| alertBoard | 6 | 6 | 6 | 6 | 固定 | 290px（註記：h5=240 會讓六宮格溢出，:100-102） |
| hotZones | 6 | 12 | 6 | 5 | 固定 | 240px（註記：h4 只露 4 筆） |
| triage | 0 | 14 | 6 | 3 | 固定 | 140px |
| liveWall | 0 | 21 | 12 | 13 | content | 內容撐（2×2 16:9） |
| hazardStrip | 0 | 34 | 12 | 7 | content | 內容撐（1×2 16:9） |
| typhoon | 0 | 41 | 12 | 6 | content | 內容撐（獨立一列全寬，:112-115） |
| radiation | 0 | 47 | 4 | 4 | content | 內容撐＋並排 stretch |
| lightning | 4 | 47 | 4 | 4 | content | 同上 |
| earthquake | 8 | 47 | 4 | 4 | content | 同上 |
| foodPriceBoard | 0 | 51 | 12 | 7 | content | 內容撐（走勢圖 min 140px） |
| taiex | 0 | 58 | 6 | 3 | content | 內容撐＋與 situationCards stretch |
| situationCards | 6 | 58 | 6 | 3 | content | 同上 |

左欄 690+10+140 = 840，右欄 290+10+290+10+240 = 840，兩欄同高。

---

## 1. newsFeed — `M/NewsFeedPanel.tsx`（接線 `M/MonitorPanel.tsx:567-592`）

1. **尺寸**：x0 y0 w6 h14，固定 690px，內部 `overflowY:auto` 的清單自捲（:165-166）。
2. **外框**：元件自畫。`borderRadius:RADIUS.xl`、`1px panelBorder`、背景 `neutralFill(0.022)`、`height:100%`、`overflow:hidden`（:70-76）。標題列 `padding:"11px 14px 9px"`，清單區 `padding:"12px 14px 16px"`（:155）。另外整棵被 `IntelThemeProvider palette={DARK_INTEL}` 包住（:47-51），走 palette 而非直接用 COLORS。
3. **標題列**：icon（radio 15px）＋「新聞 Feed」（中英混，12.5px 700 FONT_CJK `textStrong`，:82）＋狀態 pill（點＋`LIVE`／`受限`／`更新中斷`／`讀取中`，`FONT_DATA` xs 700，:92-112）＋右側「N 則」`FONT_DATA` 10.5px `textMuted`（:114）。沒有 eyebrow、來源、更新時間。`LIVE` 為英文大寫。
4. **數值列**：無主數字。
5. **圖表**：無；清單＋ `IntelCard`（與 `IntelPanel` 共用），左側一條漸層縱線（:180-186）。
6. **缺值／過期**：`status!==ready` 時標題下補一行 xs 說明文字（:118-122）；空狀態 icon＋「目前無符合條件的事件」（md）＋副行（sm）（:139-150）。**卡片內 `IntelCard.tsx:80-81` 的 `GIS_LEVELS[e.gis_relevance ?? 0]`／`SEV_LEVELS[e.severity ?? 0]`，null 被畫成最低級徽章**。
7. **共用 vs 手刻**：共用 `IntelCard`、`IntelFilters`、`MonitorDataStatus`（接線處，label 寫「升溫排行」是 trending 查詢，不是新聞本體，:568）。手刻：標題列、狀態 pill、空狀態。**非 7 階字級**：12.5（:82）、10.5（:114）；`IntelCard.tsx` 內 9.5／10.5／12.5 多處（:51,69,153,170,184,200,216,283,297,396）。

## 2. timeline — `M/TimelineDock.tsx`（含 `A/AlertsTrack.tsx`；接線 `MonitorPanel.tsx:605-618`）

1. **尺寸**：x6 y0 w6 h6，固定 290px。內部 chart 區 `flex:1; minHeight:0`（:204），不是固定 px，會吃剩餘高。
2. **外框**：元件自畫，**與同欄其他卡不同**：`padding:"10px 16px 8px"`、**只有 `borderBottom`**、背景 `rgba(0,0,0,0.28)`，**沒有圓角、沒有四邊框**（:114-121）。這是 dock 版底部橫條的遺留樣式。
3. **標題列**：「時間軸 TIMELINE DOCK」（中英混，`FONT_DATA` xs、letterSpacing 2px、`textMuted`，:124-131；**中文被包在等寬字裡**）＋副標「新聞密度 · 每小時」9.5px（:132）＋右側 7 個分類色方塊（8×8，:137-146）＋ 分隔線 ＋ 播放鍵 26×26（:148-164）＋時間字（`即時 NOW`／`HH:MM`，md 700，:165-173）＋ `LIVE` 鈕（`FONT_DATA` sm，:174-193）。`LIVE`、`NOW` 為英文。沒有來源、更新時間。
4. **數值列**：無主數字。時間字 md `FONT_DATA`；`minWidth:58` 固定 px。
5. **圖表**：24 根 CSS 堆疊柱（flex 子 div，column-reverse，依分類色，:224-262）＋ 5 條水平格線（:206-214）＋ 未來區暗罩（:215-222）＋ 播放指針（:264-280）＋ hover tooltip **自己手刻**（:282-327，不走 `useChartTooltip`）＋ x 軸刻度 0/6/12/18/23:59（:330-344）＋下方 `AlertsTrack`（24 格警報軌，另有 `ALERTS 24H` 8.5px 標籤 `AlertsTrack.tsx:83`）。可拖曳 scrub。
6. **缺值／過期**：`newsDerived` → 沒資料前整格只剩一行狀態字。`bucketByHour` 對每小時預設 0（:40-44）是「真計數」，但「該小時沒抓到」與「0 則」無法區分（與資料來源一致性問題，低風險）。tooltip 內 0 則顯示「無事件」（:320-324）。`AlertsTrack.tsx:43` `series[g]?.[h] ?? 0`。無空狀態（全 0 時只是空圖）。
7. **共用 vs 手刻**：共用 `AlertsTrack`、`NEWS_CATEGORIES`。手刻：外框、標題列、tooltip、柱圖。**非 7 階字級**：9.5（:132,309,321）、10.5（:297）；**hex**：`#fff`（:298）；手寫 rgba 多處（:119,154,211,219,220,244,288）。

## 3. alertBoard — `A/AlertBoard.tsx`（接線 `MonitorPanel.tsx:593-604`）

1. **尺寸**：x6 y6 w6 h6，固定 290px（實測下限 264，`monitorSplitLayout.ts:100-102`）。內部：標題列＋趨勢（`flex:"1 1 auto"; maxHeight:120`，:444-451）＋六宮格（`gridAutoRows:minmax(0,1fr)`，:459-462，吃剩餘高）。
2. **外框**：**根節點沒有外框**（`display:flex; column; height:100%`，:398）；只有內層 `AlertTrend` 小面板（`padding:"8px 10px"`、`radius lg`、背景 `rgba(255,255,255,0.025)`、`borderMid`，:64-71）與每個 `GroupCard`（`padding:"9px 10px"`、radius lg，:188-200）各自有框。與同欄 timeline／hotZones 的外框語彙都不同。非 ready／全清狀態各畫一個獨立的框（:355,366-372）。
3. **標題列**：icon（warn 12px 紅 `#ef4444`）＋「警訊整合」（base 11px 700 FONT_CJK `textStrong`，letterSpacing .5px，:408-415）＋「NCDR + CWA」（`FONT_DATA` xs、ls 1.5px、`textDim`，:416-423，來源以英文縮寫呈現）＋右側「N 則」（`FONT_DATA` sm）＋嚴重 pill（紅、`alertBreathe` 動畫，:428-441）。沒有更新時間。
4. **數值列**：六宮格主數字 `FONT_DATA` xxl(22) 700（:226-234）；嚴重數「⚠ N 嚴重」9.5px 紅 `#ef4444`（:236-244，emoji ⚠）。單位「則」放 tooltip。組名 base 11px 600；英文 `def.en`（ENG 縮寫）xs `FONT_DATA`（:216-223）。
5. **圖表**：① `AlertTrend`：SVG 手刻 area＋polyline，`viewBox 100×34 preserveAspectRatio:none`（:96-113），`useChartTooltip`；右上「Peak N」英文（:93）。② 每組 `Sparkline`：SVG 手刻 polyline 100×16（:144-166），hover 走 `useChartTooltip`。③ 抽屜 `AlertDrawer`（點組別展開最多 12 筆，`maxHeight:220`，:300-345）。兩個 sparkline **不是** `PressureRing.tsx` 的共用 `Sparkline`（那個支援 null 斷線），這邊是自寫且不支援 null。
6. **缺值／過期**：非 ready 時**整個板被一行文字取代，舊資料不顯示**（:352-360，與 TAIEX／HazardCards「保留舊資料並標示」的做法相反）。全清：綠條「目前全國無 active 警報」＋ `ALL CLEAR`（:363-395，中英夾雜、英文 active）。**0 的畫法**：`:36` `series[g][h] ?? 0`、`:140` `data[h] ?? 0`、`:470` `s?.count ?? 0`、`:473` 缺序列回填全 0 陣列、`AlertsTrack.tsx:43`；loader `D/alertsLoader.ts:180-186,275` 全部 `?? 0`。「今日某組沒有記錄」與「0 則」在 UI 上無法區分。`topTerm ?? "—"`（:252）是正確的缺值寫法。抽屜載入中／空狀態各有文字（:274-298）。
7. **共用 vs 手刻**：共用 `useChartTooltip`／`fmtChartValue`、`ALERT_GROUPS_DEF`。手刻：全部外框與標題。**非 7 階字級**：9.5（:238,338）、11.5（:378,505）；**hex**：`#ef4444` ×3（:239,407,435，應為 `COLORS.statusErr`）；手寫 rgba 多處（:68,191-194,370,432-433,486）。**英文標籤**：`24H TREND`（:84）、`Peak`、`ALL CLEAR`、`NCDR + CWA`、`active`。**nowrap 補丁**：:204-206 註解說明「民生」會折行→用 `whiteSpace:nowrap` 硬鎖。

## 4. hotZones — `M/HotspotsWidget.tsx`（接線 `MonitorPanel.tsx:620-626`）

1. **尺寸**：x6 y12 w6 h5，固定 240px（實測 234，exactly 5 列）。列數寫死 `slice(0,5)`（:58）；字體或列高一變就溢出 → 格內捲動。
2. **外框**：共用 `Widget`（`PressureRing.tsx:346-359`：radius xl、`panelBorder`、背景 `rgba(255,255,255,0.022)`、`padding:13`、flex column）。
3. **標題列**：`SectionLabel`「熱區 Top 5 · HOTSPOTS」（`PressureRing.tsx:326-344`：3×12 色條＋`FONT_DATA` sm、ls 1.5px、`textDefault`、**`textTransform:"uppercase"`**；中文也被包在 `FONT_DATA`）。右側無內容；無來源／更新時間。
4. **數值列**：每列＝名次（base 700）＋圓點＋縣市（md）＋分類 pill（9.5px）＋ 進度條 ＋ 件數（`FONT_DATA` lg 700，**`#fff`** :134）＋「×倍數」（9.5px；≥2 變 `statusWarn` ＋ flame icon，:139-151）。單位寫法：「×1.4」緊貼（符合 §6.2）。倍數 `surge = 1 + n*0.28`（:35）是**憑空公式**，不是實際基準比較（誠實性問題，標為待確認）。
5. **圖表**：CSS 進度條（div，高 5，:116-130），寬度 `n/maxHot`，`maxHot` 缺資料時為 1（:51）。tooltip `useChartTooltip`（`bind`，但 `onMouseMove` 與 `onMouseLeave` 是手動接，:69,82）。
6. **缺值／過期**：空狀態「⚠ 尚無資料」（:155-164，emoji、base `textFaint`）。統計的是 `allEventsToday`，縣市為「全國／全部」的事件被排除（:22）。newsDerived 包裝。
7. **共用 vs 手刻**：共用 `Widget`、`SectionLabel`、`useChartTooltip`。手刻：列的 hover 背景（`rgba` ＋ JS 改 style，:73,78,81）。**非 7 階字級**：9.5（:109,142）；**hex**：`#fff`（:134）。

## 5. triage — `M/TriageWidget.tsx`（接線 `MonitorPanel.tsx:619`）

1. **尺寸**：x0 y14 w6 h3，固定 140px。實際內容高度未實測（三欄各含圖例折行，:52-80）。
2. **外框**：共用 `Widget`（`style={{gridColumn:"1 / -1"}}`，在 flex 容器內無作用，屬殘留，:107）。
3. **標題列**：`SectionLabel`「信號分級 · TRIAGE」。分欄小標 `FONT_DATA` xs ls .5px `textDim`，內容為「地理相關 GIS_RELEVANCE」「嚴重程度 SEVERITY」「事件性質 IS_EVENT」（:110-114，**直接印出內部欄位名**，違反 §6.3）。
4. **數值列**：無主數字；圖例內 `<b>` 計數 `FONT_DATA`，非零 `#fff`（:73）。
5. **圖表**：CSS 堆疊比例條（高 9，radius md，:37-51），寬度 `count/total`；三欄 `repeat(3,1fr)` gap 18（:109）。tooltip 走 `tip.bind`。
6. **缺值／過期**：**`:96` `e.gis_relevance ?? 0`、`:97` `e.severity ?? 0`，null 被歸到第 0 級（「無關」／最輕）；`:100` `e.is_event === false ? 聲明 : 事件`，null 算「事件」**。`:15` `|| 1` 僅防除零，可接受。全 0 時整條空灰。無空狀態文字。
7. **共用 vs 手刻**：共用 `Widget`／`SectionLabel`／`GIS_LEVELS`／`SEV_LEVELS`／`useChartTooltip`。**非 7 階字級**：9.5（:58）；**hex**：`#fff`（:73）。

## 6. liveWall — `M/LiveWall.tsx`（接線 `MonitorPanel.tsx:640`）

1. **尺寸**：x0 y21 w12 h13 content，內容撐（2×2 的 16:9 磚，高度隨欄寬，:528-533，`aspectRatio:"16 / 9"` :330）。
2. **外框**：元件**複製了** `Widget` 的樣式自畫（radius xl、`panelBorder`、`rgba(255,255,255,0.022)`、`padding:13`，:491-498），不是直接用 `Widget`。每個 slot 另有 `1px` 邊框（緊急台橘 `rgba(255,152,0,0.55)`、其餘 `borderSoft`，:329-332）、背景 `#000`。
3. **標題列**：手刻色條＋「新聞直播 · LIVE WALL」（`FONT_DATA` sm ls 1.5px `textDefault`，:500-509；**沒有 uppercase 轉換**，與 `SectionLabel` 不同，中文亦在 `FONT_DATA`）＋右側「4 格同步 · 可切換 N 家」（xs `textFaint`）；華視切防災直播時換成橘色 pill「⚠ 華視已切換防災直播」（:511-521）。無來源／更新時間。磚內左上：紅 `LIVE` pill（`FONT_DATA` 8.5 700，:376-397）＋頻道名（base 700 白）。
4. **數值列**：無。
5. **圖表**：無；YouTube iframe ×4，`useInView` 延遲掛載；頻道選單（`ChannelMenu`，下拉寬 232 固定，:161）。
6. **缺值／過期**：`MonitorDataStatus`「直播解析」（:499）；磚內「RESOLVER ERROR／RESOLVING…」＋說明（:349-365，英文大寫＋等寬）；`:64,69` 頻道 note 直接寫「⏳ handle 待修」顯示給使用者（內部維運備註外洩到 UI）。底部「ⓘ 因為與 YouTube 的連線關係…」9.5px。
7. **共用 vs 手刻**：共用 `MonitorDataStatus`、`useInView`；其餘全手刻。**非 7 階字級**：8（:212）、8.5（:177,184,205,280,391）、9.5（:554）、10.5（:133）、11.5（:251）；**hex**：`#fff`×5、`#000`、`#ff3b30`×2（:237-238）、`#04121f`×2（:268,409）；手寫 rgba 多處（:131,226,331,373,380,517）。**emoji**：🔇（:432）、⚠（:520）、⏳、ⓘ。`▾`（:153）當 chevron（guard `triangle-chevron` 目標）。`zIndex` 30／20 字面值（:161,422）。

## 7. hazardStrip — `M/HazardWatchStrip.tsx`（接線 `MonitorPanel.tsx:647`）

1. **尺寸**：x0 y34 w12 h7 content，內容撐（1×2 的 16:9 磚，`aspectRatio` :57）。
2. **外框**：自畫（radius xl、`panelBorder`、背景**橘色底** `rgba(255,152,0,0.04)`、`padding:13`，:174-181）；磚邊框 `rgba(255,152,0,0.45)`（:58）。檔頭註解自稱「與 LiveWall 風格 1:1 對齊」，實際是複製貼上。
3. **標題列**：色條（`statusWarn`）＋「災防觀測 · HAZARD WATCH」（`FONT_DATA` sm ls 1.5px，:184-191）＋右「地震 + 天氣 · 24h 監測」（xs）。磚內：橘 `LIVE` pill（`FONT_DATA` 8.5 700，字色 `#04121f`）＋頻道名 base 700 白＋英文 `EQ MONITOR`／`WEATHER LIVE`（8.5，:126-134，**頻道 `en` 欄位 UI 直出**）。
4. **數值列**：無。
5. **圖表**：無；YouTube iframe ×2。
6. **缺值／過期**：`STANDBY`（英文，`FONT_DATA` xs，:76-86）在 iframe 進視窗前顯示。無資料狀態、無失敗狀態（iframe 壞掉使用者自己看 YouTube 的錯誤，`video_id` 寫死，檔頭註解 :11-15 有過下播事故）。
7. **共用 vs 手刻**：只用 `useInView`；全手刻、與 LiveWall 重複約 80 行。**非 7 階字級**：8.5（:111,128）；**hex**：`#000`×2、`#fff`×2、`#04121f`；**emoji**：🔇（:165）。

## 8. typhoon／radiation／lightning／earthquake — `M/HazardCards.tsx`（接線 `MonitorPanel.tsx:659-662`）

四卡共用同一個私有外殼 `HazardShell`（`HazardCards.tsx:49-118`，**未 export**）＋私有 `Metric`（:121）／`MetricRow`（:138）／`Note`（:146）／`MetaRow`（:155）。趨勢圖共用 `HazardTrendBars.tsx`（export，本批最乾淨的共用件）。

### 8.1 共通（四卡）
1. **尺寸**：typhoon x0 y41 w12（獨立全寬列）；radiation／lightning／earthquake 各 w4（x0/4/8，y47）；全 content。三卡並排等高 stretch（`MonitorPanel.tsx:150-173`）：**`HazardShell` 根節點（column）會被拉長，但內層面板（:72-80）沒有 `flex:1`，面板框底邊不會跟著對齊**，三卡底部可能參差（依 code 推論，未實測）。
2. **外框**：`SectionLabel` 在**框外上方**（:71），框本體＝radius xl、`panelBorder`、`linear-gradient(160deg, {tint}, rgba(255,255,255,0.012))`、`padding:"12px 14px"`、gap 8（:72-80）。tint 四色各異（`rgba` 字面值 :320,415,510,609）。
3. **標題列**（框內首列）：狀態大圓點 11px（帶 `boxShadow`，:82-87）＋標題（md 700，:88-95）＋右側 badges（`FONT_DATA` 8.5 700、accent 色 pill，:97-109）。框外 `SectionLabel`：「颱風 · TYPHOON」「地震 · SEISMIC」「輻射 · RADIATION」「落雷 · LIGHTNING」，**四個 `labelColor` 全部是 `COLORS.accent`**（:325 等），沒有依主題變色。底部 footer（xs `textDim`，**無 `fontFamily`**，:114）寫來源，如「來源：中央氣象署 CWA 地震報告」；更新時間放 `MetaRow` 右側（`relTime`）或不放（輻射無）。
4. **數值列**：`Metric`＝`FONT_DATA` xxl(22) 700 ＋單位 sm `textMuted`、`marginLeft:4`（空白用 margin，不是字元，:121-135）；單位文字如「km 距台灣」「µSv/h 平均」「次 / 近 1h」。**單位 span 沒有 `fontFamily`**（落到繼承）。次要字 `FONT_DATA` sm（:461,553,655，手寫重複）。
5. **圖表**：`HazardTrendBars`（CSS flex 柱、柱高＝量、柱色＝強度分級、null＝灰樁、hover `useChartTooltip`，`HazardTrendBars.tsx:65-172`）。caption 8.5px `FONT_DATA`（:90）、端點標籤 8px（:162）。
6. **缺值／過期**：`HazardShell` 把任一 query `denied/error` 轉成標題「資料無權限讀取／資料更新中斷」＋灰點（:64-68），**但 children（舊資料）仍照畫**；並逐一附 `MonitorDataStatus`（:111-112）。無資料前：標題「…（載入中）」＋ error 時 `Note`「查詢失敗，非『無…』」（:323-332,418-427,513-522,612-621）——**這是全批最好的缺值文案**。
7. **共用 vs 手刻**：共用 `SectionLabel`、`HazardTrendBars`、`MonitorDataStatus`、`useMonitorResource`。**非 7 階字級**：`FONT_DATA 8.5`（:101）＋ `HazardTrendBars` 8.5／8；**hex**：無（全走 COLORS，rgba 字面值見上）。

### 8.2 typhoon（`:303-382`）
- 主數字 `distance_km.toLocaleString("zh-TW")`＋「km 距台灣」（:367-371）；> 1500km 時標題改「無颱風接近」。兩排趨勢（45 天接近程度 34px、1000km 內顆數 26px）＋點柱展開（`Note`＋`MetaRow`，:278-298）。底列 `最大風速 {kt ?? "—"} kt · {m/s}`（:377，缺值正確寫「—」）。
- **0 的畫法**：`D/typhoonTracksLoader.ts:542` `stormsNearby: r?.storms_nearby ?? 0`（補日時「沒有該日資料列」→ 0）；UI 據此畫「0 顆」柱（`HazardCards.tsx:245`）並在點柱說明寫「無颱風在 1000km 內」或「當天無颱風觀測」（:282-287，後者用 `nearestKm == null` 判斷，前者已被 `stormsNearby>0` 短路）。同一天 `nearestKm` 是 null（灰樁）但 `stormsNearby` 是 0（真 0 柱）→ 上下兩排對「無資料日」的畫法互相矛盾。`proximityHeight` 對遠方颱風回 0（:215-218，語意是「構不上關心」，屬正確的 clamp，不是缺值）。

### 8.3 earthquake（`:403-479`）
- 主數字 `M` 前綴＋`magnitude.toFixed(1)`＋「深度 x.x km」；趨勢 14 天；`MetaRow`「24h 內 N 次」＋ `relTime`。
- **0 的畫法（嚴重）**：`D/earthquakeLoader.ts:121-122` `magnitude: pick.magnitude == null ? 0 : …`、`depth_km: pick.depth_km == null ? 0 : …`；且 `pick` 會 fallback 到 `rows[0]`（:117，不保證有 magnitude）→ 卡片顯示「M 0.0」「深度 0.0 km」並用 `magColor(0)` 染成「平時綠」（`HazardCards.tsx:441,457-462`）。另 `:128` `count24h: countRes.count ?? 0`（→ `HazardCards.tsx:474`「24h 內 0 次」）、`:203` 補日 `count ?? 0`（註解寫明是刻意補 0，但 collector 斷供也會畫成 0 柱）。

### 8.4 radiation（`:500-578`）
- 主數字 `fmtDose(avg)`（null → 「—」，:483-485，正確）＋「µSv/h 平均」；badge `{reporting}/{total} 站`；三態 `Note`／`MetaRow`（警戒／觀察／全部正常）。
- 缺值做得對：`meanUsvh == null ? null`（:541，註解說明 0 µSv/h 物理上不可能）。**殘留**：`D/nuclearLoader.ts:351` `stationCount: r?.station_count ?? 0` → tooltip note「… · 0 站」（`HazardCards.tsx:543`）。

### 8.5 lightning（`:599-678`）
- 主數字 `count1h`＋「次 / 近 1h」＋「今日累計 N 次」；`quiet = countDay === 0` 時整塊換成 `Note`「氣象署源今日（…）尚無落雷紀錄」（:645-647）；`MetaRow`「最新 {relTime} · {型別 ?? "未知型別"}」（:660-664）；最底 `MetaRow` 固定印「台電源 上游斷供中（端點回空）」（:628-630,675，把已知事故直接寫進 UI 文案）。
- **0 的畫法**：`D/lightningLoader.ts:280` `count: r?.event_count ?? 0`（補日缺列 → 0 柱），對照 nuclear 同樣補日卻用 null（灰樁）——**同型資料兩種缺值策略**。

## 9. foodPriceBoard — `M/FoodPriceBoard.tsx`（接線 `MonitorPanel.tsx:644`）

1. **尺寸**：x0 y51 w12 h7 content，內容撐；走勢圖 `SPARK_MIN_H = 140`（:243，fit:content 下 `flex:1` 分不到高，所以寫死）。2×2 格（:100）；寬度欄 `1fr 1fr` gap 9（:100）。
2. **外框**：`SectionLabel` 在框外（:80，`color="#5fbf6d"` 手寫 hex）＋框（radius xl、`panelBorder`、`linear-gradient(160deg, rgba(95,191,109,0.06), …)`、`padding:"12px 14px"`、gap 11、`flex:1`，:81-91）；每個指數格另有 radius lg、`border: ${color}33`、背景 `${color}0d`、`padding:"8px 9px 7px"`（:137-145，**框中框**）。
3. **標題列**：`SectionLabel`「食品價格 · FOOD PRICE MONITOR」；格內標題：指標中文（12.5px 700，:148）＋英文代碼 VPI／FPI／MPI／EPI（8.5px `FONT_DATA`，:151，**indicator id 直出**）＋右側燈號圓點（7px，:154）；第二行涵蓋範圍 8.5px（:158-166）；右側／來源：底部 footer xs 一整句（「農業部批發拍賣成交價 · 基期 2024-2025 = 100 · 近 180 天 …」，:108-118）。
4. **數值列**：指數 `FONT_DATA` **21px** 600（:170，非階）；偏離 %（11px 600，紅／青／預設，:173-175，`+`／`-` 符號緊貼、「vs 常態」8.5px）；YoY「年增 +x.x%」8.5px（:207）；異常天數「▲N」「▼N」「·N 注意」8.5px（:184-201，符號緊貼、`▲▼` 字元當方向）。顏色：`FOOD_ALERT_HIGH`／`FOOD_ALERT_LOW`（資料色，`D/intelLoaders.ts`）。
5. **圖表**：SVG 手刻 180 天折線＋異常區段底色＋基期線＋終點圓點（:326-357，`viewBox 100×52`、`preserveAspectRatio:none`、`vectorEffect:non-scaling-stroke`），`low_coverage` 斷線（:276-283）；hover `useChartTooltip`（:309-324，title 用 `M/D`）。**沒有 y 軸刻度、沒有 x 軸日期端點**；不用共用 `Sparkline`。Legend 4 色（:362-381）。
6. **缺值／過期**：**最完整的過期提示**：`latestDate` 與 `staleDays`，>3 天用 `#fbbf24` 粗體「⚠ 資料截至 … （已 N 天未更新）」（:64-76,109-114）。空狀態「資料載入中…／尚無食品價格摘要」（:94-97）；走勢「資料不足」（:306）；`MonitorDataStatus` ×2（:92-93）。**0 的畫法**：`D/intelLoaders.ts:808` `latestVal: Number(r.latest_val)`（null → 0 → 畫「0.0」，`FoodPriceBoard.tsx:171`）、`:784` `indexVal: Number(r.index_val)`（null → 0，`:268` 的 `Number.isFinite` 擋不住 0，折線被拉到底）、`:815-817,820` 異常日數／`nDays` `?? 0` → `:194-196`「無異常日」、`:116`「期間無異常日」會在欄位缺失時宣稱沒有異常；`FoodPriceBoard.tsx:255,290` `(devPct ?? 0)` 讓 null 偏離方向當「偏高」（僅在 `light==="red"` 才用到，風險低）。
7. **共用 vs 手刻**：共用 `SectionLabel`、`useChartTooltip`、`MonitorDataStatus`、`useMonitorResource`；其餘手刻（含自己的 `Sparkline` 函式，與 `PressureRing.tsx` 同名不同實作）。**非 7 階字級**：8.5 ×9（:151,160,176,183,204,306,374,377）、12.5（:148）、21（:170）；**hex**：`#5fbf6d`、`#fbbf24`、`#e0a63c`×2、`#63b26a`×2；**emoji**：⚠、⚠️（:111,117）；文案裡「⚠️ 肉價不含牛」。

## 10. taiex — `M/PressureRing.tsx` `TwseTicker`（:106-214；接線 `MonitorPanel.tsx:639`）

1. **尺寸**：x0 y58 w6 h3 content，內容撐；與 situationCards 並排 stretch。
2. **外框**：元件自畫，**與 Widget 不同**：radius xl、`panelBorder`、`linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`、`padding:"10px 14px"`、`minWidth:208`（:125-133）。**沒有 `SectionLabel`**。
3. **標題列**：「TAIEX 加權指數」（**英文在前**，`FONT_DATA` xs、ls 1.2px、`textDim`、nowrap，:136-143；中文包在等寬字）＋ 右側狀態 pill（`FONT_CJK` **8.5px**，「盤中 13:33／受限／更新中斷／讀取中」，:145-152；`data.status ?? "—"`）。無來源、無更新時間（時間混在 pill 裡）。
4. **數值列**：指數 `FONT_DATA` **24px** 700（非階，:155-162）；漲跌 `▲ +x`（lg 700，漲紅跌綠 `#ff4d4f`／`#16c784`，:117,165-167）＋ 百分比 md 700（:168-170，**`change_pct` 未 `toFixed`、直接印原值**）；H／L／量 xs（:174-183，**這一列整排 `FONT_DATA` 但含中文「量」**）。沒有單位空白規則問題（「萬張」在 DB 字串內）。
5. **圖表**：共用 `Sparkline`（`PressureRing.tsx:239-324`，支援 null 斷線、opt-in tooltip、`labelAt`、`unit`）；30 日收盤，**寬 360 高 48 固定 px**（:201-209）；前置「30D」標籤 7.5px ls 1.5px（:189-196，非階且比 xs 還小）。沒有 y 軸刻度。
6. **缺值／過期**：`has = available && data.index > 0`（:119，把 0 當缺值，正確）→ 否則「—」；stale（error 且曾成功）整體變 `textMuted` 並在下方寫「最後成功 hh:mm」，非 ready 寫「不以 0 或舊行情判斷漲跌」（:184-186，**這句是工程語氣文案，不適合面向使用者**）。**0 的畫法**：`D/intelLoaders.ts:271-283` `index`／`prev_close`／`open`／`high`／`low` 全 `Number(… ?? 0)`、`change_pct` 缺值回 0（:274）→ 在 `index>0` 為真、但上游缺 `high`／`low`／`change` 時，`:166-169,180-181` 會印「H 0」「L 0」「▲ +0 +0%」並染漲紅；`:115` `up = change >= 0`；`:123` `(histLast?.close ?? 0) >= (histFirst?.close ?? 0)`（僅顏色，被 `closes.length>=2` 守住，低風險）。
7. **共用 vs 手刻**：共用 `Sparkline`、`MonitorDataStatus`（「行情歷史」，:134，但放在 flex 欄最上方，狀態行會把卡片撐高）、`useMonitorResource`。手刻：外框、標題、數值列。**非 7 階字級**：8.5（:147）、24（:157）、7.5（:76 與 :191）、10.5（:97）、40（:66，PressureRing 本體，不在 split）；**hex**：`#ff4d4f`、`#16c784`（×2，:117,203）、`#fff`（:158；:67）。

### 10.1 「指標跑出格子外」根因

**根因：30D 迷你走勢的 `<Sparkline w={360}>` 是固定 px 寬且 `flexShrink:0`，split 的 w6 格放不下。**

| 環節 | 位置 | 說明 |
|---|---|---|
| 固定寬 360 | `PressureRing.tsx:204`（`w={360}`） | 註解 :197-200 是「dock 版 w5 格（容器 1100px）可用約 380」時算的上限 |
| 不可縮 | `PressureRing.tsx:304`（`style={{flexShrink:0, overflow:"visible"}}`）、:188（外層 `display:flex`，無 `minWidth:0`／無 wrap） | SVG 固定 `width={w}`，flex 也不縮 |
| 格子太窄 | split w6 ＝ 邏輯 358px（見 §0：835/1.15=726；(726-10)/2）；扣卡片 padding 14×2＋框 2 → **可用 ≈ 328px** | 30D 列寬 ≈ 標籤 ~18 ＋ gap 7 ＋ 360 ≈ **385px，溢出約 57 邏輯 px（≈ 65 實 px）**；視窗越窄越多；堆疊模式（手機，格寬≈360→可用≈300）溢出更多 |
| 無裁切 | `MonitorPanel.tsx:134-137`（`fit:content` → `overflow:visible`）、`:139` | 溢出部分不會被裁也不會捲，直接畫到右鄰 situationCards 格或 dock 邊外 |
| 次要 | `PressureRing.tsx:131`（`minWidth:208`）、:154/:176（`whiteSpace:nowrap`） | 標題列／數值列／H·L·量 列都 nowrap 且沒有 `minWidth:0`／`overflow:hidden`：指數大（如 22,500.12 ＋ ▲ ＋ 百分比）時本身合計約 260px，尚未爆，但再窄（堆疊）會爆；`minWidth:208` 會讓卡片在極窄格強制撐出 |
| 為何「看起來正常」過 | `MonitorPanel.tsx:118-121` 註解 | 並排 stretch 修正時被當成「內容本來就超過 413」的正面例子，其實 413 是**未乘 zoom 的實寬**，邏輯寬只有 358 |

驗證方式（未執行）：DevTools 量 `[data-widget="taiex"]` 的 `clientWidth`（預期 ≈358）對比其內最寬子層 `scrollWidth`（預期 ≈385）。
修正方向（僅列方向，本輪不改）：`Sparkline` 改 `width:"100%"`＋`viewBox`／ResizeObserver，或 `w` 由容器量測；30D 列加 `minWidth:0`；卡片加 `overflow:hidden` 作保險。

## 11. situationCards — `M/SituationCards.tsx`（接線 `MonitorPanel.tsx:641`）

1. **尺寸**：x6 y58 w6 h3 content，內容撐，並排 stretch；但**根節點沒有框、也沒有 `flex:1`，內部 grid 不會長高**，與 TAIEX 卡底部不一定對齊（推論，未實測）。
2. **外框**：根節點無框（`gridColumn:"1 / -1"`，在 flex 容器內無作用，:105）；每張疾病卡自己有框（radius xl、`panelBorder`、`linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))`、`padding:"12px 13px"`，:12-16）。結構＝**標題在框外，框在每個資料項上**（與 Food／Hazard 相同，與 Widget／TAIEX 不同）。
3. **標題列**：手刻色條（accent）＋「公衛 · HEALTH BOARD」（`FONT_DATA` sm ls 1.5px，:106-114，`SectionLabel` 的複製品）＋ 右「CDC 截至 ISO 第 W{week} 週」（xs，`week>0 ? week : "—"`，:116-118，中英夾「W」）。疾病卡標題：色點 8px＋病名（md 700）＋右側 `W{week}` pill（8.5px，:30-37）。
4. **數值列**：`FONT_DATA` **26px** 700 **`#fff`**（:43，非階）＋單位 9.5px（:48，如「本週確診」，與數字間距靠 `gap:5`）；YoY「↑+12%／↓-88%」base 700，↑升＝`statusWarn`、↓降＝`statusLive`（:8-9,57-61），「vs 去年同期」xs。
5. **圖表**：共用 `Sparkline`（`PressureRing.tsx`），`w=88 h=24`＋`showTooltip`、`labelAt` 週次（:66-81）；auto-fit grid `minmax(200px,1fr)`（:123）。
6. **缺值／過期**：空狀態＝三張虛線框「等待 CDC 週報資料…」（:127-133，**載入中／錯誤／真空無法區分**，且固定畫 3 張）；`MonitorDataStatus`「公衛週報」（接線處）。**0 的畫法**：`D/intelLoaders.ts:524` `yoy: Number(r.yoy ?? 0)` → 缺 YoY 時畫「↑+0% vs 去年同期」並染警示色（`SituationCards.tsx:8,57-61`）；`:523` `spark: r.spark.map(Number)` → 序列內的 null 被轉成 0 再傳給支援 null 斷線的 `Sparkline`，折線被拉到底（共用元件的 null 機制被 loader 繞過）；`:510` `week ?? 0` 被 UI 守成「—」（OK）；`:521` `value ?? "—"`（OK）。
7. **共用 vs 手刻**：共用 `Sparkline`、`MonitorDataStatus`。標題、框、數值列手刻。**非 7 階字級**：8.5（:32）、9.5（:48,86）、26（:43）；**hex**：`#fff`（:43）。

---

## 12. 總表

| 格 | 外框誰畫 | 標題形式 | 主數字 px | 圖表種類 | 缺值守則 | 共用元件使用 | 非階字級 | hex |
|---|---|---|---|---|---|---|---|---|
| newsFeed | 自畫（xl） | 內嵌：icon＋中英混標題 | — | 清單 | status 行＋空狀態 | IntelCard／IntelFilters | 12.5、10.5（＋IntelCard 多處） | 0 |
| timeline | 自畫（僅下邊線、無圓角） | 內嵌：英文 eyebrow | — | CSS 堆疊柱＋手刻 tooltip | 0 預設、無空狀態 | AlertsTrack | 9.5×3、10.5 | `#fff` |
| alertBoard | **無根框**；內層小框 | 內嵌：icon＋中文＋英文來源 | 22（階內） | SVG 手刻 area＋sparkline | 非 ready 整板取代（舊資料不顯示）；`?? 0` 多處 | useChartTooltip | 9.5×2、11.5×2、8.5（Track） | `#ef4444`×3 |
| hotZones | Widget | SectionLabel（框內） | 13（件數） | CSS 條 | 「⚠ 尚無資料」 | Widget／SectionLabel | 9.5×2 | `#fff` |
| triage | Widget | SectionLabel（框內） | — | CSS 比例條 | `?? 0` 歸第 0 級（3 處） | Widget／SectionLabel | 9.5 | `#fff` |
| liveWall | 自畫（複製 Widget） | 手刻色條（框內，複製 SectionLabel） | — | iframe | 磚內 RESOLVER ERROR | MonitorDataStatus | 8、8.5×5、9.5、10.5、11.5 | 多（`#fff`/`#000`/`#ff3b30`/`#04121f`） |
| hazardStrip | 自畫（橘底） | 手刻色條（框內） | — | iframe | `STANDBY` | （無） | 8.5×2 | `#000`/`#fff`/`#04121f` |
| typhoon/radiation/lightning/earthquake | HazardShell（框內框外分離） | SectionLabel（框外）＋標題列（框內，狀態點） | 22 | HazardTrendBars（CSS 柱） | 標題改寫＋灰點＋Note；loader 仍有 `?? 0`／`== null ? 0` | SectionLabel／HazardTrendBars／MonitorDataStatus | 8.5（＋Bars 8.5／8） | 0 |
| foodPriceBoard | 自畫（綠色漸層）＋格內再框 | SectionLabel（框外，自訂 hex 色） | 21 | SVG 手刻 180 天折線 | 最完整（截止日／資料不足）；loader `Number(null)` | SectionLabel／useChartTooltip | 8.5×9、12.5、21 | 6 個 |
| taiex | 自畫（漸層） | 內嵌：英文在前 eyebrow＋狀態 pill | 24 | 共用 Sparkline（固定 360px） | stale 變灰＋「最後成功」；loader `?? 0` | Sparkline／MonitorDataStatus | 7.5×2、8.5、10.5、24 | `#ff4d4f`/`#16c784`/`#fff` |
| situationCards | 無根框；每項自畫（漸層） | 手刻色條（框外，複製 SectionLabel） | 26 | 共用 Sparkline（88×24） | 三張虛線佔位；loader `?? 0`／`.map(Number)` | Sparkline／MonitorDataStatus | 8.5、9.5×2、26 | `#fff` |

---

## 13. 跨格不一致點

**A. 外框／標題結構有三種寫法（同一個「卡片」三種長相）**
1. `SectionLabel` 在 `Widget` 框內：hotZones、triage（`PressureRing.tsx:326,346`）；liveWall、hazardStrip 是**手刻複製**同樣結構（`LiveWall.tsx:491-509`、`HazardWatchStrip.tsx:174-191`）。
2. `SectionLabel` 在框外、框內另有標題列：Hazard 四卡（`HazardCards.tsx:70-80`）、foodPriceBoard（:79-91）；situationCards 是手刻複製（框外標題、資料項自帶框）。
3. 沒有 `SectionLabel`，標題內嵌在框內：newsFeed、timeline、alertBoard、taiex（四種各自的 eyebrow 寫法）。
4. 框本身四種：`Widget` 純色 `rgba(255,255,255,0.022)`；Hazard／Food／TAIEX／疾病卡用 `linear-gradient(160deg, …)`（tint 各自寫死）；timeline 只有下邊線無圓角；alertBoard 無根框。

**B. 標題文字語言與字型**
- 格式有「中文 · ENGLISH」（SectionLabel 系：熱區、信號分級、新聞直播、災防觀測、颱風…、食品價格、公衛）、「中文 ENGLISH」（時間軸 TIMELINE DOCK）、「English 中文」（TAIEX 加權指數）、「中文」＋英文來源（警訊整合 + NCDR + CWA）、「中英混」（新聞 Feed）。與 §6.1（標籤中文、英文小字附註）不符。
- `SectionLabel` 內建 `textTransform:"uppercase"`（`PressureRing.tsx:338`）；LiveWall／HazardWatch／SituationCards 的複製版沒有——同一視覺不同行為。
- 中文被包進 `FONT_DATA`（等寬）：SectionLabel 全部使用者、timeline 標題、TAIEX 標題與 H/L/量 列、LiveWall／Hazard／Situation 標題（違反 §7 `font-data-on-cjk`）。
- 標題字級：SectionLabel 10px（sm）、newsFeed 12.5px、alertBoard 11px、timeline 9px、TAIEX 9px、Hazard 框內標題 12px、Food 格標題 12.5px——同一層級「卡片標題」有 5 種字級。

**C. 字級（非 7 階）與手寫 hex**
- 半級／非階字級散在 11 個檔案（見總表）：最常見 8.5（≥25 處）與 9.5（≥15 處）；大字 21／24／26 三種各自的「主數字」（階內只有 22）。
- 手寫 hex：`#fff` 散在 8 個檔案；`#ef4444`（AlertBoard）應為 `COLORS.statusErr`；Food 一組私有綠／琥珀（`#5fbf6d` `#63b26a` `#e0a63c` `#fbbf24`）；TAIEX 漲跌 `#ff4d4f`／`#16c784` 重複兩處；LiveWall `#ff3b30`。

**D. 主數字**
- 6 種：alertBoard 22、Hazard 22、Food 21、TAIEX 24、situationCards 26、hotZones 13；顏色有 `#fff`（3 處）、`textStrong`（其餘），沒有共用的「大數字」元件（`HazardCards.Metric` 私有、未 export）。
- 單位：Hazard 用 span ＋ `marginLeft:4`；situationCards 用 `gap:5`；Food 用符號緊貼「+1.2%」；trend 柱 tooltip 單位由呼叫端傳字串（`" km（距 1500 圈）"`、`" 顆"`、`" 次"`、`" µSv/h"`），`HazardTrendBars.tsx:133-135` 整數走 `fmtChartValue(value, unit.trim())`、非整數走 `` `${value}${unit}` `` 兩條路徑。

**E. 圖表**
- 5 套實作：`PressureRing.Sparkline`（共用、支援 null 斷線）、AlertBoard 自寫 `Sparkline`／`AlertTrend`（不支援 null）、FoodPriceBoard 自寫 `Sparkline`（同名）、TimelineDock／AlertsTrack CSS 柱、`HazardTrendBars` CSS 柱。
- tooltip：`useChartTooltip`（多數）vs TimelineDock 手刻（:282-327，樣式與 ChartHoverTooltip 不同）。
- 軸：只有 Timeline（x 刻度）與 HazardTrendBars（兩端日期、footer 最大值）有軸資訊；Food 180 天折線、TAIEX 30D、AlertTrend 都沒有刻度、沒有端點日期。

**F. 缺值／過期**
- 狀態字寫法 3 種：`MonitorDataStatus`（一行小字）、自有 pill（newsFeed、TAIEX）、`HazardShell` 改標題＋灰點。
- 非 ready 時舊資料的處理 3 種：AlertBoard 整板換成文字（不顯示舊資料）；TAIEX／HazardCards 保留舊資料並標示；`newsDerived` 在首次成功前整格空。
- 「0」與「缺值」不分：見 §14。
- 空狀態文案無統一：「⚠ 尚無資料」、「目前無符合條件的事件」、「資料不足」、「資料載入中…／尚無食品價格摘要」、「等待 CDC 週報資料…」、`STANDBY`／`RESOLVING…`／`RESOLVER ERROR`、「載入中」。
- 工程語氣文案直接面向使用者：「不以 0 或舊行情判斷漲跌」（`PressureRing.tsx:185`）、「台電源 上游斷供中（端點回空）」（`HazardCards.tsx:630`）、「⏳ handle 待修」（`LiveWall.tsx:64,69`）、`GIS_RELEVANCE`／`SEVERITY`／`IS_EVENT` 欄位名（`TriageWidget.tsx:110-114`）、Food 指標代碼 VPI／FPI／MPI／EPI。

**G. 版面機制**
- 固定高格（newsFeed／timeline／alertBoard／hotZones／triage）的 `h` 是「實測剛好」的像素，字級或 zoom 一變就溢出；alertBoard、hotZones 已有註解承認（`monitorSplitLayout.ts:100-102`），並靠 `whiteSpace:nowrap` 補丁（AlertBoard :204-206）。
- `fit:content` 格無裁切（`overflow:visible`），任何固定 px 寬元件（TAIEX 360、LiveWall 選單 232、`minWidth:208`）都會直接溢出到鄰格。
- 並排 stretch 只讓 cell 與「根節點」長高，內層面板沒有 `flex:1`（Hazard 三卡、situationCards），底邊不保證對齊。
- 已知 z-index 字面值：LiveWall 30／20（:161,422）。

## 14. 把缺值畫成 0 的位置（完整清單）

| # | 位置 | 寫法 | 後果 |
|---|---|---|---|
| 1 | `D/earthquakeLoader.ts:121-122`（→ `HazardCards.tsx:457-462`） | `magnitude/depth_km == null ? 0 : …`，`pick` 可 fallback 到無規模的 `rows[0]`（:117） | 最新地震顯示「M 0.0／深度 0.0 km」且染綠 |
| 2 | `D/intelLoaders.ts:808`（→ `FoodPriceBoard.tsx:171`）、`:784`（→ :268 sparkline） | `Number(r.latest_val)`／`Number(r.index_val)`（null → 0） | 指數顯示 0.0、折線被拉到 0 |
| 3 | `D/intelLoaders.ts:815-817,820`（→ `FoodPriceBoard.tsx:116,194-196`） | 異常日數／nDays `?? 0` | 欄位缺失時宣稱「無異常日」「期間無異常日」 |
| 4 | `D/intelLoaders.ts:271-283`（→ `PressureRing.tsx:166-169,180-181`） | index/prev/open/high/low `?? 0`、`change_pct` 缺值回 0 | TAIEX 顯示「H 0／L 0／▲ +0 +0%」染漲紅 |
| 5 | `D/intelLoaders.ts:524`（→ `SituationCards.tsx:8,57-61`） | `Number(r.yoy ?? 0)` | 缺 YoY 時畫成「↑+0% vs 去年同期」＋警示色 |
| 6 | `D/intelLoaders.ts:523`（→ `SituationCards.tsx:66`） | `r.spark.map(Number)` | 序列 null → 0，繞過共用 `Sparkline` 的 null 斷線 |
| 7 | `TriageWidget.tsx:96-97`（＋:100） | `gis_relevance ?? 0`、`severity ?? 0`、`is_event` null 算事件 | 未分級事件被計入第 0 級／「事件」 |
| 8 | `IntelCard.tsx:80-81`（newsFeed 卡內） | `GIS_LEVELS[e.gis_relevance ?? 0]`、`SEV_LEVELS[e.severity ?? 0]` | 徽章顯示最低級而非缺值 |
| 9 | `A/AlertBoard.tsx:36,140,470,473`、`A/AlertsTrack.tsx:43`；`D/alertsLoader.ts:180-186,275` | `?? 0`、缺序列回填 0 陣列 | 「該組無記錄」與「0 則」無法區分 |
| 10 | `D/typhoonTracksLoader.ts:542`（→ `HazardCards.tsx:245-247,282-287`） | `storms_nearby ?? 0` 補日 | 缺觀測日畫成「0 顆在 1000km 內」，與同日 `nearestKm=null`（灰樁）矛盾 |
| 11 | `D/lightningLoader.ts:280`（→ `HazardCards.tsx:634`） | `event_count ?? 0` 補日 | 缺資料日畫成 0 柱（對照 nuclear 用 null 灰樁） |
| 12 | `D/earthquakeLoader.ts:128`（→ `HazardCards.tsx:474`）、`:203` | `count24h ?? 0`；補日 `count ?? 0` | 「24h 內 0 次」、斷供日 0 柱（:203 註解聲明刻意） |
| 13 | `D/nuclearLoader.ts:351`（→ `HazardCards.tsx:543`） | `station_count ?? 0` | tooltip「… · 0 站」 |
| 14 | `FoodPriceBoard.tsx:255,290` | `(devPct ?? 0) < 0／>= 0` | null 偏離被視為偏高（僅 `light==="red"` 才走到，低風險） |
| 15 | `PressureRing.tsx:123` | `(close ?? 0)` 比較 | 僅決定折線顏色，已被 `closes.length>=2` 守住（低風險） |

正確處理缺值的對照（可當範本）：`HazardTrendBars.tsx:104-118`（null＝灰樁＋tooltip「無資料」）、`HazardCards.tsx:483-485,541`（`fmtDose` null→「—」、`meanUsvh==null ? null`）、`PressureRing.tsx:119`（`index>0` 才算有值）、`PressureRing.Sparkline`（:216-277，null 斷線）、`FoodPriceBoard.tsx:132,174,207`（null 偏離／YoY 寫「—」或留空）、HazardCards 四卡「…（載入中）」＋「查詢失敗，非『無…』」文案。

## 15. 已存在、可作共用基礎的元件

| 元件 | 位置 | 狀態 | 備註 |
|---|---|---|---|
| `MonitorDataStatus` | `M/MonitorDataStatus.tsx` | export，已廣用 | 一行傳輸層狀態；字級 10 手寫、padding 手寫；可收斂成統一的狀態列 |
| `SectionLabel`／`Widget` | `M/PressureRing.tsx:326,346` | export | 框內標題的基準；但 `uppercase`、`FONT_DATA` 包中文、`padding:13` 需對齊規格後才能當基準 |
| `Sparkline`（null 斷線、opt-in tooltip、`labelAt`／`unit`／`formatValue`） | `M/PressureRing.tsx:239-324` | export，TAIEX／situationCards／其他卡在用 | 缺點：寬高固定 px（TAIEX 溢出根因）；應改成可響應寬度 |
| `HazardTrendBars` | `M/HazardTrendBars.tsx` | export | 量＋強度＋null 灰樁＋選取外框，契約最清楚；其他柱圖（timeline、AlertsTrack）可評估併入 |
| `HazardShell`／`Metric`／`MetricRow`／`Note`／`MetaRow` | `M/HazardCards.tsx:49-167` | **私有未 export** | 最接近「標準卡」（狀態點標題＋大數字＋次要列＋來源 footer）；升格後可給 Food／TAIEX／公衛 共用 |
| `useChartTooltip`／`fmtChartValue` | `src/components/ChartHoverTooltip` | export | 多數圖表已用；TimelineDock 沒用 |
| `useMonitorResource` | `src/hooks/useMonitorResource.ts` | export | 統一輪詢＋status／lastSuccessAt；所有新接資料的卡都該走它 |
| `IntelThemeProvider`／`DARK_INTEL`／`neutralFill`／`useIntelTheme` | `src/components/intel/intelTheme.tsx` | export | 只有 NewsFeedPanel 用；其餘仍直接吃 `COLORS`（兩套色來源並存） |
| Token：`FONT_SIZE`／`RADIUS`／`ELEVATION`／`SURFACE`／`FONT_CJK`／`FONT_DATA`／`COLORS` | `src/styles/designTokens.ts`、`src/components/intel/intelTokens.ts` | — | 已被全批引用，但 rgba 背景／邊框仍大量手寫（沒有對應 token：`rgba(255,255,255,0.02/0.025/0.04/0.05/0.06)` 五六種） |
| `PanelHeader`／`SourceFooter`（任務提及） | `src/components/sidebar/PanelHeader.tsx` 僅側欄 | **監看模式沒有** | 全 repo 無 `SourceFooter`；監看模式尚無共用標題列與來源註腳元件，各卡 footer 為手寫 xs 字串 |

## 16. 未確認事項

- 各固定高格（triage 140px、timeline 290px）在 zoom 1.15 下實際內容高度，未實測。
- 並排 stretch 後的底邊對齊（Hazard 三卡、TAIEX｜公衛）為程式推論，未目視。
- TAIEX 溢出的 385 vs 328 是以 1920 視窗、zoom 1.15、未含實際字寬的估算；正式數字需 DevTools 量測。
- `HotspotsWidget` 的 `surge = 1 + n*0.28` 是否為刻意的示意值，待產品確認（若非真實基準比較，屬誠實性問題）。
- 本清單未涵蓋 `IntelCard`／`IntelFilters` 的完整字級盤點（只記錄了與 null 有關與明顯非階字級的行）。
