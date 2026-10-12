/**
 * i18n 進度：各區塊還剩多少行寫死的中文（口徑見 src/i18n/__tests__/hardcodedZhScan.ts）。
 *
 *   npx tsx scripts/i18n/hardcoded-zh.ts          # 印出進度表
 *   npx tsx scripts/i18n/hardcoded-zh.ts --write  # 數字下降後鎖住新基準（只能往下）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { I18N_AREAS, scanHardcodedZh } from "../../src/i18n/__tests__/hardcodedZhScan";

const root = join(import.meta.dirname, "..", "..");
const baselinePath = join(root, "src/i18n/__tests__/hardcodedZh.baseline.json");
const baseline: Record<string, number> = JSON.parse(readFileSync(baselinePath, "utf8"));
const now = scanHardcodedZh(root);

console.log(["階段", "現在", "基準", "差", "區塊"].join("\t"));
for (const area of I18N_AREAS) {
  const cur = now[area.id] ?? 0;
  const base = baseline[area.id] ?? cur;
  const diff = cur - base;
  const mark = diff > 0 ? "  ⚠️ 增加" : diff < 0 ? "  ✅ 減少" : "";
  console.log([area.phase, cur, base, diff, `${area.label}${area.kind === "data" ? "（資料）" : ""}${mark}`].join("	"));
}
const total = Object.values(now).reduce((a, b) => a + b, 0);
console.log(`合計 ${total}`);

if (process.argv.includes("--write")) {
  const increased = I18N_AREAS.filter((a) => (now[a.id] ?? 0) > (baseline[a.id] ?? Infinity));
  if (increased.length) {
    console.error(`拒絕寫入：${increased.map((a) => a.id).join(", ")} 比基準多。基準只能往下調。`);
    process.exit(1);
  }
  writeFileSync(baselinePath, JSON.stringify(now, null, 2) + "\n");
  console.log("已更新基準");
}
