# Mini Taiwan Pulse — Design System

> **UI 規範 SSOT**。新增或修改任何 UI（面板、popup、控制項、工具列、樣式表）前必讀；PR 前照 §8 checklist 逐項勾。
> 自動檢查：`src/styles/__tests__/designSystemGuard.test.ts`（§9）。視覺參考頁：[`design-system-reference.html`](./design-system-reference.html)（暗／淡並排，每個元件標實作檔）。
> 決策來源：`docs/features/ui-consistency-audit-20260927/`（`handoff.md` §4a 四輪拍板、`proposal.md`、三份設計稿）。本檔寫的是**拍板後的最終規格與實際實作值**；兩者不一致時以本檔 §10「遷移狀態」誠實標示。

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

---

## 0. 怎麼用這份文件

| 你要做的事 | 先看 |
|---|---|
| 新面板／新 popup 內容 | §5.1、§5.2、§5.3、§6 |
| 新控制項（按鈕、滑桿、選單、開關） | §5.7–§5.16；圖層控制一律走 `layerParamsSpec.ts` 規格自動產生，不手寫 |
| 要一個顏色 | §3；找不到才考慮新增 token（TS 與 CSS 兩邊同時加，並補 §3 表格） |
| 淡色底圖要支援 | §3.9 `LIGHT`；**不得**另開一套淡色色票 |
| guard 測試紅燈 | §9；修程式碼，不要改基準 |

## 1. 原則

| 原則 | 說明 |
|---|---|
| **中文優先** | 使用者看得到的標籤、標題、按鈕、狀態一律中文。英文代碼只在必要時以小字附註（§6.1）。 |
| **系統字，不載 web font** | 只用各平台內建字：中文與一般文字 `--font-cjk`，數字／時間／座標／代碼 `--font-data`。不引用沒載入的字族名（Inter、JetBrains Mono、Georgia、宋體）——寫了等於白寫，還會讓 fallback 在不同機器解析成不同字（§4）。 |
| **Token 優先** | 顏色／字級／圓角／間距／陰影一律取 token：TS 從 `src/styles/designTokens.ts` import，CSS 用 `src/styles/tokens.css` 的 `var(--…)`。禁止在元件裡寫死 hex／rgba（例外見 §3.16、§4.2）。 |
| **不顯示內部識別碼** | `datasetId`、`warehouse:wh-8`、layer key 這類代號不直接給使用者看，先過人類可讀映射（§6.3）。 |
| **null 不當 0** | 缺值、過期、錯誤不轉成 0、「正常」或空字串冒充有值；`Row` 遇到 null／空值直接不渲染，統計缺值顯示「—」並保留原因（§6.5）。 |
| **暗／淡並行** | 每個元件都有暗色（預設）與淡色（淡色底圖 `light`／`streets`）兩套值；設計稿與參考頁一律並排驗證。淡色值只來自 `LIGHT`／`--light-*`。 |
| **不引入 CSS 框架、不抽通用元件庫** | 維持 inline style + token + 少量元件級 CSS。業務元件深耦合 Mapbox／timeStore，抽通用 `Button`/`Card` 反而 over-abstract；共用的是**規格**（本檔）與少數已存在的共用元件（`PanelHeader`、`Row`、`Title`、`SourceFooter`、`ToolbarButton`、`LayerParamControls`）。 |
| **每階段獨立 PR** | 大改分 Phase，一個 Phase 一個 PR，可獨立 review／回退。 |

## 2. SSOT 檔案

