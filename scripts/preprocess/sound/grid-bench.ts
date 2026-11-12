/**
 * City Sound Atlas W6-0：前端算格耗時量測（單執行緒、不開瀏覽器）。
 *
 * 用法（worktree 根目錄）：
 *   npx vite-node scripts/preprocess/sound/grid-bench.ts [--scene taipei-1109] [--sample 300] [--json OUT] [--day-pack]
 *
 * 量什麼：
 *   B1 直算：對抽樣格心逐格呼叫 queryReceiver（全族）與 queryFamilyInterval（逐族、瞬時與 10 分區間），外推到全範圍 38,067 格。
 *   B2 分類算法（不另寫 kernel；空間項與時間項都呼叫既有 adapter 的匯出函式）：
 *      - 測站場 × 時間序列：rain、wind_vegetation、coastal_wave → 預算每格「最近站＋空間係數」，每幀只查站值。
 *      - 移動點：aviation、rail → 每幀先算每個來源的位置，只對半徑內的格呼叫距離 kernel。
 *   B3 抽樣驗證：分類算法 vs queryReceiver(格心, t)（狀態要相同、數值容差 1e-9）。
 * 讀 public/sound-atlas/scenes/<id>.json 與 public/rail（不是 vitest；CI 沒有這些檔）。
 * 場景快照只裁了接收點 ±30 km 的資料：bbox 外的格多半是 unknown／unavailable，耗時估計會偏低，報告要註明。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { flightRowsToFlights, type FlightTrailRow } from "../../../src/data/flightTrails";
import type { LightningSource, LightningStrike } from "../../../src/data/lightningLoader";
import type { RainGaugeDayRow } from "../../../src/data/rainGaugeLoader";
import { taipeiMidnightMs } from "../../../src/lib/taipeiDay";
import { COMMON, AVIATION, RAIL, RAIN, WIND_VEGETATION, COASTAL_WAVE, RIVER_WATER, TYPICAL_TRAFFIC } from "../../../src/sound/model/soundProfiles";
import { queryFamilyInterval, queryReceiver, SOUND_FAMILIES_ADVANCED } from "../../../src/sound/engines/receiverQuery";
import { haversineM, slantDistanceM } from "../../../src/sound/engines/geometryDistance";
import { proximityPotential } from "../../../src/sound/engines/relativePotentialKernel";
import { rainPotential } from "../../../src/sound/engines/relativePotentialKernel";
import { percentileRank, vegetationFactor, wavePotential, windPotential, type QuantileTable } from "../../../src/sound/engines/naturalKernels";
import { distanceToGeometryM } from "../../../src/sound/engines/geometryShapes";
import { aviationPositionAt, flightsToAviationRecords, type AviationRecord } from "../../../src/sound/sourceAdapters/aviationAdapter";
import { dedupeAndLinkStrikes } from "../../../src/sound/sourceAdapters/thunderAdapter";
import { nearestRainStation, rainRowsToRecords, type RainRecord } from "../../../src/sound/sourceAdapters/rainFieldAdapter";
import { loadRail, nearestOnTrack, railProgressAt, RAIL_SYSTEMS, type RailFetchers, type RailRecord, type RailTrackInput } from "../../../src/sound/sourceAdapters/railAdapter";
import { structureAtProgress } from "../../../src/sound/model/railSegments";
import { canopyCover } from "../../../src/sound/sourceAdapters/windVegetationAdapter";
import { insideBbox, nearestStation } from "../../../src/sound/sourceAdapters/naturalShared";
import { isTypicalTrafficRecord, loadTypicalTraffic, typicalFlowAt, typicalVolumePotential, vdWithinRadius, type TypicalTrafficRecord } from "../../../src/sound/sourceAdapters/typicalTrafficAdapter";
import { queryRoadTrafficInterval, type RoadTrafficRecord } from "../../../src/sound/sourceAdapters/roadTrafficAdapter";
import { parseMvpBSceneBlocks, parseSystemSchedule, parseTraSchedule, roadworkSnapshotSet } from "../../../src/sound/mvpBSources";
import { naturalSnapshotSet, parseNaturalBlock } from "../../../src/sound/advancedSources";
import { GRID_SPEC, cellCenter, inScopeCells } from "../../../src/sound/grid/gridSpec";
import type { AnySoundFamily, FamilyStatus, Receiver, SoundSourceSet, SourceCoverage, SourceHealth } from "../../../src/sound/types";

type AnySet = SoundSourceSet<unknown, AnySoundFamily>;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const SCENE_ID = arg("--scene", "taipei-1109")!;
const SAMPLE = Number(arg("--sample", "300"));
const OUT = arg("--json");

// ── 場景 → sets（規則同 scripts/preprocess/verify-sound-scenes.ts；該檔頂層會執行 main，不能 import） ──
interface Scene {
  id: string;
  date: string;
  focus_time: string;
  bbox: [number, number, number, number];
  aviation: { health?: SourceHealth; rows: FlightTrailRow[] };
  thunder: { health: Record<string, "ok" | "empty" | "error">; events: (LightningStrike & { source: LightningSource })[] };
  rain: { health?: SourceHealth; rows: RainGaugeDayRow[] };
}
function cov(family: AnySoundFamily, provider: string, date: string, status: SourceHealth): SourceCoverage<AnySoundFamily> {
  const start = taipeiMidnightMs(date) / 1000;
  return { family, provider, dateKey: date, status, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" };
}
function readJson(p: string): unknown {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
function localRailFetchers(railDir: string): RailFetchers {
  const lineOf = (p: string): [number, number][] | null => {
    const d = readJson(p) as { type?: string; features?: GeoJSON.Feature[] } | GeoJSON.Feature | null;
    const f = d && (d as { type?: string }).type === "FeatureCollection" ? (d as { features: GeoJSON.Feature[] }).features[0] : (d as GeoJSON.Feature | null);
    return f?.geometry?.type === "LineString" ? (f.geometry.coordinates as [number, number][]) : null;
  };
  return {
    async network() {
      const out: RailTrackInput[] = [];
      for (const sys of RAIL_SYSTEMS) {
        const progress = (readJson(path.join(railDir, sys, "station_progress.json")) ?? {}) as Record<string, Record<string, number>>;
        for (const [trackId, sp] of Object.entries(progress)) {
          if (sys === "trtc" && trackId.startsWith("MK-")) continue;
          const coords = lineOf(path.join(railDir, sys, "tracks", `${trackId}.geojson`));
          if (coords && coords.length >= 2) out.push({ system: sys, trackId, coords, stationProgress: sp });
        }
      }
      return out;
    },
    async schedule(system) {
      if (system === "tra") return { departures: parseTraSchedule(readJson(path.join(railDir, "tra", "master_schedule.json")) as { schedules?: unknown[] } | null), basis: "local_template" };
      if (system === "trtc") {
        const progress = (readJson(path.join(railDir, "trtc", "station_progress.json")) ?? {}) as Record<string, unknown>;
        const arr = Object.keys(progress).filter((k) => !k.startsWith("MK-")).map((k) => readJson(path.join(railDir, "trtc", "schedules", `${k}.json`))).filter(Boolean);
        return { departures: parseSystemSchedule(arr), basis: "local_template" };
      }
      const file = system === "thsr" ? path.join(railDir, "thsr", "schedules", "thsr_schedules.json") : path.join(railDir, system, `${system}_schedules.json`);
      return { departures: parseSystemSchedule(readJson(file)), basis: "local_template" };
    },
  };
}
async function sceneSets(s: Scene): Promise<AnySet[]> {
  const avHealth = s.aviation.health ?? (s.aviation.rows.length ? "ok" : "empty");
  const rainHealth = s.rain.health ?? (s.rain.rows.length ? "ok" : "empty");
  const sources = Object.keys(s.thunder.health) as LightningSource[];
  const bySource = sources.filter((src) => s.thunder.health[src] !== "error").map((src) => ({ source: src, strikes: s.thunder.events.filter((e) => e.source === src) }));
  const sets: AnySet[] = [
    { family: "aviation", dateKey: s.date, records: flightsToAviationRecords(flightRowsToFlights(s.aviation.rows).flights), coverage: [cov("aviation", "flight_trails", s.date, avHealth)] },
    { family: "rain", dateKey: s.date, records: rainRowsToRecords(s.rain.rows), coverage: [cov("rain", "cwa_rain_gauge", s.date, rainHealth)] },
    { family: "thunder", dateKey: s.date, records: dedupeAndLinkStrikes(bySource), coverage: sources.map((src) => cov("thunder", src, s.date, s.thunder.health[src]!)) },
  ] as AnySet[];
  const rw = parseMvpBSceneBlocks(s).roadwork;
  if (rw) sets.push(roadworkSnapshotSet(rw, s.date) as AnySet);
  const railDir = path.join(ROOT, "public/rail");
  if (existsSync(railDir)) sets.push((await loadRail({ date: s.date }, localRailFetchers(railDir))) as AnySet);
  const nat = parseNaturalBlock(s);
  if (nat) for (const f of SOUND_FAMILIES_ADVANCED) {
    const set = naturalSnapshotSet(nat, f, s.date);
    if (set) sets.push(set as AnySet);
  }
  // 道路：國道路段只能即時 RPC（node 讀不到）→ 只載 VD 平日典型值（本機小檔）
  const vdPath = path.join(ROOT, "public/sound-atlas/vd-baseline-taipei.json");
  if (existsSync(vdPath)) sets.push((await loadTypicalTraffic({ date: s.date }, async () => readJson(vdPath) as never)) as AnySet);
  return sets;
}

// ── 工具 ───────────────────────────────────────────────
const recv = (i: number): Receiver => {
  const [lon, lat] = cellCenter(i);
  return { id: `cell:${i}`, longitude: lon, latitude: lat, environment: "outdoor" };
};
function timeIt<T>(fn: () => T, reps = 5): { minMs: number; medMs: number; value: T } {
  fn(); // warm-up
  const ts: number[] = [];
  let value!: T;
  for (let k = 0; k < reps; k++) {
    const a = performance.now();
    value = fn();
    ts.push(performance.now() - a);
  }
  ts.sort((x, y) => x - y);
  return { minMs: ts[0]!, medMs: ts[Math.floor(ts.length / 2)]!, value };
}
function seededSample(arr: Uint32Array, n: number, seed = 42): number[] {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const copy = Array.from(arr);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}
/** coverage gate（同 queryFamilyInterval 的前段，只依時間） */
function familyGate(sets: readonly AnySet[], family: AnySoundFamily, t: number): "unavailable" | "unknown" | "ok" {
  const covs = sets.filter((s) => s.family === family).flatMap((s) => s.coverage);
  const over = covs.filter((c) => c.windowStart <= t && t < c.windowEnd);
  if (!over.length) return "unavailable";
  return over.some((c) => c.status === "ok") ? "ok" : "unknown";
}

