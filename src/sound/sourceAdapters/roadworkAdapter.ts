/**
 * 道路施工 adapter（C01，點／線／面；許可期間＝可能活動）。
 *
 * 資料：重用 `roadEventsLoader.fetchRoadEventsDay(date)`（public RPC get_road_events_day，Supabase 保留約 21 天）；
 * 場景快照用 S3 `road_event_planned/archives/<D>.tar.gz` 轉成同形 RoadEvent（build-sound-scenes.py）。
 * 只取 source=event_city（TDX 縣市預告事件）且 EventType ∈ ROADWORK.eventTypes（2＝施工）。
 *
 * 時間：EffectiveTime～ExpireTime（許可期間）以既有 `isRoadEventActive` 判定。許可期間內：
 *   - permitWindowPolicy=possible_activity（預設）→ active，evidence=scheduled，proxyKind=permit_window_possible_activity，
 *     潛勢再乘 possibleActivityWeight。**許可≠機具運轉**；多數許可跨月／跨年、沒有每日工時，不自行假設工時。
 *   - permitWindowPolicy=unknown → unknown。
 *   許可期間外 → 不產生貢獻（inactive）。生效時間缺漏（start_ts=0）→ 不算進行中，計數進 notes。
 *
 * 空間涵蓋：collector 只查 10 縣市，且臺南、高雄、金門回 0 筆（視為沒發布）。接收者所在縣市不在涵蓋清單 → 一筆 unknown，
 * 不會被算成 inactive＝0（T18）。涵蓋清單：即時路徑用 ROADWORK.coveredCities；快照用歸檔的 per_city>0。
 */
import { fetchRoadEventsDay, isRoadEventActive, type RoadEvent } from "../../data/roadEventsLoader";
import { MODEL_VERSION, ROADWORK } from "../model/soundProfiles";
import { citiesContaining } from "../model/cityBbox";
import { distanceToGeometryM } from "../engines/geometryShapes";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import type { IntervalQuery, Receiver, SoundSourceAdapter, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceEvaluation } from "../types";

export type RoadworkPayload =
  | { kind: "permit"; event: RoadEvent }
  | {
      /** 這組資料的空間涵蓋（哪些縣市有發布施工事件） */
      kind: "coverage";
      coveredCities: readonly string[];
    };

export type RoadworkRecord = SoundSourceRecord<RoadworkPayload, "roadwork">;

export const ROADWORK_PROVIDER = "tdx_road_event_city";
export const ROADWORK_COVERAGE_ID = "roadwork:coverage";

/** 接收者所在縣市（未外擴外框）都在涵蓋清單內才算涵蓋；外框有重疊時保守處理 */
export function receiverCovered(receiver: Pick<Receiver, "longitude" | "latitude">, coveredCities: readonly string[]): { covered: boolean; cities: string[] } {
  const cities = citiesContaining(receiver.longitude, receiver.latitude);
  return { covered: cities.length > 0 && cities.every((c) => coveredCities.includes(c)), cities };
}

/** 生命週期上界（unix 秒）：ExpireTime；沒有時用 isRoadEventActive 的新鮮度規則判定，這裡只給篩選用的寬鬆上界 */
function permitEnd(e: RoadEvent): number {
  return e.end_ts ?? e.last_updated_ts + 36 * 3600;
}

export function roadEventsToRecords(
  events: readonly RoadEvent[],
  dateKey: string,
  coveredCities: readonly string[],
): { records: RoadworkRecord[]; skipped: { notRoadwork: number; noStart: number; noGeometry: number } } {
  const dayStart = taipeiMidnightMs(dateKey) / 1000;
  const skipped = { notRoadwork: 0, noStart: 0, noGeometry: 0 };
  const records: RoadworkRecord[] = [
    {
      id: ROADWORK_COVERAGE_ID,
      family: "roadwork",
      geometryKind: "area",
      payload: { kind: "coverage", coveredCities },
      validFrom: dayStart,
      validUntil: dayStart + 86_400,
      modelVersion: MODEL_VERSION,
      provenance: { provider: ROADWORK_PROVIDER },
      quality: { location: "unknown", time: "scheduled", emission: "unmeasured" },
      visibility: "internal",
    },
  ];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.source !== "event_city" || e.event_type == null || !ROADWORK.eventTypes.value.includes(e.event_type)) {
      skipped.notRoadwork++;
      continue;
    }
    if (!e.geometry) {
      skipped.noGeometry++;
      continue;
    }
    if (!(e.start_ts > 0)) {
      skipped.noStart++;
      continue;
    }
    if (seen.has(e.event_id)) continue;
    seen.add(e.event_id);
    const g = e.geometry.type;
    records.push({
      id: `roadwork:${e.event_id}`,
      family: "roadwork",
      geometryKind: g === "Point" || g === "MultiPoint" ? "point" : g.includes("Polygon") ? "area" : "line",
      payload: { kind: "permit", event: e },
      validFrom: e.start_ts,
      validUntil: permitEnd(e),
      modelVersion: MODEL_VERSION,
      provenance: { provider: ROADWORK_PROVIDER, originalId: e.event_id, observedAt: e.last_updated_ts || undefined },
      quality: { location: "geocoded", time: "scheduled", emission: "unmeasured" },
      visibility: "public",
    });
  }
  return { records, skipped };
}

/** 區間 [t0, t1] 內是否有任一時刻在許可期間內（沿用 isRoadEventActive 的規則） */
export function permitActiveDuring(e: RoadEvent, t0: number, t1: number): boolean {
  if (!(e.start_ts > 0) || e.start_ts > t1) return false;
  return isRoadEventActive(e, Math.max(t0, e.start_ts));
}

