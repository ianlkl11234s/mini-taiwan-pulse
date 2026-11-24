/**
 * 目前介面語系（i18n）。
 *
 * 決定順序：URL `?lang=` ＞ localStorage（使用者手動選過）＞ `navigator.languages` ＞ 預設 zh-TW。
 * 瀏覽器語言逐一比對（`matchLocale`）：zh-* 一律中文，不支援的語言（fr 等）落到中文。
 * 2026-10-16 起自動跟隨瀏覽器（翻譯已覆蓋主要畫面，使用者拍板）。
 * URL 不受 urlState 的 `v=1` 版本閘門限制 —— `?lang=en` 單獨出現也要生效，
 * 方便直接分享英文／日文版連結。
 *
 * 訊息檔：預設語系（zh-TW）同步打包，開站行為不變。英日文分批載入（B1 P6，規則見 `src/i18n/localeFiles.ts`）：
 * - 切到英日文時先載開站檔（`BOOT_FILES`＋已登記需要的檔，例如已載入國家包的 `layers.<cc>`），
 *   載完才換語系，載入期間畫面維持原語系（不閃 key）；
 * - 其餘的檔在第一次查不到字時才載。載入期間該字回退到中文（中文檔一直都在：介面字有中文原文，
 *   名稱類 key 由呼叫端的 `lookup` 回退中文名），載完重發 snapshot，畫面換成該語言。
 *   選「先顯示中文」而不是「等載完」：說明框、圖例、設定面板是使用者點開才出現的，等待會讓點擊沒反應；
 *   中文後備一定是正確內容，不會是 key 或空白。
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALES, isLocale, matchLocale, type Locale } from "../i18n/locales";
import { lookup, translate, type Messages, type TranslateVars } from "../i18n/translate";
import type { MessageKey } from "../i18n/keys";
import { formatDateTime, formatNumber } from "../i18n/format";
import { syncCanonicalLink } from "../i18n/canonical";
import { BOOT_FILES, filesForKey } from "../i18n/localeFiles";
import { withLoading } from "../lib/loadingRegistry";

const STORAGE_KEY = "mini-taiwan:locale:v1";

const defaultMessages = mergeModules(
  import.meta.glob<Messages>("../i18n/locales/zh-TW/*.json", { eager: true, import: "default" }),
);
const lazyModules = import.meta.glob<Messages>(["../i18n/locales/*/*.json", "!../i18n/locales/zh-TW/*.json"], { import: "default" });

function mergeModules(modules: Record<string, Messages>): Messages {
  return Object.assign({}, ...Object.keys(modules).sort().map((path) => modules[path]));
}

const filePath = (locale: Locale, file: string) => `../i18n/locales/${locale}/${file}.json`;
const hasFile = (locale: Locale, file: string) => filePath(locale, file) in lazyModules;
function allFiles(locale: Locale): string[] {
  const prefix = `../i18n/locales/${locale}/`;
  return Object.keys(lazyModules).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length, -".json".length));
}

/** 各語系已載入的檔 → 內容；`merged` 是合併後的查字表（依檔名排序合併，與整包載入時相同）。 */
const loadedFiles = new Map<Locale, Map<string, Messages>>();
const merged = new Map<Locale, Messages>([[DEFAULT_LOCALE, defaultMessages]]);
/** 正在抓的檔（`<locale>/<file>`） */
const pendingFiles = new Map<string, Promise<void>>();
/** 抓過但失敗的檔：查不到字時不再自動重抓（避免迴圈），下次切換語系時清掉重試。 */
const failedFiles = new Set<string>();
/** 開站要載的檔＋之後登記需要的檔（國家包的 `layers.<cc>`）。換語系時這些都載完才切過去。 */
const wantedFiles = new Set<string>(BOOT_FILES);
let wantAllFiles = false;
let loadSeq = 0;

function filesOf(locale: Locale): Map<string, Messages> {
  let files = loadedFiles.get(locale);
  if (!files) { files = new Map(); loadedFiles.set(locale, files); }
  return files;
}

function isSettled(locale: Locale, file: string): boolean {
  return !hasFile(locale, file) || filesOf(locale).has(file);
}

/**
 * 載入某語系的幾個檔；全部成功才 resolve（任一失敗就 reject，已成功的照樣可用）。
 * 一批登記成一個 loadingRegistry 任務。
 */
