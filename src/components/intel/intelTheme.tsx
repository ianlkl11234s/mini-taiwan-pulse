/**
 * 即時情報 Intel 面板 — 暗／淡主題分發（Phase L）
 *
 * 沿用 `featureInfo/featureTheme.tsx`／`toolbar/toolbarTheme.ts` 的既有模式：
 * - 暗色＝`intelTokens.ts` 原始 `COLORS`（byte-identical，Phase L 前後外觀不變）。
 * - 淡色＝一律取自 `designTokens.ts` 的 `LIGHT`（不另開淡色色票，design-system.md §3.9）。
 * - 用 Context 分發，未被 `IntelThemeProvider` 包住時 fallback 深色（向後相容；
 *   Monitor Mode 的戰情看板刻意維持全暗，NewsFeedPanel 顯式套 `DARK_INTEL`）。
 *
 * 分類／警示／嚴重度色（NEWS_CATEGORIES、ALERT_GROUPS_DEF、ALERT_SEVERITY、GIS_LEVELS、
 * SEV_LEVELS）是資料語意色（design-system.md §3.16），兩主題共用同一色相，不進本 palette；
 * 淡色底圖下淺色相（黃、淺綠…）字色不足以對比時，改用 `chipText()`／`levelColor()` 加深。
 */
import { createContext, useContext, type ReactNode } from "react";
import { COLORS, CONTROL, LIGHT, SURFACE } from "../../styles/designTokens";
import { withAlpha } from "./intelTokens";

export interface IntelPalette {
  isDark: boolean;
  /** 面板外殼底／框 */
  panelBg: string;
  panelBorder: string;
  /** 邊框三階＋強調框（選中卡片／啟用 chip 用） */
  borderSoft: string;
  borderMid: string;
  borderStrong: string;
  borderAccent: string;
  /** 文字階 */
  textStrong: string;
  textDefault: string;
  textMuted: string;
  textDim: string;
  textFaint: string;
  textGhost: string;
  /** 強調色 */
  accent: string;
  accentSoft: string;
  accentFaint: string;
  /** 狀態色 */
  statusLive: string;
  statusLiveSoft: string;
  statusLiveBorder: string;
  statusWarn: string;
  statusWarnSoft: string;
  statusWarnBorder: string;
  statusErr: string;
  /** 互動控制底（分段、select trigger…） */
  controlBg: string;
  controlBgHover: string;
  controlBorder: string;
  /** 原生 `<option>` 展開底（不透明） */
  optionBg: string;
}

export const DARK_INTEL: IntelPalette = {
  isDark: true,
  panelBg: SURFACE.strong,
  panelBorder: COLORS.panelBorder,
  borderSoft: COLORS.borderSoft,
  borderMid: COLORS.borderMid,
  borderStrong: COLORS.borderStrong,
  borderAccent: COLORS.borderAccent,
  textStrong: COLORS.textStrong,
  textDefault: COLORS.textDefault,
  textMuted: COLORS.textMuted,
  textDim: COLORS.textDim,
  textFaint: COLORS.textFaint,
  textGhost: COLORS.textGhost,
  accent: COLORS.accent,
  accentSoft: COLORS.accentSoft,
  accentFaint: COLORS.accentFaint,
  statusLive: COLORS.statusLive,
  statusLiveSoft: COLORS.statusLiveSoft,
  statusLiveBorder: COLORS.statusLiveBorder,
  statusWarn: COLORS.statusWarn,
  statusWarnSoft: COLORS.statusWarnSoft,
  statusWarnBorder: COLORS.statusWarnBorder,
  statusErr: COLORS.statusErr,
  controlBg: CONTROL.bg,
  controlBgHover: CONTROL.bgHover,
  controlBorder: CONTROL.border,
  // IntelFilters 原本的 <option> 字面值（非 CONTROL.optionBg "#10101b"）；保留原字面以維持暗色不變。
  optionBg: "#1a1c20",
};

export const LIGHT_INTEL: IntelPalette = {
  isDark: false,
  panelBg: LIGHT.surfacePanel,
  panelBorder: LIGHT.border,
  borderSoft: LIGHT.borderSoft,
  borderMid: LIGHT.borderMid,
  borderStrong: LIGHT.borderStrong,
  borderAccent: withAlpha(LIGHT.accent, 0.5),
  textStrong: LIGHT.textStrong,
  textDefault: LIGHT.textDefault,
  textMuted: LIGHT.textMuted,
  textDim: LIGHT.textDim,
  // LIGHT 沒有比 textDim 更淡的階；faint 沿用 textDim（design-system.md §3.9 沒有再細分）。
  textFaint: LIGHT.textDim,
  // ghost 純裝飾（空狀態大 icon），沿用 borderMid 的低對比黑，比文字更淡一階。
  textGhost: LIGHT.borderMid,
  accent: LIGHT.accent,
  accentSoft: withAlpha(LIGHT.accent, 0.5),
  accentFaint: LIGHT.accentFaint,
  statusLive: LIGHT.statusLive,
  statusLiveSoft: withAlpha(LIGHT.statusLive, 0.16),
  statusLiveBorder: withAlpha(LIGHT.statusLive, 0.45),
  statusWarn: LIGHT.statusWarn,
  statusWarnSoft: withAlpha(LIGHT.statusWarn, 0.16),
  statusWarnBorder: withAlpha(LIGHT.statusWarn, 0.45),
  statusErr: LIGHT.statusErr,
  controlBg: LIGHT.controlBg,
  controlBgHover: LIGHT.controlBgHover,
  controlBorder: LIGHT.controlBorder,
  optionBg: LIGHT.surfaceSolid,
};

