# 衛星情報面板：卡片、彈窗與資料狀態盤點（唯讀）

> 盤點日 2026-10-04，分支 `feat/rail-routes-static` 工作區（未改任何檔）。
> repo 根：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse`，以下路徑皆相對 repo 根。
> 規格：`docs/design-system/spec.md`。行號是本次讀到的版本。

## 0. 前提事實（先修正任務假設）

- **三個元件都沒有淡色版**：`ManeuverAlertSection`／`ManeuverCompareModal`／`SatelliteDetailCard` 的色都來自 `satelliteConsoleTokens.ts`，它轉出口 `intel/intelTokens.ts` 的靜態暗色 `COLORS`，沒有接 `intelTheme`／`useFeatureTheme`／`LIGHT`。
- **`COLORS.panelBg` = `rgba(0,0,0,0.52)`**（`intelTokens.ts:17`），也就是 `SURFACE.panel`；spec §3.1 寫明「新面板不要用」。`COLORS.panelBorder` = `rgba(255,255,255,0.10)`，等於 `BORDER.panel`。
- **HazardShell／Metric／MetricRow／Note／MetaRow 不是共用元件**：都是 `src/components/intel/monitor/HazardCards.tsx` 第 56／147／167／183／196 行的私有函式，沒有 export。ISR 卡**沒有用到它們**，實際用的是 `MonitorMetric.tsx` 的升格版本（見 §1.5）。
- **地圖 popup 跟 SatelliteDetailCard 沒有共用程式碼，畫面也各自獨立**（見 §1.4）。DetailCard 檔頭註解寫「點任一衛星觸發」（`SatelliteDetailCard.tsx:2`），實際上不成立：`satelliteConsoleStore.selectNorad()` 只有 Console 的三個 section 會呼叫（`SatelliteConsole.tsx:96,109,114`）；點地圖上的衛星只會開 popup。
- **spec 狀態表**：§10.2 沒有「衛星情報」這一列。spec 提到衛星面板的只有 §3.1（底色已改 `SURFACE.strong`）、§5.1（位置 `left 64`）、§5.25／§10.3（z-index 30／35／100 登記為**已知未歸層**）、§5.26（左側面板互斥）、§10.3「等寬中文 3 處」（含 `ManeuverCompareModal.tsx`）。
- **guard 低估**：`designSystemGuard.baseline.json` 的 `font-data-on-cjk` 只記了 `ManeuverCompareModal.tsx` 1 筆，但人工數出三個檔共約 18 處用 `FONT_DATA` 包中文（明細見各節）。所以 guard 綠燈不等於合規。`▸`、`▾` 不在 `triangle-chevron` 規則內，也沒被抓到。

---

## 1. 逐元件盤點

### 1.1 `src/components/satelliteConsole/ManeuverAlertSection.tsx`（§A 變軌警報，394 行）

| 欄位 | 現況（行號） |
|---|---|
| 尺寸／位置／z | 是 Console 面板（`SatelliteConsole.tsx:62-86`：fixed `left:64`、`top:LAYOUT.leftDockTop`、`bottom:130`、寬 `PANEL_WIDTH` 412、`zIndex:30`）內捲動區的第一段；本身 padding `12px 14px`、底線 `borderSoft`（L95）。 |
| 外框與背景 | Banner：`RADIUS.lg`，底 `rgba(239,68,68,0.12)`／`rgba(156,163,175,0.10)`，框 `rgba(239,68,68,0.45)`（L104-105）。卡片：底與框取自檔內 `SEV_TOKEN`（L34-38，全部手寫 hex／rgba）。紅卡整張套 `satManeuverPulse 1.5s` 呼吸動畫（L235），Banner 圓點與 SevDot 也有脈衝（L114, L205）。 |
| 標題列 | 沒有 H2／小節標。Banner「近 24h 變軌偵測」11.5px 600（L107, L116）兼當標題。 |
| 字級（不在 7 階） | `fontSize: 11.5`（L77、L107）。其餘用 `FONT_SIZE.*`。卡名 `FONT_SIZE.md` 12／compact 11（L247）。 |
| 字型（FONT_DATA 包中文） | ① 嚴重度說明「重大 N 注意 N 例行 N」（L130）② 嚴重度 chip「重大／注意／例行」（L265）③ 中行 `formatManeuverDetail`「傾角 +0.12°」＋`formatRelTime`「14 分鐘前」（L296）④ ImpactChip「計算 TW 影響中…」（L343）。共 4 處。 |
| 手寫色 | `SEV_TOKEN` 的 `#ef4444`／`#f97316`／`#9ca3af` 及 rgba（L35-37）；INTL 計數 `"#22c55e"`（L120）；例行展開鈕底 `rgba(255,255,255,0.025)`（L164）；按鈕 `"rgba(100,170,255,0.55)"`、`"#cfe4ff"`、`"rgba(100,170,255,0.16)"`（L314, L324）；ImpactChip 的 rgba 與 `"#22c55e"`（L341, L355-357, L370）；chip 用 `${color}22`／`55` 拼透明度（L263-264, L277-278）。`satelliteConsoleTokens.ts:39-40` 的 `SHAPE_CHANGE` `#facc15`。嚴重度橘 `#f97316` 和類型 ALTITUDE 的 `statusWarn #ff9800` 是兩種相近的橘。 |
| 英文／代碼外露 | Banner「CN n / INTL n / TW n」（L118-122）；類型 chip「PLANE／ALT／SHAPE」，由 `PLANE_CHANGE` 等列舉縮寫而來（L289）；「(drift/station-keeping)」（L176）；「影響 TW」「計算 TW 影響中…」（L345, L360）；國旗 emoji 的 `title` 會 fallback 成 `row.cn_group`（`YAOGAN` 等內部代碼，L240）；「近 24h」。`satelliteConsoleTokens.ts` 的 `MANEUVER_TOKEN.label` 存的是 `"PLANE_CHANGE"`（L21）。 |
| 圖表 | 無圖表。嚴重度說明是手寫 6px 圓點的行內圖例（`SevDot` L200-208）。 |
| 缺值／過期／載入 | 空陣列時顯示綠色「近 24h 無變軌偵測 · 監測中」（L68-88），但 RPC 錯誤或 Supabase 未設定時 loader 也回 `[]`，畫面一樣（見 §3）。沒有載入中狀態，第一次 fetch 前同樣顯示「無變軌」。沒有資料時間或新鮮度（MV 每 2h refresh，`satelliteManeuversLoader.ts:5`）。`impact` 缺失時永遠停在「計算 TW 影響中…」（L336-347，見 §3）。 |
| 按鈕 | `btnStyle()`（L381-394）：padding `5px 10px`，沒有固定高 26，字重 400（§5.7 規定 500），「詳情」底 `transparent`、框 `borderMid`（§5.7 規定 `CONTROL.bg`／`CONTROL.border`），「覆蓋變化」用自訂主要色（字 `#cfe4ff`，§5.7 規定 `--accent`）；沒有 hover 底、沒有 `:focus-visible`。compact「對比」鈕 10px、padding `3px 8px`。例行展開鈕是虛線框、文字「▸ 展開／▾ 收合」（L177，三角字元）。衛星名是可點的 `<span>`（L243-258），不是 button，沒有 keyboard／aria。`onFlyTo` prop 宣告了但沒使用（L26, L40）。 |
| 共用 vs 手刻 | 全部手刻，沒有用到 `PanelHeader`、`ToolbarButton`／`.lpc-btn`、legendKit、`MonitorMetric`。 |

