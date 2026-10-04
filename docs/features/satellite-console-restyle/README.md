# 衛星情報面板改版（satellite-console-restyle）

> **Slug**：`satellite-console-restyle`
> **狀態**：2026-10-04 盤點完成；同日使用者拍板（見下方「決策紀錄」），P-D 先行；P1 已實作（見決策 6）
> **P-D 進度**：2026-10-04 已實作對照表 B 除「時間軸拉到過去，變軌清單仍抓現在」以外的 12 列（分支 `feat/satellite-console-restyle`）；該列待使用者決定作法，原樣保留（見文末「P-D 實作紀錄」）
> **細節**：外殼與清單區 [`inventory-shell.md`](./inventory-shell.md)、卡片／彈窗／資料狀態 [`inventory-cards.md`](./inventory-cards.md)
> **規格**：[`docs/design-system/spec.md`](../../design-system/spec.md)

## 決策紀錄（2026-10-04 使用者拍板）

| # | 題目 | 決定 |
|---|---|---|
| 1 | 對照表 A 視覺改法照規格 | 同意；**每段動手前先給元件比較頁**看過再改 |
| 2 | 對照表 B 資料狀態修正是否納入 | 納入，P-D **排最前面** |
| 3 | 「信心 N%」 | 拿掉百分比，改「依歷史間隔估算」；事件數不足時不顯示 |
| 4 | 歷史模式變軌清單 | 要**跟著時間軸走**；作法細節待使用者確認（需 gis-platform migration，見 P-D 附註）。P-D 先做其他列，此列暫留 |
| 5 | 分段順序 | P-D → P1 → P2 → P3 → P4 → P5 |
| 6 | P1 比較頁 | E3＋H1＋B1＋T1＋S1＋F1（2026-10-04） |

## 一句話

衛星情報面板只有群組列用了共用列元件，其餘標頭、區段標題、卡片、徽章、按鈕、彈窗全是手刻，而且只有暗色。這次先盤點，再請使用者確認「改成什麼」與「資料狀態問題要不要一起修」。

## 橫向結論

1. **只有 CN／國際群組列走共用元件**（`ListRow`，`CNGroupSection.tsx:106`）；展開後的衛星清單、台灣衛星隊的卡、覆蓋統計、警報區、彈窗、百科卡全手刻。
2. **整個面板沒有淡色版**：App 不傳 `isDarkTheme`（`App.tsx:2384-2390`），`ListRow` 外包寫死 `DARK_PALETTE`（`CNGroupSection.tsx:183-184`），警報區／彈窗／百科卡色全來自靜態暗色 `COLORS`（`satelliteConsoleTokens.ts:6-12`）。
3. **標頭不是 H2**：自刻，英文「SATELLITE」放標題下方、等寬、letterSpacing 2.5，padding `13px 14px 11px`，關閉鈕 `aria-label="close"`（`SatelliteConsoleHeader.tsx:26-50,81-98`）。
4. **區段標題全是英文大寫字面字串**（「CHINA · 6 GROUPS」「INTL RECON · 9 COUNTRIES」「TAIWAN · N SATS」），`designSystemGuard` 的 `uppercase-eyebrow` 抓不到（`CNGroupSection.tsx:186-205`、`TWFleetSection.tsx:184-193`）。
5. **群組名稱不符規格**：中國英文在前，國際 9 群是 emoji 國旗加純英文、沒有中文；等級徽章直接印 S/A/B/C（`satelliteConsoleTokens.ts:46-66`、`CNGroupSection.tsx:111-115`）。
6. **等寬字包中文約 36 處**（外殼 7 處、警報區 4、彈窗 10、百科卡 4，另覆蓋統計與台灣隊多處），guard 只記 1 筆（`ManeuverCompareModal.tsx` 的 `font-data-on-cjk`，見 `designSystemGuard.baseline.json`）；非 7 階字級 9.5／10.5／11.5／12.5／13.5 在外殼 15 處、卡片 8 處。
7. **手寫 hex／rgba 數十處**，其中 `statusWarnSoft`、`statusLive`、`ELEVATION.lg` 已有等值 token（`SatelliteConsole.tsx:72-75`、`TWFleetSection.tsx:228-229`、`ManeuverAlertSection.tsx:35-37`）。
8. **彈窗與百科卡是規格外的獨立面板**：彈窗底 `SURFACE.panel`、z 100、標頭 12/16、關閉鈕 28×28、無手機分支（`ManeuverCompareModal.tsx:312-362`）；百科卡 z 35、位置寫死 `64+412+8`（`SatelliteDetailCard.tsx:82,91`）。
9. **資料狀態有多處「錯誤偽裝成正常」**：變軌 RPC 失敗回 `[]` → 綠色「無變軌 · 監測中」（`satelliteManeuversLoader.ts:48-51`）；TLE 未載入 → 「覆蓋台灣中 0 顆」（`CoverageStatsSection.tsx:93,227-236`）。整個面板沒有任何資料新鮮度。
10. **地圖 popup 與百科卡互不相通**：點地圖衛星只開 popup，百科卡只能從面板清單開；popup 標題手寫、每次顯示「來源資訊待補」（`satellitePanels.tsx:16`、`useSatellitesLayer.ts:339-345`）。

