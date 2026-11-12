/**
 * 飛機網格（W6-3）：一個 10 分區間內，每格的飛機潛勢碼（potentialCode：0／1–200／255）。
 *
 * 和 queryAviationInterval（接收點查詢、24h 構成圖）**同一套規則**，只是把「每格掃每架飛機」改成
 * 「每架飛機每個取樣時刻，只掃候選半徑內的格」：
 * - 取樣時刻：sampleTimes(t0, t1, AVIATION.intervalSampleStepS)（同 adapter）；
 * - 位置：aviationPositionAt（段內插值、長缺口 unknown）；水平距離 haversineM(格心, 飛機)（同參數順序）；
 * - 半徑內有高度 → 潛勢 proximityPotential(斜距, 2 km)，取所有飛機、所有時刻的最大值；
 * - 半徑內高度單位未知、或位置未知且缺口任一端（gapEnds）在半徑內 → 無法判斷候選；
 * - 每格：有潛勢 > 0 → 量化潛勢；否則有候選 → 255；否則 0。
 * 接收點固定為預設耳高（1.5 m）。一幀約數秒（全網格、10 分區間），所以只在預處理跑
 * （scripts/preprocess/sound/build-sound-grid-packs.ts → aviation-<D>.class.bin），前端讀包。
 */
import { AVIATION, COMMON } from "../model/soundProfiles";
import { haversineM, slantDistanceM } from "../engines/geometryDistance";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { aviationPositionAt, gapEnds, sampleTimes, type AviationRecord } from "../sourceAdapters/aviationAdapter";
import { cellCenter, countyCodes, GRID_CELLS, GRID_COLS, GRID_ROWS, GRID_SPEC, GRID_UNKNOWN } from "./gridSpec";
import { quantizePotential } from "./potentialCode";

const M_PER_DEG = 111_195;

let centers: { lon: Float64Array; lat: Float64Array } | null = null;
function cellCenters() {
  if (centers) return centers;
  const lon = new Float64Array(GRID_CELLS);
  const lat = new Float64Array(GRID_CELLS);
  for (let c = 0; c < GRID_CELLS; c++) {
    const [x, y] = cellCenter(c);
    lon[c] = x;
    lat[c] = y;
  }
  centers = { lon, lat };
  return centers;
}

/**
 * 對 (lon, lat) 半徑 radiusM 內的範圍內格呼叫 visit(cell, 水平距離)。
 * 外框只用來縮小掃描範圍（外擴 2%＋1 格），是否在半徑內一律用 haversineM 判定。
 */
function forCellsWithin(lon: number, lat: number, radiusM: number, scope: Uint8Array, visit: (cell: number, dh: number) => void): void {
  const { lon: cx, lat: cy } = cellCenters();
  const dLat = (radiusM / M_PER_DEG) * 1.02 + GRID_SPEC.dLat;
  const latMin = lat - dLat;
  const dLon = (radiusM / (M_PER_DEG * Math.cos(((Math.abs(lat) + dLat) * Math.PI) / 180))) * 1.02 + GRID_SPEC.dLon;
  const r0 = Math.max(0, Math.floor((GRID_SPEC.north - (lat + dLat)) / GRID_SPEC.dLat));
  const r1 = Math.min(GRID_ROWS - 1, Math.floor((GRID_SPEC.north - latMin) / GRID_SPEC.dLat));
  const c0 = Math.max(0, Math.floor((lon - dLon - GRID_SPEC.west) / GRID_SPEC.dLon));
  const c1 = Math.min(GRID_COLS - 1, Math.floor((lon + dLon - GRID_SPEC.west) / GRID_SPEC.dLon));
  for (let r = r0; r <= r1; r++) {
    const base = r * GRID_COLS;
    for (let c = c0; c <= c1; c++) {
      const i = base + c;
      if (!scope[i]) continue;
      const dh = haversineM(cx[i]!, cy[i]!, lon, lat);
      if (dh <= radiusM) visit(i, dh);
    }
  }
}

let scopeCache: Uint8Array | null = null;
/** 範圍內＝1（縣市遮罩） */
export function scopeMask(): Uint8Array {
  if (scopeCache) return scopeCache;
  const codes = countyCodes();
  scopeCache = new Uint8Array(GRID_CELLS);
  for (let i = 0; i < GRID_CELLS; i++) scopeCache[i] = codes[i] ? 1 : 0;
  return scopeCache;
}

/**
 * 一個區間 [t0, t1] 的整幀碼（長度 GRID_CELLS）。records 必須已過 coverage gate（status=ok 的來源）。
 * 範圍外的格不算、填 255（顯示時本來就被遮罩）。
 */
export function aviationIntervalCodes(
  records: readonly AviationRecord[],
  t0: number,
  t1: number,
  out: Uint8Array = new Uint8Array(GRID_CELLS),
  scope: Uint8Array = scopeMask(),
): Uint8Array {
  const pot = new Float64Array(GRID_CELLS);
  const unk = new Uint8Array(GRID_CELLS);
  const radius = AVIATION.candidateRadiusM.value;
  const half = AVIATION.halfPotentialDistanceM.value;
  const recvH = COMMON.receiverDefaultHeightM.value;
  const times = sampleTimes(t0, t1, AVIATION.intervalSampleStepS.value);
  const markUnknown = (c: number) => { unk[c] = 1; };
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    for (const t of times) {
      const pos = aviationPositionAt(r.payload, t);
      if (pos.status === "inactive") continue;
      if (pos.status === "unknown") {
        for (const end of gapEnds(r.payload, t)) if (end) forCellsWithin(end[1], end[0], radius, scope, markUnknown);
        continue;
      }
      const alt = pos.altitudeM;
      if (alt == null) {
        forCellsWithin(pos.lon, pos.lat, radius, scope, markUnknown);
        continue;
      }
      forCellsWithin(pos.lon, pos.lat, radius, scope, (c, dh) => {
        const p = proximityPotential(slantDistanceM(dh, alt - recvH), half);
        if (p > pot[c]!) pot[c] = p;
      });
    }
  }
  for (let c = 0; c < GRID_CELLS; c++) {
    out[c] = !scope[c] ? GRID_UNKNOWN : pot[c]! > 0 ? quantizePotential(pot[c]!) : unk[c] ? GRID_UNKNOWN : 0;
  }
  return out;
}
