/**
 * 重產對比契約基準（design-system map-layers §3.9 C-3；測試 src/map/__tests__/contrastContract.test.ts）。
 *
 *   npm run contrast:baseline            # 只在違規「減少或變好」時寫入
 *   npm run contrast:baseline -- --allow-new   # 有新增或變差：須在 PR 說明理由並經使用者同意
 *
 * ⚠️ 用 vite-node（相依鏈有 import.meta.env）。跑完 git diff 逐行 review。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CONTRAST_BASELINE_PATH, currentContrastViolations, type ContrastViolation } from "../../src/map/__tests__/contrastContractExtract";

const allowNew = process.argv.includes("--allow-new");
const previous: Record<string, ContrastViolation> = existsSync(CONTRAST_BASELINE_PATH)
  ? (JSON.parse(readFileSync(CONTRAST_BASELINE_PATH, "utf8")) as { violations: Record<string, ContrastViolation> }).violations
  : {};
const current = currentContrastViolations();
const added = Object.keys(current).filter((key) => !(key in previous));
const worse = Object.keys(current).filter((key) => key in previous && current[key]!.contrast < previous[key]!.contrast);
const fixed = Object.keys(previous).filter((key) => !(key in current));
if ((added.length || worse.length) && !allowNew && existsSync(CONTRAST_BASELINE_PATH)) {
  console.error(`❌ 有新增 ${added.length}／變差 ${worse.length} 筆，不寫入（要先修圖層；確定要收進基準加 --allow-new）`);
  console.error([...added.map((k) => `  + ${k} ${current[k]!.contrast}`), ...worse.map((k) => `  ↓ ${k} ${previous[k]!.contrast} → ${current[k]!.contrast}`)].join("\n"));
  process.exit(1);
}
const body = {
  note: "對比契約基準（map-layers §3.9 C-3）：只准減少。重產：npm run contrast:baseline",
  thresholds: { registryDarkMin: 3, statisticsMin: 1.8, statisticsTop: 6, darkLand: "#292828" },
  violations: current,
};
writeFileSync(CONTRAST_BASELINE_PATH, `${JSON.stringify(body, null, 1)}\n`, "utf8");
console.log(`✅ ${CONTRAST_BASELINE_PATH}：${Object.keys(current).length} 筆（移除 ${fixed.length}、新增 ${added.length}、變差 ${worse.length}）`);
