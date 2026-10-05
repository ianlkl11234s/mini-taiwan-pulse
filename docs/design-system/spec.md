最後更新：2026-09-29（對齊 master 至 #400）

# Mini Taiwan Pulse — Design System

> **UI 規範 SSOT**。新增或修改任何 UI（面板、popup、控制項、工具列、樣式表）前必讀；PR 前照 §8 checklist 逐項勾。資料夾入口：[`README.md`](./README.md)（檔案地圖、維護流程）；每輪決定：[`CHANGELOG.md`](./CHANGELOG.md)。
> 自動檢查：`src/styles/__tests__/designSystemGuard.test.ts`（§9）。視覺參考：**活的元件頁** `tools/design-system.html`（原始碼 `src/design-system/`；`npm run dev` 後開 `/tools/design-system.html`，直接 import 真正的元件與 token，暗／淡並排，數值與程式同步）；靜態快照 [`reference.html`](./reference.html)（`npm run design:snapshot` 產生，會落後程式，以活頁為準）。
> 決策來源：`docs/features/ui-consistency-audit-20260927/`（`handoff.md` §4a 五輪拍板、`proposal.md`、三份設計稿）。本檔寫的是**拍板後的最終規格與實際實作值**；兩者不一致時以本檔 §10「遷移狀態」誠實標示。

## 目錄

