import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Map } from "mapbox-gl";
import { analysisResultInteractiveLayerIds, installAnalysisResults, removeAnalysisResults, setAnalysisOpacity } from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";
import { researchResultPopupFacts } from "../researchResultPopup";
import { loadWarehouseResult, validateWarehouseImportArgs } from "../warehouseResultImport";
import { validateWarehouseResultStyle, warehouseChoroplethNullFilter, warehouseHeatmapFilter, warehouseHeatmapPaint, warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend, type WarehouseResultStyle } from "../warehouseResultStyle";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";
import { WarehouseCompareTableView } from "../WarehouseCompareTable";
import { nullHatchCssGradient } from "../vizSpec";

const choropleth = { kind: "choropleth", field: "median_price", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "房價中位數", breaks: [40, 55, 70, 90], colors: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"], labels: ["30 – < 40", "40 – < 55", "55 – < 70", "70 – < 90", "90 – 120"], min: 30, max: 120, nullColor: "#bdbdbd", nullCount: 2 } as const satisfies WarehouseResultStyle;
const bivariate = { kind: "bivariate", xField: "price", yField: "stops", xLabel: "房價", yLabel: "公車站密度", classProperty: "_bi_class", xBreaks: [50, 70], yBreaks: [3, 8], classes: ["1-1", "2-1", "3-1", "1-2", "2-2", "3-2", "1-3", "2-3", "3-3"], colors: ["#e8e8e8", "#e4acac", "#c85a5a", "#b0d5df", "#ad9ea5", "#985356", "#64acbe", "#627f8c", "#574249"], nullColor: "#bdbdbd", nullCount: 1 } as const satisfies WarehouseResultStyle;
const heatmap = { kind: "heatmap", weightField: "deaths", weightProperty: "_style_weight", weightMax: 4, colors: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"], nullCount: 3 } as const satisfies WarehouseResultStyle;
const compare = { kind: "compare", labelField: "label", pointProperty: "_compare_index", columns: [{ index: 1, label: "台北車站" }, { index: 2, label: "板橋車站" }, { index: 3, label: "新竹車站" }], rows: [
  { field: "a", label: "餐飲店家數", unit: null, cells: [{ value: 30, notCovered: false, rank: 1 }, { value: 10, notCovered: false, rank: 2 }, { value: null, notCovered: true, rank: null }] },
  { field: "b", label: "b", unit: "間", cells: [{ value: 5, notCovered: false, rank: 2 }, { value: 8, notCovered: false, rank: 1 }, { value: null, notCovered: false, rank: null }] },
] } as const satisfies WarehouseResultStyle;
const choroplethHatch = { ...choropleth, ramp: "viridis", nullStyle: "hatch", palette: { dark: choropleth.colors, light: ["#a", "#b", "#c", "#d", "#e"].map((_, index) => `#${(index + 1).toString().padStart(6, "0")}`) } } as const satisfies WarehouseResultStyle;
const clone = <T,>(value: T): T => structuredClone(value) as T;

type Layer = { id: string; type: string; source: string; minzoom?: number; filter?: unknown; paint: Record<string, unknown>; layout?: Record<string, unknown> };
function stubMap() {
  const sources = new globalThis.Map<string, { data: unknown; setData: (data: unknown) => void }>();
  const layers = new globalThis.Map<string, Layer>();
  const images = new Set<string>();
  const api = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, value: { data: unknown }) => sources.set(id, { data: value.data, setData(data) { this.data = data; } }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: Layer) => layers.set(layer.id, structuredClone(layer)),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    isSourceLoaded: () => true,
    setPaintProperty: (id: string, property: string, value: unknown) => { const layer = layers.get(id); if (layer) layer.paint[property] = value; },
    setFilter: (id: string, filter: unknown) => { const layer = layers.get(id); if (layer) layer.filter = filter ?? undefined; },
    // A style/basemap switch clears every addImage'd image; addImage throws on a duplicate id
    // (mirrors real mapbox-gl), so this catches a missing `hasImage` guard in the caller.
    hasImage: (id: string) => images.has(id),
    addImage: (id: string) => { if (images.has(id)) throw new Error(`DUPLICATE_IMAGE:${id}`); images.add(id); },
    on: () => {}, off: () => {},
  };
  return { map: api as unknown as Map, layers, images };
}