### 1.2 `src/components/satelliteConsole/ManeuverCompareModal.tsx`（§F 變軌前後覆蓋對比，539 行）

| 欄位 | 現況（行號） |
|---|---|
| 尺寸／位置／z | 遮罩 fixed `inset:0`、`zIndex: 100`（L312，§5.25 已登記為未歸層）、`rgba(0,0,0,0.6)`＋`blur(4px)`、padding 24；點遮罩可關閉（L310）。容器 `width:760`、`maxWidth:100%`、`maxHeight:92vh`（L322）。MiniMap SVG 寫死 `320×260`，兩張並排（L149, L379-382），內容寬不會跟著縮；沒有 §5.27 的手機分支（`100vw × 92vh` 由下緣出現）。沒有 Esc 關閉。 |
| 外框與背景 | 底 `COLORS.panelBg` = `SURFACE.panel` 0.52（L323；§3.1 規定模態用 `SURFACE.solid` 0.94），框 `BORDER.panel` 等值、`RADIUS.xl`；沒有 elevation。進場動畫沿用左側面板的 `satConsoleFadeIn`（translateX 滑入，L326）。 |
| 標題列 | padding `12px 16px`（§5.27／§5.1 規定 `10px 14px`）；沒有 eyebrow；依序是類型 chip（FONT_DATA，L335-343）＋名稱 13px 700＋「NORAD n」＋變化量；關閉鈕 `28×28`（§5.27 規定 24×24），沒有 `aria-label`，色 `textDim`（規格 `textMuted`）（L353-361）。 |
| 字級（不在 7 階） | MiniMap 標籤 `fontSize: 9.5`（L203）；百分比字重 800（L431，§3.14 只有 400／600／700）。 |
| 字型（FONT_DATA 包中文） | ① MiniMap 標籤「BEFORE · 變軌前 7 天」（L203）② 「過台 N 次 / 7d」（L207）③ 標頭類型 chip `token.zh`「軌道面變化」（L339）④ 標頭變化量「傾角…」（L350）⑤ 方法註記「顯示框：經度…｜比對方法…」（L391）⑥ 「OVERHEAD PASSES · 過台頻次 7 天」（L419）⑦ 「↑ 增加 N 次／↓ 減少／持平」（L435）⑧ PassBar 單位「次」（L458）⑨ 「新增覆蓋」（L489）⑩ 「失去覆蓋」（L503）。共 10 處；guard 基準只記 1。 |
| 手寫色 | 區域 bbox 綠／紅／灰 rgba（L187-193）；SVG 底 `"#0b0f14"`（L213）、經緯線 `rgba(255,255,255,0.04)`（L219, L225）；台灣中心點 `"#4fc3f7"`＋`white`（L247-249）；軌跡 `"#ff9800"`／`"#4fc3f7"`（L380-381）；headline 的 `"#4fc3f7"`（L408-409）、`rgba(255,255,255,0.025)`（L415）、`rgba(255,152,0,0.55)`（L425）、`rgba(255,255,255,0.05)`（L460）；Chip `"#22c55e"`（L493, L496）、`${color}22／66`（L526-527）。SVG `<text>` 用 `fontFamily="ui-monospace, monospace"` 字面（L249）。 |
| 英文／代碼外露 | 「NORAD {id}」（L348）、「BEFORE／AFTER」（L380-381, L425, L441）、「OVERHEAD PASSES」（L422）、SVG 文字「TW」（L249）、「7d」（L208）、載入文案「載入 TLE pair + 計算 7 天 ground track…」（L367）、錯誤文案「tle_history 找不到對應的 prev/curr TLE（epoch 可能尚未歸檔）」（L371，表名與欄名外露）、「elevation&gt;10°」「10 min 步進」（L393）。標籤用 `letterSpacing 1.5–2px`，視覺上是英文大寫 eyebrow（L203, L419, L452, L489）。 |
| 圖表 | 全部手刻：MiniMap 是等距矩形投影的 SVG（L148-259）；PassBar 是 CSS 進度條（L447-468）。綠＝新增、紅＝失去、灰＝不變、橘／藍軌跡都沒有圖例，只靠 chip 文字。 |
| 缺值／過期／載入 | 載入中（L365-368，沒走 §6.4 的「載入中…」用字）。`!pair.prev || !pair.curr` 時顯示 warn 文案（L369-372）：RPC 錯誤、Supabase 未設定、TLE 未歸檔三種情況共用同一句（`satelliteHistoryLoader.ts:70-73` 錯誤時回 `{prev:null,curr:null}`）。`computeGroundTrack` 回 null（TLE 解析失敗）時 `diff` 為 null，headline 與區域 chip 不顯示，只剩兩張空白小地圖，沒有任何說明。前一段過台次數為 0、後一段大於 0 時 `pct` 被設成 100%（L293-295，合成值）。 |
| 按鈕／modal | 只有關閉鈕（見標題列）。對照 §5.27：層級（100 ≠ `Z_INDEX.modal` 40）、標頭 padding、沒有 eyebrow、關閉鈕尺寸、底色、沒有手機尺寸，都不符合。遮罩點擊關閉符合。 |
| 共用 vs 手刻 | 全部手刻。`computeGroundTrack`（L80-128）與 `utils/maneuverImpact.ts` `countTwPasses` 是兩份同樣的 SGP4 過台邏輯（後者檔頭自承「與 §F 同邏輯」）。 |

