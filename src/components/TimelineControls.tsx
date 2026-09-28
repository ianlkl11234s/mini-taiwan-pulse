import { useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { TimeMode } from "../types";
import { getGfwHourlyGridDataWindowSnapshot, subscribeGfwHourlyGridDataWindow } from "../state/gfwHourlyGridDataWindowStore";
import { useGfwV4TrackDataWindow } from "../state/gfwV4TrackDataWindowStore";
import { formatGfwUtcWindow, nearestGfwWindowHour, utcDateWindowSeconds } from "../state/gfwTimelineDataWindow";
import { TimeAxis } from "./timeline/TimeAxis";
import {
  buildLiveTicks,
  describeDataWindow,
  formatClock,
  formatMonthDay,
  gapsOutsideDataWindow,
  keyboardSeekTarget,
  weekdayLabel,
  type AxisGap,
} from "./timeline/timelineAxis";
import "./timeline/timeline.css";
import { Z_INDEX } from "../styles/designTokens";

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

const SPEEDS = [30, 60, 120, 300, 600, 1800, 3600];
const RANGE_DAYS = [1, 2, 3, 4, 5, 6, 7];
/** 卡片右側預留給右下停靠 popup（280px）＋間距，避免互相遮住 */
const RIGHT_RESERVE = 312;

export function formatTaiwanDateInputValue(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function parseTaiwanDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

interface DataWindowNotice {
  key: string;
  subject: string;
  gaps: AxisGap[];
  text: string | null;
  title: string;
  /** 目前時間落在資料窗外時，才提供「跳至可用時段」 */
  jumpTarget: number | null;
}

const GFW_SUBJECT: Record<string, string> = { Grid: "漁船熱區", Tracks: "漁船航跡" };

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isFuture = currentTime > Date.now() / 1000;
  const gridWindow = useSyncExternalStore(
    subscribeGfwHourlyGridDataWindow,
    getGfwHourlyGridDataWindowSnapshot,
    () => null,
  );
  const trackWindow = useGfwV4TrackDataWindow();

  // 漁船資料窗：軸上以斜線標出視窗內「不在資料窗」的時段；目前時間落在窗外時另給跳轉。
  const candidates: { layer: string; start: number; end: number; first: string; last: string; outOfWindow: boolean }[] = [];
  if (gridWindow) {
    const start = Date.parse(gridWindow.startIso) / 1000;
    const end = Date.parse(gridWindow.endIsoExclusive) / 1000;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      candidates.push({
        layer: "Grid",
        start,
        end,
        first: gridWindow.startIso.slice(0, 10),
        last: gridWindow.latestCompleteDate || new Date((end - 1) * 1000).toISOString().slice(0, 10),
        outOfWindow: gridWindow.status === "out-of-window",
      });
    }
  }
  if (trackWindow.status !== "unknown" && trackWindow.startUtcDate && trackWindow.endUtcDate) {
    const seconds = utcDateWindowSeconds(trackWindow.startUtcDate, trackWindow.endUtcDate);
    if (seconds) {
      candidates.push({
        layer: "Tracks",
        start: seconds.startUtcSeconds,
        end: seconds.endUtcSecondsExclusive,
        first: trackWindow.startUtcDate,
        last: trackWindow.endUtcDate,
        outOfWindow: trackWindow.status === "out-of-window",
      });
    }
  }
  const noticeMap = new Map<string, DataWindowNotice>();
  for (const c of candidates) {
    const key = `${c.start}|${c.end}`;
    const prev = noticeMap.get(key);
    const subject = prev ? "漁船資料" : GFW_SUBJECT[c.layer] ?? "漁船資料";
    const gaps = gapsOutsideDataWindow(windowStart, windowEnd, c.start, c.end);
    const jumpTarget = c.outOfWindow || prev?.jumpTarget != null
      ? nearestGfwWindowHour(currentTime, c.start, c.end)
      : null;
    noticeMap.set(key, {
      key,
      subject,
      gaps,
      text: describeDataWindow(subject, windowStart, windowEnd, c.start, c.end, c.first, c.last),
      title: `可用 ${formatGfwUtcWindow(c.start, c.end)}`,
      jumpTarget,
    });
  }
  const notices = [...noticeMap.values()].filter((n) => n.gaps.length > 0 || n.jumpTarget !== null);
  const gaps = notices.flatMap((n) => n.gaps);

  const duration = windowEnd - windowStart;
  const ticks = buildLiveTicks(windowStart, windowEnd, rangeDays);

  // 即時模式下 seek 是 no-op：改用 jumpToTime（會切到回放並停在該時刻，與既有「跳至」語意相同）
  const seekTo = (time: number) => {
    if (isLive) onJumpToTime(time);
    else if (duration > 0) onSeekByProgress((time - windowStart) / duration);
  };

  const clock = formatClock(currentTime);
  const needleLabel = rangeDays > 1 && currentTime > 0 ? `${formatMonthDay(currentTime)} ${clock}` : clock;
  const multiDay = rangeDays > 1;
  const lastDay = windowEnd - 1;

  const rootClass = [
    "tl3",
    isDarkTheme ? "" : "tl3--light",
    isMobile ? "tl3--mobile" : "",
  ].filter(Boolean).join(" ");

  const rootStyle: React.CSSProperties = isMobile
    ? {}
    : {
        position: "absolute",
        bottom: 16,
        left: leftOffset,
        // 時間軸屬地圖控制列，刻意維持 mapOverlay（10），在浮動面板（20）之下
        zIndex: Z_INDEX.mapOverlay,
        width: 620,
        maxWidth: `calc(100vw - ${leftOffset + RIGHT_RESERVE}px)`,
        minWidth: 320,
        transition: "left 0.2s ease",
      };

  return (
    <div data-viewport-occluder="timeline" className={rootClass} style={rootStyle}>
      <div className="tl3-top">
        {isLive ? (
          <button
            type="button"
            className="tl3-btn tl3-btn--primary tl3-btn--play"
            onClick={() => onTimeModeChange("replay")}
            title="暫停即時（切換為回放）"
            aria-label="暫停即時，切換為回放"
          >
            <Pause size={13} fill="currentColor" strokeWidth={0} />
          </button>
        ) : (
          <button
            type="button"
            className="tl3-btn tl3-btn--primary tl3-btn--play"
            onClick={onToggle}
            title={playing ? "暫停" : "播放"}
            aria-label={playing ? "暫停" : "播放"}
          >
            {playing ? <Pause size={13} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} />}
          </button>
        )}
        <span className={isFuture && !isLive ? "tl3-clock tl3-clock--future" : "tl3-clock"}>{clock}</span>
        {isLive && (
          <span className="tl3-live"><i />即時</span>
        )}
        {isFuture && !isLive && (
          <span className="tl3-warnchip" role="status" title="此時間尚未到達，沒有最新資料">尚無資料</span>
        )}
        <select
          className="tl3-select tl3-select--mono"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          title="播放倍速"
          aria-label="播放倍速"
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>

        <span className="tl3-group tl3-group--end">
          <button type="button" className="tl3-btn tl3-btn--icon tl3-btn--ghost" onClick={() => onShiftDate(-1)} title="前一天" aria-label="前一天">
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            className="tl3-btn tl3-btn--ghost tl3-date"
            onClick={() => setShowDatePicker((v) => !v)}
            title="選擇日期"
            aria-label="選擇日期"
            aria-expanded={showDatePicker}
            style={{ padding: "0 4px" }}
          >
            <span className="mono">{formatMonthDay(windowStart)}</span>
            {multiDay ? (
              <>–<span className="mono">{formatMonthDay(lastDay)}</span></>
            ) : (
              <span className="tl3-date-dim">（{weekdayLabel(windowStart)}）</span>
            )}
          </button>
          <button type="button" className="tl3-btn tl3-btn--icon tl3-btn--ghost" onClick={() => onShiftDate(1)} title="後一天" aria-label="後一天">
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            className="tl3-btn"
            aria-pressed={isLive}
            onClick={() => { if (!isLive) onTimeModeChange("live"); }}
            title={isLive ? "目前為即時" : "回到現在（即時）"}
          >
            現在
          </button>
          <select
            className="tl3-select"
            value={rangeDays}
            onChange={(e) => onRangeDaysChange(Number(e.target.value))}
            title="顯示天數"
            aria-label="顯示天數"
          >
            {RANGE_DAYS.map((n) => <option key={n} value={n}>{n} 天</option>)}
          </select>
        </span>
      </div>

      {showDatePicker && (
        <div className="tl3-top">
          <input
            type="date"
            className="tl3-date-input"
            aria-label="日期"
            value={formatTaiwanDateInputValue(selectedDate)}
            onChange={(e) => {
              const date = parseTaiwanDateInputValue(e.target.value);
              if (date) {
                onDateChange(date);
                setShowDatePicker(false);
              }
            }}
          />
        </div>
      )}

      <TimeAxis
        ratio={progress}
        ticks={ticks}
        gaps={gaps}
        gapTitle="斜線＝該時段無資料"
        needleLabel={needleLabel}
        ariaLabel="時間軸"
        ariaValueMin={windowStart}
        ariaValueMax={windowEnd}
        ariaValueNow={Math.round(currentTime)}
        ariaValueText={needleLabel}
        // 指標拖曳對齊到整分鐘（避免 15:59:59 這種顯示）
        onSeekRatio={(r) => seekTo(Math.min(windowEnd, Math.round((windowStart + r * duration) / 60) * 60))}
        onKey={(key, shiftKey) => {
          const next = keyboardSeekTarget(key, shiftKey, currentTime, windowStart, windowEnd);
          if (next === null) return false;
          seekTo(next);
          return true;
        }}
      />

      {notices.length > 0 && (
        <div className="tl3-notes" role="status">
          {notices.map((n) => (
            <span key={n.key} className="tl3-group">
              {n.text && <span className="tl3-warnchip" title={n.title}>{n.text}</span>}
              {n.jumpTarget !== null && (
                <button
                  type="button"
                  className="tl3-btn tl3-btn--small"
                  onClick={() => { if (n.jumpTarget !== null) onJumpToTime(n.jumpTarget); }}
                  title={n.title}
                >
                  跳至可用時段
                </button>
              )}
            </span>
          ))}
          {gaps.length > 0 && <span className="tl3-hint">斜線＝該時段無資料</span>}
        </div>
      )}
    </div>
  );
}
