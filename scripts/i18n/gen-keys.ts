/**
 * 由 zh-TW 介面字串檔產生 key 型別（src/i18n/keys.generated.ts）。
 * 改了 locales/zh-TW/*.json（新增 key 或新檔案）後執行：
 *
 *   npx tsx scripts/i18n/gen-keys.ts
 *
 * 不手寫 import：檔案一多（每個說明框主題一個檔），手動維護 keys.ts 容易漏、平行作業也會衝突。
 * `localeParity` 測試會檢查產生檔是否最新。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderKeysModule } from "../../src/i18n/__tests__/keysCodegen";

const root = join(import.meta.dirname, "..", "..");
writeFileSync(join(root, "src/i18n/keys.generated.ts"), renderKeysModule(root));
console.log("已更新 src/i18n/keys.generated.ts");
