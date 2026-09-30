/**
 * PF-7：由交付的完整統計配方 JSON（SSOT）派生首屏用的同步目錄 `*.catalog.json`。
 * 交付 JSON 更新後必跑；`statisticsRecipeCatalog.test.ts` 會擋住目錄與 SSOT 不一致。
 *
 * Run: npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { deriveStatisticsRecipeCatalog, STATISTICS_RECIPE_CATALOG_SPECS } from "../../src/data/statisticsRecipeCatalog";

for (const spec of STATISTICS_RECIPE_CATALOG_SPECS) {
  const document = JSON.parse(readFileSync(resolve(spec.source), "utf8"));
  const catalog = deriveStatisticsRecipeCatalog(document, spec.omitRecipeKeys, basename(spec.source), { keepReleaseOptions: spec.keepReleaseOptions });
  const text = `${JSON.stringify(catalog, null, 2)}\n`;
  writeFileSync(resolve(spec.catalog), text);
  console.log(`${spec.catalog}: ${Buffer.byteLength(text)} bytes (${document.recipes.length} recipes)`);
}
