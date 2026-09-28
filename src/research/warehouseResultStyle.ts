import type { ExpressionSpecification } from "mapbox-gl";
import { VIZ_SPEC, categoricalFor, nullHatchCssGradient, type Theme } from "./vizSpec";
import { classifyVizNumberKind, formatVizNumber, type VizNumberKind } from "./vizFormat";

/**
 * Styling metadata computed by the MCP warehouse (pulse_wh_present `style`). Breaks, colours and
 * labels arrive ready-made; the browser validates their shape and applies them verbatim — it never
 * re-classifies. Features with a missing value carry null in the style property and are drawn grey
 * (or, for choropleth/bivariate with `nullStyle: "hatch"`, a transparent 45° pattern — see
 * analysisResultOverlay.ts).
 *
 * Stage A (choropleth/heatmap): `ramp`/`palette`/`nullStyle` are optional additions — the server
 * still sends the flat `colors` array (= `palette.dark`) for one release, so a style with no
 * `palette` renders exactly as before; `valueKind` is likewise optional (absent -> a conservative
 * guess from the value's own shape, see `classifyVizNumberKind`).
 *
 * Stage B: `bivariate` is a hard breaking replacement (the old 3x3 `_bi_class` categorical grid is
 * gone; a style in that shape is now rejected, not rendered) and `proportional` is a brand-new kind.
 * Both always carry `ramp`/`palette`/`nullStyle`/their `*ValueKind` fields; their own optional-key
 * tolerance is for the later `*Unit`/`*Title` display-metadata addition below, not for staying
 * compatible with any pre-existing format.
 *
 * `WAREHOUSE_STYLE_RENDERERS` is the per-kind registry (validate + colour/paint + legend + fact);
 * the exported functions below are its typed, kind-narrowed callers.
 */
export type WarehouseCompareCell = { value: number | null; notCovered: boolean; rank: number | null };
export type WarehouseCompareRow = { field: string; label: string; unit: string | null; cells: WarehouseCompareCell[] };
export type WarehouseCompareColumn = { index: number; label: string };
export type WarehousePalette = { dark: string[]; light: string[] };
export type WarehouseSizeLegendEntry = { value: number; radiusPx: number; label: string };

export type WarehouseResultStyle =
  | { kind: "choropleth"; field: string; valueProperty: "_style_value"; method: "quantile" | "equal"; scheme: "sequential" | "diverging"; label: string; breaks: number[]; colors: string[]; labels: string[]; min: number; max: number; nullColor: string; nullCount: number; ramp?: string; palette?: WarehousePalette; nullStyle?: "hatch"; valueKind?: VizNumberKind; unit?: string | null }
  | {
      kind: "bivariate"; mode: "fill-and-size"; xField: string; yField: string; xLabel: string; yLabel: string;
      xValueKind: VizNumberKind; yValueKind: VizNumberKind;
      valueProperty: "_style_value"; sizeValueProperty: "_size_value"; sizeRadiusProperty: "_size_radius"; sizeRankProperty: "_size_rank"; sizeAnchorProperty: "_size_anchor";
      ramp: string; palette: WarehousePalette; breaks: number[]; labels: string[]; min: number; max: number;
      rMinPx: number; rMaxPx: number; topN: number;
      nullStyle: "hatch"; nullColor: string; nullCount: number;
      xUnit?: string | null; yUnit?: string | null;
    }
  | { kind: "heatmap"; weightField: string | null; weightProperty: "_style_weight" | null; weightMax: number | null; colors: string[]; nullCount: number; ramp?: string; palette?: WarehousePalette; nullStyle?: "hatch" }
  | { kind: "compare"; labelField: string | null; pointProperty: "_compare_index"; columns: WarehouseCompareColumn[]; rows: WarehouseCompareRow[] }
  | {
      kind: "proportional"; sizeField: string; colorField: string | null; labelField: string | null;
      sizeValueProperty: "_size_value"; sizeRadiusProperty: "_size_radius"; labelRankProperty: "_label_rank"; valueProperty: "_style_value" | null;
      sizeValueKind: VizNumberKind; colorValueKind: VizNumberKind;
      rMinPx: number; rMaxPx: number; fillOpacity: number; ringPx: number; labelTopN: number; drawOrder: "largest-first";
      ramp: string; palette: WarehousePalette; breaks: number[]; labels: string[]; min: number | null; max: number | null;
      nullStyle: "hatch"; nullColor: string; nullCount: number;
      sizeLegend: WarehouseSizeLegendEntry[];
      sizeTitle?: string; sizeUnit?: string | null; colorTitle?: string | null; colorUnit?: string | null;
    };

