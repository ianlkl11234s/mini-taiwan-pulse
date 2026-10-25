/**
 * 公車擁擠模擬：public/sim/bus-crowding/ 靜態檔（gitignored，build-bus-crowding-sim.py 產生）。
 * 幾何只抓一次；數值檔依「方案 × 兩版」抓，模組級快取，切換不重抓。全部包 withLoading（CLAUDE.md §3）。
 */
import { withLoading } from "../lib/loadingRegistry";
import {
  BUS_CROWDING_VERSIONS, busCrowdingSimUrl,
  type BusCrowdingScenario, type BusCrowdingScenarioData, type BusCrowdingValues, type BusCrowdingVersion,
} from "./busCrowdingSimTypes";
import { assembleReplayTrips, type ReplayLine, type ReplayTrip, type ReplayTripDiff } from "./busCrowdingReplay";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function getJson<T>(path: string, fetchFn: FetchLike): Promise<T> {
  const response = await fetchFn(busCrowdingSimUrl(path));
  if (!response.ok) throw new Error(`公車擁擠模擬資料讀取失敗（HTTP ${response.status}）：${path}`);
  return (await response.json()) as T;
}

let geometryPromise: Promise<GeoJSON.FeatureCollection> | null = null;
const valuesCache = new Map<string, Promise<BusCrowdingValues>>();

/** 路段幾何（約 2.1 萬段，gzip 約 0.8 MB）。失敗時清快取，下次開圖層重試。 */
export function loadBusCrowdingSegments(fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<GeoJSON.FeatureCollection> {
  if (!geometryPromise) {
    geometryPromise = withLoading("bus-crowding-sim:segments", "公車擁擠模擬路段載入中", getJson<GeoJSON.FeatureCollection>("segments.geojson", fetchFn));
    geometryPromise.catch(() => { geometryPromise = null; });
  }
  return geometryPromise;
}

function loadValues(version: BusCrowdingVersion, scenario: BusCrowdingScenario, fetchFn: FetchLike): Promise<BusCrowdingValues> {
  const key = `${version}/${scenario}`;
  let p = valuesCache.get(key);
  if (!p) {
    p = getJson<BusCrowdingValues>(`${key}.json`, fetchFn);
    valuesCache.set(key, p);
    p.catch(() => { valuesCache.delete(key); });
  }
  return p;
}

/** 一個方案的兩版數值（popup 兩版都要）。 */
export function loadBusCrowdingScenario(scenario: BusCrowdingScenario, fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<BusCrowdingScenarioData> {
  return withLoading(`bus-crowding-sim:${scenario}`, "公車擁擠模擬數值載入中", (async () => {
    const [a, b] = await Promise.all(BUS_CROWDING_VERSIONS.map((v) => loadValues(v, scenario, fetchFn)));
    return { scenario, values: { v137: a!, v180: b! } };
  })());
}

// ── 時間回放（只在「時間回放」檢視載入；班次只含負載分級，不含人數）──

let replayLinesPromise: Promise<(ReplayLine | null)[]> | null = null;
const replayFileCache = new Map<string, Promise<unknown>>();
const replayTripsCache = new Map<string, Promise<ReplayTrip[]>>();

/** 回放線形（約 1.3 MB，gzip 約 0.4 MB）；index＝線編號，s3 與非單調線為 null。 */
export function loadBusCrowdingReplayLines(fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<(ReplayLine | null)[]> {
  if (!replayLinesPromise) {
    replayLinesPromise = withLoading("bus-crowding-sim:replay-lines", "公車擁擠回放線形載入中", getJson<(ReplayLine | null)[]>("lines.json", fetchFn));
    replayLinesPromise.catch(() => { replayLinesPromise = null; });
  }
  return replayLinesPromise;
}

function loadReplayFile<T>(path: string, fetchFn: FetchLike): Promise<T> {
  let p = replayFileCache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = getJson<T>(path, fetchFn);
    replayFileCache.set(path, p);
    p.catch(() => { replayFileCache.delete(path); });
  }
  return p;
}

/**
 * 一個版本 × 方案的完整班次：整包載基準 trips＋該方案 diff，組法照原型 index.html:183–184。
 * （PLAN Phase 3 原寫「點路線才載」，全城動畫需要全部班次，刻意偏離，見 PLAN。）切版本才換檔。
 */
export function loadBusCrowdingReplayTrips(
  version: BusCrowdingVersion, scenario: BusCrowdingScenario, fetchFn: FetchLike = (u, i) => fetch(u, i),
): Promise<ReplayTrip[]> {
  const key = `${version}/${scenario}`;
  let p = replayTripsCache.get(key);
  if (!p) {
    p = withLoading(`bus-crowding-sim:replay:${key}`, "公車擁擠回放班次載入中", (async () => {
      const base = await loadReplayFile<{ trips: ReplayTrip[] }>(`${version}/trips-base.json`, fetchFn);
      const diff = scenario === "base" ? null : await loadReplayFile<ReplayTripDiff>(`${version}/trips-${scenario}.json`, fetchFn);
      return assembleReplayTrips(base.trips, diff);
    })());
    replayTripsCache.set(key, p);
    p.catch(() => { replayTripsCache.delete(key); });
  }
  return p;
}
