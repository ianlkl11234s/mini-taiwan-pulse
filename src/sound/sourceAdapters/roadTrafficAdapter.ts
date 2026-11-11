/**
 * 道路車流 adapter（T01，線聲源）。
 *
 * 查核結論（2026-11-11，詳見 docs/features/city-sound-atlas/MVP_B_SOURCES.md §3）：
 * - 前端可讀的道路資料只有 `get_freeway_congestion_day`（國道路段幾何＋壅塞等級＋旅行速率）與
 *   `get_road_congestion_day`（省道壅塞等級 timeline，幾何在 PMTiles）。**兩者都沒有車流量**。
 * - 國道 VD 車流量（realtime/live.freeway_vd_traffic、S3 freeway_vd/archives）沒有 public RPC，
 *   歸檔也沒有 VD 座標；市區 VD（collector `vd`）S3 只到 2026-01-14。
 * → 預設只給「道路類型 proxy」：國道路段附近 active，潛勢＝距離 kernel × 道路類型權重，
 *   `proxyKind=road_type_no_volume`、`evidence=inferred`，**不宣稱流量**。壅塞等級與速率只放 notes
 *   （凌晨三點與下午三點都可能是「順暢」，等級不能當流量）。
 * - payload 保留可選 volume 序列（日後有 VD 流量來源時注入）：有樣本 → `observed_volume`、evidence=observed。
 *
 * 空間涵蓋：目前只有國道路段。接收者 candidateRadius 內沒有任何已載入路段 → 回一筆 unknown（市區街道未涵蓋），
 * 不會被算成 inactive＝0（T18）。
 */
import { fetchFreewayDay, type FreewaySection, type FreewaySnapshot } from "../../data/freewayLoader";
import { MODEL_VERSION, ROAD_TRAFFIC } from "../model/soundProfiles";
import { distanceToGeometryM } from "../engines/geometryShapes";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import type { IntervalQuery, SoundSourceAdapter, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceEvaluation } from "../types";

export type RoadType = keyof typeof ROAD_TRAFFIC.roadTypeProxyWeight.value;

export interface VolumeSample {
  ts: number;
  vehPerHour: number | null;
}

export interface RoadTrafficPayload {
  sectionId: string;
  name: string | null;
  roadName: string | null;
  direction: string | null;
  roadType: RoadType;
  coords: [number, number][];
  /** 壅塞等級／速率（只放 notes，不當流量） */
  congestion: FreewaySnapshot[];
  /** 觀測車流量（每小時車輛數）；null＝沒有流量來源（目前一律 null） */
  volume: VolumeSample[] | null;
}

export type RoadTrafficRecord = SoundSourceRecord<RoadTrafficPayload, "road_traffic">;

export const ROAD_TRAFFIC_PROVIDER = "freeway_sections";
export const ROAD_TRAFFIC_GAP_ID = "road_traffic:network_not_covered";

export function freewaySectionsToRecords(
  sections: readonly FreewaySection[],
  dateKey: string,
  volumeBySection: ReadonlyMap<string, VolumeSample[]> | null = null,
): RoadTrafficRecord[] {
  const start = taipeiMidnightMs(dateKey) / 1000;
  return sections
    .filter((s) => s.coords.length >= 2)
    .map((s) => ({
      id: `road_traffic:freeway:${s.section_id}`,
      family: "road_traffic" as const,
      geometryKind: "line" as const,
      payload: {
        sectionId: s.section_id,
        name: s.section_name,
        roadName: s.road_name,
        direction: s.direction_label,
        roadType: "freeway" as const,
        coords: s.coords,
        congestion: s.timeline,
        volume: volumeBySection?.get(s.section_id) ?? null,
      },
      validFrom: start,
      validUntil: start + 86_400,
      modelVersion: MODEL_VERSION,
      provenance: { provider: ROAD_TRAFFIC_PROVIDER, originalId: s.section_id },
      quality: { location: "exact_observed" as const, time: "estimated" as const, emission: "proxy" as const },
      visibility: "public" as const,
    }));
}

/** 時間 t 的流量：取 t 之前最近一筆且不超過 volumeMaxAgeS；否則 null */
export function volumeAt(samples: readonly VolumeSample[], t: number): VolumeSample | null {
  let best: VolumeSample | null = null;
  for (const s of samples) if (s.ts <= t && (!best || s.ts > best.ts)) best = s;
  if (!best || t - best.ts > ROAD_TRAFFIC.volumeMaxAgeS.value || best.vehPerHour == null || !(best.vehPerHour >= 0)) return null;
  return best;
}

export function volumePotential(vehPerHour: number): number {
  return 1 - Math.exp(-vehPerHour / ROAD_TRAFFIC.volumeScaleVehPerHour.value);
}

function congestionNote(p: RoadTrafficPayload, t: number): string {
  let snap: FreewaySnapshot | null = null;
  for (const s of p.congestion) if (s.ts <= t && (!snap || s.ts > snap.ts)) snap = s;
  return snap ? `congestion_level:${snap.level},speed_kmh:${snap.speed ?? "null"}@${new Date(snap.ts * 1000).toISOString()}(not_volume)` : "congestion:none";
}

