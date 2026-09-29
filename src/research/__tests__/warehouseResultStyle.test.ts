import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Map } from "mapbox-gl";
import { analysisResultInteractiveLayerIds, installAnalysisResults, layerId, nullHatchLayerId, removeAnalysisResults, setAnalysisOpacity, setAnalysisResultPeriod } from "../analysisResultOverlay";
import type { PresentableResult } from "../researchAnalysisSession";
import { researchResultPopupFacts } from "../researchResultPopup";
import { loadWarehouseResult, validateWarehouseImportArgs } from "../warehouseResultImport";
import {
  classifyStepColor, isTimedChoropleth, validateWarehouseResultStyle, warehouseChoroplethColorAtPeriod, warehouseChoroplethPeriodFact, warehouseChoroplethPeriodProperty,
  warehouseFillNullFilter, warehouseFillNullFilterAtPeriod, warehouseHeatmapFilter, warehouseHeatmapPaint,
  warehouseProportionalColor, warehouseProportionalLabelFilter, warehouseProportionalSizeFilter, warehouseProportionalSortKey,
  warehouseRankBarStyle, warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend, type WarehouseResultStyle, type WarehouseTimedChoropleth,
} from "../warehouseResultStyle";
import { WarehouseStyleLegendView } from "../WarehouseStyleLegend";
import { WarehouseCompareTableView } from "../WarehouseCompareTable";
import { nullHatchCssGradient, VIZ_SPEC } from "../vizSpec";

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
// mcp title/unit additions (2026-09-28 correction): choropleth/bivariate keep their existing
// label/xLabel/yLabel verbatim (no title override) and only gain a display `unit`; proportional
// alone gains `sizeTitle`/`colorTitle` overrides alongside `sizeUnit`/`colorUnit`.
const choroplethWithUnit = { ...choropleth, unit: "人/km²" } as const satisfies WarehouseResultStyle;
const bivariateWithUnit = { ...bivariateV3, xUnit: "元", yUnit: "站/km²" } as const satisfies WarehouseResultStyle;
const proportionalWithTitles = { ...proportional, sizeTitle: "人口數", sizeUnit: "人", colorTitle: "人口密度", colorUnit: "人/km²" } as const satisfies WarehouseResultStyle;
const gridFixture = {
  kind: "grid", method: "h3", resolution: 8, cellMeters: null, weightField: null,
  valueProperty: "_style_value", countProperty: "_grid_count", weightProperty: null, idProperty: "_grid_id",
  title: "格點密度", unit: "件", valueKind: "count",
  ramp: "viridis", palette: { dark: ["#31688e", "#21918c", "#35b779"], light: ["#35b779", "#1f9e89", "#26828e"] },
  breaks: [10, 20], labels: ["< 10", "10 – < 20", "≥ 20"], min: 0, max: 40,
  cellCount: 3, pointCount: 12, weightMissingCount: 0, gapPx: 1,
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 0,
} as const satisfies WarehouseResultStyle;
const extrusionFixture = {
  kind: "extrusion", field: "height_m", valueProperty: "_style_value", method: "quantile", scheme: "sequential", label: "建物高度",
  breaks: [10, 20], colors: ["#eff3ff", "#6baed6", "#08519c"], labels: ["< 10", "10 – < 20", "≥ 20"], min: 0, max: 40,
  valueKind: "count", unit: "m",
  ramp: "viridis", palette: { dark: ["#eff3ff", "#6baed6", "#08519c"], light: ["#f0f0f0", "#a1c9e6", "#1858a8"] },
  nullStyle: "hatch", nullColor: "#bdbdbd", nullCount: 0,
  heightField: "height_m", heightProperty: "_extrusion_height", maxHeightM: 60, heightMax: 300,
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
    moveLayer: () => {},
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
  return { map: api as unknown as Map, layers, images, sources };
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

  it("accepts the optional mcp title/unit display metadata and rejects a malformed one", () => {
    expect(validateWarehouseResultStyle(clone(choroplethWithUnit))).toEqual(choroplethWithUnit);
    expect(validateWarehouseResultStyle(clone(bivariateWithUnit))).toEqual(bivariateWithUnit);
    expect(validateWarehouseResultStyle(clone(proportionalWithTitles))).toEqual(proportionalWithTitles);
    // unit (and proportional's colorTitle) may be explicitly null; an old-format style with no
    // such keys at all still renders (already covered above) — this checks the null variant too.
    expect(validateWarehouseResultStyle({ ...choropleth, unit: null })).toEqual({ ...choropleth, unit: null });
    expect(validateWarehouseResultStyle({ ...proportional, colorTitle: null })).toEqual({ ...proportional, colorTitle: null });
    for (const bad of [
      { ...choropleth, unit: "a".repeat(17) }, // unit over 16 chars
      { ...choropleth, unit: "" }, // empty string is not a valid unit
      { ...bivariateV3, xUnit: 5 }, // wrong type
      { ...proportional, sizeTitle: "a".repeat(41) }, // title over 40 chars
      { ...proportional, sizeTitle: null }, // sizeTitle has no null variant — sizeField always exists
      { ...proportional, colorUnit: 5 }, // wrong type
      { ...choropleth, title: "not a real field" }, // choropleth never gained a title override
    ]) {
      expect(() => validateWarehouseResultStyle(bad)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    }
  });

  it("prefers an explicit server valueKind over the value-shape guess, and falls back when absent", () => {
    // 12.5 is not an integer; with no valueKind this reads as "ratio" ("12.5"), but an explicit
    // "count" valueKind wins and rounds it ("13" per the myriad/thousands count rule).
    expect(warehouseStyleFact({ ...choropleth, valueKind: "count" }, { _style_value: 12.5 })!.value).toBe("13");
    expect(warehouseStyleFact(choropleth, { _style_value: 12.5 })!.value).toBe("12.5");
    expect(warehouseStyleFact({ ...choropleth, unit: "人/km²" }, { _style_value: null })!.value).toBe("無資料");
    expect(warehouseStyleFact({ ...choropleth, unit: "人/km²" }, { _style_value: 12.5 })!.value).toBe("12.5 人/km²");
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

  it("appends a declared unit to legend titles and popup values, and lets proportional override its field-derived title", () => {
    const choroplethLegend = warehouseStyleLegend(choroplethWithUnit);
    if (choroplethLegend.kind !== "choropleth") throw new Error("expected a choropleth legend");
    expect(choroplethLegend.title).toBe("房價中位數（人/km²）");
    expect(choroplethLegend.entries[0]!.label).toBe(choropleth.labels[0]); // units never touch the bin labels
    expect(warehouseStyleFact(choroplethWithUnit, { _style_value: 88 })).toEqual({ label: "房價中位數", value: "88 人/km²" });

    const bivariateLegend = warehouseStyleLegend(bivariateWithUnit);
    if (bivariateLegend.kind !== "bivariate") throw new Error("expected a bivariate legend");
    expect(bivariateLegend.xLabel).toBe("房價（元）");
    expect(bivariateLegend.yLabel).toBe("公車站密度（站/km²）");
    expect(warehouseStyleFact(bivariateWithUnit, { _style_value: 60, _size_value: 900, stops: 12 })!.value).toBe("60 元 / 900 站/km²");

    const proportionalLegend = warehouseStyleLegend(proportionalWithTitles);
    if (proportionalLegend.kind !== "proportional") throw new Error("expected a proportional legend");
    expect(proportionalLegend.sizeLabel).toBe("人口數（人）");
    expect(proportionalLegend.colorLegend!.title).toBe("人口密度（人/km²）");
    expect(warehouseStyleFact(proportionalWithTitles, { _size_value: 900, _style_value: 42, _label_rank: 1 })).toEqual({
      label: "人口數 × 人口密度", value: "人口數: 900 人；人口密度: 42 人/km²；第 1 名",
    });

    // A "%" unit never doubles up with formatVizNumber's own trailing "%".
    expect(warehouseStyleFact({ ...choropleth, valueKind: "percent", unit: "%" }, { _style_value: 12.3 })!.value).toBe("12.3%");
    // Absent title/unit fields (old-format style) render exactly as before.
    expect(warehouseStyleLegend(proportional)).toMatchObject({ sizeLabel: "population" });
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
    const html = (style: Exclude<WarehouseResultStyle, { kind: "compare" | "series" }>) => renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(style) }));
    const bar = html(choropleth);
    expect(bar).toContain("房價中位數 · 分位數分級");
    expect(bar).toContain("無資料／未涵蓋（2）");
    expect(bar.match(/agent-style-legend__bar/g)).toHaveLength(1);
    expect(html(heatmap)).toContain("linear-gradient(to right, #ffffb2");
    const hatch = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(choroplethHatch, "dark") }));
    expect(hatch).toContain(nullHatchCssGradient("dark"));
    const bivariateHtml = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(bivariateV3, "dark", [{ _size_value: 900, _size_radius: 28, _size_rank: 1 }]) }));
    expect(bivariateHtml).toContain("填色：房價 · 大小：公車站密度");
    expect(bivariateHtml.match(/agent-style-legend__bar/g)).toHaveLength(1);
    expect(bivariateHtml).toContain("<svg");
    const proportionalHtml = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(proportional, "dark") }));
    expect(proportionalHtml).toContain("population");
    expect(proportionalHtml).toContain("density");
    expect(proportionalHtml).toContain("<svg");
    expect(proportionalHtml).toContain("另有 2 筆缺少可用的「population」數值，未顯示");
    expect(renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(proportionalMono, "dark") }))).not.toContain("另有");
    // 有單位時標題不重複加括號：「填色：X（單位） · 大小：Y（單位）」
    const bivariateUnitHtml = renderToStaticMarkup(createElement(WarehouseStyleLegendView, { legend: warehouseStyleLegend(bivariateWithUnit, "dark") }));
    expect(bivariateUnitHtml).toContain("填色：房價（元） · 大小：公車站密度（站/km²）");
  });
});

