# 淺色主題推進計畫（Light Theme Rollout）

> 建立於 2026-07-07。記錄「選 Light 底圖時，UI chrome 跟著切淺色」這條線的**已完成範圍**與**剩餘待辦的確切改動點**。
> 本文只做規劃，不含實作。之後要動哪塊再依此文執行。

---

## 0. 機制與共用範式（已建立）

- **主題來源**：`App.tsx:434` `const isDarkTheme = !["light","streets"].includes(mapStyleId)`（由底圖樣式推導），以 prop 往下傳。
- **分發範式**：`createContext(DARK)` 預設深色 → 元件用 `<Provider palette={isDark?DARK:LIGHT}>` 包住自己 subtree → 子元件 `useXxxTheme()` 讀色。**未被 Provider 包住時 fallback 深色（向後相容）**。
  - 已用此範式：`IconRailSidebar`、`InfoModal`、`LegendPanel`、`featureInfo/featureTheme.tsx`。
- **鐵則**：只中性化 **chrome**（面板底 / 文字 / 邊框 / hover / 連結）；**accent 藍、狀態色（綠橘紅黃）、資料/類別/嚴重度色兩主題共用、不反轉**（因為多與地圖 layer/legend/popup 對齊）。低對比的資料色在白底靠「加深一階」或「補描邊」處理，不換整組調色盤。
- **淺色 chrome 標準色票**（沿用 `featureTheme.LIGHT_FEATURE`，全站一致）：
  | 語意 | 值 |
  |---|---|
  | textStrong | `#111827` |
  | textDefault | `#1F2937` |
  | textMuted | `#4B5563` |
  | textDim | `#6B7280` |
  | bgSubtle | `rgba(0,0,0,0.04)` |
  | bgStrong | `rgba(0,0,0,0.06)` |
  | border | `rgba(0,0,0,0.10)` |
  | link | `#0284C7` |

---

## 1. 已完成 ✅

| 區塊 | 檔案 | 手法 |
|---|---|---|
| 左側 IconRail + Layers/Locations 面板 | `IconRailSidebar.tsx` | palette + `useRailTheme()` context |
| 頂部標題 / 底圖選單 / 即時·歷史 / Capture / Monitor / AI / Info / 統計列 | `App.tsx`、`StyleSelector`、`ModeToggle`、`TimelineControls`、`HistoricalTimeline` | 既有 `isDarkTheme` prop（原本就有 light 分支）|
| Info 視窗 | `InfoModal.tsx` | palette + context |
| AI 助手（BYOK Chat） | `chat/ChatPanel.tsx` | `buildPalette(isDark)` |
| 頭像下拉選單 | `auth/UserAvatar.tsx` | 區域 `c` palette |
| 右下資料來源鈕 | `DataSourceBrowser.tsx` | inline ternary |
| 圖例面板外殼 + 57 個子圖例文字 | `LegendPanel.tsx` | `useLegendTheme()` context |
| 點擊資訊卡外殼 + 共用 Row/Badge/來源 footer + 22 個 domain 面板 | `FeatureInfoPanel.tsx`、`featureInfo/featureTheme.tsx`、`featureInfo/*Panels.tsx` | `useFeatureTheme()` context |
| 畜牧場點大小範圍 0.01–0.5（非主題，同批處理） | `useTransportParams.ts` | — |

**已知小殘留**（可讀、非隱形，低優先）：
- 圖例 3 行註腳小字用 `COLORS.textFaint`（`LegendPalette` 未含此 key），白底偏淡但可讀。
- feature 面板少數 cyan 連結（`#67e8f9` / `#22d3ee` / `#7ec4ff`）未轉 `link`，白底對比稍低。

---

## 2. 待辦 A：即時情報 IntelPanel

**檔案**（`src/components/intel/`，排除 `monitor/`）：
`IntelPanel.tsx`(654) · `IntelCard.tsx`(389) · `IntelFilters.tsx`(232) · `IntelHeader.tsx`(233) · `IntelReplay.tsx`(107) · `IntelSituation.tsx`(352) · `IntelIcon.tsx`(48, 純 SVG 免改)

### ⚠️ 共用元件坑（最重要）
`IntelCard` / `IntelFilters` / `IntelIcon` / `intelTokens.COLORS` **與 Monitor 看板共用**（`intelTokens` 被全部 11 個 monitor 檔 import；`IntelCard`/`IntelFilters` 被 `MonitorPanel` 直接 render）。
→ **絕不可直接改 `intelTokens.COLORS` 的 token 值**（會連 Monitor 一起變淺、破版）。
→ 正解：建 `IntelThemeContext`（照 `featureTheme.tsx` 抄），IntelPanel 套 Provider；**Monitor 端不套 Provider → 自動 fallback 深色**，共用的 IntelCard/IntelFilters 在 Monitor 維持深色、在 Intel 變淺。已驗證此範式可行。

