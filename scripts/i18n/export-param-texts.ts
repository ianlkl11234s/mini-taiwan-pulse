/**
 * 匯出圖層設定面板的中文清單（翻譯 params.json 用），依出現次數排序，附前幾個用到的控件。
 * 用法：npx vite-node scripts/i18n/export-param-texts.ts [語系，例如 en] [輸出路徑]
 * 給語系時只列該語系 params.json 還沒有的字。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { collectParamTexts } from "../../src/i18n/__tests__/paramTexts";

const [locale, out] = process.argv.slice(2);
let have: Record<string, string> = {};
if (locale) {
  try { have = JSON.parse(readFileSync(`src/i18n/locales/${locale}/params.json`, "utf8")); } catch { /* 還沒有檔 */ }
}
const rows = [...collectParamTexts().texts]
  .filter(([zh]) => !(`param.${zh}` in have))
  .sort((a, b) => b[1].length - a[1].length)
  .map(([zh, where]) => ({ zh, count: where.length, examples: where.slice(0, 3) }));
const json = JSON.stringify(rows, null, 2);
if (out) writeFileSync(out, json + "\n");
else console.log(json);
