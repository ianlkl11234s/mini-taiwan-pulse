# 監看模式 split 改版（monitor-restyle）

> **Slug**：`monitor-restyle`
> **狀態**：2026-10-01 拍板（A1／B1／C3／D3／E3／F3＋雙主圖／G2／H2／I2／K1）；P1 完成（卡片殼）、P2a 完成（字級 S13）、P2b 完成（數值列與走勢）、P3 完成（多指標卡）、P4 完成（來源新鮮度、缺值修正），P5–P6 未開始
> **比較頁**：[`picks.html`](./picks.html)（暗／淡並排，用代號選）
> **細節**：外觀盤點 [`inventory-a.md`](./inventory-a.md)（上半 14 格）、[`inventory-b.md`](./inventory-b.md)（下半 10 格＋MonitorPanel 外殼）、資料品質 [`data-quality.md`](./data-quality.md)（含所用 SQL，查詢時間 2026-09-30 23:10 台灣時間）
> **規格**：[`docs/design-system/spec.md` §5.35](../../design-system/spec.md)（定案）

## 一句話

split 的 24 格沒有共用卡片框：MonitorPanel 只排位置，框、標題、數值、圖表、缺值提示全由各卡自己畫，所以每加一格就多一套寫法。這次先盤點，再用比較頁讓使用者選一套監看卡規格。

## 橫向結論

1. **沒有共用卡片框**（`MonitorPanel.tsx:123-140` 只給 flex 殼）。外框有三種位置：標題在框內、段落標在框外、無框。
2. **標題列 0 格符合 §5.1／§6.1**：五種中英混寫格式，`SectionLabel` 內建 `uppercase`（`PressureRing.tsx:338`），多處中文套等寬字。
3. **時間序列 5 種實作**：`Sparkline`（寬度寫死）、`TimeseriesSparkline`、`HazardTrendBars`、PlaBoard 手刻 CSS 柱、TraDelay／Food／AlertBoard 手刻 SVG。軸、端點日期、圖高（34–190px）都不一致。
4. **加權指數溢出（實測）**：卡寬 412px、30 天走勢 SVG 414px，右緣多出 48px 畫到公衛卡上。根因 `Sparkline w={360}`＋`flexShrink:0`（`PressureRing.tsx:204`、`:304`），在 `zoom 1.15` 下放不進 w6 格；`fit:"content"` 格 `overflow:visible`（`MonitorPanel.tsx:134-137`）所以不裁切。
5. **傳輸狀態 ≠ 來源新鮮度**：`MonitorDataStatus` 只分讀取中／中斷／無權限，RPC 成功就算 ready。24 格只有 5 格自己判斷來源過期；其餘 18 格上游停更也看不出來。
6. **缺值畫成 0** 散在 loader 與元件，約 20 處（下表「缺值→0」欄，完整清單見 inventory-a §14、inventory-b §5、data-quality「把缺值畫成 0 的位置」）。
7. **合成值當資料**：熱區「熱度倍數 ×9.4」是 `1 + 則數 × 0.28`（`HotspotsWidget.tsx:35`），不是真實倍數；戰情概覽未就緒時用 50 決定卡片等級色（`SituationOverview.tsx:188`）。
8. **正在壞的**：機場入出境停更約 2.5 天（卡片整張空、顯示「24h 入 0／出 0」）；在監上游停更 138 天；登革熱來源下架（卡片直接消失）；流感／腸病毒落後 3 週；落雷氣象署來源疑似 09-27 起停；急診 09-25～28 整段斷；**壓力指數前端 bug 永遠「更新中斷」**（`intelLoaders.ts:179` 讀 `asof`，RPC 回 `updated_at`；`per_signal` 是物件被轉成空陣列）。

## 24 格總表

尺寸＝split 的 `w`（12 欄；w4≈1/3、w6≈1/2、w12 全寬）。圖表：`Spk`＝`PressureRing.tsx` `Sparkline`、`TS`＝`TimeseriesSparkline`、`HTB`＝`HazardTrendBars`、手刻＝元件自己畫。判定取自 data-quality（實測）。