### 要改的地方
1. **接線**：`App.tsx:1958` 給 `<IntelPanel>` 傳 `isDarkTheme`；IntelPanel 內建 Provider 包住自己 subtree。
2. **文字六階**（`COLORS.textStrong/Default/Muted/Dim/Faint` → `t.*`）：IntelCard / IntelFilters / IntelHeader / IntelReplay / IntelSituation / IntelPanel inline。
3. **邊框五階**（`panelBorder/borderSoft/borderMid/borderStrong` 全白半透 → `t.border` 系）：整批反轉。
4. **中性 chrome hardcode（~19 處，不受 token 控制，逐處改）**：
   - 卡底 `rgba(255,255,255,0.022)`、hover `rgba(255,255,255,0.04)`×6、tab inactive、SITUATION 底 `0.015`、replay 底 `rgba(0,0,0,0.3)`、popover `rgba(0,0,0,0.25)`、filter segment `rgba(0,0,0,0.4/0.45)`、dropdown option `#1a1c20`。
   - **`#0a0a14` spine dot 邊框**（IntelCard L77，時間軸挖洞用）→ 白底會變黑圈，改讀面板底色。
   - **時間軸漸層線**（`linear-gradient(borderMid, borderSoft, transparent)`，IntelPanel L491/539/599）→ 白色漸層白底全隱形，改深色漸層。
   - `#fff` 純白文字（IntelFilters active chip ×4、IntelSituation 熱區數字）、`#04121f` checkbox 內字。
5. **資料色（不反轉，僅補救 2 類）**：
   - GIS 分級 lv0/lv1、SEV lv0 用 `rgba(255,255,255,0.22/0.42)` 當「無值 fallback」→ 白底隱形，改中性灰。
   - tab active 藍 `#64aaff` 白底對比不足 → 加深 `#0284C7`（同 `link`）。
   - 類別色 / 群組色 / 嚴重度色（NEWS_CATEGORIES、ALERT_GROUPS_DEF、SEV_LEVELS）**保留不動**。

**工作量**：中。難點不在 token（改一次全生效）而在 6 檔內 ~19 處散落 inline chrome + spine dot + 漸層線。可比照已完成的 feature 面板，分批 subagent。

---

## 3. 待辦 B：衛星情報 SatelliteConsole

**檔案**（`src/components/satelliteConsole/`，8 檔）：
`SatelliteConsole.tsx`(174, 主殼) · `SatelliteConsoleHeader.tsx`(145) · `ManeuverAlertSection.tsx`(394, §A) · `CoverageStatsSection.tsx`(406, §D) · `CNGroupSection.tsx`(250, §B) · `TWFleetSection.tsx`(325, §C) · `SatelliteDetailCard.tsx`(276, §E 浮動卡) · `ManeuverCompareModal.tsx`(539, §F 真 modal)

### 共用/風險
- **可獨立改動**：8 檔沒有被 satelliteConsole 資料夾外 import，不會波及 intel/monitor（唯一跨資料夾是 header 借 `IntelIcon`，免改）。
- **`SATELLITE_COLORS`（`data/satelliteTypes.ts`）是共享資產**（loader/hook/legend/popup/地圖都用）→ **不可改**。淺色化只翻中性 chrome + 對低對比國別色（taiwan `#4fc3f7`、usa `#93c5fd`、germany `#fde047`、israel `#c4b5fd`、russia `#a8a29e`）在白底補描邊。

### 要改的地方
1. **接線**：`App.tsx:1949` 給 `<SatelliteConsole>` 傳 `isDarkTheme` + 建 context Provider（theme 線目前完全沒接進來）。
2. **文字五階 + 邊框五階**：同 Intel，整批 `COLORS.text*` / border → `t.*`。
3. **中性 chrome hardcode**（散在 6 個 section）：banner/折疊鈕/ImpactChip/timeline 展開/hover/研究 chip/卡底/mini-bar 軌…等 `rgba(255,255,255,0.02~0.10)`。
4. **§E 浮動卡**（`SatelliteDetailCard`）：卡底 `panelBg`、預測框 `rgba(100,170,255,0.08)`、mini bar、`#cfe4ff` 大數字。
5. **§F 真 modal（`ManeuverCompareModal`）＝ 最大難點**：
   - scrim `rgba(0,0,0,0.6)`（modal 遮罩，亮/暗是否都保留深遮罩需決策，建議保留或改 `rgba(0,0,0,0.35)`）。
   - **SVG MiniMap 全 hardcode inline**：底 `#0b0f14`（近黑）、經緯格線 `rgba(255,255,255,0.04)`、「不變」region `rgba(255,255,255,0.04)`+stroke `rgba(255,255,255,0.18)`、TW 中心白描邊 `"white"` → 白底全部消失，需逐一改寫 + 補 light 版。gained 綠 / lost 紅 / 軌道線 before 橘·after 藍屬資料色，保留。
6. **狀態/資料色保留**：MANEUVER_TOKEN、SEV_TOKEN（紅橘灰）、fleet 燈號、覆蓋率 `#4fc3f7` 大字（可加深）等。

**工作量**：中偏高。7 個 section 的 chrome 機械替換 + **§F SVG mini-map 是唯一需要真正重畫 light 版的地方**（近黑底 + 白格線 + 白描邊全在白底失效）。

---