export function getIntelPalette(isDarkTheme: boolean): IntelPalette {
  return isDarkTheme ? DARK_INTEL : LIGHT_INTEL;
}

const IntelThemeContext = createContext<IntelPalette>(DARK_INTEL);

/** 子元件讀主題色。未被 Provider 包住時 fallback 深色（向後相容；Monitor Mode 沿用）。 */
export const useIntelTheme = (): IntelPalette => useContext(IntelThemeContext);

export function IntelThemeProvider({
  palette,
  children,
}: {
  palette: IntelPalette;
  children: ReactNode;
}) {
  return <IntelThemeContext.Provider value={palette}>{children}</IntelThemeContext.Provider>;
}

// ─── 徽章文字對比（design-system.md §5.21）──────────────────────────
//
// chipTint／chipOutline 的底色與框線沿用資料本身的色相不變；淡色主題下
// 若直接用該色當「字」色，淺色相（黃、淺綠、青…）對白底面板的對比嚴重不足。
// 規則：淡色主題把字色改成「該色 45% ＋ LIGHT.textStrong 55%」線性混色，
// 暗色維持原色不變。已對 NEWS_CATEGORIES／ALERT_GROUPS_DEF／ALERT_SEVERITY／
// COLORS.cluster 全部色相驗證 ≥4.5:1（見 intelTheme.contrast.test.ts）。

/** 淡色時把字色往 LIGHT.textStrong 混的比例（0=保留原色，1=全部變 textStrong）。 */
export const CHIP_TEXT_MIX = 0.55;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const full = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** 線性 RGB 混色；`t` = 混入 `hexB` 的比例。輸入非 hex（理論上不會發生）時原樣回傳 `hexA`。 */
export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  return rgbToHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
}

/** WCAG 相對亮度（0-1）。 */
export function relLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb.map(f) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 對比率（≥1）。 */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relLuminance(hexA);
  const l2 = relLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 徽章／分級文字色：暗色原樣回傳；淡色把 hue 與 `LIGHT.textStrong` 依 `CHIP_TEXT_MIX`
 * 混色以拉高對比。只用於「資料色當文字」的場景（chipTint/chipOutline 呼叫端、
 * IntelCard 展開區的分級色）；中性色（textDim 等）本身已經過主題選色，不要再套這層。
 */
export function chipText(color: string, palette: IntelPalette): string {
  if (palette.isDark) return color;
  return mixHex(color, LIGHT.textStrong, CHIP_TEXT_MIX);
}

/**
 * GIS_LEVELS／SEV_LEVELS 分級色轉主題安全色：
 * - 白色半透明佔位（NONE/MENTION）→ 對應主題的中性文字階
 * - 與 `COLORS.accent`／`statusWarn`／`statusErr` 同值 → 直接換成 palette 對應欄位（已是主題安全值）
 * - 其餘（純資料 hue，如黃／橘）→ 走 `chipText` 混色
 */
export function levelColor(raw: string, palette: IntelPalette): string {
  if (palette.isDark) return raw;
  if (raw === "rgba(255,255,255,0.22)") return palette.textFaint;
  if (raw === "rgba(255,255,255,0.42)") return palette.textMuted;
  if (raw === DARK_INTEL.accent) return palette.accent;
  if (raw === DARK_INTEL.statusWarn) return palette.statusWarn;
  if (raw === DARK_INTEL.statusErr) return palette.statusErr;
  return chipText(raw, palette);
}

/** 中性疊色：暗＝白疊在暗底（愈疊愈亮），淡＝黑疊在淡底（愈疊愈暗）。同 alpha 換極性，
 *  與 `BORDER.soft`(rgba(255,255,255,.06)) ↔ `LIGHT.borderSoft`(rgba(0,0,0,.06)) 同慣例。
 *  用於卡片／列底這類「疊在面板上、比面板更淺（暗）一階」的中性底，不用於 §3.16 資料色。 */
export function neutralFill(alpha: number, isDark: boolean): string {
  return isDark ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
}
