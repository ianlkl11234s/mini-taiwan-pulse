import { useMemo } from "react";

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
}

const W = 256;          // 固定寬，配 popup 280 寬扣 padding
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

function fmtTick(v: number): string {
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
}: TimeseriesSparklineProps) {
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
    const yLo = vMin - pad * 0.2;
    const yHi = vMax + pad;
    const ticks = niceTicks(yLo, yHi, 3);
    const xScale = (t: number) =>
      tMax === tMin ? PAD_L : PAD_L + ((t - tMin) / (tMax - tMin)) * (W - PAD_L - PAD_R);
    const yScale = (v: number) =>
      yHi === yLo ? PAD_T : PAD_T + (1 - (v - yLo) / (yHi - yLo)) * (height - PAD_T - PAD_B);

    const pts = data.map((d) => `${xScale(d.t).toFixed(1)},${yScale(d.v).toFixed(1)}`).join(" ");
    const areaPath =
      `M${xScale(data[0]!.t).toFixed(1)},${(height - PAD_B).toFixed(1)} ` +
      `L${pts.split(" ").join(" L")} ` +
      `L${xScale(data[data.length - 1]!.t).toFixed(1)},${(height - PAD_B).toFixed(1)} Z`;

    // X 軸時間 tick（最多 4 個：起、1/3、2/3、終）
    const timeTicks: { x: number; label: string }[] = [];
    const tickCount = Math.min(4, data.length);
    for (let i = 0; i < tickCount; i++) {
      const t = tMin + ((tMax - tMin) * i) / (tickCount - 1);
      const d = new Date(t * 1000);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      timeTicks.push({ x: xScale(t), label: `${hh}:${mm}` });
    }

    return { tMin, tMax, yLo, yHi, ticks, xScale, yScale, pts, areaPath, timeTicks };
  }, [data, warningValue, height]);

  if (data.length === 0 || !view) {
    return (
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          padding: "8px 4px",
          textAlign: "center",
        }}
      >
        — 過去 24h 無讀值 —
      </div>
    );
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", marginTop: 4 }}
    >
      {/* Y 軸 grid + tick label */}
      {view.ticks.map((tv) => {
        const y = view.yScale(tv);
        return (
          <g key={`y-${tv}`}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
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
              {fmtTick(tv)}
            </text>
          </g>
        );
      })}

      {/* 警戒線 */}
      {warningValue != null && (
        <g>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={view.yScale(warningValue)}
            y2={view.yScale(warningValue)}
            stroke={warningColor}
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
          <text
            x={W - PAD_R - 2}
            y={view.yScale(warningValue) - 2}
            fontSize={8}
            textAnchor="end"
            fill={warningColor}
            fontFamily="monospace"
          >
            {warningLabel} {fmtTick(warningValue)}
          </text>
        </g>
      )}

      {/* 區域填色 */}
      {fillArea && (
        <path d={view.areaPath} fill={lineColor} fillOpacity={0.15} />
      )}

      {/* 主線 */}
      <polyline
        points={view.pts}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 最末點 marker */}
      <circle
        cx={view.xScale(data[data.length - 1]!.t)}
        cy={view.yScale(data[data.length - 1]!.v)}
        r={2.2}
        fill={lineColor}
      />

      {/* X 軸時間 tick */}
      {view.timeTicks.map((tk, i) => (
        <text
          key={`x-${i}`}
          x={tk.x}
          y={height - 2}
          fontSize={8}
          textAnchor={i === 0 ? "start" : i === view.timeTicks.length - 1 ? "end" : "middle"}
          fill="rgba(255,255,255,0.5)"
          fontFamily="monospace"
        >
          {tk.label}
        </text>
      ))}

      {/* 單位（右上角） */}
      {unit && (
        <text
          x={W - PAD_R}
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
  );
}
