/**
 * map-layers.md §3.9 C-4 暗底點／線亮度下限、C-5 類別色盤。
 */
import { describe, expect, it } from "vitest";
import { compositeOver, contrastRatio, deltaE, oklch, parseColor } from "../colorContrast";
import { DARK_CONTRAST, isHueFamily, liftCategoricalForDark, liftForDark, liftModeOf, liftRampForDark, liftedColorMap } from "../darkContrast";
import { BASEMAP_LAND, MAP_CATEGORICAL } from "../mapStyleScale";
import { OVERLAY_REGISTRY } from "../overlayRegistry";

const DARK = parseColor(BASEMAP_LAND.dark)!.rgb;
const LIGHT = parseColor(BASEMAP_LAND.light)!.rgb;
const rgb = (c: string) => parseColor(c)!.rgb;
const onDark = (c: string, a: number) => contrastRatio(compositeOver(rgb(c), DARK, a), DARK);
const onLight = (c: string, a: number) => contrastRatio(compositeOver(rgb(c), LIGHT, a), LIGHT);

describe("C-4 暗底亮度下限", () => {
  it("對比不足的單色提亮到 ≥ 3、保留色相；已達標的不動", () => {
    const lifted = liftForDark("#0a1e6b", 0.8);
    expect(onDark(lifted, 0.8)).toBeGreaterThanOrEqual(DARK_CONTRAST.min);
    expect(Math.abs(oklch(rgb(lifted))[2] - oklch(rgb("#0a1e6b"))[2])).toBeLessThan(6);
    expect(liftForDark("#fbbf24", 0.8)).toBe("#fbbf24");
  });

  it("連白色都到不了目標對比的透明度：維持原色、保留類別差異（不推成全白）", () => {
    const cats = ["#1f9d55", "#3b6fe0", "#22b8c7", "#f2c230"];
    expect(liftCategoricalForDark(cats, 0.12)).toEqual(cats);
    expect(liftForDark("#7f1d1d", 0.08)).toBe("#7f1d1d");
    expect(liftRampForDark(["#04121f", "#0a4272", "#3b8ec9"], 0.1)).toEqual(["#04121f", "#0a4272", "#3b8ec9"]);
  });

  it("暗底提亮依預設透明度：拖低滑桿只淡化、不改色，與圖例對照一致", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "speedCamera")!;
    const layer = config.layers.find((l) => l.suffix === "circle")!;
    const color = (params: Record<string, number>) => JSON.stringify(layer.paint(true, params)["circle-color"]);
    expect(color({ speedCameraOpacity: 0.1 })).toBe(color({}));
    expect(color({ speedCameraOpacity: 0.1 })).not.toContain("#ffffff");
  });

  it("連續色階保留深淺順序", () => {
    const ramp = ["#04121f", "#0a4272", "#3b8ec9", "#b0dcf5"];
    const lifted = liftRampForDark(ramp, 0.85, true);
    const L = lifted.map((c) => oklch(rgb(c))[0]);
    expect(L).toEqual([...L].sort((a, b) => a - b));
    for (const c of lifted) expect(onDark(c, 0.85)).toBeGreaterThanOrEqual(DARK_CONTRAST.min);
  });

  it("類別色提亮後撞色時錯開亮度（例：非都市土地 AK、AL 兩種藍）", () => {
    const lifted = liftCategoricalForDark(["#2f80ed", "#1e5aa8", "#fbbf24"], 0.8);
    expect(deltaE(rgb(lifted[0]!), rgb(lifted[1]!))).toBeGreaterThanOrEqual(DARK_CONTRAST.categoryDeltaE);
    expect(lifted[2]).toBe("#fbbf24");
  });

  it("同色相 match 視為色階", () => {
    expect(isHueFamily(["#fee2e2", "#fca5a5", "#dc2626", "#7f1d1d"])).toBe(true);
    expect(isHueFamily(["#2563eb", "#dc2626", "#16a34a"])).toBe(false);
  });

  it("registry 提亮後的點、線暗底對比 ≥ 3（共用新色者淡底也 ≥ 3），圖例對照表與地圖一致", () => {
    let checked = 0;
    for (const config of OVERLAY_REGISTRY) {
      const map = liftedColorMap(config.id, true);
      if (map.size === 0) continue;
      checked += 1;
      if (liftModeOf(config.id) === "shared") expect(liftedColorMap(config.id, false)).toBe(map);
      else expect(liftedColorMap(config.id, false).size).toBe(0);
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("C-5 類別色盤", () => {
  it("暗底版 0.85 疊暗陸 ≥ 3.15、淡底版 0.85 疊淡陸 ≥ 3.4", () => {
    for (const c of MAP_CATEGORICAL.dark) expect(onDark(c, 0.85)).toBeGreaterThanOrEqual(3.1);
    for (const c of MAP_CATEGORICAL.light) expect(onLight(c, 0.85)).toBeGreaterThanOrEqual(3.4);
  });

  it("前 4 色彼此 ΔE ≥ 17、8 色 ≥ 10（兩套）", () => {
    const minDe = (cs: readonly string[]) => Math.min(...cs.flatMap((a, i) => cs.slice(i + 1).map((b) => deltaE(rgb(a), rgb(b)))));
    for (const set of [MAP_CATEGORICAL.dark, MAP_CATEGORICAL.light]) {
      expect(minDe(set.slice(0, 4))).toBeGreaterThanOrEqual(17);
      expect(minDe(set)).toBeGreaterThanOrEqual(10);
    }
  });
});
