import type { ExpressionSpecification } from "mapbox-gl";

/**
 * Styling metadata computed by the MCP warehouse (pulse_wh_present `style`). Breaks, colours and
 * labels arrive ready-made; the browser validates their shape and applies them verbatim — it never
 * re-classifies. Features with a missing value carry null in the style property and are drawn grey.
 */
export type WarehouseCompareCell = { value: number | null; notCovered: boolean; rank: number | null };
export type WarehouseCompareRow = { field: string; label: string; unit: string | null; cells: WarehouseCompareCell[] };
export type WarehouseCompareColumn = { index: number; label: string };

export type WarehouseResultStyle =
  | { kind: "choropleth"; field: string; valueProperty: "_style_value"; method: "quantile" | "equal"; scheme: "sequential" | "diverging"; label: string; breaks: number[]; colors: string[]; labels: string[]; min: number; max: number; nullColor: string; nullCount: number }
  | { kind: "bivariate"; xField: string; yField: string; xLabel: string; yLabel: string; classProperty: "_bi_class"; xBreaks: number[]; yBreaks: number[]; classes: string[]; colors: string[]; nullColor: string; nullCount: number }
  | { kind: "heatmap"; weightField: string | null; weightProperty: "_style_weight" | null; weightMax: number | null; colors: string[]; nullCount: number }
  | { kind: "compare"; labelField: string | null; pointProperty: "_compare_index"; columns: WarehouseCompareColumn[]; rows: WarehouseCompareRow[] };

export type WarehouseStyleLegend =
  | { kind: "choropleth"; title: string; method: string; entries: { label: string; color: string }[]; breaks: number[]; nullEntry: { label: string; color: string } }
  | { kind: "bivariate"; xLabel: string; yLabel: string; cells: { cls: string; color: string; x: number; y: number }[]; nullEntry: { label: string; color: string } }
  | { kind: "heatmap"; title: string; gradient: string; note: string; nullEntry: { label: string; color: string } | null };