describe("P1 rank-bar classification (docs/features/viz-library/DECISIONS.md §6)", () => {
  it("classifies a value into the same step colour a map step expression would use for it", () => {
    expect(classifyStepColor(35, choropleth.breaks, choropleth.colors)).toBe(choropleth.colors[0]);
    expect(classifyStepColor(40, choropleth.breaks, choropleth.colors)).toBe(choropleth.colors[1]); // >= a threshold moves up a class
    expect(classifyStepColor(200, choropleth.breaks, choropleth.colors)).toBe(choropleth.colors[4]); // past the last threshold
  });

  it("reads choropleth/grid/extrusion's own title/unit/valueKind, and bivariate's x-side (its fill classification, not the size y-side)", () => {
    expect(warehouseRankBarStyle(choroplethWithUnit, "dark")).toMatchObject({ title: "房價中位數", unit: "人/km²", valueKind: undefined, breaks: choropleth.breaks });
    expect(warehouseRankBarStyle(bivariateWithUnit, "dark")).toMatchObject({ title: "房價", unit: "元", valueKind: "count" });
    expect(warehouseRankBarStyle(gridFixture, "dark")).toMatchObject({ title: "格點密度", unit: "件", valueKind: "count" });
    expect(warehouseRankBarStyle(extrusionFixture, "dark")).toMatchObject({ title: "建物高度", unit: "m", valueKind: "count" });
  });

  it("picks the theme-matched palette side when the style carries one, else falls back to the flat stage-A colors array", () => {
    expect(warehouseRankBarStyle(choroplethHatch, "light").colors).toEqual(choroplethHatch.palette.light);
    expect(warehouseRankBarStyle(choropleth, "dark").colors).toEqual(choropleth.colors);
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

  it("draws the bivariate V3 size-bubble stroke width/colour from the shared viz spec, not a local constant", () => {
    const { map, layers } = stubMap();
    const bivariateStyleSpec = VIZ_SPEC.styles.bivariate;
    installAnalysisResults(map, [bivariatePolygon], 0.8, "dark");
    const darkBubble = layers.get("research-analysis-result-bivariate-size-circle-0")!;
    expect(darkBubble.paint["circle-stroke-width"]).toBe(bivariateStyleSpec.sizeStrokePx);
    expect(darkBubble.paint["circle-stroke-color"]).toBe(bivariateStyleSpec.sizeStroke.dark);
    installAnalysisResults(map, [bivariatePolygon], 0.8, "light");
    expect(layers.get("research-analysis-result-bivariate-size-circle-0")!.paint["circle-stroke-color"]).toBe(bivariateStyleSpec.sizeStroke.light);
    removeAnalysisResults(map);
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

  it("resets a leftover circle-sort-key when a slot switches out of proportional into another circle-drawn kind", () => {
    const { map, layers } = stubMap();
    installAnalysisResults(map, [proportionalPoints], 0.8, "dark");
    expect(layers.get("research-analysis-result-points-0")!.layout).toMatchObject({ "circle-sort-key": warehouseProportionalSortKey(proportional) });
    // comparePoints reuses the same slot with a plain (non-proportional) circle-drawn style; the
    // prior occupant's sort key must not linger and silently reorder this unrelated result's draw order.
    installAnalysisResults(map, [comparePoints], 0.8, "dark");
    expect(layers.get("research-analysis-result-points-0")!.layout?.["circle-sort-key"]).toBeUndefined();
    removeAnalysisResults(map);
    expect(layers.size).toBe(0);
  });

  it("draws heatmaps with a pickable close-zoom point layer that follows opacity and cleanup", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [points], 0.7);
    expect(layers.get("research-analysis-result-points-0")!.type).toBe("heatmap");
    expect(layers.get("research-analysis-result-heat-points-0")).toMatchObject({ type: "circle", minzoom: 13 });
    // Rows without a usable weight are excluded from the point layer as well as the heatmap.
    expect(layers.get("research-analysis-result-heat-points-0")!.filter).toEqual(warehouseHeatmapFilter(heatmap));
    expect(analysisResultInteractiveLayerIds(map, 1)).toEqual(["research-analysis-result-heat-points-0"]);
    setAnalysisOpacity(map, installed, "wh-4", 0.3);
    expect(layers.get("research-analysis-result-points-0")!.paint["heatmap-opacity"]).toBe(0.3);
    expect(layers.get("research-analysis-result-heat-points-0")!.paint["circle-opacity"]).toBe(0.3);
    // Reusing the slot for another heatmap recolours the point layer, not just the heatmap.
    installAnalysisResults(map, [{ ...points, resultStyle: { ...heatmap, colors: ["#ffffb2", "#123456"] } }], 0.7);
    expect(layers.get("research-analysis-result-heat-points-0")!.paint["circle-color"]).toBe("#123456");
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

// T2 A2: choropleth folded from area x period rows (map playback).
const choroplethTimed = {
  ...choropleth, ramp: "viridis", nullStyle: "hatch", palette: choroplethHatch.palette,
  timeField: "wk", idField: "town_code", periods: ["2024-03-04", "2024-03-11", "2024-03-18"], periodUnit: "week",
  seriesProperty: "_style_series", latestPeriod: "2024-03-18",
} as const satisfies WarehouseResultStyle;

// T1=L1: a non-spatial panel line chart (no map geometry).
const series = {
  kind: "series", timeField: "m", valueField: "v", baselineField: "ly", baselineLabel: "去年同期",
  title: "事故件數", unit: "件", valueKind: "count",
  periods: ["2024-01-01", "2024-02-01", "2024-03-01"], periodUnit: "month", values: [10, null, 30], baseline: [8, 20, 25],
  min: 10, max: 30, latest: { period: "2024-03-01", value: 30 }, nullCount: 1,
} as const satisfies WarehouseResultStyle;

describe("choropleth with T2 A2 map-playback fields", () => {
  it("accepts the six time keys together and rejects them alone or mismatched", () => {
    expect(validateWarehouseResultStyle(clone(choroplethTimed))).toEqual(choroplethTimed);
    expect(isTimedChoropleth(choroplethTimed)).toBe(true);
    expect(isTimedChoropleth(choropleth)).toBe(false);
    // partial: only timeField, missing the other five.
    expect(() => validateWarehouseResultStyle({ ...clone(choroplethTimed), idField: undefined, periods: undefined, periodUnit: undefined, seriesProperty: undefined, latestPeriod: undefined })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    // latestPeriod must equal periods' own last entry, not just any string.
    expect(() => validateWarehouseResultStyle({ ...clone(choroplethTimed), latestPeriod: "2024-04-01" })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    // seriesProperty is a fixed literal.
    expect(() => validateWarehouseResultStyle({ ...clone(choroplethTimed), seriesProperty: "_other" })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    // more than 104 periods is rejected (mcp MAP_MAX_PERIODS).
    const many = { ...clone(choroplethTimed), periods: Array.from({ length: 105 }, (_, index) => `${2000 + index}`), latestPeriod: "2104" };
    expect(() => validateWarehouseResultStyle(many)).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("builds a period-indexed fill-color expression and matching null filter, keyed off a flat _pN scalar (never an array read)", () => {
    // Regression: a Mapbox GeoJSON source does not reliably keep an array-valued property through
    // its own worker encoding — ["at", i, ["get", "_style_series"]] observed it as a *string* in a
    // live browser ("evaluated to string but was expected to be of type array"). Every period gets
    // its own flat scalar property instead (warehouseChoroplethPeriodProperty).
    expect(warehouseChoroplethPeriodProperty(1)).toBe("_p1");
    const color = warehouseChoroplethColorAtPeriod(choroplethTimed as WarehouseTimedChoropleth, "dark", 1);
    expect(color).toEqual(["case", ["==", ["typeof", ["get", "_p1"]], "number"],
      ["step", ["get", "_p1"], "#eff3ff", 40, "#bdd7e7", 55, "#6baed6", 70, "#3182bd", 90, "#08519c"],
      "rgba(0,0,0,0)"]);
    expect(JSON.stringify(color)).not.toContain('"at"');
    const filter = warehouseFillNullFilterAtPeriod(choroplethTimed as WarehouseTimedChoropleth, 1);
    expect(filter).toEqual(["!=", ["typeof", ["get", "_p1"]], "number"]);
  });

  it("reports one period's own value, clamping an out-of-range index rather than throwing", () => {
    const row = { _style_series: [12, 34, 56] };
    expect(warehouseChoroplethPeriodFact(choroplethTimed as WarehouseTimedChoropleth, row, 1)).toEqual({ label: "房價中位數（2024-03-11）", value: "34", period: "2024-03-11" });
    expect(warehouseChoroplethPeriodFact(choroplethTimed as WarehouseTimedChoropleth, row, 99).period).toBe("2024-03-18");
    expect(warehouseChoroplethPeriodFact(choroplethTimed as WarehouseTimedChoropleth, { _style_series: [null, 34, 56] }, 0).value).toBe("無資料");
  });

  const timedPolygon: PresentableResult = {
    resultId: "wh-6", datasetId: "warehouse:wh-6", geometry: { type: "Polygon", role: "derived", spatialAnalysisEligible: false }, resultStyle: choroplethTimed,
    rows: [
      { geometry: { type: "Polygon", coordinates: [[[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]]] }, name: "大安區", _style_value: 88, _style_series: [12, 34, 88] },
      // A short/missing series (e.g. an older cached export) must not crash the paint expression —
      // it is padded with null out to periods.length, never left as-is or dropped.
      { geometry: { type: "Polygon", coordinates: [[[121.6, 25], [121.61, 25], [121.61, 25.01], [121.6, 25]]] }, name: "信義區", _style_value: 40, _style_series: [40] },
    ],
  };

  it("expands each feature's series into flat _p0.._pN scalars (padding a short/missing one with null), never an array property on the map source", () => {
    const { map, sources } = stubMap();
    installAnalysisResults(map, [timedPolygon], 0.6, "dark");
    const data = sources.get("research-analysis-result-0")!.data as { features: { properties: Record<string, unknown> }[] };
    expect([0, 1, 2].map(index => data.features[0]!.properties[warehouseChoroplethPeriodProperty(index)])).toEqual([12, 34, 88]);
    expect([0, 1, 2].map(index => data.features[1]!.properties[warehouseChoroplethPeriodProperty(index)])).toEqual([40, null, null]);
    expect(data.features[0]!.properties).not.toHaveProperty("_style_series");
    // No property on any installed feature may be an array — that is exactly what broke Mapbox's
    // own paint-expression evaluation in a live browser.
    for (const feature of data.features) for (const value of Object.values(feature.properties)) expect(Array.isArray(value)).toBe(false);
  });

  it("re-paints an installed timed choropleth's fill and null-hatch filter to a scrubbed period, without rebuilding the source", () => {
    const { map, sources, layers } = stubMap();
    const installed = installAnalysisResults(map, [timedPolygon], 0.6, "dark");
    const before = sources.get("research-analysis-result-0")!.data;
    setAnalysisResultPeriod(map, installed, "wh-6", 0, "dark", false);
    expect(sources.get("research-analysis-result-0")!.data).toBe(before); // same object — no setData call
    expect(layers.get(layerId(0))!.paint["fill-color"]).toEqual(warehouseChoroplethColorAtPeriod(choroplethTimed as WarehouseTimedChoropleth, "dark", 0));
    expect(layers.get(nullHatchLayerId(0))!.filter).toEqual(warehouseFillNullFilterAtPeriod(choroplethTimed as WarehouseTimedChoropleth, 0));
    // Scrubbing to period 0 reads the _p0 scalar, never an "at"/array read on _style_series.
    expect(JSON.stringify(layers.get(layerId(0))!.paint["fill-color"])).toContain('"_p0"');
    expect(JSON.stringify(layers.get(layerId(0))!.paint["fill-color"])).not.toContain("_style_series");
    // Out-of-range index clamps to the last period rather than throwing.
    setAnalysisResultPeriod(map, installed, "wh-6", 999, "dark", false);
    expect(layers.get(layerId(0))!.paint["fill-color"]).toEqual(warehouseChoroplethColorAtPeriod(choroplethTimed as WarehouseTimedChoropleth, "dark", 2));
    expect(JSON.stringify(layers.get(layerId(0))!.paint["fill-color"])).toContain('"_p2"');
  });

  it("is a no-op for an outlineOnly slot (never re-enables a fill the panel turned off), or a non-timed/unknown result", () => {
    const { map, layers } = stubMap();
    const installed = installAnalysisResults(map, [timedPolygon], 0.6, "dark", { outlineOnly: ["wh-6"] });
    const before = layers.get(layerId(0))!.paint["fill-color"];
    setAnalysisResultPeriod(map, installed, "wh-6", 0, "dark", true);
    expect(layers.get(layerId(0))!.paint["fill-color"]).toEqual(before);
    setAnalysisResultPeriod(map, installed, "not-a-real-id", 0, "dark", false); // unknown id: no throw
  });
});

describe("series (T1=L1 panel line chart, no map geometry)", () => {
  it("validates a well-formed series style and round-trips it", () => {
    expect(validateWarehouseResultStyle(clone(series))).toEqual(series);
    expect(warehouseStyleFact(series, {})).toBeNull();
  });

  it("rejects a baseline/baselineField/baselineLabel that do not travel together", () => {
    expect(() => validateWarehouseResultStyle({ ...clone(series), baselineField: null })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    expect(() => validateWarehouseResultStyle({ ...clone(series), baselineLabel: null })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    expect(() => validateWarehouseResultStyle({ ...clone(series), baseline: null })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("rejects a latest period that disagrees with periods, or values/baseline of the wrong length", () => {
    expect(() => validateWarehouseResultStyle({ ...clone(series), latest: { period: "2024-02-01", value: 30 } })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    expect(() => validateWarehouseResultStyle({ ...clone(series), values: [10, 30] })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
    expect(() => validateWarehouseResultStyle({ ...clone(series), baseline: [8, 20] })).toThrow("WAREHOUSE_RESULT_STYLE_INVALID");
  });

  it("keeps the warehouse style registry key set including series, with validate-only (no color/legend/fact)", () => {
    expect(validateWarehouseResultStyle(clone({ ...series, unit: null, baselineField: null, baselineLabel: null, baseline: null }))).toMatchObject({ kind: "series" });
  });
});
