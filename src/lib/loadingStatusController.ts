/**
 * 右上載入狀態條的節奏控制（design-system §5.30）。
 *
 * 規則：
 *  - 150ms 內就結束的任務不顯示（避免閃爍）
 *  - 一出現，「載入中」至少停 600ms
 *  - 全部結束後再等 300ms 合併同一批，才顯示「已載入」
 *  - 「已載入」停 2 秒後淡出（淡出時間由 CSS 決定，這裡保留內容直到淡出結束）
 *  - 失敗顯示錯誤停 4 秒
 *  - 時間軸播放中只顯示「載入中」，停下後才顯示「已載入」
 *
 * 純邏輯、不碰 DOM；計時器可注入，方便用 fake timers 測試。
 */

import type { LoadingEvent } from "./loadingRegistry";

export const LOADING_STATUS_TIMING = {
  showDelayMs: 150,
  minLoadingMs: 600,
  settleMs: 300,
  doneHoldMs: 2000,
  errorHoldMs: 4000,
  fadeMs: 500,
} as const;

export type LoadingStatusPhase = "loading" | "done" | "error";

export interface LoadingStatusView {
  /** false 時淡出；內容保留到淡出結束。 */
  visible: boolean;
  phase: LoadingStatusPhase;
  /** loading：最新一項任務名；done：單項時的任務名；error：失敗的任務名。 */
  label: string;
  /** loading：除了 label 之外同時進行的項數。 */
  extra: number;
  /** done：這一批完成的項數。 */
  count: number;
}

export const HIDDEN_LOADING_STATUS: LoadingStatusView = {
  visible: false,
  phase: "loading",
  label: "",
  extra: 0,
  count: 0,
};

type State = "hidden" | "pending" | "loading" | "done" | "error" | "fading";

interface Options {
  onChange: (view: LoadingStatusView) => void;
  now?: () => number;
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  timing?: typeof LOADING_STATUS_TIMING;
}

export function createLoadingStatusController({
  onChange,
  now = () => performance.now(),
  setTimer = (cb, ms) => setTimeout(cb, ms),
  clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  timing = LOADING_STATUS_TIMING,
}: Options) {
  const active = new Map<string, { label: string; n: number }>();
  let state: State = "hidden";
  let playing = false;
  let shownAt = 0;
  let batch = 0;
  let lastLabel = "";
  let view: LoadingStatusView = HIDDEN_LOADING_STATUS;
  const timers = new Set<unknown>();

  function later(cb: () => void, ms: number) {
    const handle = setTimer(() => {
      timers.delete(handle);
      cb();
    }, ms);
    timers.add(handle);
  }
  function clearAll() {
    for (const t of timers) clearTimer(t);
    timers.clear();
  }
  function publish(next: LoadingStatusView) {
    view = next;
    onChange(view);
  }
  function latestLabel(): string {
    let label = lastLabel;
    for (const v of active.values()) label = v.label;
    return label;
  }
  function showLoading() {
    if (state !== "loading") shownAt = now();
    state = "loading";
    publish({ visible: true, phase: "loading", label: latestLabel(), extra: Math.max(0, active.size - 1), count: 0 });
  }
  function hideAfter(ms: number) {
    later(() => {
      state = "fading";
      publish({ ...view, visible: false });
      later(() => {
        state = "hidden";
        batch = 0;
        if (active.size > 0) begin();
      }, timing.fadeMs);
    }, ms);
  }
  function begin() {
    state = "pending";
    later(() => {
      if (state === "pending" && active.size > 0) showLoading();
    }, timing.showDelayMs);
  }
  function tryFinish() {
    if (active.size > 0 || playing) return;
    if (state === "pending") {
      clearAll();
      state = "hidden";
      batch = 0;
      return;
    }
    if (state !== "loading") return;
    clearAll();
    const wait = Math.max(timing.settleMs, shownAt + timing.minLoadingMs - now());
    later(() => {
      if (active.size > 0 || playing || state !== "loading") return;
      state = "done";
      publish({ visible: true, phase: "done", label: lastLabel, extra: 0, count: batch });
      hideAfter(timing.doneHoldMs);
    }, wait);
  }

  function handle(event: LoadingEvent) {
    if (event.type === "start") {
      const cur = active.get(event.id);
      active.set(event.id, { label: event.label, n: (cur?.n ?? 0) + 1 });
      batch += 1;
      lastLabel = event.label;
      if (state === "error") return;
      if (state === "hidden") return begin();
      if (state === "pending") return;
      clearAll();
      showLoading();
      return;
    }
    const cur = active.get(event.id);
    if (cur && cur.n > 1) active.set(event.id, { ...cur, n: cur.n - 1 });
    else active.delete(event.id);
    if (event.type === "fail") {
      clearAll();
      state = "error";
      publish({ visible: true, phase: "error", label: event.label, extra: 0, count: 0 });
      hideAfter(timing.errorHoldMs);
      return;
    }
    if (state === "loading" && active.size > 0) showLoading();
    tryFinish();
  }

  return {
    handle,
    setPlaying(next: boolean) {
      if (playing === next) return;
      playing = next;
      if (!playing) tryFinish();
    },
    dispose() {
      clearAll();
    },
    get view() {
      return view;
    },
  };
}