// 網格結果：status 0 inactive／1 active／2 unknown／3 unavailable；value 只在 active 有意義
const ST = { inactive: 0, active: 1, unknown: 2, unavailable: 3 } as const;
interface FamilyGrid { status: Uint8Array; value: Float64Array }
const newGrid = (n: number): FamilyGrid => ({ status: new Uint8Array(n), value: new Float64Array(n) });
const M_PER_DEG = 111_195;

// ── B2 分類算法 ──────────────────────────────────────────
/** 測站場（雨）：預算每格最近站與距離 */
function prepRain(records: RainRecord[], cells: Uint32Array) {
  const firstPerStation: RainRecord[] = [];
  const seen = new Set<string>();
  for (const r of records) if (!seen.has(r.payload.stationId)) { seen.add(r.payload.stationId); firstPerStation.push(r); }
  const stationIds = firstPerStation.map((r) => r.payload.stationId);
  const sIdx = new Map(stationIds.map((id, i) => [id, i]));
  const nearest = new Int32Array(cells.length).fill(-1);
  const maxD = RAIN.maxStationDistanceM.value;
  cells.forEach((c, k) => {
    const [lon, lat] = cellCenter(c);
    const n = nearestRainStation(firstPerStation, lon, lat);
    nearest[k] = n && n.distanceM <= maxD ? sIdx.get(n.stationId)! : -1;
  });
  const rowsByStationHour = new Map<string, RainRecord>();
  for (const r of records) {
    const key = `${r.payload.stationId}|${r.payload.bucketStart}`;
    if (!rowsByStationHour.has(key)) rowsByStationHour.set(key, r);
  }
  return { stationIds, nearest, rowsByStationHour };
}
function frameRain(prep: ReturnType<typeof prepRain>, t: number, out: FamilyGrid) {
  const bucket = RAIN.bucketDurationS.value;
  const h = Math.floor(t / bucket) * bucket;
  const st = new Uint8Array(prep.stationIds.length);
  const val = new Float64Array(prep.stationIds.length);
  prep.stationIds.forEach((id, i) => {
    const row = prep.rowsByStationHour.get(`${id}|${h}`);
    const pot = row ? rainPotential(row.payload.precipitation1hMm) : null;
    if (pot == null) st[i] = ST.unknown;
    else if (pot <= 0) st[i] = ST.inactive;
    else { st[i] = ST.active; val[i] = pot; }
  });
  for (let k = 0; k < prep.nearest.length; k++) {
    const s = prep.nearest[k]!;
    if (s < 0) { out.status[k] = ST.unknown; continue; }
    out.status[k] = st[s]!;
    out.value[k] = val[s]!;
  }
}

