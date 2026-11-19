/**
 * 視窗經度範圍 → 世界座標 [-180, 180] 內的區間。
 *
 * `map.getBounds()` 在平移到另一份世界（world copy）時，經度會超出 ±180（例如 350°～370°），
 * 直接與 bbox 比對會讓資料明明畫在畫面上卻被判為不相交。這裡把視窗中心 wrap 回 [-180, 180]，
 * 跨 ±180 的視窗回兩段區間；寬度 ≥ 360 視為整個世界。
 */
export function viewLngRanges(west: number, east: number): Array<[number, number]> {
  if (east - west >= 360) return [[-180, 180]];
  const shift = -360 * Math.round((west + east) / 2 / 360);
  const w = west + shift;
  const e = east + shift;
  const out: Array<[number, number]> = [[w, e]];
  if (w < -180) out.push([w + 360, e + 360]);
  if (e > 180) out.push([w - 360, e - 360]);
  return out;
}
