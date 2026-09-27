import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Map } from "mapbox-gl";
import { analysisResultInteractiveLayerIds, installAnalysisResults, removeAnalysisResults, setAnalysisOpacity } from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";
import { researchResultPopupFacts } from "../researchResultPopup";
import { loadWarehouseResult, validateWarehouseImportArgs } from "../warehouseResultImport";
import {
  validateWarehouseResultStyle, warehouseFillNullFilter, warehouseHeatmapFilter, warehouseHeatmapPaint,
  warehouseProportionalColor, warehouseProportionalLabelFilter, warehouseProportionalSizeFilter, warehouseProportionalSortKey,
  warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend, type WarehouseResultStyle,
} from "../warehouseResultStyle";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";
import { WarehouseCompareTableView } from "../WarehouseCompareTable";
import { nullHatchCssGradient } from "../vizSpec";

const choropleth = { kind: "choropleth", field: "median_price", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "房價中位數", breaks: [40, 55, 70, 90], colors: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"], labels: ["30 – < 40", "40 – < 55", "55 – < 70", "70 – < 90", "90 – 120"], min: 30, max: 120, nullColor: "#bdbdbd", nullCount: 2 } as const satisfies WarehouseResultStyle;
const heatmap = { kind: "heatmap", weightField: "deaths", weightProperty: "_style_weight", weightMax: 4, colors: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"], nullCount: 3 } as const satisfies WarehouseResultStyle;
const compare = { kind: "compare", labelField: "label", pointProperty: "_compare_index", columns: [{ index: 1, label: "台北車站" }, { index: 2, label: "板橋車站" }, { index: 3, label: "新竹車站" }], rows: [
  { field: "a", label: "餐飲店家數", unit: null, cells: [{ value: 30, notCovered: false, rank: 1 }, { value: 10, notCovered: false, rank: 2 }, { value: null, notCovered: true, rank: null }] },
  { field: "b", label: "b", unit: "間", cells: [{ value: 5, notCovered: false, rank: 2 }, { value: 8, notCovered: false, rank: 1 }, { value: null, notCovered: false, rank: null }] },
] } as const satisfies WarehouseResultStyle;
const choroplethHatch = { ...choropleth, ramp: "viridis", nullStyle: "hatch", palette: { dark: choropleth.colors, light: ["#a", "#b", "#c", "#d", "#e"].map((_, index) => `#${(index + 1).toString().padStart(6, "0")}`) } } as const satisfies WarehouseResultStyle;
// V3: replaces the old 9-colour `_bi_class` 3x3 grid entirely (see the explicit rejection test below).
const bivariateV3 = {
  kind: "bivariate", mode: "fill-and-size", xField: "price", yField: "stops", xLabel: "房價", yLabel: "公車站密度",
  xValueKind: "count", yValueKind: "count",
  valueProperty: "_style_value", sizeValueProperty: "_size_value", sizeRadiusProperty: "_size_radius", sizeRankProperty: "_size_rank", sizeAnchorProperty: "_size_anchor",
  ramp: "viridis", palette: { dark: ["#31688e", "#21918c", "#35b779"], light: ["#35b779", "#1f9e89", "#26828e"] },
  breaks: [50, 70], labels: ["< 50", "50 – < 70", "≥ 70"], min: 30, max: 120,
  rMinPx: 4, rMaxPx: 28, topN: 8,
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 1,
} as const satisfies WarehouseResultStyle;
const proportional = {
  kind: "proportional", sizeField: "population", colorField: "density", labelField: "name",
  sizeValueProperty: "_size_value", sizeRadiusProperty: "_size_radius", labelRankProperty: "_label_rank", valueProperty: "_style_value",
  sizeValueKind: "count", colorValueKind: "density",
  rMinPx: 4, rMaxPx: 28, fillOpacity: 0.75, ringPx: 1, labelTopN: 5, drawOrder: "largest-first",
  ramp: "viridis", palette: { dark: ["#31688e", "#21918c", "#35b779"], light: ["#35b779", "#1f9e89", "#26828e"] },
  breaks: [50, 70], labels: ["< 50", "50 – < 70", "≥ 70"], min: 30, max: 120,
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 2,
  sizeLegend: [{ value: 1000, radiusPx: 28, label: "1,000" }, { value: 250, radiusPx: 14, label: "250" }, { value: 60, radiusPx: 6, label: "60" }],
} as const satisfies WarehouseResultStyle;
// Monochrome proportional: no colorField -> a 1-colour palette, empty breaks/labels, null min/max.
const proportionalMono = {
  kind: "proportional", sizeField: "population", colorField: null, labelField: null,
  sizeValueProperty: "_size_value", sizeRadiusProperty: "_size_radius", labelRankProperty: "_label_rank", valueProperty: null,
  sizeValueKind: "count", colorValueKind: "count",
  rMinPx: 4, rMaxPx: 28, fillOpacity: 0.75, ringPx: 1, labelTopN: 5, drawOrder: "largest-first",
  ramp: "viridis", palette: { dark: ["#35b779"], light: ["#26828e"] },
  breaks: [], labels: [], min: null, max: null,
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 0,
  sizeLegend: [{ value: 1000, radiusPx: 28, label: "1,000" }],
} as const satisfies WarehouseResultStyle;
// The pre-V3 shape (9-colour categorical grid on `_bi_class`); must now be rejected, not rendered.
const OLD_BIVARIATE_FORMAT = { kind: "bivariate", xField: "price", yField: "stops", xLabel: "房價", yLabel: "公車站密度", classProperty: "_bi_class", xBreaks: [50, 70], yBreaks: [3, 8], classes: ["1-1", "2-1", "3-1", "1-2", "2-2", "3-2", "1-3", "2-3", "3-3"], colors: ["#e8e8e8", "#e4acac", "#c85a5a", "#b0d5df", "#ad9ea5", "#985356", "#64acbe", "#627f8c", "#574249"], nullColor: "#bdbdbd", nullCount: 1 };
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
    setLayoutProperty: (id: string, property: string, value: unknown) => { const layer = layers.get(id); if (layer) layer.layout = { ...layer.layout, [property]: value }; },
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
    for (const style of [choropleth, bivariateV3, heatmap, { ...heatmap, weightField: null, weightProperty: null, weightMax: null }, compare, proportional, proportionalMono]) expect(validateWarehouseResultStyle(clone(style))).toEqual(style);
    for (const bad of [{ ...choropleth, kind: "dots" }, { ...choropleth, breaks: [55, 40, 70, 90] }, { ...choropleth, colors: ["red", ...choropleth.colors.slice(1)] }, { ...heatmap, weightMax: Number.NaN }, { ...choropleth, extra: 1 },
      { ...compare, rows: [] },
      { ...compare, columns: Array.from({ length: 21 }, (_, index) => ({ index: index + 1, label: `p${index}` })), rows: compare.rows.map(row => ({ ...row, cells: Array.from({ length: 21 }, () => row.cells[0]) })) },
      { ...compare, rows: [{ ...compare.rows[0], cells: [{ value: 0, notCovered: true, rank: 1 }, ...compare.rows[0].cells.slice(1)] }, compare.rows[1]] },
      { ...compare, rows: [{ ...compare.rows[0], cells: [{ value: null, notCovered: false, rank: 1 }, ...compare.rows[0].cells.slice(1)] }, compare.rows[1]] },
      { ...compare, labelField: "x; drop table" },
      OLD_BIVARIATE_FORMAT, // the pre-V3 9-colour grid is a hard rejection now, not a legacy fallback
      { ...bivariateV3, colors: ["#e8e8e8", "#e4acac", "#c85a5a"] }, // bivariate V3 has no `colors` field at all
      { ...bivariateV3, palette: { dark: bivariateV3.palette.dark.slice(0, 2), light: bivariateV3.palette.light.slice(0, 2) } }, // palette length must match breaks+1
      { ...proportional, colorField: null }, // colorField null but breaks/labels/min/max still populated
      { ...proportionalMono, colorField: "density" }, // colorField set but palette length still 1
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

  it("prefers an explicit server valueKind over the value-shape guess, and falls back when absent", () => {
    // 12.5 is not an integer; with no valueKind this reads as "ratio" ("12.5"), but an explicit
    // "count" valueKind wins and rounds it ("13" per the myriad/thousands count rule).
    expect(warehouseStyleFact({ ...choropleth, valueKind: "count" }, { _style_value: 12.5 })!.value).toBe("13");
    expect(warehouseStyleFact(choropleth, { _style_value: 12.5 })!.value).toBe("12.5");
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

  it("filters exactly the features a hatch-styled choropleth or bivariate fill left transparent", () => {
    expect(warehouseFillNullFilter(choroplethHatch)).toEqual(["!=", ["typeof", ["get", "_style_value"]], "number"]);
    expect(warehouseFillNullFilter(bivariateV3)).toEqual(["!=", ["typeof", ["get", "_style_value"]], "number"]);
  });

  it("builds bivariate V3's x-fill as a step expression, always transparent (never grey) when null", () => {
    const dark = warehouseStyleColor(bivariateV3, "dark") as unknown[];
    expect(dark).toEqual(["case", ["==", ["typeof", ["get", "_style_value"]], "number"], ["step", ["get", "_style_value"], "#31688e", 50, "#21918c", 70, "#35b779"], "rgba(0,0,0,0)"]);
    const light = warehouseStyleColor(bivariateV3, "light") as unknown[];
    expect((light[2] as unknown[])[2]).toBe("#35b779"); // light[0]
  });

  it("normalises heatmap weight by the server maximum and filters missing weights", () => {
    const paint = warehouseHeatmapPaint(heatmap, 0.6);
    expect(paint["heatmap-weight"]).toEqual(["/", ["get", "_style_weight"], 4]);
    expect(paint["heatmap-opacity"]).toBe(0.6);
    expect(warehouseHeatmapFilter(heatmap)).toEqual(["==", ["typeof", ["get", "_style_weight"]], "number"]);
    expect(warehouseHeatmapPaint({ ...heatmap, weightField: null, weightProperty: null, weightMax: null }, 1)["heatmap-weight"]).toBe(1);
  });

  it("colours a proportional circle by its classified colorField, falling back to the categorical 'other' colour when null (never a hatch — a point has no area to hatch)", () => {
    const expression = warehouseProportionalColor(proportional, "dark") as unknown[];
    expect(expression[0]).toBe("case");
    expect(expression[expression.length - 1]).toBe("#6b7280"); // categorical.other.dark
    expect(warehouseProportionalColor(proportionalMono, "dark")).toBe("#35b779"); // its one-colour palette
  });

  it("filters out an unsized feature, filters labels to only the ranked top-N, and sorts the largest circle to draw first", () => {
    expect(warehouseProportionalSizeFilter(proportional)).toEqual(["==", ["typeof", ["get", "_size_radius"]], "number"]);
    expect(warehouseProportionalLabelFilter(proportional)).toEqual(["==", ["typeof", ["get", "_label_rank"]], "number"]);
    expect(warehouseProportionalSortKey(proportional)).toEqual(["-", 0, ["get", "_size_radius"]]);
  });

  it("describes legends and popup facts without turning null into zero", () => {
    expect(warehouseStyleLegend(choropleth)).toMatchObject({ kind: "choropleth", breaks: [40, 55, 70, 90], nullEntry: { label: "無資料／未涵蓋（2）", color: "#bdbdbd" } });
    expect(warehouseStyleFact(choropleth, { _style_value: null })).toEqual({ label: "房價中位數", value: "無資料" });
  });

  it("gives bivariate V3's fill legend the actual drawn size-legend rows (not a recomputed scale), and always the hatch null entry", () => {
    const rows = [
      { _style_value: 55, _size_value: 900, _size_radius: 28, _size_rank: 1 },
      { _style_value: 40, _size_value: 500, _size_radius: 18, _size_rank: 2 },
      { _style_value: 80, _size_value: 100, _size_radius: 6, _size_rank: 3 },
      { _style_value: null }, // untouched by the size legend; contributes to nullCount at the style level
    ];
    const legend = warehouseStyleLegend(bivariateV3, "dark", rows);
    expect(legend.kind === "bivariate" && legend.fillEntries.map(entry => entry.color)).toEqual(bivariateV3.palette.dark);
    expect(legend.kind === "bivariate" && legend.sizeLegend).toEqual([
      { value: 900, radiusPx: 28, label: "900" }, { value: 500, radiusPx: 18, label: "500" }, { value: 100, radiusPx: 6, label: "100" },
    ]);
    expect(legend.kind === "bivariate" && legend.nullEntry).toEqual({ label: "無資料／未涵蓋（1）", color: "transparent", hatch: true, gradient: nullHatchCssGradient("dark") });
    // No rows given (e.g. a legend-only call site with no rows in hand) degrades to an empty size legend, never throws.
    const withoutRows = warehouseStyleLegend(bivariateV3, "dark");
    if (withoutRows.kind !== "bivariate") throw new Error("expected a bivariate legend");
    expect(withoutRows.sizeLegend).toEqual([]);
  });

  it("summarises a bivariate V3 point: x from its classified value, y from its own size value or, outside the top-N, its raw field", () => {
    expect(warehouseStyleFact(bivariateV3, { _style_value: 60, _size_value: 900, stops: 12 })!.value).toBe("60 / 900");
    expect(warehouseStyleFact(bivariateV3, { _style_value: 60, stops: 12 })!.value).toBe("60 / 12"); // not in the top-N, falls back to raw yField
    expect(warehouseStyleFact(bivariateV3, { _style_value: null, stops: null })!.value).toBe("無資料 / 無資料");
  });

  it("orders a proportional popup fact as size -> colour -> rank, and excludes an unsized feature entirely", () => {
    expect(warehouseStyleFact(proportional, { _size_value: 900, _style_value: 42, _label_rank: 1 })).toEqual({ label: "population × density", value: "population: 900；density: 42；第 1 名" });
    expect(warehouseStyleFact(proportional, { _size_value: 900, _style_value: null })!.value).toBe("population: 900；density: 無資料");
    expect(warehouseStyleFact(proportionalMono, { _size_value: 42 })).toEqual({ label: "population", value: "population: 42" });
    expect(warehouseStyleFact(proportional, {})).toBeNull(); // no _size_value: this feature was never drawn
  });

  it("gives a hatch-styled choropleth's null entry a CSS gradient sample instead of a flat swatch, per theme", () => {
    const dark = warehouseStyleLegend(choroplethHatch, "dark");
    const light = warehouseStyleLegend(choroplethHatch, "light");
    if (dark.kind !== "choropleth" || light.kind !== "choropleth") throw new Error("expected a choropleth legend");
    expect(dark.nullEntry).toEqual({ label: "無資料／未涵蓋（2）", color: "transparent", hatch: true, gradient: nullHatchCssGradient("dark") });
    expect(light.nullEntry).toEqual({ label: "無資料／未涵蓋（2）", color: "transparent", hatch: true, gradient: nullHatchCssGradient("light") });
    expect(dark.nullEntry.gradient).not.toBe(light.nullEntry.gradient);
    // A plain choropleth (no nullStyle) keeps the old flat swatch untouched.
    const plain = warehouseStyleLegend(choropleth);
    if (plain.kind !== "choropleth") throw new Error("expected a choropleth legend");
    expect(plain.nullEntry).toEqual({ label: "無資料／未涵蓋（2）", color: "#bdbdbd" });
  });

  it("renders colour bars, size-legend circles and density legends", () => {
    const html = (style: Exclude<WarehouseResultStyle, { kind: "compare" }>) => renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(style) }));
    const bar = html(choropleth);
    expect(bar).toContain("房價中位數 · 分位數分級");
    expect(bar).toContain("無資料／未涵蓋（2）");
    expect(bar.match(/agent-style-legend__bar/g)).toHaveLength(1);
    expect(html(heatmap)).toContain("linear-gradient(to right, #ffffb2");
    const hatch = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(choroplethHatch, "dark") }));
    expect(hatch).toContain(nullHatchCssGradient("dark"));
    const bivariateHtml = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(bivariateV3, "dark", [{ _size_value: 900, _size_radius: 28, _size_rank: 1 }]) }));
    expect(bivariateHtml).toContain("房價（填色）× 公車站密度（大小）");
    expect(bivariateHtml.match(/agent-style-legend__bar/g)).toHaveLength(1);
    expect(bivariateHtml).toContain("<svg");
    const proportionalHtml = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(proportional, "dark") }));
    expect(proportionalHtml).toContain("population");
    expect(proportionalHtml).toContain("density");
    expect(proportionalHtml).toContain("<svg");
    expect(proportionalHtml).toContain("另有 2 筆缺少可用的「population」數值，未顯示");
    expect(renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(proportionalMono, "dark") }))).not.toContain("另有");
  });
});