/** 測站場 × 空間係數（風×樹冠、浪×離岸距離）：預算每格係數與最近站 */
type NatKind = "wind_vegetation" | "coastal_wave";
function prepNatural(set: AnySet | undefined, kind: NatKind, cells: Uint32Array) {
  const n = cells.length;
  const staticStatus = new Uint8Array(n).fill(255); // 255 = 交給時間項；其他 = 固定狀態
  const factor = new Float64Array(n);
  const nearest = new Int32Array(n).fill(-1);
  const records = (set?.records ?? []) as { payload: { kind: string } & Record<string, unknown> }[];
  const extents = records.flatMap((r) => (r.payload.kind === "station_extent" ? [r.payload.bbox as [number, number, number, number]] : []));
  const obsKind = kind === "wind_vegetation" ? "wind_obs" : "wave_obs";
  const obs = records.flatMap((r) => (r.payload.kind === obsKind ? [r.payload as unknown as { stationId: string; lon: number; lat: number; stationName: string | null; obsTime: number; windSpeedMs?: number | null; waveHeightM?: number | null; wavePeriodS?: number | null }] : []));
  const reporting = new Set(obs.filter((o) => (kind === "wind_vegetation" ? o.windSpeedMs != null : o.waveHeightM != null && o.wavePeriodS != null)).map((o) => o.stationId));
  const stationObs = obs.filter((o) => reporting.has(o.stationId));
  const stations: string[] = [];
  const sIdx = new Map<string, number>();
  const maxD = kind === "wind_vegetation" ? WIND_VEGETATION.maxStationDistanceM.value : COASTAL_WAVE.maxStationDistanceM.value;
  const grids = records.flatMap((r) => (r.payload.kind === "canopy_grid" ? [r.payload.grid as Parameters<typeof canopyCover>[0]] : []));
  const coasts = records.flatMap((r) => (r.payload.kind === "coast" ? [r.payload as unknown as { bbox: [number, number, number, number]; geometry: GeoJSON.Geometry }] : []));
  cells.forEach((c, k) => {
    const [lon, lat] = cellCenter(c);
    if (kind === "wind_vegetation") {
      let cr: ReturnType<typeof canopyCover> = null;
      for (const g of grids) { cr = canopyCover(g, lon, lat); if (cr) break; }
      if (cr == null || cr === "masked") { staticStatus[k] = ST.unknown; return; }
      const vf = vegetationFactor(cr.cover)!;
      if (vf <= 0) { staticStatus[k] = ST.inactive; return; }
      factor[k] = vf;
    } else {
      const maxCoast = COASTAL_WAVE.coastMaxDistanceM.value;
      const near = coasts.filter((cst) => insideBbox(lon, lat, cst.bbox, maxCoast));
      if (!near.length) { staticStatus[k] = ST.unknown; return; }
      const ds = near.map((cst) => distanceToGeometryM(cst.geometry, lon, lat)).filter((d): d is number => d != null);
      if (!ds.length) { staticStatus[k] = ST.unknown; return; }
      const coastD = Math.min(...ds);
      if (coastD > maxCoast) { staticStatus[k] = ST.inactive; return; }
      factor[k] = proximityPotential(coastD, COASTAL_WAVE.halfPotentialDistanceM.value);
    }
    if (!extents.some((b) => insideBbox(lon, lat, b))) { staticStatus[k] = ST.unknown; return; }
    const ns = nearestStation(stationObs as never[], lon, lat) as { station: { stationId: string }; distanceM: number } | null;
    if (!ns || ns.distanceM > maxD) { staticStatus[k] = ST.unknown; return; }
    let i = sIdx.get(ns.station.stationId);
    if (i == null) { i = stations.length; stations.push(ns.station.stationId); sIdx.set(ns.station.stationId, i); }
    nearest[k] = i;
  });
  const byStationHour = new Map<string, (typeof obs)[number]>();
  for (const o of obs) if (!byStationHour.has(`${o.stationId}|${o.obsTime}`)) byStationHour.set(`${o.stationId}|${o.obsTime}`, o);
  return { kind, staticStatus, factor, nearest, stations, byStationHour };
}
function frameNatural(p: ReturnType<typeof prepNatural>, t: number, out: FamilyGrid) {
  const bucket = p.kind === "wind_vegetation" ? WIND_VEGETATION.bucketDurationS.value : COASTAL_WAVE.bucketDurationS.value;
  const h = Math.floor(t / bucket) * bucket;
  const base = p.stations.map((id) => {
    const o = p.byStationHour.get(`${id}|${h}`);
    if (!o) return null;
    return p.kind === "wind_vegetation" ? windPotential(o.windSpeedMs) : wavePotential(o.waveHeightM, o.wavePeriodS);
  });
  for (let k = 0; k < p.nearest.length; k++) {
    if (p.staticStatus[k] !== 255) { out.status[k] = p.staticStatus[k]!; continue; }
    const b = base[p.nearest[k]!];
    if (b == null) { out.status[k] = ST.unknown; continue; }
    const v = b * p.factor[k]!;
    if (v > 0) { out.status[k] = ST.active; out.value[k] = v; } else out.status[k] = ST.inactive;
  }
}

