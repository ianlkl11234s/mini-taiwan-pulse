/**
 * 由 layerManifest 產生外國圖層索引（src/data/layerIndex.generated.ts）。
 * 改了外國圖層的 manifest（名稱、顏色、icon、主題、popup、legend、時區…）或 OVERLAY_REGISTRY／GIS_LAYERS 順序後執行：
 *
 *   npx vite-node scripts/layers/gen-layer-index.ts
 *
 * 必須用 vite-node（相依鏈有 import.meta.env）。`layerIndex.test` 會檢查產生檔是否最新。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderLayerIndexModule } from "../../src/data/__tests__/layerIndexCodegen";
import { loadAllPacks } from "../../src/countries/packs";

const root = join(import.meta.dirname, "..", "..");
// 國家包（B1 P5a）的圖層也要進索引：先全部載入
await loadAllPacks();
writeFileSync(join(root, "src/data/layerIndex.generated.ts"), renderLayerIndexModule());
console.log("已更新 src/data/layerIndex.generated.ts");