describe("warehouse result style contract", () => {
  it("accepts server metadata and rejects malformed styles", () => {
    for (const style of [choropleth, bivariate, heatmap, { ...heatmap, weightField: null, weightProperty: null, weightMax: null }, compare]) expect(validateWarehouseResultStyle(clone(style))).toEqual(style);
    for (const bad of [{ ...choropleth, kind: "dots" }, { ...choropleth, breaks: [55, 40, 70, 90] }, { ...choropleth, colors: ["red", ...choropleth.colors.slice(1)] }, { ...bivariate, colors: bivariate.colors.slice(0, 8) }, { ...heatmap, weightMax: Number.NaN }, { ...choropleth, extra: 1 },
      { ...compare, rows: [] },
      { ...compare, columns: Array.from({ length: 21 }, (_, index) => ({ index: index + 1, label: `p${index}` })), rows: compare.rows.map(row => ({ ...row, cells: Array.from({ length: 21 }, () => row.cells[0]) })) },
      { ...compare, rows: [{ ...compare.rows[0], cells: [{ value: 0, notCovered: true, rank: 1 }, ...compare.rows[0].cells.slice(1)] }, compare.rows[1]] },
      { ...compare, rows: [{ ...compare.rows[0], cells: [{ value: null, notCovered: false, rank: 1 }, ...compare.rows[0].cells.slice(1)] }, compare.rows[1]] },
      { ...compare, labelField: "x; drop table" },
    ]) {
      expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    }
  });

  it("accepts the optional ramp/palette/nullStyle additions and rejects a malformed one", () => {
    expect(validateWarehouseResultStyle(clone(choroplethHatch))).toEqual(choroplethHatch);
    for (const bad of [
      { ...choropleth, ramp: "not-a-real-ramp" },
      { ...choropleth, palette: { dark: choropleth.colors, light: choropleth.colors.slice(0, 2) } }, // light shorter than colors
      { ...choropleth, palette: { dark: choropleth.colors } }, // missing light
      { ...choropleth, nullStyle: "solid" },
    ]) {
      expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    }
  });

  it("summarises a compare point in one popup fact and never turns a not-covered cell into 0", () => {
    expect(warehouseStyleFact(compare, { _compare_index: 1 })).toEqual({ label: "台北車站", value: "餐飲店家數: 30（第 1）；b: 5 間（第 2）" });
    expect(warehouseStyleFact(compare, { _compare_index: 3 })).toEqual({ label: "新竹車站", value: "餐飲店家數: 未涵蓋；b: 無資料" });
    expect(warehouseStyleFact(compare, { _compare_index: 99 })).toBeNull();
  });

  it("renders a comparison table with the top value bold, a not-covered cell muted, and clickable column headers", () => {
    const plain = renderToStaticMarkup(createElement(WarehouseCompareTableView, { table: compare }));
    expect(plain).toContain("台北車站");
    expect(plain).toContain("未涵蓋");
    expect(plain.match(/agent-compare-table__best/g)).toHaveLength(2); // rank 1 in each of the two rows
    expect(plain).not.toContain(">0<"); // the not-covered cell must never render as a fabricated 0
    expect(plain).not.toContain("<button");
    const withSelect = renderToStaticMarkup(createElement(WarehouseCompareTableView, { table: compare, onSelectColumn: () => {} }));
    expect(withSelect.match(/<button/g)).toHaveLength(3); // one per compared point
  });

  it("builds a step expression over server breaks with nulls kept grey", () => {
    expect(warehouseStyleColor(choropleth)).toEqual(["case", ["==", ["typeof", ["get", "_style_value"]], "number"], ["step", ["get", "_style_value"], "#eff3ff", 40, "#bdd7e7", 55, "#6baed6", 70, "#3182bd", 90, "#08519c"], "#bdbdbd"]);
  });

  it("picks the palette side matching the requested theme, and leaves the null branch transparent under nullStyle hatch", () => {
    const dark = warehouseStyleColor(choroplethHatch, "dark") as unknown[];
    const light = warehouseStyleColor(choroplethHatch, "light") as unknown[];
    expect((dark[2] as unknown[])[2]).toBe(choroplethHatch.palette.dark[0]);
    expect((light[2] as unknown[])[2]).toBe(choroplethHatch.palette.light[0]);
    expect(dark[3]).toBe("rgba(0,0,0,0)");
    expect(light[3]).toBe("rgba(0,0,0,0)");
    // No palette on the server style (old format) still renders exactly as before, in either theme.
    expect(warehouseStyleColor(choropleth, "light")).toEqual(warehouseStyleColor(choropleth, "dark"));
  });

  it("filters exactly the features a hatch-styled choropleth's colour expression left transparent", () => {
    expect(warehouseChoroplethNullFilter(choroplethHatch)).toEqual(["!=", ["typeof", ["get", "_style_value"]], "number"]);
  });

  it("builds a match expression on _bi_class with grey fallback", () => {
    const expression = warehouseStyleColor(bivariate) as unknown[];
    expect(expression.slice(0, 4)).toEqual(["match", ["coalesce", ["get", "_bi_class"], ""], "1-1", "#e8e8e8"]);
    expect(expression[expression.length - 3]).toBe("3-3");
    expect(expression[expression.length - 2]).toBe("#574249");
    expect(expression[expression.length - 1]).toBe("#bdbdbd");
  });

  it("normalises heatmap weight by the server maximum and filters missing weights", () => {
    const paint = warehouseHeatmapPaint(heatmap, 0.6);
    expect(paint["heatmap-weight"]).toEqual(["/", ["get", "_style_weight"], 4]);
    expect(paint["heatmap-opacity"]).toBe(0.6);
    expect(warehouseHeatmapFilter(heatmap)).toEqual(["==", ["typeof", ["get", "_style_weight"]], "number"]);
    expect(warehouseHeatmapPaint({ ...heatmap, weightField: null, weightProperty: null, weightMax: null }, 1)["heatmap-weight"]).toBe(1);
  });

  it("describes legends and popup facts without turning null into zero", () => {
    expect(warehouseStyleLegend(choropleth)).toMatchObject({ kind: "choropleth", breaks: [40, 55, 70, 90], nullEntry: { label: "無資料／未涵蓋（2）", color: "#bdbdbd" } });
    const grid = warehouseStyleLegend(bivariate);
    expect(grid.kind === "bivariate" && grid.cells.find(cell => cell.cls === "3-1")).toEqual({ cls: "3-1", color: "#c85a5a", x: 3, y: 1 });
    expect(warehouseStyleFact(choropleth, { _style_value: null })).toEqual({ label: "房價中位數", value: "無資料" });
    expect(warehouseStyleFact(bivariate, { price: 60, stops: null, _bi_class: null })!.value).toBe("60 / 無資料（無資料）");
  });

  it("gives a hatch-styled choropleth's null entry a CSS gradient sample instead of a flat swatch, per theme", () => {
    const dark = warehouseStyleLegend(choroplethHatch, "dark");
    const light = warehouseStyleLegend(choroplethHatch, "light");
    expect(dark.nullEntry).toEqual({ label: "無資料／未涵蓋（2）", color: "transparent", hatch: true, gradient: nullHatchCssGradient("dark") });
    expect(light.nullEntry).toEqual({ label: "無資料／未涵蓋（2）", color: "transparent", hatch: true, gradient: nullHatchCssGradient("light") });
    expect(dark.nullEntry?.gradient).not.toBe(light.nullEntry?.gradient);
    // A plain choropleth (no nullStyle) keeps the old flat swatch untouched.
    expect(warehouseStyleLegend(choropleth).nullEntry).toEqual({ label: "無資料／未涵蓋（2）", color: "#bdbdbd" });
  });

  it("renders colour bar, 3x3 grid and density legends", () => {
    const html = (style: Exclude<WarehouseResultStyle, { kind: "compare" }>) => renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(style) }));
    const bar = html(choropleth);
    expect(bar).toContain("房價中位數 · 分位數分級");
    expect(bar).toContain("無資料／未涵蓋（2）");
    expect(bar.match(/agent-style-legend__bar/g)).toHaveLength(1);
    const square = html(bivariate);
    expect(square.match(/<b /g)).toHaveLength(9);
    expect(square).toContain("↑ 公車站密度");
    expect(square).toContain("房價 →");
    expect(html(heatmap)).toContain("linear-gradient(to right, #ffffb2");
    const hatch = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(choroplethHatch, "dark") }));
    expect(hatch).toContain(nullHatchCssGradient("dark"));
  });
});

