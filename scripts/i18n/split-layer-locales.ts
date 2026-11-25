/**
 * 把英日文的圖層名依國家分檔（B1 P6）：有國家包的國家放 `layers.<cc>.json`，跟著國家包載入；
 * 台灣、WORLD、SIM 與還沒有國家包的國家留在 `layers.json`（開站就載）。
 *
 *   npx vite-node scripts/i18n/split-layer-locales.ts
 *
 * 可重跑：每次先把所有 `layers*.json` 合起來再重新分，key 順序沿用原檔。
 * 新增外國圖層時直接寫進 `layers.<cc>.json` 即可；寫錯檔 `localeParity` 會紅燈，跑本腳本就會搬好。
 * 新國家有了國家包後也跑一次。之後記得跑 `npx tsx scripts/i18n/gen-keys.ts`。
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { layerFileForKey } from "../../src/i18n/__tests__/layerLocaleFiles";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../../src/i18n/locales";

const root = join(import.meta.dirname, "..", "..");

for (const locale of SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
  const dir = join(root, "src/i18n/locales", locale);
  const sources = readdirSync(dir).filter((f) => /^layers(\.[a-z]{2})?\.json$/.test(f)).sort();
  // layers.json 排第一，保留它原本的 key 順序
  sources.sort((a, b) => (a === "layers.json" ? -1 : b === "layers.json" ? 1 : a.localeCompare(b)));
  const out = new Map<string, Record<string, string>>();
  for (const name of sources) {
    const messages = JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, string>;
    for (const [key, value] of Object.entries(messages)) {
      const file = layerFileForKey(key);
      const bucket = out.get(file) ?? {};
      bucket[key] = value;
      out.set(file, bucket);
    }
  }
  for (const name of sources) rmSync(join(dir, name));
  for (const [file, messages] of [...out].sort(([a], [b]) => a.localeCompare(b))) {
    writeFileSync(join(dir, `${file}.json`), `${JSON.stringify(messages, null, 2)}\n`);
  }
  console.log(`${locale}: ${[...out].map(([f, m]) => `${f} ${Object.keys(m).length}`).join("、")}`);
}
