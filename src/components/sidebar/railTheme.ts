import { createContext, useContext } from "react";
import { LAYER_TOGGLE_PALETTE } from "./LayerToggleSwitch";
import { SURFACE, BORDER as BORDER_TOKEN, LIGHT } from "../../styles/designTokens";

/**
 * 圖層面板共用色票（spec §5.1／§5.5）：桌機 rail 四入口、手機底部面板、資料來源、
 * Agent 分析結果、衛星群組、我的 —— 所有用 `sidebar/LayerRow` 的清單都從這裡取色。
 * 只有 `BG_RAIL`／`BG_PANEL`／`PANEL_BORDER` 走 token，其餘仍是 inline 值（spec §10.3）。
 */
export interface RailPalette {
  ACCENT: string; ACCENT_TOGGLE: string; BG_RAIL: string; BG_PANEL: string; PANEL_BORDER: string;
  BORDER: string; DIM: string; INACTIVE_TEXT: string;
  TEXT_STRONG: string; BANNER_BG: string; SEARCH_BG: string;
  TOGGLE_OFF: string; TOGGLE_KNOB_ON: string; TOGGLE_KNOB_OFF: string;
  ROW_HOVER: string; ROW_ACTIVE: string; RAIL_ICON_ACTIVE: string;
  ALLOFF_BG: string; ALLOFF_BORDER: string;
  COLOR_SCHEME: 'light' | 'dark';
}

export const DARK_PALETTE: RailPalette = {
  ACCENT: "#E5E7EB", ACCENT_TOGGLE: LAYER_TOGGLE_PALETTE.dark.on, BG_RAIL: SURFACE.app, BG_PANEL: SURFACE.strong, PANEL_BORDER: BORDER_TOKEN.panel,
  BORDER: "#2A2D32", DIM: "#6B7280", INACTIVE_TEXT: "#9CA3AF",
  TEXT_STRONG: "#fff", BANNER_BG: "rgba(20,21,24,0.95)", SEARCH_BG: "#1A1C20",
  TOGGLE_OFF: LAYER_TOGGLE_PALETTE.dark.off, TOGGLE_KNOB_ON: LAYER_TOGGLE_PALETTE.dark.knobOn, TOGGLE_KNOB_OFF: LAYER_TOGGLE_PALETTE.dark.knobOff,
  ROW_HOVER: "rgba(255,255,255,0.03)", ROW_ACTIVE: "rgba(255,255,255,0.06)", RAIL_ICON_ACTIVE: "rgba(255,255,255,0.08)",
  ALLOFF_BG: "rgba(255,255,255,0.06)", ALLOFF_BORDER: "rgba(255,255,255,0.12)",
  COLOR_SCHEME: 'dark',
};

export const LIGHT_PALETTE: RailPalette = {
  ACCENT: "#374151", ACCENT_TOGGLE: LAYER_TOGGLE_PALETTE.light.on, BG_RAIL: "#FFFFFF", BG_PANEL: LIGHT.surfacePanel, PANEL_BORDER: LIGHT.border,
  BORDER: "rgba(0,0,0,0.10)", DIM: "#9CA3AF", INACTIVE_TEXT: "#6B7280",
  TEXT_STRONG: "#111827", BANNER_BG: "rgba(243,244,246,0.96)", SEARCH_BG: "#F3F4F6",
  TOGGLE_OFF: LAYER_TOGGLE_PALETTE.light.off, TOGGLE_KNOB_ON: LAYER_TOGGLE_PALETTE.light.knobOn, TOGGLE_KNOB_OFF: LAYER_TOGGLE_PALETTE.light.knobOff,
  ROW_HOVER: "rgba(0,0,0,0.04)", ROW_ACTIVE: "rgba(0,0,0,0.05)", RAIL_ICON_ACTIVE: "rgba(0,0,0,0.07)",
  ALLOFF_BG: "rgba(0,0,0,0.04)", ALLOFF_BORDER: "rgba(0,0,0,0.10)",
  COLOR_SCHEME: 'light',
};

export const railPalette = (isDarkTheme: boolean): RailPalette => (isDarkTheme ? DARK_PALETTE : LIGHT_PALETTE);

export const RailThemeContext = createContext<RailPalette>(DARK_PALETTE);
export const useRailTheme = () => useContext(RailThemeContext);
