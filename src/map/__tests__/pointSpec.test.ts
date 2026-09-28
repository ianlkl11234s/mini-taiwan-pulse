import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { DECORATION_SUFFIX_RE, LIVE_DECORATION_LAYERS, withPointSpec } from "../pointSpec";
import { POINT_TIERS } from "../pointTiers";
import { POINT_RADIUS } from "../mapStyleScale";
import { getParamsSpec } from "../../data/layerParamsSpec";
import type { OverlayConfig } from "../../types";

const mainCircles = (c: OverlayConfig) => c.layers.filter((l) => l.type === "circle" && !DECORATION_SUFFIX_RE.test(l.suffix));

describe("R2 點圖層規格（pointSpec）", () => {
  it("分階表只收存在於 OVERLAY_REGISTRY 且有主體 circle 的圖層", () => {
    const withCircle = new Set(OVERLAY_REGISTRY.filter((c) => mainCircles(c).length).map((c) => c.id));
    const stray = Object.keys(POINT_TIERS).filter((k) => !withCircle.has(k as never));
    expect(stray).toEqual([]);
  });

  it("P-1 B：S／M／L 圖層在預設參數下，所有縮放的半徑都是固定階", () => {
    const bad: string[] = [];
    for (const c of OVERLAY_REGISTRY) {
      const tier = POINT_TIERS[c.id];
      if (!tier || tier === "B") continue;
      for (const l of mainCircles(c)) {
        for (const dark of [true, false]) {
          const r = l.paint(dark, {})["circle-radius"];
          if (r !== POINT_RADIUS[tier]) bad.push(`${c.id}/${l.suffix}: ${JSON.stringify(r)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("P-2 A：主體描邊只有底圖色 1px", () => {
    for (const c of OVERLAY_REGISTRY) {
      if (!POINT_TIERS[c.id]) continue;
      for (const l of mainCircles(c)) {
        expect(l.paint(true, {})).toMatchObject({ "circle-stroke-color": "#0a0a14", "circle-stroke-width": 1 });
        expect(l.paint(false, {})).toMatchObject({ "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 });
      }
    }
  });

  it("大小滑桿仍有效：滑桿值加倍 → 半徑加倍", () => {
    const c = OVERLAY_REGISTRY.find((x) => x.id === "religionTemples")!;
    const size = (getParamsSpec("religionTemples") ?? []).find((s) => s.kind === "slider" && /scale/i.test(s.name))!;
    const def = Number(size.default);
    expect(mainCircles(c)[0]!.paint(true, { [size.name]: def * 2 })["circle-radius"]).toBe(POINT_RADIUS[POINT_TIERS.religionTemples as "S" | "M" | "L"] * 2);
  });

  it("P-6：靜態資料的光暈透明（子圖層保留當點擊範圍）；即時資料限制在 0.35 內", () => {
    for (const c of OVERLAY_REGISTRY) {
      for (const l of c.layers) {
        if (!DECORATION_SUFFIX_RE.test(l.suffix) || /(?:^|[-_])hit(?:$|[-_])/.test(l.suffix)) continue;
        if (l.type !== "circle" && l.type !== "line") continue;
        const op = l.paint(true, {})[`${l.type}-opacity`];
        if (LIVE_DECORATION_LAYERS.has(c.id)) {
          if (typeof op === "number") expect(op).toBeLessThanOrEqual(0.35);
        } else {
          expect(op).toBe(0);
        }
      }
    }
  });

  it("沒有分階也沒有裝飾的 config 原樣返回", () => {
    const plain: OverlayConfig = { id: "countyBoundary", sourceUrl: "", sourceId: "x", layers: [{ suffix: "line", type: "line", paint: () => ({ "line-width": 1 }) }] };
    expect(withPointSpec(plain)).toBe(plain);
  });
});
