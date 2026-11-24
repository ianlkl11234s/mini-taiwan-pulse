/**
 * 由 pulse-data 的國家清單正本（countries/countries.json）產生 src/constants/countries.generated.ts。
 * pulse-data 改了國家清單後執行（worktree 內請帶 PULSE_DATA_ROOT）：
 *
 *   PULSE_DATA_ROOT=<pulse-data checkout> npx tsx scripts/countries/gen-countries.ts
 *
 * 產生檔要提交（CI 讀不到私有的 pulse-data）。`countries` 測試會驗產生檔沒被手改，本機有 pulse-data 時再驗是否最新；
 * pulse-data CI 會比對網站 develop 的產生檔與正本。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GENERATED_PATH, findCountriesSource, renderCountriesModule } from "../../src/constants/__tests__/countriesCodegen";

const root = join(import.meta.dirname, "..", "..");
const source = findCountriesSource(root);
if (!source) throw new Error("找不到 pulse-data countries/countries.json；設 PULSE_DATA_ROOT=<pulse-data checkout>");
writeFileSync(join(root, GENERATED_PATH), renderCountriesModule(readFileSync(source, "utf8")));
console.log(`已更新 ${GENERATED_PATH}（來源 ${source}）`);