describe("warehouse style on the map overlay", () => {
  const polygon: PresentableResult = {
    resultId: "wh-3", datasetId: "warehouse:wh-3", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: choropleth,
    rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, name: "大安區", _style_value: 88 }],
  };
  const points: PresentableResult = {
    resultId: "wh-4", datasetId: "warehouse:wh-4", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, resultStyle: heatmap,
    rows: [{ geometry: { type: "Point", coordinates: [121.5, 25] }, _style_weight: 2 }, { geometry: { type: "Point", coordinates: [121.51, 25] }, _style_weight: null }],
  };
  const comparePoints: PresentableResult = {
    resultId: "wh-7", datasetId: "warehouse:wh-7", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, resultStyle: compare,
    rows: [
      { geometry: { type: "Point", coordinates: [121.517, 25.0478] }, _compare_index: 1, a: 30, b: 5 },
      { geometry: { type: "Point", coordinates: [121.4637, 25.0143] }, _compare_index: 2, a: 10, b: 8 },
      { geometry: { type: "Point", coordinates: [120.9718, 24.8014] }, _compare_index: 3, "a__notCovered": true, b: null },
    ],
  };

  it("fills choropleth polygons with the style expression and exposes a legend", () => {
    const { map, layers } = stubMap();
    const [installed] = installAnalysisResults(map, [polygon]);
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-color"]).toEqual(warehouseStyleColor(choropleth));
    expect(installed!.styleLegend?.kind).toBe("choropleth");
  });

  it("draws a theme-matched null-hatch pattern layer for a choropleth under nullStyle hatch, registers the image once, and survives a redraw (basemap switch)", () => {
    const hatchedPolygon: PresentableResult = { ...polygon, resultStyle: choroplethHatch };
    const { map, layers, images } = stubMap();
    installAnalysisResults(map, [hatchedPolygon], 0.8, "light");
    const hatch = layers.get("research-analysis-result-null-hatch-0")!;
    expect(hatch.type).toBe("fill");
    expect(hatch.paint["fill-pattern"]).toBe("viz-null-hatch-light");
    expect(hatch.filter).toEqual(warehouseChoroplethNullFilter(choroplethHatch));
    expect(hatch.paint["fill-opacity"]).toBe(0.8);
    expect(images.has("viz-null-hatch-light")).toBe(true);
    // Simulates map.setStyle wiping addImage'd images on a basemap switch, then the style.load
    // redraw reinstalling: must not throw on a re-add and must re-register the image.
    images.clear();
    expect(() => installAnalysisResults(map, [hatchedPolygon], 0.8, "light")).not.toThrow();
    expect(images.has("viz-null-hatch-light")).toBe(true);
    setAnalysisOpacity(map, installAnalysisResults(map, [hatchedPolygon], 0.8, "light"), hatchedPolygon.resultId, 0.3);
    expect(layers.get("research-analysis-result-null-hatch-0")!.paint["fill-opacity"]).toBe(0.3);
    // A plain choropleth (no nullStyle) never gets the hatch layer.
    installAnalysisResults(map, [polygon], 0.8, "light");
    expect(layers.has("research-analysis-result-null-hatch-0")).toBe(false);
    removeAnalysisResults(map);
    expect(layers.size).toBe(0);
  });

  it("draws heatmaps with a pickable close-zoom point layer that follows opacity and cleanup", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [points], 0.7);
    expect(layers.get("research-analysis-result-points-0")!.type).toBe("heatmap");
    expect(layers.get("research-analysis-result-heat-points-0")).toMatchObject({ type: "circle", minzoom: 13 });
    expect(analysisResultInteractiveLayerIds(map, 1)).toEqual(["research-analysis-result-heat-points-0"]);
    setAnalysisOpacity(map, installed, "wh-4", 0.3);
    expect(layers.get("research-analysis-result-points-0")!.paint["heatmap-opacity"]).toBe(0.3);
    expect(layers.get("research-analysis-result-heat-points-0")!.paint["circle-opacity"]).toBe(0.3);
    installAnalysisResults(map, [{ ...points, resultStyle: undefined }]);
    expect(layers.get("research-analysis-result-points-0")!.type).toBe("circle");
    expect(layers.has("research-analysis-result-heat-points-0")).toBe(false);
    removeAnalysisResults(map);
    expect(layers.size).toBe(0);
  });

  it("surfaces the styled value in popup facts", () => {
    expect(researchResultPopupFacts({ styleFactLabel: "房價中位數", styleFactValue: "88" })[0]).toEqual({ label: "房價中位數", value: "88" });
  });

  it("draws compare points as plain numbered circles, never colour-classified", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [comparePoints]);
    expect(layers.get("research-analysis-result-points-0")!.type).toBe("circle");
    const label = layers.get("research-analysis-result-compare-label-0")!;
    expect(label.type).toBe("symbol");
    expect(label.layout).toMatchObject({ "text-field": ["get", "_compare_index"] });
    expect(installed[0]!.compareTable).toEqual(compare);
    expect(installed[0]!.styleLegend).toBeUndefined();
    setAnalysisOpacity(map, installed, "wh-7", 0.4);
    expect(layers.get("research-analysis-result-compare-label-0")!.paint["text-opacity"]).toBe(0.4);
    installAnalysisResults(map, [{ ...comparePoints, resultStyle: undefined }]);
    expect(layers.has("research-analysis-result-compare-label-0")).toBe(false);
    removeAnalysisResults(map);
    expect(layers.size).toBe(0);
  });
});

