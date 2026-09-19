/**
 * Timeline control adapter for the local research bridge.
 *
 * The adapter deliberately owns no clock. App supplies useTimeline's actions,
 * which remain the sole writer of timeStore.
 */

export const TIMELINE_SPEEDS = [30, 60, 120, 300, 600, 1800, 3600] as const;
export type TimelineSpeed = (typeof TIMELINE_SPEEDS)[number];
export type TimelineControlMode = "live" | "replay";

export type TimelineControlChange =
  | { mode: "live"; playing?: false; speed?: TimelineSpeed }
  | { mode: "replay"; time: number; playing?: boolean; speed?: TimelineSpeed };
/** Names consumed by the research bridge. */
export type TimelineChange = TimelineControlChange;

export type TimelineAvailability = "not_loaded" | "loading" | "available" | "empty" | "unknown";

export interface TimelineControl {
  getContext(): Record<string, unknown>;
  apply(change: TimelineControlChange): Promise<void> | void;
}
/** Name consumed by MainMapConnection. */
export type TimelineAdapter = TimelineControl;

export interface TimelineActions {
  setTimeMode(mode: TimelineControlMode): void;
  jumpToTime(time: number): void;
  play(): void;
  pause(): void;
  setSpeed(speed: number): void;
}

export interface TimelineSnapshot {
  currentTime: number;
  mode: TimelineControlMode;
  playing: boolean;
  speed: number;
  windowStart: number;
  windowEnd: number;
}

export interface ShipDateAvailability {
  state: TimelineAvailability;
  dates: readonly string[];
}

export interface TimelineControlOptions {
  /** Read on demand so a bridge query sees App's latest UI action closures. */
  getTimeline(): TimelineSnapshot & TimelineActions;
  /** Reads timeStore at query time; avoids the UI's intentionally throttled clock. */
  getCurrentTime?: () => number;
  getShipDates(): ShipDateAvailability;
  /** The multi-year HistoricalTimeline owns another interaction mode. */
  isHistoricalModeActive?: () => boolean;
  /** Needed only when a live → replay command also asks to start playback. */
  afterModeChange?: () => Promise<void>;
}

function taipeiDateKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function isTaipeiDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isFinite(parsed.getTime()) && taipeiDateKey(parsed.getTime() / 1000) === date;
}

function knownDateBounds(dates: readonly string[]): { start: string; end: string } | null {
  const valid = [...new Set(dates.filter(isTaipeiDateKey))];
  if (valid.length === 0) return null;
  valid.sort();
  return { start: valid[0]!, end: valid[valid.length - 1]! };
}

function normalizeShipDates(value: ShipDateAvailability): ShipDateAvailability {
  return { state: value.state, dates: [...new Set(value.dates.filter(isTaipeiDateKey))].sort() };
}

function isUnixSeconds(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 4_102_444_800;
}

function isTimelineSpeed(value: number): value is TimelineSpeed {
  return (TIMELINE_SPEEDS as readonly number[]).includes(value);
}

function defaultAfterModeChange(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Builds the bridge-facing contract without creating a second timeline state.
 * HistoricalTimeline's multi-year selector is intentionally not exposed here:
 * this adapter only controls the map's daily live/replay timeline.
 */
export function createTimelineControl(options: TimelineControlOptions): TimelineControl {
  return {
    getContext(): Record<string, unknown> {
      const timeline = options.getTimeline();
      const ships = normalizeShipDates(options.getShipDates());
      const currentTime = options.getCurrentTime?.() ?? timeline.currentTime;
      const recentShipDates = ships.dates.slice(-100);
      return {
        timezone: "Asia/Taipei",
        timelineKind: "daily_replay",
        historicalMultiYearControl: "unavailable",
        historicalMultiYearMode: options.isHistoricalModeActive?.() ? "active" : "inactive",
        mode: timeline.mode,
        currentTime,
        currentDate: taipeiDateKey(currentTime),
        playing: timeline.playing,
        speed: timeline.speed,
        replayWindow: { start: timeline.windowStart, end: timeline.windowEnd },
        ships: {
          availability: ships.state,
          dates: recentShipDates,
          totalDates: ships.dates.length,
          datesTruncated: ships.dates.length > recentShipDates.length,
          bounds: knownDateBounds(ships.dates),
        },
        buses: { availability: "unknown" },
      };
    },

    async apply(change: TimelineControlChange): Promise<void> {
      if (options.isHistoricalModeActive?.()) throw new Error("TIMELINE_HISTORICAL_MODE_ACTIVE");
      const timeline = options.getTimeline();
      if (change.speed !== undefined && !isTimelineSpeed(change.speed)) {
        throw new Error("TIMELINE_SPEED_UNSUPPORTED");
      }

      if (change.mode === "live") {
        if ("time" in change) throw new Error("TIMELINE_LIVE_TIME_FORBIDDEN");
        if ((change as { playing?: boolean }).playing === true) throw new Error("TIMELINE_LIVE_CANNOT_PLAY");
        if (change.speed !== undefined) timeline.setSpeed(change.speed);
        timeline.pause();
        timeline.setTimeMode("live");
        return;
      }

      if (!isUnixSeconds(change.time)) throw new Error("TIMELINE_REPLAY_TIME_REQUIRED");
      if (change.speed !== undefined) timeline.setSpeed(change.speed);
      timeline.jumpToTime(change.time);
      if (change.playing === undefined) return;

      // jumpToTime changes React mode state. Read the refreshed useTimeline actions
      // after React has committed before requesting playback.
      await (options.afterModeChange ?? defaultAfterModeChange)();
      const refreshed = options.getTimeline();
      if (change.playing) refreshed.play();
      else refreshed.pause();
    },
  };
}
