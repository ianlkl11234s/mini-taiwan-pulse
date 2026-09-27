import type { ExpressionSpecification } from "mapbox-gl";
import { VIZ_SPEC, nullHatchCssGradient, type Theme } from "./vizSpec";
import { classifyVizNumberKind, formatVizNumber } from "./vizFormat";

/**
 * Styling metadata computed by the MCP warehouse (pulse_wh_present `style`). Breaks, colours and
 * labels arrive ready-made; the browser validates their shape and applies them verbatim — it never
 * re-classifies. Features with a missing value carry null in the style property and are drawn grey
 * (or, for choropleth with `nullStyle: "hatch"`, a transparent 45° pattern — see analysisResultOverlay.ts).
 *
 * `ramp`/`palette`/`nullStyle` are optional additions (docs/features/viz-library/DECISIONS.md): the
 * server still sends the flat `colors` array (= `palette.dark`) for one release, so a style with no
 * `palette` renders exactly as before. `WAREHOUSE_STYLE_RENDERERS` is the per-kind registry (validate
 * + colour/paint + legend + fact); the exported functions below are its typed, kind-narrowed callers.
 */
export type WarehouseCompareCell = { value: number | null; notCovered: boolean; rank: number | null };
export type WarehouseCompareRow = { field: string; label: string; unit: string | null; cells: WarehouseCompareCell[] };
export type WarehouseCompareColumn = { index: number; label: string };
export type WarehousePalette = { dark: string[]; light: string[] };

export type WarehouseResultStyle =
  | { kind: "choropleth"; field: string; valueProperty: "_style_value"; method: "quantile" | "equal"; scheme: "sequential" | "diverging"; label: string; breaks: number[]; colors: string[]; labels: string[]; min: number; max: number; nullColor: string; nullCount: number; ramp?: string; palette?: WarehousePalette; nullStyle?: "hatch" }
  | { kind: "bivariate"; xField: string; yField: string; xLabel: string; yLabel: string; classProperty: "_bi_class"; xBreaks: number[]; yBreaks: number[]; classes: string[]; colors: string[]; nullColor: string; nullCount: number; ramp?: string; palette?: WarehousePalette; nullStyle?: "hatch" }
  | { kind: "heatmap"; weightField: string | null; weightProperty: "_style_weight" | null; weightMax: number | null; colors: string[]; nullCount: number; ramp?: string; palette?: WarehousePalette; nullStyle?: "hatch" }
  | { kind: "compare"; labelField: string | null; pointProperty: "_compare_index"; columns: WarehouseCompareColumn[]; rows: WarehouseCompareRow[] };

/** `hatch`/`gradient` are only set for a choropleth null entry under `nullStyle: "hatch"`; every other
 *  legend still carries a plain solid `color` swatch. */
export type WarehouseLegendNullEntry = { label: string; color: string; hatch?: true; gradient?: string };

export type WarehouseStyleLegend =
  | { kind: "choropleth"; title: string; method: string; entries: { label: string; color: string }[]; breaks: number[]; nullEntry: WarehouseLegendNullEntry }
  | { kind: "bivariate"; xLabel: string; yLabel: string; cells: { cls: string; color: string; x: number; y: number }[]; nullEntry: WarehouseLegendNullEntry }
  | { kind: "heatmap"; title: string; gradient: string; note: string; nullEntry: WarehouseLegendNullEntry | null };

