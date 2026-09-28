import { describe, expect, it } from "vitest";
import type { Map } from "mapbox-gl";
import {
  ANALYSIS_DIM_RATIO, analysisFeatureTarget, analysisResultStackKind, analysisResultHoverLayerIds, analysisSelectionOf, clearAnalysisHover, FEATURE_ID_PROPERTY, installAnalysisResults,
  setAnalysisHover, setAnalysisOpacity, setAnalysisSelection,
} from "../analysisResultOverlay";
import { analysisHoverLabel, analysisHoverTipPosition, supportsAnalysisHover } from "../analysisResultHover";
import type { PresentableResult } from "../researchAnalysisSession";
import { MAX_VISIBLE_ANALYSIS_RESULTS, nextAnalysisActivations, planAnalysisStack, type AnalysisStackKind } from "../analysisResultStack";
import { visibleResultIds } from "../bridgeClient";
import { VIZ_SPEC } from "../vizSpec";
import type { WarehouseResultStyle } from "../warehouseResultStyle";
import { SELECTION_RING } from "../../styles/designTokens";

type Layer = { id: string; type: string; source: string; paint: Record<string, unknown>; filter?: unknown; layout?: Record<string, unknown>; minzoom?: number };
type Target = { source: string; id: number };
/** Ordered layer stack (moveLayer semantics of mapbox-gl) plus feature-state bookkeeping. */
function stubMap() {
  const sources = new globalThis.Map<string, { data: unknown; options: Record<string, unknown>; setData: (data: unknown) => void }>();
  const order: Layer[] = [];
  const states = new globalThis.Map<string, Record<string, unknown>>();
  const key = (target: Target) => `${target.source}#${target.id}`;
  const api = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, options: { data: unknown } & Record<string, unknown>) => sources.set(id, { data: options.data, options, setData(data) { this.data = data; } }),
    removeSource: (id: string) => { sources.delete(id); for (const stateKey of [...states.keys()]) if (stateKey.startsWith(`${id}#`)) states.delete(stateKey); },
    getLayer: (id: string) => order.find(layer => layer.id === id),
    addLayer: (layer: Layer) => { order.push(structuredClone(layer)); },
    removeLayer: (id: string) => { const index = order.findIndex(layer => layer.id === id); if (index >= 0) order.splice(index, 1); },
    moveLayer: (id: string, beforeId?: string) => {
      const index = order.findIndex(layer => layer.id === id);
      if (index < 0) throw new Error(`MISSING_LAYER:${id}`);
      const [layer] = order.splice(index, 1);
      const before = beforeId === undefined ? -1 : order.findIndex(candidate => candidate.id === beforeId);
      if (beforeId !== undefined && before < 0) throw new Error(`MISSING_BEFORE:${beforeId}`);
      if (before < 0) order.push(layer!); else order.splice(before, 0, layer!);
    },
    isSourceLoaded: () => true,
    setPaintProperty: (id: string, property: string, value: unknown) => { const layer = api.getLayer(id); if (layer) layer.paint[property] = value; },
    setLayoutProperty: (id: string, property: string, value: unknown) => { const layer = api.getLayer(id); if (layer) layer.layout = { ...layer.layout, [property]: value }; },
    setFilter: (id: string, filter: unknown) => { const layer = api.getLayer(id); if (layer) layer.filter = filter ?? undefined; },
    setFeatureState: (target: Target, state: Record<string, unknown>) => { if (!sources.has(target.source)) throw new Error("NO_SOURCE"); states.set(key(target), { ...states.get(key(target)), ...state }); },
    removeFeatureState: (target: { source: string }) => { for (const stateKey of [...states.keys()]) if (stateKey.startsWith(`${target.source}#`)) states.delete(stateKey); },
    hasImage: () => true, addImage: () => {},
    // The reveal fade-in finishes on the next rendered frame; run it synchronously here.
    on: (event: string, listener: () => void) => { if (event === "render") listener(); }, off: () => {},
  };
  /** A basemap switch (setStyle) drops every source, layer and feature-state. */
  const styleReload = () => { sources.clear(); order.length = 0; states.clear(); };
  return { map: api as unknown as Map, sources, order, states, stateOf: (target: Target) => states.get(key(target)) ?? {}, styleReload };
}

