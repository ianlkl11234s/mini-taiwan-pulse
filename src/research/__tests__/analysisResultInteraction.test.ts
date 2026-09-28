import { describe, expect, it } from "vitest";
import type { Map } from "mapbox-gl";
import {
  analysisFeatureTarget, analysisResultHoverLayerIds, clearAnalysisHover, FEATURE_ID_PROPERTY, installAnalysisResults, setAnalysisHover,
} from "../analysisResultOverlay";
import { analysisHoverLabel, analysisHoverTipPosition, supportsAnalysisHover } from "../analysisResultHover";
import type { PresentableResult } from "../researchAnalysisSession";
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
    on: () => {}, off: () => {},
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