describe("warehouse import with style", () => {
  const collection = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, properties: { _style_value: null } }] });
  const sha = createHash("sha256").update(collection).digest("hex");
  const fetchImpl = (async () => new Response(collection)) as unknown as typeof fetch;

  it("carries a validated style onto each imported result; unstyled imports are unchanged", async () => {
    const [styled] = await loadWarehouseResult(validateWarehouseImportArgs({ resultId: "wh-9", sha256: sha, label: "x", featureCount: 1, style: clone(choropleth) }), fetchImpl);
    expect(styled!.resultStyle).toEqual(choropleth);
    const [plain] = await loadWarehouseResult(validateWarehouseImportArgs({ resultId: "wh-9", sha256: sha, label: "x", featureCount: 1 }), fetchImpl);
    expect(plain).not.toHaveProperty("resultStyle");
  });

  it("rejects a heatmap style on polygon results and malformed styles", async () => {
    await expect(loadWarehouseResult(validateWarehouseImportArgs({ resultId: "wh-9", sha256: sha, label: "x", featureCount: 1, style: clone(heatmap) }), fetchImpl)).rejects.toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    expect(() => validateWarehouseImportArgs({ resultId: "wh-9", sha256: sha, label: "x", featureCount: 1, style: { kind: "choropleth" } })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("rejects a compare style on polygon results or when the point count does not match its columns", async () => {
    await expect(loadWarehouseResult(validateWarehouseImportArgs({ resultId: "wh-9", sha256: sha, label: "x", featureCount: 1, style: clone(compare) }), fetchImpl)).rejects.toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    const threePoints = JSON.stringify({ type: "FeatureCollection", features: [1, 2].map(index => ({ type: "Feature", geometry: { type: "Point", coordinates: [121.5 + index * 0.01, 25] }, properties: { _compare_index: index } })) });
    const shaTwo = createHash("sha256").update(threePoints).digest("hex");
    const fetchTwo = (async () => new Response(threePoints)) as unknown as typeof fetch;
    await expect(loadWarehouseResult(validateWarehouseImportArgs({ resultId: "wh-9", sha256: shaTwo, label: "x", featureCount: 2, style: clone(compare) }), fetchTwo)).rejects.toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });
});