const BIVARIATE_CLASSES = ["1-1", "2-1", "3-1", "1-2", "2-2", "3-2", "1-3", "2-3", "3-3"];
const FIELD = /^[\p{L}_][\p{L}\p{N}_]{0,79}$/u;
const HEX = /^#[0-9a-fA-F]{6}$/;
const STYLE_OPTIONAL_KEYS = ["ramp", "palette", "nullStyle"] as const;
const CHOROPLETH_KEYS = ["kind", "field", "valueProperty", "method", "scheme", "label", "breaks", "colors", "labels", "min", "max", "nullColor", "nullCount"];
const BIVARIATE_KEYS = ["kind", "xField", "yField", "xLabel", "yLabel", "classProperty", "xBreaks", "yBreaks", "classes", "colors", "nullColor", "nullCount"];
const HEATMAP_KEYS = ["kind", "weightField", "weightProperty", "weightMax", "colors", "nullCount"];
const COMPARE_KEYS = ["kind", "labelField", "pointProperty", "columns", "rows"];

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const field = (value: unknown): value is string => typeof value === "string" && FIELD.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 60;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const finiteList = (value: unknown, min: number, max: number): value is number[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(finite);
const colorList = (value: unknown, min: number, max: number): value is string[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => typeof item === "string" && HEX.test(item));
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5000;
const exactly = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
/** Required keys must all be present; every other key present must be one of the kind's optional additions. */
const hasOnly = (value: Record<string, unknown>, required: string[], optional: readonly string[]) => {
  const keys = Object.keys(value);
  return required.every(key => keys.includes(key)) && keys.every(key => required.includes(key) || (optional as readonly string[]).includes(key));
};
const validRamp = (value: unknown): value is string => typeof value === "string" && Object.prototype.hasOwnProperty.call(VIZ_SPEC.ramps, value);
const validPalette = (value: unknown, length: number): value is WarehousePalette => isObject(value) && exactly(value, ["dark", "light"]) && colorList(value.dark, length, length) && colorList(value.light, length, length);
/** `ramp`/`palette`/`nullStyle`, when present, must each be well-formed; `palette`'s two arrays must
 *  match `colors`' length exactly so a theme swap never changes the number of classes. */
function validOptional(value: Record<string, unknown>, colorsLength: number): boolean {
  if ("ramp" in value && !validRamp(value.ramp)) return false;
  if ("palette" in value && !validPalette(value.palette, colorsLength)) return false;
  if ("nullStyle" in value && value.nullStyle !== "hatch") return false;
  return true;
}
// A compare cell's rank is null exactly for an unranked cell (missing or not-covered); a not-covered cell
// never carries a fabricated value (e.g. a raw 0 from an uncovered dataset).
function compareCell(value: unknown, columnCount: number): value is WarehouseCompareCell {
  if (!isObject(value) || Object.keys(value).length !== 3) return false;
  if (!(value.value === null || (typeof value.value === "number" && Number.isFinite(value.value)))) return false;
  if (typeof value.notCovered !== "boolean" || (value.notCovered && value.value !== null)) return false;
  return value.value === null ? value.rank === null : Number.isInteger(value.rank) && (value.rank as number) >= 1 && (value.rank as number) <= columnCount;
}

function validateChoropleth(value: Record<string, unknown>): boolean {
  if (!hasOnly(value, CHOROPLETH_KEYS, STYLE_OPTIONAL_KEYS)) return false;
  if (!field(value.field) || value.valueProperty !== "_style_value") return false;
  if (!["quantile", "equal"].includes(value.method as string) || !["sequential", "diverging"].includes(value.scheme as string)) return false;
  if (!text(value.label)) return false;
  if (!finiteList(value.breaks, 0, 10)) return false;
  if (!value.breaks.every((item, index, all) => index === 0 || item > all[index - 1]!)) return false;
  if (!colorList(value.colors, 1, 12) || value.colors.length !== value.breaks.length + 1) return false;
  if (!Array.isArray(value.labels) || value.labels.length !== value.colors.length || !value.labels.every(text)) return false;
  if (!finite(value.min) || !finite(value.max) || value.min > value.max) return false;
  if (!colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return false;
  return validOptional(value, value.colors.length);
}

function validateBivariate(value: Record<string, unknown>): boolean {
  if (!hasOnly(value, BIVARIATE_KEYS, STYLE_OPTIONAL_KEYS)) return false;
  if (!field(value.xField) || !field(value.yField) || !text(value.xLabel) || !text(value.yLabel) || value.classProperty !== "_bi_class") return false;
  if (!finiteList(value.xBreaks, 2, 2) || !finiteList(value.yBreaks, 2, 2)) return false;
  if (!Array.isArray(value.classes) || value.classes.length !== 9 || !value.classes.every((item, index) => item === BIVARIATE_CLASSES[index])) return false;
  if (!colorList(value.colors, 9, 9) || !colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return false;
  return validOptional(value, value.colors.length);
}

function validateHeatmap(value: Record<string, unknown>): boolean {
  if (!hasOnly(value, HEATMAP_KEYS, STYLE_OPTIONAL_KEYS)) return false;
  const weighted = value.weightField !== null;
  if (weighted) {
    if (!field(value.weightField) || value.weightProperty !== "_style_weight") return false;
    if (!finite(value.weightMax) || value.weightMax < 0) return false;
  } else if (value.weightProperty !== null || value.weightMax !== null) return false;
  if (!colorList(value.colors, 2, 12) || !count(value.nullCount)) return false;
  return validOptional(value, value.colors.length);
}

function validateCompare(value: Record<string, unknown>): boolean {
  if (!exactly(value, COMPARE_KEYS)) return false;
  if ((value.labelField !== null && !field(value.labelField)) || value.pointProperty !== "_compare_index") return false;
  if (!Array.isArray(value.columns) || value.columns.length < 1 || value.columns.length > 20) return false;
  if (!value.columns.every((column, index) => isObject(column) && Object.keys(column).length === 2 && column.index === index + 1 && text(column.label))) return false;
  const columnCount = value.columns.length;
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 12) return false;
  if (!value.rows.every(row => isObject(row) && Object.keys(row).length === 4 && field(row.field) && text(row.label)
    && (row.unit === null || text(row.unit)) && Array.isArray(row.cells) && row.cells.length === columnCount
    && row.cells.every(cell => compareCell(cell, columnCount)))) return false;
  return true;
}

/** Mirrors the Gateway contract; anything else rejects the import rather than drawing a guess. */
export function validateWarehouseResultStyle(value: unknown): WarehouseResultStyle {
  const fail = (): never => { throw new Error("WAREHOUSE_RESULT_STYLE_INVALID"); };
  if (!isObject(value)) return fail();
  if (value.kind === "choropleth") return validateChoropleth(value) ? (value as WarehouseResultStyle) : fail();
  if (value.kind === "bivariate") return validateBivariate(value) ? (value as WarehouseResultStyle) : fail();
  if (value.kind === "heatmap") return validateHeatmap(value) ? (value as WarehouseResultStyle) : fail();
  if (value.kind === "compare") return validateCompare(value) ? (value as WarehouseResultStyle) : fail();
  return fail();
}

/** `palette[theme]` when the server sent one, otherwise the flat (pre-theme) `colors` array. */
function resolvePalette(style: { colors: string[]; palette?: WarehousePalette }, theme: Theme): string[] {
  return style.palette ? style.palette[theme] : style.colors;
}

/** A choropleth-null feature (missing `_style_value`), used to draw the hatch overlay layer over
 *  exactly the same features the colour expression leaves transparent. */
export function warehouseChoroplethNullFilter(style: Extract<WarehouseResultStyle, { kind: "choropleth" }>): ExpressionSpecification {
  return ["!=", ["typeof", ["get", style.valueProperty]], "number"] as unknown as ExpressionSpecification;
}

function choroplethColor(style: Extract<WarehouseResultStyle, { kind: "choropleth" }>, theme: Theme): ExpressionSpecification {
  const colors = resolvePalette(style, theme);
  const value = ["get", style.valueProperty];
  const scale: unknown = style.breaks.length === 0 ? colors[0]! : ["step", value, colors[0]!, ...style.breaks.flatMap((threshold, index) => [threshold, colors[index + 1]!])];
  // Under nullStyle "hatch" the pattern layer (analysisResultOverlay.ts) owns the null pixels; this
  // layer leaves them fully transparent instead of painting a solid grey underneath the hatch.
  const nullColor = style.nullStyle === "hatch" ? "rgba(0,0,0,0)" : style.nullColor;
  return ["case", ["==", ["typeof", value], "number"], scale, nullColor] as unknown as ExpressionSpecification;
}

function bivariateColor(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, theme: Theme): ExpressionSpecification {
  const colors = resolvePalette(style, theme);
  return ["match", ["coalesce", ["get", style.classProperty], ""], ...style.classes.flatMap((cls, index) => [cls, colors[index]!]), style.nullColor] as unknown as ExpressionSpecification;
}

/** Heatmap paint; missing weights are filtered out by warehouseHeatmapFilter, never weighted as 0. */
function heatmapPaint(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, opacity: number, theme: Theme): Record<string, unknown> {
  const colors = resolvePalette(style, theme);
  const stops = colors.flatMap((color, index) => [(index + 1) / colors.length, color]);
  const weight = style.weightProperty && style.weightMax && style.weightMax > 0 ? ["/", ["get", style.weightProperty], style.weightMax] : 1;
  return {
    "heatmap-weight": weight,
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 15, 3],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 15, 28],
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", ...stops],
    "heatmap-opacity": opacity,
  };
}

