/**
 * 交通可及性整點等時線（移植原型 reach.html buildGridCell／computeIso）。
 *
 * 切起點時在瀏覽器算一次：H3 res 8 到達時間柵格化到 0.01°（約 1 km，440×485）規則網格；
 * 無路網／未到的陸地格與海面以鄰格平均往外填 20 格（約 20 km），等值線才會穿過山區而不是沿空白邊界繞；
 * 再用 d3-contour 對 1…H 小時各算一條，填出來的海面與離陸地太遠的空白不畫（線在海岸、空白處斷開）。
 * 播放時只在跨過整點時改 filter（≤12 次），不重算。
 */
import type { ContourMultiPolygon } from "d3-contour";
import { TRANSIT_REACH_NA, type TransitReachCells } from "./transitReachTypes";

export const ISO_GRID = { lng0: 117.9, lat1: 26.45, d: 0.01, w: 440, h: 485 } as const;

type LatLngToCell = (lat: number, lng: number, res: number) => string;
type ContoursFn = (values: ArrayLike<number>, thresholds: number[]) => ContourMultiPolygon[];

const gridCellCache = new WeakMap<TransitReachCells, Int32Array>();

/** 1 km 網格每格 → cells 索引（-1＝不在任何陸地格）。依 cells 快取（約 0.2 秒算一次） */
export function isoGridCells(cells: TransitReachCells, cellIndex: Map<string, number>, latLngToCell: LatLngToCell): Int32Array {
  const cached = gridCellCache.get(cells);
  if (cached) return cached;
  const { w, h, d, lng0, lat1 } = ISO_GRID;
  const out = new Int32Array(w * h).fill(-1);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const lat = lat1 - (j + 0.5) * d, lng = lng0 + (i + 0.5) * d;
    if (lat > 26.4 || lat < 21.7) continue;
    const k = cellIndex.get(latLngToCell(lat, lng, cells.res));
    if (k !== undefined) out[j * w + i] = k;
  }
  gridCellCache.set(cells, out);
  return out;
}

/** 整點等時線（MultiLineString，properties：h、label）。`contours` 由呼叫端以 d3-contour 建立（延遲載入）。 */
export function computeIsochrones(
  times: Uint16Array, cells: TransitReachCells, gridCell: Int32Array, rangeHours: number, contours: ContoursFn,
): GeoJSON.FeatureCollection<GeoJSON.MultiLineString, { h: number; label: string }> {
  const { w: W, h: H, d, lng0, lat1 } = ISO_GRID;
  const N = W * H;
  const val = new Float32Array(N).fill(NaN);
  const ok = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    const c = gridCell[n]!;
    if (c < 0) continue;
    ok[n] = 1;
    if (cells.u[c] !== 1 && times[c] !== TRANSIT_REACH_NA) val[n] = times[c]! / 10;
  }
  let cur = val;
  for (let pass = 0; pass < 20; pass++) {
    const nxt = Float32Array.from(cur);
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const n = j * W + i;
      if (!Number.isNaN(cur[n]!)) continue;
      let s = 0, k = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const v = cur[n + dj * W + di]!;
        if (!Number.isNaN(v)) { s += v; k++; }
      }
      if (k) nxt[n] = s / k;
    }
    cur = nxt;
  }
  const vals = new Float32Array(N);
  for (let n = 0; n < N; n++) vals[n] = Number.isNaN(cur[n]!) ? -1e6 : -cur[n]!;
  const thresholds: number[] = [];
  for (let hour = 1; hour <= rangeHours; hour++) thresholds.push(-hour * 60);
  const keep = (x: number, y: number) => {
    const i = Math.round(x - 0.5), j = Math.round(y - 0.5);
    if (i < 0 || j < 0 || i >= W || j >= H) return false;
    const n = j * W + i;
    return ok[n] === 1 && !Number.isNaN(cur[n]!);
  };
  const features = contours(vals, thresholds).map((c) => {
    const hour = Math.round(-c.value / 60);
    const lines: [number, number][][] = [];
    for (const poly of c.coordinates) for (const ring of poly) {
      let run: [number, number][] = [];
      for (const [x, y] of ring as [number, number][]) {
        if (keep(x, y)) run.push([lng0 + (x - 0.5) * d, lat1 - (y - 0.5) * d]);
        else { if (run.length > 3) lines.push(run); run = []; }
      }
      if (run.length > 3) lines.push(run);
    }
    return { type: "Feature" as const, properties: { h: hour, label: `${hour}h` }, geometry: { type: "MultiLineString" as const, coordinates: lines } };
  });
  return { type: "FeatureCollection", features };
}
