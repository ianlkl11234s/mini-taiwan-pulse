/**
 * 重新產生 layer 黃金快照 fixture（AR-22 Phase 0）
 *
 *   npx vite-node scripts/preprocess/dump-layer-golden.ts
 *
 * ⚠️ 必須用 vite-node 不能用 tsx —— 相依鏈會碰到 src/lib/supabase.ts 的
 *    `import.meta.env`（Vite 專屬），tsx 沒有這個 shim 會直接 TypeError。
 *
 * ⚠️ 這支腳本會**覆蓋**護欄的基準值。只在「已經確認登記資料的變更是有意的」時才跑，
 *    跑完務必 `git diff` 逐行 review —— 無腦重跑等於把護欄拆掉。
 *
 * 抽取邏輯完全來自 src/data/__tests__/layerGoldenExtract.ts（與測試共用同一份，
 * 兩邊各寫一份必漂移）；本檔只是「呼叫 extract → 寫檔」的殼。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  extractGolden, canonicalJson, pickFixture, FIXTURE_PATH, FIXTURE_SECTIONS,
} from "../../src/data/__tests__/layerGoldenExtract";

// ⚠️ Phase 4 起只有 FIXTURE_SECTIONS 那 3 個 section 入檔（其餘 9 個已被
//    layerManifest.test.ts 逐 key 焊死，凍第二份只是 churn）——判準見
//    layerGoldenExtract.ts 的 FIXTURE_SECTIONS 註解。
const snapshot = extractGolden();
const fixture = pickFixture(snapshot);
const json = canonicalJson(fixture);

mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
writeFileSync(FIXTURE_PATH, json, "utf8");

const bytes = Buffer.byteLength(json, "utf8");
console.log(`✅ ${FIXTURE_PATH}`);
console.log(`   layer keys : ${snapshot.meta.keyCount}`);
console.log(`   sections   : ${FIXTURE_SECTIONS.join(", ")}（抽取器仍抽全 ${snapshot.meta.sections.length} 個）`);
console.log(`   size       : ${(bytes / 1024).toFixed(1)} KB`);
