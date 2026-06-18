/**
 * Mini Taiwan Pulse — Design Tokens（全專案 SSOT）
 *
 * 規範與遷移狀態見 docs/design-system.md
 *
 * 結構：
 * - 沿用 intel/intelTokens.ts 的既有 token（re-export，不重複定義）
 * - 在此擴張 SURFACE / WHITE_ALPHA / BORDER / RADIUS / FONT_SIZE / ELEVATION / SPACING
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
