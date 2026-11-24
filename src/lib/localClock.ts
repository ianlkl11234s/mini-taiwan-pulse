/**
 * 時間軸「當地時間」小字的純函式（多時區時間軸第 2 步，2026-11-23）。
 * 時間軸一律顯示台北時間；看外國（地圖中心在位移不同的國家）時，旁邊附當地時間。
 * 無 React、無全域狀態；時區換算沿用 zonedTime（內部已快取 formatter）。
 */
import { countryDef, countryForPoint, type CountryCode } from "../constants/countries";
import { DEFAULT_TIME_ZONE, zonedDateKey, zonedOffsetMinutes, zonedParts } from "./zonedTime";

export interface LocalClock {
  /** 當地時間 HH:mm */
  time: string;
  /** UTC 位移，例 "+0"、"-8"、"+5:30" */
  offset: string;
  /** 當地日期相對台北日期：-1 前一天、0 同一天、1 隔天 */
  dayShift: -1 | 0 | 1;
  /** true＝國家跨多個時區，改顯示 UTC（站主 2026-11-24 決定），不是當地時間 */
  utc?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h}` : `${sign}${h}:${pad2(m)}`;
}

/**
 * unix 秒＋時區 → 要顯示的當地時間；位移與台北相同（或輸入無效）回 null。
 * 位移用「該時刻」比較，所以倫敦夏令（UTC+1）仍與台北不同、而 +8 的國家永遠 null。
 */
export function localClockFor(unixSec: number, timeZone: string): LocalClock | null {
  const ms = unixSec * 1000;
  if (!Number.isFinite(ms)) return null;
  const offsetMin = zonedOffsetMinutes(ms, timeZone);
  if (offsetMin === zonedOffsetMinutes(ms, DEFAULT_TIME_ZONE)) return null;
  const p = zonedParts(ms, timeZone);
  const local = zonedDateKey(ms, timeZone);
  const taipei = zonedDateKey(ms, DEFAULT_TIME_ZONE);
  return {
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
    offset: formatOffset(offsetMin),
    dayShift: local < taipei ? -1 : local > taipei ? 1 : 0,
  };
}

/**
 * 地圖中心所在國家（不在任何國家框內回 undefined）。
 */
export function countryForMapCenter(lng: number, lat: number): CountryCode | undefined {
  return countryForPoint(lng, lat);
}

/**
 * 國家 → 當地時間（國家為 undefined 回 null）。
 * 國家設定登記了多個時區（`timeZones`，例 CA）時改顯示 UTC：用預設時區會在溫哥華顯示多倫多時間，
 * 差 3 小時（站主 2026-11-24 決定「跨時區國家統一以 UTC 顯示」）。
 */
export function localClockForCountry(unixSec: number, country: CountryCode | undefined): LocalClock | null {
  if (!country) return null;
  const def = countryDef(country);
  if ((def.timeZones?.length ?? 0) > 1) {
    const clock = localClockFor(unixSec, "UTC");
    return clock && { ...clock, utc: true };
  }
  return localClockFor(unixSec, def.timeZone);
}