const square = (x: number) => ({ type: "Polygon", coordinates: [[[x, 25], [x + 0.1, 25], [x + 0.1, 25.1], [x, 25.1], [x, 25]]] });
const points: PresentableResult = {
  resultId: "points", datasetId: "fixture:points", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
  rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] }, name: "甲站" }, { geometry: { type: "Point", coordinates: [121.6, 25] }, name: "乙站" }],
};
const choropleth = { kind: "choropleth", field: "density", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "人口密度", breaks: [10], colors: ["#eff3ff", "#08519c"], labels: ["< 10", "≥ 10"], min: 1, max: 30, nullColor: "#bdbdbd", nullCount: 0, unit: "人/km²" } as const satisfies WarehouseResultStyle;
const areas: PresentableResult = {
  resultId: "areas", datasetId: "fixture:areas", geometry: { type: "Polygon", role: "actual", spatialAnalysisEligible: true }, resultStyle: choropleth,
  rows: [{ geometry: square(121.5), area_name: "中正區", _style_value: 12345 }, { geometry: square(121.7), area_name: "大同區", _style_value: 5 }],
};
const heatmap = { kind: "heatmap", weightField: null, weightProperty: null, weightMax: null, colors: ["#ffffb2", "#bd0026"], nullCount: 0 } as const satisfies WarehouseResultStyle;
const heat: PresentableResult = { ...points, resultId: "heat", resultStyle: heatmap };

describe("I1 hover label (名稱＋主要數值)", () => {
  it("uses the style fact (unit-formatted via formatVizNumber) as the main value", () => {
    expect(analysisHoverLabel({ area_name: "中正區", styleFactLabel: "人口密度", styleFactValue: "12,345 人/km²" })).toEqual({ name: "中正區", value: "12,345 人/km²" });
  });
  it("falls back to the observed value with its unit, and to name only", () => {
    expect(analysisHoverLabel({ name: "甲站", status: "observed", value: 23456, unit: "人" })).toEqual({ name: "甲站", value: "2.3 萬 人" });
    expect(analysisHoverLabel({ name: "甲站" })).toEqual({ name: "甲站", value: null });
  });
  it("is disabled on touch-first devices and enabled without matchMedia", () => {
    expect(supportsAnalysisHover({ matchMedia: () => ({ matches: false }) as MediaQueryList })).toBe(false);
    expect(supportsAnalysisHover({ matchMedia: () => ({ matches: true }) as MediaQueryList })).toBe(true);
    expect(supportsAnalysisHover(undefined)).toBe(true);
  });
  it("flips next to the cursor instead of overflowing the map", () => {
    expect(analysisHoverTipPosition({ x: 10, y: 10 }, { width: 100, height: 20 }, { width: 800, height: 600 })).toEqual({ left: 22, top: 22 });
    expect(analysisHoverTipPosition({ x: 790, y: 590 }, { width: 100, height: 20 }, { width: 800, height: 600 })).toEqual({ left: 678, top: 558 });
  });
});

