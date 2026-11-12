/**
 * 鐵道 adapter（R01，移動點；地面／高架，排除地下段）。
 *
 * 資料（重用既有 loader，不新增 RPC）：
 * - 軌道幾何與 station_progress：`railLoader.loadAllRail()`（5 系統 tracks＋台鐵 odTracks）。
 * - 指定營運日的班表：台鐵 `fetchTraDailySchedule(opDay)`；其他系統 `fetchSupabaseSchedule(system, opDay)`。
 *   取不到 → 該系統該營運日 unavailable，**不拿今天的班表回填**（T12）。
 *   注意 fetchSupabaseSchedule 會在沒有 `_daily` 時退回 `_fixed`（固定時刻表），前端分不出是哪一種 → basis 標
 *   `daily_or_fixed_unverified`。
 *
 * 列車位置：與 `src/engines/RailEngine.ts`／`TraTrainEngine.ts` 相同的規則（延長日制 05:50 分界、
 * 站間依時間線性推進 progress、`interpolateOnLineString` 定位、環狀線終點 progress 修正）。
 * 兩個引擎只輸出位置、不輸出所在站間，所以這裡照同規則重算一次，以便查站間結構；
 * 一致性由測試 `railAdapter.test.ts` 對照 RailEngine.update 驗證。
 *
 * 營運日：延長日制下 D 日 00:00–05:50 屬於 D−1 營運日。查 D 時讀 D−1 與 D 兩個營運日（跨日班表）。
 *
 * 結構：`model/railSegments.ts`（OSM 衍生站間分類）。地下段不產生貢獻；unknown 段 → status unknown、潛勢 null。
 * 區間查詢：直接求「該時段列車走過的軌道子段」到接收者的最短距離（解析解，不取樣），高速列車不會漏。
 * 班表是 scheduled 證據，不是觀測（誤點、停駛不反映）。
 */
import type { RailStationTime } from "../../types";
import { DAY_START_SECONDS, calculateTotalLength, interpolateOnLineString, timeToSeconds } from "../../engines/railUtils";
import { MODEL_VERSION, RAIL } from "../model/soundProfiles";
import { structureAtProgress, trackStructureIntervals, type RailStructure, type StructureInterval } from "../model/railSegments";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { MS_PER_DAY, taipeiMidnightMs } from "../../lib/taipeiDay";
import { liveRailFetchers } from "./railLiveFetchers";
import type {
  IntervalQuery,
  Receiver,
  SoundSourceAdapter,
  SoundSourceRecord,
  SoundSourceSet,
  SourceContribution,
  SourceCoverage,
  SourceEvaluation,
} from "../types";

export type RailSystemId = "trtc" | "tra" | "thsr" | "krtc" | "tmrt" | "klrt";
export const RAIL_SYSTEMS: readonly RailSystemId[] = ["trtc", "tra", "thsr", "krtc", "tmrt", "klrt"];

export interface RailTrackInput {
  system: RailSystemId;
  trackId: string;
  coords: [number, number][];
  stationProgress: Record<string, number>;
}

export interface RailDepartureInput {
  trainId: string;
  trackId: string;
  /** "HH:MM:SS"；05:50 前視為延長日（+24h），與 railUtils.timeToSeconds 相同 */
  departureTime: string;
  totalTravelTime: number;
  stations: RailStationTime[];
}

export type RailScheduleBasis = "date_specific" | "daily_or_fixed_unverified" | "local_template";

export interface RailDaySchedule {
  departures: RailDepartureInput[] | null;
  basis: RailScheduleBasis;
  reason?: string;
}

/** 已準備好的軌道（快取：累積長度、結構區間、外框） */
export interface PreparedTrack {
  system: RailSystemId;
  trackId: string;
  coords: [number, number][];
  cum: number[];
  total: number;
  stationProgress: Record<string, number>;
  intervals: StructureInterval[];
  bbox: [number, number, number, number];
}

export type RailPayload =
  | {
      kind: "train";
      system: RailSystemId;
      opDay: string;
      trainId: string;
      depUnix: number;
      totalTravelTime: number;
      stations: RailStationTime[];
      basis: RailScheduleBasis;
      track: PreparedTrack;
    }
  | {
      /** 該系統該營運日班表取不到：軌道附近 → unknown（不是安靜） */
      kind: "schedule_unavailable";
      system: RailSystemId;
      opDay: string;
      reason: string;
      track: PreparedTrack;
    };

export type RailRecord = SoundSourceRecord<RailPayload, "rail">;

