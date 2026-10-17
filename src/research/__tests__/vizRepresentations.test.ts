// 批次 3：新表現法（flow / grid / extrusion / isochrone）。涵蓋 warehouseResultStyle 的驗證／配色／
// 圖例／popup fact，以及 analysisResultOverlay 的實際疊圖行為（弧線、格間縫、立體、等時圈外框、
// F3 流動小點計時器、S1 stack 分類）。既有 5 種樣式的行為留在 warehouseResultStyle.test.ts，不重複。
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Map } from "mapbox-gl";
import {
  analysisResultInteractiveLayerIds, analysisLayerStack, analysisResultStackKind, flowArcCoordinates,
  installAnalysisResults, removeAnalysisResults, setAnalysisOpacity,
} from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";
import { warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend, validateWarehouseResultStyle, type WarehouseResultStyle } from "../warehouseResultStyle";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";
import { VIZ_SPEC } from "../vizSpec";

const grid = {
  kind: "grid", method: "h3", resolution: 8, cellMeters: null, weightField: null,
  valueProperty: "_style_value", countProperty: "_grid_count", weightProperty: null, idProperty: "_grid_id",
  title: "點數", unit: null, valueKind: "count",
  ramp: "viridis", palette: { dark: ["#31688e", "#21918c", "#35b779"], light: ["#35b779", "#1f9e89", "#26828e"] },
  breaks: [10, 30], labels: ["< 10", "10 – < 30", "≥ 30"], min: 1, max: 50,
  cellCount: 2, pointCount: 120, weightMissingCount: 0, gapPx: 1,
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 0,
} as const satisfies WarehouseResultStyle;
const gridWeighted = { ...grid, weightField: "sales", weightProperty: "_grid_weight" as const, title: "營業額", unit: "元", weightMissingCount: 2 } as const satisfies WarehouseResultStyle;

const extrusion = {
  kind: "extrusion", field: "population", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "人口數",
  breaks: [300, 600], colors: ["#31688e", "#21918c", "#35b779"], labels: ["< 300", "300 – < 600", "≥ 600"], min: 10, max: 900,
  valueKind: "count", unit: "人",
  ramp: "viridis", palette: { dark: ["#31688e", "#21918c", "#35b779"], light: ["#35b779", "#1f9e89", "#26828e"] },
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 1,
  heightField: "population", heightProperty: "_extrusion_height", maxHeightM: 3000, heightMax: 900,
} as const satisfies WarehouseResultStyle;

const isochrone = {
  kind: "isochrone", minutesField: "minutes", rankProperty: "_iso_rank", title: "等時圈", unit: "分鐘",
  ramp: "brand", palette: { dark: ["#a5cffe", "#519cec", "#256bb1"], light: ["#004d96", "#2e7ac7", "#72a5de"] },
  levels: [{ value: 10, rank: 0, label: "10" }, { value: 15, rank: 1, label: "15" }, { value: 20, rank: 2, label: "20" }],
  fillOpacity: 0.3, drawOrder: "largest-first", nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 0,
} as const satisfies WarehouseResultStyle;

const flow = {
  kind: "flow", valueField: "trips", labelField: null, source: "points",
  valueProperty: "_style_value", flowValueProperty: "_flow_value", widthProperty: "_flow_width",
  title: "通勤量", unit: "人次", valueKind: "count",
  ramp: "viridis", palette: { dark: ["#31688e", "#35b779"], light: ["#35b779", "#26828e"] },
  breaks: [50], labels: ["< 50", "≥ 50"], min: 10, max: 200,
  widthMinPx: 1, widthMaxPx: 6, flowCount: 1, animate: true, animateBelow: 30, dotPx: 1.8, dotOpacity: 0.5,
  droppedCount: 1, nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 1,
} as const satisfies WarehouseResultStyle;
const flowManyNoAnimate = { ...flow, flowCount: 40, animate: false } as const satisfies WarehouseResultStyle;

const clone = <T,>(value: T): T => structuredClone(value) as T;

