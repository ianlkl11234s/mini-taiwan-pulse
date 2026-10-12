/**
 * 資料內容的顯示層翻譯（不是介面字串）。P1 起說明框、圖例都走這裡，不要各面板自己寫一套。
 *
 * 兩種情況：
 * 1. 資料本身有外文欄位（颱風 `name_en`、博物館 `name_eng`…）→ `localizedField`
 * 2. 資料是類別代碼，中文對照寫在 `*Types.ts`（新聞類別、設施類型…）→ `enumLabel`
 *    英日文寫在 `locales/<語系>/enums.json`，key = `enum.<domain>.<code>`；中文仍以原對照表為準。
 *
 * 自由文字（新聞標題、警報內文）不在這裡翻，顯示原文。
 */
import type { I18nContext } from "./layerText";
import type { Locale } from "./locales";

/** 各語系對應的欄位名；缺的語系會回退到 zh 欄位 */
export type LocalizedFieldMap = { zh: string } & Partial<Record<Exclude<Locale, "zh-TW">, string>>;

export interface LocalizedValue {
  text: string;
  /** true＝目前語系沒有這個欄位或值是空的，顯示的是中文原值 */
  isFallback: boolean;
}

function nonEmpty(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/**
 * 依語系挑欄位：`localizedField(props, { zh: "name", en: "name_en" }, i18n)`。
 * 中文欄位也沒有值時回傳 null（缺資料不要變成空字串或 0）。
 */
export function localizedField(
  record: Readonly<Record<string, unknown>>,
  fields: LocalizedFieldMap,
  { active }: Pick<I18nContext, "active">,
): LocalizedValue | null {
  const zh = nonEmpty(record[fields.zh]);
  if (active !== "zh-TW") {
    const field = fields[active];
    const localized = field ? nonEmpty(record[field]) : null;
    if (localized) return { text: localized, isFallback: false };
  }
  return zh == null ? null : { text: zh, isFallback: active !== "zh-TW" };
}

/**
 * 類別代碼 → 目前語系的標籤：`enumLabel("newsCategory", "disaster", NEWS_LABELS.disaster, i18n)`。
 * `zhLabel` 傳既有中文對照表的值，中文介面直接回傳它，不必搬進 JSON。
 */
export function enumLabel(domain: string, code: string | number, zhLabel: string, { active, lookup }: I18nContext): string {
  if (active === "zh-TW") return zhLabel;
  return lookup(`enum.${domain}.${code}`) ?? zhLabel;
}