## 4. 待辦 C：Monitor 看板（路線 B — 完整淺色化）

> 目前決定走**路線 A（Monitor 維持深色島，不動）**。以下是若改走路線 B 的完整拆解，供未來評估。

**檔案**（`src/components/intel/monitor/`，12 檔）：
`MonitorPanel.tsx`(主殼/dock/wall) · `TimelineDock.tsx`(24h 直方圖) · `IndicatorPanel.tsx`(右欄容器 + 熱區/breakdown/triage inline) · `SituationOverview.tsx` + `PressureRing.tsx`(戰情概覽 gauge + TwseTicker + 共用基元 Widget/SectionLabel/Sparkline) · `SituationCards.tsx`(PLA/Disease) · `PowerCard.tsx` + `powerCardData.ts`(能源) · `LiveWall.tsx`(YouTube 直播牆) · `HazardWatchStrip.tsx` · `PrisonCard.tsx` · `AirportPaxCard.tsx` · `alerts/AlertBoard.tsx` + `alerts/AlertsTrack.tsx`
＋共用 `intel/IntelCard.tsx`、`IntelFilters.tsx`（新聞 Feed 欄）。

### 分階段

**Phase 0 — 架構前置（必要）**
- Monitor 完全沒 theme 接線（0）。`App.tsx:1973` 給 `<MonitorPanel>` 傳 `isDarkTheme`，建 `MonitorThemeContext` 貫穿 ~12 子元件。
- 若同時要 Intel 也淺色：讓 IntelCard/IntelFilters 讀 IntelThemeContext（見待辦 A），Monitor 端**改成套自己的 Provider**（否則 Monitor 也想淺色時共用元件會 fallback 深色）。→ Intel 與 Monitor 的共用元件此時要一起想清楚 Provider 策略。

**Phase 1 — 表面層（工作量最大、~80% 是散落 inline）**
- 定義語意 surface token：`panelBg / cardBg / cardBgSubtle / hover / gridline / tintOverlay`（light/dark 各一）。
- 逐檔把 `rgba(255,255,255,0.012~0.06)`（卡底/hover/格線）換成上述 token。
- 面板底 `rgba(8,9,13,0.86)` → light `rgba(255,255,255,0.92)`；wall `rgba(6,7,11,0.97)` → light `rgba(248,249,251,0.98)`。
- 各卡漸層 tint `rgba(色,0.06)`（PLA 紅 / Power 綠 / Prison 紫 / Airport 藍…6+ 處）→ 白底看不出，需提高到 `rgba(色,0.10~0.12)`。

**Phase 2 — 資料視覺化色（需設計判斷）**
多數彩度夠可留，只處理白底消失/刺眼：
- gauge track `rgba(255,255,255,0.07)` → `rgba(0,0,0,0.08)`。
- GIS/SEV 前兩級白透明（0.22/0.42）→ 中性灰。
- 淡黃/淡綠：fuel 天然氣 `#F2D64B`/solar `#F2E085`/storage `#F2EBC4`、traffic/notice `#eab308`、lifeline `#a3e635` → 加深一階。
- `#fff` / `rgba(255,255,255,0.92)` 大數字 → `#111827`。
- ⚠️ **NEWS_CATEGORIES 同時用在地圖 circle-color**：改色要嘛同步地圖、要嘛只在 Monitor 面板端 override（建議後者，避免動地圖）。

**Phase 3 — 陰影/glow 收尾**
- `ELEVATION.dock` 及各處黑色 boxShadow/drop-shadow 在白底過重 → 減淡；彩色 glow 白底降級。

### 共用性摘要
- **文字/status/border 語意色高度集中在 `intelTokens.COLORS`** → 做成雙主題可一次覆蓋大量（但注意會同時影響 Intel，需一起規劃）。
- **表面層 ~80% hardcode inline** → 這是真正的工作量，逐檔走 surface token。

**工作量**：大（12 檔 + 共用基元 + 地圖類別色一致性）。建議獨立一輪、分批 subagent。

---

## 5. 決策點（留給之後）

1. **Intel / Satellite 要不要做？** 兩者獨立、風險可控（Satellite 唯一難點是 §F SVG mini-map）。Intel 要注意與 Monitor 共用元件的 Provider 策略。
2. **Monitor 走 A 還是 B？** 目前 A（深色島）。若改 B，Phase 0 要連 Intel 的共用元件 Provider 策略一起定。
3. **資料類別色（NEWS_CATEGORIES / SATELLITE_COLORS）在淺色是否調整？** 會牽動地圖一致性；預設「不動、只在面板端補救低對比色」。
4. **modal scrim**（Satellite §F、其他 modal）亮色底下要不要保留深遮罩？建議保留或略減淡。

## 6. 建議優先序
1. （已完成）圖層 popup / 圖例 / Info / AI / 頭像 — 最常看。
2. **即時情報 IntelPanel** — 常用、範式現成、中等工作量。
3. **衛星情報 SatelliteConsole** — 獨立、風險低（除 §F mini-map）。
4. **Monitor 路線 B** — 最大工程，建議最後且獨立評估；預設維持深色島。