| 格子 | 元件 | 寬 | 框 | 標題形式 | 主數字 | 圖表 | 缺值→0／假值 | 來源過期提示 | 資料判定 |
|---|---|---|---|---|---|---|---|---|---|
| 新聞 Feed | `NewsFeedPanel` | w6 固定 690px | 自畫 | icon＋「新聞 Feed」中英混 | — | 清單 | 徽章缺值顯示最低級（`IntelCard.tsx:80-81`） | 半套（空且落後>1天） | 新鮮 |
| 時間軸 | `TimelineDock` | w6 固定 290px | 只有下邊線 | 英文 eyebrow `TIMELINE DOCK` | — | CSS 堆疊柱＋手刻 tooltip | `AlertsTrack.tsx:43` `?? 0` | 半套 | 新鮮 |
| 警訊整合 | `AlertBoard` | w6 固定 290px | 無根框 | icon＋中文＋`NCDR + CWA` | 22 | 手刻 SVG | series 失敗畫 24 格 0（`MonitorPanel.tsx:457-460`） | 無 | 新鮮 |
| 熱區 | `HotspotsWidget` | w6 固定 240px | `Widget` | `SectionLabel`「熱區 TOP 5 · HOTSPOTS」 | 13 | CSS 條 | **熱度倍數合成**（`:35`） | 半套 | 新鮮（倍數假） |
| 信號分級 | `TriageWidget` | w6 固定 140px | `Widget` | `SectionLabel`＋英文欄名 `GIS_RELEVANCE` | — | CSS 比例條 | `?? 0` 歸第 0 級（`:96-100`） | 半套 | 新鮮 |
| 新聞直播 | `LiveWall` | w12 | 自畫（複製 Widget） | 手刻色條「新聞直播 · LIVE WALL」 | — | iframe | — | 無 | 新鮮 |
| 災防觀測 | `HazardWatchStrip` | w12 | 自畫（橘底） | 手刻色條 | — | iframe | — | 無 | 人工維護 |
| 颱風 | `HazardCards` | w12 | `HazardShell`（標題框外） | 框外 `SectionLabel`＋框內狀態點標題 | 22 | `HTB` ×2 | `typhoonTracksLoader.ts:542` 補日填 0 | 無 | 新鮮 |
| 輻射 | `HazardCards` | w4 | 同上 | 同上 | 22 | `HTB` | —（null 灰樁，最好） | 站級 | 新鮮（2 站停） |
| 落雷 | `HazardCards` | w4 | 同上 | 同上 | 22 | `HTB` | `lightningLoader.ts:280` 補 0；停更＝「今日尚無落雷」 | 無 | **疑似停更** |
| 地震 | `HazardCards` | w4 | 同上 | 同上 | 22 | `HTB` | `earthquakeLoader.ts:121-122` 規模／深度 null→0 | 無 | 新鮮 |
| 食品價格 | `FoodPriceBoard` | w12 | 自畫綠漸層＋內框 | 框外 `SectionLabel`（自訂色） | 21 | 手刻 SVG 180 天 | `intelLoaders.ts:784,808` `Number(null)`→0 | **>3 天** | 新鮮（排程靠本機） |
| 加權指數 | `TwseTicker` | w6 | 自畫漸層 | 英文在前「TAIEX 加權指數」＋狀態 pill | 24 | `Spk` 寫死 360px → **溢出 48px** | `intelLoaders.ts:271-283` H／L／漲跌 `?? 0` | 無（只有時分） | 新鮮 |
| 公衛 | `SituationCards` | w6 | 無根框、每項自畫 | 手刻色條「公衛 · HEALTH BOARD」 | 26 | `Spk` 88×24 | yoy RPC＋前端雙重補 0（`intelLoaders.ts:521-524`） | 無（只寫「截至 W37」） | **延遲 3 週；登革熱下架** |
| 司法矯正 | `PrisonCard` | w6 | `SectionLabel`＋框 | 「司法矯正 · INMATES」 | 22 | `TS` | null 時亮綠燈（`:51-54`） | **>7 天** | **停更 138 天** |
| 機場入出境 | `AirportPaxCard` | w6 | 有 | 「機場入出境 · BORDER PAX 24H」 | 10 | `TS` ×2 | `\|\| 0`；空序列顯示「入 0／出 0」＋內部表名 | 無 | **停更 2.5 天** |
| 供電 | `PowerCard` | w12 | 主框＋3 種次框 | 「能源 · POWER GRID」＋`UNIT OUTPUT` | 22／14 | `Spk` ×14、`TS` ×2、CSS 條 | 無序列傳 `[0,0]`（`:457`）；全國合計缺點當 0（`powerCardData.ts:107-110`） | 無（只有時分） | 新鮮 |
| 急診壅塞 | `ERCard` | w12 | 有 | 「急診壅塞 · ER CONGESTION 24H」＋`ER WAIT`、`14D TREND` | 20 | `Spk` ×N、`TS`、CSS 條 | `[0,0]`（`:168`）；14 天圖缺桶被連線 | 無 | **部分停更未標** |
| 戰情概覽 | `SituationOverview` | w12 | `Widget`＋自繪標題 | 「戰情概覽 · PRESSURE INDEX」 | 40（環） | SVG 環 | 未就緒用 50 定色（`:188`） | 無 | **前端 bug 永遠中斷** |
| 共機擾台 | `PlaBoard` | w12，另 `zoom 1.12` | 有 | 「共機擾台 · PLA SITUATION BOARD」＋`SEVERITY` | 30 | 手刻 CSS 柱 190px | `pct ?? 0`（`:156`）、`level ?? 1`（`:90-98,260`） | 無 | 新鮮 |
| 特殊船舶 | `VesselZoneCard` | w12，另 `zoom 1.12` | **無框** | 行內 12px「特殊船舶接近帶」 | — | `HTB` ×5 | `fillDays` 補 0（`:144-165`）；真 0 反而畫灰樁（`:189`） | 無 | 新鮮（停更會變「無船」） |
| 中國 ISR 衛星 | `IsrSatellitePassCard` | w12 | 有 | 「中國 ISR 衛星 · TERRITORIAL PASS MONITOR」 | 28 | `HTB` | —（七態文案，最好）；但印出 `latest_valid_day` 等內部欄名 | **>36h／48h** | 新鮮 |
| 台鐵誤點 | `TraDelayBoard` | w12 | **無框** | `SectionLabel`「TRA DELAY」純英文 | 13 | 手刻 SVG 三線、無軸 | `Number(x ?? 0)` 後過濾 | 無 | 新鮮 |
| 網路觀察 | `TelecomStatusCard` | w12 | 邊框色隨狀態 | 「RIPE NCC 網路觀察 · NETWORK OBSERVATION」＋大量英文狀態字 | 12 | `TS` 雙線 | —（空白不是 0） | **DB 門檻** | 新鮮（Cloudflare 子源延遲） |

