import { classifyVizNumberKind, formatVizNumber, type VizNumberKind } from "./vizFormat";
import type { TrendPoint } from "./charts/TrendLine";
import type { WarehouseResultStyle } from "./warehouseResultStyle";

/**
 * Adapts a stored read_series/compare_series result's rows (analysisOperations.ts readSeries/
 * compareSeries, spec T1, docs/features/viz-library/DECISIONS.md §6 P3=W3) into generic TrendLine
 * points. Pure data mapping — no React, no knowledge of the map or the result store.
 */
export type SeriesRow = Record<string, unknown>;

const COMPARE_SERIES_STATUSES = new Set(["valid", "missing_current", "missing_baseline", "zero_baseline"]);

/** True for a compare_series row (current_value/baseline_value/status), false for a plain read_series
 *  row (value/records/missing_value). Both always carry `period_start`; only compare_series carries
 *  `status`, whose values are this closed set (analysisOperations.ts compareSeries). */
export function isCompareSeriesRow(row: SeriesRow): boolean {
  return typeof row.status === "string" && COMPARE_SERIES_STATUSES.has(row.status);
}

/** "2026-09-21T00:00:00+08:00" -> "09/21". `period_start` is already a Taiwan-local (Asia/Taipei)
 *  midnight ISO string baked in by analysisOperations.readSeries — this only slices the fixed-width
 *  prefix, no further Date/timezone math (a second timezone conversion here could reintroduce the
 *  exact bug that fix just closed). Anything not in that shape is returned verbatim. */
export function shortTaipeiDateLabel(periodStart: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(periodStart) ? `${periodStart.slice(5, 7)}/${periodStart.slice(8, 10)}` : periodStart;
}

function numericOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type SeriesTrendLineData = { points: TrendPoint[]; baseline?: TrendPoint[]; valueKind: VizNumberKind };

/**
 * `rows` -> TrendLine points. A compare_series row already carries both `current_value` and
 * `baseline_value` for the same `period_start`, so points/baseline come out the same length and
 * period order without any separate alignment step (spec L3: baseline series must be index-aligned
 * with the main points — this is what guarantees that here).
 */
export function seriesTrendLineData(rows: readonly SeriesRow[], unit: string | null): SeriesTrendLineData {
  const compare = rows.length > 0 && isCompareSeriesRow(rows[0]!);
  const valueField = compare ? "current_value" : "value";
  const points: TrendPoint[] = rows.map(row => {
    const periodStart = String(row.period_start);
    return { id: periodStart, label: shortTaipeiDateLabel(periodStart), value: numericOrNull(row[valueField]) };
  });
  const baseline: TrendPoint[] | undefined = compare
    ? rows.map(row => { const periodStart = String(row.period_start); return { id: periodStart, label: shortTaipeiDateLabel(periodStart), value: numericOrNull(row.baseline_value) }; })
    : undefined;
  const sampleValue = points.find(point => point.value !== null)?.value ?? (baseline?.find(point => point.value !== null)?.value ?? 0);
  return { points, baseline, valueKind: classifyVizNumberKind(sampleValue, unit) };
}

export type WarehouseSeriesTrendLineData = SeriesTrendLineData & { title: string; unit: string | null; latestText: string; baselineLabel: string | null };

/**
 * Adapts a warehouse-imported `series` style (mcp `pulse_wh_present`, T1=L1, no map geometry — see
 * warehouseResultImport.ts) into TrendLine points, directly from its own `periods`/`values`/
 * `baseline` arrays (already period-aligned server-side, unlike `seriesTrendLineData` above which
 * reads a session-local read_series/compare_series result's per-row `period_start`/`value` shape).
 */
export function warehouseSeriesTrendLineData(style: Extract<WarehouseResultStyle, { kind: "series" }>): WarehouseSeriesTrendLineData {
  const points: TrendPoint[] = style.periods.map((period, index) => ({ id: period, label: shortTaipeiDateLabel(period), value: style.values[index] ?? null }));
  const baseline: TrendPoint[] | undefined = style.baseline
    ? style.periods.map((period, index) => ({ id: period, label: shortTaipeiDateLabel(period), value: style.baseline![index] ?? null }))
    : undefined;
  return {
    points, baseline, valueKind: style.valueKind, title: style.title, unit: style.unit, baselineLabel: style.baselineLabel,
    latestText: style.latest.value === null ? "無資料" : formatVizNumber(style.latest.value, style.valueKind),
  };
}