/** `hatch`/`gradient` are only set for a fill (choropleth/bivariate) null entry under
 *  `nullStyle: "hatch"`; every other legend still carries a plain solid `color` swatch. */
export type WarehouseLegendNullEntry = { label: string; color: string; hatch?: true; gradient?: string };

export type WarehouseStyleLegend =
  | { kind: "choropleth"; title: string; method: string; entries: { label: string; color: string }[]; breaks: number[]; nullEntry: WarehouseLegendNullEntry }
  | { kind: "bivariate"; xLabel: string; yLabel: string; fillEntries: { label: string; color: string }[]; fillBreaks: number[]; sizeLegend: WarehouseSizeLegendEntry[]; nullEntry: WarehouseLegendNullEntry }
  | { kind: "heatmap"; title: string; gradient: string; note: string; nullEntry: WarehouseLegendNullEntry | null }
  | { kind: "proportional"; sizeLabel: string; sizeLegend: WarehouseSizeLegendEntry[]; colorLegend: { title: string; entries: { label: string; color: string }[]; nullEntry: WarehouseLegendNullEntry } | null; excludedNote: string | null };

const FIELD = /^[\p{L}_][\p{L}\p{N}_]{0,79}$/u;
const HEX = /^#[0-9a-fA-F]{6}$/;
const NUMBER_FORMAT_KINDS = ["count", "density", "ratio", "percent"] as const;
const STYLE_OPTIONAL_KEYS = ["ramp", "palette", "nullStyle"] as const;
const CHOROPLETH_OPTIONAL_KEYS = [...STYLE_OPTIONAL_KEYS, "valueKind", "unit"] as const;
const CHOROPLETH_KEYS = ["kind", "field", "valueProperty", "method", "scheme", "label", "breaks", "colors", "labels", "min", "max", "nullColor", "nullCount"];
const BIVARIATE_KEYS = ["kind", "mode", "xField", "yField", "xLabel", "yLabel", "xValueKind", "yValueKind", "valueProperty", "sizeValueProperty", "sizeRadiusProperty", "sizeRankProperty", "sizeAnchorProperty", "ramp", "palette", "breaks", "labels", "min", "max", "rMinPx", "rMaxPx", "topN", "nullStyle", "nullColor", "nullCount"];
/** Optional display-unit metadata the mcp warehouse may attach; a style omitting them renders
 *  exactly as before. Titles are not part of this addition — choropleth/bivariate keep using their
 *  existing `label`/`xLabel`/`yLabel` fields verbatim (no title override). */
const BIVARIATE_UNIT_KEYS = ["xUnit", "yUnit"] as const;
const HEATMAP_KEYS = ["kind", "weightField", "weightProperty", "weightMax", "colors", "nullCount"];
const COMPARE_KEYS = ["kind", "labelField", "pointProperty", "columns", "rows"];
const PROPORTIONAL_KEYS = ["kind", "sizeField", "colorField", "labelField", "sizeValueProperty", "sizeRadiusProperty", "labelRankProperty", "valueProperty", "sizeValueKind", "colorValueKind", "rMinPx", "rMaxPx", "fillOpacity", "ringPx", "labelTopN", "drawOrder", "ramp", "palette", "breaks", "labels", "min", "max", "nullStyle", "nullColor", "nullCount", "sizeLegend"];
/** proportional's own title metadata: `sizeTitle` falls back to `sizeField` (never null — the size
 *  field always exists), `colorTitle` falls back to `colorField` (nullable — a monochrome
 *  proportional has no colorField to title at all). */