/** 河川：河道距離係數（靜態）× 最近水位站（≤5 km）× 該小時水位在自身歷史的分位 */
function prepRiver(set: AnySet | undefined, cells: Uint32Array) {
  const n = cells.length;
  const staticStatus = new Uint8Array(n).fill(255);
  const factor = new Float64Array(n);
  const nearest = new Int32Array(n).fill(-1);
  const records = (set?.records ?? []) as { payload: { kind: string } & Record<string, unknown> }[];
  const maxCh = RIVER_WATER.channelMaxDistanceM.value;
  const nets = records.flatMap((r) => (r.payload.kind === "river_network" ? [r.payload as unknown as { bbox: [number, number, number, number]; geometry: GeoJSON.Geometry }] : []));
  const extents = records.flatMap((r) => (r.payload.kind === "station_extent" ? [r.payload.bbox as [number, number, number, number]] : []));
  const reporting = new Set(records.flatMap((r) => (r.payload.kind === "river_obs" && r.payload.levelM != null ? [r.payload.stationId as string] : [])));
  const stations = records.flatMap((r) => (r.payload.kind === "river_station" && reporting.has(r.payload.stationId as string) ? [r.payload as unknown as { stationId: string; stationName: string | null; lon: number; lat: number; quantiles: QuantileTable | null }] : []));
  // 同 riverWaterAdapter.quantilesUsable（未匯出）
  const usable = (q: QuantileTable | null | undefined): q is QuantileTable => !!q && q.n >= RIVER_WATER.minHistorySamples.value && q.probs.length >= 2 && q.probs.length === q.values.length;
  const sts: { stationId: string; q: QuantileTable }[] = [];
  const sIdx = new Map<string, number>();
  cells.forEach((c, k) => {
    const [lon, lat] = cellCenter(c);
    const near = nets.filter((nt) => insideBbox(lon, lat, nt.bbox, maxCh));
    if (!near.length) { staticStatus[k] = ST.unknown; return; }
    const ds = near.map((nt) => distanceToGeometryM(nt.geometry, lon, lat)).filter((d): d is number => d != null);
    if (!ds.length) { staticStatus[k] = ST.unknown; return; }
    const chD = Math.min(...ds);
    if (chD > maxCh) { staticStatus[k] = ST.inactive; return; }
    factor[k] = proximityPotential(chD, RIVER_WATER.halfPotentialDistanceM.value);
    if (!extents.some((b) => insideBbox(lon, lat, b))) { staticStatus[k] = ST.unknown; return; }
    const ns = nearestStation(stations, lon, lat);
    if (!ns || ns.distanceM > RIVER_WATER.maxStationDistanceM.value) { staticStatus[k] = ST.unknown; return; }
    if (!usable(ns.station.quantiles)) { staticStatus[k] = ST.unknown; return; }
    let i = sIdx.get(ns.station.stationId);
    if (i == null) { i = sts.length; sts.push({ stationId: ns.station.stationId, q: ns.station.quantiles }); sIdx.set(ns.station.stationId, i); }
    nearest[k] = i;
  });
  const obs = new Map<string, { levelM: number | null }>();
  for (const r of records) if (r.payload.kind === "river_obs") {
    const key = `${r.payload.stationId}|${r.payload.bucketStart}`;
    if (!obs.has(key)) obs.set(key, r.payload as unknown as { levelM: number | null });
  }
  return { staticStatus, factor, nearest, sts, obs };
}
function frameRiver(p: ReturnType<typeof prepRiver>, t: number, out: FamilyGrid) {
  const bucket = RIVER_WATER.bucketDurationS.value;
  const h = Math.floor(t / bucket) * bucket;
  const base = p.sts.map((s) => {
    const o = p.obs.get(`${s.stationId}|${h}`);
    return o ? percentileRank(o.levelM, s.q) : null;
  });
  for (let k = 0; k < p.nearest.length; k++) {
    if (p.staticStatus[k] !== 255) { out.status[k] = p.staticStatus[k]!; continue; }
    const b = base[p.nearest[k]!];
    if (b == null) { out.status[k] = ST.unknown; continue; }
    const v = b * p.factor[k]!;
    if (v > 0) { out.status[k] = ST.active; out.value[k] = v; } else out.status[k] = ST.inactive;
  }
}

/**
 * 道路（臺北 VD 平日典型）：不是「最近站」，是每格 300 m 內**所有** VD 的 (VD, 距離) 稀疏清單，
 * 每幀取 max(proximity(d) × typicalVolumePotential(該小時流量))。300 m 內沒有 VD 的格走國道 proxy 分支；
 * node 讀不到國道路段（records 0 筆），該分支與時間無關，預算一次（呼叫 adapter 本身）。
 */
