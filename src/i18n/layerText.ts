/**
 * 圖層／主題名稱的顯示層翻譯。
 *
 * ⚠️ 只在「畫到畫面上」這一刻翻譯，manifest 的 `name`、`label`、`section.theme`、
 * `section.group` 一律不動 —— 它們同時是 THEMES 索引、搜尋索引、URL 與 Agent 的識別字。
 *
 * 翻譯來源（`src/i18n/locales/<locale>/layers.json`、`themes.json`）：
 * - `layer.<layerKey>`：圖層名稱，key 用 manifest key（穩定、不會因改中文名而失效）
 * - `theme.<原始主題或子群字串>`：主題／子群標題
 * 缺翻譯時回退到 manifest 既有的外文名或中文原名，不會出現空白。
 */
import type { LayerName } from "../data/layerManifest";
import type { Locale } from "./locales";

type T = (key: string) => string;

const HAS_KANA = /[぀-ヿ]/;
const HAS_HAN = /[㐀-鿿]/;

function lookup(t: T, key: string): string | null {
  const value = t(key);
  return value === key ? null : value;
}

export interface LocalizedLayerName {
  /** 主名（該語系） */
  primary: string;
  /** 小字註記：非中文介面時放中文原名，方便對照在地名稱 */
  secondary?: string;
  qualifier?: string;
}

export function localizeLayerName(layerKey: string, name: LayerName, locale: Locale, t: T): LocalizedLayerName {
  if (locale === "zh-TW") return { primary: name.zh, secondary: name.alt, qualifier: name.qualifier };
  const translated = lookup(t, `layer.${layerKey}`);
  // manifest 的 alt 是「原文外文名」：日本圖層是日文、其他多為英文
  const altFits = name.alt && (locale === "ja" ? HAS_KANA.test(name.alt) || HAS_HAN.test(name.alt) : !HAS_HAN.test(name.alt) && !HAS_KANA.test(name.alt));
  const primary = translated ?? (altFits ? name.alt! : name.zh);
  return { primary, secondary: primary === name.zh ? undefined : name.zh, qualifier: name.qualifier };
}

/** 主題／子群標題。既有寫法是「中文 English」，英文介面可直接取後半。 */
export function localizeSectionTitle(title: string, locale: Locale, t: T): string {
  if (locale === "zh-TW") return title;
  const translated = lookup(t, `theme.${title}`);
  if (translated) return translated;
  if (locale === "en") {
    const english = title.match(/^[^\sA-Za-z]+\s+([A-Za-z].*)$/)?.[1];
    if (english) return english;
  }
  return title;
}
