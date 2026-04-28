export type HistoricalGranularity = "year" | "month" | "day";

interface Props {
  year: number;
  availableYears: number[]; // 民國年，遞增
  playing: boolean;
  speed: number; // 倍速：每秒前進的步數倍率
  granularity: HistoricalGranularity;
  isDarkTheme?: boolean;
  isMobile?: boolean;
  leftOffset?: number;
  onTogglePlay: () => void;
  onSpeedChange: (s: number) => void;
  onYearChange: (y: number) => void;
  onGranularityChange: (g: HistoricalGranularity) => void;
}

const ROC_OFFSET = 1911;

const getBtnStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(120,120,120,0.35)" : "rgba(255,255,255,0.9)",
  color: dark ? "rgba(220,220,220,0.9)" : "#555",
  border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
});

const getSelectStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(120,120,120,0.35)" : "rgba(255,255,255,0.9)",
  color: dark ? "rgba(220,220,220,0.9)" : "#555",
  border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 13,
  fontFamily: "monospace",
});

const granLabel: Record<HistoricalGranularity, string> = {
  year: "年",
  month: "月",
  day: "日",
};

export function HistoricalTimeline({
  year,
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
  onGranularityChange,
}: Props) {
  const dark = isDarkTheme;
  const minYear = availableYears[0] ?? 104;
  const maxYear = availableYears[availableYears.length - 1] ?? 113;
  const isFirst = year <= minYear;
  const isLast = year >= maxYear;

  const wrapStyle: React.CSSProperties = isMobile
    ? {}
    : {
        position: "absolute",
        bottom: 16,
        left: leftOffset,
        zIndex: 10,
        width: 360,
        transition: "left 0.2s ease",
      };

  const granBtn = (g: HistoricalGranularity, disabled = false): React.CSSProperties => ({
    ...getBtnStyle(dark),
    fontSize: 12,
    padding: "3px 10px",
    fontWeight: g === granularity ? 700 : 400,
    color:
      disabled
        ? dark
          ? "rgba(180,180,180,0.4)"
          : "rgba(0,0,0,0.3)"
        : g === granularity
          ? "#4caf50"
          : dark
            ? "rgba(220,220,220,0.9)"
            : "#555",
    background:
      g === granularity && !disabled
        ? "rgba(76,175,80,0.18)"
        : dark
          ? "rgba(120,120,120,0.25)"
          : "rgba(255,255,255,0.9)",
    border: `1px solid ${
      g === granularity && !disabled
        ? "rgba(76,175,80,0.5)"
        : dark
          ? "rgba(255,255,255,0.1)"
          : "rgba(0,0,0,0.08)"
    }`,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div style={wrapStyle}>
      {/* Row 1: 粒度 + 年份標籤 */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <button style={granBtn("year")} onClick={() => onGranularityChange("year")}>
          {granLabel.year}
        </button>
        <button
          style={granBtn("month", true)}
          disabled
          title="目前無月度資料（保留給火災等日後資料）"
        >
          {granLabel.month}
        </button>
        <button
          style={granBtn("day", true)}
          disabled
          title="目前無日資料（保留給火災等日後資料）"
        >
          {granLabel.day}
        </button>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 13,
            fontWeight: 600,
            color: dark ? "rgba(240,240,240,0.95)" : "#222",
            fontFamily: "monospace",
          }}
        >
          民國 {year}（{year + ROC_OFFSET}）
        </span>
      </div>

      {/* Row 2: 播放控制 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <button
          onClick={() => !isFirst && onYearChange(year - 1)}
          style={{ ...getBtnStyle(dark), padding: "2px 8px", fontSize: 12, opacity: isFirst ? 0.4 : 1 }}
          disabled={isFirst}
          title="前一年"
        >
          ◀
        </button>
        <button
          onClick={onTogglePlay}
          style={{
            ...getBtnStyle(dark),
            ...(isMobile
              ? { width: 44, height: 44, fontSize: 18, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }
              : {}),
          }}
          title={playing ? "暫停" : "播放（自動跳年）"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          onClick={() => !isLast && onYearChange(year + 1)}
          style={{ ...getBtnStyle(dark), padding: "2px 8px", fontSize: 12, opacity: isLast ? 0.4 : 1 }}
          disabled={isLast}
          title="後一年"
        >
          ▶
        </button>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={getSelectStyle(dark)}
          title="每秒幾年"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
        <span
          style={{
            fontSize: 11,
            color: dark ? "rgba(180,180,180,0.6)" : "rgba(0,0,0,0.5)",
            fontFamily: "monospace",
          }}
        >
          {minYear}~{maxYear}
        </span>
      </div>

      {/* Row 3: 年份 slider */}
      <input
        type="range"
        min={minYear}
        max={maxYear}
        step={1}
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        style={{ width: "100%", height: isMobile ? 8 : undefined, accentColor: dark ? "#aaa" : "#4caf50" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: dark ? "rgba(180,180,180,0.4)" : "rgba(0,0,0,0.3)",
          fontSize: 10,
          fontFamily: "monospace",
          marginTop: 2,
        }}
      >
        <span>{minYear}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}
