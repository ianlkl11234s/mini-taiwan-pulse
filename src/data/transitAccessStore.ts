/**
 * 雙北大眾運輸可及性模擬資料（公開模擬資料家族 slug＝transit_access）的載入與共用狀態。
 *
 * - 網格：grid/cells.json、facilities.json、car.u8 開網格層才載；每個（公車版本×時段）三檔 near／count／arg 切到才載。
 * - 單起點：single/cells.json、origins.json 開播放層才載；每個（版本×時段×起點）一檔 u8（77 KB）切到才載。
 * - 圖例與 popup 讀這裡目前畫在地圖上的那組資料，不重抓。
 */
import { loadSimBundle, loadSimFile, loadSimJson } from "./simBundle";
import type { LoadedSimBundle } from "./simBundleTypes";
import {
  DEFAULT_CLASSIFICATION, TRANSIT_ACCESS_SLUG, gridClassification, gridFilePath, gridMeta, singleFilePath,
  type TransitAccessCells, type TransitAccessClassification, type TransitAccessFacilities, type TransitAccessGridMeta, type TransitAccessOrigin, type TransitAccessSlotData,
} from "./transitAccessTypes";

const LABEL = "雙北大眾運輸可及性模擬資料";

function listeners() {
  const set = new Set<() => void>();
  return {
    emit: () => { for (const l of set) l(); },
    subscribe: (cb: () => void) => { set.add(cb); return () => { set.delete(cb); }; },
  };
}

// 分級設定（門檻預設、分階）：bundle 載入後換成 bundle.json 的值；圖例、popup、host 共用
let classification: TransitAccessClassification = DEFAULT_CLASSIFICATION;
const clsL = listeners();
export const transitAccessClassification = () => classification;
export const subscribeTransitAccessClassification = clsL.subscribe;

async function bundleOnce(): Promise<LoadedSimBundle> {
  const b = await loadSimBundle(TRANSIT_ACCESS_SLUG, LABEL);
  const next = gridClassification(b.manifest);
  if (JSON.stringify(next) !== JSON.stringify(classification)) { classification = next; clsL.emit(); }
  return b;
}

function validCells(c: TransitAccessCells | null | undefined): c is TransitAccessCells {
  return !!c && Array.isArray(c.h3) && Array.isArray(c.pop) && Array.isArray(c.town) && c.h3.length === c.pop.length && c.h3.length === c.town.length;
}

// ══════════════════════════════════════════════════════════════════
//  網格
// ══════════════════════════════════════════════════════════════════

export interface TransitAccessGridBase {
  bundle: LoadedSimBundle;
  meta: TransitAccessGridMeta;
  cells: TransitAccessCells;
  facilities: TransitAccessFacilities;
  car: Uint8Array;
}

let gridBasePromise: Promise<TransitAccessGridBase> | null = null;
export function loadTransitAccessGridBase(): Promise<TransitAccessGridBase> {
  if (!gridBasePromise) {
    gridBasePromise = (async () => {
      const bundle = await bundleOnce();
      const [cells, facilities, car] = await Promise.all([
        loadSimJson<TransitAccessCells>(bundle, "grid/cells.json", LABEL),
        loadSimJson<TransitAccessFacilities>(bundle, "grid/facilities.json", LABEL),
        loadSimFile(bundle, "grid/car.u8", LABEL),
      ]);
      const meta = gridMeta(bundle.manifest);
      if (!validCells(cells)) throw new Error("grid/cells.json 格式不符");
      if (car.byteLength !== meta.groups.length * cells.h3.length) throw new Error("grid/car.u8 長度不符");
      return { bundle, meta, cells, facilities, car: new Uint8Array(car) };
    })();
    gridBasePromise.catch(() => { gridBasePromise = null; });
  }
  return gridBasePromise;
}

/** 一組（公車版本×時段）的三檔；長度依 meta 驗 */
export async function loadTransitAccessSlot(base: TransitAccessGridBase, network: string, slot: string): Promise<TransitAccessSlotData> {
  const { bundle, meta, cells } = base;
  const n = cells.h3.length, g = meta.groups.length;
  const [near, count, arg] = await Promise.all((["near", "count", "arg"] as const).map((kind) => loadSimFile(bundle, gridFilePath(bundle.manifest, kind, network, slot), "雙北大眾運輸可及性網格")));
  if (near!.byteLength !== g * meta.percentiles.length * n || count!.byteLength !== g * meta.thresholds.length * n * 2 || arg!.byteLength !== g * n * 2) {
    throw new Error(`網格檔長度不符：${network}/${slot}`);
  }
  return { near: new Uint8Array(near!), count: new Uint16Array(count!), arg: new Uint16Array(arg!) };
}

