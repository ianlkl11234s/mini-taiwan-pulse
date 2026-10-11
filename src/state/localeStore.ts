/**
 * 目前介面語系（i18n）。
 *
 * 決定順序：URL `?lang=` ＞ localStorage ＞ 預設 zh-TW。
 * 試點期間**不看瀏覽器語言**：大部分畫面還是中文，自動切換會讓外文瀏覽器使用者看到
 * 半中半外的介面。翻譯覆蓋夠了再決定要不要加回 navigator.languages。
 * URL 不受 urlState 的 `v=1` 版本閘門限制 —— `?lang=en` 單獨出現也要生效，
 * 方便直接分享英文／日文版連結。
 *
 * 訊息檔：預設語系同步打包；其他語系第一次切換時才 lazy import，
 * 載入完成前畫面維持原語系（不閃 key）。
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALES, isLocale, matchLocale, type Locale } from "../i18n/locales";
import { translate, type Messages, type TranslateVars } from "../i18n/translate";

const STORAGE_KEY = "mini-taiwan:locale:v1";

const defaultMessages = mergeModules(
  import.meta.glob<Messages>("../i18n/locales/zh-TW/*.json", { eager: true, import: "default" }),
);
const lazyModules = import.meta.glob<Messages>(["../i18n/locales/*/*.json", "!../i18n/locales/zh-TW/*.json"], { import: "default" });

function mergeModules(modules: Record<string, Messages>): Messages {
  return Object.assign({}, ...Object.keys(modules).sort().map((path) => modules[path]));
}

const loaded = new Map<Locale, Messages>([[DEFAULT_LOCALE, defaultMessages]]);
const pending = new Map<Locale, Promise<void>>();

/** 載入語系本身與它的回退語系（ja 缺字要能回退到 en，en 也得先載入）。 */
function loadLocale(locale: Locale): Promise<void> {
  const chain = [locale, ...LOCALES[locale].fallback].filter(isLocale);
  return Promise.all(chain.map(loadOne)).then(() => undefined);
}

function loadOne(locale: Locale): Promise<void> {
  if (loaded.has(locale)) return Promise.resolve();
  const existing = pending.get(locale);
  if (existing) return existing;
  const prefix = `../i18n/locales/${locale}/`;
  const paths = Object.keys(lazyModules).filter((path) => path.startsWith(prefix));
  const promise = Promise.all(paths.map(async (path) => [path, await lazyModules[path]!()] as const))
    .then((entries) => { loaded.set(locale, mergeModules(Object.fromEntries(entries))); })
    .finally(() => pending.delete(locale));
  pending.set(locale, promise);
  return promise;
}

function readInitialLocale(): Locale {
  try {
    if (typeof location !== "undefined") {
      const fromUrl = matchLocale(new URLSearchParams(location.search).get("lang"));
      if (fromUrl) return fromUrl;
    }
  } catch { /* URL 解析失敗就往下 */ }
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (isLocale(saved)) return saved;
  } catch { /* private mode：忽略 */ }
  return DEFAULT_LOCALE;
}

export interface LocaleSnapshot {
  /** 使用者選的語系 */
  locale: Locale;
  /** 訊息已載入、畫面實際使用的語系（lazy 載入期間仍是上一個） */
  active: Locale;
  t: (key: string, vars?: TranslateVars) => string;
}

function buildSnapshot(locale: Locale, active: Locale): LocaleSnapshot {
  const chain = [active, ...LOCALES[active].fallback, DEFAULT_LOCALE]
    .filter((code, index, all): code is Locale => isLocale(code) && all.indexOf(code) === index)
    .map((code) => loaded.get(code))
    .filter((messages): messages is Messages => messages != null);
  const intl = LOCALES[active].intl;
  return { locale, active, t: (key, vars) => translate(chain, intl, key, vars) };
}

let snapshot = buildSnapshot(DEFAULT_LOCALE, DEFAULT_LOCALE);
const listeners = new Set<() => void>();

function publish(next: LocaleSnapshot) {
  snapshot = next;
  if (typeof document !== "undefined") document.documentElement.lang = LOCALES[next.active].htmlLang;
  for (const listener of listeners) listener();
}

function activate(locale: Locale) {
  const ready = [locale, ...LOCALES[locale].fallback].filter(isLocale).every((code) => loaded.has(code));
  publish(buildSnapshot(locale, ready ? locale : snapshot.active));
  if (ready) return;
  void loadLocale(locale).then(
    () => { if (snapshot.locale === locale) publish(buildSnapshot(locale, locale)); },
    () => { /* 網路失敗：維持目前語系，下次切換再試 */ },
  );
}

export const localeStore = {
  getSnapshot: (): LocaleSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** App 啟動時呼叫一次：讀 URL／偏好／瀏覽器語言。 */
  init(): void {
    activate(readInitialLocale());
  },
  set(locale: Locale): void {
    if (locale === snapshot.locale) return;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, locale);
    } catch { /* 偏好存不了不影響切換 */ }
    activate(locale);
  },
  /** 測試用：等待 lazy 訊息載入 */
  ready: (locale: Locale): Promise<void> => loadLocale(locale),
};

/** React 端入口：`const { t, active } = useLocale();` */
export function useLocale(): LocaleSnapshot {
  return useSyncExternalStore(localeStore.subscribe, localeStore.getSnapshot, localeStore.getSnapshot);
}

export { STORAGE_KEY as LOCALE_STORAGE_KEY };