## 對照表 A：視覺／規格

「改成什麼」是依規格應採用的現成元件或做法，待使用者確認。淡色版欄：暗＝只有暗色。

| 區塊 | 元件檔 | 外框／背景 | 標題形式 | 字級／字型 | 手寫色 | 英文／內部代碼外露 | 控制項 | 淡色版 | 對應規格 | 改成什麼（範本） |
|---|---|---|---|---|---|---|---|---|---|---|
| 面板外殼 | `SatelliteConsole.tsx` | `SURFACE.strong`＋blur ✅、`RADIUS.xl` ✅；陰影寫字面值、歷史模式橘框／光暈手寫（:69-76）；z 字面 30（:77） | — | 容器 `FONT_CJK` ✅ | `rgba(255,152,0,…)`、`rgba(0,0,0,0.45)` | — | — | 暗（App 不傳 `isDarkTheme`） | §1、§3.1、§5.1、§5.25 | 接 `isDarkTheme`→`getIntelPalette`→`IntelThemeProvider`（範本 `IntelPanel.tsx:101-107,453`）；陰影取 `ELEVATION.lg`；歷史模式色走 `statusWarn*` token；z 維持已登記未歸層 |
| 標頭 | `SatelliteConsoleHeader.tsx` | 第 1 列 padding `13px 14px 11px`；第 2 列整列 `FONT_DATA` | 手刻 icon＋中文＋英文「SATELLITE」在下方 | 標題 13.5（非 7 階）；第 2 列中文落等寬 | `rgba(255,152,0,…)`、`rgba(239,68,68,…)`（:20-21,61-62,112） | 「SATELLITE」「ALERT」「LIVE／HISTORY」「§A」「close」 | 關閉鈕 `IntelIcon`、`textDim` | 暗 | §5.1 H2、§5.21、§6.1、§6.3 | `PanelHeader`（`sidebar/PanelHeader.tsx:12`）傳 `eyebrow`（中文在上）；ALERT／LIVE 改中文＋`chipTint`／`chipOutline`；「§A」改白話；中文與數字分開包 `FONT_DATA` |
| 中國 6 群 | `CNGroupSection.tsx` | 外層／每群 `borderSoft` | 區段標題英文大寫字面（:186-194） | 展開清單 9.5；「共 N，顯示前 80」落等寬（:170） | hover `rgba(255,255,255,0.03)`；變軌徽章 `rgba(239,68,68,…)`（:119,152） | 群名英文在前、tier 印 S/A/B/C、「loader」「TLE」、`⚡` | `ListRow`＋`RailToggle` ✅；展開清單手刻 | 暗（`DARK_PALETTE`） | §5.5、§5.21、§6.1、§6.3 | 標題換 `SubGroupLabel`／`MacroGroupLabel`；群名中文主名＋外文小字；tier 改人話徽章；變軌徽章 `chipTint`；空清單改 §6.4 用字 |
| 國際 9 國 | `CNGroupSection.tsx`、`satelliteConsoleTokens.ts:56-65` | 同上 | 「INTL RECON · 9 COUNTRIES」 | 同上 | 同上 | emoji 國旗＋純英文、無中文 | 同上 | 暗 | §5.5（禁名稱放 emoji）、§6.1 | 去 emoji 國旗；名稱改「美國 · USA」型式；其餘同中國 6 群 |
| 台灣衛星隊 | `TWFleetSection.tsx` | 手刻卡 `RADIUS.xl`、padding `8px 11px`、`#4fc3f7` 淡底／框（:204-218） | 「TAIWAN · N SATS」＋右側「覆蓋中」 | 12.5／10.5／9.5 共 8 處；座標列中文落等寬（:264-280） | `#4fc3f7`、`#cfe4ff`、多組 rgba（:194,209-217,228-229,308-310） | 「NORAD n」「{n}d」「12h」、`⚠`、原始英文名 | 「飛到衛星」「百科」手刻按鈕、10.5px | 暗 | §3.10、§3.13、§3.16、§5.7、§5.21、§6.2 | 卡改 `RADIUS.lg`；徽章 `chipTint`／`chipOutline`；按鈕 C2 `CONTROL.*`；`#4fc3f7` 登記為資料色常數；單位補空白、改中文 |
| 覆蓋統計 | `CoverageStatsSection.tsx` | padding `10px 14px 8px`、`borderBottom` | **無區段標題** | 10.5／9.5 共 5 處；breakdown、次數、「共 N 次」落等寬（:263-276,333,397） | `#4fc3f7`、`#22c55e`、`rgba(0,0,0,0.25)`（:227,266,269,300,312-314,327） | 「timeline」「CN／TW」「+{h}h」、`▸▾` | 展開鈕用 `▸▾` 字元；「只看遙測偵察／全部」兩顆手刻鈕（選中一綠一藍） | 暗 | §5.8、§5.16、§6.2、§7 | 加中文區段標題；展開鈕改 lucide `ChevronRight` 旋轉；篩選改分段控制（範本 `IntelPanel.tsx:541-565`）；單色選中 `accentFaint`＋`accent` |
| 變軌警報區 | `ManeuverAlertSection.tsx` | Banner／卡底手寫紅灰；紅卡整張呼吸脈衝（:104-105,235） | 無標題，Banner「近 24h 變軌偵測」兼用 | 11.5（:77,107）；4 處等寬包中文（:130,265,296,343） | `SEV_TOKEN` 及按鈕、chip 約 20 處（:35-37,120,314-370） | 「CN／INTL／TW」「PLANE／ALT／SHAPE」「影響 TW」「(drift/station-keeping)」、`cn_group` 進 `title` | 按鈕高不固定、字重 400；`▸▾`；衛星名是 `<span onClick>` | 暗 | §3.5、§5.7、§5.21、§6.1、§6.3 | 嚴重度色走 `COLORS.statusErr/Warn`；chip `chipTint`；按鈕 C2；衛星名改 `<button>`；類型用 `MANEUVER_TOKEN.zh`；去脈衝改以顏色表示 |
| 變軌對比彈窗 | `ManeuverCompareModal.tsx` | 底 `SURFACE.panel`、z 100、遮罩 padding 24、容器寬 760 | 手刻 12/16 標頭、無 eyebrow、關閉鈕 28×28 無 `aria-label` | 9.5、字重 800；10 處等寬包中文 | bbox、SVG、軌跡約 20 處（:187-249,380-381,408-526） | 「BEFORE／AFTER」「OVERHEAD PASSES」「NORAD」「TW」「tle_history prev/curr」 | 只有關閉鈕；無 Esc；SVG 寫死 320×260 | 暗 | §3.1、§5.27、§5.35 E3、§6.1、§6.3 | 依 §5.27：底 `SURFACE.solid`、`Z_INDEX.modal`、`PanelHeader` 式標頭、24×24 關閉鈕；加 Esc 與手機版；圖用 `HazardTrendBars`；補圖例（`legendKit`） |
| 衛星百科卡 | `SatelliteDetailCard.tsx` | 外殼符合 §5.1 ✅；z 35、`left: 64+412+8` 寫死 | 手刻標頭 11/14/9、無 eyebrow | 10.5／9.5 共 5 處；4 處等寬包中文（:246 Section 整個等寬） | 預測區 `rgba(100,170,255,…)`、`#cfe4ff`（:199-221） | 「NORAD／COSPAR」、`satellite_tle_history`、`reference.satellite_catalog`、UCS 英文原值 | 只有關閉鈕（`aria-label="close"`） | 暗 | §5.1、§5.2、§6.1、§6.3 | `PanelHeader`；位置改引用 `PANEL_WIDTH`／`LAYOUT`；Row 用 `featureInfo/shared.tsx` 的 `Row`（null 不渲染）；footer 改 `SourceFooter`；英文原值加中文對照 |
| 地圖 popup | `featureInfo/satellitePanels.tsx` | 走 `FeatureInfoPanel` 殼 ✅ | 手寫 div，缺 `Title`（無色點、底線） | 13／700 ✅ | fallback `#888`（:12） | 「Satellite」「NORAD」「swath／elevation ≥10° cone」、類別帶 emoji＋英文 | — | 有（跟 popup 殼） | §5.2、§5.3、§6.1 | 標題改 `shared.tsx:11` 的 `Title`；說明改中文；來源欄位見對照表 B |
| footer | `SatelliteConsole.tsx:119-142` | `padding 8px 14px`、`borderTop` | — | `FONT_DATA` 整行含中文 | — | 「UCS Database · Space-Track」 | 原生 checkbox「顯示全部軌道」 | 暗 | §5.3 F2、§5.10、§6.1 | 來源行改 F2 結構（機關 · Tier · 原始頁 ↗／抓取於）；checkbox 改細項開關（`LayerToggleSwitch` 20×11） |

