import { FONT_DATA } from "../../styles/designTokens";
import { formatVizNumber, type VizNumberKind } from "../vizFormat";

/**
 * Shared SVG chart (spec T1 = L1, docs/features/viz-library/DECISIONS.md §6): a line + translucent
 * area, latest non-null point marked and labelled, an optional grey dashed baseline (L3), null values
 * breaking the line rather than being interpolated across (spec X: "缺資料折線斷開"). `compact`
 * drops the axes for a small inline (e.g. popup) placement.
 *
 * `baseline`, when given, must be the same length and period order as `points` (index-aligned) — the
 * caller (e.g. compare_series output, which already unions both periods onto one row) does that
 * alignment; this component has no notion of what a "period" means.
 */
export type TrendPoint = { id: string; label: string; value: number | null };

export interface TrendLineProps {
  points: readonly TrendPoint[];
  valueKind?: VizNumberKind;
  unit?: string | null;
  /** Line/area colour; defaults to inheriting the surrounding text colour. */
  color?: string;
  baseline?: readonly TrendPoint[];
  compact?: boolean;
  title?: string;
}

const WIDTH = 300;
const HEIGHT_FULL = 96;
const HEIGHT_COMPACT = 40;
const PAD_LEFT = 4;
const PAD_TOP = 8;

type Segment = { index: number; value: number }[];

/** Splits a point series into contiguous non-null runs; a null value ends the current run and starts
 *  a new one on the next non-null point, so the drawn line never bridges a gap (spec X). */
function segments(points: readonly TrendPoint[]): Segment[] {
  const runs: Segment[] = [];
  let current: Segment = [];
  points.forEach((point, index) => {
    if (point.value === null) { if (current.length) { runs.push(current); current = []; } return; }
    current.push({ index, value: point.value });
  });
  if (current.length) runs.push(current);
  return runs;
}

function pathFor(runs: readonly Segment[], x: (index: number) => number, y: (value: number) => number): string {
  return runs.map(run => `M ${run.map(point => `${x(point.index)},${y(point.value)}`).join(" L ")}`).join(" ");
}

function areaPathFor(runs: readonly Segment[], x: (index: number) => number, y: (value: number) => number, baselineY: number): string {
  return runs.map(run => {
    const line = run.map(point => `${x(point.index)},${y(point.value)}`).join(" L ");
    return `M ${x(run[0]!.index)},${baselineY} L ${line} L ${x(run[run.length - 1]!.index)},${baselineY} Z`;
  }).join(" ");
}

/** formatVizNumber already appends "%" for a percent kind; every other kind needs its unit appended
 *  separately (spec N1 "有單位必寫"). */
function valueText(value: number | null, kind: VizNumberKind, unit: string | null): string {
  const text = formatVizNumber(value, kind);
  return value !== null && unit && kind !== "percent" ? `${text}${unit}` : text;
}

function summaryLabel(points: readonly TrendPoint[], latest: TrendPoint | undefined, kind: VizNumberKind, unit: string | null, hasBaseline: boolean, title: string | undefined): string {
  const prefix = title ? `${title}：` : "";
  if (!points.length) return `${prefix}趨勢折線圖，暫無資料`;
  const latestText = latest && latest.value !== null ? `最新一期「${latest.label}」${valueText(latest.value, kind, unit)}` : "最新一期無資料";
  return `${prefix}趨勢折線圖，共 ${points.length} 期；${latestText}${hasBaseline ? "，已加上比較基準線" : ""}`;
}

export function TrendLine({ points, valueKind = "count", unit = null, color, baseline, compact = false, title }: TrendLineProps) {
  const height = compact ? HEIGHT_COMPACT : HEIGHT_FULL;
  const padRight = compact ? 4 : 44;
  const padBottom = compact ? 4 : 16;
  const plotWidth = Math.max(1, WIDTH - PAD_LEFT - padRight);
  const plotHeight = Math.max(1, height - PAD_TOP - padBottom);

  const values = points.map(point => point.value).filter((value): value is number => value !== null);
  const baselineValues = (baseline ?? []).map(point => point.value).filter((value): value is number => value !== null);
  const allValues = [...values, ...baselineValues];
  const min = allValues.length ? Math.min(0, ...allValues) : 0;
  const max = allValues.length ? Math.max(min + 1e-9, ...allValues) : 1;
  const x = (index: number) => points.length <= 1 ? PAD_LEFT : PAD_LEFT + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => PAD_TOP + plotHeight - ((value - min) / (max - min)) * plotHeight;

  const runs = segments(points);
  const linePath = pathFor(runs, x, y);
  const areaPath = areaPathFor(runs, x, y, y(min));
  const baselineRuns = baseline ? segments(baseline) : [];
  const baselinePath = pathFor(baselineRuns, x, y);

  const lineColor = color ?? "currentColor";
  const latest = points[points.length - 1];
  const showLatestDot = !!latest && latest.value !== null;
  const summary = summaryLabel(points, latest, valueKind, unit, baselineValues.length > 0, title);

  const tickIndexes = !compact && points.length > 0
    ? [...new Set([0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1])]
    : [];
  const gridValues = !compact ? [0.25, 0.5, 0.75].map(fraction => min + (max - min) * fraction) : [];

  return (
    <div className="agent-trend-line">
      {title && !compact && <div className="agent-trend-line__title">{title}</div>}
      <svg role="img" aria-label={summary} viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMin meet">
        {gridValues.map((value, index) => (
          <line key={index} x1={PAD_LEFT} x2={WIDTH - padRight} y1={y(value)} y2={y(value)} stroke="currentColor" strokeOpacity={0.14} strokeWidth={1} />
        ))}
        {baselinePath && <path d={baselinePath} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeDasharray="3 3" strokeWidth={1.25} />}
        {areaPath && <path d={areaPath} fill={lineColor} fillOpacity={0.15} stroke="none" />}
        {linePath && <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.75} />}
        {showLatestDot && <circle cx={x(points.length - 1)} cy={y(latest!.value!)} r={2.75} fill={lineColor} />}
        {showLatestDot && (
          <text
            x={compact ? WIDTH - padRight : Math.min(x(points.length - 1) + 5, WIDTH - 2)}
            y={y(latest!.value!)} dy="0.32em" fontSize={9} fill="currentColor" textAnchor={compact ? "end" : "start"}
            style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}
          >
            {valueText(latest!.value, valueKind, unit)}
          </text>
        )}
        {tickIndexes.map(index => (
          <text key={index} x={x(index)} y={height - 4} fontSize={8} fill="currentColor" opacity={0.7}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>
            {points[index]?.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