function loadFiles(locale: Locale, files: Iterable<string>): Promise<void> {
  if (locale === DEFAULT_LOCALE) return Promise.resolve();
  const todo = [...new Set(files)].filter((f) => !isSettled(locale, f));
  if (!todo.length) return Promise.resolve();
  const jobs = todo.map((file) => {
    const id = `${locale}/${file}`;
    const existing = pendingFiles.get(id);
    if (existing) return existing;
    const job = lazyModules[filePath(locale, file)]!()
      .then((messages) => { filesOf(locale).set(file, messages); failedFiles.delete(id); })
      .catch((err: unknown) => { failedFiles.add(id); throw err; })
      .finally(() => pendingFiles.delete(id));
    pendingFiles.set(id, job);
    return job;
  });
  const batch = Promise.allSettled(jobs).then((results) => {
    const files = filesOf(locale);
    merged.set(locale, Object.assign({}, ...[...files.keys()].sort().map((f) => files.get(f))));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) throw failed.reason;
  });
  return withLoading(`locale:${locale}:${++loadSeq}`, `載入${LOCALE_LABEL_ZH[locale]}翻譯`, batch);
}

const LOCALE_LABEL_ZH: Record<Locale, string> = { "zh-TW": "中文", en: "英文", ja: "日文" };

/** 某語系換過去前必須載完的檔。 */
function requiredFiles(locale: Locale): string[] {
  return wantAllFiles ? allFiles(locale) : [...wantedFiles];
}

/** 載入語系本身與它的回退語系的全部檔（測試與 embed／card 等獨立入口用）。 */
function loadLocale(locale: Locale): Promise<void> {
  const chain = [locale, ...LOCALES[locale].fallback].filter(isLocale);
  return Promise.all(chain.map((code) => loadFiles(code, allFiles(code)))).then(() => undefined);
}

/** 查不到字時要補載的檔（per 語系排隊，同一個 microtask 內合成一批）。 */
const missQueue = new Map<Locale, Set<string>>();
/** 已確認「沒有檔可再載」的 key，之後不再找（per 語系）。 */
const missSettled = new Map<Locale, Set<string>>();
let missFlushScheduled = false;

function hasKey(messages: Messages | undefined, key: string): boolean {
  return messages != null && (messages[key] != null || messages[`${key}_other`] != null);
}

function noteMiss(active: Locale, key: string): void {
  let settled = missSettled.get(active);
  if (!settled) { settled = new Set(); missSettled.set(active, settled); }
  if (settled.has(key)) return;
  for (const code of [active, ...LOCALES[active].fallback].filter(isLocale)) {
    if (code === DEFAULT_LOCALE) break;
    if (hasKey(merged.get(code), key)) break;
    const todo = filesForKey(key, (f) => hasFile(code, f))
      .filter((f) => !isSettled(code, f) && !failedFiles.has(`${code}/${f}`));
    if (todo.length) {
      const queue = missQueue.get(code) ?? new Set<string>();
      for (const f of todo) queue.add(f);
      missQueue.set(code, queue);
      scheduleMissFlush();
      return;
    }
  }
  settled.add(key);
}

function scheduleMissFlush(): void {
  if (missFlushScheduled) return;
  missFlushScheduled = true;
  queueMicrotask(() => {
    missFlushScheduled = false;
    const batches = [...missQueue];
    missQueue.clear();
    for (const [code, files] of batches) {
      void loadFiles(code, files).catch(() => undefined).then(() => {
        // 補到的字要讓畫面重畫：重發同一語系的 snapshot（t／lookup 換新身分）
        const { locale, active } = snapshot;
        if (active !== DEFAULT_LOCALE && [active, ...LOCALES[active].fallback].includes(code)) publish(buildSnapshot(locale, active));
      });
    }
  });
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
  try {
    const languages = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
    for (const tag of languages) {
      const matched = matchLocale(tag);
      if (matched) return matched;
    }
  } catch { /* 取不到瀏覽器語言就用預設 */ }
  return DEFAULT_LOCALE;
}

