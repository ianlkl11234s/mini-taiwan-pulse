/**
 * Mini Taiwan Pulse — Design Tokens（全專案 SSOT）
 *
 * 規範與遷移狀態見 docs/design-system.md
 *
 * 結構：
 * - 沿用 intel/intelTokens.ts 的既有 token（re-export，不重複定義）
 * - 在此擴張 SURFACE / WHITE_ALPHA / BORDER / RADIUS / FONT_SIZE / ELEVATION / SPACING / CONTROL
 * - 新元件統一從本檔 import；intel/satellite 既有元件不強制改
 */

import {
  COLORS as INTEL_COLORS,
} from "../components/intel/intelTokens";

// ─── Re-export 既有 token（沿用無痛）────────────────────────────
export {
  FONT_CJK,
  FONT_DATA,
  GIS_LEVELS,
  SEV_LEVELS,
  COUNTY_OPTIONS,
  PRESSURE_LEVELS,
  pressureLevel,
  MICON,
  ALERT_GROUPS_DEF,
  ALERT_GROUP_ORDER,
  ALERT_SEVERITY,
  alertSeverity,
  relTime,
  clockTime,
  fmtCountdown,
  fmtExpiry,
  smoothPressure,
} from "../components/intel/intelTokens";
export type {
  PressureLevelKey,
  PressureLevelDef,
  AlertGroupShort,
  AlertGroupDef,
  AlertSeverityDef,
} from "../components/intel/intelTokens";

// ─── SURFACE — 面板背景五階 ────────────────────────────────────
/**
 * 新元件**唯一 canonical** 面板背景出口；`COLORS.panelBg*` 是 legacy alias，僅為相容保留。
 *
 * 規則：
 * - app    → 全域底（地圖底 / LoadingScreen）
 * - subtle → narrow sidebar / floating overlay（最透）
 * - panel  → 主面板預設（intel / satellite / legend 已使用）
 * - strong → 需要更高可讀性（feature info / data calendar）
 * - solid  → 全屏 / 模態 / LiveWall
 */
export const SURFACE = {
  app: "#0a0a14",
  subtle: "rgba(0,0,0,0.40)",
  panel: "rgba(0,0,0,0.52)",
  strong: "rgba(10,10,20,0.88)",
  solid: "rgba(10,10,20,0.94)",
} as const;

// ─── COLORS — 文字 / 強調 / 狀態（沿用 intelTokens）
/**
 * 文字、強調、狀態色沿用 intelTokens 原始定義。
 *
 * ⚠️ **不再新增 panelBg / border 相關 key**：新元件請改用 `SURFACE.*` / `BORDER.*`。
 * `INTEL_COLORS.panelBg` / `panelBorder` / `border*` 為相容保留，遷移完成後將被移除。
 */
export const COLORS = {
  ...INTEL_COLORS,
  /** 暗色連結字（資料來源面板、圖層控制「全選／清除」）。CSS：--link。淡色見 LIGHT.link */
  link: "#7fb2ff",
  /** 「派生」狀態紫（資料來源面板 pulse_only）。暗／淡共用。CSS：--status-derived */
  statusDerived: "#a78bfa",
} as const;

// ─── WHITE_ALPHA — 白色半透階梯（裝飾線 / 軟分隔）─────────────
/**
 * 取代散落的 rgba(255,255,255,0.04~0.60)。
 * 文字色請用 COLORS.textStrong / textDefault / textMuted / textDim / textFaint / textGhost。
 */
export const WHITE_ALPHA = {
  4: "rgba(255,255,255,0.04)",
  8: "rgba(255,255,255,0.08)",
  12: "rgba(255,255,255,0.12)",
  20: "rgba(255,255,255,0.20)",
  40: "rgba(255,255,255,0.40)",
  60: "rgba(255,255,255,0.60)",
} as const;

// ─── BORDER — 分隔線 / 邊框 ────────────────────────────────────
export const BORDER = {
  soft: "rgba(255,255,255,0.06)",
  panel: "rgba(255,255,255,0.10)",
  mid: "rgba(255,255,255,0.14)",
  strong: "rgba(255,255,255,0.22)",
  accent: "rgba(100,170,255,0.55)",
} as const;