const BIVARIATE_CLASSES = ["1-1", "2-1", "3-1", "1-2", "2-2", "3-2", "1-3", "2-3", "3-3"];
const FIELD = /^[\p{L}_][\p{L}\p{N}_]{0,79}$/u;
const HEX = /^#[0-9a-fA-F]{6}$/;

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const field = (value: unknown): value is string => typeof value === "string" && FIELD.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 60;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const finiteList = (value: unknown, min: number, max: number): value is number[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(finite);
const colorList = (value: unknown, min: number, max: number): value is string[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => typeof item === "string" && HEX.test(item));
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5000;
const exactly = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
// A compare cell's rank is null exactly for an unranked cell (missing or not-covered); a not-covered cell
// never carries a fabricated value (e.g. a raw 0 from an uncovered dataset).
function compareCell(value: unknown, columnCount: number): value is WarehouseCompareCell {
  if (!isObject(value) || Object.keys(value).length !== 3) return false;
  if (!(value.value === null || (typeof value.value === "number" && Number.isFinite(value.value)))) return false;
  if (typeof value.notCovered !== "boolean" || (value.notCovered && value.value !== null)) return false;
  return value.value === null ? value.rank === null : Number.isInteger(value.rank) && (value.rank as number) >= 1 && (value.rank as number) <= columnCount;
}

/** Mirrors the Gateway contract; anything else rejects the import rather than drawing a guess. */
export function validateWarehouseResultStyle(value: unknown): WarehouseResultStyle {
  const fail = () => { throw new Error("WAREHOUSE_RESULT_STYLE_INVALID"); };
  if (!isObject(value)) return fail();
  if (value.kind === "choropleth") {
    if (!exactly(value, ["kind", "field", "valueProperty", "method", "scheme", "label", "breaks", "colors", "labels", "min", "max", "nullColor", "nullCount"])
      || !field(value.field) || value.valueProperty !== "_style_value" || !["quantile", "equal"].includes(value.method as string) || !["sequential", "diverging"].includes(value.scheme as string)
      || !text(value.label) || !finiteList(value.breaks, 0, 10) || !value.breaks.every((item, index, all) => index === 0 || item > all[index - 1]!)
      || !colorList(value.colors, 1, 12) || value.colors.length !== value.breaks.length + 1
      || !Array.isArray(value.labels) || value.labels.length !== value.colors.length || !value.labels.every(text)
      || !finite(value.min) || !finite(value.max) || value.min > value.max || !colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return fail();
    return value as WarehouseResultStyle;
  }
  if (value.kind === "bivariate") {
    if (!exactly(value, ["kind", "xField", "yField", "xLabel", "yLabel", "classProperty", "xBreaks", "yBreaks", "classes", "colors", "nullColor", "nullCount"])
      || !field(value.xField) || !field(value.yField) || !text(value.xLabel) || !text(value.yLabel) || value.classProperty !== "_bi_class"
      || !finiteList(value.xBreaks, 2, 2) || !finiteList(value.yBreaks, 2, 2)
      || !Array.isArray(value.classes) || value.classes.length !== 9 || !value.classes.every((item, index) => item === BIVARIATE_CLASSES[index])
      || !colorList(value.colors, 9, 9) || !colorList([value.nullColor], 1, 1) || !count(value.nullCount)) return fail();
    return value as WarehouseResultStyle;
  }
  if (value.kind === "heatmap") {
    const weighted = value.weightField !== null;
    if (!exactly(value, ["kind", "weightField", "weightProperty", "weightMax", "colors", "nullCount"])
      || (weighted && (!field(value.weightField) || value.weightProperty !== "_style_weight" || !finite(value.weightMax) || value.weightMax < 0))
      || (!weighted && (value.weightProperty !== null || value.weightMax !== null))
      || !colorList(value.colors, 2, 12) || !count(value.nullCount)) return fail();
    return value as WarehouseResultStyle;
  }
  if (value.kind === "compare") {
    if (!exactly(value, ["kind", "labelField", "pointProperty", "columns", "rows"])
      || (value.labelField !== null && !field(value.labelField)) || value.pointProperty !== "_compare_index"
      || !Array.isArray(value.columns) || value.columns.length < 1 || value.columns.length > 20
      || !value.columns.every((column, index) => isObject(column) && Object.keys(column).length === 2 && column.index === index + 1 && text(column.label))) return fail();
    const columnCount = value.columns.length;
    if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 12
      || !value.rows.every(row => isObject(row) && Object.keys(row).length === 4 && field(row.field) && text(row.label)
        && (row.unit === null || text(row.unit)) && Array.isArray(row.cells) && row.cells.length === columnCount
        && row.cells.every(cell => compareCell(cell, columnCount)))) return fail();
    return value as WarehouseResultStyle;
  }
  return fail();
}

/** Fill / circle colour: `step` over the server breaks for choropleth, `match` on _bi_class for bivariate. */
export function warehouseStyleColor(style: Exclude<WarehouseResultStyle, { kind: "heatmap" | "compare" }>): ExpressionSpecification {
  if (style.kind === "choropleth") {
    const value = ["get", style.valueProperty];
    const scale: unknown = style.breaks.length === 0 ? style.colors[0]! : ["step", value, style.colors[0]!, ...style.breaks.flatMap((threshold, index) => [threshold, style.colors[index + 1]!])];
    return ["case", ["==", ["typeof", value], "number"], scale, style.nullColor] as unknown as ExpressionSpecification;
  }
  return ["match", ["coalesce", ["get", style.classProperty], ""], ...style.classes.flatMap((cls, index) => [cls, style.colors[index]!]), style.nullColor] as unknown as ExpressionSpecification;
}

/** Heatmap paint; missing weights are filtered out by warehouseHeatmapFilter, never weighted as 0. */
export function warehouseHeatmapPaint(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>, opacity: number): Record<string, unknown> {
  const stops = style.colors.flatMap((color, index) => [(index + 1) / style.colors.length, color]);
  const weight = style.weightProperty && style.weightMax && style.weightMax > 0 ? ["/", ["get", style.weightProperty], style.weightMax] : 1;
  return {
    "heatmap-weight": weight,
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 15, 3],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 15, 28],
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", ...stops],
    "heatmap-opacity": opacity,
  };
}

