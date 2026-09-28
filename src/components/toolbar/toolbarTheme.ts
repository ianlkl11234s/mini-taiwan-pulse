/**
 * 右上角工具列（Phase G）暗／淡色色票。
 *
 * `designTokens.ts` 只定義暗色 token；淡色數值取自
 * `src/styles/tokens.css` 的 `--light-*`（與 `UserAvatar.tsx` 既有的手刻淡色物件同源，
 * 兩處數值需同步變動）。不是新 token，只是把已存在的 CSS 變數鏡射進 TS 供 inline style 使用。
 */
import { COLORS, SURFACE, BORDER, CONTROL, ELEVATION } from "../../styles/designTokens";

export interface ToolbarPalette {
  surfaceBg: string;
  borderPanel: string;
  controlBg: string;
  controlBgHover: string;
  controlBorder: string;
  accent: string;
  accentFaint: string;
  textStrong: string;
  textMuted: string;
  textDim: string;
  shadow: string;
  popupBg: string;
  popupBorder: string;
}

const LIGHT: ToolbarPalette = {
  surfaceBg: "rgba(255,255,255,0.95)",
  borderPanel: "rgba(0,0,0,0.10)",
  controlBg: "rgba(0,0,0,0.035)",
  controlBgHover: "rgba(0,0,0,0.08)",
  controlBorder: "rgba(0,0,0,0.14)",
  accent: "#0b6fd6",
  accentFaint: "rgba(11,111,214,0.10)",
  textStrong: "#111827",
  textMuted: "#4b5563",
  textDim: "#6b7280",
  shadow: "0 12px 40px rgba(0,0,0,0.18)",
  popupBg: "#ffffff",
  popupBorder: "rgba(0,0,0,0.10)",
};

const DARK: ToolbarPalette = {
  surfaceBg: SURFACE.strong,
  borderPanel: BORDER.panel,
  controlBg: CONTROL.bg,
  controlBgHover: CONTROL.bgHover,
  controlBorder: CONTROL.border,
  accent: COLORS.accent,
  accentFaint: COLORS.accentFaint,
  textStrong: COLORS.textStrong,
  textMuted: COLORS.textMuted,
  textDim: COLORS.textDim,
  shadow: ELEVATION.lg,
  popupBg: SURFACE.strong,
  popupBorder: BORDER.panel,
};

export function getToolbarPalette(isDarkTheme: boolean): ToolbarPalette {
  return isDarkTheme ? DARK : LIGHT;
}
