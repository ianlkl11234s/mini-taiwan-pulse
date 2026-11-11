/**
 * City Sound Atlas — 模組級 store（Host、面板、圖例、popup 共用；App 不經手）。
 *
 * 時間不在這裡：「當下」結果由 Host 以 timeStore.subscribeThrottled 節流算好再寫進來，
 * React 端只訂閱這個 store（useSyncExternalStore），不把 currentTime 放進 deps。
 */
import type { DayProfile, ReceiverQueryResult } from "./engines/receiverQuery";
import type { RouteProfile } from "./engines/routeProfile";
import type { SoundSceneId, SoundSceneSnapshot } from "./scenes";
import type { SetOrigin } from "./soundAtlasData";
import type { Receiver, SoundSourceFamily, SoundSourceSet } from "./types";

export interface SoundAtlasPerf {
  /** 最近一次「當下」接收點查詢耗時（ms） */
  lastQueryMs: number | null;
  /** 最近一次 24h 構成計算耗時（ms） */
  lastProfileMs: number | null;
  /** 本次開啟以來同時波前峰值（未套上限前的活躍數）與實際畫出的峰值 */
  wavefrontActivePeak: number;
  wavefrontDrawnPeak: number;
}

/** 路線剖面（沿途主要聲源；不是噪音暴露量）。出發時間在按「完成」時讀一次時間軸 */
export interface SoundRouteState {
  drawing: boolean;
  points: [number, number][];
  mode: "walk" | "bike";
  departUnix: number | null;
  result: RouteProfile<SoundSourceFamily> | null;
}

export interface SoundAtlasState {
  receiver: Receiver | null;
  /** 「放置接收點」模式：下一次點地圖放點 */
  placing: boolean;
  sceneId: SoundSceneId | null;
  /** 場景快照（null = 沒有或讀不到；來源全走即時） */
  snapshot: SoundSceneSnapshot | null;
  snapshotStatus: "none" | "loading" | "loaded" | "missing";
  /** 已載入資料的日期（臺灣日期） */
  dateKey: string | null;
  sets: Partial<Record<SoundSourceFamily, SoundSourceSet>>;
  origins: Partial<Record<SoundSourceFamily, SetOrigin>>;
  loading: SoundSourceFamily[];
  current: ReceiverQueryResult | null;
  profile: DayProfile | null;
  perf: SoundAtlasPerf;
  route: SoundRouteState;
}

export const EMPTY_ROUTE: SoundRouteState = { drawing: false, points: [], mode: "walk", departUnix: null, result: null };

const INITIAL: SoundAtlasState = {
  receiver: null,
  placing: false,
  sceneId: null,
  snapshot: null,
  snapshotStatus: "none",
  dateKey: null,
  sets: {},
  origins: {},
  loading: [],
  current: null,
  profile: null,
  perf: { lastQueryMs: null, lastProfileMs: null, wavefrontActivePeak: 0, wavefrontDrawnPeak: 0 },
  route: EMPTY_ROUTE,
};

let state: SoundAtlasState = INITIAL;
const listeners = new Set<() => void>();

export const soundAtlasStore = {
  get(): SoundAtlasState {
    return state;
  },
  set(patch: Partial<SoundAtlasState>): void {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  /** 全部聲景圖層關掉時清空（接收點與場景也清，避免下次開啟殘留） */
  reset(): void {
    state = INITIAL;
    listeners.forEach((l) => l());
  },
};

export const DEFAULT_RECEIVER_HEIGHT_M = 1.5;

/** Host 掛上的地圖（面板「選場景」要 flyTo 用）；圖層全關時清掉 */
let soundAtlasMap: import("mapbox-gl").Map | null = null;
export function setSoundAtlasMap(map: import("mapbox-gl").Map | null): void {
  soundAtlasMap = map;
}
export function getSoundAtlasMap(): import("mapbox-gl").Map | null {
  return soundAtlasMap;
}

export function makeReceiver(lon: number, lat: number, heightM: number = DEFAULT_RECEIVER_HEIGHT_M): Receiver {
  return { id: "sound-receiver", longitude: lon, latitude: lat, heightM, environment: "outdoor" };
}
