/**
 * 垃圾車 adapter（W01，表定停點）。
 *
 * 資料：重用 wasteScheduleLoader.fetchWasteScheduleDay(cities, dow)（靜態快照
 * get_waste_schedule_day_<dow>_<分組>.json）。只用表定停點：不做 GPS、不沿停點間直線發聲。
 *
 * 時間：
 * - 每筆停點錨定「服務日」的臺北零時；arrivalSec 可 > 86400（24:11 = 隔日 00:11）。
 * - 查某日 D 時同時讀 D 與 D−1 的 dow 表定，D−1 只保留跨進 D 的停點（T01）。
 * - dow 以 Asia/Taipei 計算（不用執行環境時區的 getDay）。
 *
 * 星期可信度（T02）：RPC 端把「星期欄位為空」當每日，輸出看不出哪些停點缺星期。
 * 以城市層級白名單判斷：WASTE.weekdayListedCities（已查證 4 城）→ weekday_listed；
 * WASTE.weekdayUnknownCities（臺北市）→ weekday_unknown（預設回 unknown）；其餘 → weekday_unverified
 * （預設顯示候選但 evidence=inferred）。只有 weekday_listed 且非推算時刻才算 scheduled。
 */
import {
  ALL_22_CITIES,
  fetchWasteScheduleDay,
  type WasteScheduleRoute,
} from "../../data/wasteScheduleLoader";
import { MODEL_VERSION, WASTE } from "../model/soundProfiles";
import { haversineM } from "../engines/geometryDistance";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { MS_PER_DAY, taipeiMidnightMs } from "../../lib/taipeiDay";
import type {
  IntervalQuery,
  SoundSourceAdapter,
  SoundSourceRecord,
  SoundSourceSet,
  SourceContribution,
  SourceCoverage,
  SourceEvaluation,
} from "../types";

export type CalendarConfidence = "weekday_listed" | "weekday_unknown" | "weekday_unverified";

export interface WastePayload {
  city: string;
  routeId: string;
  routeName: string | null;
  stopId: number;
  stopName: string | null;
  lon: number;
  lat: number;
  /** 服務日（表定所屬日）臺北日期與零時 unix 秒 */
  serviceDateKey: string;
  serviceMidnight: number;
  arrivalSec: number;
  departureSec: number;
  /** 實際停靠窗（unix 秒）：[arrival, max(departure, arrival+minDwell)] */
  stopStart: number;
  stopEnd: number;
  calendarConfidence: CalendarConfidence;
  scheduleInferred: boolean;
}

export type WasteRecord = SoundSourceRecord<WastePayload>;

/** 臺北日期鍵 → JS getDay 規則的 dow（0=Sun）；與執行環境時區無關 */
export function taipeiDow(dateKey: string): number {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`)).getUTCDay();
}

/** 臺北日期鍵加減天數 */
export function shiftTaipeiDateKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 白名單：只有已查證有星期欄位的城市才是 weekday_listed */
export function calendarConfidenceForCity(city: string): CalendarConfidence {
  if (WASTE.weekdayUnknownCities.value.includes(city)) return "weekday_unknown";
  if (WASTE.weekdayListedCities.value.includes(city)) return "weekday_listed";
  return "weekday_unverified";
}

function calendarPolicy(c: CalendarConfidence): "unknown" | "candidate" | "confirmed" {
  if (c === "weekday_unknown") return WASTE.weekdayUnknownPolicy.value;
  if (c === "weekday_unverified") return WASTE.weekdayUnverifiedPolicy.value;
  return "confirmed";
}

/** 某服務日的表定路線 → 停點 records（純函式） */
export function scheduleRoutesToRecords(
  routes: readonly WasteScheduleRoute[],
  serviceDateKey: string,
): WasteRecord[] {
  const serviceMidnight = taipeiMidnightMs(serviceDateKey) / 1000;
  const out: WasteRecord[] = [];
  for (const route of routes) {
    const calendarConfidence = calendarConfidenceForCity(route.city);
    for (const s of route.stops) {
      const stopStart = serviceMidnight + s.arrivalSec;
      const stopEnd = serviceMidnight + Math.max(s.departureSec, s.arrivalSec + WASTE.minAudibleDwellS.value);
      out.push({
        id: `waste:${serviceDateKey}:${route.city}:${route.routeId}:${s.stopSeq}:${s.stopId}`,
        family: "waste_collection",
        geometryKind: "point",
        payload: {
          city: route.city,
          routeId: route.routeId,
          routeName: route.routeName,
          stopId: s.stopId,
          stopName: s.stopName,
          lon: s.lng,
          lat: s.lat,
          serviceDateKey,
          serviceMidnight,
          arrivalSec: s.arrivalSec,
          departureSec: s.departureSec,
          stopStart,
          stopEnd,
          calendarConfidence,
          scheduleInferred: route.scheduleInferred,
        },
        validFrom: stopStart - WASTE.approachBufferS.value,
        validUntil: stopEnd,
        modelVersion: MODEL_VERSION,
        provenance: { provider: "waste_schedule_static", originalId: `${route.routeId}#${s.stopId}` },
        quality: { location: "geocoded", time: route.scheduleInferred ? "estimated" : "scheduled", emission: "unmeasured" },
        visibility: "public",
      });
    }
  }
  return out;
}

