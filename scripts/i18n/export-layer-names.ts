/**
 * 匯出圖層名稱盤點（翻譯用）。
 * 用法：npx vite-node scripts/i18n/export-layer-names.ts [輸出路徑]   （不給路徑就印到 stdout）
 */
import { writeFileSync } from "node:fs";
import { LAYER_MANIFEST } from "../../src/data/layerManifest";

const rows = Object.values(LAYER_MANIFEST)
  .filter((e) => e.section)
  .map((e) => ({
    key: e.key,
    zh: e.name.zh,
    alt: e.name.alt ?? null,
    qualifier: e.name.qualifier ?? null,
    theme: e.section!.theme,
    group: e.section!.group ?? null,
  }));

const json = JSON.stringify(rows, null, 2);
const out = process.argv[2];
if (out) writeFileSync(out, json + "\n");
else console.log(json);