| 檔案 | 角色 |
|---|---|
| `src/styles/designTokens.ts` | **TS token SSOT**：`SURFACE` `COLORS` `WHITE_ALPHA` `BORDER` `RADIUS` `FONT_SIZE` `FONT_WEIGHT` `ELEVATION` `SPACING` `CONTROL` `SLIDER` `LIGHT` `SELECTION_RING` ＋ re-export `FONT_CJK` `FONT_DATA` |
| `src/styles/tokens.css` | **CSS token SSOT**：與 TS 1:1 同值的 CSS 變數（`main.tsx`、`research/main.tsx`、`jev-layer-screening/main.tsx` 全域載入） |
| `src/components/intel/intelTokens.ts` | 歷史 token（`COLORS` 原始定義、`FONT_CJK`/`FONT_DATA`、分級色、`chipTint`/`chipOutline`），被 designTokens **單向 re-export** |
| `src/components/sidebar/layerCatalog.ts` | `LAYER_COLORS`／主題與群組 SSOT（圖層資料色，§3.16） |
| `src/data/layerParamsSpec.ts` | 圖層控制項規格（標籤文字、滑桿範圍）→ 自動產生控制項 |
| `src/components/LegendPanel.tsx` `LEGEND_REGISTRY` | layer → 圖例 |
| `src/components/featureInfo/registry.tsx` `PANEL_REGISTRY` | layer → popup 內容 |
| `src/styles/__tests__/designSystemGuard*.{ts,json}` | 自動檢查規則、基準、TS↔CSS 同值測試（§9） |

**TS ↔ CSS 對應規則**：`SURFACE.x ↔ --surface-x`；`COLORS.textX ↔ --text-x`；`BORDER.x ↔ --border-x`；`CONTROL.camel ↔ --control-kebab`；`SLIDER.x ↔ --slider-x`；`LIGHT.camelCase ↔ --light-kebab-case`；`COLORS.link ↔ --link`；`COLORS.statusDerived ↔ --status-derived`。`LIGHT`／`SLIDER`／`CONTROL`／`link`／`statusDerived`／`accent` 的兩邊同值由 guard 測試強制。

⚠️ `intelTokens.ts` **不可**改成 re-export from `designTokens`（designTokens 已 import 它，會 circular）。退役順序：(a) 常數搬進 designTokens → (b) intelTokens 改 re-export from designTokens → (c) import 全改完才刪。

## 3. Token 表

> 欄位：TS 名稱 ↔ CSS 變數 ↔ 暗色值 ↔ 用途。淡色值見 §3.9。

### 3.1 SURFACE — 面板背景

| TS | CSS | 值 | 用途 |
|---|---|---|---|
| `SURFACE.app` | `--surface-app` | `#0a0a14` | App 底（地圖底色、LoadingScreen） |
| `SURFACE.subtle` | `--surface-subtle` | `rgba(0,0,0,0.40)` | 窄 sidebar／浮動 overlay |
| `SURFACE.panel` | `--surface-panel` | `rgba(0,0,0,0.52)` | 主面板預設（Intel／衛星／圖例） |
| `SURFACE.strong` | `--surface-strong` | `rgba(10,10,20,0.88)` | 需高可讀性：停靠 popup、工具列底板、rail 面板 |
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

目前取用 `LIGHT` 的消費端：`toolbar/toolbarTheme.ts`、`sidebar/DataSourcePanel.tsx`（`LIGHT_DS`）、`featureInfo/featureTheme.tsx`（`LIGHT_FEATURE`）、`FeatureInfoPanel.tsx`、`sidebar/layerParamControls.css`（`--lpc-*`）、`map/selectionRing.ts`，以及各子系統 CSS 的 `--light-*`。尚未收斂者列在 §10.3。

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
- **H2 標頭**：padding `10px 14px`；eyebrow 9px `--text-dim`、letterSpacing 1.4px、中文（例「資料」「研究」）；標題 13px bold `--text-strong`、上距 1px；底線 `1px --border-panel`；關閉鈕 24×24、`<X size={14}/>`、透明底、`--text-muted`，`aria-label="關閉{標題}"`。
- **淡色**：底 `LIGHT.surfacePanel`、框 `LIGHT.border`、字 `LIGHT.textStrong`／`textDim`。
- **禁止**：自己手刻標頭；英文大寫 eyebrow；純文字「×」關閉鈕；標頭用等寬字。
- **實作**：`src/components/sidebar/PanelHeader.tsx`（傳 `eyebrow` 即走 H2；**不傳 eyebrow 的舊分支仍是 Inter，待遷移**，§10.3）。

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

### 5.5 L2 群組標題