// ── 幾何 ───────────────────────────────────────────────────

export function prepareTrack(
  t: RailTrackInput,
  lookup: Parameters<typeof trackStructureIntervals>[2] = undefined,
): PreparedTrack {
  const cum = [0];
  for (let i = 0; i + 1 < t.coords.length; i++) {
    const [x1, y1] = t.coords[i]!;
    const [x2, y2] = t.coords[i + 1]!;
    cum.push(cum[i]! + Math.hypot(x2 - x1, y2 - y1));
  }
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of t.coords) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  return {
    system: t.system,
    trackId: t.trackId,
    coords: t.coords,
    cum,
    total: calculateTotalLength(t.coords),
    stationProgress: t.stationProgress,
    intervals: trackStructureIntervals(t.system, t.stationProgress, lookup),
    bbox: [w, s, e, n],
  };
}

const M_PER_DEG = 111_195;

/** 接收者到軌道 progress 區間 [pa, pb] 子折線的最短距離（局部等距投影，公尺）與最近點 progress */
export function nearestOnTrack(track: PreparedTrack, receiver: Receiver, pa: number, pb: number): { distanceM: number; progress: number } {
  const lo = Math.max(0, Math.min(pa, pb));
  const hi = Math.min(1, Math.max(pa, pb));
  const kx = M_PER_DEG * Math.cos((receiver.latitude * Math.PI) / 180);
  const rx = receiver.longitude * kx;
  const ry = receiver.latitude * M_PER_DEG;
  const total = track.total;
  if (total === 0 || track.coords.length < 2) {
    const [x, y] = track.coords[0] ?? [NaN, NaN];
    return { distanceM: Math.hypot(x * kx - rx, y * M_PER_DEG - ry), progress: lo };
  }
  if (hi - lo < 1e-12) {
    const [x, y] = interpolateOnLineString(track.coords, lo);
    return { distanceM: Math.hypot(x * kx - rx, y * M_PER_DEG - ry), progress: lo };
  }
  const dLo = lo * total;
  const dHi = hi * total;
  let best = { distanceM: Infinity, progress: lo };
  for (let i = 0; i + 1 < track.coords.length; i++) {
    const hit = segmentNearest(track, i, dLo, dHi, rx, ry, kx);
    if (hit && hit.distanceM < best.distanceM) best = hit;
  }
  return best;
}

/**
 * 第 i 段（coords[i]→coords[i+1]）裁到累積長度 [dLo, dHi] 之後，到 (rx, ry)（已投影：lon·kx、lat·M）的最短距離；
 * 這段不在範圍內或長度 0 → null。nearestOnTrack 與鐵道網格（W6-3 railGrid）共用，逐位相同。
 */
export function segmentNearest(track: PreparedTrack, i: number, dLo: number, dHi: number, rx: number, ry: number, kx: number): { distanceM: number; progress: number } | null {
  const c0 = track.cum[i]!;
  const c1 = track.cum[i + 1]!;
  if (c1 < dLo || c0 > dHi || c1 === c0) return null;
  const t0 = Math.max(0, (dLo - c0) / (c1 - c0));
  const t1 = Math.min(1, (dHi - c0) / (c1 - c0));
  const [x1, y1] = track.coords[i]!;
  const [x2, y2] = track.coords[i + 1]!;
  const ax = (x1 + (x2 - x1) * t0) * kx, ay = (y1 + (y2 - y1) * t0) * M_PER_DEG;
  const bx = (x1 + (x2 - x1) * t1) * kx, by = (y1 + (y2 - y1) * t1) * M_PER_DEG;
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  const u = L === 0 ? 0 : Math.max(0, Math.min(1, ((rx - ax) * dx + (ry - ay) * dy) / L));
  const d = Math.hypot(rx - (ax + u * dx), ry - (ay + u * dy));
  const along = c0 + (c1 - c0) * (t0 + (t1 - t0) * u);
  return { distanceM: d, progress: along / track.total };
}

function trackNearReceiver(track: PreparedTrack, receiver: Receiver, radiusM: number): boolean {
  const padLat = radiusM / M_PER_DEG;
  const padLon = radiusM / (M_PER_DEG * Math.cos((receiver.latitude * Math.PI) / 180));
  const [w, s, e, n] = track.bbox;
  return receiver.longitude >= w - padLon && receiver.longitude <= e + padLon && receiver.latitude >= s - padLat && receiver.latitude <= n + padLat;
}

// ── 列車狀態（與 RailEngine／TraTrainEngine 同規則） ─────────────

