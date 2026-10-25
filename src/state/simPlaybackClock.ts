/**
 * 模擬面板 S-1 播放列的 scoped 時鐘（spec §5.40 S-1；範本 `earthquakeReplayClock.ts`）。
 *
 * - **不接全站 timeStore**：模擬時間（例：公車 07:00–09:00 的「當日秒數」）和真實時間是兩件事。
 * - 引擎（圖層 hook）用 `get()` 同步讀、`subscribe` 收通知；通知節流到 10Hz，
 *   播放列（React）也只在通知時重繪，不讓整個 App 每幀 re-render（CLAUDE.md §6 精神）。
 * - 播放自己跑 RAF：每幀 t += 牆鐘秒 × 倍速，到結尾就停（不循環）；頁面隱藏時 RAF 不跑＝暫停推進。
 * - 每個實驗一個時鐘，用 id 登記，`layerParamsSpec` 的 `kind: "playback"` 以 `clock` 欄位指過來。
 */

const NOTIFY_INTERVAL_MS = 100;

export interface SimClockSnapshot {
  /** 模擬時刻（秒，當日 0 時起算） */
  t: number;
  playing: boolean;
  /** 倍速：模擬秒／牆鐘秒 */
  speed: number;
}

export interface SimClockConfig {
  t0: number;
  t1: number;
  /** 初始（與關閉圖層時回到的）時刻 */
  start: number;
  /** 倍速選項（模擬秒／牆鐘秒）與預設 */
  speeds: readonly number[];
  defaultSpeed: number;
}

export interface SimPlaybackClock {
  readonly config: SimClockConfig;
  get(): number;
  getSnapshot(): SimClockSnapshot;
  subscribe(cb: () => void): () => void;
  /** 跳到某時刻（拖曳、鍵盤）；夾在 [t0, t1]，立即通知 */
  seek(t: number): void;
  play(): void;
  pause(): void;
  setSpeed(speed: number): void;
  /** 重來：回到 t0（不改播放狀態） */
  restart(): void;
  /** 關閉圖層：暫停並回到初始時刻 */
  reset(): void;
}

const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function createSimPlaybackClock(config: SimClockConfig): SimPlaybackClock {
  let snapshot: SimClockSnapshot = { t: config.start, playing: false, speed: config.defaultSpeed };
  let lastNotifyMs = 0;
  let raf: number | null = null;
  let lastFrameMs = 0;
  const listeners = new Set<() => void>();

  const notify = () => {
    lastNotifyMs = performance.now();
    for (const l of listeners) l();
  };
  const update = (next: Partial<SimClockSnapshot>, force: boolean) => {
    snapshot = { ...snapshot, ...next };
    if (force || performance.now() - lastNotifyMs >= NOTIFY_INTERVAL_MS) notify();
  };
  const stopLoop = () => {
    if (raf !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = null;
  };
  const frame = (now: number) => {
    raf = null;
    if (!snapshot.playing) return;
    const dt = Math.min(1, Math.max(0, (now - lastFrameMs) / 1000)); // 分頁切回來時不一次跳太遠
    lastFrameMs = now;
    const t = snapshot.t + dt * snapshot.speed;
    if (t >= config.t1) { update({ t: config.t1, playing: false }, true); return; } // 播到結尾就停
    update({ t }, false);
    raf = requestAnimationFrame(frame);
  };

  return {
    config,
    get: () => snapshot.t,
    getSnapshot: () => snapshot,
    subscribe(cb) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    seek(t) {
      update({ t: clampTo(t, config.t0, config.t1) }, true);
    },
    play() {
      if (snapshot.playing) return;
      // 停在結尾時按播放＝從頭（同原型 index.html:500）
      update({ playing: true, ...(snapshot.t >= config.t1 ? { t: config.t0 } : {}) }, true);
      lastFrameMs = performance.now();
      stopLoop();
      raf = requestAnimationFrame(frame);
    },
    pause() {
      stopLoop();
      if (snapshot.playing) update({ playing: false }, true);
    },
    setSpeed(speed) {
      if (config.speeds.includes(speed)) update({ speed }, true);
    },
    restart() {
      update({ t: config.t0 }, true);
    },
    reset() {
      stopLoop();
      update({ t: config.start, playing: false }, true);
    },
  };
}

const registry = new Map<string, SimPlaybackClock>();

export function registerSimPlaybackClock(id: string, clock: SimPlaybackClock): SimPlaybackClock {
  registry.set(id, clock);
  return clock;
}

export function getSimPlaybackClock(id: string): SimPlaybackClock | undefined {
  return registry.get(id);
}

/** HH:MM（模擬時刻，當日秒數） */
export function formatSimClock(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}