- **用途**：Layers／資料來源面板內，主題下的子群組（例「點位」「交通用地」）。
- **結構**：中文標題 ＋ 右側 1px 細線拉到底；子項縮排 14px。
- **尺寸**：10px（`FONT_SIZE.sm`）semibold、letterSpacing 0.6、padding `10px 12px 3px`、gap 8。
- **暗／淡**：字 `#9ca3af`／`#4b5563`（= textMuted）；線 `rgba(255,255,255,0.14)`／`rgba(0,0,0,0.12)`。拍板稿為 `--border-soft`，實作取 `BORDER.mid` 較明顯，以實作為準。
- **禁止**：「└」字元縮排；整段 `FONT_DATA`。
- **實作**：`src/components/IconRailSidebar.tsx` `SubGroupLabel`（顏色目前 inline hex，§10.3）。

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

### 5.10 迷你開關

- **尺寸**：控制區 20×11 軌道、7px 圓點（左 2 → 11）；工具列／面板 24×14、10px 圓點。
- **狀態**：關 軌道 `--control-border`、圓點 `--text-strong`；開 軌道 `--accent`、圓點 `#fff`；transition .15s。標籤 10px `--text-muted`，開啟時 `--text-default`。≥3 個開關排兩欄。
- **無障礙**：`role="switch"`＋`aria-checked`。
- **禁止**：用 checkbox 或文字「ON/OFF」。
- **實作**：`LayerParamControls.tsx` `ToggleControl`＋`.lpc-sw`、`toolbar/BasemapMenu.tsx` `MiniSwitch`。

### 5.11 圖層控制區（V2 版面）

- **結構**：圖層列展開後，名稱下方一塊控制區，左側 `1px --lpc-line` 直線、padding-left 10、gap 6；每個控制項一列：**標籤＋數值同一行、控件全寬在下一行**（grid `"k v" "c c"`）。
- **尺寸**：標籤 10px `--text-muted` `FONT_CJK`、超長省略；數值 10px `FONT_DATA` `--text-default` tabular-nums 靠右。
- **暗／淡**：`.lpc-theme`／`.lpc-theme--light`（`layerControlThemeClass(isDarkTheme)`）。淡色左線 `rgba(0,0,0,.12)` 不在 token 階上，刻意保留。
- **禁止**：手寫圖層控制 JSX（一律 `layerParamsSpec.ts` 規格 → `ParamControlList`）；標籤與數值擠在同一字串。
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
- **實作**：`LayerParamControls.tsx` `SliderControl`＋`input[type="range"].lpc-range`。

### 5.14（已移除）獨立隱藏鈕

- 2026-09-28 使用者拍板移除：原「Hide」／眼睛圖示的功能是「關掉展開中的圖層並收合」，與圖層列的開關＋展開箭頭重複，還多占一列。
- **不要再加回**獨立的隱藏按鈕；關閉圖層用開關、收合用 chevron。

### 5.15 小型圖示按鈕

同 §5.14 規格（20×20、`RADIUS.md`、hover 出底）。任何只有圖示的按鈕都要有 `title` 與 `aria-label`。

### 5.16 Chevron

- **規格**：lucide `<ChevronRight size={12}/>`，展開時 `transform: rotate(90deg)`、transition .15s；或 `ChevronRight`／`ChevronDown` 切換（圖例收合鈕）。色 `--text-muted`。
- **禁止**：`▶`／`▼` 字元（guard `triangle-chevron`）。播放鍵請用 lucide `Play`／`Pause`；升降趨勢的 `▲▼` 成對符號屬資料語意，不算 chevron。
- **實作**：`.lpc-chev`、`LegendPanel.tsx`、`IconRailSidebar.tsx`。

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
- **實作**：`src/components/intel/{IntelHeader.tsx,IntelCard.tsx,IntelFilters.tsx,intelTokens.ts}`、`intel/alerts/AlertCard.tsx`。**尚無淡色主題**（§10.3）。

### 5.22 資料來源面板（D1 列內展開）