function heatmapFilter(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>): ExpressionSpecification | null {
  return style.weightProperty ? ["==", ["typeof", ["get", style.weightProperty]], "number"] as unknown as ExpressionSpecification : null;
}

/** Solid swatch for every kind except a choropleth's hatch null entry, which carries a CSS gradient
 *  matching the map-side pattern (vizNullPattern.ts) instead of a flat colour. */
function nullEntry(style: Exclude<WarehouseResultStyle, { kind: "compare" }>, theme: Theme): WarehouseLegendNullEntry {
  const label = `無資料／未涵蓋（${style.nullCount}）`;
  if (style.kind === "choropleth" && style.nullStyle === "hatch") return { label, color: "transparent", hatch: true, gradient: nullHatchCssGradient(theme) };
  return { label, color: style.kind === "heatmap" ? "#bdbdbd" : style.nullColor };
}

function choroplethLegend(style: Extract<WarehouseResultStyle, { kind: "choropleth" }>, theme: Theme): WarehouseStyleLegend {
  const colors = resolvePalette(style, theme);
  return { kind: "choropleth", title: style.label, method: style.method === "quantile" ? "分位數分級" : "等距分級", entries: style.labels.map((label, index) => ({ label, color: colors[index]! })), breaks: style.breaks, nullEntry: nullEntry(style, theme) };
}