export function evaluateRoadTraffic(record: RoadTrafficRecord, t: number): SourceEvaluation {
  if (t < record.validFrom || t > record.validUntil) return { status: "inactive" };
  const [lon, lat] = record.payload.coords[0]!;
  if (record.payload.volume) {
    const v = volumeAt(record.payload.volume, t);
    if (!v) return { status: "unknown", reason: "volume_sample_gap" };
    return { status: "active", geometry: { lon, lat, altitudeM: null }, relativeActivity: volumePotential(v.vehPerHour!) };
  }
  return { status: "active", geometry: { lon, lat, altitudeM: null }, relativeActivity: ROAD_TRAFFIC.roadTypeProxyWeight.value[record.payload.roadType] };
}

const iso = (t: number) => new Date(t * 1000).toISOString();

export const queryRoadTrafficInterval: IntervalQuery<RoadTrafficPayload, "road_traffic"> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution<"road_traffic">[] = [];
  const radius = ROAD_TRAFFIC.candidateRadiusM.value;
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    const p = r.payload;
    const d = distanceToGeometryM({ type: "LineString", coordinates: p.coords }, receiver.longitude, receiver.latitude);
    if (d == null || d > radius) continue;
    const prox = proximityPotential(d, ROAD_TRAFFIC.halfPotentialDistanceM.value);
    const base = {
      sourceId: r.id,
      family: "road_traffic" as const,
      spatialDistanceM: d,
      modeledDbA: null,
      spatialPrecision: "freeway_section_line",
      notes: [`road_type:${p.roadType}`, `road:${p.roadName ?? ""}${p.direction ?? ""}`, `section:${p.name ?? p.sectionId}`, congestionNote(p, t1)],
    };
    if (p.volume) {
      // 區間內取最大流量樣本；沒有任何有效樣本 → unknown
      let bestV: VolumeSample | null = null;
      for (const s of p.volume) {
        const v = s.ts >= t0 && s.ts <= t1 ? s : null;
        if (v && v.vehPerHour != null && v.vehPerHour >= 0 && (!bestV || v.vehPerHour > bestV.vehPerHour!)) bestV = v;
      }
      if (!bestV) bestV = volumeAt(p.volume, t0);
      if (!bestV) {
        contributions.push({ ...base, status: "unknown", unknownReason: "volume_sample_gap", sourceTime: iso(t0), relativePotential: null, evidence: "observed", temporalPrecision: "vd_sample_gap", acousticConfidence: "unmeasured", proxyKind: "observed_volume" });
        continue;
      }
      contributions.push({
        ...base,
        status: "active",
        sourceTime: iso(bestV.ts),
        relativePotential: prox * volumePotential(bestV.vehPerHour!),
        evidence: "observed",
        temporalPrecision: "vd_sample",
        acousticConfidence: "proxy",
        proxyKind: "observed_volume",
        notes: [...base.notes, `volume_veh_per_hour:${bestV.vehPerHour}`],
      });
      continue;
    }
    contributions.push({
      ...base,
      status: "active",
      sourceTime: iso(Math.max(t0, r.validFrom)),
      relativePotential: prox * ROAD_TRAFFIC.roadTypeProxyWeight.value[p.roadType],
      evidence: "inferred",
      temporalPrecision: "none(road_type_static)",
      acousticConfidence: "unmeasured",
      proxyKind: "road_type_no_volume",
      notes: [...base.notes, "road_type_proxy_only:no_traffic_volume"],
    });
  }
  if (contributions.length === 0) {
    // 只有國道路段：附近沒有已載入路段 ≠ 附近沒有車（市區街道未涵蓋）
    contributions.push({
      sourceId: ROAD_TRAFFIC_GAP_ID,
      family: "road_traffic",
      status: "unknown",
      unknownReason: "road_network_not_covered(only_freeway_sections_loaded)",
      sourceTime: iso(t0),
      spatialDistanceM: null,
      relativePotential: null,
      modeledDbA: null,
      evidence: "inferred",
      spatialPrecision: "none",
      temporalPrecision: "none",
      acousticConfidence: "unmeasured",
      notes: ["no_loaded_road_within_candidate_radius", "local_streets_not_covered"],
    });
  }
  return { contributions, notes: [] };
};

export async function loadRoadTraffic(
  ctx: { date: string },
  fetcher: (date: string) => Promise<{ sections: FreewaySection[] }> = fetchFreewayDay,
): Promise<SoundSourceSet<RoadTrafficPayload, "road_traffic">> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const base = { family: "road_traffic" as const, provider: ROAD_TRAFFIC_PROVIDER, dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
  try {
    const { sections } = await fetcher(ctx.date);
    const records = freewaySectionsToRecords(sections, ctx.date);
    return {
      family: "road_traffic",
      dateKey: ctx.date,
      records,
      coverage: [{ ...base, status: records.length ? "ok" : "empty", reason: records.length ? "road_type_proxy_only(no_volume_source)" : "no_freeway_sections_for_date" }],
    };
  } catch (e) {
    return { family: "road_traffic", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const roadTrafficAdapter: SoundSourceAdapter<RoadTrafficPayload, "road_traffic"> = {
  family: "road_traffic",
  load: (c) => loadRoadTraffic(c),
  evaluate: evaluateRoadTraffic,
  queryInterval: queryRoadTrafficInterval,
};
