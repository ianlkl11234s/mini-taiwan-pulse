import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hookFillPaint, hookLinePaint, valueAtZ14, withLineFillSpec } from "../lineFillSpec";
import { HOOK_FILL_TIERS, HOOK_LINE_TIERS } from "../lineFillTiers";
import { BOUNDARY_GRAY, FILL_OPACITY, FILL_OUTLINE, LINE_OPACITY, LINE_WIDTH, mapSeamColor } from "../mapStyleScale";
import type { OverlayConfig } from "../../types";

const base = { "line-width": 2, "line-opacity": 0.5, "line-color": "#abc", "line-dasharray": [2, 1] };
describe("R3b hook line/fill contract", () => {
  it("hook fill-outline-color ratchet remains zero (F2 independent outlines)", () => {
    const root = new URL("../../hooks/", import.meta.url);
    const hits = readdirSync(root).filter(file => file.endsWith(".ts"))
      .filter(file => /["']fill-outline-color["']\s*:/.test(readFileSync(new URL(file, root), "utf8")));
    expect(hits).toEqual([]);
  });

  it("all confirmed tiers normalize defaults and scale/clamp sliders", () => {
    for (const [name, tier] of Object.entries(HOOK_LINE_TIERS)) {
      const [key, id] = name.split("/") as [string, string];
      const p = hookLinePaint(key, id, base, base);
      if (!tier.outline && tier.width !== "keep") expect(valueAtZ14(p["line-width"]), name).toBe(LINE_WIDTH[tier.width][1]);
      if (!tier.outline && tier.opacity !== "keep") expect(p["line-opacity"], name).toBe(LINE_OPACITY[tier.opacity]);
      const high = hookLinePaint(key, id, { ...base, "line-opacity": 100 }, base);
      if (tier.opacity !== "keep" || tier.outline) expect(Number(high["line-opacity"]), name).toBeLessThanOrEqual(1);
    }
    for (const [name, tier] of Object.entries(HOOK_FILL_TIERS)) {
      if (tier === "keep") continue;
      const [key, id] = name.split("/") as [string, string];
      const def = { "fill-opacity": 0.6 };
      expect(hookFillPaint(key, id, def, def)["fill-opacity"], name).toBe(FILL_OPACITY[tier]);
      expect(hookFillPaint(key, id, { "fill-opacity": 0 }, def)["fill-opacity"], name).toBe(0);
      expect(hookFillPaint(key, id, { "fill-opacity": 6 }, def)["fill-opacity"], name).toBeLessThanOrEqual(1);
    }
  });
  it("shares registry calculation and preserves data encodings including outlines", () => {
    const c = { id: "osmPowerLines", layers: [{suffix:"cable", type:"line", paint:()=>base}] } as unknown as OverlayConfig;
    // Both entry points execute the same lineWrap; use a matching standard tier.
    const hook = hookLinePaint("soilLiquefactionPotential", "soil-liquefaction-potential-outline", base, base);
    expect(hook["line-width"]).toEqual(["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1]);
    expect(withLineFillSpec(c).layers[0]!.paint(true, {})["line-width"]).toEqual(hook["line-width"]);
    const encoded = { "line-width": ["get", "width"], "line-opacity": ["feature-state", "opacity"], "line-color": ["get", "color"], "line-dasharray": ["case", ["get", "forecast"], ["literal", [1, 2.5]], ["literal", [2, 2]]] };
    expect(hookLinePaint("propertyValueAdmin", "property-value-admin-county-line", encoded, encoded)).toEqual(encoded);
    const missing = { "fill-opacity": ["case", ["has", "value"], 0.6, 0] };
    expect(hookFillPaint("fireIsochrone", "fire-isochrone-coverage-fill", missing, missing)).toEqual(missing);
  });
  it("F2 seam theme is shared and hidden/data-driven paints stay intact", () => {
    for (const dark of [true, false]) {
      expect(hookLinePaint("propertyValueAdmin", "property-value-admin-county-line", base, base, dark)["line-color"]).toBe(mapSeamColor(dark));
    }
    expect(hookFillPaint("fireIsochrone", "fire-isochrone-coverage-fill", { "fill-opacity": 0 }, { "fill-opacity": 0 })["fill-opacity"]).toBe(0);
  });
  it("confirmed non-keep hook files reference the shared helper", () => {
    const tiers = readFileSync(new URL("../lineFillTiers.ts", import.meta.url), "utf8").split("export const HOOK_LINE_TIERS")[1]!;
    const files = new Set<string>();
    for (const line of tiers.split("\n")) {
      const file = line.match(/\/\/ (src\/[^ ]+\.ts)\s*$/)?.[1];
      if (file && !/: "keep",/.test(line)) files.add(file);
    }
    const missing = [...files].filter(file => !/hook(?:Line|Fill)/.test(readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8")));
    expect(missing).toEqual([]);
  });
  it("F-2 outlines for agriculture and JP water fills (review F202/F203)", () => {
    const line = { "line-color": "#123456", "line-opacity": 0.3, "line-width": 1 };
    for (const [key, id] of [["agriSoil", "agri-soil-outline"], ["agriLeisureFarmZones", "agri-leisure-farm-zones-outline"],
      ["agriRuralRegen", "agri-rural-regen-outline"], ["jpWaterLakes", "jp-water-jpWaterLakes-outline"]] as const) {
      const p = hookLinePaint(key, id, line, line);
      expect(p["line-width"], id).toBe(FILL_OUTLINE.coverage.width);
      expect(p["line-opacity"], id).toBeCloseTo(FILL_OUTLINE.coverage.opacity);
      expect(p["line-color"], id).toBe("#123456");
      expect(Number(hookLinePaint(key, id, { ...line, "line-opacity": 0.15 }, line)["line-opacity"]), id).toBeCloseTo(FILL_OUTLINE.coverage.opacity / 2);
    }
    for (const dark of [true, false]) {
      const p = hookLinePaint("jpWaterSupplyAreas", "jp-water-jpWaterSupplyAreas-outline", line, line, dark);
      expect(p["line-width"]).toBe(FILL_OUTLINE.background.width);
      expect(p["line-color"]).toBe(BOUNDARY_GRAY[dark ? "dark" : "light"]);
      expect(p["line-opacity"]).toBeCloseTo(FILL_OUTLINE.background.opacity);
    }
  });

  it("F177：fill-opacity 的 zoom gate 只縮放輸出值、不被 z14 純量取代", () => {
    const fade = ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 0] as unknown;
    const c = {
      id: "aquacultureWaterSatellite",
      layers: [{ suffix: "fill", type: "fill", paint: () => ({ "fill-opacity": fade }) }],
    } as unknown as OverlayConfig;
    const wrapped = withLineFillSpec(c).layers[0]!.paint(true, {})["fill-opacity"] as unknown[];
    expect(wrapped.slice(0, 4)).toEqual(["interpolate", ["linear"], ["zoom"], 6]);
    expect(wrapped[6]).toBe(0);
    expect(typeof wrapped[4]).toBe("number");
  });

  it("F178：資料驅動的外框 line-opacity 保留，不被 coverage 固定值蓋掉", () => {
    const op = ["case", ["==", ["get", "hidden"], 1], 0, 0.8];
    const c = {
      id: "aquacultureWaterSatellite",
      layers: [
        { suffix: "fill", type: "fill", paint: () => ({ "fill-opacity": 0.5 }) },
        { suffix: "outline", type: "line", paint: () => ({ "line-width": 1, "line-opacity": op }) },
      ],
    } as unknown as OverlayConfig;
    expect(withLineFillSpec(c).layers[1]!.paint(true, {})["line-opacity"]).toEqual(op);
  });

  it("F180／F184：isobath/line 不被當面外框正規化", () => {
    const linePaint = { "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 2.2], "line-opacity": 0.85 };
    const c = {
      id: "isobath",
      layers: [
        { suffix: "fill", type: "fill", paint: () => ({ "fill-opacity": 0.35 }) },
        { suffix: "line", type: "line", paint: () => linePaint },
      ],
    } as unknown as OverlayConfig;
    expect(withLineFillSpec(c).layers[1]!.paint(true, {})).toEqual(linePaint);
  });
});