## 對照表 B：資料狀態與正確性

> **非純視覺，是否納入本輪由使用者決定。** 不納入時，本輪只改外觀，這些問題原樣保留；納入則多一段 P-D。各列「規格」依 §6.4（狀態用字）、§6.5（缺值）；來源見 [`inventory-cards.md` §3](./inventory-cards.md) 與 [`inventory-shell.md` §3](./inventory-shell.md)。

| 問題 | 現況 | 位置 | 規格（§6.4／§6.5） | 建議 |
|---|---|---|---|---|
| 變軌 RPC 失敗顯示綠色「無變軌 · 監測中」（已複驗） | RPC 錯誤或 Supabase 未設定時 loader 回 `[]`；首次 fetch 前也是同畫面 | `satelliteManeuversLoader.ts:48-51` → `ManeuverAlertSection.tsx:68-88` | 錯誤要有自己的文字，不能當正常 | loader 回狀態（loading／error／empty／ok），失敗顯示「資料讀取失敗」；範本 `MonitorDataStatus`＋`deriveIsrLatestDisplay` |
| 「影響 TW」卡在計算中 | pair 缺失或 `countTwPasses` 回 null 時 `impact:null`，chip 永遠「計算 TW 影響中…」 | `useManeuverImpacts.ts:50,54,73-75` → `ManeuverAlertSection.tsx:336-347` | §6.4 載入中與失敗要分開 | 區分 computing／unavailable，後者顯示「無法計算」 |
| 覆蓋統計未載入顯示 0 顆／0 次 | `coveringNow` 初值 `[]`、`computingScan` 初值 false，TLE 未載入／失敗時主數字顯示 0 | `CoverageStatsSection.tsx:93,96,140,227-236` | §6.5 null 不當 0 | 未就緒顯示「—」或「讀取中…」；失敗顯示錯誤字 |
| null→0 造成假變軌 | `deriveManeuverEvents` 把 null 當 0 相減；`formatManeuverDetail`、`getManeuverSeverity` 用 `?? 0`（null 一律歸「例行」） | `satelliteHistoryLoader.ts:106-108`；`satelliteManeuversLoader.ts:66-95` | §6.5；§1 null 不當 0 | 任一端 null 即略過該欄，不產生事件；顯示「—」 |
| 「信心 N%」是公式 | `min(80, 30+5×間隔數)`；n=2 時 σ=0 仍出預測；未扣距上次已過天數 | `satelliteHistoryLoader.ts:151-175`；`SatelliteDetailCard.tsx:197-228` | §6.5（合成值不可冒充統計量） | 改稱「依歷史間隔估算」並拿掉百分比，或事件數不足時不顯示 |
| 「變軌前 7 天」文案與計算不符 | 兩段都從偵測時間往後推 7 天，差別只在新舊 TLE：是反事實推算，不是事件前真實 7 天 | `ManeuverCompareModal.tsx:276-278,380`；`useManeuverImpacts.ts:51-53` | §6.1、§6.5（文案要忠於計算） | 文案改「以變軌前／後軌道推算未來 7 天」 |
| 前段 0 次時百分比硬寫 100% | 前段 0、後段 >0 時 `pct=100`；兩段皆 0 顯示 0%「持平」 | `ManeuverCompareModal.tsx:293-295` | §6.5 | 前段為 0 時不顯示百分比，只顯示次數差 |
| 時間軸拉到過去，變軌清單仍抓現在 | 歷史模式有橘框，但清單固定抓真實現在近 24h；百科卡 30 天歷史也無時間錨點 | `SatelliteConsole.tsx:38-49`；`satelliteManeuversLoader.ts:108-117`；`SatelliteDetailCard.tsx:40-48` | §6.4（時間基準要一致） | 歷史模式下警報區標明「僅顯示現實 24h」或隱藏；錨點是否跟時間軸待決定 |
| 無任何資料新鮮度顯示 | 看不到 TLE 抓取時間、變軌最後成功時間；MV 每 2h 刷新、TLE 走 localStorage 快取 | `SatelliteConsoleHeader.tsx:102-142`；`satelliteLoader.ts:34-44`；`satelliteManeuversLoader.ts:5,35-36` | §6.4、§5.3「抓取於」 | 標頭或 footer 加「更新 HH:MM」；用 `useMonitorFreshness` 判過期 |
| 變軌資料雙重輪詢 | 面板內 `fetchRecentManeuvers(24)` 每 30s，App 另有 `useSatelliteManeuvers`，同時兩份 | `SatelliteConsole.tsx:39-53`；`App.tsx:743` | （效能／一致性，非規格條文） | 合併成單一來源（面板改吃 hook 結果） |
| popup 衛星無來源欄位 | feature props 無 `source_org`／`source_url`，也不在豁免清單，每次顯示「來源資訊待補」 | `useSatellitesLayer.ts:339-345`；`FeatureInfoPanel.tsx:26-51` | §5.3 F2 | props 補來源，或加入 `FOOTER_SELF_MANAGED_LAYER_TYPES` |
| 內部表名外露 | `reference.satellite_catalog`、`realtime.satellite_tle_history`、`tle_history`、`prev/curr`、`epoch`；`cn_group` 進 tooltip | `SatelliteDetailCard.tsx:225,233`；`ManeuverCompareModal.tsx:371`；`ManeuverAlertSection.tsx:240` | §6.3 | 改人類可讀來源名（例：「UCS 衛星資料庫」「歷史軌道資料」） |
| 錯誤偽裝成「無顯著機動」／「目錄缺失」 | `fetchTleHistory` 錯誤回 `[]` → 「未達閾值」；目錄 RPC 錯誤與「UCS 沒這顆」同為整卡「—」；彈窗三種失敗共用一句 | `satelliteHistoryLoader.ts:37-42,70-73`；`satelliteCatalogLoader.ts:71-74` | §6.4、§6.5 | 同第 1 列做法：loader 回狀態、各失敗各自文案 |
| 台灣衛星隊失敗時永遠「載入中…」 | `loadSatellites` 失敗回 `[]`，`rows.length===0` 就顯示載入中；傳播失敗的衛星被靜默略過 | `TWFleetSection.tsx:174-180,145-146`；`satelliteLoader.ts:110-112` | §6.4 | 區分載入中／失敗；略過時註明「N 顆暫無法計算」 |