### 1.3 `src/components/satelliteConsole/SatelliteDetailCard.tsx`（§E 衛星百科卡，276 行）

| 欄位 | 現況（行號） |
|---|---|
| 尺寸／位置／z | fixed，`left: 64 + 412 + 8`（寫死，沒有引用 `PANEL_WIDTH`）、`top: LAYOUT.leftDockTop`、寬 380、`maxHeight: calc(100vh - 112px)`、`zIndex: 35`（L80-91，§5.25 已登記為未歸層）。 |
| 外框與背景 | `SURFACE.strong`＋`blur(16px)`、`BORDER.panel`（等值）、`RADIUS.xl`、`ELEVATION.lg`、`FONT_CJK`（L86-97），符合 §5.1 外殼。 |
| 標題列 | 手刻，不是 `PanelHeader`；沒有 eyebrow；padding `11px 14px 9px`（§5.1 規定 `10px 14px`）；標題 13 bold（符合）；副行「NORAD n · COSPAR x」FONT_DATA 10px（L113-115）；關閉鈕 24×24＋`<X size={14}/>`（符合），但 `aria-label="close"` 是英文（§5.1 規定「關閉{標題}」），色 `textDim`（規格 `textMuted`）（L117-125）。 |
| 字級（不在 7 階） | `fontSize: 10.5`（L172, L182）、`9.5`（L185, L210, L224）。 |
| 字型（FONT_DATA 包中文） | ① Section 小節標整個是 `FONT_DATA`，內容是中文「操作方／用途」「發射」「軌道」「變軌歷史 · 近 30 天（N 筆）」「啟發式預測」（L246）② 事件 detail「傾角 +0.12°」（L188）③ 「信心 N%」（L206）④ footnote「來源：UCS…」（L232）。共 4 處。 |
| 手寫色 | 預測區底 `rgba(100,170,255,0.08)`、框 `rgba(100,170,255,0.25)`（L199）；數字 `"#cfe4ff"`（L202）；進度條 `rgba(255,255,255,0.08)`、`rgba(100,170,255,0.5)`（L214, L221）。 |
| 英文／代碼外露 | 「NORAD」「COSPAR」（L114）；fallback 標題 `NORAD ${norad}`（L111）；事件類型「PLANE／ALT／SHAPE」（L186）；「μ = … d · σ = … d · n = …」（L211）；預測註記「基於 satellite_tle_history 推算」（L225，表名）；footnote「UCS Satellite Database (reference.satellite_catalog) · TLE history (realtime.satellite_tle_history)」（L233，schema.表名）；`fmtCountry` 只翻中國／台灣／美國，其他國家原樣顯示英文（L270-276）；UCS 原文欄位（用途、細項、用戶、運營商、場地、火箭、製造、軌道類別 LEO/GEO）全部顯示英文原值（L137-163）；`orbitStr` 用「min」（L73）；Section 標題用 `letterSpacing 1.5px`（L248）。 |
| 圖表 | 預測區的 mini bar 是手刻 CSS（L214-223），以 30 天當全寬，沒有軸也沒有刻度。 |
| 缺值／過期／載入 | 載入中「載入中…」（L129-132）。目錄查不到（RPC 錯誤或 UCS 沒有這顆）時 `catalog=null`，所有 Row 顯示「—」，沒有任何原因說明（L137-152）；有些 Row 缺值會隱藏（`operator`、`users`、質量、壽命），有些顯示「—」（國家、用途、日期、場地、火箭、製造），規則不一致。TLE 歷史 RPC 錯誤時回 `[]`，畫面顯示「近 30 天 TLE 變化未達閾值，無顯著機動」（L171-174，錯誤偽裝成無事件，見 §3）。「已運作」跟著時間軸（`timelineSec`，L41, L152），但 30 天歷史以真實現在為準（L48）。預測區只在 `muDays>0` 時出現。 |
| 按鈕 | 只有關閉鈕。`onOpenCompare` prop 有傳入（`SatelliteConsole.tsx:150`），但元件沒有解構也沒有使用（L36）。 |
| 共用 vs 手刻 | `Section`／`Row`（L242-268）是檔內私有元件；`Row` 標籤寬 70、`textDim`（§5.2 Row 標籤規定 `textMuted`、minWidth 56），而且沒有 §5.2 的 null 不渲染行為。沒用 `featureInfo/shared.tsx` 的 `Row`／`SourceFooter`。 |