function bivariateLegend(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, theme: Theme): WarehouseStyleLegend {
  const colors = resolvePalette(style, theme);
  return { kind: "bivariate", xLabel: style.xLabel, yLabel: style.yLabel, cells: style.classes.map((cls, index) => ({ cls, color: colors[index]!, x: Number(cls[0]), y: Number(cls[2]) })), nullEntry: nullEntry(style, theme) };
}

function heatmapLegend(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, theme: Theme): WarehouseStyleLegend {
  const colors = resolvePalette(style, theme);
  return {
    kind: "heatmap", title: style.weightField ? `密度（依 ${style.weightField} 加權）` : "點位密度",
    gradient: `linear-gradient(to right, ${colors.join(", ")})`, note: "顏色越深代表鄰近點位越密集；縮放時會重新計算，並非絕對數值。",
    nullEntry: style.weightField && style.nullCount > 0 ? { label: `權重缺值未計入（${style.nullCount}）`, color: "#bdbdbd" } : null,
  };
}

/** Number display for a raw feature value: `formatVizNumber` under a conservative kind guess (spec
 *  U1). No ResultStyle field declares an explicit value kind yet, so this never has a unit to lean on
 *  for choropleth/bivariate; a compare row's own `unit` (if any) is passed in by its caller. */
const show = (value: unknown, unit: string | null = null): string => {
  if (typeof value === "number" && Number.isFinite(value)) return formatVizNumber(value, classifyVizNumberKind(value, unit));
  return typeof value === "string" && value.trim() ? value : "無資料";
};

