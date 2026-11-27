/**
 * 產生 localeFileIndex.generated.ts（腳本與測試共用）：英日文 key 的前兩段對不到檔名規則時，登記「前綴 → 檔」。
 * 規則與查法見 src/i18n/localeFiles.ts。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../locales";
import { BOOT_FILES, keyPrefix, ruleFilesForKey } from "../localeFiles";

/** 英日文每個檔（不含副檔名）→ 該檔的 key（兩語系聯集）。 */
export function collectForeignFiles(root: string): Map<string, Set<string>> {
  const files = new Map<string, Set<string>>();
  for (const locale of SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
    const dir = join(root, "src/i18n/locales", locale);
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const file = name.slice(0, -".json".length);
      const keys = files.get(file) ?? new Set<string>();
      for (const key of Object.keys(JSON.parse(readFileSync(join(dir, name), "utf8")) as object)) keys.add(key);
      files.set(file, keys);
    }
  }
  return files;
}

export function buildLocaleFileIndex(root: string): Record<string, string[]> {
  const files = collectForeignFiles(root);
  const exists = (f: string) => files.has(f);
  const prefixFiles = new Map<string, Set<string>>();
  for (const [file, keys] of files) {
    // 開站檔一律已載入，查不到字時不必找它
    if (BOOT_FILES.includes(file)) continue;
    for (const key of keys) {
      if (key.startsWith("layer.")) continue;
      const prefix = keyPrefix(key);
      const set = prefixFiles.get(prefix) ?? new Set<string>();
      set.add(file);
      prefixFiles.set(prefix, set);
    }
  }
  const index: Record<string, string[]> = {};
  for (const [prefix, set] of [...prefixFiles].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const actual = [...set].sort();
    // 用前綴本身查規則（前綴下所有 key 的規則結果相同，因為規則只看前兩段）
    const rule = ruleFilesForKey(`${prefix}.x`, exists);
    if (actual.length === 1 && rule.length === 1 && rule[0] === actual[0]) continue;
    index[prefix] = actual;
  }
  return index;
}

export function renderLocaleFileIndexModule(root: string): string {
  const index = buildLocaleFileIndex(root);
  return [
    "// ⚠️ 自動產生，請勿手改：npx tsx scripts/i18n/gen-keys.ts",
    "// 英日文翻譯 key 的前兩段 → 所在檔（只列檔名規則對不到的；規則見 src/i18n/localeFiles.ts）。",
    "",
    "export const LOCALE_FILE_INDEX: Readonly<Record<string, readonly string[]>> = {",
    ...Object.entries(index).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`),
    "};",
    "",
  ].join("\n");
}