// ─── RADIUS — 圓角階梯 ────────────────────────────────────────
/**
 * 收斂 12 種散值 → 4 階尺寸（sm/md/lg/xl）+ 2 種 shape token（pill / full）。
 * 既有 `borderRadius: 3 / 5 / 7 / 10` 全部改用最接近的一階；
 * 罕用 12 / 16 / 24px（共 3 處）保留 inline 一次性數值，不進 scale。
 *
 * 註：`full` 為字串 `"50%"`（圓形百分比語意），與其他 number token 共用時
 * `borderRadius` prop 接受 number | string，無實務型別問題。
 */
export const RADIUS = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  pill: 9999,
  full: "50%",
} as const;

// ─── FONT_SIZE — 字級階梯 ─────────────────────────────────────
/**
 * 收斂 16 種散值 → 7 階。audit 顯示 9–13px 佔 80%（9:174 / 10:157 / 11:106 / 12:66 / 13:82）。
 * 14px (13 use) → md(12) 或 lg(13)；16px (5 use) → xl(18) — 視場景 round 就近。
 * 32px / 40px 各 1 use → 保留 inline 一次性數值，不進 scale。
 */
export const FONT_SIZE = {
  xs: 9,
  sm: 10,
  base: 11,
  md: 12,
  lg: 13,
  xl: 18,
  xxl: 22,
} as const;

// ─── FONT_WEIGHT — 字重 ───────────────────────────────────────
/** 本專案實務上只用 600 / 700。regular 留給未來。 */
export const FONT_WEIGHT = {
  regular: 400,
  semibold: 600,
  bold: 700,
} as const;

// ─── ELEVATION — 主面板陰影 ───────────────────────────────────
/**
 * 4 種 panel shadow 散值 → 3 階 + 1 反向。
 * - sm  → TimelineDock 等貼地控件
 * - md  → LiveWall / overlay
 * - lg  → IntelPanel / SatelliteDetailCard / ManeuverCompareModal
 * - dock → MonitorPanel 從上緣往上散
 */
export const ELEVATION = {
  sm: "0 6px 20px rgba(0,0,0,0.50)",
  md: "0 8px 32px rgba(0,0,0,0.55)",
  lg: "0 12px 40px rgba(0,0,0,0.45)",
  dock: "0 -16px 50px rgba(0,0,0,0.50)",
} as const;

// ─── SPACING — 間距階梯 ──────────────────────────────────────
/**
 * gap / padding 大宗為 4 / 6 / 8 / 12，對齊到此階梯。
 * 不收斂全部 padding 寫法（pill-style "1px 6px" 等 inline 直寫保留）。
 */
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

// ─── CONTROL — 互動態背景（button / select / input / segmented）────
/**
 * 2026-09-27 開啟（design-system.md §8；依據 ui-consistency-audit handoff §4a #4 / C2）。
 * 與 src/styles/tokens.css 的 --control-* 同值。`SURFACE.*` 仍只給面板容器底。
 * 主要按鈕（C2）：背景 COLORS.accentFaint、框與字 COLORS.accent、semibold。
 */
export const CONTROL = {
  bg: "rgba(255,255,255,0.06)",
  bgHover: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.12)",
  disabledOpacity: 0.55,
  /** 原生 <select> 展開選項的底色（不透明，避免透出地圖）。CSS：--control-option-bg */
  optionBg: "#10101b",
} as const;

// ─── SLIDER — S1 細滑桿（圖層控制 V2＋S1）──────────────────────
/**
 * 2px 軌道＋10px 圓點。實作：共用 src/components/controls/Slider.tsx＋slider.css（.ctl-range；
 * 圖層控制 LayerParamControls 也用它，Phase Q 收斂）。
 * CSS：--slider-track / --slider-fill / --slider-thumb。淡色見 LIGHT.slider*。
 */
export const SLIDER = {
  track: "rgba(255,255,255,0.14)",
  fill: "rgba(255,255,255,0.55)",
  thumb: "#f3f4f6",
} as const;

// ─── LIGHT — 淡色 chrome（淡色底圖時使用）──────────────────────
/**
 * 全站唯一的淡色色票，與 src/styles/tokens.css 的 --light-* 1:1 同值（key 對應：
 * camelCase ↔ kebab-case，例 surfacePanel ↔ --light-surface-panel）。改一邊必須同步另一邊。
 *
 * 不做全站主題切換：各子系統依 isDarkTheme 選 dark／light palette（TS）或加觸發 class（CSS），
 * 但數值一律取自這裡，不得另開一套淡色色票（design-system.md §3.9）。
 * accent / 狀態色在淡底上需加深，所以另有 light 版；圖層資料色（LAYER_COLORS）兩主題共用。
 */
