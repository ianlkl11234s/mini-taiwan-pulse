interface Props {
  playing: boolean;
  speed: number;
  progress: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onSeekByProgress: (p: number) => void;
}

const btnStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
};

const selectStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 13,
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
};

function formatTime(t: number): string {
  if (t <= 0) return "--:--";
  const d = new Date(t * 1000);
  return d.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function TimelineControls({
  playing,
  speed,
  progress,
  currentTime,
  startTime,
  endTime,
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
        <button onClick={onToggle} style={btnStyle}>
          {playing ? "\u23F8" : "\u25B6"}
        </button>

        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={30}>30x</option>
          <option value={60}>60x</option>
          <option value={120}>120x</option>
          <option value={300}>300x</option>
          <option value={600}>600x</option>
        </select>

        <span
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          {formatTime(currentTime)}
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
        style={{ width: "100%", accentColor: "#66aaff" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "rgba(255,255,255,0.4)",
          fontSize: 10,
          fontFamily: "monospace",
          marginTop: 2,
        }}
      >
        <span>{formatTime(startTime)}</span>
        <span>{formatTime(endTime)}</span>
      </div>
    </div>
  );
}