type SegState = { status: "running" | "stopped" | "arrived" | "waiting"; i: number; j: number; f: number };

function findSegment(stations: readonly RailStationTime[], elapsed: number): SegState {
  if (elapsed < 0) return { status: "waiting", i: 0, j: 0, f: 0 };
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i]!;
    if (elapsed >= s.arrival && elapsed < s.departure) return { status: "stopped", i, j: Math.min(i + 1, stations.length - 1), f: 0 };
    if (i < stations.length - 1) {
      const next = stations[i + 1]!;
      if (elapsed >= s.departure && elapsed < next.arrival) {
        const tt = next.arrival - s.departure;
        return { status: "running", i, j: i + 1, f: tt > 0 ? Math.max(0, Math.min(1, (elapsed - s.departure) / tt)) : 0 };
      }
    }
  }
  return { status: "arrived", i: stations.length - 1, j: stations.length - 1, f: 1 };
}

function stationP(track: PreparedTrack, stations: readonly RailStationTime[], idx: number): number | null {
  const id = stations[idx]?.station_id;
  if (!id) return null;
  const p = track.stationProgress[id];
  if (typeof p !== "number") return null;
  const isLoop = stations.length > 1 && stations[0]!.station_id === stations[stations.length - 1]!.station_id;
  // RailEngine 的環狀線修正：終點站 progress 回到起點時強制 1.0
  if (isLoop && idx === stations.length - 1 && idx > 0 && p < 0.5) return 1;
  return p;
}

export type RailProgressState =
  | { status: "inactive" }
  | { status: "unknown"; reason: string }
  | { status: "on_track"; progress: number; moving: boolean };

/** 時間 t 的列車 progress（0–1）；validFrom～validUntil 外 inactive；站不在 progress 表 → unknown（不猜） */
export function railProgressAt(record: RailRecord, t: number): RailProgressState {
  const p = record.payload;
  if (p.kind !== "train") return { status: "unknown", reason: p.reason };
  if (t < record.validFrom || t > record.validUntil) return { status: "inactive" };
  const seg = findSegment(p.stations, t - p.depUnix);
  if (seg.status === "waiting") return { status: "inactive" };
  const from = stationP(p.track, p.stations, seg.i);
  const to = stationP(p.track, p.stations, seg.j);
  if (from == null || to == null) return { status: "unknown", reason: "station_not_in_track_progress" };
  if (seg.status === "running") return { status: "on_track", progress: from + (to - from) * seg.f, moving: true };
  return { status: "on_track", progress: from, moving: false };
}

export function evaluateRail(record: RailRecord, t: number): SourceEvaluation {
  const st = railProgressAt(record, t);
  if (st.status !== "on_track") return st;
  const structure = structureAtProgress(record.payload.track.intervals, st.progress);
  if (structure === "underground") return { status: "inactive" };
  if (structure === "unknown") return { status: "unknown", reason: "rail_structure_unknown" };
  const [lon, lat] = interpolateOnLineString(record.payload.track.coords, st.progress);
  return { status: "active", geometry: { lon, lat, altitudeM: null }, relativeActivity: RAIL.structureWeight.value[structure] };
}

// ── 區間查詢 ───────────────────────────────────────────────

const iso = (t: number) => new Date(t * 1000).toISOString();

