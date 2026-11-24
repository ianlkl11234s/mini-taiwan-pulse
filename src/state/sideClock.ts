/**
 * 本側時鐘（G2-4「當地同時刻」，2026-11-24）。
 *
 * 時間軸（`timeStore`）只有一把，是左圖（主地圖）的時間。兩國並排選「當地同時刻」時，右圖要看
 * 右國的同一個當地鐘點（左台灣 08:00 ↔ 右英國 08:00，實際晚 8 小時），所以右圖的圖層改讀
 * `rightClock`：右側時間＝把左側時刻在左國的牆上鐘點，換成右國同一個牆上鐘點的那一刻
 * （`lib/localClock.ts` 的 `alignLocalInstant`；位移取該刻的，含夏令）。同一刻、或不在並排時，
 * `rightClock` 就是時間軸本身。
 *
 * 用法（規則 6 不變：時間仍走訂閱，不進 deps）：
 *   const clock = useSideClock();          // 右圖的 <LayerHosts> 外面包了 Provider；其他地方＝leftClock
 *   useEffect(() => clock.subscribeThrottled(1000, run), [clock, …]);   // clock 身分固定，可放 deps
 *
 * 讀法和 `timeStore` 相同（getTime／getDateKey／getWindowDateKeys／subscribe／subscribeThrottled／
 * subscribeDate／subscribeWindowDateKeys）。日期 key 一律是「本側時刻的台北日期」，和 `timeStore.getDateKey()`
 * 同口徑；圖層要依當地日取資料時照舊用 `dataDateKeyFor(key, clock.getTime())`。
 *
 * 對齊改變（切模式、換左／右國家）時時間軸可能是暫停的、不會 tick，所以 `rightClock` 另外訂
 * compareStore／countryStore，對齊一變就用新時間通知所有訂閱者。
 */
import { createContext, useContext } from "react";
import { timeStore } from "./timeStore";
import { createDateNotifier } from "./dateNotifier";
import { compareStore, isLocalTimeAlign } from "./compareStore";
import { countryStore } from "./countryStore";
import { alignLocalInstant, countryClockTimeZone } from "../lib/localClock";
import { DEFAULT_TIME_ZONE, shiftDateKey, zonedDateKey, zonedMidnightMs } from "../lib/zonedTime";

type Listener<T> = (v: T) => void;

export type MapSide = "left" | "right";

/** 一側地圖的時間來源（讀法同 timeStore，唯讀） */
export interface SideClock {
  readonly side: MapSide;
  /** 本側時刻（unix 秒） */
  getTime(): number;
  /** 本側時刻的台北日期 YYYY-MM-DD */
  getDateKey(): string;
  /** 時間軸視窗換到本側後涵蓋的台北日期 */
  getWindowDateKeys(): string[];
  subscribe(cb: Listener<number>): () => void;
  subscribeThrottled(ms: number, cb: Listener<number>): () => void;
  subscribeDate(cb: Listener<string>): () => void;
  subscribeWindowDateKeys(cb: Listener<string[]>): () => void;
}

/** 左圖（主地圖）＝時間軸本身 */
export const leftClock: SideClock = {
  side: "left",
  getTime: () => timeStore.getTime(),
  getDateKey: () => timeStore.getDateKey(),
  getWindowDateKeys: () => timeStore.getWindowDateKeys(),
  subscribe: (cb) => timeStore.subscribe(cb),
  subscribeThrottled: (ms, cb) => timeStore.subscribeThrottled(ms, cb),
  subscribeDate: (cb) => timeStore.subscribeDate(cb),
  subscribeWindowDateKeys: (cb) => timeStore.subscribeWindowDateKeys(cb),
};

interface Alignment {
  fromTz: string;
  toTz: string;
}

/** 目前右圖要不要換算：當地同時刻、而且兩國鐘點時區不同才要 */
function currentAlignment(): Alignment | null {
  const snap = compareStore.getSnapshot();
  if (!isLocalTimeAlign(snap) || !snap.rightCountry) return null;
  const fromTz = countryClockTimeZone(countryStore.getSnapshot());
  const toTz = countryClockTimeZone(snap.rightCountry);
  return fromTz === toTz ? null : { fromTz, toTz };
}

const alignmentSignature = (a: Alignment | null) => (a ? `${a.fromTz}|${a.toTz}` : "");

/** 時間軸時刻 → 右圖時刻（不換算時原樣回傳） */
export function rightTimeOf(t: number, a: Alignment | null = currentAlignment()): number {
  return a ? alignLocalInstant(t, a.fromTz, a.toTz) : t;
}