0. [怎麼用這份文件](#0-怎麼用這份文件)
1. [原則](#1-原則)
2. [SSOT 檔案](#2-ssot-檔案)
3. [Token 表](#3-token-表)
4. [字型](#4-字型)
5. [元件規格](#5-元件規格)
6. [文案規則](#6-文案規則)
7. [禁止事項總表](#7-禁止事項總表)
8. [新增 UI checklist](#8-新增-ui-checklist)
9. [自動檢查（guard）](#9-自動檢查guard)
10. [遷移狀態](#10-遷移狀態)
11. [未納入 token 的範圍與 KEEP OUT](#11-未納入-token-的範圍與-keep-out)
12. [相關文件](#12-相關文件)
13. [地圖圖層視覺規格](#13-地圖圖層視覺規格)

---

## 0. 怎麼用這份文件

| 你要做的事 | 先看 |
|---|---|
| 新面板／新 popup 內容 | §5.1、§5.2、§5.3、§6 |
| 新控制項（按鈕、滑桿、選單、開關） | §5.7–§5.16；圖層控制一律走 `layerParamsSpec.ts` 規格自動產生，不手寫 |
| 要一個顏色 | §3；找不到才考慮新增 token（TS 與 CSS 兩邊同時加，並補 §3 表格） |
| 淡色底圖要支援 | §3.9 `LIGHT`；**不得**另開一套淡色色票 |
| guard 測試紅燈 | §9；修程式碼，不要改基準 |
| 要決定元素疊在誰上面（z-index） | §5.25；不寫死數字 |
| 新的左側浮動面板 | §5.26 互斥清單 |
| 新的置中視窗／提示訊息 | §5.27、§5.25 |
| 調整地圖上的點／線／面數值、圖例樣式 | §13 → [`map-layers.md`](./map-layers.md) |

## 1. 原則

| 原則 | 說明 |
|---|---|
| **中文優先** | 使用者看得到的標籤、標題、按鈕、狀態一律中文。英文代碼只在必要時以小字附註（§6.1）。 |
| **系統字，不載 web font** | 只用各平台內建字：中文與一般文字 `--font-cjk`，數字／時間／座標／代碼 `--font-data`。不引用沒載入的字族名（Inter、JetBrains Mono、Georgia、宋體）——寫了等於白寫，還會讓 fallback 在不同機器解析成不同字（§4）。 |
| **Token 優先** | 顏色／字級／圓角／間距／陰影一律取 token：TS 從 `src/styles/designTokens.ts` import，CSS 用 `src/styles/tokens.css` 的 `var(--…)`。禁止在元件裡寫死 hex／rgba（例外見 §3.16、§4.2）。 |
| **不顯示內部識別碼** | `datasetId`、`warehouse:wh-8`、layer key 這類代號不直接給使用者看，先過人類可讀映射（§6.3）。 |
| **null 不當 0** | 缺值、過期、錯誤不轉成 0、「正常」或空字串冒充有值；`Row` 遇到 null／空值直接不渲染，統計缺值顯示「—」並保留原因（§6.5）。 |
| **暗／淡並行** | 每個元件都有暗色（預設）與淡色（淡色底圖 `light`／`streets`）兩套值；設計稿與參考頁一律並排驗證。淡色值只來自 `LIGHT`／`--light-*`。 |
| **不引入 CSS 框架、不抽通用元件庫** | 維持 inline style + token + 少量元件級 CSS。業務元件深耦合 Mapbox／timeStore，抽通用 `Button`/`Card` 反而 over-abstract；共用的是**規格**（本檔）與少數已存在的共用元件（`PanelHeader`、`Row`、`Title`、`SourceFooter`、`ToolbarButton`、`LayerParamControls`、`controls/Slider`）。 |
| **不放沒有功能的按鈕** | 不做「規劃中」「敬請期待」的占位按鈕（例：第二輪移除的 rail 設定鈕，按了只跳「設定功能規劃中」）。真的有功能時再加入口。 |
| **每階段獨立 PR** | 大改分 Phase，一個 Phase 一個 PR，可獨立 review／回退。 |

## 2. SSOT 檔案

| 檔案 | 角色 |
|---|---|
| `src/styles/designTokens.ts` | **TS token SSOT**：`SURFACE` `COLORS` `WHITE_ALPHA` `BORDER` `RADIUS` `FONT_SIZE` `FONT_WEIGHT` `ELEVATION` `SPACING` `CONTROL` `SLIDER` `LIGHT` `SELECTION_RING` `Z_INDEX` `LAYOUT` ＋ re-export `FONT_CJK` `FONT_DATA`（`LAYOUT` 只有 TS，無 CSS 變數） |
| `src/styles/tokens.css` | **CSS token SSOT**：與 TS 1:1 同值的 CSS 變數（`main.tsx`、`research/main.tsx`、`jev-layer-screening/main.tsx`、`card/main.tsx`（分析卡片頁 §5.34）、`design-system/main.tsx`（活的元件頁）全域載入） |
| `src/components/intel/intelTokens.ts` | 歷史 token（`COLORS` 原始定義、`FONT_CJK`/`FONT_DATA`、分級色、`chipTint`/`chipOutline`），被 designTokens **單向 re-export** |
| `src/components/sidebar/layerCatalog.ts` | `LAYER_COLORS`／主題與群組 SSOT（圖層資料色，§3.16） |
| `src/data/layerParamsSpec.ts` | 圖層控制項規格（標籤文字、滑桿範圍）→ 自動產生控制項 |
| `src/components/LegendPanel.tsx` `LEGEND_REGISTRY` | layer → 圖例 |
| `src/components/featureInfo/registry.tsx` `PANEL_REGISTRY` | layer → popup 內容 |
| `src/styles/__tests__/designSystemGuard*.{ts,json}` | 自動檢查規則、基準、TS↔CSS 同值測試（§9） |
| `src/map/mapStyleScale.ts` | 地圖圖層拍板數值 SSOT（點半徑、描邊、線寬、面透明度、缺值斜線、熱區、標籤、地圖中文字型；§13） |
| `src/map/pointTiers.ts`／`src/map/pointSpec.ts` | 點圖層分階（registry `POINT_TIERS`、hook `HOOK_POINT_TIERS`）與 registry 集中套用 `withPointSpec()`（§13） |
| `src/components/legend/legendKit.tsx` | 圖例共用元件與色票尺寸（§5.32） |
| `src/lib/loadingStatusController.ts` | 載入狀態條節奏 `LOADING_STATUS_TIMING`（§5.30） |
| `src/components/boot/bootSequence.ts` | 開站畫面規格與時間 `BOOT_TIMING`／`BOOT_LAYOUT`（§5.33） |
| `card.html`＋`src/card/main.tsx` | 分析卡片頁 `/card/<slug>` 入口（§5.34） |
| `tools/design-system.html`＋`src/design-system/` | 活的元件頁：直接畫真正的元件與 token（只展示，不是數值來源） |

**TS ↔ CSS 對應規則**：`SURFACE.x ↔ --surface-x`；`COLORS.textX ↔ --text-x`；`BORDER.x ↔ --border-x`；`CONTROL.camel ↔ --control-kebab`；`SLIDER.x ↔ --slider-x`；`LIGHT.camelCase ↔ --light-kebab-case`；`COLORS.link ↔ --link`；`COLORS.statusDerived ↔ --status-derived`；`Z_INDEX.camelCase ↔ --z-kebab-case`（`zIndex.test.ts` 強制同值與順序）。`LAYOUT` 只有 TS；CSS 端需要時寫同值並註明來源（目前 `research/mainMapConnection.css` 的 Agent 面板 `top: 60px; left: 64px`，改 `LAYOUT.leftDockTop` 要一起改）。`LIGHT`／`SLIDER`／`CONTROL`／`link`／`statusDerived`／`accent` 的兩邊同值由 guard 測試強制。

⚠️ `intelTokens.ts` **不可**改成 re-export from `designTokens`（designTokens 已 import 它，會 circular）。退役順序：(a) 常數搬進 designTokens → (b) intelTokens 改 re-export from designTokens → (c) import 全改完才刪。

## 3. Token 表

> 欄位：TS 名稱 ↔ CSS 變數 ↔ 暗色值 ↔ 用途。淡色值見 §3.9。

### 3.1 SURFACE — 面板背景

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `SURFACE.app` | `--surface-app` | `#0a0a14` | App 底（地圖底色、LoadingScreen） |
| `SURFACE.subtle` | `--surface-subtle` | `rgba(0,0,0,0.40)` | 窄 sidebar／浮動 overlay |
| `SURFACE.panel` | `--surface-panel` | `rgba(0,0,0,0.52)` | 次要浮層（AI 對話桌機底、研究頁地圖說明）；新面板不要用。Intel／衛星／圖例已改 `SURFACE.strong` |
| `SURFACE.strong` | `--surface-strong` | `rgba(10,10,20,0.88)` | 需高可讀性：停靠 popup、工具列底板、**所有左側停靠面板**（rail 面板、即時情報、衛星、地震回放）、圖例、時間軸、載入狀態條 |
| `SURFACE.solid` | `--surface-solid` | `rgba(10,10,20,0.94)` | 全屏／模態／LiveWall |

`SURFACE.*` **只給面板容器底**；按鈕、選單、分段等互動底色走 `CONTROL.*`（§3.6）。`COLORS.panelBg*` 是 legacy alias，不再新增使用。

### 3.2 TEXT — 文字階

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `COLORS.textStrong` | `--text-strong` | `#f3f4f6` | 標題、popup 數值、重點數據 |
| `COLORS.textDefault` | `--text-default` | `#d8dce3` | 預設正文 |
| `COLORS.textMuted` | `--text-muted` | `#9ca3af` | 標籤（Row label、控制項名稱）、次要資訊 |
| `COLORS.textDim` | `--text-dim` | `#6b7280` | eyebrow、footer、placeholder |
| `COLORS.textFaint` | `--text-faint` | `#4b5560` | 提示性說明 |
| `COLORS.textGhost` | `--text-ghost` | `#363b44` | 接近不可見的裝飾 |

### 3.3 BORDER／WHITE_ALPHA

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `BORDER.soft` | `--border-soft` | `rgba(255,255,255,0.06)` | popup Row 細線、footer 上緣 |
| `BORDER.panel` | `--border-panel` | `rgba(255,255,255,0.10)` | 面板外框、標頭底線 |
| `BORDER.mid` | `--border-mid` | `rgba(255,255,255,0.14)` | 時間軸左線、控制區左線、L2 群組細線 |
| `BORDER.strong` | `--border-strong` | `rgba(255,255,255,0.22)` | 強分隔 |
| `BORDER.accent` | `--border-accent` | `rgba(100,170,255,0.55)` | 強調框 |
| `WHITE_ALPHA[4…60]` | `--white-a4…a60` | `rgba(255,255,255,.04/.08/.12/.20/.40/.60)` | 裝飾（glow、軟分隔）；**文字色不用這組** |

### 3.4 ACCENT／LINK

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `COLORS.accent` | `--accent` | `#64aaff` | 互動、選中、focus、主要按鈕字與框 |
| `COLORS.accentSoft` | `--accent-soft` | `rgba(100,170,255,0.55)` | 強調邊框 |
| `COLORS.accentFaint` | `--accent-faint` | `rgba(100,170,255,0.16)` | 主要按鈕底、分段選中底 |
| `COLORS.link` | `--link` | `#7fb2ff` | 文字連結（資料來源面板、多選「全選／清除」） |

### 3.5 STATUS

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `COLORS.statusLive` | `--status-live` | `#22c55e` | 即時、正常、「已接上」 |
| `COLORS.statusWarn` | `--status-warn` | `#ff9800` | 警示、「待補」、「來源資訊待補」 |
| `COLORS.statusWarnSoft` | `--status-warn-soft` | `rgba(255,152,0,0.16)` | 警示淡底 |
| `COLORS.statusErr` | `--status-err` | `#ef4444` | 錯誤、失敗 |
| `COLORS.statusDerived` | `--status-derived` | `#a78bfa` | 「派生」（pulse_only）；暗／淡共用 |

### 3.6 CONTROL — 互動態背景（C2）

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `CONTROL.bg` | `--control-bg` | `rgba(255,255,255,0.06)` | 一般按鈕、分段、選單底 |
| `CONTROL.bgHover` | `--control-bg-hover` | `rgba(255,255,255,0.10)` | hover |
| `CONTROL.border` | `--control-border` | `rgba(255,255,255,0.12)` | 控制項框；開關關閉時的軌道 |
| `CONTROL.disabledOpacity` | `--control-disabled-opacity` | `0.55` | 停用 |
| `CONTROL.optionBg` | `--control-option-bg` | `#10101b` | 原生 `<select>` 展開選項底（不透明） |

### 3.7 SLIDER — S1 細滑桿

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `SLIDER.track` | `--slider-track` | `rgba(255,255,255,0.14)` | 2px 軌道（未拖段） |
| `SLIDER.fill` | `--slider-fill` | `rgba(255,255,255,0.55)` | 已拖段 |
| `SLIDER.thumb` | `--slider-thumb` | `#f3f4f6` | 10px 圓點 |

### 3.8 SELECTION_RING — R2 選取圈

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `SELECTION_RING.dark` | `--selection-ring-accent`（執行時由 `selectionRing.ts` 寫到地圖容器） | `#64aaff`（= `COLORS.accent`） | 暗色底圖 |
| `SELECTION_RING.light` | 同上 | `#0b6fd6`（= `LIGHT.accent`） | 淡色底圖 |

### 3.9 LIGHT — 淡色 chrome

全站**唯一**淡色色票。TS 依 `isDarkTheme` 選 palette；CSS 在子系統的淡色觸發 class 內把語意別名指到 `--light-*`（`.main-map-agent--light`、`.member-panel-light`、`.research-activity-position--light`、`.lpc-theme--light`）。

| TS | CSS | 值 | 對應暗色 |
|---|---|---|---|
| `LIGHT.surfacePanel` | `--light-surface-panel` | `rgba(255,255,255,0.95)` | `SURFACE.strong`（popup、工具列、面板） |
| `LIGHT.surfaceStrong` | `--light-surface-strong` | `rgba(255,255,255,0.97)` | 更高可讀性底 |
| `LIGHT.surfaceSolid` | `--light-surface-solid` | `#ffffff` | 選單彈出層、`<select>` 選項底 |
| `LIGHT.textStrong` | `--light-text-strong` | `#111827` | `textStrong` |
| `LIGHT.textDefault` | `--light-text-default` | `#1f2937` | `textDefault` |
| `LIGHT.textMuted` | `--light-text-muted` | `#4b5563` | `textMuted` |
| `LIGHT.textDim` | `--light-text-dim` | `#6b7280` | `textDim` |
| `LIGHT.fillSubtle` | `--light-fill-subtle` | `rgba(0,0,0,0.04)` | popup 中性淺底 |
| `LIGHT.fillStrong` | `--light-fill-strong` | `rgba(0,0,0,0.06)` | popup 中性較實底／badge off |
| `LIGHT.borderSoft` | `--light-border-soft` | `rgba(0,0,0,0.06)` | `BORDER.soft` |
| `LIGHT.border` | `--light-border` | `rgba(0,0,0,0.10)` | `BORDER.panel` |
| `LIGHT.borderMid` | `--light-border-mid` | `rgba(0,0,0,0.16)` | `BORDER.mid` |
| `LIGHT.borderStrong` | `--light-border-strong` | `rgba(0,0,0,0.22)` | `BORDER.strong`（Phase L 新增，即時情報選中 chip 強分隔框） |
| `LIGHT.controlBg` | `--light-control-bg` | `rgba(0,0,0,0.035)` | `CONTROL.bg` |
| `LIGHT.controlBgHover` | `--light-control-bg-hover` | `rgba(0,0,0,0.08)` | `CONTROL.bgHover` |
| `LIGHT.controlBorder` | `--light-control-border` | `rgba(0,0,0,0.14)` | `CONTROL.border` |
| `LIGHT.accent` | `--light-accent` | `#0b6fd6` | `COLORS.accent` |
| `LIGHT.accentFaint` | `--light-accent-faint` | `rgba(11,111,214,0.10)` | `COLORS.accentFaint` |
| `LIGHT.link` | `--light-link` | `#0284c7` | `COLORS.link` |
| `LIGHT.statusLive` | `--light-status-live` | `#15803d` | `statusLive` |
| `LIGHT.statusWarn` | `--light-status-warn` | `#c2410c` | `statusWarn` |
| `LIGHT.statusErr` | `--light-status-err` | `#b42318` | `statusErr` |
| `LIGHT.sliderTrack` | `--light-slider-track` | `rgba(0,0,0,0.12)` | `SLIDER.track` |
| `LIGHT.sliderFill` | `--light-slider-fill` | `rgba(0,0,0,0.45)` | `SLIDER.fill` |
| `LIGHT.sliderThumb` | `--light-slider-thumb` | `#111827` | `SLIDER.thumb` |
| `LIGHT.elevationLg` | `--light-elevation-lg` | `0 12px 40px rgba(0,0,0,0.18)` | `ELEVATION.lg` |

目前取用 `LIGHT` 的消費端：`toolbar/toolbarTheme.ts`、`sidebar/DataSourcePanel.tsx`（`LIGHT_DS`）、`featureInfo/featureTheme.tsx`（`LIGHT_FEATURE`）、`FeatureInfoPanel.tsx`、`sidebar/layerParamControls.css`（`--lpc-*`）、`map/selectionRing.ts`、`intel/intelTheme.tsx`（`LIGHT_INTEL`，Phase L）、`legend/legendKit.tsx`（`LIGHT_LEGEND`）、`loadingStatus.css`、`boot/bootScreen.css`、`timeline/timeline.css`（`.tl3--light`）以及各子系統 CSS 的 `--light-*`。尚未收斂者列在 §10.3。

### 3.10 RADIUS

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `RADIUS.sm` | `--radius-sm` | `2` | tag、checkbox |
| `RADIUS.md` | `--radius-md` | `4` | **按鈕、選單、分段預設**、badge |
| `RADIUS.lg` | `--radius-lg` | `6` | 面板內卡片 |
| `RADIUS.xl` | `--radius-xl` | `8` | 面板／popup 外框、下拉彈出層 |
| `RADIUS.pill` | `--radius-pill` | `9999` | pill、開關軌道 |
| `RADIUS.full` | `--radius-full` | `"50%"` | 圓點、圓鈕 |

收斂：`3 → md`、`5/7 → lg`、`9/10 → xl`。例外：工具列底板實作為 `7`（T2 拍板值）、分段內按鈕 `3`（在 4px 外框內留 1px）。12／16／24px 罕用值保留 inline。

### 3.11 SPACING

| TS | CSS | 值 |
|---|---|---|
| `SPACING.xxs/xs/sm/md/lg/xl/xxl` | `--space-xxs…xxl` | `2 / 4 / 6 / 8 / 12 / 16 / 24` |

面板 padding 慣例：標頭 `10px 14px`、popup `12px 14px`、控制區左線內縮 `10px`。`"1px 6px"` 這類 pill padding 保留 inline。

### 3.12 ELEVATION

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `ELEVATION.sm` | `--elevation-sm` | `0 6px 20px rgba(0,0,0,0.50)` | 貼地控件（TimelineDock） |
| `ELEVATION.md` | `--elevation-md` | `0 8px 32px rgba(0,0,0,0.55)` | overlay、LiveWall |
| `ELEVATION.lg` | `--elevation-lg` | `0 12px 40px rgba(0,0,0,0.45)` | 主面板、工具列、下拉彈出層 |
| `ELEVATION.dock` | `--elevation-dock` | `0 -16px 50px rgba(0,0,0,0.50)` | 由下往上（MonitorPanel） |

### 3.13 FONT_SIZE — 字級 7 階

| TS | CSS | px | 用途 |
|---|---|---|---|
| `FONT_SIZE.xs` | `--font-xs` | 9 | eyebrow、footer、pill |
| `FONT_SIZE.sm` | `--font-sm` | 10 | Row 標籤、控制項標籤／數值、L2 群組標題 |
| `FONT_SIZE.base` | `--font-base` | 11 | **預設正文**、popup Row 值、按鈕字 |
| `FONT_SIZE.md` | `--font-md` | 12 | 強調副資訊 |
| `FONT_SIZE.lg` | `--font-lg` | 13 | 面板標題（H2）、popup Title |
| `FONT_SIZE.xl` | `--font-xl` | 18 | 卡片大標 |
| `FONT_SIZE.xxl` | `--font-xxl` | 22 | 大型面板標頭 |

設計稿中的半級（9.5／10.5／11.5／12.5px）只出現在參考稿，實作就近 round 到上表。品牌字標 20／28px、研究頁大數字 29px 等一次性大字保留 inline（§4.2）。

**字級刻意例外**（拍板值，不 round）：

| 位置 | 值 | 理由 |
|---|---|---|
| Layers 大分類標題（§5.5） | 9.5px | 第二輪 LT1：刻意小於 L2 群組標題（10px），大分類只當分段提示，不搶主題列 |
| 說明視窗 `kbd`（§5.27） | 9.5px `FONT_DATA` 600 | 按鍵標籤嵌在 11px 正文裡，需略小 |
| 分享欄位值（§5.27） | 10.5px `FONT_DATA` | 網址／HTML 長字串，10px 太擠、11px 換行過多 |
| 左下時間軸刻度／時間（§5.24） | 9.5px／15px | TC1／TC3 設計稿值 |

### 3.14 FONT_WEIGHT

`regular 400`／`semibold 600`／`bold 700`（CSS `--font-weight-*`）。按鈕字 500 為 C2 規格值（inline）。

### 3.15 災害／警示語意色

以 `LAYER_COLORS`（地圖色）為基準，`ALERT_GROUPS_DEF`（警示卡）對齊：同一語意在地圖、警示列、popup 同色。

| 語意 | 色 |
|---|---|
| earthquake | `#ff3b30` |
| flood／water | `#ef4444` |
| fire | `#ff5722` |
| weather／transit／lifeline | `#38bdf8`／`#fb923c`／`#a3e635`（無 layer 對應，沿用） |

### 3.16 例外：資料色不進 token

下列是**資料語意色**，刻意不收進 chrome token（改色會改變資料意義）：

- `LAYER_COLORS[layerKey]`（`layerCatalog.ts`，`layerConsistency` 測試保護）與 overlay paint 色。
- 分級色 `GIS_LEVELS`／`SEV_LEVELS`／`PRESSURE_LEVELS`（`intelTokens.ts`）。
- 分析結果色階：`research/analysisResultOverlay.ts` 的 `COUNT_COLORS`／`NUMERIC_COLORS`，以及 `mainMapConnection.css` `.agent-analysis-swatch--count` 的同組漸層（guard `hex-literal-in-ui-css` 基準內的 3 筆即此處）。
- 底圖縮圖漸層（`toolbar/BasemapMenu.tsx` `GRADIENT`）、使用者頭像漸層。
- aurora／極光等特效色、Three.js scene 內的材質色。

新增資料色時放在該圖層或資料檔的常數，不要塞進 `designTokens.ts`；UI chrome（面板、按鈕、文字、邊框）則一律用 token。

## 4. 字型

### 4.1 字型角色

| 角色 | TS | CSS | Stack | 用在 |
|---|---|---|---|---|
| 正文 | `FONT_CJK` | `--font-cjk` | `"PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", system-ui, sans-serif` | **所有中文**與一般文字：標籤、標題、按鈕、面板與 popup 容器、eyebrow |
| 數據 | `FONT_DATA` | `--font-data` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | **只給**數字、時間、座標、代碼、數量；配 `font-variant-numeric: tabular-nums` |

規則：

1. 容器（面板、popup、卡片）設 `FONT_CJK`；`FONT_DATA` 只包在**只含數字／代碼**的最小節點上。混排寫法：`更新 <span style={{ fontFamily: FONT_DATA }}>{time}</span>`。
2. `FONT_DATA` 節點的直接文字不得含中文（guard `font-data-on-cjk`）。
3. 所有文字節點都要能繼承到字型：新的根容器（portal、`document.createElement` 的 DOM、獨立頁）必須明確設 `fontFamily: FONT_CJK`／`font-family: var(--font-cjk)`，否則瀏覽器預設會落到襯線字。
4. 不載入 web font；stack 裡只能出現系統內建字（guard `web-font`）。

### 4.2 刻意例外

| 例外 | 值 | 位置 | 理由 |
|---|---|---|---|
| 品牌字標「Mini Taiwan Pulse」 | `FONT_DATA`、700、20px、letterSpacing 2；拍攝模式大標 28px（手機 20px）、letterSpacing 4 | `App.tsx` 左上 `<h1>`、拍攝模式標題區 | 第四輪拍板：品牌識別維持等寬粗體；英文字標非中文，不違反 §4.1 精神。與右側工具列（高 26）垂直置中。 |
| 來源 footer 第二行（授權＋「抓取於 …」） | `FONT_DATA` 整行 | `featureInfo/shared.tsx` `SourceFooter` | 第三輪拍板 F2 字面指定「第二行授權＋抓取時間（等寬）」，比 §4.1 一般規則更晚、更具體；guard 啟發式因跨行不會命中。 |
| 座標 HUD | `FONT_DATA` 整行（含「仰角」「方位」中文） | `App.tsx` `CameraHud` | 第四輪拍板字面：「25.0464, 121.5318 · z12.5 · 仰角 0° · 方位 0°」整行等寬對齊；中文只佔兩個短詞。新 HUD 不比照。 |
| 資料分級色、分析色階、aurora 等特效色 | hex 字面 | 見 §3.16 | 資料語意色，不是 UI chrome。 |
| 研究頁一次性大數字 | 29px 等 | `research/research.css` | 單次使用，不進 7 階。 |

## 5. 元件規格

> 每個元件：**用途 → 結構 → 尺寸 → 暗／淡 → 狀態 → 禁止 → 實作檔**。視覺見參考頁同名區塊。

### 5.1 面板外殼＋H2 標頭

- **用途**：左側 rail 浮動面板（Layers、資料來源…）、與 Agent 協作面板、即時情報、會員專區。
- **結構**：外殼 → H2 標頭（eyebrow ＋ 標題 ＋ 關閉鈕）→ 內容（捲動區）。
- **外殼**：底 `SURFACE.strong`、`1px BORDER.panel`、`RADIUS.xl`、`ELEVATION.lg`、`font-family: --font-cjk`。
- **位置**：左側停靠面板（rail 面板、即時情報、衛星、地震回放、Agent）一律 `left: 64`、上緣 `LAYOUT.leftDockTop`（60）＝對齊 rail 第一條分隔線，剛好在左上座標列（底 58）下方。rail 本體底色 `SURFACE.app`，與時間軸、面板同一個藍黑色系；不再用中性黑 `#0D0E10`／`rgba(0,0,0,0.45)`（2026-09-29 修正：Layers 面板原本比時間軸淡）。rail 寬 56＋間距 8＝64。CSS 端（Agent 面板 `research/mainMapConnection.css`）暫以字面 `top: 60px; left: 64px` 對齊，改 `LAYOUT.leftDockTop` 要一起改。
- **H2 標頭**：padding `10px 14px`；eyebrow 9px `--text-dim`、letterSpacing 1.4px、中文（例「資料」「研究」）；標題 13px bold `--text-strong`、上距 1px；底線 `1px --border-panel`；關閉鈕 24×24、`<X size={14}/>`、透明底、`--text-muted`，`aria-label="關閉{標題}"`。
- **淡色**：底 `LIGHT.surfacePanel`、框 `LIGHT.border`、字 `LIGHT.textStrong`／`textDim`。
- **禁止**：自己手刻標頭；英文大寫 eyebrow；純文字「×」關閉鈕；標頭用等寬字。
- **實作**：`src/components/sidebar/PanelHeader.tsx`（傳 `eyebrow` 即走 H2；不傳 eyebrow 的舊分支第二輪已改 `FONT_CJK`，視覺仍是舊版標頭）。
- **圖層面板（2026-10-03 面板統一 A 段）**：桌機 rail 四個入口（台灣 Taiwan／統計 Statistics／世界 World／日本 Japan）與手機底部面板是**同一個元件** `sidebar/LayersPanel.tsx`，入口定義只有一份 `sidebar/layerPanels.ts` `LAYER_PANELS`（主題清單、大分類、「全部關閉」範圍、統計單一／可重疊）。面板頂部：「全部關閉」→ 搜尋 →（統計）單一／可重疊。桌機有 PanelHeader；手機改用四個分頁（順序同 rail：台灣／統計／世界／日本），分頁下是「我的」。色票 `sidebar/railTheme.ts`（`railPalette(isDarkTheme)`＋`RailThemeContext`），面板外的清單要用共用列也從這裡包 Provider。手機面板與外殼 `MobileBottomSheet` 跟隨底圖主題（2026-10-03 收尾修正；暗色底 `rgba(0,0,0,0.7)` 維持，淡色 `LIGHT.surfaceStrong`＋上緣 `LIGHT.border`），抽屜內的底圖選單、地名開關、地點跳轉同樣吃 `isDarkTheme`，不得寫死 `isDarkTheme={true}`。
- **搜尋（P9）**：各入口只搜自己的主題；結果列就是一般圖層列（可直接開關、收藏星號、可展開），名稱下一行小字「主題・群組」；結果末尾列出其他入口的相符筆數（例「日本還有 3 筆相符」），點了切到該入口並帶入關鍵字。

### 5.2 停靠 popup（B 版「細線緊湊」）

- **用途**：點地圖圖徵／Agent 分析結果後的資訊面板。**全部停靠右下**，不用 `mapboxgl.Popup` 錨定、無尖角；點擊處另畫選取圈（§5.4）。
- **結構**：eyebrow「主題 · 圖層」→ Title（色點＋名稱）→ Row 列表 → SourceFooter（§5.3）。
- **容器**：寬 280px（CCTV 460px）、`maxWidth 92vw`、`maxHeight 80vh`；底 `SURFACE.strong`、`backdrop-filter: blur(14px)`、框 `rgba(100,170,255,0.25)`（淡 `LIGHT.border`）、`RADIUS.xl`、padding `12px 14px`、`FONT_CJK`；右上關閉鈕 `<X size={14}/>`。
- **Eyebrow**：9px `textDim`、letterSpacing 1.2、下距 6；文字「主題中文名 · 圖層名」（例「宗教 · 寺廟」），對不到主題時只顯示圖層名；中文、不轉大寫。
- **Title**：13px bold `textStrong`；前置 9px 分類色點（`RADIUS.full`、`flexShrink 0`）、gap 6；底線 `1px palette.border`、paddingBottom 5、marginBottom 4。
- **Row**：11px、line-height 1.3、padding `3px 0`、gap 8；標籤 10px `textMuted`、minWidth 56；值 `textStrong`，純數字加 `mono`（`FONT_DATA`＋tabular-nums）；相鄰兩列之間 `1px --fi-border-soft` 細線（最後一列不畫，由 `.fi-row + .fi-row` 實現）。列高約 21px。
- **暗／淡**：`DARK_FEATURE`／`LIGHT_FEATURE`（`featureTheme.tsx`），子面板用 `useFeatureTheme()` 讀，不自行判斷主題。
- **狀態**：值為 null／空字串／"null" → Row 不渲染（不顯示 0 或「—」冒充）。
- **禁止**：整個 popup 容器套 `FONT_DATA`；各 domain 檔自己複製 Title；印內部 id（§6.3）；在 popup 內另開圖例色塊（圖例走 `LEGEND_REGISTRY`）。
- **實作**：`src/components/FeatureInfoPanel.tsx`、`src/components/featureInfo/{shared.tsx,featureTheme.tsx,featureInfo.css}`。

### 5.3 來源 footer（F2）

- **結構**：上緣 `1px borderSoft`、marginTop 10、paddingTop 8、9px `textDim`。
  - 第一行：`機關 · Tier N · 原始下載頁 ↗`（任一項缺就省略，不留孤立「·」；連結色 `palette.link`）。
  - 第二行：`授權 · 抓取於 …`，`FONT_DATA`（§4.2 例外）。
  - `_provenance`／`provenance` 超過 1 筆時 `<details>` 收合「溯源 N 筆」。
  - 無 `source_org` 也無 `source_url`：整段只顯示「資料來源 · 來源資訊待補」，`warn` 色（暗 `#ff9800`／淡 `#c2410c`）。
- **掛載**：`FeatureInfoPanel` 在內容後統一掛一次；**排除清單** `FOOTER_SELF_MANAGED_LAYER_TYPES`：`chatHighlight`（非資料圖層）、`publicToilet`／`disasterShelters`／`nationalParks`（panel 端補來源常數）、`networkStructuresPanels.tsx` 全部 9 個 panel（`source_name` schema 不同）；水庫 context 彙整視圖不掛；`analysisResult` 自帶「暫時分析結果 · 非完整來源圖層」footer。
- **禁止**：panel 內再自己畫「來源機關」「原始資料 ↗」造成重複；沒有來源時整段省略。
- **實作**：`src/components/featureInfo/shared.tsx` `SourceFooter`、`FeatureInfoPanel.tsx`。

### 5.4 選取圈（R2 呼吸脈衝）

- **用途**：popup 停靠右下後，標示「點的是哪裡」。全站圖層共用，同時只有一個。
- **結構**：`mapboxgl.Marker` 0×0 錨點 ＋ 實線圈 ＋ 脈衝圈。
- **尺寸**：實線圈 24px、`2px solid accent`；脈衝圈由 24px 擴散到 58px、opacity .8 → 0、1.8s ease-out 無限循環。
- **暗／淡**：accent `SELECTION_RING.dark`（`#64aaff`）／`.light`（`#0b6fd6`），寫入地圖容器 `--selection-ring-accent`。
- **狀態**：`prefers-reduced-motion` → 無動畫，靜態 36px、opacity .35 淡圈；popup 關閉即移除；位置優先 `featureInfo.coords`，否則用 10 秒內最後一次地圖點擊。
- **禁止**：各圖層自己畫高亮圈；不跟 popup 生命週期走。
- **實作**：`src/map/selectionRing.{ts,css}`（位置、色、掛載 hook `useSelectionRing`）、`App.tsx`（記錄點擊）。

### 5.5 Layers 主題列、大分類與 L2 群組標題

三層由大到小：**大分類**（例「移動與城市」）→ **主題列**（例「交通 Move」，可收合、有總開關）→ **L2 群組**（例「點位」）。

**主題列（LT1，第二輪拍板）**

- **資料**（2026-10-03 B 段）：`theme.title` 是識別字串（manifest `section.theme`、大分類、各入口清單都拿它當 key），**不拆字**。顯示名稱查 `layerCatalog.ts` 的 `themeName(title)` → `{ zh, sub? }`（`THEME_NAMES` 表；新增主題要補一列，`layerConsistency` 測試擋漏列）。舊的 `splitThemeTitle()` 已移除。
- **副標**：台灣、統計、世界用英文；**日本 14 個主題用日文漢字**（P3 B），與中文同字也照樣顯示（例「宗教 宗教」「長照服務 介護サービス」），不去重。沒有 `sub` 時只顯示中文。
- **結構**：chevron（`ChevronRight`／`ChevronDown` 14px，`--text-dim`）→ 中文 → 副標小字 → 右側計數 `開啟數/總數` → 總開關（迷你開關，§5.10）。
- **字**：中文 13px（`FONT_SIZE.lg`）semibold `--text-strong`、`FONT_CJK`；英文 10px（`FONT_SIZE.sm`）`--text-dim`、`FONT_CJK`、letterSpacing 0.3、**不轉大寫**；中英 baseline 對齊、gap 6。
- **空間不足**（2026-10-03 收尾修正）：中文主名與計數 `white-space: nowrap`、不縮；**只省略副標**（`text-overflow: ellipsis`），同圖層列 `LayerNameLine`。中文字可在任意字間斷行，不設 nowrap 會先被擠成兩行（例「人口與教 / 育」）。
- **計數**：固定 `FONT_DATA` 10px `--text-dim`，**不再依開啟狀態變色**（舊版有開啟時變亮已拿掉）。
- **容器**：sticky 置頂（滾動時黏住直到下一個主題列推走）、上下 `1px` 分隔線、`backdrop-filter: blur(8px)`；padding `8px 4px 8px 12px`。
- **禁止**：整列 `FONT_DATA`；`uppercase`；英文與中文同字級；渲染時自己拆 `theme.title`。

**大分類（P4，2026-10-03 B 段）**

- **資料驅動**：每個入口一份定義 `LayerPanelDef.macroGroups`（`sidebar/layerPanels.ts`，`{ zh, en?, themes }[]`）；面板依陣列順序顯示，主題在清單裡必須按組相鄰（測試鎖住）。沒給就不分。
- **現況**：台灣沿用全站 6 類（`LAYER_MACRO_GROUPS`＋`THEME_MACRO_GROUPS`，後者同時決定 `THEMES` 排序）；日本 5 類：行政與人口（行政區、人口）、交通與旅宿（交通、旅宿）、醫療與照護（醫療設施、長照服務、醫療圈）、社會（治安、教育、宗教）、自然與環境（自然保護、世界遺產、水資源、高度與地表）。
- **統計 5 類**（2026-10-03 使用者決定 S-B，依政府統計領域；`STATISTICS_MACRO_GROUPS`）：人口與社會（人口與教育、醫療與長照、犯罪與治安）、經濟與住宅（工作與所得、住宅與不動產）、交通（公共運輸、道路與車輛、交通用地）、土地與環境（農林漁牧、環境與資源）、基準（地圖參考）。原「人口與社會」「交通與運輸」兩個大主題拆成 7 個主題，只動主題／小分組歸屬，圖層 key、資料、manifest 名稱不變；預設收合沿用拆分前（從人口與社會拆出的展開、從交通與運輸拆出的收合）。
- **世界 3 類**（W-A）：沿用台灣大分類名與同一張對照 `THEME_MACRO_GROUPS`（`WORLD_MACRO_GROUPS` 由它派生，不另立一份）：公共生活（全球通訊）、環境與資源（全球氣候、全球環境）、情報（全球情勢、全球海事）；主題不改名，`WORLD_THEMES` 依大分類排序，`WORLD_TAB_THEME_TITLES` 只管 membership 與同類內先後。
- **預設收合**：台灣、世界、日本主題一律預設收合（日本 2026-10-03 起，原本展開）；統計見上。

**大分類標題（LT1）**

- 只顯示中文（`macroGroups[].zh`），**9.5px**（刻意小於 L2 的 10px，見 §3.13 例外表）、letterSpacing 1.2、`--text-dim`、`FONT_CJK`；右側 1px 細線拉到底，線色同 L2 群組線（暗 `rgba(255,255,255,0.14)`／淡 `rgba(0,0,0,0.12)`）；padding `10px 12px 4px`、gap 8。

**L2 群組標題**

- **用途**：主題下的子群組（例「點位」「交通用地」）。
- **結構**：中文標題 ＋ 右側 1px 細線拉到底；子項縮排 14px。
- **尺寸**：10px（`FONT_SIZE.sm`）semibold、letterSpacing 0.6、padding `10px 12px 3px`、gap 8。
- **暗／淡**：字 `#9ca3af`／`#4b5563`（= textMuted）；線 `rgba(255,255,255,0.14)`／`rgba(0,0,0,0.12)`。拍板稿為 `--border-soft`，實作取 `BORDER.mid` 較明顯，以實作為準。
- **禁止**：「└」字元縮排；整段 `FONT_DATA`。

**圖層列（2026-10-03 面板統一 A 段，P1／P8）**

- **結構**：icon（14px，開啟時圖層色、關閉時 `--text-dim`，統計列也一樣）→ 名稱（`LayerNameLine`）→ 計數格 → chevron（§5.16）→ 列開關（§5.10）。開啟時列左緣 2px 圖層色。
- **名稱（P2 A，2026-10-03 B 段）**：manifest `name: { zh, alt?, qualifier? }`（`...layerName({ … })` 寫入，`label` 由 `composeLayerLabel` 組成 `中文 外文（限定詞）`，給搜尋、Agent、無障礙名稱用，不手寫）。同一行：中文 12px `--text-strong` → 外文 10px `--text-dim`（空間不夠時**只省略外文**，中文保持完整、必要時換行）→ 限定詞小標籤（9px、1px 邊框、radius 4，例「国土地理院」「2014」「5/10 min」，不縮）。中文口徑（「（每萬人口）」「（縣市）」）屬中文主名，不放限定詞。只拿到 key 的清單（搜尋結果、資料來源、我的）用 `layerDisplayName(key)` 查。
- **計數格兼載入狀態**：有數字就顯示（`FONT_DATA` tabular-nums、`toLocaleString("zh-TW")`，單位另用中文 span）；圖層開著且 `loadingRegistry` 有對應任務時改顯示 10px 小轉圈（`.lr-spin`，`role="status"`、`aria-label="載入中"`，減少動態時不轉）。任務與圖層的對應是盡力比對（`src/lib/layerLoading.ts`：key、kebab key、manifest `sourceId` 開頭），只帶資料集或日期的任務接不到，這類仍只有右上載入條（§5.30）。
- **展開區**：每一列都可展開；展開區最後一行固定是「說明・來源」（收合入口，點開顯示 manifest 說明＋資料來源面板同一張上游資料卡，不另開資料）。統計列的來源說明暫留在統計詳情內（C 段再併入）。
- **鎖定**：半透明、鎖頭取代 chevron、不顯示開關；點列走 App 端權限提示。
- **同一個列元件的其他用法**（`ListRow`）：資料來源（沒有開關，狀態圖示 ✓／⚙／? 放在開關那格）、Agent 分析結果（群組與結果都是列開關；結果本體預設展開）、衛星群組（等級徽章在名稱後、顆數在計數格、黑白開關在 chevron 後）、我的・收藏／已開啟（列開關直接開關圖層＋收藏星號）、醫療統計群組列（「指標」選單仍在列外，屬 C 段）。
- **禁止**：在清單裡另做一種列；用原生 checkbox 或色點當圖層開關；另設手機名稱或在名稱裡寫筆數（`labelMobile` 已移除，筆數走計數格）；名稱裡放 emoji、全形空白或「└」假裝子項；自己拆 `label` 字串。

- **實作**：`src/components/sidebar/LayerRow.tsx`（`ListRow`、`LayerRow`、`RailToggle`）＋`layerRow.css`、`sidebar/ThemeBanner.tsx`（`ThemeBanner`、`MacroGroupLabel`、`SubGroupLabel`）、`sidebar/ExpandedControls.tsx`、`sidebar/LayerInfoLine.tsx`、`sidebar/LayersPanel.tsx`、`sidebar/layerPanels.ts`、`sidebar/railTheme.ts`（`BG_RAIL`／`BG_PANEL`／`PANEL_BORDER` 已走 token，其餘 rail palette 仍 inline hex，§10.3）；`IconRailSidebar.tsx`（桌機 rail）與 `LayerSidebar.tsx`（手機）只負責外殼與入口切換；`sidebar/layerCatalog.ts`（`themeName()`、`layerDisplayName()`）、`data/layerManifest.ts`（`LayerName`、`layerName()`、`composeLayerLabel()`）。

### 5.6 時間軸（border-left）

- **用途**：與 Agent 協作的活動歷程、即時情報事件列表等「依時間排列的一串」。
- **結構**：清單左側 `1px solid --border-mid` 直線；每筆可有 7px 圓點落在線上；時間戳在右或行首。
- **尺寸**：清單 padding-left 12px；時間戳 `--font-data` 10px `--text-dim` tabular-nums；外框同 popup（8px 圓角、`--surface-strong`）。
- **禁止**：白色實心分隔線；「└」字元；時間戳用中文字型。
- **實作**：`src/research/researchActivity.css`（`.research-activity__history`／`__time`）、即時情報列表（`src/components/intel/`）。

### 5.7 按鈕（C2）

| 種類 | 規格 |
|---|---|
| 一般 | 高 26、padding `0 10px`、`RADIUS.md`、`1px --control-border`、底 `--control-bg`、字 11px／500 `--text-strong` `FONT_CJK`、gap 5、icon 13px |
| hover | 底 `--control-bg-hover` |
| 主要 | 底 `--accent-faint`、框與字 `--accent`、600 |
| 圖示 | 26×26 正方、padding 0、置中；**必有 `title`／`aria-label`** |
| 工具列內 | 框與底透明，hover 才出底（`ToolbarButton`） |
| 小尺寸（控制區） | 高 22、padding `0 8px`、字 10px（`.lpc-btn`）；選中＝主要樣式 |
| focus | `:focus-visible` → `2px solid accent`、offset 2（控制區 offset 1） |
| 停用 | `opacity: var(--control-disabled-opacity)`（0.55）、`cursor: not-allowed` |

- **淡色**：`LIGHT.control*`／`LIGHT.accent*`。
- **禁止**：用 `SURFACE.*` 當按鈕底；自訂一次性按鈕色（例 `#204f43`）；純文字符號當圖示（×、▶）。
- **實作**：`src/components/toolbar/ToolbarButton.tsx`、`layerParamControls.css` `.lpc-btn`、`memberPanel.css`、`mainMapConnection.css`（`button` 規則）。pressed 態未定義。

### 5.8 分段控制

- **用途**：2–3 個互斥選項（即時／歷史、篩選分頁、圖層控制 ≤3 選項）。
- **尺寸**：工具列版高 26、外框 padding 2、gap 2、`RADIUS.md`+1（5px）；控制區版 padding 1、按鈕 padding `4px 7px`、10px、內圓角 3。
- **狀態**：選中 `aria-pressed="true"` → 底 `--accent-faint`、字 `--accent` 600；未選 `--text-muted`；hover 未選 `--control-bg-hover`；停用 opacity .4。
- **禁止**：>3 選項用分段（改選單）；用顏色以外沒有 `aria-pressed` 的選中態。
- **實作**：`src/components/ModeToggle.tsx`（工具列）、`LayerParamControls.tsx` `ControlSegmented`＋`.lpc-seg`、即時情報篩選。

### 5.9 選單（原生 select）

- **用途**：>3 選項（圖層 UX 鐵則 4）。保留原生 `<select>`（無障礙、手機原生選擇器）。
- **尺寸**：高 20、padding `0 20px 0 7px`、`RADIUS.md`、10px `FONT_CJK`、自繪 8×5 箭頭（`--lpc-arrow`）。
- **暗／淡**：底 `--control-bg`、框 `--control-border`；展開選項底 `--control-option-bg`（暗 `#10101b`）／`--light-surface-solid`（淡 `#ffffff`）；`color-scheme` 跟主題。
- **狀態**：hover `--control-bg-hover`；停用 `--control-disabled-opacity`；focus 2px accent。
- **實作**：`layerParamControls.css` `select.lpc-select`（控制項由 `layerParamsSpec.ts` 產生）。
- **例外**：色盤（要畫色條）用 §5.36 色盤選單，不用原生 select。

### 5.10 開關（兩階）

開關只有兩種，依「開的是什麼」選，不另做第三種尺寸（2026-09-29 拍板 S2，圖解 `docs/features/ui-consistency-audit-20260927/toggle-sheet.html`）。

| 階 | 用在哪 | 尺寸 | 開 | 關 | 實作 |
|---|---|---|---|---|---|
| **列開關** | 整層開／關：Layers 主題列與圖層列、統計列、醫療統計群組、Agent 分析結果清單與群組、衛星群組、我的・收藏／已開啟 | 28×16 軌道、12px 圓點（左 2 → 14） | **黑白，依主題**：暗 白軌 `#ffffff`＋圓點 `#111827`；淡 深軌 `#1f2937`＋白圓點 | 暗 `#4b5563`／淡 `#d1d5db` 軌道＋白圓點 | `sidebar/LayerToggleSwitch.tsx`（`LAYER_TOGGLE_PALETTE`） |
| **細項開關** | 一層裡的選項：圖層控制區（顯示站名、光柱…）、底圖選單「顯示地名」 | 20×11 軌道、7px 圓點（左 2 → 11） | 軌道 `--accent`、圓點 `#fff` | 軌道 `--control-border`、圓點 `--text-strong` | `LayerParamControls.tsx` `ToggleControl`＋`.lpc-sw`、`toolbar/BasemapMenu.tsx` `MiniSwitch` |

- **為什麼兩種顏色**：列開關是「整層開關」，用中性黑白比較穩，開很多層時不會一整排彩色；細項用強調藍，標出「這層裡哪些選項有開」。
- **主題**：列開關傳 `isDarkTheme` 即可，預設顏色自己跟著主題；個別顏色 prop 只給特例覆寫，不要各處重抄色碼。
- **動畫與標籤**：transition .15s。細項開關標籤 10px `--text-muted`，開啟時 `--text-default`；≥3 個細項開關排兩欄。
- **無障礙**：`role="switch"`＋`aria-checked`＋`aria-label`。
- **禁止**：用 checkbox 或文字「ON/OFF」；新增第三種尺寸（原規格的 24×14 從未使用，已刪除）；在列開關用強調色或在細項開關用黑白。

### 5.11 圖層控制區（V2 版面）

- **結構**：圖層列展開後，名稱下方一塊控制區，左側 `1px --lpc-line` 直線、padding-left 10、gap 6；每個控制項一列：**標籤＋數值同一行、控件全寬在下一行**（grid `"k v" "c c"`）。
- **尺寸**：標籤 10px `--text-muted` `FONT_CJK`、超長省略；數值 10px `FONT_DATA` `--text-default` tabular-nums 靠右。
- **暗／淡**：`.lpc-theme`／`.lpc-theme--light`（`layerControlThemeClass(isDarkTheme)`）。淡色左線 `rgba(0,0,0,.12)` 不在 token 階上，刻意保留。
- **順序（P5，2026-10-03 B 段）**：**資料篩選 → 顏色 → 透明度 → 大小 → 其他外觀 → 說明・來源**。
  - 類別判斷（`layerParamsSpec.ts` `paramControlCategory`）：控制項寫了 `category` 就照寫的；否則 `palette`＝顏色（熱區／網格顏色）、`multiSelect`＝資料篩選、滑桿標籤含「透明度」＝透明度；其餘查 `CATEGORY_BY_LABEL` 詞彙表（例 年份／類別／定位精度／模式＝資料篩選，配色／著色模式／立體效果＝顏色，大小／寬度／線寬／光點＝大小，高度／3D／光暈／網格大小＝其他外觀）。同一個詞在不同層意思不同時在 spec 寫 `category`（例 `urbanHeat`「顯示」選指標＝資料篩選、`buildingsGba`「顯示模式」＝其他外觀）。
  - 排序在 `buildParamControls` 做（`orderedVisibleParamsSpec`，同類保持宣告順序）；Agent 端 `research/layerControls.ts` 用同一支對位置。spec 陣列、store、overlay 編碼、manifest `params.kinds` 都照宣告順序，不受影響。
  - 寫死在 `ExpandedControls` 的區塊不參與排序：航班模式鈕、`PropertyValueStatisticsDetails`、歷史航跡在控制項之前；「說明・來源」固定最後。統計的期別、指標、細項（C 段）已改成連動選單（§5.37），照類別排在資料篩選；統計的來源與處理紀錄放在「說明・來源」裡。
  - `linkedSelect` 一律歸資料篩選（不必進詞彙表）。
  - 「立體效果」toggle（R6，2026-10-05）歸顏色組：排在資料篩選之後、透明度之前，每個有 Three.js 效果的非移動物件圖層一個，預設關。
  - 護欄：`src/state/__tests__/layerParamsOrder.test.ts`——分不出類（新標籤）就紅：在詞彙表補一列或寫 `category`；輸出名次必須單調不減。
- **禁止**：手寫圖層控制 JSX（一律 `layerParamsSpec.ts` 規格 → `ParamControlList`）；標籤與數值擠在同一字串；為了順序去搬 spec 陣列（排序由類別決定）。
- **實作**：`src/components/sidebar/{LayerParamControls.tsx,layerParamControls.css}`、`src/state/layerParamsControls.ts`。

### 5.12 多選清單

- **結構**：`<details>` summary（chevron＋名稱＋已選數 `FONT_DATA`＋右側「全選／清除」連結 `--link`）→ 兩欄 checkbox。
- **尺寸**：10px；checkbox 10×10、`RADIUS.sm`、框 `--lpc-line`，選中填該類別色 `--cc`（無則 accent）。停用項 opacity .45。
- **實作**：`LayerParamControls.tsx`（multiSelect 分支）＋`.lpc-ms`／`.lpc-chk`。

### 5.13 滑桿 V2＋S1

- **尺寸**：input 高 14、2px 軌道、10px 圓點（`margin-top: -4px`）、圓點外 3px 12% 光暈；已拖段較亮（`--p` 由元件 inline 更新）。
- **色**：`--slider-track`／`--slider-fill`／`--slider-thumb`（淡色 `--light-slider-*`）。
- **狀態**：focus-visible → 圓點 `0 0 0 2px accent`。
- **數值**：`valueText` 由 `splitSliderLabel()` 產生（§6.2）。
- **禁止**：在共用元件以外寫原生 `type="range"`（guard `native-range`）；粗軌道、系統預設藍色滑桿。
- **實作**：全站唯一元件 `src/components/controls/Slider.tsx`＋`slider.css`（`.ctl-range`），見 §5.28；圖層控制 `LayerParamControls.tsx` `SliderControl` 也用它（Phase Q 收斂，舊 `.lpc-range` 已刪）。

### 5.14（已移除）獨立隱藏鈕

- 2026-09-28 使用者拍板移除：原「Hide」／眼睛圖示的功能是「關掉展開中的圖層並收合」，與圖層列的開關＋展開箭頭重複，還多占一列。
- **不要再加回**獨立的隱藏按鈕；關閉圖層用開關、收合用 chevron。

### 5.15 小型圖示按鈕

同 §5.14 規格（20×20、`RADIUS.md`、hover 出底）。任何只有圖示的按鈕都要有 `title` 與 `aria-label`。

### 5.16 Chevron

- **規格**：lucide `<ChevronRight size={12}/>`，展開時 `transform: rotate(90deg)`、transition .15s；或 `ChevronRight`／`ChevronDown` 切換（圖例收合鈕）。色 `--text-muted`。
- **禁止**：`▶`／`▼` 字元（guard `triangle-chevron`）。播放鍵請用 lucide `Play`／`Pause`；升降趨勢的 `▲▼` 成對符號屬資料語意，不算 chevron。
- **實作**：`.lpc-chev`、`LegendPanel.tsx`、`sidebar/LayerRow.tsx`、`sidebar/ThemeBanner.tsx`。

### 5.17 工具列（T2）

- **位置**：右上，單一底板；左上為品牌字標＋座標 HUD（§5.18）。
- **底板**：`SURFACE.strong`（淡 `LIGHT.surfacePanel`）、`1px BORDER.panel`、`borderRadius 7`、padding 3、gap 4、`ELEVATION.lg`；窄寬度整條換行並維持靠右（`marginLeft: auto`）。
- **組成順序**（固定）：即時／歷史分段 ｜ 底圖 ｜ 分享（圖示）、說明（圖示）、AI（一般，開啟時主要）、**拍攝模式**（主要按鈕）｜ 帳號。`｜` 為 1px×16 直線，色 `palette.controlBorder`（暗 `CONTROL.border`／淡 `LIGHT.controlBorder`）。
- **項目**：高 26、圓角 4、icon 13px（§5.7）。
- **拿掉的東西**：Monitor BETA 按鈕（左側 rail「監測模式」保留）、第二排、計數列「flights · ships · 台灣好行」；操作提示移進「說明」。
- **禁止**：在工具列加新的一排或浮動按鈕；把新功能塞成第二個主要按鈕。
- **實作**：`src/App.tsx`（組成）、`src/components/toolbar/{ToolbarButton.tsx,toolbarTheme.ts}`、`src/components/ModeToggle.tsx`、`src/components/auth/UserAvatar.tsx`。

### 5.18 品牌字標與座標 HUD

- 字標：見 §4.2（`FONT_DATA` 700 20px、暗 `#fff`／淡 `#333`、與工具列同列垂直置中，行高 26）。
- HUD：字標正下方；`25.0464, 121.5318 · z12.5 · 仰角 0° · 方位 0°`；10px `FONT_DATA` tabular-nums letterSpacing 0.5、暗 `textDim`／淡 `rgba(0,0,0,0.45)`。
- **實作**：`App.tsx`、`CameraHud`。

### 5.19 底圖選單（B3 純圖示）

- **按鈕**：工具列圖示按鈕，地圖 glyph 13px ＋ 右下 7px 色點（當前底圖漸層，`RADIUS.sm`、1px 底板色描邊）；`title="底圖：{中文名}"`。
- **彈出層**：靠右、top `100% + 6px`、底 `palette.popupBg`（暗 `SURFACE.strong`／淡 `LIGHT.surfaceSolid`）、`RADIUS.xl`、`ELEVATION.lg`、padding 4；7 個底圖（純黑、暗色、淡色、衛星、衛星街道、夜間導航、街道）以 4 欄 × 52px 縮圖排列（1:1、圓角 5、選中 2px accent outline＋accent 600 字）、中文名 9.5px；分隔線後「顯示地名」＋迷你開關。
- **互動**：點外部或 Esc 關閉；`role="menu"`／`menuitemradio`。
- **實作**：`src/components/toolbar/BasemapMenu.tsx`。

### 5.20 拍攝模式（P2）

- **進入**：工具列主要按鈕「拍攝模式」；隱藏所有介面，只留地圖、vignette 與大標。
- **離開提示**：底部置中膠囊「離開拍攝模式 Esc」，平常 opacity 0；滑鼠移動淡入（.3s），靜止 2 秒淡出；`prefers-reduced-motion` 無 transition；點擊也可離開。膠囊 10px `FONT_CJK`、`RADIUS.pill`、半透黑底＋blur 6。
- **大標**：`FONT_DATA` 700 28px（手機 20）、副標 `FONT_CJK` 18px 600。
- **實作**：`src/components/toolbar/CaptureExitHint.tsx`、`App.tsx`（拍攝模式區塊）。

### 5.21 即時情報（H2＋徽章兩公式）

- **外殼**：同 §5.1（H2：eyebrow＋13px 標題＋即時 pill）；中文一律 `FONT_CJK`，時間與數字包 `FONT_DATA` span。
- **徽章兩公式**（`intelTokens.ts`）：
  - **分類** `chipTint(color)`：底＝該色 14% alpha、字＝該色、無框。
  - **程度／狀態** `chipOutline(color)`：透明底、`1px` 該色 50% alpha 框、字＝該色。
  - 共通：10px、padding `3px 5px`（外框版 `2px 5px`）、圓角 3。
- **篩選**：分段控制（§5.8）；事件列表用左線時間軸（§5.6）。
- **禁止**：自訂第三種徽章公式；分類與程度用同一種外觀。
- **暗／淡**：`intel/intelTheme.tsx` 的 `IntelPalette`（`DARK_INTEL`／`LIGHT_INTEL`，淡色一律取自本檔 `LIGHT`）＋ `IntelThemeProvider`／`useIntelTheme()` 分發，由 `IntelPanel` 依 `isDarkTheme` 建 palette；未被 Provider 包住時 fallback 深色。監看模式新版也由 `MonitorPanel` 依底圖主題包同一個 Provider（§5.35 H2，P5 已實作；舊版一律暗）。
- **淡色徽章對比規則**：`chipTint`／`chipOutline` 的底色／框線沿用資料 hue 不變（§3.16 資料色不進 token）；但淡色主題若直接拿該 hue 當「字」色，淺色相（黃、淺綠、青…）對近白面板對比不足。呼叫端改用 `intelTheme.ts` 的 `chipText(color, palette)`：暗色原樣回傳，淡色把 hue 與 `LIGHT.textStrong` 依 45%／55% 混色（`CHIP_TEXT_MIX = 0.55`）。已對 7 個新聞分類、6 個警示分類、4 個嚴重度色、`COLORS.cluster` 共 18 色驗證 WCAG 對比：`chipOutline`（字疊在不透明面板底，對純白量測即精確值）全數 ≥5.32:1；`chipTint`（字疊在「白＋該色 14% alpha」的真實淡底，對比略低於純白版本）全數 ≥5.01:1；兩者最低都是 lifeline `#a3e635`（見 `intel/__tests__/intelTheme.contrast.test.ts`，兩種底各自量測，未達標顏色目前為零）。`GIS_LEVELS`／`SEV_LEVELS` 的分級色另用 `levelColor()` 轉換（白色半透明佔位→中性文字階；與 accent／statusWarn／statusErr 同值→換成對應 palette 欄位；其餘資料 hue→`chipText`）。
- **實作**：`src/components/intel/{IntelHeader.tsx,IntelCard.tsx,IntelFilters.tsx,intelTokens.ts,intelTheme.tsx}`、`intel/alerts/{AlertCard.tsx,AlertSummaryBar.tsx,FeedTabs.tsx}`。

### 5.22 資料來源面板（D1 列內展開）

- **位置**：左側 rail「資料來源」（資料庫圖示，Locations 之後）；取代舊右下浮動 ⓘ 與置中詳細視窗。
- **外殼**：同 Layers：H2（eyebrow「資料」）、搜尋框「搜尋圖層名稱」、狀態篩選分段（「全部 N」＋ ✓／⚙／? 三個狀態圖示與數量，`title` 為中文狀態名）、主題 → L2 群組。
- **列**：共用圖層列（§5.5 圖層列，2026-10-03 起）：圖層 icon＋中文名，英文名小字 `textDim`；沒有開關，狀態圖示（✓ 已接上 `statusLive`／⚙ 派生 `statusDerived`／? 待補 `statusWarn`）放在開關那格；鎖頭圖示表示受限。L2 群組標題用共用 `SubGroupLabel`。
- **展開**：點列在列下方展開上游資料卡，同時只展開一筆（`aria-expanded`）；卡內 Fact 列標籤 10px `muted` 寬 44、值 `textStrong`，代碼類值 `FONT_DATA`；連結 `link` 色。
- **暗／淡**：`DARK_DS`／`LIGHT_DS`（皆取 token）。
- **禁止**：顯示 `datasetId` 當標題（§6.3）。2026-10-03 B 段已修掉 2 處 fallback：沒有 catalog 標題時卡片標題改「上游資料集」／「已比對的上游資料集」，代號移到「資料集」事實列（`FONT_DATA`），比對信心印「高／中／低」。
- **實作**：`src/components/sidebar/DataSourcePanel.tsx`、`IconRailSidebar.tsx`（rail 入口）。

### 5.23 圖例收合鈕

- **結構**：圖例面板頂端整列按鈕：chevron（展開 `ChevronDown`／收合 `ChevronRight`，12px）＋「圖例」。
- **尺寸**：padding `6px 10px`、gap 6、10px `FONT_CJK`、透明底。
- **禁止**：英文「LEGEND」、大寫。
- **實作**：`src/components/LegendPanel.tsx`。

### 5.24 左下時間軸（TC3 收合＋展開；展開＝TC1 單列）

- **用途**：地圖左下的即時／回放時間軸（`TimelineControls`）與歷史模式時間軸（`HistoricalTimeline`），共用外殼 `TimelineShell`。設計稿：`docs/features/ui-consistency-audit-20260927/timeline-compact-sheet.html` 的 TC1、TC3（Phase R 取代 Phase M 的 TL3 兩列卡片）。
- **底邊位置（共用常數）**：`LAYOUT.mapBottomInset = 64`（`designTokens.ts`）。時間軸（收合與展開）與右下停靠區（popup＋圖例，`App.tsx`）的 `bottom` **都用這個常數**，兩者底邊對齊；改值會同時移動兩邊，不得在任一處寫死數字。64 讓出 Mapbox 右下版權列。實測（1440×900）：時間軸底 836、右下停靠區／圖例面板底 836。
- **收合（預設）**：膠囊寬 270px、高 36、`RADIUS.pill`；底 `--surface-strong`＋`1px --border-panel`＋`ELEVATION.lg`。內容：圓形播放鍵 26px（C2 主要色）→ 目前時間 `FONT_DATA` 15px／600 → 細進度軸（`TimeAxis compact`：只畫基線、已播放段、指針、缺漏斜線；**不畫刻度與標籤**）。
- **展開＝TC1 單列卡片**：寬 590px、高約 44、`RADIUS.xl`。一列排：播放鍵 → 時間（多天時帶日期「9/27 14:00」）→「即時」綠點（僅 live）→ 帶刻度標籤的 `TimeAxis`（撐滿剩餘寬度）→ 倍速 select → 膠囊按鈕：
  - 即時：「9/28 · 1 天」（多天「9/27–9/29 · 3 天」）。點開**向上彈出**面板：前／後一天、原生日期輸入＋星期、「現在」（`aria-pressed`＝即時中）、範圍 select「1 天…7 天」。
  - 歷史：「民國 115 年 9 月」（依粒度到年／月／日）。面板內：民國年／月／日 select（粒度未涵蓋者停用）＋粒度分段「年／月／日」＋資料範圍警示（例「火災資料：111~113」）。房地產開啟時膠囊為「房地產 · 季」，面板內是分段「季／月／週」。
  - 尚無資料（回放游標在「現在」之後）：時間變橘色，另有「尚無資料」小標籤**浮在卡片上方，標籤中線（「無」「資」之間）對齊時間的冒號**（掛在冒號上絕對定位，不佔列內寬度）。不可放進列內：會擠窄 `TimeAxis`，拖曳時刻度對應的時間跟著變，提示在「現在」前後反覆出現／消失。外觀：10px／500 `FONT_CJK`、警示色字、1px 警示色 45% 框、**圓角 3（刻意不在 `RADIUS` 階上）**、padding `1px 5px`、面板底＋陰影（`--tl-surface`／`--tl-shadow`）；卡片上緣再往上 6px（`bottom: calc(100% + 18.5px)`，實測）。只在展開時顯示；只有 `TimelineControls`（即時／回放）有，歷史時間軸不適用（`timeline.css` `.tl3-warnchip`，#397）。
  - GFW 資料缺漏：斜線在兩態的軸上都畫；說明標籤與「跳至可用時段」只在展開時以第二列出現。
- **播放規則**（2026-09-30）：回放播到「視窗結尾」與「現在」取較早者就停，不播進還沒發生的未來；游標已被拖到現在之後時按播放，原地停、不跳回（`useTimeline.ts` `replayPlaybackEnd`、`advanceReplayFrame`）。資料載入完成時的自動播放走 `autoPlay()`：使用者（或套用場景）按過暫停就不自動重啟，要自己按播放；按播放會清掉這個狀態。
- **寬度**：兩態都套 `maxWidth: calc(100vw - 左側偏移 - 312px)`（右側留給右下停靠 popup 280px＋間距）；展開時往右、往上長，底邊不動。
- **展開／收合時機**（純函式 `timelineExpand.ts` `expandReducer`，有單元測試）：
  - 展開理由（hold）：滑鼠在卡片上、鍵盤 focus 在卡片內、正在拖曳刻度軸、日期面板開著。任一成立即展開。
  - 全部解除後進入倒數，**2 秒**（`COLLAPSE_DELAY_MS`）後收合；倒數中任一 hold 回來就取消。
  - 拖曳中（pointer capture，滑出卡片也算）不收；面板開著不收（點卡片外或 Esc 關面板）。
  - 觸控：點膠囊展開，之後同樣走 2 秒倒數。鍵盤：膠囊 `tabIndex=0`、Enter／Space 展開；Tab 進入卡片即展開。
  - 滑鼠點按鈕或拖軸留下的 focus **不算** hold（否則點過一次就永不收）；只有鍵盤帶來的 focus 與 select／input 的 focus 算。
  - 計時器 effect 只依賴狀態機 phase，不依賴 `currentTime`（CLAUDE.md §6）。
  - `prefers-reduced-motion: reduce` 時寬度／圓角無過場。
- **刻度軸**（`TimeAxis`，`role="slider"`＋`aria-valuemin/max/now/valuetext`，兩態共用同一個元素，展開時 focus 不會掉）：高 30；基線 `1px --border-mid`；已播放段 3px `--slider-fill`；主刻度 9px、次刻度 5px；標籤 `FONT_DATA` 9.5px `--text-dim`（兩端貼齊邊緣）；指針 2px `--accent`，不再掛時間標籤（時間已在左側大字，值在 `aria-valuetext`）。
  - 即時標籤規則：1 天主刻度每 4 小時「00 04 … 24」、次刻度每小時；2 天主刻度每 6 小時（日界「M/D」、其餘「HH」）、次刻度每 2 小時；3–7 天主刻度每天「M/D」、次刻度每 6 小時。台北時間固定 +8h 對齊。
  - 歷史標籤：年粒度＝可用民國年；月粒度＝「1月…12月」；日粒度＝該月日數（超過 13 格隔格標，最後一格必標）。房地產＝各季起點「2024Q3…」。
- **操作**：點擊或拖曳（pointer capture，對齊整分鐘）跳轉；鍵盤 ←→ 5 分鐘、Shift＋←→／PageUp／PageDown 1 小時、Home／End 到兩端（歷史軸 ←→ 一格、PageUp／Down 三格）。回放走 `onSeekByProgress`；即時模式拖曳／鍵盤改走 `onJumpToTime`（切到回放並停在該時刻）；即時的播放鍵顯示暫停圖示，按下＝切換為回放。
- **層級**：時間軸根節點 `Z_INDEX.mapOverlay`（10）；日期面板在它的 stacking context 內，因此也在浮動面板（20）之下——刻意接受，不為此寫死數字。
- **手機**：固定展開、不做膠囊（沒有 hover）；維持在頂部時間軸條內，第一列播放／時間／倍速／膠囊，刻度軸換到第二列全寬；面板改往下彈。
- **遮擋判斷**：根節點保留 `data-viewport-occluder="timeline"`（即時）／`data-testid="historical-timeline"`（歷史），`viewportFit` 以此避開時間軸。
- **暗／淡**：觸發 class `.tl3--light` 把 `--tl-*` 別名與 `--accent*`／`--control-*` 指到 `--light-*`。
- **禁止**：原生 `type="range"`；`▶` 字元；英文「Now／LIVE／1d／60x」；等寬字包中文；時間軸或右下停靠區寫死 `bottom` 數字。
- **實作**：`src/components/timeline/{TimelineShell.tsx,timelineExpand.ts,TimeAxis.tsx,timelineAxis.ts,timeline.css}`、`TimelineControls.tsx`、`HistoricalTimeline.tsx`；常數 `designTokens.ts` `LAYOUT`。

### 5.25 層級（z-index）

- **SSOT**：`designTokens.ts` `Z_INDEX` ↔ `tokens.css` `--z-*`，兩邊同值（`src/styles/__tests__/zIndex.test.ts` 強制同值與由低到高的順序）。TS 用 `zIndex: Z_INDEX.modal`，CSS 用 `z-index: var(--z-modal)`。

| 層 | TS／CSS | 值 | 放什麼 |
|---|---|---|---|
| 地圖覆蓋 | `mapOverlay`／`--z-map-overlay` | 10 | 地圖上的標記、選取圈；**左下時間軸（桌機卡片與手機時間軸條）** |
| 浮動面板 | `floatingPanel`／`--z-floating-panel` | 20 | 左側 rail 面板（Layers、資料來源…）、地震回放、Agent 面板與活動卡、右下停靠 popup＋圖例、桌機會員專區 |
| 工具列 | `toolbar`／`--z-toolbar` | 25 | 右上工具列（T2）、手機標頭（M1）、拍攝模式離開提示、載入狀態條（§5.30） |
| 彈出層 | `popover`／`--z-popover` | 30 | 下拉選單（底圖、帳號、手機「⋯」）、hover tooltip、日本水資源／醫療載入失敗提示（`JpWaterAlert`／`JpMedicalAlert`，在 `LayerHosts` 最後渲染，蓋過選單但在置中視窗之下） |
| 置中視窗 | `modal`／`--z-modal` | 40 | 說明、分享視窗；同層另有 AI 對話浮層（`ChatPanel`）與手機會員專區（見下方 DOM 順序） |
| 提示訊息 | `toast`／`--z-toast` | 50 | 保留給不需要蓋過「資料更新中」遮罩的提示；目前無使用者（見特例） |

- **時間軸為什麼是 10**：時間軸屬於地圖控制列，不是面板；左側面板或右下 popup 展開時應蓋在時間軸上面，所以刻意比浮動面板低一層。`TimelineControls`／`HistoricalTimeline`／App 手機時間軸條都寫 `Z_INDEX.mapOverlay` 並附註解。
- **同層靠 DOM 順序，不得寫死數字**：同一層要誰在上面，就調整渲染順序（後渲染者在上），不要改成 21、41 之類的數字壓過鄰居。目前的 modal 層順序（`App.tsx` 最後段）：`ChatPanel` → `MemberPanel` → `InfoModal` → `ShareModal`，維持「說明／分享永遠在對話浮層與會員面板之上、手機會員面板在對話浮層之上」。**不要把這幾個元件往前搬。**
- **特例（維持寫死，已登記）**：

| 元件 | 值 | 理由 |
|---|---|---|
| `LoadingScreen` | 9999 | 啟動畫面，蓋住一切 |
| 資料更新中遮罩（App day-loading overlay） | 1000 | 全畫面半透明遮罩＋進度，需在所有介面之上 |
| `TransientNotice`、私人圖層提示（App `gatedNotice`） | 3000 | 提示訊息必須高於 1000 的資料更新中遮罩（否則被壓暗、模糊）；時間切換時兩者常同時出現 |
| `AdminPanel` | 10001 | 管理者視窗，最高 |
| 圖層 host 錯誤提示（`allenCoralHost`、`coralReefHost`） | 10000 | 私人資料存取錯誤必須可見 |
| `ChartHoverTooltip` | 10050（常數 `TOOLTIP_Z`） | 圖表 hover tooltip 要蓋過所有面板 |

- **尚未歸層（記錄於 guard `raw-z-index` 基準，只能減少）**：`MobileBottomSheet` 40（`layerConsistency` 測試直接比對字面值）、`MonitorPanel` 40、即時情報／衛星面板 30、衛星詳細卡 35、`ManeuverCompareModal` 100、`AirportSelector` 下拉 100、Monitor 看板內部 20／30。之後動到這些元件時順手歸層。
- **元件內部小值**：0–9 的 `zIndex`（sticky 標頭 2、指針 3…）只排兄弟順序，不算全站層級，guard 不計。
- **禁止**：新增 ≥10 的寫死數字（guard `raw-z-index`）；為了壓過某元件改數字而不先確認它屬哪一層。
- **實作**：`src/styles/designTokens.ts` `Z_INDEX`、`src/styles/tokens.css`、`src/App.tsx`（modal 層 DOM 順序）。

### 5.26 左側面板互斥（Z1）

- **規則**：左側浮動面板**同時只開一個**。打開其中一個時，其他已開的自動關閉；只關不開時不做事。
- **適用面板**：本地 Agent、地震回放、即時情報、衛星情報、會員專區（`LEFT_PANEL_KEYS`）。Layers／資料來源等 rail 面板本來就是同一個抽屜，不在此清單。
- **地震回放特例**：地震回放是圖層旗標（`layerVisibility.earthquakeReplay`），可從圖層清單、批次開關、URL 還原、Agent bridge 打開；因此「關掉地震回放面板」＝**關掉該圖層**，App 觀察「剛由關變開」的面板再呼叫既有的關閉 setter。
- **Agent（A1）**：「與 Agent 協作」左側面板只放**配對與連線**（登入、配對碼、連線狀態、本次分析圖層），參與互斥——打開地震回放等其他左側面板時它會收起，Agent 仍保持連線。**執行步驟活動卡**（「最新動作」，`ResearchActivityCard`）掛在地圖容器右上（portal，`top: 100px`＝工具列列底 58＋42 間距，常數 `--research-activity-top`），**不受互斥影響**：只要已配對且有活動就顯示（`activityCardVisible()`，只看活動與拍攝模式），層級 `floatingPanel`，工具列選單（popover 30）蓋在它上面。
- **新增左側面板時**：把 key 加進 `LEFT_PANEL_KEYS` 並在 App 接上開關 state，層級用 `Z_INDEX.floatingPanel`。
- **實作**：`src/state/leftPanelMutex.ts`（純函式 `leftPanelsToClose()`＋測試）、`src/App.tsx`。

### 5.27 置中視窗（modal）與分享欄位

**置中視窗**（說明 `InfoModal`、分享 `ShareModal`）

- **層級**：`Z_INDEX.modal`；遮罩 `inset: 0`、半透明黑底，點遮罩關閉。
- **標頭**：H2（§5.1）——padding `10px 14px`、eyebrow（「說明」「分享」）＋13px bold 標題、下方 `1px --border-panel`；關閉鈕 lucide `<X size={14}/>`、24×24、`RADIUS.md`。
- **語言切換**（說明視窗）：分段控制「中文／EN」（§5.8），高 24、padding 2、gap 2、`1px` 框；選中底 `COLORS.accentFaint`（淡 `LIGHT.accentFaint`）。不用「ZH／EN」英文縮寫。
- **卡片**：底 `CONTROL.bg`、框 `BORDER.soft`、`RADIUS.lg`、padding `12px 14px`；需要強調時左側 3px 色條。
- **按鍵標籤 `kbd`**：`FONT_DATA` 9.5px 600、透明底、1px 框、圓角 3、padding `1px 4px`。
- **內文**：`FONT_CJK`；容器不得設 monospace；不用 `uppercase` 與 `▶` 說明文字。
- **尺寸**：說明視窗桌機 `min(920px, 92vw) × min(680px, 88vh)`，手機 `100vw × 92vh` 由下緣出現。

**分享欄位對齊**

- **版面**：每個欄位（連結、嵌入 HTML）用 `grid-template-columns: 1fr auto`：左值欄、右複製鈕。
- **值欄**：`FONT_DATA` 10.5px（§3.13 例外）、`--control-bg` 底、`--control-border` 框、圓角 4。
- **複製鈕**：C2 一般樣式＋`Copy` 圖示，**固定寬 74px**，讓「複製」↔「已複製」切換時版面不跳動；成功 2 秒內改主要樣式（accentFaint 底、accent 框字、600）；失敗時自動選取文字方便手動複製。
- **規則**：任何「文字會在兩種長度間切換」的按鈕（複製／已複製、開始／停止）都給固定寬度或最小寬度。
- **實作**：`src/components/InfoModal.tsx`、`src/components/ShareModal.tsx`。

### 5.28 共用滑桿（controls/Slider）

- **唯一的原生 range 元件**：`src/components/controls/Slider.tsx`，樣式 `slider.css` `.ctl-range`（規格同 §5.13 S1）。其他檔案不得寫 `type="range"`（guard `native-range` 白名單只剩本元件）。
- **使用者**：圖層控制（`LayerParamControls` `SliderControl`）、地震回放、情報回放、bbox 工具、研究頁、Jev 篩選頁、Agent 面板分析結果透明度。
- **API**：`value`／`min`／`max`／`step`／`onChange(number)`／`ariaLabel`／`ariaValueText`；已拖段比例 `--p` 由元件計算。
- **主題**：預設吃 `--slider-track`／`--slider-fill`／`--slider-thumb`（暗色）。有自己主題系統的呼叫端傳 `trackColor`／`fillColor`／`thumbColor`／`accentColor` 覆寫（圖層控制傳 `var(--lpc-*)`、情報回放傳 intel palette）；或像 Agent 面板一樣在淡色容器上重設 `--slider-*` 為 `--light-slider-*`。
- **容器通用 input 樣式**：`.ctl-range` 自帶 `padding: 0; border: 0`，不會被 `.xxx input { padding; border }` 之類的容器規則撐開；呼叫端不要再為 range 另寫覆寫規則。
- **實作**：`src/components/controls/{Slider.tsx,slider.css}`。

### 5.29 手機標頭（M1）

- **位置**：手機版頂端全寬，高 44（加 `safe-area-inset-top`），`Z_INDEX.toolbar`；底 `SURFACE.strong`（淡 `LIGHT.surfaceStrong`）＋`backdrop-filter: blur(12px)`、下緣 `1px palette.borderPanel`；padding `0 8px`、gap 4。
- **左側**：品牌縮寫「MTP」（`FONT_DATA` 13px 700、letterSpacing 1.5，§4.2 品牌例外）＋座標 HUD（9px `FONT_DATA` tabular-nums、`textDim`、單行省略）。
- **右側外露**（固定順序）：AI（開啟時主要樣式）→ 拍攝模式（C2 主要）→ `⋯` 更多 → 帳號。按鈕 30×30、圓角 6（`RADIUS.lg`）、icon 16px。
- **`⋯` 選單**：向下靠右、寬 190px、padding 4、`RADIUS.xl`、`Z_INDEX.popover`；列 padding `7px 8px`、icon 15px、12px `FONT_CJK`；開關類項目 accent 字＋600＋`aria-pressed`。內容：說明、分享、3D／2D 切換（右側附目前值）、本地 Agent（僅 DEV）、會員專區。點外面或 Esc 關閉。
- **禁止**：在手機標頭再加外露按鈕（新入口一律收進 `⋯`）；第二排。
- **實作**：`src/App.tsx`（手機分支、`mobileIconButtonStyle`）、`src/components/toolbar/MobileMoreMenu.tsx`、`src/components/auth/UserAvatar.tsx`（`compact`）。

### 5.30 載入狀態條

2026-09-28 拍板（比較頁 `docs/features/ui-consistency-audit-20260927/loading-status-sheet.html` 的 S1）。取代舊的 `LoadingIndicator`（英文大寫「LOADING」卡片、`top 110px`、z-index 1000，和 Agent 活動卡重疊、一閃即逝）。

- **位置**：工具列正下方、貼齊工具列右緣：桌機 `top 60px`、`right 16px`（工具列底約 52、Agent 活動卡頂 100，放在兩者之間）；手機 `top 52px`、`right 10px`；Monitor split 時讓到 dock 左邊。層級 `Z_INDEX.toolbar`。拍攝模式不顯示。
- **外觀**：單行，高 22、padding `0 9px`、`RADIUS.lg`；底 `SURFACE.strong`＋1px `BORDER.panel`＋`ELEVATION.lg`＋`blur(12px)`（淡色用 `--light-*`）。10px `FONT_CJK`；項數 `+N` 用 `FONT_DATA` tabular-nums、`textDim`。圖示 10px：載入中＝accent 細圈轉動、完成＝`statusLive` 勾、失敗＝`statusErr` 三角。
- **文案**：「載入中 · 名稱」＋`+N`（同時進行的其他項數）；「已載入 · 名稱」或「已載入 N 項」；「載入失敗 · 名稱」（名稱也用錯誤色）。不用英文、不用大寫、不逐項列出。
- **節奏**（`src/lib/loadingStatusController.ts` 的 `LOADING_STATUS_TIMING`）：

| 規則 | 值 |
|---|---|
| 出現前延遲（這段內就完成的任務不顯示） | 150ms |
| 「載入中」最短停留 | 600ms |
| 全部結束後合併等待（這段內有新任務就算同一批） | 300ms |
| 「已載入」停留，之後淡出 | 2 秒；淡出 0.5 秒（出現 0.22 秒） |
| 失敗停留 | 4 秒 |
| 時間軸、地震回放、歷史軌跡播放中 | 只顯示「載入中」，停下後才顯示「已載入」 |
| 換任務 | 只換文字（0.16 秒淡入），框不重跑出現動畫 |

- **失敗怎麼判定**：`withLoading` 的 Promise reject，或 Supabase 回傳 `{ error }`，都算失敗（`loadingRegistry.end(id, true)`）。`keepLoadingUntilMapIdle` 的逾時保底不算失敗。
- **減少動態**：`prefers-reduced-motion` 時不位移、不轉圈，只淡入淡出。
- **實作**：`src/components/LoadingStatus.tsx`＋`loadingStatus.css`；事件來源 `loadingRegistry.subscribeEvents()`。
- **禁止**：另做一個右上載入提示；用 z-index 1000 壓過面板；載入一結束就立刻讓提示消失。

### 5.31 Agent 處理中光暈

2026-09-28 拍板（同一比較頁的 A1）。Agent 執行步驟（`working`／`presenting`）時，地圖四周加一圈很淡的強調色內光暈，告訴使用者系統正在處理。

- **顏色**：`--accent`（淡色底圖由 `.research-activity-position--light` 換成 `--light-accent`）；內陰影 `inset 0 0 40px` 22%＋`inset 0 0 110px` 10%。不用白色（舊版在淡色底圖上是一圈白邊）。
- **動態**：節點常駐，只切換 class：淡入 0.6 秒、淡出 0.9 秒；**不忙碌 1.5 秒後才熄**（`GLOW_LINGER_MS`），步驟之間短暫不忙碌時不會熄滅再亮起。不做無限循環的明暗閃動。`prefers-reduced-motion` 時不做過渡。
- **實作**：`src/research/ResearchActivityCard.tsx`（`useLingeringFlag`）、`researchActivity.css`。

### 5.32 地圖圖例（legendKit）

2026-09-28 拍板（`map-layers.md` §4.2，LG-1–LG-12）。新圖例一律用 `src/components/legend/legendKit.tsx`，不再手寫色票尺寸。

- **結構**：`LegendTitle`（標題）→ `LegendRow`（色票＋標籤）→ `LegendNote`（註記、方法、來源）。組間距 10、列間距 2–4、色票與文字間 6。
- **標題**（LG-11）：`<LegendTitle zh="醫療據點" en="Medical" />`：中文 10px 600 `textStrong`，英文 9px `textDim`、不轉大寫，中文在前。不要再寫「MEDICAL 醫療據點」或「污染嚴重度 SEVERITY」。
- **色票**：`SwatchDot` 10px 圓＋1px 底圖色描邊（LG-1）、`SwatchSquare` 12×10 圓角 2（LG-2，`outline` 為框線面）、`SwatchLine` 20px 線段含虛線（LG-4）、`SwatchSteps` 分級列＋分界數字（LG-3）、`SwatchGradient` 漸層條（LG-8）、`SwatchHatch` 缺值單向細斜線／遮蔽交叉斜線（LG-7）。
- **色票參數**（R4 補）：`SwatchDot` 可帶 `stroke`／`strokeWidth`（地圖描邊是資料編碼時照畫，例：設施狀態框）與 `glow`（即時光暈）；`SwatchSquare`、`SwatchGradient` 可帶 `stroke`（面外框，分級面／網格用 `mapSeamColor(isDark)`，與 R3a 地圖細縫同源）；`SwatchLine` 可帶 `opacity`。
- **色票同源**（R4）：色票顏色一律 import 與地圖 paint **同一個常數**（`src/map/layerPaintColors.ts`、各 `src/data/*Types.ts`），不在 `LegendPanel.tsx` 重抄色號；地圖暗淡不同色時，圖例依 `isDark` 取同一邊。
- **主題**（LG-12）：文字色只用 `useLegendTheme()`（`DARK_LEGEND`／`LIGHT_LEGEND`），不直接用 `COLORS.*`。文字色取 `COLORS`／`LIGHT`；暗色 `bgSubtle`、`border` 目前是 inline rgba（§10.3）。
- **尺寸常數**：`LEGEND_SWATCH`（點、方塊、線、分級、漸層、斜線、icon 14、間距 6）。`SwatchDot`／`SwatchSquare` 預設不透明度 0.9。
- **尚無元件**：LG-5 大小（三圓）、LG-6 icon 還沒有共用元件，逐層做時補。
- **字型**（LG-10）：面板容器 `FONT_CJK`；數字、分界、單位用 `LegendNum`（`FONT_DATA`＋tabular-nums）。
- **精簡版**（LG-9）：`LegendPanel` 的 `compact`（停靠 popup 開著時）會讓 `LegendNote` 不顯示；色階、分界、單位不可收。
- **禁止**：手寫 `width／height` 色票（ratchet 只准減少）；英文大寫標題；在圖例裡用 `FONT_DATA` 包中文。
- **實作**：`src/components/legend/legendKit.tsx`；地圖側缺值斜線 `src/map/mapStyleScale.ts` `hatchImageData()`，圖例與地圖同一組顏色。

### 5.33 開站畫面（W2 城市脈動＋M2 機關展開）

- **用途**：第一次打開網站、地圖還沒畫好之前的全螢幕畫面；只出現一次，之後的載入都走 §5.30 載入狀態條。
- **開頭**：台灣輪廓淡入 0.7s，品牌字與狀態列 0.3s 後淡入 0.5s；城市脈動等淡入完成才開始（試過由小彈出，不自然，改淡入）。
- **等待（W2）**：底色 `SURFACE.app`（淡色 `--light-surface-solid`，依開站 URL 的 `style` 決定）。中間是台灣本島＋離島輪廓（澎湖、金門、馬祖、綠島、蘭嶼、小琉球、龜山島；不含東沙、太平島、釣魚台），填 5% 強調色（淡色 6%）、0.5px 強調色描邊，輪廓整體不透明度 0.75。九個城市點由北往南依序亮起並擴出波紋：馬祖、台北、新竹、金門、台中、花蓮、澎湖、台南、高雄。
- **版面（2026-09-29 以調整工具定案）**：本島高 `19vh`；**本島外框中心**對齊視窗中心再往上 `4.5vh`（X 0）；城市點直徑 5.8px（以 900px 高視窗為準，隨高度等比）；波紋放大 ×6；一輪 2.2s；不顯示城市名稱。本島下緣再往下 `3.5vh` 放品牌字「MINI TAIWAN PULSE」（`FONT_DATA` 700、`clamp(11px, 2.08vh, 20px)`、字距 0.3em、不透明度 0.85、PULSE 用強調色）與狀態列。
- **狀態列**：與 §5.30 同款（高 22、`--font-sm`、`SURFACE.strong`、`BORDER.panel`、`RADIUS.lg`）；文字「載入地圖」→「✓ 完成」。**文字中心對齊中線**（「入」「地」之間），圖示掛在左側，不計入置中。
- **收尾（M2）**：地圖就緒 → 「✓ 完成」停 0.4s → 遮罩淡出 0.45s（內容同時放大 1.04）→ 主畫面元件從邊界彈入：側欄從左、工具列從上、時間軸從下、左上標題最後落下，`cubic-bezier(0.34,1.56,0.64,1)` 0.85s，依序延遲 0／0.12／0.24／0.36s；側欄圖示 0.4s 逐一放大彈出（延遲 0.4–0.7s）；整段約 1.6s（2026-09-29 依使用者要求比初版慢約 0.5s）；工具列與時間軸到位時閃一下強調色光暈（像機關卡住）。
- **做法**：`<html data-boot="wait|enter">` 控制（`src/main.tsx` 在 render 前先設 `data-boot="wait"`），要參與進場的元件只標 `data-boot-part="rail|toolbar|timeline|title"`，不必接 props；進場結束後移除 `data-boot`。30 秒還沒就緒直接跳到淡出。
- **減少動態**：不跑波紋與彈入，只淡出。
- **開站加速（同一輪）**：地形（DEM）只在傾斜視角時才載入（`src/map/MapView.tsx` `ensureTerrainIfTilted`，傾斜後不再移除），正俯視開站不再等 DEM 圖磚。
- **禁止**：假進度條、log 終端框、漸層光暈進度（舊版已移除）；在開站畫面加入即時數字（開站時還沒有資料，會變成假數據）。
- **實作**：`src/components/LoadingScreen.tsx`、`src/components/boot/`（`bootSequence.ts` 規格與時間、`taiwanOutline.ts` 輪廓資料、`bootScreen.css`）、`src/App.tsx`（`bootPhase`）、`src/main.tsx`。設計稿：`docs/features/ui-consistency-audit-20260927/boot-*-sheet.html`、`boot-w2-tuner.html`。

### 5.34 分析卡片頁（`/card/<slug>`）

#394 上線、#399 修數值格式。本節只記現況，視覺細節尚未逐項稽核。

- **用途**：Agent 分析結果的分享卡片；獨立頁面，也在與 Agent 協作面板裡當草稿預覽。卡片版式依 `docs/features/viz-library/DECISIONS.md` §6 E1（直式 4:5）。
- **入口**：`card.html`＋`src/card/main.tsx`；`/card/<slug>` 由 vite 開發外掛與 nginx `location ^~ /card/` 導到 `card.html`。地圖用 **MapLibre**（不載 mapbox-gl）。
- **版面**：卡片最寬 480px、`aspect-ratio: 4 / 5`（寬 ≤ 420px 時取消比例）；上方地圖 5:3，下方標題、期間、數字、長條、但書、來源、頁尾。草稿預覽以 `--card-scale: 0.72` 等比縮小。
- **token**：`card.css` 顏色、字級、間距、圓角、陰影全部用 `tokens.css` 變數（卡片底 `--surface-solid`、`1px --border-panel`、`--radius-xl`、`--elevation-md`；圖例底 `--surface-strong`；但書 `--status-warn`；品牌字 `--accent`）。
- **地圖**：配色取 `vizSpec` 暗色組（與主站分析結果同一套取色規則）；圖例色票 12×8；地圖標籤 11px（點）／12px（面）、halo 1.2／1.4（字型 `LABEL_FONT`，與 map-layers T-1／T-2 不同，待確認是否要對齊）。
- **暗／淡**：**只有暗色**（`CARD_THEME = "dark"`），與 §1「暗／淡並行」不一致，列在 §10.3。
- **實作**：`src/card/`（`CardApp.tsx`、`AnalysisCard.tsx`、`CardMap.tsx`、`cardStyle.ts`、`card.css`）。

### 5.35 監看模式卡片

2026-10-01 拍板（比較頁 `docs/features/monitor-restyle/picks.html`，代號 A1／B1／C3／D3／E3／F3＋雙主圖／G2／H2／I2／K1）；實作分階段見 `docs/features/monitor-restyle/README.md`「實作順序」。盤點與證據同目錄（2026-09-30）。

**實作狀態**：P1 完成（卡片殼、標題列、面板標頭中文化、窄格不溢出、新舊版切換）；P2a 完成（監看字級 S13）；P2b 完成（共用數值列與走勢，上半部、災害四卡、食品、加權指數、公衛、在監）；P3 完成（8 張多指標卡）；P4 完成（來源新鮮度、缺值修正，見下「新鮮度實作」）；P5 完成（淡色版，見下「主題（H2）」）；P6 未開始。活的元件頁 §13。

- **監看字級 S13**（2026-10-01 使用者在 `docs/features/monitor-restyle/fonts.html` 選定；只用在新版監看模式）：最小 13px。新版取消內容整體放大 1.15（舊版保留）。

  | 角色 | px | 變數 |
  |---|---|---|
  | 軸上日期、英文小字、來源列、角標 | 13 | `--mon-f-cap` |
  | 小節標、KPI 標籤、資料時間、pill | 13 | `--mon-f-label` |
  | 正文、清單、單位 | 14 | `--mon-f-body` |
  | 卡片標題 | 16 | `--mon-f-title` |
  | KPI 數值 | 19 | `--mon-f-kpi` |
  | 主數字 | 24 | `--mon-f-main` |

  行高：卡內預設 1.45（`.mtp-mcard`），卡內區塊間距 10px；主數字等自訂行高的不受影響。

  實作：`monitorFont.ts`（`MON_FONT_PX`、`MF`、`fs(v2, legacyPx)`：≤9.5→cap、≤10.5→label、≤12.5→body、≤15→title、≤21→kpi、≥22→main；≥36 的一次性大字原樣）、`monitorCard.css` 變數。全站 7 階（§3.13）不變；監看以外（即時情報面板等）不受影響。

- **新舊版切換**：面板標頭「新版／舊版」，預設新版，存 localStorage `mtp-monitor-style`；舊版是改版前畫面原樣，供對照或退回。各卡以 `useMonitorV2()` 分支，**舊版樣式值不改**。
- **資料時間來源**：卡片用 `useMonitorCardHeader({ time, timeText, state })` 送到標題列；由 MonitorPanel 組裝的格子用 `<MonitorCardTime>`。一律送**資料本身的時間**（觀測、發布、報表日），**不送瀏覽器收到回應的時間**。新聞四格＝新聞管線彙整時間（RPC `aggregated_at`＝`live.news_events_daily.refreshed_at`，每 30 分彙整、凌晨也會前進；migration 425），最新一則發布時間已超過 12 小時則改用發布時間判斷並在卡底寫「收集可能停了」；環境輻射＝有回報站的最新觀測時間（停報站不算）。拿不到資料時間的格子不顯示時間：警訊整合（警報 RPC 只回計數）、災防觀測（寫死的 YouTube 影片，無資料時間）。
- **固定高格補償**：多了標題列與 S13 字級後，上半部固定高格子依 1920／1496 實測加高、其下格子順移，左右兩欄仍同止（`MonitorPanel.tsx` `V2_ADJUST_*`）：split 警訊 8、熱區 6、信號分級 6 列（新聞事件讓出 1 列，清單本來就捲動）；dock 新聞 15、警訊 9、熱區 6、時間軸 10、信號分級 5 列。

- **用途**：監看模式（Monitor）split／dock／wall 裡的每一格看板。改版前 `MonitorPanel` 只排位置不畫框，24 格各自手刻（3 種框、5 種標題、9 種主數字字級、5 套時間序列、約 20 處缺值畫成 0）。
- **不新造通用 Card**（§11 KEEP OUT）：把既有 `HazardShell`（＋`Metric`／`MetricRow`／`Note`／`MetaRow`）升格成監看卡標準殼，`Widget`／`SectionLabel` 收斂進去。
- **卡片殼（A1）**：`MonitorPanel` 統一畫框，各卡不再自畫；`1px BORDER.panel`、`RADIUS.lg`、padding `10px 12px`；標題列是卡的第一列。不再有框外段落標、無框卡、卡內第二層英文標題、個別卡片額外 `zoom`。
- **尺寸階（B1）**：格寬 小 1/3（w4）／中 1/2（w6）／全寬（w12）；圖高 迷你 24（列內）／標準 48（卡內主圖）／大 96（全寬主角圖）。圖一律寬 100% 隨格子伸縮，不寫死 px。
- **標題列（C3）**：13px bold 中文標題＋9px `textDim` 英文名（§6.1 小字附註）；右側資料時間 10px `FONT_DATA`（當日 `HH:MM`、跨日 `MM/DD`）；只有異常才在時間前加 `chipOutline` pill。窄格放不下時**先隱藏英文名**，中文標題、時間、pill 必留。不用英文大寫；面板標頭照 §5.1（`MONITOR`／`BETA`／`SITUATIONAL AWARENESS` 一併中文化）。
- **數值列（D3）**：一格一個主數字＋其餘指標 KPI 列（標籤在上）＋副資訊。字級依 S13：主數字 24、KPI 19、標籤與副資訊 13（原提案 22／18／10 已由 S13 取代）。單位照 §6.2；漲跌色依領域（股市紅漲綠跌，其他依好壞）。
- **走勢圖（E3）**：連續量（指數、比率、人數、MW）用折線＋淡面積＋最新點＋首尾日期；計數（次數、件數、架次）用柱。缺值：折線斷開並在缺段畫斜線帶（與地圖缺值斜線同語彙）／柱為灰色短樁；0＝底線。由擴充 `TimeseriesSparkline`＋`HazardTrendBars` 的同一個走勢元件出，不再手刻 SVG／CSS 柱。
- **共用數值列與走勢（P2b 實作）**：`MonitorMetric.tsx`（`MonitorMetric` 主數字／`MonitorKpis`／`MonitorSub`／`MonitorNote`，由 `HazardCards` 私有元件升格）；`monitorChart.ts` `MON_CHART_H`；`TimeseriesSparkline`、`HazardTrendBars` 的 `heightTier`（圖區高度，只在新版生效）。新版折線：缺口斜線帶、最新值圓點、上留白 10（有單位 18，單位字放留白裡）、Y 軸字最多底中頂三個（圖區 < 60 只留底頂）。資料是時段桶或只有序列、沒有時間戳時（警訊 24 小時、公衛週次）保留原圖，只對齊圖高、字級與首尾標籤，不捏造日期；類別堆疊（時間軸）與異常日區帶（食品）也保留原圖。
- **多指標卡（F3＋雙主圖）**：
  - 主圖＋其餘小倍數列（名稱｜走勢｜最新值，同寬同高、共用時間軸、各自比例尺，不另放圖例）。
  - **全寬卡最多 2 個主圖並排**，各配一個 22px 主數字（例：供電＝備轉容量率＋供電能力 vs 尖峰負載）；半寬以下的卡只放 1 個主圖。這是 D3「一格一個 22px」的唯一例外。
  - 同單位最多 3 條可疊在同一張主圖，名稱標在線尾；不同單位一定分圖。
- **多指標卡逐卡排法（P3，2026-10-02 使用者在 `docs/features/monitor-restyle/p3-picks.html` 選定）**：
  | 卡 | 選 | 排法 |
  |---|---|---|
  | 供電 | P-A | 兩個主圖並排：備轉容量率（大圖）｜供電能力 vs 尖峰負載（同單位疊線）；四區用電收成副資訊；電廠小倍數（登入後） |
  | 急診壅塞 | E-A | 主數字＋分級堆疊條＋14 天主圖（缺口斜線）＋依區分組的 60 院小格（迷你線改用時間軸） |
  | 共機擾台 | L-A | 主數字（架次）＋嚴重度 pill＋120 天大柱（柱高＝架次、色＝分級，**越中線架次疊在柱底**——使用者補充）＋空域方位、侵擾方式兩組橫條並排 |
  | 特殊船舶 | V-A | 合併大柱（色＝最深分帶）＋四分帶小倍數（同一把尺）＋三類船天數副資訊 |
  | 中國 ISR 衛星 | I-A | 主數字＋相對位置 pill＋標準柱＋一行色塊圖例＋一行說明 |
  | 台鐵誤點 | T-B | 三個 KPI 並列（不分主次）＋三線疊圖大圖＋最誤點車次收合 |
  | 網路觀察 | N-A | 即時指標數＋Atlas 四指標小倍數（IPv4／IPv6 雙線、**近 7 天正常範圍色帶**）＋RIS 一行狀態＋「怎麼看」說明（使用者補充：看不出是否正常） |
  | 機場入出境 | A-A | 入境、出境疊成同一張圖＋主數字（入境）＋KPI（出境） |
- **多指標卡共用元件（P3 實作）**：`MonitorRows`（小倍數列：名稱｜圖｜最新值）；`TimeseriesSparkline` 的 `bare`（v2 不畫軸，小倍數用）、`band`（正常範圍色帶）、`moreSeries`（第三條以後的同單位線）；`HazardTrendBars` 的 `bare`、`part`／`partColor`／`partLabel`（柱底疊子量，共機越中線用藍色——第 5 級柱本身是紅，紅疊紅看不出）、`maxValue`（小倍數同一把尺）。折線與柱的 `bare mini` 總高都是 28。
- **網路觀察殘缺量測**：RIPE Atlas collector 每 5 分鐘覆寫上一桶，桶內只剩約 100 秒的探針（`internet-health-reading.md`）。新版只畫探針數 ≥ 預期 80% 的完整桶，24 小時線每小時取完整桶加權平均成一點，整小時沒有完整桶畫斜線；即時值取最近一個完整 5 分鐘桶。collector 修好前大段斜線＝量測殘缺，不是網路異常（卡底「怎麼看」說明）。正常色帶（IPv4／IPv6）：Ping 97–100／83–92%、RTT 4–5.5／4–12 ms、Probe 回報 90–100%、可達 ASN 85–100／70–85%（30 天完整桶，建議值）。
- **狀態提示（G2）**：狀態字見下表（擴充 §6.4）。過期／停更時主數字改 `textMuted`、走勢在最後一筆之後到現在畫斜線、卡底一行原因（10px）。收盤／休市只出中性 pill、不降灰。受影響（資料本身的警訊，如供電吃緊、急診壅塞）用數值與圖的顏色表示，不改卡底、不加色條。
- **主題（H2）**：監看模式跟底圖主題切換暗／淡（取代 §5.21 原本「刻意維持全暗」）。淡色值只取 `LIGHT`；資料色文字走 `chipText()` 並逐格驗對比；影片牆（YouTube iframe）本身維持暗。
  - **P5 實作（2026-10-03 使用者在 `docs/features/monitor-restyle/p5-picks.html` 選 S1／W1／D2／P2／X1／R2）**：S1 白卡（`--light-surface-solid`）疊淡灰面板 `rgba(243,244,246,0.95)`；W1 分割／停靠 95%、全屏不透明 `#f3f4f6`；D2 資料色當填色／線經 `monitorTheme.fill()` 加深到對白至少 3:1（文字走 `text()`＝`chipText`）；P2 標題列 pill 淡底實心（`color-mix` 12%）；X1 斜線黑 12%、灰樁黑 6%；R2 壓力環淡色保留等級色光暈、中間數字用等級色。卡片與共用圖表一律 `useMonitorTheme()`（`monitorTheme.ts`），暗色值與改版前字面值相同，所以一般彈窗（沒有 Provider）裡的共用折線不變。舊版一律暗。
- **指數化（I2）**：分領域子指數 **災害**（颱風、地震、落雷、輻射、警訊）、**民生**（供電、急診、食品價格、公衛）、**國防**（共機、特殊船舶、ISR 衛星）、**網路與交通**（網路觀察、台鐵誤點、機場入出境）。戰情壓力總指數先修好（K1），子指數上線後改由子指數加權合成，權重公開、可展開到原始值。子指數需 gis-platform 預先彙整表與排程（migration 由使用者拍板），排在前端改版之後。停更來源不得默默拉低指數：要在指數旁標出缺了哪些來源。
- **缺值修正（K1）**：這輪一起把 loader／元件的 `?? 0`、`|| 0`、補 0 改成保留 null；壓力指數 loader 改讀 `updated_at`、`per_signal` 改讀物件；熱區「熱度倍數」合成值改成真實比較或拿掉。RPC 端缺值補 0 已於 migration 425 改回 NULL（公衛 yoy、加權指數 change_pct、壓力指數 vs_baseline／vs_1h_ago）；熱區 `get_news_trending.baseline_avg` 的 `COALESCE(…,0)` 刻意保留（前端以 0 判斷「新」）。上游停更另開資料工單。
- **窄格規則**（2026-10-01 使用者在比較頁抓到示意卡數字互壓、標籤被截、漲跌斷行）：
  - 卡片 `overflow: hidden`＋`min-width: 0`，內容不得畫出格子（改版前 `fit:"content"` 格是 `overflow: visible`）。
  - 主數字、KPI 數值、漲跌、時間 `white-space: nowrap`；放不下時整組換行，不在數字中間斷行、不縮字。
  - KPI 列自動折行（每格最小 110px；S13 字級下 96px 放不下，2026-10-02 調整）。副資訊每一項是不可拆的一組。
  - 標題列：標題與時間同一行優先，pill 放不下才換第二行；標題不截成「…」。
  - 走勢軸字卡寬低於 240px 時只留首尾日期。
  - 驗收：1496px（split 不退化單欄的最窄寬度）與 1920px 螢幕，w4／w6 格逐格截圖，暗淡各一。

**狀態字**（擴充 §6.4；「週期」＝該格來源的預期更新間隔，每格實作時登記）：

| 狀態 | 條件 | 顯示 |
|---|---|---|
| 即時 | 最新資料在 1 個週期內 | 只顯示時間 |
| 延遲 | 超過 2 個週期 | 時間改 `statusWarn` |
| 過期 | 超過 6 個週期或已跨日（日更資料超過 2 天） | pill「過期」`statusWarn`＋G2 畫法 |
| 停更 | 超過 7 天，或來源已下架 | pill「停更 N 天」／「來源已下架」`statusErr`＋一行原因 |
| 無資料 | 從未取得 | 「—」＋原因（§6.5） |
| 收盤／休市 | 來源依時段正常暫停 | 中性 pill，不降灰 |
| 讀取中／更新中斷／無權限 | 傳輸狀態（現有 `MonitorDataStatus`） | 維持現行 |

- **新鮮度實作（P4）**：週期登記在 `monitorCardMeta.ts` 的 `fresh`，判斷在 `monitorFreshness.ts`（`judgeFreshness` 純函式＋`useMonitorFreshness(widgetId, { time, timeText, dataMs, paused, retired, reason })`，取代卡片直接呼叫 `useMonitorCardHeader`）。週期類型：
  - `stream`（每 N 分）：> 2 週期延遲、> 6 週期過期、> 7 天停更。新聞四格 30、警訊 15、輻射 15、網路觀察 5、供電 10、急診 15、機場 60、戰情概覽 60。
  - `days`（日／週批次，以台灣日期差）：> `staleDays`（預設 2）過期、> `stoppedDays`（預設 7）停更。食品、台鐵 3 天（T+1＋週末）；公衛週報 14／35 天；在監、共機、ISR 預設。
  - `market`：加權指數盤中 1 分；收盤傳 `paused` 只出中性 pill，資料超過 4 天仍轉過期（避免收集器死在收盤後永遠掛「收盤」）。
  - `event`：地震、落雷、颱風、特殊船舶——最新事件時間不代表來源活著（沒船、沒落雷的日子本來就沒有列），不判過期。
  - 不登記：新聞直播、災防觀測（沒有資料本身的時間）。
  - 走勢尾段：折線 `TimeseriesSparkline staleUntil`；計數柱由 loader 把日序列補到今天、最後一筆之後補 null（灰樁），只在過期／停更時才補，平常不補（日彙整本來就落後一天）。
- **禁止**：寫死圖寬 px；缺值補 0 或合成值當資料；未就緒時用預設值決定顏色（改版前戰情概覽用 50）；印內部欄位名（`latest_valid_day`、`border_airport_snapshot`）；個別卡片額外 `zoom`；英文大寫標題；各卡自畫外框。
- **實作**（改版前位置）：`src/components/intel/monitor/`（`MonitorPanel.tsx`、`monitorSplitLayout.ts`、各卡元件）、`PressureRing.tsx`（`Widget`／`SectionLabel`／`Sparkline`）、`HazardCards.tsx`（`HazardShell`）、`HazardTrendBars.tsx`、`MonitorDataStatus.tsx`。

### 5.36 色盤選單（R7 熱區／網格配色）

- **用途**：熱區與網格圖層換色（只有這兩類；點、面、類別、語意分級圖層不提供）。規格 `layerParamsSpec.ts` 的 `kind: "palette"`（`heatmapPalette(key)`／`gridPalette(name, 預設)`），值是色盤 id 字串、不進 overlayParams；地圖、圖例、popup 一律讀 `state/layerPalette.ts` 解析器。色盤庫 `src/map/palettes.ts`（17 組，暗／淡各 7 階，數值見 map-layers §3.4 G-2）。
- **位置**：圖層控制區裡「資料篩選之後、透明度之前」（AUDIT P5）；標籤「熱區顏色」（點圖層的熱區，拉近後的點顏色不變）或「網格顏色」。
- **收合**：一列按鈕，高 20、`RADIUS.md`、框 `--control-border`、底 `--control-bg`（hover `--control-bg-hover`），左側 72×10 色條（依主題畫暗版或淡版）＋中文色盤名 10px `FONT_CJK`＋右側 lucide `ChevronDown` 12px（展開時轉 180°）。`aria-haspopup="listbox"`、`aria-expanded`、`aria-label`＝「標籤：色盤名」。
- **清單**：portal 浮在 body 上（`--z-popover`；按鈕在比彈出層高的容器裡，例如手機底部抽屜，改用 `--z-modal`，靠 DOM 順序蓋在上面），**不在面板內展開**（面板有高度上限會裁切）。寬＝按鈕寬（至少 220）、最高 360，下方空間不足就往上開；底 `--surface-solid`／`--light-surface-solid`、框 `--control-border`、`RADIUS.lg`、陰影 `--elevation-md`／`--light-elevation-lg`。長清單每列一條色帶＋中文名（11px `FONT_CJK`；預設那組加 10px「預設」小字），列高 26、hover `--control-bg-hover`、選中 `--accent-faint` 底＋右側 lucide `Check` 12px（`--accent`）。底部「還原預設」用控制區小按鈕 `.lpc-btn`（§5.7，含 lucide `RotateCcw`），已是預設時停用。
- **鍵盤**：開啟時焦點落在目前選取那列；↑↓／Home／End 移動、Enter 選取、Esc 關閉並把焦點還給按鈕；點外面關閉。每列與按鈕 focus-visible 2px `--accent` 外框。
- **禁止**：自由取色器（只能從驗證過的色盤庫挑）；用文字「✓」當選取標記；用等寬字型顯示中文色盤名；在面板內行內展開清單。
- **實作**：`src/components/sidebar/{PaletteControl.tsx,paletteControl.css}`（由 `LayerParamControls.tsx` `renderControl` 的 `palette` 分支使用）、`src/state/layerParamsControls.ts` `PaletteConfig`。

### 5.37 連動選單（C 段：統計期別／指標／細項）

- **用途**：選項要非同步載入、而且彼此連動的資料篩選（目前只有統計：指標 → 資料期別或各維度；統計群組的「指標／口徑」）。規格 `layerParamsSpec.ts` 的 `kind: "linkedSelect"`（`provider`、`field`、`dependsOn`、`primary`、`persist`），統計的規格由 `data/statisticsParamsSpec.ts` 從 recipe 目錄派生，不逐層手寫。**值不在 layerParamsStore**：provider（`state/linkedSelect.ts` 註冊表；統計＝`state/statisticsLinkedSelect.ts`，值在 `regionalStatisticsStore`）負責選項、目前值與寫入。
- **連動規則（全部 provider 共用）**：本列選項＝與上游各列目前值相符的合法組合裡本欄的相異值。改一列時，宣告在前的列不動、它設成新值，之後各列依序「目前值仍合法就保留，否則改成第一個合法值」，一定落在真實存在的組合。例外：教育固定入口的「指標」不隨換學年——目前學年沒有的指標停用並標「（此學年未提供）」（統計規則 §3）。
- **外觀**：與一般選單同一列（§5.11 V2：標籤一行、原生 `.lpc-select` 全寬一行），一律用選單不轉分段（期別字串長、選項數會隨上游變）。
- **可見**：選項 ≥2 才顯示（只有一個值的維度不佔列，目前選擇寫在「說明・來源」的「目前選擇」）；provider 尚未就緒（載入中、錯誤）且同一 provider 沒有任何一列可見時，`primary` 那一列保底顯示。
- **狀態**：狀態文字只放在同一 provider 第一個可見的那一列的數值欄（中文用 `FONT_CJK`、`--lpc-muted`）：「載入中…」「載入失敗：原因」＋選單下「重試」（`.lpc-link`）；改值後資料載入期間顯示「切換中…」、選單暫停操作（`aria-busy`）。選項還沒有時選單停用、只有一個「載入中…」選項。載入本身走 loadingRegistry（配方明細、統計數值）。
- **Agent**：`research/layerControls.ts` 列出連動選單時帶當下選項、`linked.status`、`linked.dependsOn`；設定時值必須在當下選項內（停用的也不行），選項未載入回 `LAYER_CONTROL_OPTIONS_NOT_READY`，非同步改值等資料載入後才讀回。
- **場景存檔**：存 provider 的目前值（群組「指標」`persist: false` 不存，由可見圖層表達）；還原時等圖層開啟、選項就緒後逐列驗證套用，不合法或逾時的列列進「略過項目」。
- **禁止**：在 `ExpandedControls` 或統計元件裡另寫期別／指標 select；把值複製進 layerParamsStore（兩個寫入者會互相蓋）；載入中把整列藏起來造成版面跳動（用保底列）。
- **實作**：`src/state/{linkedSelect.ts,statisticsLinkedSelect.ts}`、`src/data/statisticsParamsSpec.ts`、`LayerParamControls.tsx` `LinkedSelectControl`、`layerParamsControls.ts` `LinkedSelectConfig`／`visibleControlSpecs`。

## 6. 文案規則

### 6.1 標籤一律中文

- 標題、按鈕、eyebrow、控制項標籤、狀態、空狀態：中文。
- 英文代碼（資料集代號、機關英文縮寫、單位代碼）**只在必要時**以小字附註：`textDim`、比主文字小一階，放在中文之後（例 資料來源列的英文名、`RIPE` 這類專有名詞）。
- 不用 `text-transform: uppercase`（guard `uppercase-eyebrow`）；eyebrow 用中文分類（「交通 · 公車」）。
- 圖層控制項 `labelPrefix` 以中文開頭（guard `english-control-label`）。

### 6.2 數值與單位

依 `src/state/layerParamsControls.ts` `splitSliderLabel()`：

- 名稱與數值分欄：`labelPrefix` 結尾的運算符號（`×` `+` `≥` `≤` `±` `-`）移到數值欄：「高度 ×」→ 名稱「高度」、數值「×1.0」。
- **字母或中文開頭的單位前補一個半形空白**：`12 m`、`30 分鐘`、`5 公里`。
- **符號單位緊貼**：`80%`、`×1.5`、`≥3`。
- 數值用 `FONT_DATA`＋`tabular-nums`；千分位用 `toLocaleString("zh-TW")`。

### 6.3 不印內部識別碼

- `datasetId`、倉庫代號（`warehouse:wh-8`）、layer key、indicator id 不直接顯示。
- 顯示前先過映射：資料集 → `describeDataset(datasetId).label`（`research/MainMapConnection.tsx`）；圖層 → `HEADER_LABELS`／`layerCatalog` 中文名；統計 → `statisticsDataSources` 定義；統計參考邊界代碼（`COUNTY_MOI_1140318` 等）→ `data/statisticsLabels.ts` `boundaryVersionLabel()`／說明文字裡夾帶的用 `humanizeStatisticsText()`（代碼仍留在資料集欄位）。
- 映射查不到時顯示中性文字（例「未命名資料集」），不 fallback 成代號。
- 除錯需要看代號時放在 `title` tooltip 或開發者面板，不放在主要文字。
- guard `internal-id-display` 為**只記錄不擋**的啟發式（§9.2）。

### 6.4 狀態用字

| 情境 | 用字 | 色 |
|---|---|---|
| 上游資料已對上目錄 | 已接上 | `statusLive` |
| Pulse 自行計算／衍生 | 派生 | `statusDerived` |
| 目錄尚缺 | 待補 | `statusWarn` |
| popup 無來源 | 資料來源 · 來源資訊待補 | `warn` |
| 載入中 | 載入中…（走 loadingRegistry） | `textMuted` |
| 缺值 | —（不寫 0） | `textDim` |

### 6.5 null 不當 0

- 缺值／過期／錯誤各自有文字，不合成為 0、「正常」或預設座標。
- `Row` 值為空時不渲染；統計、圖表的缺值要能和 0 區分。

## 7. 禁止事項總表

| ❌ 不要 | ✅ 改成 | guard |
|---|---|---|
| 中文用等寬字（`FONT_DATA` 包中文） | 容器 `FONT_CJK`，只把數字包 `FONT_DATA` | `font-data-on-cjk` |
| 寫死 hex／rgba（元件、CSS） | token／`var(--…)`；資料色見 §3.16 | `hex-literal-in-ui-css`（CSS） |
| 原生 `type="range"` | `controls/Slider`（圖層控制走 `ParamControlList`，內部同一元件） | `native-range` |
| 寫死 ≥10 的 `zIndex`／`z-index` 數字 | `Z_INDEX.*`／`var(--z-*)`，同層靠 DOM 順序（§5.25） | `raw-z-index` |
| 沒有功能的占位按鈕（「規劃中」設定鈕等） | 有功能時再加入口 | — |
| 會切換文字的按鈕寬度跟著文字跳 | 固定寬或最小寬（§5.27） | — |
| `▶` `▼` 字元當 chevron／播放 | lucide `ChevronRight`／`Play` | `triangle-chevron` |
| 英文大寫 eyebrow、`uppercase` | 中文 eyebrow，不轉大寫 | `uppercase-eyebrow` |
| 控制項英文標籤 | 中文 `labelPrefix` | `english-control-label` |
| 另開一套淡色色票 | `LIGHT`／`--light-*` | TS↔CSS 同值測試 |
| 載入 web font、引用 Inter／JetBrains Mono／Georgia／宋體 | `--font-cjk`／`--font-data` | `web-font` |
| 新根容器沒設 `fontFamily`（落到襯線字） | 根節點設 `FONT_CJK` | — |
| 印 `datasetId` 等內部代號 | 人類可讀映射 | `internal-id-display`（記錄） |
| `SURFACE.*` 當按鈕底 | `CONTROL.*` | — |
| 純文字「×」關閉鈕 | `<X size={14}/>` | — |
| 缺值顯示 0 | 「—」或不渲染 | — |
| 手寫圖層控制 JSX | `layerParamsSpec.ts` 規格 | `layerConsistency` |
| 自訂新 radius／font size | §3.10／§3.13 階 | — |

## 8. 新增 UI checklist

PR 前逐項勾（貼進 PR 描述）：

- [ ] 顏色全部來自 `designTokens.ts`／`tokens.css`；資料色（§3.16）有註明來源
- [ ] 淡色底圖（`light`／`streets`）下看過，淡色值取自 `LIGHT`／`--light-*`
- [ ] 容器 `FONT_CJK`；只有數字／時間／座標／代碼用 `FONT_DATA`＋tabular-nums
- [ ] 字級、圓角、間距、陰影在 token 階上
- [ ] 所有使用者可見文字是中文；英文代碼只以小字附註；沒有 `uppercase`
- [ ] 沒有顯示內部識別碼；缺值不顯示為 0
- [ ] 面板用 `PanelHeader`（H2，傳 `eyebrow`）；popup 內容用 `Title`／`Row`／中央 `SourceFooter`
- [ ] 控制項符合 §5.7–§5.16（C2 按鈕、分段、原生 select、迷你開關、S1 滑桿、lucide chevron）
- [ ] 圖示按鈕有 `title`＋`aria-label`；開關有 `role="switch"`；focus-visible 有 2px accent 外框
- [ ] 層級用 `Z_INDEX`／`--z-*`，沒有新的寫死數字；新左側面板已加入互斥清單（§5.25、§5.26）
- [ ] 沒有「規劃中」之類沒有功能的按鈕
- [ ] 窄螢幕（手機寬度）不橫向溢出
- [ ] `npx tsc -b` 綠；`npx vitest run src/styles/__tests__/designSystemGuard.test.ts` 綠
- [ ] 若 guard 顯示違規減少：已執行 `npm run design:baseline` 並 commit 基準
- [ ] 若新增 token：TS 與 CSS 同時加，並補本檔 §3 表格

## 9. 自動檢查（guard）

### 9.1 做法（ratchet）

- 測試：`src/styles/__tests__/designSystemGuard.test.ts`（含規則單元測試、ratchet 比對、TS↔CSS 同值）。
- 規則：`src/styles/__tests__/designSystemGuardRules.ts`；基準：`src/styles/__tests__/designSystemGuard.baseline.json`（`{規則: {檔案: 筆數}}`）。
- 範圍：`src/**/*.{ts,tsx,css}`，排除 `__tests__`、`__fixtures__`／fixture、`*.test.*`。
- **任何檔案計數增加、或新檔案出現違規 → 測試失敗**，訊息列出檔案、規則、增加數、怎麼改與本檔章節。
- 計數減少 → 只提示；執行 `npm run design:baseline` 把基準降下來。
- `npm run design:baseline` **只會往下降**：有新增違規時拒絕寫入並 exit 1。`--reset` 會整份重建，只用於基準遺失或規則定義本身改變，且必須在 PR 說明。
- ⚠️ **guard 紅燈不可用改基準繞過**。唯一例外是本檔 §4.2／§3.16 已登記、或經拍板新增的刻意例外——先改本檔登記，再在 PR 說明為何 `--reset`。

### 9.2 規則與目前基準（2026-09-29）

| 規則 | 擋什麼 | 擋／記錄 | 基準筆數（檔案數） |
|---|---|---|---|
| `web-font` | `fonts.googleapis`、`@font-face`、`"JetBrains Mono"`、`Inter,`、`Georgia`、`Songti` | 擋 | 0（0） |
| `hex-literal-in-ui-css` | `src/research/*.css`、`src/components/**/*.css` 的 `#rgb`／`#rrggbb`（`src/styles/**` 除外） | 擋 | 4（2） |
| `native-range` | `type="range"`／`type: "range"`（只有 `controls/Slider.tsx` 除外） | 擋 | 0（0） |
| `triangle-chevron` | `▶` `▼` 與 escape（註解與 `▲▼` 趨勢成對不算） | 擋 | 5（4） |
| `english-control-label` | `layerParamsSpec.ts` `labelPrefix` 英文開頭 | 擋 | 1（1） |
| `uppercase-eyebrow` | `textTransform: "uppercase"`／`text-transform: uppercase` | 擋 | 3（2） |
| `font-data-on-cjk` | 啟發式：`FONT_DATA` 元素的直接子文字含中文（同一行內） | 擋 | 3（3） |
| `raw-z-index` | `zIndex: <n>`／`z-index: <n>` 且 n ≥ 10（`src/styles/**` 定義檔除外；0–9 元件內部小值不算） | 擋 | 17（15）（#390 刪除 `LoadingIndicator` 後） |
| `internal-id-display` | 啟發式：`datasetId` 放進 JSX 子節點或 `title`／`label`／`desc`／`text` 欄位 | **只記錄** | 1（1）（2026-10-03 B 段修掉資料來源卡 2 處） |

`raw-z-index` 於 Phase Q 新增，基準以 `design:baseline --reset` 由當下程式碼建立（規則新增屬 §9.1 的 reset 條件；其他規則的值同時只降不升）。已登記的特例（§5.25 特例表）也計在基準內——它們不會再增加，但也不會自動歸零。

**誤判與漏判**：
- `font-data-on-cjk` 只看同一行；跨行的 JSX（例 F2 footer 第二行）不會命中，屬已知漏判。正確混排寫法（中文在外、數字 span 在內）不會誤判。
- `internal-id-display` 會命中「先顯示標題、查不到才 fallback 代號」的寫法（`DataSourcePanel.tsx` 原有 2 處屬此類，2026-10-03 已修）；但也可能把合法的 tooltip 或除錯欄位算進去，因此只記錄不擋。
- `web-font` 的 `Georgia` 也會命中資料中的國名（目前 0 筆）；遇到時把字串移到資料檔（`src/data/**` 同樣受掃描，需在 PR 說明）。
- `raw-z-index` 只看 `zIndex:`／`z-index:` 後直接接數字的寫法；`zIndex: cond ? 50 : 10`、字串拼接或變數不會命中（漏判）。註解行不算。
- `triangle-chevron` 同時擋播放鍵 `▶`（應改 lucide `Play`）；`▲▼` 成對的升降趨勢不擋。

## 10. 遷移狀態

### 10.1 歷史

| Phase | 範圍 | 狀態 | Commit／PR |
|---|---|---|---|
| 0 | 建 `designTokens.ts` + 本文件 | ✅ | `d9aaf28` |
| 1 | 面板背景＋陰影 → `SURFACE`／`ELEVATION` | ✅ | `1cb6f9b` |
| 2 | `"monospace"` → `FONT_DATA` | ✅ | `86391f4` |
| 3 | 散落 rgba 白 → `COLORS.text*` | ✅ | `cc744e1` |
| 4 | borderRadius／fontSize 收斂 | ✅ | `7ee817b` |
| 5 | 災害語意色對齊 `LAYER_COLORS` | ✅ | `c6a4e7e` |
| 6 | CloseButton／Loading 統一 | ✅ | `22c8d64` |
| A | `tokens.css` 全站 CSS 變數、系統字 stack（不載 web font） | ✅ | UI 統一第一輪 |
| B | popup 容器改 `FONT_CJK`、`Row mono` | ✅（mono 只套 4 處） | |
| C | 共用 `Title`（13 檔收斂） | ✅ | |
| D | F2 `SourceFooter` 中央掛載＋排除清單 | ✅ | |
| E | popup 全部停靠右下、R2 選取圈、L2 群組、時間軸 `border-left` | ✅ | |
| F | `CONTROL.*`、research／member CSS 接 token、research 頁暗色化 | ✅ | |
| G | 工具列 T2、B3 底圖、P2 拍攝模式 | ✅ | |
| H | 即時情報 H2、分段、徽章兩公式 | ✅（無淡色） | `cb7ba0c4` |
| I | 圖層控制 V2＋S1、標籤中文化 | ✅ | `79a23cf8`、`6b0ffa34` |
| K | 資料來源面板 D1 | ✅ | `75c4c669` |
| J | 淡色／控制 token 收斂、本文件改寫、參考頁、guard | ✅ | #368 |
| L | 即時情報 Intel 面板淡色主題（`intelTheme.tsx` palette／徽章對比公式） | ✅ | `220a7685`、`5ebb3fb4` |
| M | 左下時間軸 TL3 刻度軸（即時＋歷史） | ✅ | `20d1fd94`、`cc8c2827` 起 |
| N | 第二輪：Layers 主題列 LT1、Inter 殘留改 `FONT_CJK`、移除 rail 設定鈕（S1） | ✅ | `efff01d4`、`099cf4c6`、`4a643ac6` |
| O | 第二輪：`Z_INDEX` 層級（Z1）＋左側面板互斥、手機標頭 M1 | ✅ | `8b4a6f43`、`a22daf14` |
| P | 第二輪：說明／分享視窗 H2、分享欄位 `1fr auto`、共用滑桿 `controls/Slider` | ✅ | `1370a736`、`3f8b9741`、`8c7f9fd5` |
| Q | 第二輪收尾：置中視窗／對話浮層／會員面板歸層、Agent 透明度滑桿與圖層滑桿收斂到 `controls/Slider`、guard `raw-z-index`、本文件與參考頁 | ✅ | `54728865`、`6c43deb2`＋本文件 commit |
| R | 第二輪：時間軸 TC3（收合膠囊＋展開單列 TC1、底邊與右下停靠區共用 `LAYOUT.mapBottomInset`）、Agent 活動卡固定右上不受左側互斥影響（A1） | ✅ | `965deb17`、`8d52327c`＋本文件 commit |
| S | 載入狀態條（§5.30，取代 `LoadingIndicator`）、Agent 處理中光暈平滑化（§5.31） | ✅ | #390 |
| R1 | 地圖圖層規格 R1：`mapStyleScale.ts`、統計細縫與缺值斜線、`legendKit`（§5.32）、圖例標題中文化、地圖中文字型 | ✅ | #391 |
| R2a | 地圖點圖層 registry 192 層：固定分階、底圖色描邊、即時光暈上限（`pointTiers.ts`、`pointSpec.ts`） | ✅ | #392 |
| ST | 車站：高鐵／台鐵光柱預設關、捷運「Mapbox 點位／實際範圍（光暈示意）」顯示模式 | ✅ | #393 |
| CARD | 分析卡片頁 `/card/<slug>`（§5.34）；數值依 `value_kind` 格式化 | ✅ | #394、#399 |
| T | 開站畫面 W2＋M2（§5.33）、左側停靠面板統一底色與上緣（§5.1）、地形只在傾斜時載入 | ✅ | #395 |
| R2b | hook／factory 點圖層 122 層套分階與描邊、11 層改泡泡 B、資料編碼描邊保留、日本宗教 z ≤ 8 不畫描邊 | ✅ | #396 |
| TC3 修正 | 時間軸「尚無資料」小標浮在冒號上方、不佔列寬（§5.24） | ✅ | #397 |
| R2c | 火災傷亡外框暗淡對比、特殊船舶可信度淡化乘透明度、火災圖例註記改 `LegendNote` | ✅ | #398 |

### 10.2 區塊狀態

| 區塊 | 狀態 | 備註 |
|---|---|---|
| 停靠 popup（B 版、Title、Row、F2） | ✅ 符合 | `Row mono` 只套在少數純數值列，41 個 `*Panels.tsx` 尚未逐一過 |
| 選取圈 R2 | ✅ 符合 | |
| 工具列 T2／底圖 B3／拍攝模式 P2 | ✅ 符合 | |
| 圖層控制 V2＋S1 | ✅ 符合 | 1 個英文標籤（「Bloom 高樓門檻」）在 guard 基準 |
| 資料來源面板 D1 | ⚠️ 部分 | 2 處 `datasetId` fallback 當標題 |
| 與 Agent 協作面板、研究頁、活動時間軸 | ✅ 符合 | 分析色階漸層屬資料色例外 |
| 會員專區 | ✅ 符合 | |
| Layers 面板主題列／大分類／L2 群組 | ✅ 符合（LT1） | 群組標題與大分類細線顏色仍 inline hex |
| 即時情報 | ✅ 符合 | Phase L：暗／淡皆吃 `intelTheme.ts` palette；監看模式新版 P5 起跟底圖主題（§5.35 H2），舊版維持全暗 |
| 面板標頭（非 H2 分支） | ⚠️ 部分 | `PanelHeader` 未傳 `eyebrow` 的分支字型已改 `FONT_CJK`，版面仍是舊標頭 |
| 說明／分享視窗 | ✅ 符合 | H2、語言分段、`kbd`、分享欄位 `1fr auto`（§5.27） |
| 手機標頭 | ✅ 符合（M1） | 手機時間軸條淡色時仍是暗色底（§10.3） |
| 層級（z-index） | ⚠️ 部分 | 表內元件已歸層；仍有 17 處寫死數字（15 檔，含已登記特例），見 §5.25 與 guard 基準 |
| 圖例 | ⚠️ 部分 | `legendKit` 已上線（§5.32）；R4 已對齊 28 個不一致圖例（[`map-layers.md`](./map-layers.md) §4.3）；`LegendPanel.tsx` 手寫色票剩 6 處（ratchet 只准減少） |
| 載入狀態條（§5.30） | ✅ 符合 | #390 |
| Agent 處理中光暈（§5.31） | ✅ 符合 | #390 |
| 開站畫面（§5.33） | ✅ 符合 | #395 |
| 左側停靠面板（底色／上緣，§5.1） | ✅ 符合 | #395；Agent 面板 CSS 以字面值對齊 `LAYOUT.leftDockTop` |
| 分析卡片頁（§5.34） | ⚠️ 部分 | 只有暗色；視覺值未逐項稽核 |
| 地圖圖層數值（點／線／面／圖例） | ⚠️ 部分 | R1–R5、R7 已套用（R1 統計細縫、缺值／遮蔽斜線、地圖中文字型、圖例標題；R2 點；R3a／R3b 線面與網格影像文字；R4 圖例色；R5 密集點熱區＋密度透明度；R7 熱區／網格色盤可選）；只剩 R6 Three.js／Mapbox 切換未做。盤點 `docs/design-system/layer-style-inventory.json`；拍板結果 [`map-layers.md`](./map-layers.md) §7 |
| 左下時間軸（TC3） | ✅ 符合 | 即時／歷史共用 `TimelineShell`＋`TimeAxis`；刻度標籤 9.5px、時間 15px 依設計稿，不在 7 階字級上 |

### 10.3 未處理（已知，誠實列出）

| 項目 | 現況 | 位置 |
|---|---|---|
| 手機時間軸條 | 淡色底圖時仍是暗色半透明底 `rgba(0,0,0,0.4)`，未跟淡色主題 | `App.tsx` 手機分支（Timeline 條） |
| 未歸層的 z-index | `MobileBottomSheet` 40、`MonitorPanel` 40、即時情報／衛星面板 30（屬 Z1 互斥面板，但層級仍比 `floatingPanel` 高）、衛星詳細卡 35、`ManeuverCompareModal` 100、`AirportSelector` 100、Monitor 看板內部 20／30 | guard `raw-z-index` 基準 |
| `Z_INDEX.toast` 無使用者 | 提示訊息必須高於 1000 的資料更新中遮罩，目前以特例 3000 保留；若要讓提示訊息進表，需先決定把遮罩歸層或把 toast 值提高到 1000 以上 | `TransientNotice.tsx`、`App.tsx` `gatedNotice` |
| modal 層混入對話浮層 | `ChatPanel` 與手機會員面板暫放 modal 層、靠 DOM 順序在視窗之下；表上缺一個「彈出層之上、置中視窗之下」的側欄／底部面板槽位 | `App.tsx`、`ChatPanel.tsx`、`memberPanel.css` |
| 設定（Settings） | 第二輪已移除 rail 上沒有功能的設定鈕（S1）；目前沒有設定入口，真的有設定需求再加（§1「不放沒有功能的按鈕」） | — |
| 等寬中文 | 3 處 | `FoodPriceBoard.tsx`、`TelecomStatusCard.tsx`、`ManeuverCompareModal.tsx` |
| popup 暗色連結色 | `DARK_FEATURE.link = #7DD3FC`，與 `COLORS.link #7fb2ff` 不同；本輪只做等值替換未改 | `featureTheme.tsx` |
| 其他手刻淡色物件 | `UserAvatar`（陰影、分隔線、hover 值不在 token 階）、`InfoModal` palette、`ChatPanel`（`LayerSidebar` 開關色已於 2026-10-03 面板統一 A 段改用共用列開關）（`LIGHT_LEGEND` 已移到 `legendKit.tsx` 並取 `LIGHT` 值） | 各檔 |
| 圖例暗色底與框 | `DARK_LEGEND.bgSubtle`／`border` 是 inline rgba，不是 token | `legend/legendKit.tsx` |
| Layers rail palette | `BORDER`、`BANNER_BG`、`SEARCH_BG`、`TOGGLE_*`、`ROW_*` 等仍 inline hex（暗淡兩套） | `sidebar/railTheme.ts` `DARK_PALETTE`／`LIGHT_PALETTE` |
| `LAYOUT` 無 CSS 變數 | Agent 面板寫死 `top: 60px; left: 64px`，與 `LAYOUT.leftDockTop` 需人工同步 | `research/mainMapConnection.css` |
| 地圖常數未接線 | `mapStyleScale.ts` 的 `LINE_WIDTH`／`lineWidthExpr`、`LINE_DASH`、`LINE_OPACITY`、`FILL_OPACITY`、`LABEL` 已定義，還沒有圖層引用（R3）；`HEATMAP`、`POINT_OPACITY` 已由 R5 接線 | `src/map/mapStyleScale.ts` |
| embed／卡片地圖字型 | embed 與分析卡片頁（皆 MapLibre）未設 `localIdeographFontFamily`，是否需要未驗證 | `src/embed/EmbedApp.tsx`、`src/card/CardMap.tsx` |
| 分析卡片頁只有暗色 | `CARD_THEME = "dark"`，沒有淡色版（§5.34） | `src/card/cardStyle.ts` |
| 捷運顯示模式標籤 | 「Mapbox 點位」含英文品牌名，與 §6.1 中文優先不一致，待決 | `src/data/transportHubTypes.ts` |
| popup 暗色外框 | `rgba(100,170,255,0.25)` inline 字面，不在 `BORDER` 階上（`BORDER.accent` 為 0.55） | `FeatureInfoPanel.tsx` |
| 淡色錯誤色 | tokens `--light-status-err #b42318` vs 設計稿 `#b91c1c` | 以 token 為準，設計稿未同步 |
| 按鈕 pressed 態 | 未定義 | §5.7 |
| 點圖層字面值（R2） | `overlayRegistry.ts` 裡 192 個點圖層的 `circle-radius`／`circle-stroke-*` 字面值已被 `pointSpec.ts` 覆寫、不生效；改大小請改 `pointTiers.ts`，字面值逐層調整時清除 | `src/map/pointSpec.ts` |
| 泡泡圖層（P-1 B 後續） | registry 38＋hook 16＝54 個依資料放大的點圖層仍用各自的半徑範圍，部分還隨縮放；待逐層改成 M3（面積∝值、rMin 4／rMax 28）。泡泡即時層（`newsEvents`、`a1AccidentRealtime`）的光暈半徑未設上限 | `pointTiers.ts` 的 `B`、`pointSpec.ts` |
| 圖例手寫色票 | `LegendPanel.tsx` 剩 6 處手寫 `width／height` 色票（表演場館大小對照、航空空域虛線框、電網 1.5px 線、離岸風電複合圖樣），kit 尚無對應元件；ratchet 只准減少 | `legendKit.test.ts` |
| 圖例精簡版（LG-9） | 只有 `LegendNote` 會在停靠 popup 開著時收起；手寫註記 div 不會 | `LegendPanel.tsx` |
| 點圖層資料編碼描邊（registry） | #392 曾把 34 層依資料變化的描邊蓋成細縫，#401 還原（`withPointSpec` 以 `isDataDriven()` 判斷）。#401 合併前以本列為準 | `src/map/pointSpec.ts` |

## 11. 未納入 token 的範圍與 KEEP OUT

**未來題目**（有需求再開，開時更新本節）：

- transition／duration／easing（現行慣例：hover .15s、淡入淡出 .3s、脈衝 1.8s）。
- Breakpoint tokens（目前 JS `isMobile`）。
- Control sizing 通用 scale（目前規格寫在 §5.7–§5.14）。
- 全站主題切換（目前各子系統依 `isDarkTheme` 選 palette／觸發 class）。

**KEEP OUT**：

- ❌ 不引入 Tailwind／CSS Modules／styled-components。
- ❌ 不抽 `Button`／`Card` 通用元件庫。
- ❌ 不改 `LAYER_COLORS` 結構。
- ❌ 不一次大爆炸改全部元件——每 Phase 獨立 PR。
- ❌ 不反向把 `intelTokens` 改成 re-export from `designTokens`。
- ❌ `SURFACE.*` 不當互動底色（即使數值相同）。

**決策紀錄**：`CONTROL.*` 於 2026-09-27 開啟（handoff §4a 拍板 #4、第三輪 C2），原 Phase 0–6 列為「未來題目」；`LIGHT`／`SLIDER`／`SELECTION_RING`／`COLORS.link`／`statusDerived`／`CONTROL.optionBg` 於 2026-09-28 Phase J 由各元件的候選值收斂而來（值不變）；`Z_INDEX` 於 2026-09-28 第二輪 Phase O 開啟（原列「未來題目」），Phase Q 補齊置中視窗與特例登記。

## 12. 相關文件

- 資料夾入口：[`README.md`](./README.md)（檔案地圖、程式裡的唯一來源、維護流程）；每輪決定：[`CHANGELOG.md`](./CHANGELOG.md)
- 活的元件頁：`tools/design-system.html`（原始碼 `src/design-system/`；`npm run dev` 後開 `/tools/design-system.html`）；靜態快照 [`reference.html`](./reference.html)（`npm run design:snapshot`）
- 地圖圖層視覺規格：[`map-layers.md`](./map-layers.md)（盤點資料 [`layer-style-inventory.json`](./layer-style-inventory.json)，`npm run design:audit-layers` 重產；拍板比較頁 [`map-layer-picks.html`](./map-layer-picks.html)）
- 拍板與設計稿：`docs/features/ui-consistency-audit-20260927/`（`handoff.md` §4a、`proposal.md`、`ui-unification-sheet.html`、`popup-density-variants.html`、`ui-controls-sheet.html`、`timeline-sheet.html`、第二輪 `round2-sheet.html`、時間軸 `timeline-compact-sheet.html`、載入提示 `loading-status-sheet.html`、開站 `boot-screen-sheet.html`→`boot-motion-sheet.html`→`boot-wait-sheet.html`→`boot-w2-tuner.html`）
- 地圖圖層套用計畫：`docs/features/map-layer-restyle/`（`PLAN.md`、`handoff-r2-hooks.md`、`handoff-r2-hooks-fix.md`、分階比較頁 `r2-tiers.html`）
- `CLAUDE.md` §5／§5a／§7、`docs/development-rules.md` §4a（圖層 UX 四鐵則）
- `docs/known-issues.md`

## 13. 地圖圖層視覺規格

地圖上的資料圖形（點、線、面、3D、熱區、網格、影像、地圖文字標籤）與圖例樣式另有專檔：[`map-layers.md`](./map-layers.md)。本檔 §3 的 token 規則管 UI chrome；地圖圖形的顏色屬 §3.16「資料色」，數值階（點半徑、線寬、面透明度、描邊、圖例色票尺寸）在專檔定義。

- **進度（2026-10-04）**：R1（#391）、R2 點（#392／#396／#398）、R3a 線面 registry（#461）、R3b 線面 hook＋網格／影像／文字／擠出（#475）、R4 圖例對齊（#465／#468）、R5 密集點熱區＋密度透明度（#498）、R7 熱區／網格色盤可選（#510）已上線；只剩 R6 Three.js／Mapbox 切換（待使用者決定範圍）。主體點半徑中位 z10／z14 皆 4.5；線寬、面透明度的盤點中位值仍是 2026-09-28 數字。
- **拍板（2026-09-28）**：點 S 3／M 4.5／L 6.5 固定半徑（不隨縮放）、描邊暗 `#0a0a14`／淡 `#ffffff` 1px；線 細／標準／強調 三階（隨縮放）、不加外框；面 分級 0.55／覆蓋 0.35／背景 0.15／網格 0.7；密集點低縮放用熱區；暗淡只換色不換尺寸；缺值統一透明底＋細斜線；Three.js 圖層加「基本點線面」模式、預設 Mapbox；圖例 8 型規格、標題中文在前英文小字在後；2026-09-28／29 追加：hook 依資料半徑的 11 層改泡泡、依屬性變化的描邊保留、車站光柱預設關。完整清單見專檔 §7。
- **數值來源**：`src/map/mapStyleScale.ts`（拍板數值）；點分階 `src/map/pointTiers.ts`（改點大小只改這裡，不改 `overlayRegistry.ts` 字面值）；registry 點圖層集中套用 `src/map/pointSpec.ts`。
- **資料與工具**：`docs/design-system/layer-style-inventory.json`（逐層數值、檔案行號、四鐵則、圖例問題）；`npm run design:audit-layers` 重產；逐層調整照專檔 §6 工作流。
- **參考頁**：活的元件頁 `tools/design-system.html` 地圖圖層區塊；靜態快照 [`reference.html#map-layers`](./reference.html#map-layers)；拍板比較頁 [`map-layer-picks.html`](./map-layer-picks.html)（真實底圖 1:1）。
- 分析結果圖層的規格已定案於 `docs/features/viz-library/DECISIONS.md`，專檔引用不重寫。
