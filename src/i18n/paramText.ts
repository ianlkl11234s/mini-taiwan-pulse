/**
 * 圖層設定面板（layerParamsSpec.ts）的顯示層翻譯。
 *
 * 中文標籤是原始碼：Agent（research/layerControls.ts）、黃金快照、`english-control-label`
 * guard 都讀中文，所以規格檔不改，只在面板顯示時換語系。
 *
 * 英日文寫在 `locales/<語系>/params.json`，用中文原文當 key：`param.透明度`。
 * 「透明度」「大小」這類字在幾百個控件重複，翻一次全部通用；新圖層沿用既有字就自動有翻譯，
 * 沒翻到的顯示中文，不會擋上線。
 * 同一個中文在某個圖層要不同譯法時，加 `param.<layerKey>.<參數名>` 覆寫（優先查）。
 */
import type { I18nContext } from "./layerText";

const CJK = /[㐀-鿿]/u;

/** 控件文字 → 目前語系。`target` 給了就先查單一圖層的覆寫。不含中文的字（`×`、`min`）原樣回傳 */
export function paramText(
  zh: string,
  i18n: I18nContext | undefined,
  target?: { layerKey: string; name: string },
): string {
  if (!i18n || i18n.active === "zh-TW" || !CJK.test(zh)) return zh;
  return (target && i18n.lookup(`param.${target.layerKey}.${target.name}`)) ?? i18n.lookup(`param.${zh}`) ?? zh;
}

/** 色盤名（palettes.ts 的 `zh`）→ 目前語系，key = `enum.palette.<id>` */
export function paletteName(id: string, zh: string, i18n: I18nContext | undefined): string {
  if (!i18n || i18n.active === "zh-TW") return zh;
  return i18n.lookup(`enum.palette.${id}`) ?? zh;
}