另有 R9（RPC 日期是否台灣時區切）尚未驗證，見「待查」。

## 可沿用的既有元件

不另造通用 Card（spec §11）。`HazardShell`／`Metric`／`MetricRow`／`Note`／`MetaRow` 是 `HazardCards.tsx` 的**私有**函式，沒有 export，**不可**當共用元件列入。

| 元件 | 檔案:行 | 用途 | 備註 |
|---|---|---|---|
| `PanelHeader` | `sidebar/PanelHeader.tsx:12` | H2 標頭（eyebrow＋標題＋`<X size={14}/>`＋`aria-label="關閉{標題}"`） | 取代 Console 標頭、百科卡標頭、彈窗標頭 |
| `ListRow`／`RailToggle` | `sidebar/LayerRow.tsx:74`／`:13` | 群組列、列開關 | 已用於 CN 群組列（`CNGroupSection.tsx:106`） |
| `LayerToggleSwitch` | `sidebar/LayerToggleSwitch.tsx:13` | 列開關、細項開關 | footer 的 checkbox 改用 |
| `SubGroupLabel`／`MacroGroupLabel` | `sidebar/ThemeBanner.tsx:67`／`:91` | 中文區段標題 | 取代英文大寫標題 |
| `SourceFooter` | `featureInfo/shared.tsx:158` | F2 來源 footer | 給 popup、百科卡；面板底部也照 F2 結構 |
| `Title`／`Row`／`Badge` | `featureInfo/shared.tsx:11`／`:45`／`:99` | popup、百科卡內容列 | `Row` 有 null 不渲染 |
| `chipTint`／`chipOutline` | `intel/intelTokens.ts:85`／`:90` | 徽章兩公式（§5.21） | 取代手寫 rgba 徽章 |
| `getIntelPalette`／`IntelThemeProvider`／`useIntelTheme` | `intel/intelTheme.tsx:118`／`:127`／`:125` | 暗／淡主題 | 範本接線 `IntelPanel.tsx:101-107,453` |
| `railPalette`／`RailThemeContext` | `sidebar/railTheme.ts:40`／`:42` | 群組列主題 | 取代寫死 `DARK_PALETTE` |
| `MonitorMetric`／`MonitorSub`／`MonitorNote` | `intel/monitor/MonitorMetric.tsx:46`／`:123`／`:142` | 主數字／副資訊／註記 | ISR 卡實際用的版本 |
| `HazardTrendBars` | `intel/monitor/HazardTrendBars.tsx:86` | 標準柱圖 | 取代 PassBar、預測 bar |
| `MonitorDataStatus` | `intel/monitor/MonitorDataStatus.tsx:8` | 讀取中、更新中斷 | 資料狀態文案範本 |
| `useMonitorFreshness`（`judgeFreshness`） | `intel/monitor/monitorFreshness.ts:161`（`:83`） | 新鮮度判斷 | 對照表 B 新鮮度列 |
| `deriveIsrLatestDisplay` | `intel/monitor/IsrSatellitePassCard.tsx:73` | 缺值／過期文案分態 | loading／error／empty／stale 分開，不以 0 代替 |
| `legendKit`（`SwatchDot`／`SwatchSquare`／`SwatchLine`） | `legend/legendKit.tsx` | 圖例色票 | 彈窗地圖、嚴重度圖例 |
| `ToolbarButton`／`.lpc-btn`、`ModeToggle`／`.lpc-seg` | `toolbar/ToolbarButton.tsx`、`layerParamControls.css`、`ModeToggle.tsx` | C2 按鈕、分段控制 | 取代手刻按鈕與篩選鈕 |
| `InfoModal` | `InfoModal.tsx` | §5.27 彈窗範本 | 變軌對比彈窗參考 |