describe("warehouse style on the map overlay", () => {
  const polygon: PresentableResult = {
    resultId: "wh-3", datasetId: "warehouse:wh-3", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: choropleth,
    rows: [{ geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, name: "大安區", _style_value: 88 }],
  };
  const bivariatePolygon: PresentableResult = {
    resultId: "wh-8", datasetId: "warehouse:wh-8", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: bivariateV3,
    rows: [
      { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, name: "大安區", _style_value: 60, _size_value: 900, _size_radius: 28, _size_rank: 1, _size_anchor: [121.505, 25.005] },
      { geometry: { type: "Polygon", coordinates: [[[121.6, 25], [121.61, 25], [121.61, 25.01], [121.6, 25]]] }, name: "信義區", _style_value: null },
    ],
  };
  const proportionalPoints: PresentableResult = {
    resultId: "wh-10", datasetId: "warehouse:wh-10", geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true }, resultStyle: proportional,
    rows: [
      { geometry: { type: "Point", coordinates: [121.5, 25] }, name: "甲站", _size_value: 900, _size_radius: 28, _style_value: 60, _label_rank: 1 },
      { geometry: { type: "Point", coordinates: [121.51, 25] }, name: "乙站", _style_value: null }, // excluded: no _size_radius
    ],
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
    expect(hatch.filter).toEqual(warehouseFillNullFilter(choroplethHatch));
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

  it("draws bivariate V3's x-fill with the shared hatch layer, plus a sibling size-bubble point layer from each row's _size_anchor", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [bivariatePolygon], 0.8, "dark");
    expect(layers.get("research-analysis-result-points-0")!.paint["fill-color"]).toEqual(warehouseStyleColor(bivariateV3, "dark"));
    expect(layers.get("research-analysis-result-null-hatch-0")).toMatchObject({ type: "fill", paint: { "fill-pattern": "viz-null-hatch-dark" } });
    const bubble = layers.get("research-analysis-result-bivariate-size-circle-0")!;
    expect(bubble.type).toBe("circle");
    expect(bubble.paint["circle-color"]).toBe("rgba(0,0,0,0)");
    expect(bubble.paint["circle-stroke-color"]).toBe("#f3f4f6"); // dark-theme ring
    expect(installed[0]!.styleLegend?.kind).toBe("bivariate");
    setAnalysisOpacity(map, installed, bivariatePolygon.resultId, 0.4);
    expect(layers.get("research-analysis-result-bivariate-size-circle-0")!.paint["circle-stroke-opacity"]).toBe(0.4);
    // Switching the same slot to a non-bivariate result cleans up both the bubble layer and its source.
    installAnalysisResults(map, [polygon], 0.8, "dark");
    expect(layers.has("research-analysis-result-bivariate-size-circle-0")).toBe(false);
    removeAnalysisResults(map);
    expect(layers.size).toBe(0);
  });

  it("draws proportional circles sized by _size_radius, excludes an unsized feature, and labels only the top-N", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [proportionalPoints], 0.8, "dark");
    const circle = layers.get("research-analysis-result-points-0")!;
    expect(circle.type).toBe("circle");
    expect(circle.paint["circle-radius"]).toEqual(["get", "_size_radius"]);
    expect(circle.filter).toEqual(warehouseProportionalSizeFilter(proportional));
    expect(circle.layout).toMatchObject({ "circle-sort-key": warehouseProportionalSortKey(proportional) });
    // The first install reveal-fades from 0 (no "render" event fires in this stub); reinstalling
    // the same, already-existing layer skips the fade and applies the composed opacity immediately.
    installAnalysisResults(map, [proportionalPoints], 0.8, "dark");
    // fillOpacity (0.75) composes with the result opacity (0.8), matching a polygon's own ratio convention.
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBeCloseTo(0.8 * 0.75, 5);
    const label = layers.get("research-analysis-result-proportional-label-0")!;
    expect(label.type).toBe("symbol");
    expect(label.filter).toEqual(warehouseProportionalLabelFilter(proportional));
    expect(installed[0]!.circleOpacityRatio).toBe(0.75);
    setAnalysisOpacity(map, installed, proportionalPoints.resultId, 0.4);
    expect(layers.get("research-analysis-result-points-0")!.paint["circle-opacity"]).toBeCloseTo(0.4 * 0.75, 5);
    expect(layers.get("research-analysis-result-proportional-label-0")!.paint["text-opacity"]).toBe(0.4);
    installAnalysisResults(map, [polygon], 0.8, "dark");
    expect(layers.has("research-analysis-result-proportional-label-0")).toBe(false);
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