export function evaluateRoadwork(record: RoadworkRecord, t: number): SourceEvaluation {
  const p = record.payload;
  if (p.kind !== "permit") return { status: "inactive" };
  if (!isRoadEventActive(p.event, t)) return { status: "inactive" };
  if (ROADWORK.permitWindowPolicy.value === "unknown") return { status: "unknown", reason: "permit_window_work_hours_unknown" };
  const first = firstCoord(p.event.geometry);
  if (!first) return { status: "unknown", reason: "permit_geometry_missing" };
  return {
    status: "active",
    geometry: { lon: first[0]!, lat: first[1]!, altitudeM: null },
    relativeActivity: ROADWORK.possibleActivityWeight.value,
  };
}

/** 幾何的第一個座標（evaluate 用的代表點；距離計算一律用完整幾何） */
function firstCoord(g: GeoJSON.Geometry | null): number[] | null {
  if (!g || g.type === "GeometryCollection") return null;
  let c: unknown = g.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === "number" ? (c as number[]) : null;
}

const iso = (t: number) => new Date(t * 1000).toISOString();
const daysBetween = (a: number, b: number) => Math.round((b - a) / 86_400);

export const queryRoadworkInterval: IntervalQuery<RoadworkPayload, "roadwork"> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution<"roadwork">[] = [];
  const radius = ROADWORK.candidateRadiusM.value;
  const coverage = records.find((r) => r.payload.kind === "coverage");
  const coveredCities = coverage && coverage.payload.kind === "coverage" ? coverage.payload.coveredCities : ROADWORK.coveredCities.value;
  const cov = receiverCovered(receiver, coveredCities);
  for (const r of records) {
    const p = r.payload;
    if (p.kind !== "permit") continue;
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    if (!permitActiveDuring(p.event, t0, t1)) continue;
    const d = distanceToGeometryM(p.event.geometry, receiver.longitude, receiver.latitude);
    if (d == null || d > radius) continue;
    const e = p.event;
    const notes = [
      `title:${e.title ?? ""}`,
      `event_type:${e.event_type}`,
      `permit:${iso(e.start_ts)}~${e.end_ts != null ? iso(e.end_ts) : "open(freshness_rule)"}`,
      ...(e.end_ts != null ? [`permit_span_days:${daysBetween(e.start_ts, e.end_ts)}`] : []),
      "permit_is_not_machinery_operation",
      "daily_work_hours_unknown",
    ];
    const base = {
      sourceId: r.id,
      family: "roadwork" as const,
      sourceTime: iso(Math.max(t0, e.start_ts)),
      spatialDistanceM: d,
      modeledDbA: null,
      evidence: "scheduled" as const,
      spatialPrecision: e.geometry?.type === "Point" ? "permit_point" : "permit_area_or_line",
      temporalPrecision: "permit_window(no_daily_hours)",
      acousticConfidence: "unmeasured" as const,
      proxyKind: "permit_window_possible_activity" as const,
      notes,
    };
    if (ROADWORK.permitWindowPolicy.value === "unknown") {
      contributions.push({ ...base, status: "unknown", unknownReason: "permit_window_work_hours_unknown", relativePotential: null });
    } else {
      contributions.push({
        ...base,
        status: "active",
        relativePotential: proximityPotential(d, ROADWORK.halfPotentialDistanceM.value) * ROADWORK.possibleActivityWeight.value,
      });
    }
  }
  if (!cov.covered) {
    contributions.push({
      sourceId: ROADWORK_COVERAGE_ID,
      family: "roadwork",
      status: "unknown",
      unknownReason: "roadwork_city_not_covered",
      sourceTime: iso(t0),
      spatialDistanceM: null,
      relativePotential: null,
      modeledDbA: null,
      evidence: "scheduled",
      spatialPrecision: "none",
      temporalPrecision: "none",
      acousticConfidence: "unmeasured",
      notes: [`receiver_cities:${cov.cities.join(",") || "none"}`, `covered_cities:${coveredCities.join(",")}`],
    });
  }
  return { contributions, notes: [] };
};

export async function loadRoadwork(
  ctx: { date: string },
  fetcher: (date: string) => Promise<RoadEvent[]> = fetchRoadEventsDay,
  coveredCities: readonly string[] = ROADWORK.coveredCities.value,
): Promise<SoundSourceSet<RoadworkPayload, "roadwork">> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const base = { family: "roadwork" as const, provider: ROADWORK_PROVIDER, dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
  try {
    const events = await fetcher(ctx.date);
    const { records, skipped } = roadEventsToRecords(events, ctx.date, coveredCities);
    const n = records.length - 1;
    const reason = `roadwork:${n};not_roadwork:${skipped.notRoadwork};no_start:${skipped.noStart};no_geometry:${skipped.noGeometry}`;
    // event_city 是 12 小時一抓的預告事件；整天 0 筆施工多半是收集或保留期問題 → empty（引擎回 unknown），不是「沒有施工」
    return { family: "roadwork", dateKey: ctx.date, records, coverage: [{ ...base, status: n > 0 ? "ok" : "empty", reason }] };
  } catch (e) {
    return { family: "roadwork", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const roadworkAdapter: SoundSourceAdapter<RoadworkPayload, "roadwork"> = {
  family: "roadwork",
  load: (c) => loadRoadwork(c),
  evaluate: evaluateRoadwork,
  queryInterval: queryRoadworkInterval,
};
