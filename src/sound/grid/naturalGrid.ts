/**
 * 自然三族網格（W6-3：風吹樹葉、海浪、河川）：測站場類，「每格空間項一次＋每站時間項每幀」。
 *
 * 和接收點查詢同一套規則（網格值＝queryFamilyInterval(格心, 區間) 的 familyResultCode）：
 * - 空間項直接呼叫 adapter 的 windSpatialAt／waveSpatialAt／riverSpatialAt（樹冠或海岸、河道距離、站點範圍、
 *   最近有回報的站）。「已定案」的格（沒樹冠、離岸或離河太遠＝0；沒資料＝255）不再隨時間變。
 * - 時間項呼叫 windStationScan／waveStationScan／riverStationScan，每站每幀只算一次（係數 1）；
 *   每格潛勢＝該站最大列的值 × 該格係數（與 adapter 的 `wp × 係數` 同運算順序；係數 > 0 時取最大的列相同）。
 * - coverage gate 用 gateFamilyRecords（不在涵蓋窗或沒有健康來源 → 整幀 255）。
 */
import { gateFamilyRecords } from "../engines/receiverQuery";
import { windSpatialAt, windSpatialContext, windStationScan, type WindObs, type WindVegetationRecord } from "../sourceAdapters/windVegetationAdapter";
import { waveSpatialAt, waveSpatialContext, waveStationScan, type CoastalWaveRecord, type WaveObs } from "../sourceAdapters/coastalWaveAdapter";
import { riverSpatialAt, riverSpatialContext, riverStationScan, type RiverObs, type RiverWaterRecord } from "../sourceAdapters/riverWaterAdapter";
import type { QuantileTable } from "../engines/naturalKernels";
import type { HourlyScan } from "../sourceAdapters/naturalShared";
import type { SoundSourceSet } from "../types";
import { cellCenter, GRID_CELLS, GRID_UNKNOWN, inScopeCells } from "./gridSpec";
import { quantizePotential } from "./potentialCode";

export type NaturalFamily = "wind_vegetation" | "coastal_wave" | "river_water";

/** 空間場：fixed[c]＝已定案碼（0／255），-1＝要看站；station[c]、factor[c] */
export interface NaturalField {
  family: NaturalFamily;
  set: SoundSourceSet;
  fixed: Int16Array;
  station: Int32Array;
  factor: Float64Array;
  /** 每站：逐小時列（record 順序）與時間項掃描函式 */
  scanStation: ((t0: number, t1: number) => HourlyScan<unknown>)[];
  stationIds: string[];
  buildMs: number;
}

const OUT_OF_SCOPE = GRID_UNKNOWN;

export function buildNaturalField(family: NaturalFamily, set: SoundSourceSet, cells: Uint32Array = inScopeCells()): NaturalField {
  const t0 = performance.now();
  const fixed = new Int16Array(GRID_CELLS).fill(OUT_OF_SCOPE);
  const station = new Int32Array(GRID_CELLS).fill(-1);
  const factor = new Float64Array(GRID_CELLS);
  const stationIds: string[] = [];
  const idxOf = new Map<string, number>();
  const scanStation: NaturalField["scanStation"] = [];
  const t = 0; // 空間項不依時間（t 只用在 unknown 貢獻的 sourceTime）
  const register = (id: string, makeScan: () => NaturalField["scanStation"][number]) => {
    let k = idxOf.get(id);
    if (k == null) {
      k = stationIds.length;
      idxOf.set(id, k);
      stationIds.push(id);
      scanStation.push(makeScan());
    }
    return k;
  };
  const doneCode = (out: { contributions: { status: string }[] }) => (out.contributions.length === 0 ? 0 : out.contributions.some((c) => c.status === "unknown") ? GRID_UNKNOWN : 0);

  if (family === "wind_vegetation") {
    const recs = set.records as WindVegetationRecord[];
    const ctx = windSpatialContext(recs);
    const obsOf = (id: string) => recs.flatMap((r) => (r.payload.kind === "wind_obs" && r.payload.stationId === id ? [r.payload] : [])) as WindObs[];
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k]!;
      const [lon, lat] = cellCenter(c);
      const sp = windSpatialAt(ctx, lon, lat, t);
      if (sp.kind === "done") { fixed[c] = doneCode(sp.out); continue; }
      const id = sp.station.stationId;
      station[c] = register(id, () => { const obs = obsOf(id); return (a, b) => windStationScan(obs, 1, a, b); });
      factor[c] = sp.vf;
      fixed[c] = -1;
    }
  } else if (family === "coastal_wave") {
    const recs = set.records as CoastalWaveRecord[];
    const ctx = waveSpatialContext(recs);
    const obsOf = (id: string) => recs.flatMap((r) => (r.payload.kind === "wave_obs" && r.payload.stationId === id ? [r.payload] : [])) as WaveObs[];
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k]!;
      const [lon, lat] = cellCenter(c);
      const sp = waveSpatialAt(ctx, lon, lat, t);
      if (sp.kind === "done") { fixed[c] = doneCode(sp.out); continue; }
      const id = sp.station.stationId;
      station[c] = register(id, () => { const obs = obsOf(id); return (a, b) => waveStationScan(obs, 1, a, b); });
      factor[c] = sp.distFactor;
      fixed[c] = -1;
    }
  } else {
    const recs = set.records as RiverWaterRecord[];
    const ctx = riverSpatialContext(recs);
    const obsOf = (id: string) => recs.flatMap((r) => (r.payload.kind === "river_obs" && r.payload.stationId === id ? [r.payload] : [])) as RiverObs[];
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k]!;
      const [lon, lat] = cellCenter(c);
      const sp = riverSpatialAt(ctx, lon, lat, t);
      if (sp.kind === "done") { fixed[c] = doneCode(sp.out); continue; }
      const id = sp.station.stationId;
      const q: QuantileTable = sp.quantiles;
      station[c] = register(id, () => { const obs = obsOf(id); return (a, b) => riverStationScan(obs, q, 1, a, b); });
      factor[c] = sp.distFactor;
      fixed[c] = -1;
    }
  }
  return { family, set, fixed, station, factor, scanStation, stationIds, buildMs: performance.now() - t0 };
}

export interface NaturalGridFrame {
  values: Uint8Array;
  gateReason: string | null;
}

/** 一幀 [t0, t1]：set／field 為 null 或 gate 不通過 → 整幀 255 */
export function naturalGridFrame(
  field: NaturalField | null,
  t0: number,
  t1: number,
  out: Uint8Array = new Uint8Array(GRID_CELLS),
): NaturalGridFrame {
  out.fill(GRID_UNKNOWN);
  if (!field) return { values: out, gateReason: "source_not_loaded" };
  const gate = gateFamilyRecords(field.family, [field.set], t0, t1);
  if (gate.kind !== "ok") return { values: out, gateReason: gate.reason };
  // 每站一次：最大列的值（係數 1）／是否有缺
  const best = new Float64Array(field.stationIds.length).fill(-1);
  const unk = new Uint8Array(field.stationIds.length);
  field.scanStation.forEach((scan, i) => {
    const r = scan(t0, t1);
    if (r.best) best[i] = r.best.potential;
    else if (r.firstUnknown) unk[i] = 1;
  });
  const { fixed, station, factor } = field;
  for (let c = 0; c < GRID_CELLS; c++) {
    const f = fixed[c]!;
    if (f >= 0) { out[c] = f; continue; }
    const s = station[c]!;
    out[c] = best[s]! >= 0 ? quantizePotential(best[s]! * factor[c]!) : unk[s] ? GRID_UNKNOWN : 0;
  }
  return { values: out, gateReason: null };
}