const PROPORTIONAL_TITLE_UNIT_KEYS = ["sizeTitle", "sizeUnit", "colorTitle", "colorUnit"] as const;

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const field = (value: unknown): value is string => typeof value === "string" && FIELD.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 60;
/** proportional's `sizeTitle`: absent (falls back to `sizeField`) or a short non-empty string —
 *  never `null` (unlike `colorTitle`, `sizeField` always exists, so there is no "no field to title"
 *  case here). */
const optionalTitle = (value: unknown): boolean => value === undefined || (typeof value === "string" && value.trim().length > 0 && value.length <= 40);
/** `colorTitle`: absent, explicitly `null` (no colorField to title), or a short non-empty string. */
const optionalNullableTitle = (value: unknown): boolean => value === undefined || value === null || (typeof value === "string" && value.trim().length > 0 && value.length <= 40);
/** Any `*Unit` field: absent, explicitly `null`, or a short non-empty string. */
const optionalUnit = (value: unknown): boolean => value === undefined || value === null || (typeof value === "string" && value.trim().length > 0 && value.length <= 16);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const finiteList = (value: unknown, min: number, max: number): value is number[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(finite);
const colorList = (value: unknown, min: number, max: number): value is string[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => typeof item === "string" && HEX.test(item));
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5000;
const intRange = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const exactly = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
/** Required keys must all be present; every other key present must be one of the kind's optional additions. */
const hasOnly = (value: Record<string, unknown>, required: string[], optional: readonly string[]) => {
  const keys = Object.keys(value);
  return required.every(key => keys.includes(key)) && keys.every(key => required.includes(key) || (optional as readonly string[]).includes(key));
};
const validRamp = (value: unknown): value is string => typeof value === "string" && Object.prototype.hasOwnProperty.call(VIZ_SPEC.ramps, value);
const validPalette = (value: unknown, length: number): value is WarehousePalette => isObject(value) && exactly(value, ["dark", "light"]) && colorList(value.dark, length, length) && colorList(value.light, length, length);
const validNumberFormatKind = (value: unknown): value is VizNumberKind => typeof value === "string" && (NUMBER_FORMAT_KINDS as readonly string[]).includes(value);
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
function validSizeLegend(value: unknown, maxLength: number): value is WarehouseSizeLegendEntry[] {
  return Array.isArray(value) && value.length <= maxLength && value.every(entry => isObject(entry) && Object.keys(entry).length === 3 && finite(entry.value) && finite(entry.radiusPx) && text(entry.label));
}

function validateChoropleth(value: Record<string, unknown>): boolean {
  if (!hasOnly(value, CHOROPLETH_KEYS, CHOROPLETH_OPTIONAL_KEYS)) return false;
  if (!field(value.field) || value.valueProperty !== "_style_value") return false;
  if (!["quantile", "equal"].includes(value.method as string) || !["sequential", "diverging"].includes(value.scheme as string)) return false;
  if (!text(value.label)) return false;
  if (!finiteList(value.breaks, 0, 10)) return false;
  if (!value.breaks.every((item, index, all) => index === 0 || item > all[index - 1]!)) return false;
  if (!colorList(value.colors, 1, 12) || value.colors.length !== value.breaks.length + 1) return false;
  if (!Array.isArray(value.labels) || value.labels.length !== value.colors.length || !value.labels.every(text)) return false;
  if (!finite(value.min) || !finite(value.max) || value.min > value.max) return false;
  if (!colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return false;
  if (!validOptional(value, value.colors.length)) return false;
  if ("valueKind" in value && !validNumberFormatKind(value.valueKind)) return false;
  if ("unit" in value && !optionalUnit(value.unit)) return false;
  return true;
}

/** V3: a choropleth-style quantile/viridis fill on `xField` (`_style_value`) plus a sqrt-scaled
 *  bubble size on `yField`'s top `topN` points (`_size_value`/`_size_radius`/`_size_rank`, each
 *  carrying a precomputed anchor point `_size_anchor`). Replaces the old 9-colour `_bi_class` grid
 *  entirely — a style in that shape is rejected, not rendered. */
function validateBivariate(value: Record<string, unknown>): boolean {
  if (!hasOnly(value, BIVARIATE_KEYS, BIVARIATE_UNIT_KEYS)) return false;
  if (value.mode !== "fill-and-size") return false;
  if (!field(value.xField) || !field(value.yField) || !text(value.xLabel) || !text(value.yLabel)) return false;
  if (!validNumberFormatKind(value.xValueKind) || !validNumberFormatKind(value.yValueKind)) return false;
  if (value.valueProperty !== "_style_value" || value.sizeValueProperty !== "_size_value" || value.sizeRadiusProperty !== "_size_radius" || value.sizeRankProperty !== "_size_rank" || value.sizeAnchorProperty !== "_size_anchor") return false;
  if (!validRamp(value.ramp)) return false;
  if (!finiteList(value.breaks, 0, 10)) return false;
  if (!value.breaks.every((item, index, all) => index === 0 || item > all[index - 1]!)) return false;
  if (!validPalette(value.palette, value.breaks.length + 1)) return false;
  if (!Array.isArray(value.labels) || value.labels.length !== value.breaks.length + 1 || !value.labels.every(text)) return false;
  if (!finite(value.min) || !finite(value.max) || value.min > value.max) return false;
  if (!finite(value.rMinPx) || value.rMinPx < 0 || !finite(value.rMaxPx) || value.rMaxPx < value.rMinPx) return false;
  if (!intRange(value.topN, 1, 50)) return false;
  if (value.nullStyle !== "hatch") return false;
  if (!colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return false;
  if ("xUnit" in value && !optionalUnit(value.xUnit)) return false;
  if ("yUnit" in value && !optionalUnit(value.yUnit)) return false;
  return true;
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

/** Proportional-symbol map: circle radius from `sizeField` (sqrt-scaled, precomputed as
 *  `_size_radius`); colour optionally classified from `colorField` the same way as choropleth, or a
 *  flat monochrome swatch (`palette` length 1) when there is no `colorField`. */
function validateProportional(value: Record<string, unknown>): boolean {
  if (!hasOnly(value, PROPORTIONAL_KEYS, PROPORTIONAL_TITLE_UNIT_KEYS)) return false;
  if (!field(value.sizeField)) return false;
  if (value.colorField !== null && !field(value.colorField)) return false;
  if (value.labelField !== null && !field(value.labelField)) return false;
  if (value.sizeValueProperty !== "_size_value" || value.sizeRadiusProperty !== "_size_radius" || value.labelRankProperty !== "_label_rank") return false;
  if (value.valueProperty !== null && value.valueProperty !== "_style_value") return false;
  if (!validNumberFormatKind(value.sizeValueKind) || !validNumberFormatKind(value.colorValueKind)) return false;
  if (!finite(value.rMinPx) || value.rMinPx < 0 || !finite(value.rMaxPx) || value.rMaxPx < value.rMinPx) return false;
  if (!finite(value.fillOpacity) || value.fillOpacity < 0 || value.fillOpacity > 1) return false;
  if (!finite(value.ringPx) || value.ringPx < 0) return false;
  if (!intRange(value.labelTopN, 0, 50)) return false;
  if (value.drawOrder !== "largest-first") return false;
  if (!validRamp(value.ramp)) return false;
  if (!finiteList(value.breaks, 0, 10)) return false;
  if (!value.breaks.every((item, index, all) => index === 0 || item > all[index - 1]!)) return false;
  const colored = value.colorField !== null;
  if (!colored && value.breaks.length !== 0) return false;
  if (!validPalette(value.palette, colored ? value.breaks.length + 1 : 1)) return false;
  if (!Array.isArray(value.labels) || value.labels.length !== (colored ? value.breaks.length + 1 : 0) || !value.labels.every(text)) return false;
  if (colored) { if (!finite(value.min) || !finite(value.max) || value.min > value.max) return false; }
  else if (value.min !== null || value.max !== null) return false;
  if (value.nullStyle !== "hatch") return false;
  if (!colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return false;
  if (!validSizeLegend(value.sizeLegend, 10)) return false;
  if ("sizeTitle" in value && !optionalTitle(value.sizeTitle)) return false;
  if ("sizeUnit" in value && !optionalUnit(value.sizeUnit)) return false;
  if ("colorTitle" in value && !optionalNullableTitle(value.colorTitle)) return false;
  if ("colorUnit" in value && !optionalUnit(value.colorUnit)) return false;
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
  if (value.kind === "proportional") return validateProportional(value) ? (value as WarehouseResultStyle) : fail();
  return fail();
}

/** `palette[theme]` when the server sent one, otherwise the flat (pre-theme) `colors` array. Only
 *  choropleth/heatmap ever lack a palette (stage-A backward compatibility); bivariate/proportional
 *  always carry one. */
function resolvePalette(style: { colors: string[]; palette?: WarehousePalette }, theme: Theme): string[] {
  return style.palette ? style.palette[theme] : style.colors;
}

/** A choropleth/bivariate-null feature (missing `_style_value`), used to draw the hatch overlay
 *  layer over exactly the same features the colour expression leaves transparent. Both kinds share
 *  the same `valueProperty` name and null semantics. */
export function warehouseFillNullFilter(style: Extract<WarehouseResultStyle, { kind: "choropleth" | "bivariate" }>): ExpressionSpecification {
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

/** V3 fill colour: identical shape to choroplethColor, but nullStyle is always "hatch" (no legacy
 *  solid-grey fallback ever exists for this kind). */
function bivariateFillColor(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, theme: Theme): ExpressionSpecification {
  const colors = style.palette[theme];
  const value = ["get", style.valueProperty];
  const scale: unknown = style.breaks.length === 0 ? colors[0]! : ["step", value, colors[0]!, ...style.breaks.flatMap((threshold, index) => [threshold, colors[index + 1]!])];
  return ["case", ["==", ["typeof", value], "number"], scale, "rgba(0,0,0,0)"] as unknown as ExpressionSpecification;
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

/** Proportional circle colour: a flat monochrome swatch (no colorField), or a choropleth-style step
 *  expression falling back to the categorical "other" colour (never a hatch — a point has no area to
 *  hatch) for a feature that has a size but no usable colour value. */
function proportionalCircleColor(style: Extract<WarehouseResultStyle, { kind: "proportional" }>, theme: Theme): string | ExpressionSpecification {
  if (!style.colorField || !style.valueProperty) return style.palette[theme][0]!;
  const colors = style.palette[theme];
  const value = ["get", style.valueProperty];
  const scale: unknown = style.breaks.length === 0 ? colors[0]! : ["step", value, colors[0]!, ...style.breaks.flatMap((threshold, index) => [threshold, colors[index + 1]!])];
  return ["case", ["==", ["typeof", value], "number"], scale, categoricalFor(theme).other] as unknown as ExpressionSpecification;
}

/** A feature is drawn only when the server actually gave it a radius (v <= 0 / missing size is
 *  excluded entirely, never shown as a zero-radius dot). */
export function warehouseProportionalSizeFilter(style: Extract<WarehouseResultStyle, { kind: "proportional" }>): ExpressionSpecification {
  return ["==", ["typeof", ["get", style.sizeRadiusProperty]], "number"] as unknown as ExpressionSpecification;
}

/** Only the server's top `labelTopN` points carry a rank; every other feature is left unlabelled. */
export function warehouseProportionalLabelFilter(style: Extract<WarehouseResultStyle, { kind: "proportional" }>): ExpressionSpecification {
  return ["==", ["typeof", ["get", style.labelRankProperty]], "number"] as unknown as ExpressionSpecification;
}

/** Larger circles get a lower (more negative) sort key, so they draw first / sit underneath smaller
 *  ones — "the big ones drawn first" (M3 draw order). */
export function warehouseProportionalSortKey(style: Extract<WarehouseResultStyle, { kind: "proportional" }>): ExpressionSpecification {
  return ["-", 0, ["get", style.sizeRadiusProperty]] as unknown as ExpressionSpecification;
}

/** Legend/popup label (spec G2 "標題＝指標＋單位"): a unit, when present, appends after the label
 *  in parens. `title` is the label text to use verbatim — choropleth/bivariate always pass their
 *  existing `label`/`xLabel`/`yLabel`; only proportional's `sizeTitle`/`colorTitle` can override the
 *  field name before reaching here (see proportionalLegend/proportionalFact). */
function titleWithUnit(title: string, unit: string | null | undefined): string {
  return unit ? `${title}（${unit}）` : title;
}

/** Appends a server-declared unit after a formatted popup value (spec N1 "有單位必寫"), e.g.
 *  "27,450 人/km²". Skipped for a "%" unit — a percent-kind value already carries its own trailing
 *  "%" from formatVizNumber, so appending again would double it. */
function withUnit(valueText: string, unit: string | null | undefined): string {
  return unit && unit !== "%" ? `${valueText} ${unit}` : valueText;
}

/** Solid swatch for choropleth/heatmap; a choropleth's hatch null entry instead carries a CSS
 *  gradient matching the map-side pattern (vizNullPattern.ts). Bivariate/proportional build their
 *  own null entries inline (different semantics — see bivariateLegend/proportionalLegend). */
function nullEntry(style: Extract<WarehouseResultStyle, { kind: "choropleth" | "heatmap" }>, theme: Theme): WarehouseLegendNullEntry {
  const label = `無資料／未涵蓋（${style.nullCount}）`;
  if (style.kind === "choropleth" && style.nullStyle === "hatch") return { label, color: "transparent", hatch: true, gradient: nullHatchCssGradient(theme) };
  return { label, color: style.kind === "heatmap" ? "#bdbdbd" : style.nullColor };
}

function choroplethLegend(style: Extract<WarehouseResultStyle, { kind: "choropleth" }>, theme: Theme): WarehouseStyleLegend {
  const colors = resolvePalette(style, theme);
  return { kind: "choropleth", title: titleWithUnit(style.label, style.unit), method: style.method === "quantile" ? "分位數分級" : "等距分級", entries: style.labels.map((label, index) => ({ label, color: colors[index]! })), breaks: style.breaks, nullEntry: nullEntry(style, theme) };
}

/** The y-axis size legend needs 3 *actually drawn* reference points (their real `_size_value`/
 *  `_size_radius` pair), not a recomputed nice-number scale — that guarantees the legend circle
 *  matches a real bubble on the map pixel-for-pixel. Picks the largest, smallest and one in the
 *  middle among the ranked (top-N sized) rows; degrades gracefully with fewer. */
function bivariateSizeLegendFromRows(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, rows: readonly Record<string, unknown>[]): WarehouseSizeLegendEntry[] {
  const sized = rows
    .map(row => ({ value: row[style.sizeValueProperty], radius: row[style.sizeRadiusProperty], rank: row[style.sizeRankProperty] }))
    .filter((entry): entry is { value: number; radius: number; rank: number } => finite(entry.value) && finite(entry.radius) && Number.isInteger(entry.rank))
    .sort((a, b) => a.rank - b.rank);
  if (!sized.length) return [];
  const indexes = sized.length >= 3 ? [0, Math.floor((sized.length - 1) / 2), sized.length - 1] : sized.length === 2 ? [0, 1] : [0];
  return [...new Set(indexes)].map(index => {
    const entry = sized[index]!;
    return { value: entry.value, radiusPx: entry.radius, label: formatVizNumber(entry.value, style.yValueKind) };
  });
}

function bivariateLegend(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, theme: Theme, rows: readonly Record<string, unknown>[]): WarehouseStyleLegend {
  const colors = style.palette[theme];
  return {
    kind: "bivariate", xLabel: titleWithUnit(style.xLabel, style.xUnit), yLabel: titleWithUnit(style.yLabel, style.yUnit),
    fillEntries: style.labels.map((label, index) => ({ label, color: colors[index]! })), fillBreaks: style.breaks,
    sizeLegend: bivariateSizeLegendFromRows(style, rows),
    nullEntry: { label: `無資料／未涵蓋（${style.nullCount}）`, color: "transparent", hatch: true, gradient: nullHatchCssGradient(theme) },
  };
}

function heatmapLegend(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, theme: Theme): WarehouseStyleLegend {
  const colors = resolvePalette(style, theme);
  return {
    kind: "heatmap", title: style.weightField ? `密度（依 ${style.weightField} 加權）` : "點位密度",
    gradient: `linear-gradient(to right, ${colors.join(", ")})`, note: "顏色越深代表鄰近點位越密集；縮放時會重新計算，並非絕對數值。",
    nullEntry: style.weightField && style.nullCount > 0 ? { label: `權重缺值未計入（${style.nullCount}）`, color: "#bdbdbd" } : null,
  };
}

function proportionalLegend(style: Extract<WarehouseResultStyle, { kind: "proportional" }>, theme: Theme): WarehouseStyleLegend {
  const colorLegend = style.colorField ? {
    title: titleWithUnit(style.colorTitle ?? style.colorField, style.colorUnit),
    entries: style.labels.map((label, index) => ({ label, color: style.palette[theme][index]! })),
    nullEntry: { label: "無資料", color: categoricalFor(theme).other },
  } : null;
  const sizeLabel = style.sizeTitle ?? style.sizeField;
  return {
    kind: "proportional", sizeLabel: titleWithUnit(sizeLabel, style.sizeUnit), sizeLegend: style.sizeLegend, colorLegend,
    excludedNote: style.nullCount > 0 ? `另有 ${style.nullCount} 筆缺少可用的「${sizeLabel}」數值，未顯示` : null,
  };
}

/** Number display for a raw feature value: an explicit server `kind` wins when given (e.g. a
 *  choropleth's `valueKind`); otherwise a conservative guess from the unit text and the value's own
 *  shape (spec U1, see classifyVizNumberKind) — the only path left for a style with no *ValueKind
 *  field (a stage-A choropleth/heatmap from before this rollout). */
const show = (value: unknown, unit: string | null = null, kind?: VizNumberKind): string => {
  if (typeof value === "number" && Number.isFinite(value)) return formatVizNumber(value, kind ?? classifyVizNumberKind(value, unit));
  return typeof value === "string" && value.trim() ? value : "無資料";
};

function choroplethFact(style: Extract<WarehouseResultStyle, { kind: "choropleth" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  return { label: style.label, value: withUnit(show(properties[style.valueProperty], null, style.valueKind), style.unit) };
}

function bivariateFact(style: Extract<WarehouseResultStyle, { kind: "bivariate" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  const x = properties[style.valueProperty];
  const yRanked = properties[style.sizeValueProperty];
  const yRaw = properties[style.yField];
  const xText = withUnit(show(x, null, style.xValueKind), style.xUnit);
  // A point outside the top-N sized points keeps no _size_value; fall back to its raw y field so
  // the popup still shows a real number rather than "無資料" just because it wasn't bubble-sized.
  const yText = withUnit(typeof yRanked === "number" ? show(yRanked, null, style.yValueKind) : show(yRaw, null, style.yValueKind), style.yUnit);
  return { label: `${style.xLabel} × ${style.yLabel}`, value: `${xText} / ${yText}` };
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

/** Popup fact order (spec §4 proportional): size (+kind) -> colour (+kind, when present) -> rank.
 *  No unit metadata exists on this style (unlike compare's per-row `unit`), so none is appended. */
function proportionalFact(style: Extract<WarehouseResultStyle, { kind: "proportional" }>, properties: Record<string, unknown>): { label: string; value: string } | null {
  const sizeValue = properties[style.sizeValueProperty];
  if (typeof sizeValue !== "number" || !Number.isFinite(sizeValue)) return null; // excluded feature, never reaches a rendered popup
  const sizeLabel = style.sizeTitle ?? style.sizeField;
  const parts = [`${sizeLabel}: ${withUnit(formatVizNumber(sizeValue, style.sizeValueKind), style.sizeUnit)}`];
  let colorLabel: string | null = null;
  if (style.colorField) {
    colorLabel = style.colorTitle ?? style.colorField;
    const colorValue = style.valueProperty ? properties[style.valueProperty] : undefined;
    parts.push(`${colorLabel}: ${withUnit(show(colorValue, null, style.colorValueKind), style.colorUnit)}`);
  }
  const rank = properties[style.labelRankProperty];
  if (typeof rank === "number") parts.push(`第 ${rank} 名`);
  return { label: `${sizeLabel}${colorLabel ? ` × ${colorLabel}` : ""}`, value: parts.join("；") };
}

/** Per-kind registry: validate + colour/paint + legend + fact. The exported functions below are its
 *  typed, kind-narrowed callers — kept so existing call sites never need to touch a registry directly. */
export const WAREHOUSE_STYLE_RENDERERS = {
  choropleth: { validate: validateChoropleth, color: choroplethColor, legend: choroplethLegend, fact: choroplethFact },
  bivariate: { validate: validateBivariate, color: bivariateFillColor, legend: bivariateLegend, fact: bivariateFact },
  heatmap: { validate: validateHeatmap, paint: heatmapPaint, filter: heatmapFilter, legend: heatmapLegend, fact: heatmapFact },
  compare: { validate: validateCompare, fact: compareFact },
  proportional: { validate: validateProportional, color: proportionalCircleColor, legend: proportionalLegend, fact: proportionalFact },
} as const;

/** Fill colour: `step` over the server breaks for choropleth or bivariate's x-fill. */
export function warehouseStyleColor(style: Exclude<WarehouseResultStyle, { kind: "heatmap" | "compare" | "proportional" }>, theme: Theme = "dark"): ExpressionSpecification {
  return style.kind === "choropleth" ? WAREHOUSE_STYLE_RENDERERS.choropleth.color(style, theme) : WAREHOUSE_STYLE_RENDERERS.bivariate.color(style, theme);
}

export function warehouseHeatmapPaint(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, opacity: number, theme: Theme = "dark"): Record<string, unknown> {
  return WAREHOUSE_STYLE_RENDERERS.heatmap.paint(style, opacity, theme);
}

export function warehouseHeatmapFilter(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>): ExpressionSpecification | null {
  return WAREHOUSE_STYLE_RENDERERS.heatmap.filter(style);
}

/** Proportional circle colour only (radius/filter/sort-key are separate exported helpers above,
 *  since they are plain property reads/derivations rather than a per-theme colour computation). */
export function warehouseProportionalColor(style: Extract<WarehouseResultStyle, { kind: "proportional" }>, theme: Theme = "dark"): string | ExpressionSpecification {
  return WAREHOUSE_STYLE_RENDERERS.proportional.color(style, theme);
}

/** compare has no colour legend (rendered as a table instead); callers exclude it before reaching
 *  here. `rows` is only consulted by bivariate (its size legend needs real drawn values); every
 *  other kind ignores it, so omitting it (e.g. in a legend-only test) is always safe. */
export function warehouseStyleLegend(style: Exclude<WarehouseResultStyle, { kind: "compare" }>, theme: Theme = "dark", rows: readonly Record<string, unknown>[] = []): WarehouseStyleLegend {
  if (style.kind === "choropleth") return WAREHOUSE_STYLE_RENDERERS.choropleth.legend(style, theme);
  if (style.kind === "bivariate") return WAREHOUSE_STYLE_RENDERERS.bivariate.legend(style, theme, rows);
  if (style.kind === "proportional") return WAREHOUSE_STYLE_RENDERERS.proportional.legend(style, theme);
  return WAREHOUSE_STYLE_RENDERERS.heatmap.legend(style, theme);
}

/** One popup fact describing the styled value of a feature (null stays "無資料", never 0). */
export function warehouseStyleFact(style: WarehouseResultStyle, properties: Record<string, unknown>): { label: string; value: string } | null {
  if (style.kind === "choropleth") return WAREHOUSE_STYLE_RENDERERS.choropleth.fact(style, properties);
  if (style.kind === "bivariate") return WAREHOUSE_STYLE_RENDERERS.bivariate.fact(style, properties);
  if (style.kind === "heatmap") return WAREHOUSE_STYLE_RENDERERS.heatmap.fact(style, properties);
  if (style.kind === "proportional") return WAREHOUSE_STYLE_RENDERERS.proportional.fact(style, properties);
  return WAREHOUSE_STYLE_RENDERERS.compare.fact(style, properties);
}
