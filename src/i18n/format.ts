/**
 * 依目前語系格式化數字與時間。取代散落各處寫死的 `toLocaleString("zh-TW")`。
 * 時間一律以台北時區顯示（資料語意是台灣時間，不跟著瀏覽器時區跑）。
 *
 * 只給「顯示用」；日期 key（taipeiDay.ts、`sv-SE` ISO 字串）不要改用這裡。
 */
import { LOCALES, type Locale } from "./locales";

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(locale: Locale, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(options ?? {})}`;
  let fmt = cache.get(key) as Intl.NumberFormat | undefined;
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALES[locale].intl, options);
    cache.set(key, fmt);
  }
  return fmt;
}

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(options)}`;
  let fmt = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALES[locale].intl, { timeZone: "Asia/Taipei", ...options });
    cache.set(key, fmt);
  }
  return fmt;
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return numberFormat(locale, options).format(value);
}

export function formatDateTime(
  locale: Locale,
  value: number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return dateFormat(locale, options).format(value);
}