type Layer = { id: string; type: string; source: string; filter?: unknown; paint: Record<string, unknown>; layout?: Record<string, unknown> };
function stubMap() {
  const sources = new globalThis.Map<string, { data: unknown; setData: (data: unknown) => void }>();
  const layers = new globalThis.Map<string, Layer>();
  const api = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, value: { data: unknown }) => sources.set(id, { data: value.data, setData(data) { this.data = data; } }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: Layer) => layers.set(layer.id, structuredClone(layer)),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    moveLayer: () => {},
    isSourceLoaded: () => true,
    setPaintProperty: (id: string, property: string, value: unknown) => { const layer = layers.get(id); if (layer) layer.paint[property] = value; },
    setLayoutProperty: (id: string, property: string, value: unknown) => { const layer = layers.get(id); if (layer) layer.layout = { ...layer.layout, [property]: value }; },
    setFilter: (id: string, filter: unknown) => { const layer = layers.get(id); if (layer) layer.filter = filter ?? undefined; },
    hasImage: () => true,
    addImage: () => {},
    on: () => {}, off: () => {},
  };
  return { map: api as unknown as Map, layers, sources };
}

describe("flowArcCoordinates (pure, spec L2 F3)", () => {
  it("returns ~24 segments starting and ending exactly at origin/destination", () => {
    const points = flowArcCoordinates([121.5, 25], [121.6, 25.1]);
    expect(points).toHaveLength(25);
    expect(points[0]).toEqual([121.5, 25]);
    expect(points[points.length - 1]).toEqual([121.6, 25.1]);
  });

  it("bends away from the straight-line midpoint, always to the same fixed side", () => {
    const straightMid: [number, number] = [121.55, 25.05];
    const points = flowArcCoordinates([121.5, 25], [121.6, 25.1]);
    const apex = points[12]!; // near t=0.5
    expect(apex[0]).not.toBeCloseTo(straightMid[0], 5);
    expect(apex[1]).not.toBeCloseTo(straightMid[1], 5);
    // Two parallel flows (same direction vector) bend the same way — the offset sign is a fixed
    // rule, not dependent on absolute position.
    const parallel = flowArcCoordinates([122.5, 26], [122.6, 26.1]);
    const parallelApex = parallel[12]!;
    const offsetA: [number, number] = [apex[0] - straightMid[0], apex[1] - straightMid[1]];
    const offsetB: [number, number] = [parallelApex[0] - 122.55, parallelApex[1] - 26.05];
    expect(Math.sign(offsetA[0])).toBe(Math.sign(offsetB[0]));
    expect(Math.sign(offsetA[1])).toBe(Math.sign(offsetB[1]));
  });

  it("mirrors when origin/destination are swapped (the rule is fixed, not the visual side)", () => {
    const forward = flowArcCoordinates([121.5, 25], [121.6, 25.1]);
    const backward = flowArcCoordinates([121.6, 25.1], [121.5, 25]);
    // The reversed line's apex is not the same point as the forward line's apex (mirrored bend).
    expect(forward[12]).not.toEqual(backward[12]);
  });

  it("respects a custom segment count", () => {
    expect(flowArcCoordinates([0, 0], [1, 1], 4)).toHaveLength(5);
  });
});