## 範本本身的偏差

用範本前先知道它們自己也不完全合規，別整個照抄。

- **即時情報 `IntelHeader.tsx`** 也是手刻、不走 `PanelHeader`；關閉鈕同樣是 `aria-label="close"`、色 `textDim`（`intel/IntelHeader.tsx:92-109`）。標頭應以 `PanelHeader` 為準，不要以 `IntelHeader` 為準。
- **監看 ISR 卡** 殘留：期間切換「30D／90D／120D」用 `FONT_DATA`、選中字色 `textStrong`（`IsrSatellitePassCard.tsx:418-430`）；卡底「YAOGAN／GAOFEN／JILIN」英文家族名與「census」（:474）；色階圖例是手寫 8×8 方塊（:466）。

## guard 盲點

`designSystemGuard` 目前綠燈（15/15），範圍內檔案幾乎全為 0，但**不代表合規**，抓不到：

- 多行 `FONT_DATA` 容器內的中文（`font-data-on-cjk` 只看同一行直接子文字）。
- 字面英文大寫字串（「CHINA · 6 GROUPS」等；`uppercase-eyebrow` 只認 `textTransform`）。
- `▸`／`▾`（`triangle-chevron` 只擋 `▶`／`▼`）。
- TSX 內的 hex／rgba（`hex-literal-in-ui-css` 只掃 CSS）。
- 非 7 階字級、emoji、tier 代碼、`NORAD`。

