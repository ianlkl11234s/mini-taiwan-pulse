/**
 * 火災長期時間條的資料（事件點類）：依 manifest `fireEvents.longTerm` 的涵蓋讀每年一檔，
 * 依每筆的月欄（`month`＝來源原始日期的月，見 useFireEventsLayer 註解）分到各期，
 * 時間條的件數與地圖篩選共用同一份。
 *
 * 每期狀態分四種，時間條畫法不同：
 * - `ok`：有資料（件數可為 0）
 * - `missing`：年檔讀到了但該年沒有資料（斜線，不畫成 0）
 * - `error`：年檔讀取失敗（另一種標示＋重試，不和「沒有資料」混在一起）
 * - `loading`：讀取中
 */
import { useEffect, useSyncExternalStore } from "react";
import { loadFireEventsByYearResult, type FireEvent } from "./fireLoader";
import { monthPeriodIndex, rocYear } from "../lib/longTermTime";
import { periodsOf } from "../state/longTermBarStore";

export type PeriodStatus = "ok" | "missing" | "error" | "loading";

export interface EventSeries {
  status: "idle" | "loading" | "ready";
  /** 每期件數；不是 ok 的期別為 null */
  counts: (number | null)[];
  periodStatus: PeriodStatus[];
  /** 依期別分組的事件 */
  byPeriod: FireEvent[][];
  /** 有讀取失敗的年份（西元） */
  failedYears: number[];
}

const KEY = "fireEvents";

function emptySeries(): EventSeries {
  const n = periodsOf(KEY).length;
  return { status: "idle", counts: Array(n).fill(null), periodStatus: Array(n).fill("loading"), byPeriod: Array.from({ length: n }, () => []), failedYears: [] };
}

let snap: EventSeries | null = null;
const listeners = new Set<() => void>();
let loading = false;
const yearResults = new Map<number, { events: FireEvent[]; error: string | null }>();

function getSnap(): EventSeries {
  if (!snap) snap = emptySeries();
  return snap;
}

function build(): EventSeries {
  const periods = periodsOf(KEY);
  const n = periods.length;
  const counts: (number | null)[] = Array(n).fill(null);
  const periodStatus: PeriodStatus[] = Array(n).fill("loading");
  const byPeriod: FireEvent[][] = Array.from({ length: n }, () => []);
  const failedYears: number[] = [];
  periods.forEach((p, i) => {
    const r = yearResults.get(p.year);
    if (!r) return;
    if (r.error) { periodStatus[i] = "error"; return; }
    if (r.events.length === 0) { periodStatus[i] = "missing"; return; }
    periodStatus[i] = "ok";
    counts[i] = 0;
  });
  for (const [year, r] of yearResults) {
    if (r.error) { failedYears.push(year); continue; }
    for (const e of r.events) {
      if (e.month == null) continue;
      const i = monthPeriodIndex(periods, year, e.month);
      if (i < 0 || periodStatus[i] !== "ok") continue;
      byPeriod[i]!.push(e);
      counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  const allDone = periods.every((p) => yearResults.has(p.year));
  return { status: allDone ? "ready" : "loading", counts, periodStatus, byPeriod, failedYears: failedYears.sort() };
}

function emit() {
  snap = build();
  listeners.forEach((fn) => fn());
}

/** 讀還沒讀到或讀取失敗的年份（第一次載入與「重試」共用）。 */
async function loadMissing() {
  if (loading) return;
  loading = true;
  const years = [...new Set(periodsOf(KEY).map((p) => p.year))].filter((y) => {
    const r = yearResults.get(y);
    return !r || r.error;
  });
  for (const y of years) yearResults.delete(y);
  emit();
  await Promise.all(years.map(async (y) => {
    // 年檔以民國年命名（manifest data.files 的 <rocYear>）
    const r = await loadFireEventsByYearResult(rocYear(y));
    yearResults.set(y, r);
    emit();
  }));
  loading = false;
  emit();
}

export function retryFireEventSeries(): void {
  void loadMissing();
}

/** enabled 時才開始載入（打開火災圖層才抓）。 */
export function useFireEventSeries(enabled: boolean): EventSeries {
  useEffect(() => { if (enabled && yearResults.size === 0) void loadMissing(); }, [enabled]);
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getSnap,
    getSnap,
  );
}

/** 區間合計；不是 ok 的期別分別計數。 */
export function sumSeries(s: EventSeries, a: number, b: number): { n: number; missing: number; failed: number } {
  let n = 0, missing = 0, failed = 0;
  for (let i = a; i <= b; i++) {
    const st = s.periodStatus[i];
    if (st === "ok") n += s.counts[i] ?? 0;
    else if (st === "missing") missing += 1;
    else if (st === "error") failed += 1;
  }
  return { n, missing, failed };
}