### 1.4 地圖 popup：`src/components/featureInfo/satellitePanels.tsx` `SatellitePanel`（25 行）

| 欄位 | 現況（行號） |
|---|---|
| 接線 | `src/map/gisClickRegistry.ts:370` `{ layers: ["sat-current-point"], type: "satellite" }` → `src/components/featureInfo/registry.tsx:328` `satellite: SatellitePanel`、標籤 `registry.tsx:825` `satellite: "衛星"` → `src/components/FeatureInfoPanel.tsx` 停靠 popup 殼（§5.2）。 |
| 殼 | 走 `FeatureInfoPanel`：§5.2 容器、eyebrow、`<X/>`、中央 `SourceFooter` 都符合規格版本，**是現行規格的軌道**。 |
| 標題 | 自己手寫 `<div>` 13px 700，文字色用資料色（L16）；沒用 `shared.tsx:11` 的 `Title`（所以沒有色點、沒有底線），這正是 §5.2 禁止的「各 domain 檔自己複製 Title」。name 缺值時 fallback 成英文「Satellite」（L16）。 |
| Row | 用 `shared.tsx` `Row`（符合）。標籤「NORAD」是英文（L18），而且沒加 `mono`；「類別」值用資料色上色（L17），`SATELLITE_LABELS` 帶國旗 emoji 加英文家族名（`satelliteTypes.ts:44-61`）。 |
| 說明行 | 「足跡：內圈 50 km swath / 外圈 1,500 km elevation ≥10° cone」中英混雜（L21）。 |
| 來源 footer | `useSatellitesLayer.ts:339-345` 的 feature props 只有 `cat/norad/name/altKm/maneuver`，沒有 `source_org`／`source_url`；`satellite` 也不在 `FOOTER_SELF_MANAGED_LAYER_TYPES`（`FeatureInfoPanel.tsx:26-51`）。因此每次打開都會顯示 warn 色的「資料來源 · 來源資訊待補」。 |
| 手寫色 | fallback `"#888"`（L12）。 |
| 與 DetailCard 的關係 | 沒有重疊的程式碼，入口也不同：popup＝點地圖，內容是當下傳播出來的 props（類別、NORAD、高度）；DetailCard＝在 Console 清單點名稱，內容是 UCS 目錄＋30 天 TLE 歷史＋預測。兩者共同的資訊只有名稱、NORAD、類別／國家。popup 沒有入口可以開 DetailCard，DetailCard 也不會觸發 popup 或選取圈。符合現行規格殼的是 popup，DetailCard 是規格外的獨立面板。 |

### 1.5 範本：`src/components/intel/monitor/IsrSatellitePassCard.tsx`（§5.35「中國 ISR 衛星」I-A，668 行）

**新版（`useMonitorV2()` 為真，L370-480）用到的共用元件**：

