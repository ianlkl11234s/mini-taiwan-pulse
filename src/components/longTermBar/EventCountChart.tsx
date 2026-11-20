// 事件點／大量事件的每期件數長條圖（STANDARD.md §1 事件點）。時間條與手機唯讀小圖共用。
// 缺資料畫斜線、不畫成 0；讀取失敗另畫紅色虛框，和「沒有資料」分開。
import { useId, useLayoutEffect, useRef, useState } from "react";
import { BORDER, COLORS, FONT_DATA, FONT_SIZE, LIGHT, WHITE_ALPHA } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import type { LongTermGranularity } from "../../data/layerLongTerm";
import type { LongTermPeriod } from "../../lib/longTermTime";
import type { PeriodStatus } from "../../data/fireEventSeries";
import type { LongTermRange } from "../../state/longTermBarStore";
import { granularityUnitText, periodLabel, yearAxisLabel } from "./longTermText";

const PAD = { l: 34, r: 6, t: 6, b: 16 } as const;

export interface EventCountChartProps {
  layerKey: string;
  periods: readonly LongTermPeriod[];
  granularity: LongTermGranularity;
  counts: readonly (number | null)[];
  periodStatus: readonly PeriodStatus[];
  selection: LongTermRange;
  color: string;
  isDark: boolean;
  /** 長條區高度（不含年份標籤） */
  barsHeight: number;
  /** 可互動：點一根選一期；allowRange 時可拖一段 */
  onSelect?: (range: LongTermRange) => void;
  allowRange?: boolean;
  ariaLabel: string;
}

function niceMax(v: number): number {
  const step = v > 5000 ? 1000 : v > 500 ? 100 : 10;
  return Math.max(step, Math.ceil(v / step) * step);
}

export function EventCountChart(props: EventCountChartProps) {
  const { layerKey, periods, granularity, counts, periodStatus, selection, color, isDark, barsHeight, onSelect, allowRange = false, ariaLabel } = props;
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(560);
  const dragRef = useRef<number | null>(null);
  const hatchId = `lt-hatch-${useId().replace(/:/g, "")}`;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => setW(Math.max(200, Math.round(el.clientWidth)));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  const text = isDark ? COLORS.textDefault : LIGHT.textDefault;
  const dim = isDark ? COLORS.textDim : LIGHT.textDim;
  const grid = isDark ? BORDER.soft : LIGHT.borderSoft;
  const axis = isDark ? BORDER.strong : LIGHT.borderStrong;
  const hatch = isDark ? WHITE_ALPHA[40] : LIGHT.borderStrong;
  const danger = isDark ? COLORS.statusErr : LIGHT.statusErr;

  const n = periods.length;
  const chartH = PAD.t + barsHeight + PAD.b;
  const iw = w - PAD.l - PAD.r;
  const ih = barsHeight;
  const bw = n > 0 ? iw / n : iw;
  const maxV = niceMax(Math.max(0, ...counts.map((v) => v ?? 0)));
  const ticks = [0, maxV / 2, maxV];
  const [a, b] = selection;
  const xAt = (i: number) => PAD.l + i * bw;

  const idxAt = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left - PAD.l) / iw) * n)));
  };

  const yearStarts = periods.map((p, i) => ({ p, i })).filter(({ p, i }) => i === 0 || (p.year !== periods[i - 1]?.year));

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width={w} height={chartH} role="img" aria-label={ariaLabel}
        style={{ display: "block", touchAction: onSelect ? "none" : "auto", userSelect: "none", cursor: onSelect ? "crosshair" : "default" }}
        onPointerDown={onSelect ? (e) => {
          const i = idxAt(e.clientX, e.currentTarget);
          dragRef.current = i;
          e.currentTarget.setPointerCapture(e.pointerId);
          onSelect([i, i]);
        } : undefined}
        onPointerMove={onSelect && allowRange ? (e) => {
          if (dragRef.current == null) return;
          const i = idxAt(e.clientX, e.currentTarget);
          const s = dragRef.current;
          onSelect([Math.min(s, i), Math.max(s, i)]);
        } : undefined}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <defs>
          <pattern id={hatchId} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={5} stroke={hatch} strokeWidth={1.4} />
          </pattern>
        </defs>
        {ticks.map((v) => {
          const y = PAD.t + ih - (v / maxV) * ih;
          return (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y} y2={y} stroke={v ? grid : axis} />
              <text x={PAD.l - 5} y={y + 3.5} fill={dim} fontSize={FONT_SIZE.xs} textAnchor="end" fontFamily={FONT_DATA}>{formatNumber(v)}</text>
            </g>
          );
        })}
        <rect x={xAt(a)} y={PAD.t - 3} width={(b - a + 1) * bw} height={ih + 3}
          fill={isDark ? COLORS.accentFaint : LIGHT.accentFaint} stroke={isDark ? BORDER.accent : LIGHT.accent} />
        {periods.map((p, i) => {
          const x = xAt(i) + 1;
          const bwi = Math.max(1, bw - 2);
          const label = periodLabel(layerKey, p, granularity, t);
          const st = periodStatus[i];
          if (st === "missing") {
            return <rect key={i} x={x} y={PAD.t} width={bwi} height={ih} fill={`url(#${hatchId})`}><title>{t("longTerm.bar.periodNoData", { period: label })}</title></rect>;
          }
          if (st === "error") {
            return <rect key={i} x={x + 0.5} y={PAD.t + 0.5} width={Math.max(1, bwi - 1)} height={ih - 1} fill="none" stroke={danger} strokeDasharray="2 2"><title>{t("longTerm.bar.periodFailed", { period: label })}</title></rect>;
          }
          const v = counts[i];
          if (st !== "ok" || v == null) return null;
          const h = (v / maxV) * ih;
          const op = i >= a && i <= b ? 1 : 0.38;
          return (
            <rect key={i} x={x} y={PAD.t + ih - h} width={bwi} height={h} rx={1} fill={color} fillOpacity={op}>
              <title>{t("longTerm.bar.periodCount", { period: label, count: v, n: formatNumber(v) })}</title>
            </rect>
          );
        })}
        {yearStarts.map(({ p, i }) => {
          const x = xAt(i);
          return (
            <g key={p.year}>
              <line x1={x} x2={x} y1={PAD.t} y2={PAD.t + ih + 5} stroke={axis} />
              <text x={x + 4} y={chartH - 3} fill={text} fontSize={FONT_SIZE.sm}>{yearAxisLabel(layerKey, p.year, t)}</text>
            </g>
          );
        })}
        <text x={w - PAD.r} y={chartH - 3} fill={dim} fontSize={FONT_SIZE.xs} textAnchor="end">
          {t("longTerm.bar.perBar", { unit: granularityUnitText(granularity, t) })}
        </text>
      </svg>
    </div>
  );
}
