/**
 * map-layers.md §3.9 C-3 圖層色對底圖的對比契約（ratchet）：既有違規列在 `__fixtures__/contrast-baseline.json`，
 * 不准新增、基準內的不准變差。
 * - 新違規 → 紅：調亮圖層色或透明度（暗陸合成後對比 ≥ 3；統計色階見 C-2），不要改基準繞過。
 * - 違規減少或變好 → 跑 `npm run contrast:baseline` 重產（只會變短），一起 commit。
 * 計算方法與涵蓋範圍見 `contrastContractExtract.ts`。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRAST_BASELINE_PATH, currentContrastViolations, registryKeyContrasts, type ContrastViolation } from "./contrastContractExtract";
import { compositeOver, contrastRatio, parseColor, toHex } from "../colorContrast";

const baseline = (JSON.parse(readFileSync(CONTRAST_BASELINE_PATH, "utf8")) as { violations: Record<string, ContrastViolation> }).violations;

describe("§3.9 圖層色對底圖對比（ratchet）", () => {
  it("合成與對比公式對得上正式站像素（2026-11-10 稽核）", () => {
    const land = parseColor("#292828")!.rgb;
    expect(toHex(compositeOver(parseColor("#bdd7e7")!.rgb, land, 0.55))).toBe("#7a8891");
    expect(contrastRatio(parseColor("#ffffff")!.rgb, parseColor("#000000")!.rgb)).toBeCloseTo(21);
    // 稽核：每個 registry key 取最顯眼主體子圖層，442 個 key
    expect(registryKeyContrasts().size).toBeGreaterThan(400);
  });

  it("C-3 不得新增違規、基準內的不得變差", () => {
    const current = currentContrastViolations();
    const added = Object.entries(current).filter(([key]) => !(key in baseline)).map(([key, v]) => `${key}（${v.type}）${v.contrast}`);
    const worse = Object.entries(current)
      .filter(([key, v]) => key in baseline && v.contrast < baseline[key]!.contrast - 0.005)
      .map(([key, v]) => `${key} ${baseline[key]!.contrast} → ${v.contrast}`);
    expect(added, "新增對比違規（暗陸合成後 < 3，或統計色階不合 C-2）").toEqual([]);
    expect(worse, "基準內的對比變差").toEqual([]);
  });

  it("C-2 統計序列與雙向色階不在基準裡（只剩刻意不分底圖的政黨色）", () => {
    expect(Object.entries(baseline).filter(([, v]) => v.type === "statistics")).toEqual([]);
  });
});