驗收不能只靠 guard，要照 §8 checklist 加上人工逐項與暗／淡實機看圖。

## 待查

- **手機版面板**：未盤點（Console 固定 412px、彈窗 760px，手機行為未驗證）。
- **R9**：RPC 變軌日期是否台灣時區切；註解說依台灣時區，實作是 `fetched_at.slice(0,10)`（`deriveManeuverEvents`），RPC 實際回傳格式未驗證（gis-platform 不在本次範圍，P-D 未查正式 DB）。僅讀程式碼的已知事實：`slice(0,10)` 取的是字串自己的日期，不會做時區換算；RPC 若回 UTC（`…Z`／`+00:00`）字串，台灣 00:00–08:00 的事件會落到前一天。只影響百科卡「變軌歷史」的日期標示與間隔天數（同日界線誤差 ≤1 天）；要修的話改成 `new Date(fetched_at)` 加 8 小時再取日期（不管 RPC 回哪種格式都正確），但需先確認 RPC 格式，故 P-D 未動。
- **spec §10.2** 區塊狀態表缺「衛星情報」一列，改版完成後要補。
- 已確認：各 loader 都有走 `withLoading`（loadingRegistry）。

## 分段草案（待確認）

「需選擇頁」＝動手前要先做暗／淡並排比較頁（類似 `monitor-restyle/picks.html`）讓使用者選。

