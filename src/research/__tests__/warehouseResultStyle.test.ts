import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Map } from "mapbox-gl";
import { analysisResultInteractiveLayerIds, installAnalysisResults, removeAnalysisResults, setAnalysisOpacity } from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";
import { researchResultPopupFacts } from "../researchResultPopup";
import { loadWarehouseResult, validateWarehouseImportArgs } from "../warehouseResultImport";
import { validateWarehouseResultStyle, warehouseHeatmapFilter, warehouseHeatmapPaint, warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend, type WarehouseResultStyle } from "../warehouseResultStyle";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";

const choropleth = { kind: "choropleth", field: "median_price", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "房價中位數", breaks: [40, 55, 70, 90], colors: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"], labels: ["30 – < 40", "40 – < 55", "55 – < 70", "70 – < 90", "90 – 120"], min: 30, max: 120, nullColor: "#bdbdbd", nullCount: 2 } as const satisfies WarehouseResultStyle;
const bivariate = { kind: "bivariate", xField: "price", yField: "stops", xLabel: "房價", yLabel: "公車站密度", classProperty: "_bi_class", xBreaks: [50, 70], yBreaks: [3, 8], classes: ["1-1", "2-1", "3-1", "1-2", "2-2", "3-2", "1-3", "2-3", "3-3"], colors: ["#e8e8e8", "#e4acac", "#c85a5a", "#b0d5df", "#ad9ea5", "#985356", "#64acbe", "#627f8c", "#574249"], nullColor: "#bdbdbd", nullCount: 1 } as const satisfies WarehouseResultStyle;
const heatmap = { kind: "heatmap", weightField: "deaths", weightProperty: "_style_weight", weightMax: 4, colors: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"], nullCount: 3 } as const satisfies WarehouseResultStyle;
const clone = <T,>(value: T): T => structuredClone(value) as T;

type Layer = { id: string; type: string; source: string; minzoom?: number; filter?: unknown; paint: Record<string, unknown> };
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
    isSourceLoaded: () => true,
    setPaintProperty: (id: string, property: string, value: unknown) => { const layer = layers.get(id); if (layer) layer.paint[property] = value; },
    setFilter: (id: string, filter: unknown) => { const layer = layers.get(id); if (layer) layer.filter = filter ?? undefined; },
    on: () => {}, off: () => {},
  };
  return { map: api as unknown as Map, layers };
}

describe("warehouse result style contract", () => {
  it("accepts server metadata and rejects malformed styles", () => {
    for (const style of [choropleth, bivariate, heatmap, { ...heatmap, weightField: null, weightProperty: null, weightMax: null }]) expect(validateWarehouseResultStyle(clone(style))).toEqual(style);
    for (const bad of [{ ...choropleth, kind: "dots" }, { ...choropleth, breaks: [55, 40, 70, 90] }, { ...choropleth, colors: ["red", ...choropleth.colors.slice(1)] }, { ...bivariate, colors: bivariate.colors.slice(0, 8) }, { ...heatmap, weightMax: Number.NaN }, { ...choropleth, extra: 1 }]) {
      expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    }
  });

  it("builds a step expression over server breaks with nulls kept grey", () => {
    expect(warehouseStyleColor(choropleth)).toEqual(["case", ["==", ["typeof", ["get", "_style_value"]], "number"], ["step", ["get", "_style_value"], "#eff3ff", 40, "#bdd7e7", 55, "#6baed6", 70, "#3182bd", 90, "#08519c"], "#bdbdbd"]);
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

  it("renders colour bar, 3x3 grid and density legends", () => {
    const html = (style: WarehouseResultStyle) => renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(style) }));
    const bar = html(choropleth);
    expect(bar).toContain("房價中位數 · 分位數分級");
    expect(bar).toContain("無資料／未涵蓋（2）");
    expect(bar.match(/agent-style-legend__bar/g)).toHaveLength(1);
    const square = html(bivariate);
    expect(square.match(/<b /g)).toHaveLength(9);
    expect(square).toContain("↑ 公車站密度");
    expect(square).toContain("房價 →");
    expect(html(heatmap)).toContain("linear-gradient(to right, #ffffb2");
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

  it("fills choropleth polygons with the style expression and exposes a legend", () => {
    const { map, layers } = stubMap();
    const [installed] = installAnalysisResults(map, [polygon]);
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-color"]).toEqual(warehouseStyleColor(choropleth));
    expect(installed!.styleLegend?.kind).toBe("choropleth");
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
});
