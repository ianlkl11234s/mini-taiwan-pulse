/**
 * 衛星情報面板暗／淡主題（P5，SC2）。
 *
 * SatelliteConsole 依底圖主題包 `IntelThemeProvider`（判斷同即時情報 `isDarkTheme`），
 * 子元件用 `useSatelliteTheme()` 取色：
 * - `p`：中性與狀態色（`IntelPalette`；淡色值全部取自 `LIGHT`）。
 * - `fill(hex)`：衛星資料色當「線／icon／圓點／色條」：淡色時加深到對白底至少 3:1
 *   （保色相，重用監看 D2 的 `lightDataFill`）；暗色原色。
 * - `text(hex)`：衛星資料色當「字」：淡色時過 `chipText`（§5.21）；暗色原色。
 * - `neutral(a)`：中性疊色，暗＝白 alpha、淡＝黑 alpha。
 */
import { chipText, neutralFill, useIntelTheme, type IntelPalette } from "../intel/intelTheme";
import { lightDataFill } from "../intel/monitor/monitorTheme";

export interface SatelliteTheme {
  p: IntelPalette;
  fill: (hex: string) => string;
  text: (hex: string) => string;
  neutral: (alpha: number) => string;
}

/** 資料色當線／點：暗色原色，淡色補到對白 3:1 */
export function satDataFill(hex: string, isDark: boolean): string {
  return isDark ? hex : lightDataFill(hex);
}

export function satelliteThemeFor(p: IntelPalette): SatelliteTheme {
  return {
    p,
    fill: (hex) => satDataFill(hex, p.isDark),
    text: (hex) => chipText(hex, p),
    neutral: (a) => neutralFill(a, p.isDark),
  };
}

/** 沒有 Provider 時為暗色（與改版前相同）。 */
export function useSatelliteTheme(): SatelliteTheme {
  return satelliteThemeFor(useIntelTheme());
}
