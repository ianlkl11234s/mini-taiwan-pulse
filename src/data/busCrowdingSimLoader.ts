/**
 * 公車擁擠模擬：站主限定私人 Range API（sidecar 白名單＝busCrowdingSimAssets.ts，build-bus-crowding-sim.py 產生）。
 * 每個請求都帶 Bearer（sidecar 每次驗站主），401／403 丟出帶 status 的錯誤，由呼叫端派 BUS_CROWDING_SIM_ACCESS_DENIED_EVENT 鎖回。
 * 幾何只抓一次；數值檔依「方案 × 兩版」抓，模組級快取（以帳號 id 分開；失去權限時 clearBusCrowdingSimCache 清空，
 * 不留在記憶體給別的帳號）。全部包 withLoading（CLAUDE.md §3）。
 */
import { withLoading } from "../lib/loadingRegistry";
import { BUS_CROWDING_SIM_ASSETS, type BusCrowdingSimAssetName } from "./busCrowdingSimAssets";
import {
  BUS_CROWDING_VERSIONS,
  type BusCrowdingScenario, type BusCrowdingScenarioData, type BusCrowdingValues, type BusCrowdingVersion,
} from "./busCrowdingSimTypes";
import { assembleReplayTrips, type ReplayLine, type ReplayTrip, type ReplayTripDiff } from "./busCrowdingReplay";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchLike = (u, i) => fetch(u, i);

export const BUS_CROWDING_SIM_PRIVATE_ENDPOINT = "/api/private-research/bus-crowding";
export const busCrowdingSimAssetUrl = (name: BusCrowdingSimAssetName) => `${BUS_CROWDING_SIM_PRIVATE_ENDPOINT}/${name}`;

/** 誰在讀、怎麼拿 token（每個請求重新取，不快取 token）。 */
export interface BusCrowdingSimAuth { userId: string; token: () => Promise<string> }

/** sidecar 只回 206 Range：以資產已知大小要整段（34 檔都 < 8 MiB，一段即可）。 */
export async function fetchBusCrowdingPrivateJson<T>(name: BusCrowdingSimAssetName, auth: BusCrowdingSimAuth, fetchFn: FetchLike = defaultFetch): Promise<T> {
  const { size } = BUS_CROWDING_SIM_ASSETS[name];
  const token = await auth.token();
  const response = await fetchFn(busCrowdingSimAssetUrl(name), {
    cache: "no-store", headers: { Authorization: `Bearer ${token}`, Range: `bytes=0-${size - 1}` },
  });
  if (response.status === 401 || response.status === 403) {
    const error = new Error(`bus crowding access denied (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status !== 206) throw new Error(`公車擁擠模擬私人資料尚未就緒（HTTP ${response.status}）：${name}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== size) throw new Error(`公車擁擠模擬私人資料長度不符：${name}`);
  return JSON.parse(new TextDecoder("utf-8").decode(bytes)) as T;
}

/** 401／403（不是站主、登出、session 撤銷）。 */
export const isBusCrowdingAccessDenied = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403;
};

const geometryCache = new Map<string, Promise<GeoJSON.FeatureCollection>>();
const valuesCache = new Map<string, Promise<BusCrowdingValues>>();
const replayLinesCache = new Map<string, Promise<(ReplayLine | null)[]>>();
const replayFileCache = new Map<string, Promise<unknown>>();
const replayTripsCache = new Map<string, Promise<ReplayTrip[]>>();

/** 失去權限或換帳號：清掉所有已下載的私人資料。 */
export function clearBusCrowdingSimCache(): void {
  for (const cache of [geometryCache, valuesCache, replayLinesCache, replayFileCache, replayTripsCache]) cache.clear();
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => { if (cache.get(key) === p) cache.delete(key); });
  }
  return p;
}

/** 路段幾何（約 2.1 萬段，5.8 MB）。失敗時清快取，下次開圖層重試。 */
export function loadBusCrowdingSegments(auth: BusCrowdingSimAuth, fetchFn: FetchLike = defaultFetch): Promise<GeoJSON.FeatureCollection> {
  return cached(geometryCache, auth.userId, () => withLoading("bus-crowding-sim:segments", "公車擁擠模擬路段載入中",
    fetchBusCrowdingPrivateJson<GeoJSON.FeatureCollection>("segments", auth, fetchFn)));
}

function loadValues(version: BusCrowdingVersion, scenario: BusCrowdingScenario, auth: BusCrowdingSimAuth, fetchFn: FetchLike): Promise<BusCrowdingValues> {
  return cached(valuesCache, `${auth.userId}|${version}/${scenario}`, () => fetchBusCrowdingPrivateJson<BusCrowdingValues>(`${version}-${scenario}`, auth, fetchFn));
}

/** 一個方案的兩版數值（popup 兩版都要）。 */
export function loadBusCrowdingScenario(scenario: BusCrowdingScenario, auth: BusCrowdingSimAuth, fetchFn: FetchLike = defaultFetch): Promise<BusCrowdingScenarioData> {
  return withLoading(`bus-crowding-sim:${scenario}`, "公車擁擠模擬數值載入中", (async () => {
    const [a, b] = await Promise.all(BUS_CROWDING_VERSIONS.map((v) => loadValues(v, scenario, auth, fetchFn)));
    return { scenario, values: { v137: a!, v180: b! } };
  })());
}

// ── 時間回放（只在「時間回放」檢視載入；班次只含負載分級，不含人數）──

/** 回放線形（約 2 MB）；index＝線編號，s3 與非單調線為 null。 */
export function loadBusCrowdingReplayLines(auth: BusCrowdingSimAuth, fetchFn: FetchLike = defaultFetch): Promise<(ReplayLine | null)[]> {
  return cached(replayLinesCache, auth.userId, () => withLoading("bus-crowding-sim:replay-lines", "公車擁擠回放線形載入中",
    fetchBusCrowdingPrivateJson<(ReplayLine | null)[]>("lines", auth, fetchFn)));
}

function loadReplayFile<T>(name: BusCrowdingSimAssetName, auth: BusCrowdingSimAuth, fetchFn: FetchLike): Promise<T> {
  return cached(replayFileCache, `${auth.userId}|${name}`, () => fetchBusCrowdingPrivateJson<T>(name, auth, fetchFn)) as Promise<T>;
}

/**
 * 一個版本 × 方案的完整班次：整包載基準 trips＋該方案 diff，組法照原型 index.html:183–184。
 * （PLAN Phase 3 原寫「點路線才載」，全城動畫需要全部班次，刻意偏離，見 PLAN。）切版本才換檔。
 */
export function loadBusCrowdingReplayTrips(
  version: BusCrowdingVersion, scenario: BusCrowdingScenario, auth: BusCrowdingSimAuth, fetchFn: FetchLike = defaultFetch,
): Promise<ReplayTrip[]> {
  const key = `${version}/${scenario}`;
  return cached(replayTripsCache, `${auth.userId}|${key}`, () => withLoading(`bus-crowding-sim:replay:${key}`, "公車擁擠回放班次載入中", (async () => {
    const base = await loadReplayFile<{ trips: ReplayTrip[] }>(`${version}-trips-base`, auth, fetchFn);
    const diff = scenario === "base" ? null : await loadReplayFile<ReplayTripDiff>(`${version}-trips-${scenario}`, auth, fetchFn);
    return assembleReplayTrips(base.trips, diff);
  })()));
}
