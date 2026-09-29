import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only evaluator/validator.
import { expression, featureFilter, validate } from "mapbox-gl/dist/style-spec/index.cjs";
import {
  SOIL_LIQUEFACTION_PRIVATE_ENDPOINT, SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS, SOIL_POTENTIAL_CLASSES,
  WEAK_SOIL_COLORS, isSoilLiquefactionPrivateLayer,
} from "../../data/soilLiquefactionTypes";
import { pointRadius, pointStrokePaint } from "../../map/mapStyleScale";
import {
  POTENTIAL_NOT_INVESTIGATED_FILTER, SOIL_LIQUEFACTION_LAYER_IDS, SOIL_LIQUEFACTION_SOURCE_ID,
  buildSoilLiquefactionLayers, potentialFillColor, weakSoilFillColor, weakSoilMissingFilter, weakSoilValueFilter,
} from "../useSoilLiquefactionLayers";

const HOOK_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../useSoilLiquefactionLayers.ts");
const TRANSPARENT = "rgba(0,0,0,0)";

function evalColor(expr: unknown, properties: Record<string, unknown>): string {
  const parsed = expression.createExpression(expr, { type: "color" });
  expect(parsed.result).toBe("success");
  const color = parsed.value.evaluate({ zoom: 10 }, { properties });
  return `rgba(${[color.r, color.g, color.b].map((c: number) => Math.round((color.a ? c / color.a : c) * 255)).join(",")},${color.a})`;
}
const hex = (value: string) => {
  const n = parseInt(value.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},1)`;
};
const passes = (filter: unknown, properties: Record<string, unknown>) =>
  featureFilter(filter).filter({ zoom: 10 }, { type: 3, properties });

const STATE = {
  visibility: Object.fromEntries(SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.map((key) => [key, true])) as Record<typeof SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS[number], boolean>,
  opacity: Object.fromEntries(SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS.map((key) => [key, 0.7])) as Record<typeof SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS[number], number>,
  isDark: true,
};

describe("soil-liquefaction owner-only PMTiles contract", () => {
  it("reads only the same-origin private endpoint (no official WMTS/WMS, no hard-coded sites)", () => {
    expect(SOIL_LIQUEFACTION_PRIVATE_ENDPOINT).toBe("/api/private-research/soil-liquefaction/tiles");
    const source = fs.readFileSync(HOOK_FILE, "utf8");
    expect(source).not.toMatch(/gis\.liquid\.net\.tw|WMSServer|WMTS|"raster"/);
    expect(source).not.toMatch(/TPSite|臺北市中山站/);
    expect(SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS).toHaveLength(8);
    expect(isSoilLiquefactionPrivateLayer("weakSoilSand10To20")).toBe(true);
    expect(isSoilLiquefactionPrivateLayer("jpWaterDams")).toBe(false);
  });

  it("builds one private source with style-spec-valid layers (single source, three source-layers)", () => {
    const layers = buildSoilLiquefactionLayers(STATE);
    expect(new Set(layers.map((layer) => layer.source))).toEqual(new Set([SOIL_LIQUEFACTION_SOURCE_ID]));
    expect(new Set(layers.map((layer) => layer["source-layer"]))).toEqual(new Set(["potential", "weak_soil", "monitoring_sites"]));
    const errors = validate({ version: 8, sources: { [SOIL_LIQUEFACTION_SOURCE_ID]: { type: "vector", url: "mapbox://soil.test" } }, layers });
    expect(errors).toEqual([]);
  });

  it("monitoring sites use fixed L tier radius and theme seam stroke", () => {
    const site = buildSoilLiquefactionLayers({ ...STATE, isDark: false }).find((layer) => layer.id === SOIL_LIQUEFACTION_LAYER_IDS.sites)!;
    expect(site.paint).toMatchObject({ "circle-radius": pointRadius("L"), ...pointStrokePaint(false, 0.7 / 0.9) });
  });
});

describe("potential classes", () => {
  it("colours only official high/medium/low; not_investigated and missing go to the hatch layer", () => {
    for (const item of SOIL_POTENTIAL_CLASSES) expect(evalColor(potentialFillColor(), { potential_class: item.value })).toBe(hex(item.color));
    expect(evalColor(potentialFillColor(), { potential_class: "not_investigated" })).toBe("rgba(0,0,0,0)");
    expect(passes(POTENTIAL_NOT_INVESTIGATED_FILTER, { potential_class: "not_investigated" })).toBe(true);
    expect(passes(POTENTIAL_NOT_INVESTIGATED_FILTER, {})).toBe(true);
    expect(passes(POTENTIAL_NOT_INVESTIGATED_FILTER, { potential_class: "low" })).toBe(false);
    const hatch = buildSoilLiquefactionLayers(STATE).find((layer) => layer.id === SOIL_LIQUEFACTION_LAYER_IDS.potentialNotInvestigated)!;
    expect((hatch.paint as Record<string, unknown>)["fill-pattern"]).toBe("map-hatch-missing-dark");
  });
});

describe("weak soil thickness", () => {
  it("keeps 0 (no weak layer) distinct from null (missing)", () => {
    const key = "weakSoilSand0To5" as const;
    expect(evalColor(weakSoilFillColor(key), { loose_sand_thickness_0_5m: 0 })).toBe(TRANSPARENT);
    expect(passes(weakSoilValueFilter(key), { loose_sand_thickness_0_5m: 0 })).toBe(true);
    expect(passes(weakSoilMissingFilter(key), { loose_sand_thickness_0_5m: 0 })).toBe(false);
    expect(passes(weakSoilValueFilter(key), {})).toBe(false);
    expect(passes(weakSoilMissingFilter(key), {})).toBe(true);
  });

  it("classifies 5 m segments per metre and the 10–20 m segment per 2 m", () => {
    [1, 2, 3, 4, 5].forEach((metres, index) => {
      expect(evalColor(weakSoilFillColor("weakSoilClay5To10"), { soft_clay_thickness_5_10m: metres })).toBe(hex(WEAK_SOIL_COLORS.clay[index]!));
    });
    ([[1, 0], [2, 0], [3, 1], [6, 2], [8, 3], [9, 4], [10, 4], [12, 4]] as const).forEach(([metres, index]) => {
      expect(evalColor(weakSoilFillColor("weakSoilSand10To20"), { loose_sand_thickness_10_20m: metres })).toBe(hex(WEAK_SOIL_COLORS.sand[index]));
    });
  });

  it("each weak layer reads its own field and starts at the packaged minzoom", () => {
    const layers = buildSoilLiquefactionLayers(STATE);
    const fill = layers.find((layer) => layer.id === SOIL_LIQUEFACTION_LAYER_IDS.weakFill("weakSoilClay10To20"))!;
    expect(JSON.stringify(fill.filter)).toContain("soft_clay_thickness_10_20m");
    expect(fill.minzoom).toBe(8);
  });
});