function prepTypical(set: AnySet | undefined, cells: Uint32Array, tRef: number) {
  const recs = (set?.records ?? []) as (TypicalTrafficRecord | RoadTrafficRecord)[];
  const vd = recs.filter((r) => isTypicalTrafficRecord(r as never)) as TypicalTrafficRecord[];
  const fw = recs.filter((r) => !isTypicalTrafficRecord(r as never)) as RoadTrafficRecord[];
  if (fw.length) throw new Error("國道路段已載入：fallback 分支會隨時間變，這個 spike 沒實作");
  const offsets = new Uint32Array(cells.length + 1);
  const list: { rec: number; d: number }[] = [];
  const fallback = new Uint8Array(cells.length);
  cells.forEach((c, k) => {
    const rcv = recv(c);
    vd.forEach((r, i) => {
      const d = vdWithinRadius(r, rcv);
      if (d != null) list.push({ rec: i, d });
    });
    offsets[k + 1] = list.length;
    if (offsets[k + 1] === offsets[k]) {
      const res = queryRoadTrafficInterval([], rcv, tRef, tRef);
      fallback[k] = res.contributions.some((x) => x.status === "unknown") ? ST.unknown : ST.inactive;
    }
  });
  return { vd, offsets, recIdx: Int32Array.from(list.map((x) => x.rec)), dist: Float64Array.from(list.map((x) => x.d)), fallback };
}
function frameTypical(p: ReturnType<typeof prepTypical>, t: number, out: FamilyGrid) {
  // 每支 VD 該幀的狀態：0 不在有效窗、1 有流量、2 缺值（unknown）、3 not_applicable、4 流量 0
  const st = new Uint8Array(p.vd.length);
  const pot = new Float64Array(p.vd.length);
  p.vd.forEach((r, i) => {
    if (r.validUntil < t || r.validFrom > t) return;
    const pl = r.payload;
    if (pl.kind === "vd_not_applicable") { st[i] = 3; return; }
    const v = typicalFlowAt(pl, t);
    if ("missing" in v) { st[i] = 2; return; }
    if (v.vehPerHour <= 0) { st[i] = 4; return; }
    st[i] = 1;
    pot[i] = typicalVolumePotential(v.vehPerHour);
  });
  const half = TYPICAL_TRAFFIC.halfPotentialDistanceM.value;
  for (let k = 0; k + 1 < p.offsets.length; k++) {
    const a = p.offsets[k]!, b = p.offsets[k + 1]!;
    if (a === b) { out.status[k] = p.fallback[k]!; continue; }
    let best = 0, act = false, unk = false, na = false;
    for (let j = a; j < b; j++) {
      const i = p.recIdx[j]!;
      if (st[i] === 1) { const v = proximityPotential(p.dist[j]!, half) * pot[i]!; if (v > 0) { act = true; if (v > best) best = v; } }
      else if (st[i] === 2) unk = true;
      else if (st[i] === 3) na = true;
    }
    // adapter：active 以外，有 unknown 貢獻（缺值）→ unknown；只有 not_applicable 且無任何貢獻 → unknown
    if (act) { out.status[k] = ST.active; out.value[k] = best; }
    else out.status[k] = unk || na ? ST.unknown : ST.inactive;
  }
}

/** 格心經緯 → 子集索引（只對抽樣／範圍內的格）；移動點用：找某點半徑內的格 */
function cellLocator(cells: Uint32Array) {
  const pos = new Int32Array(GRID_SPEC.cols * GRID_SPEC.rows).fill(-1);
  cells.forEach((c, k) => (pos[c] = k));
  return (lon: number, lat: number, radiusM: number, visit: (k: number, cell: number) => void) => {
    const dLat = radiusM / M_PER_DEG;
    const dLon = radiusM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
    const c0 = Math.max(0, Math.floor((lon - dLon - GRID_SPEC.west) / GRID_SPEC.dLon) - 1);
    const c1 = Math.min(GRID_SPEC.cols - 1, Math.floor((lon + dLon - GRID_SPEC.west) / GRID_SPEC.dLon) + 1);
    const r0 = Math.max(0, Math.floor((GRID_SPEC.north - lat - dLat) / GRID_SPEC.dLat) - 1);
    const r1 = Math.min(GRID_SPEC.rows - 1, Math.floor((GRID_SPEC.north - lat + dLat) / GRID_SPEC.dLat) + 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cell = r * GRID_SPEC.cols + c;
      const k = pos[cell]!;
      if (k >= 0) visit(k, cell);
    }
  };
}
type Locator = ReturnType<typeof cellLocator>;
const UNK = -1; // value 暫存：unknown 候選

/** 移動點（飛機）：每幀算位置，只對 20 km 內的格算斜距 */
function frameAviation(records: AviationRecord[], t: number, locate: Locator, cellCount: number, out: FamilyGrid) {
  const best = new Float64Array(cellCount).fill(0);
  const unk = new Uint8Array(cellCount);
  let anyActive = new Uint8Array(cellCount);
  const radius = AVIATION.candidateRadiusM.value;
  const recvH = COMMON.receiverDefaultHeightM.value;
  for (const r of records) {
    if (r.validUntil < t || r.validFrom > t) continue;
    const pos = aviationPositionAt(r.payload, t);
    if (pos.status === "inactive") continue;
    if (pos.status === "unknown") {
      // 同 aviationAdapter.gapTouchesRadius：缺口前後端點任一在半徑內 → unknown 候選
      let before: [number, number, number, number] | null = null;
      let after: [number, number, number, number] | null = null;
      for (const seg of r.payload.segments) for (const pt of seg) {
        if (pt[3] <= t) before = pt as never;
        else if (!after) after = pt as never;
      }
      for (const pt of [before, after]) if (pt) locate(pt[1], pt[0], radius, (k, cell) => {
        const [lon, lat] = cellCenter(cell);
        if (haversineM(lon, lat, pt[1], pt[0]) <= radius) unk[k] = 1;
      });
      continue;
    }
    locate(pos.lon, pos.lat, radius, (k, cell) => {
      const [lon, lat] = cellCenter(cell);
      const dh = haversineM(lon, lat, pos.lon, pos.lat);
      if (dh > radius) return;
      if (pos.altitudeM == null) { unk[k] = 1; return; }
      const pot = proximityPotential(slantDistanceM(dh, pos.altitudeM - recvH), AVIATION.halfPotentialDistanceM.value);
      if (pot > 0) { anyActive[k] = 1; if (pot > best[k]!) best[k] = pot; }
    });
  }
  for (let k = 0; k < cellCount; k++) {
    if (anyActive[k]) { out.status[k] = ST.active; out.value[k] = best[k]!; }
    else out.status[k] = unk[k] ? ST.unknown : ST.inactive;
  }
  anyActive = new Uint8Array(0);
}