另有面板本身：外殼背景手寫 `rgba(8,9,13,0.86)`、標頭 `8px 14px`（§5.1 是 `10px 14px`）、`MONITOR`／`BETA`／`SITUATIONAL AWARENESS`／`Dock`／`Split`／`Wall` 英文（inventory-b §1）。

## 可以升格成共用的既有元件（不另造通用 Card，spec §11）

| 元件 | 為什麼 | 要先改 |
|---|---|---|
| `HazardShell` ＋ `Metric`／`MetricRow`／`Note`／`MetaRow`（`HazardCards.tsx`） | 最接近標準卡：狀態點標題、主數字、註記、來源列 | 目前私有未 export；標題在框外 |
| `Widget`／`SectionLabel`（`PressureRing.tsx`） | 已有 4 格在用 | 拿掉 `uppercase`、中文不用等寬字 |
| `HazardTrendBars` | null 灰樁、0 底線的契約最清楚 | — |
| `TimeseriesSparkline` | 支援斷線、雙線、`timeDomain` | — |
| `Sparkline` | 支援 null 斷線 | 寬度改成隨容器 |
| `MonitorDataStatus`＋`useMonitorResource` | 已是共用狀態列 | 只管傳輸狀態，要加來源新鮮度 |
| ISR `deriveIsrLatestDisplay`＋`DISPLAY_LABEL` | 缺值／過期文案最完整 | 可當狀態文案範本 |

> **接手 P4**：[`handoff-p4.md`](./handoff-p4.md)

## 實作順序（每階段一個 PR）

| 階段 | 範圍 | 對應代號 |
|---|---|---|
| P1 ✅ | 共用卡片殼（`HazardShell` 升格、`MonitorPanel` 統一畫框、拿掉各卡自畫框與額外 zoom）、標題列、面板標頭中文化、窄格規則（`overflow`） | A1、C3、窄格 |
| P2a ✅ | 監看字級 S13（`fonts.html` 選定）：最小 13、取消 1.15 放大、固定高格重新分配 | — |
| P2b ✅ | 共用走勢元件（擴充 `TimeseriesSparkline`＋`HazardTrendBars`）、數值列、圖高三階；先套上半 14 格與災害四卡、加權指數、公衛 | B1、D3、E3 |
| P3 ✅ | 多指標卡：供電、急診、共機、特殊船舶、ISR、台鐵、網路、機場（雙主圖規則） | F3 |
| P4 | 來源新鮮度（每格登記週期、狀態字表）＋缺值修正＋壓力指數 loader bug＋熱度倍數 | G2、K1 |
| P5 | 跟底圖主題的淡色版，逐格驗對比 | H2 |
| P6 | 四領域子指數（analytics 規格 → gis-platform migration〔使用者拍板〕→ 前端），總指數改由子指數合成 | I2 |

資料時間追查（使用者要求追到源頭）：[`data-time-trace.md`](./data-time-trace.md)。可選的資料庫改動（要使用者拍板）：新聞 RPC 回傳彙整時間、警報 RPC 回傳最新警報時間、災防觀測兩個頻道加進 YouTube 收集清單。

資料面另案（需要人處理，不在前端 PR；網路觀察 collector 覆寫已修，data-collectors #124）：機場 collector（HiCloud VM）、在監上游、登革熱換源、落雷 CWA collector、急診 09-25～28 斷段、公衛 yoy RPC `COALESCE`。
