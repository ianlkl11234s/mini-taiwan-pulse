import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { DECORATION_SUFFIX_RE, LIVE_DECORATION_LAYERS, POINT_SPEC_EXEMPT, isDataDriven, withPointSpec } from "../pointSpec";
import { POINT_TIERS } from "../pointTiers";
import { POINT_RADIUS } from "../mapStyleScale";
import { getParamsSpec } from "../../data/layerParamsSpec";
import type { OverlayConfig } from "../../types";

const exempt = (c: OverlayConfig, suffix: string) => POINT_SPEC_EXEMPT[c.id]?.test(suffix) ?? false;
const mainCircles = (c: OverlayConfig) => c.layers.filter((l) => l.type === "circle" && !DECORATION_SUFFIX_RE.test(l.suffix) && !exempt(c, l.suffix));

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

  it("P-2 A：固定描邊一律是底圖色 1px；依資料變化的描邊（資料編碼）保留", () => {
    for (const c of OVERLAY_REGISTRY) {
      if (!POINT_TIERS[c.id]) continue;
      for (const l of mainCircles(c)) {
        for (const [dark, seam] of [[true, "#0a0a14"], [false, "#ffffff"]] as const) {
          const p = l.paint(dark, {});
          if (!isDataDriven(p["circle-stroke-color"])) expect(p["circle-stroke-color"]).toBe(seam);
          if (!isDataDriven(p["circle-stroke-width"])) expect(p["circle-stroke-width"]).toBe(1);
        }
      }
    }
  });

  it("填色隨 alpha 淡出的點（落雷、輻射），統一描邊也跟著淡出；一般點仍是固定值", () => {
    const paintOf = (id: string) => mainCircles(OVERLAY_REGISTRY.find((x) => x.id === id)!)[0]!.paint(true, {});
    for (const id of ["lightning", "lightningCwa", "nuclearRadiation"]) {
      expect(JSON.stringify(paintOf(id)["circle-opacity"])).toContain("alpha");
      expect(JSON.stringify(paintOf(id)["circle-stroke-opacity"])).toContain("alpha");
    }
    expect(typeof paintOf("lighthouses")["circle-stroke-opacity"]).toBe("number");
  });

  it("isDataDriven：讀 feature 屬性才算，只讀 zoom 的插值不算", () => {
    expect(isDataDriven(["match", ["get", "has_icu"], 1, "#ffffff", "#000"])).toBe(true);
    expect(isDataDriven(["interpolate", ["linear"], ["zoom"], 6, 0.3, 15, ["case", ["==", ["get", "p"], "x"], 1, 2]])).toBe(true);
    expect(isDataDriven(["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2])).toBe(false);
    expect(isDataDriven("#0a0a14")).toBe(false);
    expect(isDataDriven(1)).toBe(false);
  });

  it("資料編碼描邊不被統一蓋掉（#392 迴歸）：急救醫院 ICU、規劃中設施狀態色", () => {
    const paintOf = (id: string, dark: boolean) => mainCircles(OVERLAY_REGISTRY.find((x) => x.id === id)!)[0]!.paint(dark, {});
    expect(JSON.stringify(paintOf("erHospital", true)["circle-stroke-color"])).toContain("has_icu");
    expect(JSON.stringify(paintOf("erHospital", false)["circle-stroke-width"])).toContain("has_icu");
    expect(JSON.stringify(paintOf("facPlanned", true)["circle-stroke-color"])).toContain("construction");
    expect(JSON.stringify(paintOf("mountainRescueIncidents", true)["circle-stroke-color"])).toContain("deaths");
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
        if (!DECORATION_SUFFIX_RE.test(l.suffix) || /(?:^|[-_])hit(?:$|[-_])/.test(l.suffix) || exempt(c, l.suffix)) continue;
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

  it("捷運站：Mapbox 點位所有縮放都有點；實際範圍模式用光暈（不套光暈規則）", () => {
    const c = OVERLAY_REGISTRY.find((x) => x.id === "stationsMetro")!;
    const core = c.layers.find((l) => l.suffix === "metro-overview-point-core")!;
    expect(core.maxzoom).toBeUndefined();
    const glow = c.layers.find((l) => l.suffix === "metro-pt-glow-1")!;
    expect(glow.paint(true, {})["circle-opacity"]).toBeGreaterThan(0);
    const vis = (suffix: string, mode: number) => {
      const layout = c.layers.find((l) => l.suffix === suffix)!.layout;
      return (typeof layout === "function" ? layout(true, { metroDisplayModeIdx: mode }) : layout)?.visibility;
    };
    expect(vis("metro-pt-glow-1", 1)).toBe("none");
    expect(vis("metro-pt-glow-1", 0)).toBe("visible");
    expect(vis("metro-overview-point-core", 1)).toBe("visible");
    expect(vis("metro-lowzoom-core", 0)).toBe("visible");
  });

  it("沒有分階也沒有裝飾的 config 原樣返回", () => {
    const plain: OverlayConfig = { id: "countyBoundary", sourceUrl: "", sourceId: "x", layers: [{ suffix: "line", type: "line", paint: () => ({ "line-width": 1 }) }] };
    expect(withPointSpec(plain)).toBe(plain);
  });
});