/** 單調函式 progress(t) 的反查：區間內 progress 最接近 target 的時間（二分） */
function timeAtProgress(record: RailRecord, target: number, ta: number, tb: number): number {
  const pa = railProgressAt(record, ta);
  const pb = railProgressAt(record, tb);
  if (pa.status !== "on_track" || pb.status !== "on_track") return ta;
  const inc = pb.progress >= pa.progress;
  let lo = ta, hi = tb;
  for (let k = 0; k < 30 && hi - lo > 0.5; k++) {
    const mid = (lo + hi) / 2;
    const pm = railProgressAt(record, mid);
    if (pm.status !== "on_track") break;
    if ((pm.progress < target) === inc) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function baseContribution(
  r: RailRecord,
  t: number,
  distance: number | null,
  potential: number | null,
  status: "active" | "unknown",
  structure: Exclude<RailStructure, "underground">,
  notes: string[],
  unknownReason?: string,
): SourceContribution<"rail"> {
  const p = r.payload;
  return {
    ...(unknownReason ? { unknownReason } : {}),
    sourceId: r.id,
    family: "rail",
    status,
    sourceTime: iso(t),
    spatialDistanceM: distance,
    relativePotential: potential,
    modeledDbA: null,
    evidence: "scheduled",
    spatialPrecision: "track_geometry_progress_interpolation",
    temporalPrecision: p.kind === "train" ? `timetable(${p.basis})` : "none(schedule_unavailable)",
    acousticConfidence: "unmeasured",
    railStructure: structure,
    propagationApproximation: "2d",
    notes: [`system:${p.system}`, `track:${p.track.trackId}`, `op_day:${p.opDay}`, ...(p.kind === "train" ? [`train:${p.trainId}`] : []), "schedule_not_observation", ...notes],
  };
}

/** 列車這段區間走過的 progress [lo, hi] 依站間結構切段（缺口＝unknown）；鐵道網格（W6-3）共用 */
export function railPieces(track: PreparedTrack, lo: number, hi: number): { a: number; b: number; structure: RailStructure }[] {
  const pieces: { a: number; b: number; structure: RailStructure }[] = [];
  if (hi - lo < 1e-12) {
    pieces.push({ a: lo, b: lo, structure: structureAtProgress(track.intervals, lo) });
    return pieces;
  }
  let covered = lo;
  for (const iv of track.intervals) {
    const a = Math.max(lo, iv.pStart);
    const b = Math.min(hi, iv.pEnd);
    if (b < a) continue;
    if (a > covered + 1e-9) pieces.push({ a: covered, b: a, structure: "unknown" }); // 區間缺口
    pieces.push({ a, b, structure: iv.structure });
    covered = Math.max(covered, b);
  }
  if (covered < hi - 1e-9) pieces.push({ a: covered, b: hi, structure: "unknown" });
  return pieces;
}

export const queryRailInterval: IntervalQuery<RailPayload, "rail"> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution<"rail">[] = [];
  const radius = RAIL.candidateRadiusM.value;
  let undergroundSkipped = 0;
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    const track = r.payload.track;
    if (!trackNearReceiver(track, receiver, radius)) continue;

    if (r.payload.kind === "schedule_unavailable") {
      const near = nearestOnTrack(track, receiver, 0, 1);
      if (near.distanceM > radius) continue;
      // 地下段附近的缺班表不必報 unknown
      if (structureAtProgress(track.intervals, near.progress) === "underground") continue;
      contributions.push(
        baseContribution(r, Math.max(t0, r.validFrom), near.distanceM, null, "unknown", "unknown", [`schedule_unavailable:${r.payload.reason}`], "rail_schedule_unavailable"),
      );
      continue;
    }

    const ta = Math.max(t0, r.validFrom);
    const tb = Math.min(t1, r.validUntil);
    const sa = railProgressAt(r, ta);
    const sb = railProgressAt(r, tb);
    if (sa.status === "unknown" || sb.status === "unknown") {
      const near = nearestOnTrack(track, receiver, 0, 1);
      if (near.distanceM <= radius) {
        const reason = sa.status === "unknown" ? sa.reason : (sb as { reason: string }).reason;
        contributions.push(baseContribution(r, ta, near.distanceM, null, "unknown", "unknown", [`position_unknown:${reason}`], reason));
      }
      continue;
    }
    // waiting／已離開：用另一端
    const pa = sa.status === "on_track" ? sa.progress : sb.status === "on_track" ? sb.progress : null;
    const pb = sb.status === "on_track" ? sb.progress : pa;
    if (pa == null || pb == null) continue;
    const lo = Math.min(pa, pb);
    const hi = Math.max(pa, pb);

    let best: SourceContribution<"rail"> | null = null;
    let unknownCand: SourceContribution<"rail"> | null = null;
    const pieces = railPieces(track, lo, hi);
    for (const piece of pieces) {
      const near = nearestOnTrack(track, receiver, piece.a, piece.b);
      if (near.distanceM > radius) continue;
      if (piece.structure === "underground") {
        undergroundSkipped++;
        continue;
      }
      const tc = hi - lo < 1e-12 ? ta : timeAtProgress(r, near.progress, ta, tb);
      if (piece.structure === "unknown") {
        if (!unknownCand) {
          unknownCand = baseContribution(r, tc, near.distanceM, null, "unknown", "unknown", ["rail_structure_unknown(not_treated_as_surface)"], "rail_structure_unknown");
        }
        continue;
      }
      const pot = proximityPotential(near.distanceM, RAIL.halfPotentialDistanceM.value) * RAIL.structureWeight.value[piece.structure];
      if (!best || (best.relativePotential ?? 0) < pot) {
        best = baseContribution(r, tc, near.distanceM, pot, "active", piece.structure, [`structure:${piece.structure}`, sa.status === "on_track" && sa.moving ? "moving" : "stopped_or_passing"]);
      }
    }
    if (best) contributions.push(best);
    else if (unknownCand) contributions.push(unknownCand);
  }
  return { contributions, notes: undergroundSkipped ? [`rail_underground_segments_excluded:${undergroundSkipped}`] : [] };
};

