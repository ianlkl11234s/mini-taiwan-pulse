/**
 * 共享軌道工具函數
 * 被 RailEngine 和 TraTrainEngine 共用
 */

/** 延長日制起始點：05:50（台鐵/捷運營運日分界） */
export const DAY_START_SECONDS = 5 * 3600 + 50 * 60; // 21000

/** 時間字串 "HH:MM:SS" 轉為延長日秒數（05:50 前的時間 +86400） */
export function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  const totalSec = h * 3600 + m * 60 + s;
  return totalSec < DAY_START_SECONDS ? totalSec + 86400 : totalSec;
}

/** Unix timestamp 轉為延長日秒數（台灣時區 UTC+8） */
export function unixToExtendedDaySeconds(unixTs: number): number {
  const daySeconds = ((unixTs + 8 * 3600) % 86400);
  return daySeconds < DAY_START_SECONDS ? daySeconds + 86400 : daySeconds;
}

/** 計算線段總長度 */
export function calculateTotalLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** 在 LineString 上進行線性內插 */
export function interpolateOnLineString(
  coords: [number, number][],
  progress: number,
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0]!;
  if (progress <= 0) return coords[0]!;
  if (progress >= 1) return coords[coords.length - 1]!;

  const totalLength = calculateTotalLength(coords);
  const targetDistance = totalLength * progress;

  let accumulated = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDistance) {
      const t = (targetDistance - accumulated) / segLen;
      return [
        a[0] + dx * t,
        a[1] + dy * t,
      ];
    }
    accumulated += segLen;
  }

  return coords[coords.length - 1]!;
}

/**
 * 兩點的行進方位角（度，正北 0、順時針，[0, 360)）；兩點重合回 null。
 * 小範圍用平面近似（經度差乘 cos 緯度），與地圖上看到的方向一致即可。
 * R6 段 3：平面模式方向箭頭用（Mapbox `icon-rotate`）。
 */
export function bearingDeg(from: readonly [number, number], to: readonly [number, number]): number | null {
  const dLng = (to[0] - from[0]) * Math.cos(((from[1] + to[1]) / 2) * Math.PI / 180);
  const dLat = to[1] - from[1];
  if (Math.abs(dLng) < 1e-12 && Math.abs(dLat) < 1e-12) return null;
  const deg = Math.atan2(dLng, dLat) * 180 / Math.PI;
  return (deg + 360) % 360;
}

/**
 * 同 `interpolateOnLineString`（位置逐字相同），另回傳所在線段的方位角（沿座標順序）。
 * R6 段 3：列車引擎一次算出位置與行進方向，暫停／拖時間軸時箭頭方向也正確。
 */
export function interpolateWithBearingOnLineString(
  coords: [number, number][],
  progress: number,
): { position: [number, number]; bearing: number | null } {
  if (coords.length < 2) return { position: interpolateOnLineString(coords, progress), bearing: null };
  const last = coords.length - 1;
  if (progress <= 0) return { position: coords[0]!, bearing: bearingDeg(coords[0]!, coords[1]!) };
  if (progress >= 1) return { position: coords[last]!, bearing: bearingDeg(coords[last - 1]!, coords[last]!) };

  // 單趟走訪（引擎每 tick 對每班車呼叫，不能比原本多走一次）；位置算式與 interpolateOnLineString 相同
  const targetDistance = calculateTotalLength(coords) * progress;
  let accumulated = 0;
  for (let i = 0; i < last; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDistance) {
      const t = (targetDistance - accumulated) / segLen;
      return { position: [a[0] + dx * t, a[1] + dy * t], bearing: bearingDeg(a, b) };
    }
    accumulated += segLen;
  }
  return { position: coords[last]!, bearing: bearingDeg(coords[last - 1]!, coords[last]!) };
}

/** 行進方向與座標順序相反（progress 遞減）時把方位角轉 180°。 */
export function directedBearing(bearing: number | null, reverse: boolean): number | null {
  if (bearing == null) return null;
  return reverse ? (bearing + 180) % 360 : bearing;
}
