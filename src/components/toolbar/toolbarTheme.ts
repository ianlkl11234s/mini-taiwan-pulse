/**
 * 右上角工具列（Phase G）暗／淡色色票。
 *
 * 暗／淡兩組都取自 `designTokens.ts`（淡色 = `LIGHT`，與 `tokens.css` 的 `--light-*` 同值）。
 * 不是新 token，只是把 token 組成工具列需要的語意欄位。
 */
import { COLORS, SURFACE, BORDER, CONTROL, ELEVATION, LIGHT as LIGHT_TOKENS } from "../../styles/designTokens";

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
  surfaceBg: LIGHT_TOKENS.surfacePanel,
  borderPanel: LIGHT_TOKENS.border,
  controlBg: LIGHT_TOKENS.controlBg,
  controlBgHover: LIGHT_TOKENS.controlBgHover,
  controlBorder: LIGHT_TOKENS.controlBorder,
  accent: LIGHT_TOKENS.accent,
  accentFaint: LIGHT_TOKENS.accentFaint,
  textStrong: LIGHT_TOKENS.textStrong,
  textMuted: LIGHT_TOKENS.textMuted,
  textDim: LIGHT_TOKENS.textDim,
  shadow: LIGHT_TOKENS.elevationLg,
  popupBg: LIGHT_TOKENS.surfaceSolid,
  popupBorder: LIGHT_TOKENS.border,
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