| 元件／函式 | 檔案 | 用途 |
|---|---|---|
| 卡片殼、標題列 | `MonitorPanel.tsx` 統一畫框；標題與英文名在 `monitorCardMeta.ts:43` `isrSatellitePasses: { title: "中國 ISR 衛星過境", en: "ISR passes", fresh: { cadence: "days" } }` | §5.35 A1／C3 |
| `MonitorMetric`、`MonitorSub`、`MonitorNote` | `intel/monitor/MonitorMetric.tsx`（L46／L123／L142；同檔另有 `MonitorKpis` L96、`MonitorRows` L164、`toneColorFor` L29） | 主數字（`muted` 降灰）／副資訊／卡底一行 |
| `HazardTrendBars`（`heightTier="std"`、`levelColors`、`unit`、`caption`、`footer`） | `intel/monitor/HazardTrendBars.tsx:86` | 標準柱（E3） |
| `MonitorDataStatus` | `intel/monitor/MonitorDataStatus.tsx:8` | 讀取中、更新中斷、無權限 |
| `useMonitorFreshness`（＋`judgeFreshness`） | `intel/monitor/monitorFreshness.ts:161`（`judgeFreshness` L83） | 新鮮度（G2）：`muted`、`reason`、`staleUntil` |
| `useMonitorTheme`（`theme.fill()`／`theme.text()`／`theme.p`） | `intel/monitor/monitorTheme.ts:111` | 暗／淡（H2、D2） |
| `MF`、`fs` | `intel/monitor/monitorFont.ts` | S13 字級 |
| `useMonitorV2` | `intel/monitor/monitorStyle` | 新舊版分支 |
| `useMonitorResource` | `hooks/useMonitorResource` | 輪詢與狀態 |
| `taipeiDateKeyFromMs` | `lib/taipeiDay` | 台灣日界 |
| 卡內純函式 | 同檔：`deriveIsrLatestDisplay`（L73）、`buildIsrPassBars`（L98）、`padIsrBarsToToday`（L125，過期時補灰樁到今天）、`selectIsrPassWindow`（L150）、`medianOfIsrPassCounts`（L165）、`deriveIsrPassThresholds`（L186）、`classifyIsrPassLevel`（L202）、`compareLatestToMedian`（L240） | 缺值不補 0 的狀態判斷 |
| 走勢折線（本卡未用，§5.35 指定的共用元件） | `src/components/TimeseriesSparkline.tsx` | E3 連續量 |
| Loader | `src/data/isrSatellitePassesLoader.ts`：`nonNegativeInt` 保留 null（L65-69）、`deriveIsrPassFreshness`（L96-110）、`parseIsrSatellitePassReport`（L128-179），檔頭明寫「絕不把異常資料默默變成 0」 | 缺值契約 |

**範本本身的殘留**（只列事實）：期間切換鈕文字「30D／90D／120D」用 `FONT_DATA`、`RADIUS.sm`，選中時字色是 `textStrong` 而非 `accent`（L418-430）；卡底「v1 YAOGAN／GAOFEN／JILIN 範圍，非全中國 ISR census」含英文家族名與 census（L474）；色階圖例是手寫 8×8 方塊（L466）；舊版分支的 `SectionLabel` 是「中國 ISR 衛星 · TERRITORIAL PASS MONITOR」（L485）。

**相關文件的已知問題**（`docs/features/isr-satellite-monitor/`）：README 明寫「本功能不是地圖圖層」，只做 Monitor 卡，跟衛星情報 Console 沒有關係。backlog 中與 UI 有關的只有 **ISR-MON-4**：`twmain_12nm` 涵蓋哪些附屬島嶼尚未決定，決定後要「固化 region registry 與 UI 中文標籤」。ISR-MON-3（`registry_reviewed_at` 逾期規格）與 ISR-MON-5（collector heartbeat）屬於資料健康。loader 已保留 `registryReviewedAt`，但卡片沒有顯示。文件裡沒有任何 Console 面板（變軌／百科卡／對比彈窗）的 UI 待辦。

---

## 2. 現況 vs 規格差異總表

