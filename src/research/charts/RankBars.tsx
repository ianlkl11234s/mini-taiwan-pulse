import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { FONT_DATA } from "../../styles/designTokens";
import { formatVizNumber, type VizNumberKind } from "../vizFormat";
import { categoricalFor, type Theme } from "../vizSpec";
import { barDomain, barFraction } from "./barScale";

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
export function rankBarsWithOther(items: readonly RankBarItem[], theme: Theme, maxItems: number, otherLabel: (count: number) => string = count => `其他 ${count} 區`): RankBarItem[] {
  const sorted = [...items].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  if (sorted.length <= maxItems) return sorted;
  const top = sorted.slice(0, maxItems);
  const rest = sorted.slice(maxItems);
  const restValues = rest.map(item => item.value).filter((value): value is number => value !== null);
  const average = restValues.length ? restValues.reduce((sum, value) => sum + value, 0) / restValues.length : null;
  return [...top, { id: "__rank-bars-other__", label: otherLabel(rest.length), value: average, color: categoricalFor(theme).other }];
}

function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
}

function valueText(value: number | null, kind: VizNumberKind, unit: string | null, noData?: string): string {
  const text = formatVizNumber(value, kind, noData);
  return value !== null && unit && kind !== "percent" ? `${text}${unit}` : text;
}

function summaryLabel(display: readonly RankBarItem[], kind: VizNumberKind, unit: string | null, title: string | undefined, t: LocaleSnapshot["t"], noData: string): string {
  const prefix = title ? `${title}：` : "";
  const first = display[0];
  if (!first) return `${prefix}${t("analysisCard.rank.summaryEmpty")}`;
  return `${prefix}${t("analysisCard.rank.summary", { count: display.length, label: first.label, value: valueText(first.value, kind, unit, noData) })}`;
}

export function RankBars({ items, theme, valueKind = "count", unit = null, title, maxItems = 10 }: RankBarsProps) {
  const { t } = useLocale();
  const noData = t("analysisCard.rank.noData");
  const display = rankBarsWithOther(items, theme, maxItems, count => t("analysisCard.rank.other", { count }));
  const domain = barDomain(display.map(item => item.value));
  const height = Math.max(ROW_HEIGHT, display.length * ROW_HEIGHT);
  const summary = summaryLabel(display, valueKind, unit, title, t, noData);
  return (
    <div className="agent-rank-bars">
      {title && <div className="agent-rank-bars__title">{title}</div>}
      <svg role="img" aria-label={summary} viewBox={`0 0 ${CHART_WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMin meet">
        {display.map((item, index) => {
          const y = index * ROW_HEIGHT;
          const barWidth = barFraction(item.value, domain) * BAR_MAX_WIDTH;
          return (
            <g key={item.id} transform={`translate(0, ${y})`}>
              <text x={0} y={ROW_HEIGHT / 2} dy="0.32em" fontSize={9} fill="currentColor">{truncateLabel(item.label)}</text>
              <rect x={LABEL_WIDTH} y={4} width={barWidth} height={ROW_HEIGHT - 8} fill={item.color} rx={2} />
              <text x={LABEL_WIDTH + barWidth + 4} y={ROW_HEIGHT / 2} dy="0.32em" fontSize={9} fill="currentColor" style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>
                {valueText(item.value, valueKind, unit, noData)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
