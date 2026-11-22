/**
 * 長期時間條的狀態（規範：docs/features/longterm-time/STANDARD.md §2）。
 * 外部 store（useSyncExternalStore），不進 App React state：拖選、播放每一期只通知訂閱者，整個 App 不重繪。
 * 與即時時間軸的 timeStore 完全分開，本檔不讀也不寫 timeStore。
 *
 * - 選取：每層一個期別區間（含兩端），預設最新一期。
 * - 播放：逐期跳、不漸變；1× 每期 1 秒；播到最後一期停住，在最後一期按播放從頭開始。
 * - 「最後打開」：模組層訂閱 layerVisibilityStore（一直掛著，不受即時／歷史模式切換影響），
 *   決定時間條與即時時間軸誰在前。
 */
import { useSyncExternalStore } from "react";
import { layerVisibilityStore } from "./layerVisibilityStore";
import { LIVE_TIMELINE_KEYS, LONG_TERM_BAR_KEYS, longTermSpecOf } from "../data/longTermLayers";
import { LONG_TERM_DEFAULT_SPEED, LONG_TERM_MS_PER_PERIOD_AT_1X, longTermPeriods, type LongTermPeriod, type LongTermPlaySpeed } from "../lib/longTermTime";

export type LongTermRange = readonly [number, number];

export interface LongTermBarState {
  /** 各層選取的期別區間；沒寫＝最新一期 */
  selection: Readonly<Record<string, LongTermRange>>;
  playing: boolean;
  speed: LongTermPlaySpeed;
  /** 各追蹤圖層最近一次打開的順序號（越大越晚） */
  openedAt: Readonly<Record<string, number>>;
  /** 使用者點 chip 指定的時間軸；null＝依最後打開的圖層 */
  pinned: "longTerm" | "live" | null;
}

let state: LongTermBarState = { selection: {}, playing: false, speed: LONG_TERM_DEFAULT_SPEED, openedAt: {}, pinned: null };
const listeners = new Set<() => void>();
function emit(next: LongTermBarState) {
  state = next;
  listeners.forEach((fn) => fn());
}

// ── 期別（依 manifest 產生，同一頁面內不變） ──
const periodCache = new Map<string, LongTermPeriod[]>();
export function periodsOf(key: string): LongTermPeriod[] {
  let p = periodCache.get(key);
  if (!p) {
    const spec = longTermSpecOf(key);
    p = spec ? longTermPeriods(spec.coverage, spec.granularity) : [];
    periodCache.set(key, p);
  }
  return p;
}

export function selectionOf(s: LongTermBarState, key: string): LongTermRange {
  const sel = s.selection[key];
  if (sel) return sel;
  const last = Math.max(0, periodsOf(key).length - 1);
  return [last, last];
}

// ── 播放 ──
let playingKey: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}
function startTimer() {
  stopTimer();
  const key = playingKey;
  if (!key) return;
  timer = setInterval(() => {
    const n = periodsOf(key).length;
    const [cur] = selectionOf(state, key);
    const next = Math.min(cur + 1, n - 1);
    const done = next >= n - 1;
    emit({ ...state, selection: { ...state.selection, [key]: [next, next] }, playing: done ? false : state.playing });
    if (done) { stopTimer(); playingKey = null; }
  }, LONG_TERM_MS_PER_PERIOD_AT_1X / state.speed);
}

