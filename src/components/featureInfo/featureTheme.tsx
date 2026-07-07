// Feature popup 內容子面板的 light / dark 主題分發。
//
// FeatureInfoPanel 依 isDarkTheme 算 palette 並用 <FeatureThemeProvider> 包住內容；
// 各 domain 子面板（*Panels.tsx）與 shared.tsx 的 Row/Badge/SourceFooter 用 useFeatureTheme()
// 讀「中性 chrome」色（文字階 / 中性底 / 邊框 / 連結）。
//
// 只處理中性 chrome — accent 藍、狀態色（綠橘紅黃）、各 layer 資料色兩主題共用，不進本 palette。
import { createContext, useContext, type ReactNode } from "react";
import { COLORS } from "../../styles/designTokens";

export interface FeaturePalette {
  /** 主要數值文字（Row value / 強調）*/
  textStrong: string;
  /** 一般內文 */
  textDefault: string;
  /** 次要 / 標籤（Row label）*/
  textMuted: string;
  /** 最淡 / footer / 註解 */
  textDim: string;
  /** 中性淺底（原 rgba(255,255,255,0.04~0.06) 類）*/
  bgSubtle: string;
  /** 中性較實底（原 rgba(255,255,255,0.08~0.12) 類 / badge off）*/
  bgStrong: string;
  /** 中性邊框 / 分隔線 */
  border: string;
  /** 連結色（accent-on-white 需加深）*/
  link: string;
}

export const DARK_FEATURE: FeaturePalette = {
  textStrong: COLORS.textStrong,
  textDefault: COLORS.textDefault,
  textMuted: COLORS.textMuted,
  textDim: COLORS.textDim,
  bgSubtle: "rgba(255,255,255,0.05)",
  bgStrong: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.10)",
  link: "#7DD3FC",
};

export const LIGHT_FEATURE: FeaturePalette = {
  textStrong: "#111827",
  textDefault: "#1F2937",
  textMuted: "#4B5563",
  textDim: "#6B7280",
  bgSubtle: "rgba(0,0,0,0.04)",
  bgStrong: "rgba(0,0,0,0.06)",
  border: "rgba(0,0,0,0.10)",
  link: "#0284C7",
};

const FeatureThemeContext = createContext<FeaturePalette>(DARK_FEATURE);

/** 子面板讀主題色。未被 Provider 包住時 fallback 深色（向後相容）。*/
export const useFeatureTheme = (): FeaturePalette => useContext(FeatureThemeContext);

export function FeatureThemeProvider({
  palette,
  children,
}: {
  palette: FeaturePalette;
  children: ReactNode;
}) {
  return <FeatureThemeContext.Provider value={palette}>{children}</FeatureThemeContext.Provider>;
}