describe("I1 hover outline (feature-state)", () => {
  it("promotes a numeric row id so feature-state can address every row", () => {
    const { map, sources } = stubMap();
    installAnalysisResults(map, [points]);
    const source = sources.get("research-analysis-result-0")!;
    expect(source.options.promoteId).toBe(FEATURE_ID_PROPERTY);
    expect((source.data as { features: Array<{ properties: Record<string, unknown> }> }).features.map(feature => feature.properties[FEATURE_ID_PROPERTY])).toEqual([0, 1]);
  });

  it("draws a 2px accent edge for a hovered polygon and a 2px accent ring for a hovered point", () => {
    const { map, order } = stubMap();
    installAnalysisResults(map, [areas, points], 0.8, "light");
    const edge = order.find(layer => layer.id === "research-analysis-result-edge-0")!;
    expect(edge).toMatchObject({ type: "line", source: "research-analysis-result-0" });
    expect(edge.paint["line-color"]).toBe(SELECTION_RING.light);
    expect(JSON.stringify(edge.paint["line-width"])).toContain(`"hover"`);
    const circle = order.find(layer => layer.id === "research-analysis-result-points-1")!;
    expect((circle.paint["circle-stroke-color"] as unknown[])[2]).toBe(SELECTION_RING.light);
    expect((circle.paint["circle-stroke-width"] as unknown[])[2]).toBe(2);
    expect(order.some(layer => layer.id === "research-analysis-result-edge-1")).toBe(false);
  });

  it("moves the hover state between rows and clears it on leave", () => {
    const { map, stateOf } = stubMap();
    installAnalysisResults(map, [points]);
    const first = { source: "research-analysis-result-0", id: 0 };
    const second = { source: "research-analysis-result-0", id: 1 };
    expect(setAnalysisHover(map, first)).toBe(true);
    expect(setAnalysisHover(map, first)).toBe(false);
    expect(setAnalysisHover(map, second)).toBe(true);
    expect(stateOf(first)).toEqual({ hover: false });
    expect(stateOf(second)).toEqual({ hover: true });
    clearAnalysisHover(map);
    expect(stateOf(second)).toEqual({ hover: false });
  });

  it("resolves only real result rows and never hovers heatmaps", () => {
    expect(analysisFeatureTarget({ source: "research-analysis-result-2", properties: { _fid: 4 } })).toEqual({ source: "research-analysis-result-2", id: 4 });
    expect(analysisFeatureTarget({ source: "research-analysis-result-2", properties: { _fid: 4, _role: "scope" } })).toBeNull();
    expect(analysisFeatureTarget({ source: "research-analysis-result-bivariate-size-2", properties: { _fid: 4 } })).toBeNull();
    expect(analysisFeatureTarget({ source: "cwa-radar", properties: { _fid: 4 } })).toBeNull();
    const { map } = stubMap();
    installAnalysisResults(map, [heat, areas]);
    expect(analysisResultHoverLayerIds(map, 2)).toEqual(["research-analysis-result-points-1"]);
  });

  it("does not carry a stale hover across a basemap switch (style.load → redraw)", () => {
    const { map, order, stateOf, styleReload } = stubMap();
    installAnalysisResults(map, [areas]);
    const target = { source: "research-analysis-result-0", id: 1 };
    setAnalysisHover(map, target);
    styleReload();
    installAnalysisResults(map, [areas], 0.8, "light");
    expect(order.find(layer => layer.id === "research-analysis-result-edge-0")!.paint["line-color"]).toBe(SELECTION_RING.light);
    expect(stateOf(target)).toEqual({});
    // The module forgot the old row, so hovering it again is a real change that re-sets state.
    expect(setAnalysisHover(map, target)).toBe(true);
    expect(stateOf(target)).toEqual({ hover: true });
  });
});

const opacity = { defaultOpacity: 0.8, byResult: {} };
const DIMMED_FILL = ["case", ["boolean", ["feature-state", "selected"], false], 0.8 * 0.45, 0.8 * 0.45 * ANALYSIS_DIM_RATIO];

