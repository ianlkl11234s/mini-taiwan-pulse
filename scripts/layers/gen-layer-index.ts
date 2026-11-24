/**
 * 由 layerManifest 產生外國圖層索引（src/data/layerIndex.generated.ts）。
 * 改了外國圖層的 manifest（名稱、顏色、icon、主題、popup、legend、時區…）或 OVERLAY_REGISTRY／GIS_LAYERS 順序後執行：
 *
 *   npx vite-node scripts/layers/gen-layer-index.ts
 *
 * 必須用 vite-node（相依鏈有 import.meta.env）。`layerIndex.test` 會檢查產生檔是否最新。
 *
 * 搬國家包（move-country-pack.ts）時順序提示要用搬家前的順序：
 *   1. 搬家前：npx vite-node scripts/layers/gen-layer-index.ts -- --seed-out <seed.json>
 *   2. 跑 codemod
 *   3. 搬家後：npx vite-node scripts/layers/gen-layer-index.ts -- --seed <seed.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderLayerIndexModule, type LayerOrderSeed } from "../../src/data/__tests__/layerIndexCodegen";
import { LAYER_MANIFEST } from "../../src/data/layerManifest";
import { LAYER_PARAMS_SPEC } from "../../src/data/layerParamsSpec";
import { loadAllPacks } from "../../src/countries/packs";

const root = join(import.meta.dirname, "..", "..");
// 國家包（B1 P5a）的圖層也要進索引：先全部載入
await loadAllPacks();
const arg = (flag: string) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };
const seedOut = arg("--seed-out");
if (seedOut) {
  const seed: LayerOrderSeed = { layerManifest: Object.keys(LAYER_MANIFEST), layerParamsSpec: Object.keys(LAYER_PARAMS_SPEC) };
  writeFileSync(seedOut, JSON.stringify(seed));
  console.log(`已寫出順序 seed：${seedOut}`);
} else {
  const seedIn = arg("--seed");
  const seed = seedIn ? (JSON.parse(readFileSync(seedIn, "utf8")) as LayerOrderSeed) : undefined;
  writeFileSync(join(root, "src/data/layerIndex.generated.ts"), renderLayerIndexModule(seed));
  console.log("已更新 src/data/layerIndex.generated.ts");
}
