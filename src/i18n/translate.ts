/**
 * 極簡 `t()`：扁平 key、`{name}` 插值、`_one`/`_other` 複數後綴（i18next 相容格式）。
 *
 * 刻意不引入 i18next：目前只需要「查字 + 插值 + 英文複數」，自寫約 50 行即可。
 * JSON 檔維持 i18next 的扁平格式，日後需要 ICU／命名空間 lazy 載入時可以直接換套件，
 * 翻譯檔不用重寫。
 */
export type Messages = Readonly<Record<string, string>>;

export type TranslateVars = Readonly<Record<string, string | number>>;

const PLURAL_RULES = new Map<string, Intl.PluralRules>();

function pluralCategory(intlLocale: string, count: number): string {
  let rules = PLURAL_RULES.get(intlLocale);
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale);
    PLURAL_RULES.set(intlLocale, rules);
  }
  return rules.select(count);
}

function interpolate(template: string, vars: TranslateVars | undefined): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/**
 * 依序在 `chain`（目前語系 → fallback 語系）找 key；全部找不到回傳 key 本身，
 * 讓缺字在畫面上一眼可見（parity 測試會在 CI 擋下）。
 */
export function translate(
  chain: readonly Messages[],
  intlLocale: string,
  key: string,
  vars?: TranslateVars,
): string {
  const count = vars?.count;
  const pluralKey = typeof count === "number" ? `${key}_${pluralCategory(intlLocale, count)}` : null;
  for (const messages of chain) {
    const hit = (pluralKey && messages[pluralKey]) ?? messages[key] ?? (pluralKey ? messages[`${key}_other`] : undefined);
    if (hit != null) return interpolate(hit, vars);
  }
  return key;
}
