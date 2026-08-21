import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { COLORS, FONT_SIZE, SURFACE, BORDER, RADIUS, WHITE_ALPHA } from "../styles/designTokens";

/**
 * 24h SVG sparkline — Y 軸刻度 + 警戒線 + X 軸 6/12/18h tick
 *
 * 設計目標：純 SVG inline、無 chart library、與本專案 monospace 風格一致。
 * 適用任何 (observed_at, value) 時序：水位、雨量、淹水深度、AQI…
 */

export interface SparklinePoint {
  t: number;   // unix seconds
  v: number;
}

export interface TimeseriesSparklineProps {
  data: SparklinePoint[];
  /** value 單位（例：m / cm / mm） */
  unit?: string;
  /** 警戒值（畫紅色水平虛線）；不傳則不畫 */
  warningValue?: number | null;
  /** 警戒線標籤（預設「警戒」） */
  warningLabel?: string;
  /** 主線顏色（預設 #60a5fa） */
  lineColor?: string;
  /** 警戒線顏色（預設 #ef4444） */
  warningColor?: string;
  /** 總高度 px（含 padding + axis） */
  height?: number;
  /** 是否顯示資料區域填色 */
  fillArea?: boolean;
  /**
   * 缺口斷線（opt-in）：相鄰點時距 > gapSec 秒 → 折線分段、不跨接，
   * 避免把「缺快照」讀成真實低谷。不傳 = 原行為（一路連線）。
   */
  gapSec?: number;
  /**
   * 第二條線（opt-in，與主線共用同一個 Y 軸）。Y 軸值域會把兩條線一起納入計算，
   * gapSec 斷線邏輯同樣套用在這條線上。不傳 = 行為與現在完全相同。
   */
  extraSeries?: { data: SparklinePoint[]; color: string; label?: string };
  /** 主線在 tooltip 中的標籤（搭配 extraSeries 使用時用來區分兩條線）；不傳則 tooltip 只顯示色點 + 數值 */
  seriesLabel?: string;
  /**
   * 是否開啟 hover tooltip（opt-in，預設 false）：滑鼠移動時依 X 座標找最近資料點，
   * 畫垂直指示線 + 資料點圓點 + tooltip（日期 + 數值，有 extraSeries 時兩條線都列出）。
   */
  showTooltip?: boolean;
  /** tooltip 日期格式："datetime"（預設，月/日 時:分）或 "date"（只顯示月/日，適合每日一點的資料） */
  tooltipDateFormat?: "date" | "datetime";
  /** Y 軸刻度是否強制縮寫成 50k 這種格式（五位數以上數值避免擠爆）；預設 false = 沿用原本依 step 判斷的縮寫規則 */
  compactYAxis?: boolean;
}

/**
 * 主線 + extraSeries（如有）的 Y 值域合併計算（純函式，可獨立單元測試）。
 * 抽出以確保「不傳 extraSeries」時與過去逐位元等價 —— data-only 分支完全複製舊有算法。
 */
export function computeCombinedYRange(
  data: SparklinePoint[],
  extraData?: SparklinePoint[],
  warningValue?: number | null,
): { vMin: number; vMax: number } | null {
  if (data.length === 0) return null;
  const vals = data.map((d) => d.v);
  if (extraData && extraData.length > 0) vals.push(...extraData.map((d) => d.v));
  let vMin = Math.min(...vals);
  let vMax = Math.max(...vals);
  if (warningValue != null) {
    vMin = Math.min(vMin, warningValue);
    vMax = Math.max(vMax, warningValue);
  }
  return { vMin, vMax };
}

/** 缺口分段（沿用主線舊邏輯，抽出後主線與 extraSeries 共用） */
function buildSegments(points: SparklinePoint[], gapSec?: number): SparklinePoint[][] {
  if (points.length === 0) return [];
  const segments: SparklinePoint[][] = [];
  let cur: SparklinePoint[] = [];
  for (const d of points) {
    if (cur.length > 0 && gapSec != null && d.t - cur[cur.length - 1]!.t > gapSec) {
      segments.push(cur);
      cur = [];
    }
    cur.push(d);
  }
  segments.push(cur);
  return segments;
}

