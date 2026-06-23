import { FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";

export type HistoricalGranularity = "year" | "month" | "day" | "quarter";

interface Props {
  year: number;
  month: number; // 1~12
  day: number;   // 1~31
  availableYears: number[]; // 民國年，遞增
  playing: boolean;
  speed: number;
  granularity: HistoricalGranularity;
  isDarkTheme?: boolean;
  isMobile?: boolean;
  leftOffset?: number;
  onTogglePlay: () => void;
  onSpeedChange: (s: number) => void;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
  onDayChange: (d: number) => void;
  onGranularityChange: (g: HistoricalGranularity) => void;
  // 房地產季粒度（僅在 showQuarter 時顯示「季」按鈕與季 slider）
  showQuarter?: boolean;
  periods?: string[];       // 如 ["2024Q3", …, "2026Q1"]
  periodIndex?: number;     // 0..periods.length-1
  onPeriodChange?: (i: number) => void;
}

const ROC_OFFSET = 1911;

const getBtnStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(120,120,120,0.35)" : "rgba(255,255,255,0.9)",
  color: dark ? "rgba(220,220,220,0.9)" : "#555",
  border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
  borderRadius: RADIUS.md,
  padding: "4px 10px",
  fontSize: FONT_SIZE.lg,
  cursor: "pointer",
  fontFamily: FONT_DATA,
  backdropFilter: "blur(8px)",
});

const getSelectStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(120,120,120,0.35)" : "rgba(255,255,255,0.9)",
  color: dark ? "rgba(220,220,220,0.9)" : "#555",
  border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
  borderRadius: RADIUS.md,
  padding: "4px 8px",
  fontSize: FONT_SIZE.lg,
  fontFamily: FONT_DATA,
});

const granLabel: Record<HistoricalGranularity, string> = {
  year: "年",
  month: "月",
  day: "日",
  quarter: "季",
};

function daysInMonth(rocYear: number, month: number): number {
  // 用 AD Date 末日 trick：new Date(year, month, 0) 回傳上個月最後一天
  return new Date(rocYear + ROC_OFFSET, month, 0).getDate();
}

function formatLabel(
  year: number,
  month: number,
  day: number,
  granularity: HistoricalGranularity,
): string {
  const ad = year + ROC_OFFSET;
  if (granularity === "year") return `民國 ${year}（${ad}）`;
  if (granularity === "month") {
    return `民國 ${year}/${String(month).padStart(2, "0")}（${ad}）`;
  }
  return `民國 ${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function HistoricalTimeline({
  year,
  month,
  day,
  availableYears,
  playing,
  speed,
  granularity,
  isDarkTheme = true,
  isMobile = false,
  leftOffset = 16,
  onTogglePlay,
  onSpeedChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  onGranularityChange,
  showQuarter = false,
  periods = [],
  periodIndex = 0,
  onPeriodChange,
}: Props) {
  const dark = isDarkTheme;
  const minYear = availableYears[0] ?? 104;
  const maxYear = availableYears[availableYears.length - 1] ?? 113;
  const dim = daysInMonth(year, month);
  const isQuarter = granularity === "quarter";
  const showMonth = granularity === "month" || granularity === "day";
  const showDay = granularity === "day";
  const periodLabel = isQuarter ? (periods[periodIndex] ?? "—") : formatLabel(year, month, day, granularity);
  const dataNote = isQuarter && periods.length > 0
    ? `房地產：${periods[0]}~${periods[periods.length - 1]}`
    : "火災資料：111~113";

  const wrapStyle: React.CSSProperties = isMobile
    ? {}
    : {
        position: "absolute",
        bottom: 16,
        left: leftOffset,
        zIndex: 10,
        width: 380,
        transition: "left 0.2s ease",
      };

  const granBtn = (g: HistoricalGranularity): React.CSSProperties => {
    const active = g === granularity;
    return {
      ...getBtnStyle(dark),
      fontSize: FONT_SIZE.md,
      padding: "3px 10px",
      fontWeight: active ? 700 : 400,
      color: active ? "#4caf50" : dark ? "rgba(220,220,220,0.9)" : "#555",
      background: active
        ? "rgba(76,175,80,0.18)"
        : dark
          ? "rgba(120,120,120,0.25)"
          : "rgba(255,255,255,0.9)",
      border: `1px solid ${active ? "rgba(76,175,80,0.5)" : dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
      cursor: "pointer",
    };
  };

  const sliderRow = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    dimmed: boolean,
  ): React.ReactNode => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        opacity: dimmed ? 0.45 : 1,
        marginTop: 2,
      }}
    >
      <span
        style={{
          width: 26,
          fontSize: FONT_SIZE.base,
          color: dark ? "rgba(180,180,180,0.7)" : "rgba(0,0,0,0.55)",
          fontFamily: FONT_DATA,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.min(Math.max(value, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={dimmed}
        style={{ flex: 1, accentColor: dark ? "#aaa" : "#4caf50" }}
      />
      <span
        style={{
          minWidth: 36,
          fontSize: FONT_SIZE.base,
          color: dark ? "rgba(220,220,220,0.85)" : "#444",
          fontFamily: FONT_DATA,
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div style={wrapStyle}>
      {/* Row 1: 粒度 + Label */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
        <button style={granBtn("year")} onClick={() => onGranularityChange("year")}>
          {granLabel.year}
        </button>
        <button style={granBtn("month")} onClick={() => onGranularityChange("month")}>
          {granLabel.month}
        </button>
        <button style={granBtn("day")} onClick={() => onGranularityChange("day")}>
          {granLabel.day}
        </button>
        {showQuarter && (
          <button style={granBtn("quarter")} onClick={() => onGranularityChange("quarter")}>
            {granLabel.quarter}
          </button>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: FONT_SIZE.lg,
            fontWeight: 600,
            color: dark ? "rgba(240,240,240,0.95)" : "#222",
            fontFamily: FONT_DATA,
          }}
        >
          {periodLabel}
        </span>
      </div>

      {/* Row 2: 播放控制 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <button
          onClick={onTogglePlay}
          style={{
            ...getBtnStyle(dark),
            ...(isMobile
              ? { width: 44, height: 44, fontSize: FONT_SIZE.xl, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }
              : {}),
          }}
          title={playing ? "暫停" : `播放（依${granLabel[granularity]}推進）`}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={getSelectStyle(dark)}
          title="每秒幾步"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
        <span
          style={{
            fontSize: FONT_SIZE.base,
            color: dark ? "rgba(180,180,180,0.55)" : "rgba(0,0,0,0.5)",
            fontFamily: FONT_DATA,
          }}
        >
          {dataNote}
        </span>
      </div>

      {/* Row 3-5: 季粒度 → 單一季 slider；否則三層 年/月/日 slider */}
      {isQuarter
        ? sliderRow("季", periodIndex, 0, Math.max(0, periods.length - 1), (v) => onPeriodChange?.(v), false)
        : (
          <>
            {sliderRow("年", year, minYear, maxYear, onYearChange, false)}
            {sliderRow("月", month, 1, 12, onMonthChange, !showMonth)}
            {sliderRow("日", day, 1, dim, onDayChange, !showDay)}
          </>
        )}
    </div>
  );
}
