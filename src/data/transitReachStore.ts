/**
 * 交通可及性模擬資料（公開模擬資料家族 slug＝transit_reach）的載入與共用狀態。
 *
 * - 基本檔（bundle、cells、origins、routes）一次載入、快取；網格（grid/res7.json）只在開網格層時載入。
 * - 起點檔 `od/{speed}/{mode}/{origin}.u16` 依起點與模式逐檔載入（112 KB／檔，simBundle 驗 sha）。
 * - 播放層目前畫在地圖上的到達時間放在 `transitReachPlaybackState`，點擊讀值（popup）從這裡查，不重抓。
 */
import { loadSimBundle, loadSimFile, loadSimJson } from "./simBundle";
import type { LoadedSimBundle } from "./simBundleTypes";
import {
  TRANSIT_REACH_NA, TRANSIT_REACH_SLUG, normalizeOrigins, odPath,
  type TransitReachCells, type TransitReachGridData, type TransitReachMode, type TransitReachOdMode, type TransitReachOrigin,
  type TransitReachRoute, type TransitReachSpeed,
} from "./transitReachTypes";

const LABEL = "交通可及性模擬資料";

export interface TransitReachBase {
  bundle: LoadedSimBundle;
  cells: TransitReachCells;
  origins: TransitReachOrigin[];
  routes: TransitReachRoute[];
}

let basePromise: Promise<TransitReachBase> | null = null;
let baseValue: TransitReachBase | null = null;
const baseListeners = new Set<() => void>();

export function loadTransitReachBase(): Promise<TransitReachBase> {
  if (!basePromise) {
    basePromise = (async () => {
      const bundle = await loadSimBundle(TRANSIT_REACH_SLUG, LABEL);
      const [cells, originsRaw, routes] = await Promise.all([
        loadSimJson<TransitReachCells>(bundle, "cells.json", LABEL),
        loadSimJson<unknown>(bundle, "origins.json", LABEL),
        loadSimJson<TransitReachRoute[]>(bundle, "routes.json", LABEL),
      ]);
      if (!Array.isArray(cells?.ids) || !Array.isArray(cells?.u) || cells.ids.length !== cells.u.length) throw new Error("cells.json 格式不符");
      return { bundle, cells, origins: normalizeOrigins(originsRaw), routes: Array.isArray(routes) ? routes : [] };
    })();
    basePromise.then(
      (value) => { baseValue = value; for (const l of baseListeners) l(); },
      () => { basePromise = null; for (const l of baseListeners) l(); },
    );
  }
  return basePromise;
}

/** 已載入的基本檔（同步讀；未載入回 null） */
export const transitReachBase = () => baseValue;

export function subscribeTransitReachBase(cb: () => void): () => void {
  baseListeners.add(cb);
  return () => { baseListeners.delete(cb); };
}

/** 網格檔路徑：bundle.json layers[reach_grid].file，沒給就用 grid/res7.json */
function gridPath(bundle: LoadedSimBundle): string {
  const layer = bundle.manifest.layers?.find((l) => l.id === "reach_grid") as { file?: unknown } | undefined;
  return typeof layer?.file === "string" ? layer.file : "grid/res7.json";
}

/** 網格層已載入的資料（popup 依 properties.i 讀全部指標） */
let gridLoaded: { bundle: LoadedSimBundle; grid: TransitReachGridData } | null = null;
const gridListeners = new Set<() => void>();
export const transitReachGridData = () => gridLoaded;
export function subscribeTransitReachGrid(cb: () => void): () => void {
  gridListeners.add(cb);
  return () => { gridListeners.delete(cb); };
}

let gridPromise: Promise<{ bundle: LoadedSimBundle; grid: TransitReachGridData }> | null = null;
export function loadTransitReachGrid(): Promise<{ bundle: LoadedSimBundle; grid: TransitReachGridData }> {
  if (!gridPromise) {
    gridPromise = (async () => {
      const bundle = await loadSimBundle(TRANSIT_REACH_SLUG, LABEL);
      const grid = await loadSimJson<TransitReachGridData>(bundle, gridPath(bundle), "交通可及性網格");
      if (!Array.isArray(grid?.ids) || !grid.v) throw new Error("網格檔格式不符");
      gridLoaded = { bundle, grid };
      for (const l of gridListeners) l();
      return gridLoaded;
    })();
    gridPromise.catch(() => { gridPromise = null; });
  }
  return gridPromise;
}

