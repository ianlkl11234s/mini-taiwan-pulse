/**
 * 監看模式暗／淡主題（spec §5.35 H2，P5）。
 *
 * MonitorPanel 依底圖主題包 `IntelThemeProvider`（只在新版；舊版一律暗）。卡片與共用圖表用
 * `useMonitorTheme()` 取色：
 * - `p`：中性與狀態色（`IntelPalette`；淡色值全部取自 `LIGHT`）。
 * - `chart`：圖表用中性色。暗色值與改版前的寫死字面值逐字相同，所以沒有 Provider 的地方
 *   （一般彈窗裡的折線）外觀不變。
 * - `fill(hex)`：資料色當「填色／線」（D2）：淡色時淺色相加深到對白底至少 3:1。
 * - `text(hex)`：資料色當「字」：淡色時與深色字混色（`chipText`）。
 */
import { LIGHT, SURFACE, BORDER, WHITE_ALPHA } from "../../../styles/designTokens";
import { chipText, contrastRatio, mixHex, useIntelTheme, type IntelPalette } from "../intelTheme";

export interface MonitorChartColors {
  /** 格線 */
  grid: string;
  /** 軸字（刻度值）／較淡的軸字（日期） */
  axis: string;
  axisFaint: string;
  /** 缺值斜線 */
  hatch: string;
  /** 正常範圍色帶 */
  band: string;
  /** 柱的缺值灰樁 */
  stub: string;
  /** hover 指示線 */
  hover: string;
  /** 柱選中外框 */
  selected: string;
  /** tooltip 底／框（也用於折線 hover 點的描邊） */
  tooltipBg: string;
  tooltipBorder: string;
}

const DARK_CHART: MonitorChartColors = {
  grid: "rgba(255,255,255,0.08)",
  axis: "rgba(255,255,255,0.5)",
  axisFaint: "rgba(255,255,255,0.4)",
  hatch: WHITE_ALPHA[12],
  band: WHITE_ALPHA[8],
  stub: "rgba(255,255,255,0.06)",
  hover: WHITE_ALPHA[20],
  selected: "rgba(255,255,255,0.65)",
  tooltipBg: SURFACE.solid,
  tooltipBorder: BORDER.panel,
};

// X1：同 alpha 換極性
const LIGHT_CHART: MonitorChartColors = {
  grid: "rgba(0,0,0,0.08)",
  axis: LIGHT.textMuted,
  axisFaint: LIGHT.textDim,
  hatch: "rgba(0,0,0,0.12)",
  band: "rgba(0,0,0,0.06)",
  stub: "rgba(0,0,0,0.06)",
  hover: "rgba(0,0,0,0.25)",
  selected: "rgba(0,0,0,0.6)",
  tooltipBg: LIGHT.surfaceSolid,
  tooltipBorder: LIGHT.border,
};

const MIN_FILL_CONTRAST = 3;
const fillCache = new Map<string, string>();

/** 淡色資料填色：#rrggbb 對白底不足 3:1 時逐步往深色字混，最多混 60%；非 hex（rgba 等）原樣回傳 */
export function lightDataFill(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const hit = fillCache.get(hex);
  if (hit) return hit;
  let out = hex;
  for (let t = 0.1; contrastRatio(out, "#ffffff") < MIN_FILL_CONTRAST && t <= 0.6 + 1e-9; t += 0.1) {
    out = mixHex(hex, LIGHT.textStrong, t);
  }
  fillCache.set(hex, out);
  return out;
}

export interface MonitorTheme {
  isDark: boolean;
  p: IntelPalette;
  chart: MonitorChartColors;
  fill: (hex: string) => string;
  text: (hex: string) => string;
  /** 中性疊色：暗＝白 alpha、淡＝黑 alpha */
  neutral: (alpha: number) => string;
}

const DARK_THEME_FNS = {
  fill: (hex: string) => hex,
  neutral: (a: number) => `rgba(255,255,255,${a})`,
};
const LIGHT_THEME_FNS = {
  fill: lightDataFill,
  neutral: (a: number) => `rgba(0,0,0,${a})`,
};

export function monitorThemeFor(p: IntelPalette): MonitorTheme {
  const fns = p.isDark ? DARK_THEME_FNS : LIGHT_THEME_FNS;
  return {
    isDark: p.isDark,
    p,
    chart: p.isDark ? DARK_CHART : LIGHT_CHART,
    fill: fns.fill,
    text: (hex: string) => chipText(hex, p),
    neutral: fns.neutral,
  };
}

/** 卡片與共用圖表取色；沒有 Provider 時為暗色（與改版前相同）。 */
export function useMonitorTheme(): MonitorTheme {
  return monitorThemeFor(useIntelTheme());
}