| 階段 | 範圍 | 需選擇頁 |
|---|---|---|
| P1 | 外殼、標頭 H2（`PanelHeader`＋中文 eyebrow）、區段標題中文化（`SubGroupLabel`）、footer 依 §5.3 | 需要（標頭與區段標題樣式、footer 結構）。**已完成**（2026-10-04，E3＋H1＋B1＋T1＋S1＋F1） |
| P2 | 群組列名稱（中文在前、去 emoji 國旗）、等級徽章改寫、變軌徽章改 `chipTint` | 需要（群名與等級徽章寫法） |
| P3 | 台灣衛星隊＋覆蓋統計：控制項（C2 按鈕）、chevron、分段控制、新鮮度顯示 | 需要（卡片樣式、新鮮度位置） |
| P4 | 變軌警報區、對比彈窗（§5.27）、衛星百科卡、地圖 popup | 需要（彈窗與警報區視覺） |
| P5 | 淡色版（跟底圖主題，含 `satelliteConsoleStore`／App 傳 `isDarkTheme`） | 需要（淡色色票） |
| P-D | 對照表 B 的資料狀態修正（loader 回狀態、缺值不當 0、來源欄位、雙重輪詢） | 不需要。**已完成**（歷史模式清單那列除外，待決） |

## P-D 實作紀錄（2026-10-04）

對照表 B 逐列處理結果。**未做**：「時間軸拉到過去，變軌清單仍抓現在」（待使用者決定；P-D 沒有讓它更糟：清單仍固定抓現實 24h，歷史模式 Header 仍標「§A 警報固定看現實 24h」）。