function choroplethFact(style: Extract<WarehouseResultStyle, { kind: "choropleth" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  return { label: style.label, value: show(properties[style.valueProperty]) };
}

function bivariateFact(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  const cls = properties[style.classProperty];
  return { label: `${style.xLabel} × ${style.yLabel}`, value: `${show(properties[style.xField])} / ${show(properties[style.yField])}${typeof cls === "string" ? `（類別 ${cls}）` : "（無資料）"}` };
}

function heatmapFact(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  return style.weightField && style.weightProperty ? { label: style.weightField, value: show(properties[style.weightProperty]) } : null;
}

function compareFact(style: Extract<WarehouseResultStyle, { kind: "compare" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  const index = properties[style.pointProperty];
  const column = typeof index === "number" ? style.columns.find(candidate => candidate.index === index) : undefined;
  if (!column) return null;
  const parts = style.rows.map(row => {
    const cell = row.cells[(index as number) - 1];
    const kind = cell && cell.value !== null ? classifyVizNumberKind(cell.value, row.unit) : null;
    const cellValue = !cell || cell.notCovered ? "未涵蓋" : cell.value === null ? "無資料" : `${show(cell.value, row.unit)}${row.unit && kind !== "percent" ? ` ${row.unit}` : ""}${cell.rank !== null ? `（第 ${cell.rank}）` : ""}`;
    return `${row.label}: ${cellValue}`;
  });
  return { label: column.label, value: parts.join("；") };
}

/** Per-kind registry: validate + colour/paint + legend + fact. The exported functions below are its
 *  typed, kind-narrowed callers — kept so existing call sites never need to touch a registry directly. */
export const WAREHOUSE_STYLE_RENDERERS = {
  choropleth: { validate: validateChoropleth, color: choroplethColor, legend: choroplethLegend, fact: choroplethFact },
  bivariate: { validate: validateBivariate, color: bivariateColor, legend: bivariateLegend, fact: bivariateFact },
  heatmap: { validate: validateHeatmap, paint: heatmapPaint, filter: heatmapFilter, legend: heatmapLegend, fact: heatmapFact },
  compare: { validate: validateCompare, fact: compareFact },
} as const;

/** Fill / circle colour: `step` over the server breaks for choropleth, `match` on _bi_class for bivariate. */
export function warehouseStyleColor(style: Exclude<WarehouseResultStyle, { kind: "heatmap" | "compare" }>, theme: Theme = "dark"): ExpressionSpecification {
  return style.kind === "choropleth" ? WAREHOUSE_STYLE_RENDERERS.choropleth.color(style, theme) : WAREHOUSE_STYLE_RENDERERS.bivariate.color(style, theme);
}

export function warehouseHeatmapPaint(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, opacity: number, theme: Theme = "dark"): Record<string, unknown> {
  return WAREHOUSE_STYLE_RENDERERS.heatmap.paint(style, opacity, theme);
}

export function warehouseHeatmapFilter(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>): ExpressionSpecification | null {
  return WAREHOUSE_STYLE_RENDERERS.heatmap.filter(style);
}

/** compare has no colour legend (rendered as a table instead); callers exclude it before reaching here. */
export function warehouseStyleLegend(style: Exclude<WarehouseResultStyle, { kind: "compare" }>, theme: Theme = "dark"): WarehouseStyleLegend {
  if (style.kind === "choropleth") return WAREHOUSE_STYLE_RENDERERS.choropleth.legend(style, theme);
  if (style.kind === "bivariate") return WAREHOUSE_STYLE_RENDERERS.bivariate.legend(style, theme);
  return WAREHOUSE_STYLE_RENDERERS.heatmap.legend(style, theme);
}

/** One popup fact describing the styled value of a feature (null stays "無資料", never 0). */
export function warehouseStyleFact(style: WarehouseResultStyle, properties: Record<string, unknown>): { label: string; value: string } | null {
  if (style.kind === "choropleth") return WAREHOUSE_STYLE_RENDERERS.choropleth.fact(style, properties);
  if (style.kind === "bivariate") return WAREHOUSE_STYLE_RENDERERS.bivariate.fact(style, properties);
  if (style.kind === "heatmap") return WAREHOUSE_STYLE_RENDERERS.heatmap.fact(style, properties);
  return WAREHOUSE_STYLE_RENDERERS.compare.fact(style, properties);
}