export async function loadTransitReachOd(bundle: LoadedSimBundle, speed: TransitReachSpeed, mode: TransitReachOdMode, origin: TransitReachOrigin): Promise<Uint16Array> {
  const bytes = await loadSimFile(bundle, odPath(bundle.manifest, speed, mode, origin.key), "交通可及性起點資料");
  return new Uint16Array(bytes);
}

// ══════════════════════════════════════════════════════════════════
//  播放層目前狀態（popup 讀值）
// ══════════════════════════════════════════════════════════════════

export interface TransitReachPlaybackState {
  origin: TransitReachOrigin;
  mode: TransitReachMode;
  speed: TransitReachSpeed;
  /** 主檔（比較模式＝較多運具那組） */
  main: Uint16Array;
  /** 比較基準檔 */
  base: Uint16Array | null;
  cells: TransitReachCells;
  /** cell id → 索引 */
  cellIndex: Map<string, number>;
  rangeHours: number;
}

let playbackState: TransitReachPlaybackState | null = null;
export const transitReachPlaybackState = () => playbackState;
const playbackListeners = new Set<() => void>();
export function setTransitReachPlaybackState(next: TransitReachPlaybackState | null): void {
  playbackState = next;
  for (const l of playbackListeners) l();
}
export function subscribeTransitReachPlayback(cb: () => void): () => void {
  playbackListeners.add(cb);
  return () => { playbackListeners.delete(cb); };
}

/**
 * 點擊讀值（自訂 WebGL 圖層不能 queryRenderedFeatures）：用 h3 latLngToCell 查格，回傳 popup 用的值快照。
 * 不在陸地格內或播放層沒有資料回 null。`latLngToCell` 由呼叫端提供（h3 已因圖層載入）。
 */
export function pickTransitReachCell(lng: number, lat: number, latLngToCell: (lat: number, lng: number, res: number) => string): Record<string, unknown> | null {
  const s = playbackState;
  if (!s) return null;
  const i = s.cellIndex.get(latLngToCell(lat, lng, s.cells.res));
  if (i === undefined) return null;
  const minutes = (v: number | undefined) => (v === undefined || v === TRANSIT_REACH_NA ? null : v / 10);
  return {
    cell: s.cells.ids[i], u: s.cells.u[i] ?? 0,
    t: minutes(s.main[i]), base: s.base ? minutes(s.base[i]) : null,
    originName: s.origin.name, originNameEn: s.origin.name_en ?? null, originMode: s.origin.mode,
    mode: s.mode, speed: s.speed,
  };
}

/** 圖例提示：此起點沒有所選模式的資料（例：高鐵站沒有「台鐵＋開車」） */
export interface TransitReachNotice { kind: "noMode"; originName: string; mode: TransitReachMode; stationKind: string }
let notice: TransitReachNotice | null = null;
const noticeListeners = new Set<() => void>();
export const transitReachNotice = () => notice;
export function setTransitReachNotice(next: TransitReachNotice | null): void {
  if (notice === next || (notice && next && notice.originName === next.originName && notice.mode === next.mode)) return;
  notice = next;
  for (const l of noticeListeners) l();
}
export function subscribeTransitReachNotice(cb: () => void): () => void {
  noticeListeners.add(cb);
  return () => { noticeListeners.delete(cb); };
}

const cellIndexCache = new WeakMap<TransitReachCells, Map<string, number>>();
export function cellIndexOf(cells: TransitReachCells): Map<string, number> {
  let index = cellIndexCache.get(cells);
  if (!index) {
    index = new Map(cells.ids.map((id, i) => [id, i]));
    cellIndexCache.set(cells, index);
  }
  return index;
}

/** 測試用 */
export function resetTransitReachStoreForTests(): void {
  basePromise = null; baseValue = null; gridPromise = null; playbackState = null; notice = null; gridLoaded = null;
}
