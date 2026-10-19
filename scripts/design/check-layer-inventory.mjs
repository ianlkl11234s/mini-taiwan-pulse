#!/usr/bin/env node
/**
 * 圖層樣式盤點一致性檢查（npm run check:inventory；CI 同一支）
 *
 * 重跑 npm run design:audit-layers，比對重產前後的 layer-style-inventory.json 內容。
 * 比內容不比 git diff：本機已重產但還沒 commit 時不會誤報。CI 是乾淨 checkout，兩者等價。
 * 不一致時重產結果留在工作區，確認 diff 只動本次改的圖層後直接 commit。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const OUT = "docs/design-system/layer-style-inventory.json";
const read = () => (existsSync(OUT) ? readFileSync(OUT, "utf8") : null);

const before = read();
execFileSync("npm", ["run", "-s", "design:audit-layers"], { stdio: ["ignore", "ignore", "inherit"] });
const after = read();

if (before === after) {
  console.log(`✓ ${OUT} 與目前圖層樣式一致`);
  process.exit(0);
}
try {
  execFileSync("git", ["diff", "--stat", "--", OUT], { stdio: "inherit" });
} catch { /* 沒有 git 時只印訊息 */ }
if (process.env.GITHUB_ACTIONS) console.log(`::error::${OUT} 與目前圖層樣式不一致。請執行 npm run design:audit-layers 並提交結果（確認差異只動到本次改的圖層）。`);
console.error(
  `✗ ${OUT} 與目前圖層樣式不一致。\n` +
  "  已重產到工作區：確認 diff 只動到本次改的圖層（與它的圖例）後 commit。\n" +
  "  （手動重產：npm run design:audit-layers）",
);
process.exit(1);
