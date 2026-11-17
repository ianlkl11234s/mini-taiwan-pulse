/**
 * 太陽高度角（three-free 純函式）。
 *
 * 公式：天文年曆低精度太陽位置（Astronomical Almanac 簡式；1950–2050 年誤差約 0.01°），
 * 對「天黑了沒」這種用途綽綽有餘。不含大氣折射。
 *
 * 用法：同一時刻的多個位置共用 `solarFrame(unixSec)`（赤緯＋格林威治時角偏移），
 * 每個位置只算一次時角 → `solarElevationDeg(frame, lat, lng)`。
 */

const DEG = Math.PI / 180;

export interface SolarFrame {
  /** 太陽赤緯（弧度） */
  dec: number;
  /** 格林威治恆星時 − 赤經（度）；地方時角 = gha + 經度 */
  gha: number;
}

export function solarFrame(unixSec: number): SolarFrame {
  const d = unixSec / 86400 + 2440587.5 - 2451545.0; // 距 J2000.0 的日數
  const g = (357.529 + 0.98560028 * d) * DEG; // 平近點角
  const q = 280.459 + 0.98564736 * d; // 平黃經（度）
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG; // 真黃經
  const e = (23.439 - 0.00000036 * d) * DEG; // 黃赤交角
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / DEG; // 赤經（度）
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmstDeg = (18.697374558 + 24.06570982441908 * d) * 15;
  return { dec, gha: gmstDeg - ra };
}

/** 太陽高度角（度）：正＝地平線以上 */
export function solarElevationDeg(frame: SolarFrame, lat: number, lng: number): number {
  const h = (frame.gha + lng) * DEG;
  const phi = lat * DEG;
  const s = Math.sin(phi) * Math.sin(frame.dec) + Math.cos(phi) * Math.cos(frame.dec) * Math.cos(h);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

/**
 * 漁火亮度門檻（度）：太陽高度 ≥ 0°（白天）為 0；降到 −8°（民用暮光結束前後）全亮；
 * 中間用 smoothstep 漸變，所以日落後漸亮、日出前漸暗。
 */
export const NIGHT_LIGHT_FULL_DARK_DEG = -8;

export function nightLightIntensity(elevationDeg: number): number {
  if (elevationDeg >= 0) return 0;
  if (elevationDeg <= NIGHT_LIGHT_FULL_DARK_DEG) return 1;
  const t = elevationDeg / NIGHT_LIGHT_FULL_DARK_DEG; // 0 → 1
  return t * t * (3 - 2 * t);
}