- **位置**：左側 rail「資料來源」（資料庫圖示，Locations 之後）；取代舊右下浮動 ⓘ 與置中詳細視窗。
- **外殼**：同 Layers：H2（eyebrow「資料」）、搜尋框「搜尋圖層名稱」、狀態篩選分段（「全部 N」＋ ✓／⚙／? 三個狀態圖示與數量，`title` 為中文狀態名）、主題 → L2 群組。
- **列**：狀態圖示（✓ 已接上 `statusLive`／⚙ 派生 `statusDerived`／? 待補 `statusWarn`）＋中文名，英文名小字 `textDim`；鎖頭圖示表示受限。
- **展開**：點列在列下方展開上游資料卡，同時只展開一筆（`aria-expanded`）；卡內 Fact 列標籤 10px `muted` 寬 44、值 `textStrong`，代碼類值 `FONT_DATA`；連結 `link` 色。
- **暗／淡**：`DARK_DS`／`LIGHT_DS`（皆取 token）。
- **禁止**：顯示 `datasetId` 當標題（目前有 2 處 fallback，§6.3、guard 記錄中）。
- **實作**：`src/components/sidebar/DataSourcePanel.tsx`、`IconRailSidebar.tsx`（rail 入口）。

### 5.23 圖例收合鈕

- **結構**：圖例面板頂端整列按鈕：chevron（展開 `ChevronDown`／收合 `ChevronRight`，12px）＋「圖例」。
- **尺寸**：padding `6px 10px`、gap 6、10px `FONT_CJK`、透明底。
- **禁止**：英文「LEGEND」、大寫。
- **實作**：`src/components/LegendPanel.tsx`。

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
- 顯示前先過映射：資料集 → `describeDataset(datasetId).label`（`research/MainMapConnection.tsx`）；圖層 → `HEADER_LABELS`／`layerCatalog` 中文名；統計 → `statisticsDataSources` 定義。
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
| 原生 `type="range"` | `ParamControlList` slider／`.lpc-range` | `native-range` |
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

### 9.2 規則與目前基準（2026-09-28）

| 規則 | 擋什麼 | 擋／記錄 | 基準筆數（檔案數） |
|---|---|---|---|
| `web-font` | `fonts.googleapis`、`@font-face`、`"JetBrains Mono"`、`Inter,`、`Georgia`、`Songti` | 擋 | 11（5） |
| `hex-literal-in-ui-css` | `src/research/*.css`、`src/components/**/*.css` 的 `#rgb`／`#rrggbb`（`src/styles/**` 除外） | 擋 | 4（2） |
| `native-range` | `type="range"`／`type: "range"`（`LayerParamControls.tsx` 除外） | 擋 | 10（9） |
| `triangle-chevron` | `▶` `▼` 與 escape（註解與 `▲▼` 趨勢成對不算） | 擋 | 11（7） |
| `english-control-label` | `layerParamsSpec.ts` `labelPrefix` 英文開頭 | 擋 | 1（1） |
| `uppercase-eyebrow` | `textTransform: "uppercase"`／`text-transform: uppercase` | 擋 | 9（5） |
| `font-data-on-cjk` | 啟發式：`FONT_DATA` 元素的直接子文字含中文（同一行內） | 擋 | 3（3） |
| `internal-id-display` | 啟發式：`datasetId` 放進 JSX 子節點或 `title`／`label`／`desc`／`text` 欄位 | **只記錄** | 3（2） |

**誤判與漏判**：
- `font-data-on-cjk` 只看同一行；跨行的 JSX（例 F2 footer 第二行）不會命中，屬已知漏判。正確混排寫法（中文在外、數字 span 在內）不會誤判。
- `internal-id-display` 會命中「先顯示標題、查不到才 fallback 代號」的寫法（`DataSourcePanel.tsx` 2 處屬此類，是真的問題）；但也可能把合法的 tooltip 或除錯欄位算進去，因此只記錄不擋。
- `web-font` 的 `Georgia` 也會命中資料中的國名（目前 0 筆）；遇到時把字串移到資料檔（`src/data/**` 同樣受掃描，需在 PR 說明）。
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
| J | 淡色／控制 token 收斂、本文件改寫、參考頁、guard | ✅ | 本 PR |

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
| Layers 面板 L2 群組 | ⚠️ 部分 | 群組標題顏色仍 inline hex；**主題標題（`MacroGroupLabel`）仍是等寬英文大寫，如「交通 MOVE」** |
| 即時情報 | ⚠️ 部分 | 暗色符合；**沒有淡色主題** |
| 面板標頭（非 H2 分支） | ⚠️ 部分 | `PanelHeader` 未傳 `eyebrow` 的分支仍用 Inter |
| 圖例 | ✅ 符合 | |