describe("warehouse result style: grid / extrusion / isochrone / flow validation", () => {
  it("accepts well-formed styles of all four new kinds", () => {
    for (const style of [grid, gridWeighted, extrusion, isochrone, flow]) expect(validateWarehouseResultStyle(clone(style))).toEqual(style);
  });

  it("rejects malformed grid styles", () => {
    for (const bad of [
      { ...grid, method: "square", cellMeters: null }, // square needs a cellMeters
      { ...grid, method: "h3", resolution: 6 }, // not one of 7/8/9
      { ...grid, weightField: "sales", weightProperty: null }, // weighted but no weightProperty
      { ...grid, breaks: [30, 10] }, // not ascending
      { ...grid, extra: 1 },
    ]) expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("rejects malformed extrusion styles", () => {
    for (const bad of [
      { ...extrusion, maxHeightM: 0 },
      { ...extrusion, heightProperty: "_style_value" },
      { ...extrusion, nullStyle: undefined },
      { choropleth: true, ...extrusion, kind: "choropleth" },
    ]) expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("rejects malformed isochrone styles", () => {
    for (const bad of [
      { ...isochrone, levels: [] }, // at least 1 level
      { ...isochrone, levels: isochrone.levels.map(level => ({ ...level, rank: level.rank + 1 })) }, // rank must equal index
      { ...isochrone, levels: [...isochrone.levels].reverse() }, // must be ascending by value
      { ...isochrone, unit: null },
    ]) expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("rejects malformed flow styles", () => {
    for (const bad of [
      { ...flow, source: "polygons" },
      { ...flow, widthMaxPx: 0 }, // max < min (min defaults to 1)
      { ...flow, animate: "yes" },
      { ...flow, dotOpacity: 1.5 },
    ]) expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });
});

describe("warehouse result style: colour, legend and popup fact", () => {
  it("classifies grid fill colour with a step expression over _style_value, and describes the H3 method in its legend", () => {
    expect(warehouseStyleColor(grid)).toEqual(["case", ["==", ["typeof", ["get", "_style_value"]], "number"], ["step", ["get", "_style_value"], "#31688e", 10, "#21918c", 30, "#35b779"], "rgba(0,0,0,0)"]);
    const legend = warehouseStyleLegend(grid);
    if (legend.kind !== "grid") throw new Error("expected a grid legend");
    expect(legend.method).toBe("H3 網格（res 8）");
    expect(legend.title).toBe("點數");
  });

  it("summarises a grid popup as 件數 -> 占全部 % -> 權重（有才顯示）", () => {
    expect(warehouseStyleFact(grid, { _grid_count: 20 })).toEqual({ label: "點數", value: "件數: 20；占全部: 16.7%" });
    expect(warehouseStyleFact(grid, {})).toEqual({ label: "點數", value: "件數: 無資料" });
    expect(warehouseStyleFact(gridWeighted, { _grid_count: 20, _grid_weight: 3500 })).toEqual({ label: "營業額", value: "件數: 20；占全部: 16.7%；權重: 3,500 元" });
  });

  it("colours extrusion identically to choropleth and appends a 高度指標 popup part", () => {
    expect(warehouseStyleColor(extrusion)).toEqual(["case", ["==", ["typeof", ["get", "_style_value"]], "number"], ["step", ["get", "_style_value"], "#31688e", 300, "#21918c", 600, "#35b779"], "rgba(0,0,0,0)"]);
    expect(warehouseStyleFact(extrusion, { _style_value: 620, population: 620 })).toEqual({ label: "人口數", value: "620 人；高度指標: 620" });
    const legend = warehouseStyleLegend(extrusion);
    if (legend.kind !== "extrusion") throw new Error("expected an extrusion legend");
    expect(legend.title).toBe("人口數（人）");
  });

  it("matches an isochrone's fill colour by _iso_rank and lists every level's label in its legend", () => {
    expect(warehouseStyleColor(isochrone)).toEqual(["match", ["get", "_iso_rank"], 0, "#a5cffe", 1, "#519cec", 2, "#256bb1", "rgba(0,0,0,0)"]);
    const legend = warehouseStyleLegend(isochrone);
    if (legend.kind !== "isochrone") throw new Error("expected an isochrone legend");
    expect(legend.entries.map(entry => entry.label)).toEqual(["10分鐘", "15分鐘", "20分鐘"]);
    expect(warehouseStyleFact(isochrone, { _iso_rank: 1 })).toEqual({ label: "等時圈", value: "15分鐘" });
    expect(warehouseStyleFact(isochrone, {})).toEqual({ label: "等時圈", value: "無資料" });
  });

  it("classifies a flow line's colour the same way as choropleth and reports its animate flag in the legend", () => {
    expect(warehouseStyleColor(flow)).toEqual(["case", ["==", ["typeof", ["get", "_style_value"]], "number"], ["step", ["get", "_style_value"], "#31688e", 50, "#35b779"], "rgba(0,0,0,0)"]);
    expect(warehouseStyleFact(flow, { _style_value: 80 })).toEqual({ label: "通勤量", value: "80 人次" });
    const legend = warehouseStyleLegend(flow);
    if (legend.kind !== "flow") throw new Error("expected a flow legend");
    expect(legend.animate).toBe(true);
    expect(warehouseStyleLegend(flowManyNoAnimate)).toMatchObject({ animate: false });
  });

  it("renders all four new legends without throwing and with the expected caption text", () => {
    const html = (style: Exclude<WarehouseResultStyle, { kind: "compare" | "series" }>) => renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(style) }));
    expect(html(grid)).toContain("H3 網格（res 8）");
    expect(html(extrusion)).toContain("人口數（人）");
    expect(html(isochrone)).toContain("15分鐘");
    expect(html(flow)).toContain("通勤量（人次）");
  });

  it("only prints the reduced-effect hint when the server disabled F3 animation", () => {
    const animated = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(flow) }));
    const notAnimated = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(flowManyNoAnimate) }));
    expect(animated).not.toContain("暫不啟用流動效果");
    expect(notAnimated).toContain("暫不啟用流動效果");
  });
});

