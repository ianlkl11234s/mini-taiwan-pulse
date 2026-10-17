/**
 * 底圖地名語言跟著介面語系（i18n P5）。
 *
 * - 主站（Mapbox GL 3.x）：`new Map({ language })` + `map.setLanguage()`。
 *   classic style（dark-v11 等）的 text-field 是 `coalesce(name_en, name)`；帶 language 時
 *   Mapbox 伺服器會把 `name` 換成該語言並拿掉 `name_*`，所以不用改 style 表達式。
 *   setLanguage 只 reloadSources，不重載 style —— 自訂圖層（Three.js custom layer、overlay）不受影響；
 *   語言存在 map 上，setStyle 切底圖後沿用。
 * - 嵌入頁／卡片頁（Protomaps）：`layers(..., { lang })`。
 *
 * 本檔不得 import mapbox-gl／maplibre-gl（嵌入頁共用，且要能在 Node 測試）。
 */
import type { Locale } from "../i18n/locales";

/** 介面語系 → 底圖地名語言（BCP-47；Mapbox 與 Protomaps 都吃這組代碼）。 */
const BASEMAP_LABEL_LANGUAGE: Record<Locale, string> = {
  "zh-TW": "zh-Hant",
  en: "en",
  ja: "ja",
};

export function basemapLabelLanguage(locale: Locale): string {
  return BASEMAP_LABEL_LANGUAGE[locale];
}

/** 只用到 Mapbox Map 的這兩個方法，方便測試注入假物件。 */
export interface LanguageMap {
  getLanguage(): unknown;
  setLanguage(language: string): unknown;
}

export interface LocaleSource {
  getSnapshot(): { locale: Locale };
  subscribe(listener: () => void): () => void;
}

/** 語言不同才呼叫 setLanguage（每次呼叫都會重抓底圖 tile）。回傳是否有切換。 */
export function applyBasemapLanguage(map: LanguageMap, locale: Locale): boolean {
  const language = basemapLabelLanguage(locale);
  if (map.getLanguage() === language) return false;
  map.setLanguage(language);
  return true;
}

/** 訂閱語系變化並同步底圖地名；回傳取消訂閱。 */
export function bindBasemapLanguage(map: LanguageMap, source: LocaleSource): () => void {
  applyBasemapLanguage(map, source.getSnapshot().locale);
  return source.subscribe(() => applyBasemapLanguage(map, source.getSnapshot().locale));
}
