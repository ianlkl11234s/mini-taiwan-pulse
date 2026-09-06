import { useState, useSyncExternalStore } from "react";
import type { TimeMode } from "../types";
import { FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { getGfwHourlyGridDataWindowSnapshot, subscribeGfwHourlyGridDataWindow } from "../state/gfwHourlyGridDataWindowStore";
import { useGfwV4TrackDataWindow } from "../state/gfwV4TrackDataWindowStore";
import { formatGfwUtcWindow, mergeGfwTimelineWindows, nearestGfwWindowHour, utcDateWindowSeconds, type GfwTimelineWindow } from "../state/gfwTimelineDataWindow";

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
  onJumpToTime: (time: number) => void;
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
  backdropFilter: "blur(8px)",
});

/** 用台灣時區格式化時間，避免瀏覽器本地時區偏差 */
function formatTime(t: number): string {
  if (t <= 0) return "--:--";
  const d = new Date(t * 1000);
  return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateLabel(d: Date): string {
  const s = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const [, m, day] = s.split("-").map(Number);
  const wd = WEEKDAYS[new Date(d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })).getDay()] ??
    d.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei", weekday: "short" });
  return `${m}/${day} (${wd})`;
}

function formatRangeLabel(start: Date, days: number): string {
  if (days <= 1) return formatDateLabel(start);
  const end = new Date(start.getTime() + (days - 1) * 86400 * 1000);
  const ss = start.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const es = end.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const [, sm, sd] = ss.split("-").map(Number);
  const [, em, ed] = es.split("-").map(Number);
  return `${sm}/${sd} ~ ${em}/${ed} (${days}天)`;
}

function formatSliderLabel(t: number, rangeDays: number): string {
  if (t <= 0) return "--:--";
  if (rangeDays > 1) {
    const s = new Date(t * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    const [, mm, dd] = s.split("-");
    return `${mm}/${dd} 00:00`;
  }
  return formatTime(t);
}

export function formatTaiwanDateInputValue(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function parseTaiwanDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isFinite(date.getTime()) ? date : null;
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
  onJumpToTime,
  onTimeModeChange,
  onDateChange,
  onShiftDate,
  onRangeDaysChange,
}: Props) {
  const isLive = timeMode === "live";
  const dark = isDarkTheme;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isFuture = currentTime > Date.now() / 1000;
  const gridWindow = useSyncExternalStore(
    subscribeGfwHourlyGridDataWindow,
    getGfwHourlyGridDataWindowSnapshot,
    () => null,
  );
  const trackWindow = useGfwV4TrackDataWindow();
  const outOfWindow: GfwTimelineWindow[] = [];
  if (gridWindow?.status === "out-of-window") {
    const startUtcSeconds = Date.parse(gridWindow.startIso) / 1000;
    const endUtcSecondsExclusive = Date.parse(gridWindow.endIsoExclusive) / 1000;
    if (Number.isFinite(startUtcSeconds) && Number.isFinite(endUtcSecondsExclusive)) {
      outOfWindow.push({ layers: ["Grid"], startUtcSeconds, endUtcSecondsExclusive });
    }
  }
  if (trackWindow.status === "out-of-window" && trackWindow.startUtcDate && trackWindow.endUtcDate) {
    const seconds = utcDateWindowSeconds(trackWindow.startUtcDate, trackWindow.endUtcDate);
    if (seconds) {
      outOfWindow.push({
        layers: ["Tracks"],
        ...seconds,
      });
    }
  }
  const gfwWindowNotices = mergeGfwTimelineWindows(outOfWindow);

  const arrowBtn: React.CSSProperties = {
    ...getBtnStyle(dark),
    padding: "2px 8px",
    fontSize: FONT_SIZE.md,
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
            fontSize: FONT_SIZE.lg,
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
            fontSize: FONT_SIZE.base,
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
          style={{ ...getSelectStyle(dark), fontSize: FONT_SIZE.base, padding: "3px 4px" }}
          title="顯示天數"
        >
          <option value={1}>1d</option>
          <option value={2}>2d</option>
          <option value={3}>3d</option>
          <option value={4}>4d</option>
          <option value={5}>5d</option>
          <option value={6}>6d</option>
          <option value={7}>7d</option>
        </select>
      </div>

      {/* Date picker popup (native input fallback) */}
      {showDatePicker && (
        <div style={{ marginBottom: 6 }}>
          <input
            type="date"
            value={formatTaiwanDateInputValue(selectedDate)}
            onChange={(e) => {
              const date = parseTaiwanDateInputValue(e.target.value);
              if (date) {
                onDateChange(date);
                setShowDatePicker(false);
              }
            }}
            style={{
              ...getSelectStyle(dark),
              width: "100%",
              fontSize: FONT_SIZE.lg,
              padding: "6px 8px",
            }}
          />
        </div>
      )}

      {gfwWindowNotices.map((window) => {
        const jumpTarget = nearestGfwWindowHour(
          currentTime,
          window.startUtcSeconds,
          window.endUtcSecondsExclusive,
        );
        return (
          <div
            key={`${window.startUtcSeconds}-${window.endUtcSecondsExclusive}`}
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 6,
              padding: "5px 7px",
              borderRadius: RADIUS.md,
              border: "1px solid rgba(255,152,0,0.45)",
              background: dark ? "rgba(90,55,0,0.72)" : "rgba(255,244,225,0.96)",
              color: dark ? "#ffd08a" : "#7a4500",
              fontSize: FONT_SIZE.sm,
              fontFamily: FONT_DATA,
            }}
          >
            <span>
              GFW {window.layers.join("／")} 資料窗外；可用 {formatGfwUtcWindow(window.startUtcSeconds, window.endUtcSecondsExclusive)}
            </span>
            <button
              type="button"
              disabled={jumpTarget === null}
              onClick={() => { if (jumpTarget !== null) onJumpToTime(jumpTarget); }}
              style={{ ...getBtnStyle(dark), flexShrink: 0, padding: "3px 7px", fontSize: FONT_SIZE.sm }}
            >
              跳至可用時段
            </button>
          </div>
        );
      })}

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
            ...(isMobile ? { width: 44, height: 44, fontSize: FONT_SIZE.xl, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" } : {}),
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
              color: isFuture ? "#ff9800" : (dark ? "rgba(200,200,200,0.7)" : "rgba(0,0,0,0.5)"),
              fontSize: FONT_SIZE.lg,
              fontFamily: FONT_DATA,
              fontWeight: 600,
            }}
          >
            {formatTime(currentTime)}
          </span>
          {isFuture && (
            <span
              title="此時間尚未到達，沒有最新資料"
              style={{
                fontSize: FONT_SIZE.base,
                color: "#ff9800",
                background: "rgba(255,152,0,0.12)",
                border: "1px solid rgba(255,152,0,0.4)",
                borderRadius: RADIUS.md,
                padding: "2px 6px",
                fontFamily: FONT_DATA,
              }}
            >
              ⚠ 尚無資料
            </span>
          )}
        </div>
      )}

      {/* Live mode: show current time */}
      {isLive && (
        <div style={{
          fontSize: FONT_SIZE.lg,
          fontFamily: FONT_DATA,
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
              fontSize: FONT_SIZE.sm,
              fontFamily: FONT_DATA,
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