describe("S1 stack classification for the four new kinds", () => {
  const base = { resultId: "r", datasetId: "d", rows: [] } as const;
  it("treats grid and extrusion as area fills (single-fill exclusivity), but not isochrone or flow", () => {
    expect(analysisResultStackKind({ ...base, geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: grid })).toBe("area");
    expect(analysisResultStackKind({ ...base, geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: extrusion })).toBe("area");
    expect(analysisResultStackKind({ ...base, geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: isochrone })).toBe("other");
    expect(analysisResultStackKind({ ...base, geometry: { type: "LineString", role: "derived", spatialAnalysisEligible: false }, resultStyle: flow })).toBe("other");
  });

  it("places an isochrone's layer in the range band, not the area band", () => {
    const isoResult: PresentableResult = { resultId: "wh-iso", datasetId: "warehouse:wh-iso", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: isochrone, rows: [] };
    const stack = analysisLayerStack([isoResult]);
    expect(stack.find(entry => entry.id === "research-analysis-result-points-0")?.band).toBe("range");
  });

  it("places a flow line in the line band alongside its outline/dot siblings", () => {
    const flowResult: PresentableResult = { resultId: "wh-flow", datasetId: "warehouse:wh-flow", geometry: { type: "LineString", role: "derived", spatialAnalysisEligible: false }, resultStyle: flow, rows: [] };
    const stack = analysisLayerStack([flowResult]);
    expect(stack.find(entry => entry.id === "research-analysis-result-points-0")?.band).toBe("line");
    expect(stack.find(entry => entry.id === "research-analysis-result-flow-outline-0")?.band).toBe("line");
    expect(stack.find(entry => entry.id === "research-analysis-result-flow-dot-0")?.band).toBe("line");
  });
});

