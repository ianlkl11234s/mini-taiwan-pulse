import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  animalWelfarePointRadius,
  animalWelfarePointStroke,
} from "../../hooks/useAnimalWelfarePointsLayer";
import { fireEventsPointStroke } from "../../hooks/useFireEventsLayer";
import { fireLatestPointStroke } from "../../hooks/useFireLatestLayer";
import { powerPolePointPaint } from "../../hooks/usePowerPolesLayer";

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** HOOK_POINT_TIERS 每行註解結尾的 `src/...` 是該層的 hook 檔；回傳 檔案 → 該檔涵蓋的分階。 */
function hookTierFiles(): Map<string, Set<string>> {
  const text = fs.readFileSync(path.join(SOURCE_ROOT, "map", "pointTiers.ts"), "utf8");
  const block = text.slice(text.indexOf("export const HOOK_POINT_TIERS"));
  const byFile = new Map<string, Set<string>>();
  for (const line of block.split("\n")) {
    const match = line.match(/^\s+\w+: "([SMLB])",.*(src\/[\w/.]+\.tsx?)\s*$/);
    const [, tier, file] = match ?? [];
    if (!tier || !file) continue;
    byFile.set(file, (byFile.get(file) ?? new Set<string>()).add(tier));
  }
  return byFile;
}

/** 掃描誤列：主體是 symbol icon，circle 只是選取圈／群集泡泡／連線節點，不是主體點。 */
const NOT_A_POINT_FILE = new Set(["src/hooks/useGlobalEventsLayer.ts"]);
/** 描邊依資料變色（深度色），是資料編碼，不套底圖色細縫。 */
const STROKE_EXEMPT = new Set([
  "src/hooks/useGlobalEventsLayer.ts", // 同上：circle 非主體
  "src/hooks/useEarthquakeLayer.ts",
  "src/hooks/useEarthquakesGlobalLayer.ts",
  // 移動物件平面點（列車、垃圾車 GPS）：對比描邊 movingPointStrokePaint（map-layers.md §3.1 P-2 例外，2026-10-10）
  "src/map/flatMovingLayers.ts",
]);

// zoom 驅動的 circle-radius（既有 2 處記在 eslint-suppressions.json，只能變少）、舊半徑 helper、
// 手寫描邊透明度公式：改由 ESLint pulse/no-zoom-circle-radius、no-legacy-radius-helper、
// no-hand-rolled-stroke-opacity 檢查（eslint-rules/rules/guards.js）。
describe("hook point spec R2 ratchet", () => {
  it("every non-bubble hook point file uses pointRadius and pointStrokePaint", () => {
    const byFile = hookTierFiles();
    expect(byFile.size).toBeGreaterThan(30);
    const missing: string[] = [];
    for (const [file, tiers] of byFile) {
      const text = fs.readFileSync(path.join(SOURCE_ROOT, "..", file), "utf8");
      const fixedTier = [...tiers].some((tier) => tier !== "B");
      if (fixedTier && !NOT_A_POINT_FILE.has(file) && !text.includes("pointRadius(")) missing.push(`${file}: pointRadius(`);
      if (!STROKE_EXEMPT.has(file) && !text.includes("pointStrokePaint(")) missing.push(`${file}: pointStrokePaint(`);
    }
    expect(missing).toEqual([]);
  });

  it("uses fixed tiers and theme seam strokes in extracted paint helpers", () => {
    expect(animalWelfarePointRadius(1)).toBe(4.5);
    expect(animalWelfarePointStroke(true, 0.8)).toMatchObject({
      "circle-stroke-color": "#0a0a14", "circle-stroke-width": 1, "circle-stroke-opacity": 0.8,
    });
    expect(powerPolePointPaint(false, 0.7, 1)).toMatchObject({
      "circle-radius": 4.5, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
    });
    // 火災：casualty 為真時有外框（暗白／淡 #111827，資料編碼），其餘為底圖色細縫。
    expect(fireEventsPointStroke(true, 1)).toMatchObject({
      "circle-stroke-color": ["case", ["get", "casualty"], "#ffffff", "#0a0a14"],
      "circle-stroke-opacity": 0.8,
    });
    expect(fireLatestPointStroke(false, 1)).toMatchObject({
      "circle-stroke-color": ["case", ["get", "casualty"], "#111827", "#ffffff"],
      "circle-stroke-opacity": 0.9,
    });
  });
});
