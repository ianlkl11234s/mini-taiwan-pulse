/**
 * 隱私說明頁（/privacy）的語言選擇。
 *
 * 刻意不 import `state/localeStore`：它會 eager 打包整包 zh-TW 介面字串，這頁只需要自己的長文。
 * 決定順序：網址 `?lang=` ＞ 主站存過的語系（同一個 localStorage key）＞ zh-TW。
 * 不跟隨瀏覽器語言（與主站不同）：這頁是法遵文件，預設以中文版為準。
 */
import { DEFAULT_LOCALE, LOCALES, isLocale, matchLocale, type Locale } from "../i18n/locales";

/** 與 `state/localeStore` 的 LOCALE_STORAGE_KEY 相同（測試釘住兩邊一致）。 */
export const PRIVACY_LOCALE_STORAGE_KEY = "mini-taiwan:locale:v1";

type ReadableStorage = Pick<Storage, "getItem">;

export function resolvePrivacyLocale(search: string, storage: ReadableStorage | null): Locale {
  try {
    const fromUrl = matchLocale(new URLSearchParams(search).get("lang"));
    if (fromUrl) return fromUrl;
  } catch { /* 網址解析失敗就往下 */ }
  try {
    const saved = storage?.getItem(PRIVACY_LOCALE_STORAGE_KEY) ?? null;
    if (isLocale(saved)) return saved;
  } catch { /* private mode：忽略 */ }
  return DEFAULT_LOCALE;
}

/** 主站連到隱私頁的網址：非中文介面帶 `?lang=`，讓自動判斷出的語系也能延續。 */
export function privacyHref(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/privacy" : `/privacy?lang=${locale}`;
}

export function htmlLangOf(locale: Locale): string {
  return LOCALES[locale].htmlLang;
}