/** 單一 segment → polyline points / area path（baseY 不傳則不算 areaPath，供 extraSeries 用） */
function buildSegView(
  seg: SparklinePoint[],
  xScale: (t: number) => number,
  yScale: (v: number) => number,
  baseY?: string,
) {
  const pts = seg.map((d) => `${xScale(d.t).toFixed(1)},${yScale(d.v).toFixed(1)}`).join(" ");
  const areaPath =
    baseY != null
      ? `M${xScale(seg[0]!.t).toFixed(1)},${baseY} ` +
        `L${pts.split(" ").join(" L")} ` +
        `L${xScale(seg[seg.length - 1]!.t).toFixed(1)},${baseY} Z`
      : undefined;
  return { pts, areaPath, single: seg.length === 1, first: seg[0]! };
}

/** tooltip 日期格式化："date" 只顯示月/日（例 8/16）；"datetime" 另加時:分 */
function fmtTooltipDate(t: number, format: "date" | "datetime"): string {
  const d = new Date(t * 1000);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  if (format === "date") return md;
  return `${md} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const DEFAULT_W = 256;  // fallback 寬（量到容器實際寬度前使用），原配 popup 280 寬扣 padding
const PAD_L = 30;       // 左邊讓出空間給 Y 軸數字
const PAD_R = 8;
const PAD_T = 6;
const PAD_B = 14;

function niceTicks(min: number, max: number, count = 3): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) {
    return [min];
  }
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const err = (count * step) / range;
  let mult = 1;
  if (err <= 0.15) mult = 10;
  else if (err <= 0.35) mult = 5;
  else if (err <= 0.75) mult = 2;
  const niceStep = step * mult;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + 1e-9; v += niceStep) ticks.push(v);
  return ticks;
}

/**
 * Y 軸刻度格式：依刻度步距決定精度（step ≥ 1 → 整數；千級 → k 縮寫），
 * 修掉人數類量出現「0.00」的違和小數。
 */
function fmtTick(v: number, step: number, forceCompact = false): string {
  if (Math.abs(v) >= 1000 && (forceCompact || step >= 1000)) {
    const kv = v / 1000;
    return `${Number.isInteger(kv) ? kv : +kv.toFixed(1)}k`;
  }
  if (step >= 1) return Math.round(v).toString();
  if (step >= 0.1) return v.toFixed(1);
  return v.toFixed(2);
}

/** 警戒線標籤格式（依值本身量級，不受刻度步距 round 影響，1.5 不會變 2） */
function fmtValue(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

/**
 * tooltip 數值格式：四位數以上補千分位、單位前留空格（% 除外），
 * 對齊卡片其他數字的既有呈現（例：供電能力 49,496 MW / 備轉 22.2%）。
 */
function fmtTooltipValue(v: number, unit: string): string {
  const num = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : fmtValue(v);
  if (!unit) return num;
  return unit === "%" ? `${num}${unit}` : `${num} ${unit}`;
}

export function TimeseriesSparkline({
  data,
  unit = "",
  warningValue = null,
  warningLabel = "警戒",
  lineColor = "#60a5fa",
  warningColor = "#ef4444",
  height = 120,
  fillArea = true,
  gapSec,
  extraSeries,
  seriesLabel,
  showTooltip = false,
  tooltipDateFormat = "datetime",
  compactYAxis = false,
}: TimeseriesSparklineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(DEFAULT_W);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = (width: number) => {
      if (width === 0) return; // 元素隱藏時維持原值
      setW(Math.round(width));
    };
    measure(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    if (data.length === 0) return null;
    const tMin = data[0]!.t;
    const tMax = data[data.length - 1]!.t;
    // Y 值域把 extraSeries（如有）與警戒線一起納入，否則第二條線／警戒線可能跑出畫面
    const { vMin, vMax } = computeCombinedYRange(data, extraSeries?.data, warningValue)!;
    // 給 vMax 留 10% 空間，避免最高點貼頂
    const pad = (vMax - vMin) * 0.1 || Math.max(Math.abs(vMax), 1) * 0.1;
    // 資料全非負（人數/雨量/水深…）→ y 下界 clamp 到 0，不長出負值刻度
    const yLo = vMin >= 0 ? Math.max(0, vMin - pad * 0.2) : vMin - pad * 0.2;
    const yHi = vMax + pad;
    const ticks = niceTicks(yLo, yHi, 3);
    const tickStep = ticks.length >= 2 ? ticks[1]! - ticks[0]! : Math.abs(yHi - yLo) || 1;
    const xScale = (t: number) =>
      tMax === tMin ? PAD_L : PAD_L + ((t - tMin) / (tMax - tMin)) * (w - PAD_L - PAD_R);
    const yScale = (v: number) =>
      yHi === yLo ? PAD_T : PAD_T + (1 - (v - yLo) / (yHi - yLo)) * (height - PAD_T - PAD_B);

    // 缺口分段：相鄰點時距 > gapSec → 斷線（不跨接），避免缺快照被讀成低谷（extraSeries 套同一條規則）
    const baseY = (height - PAD_B).toFixed(1);
    const segViews = buildSegments(data, gapSec).map((seg) => buildSegView(seg, xScale, yScale, baseY));
    const extraSegViews = extraSeries
      ? buildSegments(extraSeries.data, gapSec).map((seg) => buildSegView(seg, xScale, yScale))
      : [];
    const extraByT = extraSeries ? new Map(extraSeries.data.map((d) => [d.t, d.v])) : undefined;

    // X 軸時間 tick：≤48h 取整點（local）、步距 1/2/4/8h；>48h 取日界 00:00、
    // 步距 1/2/4/7/14/30/60 天、標籤 M/D（8h 步距在多日範圍會生出數十個 tick 疊成字牆）
    const rangeH = (tMax - tMin) / 3600;
    const timeTicks: { x: number; label: string }[] = [];
    if (rangeH > 48) {
      const rangeD = rangeH / 24;
      // ≤70 天維持原本的 1/2/4/7 階梯（既有圖表行為不變）。
      // 70 天以上是 2026-08-21 補的：在監卡的 1Y 視窗有 268 天跨度，
      // 停在 7 天步距會生出 38 個 M/D 標籤，在 ~350px 寬的格子裡疊成一片字牆。
      const stepD =
        rangeD <= 5 ? 1 : rangeD <= 16 ? 2 : rangeD <= 32 ? 4 : rangeD <= 70 ? 7
        : rangeD <= 150 ? 14 : rangeD <= 330 ? 30 : 60;
      const cursor = new Date(tMin * 1000);
      cursor.setHours(0, 0, 0, 0);
      if (cursor.getTime() < tMin * 1000) cursor.setDate(cursor.getDate() + 1);
      for (let i = 0; cursor.getTime() / 1000 <= tMax; cursor.setDate(cursor.getDate() + 1), i++) {
        if (i % stepD !== 0) continue;
        timeTicks.push({
          x: xScale(cursor.getTime() / 1000),
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        });
      }
    } else {
      const stepH = rangeH <= 4 ? 1 : rangeH <= 9 ? 2 : rangeH <= 18 ? 4 : 8;
      for (let t = Math.ceil(tMin / 3600) * 3600; t <= tMax; t += 3600) {
        const d = new Date(t * 1000);
        if (d.getHours() % stepH !== 0 || d.getMinutes() !== 0) continue;
        timeTicks.push({ x: xScale(t), label: `${d.getHours().toString().padStart(2, "0")}:00` });
      }
    }
    if (timeTicks.length === 0) {
      // 超短範圍（< 1 整點）fallback：首尾 hh:mm
      for (const t of tMax > tMin ? [tMin, tMax] : [tMin]) {
        const d = new Date(t * 1000);
        timeTicks.push({
          x: xScale(t),
          label: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`,
        });
      }
    }

    return { tMin, tMax, yLo, yHi, ticks, tickStep, xScale, yScale, segViews, extraSegViews, extraByT, timeTicks };
  }, [data, warningValue, height, w, gapSec, extraSeries]);

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!showTooltip || !view || data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const xViewBox = ((e.clientX - rect.left) / rect.width) * w;
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(view.xScale(data[i]!.t) - xViewBox);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    setHoverIdx(bestI);
  }

  function handleMouseLeave() {
    setHoverIdx(null);
  }

  if (data.length === 0 || !view) {
    return (
      <div
        style={{
          fontSize: FONT_SIZE.sm,
          color: COLORS.textDim,
          padding: "8px 4px",
          textAlign: "center",
        }}
      >
        — 過去 24h 無讀值 —
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        style={{ display: "block", marginTop: 4 }}
        onMouseMove={showTooltip ? handleMouseMove : undefined}
        onMouseLeave={showTooltip ? handleMouseLeave : undefined}
      >
        {/* Y 軸 grid + tick label */}
        {view.ticks.map((tv) => {
          const y = view.yScale(tv);
          return (
            <g key={`y-${tv}`}>
              <line
                x1={PAD_L}
                x2={w - PAD_R}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={0.5}
              />
              <text
                x={PAD_L - 4}
                y={y + 3}
                fontSize={8}
                textAnchor="end"
                fill="rgba(255,255,255,0.5)"
                fontFamily="monospace"
              >
                {fmtTick(tv, view.tickStep, compactYAxis)}
              </text>
            </g>
          );
        })}

        {/* 警戒線 */}
        {warningValue != null && (
          <g>
            <line
              x1={PAD_L}
              x2={w - PAD_R}
              y1={view.yScale(warningValue)}
              y2={view.yScale(warningValue)}
              stroke={warningColor}
              strokeWidth={0.8}
              strokeDasharray="3 2"
            />
            <text
              x={w - PAD_R - 2}
              y={view.yScale(warningValue) - 2}
              fontSize={8}
              textAnchor="end"
              fill={warningColor}
              fontFamily="monospace"
            >
              {warningLabel} {fmtValue(warningValue)}
            </text>
          </g>
        )}

        {/* 區域填色（依缺口分段） */}
        {fillArea &&
          view.segViews.map((sv, i) =>
            sv.single ? null : (
              <path key={`a-${i}`} d={sv.areaPath} fill={lineColor} fillOpacity={0.15} />
            ),
          )}

        {/* 主線（依缺口分段；單點段畫小圓點） */}
        {view.segViews.map((sv, i) =>
          sv.single ? (
            <circle
              key={`s-${i}`}
              cx={view.xScale(sv.first.t)}
              cy={view.yScale(sv.first.v)}
              r={1.6}
              fill={lineColor}
            />
          ) : (
            <polyline
              key={`s-${i}`}
              points={sv.pts}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ),
        )}

        {/* 最末點 marker */}
        <circle
          cx={view.xScale(data[data.length - 1]!.t)}
          cy={view.yScale(data[data.length - 1]!.v)}
          r={2.2}
          fill={lineColor}
        />

        {/* 第二條線（extraSeries，opt-in；依缺口分段，同主線邏輯但不填色） */}
        {extraSeries &&
          view.extraSegViews.map((sv, i) =>
            sv.single ? (
              <circle
                key={`es-${i}`}
                cx={view.xScale(sv.first.t)}
                cy={view.yScale(sv.first.v)}
                r={1.6}
                fill={extraSeries.color}
              />
            ) : (
              <polyline
                key={`es-${i}`}
                data-testid="sparkline-extra-line"
                points={sv.pts}
                fill="none"
                stroke={extraSeries.color}
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ),
          )}
        {extraSeries && extraSeries.data.length > 0 && (
          <circle
            cx={view.xScale(extraSeries.data[extraSeries.data.length - 1]!.t)}
            cy={view.yScale(extraSeries.data[extraSeries.data.length - 1]!.v)}
            r={2.2}
            fill={extraSeries.color}
          />
        )}

        {/* X 軸時間 tick（貼邊者換錨點避免裁切） */}
        {view.timeTicks.map((tk, i) => (
          <text
            key={`x-${i}`}
            x={tk.x}
            y={height - 2}
            fontSize={8}
            textAnchor={tk.x < PAD_L + 12 ? "start" : tk.x > w - PAD_R - 12 ? "end" : "middle"}
            fill="rgba(255,255,255,0.5)"
            fontFamily="monospace"
          >
            {tk.label}
          </text>
        ))}

        {/* 單位（右上角） */}
        {unit && (
          <text
            x={w - PAD_R}
            y={PAD_T + 8}
            fontSize={8}
            textAnchor="end"
            fill="rgba(255,255,255,0.4)"
            fontFamily="monospace"
          >
            {unit}
          </text>
        )}

        {/* Hover tooltip（opt-in）：指示線 + 資料點圓點 + 日期/數值 box，靠邊翻轉避免被裁掉 */}
        {showTooltip &&
          view &&
          hoverIdx != null &&
          hoverIdx < data.length &&
          (() => {
            const hp = data[hoverIdx]!;
            const x = view.xScale(hp.t);
            const yMain = view.yScale(hp.v);
            const extraV = view.extraByT?.get(hp.t);
            const yExtra = extraV != null ? view.yScale(extraV) : null;

            const lines: { text: string; dot?: string }[] = [
              { text: fmtTooltipDate(hp.t, tooltipDateFormat) },
              { text: `${seriesLabel ? seriesLabel + " " : ""}${fmtTooltipValue(hp.v, unit)}`, dot: lineColor },
            ];
            if (extraSeries && extraV != null) {
              lines.push({
                text: `${extraSeries.label ? extraSeries.label + " " : ""}${fmtTooltipValue(extraV, unit)}`,
                dot: extraSeries.color,
              });
            }

            const charW = 5;
            const boxW = Math.max(...lines.map((l) => l.text.length)) * charW + 18;
            const lineH = 11;
            const boxH = lines.length * lineH + 8;
            const gap = 6;

            let boxX = x + gap;
            if (boxX + boxW > w - PAD_R) boxX = x - gap - boxW;
            boxX = Math.max(PAD_L, Math.min(boxX, w - PAD_R - boxW));

            const topY = yExtra != null ? Math.min(yMain, yExtra) : yMain;
            const bottomY = yExtra != null ? Math.max(yMain, yExtra) : yMain;
            let boxY = topY - gap - boxH;
            if (boxY < PAD_T) boxY = bottomY + gap;
            boxY = Math.max(PAD_T, Math.min(boxY, height - PAD_B - boxH));

            return (
              <g data-testid="sparkline-tooltip" pointerEvents="none">
                <line
                  x1={x} x2={x} y1={PAD_T} y2={height - PAD_B}
                  stroke={WHITE_ALPHA[20]} strokeWidth={1} strokeDasharray="2 2"
                />
                <circle cx={x} cy={yMain} r={2.6} fill={lineColor} stroke={SURFACE.solid} strokeWidth={1} />
                {yExtra != null && (
                  <circle cx={x} cy={yExtra} r={2.6} fill={extraSeries!.color} stroke={SURFACE.solid} strokeWidth={1} />
                )}
                <rect
                  x={boxX} y={boxY} width={boxW} height={boxH}
                  rx={RADIUS.md} fill={SURFACE.solid} stroke={BORDER.panel} strokeWidth={1}
                />
                {lines.map((l, i) => (
                  <g key={i}>
                    {l.dot && (
                      <circle cx={boxX + 8} cy={boxY + 4 + i * lineH + lineH / 2} r={2} fill={l.dot} />
                    )}
                    <text
                      x={boxX + (l.dot ? 14 : 6)}
                      y={boxY + 4 + i * lineH + lineH / 2 + 3}
                      fontSize={8}
                      fill={i === 0 ? COLORS.textStrong : COLORS.textDefault}
                      fontFamily="monospace"
                    >
                      {l.text}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