describe("warehouse styles on the map overlay", () => {
  const gridPolygon: PresentableResult = {
    resultId: "wh-grid", datasetId: "warehouse:wh-grid", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: grid,
    rows: [
      { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, _style_value: 20, _grid_count: 20, _grid_id: "1" },
      { geometry: { type: "Polygon", coordinates: [[[121.6, 25], [121.61, 25], [121.61, 25.01], [121.6, 25]]] }, _style_value: null, _grid_count: null, _grid_id: "2" },
    ],
  };
  const extrusionPolygon: PresentableResult = {
    resultId: "wh-extrusion", datasetId: "warehouse:wh-extrusion", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: extrusion,
    rows: [
      { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, name: "A里", _style_value: 300, _extrusion_height: 1000 },
      { geometry: { type: "Polygon", coordinates: [[[121.6, 25], [121.61, 25], [121.61, 25.01], [121.6, 25]]] }, name: "B里", _style_value: 700, _extrusion_height: null },
    ],
  };
  const isochronePolygon: PresentableResult = {
    resultId: "wh-iso", datasetId: "warehouse:wh-iso", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: isochrone,
    rows: [
      { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.505, 25], [121.505, 25.005], [121.5, 25]]] }, _iso_rank: 0 },
      { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.52, 25], [121.52, 25.02], [121.5, 25]]] }, _iso_rank: 2 },
    ],
  };
  const flowLines: PresentableResult = {
    resultId: "wh-flow", datasetId: "warehouse:wh-flow", geometry: { type: "LineString", role: "derived", spatialAnalysisEligible: false }, resultStyle: flow,
    rows: [
      { geometry: { type: "LineString", coordinates: [[121.5, 25], [121.6, 25.1]] }, _style_value: 80, _flow_value: 80, _flow_width: 4 },
      { geometry: { type: "LineString", coordinates: [[121.5, 25], [121.55, 25.05]] }, _style_value: null, _flow_width: null },
    ],
  };

  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("fills grid cells by _style_value and draws the basemap-coloured gap line", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [gridPolygon]);
    expect(layers.get("research-analysis-result-points-0")!.type).toBe("fill");
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-color"]).toEqual(warehouseStyleColor(grid));
    const gap = layers.get("research-analysis-result-grid-gap-0")!;
    expect(gap.type).toBe("line");
    expect(gap.paint["line-width"]).toBe(grid.gapPx);
    expect(gap.paint["line-color"]).toBe(VIZ_SPEC.surfaces.dark);
    expect(layers.get("research-analysis-result-null-hatch-0")).toBeTruthy(); // grid participates in nullStyle hatch
    expect(installed[0]!.styleLegend?.kind).toBe("grid");
    removeAnalysisResults(map);
    expect(layers.has("research-analysis-result-grid-gap-0")).toBe(false);
  });

  it("draws extrusion as fill-extrusion, excludes a null-height row from the layer, and composes the fixed 0.85 opacity ratio", () => {
    const { map, layers } = stubMap();
    installAnalysisResults(map, [extrusionPolygon], 0.8, "dark");
    // The first install reveal-fades from 0 (no "render" event fires in this stub); reinstalling
    // the same, already-existing layer skips the fade and applies the composed opacity immediately
    // (same convention as warehouseResultStyle.test.ts's proportional/bivariate reveal tests).
    installAnalysisResults(map, [extrusionPolygon], 0.8, "dark");
    const layer = layers.get("research-analysis-result-points-0")!;
    expect(layer.type).toBe("fill-extrusion");
    expect(layer.paint["fill-extrusion-height"]).toEqual(["get", "_extrusion_height"]);
    expect(layer.filter).toEqual(["==", ["typeof", ["get", "_extrusion_height"]], "number"]);
    expect(layer.paint["fill-extrusion-opacity"]).toBeCloseTo(0.8 * 0.85, 5);
    // Switching the same slot to a non-extrusion polygon must remove the fill-extrusion layer first.
    installAnalysisResults(map, [gridPolygon], 0.8, "dark");
    expect(layers.get("research-analysis-result-points-0")!.type).toBe("fill");
    removeAnalysisResults(map);
  });

  it("draws isochrone bands with match-on-rank colour, a 1.3px same-colour outline, and a largest-first fill-sort-key", () => {
    const { map, layers } = stubMap();
    installAnalysisResults(map, [isochronePolygon], 0.9, "dark");
    // Reveal fade convention, see the extrusion test above.
    const installed = installAnalysisResults(map, [isochronePolygon], 0.9, "dark");
    const fill = layers.get("research-analysis-result-points-0")!;
    expect(fill.paint["fill-color"]).toEqual(warehouseStyleColor(isochrone, "dark"));
    expect(fill.paint["fill-opacity"]).toBeCloseTo(0.9 * isochrone.fillOpacity, 5);
    expect(fill.layout?.["fill-sort-key"]).toEqual(["-", 0, ["get", "_iso_rank"]]);
    const outline = layers.get("research-analysis-result-isochrone-outline-0")!;
    expect(outline.type).toBe("line");
    expect(outline.paint["line-width"]).toBe(1.3);
    expect(outline.paint["line-color"]).toEqual(warehouseStyleColor(isochrone, "dark"));
    expect(installed[0]!.styleLegend?.kind).toBe("isochrone");
    // A plain choropleth reusing the slot must not carry a leftover fill-sort-key.
    installAnalysisResults(map, [{ ...gridPolygon, resultId: "wh-grid-2" }], 0.9, "dark");
    expect(layers.get("research-analysis-result-points-0")!.layout?.["fill-sort-key"]).toBeUndefined();
    removeAnalysisResults(map);
    expect(layers.has("research-analysis-result-isochrone-outline-0")).toBe(false);
  });

  it("bends the flow line into an arc, excludes an unsized row, and draws the W1 outline + endpoint dot", () => {
    const { map, layers, sources } = stubMap();
    const installed = installAnalysisResults(map, [flowLines], 0.7, "dark");
    const lineData = sources.get("research-analysis-result-0")!.data as { features: Array<{ geometry: { coordinates: unknown[] } }> };
    expect(lineData.features).toHaveLength(2); // both rows still present as features (filtering happens at the layer, not the source)
    expect(lineData.features[0]!.geometry.coordinates.length).toBe(25); // arced, not the original 2-point line
    const line = layers.get("research-analysis-result-points-0")!;
    expect(line.filter).toEqual(["==", ["typeof", ["get", "_flow_width"]], "number"]);
    expect(line.paint["line-width"]).toEqual(["get", "_flow_width"]);
    const outline = layers.get("research-analysis-result-flow-outline-0")!;
    expect(outline.paint["line-width"]).toEqual(["+", ["get", "_flow_width"], 3]);
    expect(outline.paint["line-color"]).toBe(VIZ_SPEC.ring.dark);
    const endpointData = sources.get("research-analysis-result-flow-endpoint-0")!.data as { features: unknown[] };
    expect(endpointData.features).toHaveLength(1); // only the drawable row gets an endpoint dot
    expect(layers.get("research-analysis-result-flow-endpoint-circle-0")!.paint["circle-radius"]).toBe(2.5);
    expect(installed[0]!.styleLegend?.kind).toBe("flow");
    removeAnalysisResults(map);
    expect(layers.has("research-analysis-result-flow-outline-0")).toBe(false);
    expect(sources.has("research-analysis-result-flow-endpoint-0")).toBe(false);
  });

  it("only enables the F3 flowing-dot layer when the server allowed it and the viewer has not asked for reduced motion", () => {
    const { map, layers } = stubMap();
    installAnalysisResults(map, [flowLines], 0.7, "dark");
    expect(layers.has("research-analysis-result-flow-dot-0")).toBe(true);
    removeAnalysisResults(map);

    // Server said not to animate (too many flows) -> no dot layer even without reduced motion.
    installAnalysisResults(map, [{ ...flowLines, resultStyle: flowManyNoAnimate }], 0.7, "dark");
    expect(layers.has("research-analysis-result-flow-dot-0")).toBe(false);
    removeAnalysisResults(map);

    // Reduced motion -> no dot layer even though the server allowed animation.
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: true })) });
    installAnalysisResults(map, [flowLines], 0.7, "dark");
    expect(layers.has("research-analysis-result-flow-dot-0")).toBe(false);
    removeAnalysisResults(map);
  });

  it("cycles the F3 dot layer's dasharray on a low-frequency timer that never duplicates across reinstalls, and stops on removal", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { map, layers } = stubMap();
    installAnalysisResults(map, [flowLines], 0.7, "dark");
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    const initialDash = layers.get("research-analysis-result-flow-dot-0")!.paint["line-dasharray"];
    vi.advanceTimersByTime(300);
    expect(layers.get("research-analysis-result-flow-dot-0")!.paint["line-dasharray"]).not.toEqual(initialDash);
    // Reinstalling the same flow (e.g. a basemap-switch redraw) must cancel the previous timer
    // before starting a new one — never leaves two timers ticking for the same slot.
    installAnalysisResults(map, [flowLines], 0.7, "dark");
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    removeAnalysisResults(map);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000); // no further paint writes once removed
    vi.useRealTimers();
  });

  it("excludes the fill-extrusion layer from the interactive (clickable) layer list only when it has no layer at all; otherwise it is pickable like any other fill", () => {
    const { map } = stubMap();
    installAnalysisResults(map, [extrusionPolygon]);
    expect(analysisResultInteractiveLayerIds(map, 1)).toEqual(["research-analysis-result-points-0"]);
    removeAnalysisResults(map);
  });

  it("propagates the opacity slider to grid/isochrone/flow sibling layers via setAnalysisOpacity", () => {
    const { map, layers } = stubMap();
    const installedGrid = installAnalysisResults(map, [gridPolygon], 0.8, "dark");
    setAnalysisOpacity(map, installedGrid, "wh-grid", 0.3);
    expect(layers.get("research-analysis-result-grid-gap-0")!.paint["line-opacity"]).toBeCloseTo(0.3, 5);
    removeAnalysisResults(map);

    const installedIso = installAnalysisResults(map, [isochronePolygon], 0.8, "dark");
    setAnalysisOpacity(map, installedIso, "wh-iso", 0.3);
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-opacity"]).toBeCloseTo(0.3 * isochrone.fillOpacity, 5);
    expect(layers.get("research-analysis-result-isochrone-outline-0")!.paint["line-opacity"]).toBeCloseTo(0.3, 5);
    removeAnalysisResults(map);

    const installedFlow = installAnalysisResults(map, [flowLines], 0.8, "dark");
    setAnalysisOpacity(map, installedFlow, "wh-flow", 0.4);
    expect(layers.get("research-analysis-result-flow-outline-0")!.paint["line-opacity"]).toBeCloseTo(0.4, 5);
    expect(layers.get("research-analysis-result-flow-dot-0")!.paint["line-opacity"]).toBeCloseTo(0.4 * flow.dotOpacity, 5);
    removeAnalysisResults(map);
  });
});
