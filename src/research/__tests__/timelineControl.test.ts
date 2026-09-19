import { describe, expect, it, vi } from "vitest";
import { createTimelineControl, type TimelineActions, type TimelineSnapshot } from "../timelineControl";

function makeTimeline(overrides: Partial<TimelineSnapshot> = {}): TimelineSnapshot & TimelineActions {
  return {
    currentTime: 1_789_027_200,
    mode: "replay",
    playing: false,
    speed: 60,
    windowStart: 1_789_011_200,
    windowEnd: 1_789_097_599,
    setTimeMode: vi.fn(),
    jumpToTime: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setSpeed: vi.fn(),
    ...overrides,
  };
}

describe("research timeline adapter", () => {
  it("reports daily Taiwan replay separately from multi-year history, with only source-known ship dates", () => {
    const timeline = makeTimeline();
    const adapter = createTimelineControl({
      getTimeline: () => timeline,
      getShipDates: () => ({ state: "available", dates: ["2026-09-03", "2026-09-01", "2026-09-03", "invalid"] }),
    });

    expect(adapter.getContext()).toMatchObject({
      timezone: "Asia/Taipei",
      timelineKind: "daily_replay",
      historicalMultiYearControl: "unavailable",
      mode: "replay",
      currentDate: "2026-09-10",
      ships: { availability: "available", dates: ["2026-09-01", "2026-09-03"], totalDates: 2, datesTruncated: false, bounds: { start: "2026-09-01", end: "2026-09-03" } },
      buses: { availability: "unknown" },
    });
  });

  it("does not convert an unverified empty date list into empty availability", () => {
    const adapter = createTimelineControl({ getTimeline: () => makeTimeline(), getShipDates: () => ({ state: "unknown", dates: [] }) });
    expect(adapter.getContext()).toMatchObject({ ships: { availability: "unknown", dates: [], bounds: null } });
  });

  it("caps bridge date arrays at the 100 most recent known dates while retaining full bounds", () => {
    const dates = Array.from({ length: 101 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10));
    const adapter = createTimelineControl({ getTimeline: () => makeTimeline(), getShipDates: () => ({ state: "available", dates }) });
    expect(adapter.getContext()).toMatchObject({ ships: { totalDates: 101, datesTruncated: true, dates: expect.arrayContaining(["2026-04-11"]), bounds: { start: "2026-01-01", end: "2026-04-11" } } });
  });

  it("uses useTimeline actions, constrains speed, and waits for the replay mode commit before play", async () => {
    const before = makeTimeline({ mode: "live" });
    const after = makeTimeline({ mode: "replay" });
    let current = before;
    const adapter = createTimelineControl({
      getTimeline: () => current,
      getShipDates: () => ({ state: "not_loaded", dates: [] }),
      afterModeChange: async () => { current = after; },
    });

    await adapter.apply({ mode: "replay", time: 1_789_027_200, playing: true, speed: 300 });
    expect(before.setSpeed).toHaveBeenCalledWith(300);
    expect(before.jumpToTime).toHaveBeenCalledWith(1_789_027_200);
    expect(after.play).toHaveBeenCalledOnce();
    await expect(adapter.apply({ mode: "replay", time: 1, speed: 42 as 30 })).rejects.toThrow("TIMELINE_SPEED_UNSUPPORTED");
    await expect(adapter.apply({ mode: "replay", time: -1 })).rejects.toThrow("TIMELINE_REPLAY_TIME_REQUIRED");
  });

  it("rejects live commands that pretend to seek or play", async () => {
    const adapter = createTimelineControl({ getTimeline: () => makeTimeline(), getShipDates: () => ({ state: "not_loaded", dates: [] }) });
    await expect(adapter.apply({ mode: "live", playing: true } as never)).rejects.toThrow("TIMELINE_LIVE_CANNOT_PLAY");
    await expect(adapter.apply({ mode: "live", time: 1 } as never)).rejects.toThrow("TIMELINE_LIVE_TIME_FORBIDDEN");
  });

  it("rejects daily timeline controls while the separate multi-year UI is active", async () => {
    const adapter = createTimelineControl({ getTimeline: () => makeTimeline(), getShipDates: () => ({ state: "not_loaded", dates: [] }), isHistoricalModeActive: () => true });
    expect(adapter.getContext()).toMatchObject({ historicalMultiYearMode: "active" });
    await expect(adapter.apply({ mode: "replay", time: 1 })).rejects.toThrow("TIMELINE_HISTORICAL_MODE_ACTIVE");
  });
});