export const longTermBarStore = {
  getSnapshot: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  /** 拖選、點長條、「最新一期」：停止播放並設定選取 */
  select(key: string, range: LongTermRange) {
    const n = periodsOf(key).length;
    const a = Math.max(0, Math.min(n - 1, Math.min(range[0], range[1])));
    const b = Math.max(0, Math.min(n - 1, Math.max(range[0], range[1])));
    const cur = selectionOf(state, key);
    if (!state.playing && cur[0] === a && cur[1] === b) return;
    stopTimer(); playingKey = null;
    emit({ ...state, playing: false, selection: { ...state.selection, [key]: [a, b] } });
  },
  selectLatest(key: string) {
    const last = Math.max(0, periodsOf(key).length - 1);
    longTermBarStore.select(key, [last, last]);
  },
  /** 從選取的第一期開始逐期播放；已在最後一期則從頭播 */
  play(key: string) {
    const n = periodsOf(key).length;
    if (n < 2) return;
    const [a] = selectionOf(state, key);
    const startAt = a >= n - 1 ? 0 : a;
    playingKey = key;
    emit({ ...state, playing: true, selection: { ...state.selection, [key]: [startAt, startAt] } });
    startTimer();
  },
  pause() {
    stopTimer(); playingKey = null;
    if (state.playing) emit({ ...state, playing: false });
  },
  setSpeed(speed: LongTermPlaySpeed) {
    if (speed === state.speed) return;
    emit({ ...state, speed });
    if (state.playing) startTimer();
  },
  pin(which: "longTerm" | "live") {
    if (which === "live") { stopTimer(); playingKey = null; }
    emit({ ...state, pinned: which, playing: which === "live" ? false : state.playing });
  },
  /** 測試用 */
  reset() {
    stopTimer(); playingKey = null; seq = 0; prevOn = null; trackingPaused = false;
    emit({ selection: {}, playing: false, speed: LONG_TERM_DEFAULT_SPEED, openedAt: {}, pinned: null });
  },
};

// ── 「最後打開」追蹤 ──
const TRACKED: readonly string[] = [...LONG_TERM_BAR_KEYS, ...LIVE_TIMELINE_KEYS];
let seq = 0;
let prevOn: Set<string> | null = null;

/**
 * 依開關變化記錄打開順序。
 * - 一次只打開一層（使用者操作）：記為最新，清掉 chip 的手動指定。
 * - 同一批打開多層（離開歷史模式還原、會員場景還原）：視為還原，依原本的先後重新編號、
 *   沒記錄過的排在前面（以 manifest 順序），不清手動指定。這樣來回切模式後時間軸不會翻面。
 */
export function trackOpened(isOn: (key: string) => boolean): void {
  if (trackingPaused) return;
  const nowOn = new Set(TRACKED.filter(isOn));
  const opened = [...nowOn].filter((k) => !prevOn?.has(k));
  prevOn = nowOn;
  if (opened.length === 0) return;
  const order = (k: string) => state.openedAt[k] ?? 0;
  opened.sort((x, y) => order(x) - order(y) || TRACKED.indexOf(x) - TRACKED.indexOf(y));
  const openedAt = { ...state.openedAt };
  for (const k of opened) openedAt[k] = ++seq;
  emit({ ...state, openedAt, pinned: opened.length === 1 ? null : state.pinned });
}

const readVisibility = () => trackOpened((k) => !!layerVisibilityStore.getVisibility(k as Parameters<typeof layerVisibilityStore.getVisibility>[0]));

/**
 * 暫停／恢復「最後打開」追蹤（時間條所在的即時時間軸卸載＝進歷史模式時暫停）。
 * 歷史模式會先全關、離開時再整包還原；暫停期間凍結比較基準，恢復時延到同一輪的還原寫完之後
 * （setTimeout 0）才比對，所以來回切模式不會把還原的圖層當成「剛打開」。
 */
let trackingPaused = false;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
export function setLongTermTrackingPaused(paused: boolean): void {
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  if (paused) { trackingPaused = true; return; }
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    trackingPaused = false;
    readVisibility();
  }, 0);
}

if (typeof window !== "undefined") {
  readVisibility();
  layerVisibilityStore.subscribe(readVisibility);
}

export function useLongTermBarState(): LongTermBarState {
  return useSyncExternalStore(longTermBarStore.subscribe, longTermBarStore.getSnapshot, longTermBarStore.getSnapshot);
}

/** 只訂閱某層的選取（播放時只有這層的消費者重繪） */
export function useLongTermSelection(key: string): LongTermRange {
  const get = () => selectionOf(state, key);
  // selectionOf 對同一層回傳同一個陣列參照（state.selection[key]）；預設值每次新建，故先快取
  return useSyncExternalStore(longTermBarStore.subscribe, () => stableSel(key, get()), () => stableSel(key, get()));
}
const selCache = new Map<string, LongTermRange>();
function stableSel(key: string, r: LongTermRange): LongTermRange {
  const prev = selCache.get(key);
  if (prev && prev[0] === r[0] && prev[1] === r[1]) return prev;
  selCache.set(key, r);
  return r;
}