/** 網格層目前畫在地圖上的資料（圖例統計與 popup 讀） */
export interface TransitAccessGridState {
  base: TransitAccessGridBase;
  network: string;
  slot: string;
  /** 主檔（比較模式＝GPS 版） */
  main: TransitAccessSlotData;
  /** 比較基準（表定版）；非比較模式為 null */
  sched: TransitAccessSlotData | null;
}
let gridState: TransitAccessGridState | null = null;
const gridL = listeners();
export const transitAccessGridState = () => gridState;
export const subscribeTransitAccessGrid = gridL.subscribe;
export function setTransitAccessGridState(next: TransitAccessGridState | null): void {
  gridState = next;
  gridL.emit();
}

/** 該時段在 bundle 沒有結果（尚未計算）時的提示 */
let gridNotice: string | null = null;
const noticeL = listeners();
export const transitAccessGridNotice = () => gridNotice;
export const subscribeTransitAccessGridNotice = noticeL.subscribe;
export function setTransitAccessGridNotice(next: string | null): void {
  if (gridNotice === next) return;
  gridNotice = next;
  noticeL.emit();
}

// ══════════════════════════════════════════════════════════════════
//  單起點
// ══════════════════════════════════════════════════════════════════

export interface TransitAccessSingleBase {
  bundle: LoadedSimBundle;
  cells: TransitAccessCells;
  origins: TransitAccessOrigin[];
  cellIndex: Map<string, number>;
}

let singleBasePromise: Promise<TransitAccessSingleBase> | null = null;
export function loadTransitAccessSingleBase(): Promise<TransitAccessSingleBase> {
  if (!singleBasePromise) {
    singleBasePromise = (async () => {
      const bundle = await bundleOnce();
      const [cells, origins] = await Promise.all([
        loadSimJson<TransitAccessCells>(bundle, "single/cells.json", LABEL),
        loadSimJson<TransitAccessOrigin[]>(bundle, "single/origins.json", LABEL),
      ]);
      if (!validCells(cells) || !Array.isArray(origins)) throw new Error("single/cells.json／origins.json 格式不符");
      return { bundle, cells, origins, cellIndex: new Map(cells.h3.map((id, i) => [id, i])) };
    })();
    singleBasePromise.catch(() => { singleBasePromise = null; });
  }
  return singleBasePromise;
}

export async function loadTransitAccessSingle(base: TransitAccessSingleBase, network: string, slot: string, origin: string): Promise<Uint8Array> {
  const bytes = await loadSimFile(base.bundle, singleFilePath(base.bundle.manifest, network, slot, origin), "雙北大眾運輸可及性起點資料");
  if (bytes.byteLength !== 3 * base.cells.h3.length) throw new Error(`起點檔長度不符：${network}/${slot}/${origin}`);
  return new Uint8Array(bytes);
}

/** 播放層目前狀態（popup 讀值） */
export interface TransitAccessPlaybackState {
  base: TransitAccessSingleBase;
  origin: TransitAccessOrigin;
  network: string;
  slot: string;
  /** u8 [3][N]（P5、P50、P95）；比較模式＝GPS 版 */
  main: Uint8Array;
  /** 比較基準（表定版） */
  sched: Uint8Array | null;
  rangeHours: number;
}
let playbackState: TransitAccessPlaybackState | null = null;
const playbackL = listeners();
export const transitAccessPlaybackState = () => playbackState;
export const subscribeTransitAccessPlayback = playbackL.subscribe;
export function setTransitAccessPlaybackState(next: TransitAccessPlaybackState | null): void {
  playbackState = next;
  playbackL.emit();
}

/** 點擊讀值（自訂 WebGL 圖層不能 queryRenderedFeatures）：h3 latLngToCell(res9) 查格，回傳 popup 用快照 */
export function pickTransitAccessCell(lng: number, lat: number, latLngToCell: (lat: number, lng: number, res: number) => string): Record<string, unknown> | null {
  const s = playbackState;
  if (!s) return null;
  const i = s.base.cellIndex.get(latLngToCell(lat, lng, 9));
  if (i === undefined) return null;
  const n = s.base.cells.h3.length;
  const three = (b: Uint8Array | null) => (b ? [b[i]!, b[n + i]!, b[2 * n + i]!] : null);
  return {
    i, pop: s.base.cells.pop[i] ?? 0, town: s.base.cells.towns[s.base.cells.town[i] ?? -1] ?? null,
    origin: s.origin.key, network: s.network, slot: s.slot, main: three(s.main), sched: three(s.sched),
  };
}

/** 測試用 */
export function resetTransitAccessStoreForTests(): void {
  gridBasePromise = null; singleBasePromise = null; classification = DEFAULT_CLASSIFICATION; gridState = null; playbackState = null; gridNotice = null;
}
