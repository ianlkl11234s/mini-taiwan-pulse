/**
 * 更新 design system guard 基準（npm run design:baseline）。
 *
 * 預設只「往下降」：每條規則 × 每個檔案取 min(目前, 基準)，歸零的檔案移除。
 * 若目前程式碼有「增加」或「新檔案違規」，不寫入並以 exit 1 結束——
 * guard 紅燈要修程式碼，不是改基準（docs/design-system.md §9）。
 *
 * --reset：以目前掃描結果整份重建（僅限基準遺失，或規則本身改了定義；PR 需說明理由）。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_RELATIVE_PATH,
  RULES,
  compareCounts,
  formatIncrease,
  ratchetDown,
  scanFiles,
  type GuardCounts,
} from "../../src/styles/__tests__/designSystemGuardRules";

const root = fileURLToPath(new URL("../..", import.meta.url));
const baselinePath = join(root, BASELINE_RELATIVE_PATH);
const reset = process.argv.includes("--reset");

const current = scanFiles(root);
const write = (counts: GuardCounts) => writeFileSync(baselinePath, `${JSON.stringify(counts, null, 2)}\n`);
const total = (counts: GuardCounts) =>
  RULES.map((r) => `${r.id}=${Object.values(counts[r.id] ?? {}).reduce((a, b) => a + b, 0)}`).join(" ");

if (reset || !existsSync(baselinePath)) {
  write(current);
  console.log(`[design:baseline] 已${reset ? "重建" : "建立"}基準：${total(current)}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as GuardCounts;
const { increases, decreases } = compareCounts(current, baseline);

if (increases.length > 0) {
  console.error("[design:baseline] 發現新增違規，基準不更新。請修正程式碼：\n");
  for (const d of increases) console.error(`${formatIncrease(d)}\n`);
  process.exit(1);
}

if (decreases.length === 0) {
  console.log("[design:baseline] 基準已是最新，無需更新。");
  process.exit(0);
}

const next = ratchetDown(current, baseline);
write(next);
for (const d of decreases) console.log(`  ↓ [${d.rule}] ${d.file}：${d.baseline} → ${d.current}`);
console.log(`[design:baseline] 已降低基準：${total(next)}`);
