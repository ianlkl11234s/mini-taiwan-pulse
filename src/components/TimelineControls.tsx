import { useState } from "react";
import type { TimeMode } from "../types";

interface Props {
  playing: boolean;
  speed: number;
  progress: number;
  currentTime: number;
  timeMode: TimeMode;
  selectedDate: Date;
  rangeDays: number;
  windowStart: number;
  windowEnd: number;
  isDarkTheme?: boolean;
  isMobile?: boolean;
  leftOffset?: number;
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onSeekByProgress: (p: number) => void;
  onTimeModeChange: (mode: TimeMode) => void;
  onDateChange: (d: Date) => void;
  onShiftDate: (days: number) => void;
  onRangeDaysChange: (n: number) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
  backdropFilter: "blur(8px)",
});

function formatTime(t: number): string {
  if (t <= 0) return "--:--";
  const d = new Date(t * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

function formatDateLabel(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = WEEKDAYS[d.getDay()]!;
  return `${m}/${day} (${wd})`;
}

function formatRangeLabel(start: Date, days: number): string {
  if (days <= 1) return formatDateLabel(start);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()} (${days}天)`;
}

function formatSliderLabel(t: number, rangeDays: number): string {
  if (t <= 0) return "--:--";
  const d = new Date(t * 1000);
  if (rangeDays > 1) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd} 00:00`;
  }
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

export function TimelineControls({
  playing,
  speed,
  progress,
  currentTime,
  timeMode,
  selectedDate,
  rangeDays,
  windowStart,
  windowEnd,
  isDarkTheme = true,
  isMobile = false,
  leftOffset = 16,
  onToggle,
  onSpeedChange,
  onSeekByProgress,
  onTimeModeChange,
  onDateChange,
  onShiftDate,
  onRangeDaysChange,
}: Props) {
  const isLive = timeMode === "live";
  const dark = isDarkTheme;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const arrowBtn: React.CSSProperties = {
    ...getBtnStyle(dark),
    padding: "2px 8px",
    fontSize: 12,
    lineHeight: 1,
  };

  return (
    <div
      style={isMobile ? {} : {
        position: "absolute",
        bottom: 16,
        left: leftOffset,
        zIndex: 10,
        width: 340,
        transition: "left 0.2s ease",
      }}
    >
      {/* Row 1: Date navigation */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <button onClick={() => onShiftDate(-1)} style={arrowBtn} title="前一天">◀</button>

        <button
          onClick={() => setShowDatePicker((v) => !v)}
          style={{
            ...getBtnStyle(dark),
            fontSize: 13,
            fontWeight: 600,
            padding: "3px 10px",
            minWidth: 110,
            textAlign: "center",
          }}
          title="選擇日期"
        >
          {formatRangeLabel(selectedDate, rangeDays)}
        </button>

        <button onClick={() => onShiftDate(1)} style={arrowBtn} title="後一天">▶</button>

        {/* Now button */}
        <button
          onClick={() => {
            if (isLive) {
              onTimeModeChange("replay");
            } else {
              onTimeModeChange("live");
            }
          }}
          style={{
            ...getBtnStyle(dark),
            fontSize: 11,
            padding: "3px 8px",
            fontWeight: isLive ? 700 : 400,
            letterSpacing: isLive ? 1 : 0,
            background: isLive
              ? "rgba(76,175,80,0.35)"
              : (dark ? "rgba(120,120,120,0.35)" : "rgba(255,255,255,0.9)"),
            border: isLive
              ? "1px solid rgba(76,175,80,0.6)"
              : `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
            color: isLive ? "#4caf50" : (dark ? "rgba(220,220,220,0.9)" : "#555"),
          }}
        >
          {isLive ? "LIVE" : "Now"}
        </button>

        {/* Range days selector */}
        <select
          value={rangeDays}
          onChange={(e) => onRangeDaysChange(Number(e.target.value))}
          style={{ ...getSelectStyle(dark), fontSize: 11, padding: "3px 4px" }}
          title="顯示天數"
        >
          <option value={1}>1d</option>
          <option value={3}>3d</option>
          <option value={7}>7d</option>
        </select>
      </div>

      {/* Date picker popup (native input fallback) */}
      {showDatePicker && (
        <div style={{ marginBottom: 6 }}>
          <input
            type="date"
            value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`}
            onChange={(e) => {
              const parts = e.target.value.split("-").map(Number);
              if (parts.length === 3) {
                onDateChange(new Date(parts[0]!, parts[1]! - 1, parts[2]!));
                setShowDatePicker(false);
              }
            }}
            style={{
              ...getSelectStyle(dark),
              width: "100%",
              fontSize: 14,
              padding: "6px 8px",
            }}
          />
        </div>
      )}

      {/* Row 2: Playback controls (browse mode only) */}
      {!isLive && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <button onClick={onToggle} style={{
            ...getBtnStyle(dark),
            ...(isMobile ? { width: 44, height: 44, fontSize: 18, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" } : {}),
          }}>
            {playing ? "\u23F8" : "\u25B6"}
          </button>

          <select
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            style={getSelectStyle(dark)}
          >
            <option value={30}>30x</option>
            <option value={60}>60x</option>
            <option value={120}>120x</option>
            <option value={300}>300x</option>
            <option value={600}>600x</option>
            <option value={1800}>1800x</option>
            <option value={3600}>3600x</option>
          </select>

          <span
            style={{
              color: dark ? "rgba(200,200,200,0.7)" : "rgba(0,0,0,0.5)",
              fontSize: 14,
              fontFamily: "monospace",
              fontWeight: 600,
            }}
          >
            {formatTime(currentTime)}
          </span>
        </div>
      )}

      {/* Live mode: show current time */}
      {isLive && (
        <div style={{
          fontSize: 14,
          fontFamily: "monospace",
          fontWeight: 600,
          color: "#4caf50",
          marginBottom: 6,
        }}>
          {formatTime(currentTime)}
        </div>
      )}

      {/* Timeline slider (browse mode only) */}
      {!isLive && (
        <>
          <input
            type="range"
            min={0}
            max={1}
            step={0.0005}
            value={progress}
            onChange={(e) => onSeekByProgress(Number(e.target.value))}
            style={{ width: "100%", height: isMobile ? 8 : undefined, accentColor: dark ? "#aaa" : "#bbb" }}
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
            <span>{formatSliderLabel(windowStart, rangeDays)}</span>
            <span>{formatSliderLabel(windowEnd, rangeDays)}</span>
          </div>
        </>
      )}
    </div>
  );
}
