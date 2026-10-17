/**
 * Shared number formatting (spec N1/U1, docs/features/viz-library/DECISIONS.md). Both mini and mcp
 * implement `formatVizNumber` against the same `viz-spec.json` `numberFormat.vectors`; see
 * `__tests__/vizFormat.test.ts` for the vector-by-vector check.
 */
export type VizNumberKind = "count" | "density" | "ratio" | "percent";

const thousands = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });
const twoDecimal = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 });

function myriad(value: number): string {
  const rounded = Math.round((value / 10000) * 10) / 10;
  const text = rounded.toFixed(1).replace(/\.0$/, "");
  return `${text} 萬`;
}

/** count: >=1萬 rounds to one decimal 萬 (trailing .0 dropped); otherwise a thousands-grouped integer. */
function formatCount(value: number): string {
  return Math.abs(value) >= 10000 ? myriad(value) : thousands.format(Math.round(value));
}

/** density: thousands-grouped, at most 0 decimals (never a 萬-unit rewrite). */
function formatDensity(value: number): string {
  return thousands.format(Math.round(value));
}

/** ratio: at most 2 decimals, trailing zeros dropped. */
function formatRatio(value: number): string {
  return twoDecimal.format(value);
}

/** percent: input is already a percentage number (12.34 means 12.34%), fixed to 1 decimal + "%". */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** A missing value is always "無資料" — never 0, never an empty string. */
export function formatVizNumber(value: number | null | undefined, kind: VizNumberKind): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "無資料";
  if (kind === "count") return formatCount(value);
  if (kind === "density") return formatDensity(value);
  if (kind === "percent") return formatPercent(value);
  return formatRatio(value);
}

/**
 * Conservative fallback for callers that only have a free-text unit string, not a declared
 * ResultStyle value kind (no such field exists yet — see the viz-library PLAN spec-gap note).
 * "%" -> percent; a per-X unit ("/"、"／"、"每...") -> density; otherwise an integer value -> count,
 * a fractional value -> ratio (so a genuine decimal, e.g. an earthquake magnitude of 4.2, is never
 * silently rounded away by the integer "count" rule). Unrecognised units never guess "percent" or
 * "density" from partial matches; they fall through to the value-shape rule.
 */
export function classifyVizNumberKind(value: number, unit: string | null | undefined): VizNumberKind {
  if (unit === "%") return "percent";
  if (unit && /[/／]|每/.test(unit)) return "density";
  return Number.isInteger(value) ? "count" : "ratio";
}
