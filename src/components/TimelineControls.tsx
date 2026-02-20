interface Props {
  playing: boolean;
  speed: number;
  progress: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  isDarkTheme?: boolean;
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onSeekByProgress: (p: number) => void;
}

const getBtnStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
  color: dark ? "#fff" : "#333",
  border: `1px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
});

const getSelectStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
  color: dark ? "#fff" : "#333",
  border: `1px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 13,
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
});

function formatDateTime(t: number): string {
  if (t <= 0) return "--/-- --:--";
  const d = new Date(t * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function TimelineControls({
  playing,
  speed,
  progress,
  currentTime,
  startTime,
  endTime,
  isDarkTheme = true,
  onToggle,
  onSpeedChange,
  onSeekByProgress,
}: Props) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 10,
      }}
    >
      {/* 控制按鈕列 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <button onClick={onToggle} style={getBtnStyle(isDarkTheme)}>
          {playing ? "\u23F8" : "\u25B6"}
        </button>

        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={getSelectStyle(isDarkTheme)}
        >
          <option value={30}>30x</option>
          <option value={60}>60x</option>
          <option value={120}>120x</option>
          <option value={300}>300x</option>
          <option value={600}>600x</option>
        </select>

        <span
          style={{
            color: isDarkTheme ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          {formatDateTime(currentTime)}
        </span>
      </div>

      {/* 時間軸滑桿 */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        onChange={(e) => onSeekByProgress(Number(e.target.value))}
        style={{ width: "100%", accentColor: isDarkTheme ? "#66aaff" : "#3366cc" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
          fontSize: 10,
          fontFamily: "monospace",
          marginTop: 2,
        }}
      >
        <span>{formatDateTime(startTime)}</span>
        <span>{formatDateTime(endTime)}</span>
      </div>
    </div>
  );
}