describe("I2 selection dimming (X1)", () => {
  it("resolves a clicked feature to a redraw-stable selection", () => {
    expect(analysisSelectionOf({ source: "research-analysis-result-1", properties: { resultId: "areas", _fid: 1 } })).toEqual({ resultId: "areas", fid: 1 });
    expect(analysisSelectionOf({ source: "research-analysis-result-1", properties: { _fid: 1 } })).toBeNull();
  });

  it("keeps the selected row and dims the rest of the same result only, then restores", () => {
    const { map, order, stateOf } = stubMap();
    const installed = installAnalysisResults(map, [areas, points], 0.8);
    setAnalysisSelection(map, installed, [{ resultId: "areas", fid: 1 }], opacity);
    expect(stateOf({ source: "research-analysis-result-0", id: 1 })).toEqual({ selected: true });
    const fill = order.find(layer => layer.id === "research-analysis-result-points-0")!;
    expect(fill.paint["fill-opacity"]).toEqual(DIMMED_FILL);
    // The other result is untouched: no selection there, so nothing to dim.
    expect(order.find(layer => layer.id === "research-analysis-result-points-1")!.paint["circle-opacity"]).toBe(0.8);
    // Selected rows reuse the I1 emphasis branch: accent edge / ring.
    expect(JSON.stringify(order.find(layer => layer.id === "research-analysis-result-edge-0")!.paint["line-width"])).toContain(`"selected"`);
    setAnalysisSelection(map, installed, [], opacity);
    expect(stateOf({ source: "research-analysis-result-0", id: 1 })).toEqual({ selected: false });
    expect(fill.paint["fill-opacity"]).toBeCloseTo(0.8 * 0.45);
  });

  it("keeps the dim when the opacity slider moves, and moves it with the selection", () => {
    const { map, order, stateOf } = stubMap();
    const installed = installAnalysisResults(map, [areas, points], 0.8);
    setAnalysisSelection(map, installed, [{ resultId: "points", fid: 0 }], opacity);
    setAnalysisOpacity(map, installed, "points", 0.5);
    expect(order.find(layer => layer.id === "research-analysis-result-points-1")!.paint["circle-opacity"]).toEqual(["case", ["boolean", ["feature-state", "selected"], false], 0.5, 0.5 * ANALYSIS_DIM_RATIO]);
    setAnalysisSelection(map, installed, [{ resultId: "areas", fid: 0 }], opacity);
    expect(stateOf({ source: "research-analysis-result-1", id: 0 })).toEqual({ selected: false });
    expect(order.find(layer => layer.id === "research-analysis-result-points-1")!.paint["circle-opacity"]).toBe(0.8);
    expect(order.find(layer => layer.id === "research-analysis-result-points-0")!.paint["fill-opacity"]).toEqual(DIMMED_FILL);
  });

  it("does not leak a selection into another result that reuses the same slot (setData keeps feature-state)", () => {
    const { map, stateOf } = stubMap();
    setAnalysisSelection(map, installAnalysisResults(map, [areas], 0.8), [{ resultId: "areas", fid: 0 }], opacity);
    installAnalysisResults(map, [{ ...areas, resultId: "other-areas" }], 0.8);
    expect(stateOf({ source: "research-analysis-result-0", id: 0 }).selected).toBe(false);
  });

  it("re-applies after a basemap switch (style.load → reinstall → setAnalysisSelection)", () => {
    const { map, order, stateOf, styleReload } = stubMap();
    const selection = [{ resultId: "areas", fid: 0 }];
    setAnalysisSelection(map, installAnalysisResults(map, [areas], 0.8), selection, opacity);
    styleReload();
    const reinstalled = installAnalysisResults(map, [areas], 0.8, "light");
    // Install alone restores plain opacity (the dim belongs to the caller's selection)…
    expect(order.find(layer => layer.id === "research-analysis-result-points-0")!.paint["fill-opacity"]).toBeCloseTo(0.8 * 0.45);
    setAnalysisSelection(map, reinstalled, selection, opacity);
    expect(stateOf({ source: "research-analysis-result-0", id: 0 })).toEqual({ selected: true });
    expect(order.find(layer => layer.id === "research-analysis-result-points-0")!.paint["fill-opacity"]).toEqual(DIMMED_FILL);
  });
});

const collectionOf = (...ids: string[]) => ({ items: ids.map(resultId => ({ resultId, visible: true, groupId: null })), groups: [] });
const kinds: Record<string, AnalysisStackKind> = { a1: "area", a2: "area", h1: "heat", h2: "heat" };
const kindOf = (resultId: string) => kinds[resultId] ?? "other";

