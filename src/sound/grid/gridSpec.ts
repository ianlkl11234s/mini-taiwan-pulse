/**
 * City Sound Atlas 北北網格定義（W6-0）。常數正本是同目錄 gridSpec.json（Python 預處理共讀）。
 *
 * - 等經緯度格（EPSG:4326），原點在西北角 (west, north)；列 0 在北、行 0 在西。
 * - 格 [col,row] 覆蓋 lon ∈ [west + col·dLon, west + (col+1)·dLon)、lat ∈ (north − (row+1)·dLat, north − row·dLat]。
 * - cellIndex = row·cols + col（列優先，與 PNG／Uint8Array 影像同序，可直接當 image source 的像素）。
 * - 範圍遮罩：gridMask.generated.ts（臺北市＋新北市，與縣市界相交面積 > 0 的格）。
 *
 * 選等經緯度而非 TWD97 公尺格：雷達 O-A0058-005 本身是等經緯度柵格，前端不必帶投影；
 * 東西向格寬隨緯度在 251.6–252.9 m 之間變動（<1%），南北向 ≈ 249 m。
 */
import spec from "./gridSpec.json";
import { GRID_MASK_ROW_SPANS } from "./gridMask.generated";

export const GRID_SPEC = spec as Readonly<typeof spec>;
export const GRID_COLS = spec.cols;
export const GRID_ROWS = spec.rows;
export const GRID_CELLS = spec.cols * spec.rows;
export const GRID_SOUTH = spec.north - spec.rows * spec.dLat;
export const GRID_EAST = spec.west + spec.cols * spec.dLon;
/** [west, south, east, north] */
export const GRID_BBOX: readonly [number, number, number, number] = [spec.west, GRID_SOUTH, GRID_EAST, spec.north];
/** 網格值的保留碼：無法判斷／缺資料（不可當 0） */
export const GRID_UNKNOWN = 255;

export type CountyCode = 0 | 1 | 2; // 0 範圍外、1 臺北市、2 新北市

/** 經緯度 → 格索引；在 bbox 外回 -1（不夾到邊界格） */
export function cellIndexOf(lon: number, lat: number): number {
  // +1e-9 格：消除 0.0025 等十進位步長的浮點誤差，讓格界恰好落在下一格
  const col = Math.floor((lon - spec.west) / spec.dLon + 1e-9);
  const row = Math.floor((spec.north - lat) / spec.dLat + 1e-9);
  if (!(col >= 0 && col < spec.cols && row >= 0 && row < spec.rows)) return -1;
  return row * spec.cols + col;
}

export function cellColRow(index: number): [number, number] {
  return [index % spec.cols, Math.floor(index / spec.cols)];
}

/** 格心 [lon, lat] */
export function cellCenter(index: number): [number, number] {
  const [col, row] = cellColRow(index);
  return [spec.west + (col + 0.5) * spec.dLon, spec.north - (row + 0.5) * spec.dLat];
}

let countyCache: Uint8Array | null = null;
/** 每格縣市碼（長度 GRID_CELLS；0 = 範圍外） */
export function countyCodes(): Uint8Array {
  if (countyCache) return countyCache;
  const out = new Uint8Array(GRID_CELLS);
  GRID_MASK_ROW_SPANS.forEach((spans, row) => {
    for (const [c0, c1, code] of spans) out.fill(code, row * spec.cols + c0, row * spec.cols + c1 + 1);
  });
  countyCache = out;
  return out;
}

export function countyOf(index: number): CountyCode {
  return (index >= 0 && index < GRID_CELLS ? countyCodes()[index]! : 0) as CountyCode;
}

/** 範圍內格的索引（遞增） */
export function inScopeCells(): Uint32Array {
  const codes = countyCodes();
  const out: number[] = [];
  for (let i = 0; i < codes.length; i++) if (codes[i]) out.push(i);
  return Uint32Array.from(out);
}