| 列 | 做法 | 位置 |
|---|---|---|
| 變軌 RPC 失敗 | `fetchRecentManeuvers` 回 `{ok, rows, fetchedAt}`／`{ok:false, reason}`；hook 回 `ManeuversState`（loading／ok／error＋`stale`）；警報區分「讀取中…」「資料讀取失敗」「近 24h 無變軌」；曾成功後更新失敗保留舊資料並標「更新中斷」 | `satelliteManeuversLoader.ts`、`satelliteDataState.ts`、`useSatelliteManeuvers.ts`、`ManeuverAlertSection.tsx` |
| 影響 TW | hook 回 `ManeuverImpactState`：沒有項目＝計算中；`unavailable`＝「影響 TW · 無法計算」（不寫進 cache，下次重試） | `useManeuverImpacts.ts` |
| 覆蓋統計 | TLE 載入走 `useSatelliteRecords`（loading／ok／error）；讀取中顯示「讀取中…」、失敗整列改錯誤字、尚未算出顯示「—」「…」，不再顯示 0 | `CoverageStatsSection.tsx` |
| null→0 假變軌 | `deriveManeuverEvents` 任一端 null 即略過該欄；`formatManeuverDetail` null 顯示「—」；嚴重度新增 `unknown`（「無法判定」，收在例行摺疊內但單獨計數，不當例行） | `satelliteHistoryLoader.ts`、`satelliteManeuversLoader.ts` |
| 信心 N% | 移除 `confidencePercent`，標示「依歷史間隔估算」；**間隔數 < 3（`MIN_PREDICTION_INTERVALS`，即事件 < 4 筆）不顯示預測**（n=2 時 σ 恆為 0、n=3 僅 2 個間隔，皆無意義）。門檻是判斷值，可再調 | `satelliteHistoryLoader.ts`、`SatelliteDetailCard.tsx` |
| 「變軌前 7 天」 | 改「變軌前／後軌道推算 7 天」、標題「以變軌前／後軌道推算未來 7 天」 | `ManeuverCompareModal.tsx` |
| Prior=0 | `computePassDiff`：前段 0 → `pct:null`，主數字顯示次數差（例「+3 次」），不再硬寫 100% | `satelliteDataState.ts`、`ManeuverCompareModal.tsx` |
| 新鮮度 | 面板 footer 上方一行「TLE 更新 HH:MM」「變軌 更新 HH:MM」（台灣時間）；TLE 用 `judgeFreshness`（2h 週期，>12h 標「資料過期」），變軌以最近一次成功讀取時間＋`stale` 旗標。時間是「瀏覽器讀到的時間」不是資料本身時間（變軌 MV 與 TLE 沒有可用的資料時間欄），位置與樣式留給 P1/P3 | `satelliteDataState.ts`（`describeFreshness`）、`SatelliteConsole.tsx` |
| 雙重輪詢 | 面板移除自己的 30s 輪詢，改吃 App 層 `useSatelliteManeuvers` 結果（`SatelliteConsole` 新增 `maneuvers` prop） | `SatelliteConsole.tsx`、`App.tsx` |
| popup 來源 | 判斷：feature props 每 5Hz 重塞整批，不加字串進去；改在 `SatellitePanel` 補 Space-Track／UCS 常數與 TLE 抓取時間並自掛 `SourceFooter`，`satellite` 加入 `FOOTER_SELF_MANAGED_LAYER_TYPES`（同土壤液化等既有做法）。來源依據：`satelliteLoader.ts` 檔頭（`satellite_classified` view，gis-platform 每 2h 從 Space-Track 同步）；license 未查證，故未填 | `satellitePanels.tsx`、`FeatureInfoPanel.tsx` |
| 內部表名 | 百科卡來源改「UCS 衛星資料庫 · 歷史軌道資料」、彈窗錯誤字不再有 `tle_history prev/curr`、`cn_group` 不進 tooltip（改用圖層中文名） | `SatelliteDetailCard.tsx`、`ManeuverCompareModal.tsx`、`ManeuverAlertSection.tsx` |
| 錯誤偽裝 | `fetchTleHistory` 回 `{ok, rows}`／`{ok:false, reason}`；`fetchCatalog` 回 `ok／missing／error`；`fetchTlePair` 加 `error`。百科卡分「歷史軌道資料讀取失敗」「近 30 天沒有歷史軌道資料」「變化未達閾值」「UCS 讀取失敗」「UCS 沒有這顆」；彈窗分「讀取失敗」「找不到前後紀錄」「軌道無法解析」 | `satelliteHistoryLoader.ts`、`satelliteCatalogLoader.ts`、`SatelliteDetailCard.tsx`、`ManeuverCompareModal.tsx` |
| 台灣衛星隊 | `deriveFleetView`：載入中／讀取失敗／目前沒有資料／全部算不出來分開；部分略過時標題旁顯示「N 顆暫無法計算」 | `TWFleetSection.tsx`、`satelliteDataState.ts` |

附帶：`loadSatellites` 新增 `loadSatellitesResult`（回 ok／失敗＋`fetchedAt`）並讓同時載入共用同一次請求（失敗時不再各元件各重打一輪）；舊 `loadSatellites` 保留給地圖圖層。CN／國際群組清單（`CNGroupSection`）仍用舊介面，TLE 失敗時清單為空，不在對照表 B 範圍，留給 P2。

**未處理／留意**：歷史模式清單那列；`useSatelliteManeuvers` 停用時回初始 loading 狀態；footer 新鮮度與警報區 stale 文字是最小放置，P1/P3 再定位。