export const LIGHT = {
  surfacePanel: "rgba(255,255,255,0.95)",
  surfaceStrong: "rgba(255,255,255,0.97)",
  /** 不透明白：選單彈出層、原生 <select> 選項底 */
  surfaceSolid: "#ffffff",
  textStrong: "#111827",
  textDefault: "#1f2937",
  textMuted: "#4b5563",
  textDim: "#6b7280",
  /** 中性淺底（popup 內 badge／區塊底） */
  fillSubtle: "rgba(0,0,0,0.04)",
  /** 中性較實底；同值也用作 popup Row 細線（borderSoft） */
  fillStrong: "rgba(0,0,0,0.06)",
  borderSoft: "rgba(0,0,0,0.06)",
  border: "rgba(0,0,0,0.10)",
  borderMid: "rgba(0,0,0,0.16)",
  /** 即時情報「強分隔」（分類 chip 選中框）淡色版；同 alpha 換極性，沿用 BORDER.strong ↔ 本欄慣例 */
  borderStrong: "rgba(0,0,0,0.22)",
  controlBg: "rgba(0,0,0,0.035)",
  controlBgHover: "rgba(0,0,0,0.08)",
  controlBorder: "rgba(0,0,0,0.14)",
  accent: "#0b6fd6",
  accentFaint: "rgba(11,111,214,0.10)",
  link: "#0284c7",
  statusLive: "#15803d",
  statusWarn: "#c2410c",
  statusErr: "#b42318",
  sliderTrack: "rgba(0,0,0,0.12)",
  sliderFill: "rgba(0,0,0,0.45)",
  sliderThumb: "#111827",
  elevationLg: "0 12px 40px rgba(0,0,0,0.18)",
} as const;

// ─── SELECTION_RING — R2 選取圈 accent ─────────────────────────
/**
 * 暗 = COLORS.accent、淡 = LIGHT.accent（不是新顏色，只是固定的組合）。
 * 由 src/map/selectionRing.ts 寫到地圖容器的 CSS 變數 --selection-ring-accent。
 */
export const SELECTION_RING = {
  dark: INTEL_COLORS.accent,
  light: LIGHT.accent,
} as const;

// ─── Z_INDEX — 層級規則（ui-r2 Phase O／Z1）──────────────────────
/**
 * 全站固定層級，與 src/styles/tokens.css 的 --z-* 同值（key 對應：camelCase ↔ kebab-case，
 * 例 floatingPanel ↔ --z-floating-panel）。改一邊必須同步另一邊。
 * 同一層內的前後由 DOM 順序決定；不要為了壓過鄰居改寫死數字，先確認屬於哪一層。
 *
 * 特例（不在本表、維持寫死）：LoadingScreen 9999、Day-loading 遮罩 1000、
 * AdminPanel 10001、圖層 host 錯誤提示 10000、ChartHoverTooltip、
 * 提示訊息 TransientNotice／私人圖層提示 3000（必須高於 1000 的資料更新中遮罩，toast 50 會被壓暗）。
 */
export const Z_INDEX = {
  /** 地圖上的標記、選取圈；時間軸（地圖控制列）刻意也在這層，位於浮動面板之下 */
  mapOverlay: 10,
  /** 浮動面板：左側 rail 面板、Agent 活動卡、右下停靠 popup（時間軸不在此層，屬 mapOverlay） */
  floatingPanel: 20,
  /** 右上工具列（桌機 T2、手機標頭） */
  toolbar: 25,
  /** 下拉面板、選單、hover tooltip */
  popover: 30,
  /** 置中視窗：說明、分享、監測模式；ChatPanel 與手機會員面板也在此層，靠 App 的 DOM 順序排在視窗之下 */
  modal: 40,
  /** 提示訊息（toast）。目前 TransientNotice 仍用特例 3000（見上），本值保留給不需蓋過遮罩的提示 */
  toast: 50,
} as const;

// ─── LAYOUT — 地圖角落停靠的共用偏移（ui-r2 Phase R）────────────────
/**
 * 左下時間軸（TC3 收合膠囊與展開卡片）與右下停靠區（popup＋圖例）共用同一個底邊偏移，
 * 兩者底邊必須對齊：改這個值會同時移動兩邊。規格見 docs/design-system.md §5.24。
 * 64 是右下停靠區原本的值，讓出 Mapbox 右下角的版權標示。
 */
export const LAYOUT = {
  /** 地圖底部停靠元件（時間軸、右下停靠區）距視窗底邊的距離（px） */
  mapBottomInset: 64,
} as const;
