// T2 A2: "分析結果自帶播放列（圖例上方），只控制該結果、不動全站時間軸" (spec
// docs/features/viz-library/DECISIONS.md §6). Pure module-level state — mirrors
// analysisLegendStore.ts's useSyncExternalStore pattern, but owns a real setInterval timer per
// result instead of just a snapshot, since playback advances on its own between renders.
//
// This store never touches the map. MainMapConnection subscribes (via useAnalysisPlaybackVersion)
// and, on every version bump, re-applies the *current* period to whichever results are still
// installed (analysisResultOverlay.ts setAnalysisResultPeriod) — the same "state → effect syncs the
// map" shape the rest of this file's analysis-result wiring already uses.
import { prefersReducedMotion } from "./researchMotion";

export type AnalysisPlaybackState = { index: number; playing: boolean };

const TICK_MS = 1000;

const states = new Map<string, AnalysisPlaybackState>();
const timers = new Map<string, ReturnType<typeof setInterval>>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  for (const listener of [...listeners]) listener();
}

function stopTimer(resultId: string): void {
  const timer = timers.get(resultId);
  if (timer !== undefined) { clearInterval(timer); timers.delete(resultId); }
}

export function getAnalysisPlaybackState(resultId: string): AnalysisPlaybackState | null {
  return states.get(resultId) ?? null;
}

export function getAnalysisPlaybackVersion(): number { return version; }

export function subscribeAnalysisPlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Keeps the registry in lockstep with the currently-installed timed-choropleth results (called once
 * per redraw, spec: "多個時間結果各自獨立"). `active` maps each such resultId to its own period
 * count. A result no longer present is unregistered (its timer stopped); a newly-seen one defaults
 * to its latest period (spec: "預設停在最新一期"); a shrunk period count (a re-run with fewer
 * periods reusing the same resultId) clamps a stale index rather than leaving it out of range.
 */
export function syncAnalysisPlaybackRegistry(active: ReadonlyMap<string, number>): void {
  let changed = false;
  for (const resultId of [...states.keys()]) {
    if (!active.has(resultId)) { stopTimer(resultId); states.delete(resultId); changed = true; }
  }
  for (const [resultId, length] of active) {
    const existing = states.get(resultId);
    if (!existing) { states.set(resultId, { index: Math.max(0, length - 1), playing: false }); changed = true; }
    else if (existing.index > length - 1) { states.set(resultId, { ...existing, index: Math.max(0, length - 1) }); changed = true; }
  }
  if (changed) notify();
}

/** Stops (and un-registers) every result's playback — used when the whole analysis collection is cleared. */
export function clearAnalysisPlayback(): void {
  for (const resultId of [...states.keys()]) stopTimer(resultId);
  if (states.size) { states.clear(); notify(); }
}

/** Scrubbing the track always stops any running timer first (spec: dragging is a direct override). */
export function scrubAnalysisPlayback(resultId: string, index: number, length: number): void {
  if (!states.has(resultId) || length < 1) return;
  stopTimer(resultId);
  const clamped = Math.max(0, Math.min(length - 1, Math.round(index)));
  states.set(resultId, { index: clamped, playing: false });
  notify();
}

/**
 * Play/pause toggle. `prefers-reduced-motion` never auto-advances (spec: "只能拖"); a result with
 * only one period has nothing to play. Reaching the last period stops the timer on its own (spec:
 * "到最後一期停止（不循環）"); pressing play again from the end restarts at the first period.
 */
export function toggleAnalysisPlayback(resultId: string, length: number): void {
  const current = states.get(resultId);
  if (!current) return;
  if (current.playing) { stopTimer(resultId); states.set(resultId, { ...current, playing: false }); notify(); return; }
  if (prefersReducedMotion() || length <= 1) return;
  const startIndex = current.index >= length - 1 ? 0 : current.index;
  states.set(resultId, { index: startIndex, playing: true });
  notify();
  const timer = setInterval(() => {
    const state = states.get(resultId);
    if (!state) { stopTimer(resultId); return; }
    const nextIndex = state.index + 1;
    const atEnd = nextIndex >= length - 1;
    // Stop in the same tick that reaches the last period — never an extra idle second sitting at
    // the end still "playing" (spec: "到最後一期停止（不循環）").
    if (atEnd) stopTimer(resultId);
    states.set(resultId, { index: Math.min(nextIndex, length - 1), playing: !atEnd });
    notify();
  }, TICK_MS);
  timers.set(resultId, timer);
}