describe("S1 stacking (O1)", () => {
  it("hides the least recently shown result when a 4th becomes visible, without removing it", () => {
    const three = collectionOf("p1", "p2", "p3");
    const stamps = nextAnalysisActivations(null, three, new globalThis.Map());
    const four = collectionOf("p1", "p2", "p3", "p4");
    const next = nextAnalysisActivations(three, four, stamps);
    const plan = planAnalysisStack(four, next, kindOf);
    expect(plan.autoHidden).toEqual(["p1"]);
    expect(plan.collection!.items.map(item => [item.resultId, item.visible])).toEqual([["p1", false], ["p2", true], ["p3", true], ["p4", true]]);
    expect(visibleResultIds(plan.collection)).toHaveLength(MAX_VISIBLE_ANALYSIS_RESULTS);
  });

  it("keeps hiding the same result when the Agent re-sends the uncapped collection (diffed against the request)", () => {
    const four = collectionOf("p1", "p2", "p3", "p4");
    let stamps = nextAnalysisActivations(collectionOf("p1", "p2", "p3"), four, new globalThis.Map([["p1", 1], ["p2", 2], ["p3", 3]]));
    const first = planAnalysisStack(four, stamps, kindOf);
    // Next command (e.g. camera only): the server still has all four visible; diff against that request, not the capped view.
    stamps = nextAnalysisActivations(four, four, stamps);
    const second = planAnalysisStack(four, stamps, kindOf);
    expect(first.autoHidden).toEqual(["p1"]);
    expect(second.autoHidden).toEqual(["p1"]);
    expect(second.collection).toEqual(first.collection);
  });

  it("treats a result switched back on from the list as the newest", () => {
    const capped = { items: [{ resultId: "p1", visible: false, groupId: null }, ...collectionOf("p2", "p3", "p4").items], groups: [] };
    const stamps = new globalThis.Map([["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4]]);
    const reenabled = { ...capped, items: capped.items.map(item => ({ ...item, visible: true })) };
    const plan = planAnalysisStack(reenabled, nextAnalysisActivations(capped, reenabled, stamps), kindOf);
    expect(plan.autoHidden).toEqual(["p2"]);
  });

  it("keeps one heatmap and one area fill; other areas become outline-only", () => {
    const collection = collectionOf("h1", "a1", "h2", "a2");
    const plan = planAnalysisStack(collection, nextAnalysisActivations(null, collection, new globalThis.Map()), kindOf);
    expect(plan.autoHidden.sort()).toEqual(["h1"]);
    expect(plan.outlineOnly).toEqual(["a1"]);
    // Nothing to change → the very same collection object comes back.
    const small = collectionOf("a1", "p1");
    expect(planAnalysisStack(small, nextAnalysisActivations(null, small, new globalThis.Map()), kindOf).collection).toBe(small);
  });

  it("classifies choropleth/bivariate/numeric polygons as areas and heatmaps as heat", () => {
    expect(analysisResultStackKind(areas)).toBe("area");
    expect(analysisResultStackKind(heat)).toBe("heat");
    expect(analysisResultStackKind(points)).toBe("other");
  });

  it("draws an outline-only area as a 1.4px categorical.other edge over a transparent pick surface", () => {
    const { map, order } = stubMap();
    const second = { ...areas, resultId: "areas-2" };
    installAnalysisResults(map, [areas, second], 0.8, "dark", { outlineOnly: ["areas"] });
    const fill = order.find(layer => layer.id === "research-analysis-result-points-0")!;
    expect(fill.paint["fill-color"]).toBe("rgba(0,0,0,0)");
    const edge = order.find(layer => layer.id === "research-analysis-result-edge-0")!;
    expect((edge.paint["line-width"] as unknown[])[3]).toBe(1.4);
    expect((edge.paint["line-color"] as unknown[])[3]).toBe(VIZ_SPEC.categorical.other.dark);
    expect(order.find(layer => layer.id === "research-analysis-result-points-1")!.paint["fill-color"]).not.toBe("rgba(0,0,0,0)");
    expect((order.find(layer => layer.id === "research-analysis-result-edge-1")!.paint["line-width"] as unknown[])[3]).toBe(0);
  });

  it("orders layers heat → areas → bubbles → lines → points → labels, and again after style.load", () => {
    const { map, order, styleReload } = stubMap();
    const proportional = { kind: "proportional", sizeField: "p", colorField: null, labelField: null, sizeValueProperty: "_size_value", sizeRadiusProperty: "_size_radius", labelRankProperty: "_label_rank", valueProperty: null, sizeValueKind: "count", colorValueKind: "count", rMinPx: 4, rMaxPx: 28, fillOpacity: 0.75, ringPx: 1, labelTopN: 5, drawOrder: "largest-first", ramp: "viridis", palette: { dark: ["#35b779"], light: ["#26828e"] }, breaks: [], labels: [], min: null, max: null, nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 0, sizeLegend: [{ value: 1, radiusPx: 4, label: "1" }] } as const satisfies WarehouseResultStyle;
    const bubbles: PresentableResult = { ...points, resultId: "bubbles", resultStyle: proportional };
    const route: PresentableResult = { resultId: "route", datasetId: "fixture:route", geometry: { type: "LineString", role: "actual", spatialAnalysisEligible: true }, rows: [{ geometry: { type: "LineString", coordinates: [[121.5, 25], [121.6, 25]] } }] };
    map.addLayer({ id: "basemap-road", type: "line", source: "composite", paint: {} } as never);
    // Install order is the opposite of the desired stack on purpose.
    const results = [points, route, bubbles, areas, heat];
    const expected = [
      "basemap-road",
      "research-analysis-result-points-4", // heat
      "research-analysis-result-points-3", "research-analysis-result-edge-3", // area fill < edge
      "research-analysis-result-points-2", // bubbles
      "research-analysis-result-points-1", // line
      "research-analysis-result-points-0", "research-analysis-result-heat-points-4", // points
      "research-analysis-result-proportional-label-2", // labels
    ];
    installAnalysisResults(map, results);
    expect(order.map(layer => layer.id)).toEqual(expected);
    styleReload();
    map.addLayer({ id: "basemap-road", type: "line", source: "composite", paint: {} } as never);
    installAnalysisResults(map, results);
    expect(order.map(layer => layer.id)).toEqual(expected);
  });
});
