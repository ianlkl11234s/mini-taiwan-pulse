/**
 * 公車擁擠模擬「時間回放」的純函式（車點位置、路段當下負載）。資料由
 * scripts/preprocess/build-bus-crowding-sim.py 產生：每班每站只有負載分級 0–3（不含人數）。
 *
 * 對照原型 taipei-gis-analytics output/bus_crowding/p3_viz/index.html：
 * - 位置（:195–204 posAt／tripState）：取 t[k] ≤ T < t[k+1]，在相鄰兩站沿線公尺之間依時間線性內插，
 *   再在線形 g／gm 上取點；靠站停留忽略（同原型）。
 * - 路段當下負載（:324–327）：每段取 20 分鐘內最近一班離站的負載；沒有就不畫。
 * - 情境組法（:183–184）：基準扣掉 removed 與 changed，再接 changed。
 */

/** 回放線形（lines.json 一列；跳過的線為 null）。 */
export interface ReplayLine {
  g: [number, number][];
  /** g 各點沿線累積公尺 */
  gm: number[];
  /** 各站沿線公尺 */
  m: number[];
  /** 路線名、子路線名、各站站名（popup 用） */
  n: string;
  sn: string;
  s: string[];
}

/** 一班車（trips-*.json）。c／x：每站離站後的負載分級字串（一字一站）；x 是另一參數版本。 */
export interface ReplayTrip {
  id: string;
  l: number;
  q: number[];
  t: number[];
  c: string;
  x?: string;
  syn?: 1;
}

export interface ReplayTripDiff {
  removed: string[];
  changed: ReplayTrip[];
}

/** 原型 index.html:183–184。 */
export function assembleReplayTrips(base: readonly ReplayTrip[], diff: ReplayTripDiff | null): ReplayTrip[] {
  if (!diff) return [...base];
  const removed = new Set(diff.removed);
  const changed = new Set(diff.changed.map((t) => t.id));
  return base.filter((t) => !removed.has(t.id) && !changed.has(t.id)).concat(diff.changed);
}

/** 原型 :20 分鐘（路段當下負載的回看）。 */
export const REPLAY_LOOKBACK_S = 1200;

function posAt(line: ReplayLine, s: number): [number, number] {
  const { gm, g } = line;
  let lo = 0;
  let hi = gm.length - 1;
  if (s <= 0 || hi <= 0) return g[0]!;
  if (s >= gm[hi]!) return g[hi]!;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (gm[mid]! <= s) lo = mid; else hi = mid;
  }
  const f = (s - gm[lo]!) / ((gm[hi]! - gm[lo]!) || 1);
  return [g[lo]![0] + (g[hi]![0] - g[lo]![0]) * f, g[lo]![1] + (g[hi]![1] - g[lo]![1]) * f];
}

/** 方位角（度，北＝0、順時針）；兩點重合回 null。 */
function bearingOf(a: [number, number], b: [number, number]): number | null {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return null;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

export interface ReplayVehicleState {
  /** 目前所在區間的起站（t、c 的索引） */
  k: number;
  /** 離開第 k 站後的負載分級 0–3 */
  cls: number;
  lng: number;
  lat: number;
  bearing: number | null;
}

/** 原型 :199–204 tripState：T 不在班次時段內回 null。 */
export function replayTripState(trip: ReplayTrip, line: ReplayLine, T: number): ReplayVehicleState | null {
  const tt = trip.t;
  const n = tt.length;
  if (n < 2 || T < tt[0]! || T > tt[n - 1]!) return null;
  let k = 0;
  let hi = n - 2;
  while (k < hi) {
    const mid = (k + hi + 1) >> 1;
    if (tt[mid]! <= T) k = mid; else hi = mid - 1;
  }
  const sa = line.m[trip.q[k]!] ?? 0;
  const sb = line.m[trip.q[Math.min(k + 1, n - 1)]!] ?? sa;
  const f = tt[k + 1]! > tt[k]! ? (T - tt[k]!) / (tt[k + 1]! - tt[k]!) : 0;
  const s = sa + (sb - sa) * Math.min(1, Math.max(0, f));
  const xy = posAt(line, s);
  // 方向：沿行進方向往前 15 m（末端改往回取）
  const ahead = sb >= sa ? 15 : -15;
  const other = posAt(line, s + ahead);
  const bearing = s + ahead > (line.gm[line.gm.length - 1] ?? 0) ? bearingOf(posAt(line, s - 15), xy) : bearingOf(xy, other);
  return { k, cls: Number(trip.c[k] ?? 0), lng: xy[0], lat: xy[1], bearing };
}

/** 分級字元 → 0–3；缺回 null。 */
export const classAt = (codes: string | undefined, k: number): number | null => {
  const ch = codes?.[k];
  return ch === undefined ? null : Number(ch);
};

/**
 * 原型 :324–327：每個路段（線 l、第 j 站 → 第 j+1 站）取 [T−20 分, T] 內最近一班離站的負載分級。
 * `segIndex`：`${l}_${j}` → 路段 feature 索引；回傳每個路段的分級（−1＝沒有班次，不畫）。
 */
export function currentSegmentClasses(
  trips: readonly ReplayTrip[], T: number, segIndex: ReadonlyMap<string, number>, segCount: number,
): Int8Array {
  const out = new Int8Array(segCount).fill(-1);
  const lastDep = new Map<number, number>(); // feature 索引 → 寫入值的離站時刻
  for (const trip of trips) {
    const tt = trip.t;
    const n = tt.length;
    if (n < 2 || tt[0]! > T || tt[n - 2]! <= T - REPLAY_LOOKBACK_S) continue;
    for (let k = 0; k < n - 1; k++) {
      const dep = tt[k]!;
      if (dep > T) break;
      if (T - dep >= REPLAY_LOOKBACK_S) continue;
      const cls = Number(trip.c[k] ?? 0);
      for (let j = trip.q[k]!; j < trip.q[k + 1]!; j++) {
        const idx = segIndex.get(`${trip.l}_${j}`);
        if (idx === undefined) continue;
        const prev = lastDep.get(idx);
        if (prev !== undefined && prev >= dep) continue;
        lastDep.set(idx, dep);
        out[idx] = cls;
      }
    }
  }
  return out;
}
