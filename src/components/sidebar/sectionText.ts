import { localizeSectionTitle } from "../../i18n/layerText";
import type { Locale } from "../../i18n/locales";
import { themeName } from "./layerCatalog";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** 大分類標題（顯示層）：先查 `macro.<中文原名>`，沒有再回退到原中文。 */
export function localizeMacroTitle(zh: string, active: Locale, t: T): string {
  if (active === "zh-TW") return zh;
  const key = `macro.${zh}`;
  const hit = t(key);
  return hit === key ? zh : hit;
}

/**
 * 主題列顯示名（顯示層）：zh-TW 維持既有「中文＋英文小字」；
 * 其他語系主名走 `localizeSectionTitle`，缺翻譯時日文退回既有英文副標、再退回中文，
 * 並把中文原名放小字方便對照。
 */
export function localizeThemeTitle(title: string, active: Locale, t: T): { primary: string; sub?: string } {
  const { zh, sub } = themeName(title);
  if (active === "zh-TW") return { primary: zh, sub };
  let primary = localizeSectionTitle(title, active, t);
  if (primary === title) primary = active === "ja" && sub && /^[A-Za-z]/.test(sub) ? sub : zh;
  return { primary, sub: primary === zh ? undefined : zh };
}