/** 時間軸視窗（台北日期）換到右圖後涵蓋的台北日期：視窗頭尾各自換算，中間逐日補齊 */
export function shiftWindowDateKeys(keys: readonly string[], shift: (t: number) => number): string[] {
  if (keys.length === 0) return [];
  const start = zonedMidnightMs(keys[0]!, DEFAULT_TIME_ZONE) / 1000;
  const end = zonedMidnightMs(shiftDateKey(keys[keys.length - 1]!, 1), DEFAULT_TIME_ZONE) / 1000 - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return keys.slice();
  const first = zonedDateKey(shift(start) * 1000, DEFAULT_TIME_ZONE);
  const last = zonedDateKey(shift(end) * 1000, DEFAULT_TIME_ZONE);
  const out: string[] = [];
  for (let k = first; k <= last && out.length < 31; k = shiftDateKey(k, 1)) out.push(k);
  return out;
}

/** 對齊改變（模式、左右國家）就呼叫 cb；時間軸暫停時靠這個讓右圖跟上 */
function onAlignmentChange(cb: () => void): () => void {
  let last = alignmentSignature(currentAlignment());
  const check = () => {
    const next = alignmentSignature(currentAlignment());
    if (next === last) return;
    last = next;
    cb();
  };
  const offCompare = compareStore.subscribe(check);
  const offCountry = countryStore.subscribe(check);
  return () => { offCompare(); offCountry(); };
}

// 右圖的日期訂閱共用一份：本側日期跨日的時刻和時間軸不同，所以從換算後的時刻自己判斷，
// 再走和 timeStore 相同的 leading＋trailing debounce（快速 scrub 只送停下來的那天）。
const rightDateListeners = new Set<Listener<string>>();
let rightDateTeardown: (() => void) | null = null;

function startRightDateFeed() {
  let lastKey = rightClock.getDateKey();
  const notifier = createDateNotifier((key) => {
    for (const cb of rightDateListeners) cb(key);
  }, { quietMs: 300 });
  const check = () => {
    const key = rightClock.getDateKey();
    if (key === lastKey) return;
    lastKey = key;
    notifier.push(key);
  };
  const offTime = timeStore.subscribe(check);
  const offAlign = onAlignmentChange(check);
  rightDateTeardown = () => { offTime(); offAlign(); notifier.dispose(); };
}

/** 右圖：當地同時刻時換算，其他時候＝時間軸 */
export const rightClock: SideClock = {
  side: "right",
  getTime: () => rightTimeOf(timeStore.getTime()),
  getDateKey: () => zonedDateKey(rightClock.getTime() * 1000, DEFAULT_TIME_ZONE),
  getWindowDateKeys() {
    const keys = timeStore.getWindowDateKeys();
    const a = currentAlignment();
    return a ? shiftWindowDateKeys(keys, (t) => rightTimeOf(t, a)) : keys;
  },
  subscribe(cb) {
    const offTime = timeStore.subscribe((t) => cb(rightTimeOf(t)));
    const offAlign = onAlignmentChange(() => cb(rightClock.getTime()));
    return () => { offTime(); offAlign(); };
  },
  subscribeThrottled(ms, cb) {
    const offTime = timeStore.subscribeThrottled(ms, (t) => cb(rightTimeOf(t)));
    const offAlign = onAlignmentChange(() => cb(rightClock.getTime()));
    return () => { offTime(); offAlign(); };
  },
  subscribeDate(cb) {
    rightDateListeners.add(cb);
    if (!rightDateTeardown) startRightDateFeed();
    return () => {
      rightDateListeners.delete(cb);
      if (rightDateListeners.size === 0 && rightDateTeardown) {
        rightDateTeardown();
        rightDateTeardown = null;
      }
    };
  },
  subscribeWindowDateKeys(cb) {
    const offWindow = timeStore.subscribeWindowDateKeys(() => cb(rightClock.getWindowDateKeys()));
    const offAlign = onAlignmentChange(() => cb(rightClock.getWindowDateKeys()));
    return () => { offWindow(); offAlign(); };
  },
};

/** 圖層 hook 所在那一側的時鐘。預設（主地圖、或不在任何 LayerHosts 內）＝左側 */
export const SideClockContext = createContext<SideClock>(leftClock);

/** 讀本側時鐘（身分固定，可放 effect deps；時間本身照舊走訂閱） */
export function useSideClock(): SideClock {
  return useContext(SideClockContext);
}