export function warehouseHeatmapFilter(style: Extract<WarehouseResultStyle, { kind: "heatmap" }>): ExpressionSpecification | null {
  return style.weightProperty ? ["==", ["typeof", ["get", style.weightProperty]], "number"] as unknown as ExpressionSpecification : null;
}

function nullEntry(style: Exclude<WarehouseResultStyle, { kind: "compare" }>): { label: string; color: string } { return { label: `無資料／未涵蓋（${style.nullCount}）`, color: style.kind === "heatmap" ? "#bdbdbd" : style.nullColor }; }

/** compare has no colour legend (rendered as a table instead); callers exclude it before reaching here. */
export function warehouseStyleLegend(style: Exclude<WarehouseResultStyle, { kind: "compare" }>): WarehouseStyleLegend {
  if (style.kind === "choropleth") {
    return { kind: "choropleth", title: style.label, method: style.method === "quantile" ? "分位數分級" : "等距分級", entries: style.labels.map((label, index) => ({ label, color: style.colors[index]! })), breaks: style.breaks, nullEntry: nullEntry(style) };
  }
  if (style.kind === "bivariate") {
    return { kind: "bivariate", xLabel: style.xLabel, yLabel: style.yLabel, cells: style.classes.map((cls, index) => ({ cls, color: style.colors[index]!, x: Number(cls[0]), y: Number(cls[2]) })), nullEntry: nullEntry(style) };
  }
  return {
    kind: "heatmap", title: style.weightField ? `密度（依 ${style.weightField} 加權）` : "點位密度",
    gradient: `linear-gradient(to right, ${style.colors.join(", ")})`, note: "顏色越深代表鄰近點位越密集；縮放時會重新計算，並非絕對數值。",
    nullEntry: style.weightField && style.nullCount > 0 ? { label: `權重缺值未計入（${style.nullCount}）`, color: "#bdbdbd" } : null,
  };
}

/** One popup fact describing the styled value of a feature (null stays "無資料", never 0). */
export function warehouseStyleFact(style: WarehouseResultStyle, properties: Record<string, unknown>): { label: string; value: string } | null {
  const show = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 4 }).format(value) : typeof value === "string" && value.trim() ? value : "無資料";
  if (style.kind === "choropleth") return { label: style.label, value: show(properties[style.valueProperty]) };
  if (style.kind === "compare") {
    const index = properties[style.pointProperty];
    const column = typeof index === "number" ? style.columns.find(candidate => candidate.index === index) : undefined;
    if (!column) return null;
    const parts = style.rows.map(row => {
      const cell = row.cells[index as number - 1];
      const cellValue = !cell || cell.notCovered ? "未涵蓋" : cell.value === null ? "無資料" : `${show(cell.value)}${row.unit ? ` ${row.unit}` : ""}${cell.rank !== null ? `（第 ${cell.rank}）` : ""}`;
      return `${row.label}: ${cellValue}`;
    });
    return { label: column.label, value: parts.join("；") };
  }
  if (style.kind === "bivariate") {
    const cls = properties[style.classProperty];
    return { label: `${style.xLabel} × ${style.yLabel}`, value: `${show(properties[style.xField])} / ${show(properties[style.yField])}${typeof cls === "string" ? `（類別 ${cls}）` : "（無資料）"}` };
  }
  return style.weightField && style.weightProperty ? { label: style.weightField, value: show(properties[style.weightProperty]) } : null;
}
