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
import {
  extractGolden, pickFixture, goldenGrouper, FIXTURE_SECTIONS,
} from "../../src/data/__tests__/layerGoldenExtract";
import {
  GOLDEN_DIR, splitFixture, writeGoldenDir, type GoldenFixture,
} from "../../src/data/__tests__/layerGoldenFiles";

// ⚠️ Phase 4 起只有 FIXTURE_SECTIONS 那 3 個 section 入檔（其餘 9 個已被
//    layerManifest.test.ts 逐 key 焊死，凍第二份只是 churn）——判準見
//    layerGoldenExtract.ts 的 FIXTURE_SECTIONS 註解。
// B1 P1：fixture 是目錄 layer-golden/<group>.json ＋ _order.json（格式見 layerGoldenFiles.ts）；
//    只重寫內容有變的檔，已不存在的 group 檔會刪掉。
const snapshot = extractGolden();
const fixture = pickFixture(snapshot) as unknown as GoldenFixture;
const { written, removed, unchanged } = writeGoldenDir(splitFixture(fixture, goldenGrouper()));

console.log(`✅ ${GOLDEN_DIR}/`);
console.log(`   layer keys : ${snapshot.meta.keyCount}`);
console.log(`   sections   : ${FIXTURE_SECTIONS.join(", ")}（抽取器仍抽全 ${snapshot.meta.sections.length} 個）`);
console.log(`   files      : 寫入 ${written.length}、刪除 ${removed.length}、未變 ${unchanged}`);
for (const n of written) console.log(`     ~ ${n}`);
for (const n of removed) console.log(`     - ${n}`);