/**
 * 組合查詢日 D 的 records：D 當日表定全部＋D−1 表定中跨進 D 的停點。
 * D 當日停點若跨到 D+1 也保留（它屬於 D 的服務日，不會被 D+1 重算）。
 */
export function wasteRecordsForDate(
  dateKey: string,
  routesToday: readonly WasteScheduleRoute[],
  routesPrev: readonly WasteScheduleRoute[],
): WasteRecord[] {
  const dayStart = taipeiMidnightMs(dateKey) / 1000;
  const prevKey = shiftTaipeiDateKey(dateKey, -1);
  const prev = scheduleRoutesToRecords(routesPrev, prevKey).filter((r) => r.validUntil >= dayStart);
  return [...prev, ...scheduleRoutesToRecords(routesToday, dateKey)];
}

function isConfirmed(p: WastePayload): boolean {
  return p.calendarConfidence === "weekday_listed" && !p.scheduleInferred;
}

export function evaluateWaste(record: WasteRecord, t: number): SourceEvaluation {
  if (t < record.validFrom || t > record.validUntil) return { status: "inactive" };
  if (calendarPolicy(record.payload.calendarConfidence) === "unknown") {
    return { status: "unknown", reason: `calendar_${record.payload.calendarConfidence}` };
  }
  return { status: "active", geometry: { lon: record.payload.lon, lat: record.payload.lat, altitudeM: null }, relativeActivity: 1 };
}

const iso = (t: number) => new Date(t * 1000).toISOString();

export const queryWasteInterval: IntervalQuery<WastePayload> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution[] = [];
  const radius = WASTE.candidateRadiusM.value;
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    const d = haversineM(receiver.longitude, receiver.latitude, r.payload.lon, r.payload.lat);
    if (d > radius) continue;
    const p = r.payload;
    const notes = [
      `route:${p.routeName ?? p.routeId}`,
      `stop:${p.stopName ?? p.stopId}`,
      `calendar_confidence:${p.calendarConfidence}`,
      `schedule_inferred:${p.scheduleInferred}`,
      `service_date:${p.serviceDateKey}`,
      "scheduled_stop_only_no_gps_no_inter_stop_line",
    ];
    const unknownByCalendar = calendarPolicy(p.calendarConfidence) === "unknown";
    contributions.push({
      sourceId: r.id,
      family: "waste_collection",
      status: unknownByCalendar ? "unknown" : "active",
      ...(unknownByCalendar ? { unknownReason: `calendar_${p.calendarConfidence}` } : {}),
      sourceTime: iso(p.stopStart),
      spatialDistanceM: d,
      relativePotential: unknownByCalendar ? null : proximityPotential(d, WASTE.halfPotentialDistanceM.value),
      modeledDbA: null,
      evidence: isConfirmed(p) ? "scheduled" : "inferred",
      spatialPrecision: "scheduled_stop_point",
      temporalPrecision: p.scheduleInferred ? "schedule_inferred_times" : "timetable",
      acousticConfidence: "unmeasured",
      notes,
    });
  }
  return { contributions, notes: [] };
};

/** 讀 D 與 D−1 的 dow 表定。fetcher 可注入以便測試。
 *  ⚠️ 預設讀 22 城 × 2 個 dow（16 個分組檔）；UI 應依視野傳 cities。 */
export async function loadWaste(
  ctx: { date: string; cities?: string[] },
  fetcher: (cities: string[], dow: number) => Promise<WasteScheduleRoute[]> = fetchWasteScheduleDay,
): Promise<SoundSourceSet<WastePayload>> {
  const cities = ctx.cities ?? ALL_22_CITIES;
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const base: Omit<SourceCoverage, "status"> = {
    family: "waste_collection",
    provider: "waste_schedule_static",
    dateKey: ctx.date,
    windowStart: start,
    windowEnd: start + 86_400,
    temporalKind: "static_schedule",
  };
  try {
    const [today, prev] = await Promise.all([
      fetcher(cities, taipeiDow(ctx.date)),
      fetcher(cities, taipeiDow(shiftTaipeiDateKey(ctx.date, -1))),
    ]);
    const records = wasteRecordsForDate(ctx.date, today, prev);
    return {
      family: "waste_collection",
      dateKey: ctx.date,
      records,
      coverage: [{ ...base, status: records.length ? "ok" : "empty", reason: records.length ? undefined : "no_scheduled_stops" }],
    };
  } catch (e) {
    return { family: "waste_collection", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const wasteAdapter: SoundSourceAdapter<WastePayload> = {
  family: "waste_collection",
  load: loadWaste,
  evaluate: evaluateWaste,
  queryInterval: queryWasteInterval,
};
