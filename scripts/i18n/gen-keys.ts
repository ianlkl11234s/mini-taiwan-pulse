/**
 * 由 zh-TW 介面字串檔產生 key 型別（src/i18n/keys.generated.ts），
 * 並由英日文翻譯檔產生「key 前綴 → 檔」索引（src/i18n/localeFileIndex.generated.ts，分批載入用）。
 * 改了 locales/ 底下任何 JSON（新增 key 或新檔案）後執行：
 *
 *   npx tsx scripts/i18n/gen-keys.ts
 *
 * 不手寫 import：檔案一多（每個說明框主題一個檔），手動維護 keys.ts 容易漏、平行作業也會衝突。
 * `localeParity` 測試會檢查產生檔是否最新。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderKeysModule } from "../../src/i18n/__tests__/keysCodegen";
import { renderLocaleFileIndexModule } from "../../src/i18n/__tests__/localeFileIndexCodegen";

const root = join(import.meta.dirname, "..", "..");
writeFileSync(join(root, "src/i18n/keys.generated.ts"), renderKeysModule(root));
writeFileSync(join(root, "src/i18n/localeFileIndex.generated.ts"), renderLocaleFileIndexModule(root));
console.log("已更新 src/i18n/keys.generated.ts、src/i18n/localeFileIndex.generated.ts");