export interface LocaleSnapshot {
  /** 使用者選的語系 */
  locale: Locale;
  /** 訊息已載入、畫面實際使用的語系（lazy 載入期間仍是上一個） */
  active: Locale;
  /** 型別檢查過的 key；找不到時回傳 key 本身 */
  t: (key: MessageKey, vars?: TranslateVars) => string;
  /** 動態 key（由資料組出來的）：找不到回 null，呼叫端自己決定 fallback */
  lookup: (key: MessageKey, vars?: TranslateVars) => string | null;
  /** 依目前語系格式化數字（千分位等） */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** 依目前語系格式化時間（固定台北時區） */
  formatDateTime: (value: number | Date, options?: Intl.DateTimeFormatOptions) => string;
}

function buildSnapshot(locale: Locale, active: Locale): LocaleSnapshot {
  const chain = [active, ...LOCALES[active].fallback, DEFAULT_LOCALE]
    .filter((code, index, all): code is Locale => isLocale(code) && all.indexOf(code) === index)
    .map((code) => merged.get(code))
    .filter((messages): messages is Messages => messages != null);
  const intl = LOCALES[active].intl;
  const own = merged.get(active);
  // 英日文查不到字 → 找出它所在的檔補載（中文整包都在，不必查）
  const check = active === DEFAULT_LOCALE ? null : (key: string) => { if (!hasKey(own, key)) noteMiss(active, key); };
  return {
    locale,
    active,
    t: (key, vars) => { check?.(key); return translate(chain, intl, key, vars); },
    lookup: (key, vars) => { check?.(key); return lookup(chain, intl, key, vars); },
    formatNumber: (value, options) => formatNumber(active, value, options),
    formatDateTime: (value, options) => formatDateTime(active, value, options),
  };
}

let snapshot = buildSnapshot(DEFAULT_LOCALE, DEFAULT_LOCALE);
const listeners = new Set<() => void>();

function publish(next: LocaleSnapshot) {
  snapshot = next;
  if (typeof document !== "undefined") { document.documentElement.lang = LOCALES[next.active].htmlLang; syncCanonicalLink(document, `?lang=${next.locale}`); } // 用目標語系推 canonical：此時 location.search 還是舊 lang（App 之後才改網址）
  for (const listener of listeners) listener();
}

function activate(locale: Locale) {
  const required = requiredFiles(locale);
  const ready = locale === DEFAULT_LOCALE || required.every((f) => isSettled(locale, f));
  publish(buildSnapshot(locale, ready ? locale : snapshot.active));
  if (ready) return;
  void loadFiles(locale, required).then(
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
  init(options: { allFiles?: boolean } = {}): void {
    // embed／card 等獨立入口：一次載全部檔（它們有用 setHTML 一次畫好的文字，補載後不會重畫）
    if (options.allFiles) wantAllFiles = true;
    activate(readInitialLocale());
  },
  set(locale: Locale): void {
    // 語系包下載失敗時 snapshot.locale 已是新語系、active 仍是舊的 → 再點同語言要能重試
    if (locale === snapshot.locale && snapshot.active === locale) return;
    // 上次抓失敗的檔，這次切換重試
    failedFiles.clear();
    missSettled.clear();
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, locale);
    } catch { /* 偏好存不了不影響切換 */ }
    activate(locale);
  },
  /** 測試用：載入語系（含回退語系）的全部檔 */
  ready: (locale: Locale): Promise<void> => loadLocale(locale),
  /**
   * 登記需要的檔並在目前選的語系（非中文時）載入，例如國家包的 `layers.<cc>`。
   * 之後切換語系也會先載這些檔。失敗不 reject（字會回退中文），回傳的 Promise 只用來等待。
   */
  need(files: readonly string[]): Promise<void> {
    for (const f of files) wantedFiles.add(f);
    const target = snapshot.locale;
    if (target === DEFAULT_LOCALE) return Promise.resolve();
    const chainReady = files.every((f) => isSettled(target, f));
    if (chainReady) return Promise.resolve();
    return loadFiles(target, files).catch(() => undefined).then(() => {
      if (snapshot.active === target) publish(buildSnapshot(snapshot.locale, target));
    });
  },
  /** 除錯與量測：某語系已載入的檔 */
  loadedFiles: (locale: Locale): string[] => [...filesOf(locale).keys()].sort(),
};

/** React 端入口：`const { t, active } = useLocale();` */
export function useLocale(): LocaleSnapshot {
  return useSyncExternalStore(localeStore.subscribe, localeStore.getSnapshot, localeStore.getSnapshot);
}

export { STORAGE_KEY as LOCALE_STORAGE_KEY };
