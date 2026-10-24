/**
 * 公車擁擠模擬：public/sim/bus-crowding/ 靜態檔（gitignored，build-bus-crowding-sim.py 產生）。
 * 幾何只抓一次；數值檔依「方案 × 兩版」抓，模組級快取，切換不重抓。全部包 withLoading（CLAUDE.md §3）。
 */
import { withLoading } from "../lib/loadingRegistry";
import {
  BUS_CROWDING_VERSIONS, busCrowdingSimUrl,
  type BusCrowdingScenario, type BusCrowdingScenarioData, type BusCrowdingValues, type BusCrowdingVersion,
} from "./busCrowdingSimTypes";

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
