import { FONT_DATA } from "../../styles/designTokens";
import { formatVizNumber, type VizNumberKind } from "../vizFormat";
import { categoricalFor, type Theme } from "../vizSpec";

/**
 * Shared SVG chart (spec P1 = R1, docs/features/viz-library/DECISIONS.md §6): a horizontal ranked
 * bar list. Hand-rolled SVG (no chart library, per spec X) — name left, bar + value right. `color`
 * is per-item and supplied by the caller (spec: "長條色＝該區地圖級距色"), never picked in here.
 */
export type RankBarItem = { id: string; label: string; value: number | null; color: string };

export interface RankBarsProps {
  items: readonly RankBarItem[];
  theme: Theme;
  valueKind?: VizNumberKind;
  unit?: string | null;
  title?: string;
  /** Top N shown before collapsing the rest into one averaged "其他 N 區" row (spec P1, default 10). */
  maxItems?: number;
}

const ROW_HEIGHT = 20;
const LABEL_WIDTH = 88;
const VALUE_WIDTH = 56;
const CHART_WIDTH = 300;
const BAR_MAX_WIDTH = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
const LABEL_MAX_CHARS = 9;

/** Sorts by value descending (missing values last); beyond `maxItems` the remainder collapses into
 *  one grey "其他 N 區" row averaging their non-null values (spec P1: "前 10＋「其他 N 區」（平均）"). */
export function rankBarsWithOther(items: readonly RankBarItem[], theme: Theme, maxItems: number): RankBarItem[] {
  const sorted = [...items].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  if (sorted.length <= maxItems) return sorted;
  const top = sorted.slice(0, maxItems);
  const rest = sorted.slice(maxItems);
  const restValues = rest.map(item => item.value).filter((value): value is number => value !== null);
  const average = restValues.length ? restValues.reduce((sum, value) => sum + value, 0) / restValues.length : null;
  return [...top, { id: "__rank-bars-other__", label: `其他 ${rest.length} 區`, value: average, color: categoricalFor(theme).other }];
}

function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
}

function valueText(value: number | null, kind: VizNumberKind, unit: string | null): string {
  const text = formatVizNumber(value, kind);
  return value !== null && unit && kind !== "percent" ? `${text}${unit}` : text;
}

function summaryLabel(display: readonly RankBarItem[], kind: VizNumberKind, unit: string | null, title: string | undefined): string {
  const prefix = title ? `${title}：` : "";
  const first = display[0];
  if (!first) return `${prefix}排名長條圖，暫無資料`;
  return `${prefix}排名長條圖，共 ${display.length} 項，由高到低；最高「${first.label}」${valueText(first.value, kind, unit)}`;
}

export function RankBars({ items, theme, valueKind = "count", unit = null, title, maxItems = 10 }: RankBarsProps) {
  const display = rankBarsWithOther(items, theme, maxItems);
  const maxValue = Math.max(1e-9, ...display.map(item => item.value ?? 0));
  const height = Math.max(ROW_HEIGHT, display.length * ROW_HEIGHT);
  const summary = summaryLabel(display, valueKind, unit, title);
  return (
    <div className="agent-rank-bars">
      {title && <div className="agent-rank-bars__title">{title}</div>}
      <svg role="img" aria-label={summary} viewBox={`0 0 ${CHART_WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMin meet">
        {display.map((item, index) => {
          const y = index * ROW_HEIGHT;
          const barWidth = item.value === null ? 0 : Math.max(0, (Math.max(0, item.value) / maxValue) * BAR_MAX_WIDTH);
          return (
            <g key={item.id} transform={`translate(0, ${y})`}>
              <text x={0} y={ROW_HEIGHT / 2} dy="0.32em" fontSize={9} fill="currentColor">{truncateLabel(item.label)}</text>
              <rect x={LABEL_WIDTH} y={4} width={barWidth} height={ROW_HEIGHT - 8} fill={item.color} rx={2} />
              <text x={LABEL_WIDTH + barWidth + 4} y={ROW_HEIGHT / 2} dy="0.32em" fontSize={9} fill="currentColor" style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>
                {valueText(item.value, valueKind, unit)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
