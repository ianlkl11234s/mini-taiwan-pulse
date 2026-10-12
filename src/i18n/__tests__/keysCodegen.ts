/** 產生 keys.generated.ts 的內容（腳本與測試共用，確保兩邊口徑一致）。 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PLURAL = /_(zero|one|two|few|many|other)$/;

export function collectStaticKeys(root: string): { files: string[]; keys: string[] } {
  const dir = join(root, "src/i18n/locales/zh-TW");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const keys = new Set<string>();
  for (const file of files) {
    const messages = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, string>;
    for (const key of Object.keys(messages)) keys.add(key.replace(PLURAL, ""));
  }
  return { files, keys: [...keys].sort() };
}

export function renderKeysModule(root: string): string {
  const { files, keys } = collectStaticKeys(root);
  return [
    "// ⚠️ 自動產生，請勿手改：npx tsx scripts/i18n/gen-keys.ts",
    `// 來源：src/i18n/locales/zh-TW/{${files.join(",")}}`,
    "",
    "export type GeneratedStaticKey =",
    ...keys.map((k, i) => `  | ${JSON.stringify(k)}${i === keys.length - 1 ? ";" : ""}`),
    "",
    `export const ZH_MESSAGE_FILES = ${JSON.stringify(files)} as const;`,
    "",
  ].join("\n");
}