// ── 載入 ───────────────────────────────────────────────────

export function shiftDateKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** "HH:MM:SS" → 當日秒數（不做延長日位移） */
function clockSeconds(timeStr: string): number {
  const [h = "0", m = "0", s = "0"] = timeStr.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export const railProvider = (system: RailSystemId, opDay: string) => `rail_${system}@${opDay}`;
export const RAIL_NETWORK_PROVIDER = "rail_network_static";

/** 營運日 opDay 的班表 → train records（unix 時間錨定 opDay 臺北零時，延長日秒數） */
export function departuresToRecords(
  system: RailSystemId,
  opDay: string,
  departures: readonly RailDepartureInput[],
  tracks: ReadonlyMap<string, PreparedTrack>,
  basis: RailScheduleBasis,
  calendarDay: boolean = RAIL.calendarDaySystems.value.includes(system),
): { records: RailRecord[]; missingTrack: number } {
  const midnight = taipeiMidnightMs(opDay) / 1000;
  const records: RailRecord[] = [];
  const seenIds = new Set<string>();
  let missingTrack = 0;
  for (const d of departures) {
    const track = tracks.get(d.trackId);
    if (!track || !d.stations?.length) {
      missingTrack++;
      continue;
    }
    // 日曆日系統（台鐵、高鐵）：班表時刻就是 opDay 當天時刻；捷運類：延長日制（05:50 前 +24h）
    const depUnix = midnight + (calendarDay ? clockSeconds(d.departureTime) : timeToSeconds(d.departureTime));
    const last = d.stations[d.stations.length - 1]!;
    // 車次編號不保證跨軌道唯一（北捷班表同一 train_id 會出現在不同 track）：重複時補 trackId，
    // 否則 UI 以 id 建索引會把列車畫到別條線上
    let id = `rail:${system}:${opDay}:${d.trainId}`;
    if (seenIds.has(id)) id = `${id}@${d.trackId}`;
    for (let k = 2; seenIds.has(id); k++) id = `rail:${system}:${opDay}:${d.trainId}@${d.trackId}#${k}`;
    seenIds.add(id);
    records.push({
      id,
      family: "rail",
      geometryKind: "moving_point_2d",
      payload: { kind: "train", system, opDay, trainId: d.trainId, depUnix, totalTravelTime: d.totalTravelTime, stations: d.stations, basis, track },
      validFrom: depUnix + d.stations[0]!.arrival,
      validUntil: depUnix + Math.max(d.totalTravelTime, last.arrival),
      modelVersion: MODEL_VERSION,
      provenance: { provider: railProvider(system, opDay), originalId: d.trainId },
      quality: { location: "approximate", time: "scheduled", emission: "unmeasured" },
      visibility: "public",
    });
  }
  return { records, missingTrack };
}

export interface RailFetchers {
  /** 靜態軌道幾何＋station_progress（所有系統） */
  network(): Promise<RailTrackInput[]>;
  /** 某系統某營運日的班表；取不到回 departures=null */
  schedule(system: RailSystemId, opDay: string): Promise<RailDaySchedule>;
}

/**
 * 查 D 日：讀 D−1、D 兩個營運日。每個（系統、營運日）一筆 coverage：
 *   延長日制（捷運類）：D−1 營運日從 D 00:00 起、D 營運日從 D 05:50 起；
 *   日曆日制（台鐵、高鐵，RAIL.calendarDaySystems）：兩者都從 D 00:00 起（D−1 只剩跨午夜的車）。
 *   D−1 營運日的窗尾延到它最後一班車的結束時間（05:50 前發車、之後還在跑的車不會被丟掉）。
 * 班表取不到的（系統、營運日）→ 該系統軌道放 schedule_unavailable 佔位（provider=rail_network_static），
 * 接收者在軌道附近時回 unknown，不會因為「沒有列車 record」被算成 0。
 */
export async function loadRail(
  ctx: { date: string; systems?: readonly RailSystemId[]; structureLookup?: Parameters<typeof trackStructureIntervals>[2] },
  fetchers: RailFetchers,
): Promise<SoundSourceSet<RailPayload, "rail">> {
  const systems = ctx.systems ?? RAIL_SYSTEMS;
  const dayStart = taipeiMidnightMs(ctx.date) / 1000;
  const split = dayStart + DAY_START_SECONDS;
  const dayEnd = dayStart + 86_400;
  const cov = (provider: string, status: SourceCoverage["status"], start: number, end: number, reason?: string): SourceCoverage<"rail"> => ({
    family: "rail",
    provider,
    dateKey: ctx.date,
    status,
    windowStart: start,
    windowEnd: end,
    temporalKind: "static_schedule",
    ...(reason ? { reason } : {}),
  });
  let network: RailTrackInput[];
  try {
    network = await fetchers.network();
  } catch (e) {
    return { family: "rail", dateKey: ctx.date, records: [], coverage: [cov(RAIL_NETWORK_PROVIDER, "error", dayStart, dayStart + 86_400, String(e))] };
  }
  const bySystem = new Map<RailSystemId, Map<string, PreparedTrack>>();
  for (const t of network) {
    if (!systems.includes(t.system) || t.coords.length < 2) continue;
    let m = bySystem.get(t.system);
    if (!m) bySystem.set(t.system, (m = new Map()));
    m.set(t.trackId, prepareTrack(t, ctx.structureLookup));
  }
  const records: RailRecord[] = [];
  const coverage: SourceCoverage<"rail">[] = [cov(RAIL_NETWORK_PROVIDER, network.length ? "ok" : "empty", dayStart, dayStart + 86_400)];
  for (const system of systems) {
    const tracks = bySystem.get(system) ?? new Map<string, PreparedTrack>();
    const calendarDay = RAIL.calendarDaySystems.value.includes(system);
    const windows = [
      // 班表取不到時 D−1 的佔位窗用到 05:50（跨午夜列車的實際結束時間無從得知，保守以 unknown 蓋住）
      { opDay: shiftDateKey(ctx.date, -1), start: dayStart, end: split, prev: true },
      { opDay: ctx.date, start: calendarDay ? dayStart : split, end: dayEnd, prev: false },
    ];
    for (const w of windows) {
      const provider = railProvider(system, w.opDay);
      let sched: RailDaySchedule;
      try {
        sched = await fetchers.schedule(system, w.opDay);
      } catch (e) {
        sched = { departures: null, basis: "date_specific", reason: String(e) };
      }
      if (!sched.departures) {
        const reason = sched.reason ?? "no_schedule_for_op_day";
        coverage.push(cov(provider, "unavailable", w.start, w.end, reason));
        for (const track of tracks.values()) {
          records.push({
            id: `rail:${system}:${w.opDay}:unavailable:${track.trackId}`,
            family: "rail",
            geometryKind: "moving_point_2d",
            payload: { kind: "schedule_unavailable", system, opDay: w.opDay, reason, track },
            validFrom: w.start,
            validUntil: w.end,
            modelVersion: MODEL_VERSION,
            provenance: { provider: RAIL_NETWORK_PROVIDER, originalId: track.trackId },
            quality: { location: "approximate", time: "scheduled", emission: "unmeasured" },
            visibility: "public",
          });
        }
        continue;
      }
      const { records: rs, missingTrack } = departuresToRecords(system, w.opDay, sched.departures, tracks, sched.basis, calendarDay);
      // 營運日的列車可能跨進 D+1；只保留與查詢日有重疊者
      const kept = rs.filter((r) => r.validUntil >= dayStart && r.validFrom < dayEnd);
      records.push(...kept);
      const lastEnd = kept.reduce((m, r) => Math.max(m, r.validUntil), -Infinity);
      // D−1：窗尾＝最後一班結束（延長日制至少到 05:50）；D：到 D+1 00:00
      const end = w.prev ? Math.min(dayEnd, Math.max(calendarDay ? dayStart : split, lastEnd)) : w.end;
      coverage.push(
        cov(provider, kept.length ? "ok" : "empty", w.start, end, [`basis:${sched.basis}`, missingTrack ? `departures_without_track_geometry:${missingTrack}` : ""].filter(Boolean).join(";")),
      );
    }
  }
  return { family: "rail", dateKey: ctx.date, records, coverage };
}

export const railAdapter: SoundSourceAdapter<RailPayload, "rail"> & { loadWith: typeof loadRail } = {
  family: "rail",
  load: (c) => loadRail(c, liveRailFetchers),
  loadWith: loadRail,
  evaluate: evaluateRail,
  queryInterval: queryRailInterval,
};
