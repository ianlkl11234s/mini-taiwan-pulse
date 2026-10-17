/**
 * 支援語系登記簿（i18n 的單一真實來源）。
 *
 * 新增語系 = 這裡加一筆（`status: "partial"`）+ 建 `src/i18n/locales/<code>/` 資料夾。
 * partial 語系可以邊翻邊合併：缺的 key 走 fallback，`localeParity` 只報告缺多少；
 * 翻完改成 `"complete"`，之後缺任何一個 key 都會紅燈。
 * 預設語系（zh-TW）的訊息同步打包；其他語系切換時才 lazy 載入。
 */
export const DEFAULT_LOCALE = "zh-TW" as const;

export const LOCALES = {
  "zh-TW": { label: "中文", aiLanguage: "繁體中文", htmlLang: "zh-Hant-TW", intl: "zh-TW", fallback: [], status: "complete" },
  en: { label: "EN", aiLanguage: "英文（English）", htmlLang: "en", intl: "en-US", fallback: ["zh-TW"], status: "complete" },
  ja: { label: "日本語", aiLanguage: "日文（日本語）", htmlLang: "ja", intl: "ja-JP", fallback: ["en", "zh-TW"], status: "complete" },
} as const satisfies Record<string, LocaleInfo>;

interface LocaleInfo {
  /** 切換器上顯示的名稱（用該語言自己的寫法） */
  label: string;
  /** AI 對話的回答語言（寫進中文系統提示，所以用中文稱呼，括號附原文） */
  aiLanguage: string;
  /** 寫進 `<html lang>`，同時驅動 CSS `:lang()` 字型堆疊 */
  htmlLang: string;
  /** Intl.NumberFormat / DateTimeFormat 用的 locale */
  intl: string;
  /** 該語系缺字時依序回退；最後一定落到預設語系 */
  fallback: readonly string[];
  /** complete：key 必須與預設語系完全一致；partial：翻譯中，缺字走 fallback */
  status: "complete" | "partial";
}

export type Locale = keyof typeof LOCALES;

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

/** 把瀏覽器／URL 給的語言標籤（`en-GB`、`ja-JP`、`zh-Hant`）對到支援語系；對不到回 null。 */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (isLocale(tag)) return tag;
  if (lower.startsWith("zh")) return "zh-TW";
  const base = lower.split("-")[0];
  return isLocale(base) ? base : null;
}
