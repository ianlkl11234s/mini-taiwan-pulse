import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { DECORATION_SUFFIX_RE, isDataDriven } from "../pointSpec";
import { valueAtZ14 } from "../lineFillSpec";
import { FILL_TIERS, LINE_TIERS } from "../lineFillTiers";
import { FILL_OPACITY, LINE_OPACITY, LINE_WIDTH } from "../mapStyleScale";
import { encodeKeyOverlay } from "../../layers/layerParamsAccess";

const defaults = (key: string) => encodeKeyOverlay(key, {});
const isMain = (suffix: string) => !DECORATION_SUFFIX_RE.test(suffix);

describe("R3a 線與面規格（lineFillSpec）", () => {
  it("分階表的 key 都對得到 OVERLAY_REGISTRY 的圖層", () => {
    const ids = new Set<string>(OVERLAY_REGISTRY.map((c) => c.id));
    const subs = new Set(OVERLAY_REGISTRY.flatMap((c) => c.layers.map((l) => `${c.id}/${l.suffix}`)));
    expect(Object.keys(FILL_TIERS).filter((k) => !ids.has(k))).toEqual([]);
    expect(Object.keys(LINE_TIERS).filter((k) => !subs.has(k) && !ids.has(k))).toEqual([]);
  });

  it("L-1／L-4：套階的線在預設參數下，z14 寬度與透明度等於規格值", () => {
    const bad: string[] = [];
    for (const c of OVERLAY_REGISTRY) {
      for (const l of c.layers) {
        const t = LINE_TIERS[`${c.id}/${l.suffix}`] ?? (l.type === "line" && isMain(l.suffix) ? LINE_TIERS[c.id] : undefined);
        if (!t || l.type !== "line") continue;
        const p = l.paint(true, defaults(c.id));
        if (t.width !== "keep" && !isDataDriven(p["line-width"]) && valueAtZ14(p["line-width"]) !== LINE_WIDTH[t.width][1]) {
          bad.push(`${c.id}/${l.suffix} width ${JSON.stringify(p["line-width"])}`);
        }
        const div = c.opacityParam ? Number(defaults(c.id)[c.opacityParam] ?? 1) : 1;
        const op = Number(p["line-opacity"]) * div;
        if (t.opacity !== "keep" && typeof p["line-opacity"] === "number" && Math.abs(op - LINE_OPACITY[t.opacity]) > 1e-9) {
          bad.push(`${c.id}/${l.suffix} opacity ${op}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("F-1：套階的面在預設參數下透明度等於規格值（全透明的點擊面除外）", () => {
    const bad: string[] = [];
    for (const c of OVERLAY_REGISTRY) {
      const t = FILL_TIERS[c.id];
      if (!t || t === "keep") continue;
      for (const l of c.layers.filter((x) => x.type === "fill")) {
        const o = l.paint(true, defaults(c.id))["fill-opacity"];
        if (o === 0 || isDataDriven(o)) continue;
        const div = c.opacityParam ? Number(defaults(c.id)[c.opacityParam] ?? 1) : 1;
        if (Math.abs(Number(o) * div - FILL_OPACITY[t]) > 1e-9) bad.push(`${c.id}/${l.suffix} ${o}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("K-4：套階的線寬、線透明度、面透明度不隨暗淡改變（依資料、底圖色細縫除外）", () => {
    const bad: string[] = [];
    for (const c of OVERLAY_REGISTRY) {
      const ft = FILL_TIERS[c.id];
      for (const l of c.layers) {
        if (!isMain(l.suffix) || (l.type !== "line" && l.type !== "fill")) continue;
        const lt = LINE_TIERS[`${c.id}/${l.suffix}`] ?? LINE_TIERS[c.id];
        if (!lt && (!ft || ft === "keep")) continue;
        const seam = !lt && l.type === "line" && (ft === "graded" || ft === "grid");
        const [d, n] = [l.paint(true, defaults(c.id)), l.paint(false, defaults(c.id))];
        for (const k of ["line-width", "line-opacity", "fill-opacity"]) {
          if (seam && k === "line-opacity") continue;
          if (isDataDriven(d[k])) continue;
          if (JSON.stringify(d[k]) !== JSON.stringify(n[k])) bad.push(`${c.id}/${l.suffix} ${k}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("L-2：虛線只有 [2,2]、[4,3]（依資料的虛線除外）", () => {
    const bad: string[] = [];
    for (const c of OVERLAY_REGISTRY) {
      for (const l of c.layers.filter((x) => x.type === "line")) {
        const dash = l.paint(true, defaults(c.id))["line-dasharray"];
        if (dash === undefined || isDataDriven(dash)) continue;
        if (!["[2,2]", "[4,3]"].includes(JSON.stringify(dash))) bad.push(`${c.id}/${l.suffix} ${JSON.stringify(dash)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("F-2：overlayRegistry 不再用 fill-outline-color（外框一律獨立 line 子圖層）", () => {
    const src = readFileSync(new URL("../overlayRegistry.ts", import.meta.url), "utf8");
    expect(src.match(/fill-outline-color/g)?.length ?? 0).toBe(0);
  });

  it("valueAtZ14：zoom 線性插值在 z14 求值", () => {
    expect(valueAtZ14(["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2])).toBe(2);
    expect(valueAtZ14(["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3])).toBe(2);
    expect(valueAtZ14(1.5)).toBe(1.5);
    expect(Number.isNaN(valueAtZ14(["get", "w"]))).toBe(true);
  });
});