/** 移動點（列車）：每幀算 progress，只對 1.5 km 內的格呼叫 nearestOnTrack(p, p)；缺班表／位置未知 → 軌道 1.5 km 內 unknown（靜態遮罩） */
function prepRailUnknownMasks(records: RailRecord[], cells: Uint32Array, locate: Locator) {
  // 每條軌道一次：nearestOnTrack(0,1) ≤ radius 的格，及其最近點是否地下
  const radius = RAIL.candidateRadiusM.value;
  const masks = new Map<string, { k: Int32Array; underground: Uint8Array }>();
  for (const r of records) {
    const tr = r.payload.track;
    const key = `${tr.system}|${tr.trackId}`;
    if (masks.has(key)) continue;
    const ks: number[] = [];
    const ug: number[] = [];
    const seen = new Set<number>();
    // 沿軌道取點，對附近格算一次真正的 nearestOnTrack
    for (const [lon, lat] of tr.coords) locate(lon, lat, radius, (k, cell) => {
      if (seen.has(k)) return;
      seen.add(k);
      const [clon, clat] = cellCenter(cell);
      const near = nearestOnTrack(tr, { id: "", longitude: clon, latitude: clat, environment: "outdoor" }, 0, 1);
      if (near.distanceM > radius) return;
      ks.push(k);
      ug.push(structureAtProgress(tr.intervals, near.progress) === "underground" ? 1 : 0);
    });
    masks.set(key, { k: Int32Array.from(ks), underground: Uint8Array.from(ug) });
  }
  void cells;
  return masks;
}
function frameRail(records: RailRecord[], t: number, locate: Locator, masks: ReturnType<typeof prepRailUnknownMasks>, cellCount: number, out: FamilyGrid) {
  const best = new Float64Array(cellCount);
  const act = new Uint8Array(cellCount);
  const unk = new Uint8Array(cellCount);
  const radius = RAIL.candidateRadiusM.value;
  for (const r of records) {
    if (r.validUntil < t || r.validFrom > t) continue;
    const tr = r.payload.track;
    const mask = masks.get(`${tr.system}|${tr.trackId}`)!;
    if (r.payload.kind === "schedule_unavailable") {
      mask.k.forEach((k, i) => { if (!mask.underground[i]) unk[k] = 1; });
      continue;
    }
    const st = railProgressAt(r, t);
    if (st.status === "unknown") { mask.k.forEach((k) => (unk[k] = 1)); continue; }
    if (st.status !== "on_track") continue;
    const structure = structureAtProgress(tr.intervals, st.progress);
    // 距離一律呼叫 nearestOnTrack(p, p)（與 adapter 同一套局部投影）；pointAt 只用來找候選格
    const [plon, plat] = pointAt(tr, st.progress);
    locate(plon, plat, radius * 1.05, (k, cell) => {
      const [lon, lat] = cellCenter(cell);
      const near = nearestOnTrack(tr, { id: "", longitude: lon, latitude: lat, environment: "outdoor" }, st.progress, st.progress);
      if (near.distanceM > radius) return;
      if (structure === "underground") return;
      if (structure === "unknown") { unk[k] = 1; return; }
      const pot = proximityPotential(near.distanceM, RAIL.halfPotentialDistanceM.value) * RAIL.structureWeight.value[structure];
      if (pot > 0) { act[k] = 1; if (pot > best[k]!) best[k] = pot; }
    });
  }
  for (let k = 0; k < cellCount; k++) {
    if (act[k]) { out.status[k] = ST.active; out.value[k] = best[k]!; }
    else out.status[k] = unk[k] ? ST.unknown : ST.inactive;
  }
}
function pointAt(tr: RailRecord["payload"]["track"], p: number): [number, number] {
  // 與 nearestOnTrack 相同的 cum（度數平面長度）比例內插
  const target = p * tr.cum[tr.cum.length - 1]!;
  for (let i = 0; i + 1 < tr.coords.length; i++) {
    if (tr.cum[i + 1]! >= target) {
      const seg = tr.cum[i + 1]! - tr.cum[i]!;
      const f = seg > 0 ? (target - tr.cum[i]!) / seg : 0;
      const [x1, y1] = tr.coords[i]!;
      const [x2, y2] = tr.coords[i + 1]!;
      return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f];
    }
  }
  return tr.coords[tr.coords.length - 1]!;
}

