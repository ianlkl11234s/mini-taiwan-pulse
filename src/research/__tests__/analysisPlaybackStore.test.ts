import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAnalysisPlayback, getAnalysisPlaybackState, getAnalysisPlaybackVersion, scrubAnalysisPlayback,
  subscribeAnalysisPlayback, syncAnalysisPlaybackRegistry, toggleAnalysisPlayback,
} from "../analysisPlaybackStore";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { clearAnalysisPlayback(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("syncAnalysisPlaybackRegistry", () => {
  it("registers a newly-seen result defaulting to its latest period, notifying subscribers", () => {
    const listener = vi.fn();
    subscribeAnalysisPlayback(listener);
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 5]]));
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 4, playing: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unregisters (and stops the timer of) a result no longer in the active set", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 5]]));
    toggleAnalysisPlayback("wh-1", 5);
    expect(getAnalysisPlaybackState("wh-1")!.playing).toBe(true);
    syncAnalysisPlaybackRegistry(new Map()); // result dropped from the collection
    expect(getAnalysisPlaybackState("wh-1")).toBeNull();
    const versionAfterUnregister = getAnalysisPlaybackVersion();
    vi.advanceTimersByTime(5000); // the old timer must not still be ticking
    expect(getAnalysisPlaybackVersion()).toBe(versionAfterUnregister);
  });

  it("clamps a stale index when a re-registered result's period count shrinks", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 5]]));
    scrubAnalysisPlayback("wh-1", 4, 5);
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 2]]));
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 1, playing: false });
  });

  it("keeps each result's registration independent (T2 A2: 各自獨立)", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 3], ["wh-2", 6]]));
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 2, playing: false });
    expect(getAnalysisPlaybackState("wh-2")).toEqual({ index: 5, playing: false });
    scrubAnalysisPlayback("wh-1", 0, 3);
    expect(getAnalysisPlaybackState("wh-2")).toEqual({ index: 5, playing: false }); // untouched
  });
});

describe("scrubAnalysisPlayback", () => {
  it("stops any running timer and sets the exact (clamped, rounded) index", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 5]]));
    toggleAnalysisPlayback("wh-1", 5);
    scrubAnalysisPlayback("wh-1", 2.6, 5);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 3, playing: false });
    scrubAnalysisPlayback("wh-1", 99, 5);
    expect(getAnalysisPlaybackState("wh-1")!.index).toBe(4);
    scrubAnalysisPlayback("wh-1", -3, 5);
    expect(getAnalysisPlaybackState("wh-1")!.index).toBe(0);
    // scrubbing must have actually cancelled the timer — no further auto-advance.
    vi.advanceTimersByTime(5000);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 0, playing: false });
  });

  it("is a no-op for an unregistered result", () => {
    scrubAnalysisPlayback("ghost", 2, 5);
    expect(getAnalysisPlaybackState("ghost")).toBeNull();
  });
});

describe("toggleAnalysisPlayback", () => {
  it("advances one period per second and stops (without looping) at the last period", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 3]])); // starts at index 2 (latest)
    scrubAnalysisPlayback("wh-1", 0, 3); // rewind to the start
    toggleAnalysisPlayback("wh-1", 3);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 0, playing: true });
    vi.advanceTimersByTime(1000);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 1, playing: true });
    vi.advanceTimersByTime(1000);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 2, playing: false }); // stopped, not looped — no idle tick at the end
    vi.advanceTimersByTime(5000);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 2, playing: false });
  });

  it("pauses when toggled again mid-play, and restarts from the first period when re-pressed at the end", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 3]]));
    scrubAnalysisPlayback("wh-1", 0, 3);
    toggleAnalysisPlayback("wh-1", 3);
    vi.advanceTimersByTime(1000);
    toggleAnalysisPlayback("wh-1", 3); // pause mid-way
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 1, playing: false });
    vi.advanceTimersByTime(3000); // paused — no further advance
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 1, playing: false });
    scrubAnalysisPlayback("wh-1", 2, 3); // at the end
    toggleAnalysisPlayback("wh-1", 3); // restart from the beginning
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 0, playing: true });
  });

  it("never auto-plays under prefers-reduced-motion (spec: 只能拖)", () => {
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: true })) });
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 5]]));
    toggleAnalysisPlayback("wh-1", 5);
    expect(getAnalysisPlaybackState("wh-1")!.playing).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(getAnalysisPlaybackState("wh-1")!.playing).toBe(false);
  });

  it("does nothing for a single-period result (nothing to play)", () => {
    syncAnalysisPlaybackRegistry(new Map([["wh-1", 1]]));
    toggleAnalysisPlayback("wh-1", 1);
    expect(getAnalysisPlaybackState("wh-1")).toEqual({ index: 0, playing: false });
  });
});
