import { localizeSectionTitle, type I18nContext } from "../../i18n/layerText";
import { themeName, type ThemeRef } from "./layerCatalog";

/** 大分類標題（顯示層）：先查 `macro.<中文原名>`，沒有再回退到原中文。 */
export function localizeMacroTitle(zh: string, { active, lookup }: I18nContext): string {
  if (active === "zh-TW") return zh;
  return lookup(`macro.${zh}`) ?? zh;
}

/**
 * 主題列顯示名（顯示層）：zh-TW 維持既有「中文＋英文小字」；
 * 其他語系主名走 `localizeSectionTitle`，缺翻譯時日文退回既有英文副標、再退回中文，
 * 並把中文原名放小字方便對照。
 */
export function localizeThemeTitle(theme: ThemeRef, i18n: I18nContext): { primary: string; sub?: string } {
  const { active } = i18n;
  const { title } = theme;
  const { zh, sub } = themeName(theme);
  if (active === "zh-TW") return { primary: zh, sub };
  let primary = localizeSectionTitle(title, i18n);
  if (primary === title) primary = active === "ja" && sub && /^[A-Za-z]/.test(sub) ? sub : zh;
  return { primary, sub: primary === zh ? undefined : zh };
}