| 項目 | 現況 | 規格條文 | 可沿用範本 | 位置 |
|---|---|---|---|---|
| 淡色主題 | 三個元件都只有暗色（靜態 `COLORS`） | §3.9 唯一淡色色票、§5.35 H2 | `useMonitorTheme`（`monitorTheme.ts`）、`intel/intelTheme.tsx` `LIGHT_INTEL`、`useFeatureTheme` | `satelliteConsoleTokens.ts:6-14` |
| 彈窗底色 | `COLORS.panelBg` = `SURFACE.panel` 0.52 | §3.1 模態用 `SURFACE.solid`；panel「新面板不要用」 | `InfoModal.tsx`／`ShareModal.tsx` | `ManeuverCompareModal.tsx:323` |
| 彈窗層級 | 100（已登記為未歸層） | §5.25 `Z_INDEX.modal` 40；§10.3 | `Z_INDEX.modal` | `ManeuverCompareModal.tsx:312` |
| 百科卡層級 | 35（已登記為未歸層） | §5.25 `floatingPanel` 20 | `Z_INDEX.floatingPanel` | `SatelliteDetailCard.tsx:91` |
| Console 層級 | 30（已登記為未歸層） | §5.25、§5.26 | 同上 | `SatelliteConsole.tsx:77` |
| 彈窗標頭 | padding 12/16、沒有 eyebrow、關閉鈕 28×28、沒有 aria-label | §5.27＋§5.1 H2：10/14、eyebrow、24×24、`aria-label="關閉{標題}"` | `sidebar/PanelHeader.tsx`、`InfoModal.tsx` | `ManeuverCompareModal.tsx:330-362` |
| 彈窗尺寸與手機 | 寬 760、SVG 寫死 320×260 不縮、沒有手機分支 | §5.27 桌機 `min(…,92vw)`、手機 100vw×92vh；§5.35「不寫死圖寬 px」 | `InfoModal.tsx` | `ManeuverCompareModal.tsx:149,322,379-382` |
| 百科卡標頭 | 手刻、沒有 eyebrow、padding 11/14/9、`aria-label="close"` | §5.1 H2 | `PanelHeader.tsx` | `SatelliteDetailCard.tsx:102-126` |
| 百科卡位置 | `left: 64+412+8` 寫死 | §5.1 位置用 `LAYOUT` | `LAYOUT.leftDockTop`、`PANEL_WIDTH` | `SatelliteDetailCard.tsx:82` |
| 字級半級 | 11.5／10.5／9.5，字重 800 | §3.13 7 階（半級要 round）、§3.14 400/600/700 | `FONT_SIZE.*` | Alert L77,L107；Detail L172,L182,L185,L210,L224；Modal L203,L431 |
| 等寬中文 | 約 18 處 `FONT_DATA` 包中文（Alert 4、Modal 10、Detail 4）；guard 只記 1 | §4.1 規則 1-2、§7 | 混排寫法 `更新 <span FONT_DATA>{n}</span>` | 見 §1.1–1.3 字型欄 |
| 英文大寫標籤 | BEFORE／AFTER／OVERHEAD PASSES／CN／INTL／TW／PLANE／ALT／SHAPE，加 letterSpacing 1.5–2px | §6.1、§5.1「英文大寫 eyebrow」禁止、§7 | 中文 eyebrow；`MANEUVER_TOKEN.zh` 已有中文 | Alert L118-122,L289；Modal L203,L380-381,L419-422,L452；Detail L186,L248 |
| 內部代碼外露 | `cn_group` 進 `title`；`reference.satellite_catalog`、`realtime.satellite_tle_history`、`tle_history`、`prev/curr TLE`、`epoch`；`MANEUVER_TOKEN.label="PLANE_CHANGE"` | §6.3 不印內部識別碼；§5.35 禁印內部欄名 | `SourceFooter`（人類可讀機關） | Alert L240；Detail L225,L233；Modal L367,L371；tokens L21 |
| NORAD／COSPAR 欄名 | 主要文字中直接顯示「NORAD」「COSPAR」 | §6.1 英文代碼只在必要時用小字附註 | — | Detail L111,L114；Modal L348；popup `satellitePanels.tsx:18` |
| 手寫色 | 嚴重度、按鈕、bbox、軌跡、預測區等數十處 hex／rgba | §7「寫死 hex／rgba」；§3.16 資料色放圖層或資料常數 | `COLORS.*`／`CONTROL.*`／`BORDER.*`；資料色移到 `satelliteTypes.ts` | 見各節手寫色欄 |
| 嚴重度與警示色 | 紅 `#ef4444`／橘 `#f97316`／灰；「影響 TW」與 INTL 計數用綠 `#22c55e`（§3.5 的「正常／即時」語意） | §3.5 STATUS 語意、§3.15 同一語意同色 | `COLORS.statusErr/Warn`；監看 `toneColorFor` | Alert L35-37,L120,L355-357 |
| 按鈕 | 高度不固定、字重 400、底透明、自訂主要色 `#cfe4ff`、沒有 hover／focus | §5.7 C2：高 26、11/500、`CONTROL.bg`、主要＝`accentFaint`＋`accent`、`:focus-visible` | `toolbar/ToolbarButton.tsx`、`.lpc-btn`（`layerParamControls.css`） | Alert L306-327,L381-394 |
| 三角字元 | 「▸ 展開／▾ 收合」 | §7 `▶▼` 要改 lucide（guard 規則沒涵蓋 ▸▾） | lucide `ChevronRight`／`ChevronDown` | Alert L177 |
| 可點擊的非 button | 衛星名是 `<span onClick>` | §5.7（focus、aria） | — | Alert L243-258 |
| 分段控制 | 三個元件都沒有；範本的 30D/90D/120D 是自訂鈕（`RADIUS.sm`、選中字 `textStrong`） | §5.8：選中 `accentFaint`＋`accent` 600、`aria-pressed` | `ModeToggle.tsx`、`ControlSegmented`／`.lpc-seg` | `IsrSatellitePassCard.tsx:414-432` |
| 圖表 | MiniMap SVG、PassBar、預測 bar 全部手刻 | §5.35 E3「不再手刻 SVG／CSS 柱」（明文只約束監看卡） | `HazardTrendBars.tsx`、`components/TimeseriesSparkline.tsx` | Modal L148-259,L447-468；Detail L214-223 |
| 行內圖例 | SevDot 手寫圓點；彈窗的綠／紅 bbox、橘／藍軌跡沒有圖例 | §5.32 legendKit 色票（明文約束地圖圖例）；§5.35 I-A「一行色塊圖例」 | `legend/legendKit.tsx` `SwatchDot`／`SwatchSquare`／`SwatchLine` | Alert L200-208；Modal L380-381 |
| popup 標題 | 手寫 div，沒有色點、沒有底線；fallback「Satellite」 | §5.2「各 domain 檔自己複製 Title」禁止 | `featureInfo/shared.tsx:11` `Title` | `satellitePanels.tsx:16` |
| popup 來源 | 每次都顯示「來源資訊待補」（warn） | §5.3 F2 | `SourceFooter`；`FOOTER_SELF_MANAGED_LAYER_TYPES` 或在 props 補來源 | `useSatellitesLayer.ts:339-345`、`FeatureInfoPanel.tsx:26-51` |
| popup 中英混雜 | 「swath」「elevation ≥10° cone」、類別帶 emoji 與英文 | §6.1 | — | `satellitePanels.tsx:21`、`satelliteTypes.ts:44-61` |
| 來源 footer（Console 與百科卡） | 面板底「UCS Database · Space-Track」FONT_DATA；百科卡 footnote 印 schema.表名；沒有資料時間 | §5.3 F2（機關 · 授權 · 抓取於） | `featureInfo/shared.tsx` `SourceFooter` | `SatelliteConsole.tsx:118-130`；Detail L232-234 |
| 狀態用字 | 「載入 TLE pair + 計算 7 天 ground track…」；錯誤用 warn 文案但混入表名 | §6.4（載入中…、走 loadingRegistry） | `MonitorDataStatus` 文案 | Modal L367,L371 |
| 缺值顯示 | 百科卡有些 Row 顯示「—」、有些隱藏；`Row` 標籤 `textDim`、寬 70 | §5.2 Row（null 不渲染、`textMuted`、minWidth 56）、§6.5 | `shared.tsx` `Row` | Detail L137-165,L261-268 |
| 新鮮度／資料時間 | 三個元件都沒有顯示 MV 刷新時間或過期狀態 | §5.35 狀態字表（延遲／過期／停更）、§5.3「抓取於」 | `useMonitorFreshness`、`monitorCardMeta.fresh` | Alert 全段；`satelliteManeuversLoader.ts:5` |
| 動畫 | 紅卡整張呼吸脈衝、彈窗沿用滑入動畫 | §5.35 G2「受影響用數值與圖的顏色表示，不改卡底」（明文只約束監看卡） | — | Alert L235；Modal L326 |
| 單位空白 | 「近 24h」「7d」「10 min」「μ = 3.2d」 | §6.2 字母單位前補半形空白 | `splitSliderLabel()` 規則 | Alert L84,L116；Modal L208,L393；Detail L211 |