// ── 主程式 ─────────────────────────────────────────────
async function main() {
  const scene = JSON.parse(readFileSync(path.join(ROOT, "public/sound-atlas/scenes", `${SCENE_ID}.json`), "utf8")) as Scene;
  const tLoad = performance.now();
  const sets = await sceneSets(scene);
  const loadMs = performance.now() - tLoad;
  const fam = (f: AnySoundFamily) => sets.filter((s) => s.family === f);
  const recCount: Record<string, number> = {};
  for (const s of sets) recCount[s.family] = (recCount[s.family] ?? 0) + s.records.length;
  const all = inScopeCells();
  const [bw, bs, be, bn] = scene.bbox;
  const inBbox = Uint32Array.from(Array.from(all).filter((c) => { const [lon, lat] = cellCenter(c); return lon >= bw && lon <= be && lat >= bs && lat <= bn; }));
  const sample = Uint32Array.from(seededSample(inBbox, SAMPLE));
  const focus = Date.parse(scene.focus_time) / 1000;
  const frameT = Math.floor(focus / 600) * 600;
  const times = [frameT, frameT - 3 * 3600, frameT + 5 * 3600, frameT + 10 * 3600 + 1200];
  const families: AnySoundFamily[] = ["aviation", "rain", "thunder", "rail", "road_traffic", "roadwork", "wind_vegetation", "coastal_wave", "river_water"];
  const report: Record<string, unknown> = {
    scene: SCENE_ID, cellsInScope: all.length, cellsInSceneBbox: inBbox.length, sample: sample.length,
    records: recCount, setLoadMs: Math.round(loadMs), frameT: new Date(frameT * 1000).toISOString(),
  };
  console.log(JSON.stringify(report));

  // B1 直算
  const direct: Record<string, { instMsPerCell: number; intervalMsPerCell: number; fullGridInstS: number }> = {};
  for (const f of families) {
    const inst = timeIt(() => { for (const c of sample) queryFamilyInterval(f, sets, recv(c), frameT, frameT); }, 3);
    const intv = timeIt(() => { for (const c of sample) queryFamilyInterval(f, sets, recv(c), frameT, frameT + 600 - 1e-6); }, 1);
    direct[f] = { instMsPerCell: inst.medMs / sample.length, intervalMsPerCell: intv.medMs / sample.length, fullGridInstS: (inst.medMs / sample.length) * all.length / 1000 };
  }
  const allInst = timeIt(() => { for (const c of sample) queryReceiver(recv(c), frameT, sets, families); }, 3);
  report.direct = direct;
  report.directAllFamilies = { msPerCell: allInst.medMs / sample.length, fullGridOneFrameS: (allInst.medMs / sample.length) * all.length / 1000, fullDay144FramesMin: (allInst.medMs / sample.length) * all.length * 144 / 60_000 };
  console.table(Object.entries(direct).map(([f, v]) => ({ family: f, instUsPerCell: +(v.instMsPerCell * 1000).toFixed(1), intervalUsPerCell: +(v.intervalMsPerCell * 1000).toFixed(1), fullGridInstS: +v.fullGridInstS.toFixed(2) })));
  console.log("direct all families", report.directAllFamilies);

  // B2 分類算法（全範圍格）
  const locateAll = cellLocator(all);
  const rainRecs = fam("rain").flatMap((s) => s.records) as RainRecord[];
  const avRecs = fam("aviation").flatMap((s) => s.records) as AviationRecord[];
  const railRecs = fam("rail").flatMap((s) => s.records) as RailRecord[];
  const pre: Record<string, { prepMs: number; bytes: string }> = {};
  const tr = timeIt(() => prepRain(rainRecs, all), 1);
  pre.rain = { prepMs: tr.medMs, bytes: `nearest Int16 × ${all.length} = ${(all.length * 2 / 1024).toFixed(0)} KB＋站×24h 序列` };
  const tw = timeIt(() => prepNatural(fam("wind_vegetation")[0], "wind_vegetation", all), 1);
  pre.wind_vegetation = { prepMs: tw.medMs, bytes: `係數 uint8＋最近站 Int16＋靜態狀態 uint8 ≈ ${(all.length * 4 / 1024).toFixed(0)} KB` };
  const tv = timeIt(() => prepNatural(fam("coastal_wave")[0], "coastal_wave", all), 1);
  pre.coastal_wave = { prepMs: tv.medMs, bytes: `同上 ≈ ${(all.length * 4 / 1024).toFixed(0)} KB` };
  const tRiv = timeIt(() => prepRiver(fam("river_water")[0], all), 1);
  pre.river_water = { prepMs: tRiv.medMs, bytes: `係數＋最近站＋靜態狀態 ≈ ${(all.length * 4 / 1024).toFixed(0)} KB` };
  const tTyp = timeIt(() => prepTypical(fam("road_traffic")[0], all, frameT), 1);
  pre.road_traffic_vd_typical = { prepMs: tTyp.medMs, bytes: `每格 300 m 內 VD 清單：${tTyp.value.recIdx.length} 筆 (Int16 VD＋uint8 距離) ≈ ${((tTyp.value.recIdx.length * 3 + all.length * 4) / 1024).toFixed(0)} KB（含 offsets）` };
  const tm = timeIt(() => prepRailUnknownMasks(railRecs, all, locateAll), 1);
  const maskCells = [...tm.value.values()].reduce((a, m) => a + m.k.length, 0);
  pre.rail_unknown_masks = { prepMs: tm.medMs, bytes: `${tm.value.size} 條軌道、共 ${maskCells} 格索引（Int32）≈ ${(maskCells * 5 / 1024).toFixed(0)} KB` };
  report.precompute = pre;
  console.table(Object.entries(pre).map(([k, v]) => ({ family: k, prepMs: Math.round(v.prepMs), size: v.bytes })));

  const g = newGrid(all.length);
  const perFrame: Record<string, { minMs: number; medMs: number }> = {};
  const fr = (name: string, fn: () => void) => { const r = timeIt(fn, 5); perFrame[name] = { minMs: +r.minMs.toFixed(2), medMs: +r.medMs.toFixed(2) }; };
  fr("rain", () => frameRain(tr.value, frameT, g));
  fr("wind_vegetation", () => frameNatural(tw.value, frameT, g));
  fr("coastal_wave", () => frameNatural(tv.value, frameT, g));
  fr("river_water", () => frameRiver(tRiv.value, frameT, g));
  fr("road_traffic(vd_typical)", () => frameTypical(tTyp.value, frameT, g));
  fr("aviation", () => frameAviation(avRecs, frameT, locateAll, all.length, g));
  fr("rail", () => frameRail(railRecs, frameT, locateAll, tm.value, all.length, g));
  // 每幀耗時的分布：飛機與列車在尖峰／離峰差很多
  const dayStart = taipeiMidnightMs(scene.date) / 1000;
  const sweep = (fn: (t: number) => void) => {
    const ts: number[] = [];
    for (let i = 0; i < 144; i += 6) { const a = performance.now(); fn(dayStart + i * 600); ts.push(performance.now() - a); }
    ts.sort((x, y) => x - y);
    return { p50: +ts[Math.floor(ts.length / 2)]!.toFixed(1), max: +ts[ts.length - 1]!.toFixed(1) };
  };
  report.perFrameFullGrid = perFrame;
  report.perFrameSweep24 = {
    aviation: sweep((t) => frameAviation(avRecs, t, locateAll, all.length, g)),
    rail: sweep((t) => frameRail(railRecs, t, locateAll, tm.value, all.length, g)),
  };
  console.table(Object.entries(perFrame).map(([k, v]) => ({ family: k, ...v })));
  console.log("sweep 24 frames", report.perFrameSweep24);

  // B3 抽樣驗證：分類算法（只算抽樣格）vs queryReceiver(格心, t)
  const locateS = cellLocator(sample);
  const preS = { rain: prepRain(rainRecs, sample), wind: prepNatural(fam("wind_vegetation")[0], "wind_vegetation", sample), wave: prepNatural(fam("coastal_wave")[0], "coastal_wave", sample), river: prepRiver(fam("river_water")[0], sample), typical: prepTypical(fam("road_traffic")[0], sample, frameT), railMask: prepRailUnknownMasks(railRecs, sample, locateS) };
  const checks: Record<string, { compared: number; statusMismatch: number; valueMismatch: number; maxAbsDiff: number; examples: string[]; byStatus: Record<string, number> }> = {};
  const names: Record<number, FamilyStatus> = { 0: "inactive", 1: "active", 2: "unknown", 3: "unavailable" };
  for (const f of ["rain", "wind_vegetation", "coastal_wave", "river_water", "road_traffic", "aviation", "rail"] as const) {
    const c = (checks[f] = { compared: 0, statusMismatch: 0, valueMismatch: 0, maxAbsDiff: 0, examples: [] as string[], byStatus: {} as Record<string, number> });
    for (const t of times) {
      const gg = newGrid(sample.length);
      const gate = familyGate(sets, f, t);
      if (f === "rain") frameRain(preS.rain, t, gg);
      else if (f === "wind_vegetation") frameNatural(preS.wind, t, gg);
      else if (f === "coastal_wave") frameNatural(preS.wave, t, gg);
      else if (f === "river_water") frameRiver(preS.river, t, gg);
      else if (f === "road_traffic") frameTypical(preS.typical, t, gg);
      else if (f === "aviation") frameAviation(avRecs, t, locateS, sample.length, gg);
      else frameRail(railRecs, t, locateS, preS.railMask, sample.length, gg);
      sample.forEach((cell, k) => {
        const ref = queryFamilyInterval(f, sets, recv(cell), t, t);
        const mine: FamilyStatus = gate === "ok" ? names[gg.status[k]!]! : gate;
        c.compared++;
        c.byStatus[ref.status] = (c.byStatus[ref.status] ?? 0) + 1;
        if (ref.status !== mine) {
          c.statusMismatch++;
          if (c.examples.length < 4) c.examples.push(`cell ${cell} t=${new Date(t * 1000).toISOString()} ref=${ref.status}(${ref.reason ?? ""}) mine=${mine}`);
          return;
        }
        if (ref.status === "active") {
          const d = Math.abs(ref.relativePotential! - gg.value[k]!);
          c.maxAbsDiff = Math.max(c.maxAbsDiff, d);
          if (d > 1e-9) c.valueMismatch++;
        }
      });
    }
  }
  report.validation = checks;
  console.table(Object.entries(checks).map(([f, v]) => ({ family: f, compared: v.compared, statusMismatch: v.statusMismatch, valueMismatch: v.valueMismatch, maxAbsDiff: v.maxAbsDiff, byStatus: JSON.stringify(v.byStatus) })));
  for (const [f, v] of Object.entries(checks)) for (const e of v.examples) console.log(`  ${f}: ${e}`);
  // B4（--day-pack）：飛機、列車整天 144 幀量化成 uint8（0 inactive、1–254 潛勢、255 unknown）後的預算檔大小
  if (args.includes("--day-pack")) {
    const pack: Record<string, unknown> = {};
    for (const f of ["aviation", "rail"] as const) {
      const buf = new Uint8Array(144 * all.length);
      const gg = newGrid(all.length);
      const a = performance.now();
      for (let i = 0; i < 144; i++) {
        const t = dayStart + i * 600;
        const gate = familyGate(sets, f, t);
        if (f === "aviation") frameAviation(avRecs, t, locateAll, all.length, gg);
        else frameRail(railRecs, t, locateAll, tm.value, all.length, gg);
        for (let k = 0; k < all.length; k++) {
          const st = gate !== "ok" ? ST.unknown : gg.status[k]!;
          buf[i * all.length + k] = st === ST.active ? Math.max(1, Math.min(254, Math.round(gg.value[k]! * 254))) : st === ST.inactive ? 0 : 255;
        }
      }
      const ms = performance.now() - a;
      const raw = Buffer.from(buf);
      pack[f] = { computeS: +(ms / 1000).toFixed(1), raw: raw.length, gz9: gzipSync(raw, { level: 9 }).length, br11: brotliCompressSync(raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length };
    }
    report.dayPack = pack;
    console.log("day pack (uint8, in-scope cells × 144)", pack);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
}

void main();
