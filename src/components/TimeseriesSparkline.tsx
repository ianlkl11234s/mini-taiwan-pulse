import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONT_SIZE } from "../styles/designTokens";

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
function fmtTick(v: number, step: number): string {
  if (Math.abs(v) >= 1000 && step >= 1000) {
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
}: TimeseriesSparklineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(DEFAULT_W);

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
    const vals = data.map((d) => d.v);
    let vMin = Math.min(...vals);
    let vMax = Math.max(...vals);
    // 把警戒線也納入 y 範圍，否則警戒線可能跑出畫面
    if (warningValue != null) {
      vMin = Math.min(vMin, warningValue);
      vMax = Math.max(vMax, warningValue);
    }
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

    // 缺口分段：相鄰點時距 > gapSec → 斷線（不跨接），避免缺快照被讀成低谷
    const segments: SparklinePoint[][] = [];
    let cur: SparklinePoint[] = [];
    for (const d of data) {
      if (cur.length > 0 && gapSec != null && d.t - cur[cur.length - 1]!.t > gapSec) {
        segments.push(cur);
        cur = [];
      }
      cur.push(d);
    }
    segments.push(cur);

    const baseY = (height - PAD_B).toFixed(1);
    const segViews = segments.map((seg) => {
      const pts = seg.map((d) => `${xScale(d.t).toFixed(1)},${yScale(d.v).toFixed(1)}`).join(" ");
      const areaPath =
        `M${xScale(seg[0]!.t).toFixed(1)},${baseY} ` +
        `L${pts.split(" ").join(" L")} ` +
        `L${xScale(seg[seg.length - 1]!.t).toFixed(1)},${baseY} Z`;
      return { pts, areaPath, single: seg.length === 1, first: seg[0]! };
    });

    // X 軸時間 tick：取整點（local）、步距依範圍選 1/2/4/8h，最多 ~4 個
    const rangeH = (tMax - tMin) / 3600;
    const stepH = rangeH <= 4 ? 1 : rangeH <= 9 ? 2 : rangeH <= 18 ? 4 : 8;
    const timeTicks: { x: number; label: string }[] = [];
    for (let t = Math.ceil(tMin / 3600) * 3600; t <= tMax; t += 3600) {
      const d = new Date(t * 1000);
      if (d.getHours() % stepH !== 0 || d.getMinutes() !== 0) continue;
      timeTicks.push({ x: xScale(t), label: `${d.getHours().toString().padStart(2, "0")}:00` });
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

    return { tMin, tMax, yLo, yHi, ticks, tickStep, xScale, yScale, segViews, timeTicks };
  }, [data, warningValue, height, w, gapSec]);

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
                {fmtTick(tv, view.tickStep)}
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
      </svg>
    </div>
  );
}