---

## 3. 資料正確性風險

| # | 風險 | 事實 | 位置 |
|---|---|---|---|
| R1 | **錯誤偽裝成「正常／無事件」** | `fetchRecentManeuvers` 在 RPC error 或 `!supabaseConfigured` 時回 `[]`，面板因此顯示綠色「近 24h 無變軌偵測 · 監測中」；第一次 fetch 完成前也是同樣畫面。 | `satelliteManeuversLoader.ts:39,48-51` → `ManeuverAlertSection.tsx:68-88` |
| R2 | **錯誤偽裝成無機動** | `fetchTleHistory` 錯誤時回 `[]`，百科卡顯示「近 30 天 TLE 變化未達閾值，無顯著機動」。 | `satelliteHistoryLoader.ts:37-42` → `SatelliteDetailCard.tsx:171-174` |
| R3 | **失敗時永遠顯示「計算中」** | `useManeuverImpacts` 在 pair 缺失或 `countTwPasses` 回 null 時回 `impact:null`，不寫 cache、不放進 Map；`ImpactChip` 把 undefined 當「計算 TW 影響中…」，所以會一直卡在這個狀態。 | `hooks/useManeuverImpacts.ts:50,54,73-75` → `ManeuverAlertSection.tsx:336-347` |
| R4 | **null 變化量顯示成 0** | `formatManeuverDetail` 用 `?? 0`，delta 為 null 時顯示「傾角 +0.00°／週期 0.00 min」；`getManeuverSeverity` 同樣 `?? 0`，所以 null 一律歸到「例行」。 | `satelliteManeuversLoader.ts:66,70,74,93-95` |
| R5 | **null 參與相減產生假事件** | `deriveManeuverEvents` 把 `inclination/period_min/eccentricity` 的 null 當 0 相減（`?? 0`），只要一筆 TLE 缺某欄，就會算出很大的 delta，被判定為一次「變軌」。百科卡的歷史清單和預測都會吃到這個假事件。 | `satelliteHistoryLoader.ts:106-108` |
| R6 | **百分比是合成值** | 對比彈窗在前段 0 次、後段大於 0 次時，`pct` 被硬設為 100%；兩段都是 0 時顯示 0%「持平」。 | `ManeuverCompareModal.tsx:293-295` |
| R7 | **「變軌前 7 天」文案與計算不符** | `prevTrack`、`currTrack` 都從同一個 `eventMs`（變軌偵測時間）**往後**推 7 天，差別只在用舊 TLE 還是新 TLE。所以「BEFORE · 變軌前 7 天」實際上是「假設沒變軌，接下來 7 天」的反事實推算，不是事件發生前真實的 7 天。`useManeuverImpacts` 的「影響 TW (a→b)」也是同一個算法。 | `ManeuverCompareModal.tsx:276-278,380`；`useManeuverImpacts.ts:51-53` |
| R8 | **預測的信心值是公式，不是統計量** | `confidence = min(80, 30 + 5×間隔數)`，畫面寫「信心 N%」。「下次變軌約 X–Y 天內」直接取 μ±σ，沒有扣掉距離上一次事件已經過的天數；而且只要有兩筆事件就會產生預測（n=2 時只有 1 個間隔，σ=0）。 | `satelliteHistoryLoader.ts:151-175`；`SatelliteDetailCard.tsx:197-228` |
| R9 | **日期切法與註解不符（未驗證）** | 註解說 `date` 依台灣時區，實作是 `fetched_at.slice(0,10)`。如果 RPC 回傳的是 UTC ISO 字串，台灣 00:00–08:00 的事件會被歸到前一天。RPC 實際回傳格式這次沒有查（gis-platform 不在本次範圍）。 | `satelliteHistoryLoader.ts:87,126` |
| R10 | **時間基準不一致** | Console 有歷史模式（時間軸拉到過去時顯示橘框，`SatelliteConsole.tsx:34-35,71`），但變軌清單一律抓真實現在的近 24h，`formatRelTime` 也用 `Date.now()`。百科卡註解說「變軌歷史也以時間軸當下為基準」（L40），實際上 `fetchTleHistory(norad, 30)` 沒有帶時間錨點，只有「已運作」欄跟著時間軸。 | `SatelliteConsole.tsx:38-49`；`satelliteManeuversLoader.ts:108-117`；`SatelliteDetailCard.tsx:40-48` |
| R11 | **過期不提示** | MV 每 2h 刷新、前端快取 2 分鐘、每 30s 輪詢，但三個元件都沒有顯示資料時間、刷新時間或過期狀態；上游停更時畫面看起來跟正常一樣。（ISR 卡有 `useMonitorFreshness`＋`latestValidDay`＋`computedAt`。） | `satelliteManeuversLoader.ts:5,35-36`；`useSatelliteManeuvers.ts:23` |
| R12 | **不同失敗原因共用一句文案** | 對比彈窗把 RPC 錯誤、Supabase 未設定、TLE 未歸檔三種情況都顯示成「tle_history 找不到對應的 prev/curr TLE（epoch 可能尚未歸檔）」；TLE 解析失敗時則沒有任何文案，只剩空白小地圖。 | `satelliteHistoryLoader.ts:60,70-73`；`ManeuverCompareModal.tsx:369-372,376,385` |
| R13 | **目錄缺失與錯誤無法區分** | `fetchBatch` 錯誤時回 `[]`，`fetchCatalog` 因此得到 null，跟「UCS 沒有這顆」顯示完全一樣（整張卡都是「—」），沒有原因說明。 | `satelliteCatalogLoader.ts:71-74`；`SatelliteDetailCard.tsx:136-165` |
| R14 | **國家分類有落差** | `CnGroup` 型別只列中國 6 群＋`TAIWAN`／`OTHER`（`satelliteManeuversLoader.ts:13-15`），但 Section 用 `INTL_GROUPS`（USA 等）計數；`CN_GROUP_TO_CATEGORY` 沒有對應的 group 會 fallback 到 `china_shiyan` 的顏色（`ManeuverAlertSection.tsx:223`）；只要 `country_operator` 與 group 都不符合，就不會被算進 CN/INTL/TW 任何一類（L49-51），所以三個數字加起來可能小於清單總數。 | 同左 |
| R15 | **內部欄名外露** | `cn_group` 代碼放在 tooltip（`title`）；`reference.satellite_catalog`、`realtime.satellite_tle_history`、`satellite_tle_history`、`tle_history`、`prev/curr`、`epoch` 直接印在主要文字裡。 | `ManeuverAlertSection.tsx:240`；`SatelliteDetailCard.tsx:225,233`；`ManeuverCompareModal.tsx:371` |
| R16 | **popup 每次都顯示「待補」** | 衛星點位的 props 沒有來源欄位，也不在豁免清單，所以停靠 popup 每次都出現 warn 色的「資料來源 · 來源資訊待補」。 | `useSatellitesLayer.ts:339-345`；`FeatureInfoPanel.tsx:26-51,141` |

對照：ISR 卡的 loader 與卡片已經處理好上述多數情況，可以作為缺值契約的參考：`nonNegativeInt` 保留 null、`freshness` 未知時自行推算、`deriveIsrLatestDisplay` 把 loading／error／empty／stale／incomplete 分開，`DISPLAY_LABEL` 一律加註「不以 0 代替」（`IsrSatellitePassCard.tsx:73-96,252-259`；`isrSatellitePassesLoader.ts:65-110`）。