### 10.3 未處理（已知，誠實列出）

| 項目 | 現況 | 位置 |
|---|---|---|
| 左下時間軸控制 | 未套 C2／S1：原生 range、`▶` 文字箭頭、自訂按鈕樣式 | `src/components/TimelineControls.tsx`、`HistoricalTimeline.tsx` |
| Layers 主題標題 | `FONT_DATA` + `uppercase` + 中英混排（「交通 MOVE」） | `IconRailSidebar.tsx` `MacroGroupLabel`、`LayerSidebar.tsx` |
| Mobile compact header | 未依 H2／T2 改寫 | `App.tsx` 手機分支、`LayerSidebar.tsx` |
| 即時情報淡色主題 | 未做 | `src/components/intel/**` |
| Settings／Info／Share 等 modal | 未依本輪規格檢查；`InfoModal` 有 `uppercase` 與 `▶` 說明文字 | `InfoModal.tsx`、`ShareModal.tsx`、Settings |
| Inter 殘留 | 11 處 `fontFamily: "Inter, …"`（`IconRailSidebar.tsx` 7、其餘各 1） | `IconRailSidebar.tsx`、`App.tsx`、`TransientNotice.tsx`、`PanelHeader.tsx`、`StatisticsDetails.tsx` |
| 其他原生 range | 地震回放、情報回放、研究頁、bbox 工具 | 見 guard 基準 `native-range` |
| 等寬中文 | 3 處 | `FoodPriceBoard.tsx`、`TelecomStatusCard.tsx`、`ManeuverCompareModal.tsx` |
| popup 暗色連結色 | `DARK_FEATURE.link = #7DD3FC`，與 `COLORS.link #7fb2ff` 不同；本輪只做等值替換未改 | `featureTheme.tsx` |
| 其他手刻淡色物件 | `UserAvatar`（陰影、分隔線、hover 值不在 token 階）、`LegendPanel` `LIGHT_LEGEND`、`InfoModal`、`ChatPanel`、`LayerSidebar` 開關色、`LoadingIndicator` | 各檔 |
| popup 暗色外框 | `rgba(100,170,255,0.25)` inline 字面，不在 `BORDER` 階上（`BORDER.accent` 為 0.55） | `FeatureInfoPanel.tsx` |
| 淡色錯誤色 | tokens `--light-status-err #b42318` vs 設計稿 `#b91c1c` | 以 token 為準，設計稿未同步 |
| 按鈕 pressed 態 | 未定義 | §5.7 |

## 11. 未納入 token 的範圍與 KEEP OUT

**未來題目**（有需求再開，開時更新本節）：

- Z_INDEX scale（Mapbox 控制、面板、modal、loading 目前 inline）。
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

**決策紀錄**：`CONTROL.*` 於 2026-09-27 開啟（handoff §4a 拍板 #4、第三輪 C2），原 Phase 0–6 列為「未來題目」；`LIGHT`／`SLIDER`／`SELECTION_RING`／`COLORS.link`／`statusDerived`／`CONTROL.optionBg` 於 2026-09-28 Phase J 由各元件的候選值收斂而來（值不變）。

## 12. 相關文件

- 視覺參考頁：[`docs/design-system-reference.html`](./design-system-reference.html)
- 拍板與設計稿：`docs/features/ui-consistency-audit-20260927/`（`handoff.md` §4a、`proposal.md`、`ui-unification-sheet.html`、`popup-density-variants.html`、`ui-controls-sheet.html`）
- `CLAUDE.md` §5／§5a／§7、`docs/development-rules.md` §4a（圖層 UX 四鐵則）
- `docs/known-issues.md`
