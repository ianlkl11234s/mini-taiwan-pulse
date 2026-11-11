/**
 * 道路車流：臺北市 VD「平日典型值」（family 沿用 road_traffic；決策見 MODEL_DECISIONS「典型車流」）。
 *
 * - 資料：public/sound-atlas/vd-baseline-taipei.json（build-sound-vd-baseline.py；2025-12-26～2026-01-14 平日、
 *   有效流量約 8 天）。每 VD 24 小時流量中位數（輛／小時）＋樣本天數。
 * - **這是歷史期間的典型值，不是當日觀測**：evidence=estimated、proxyKind=typical_weekday_volume，UI 必須照寫。
 * - 只有「臺北市平日」套用：週末、國定假日（TYPICAL_TRAFFIC.nonWorkdays）、異常日（anomalyDays，例：颱風）、
 *   放假日表範圍外 → unknown「無可靠典型值」，不退回 0、不退回國道 proxy。
 * - 流量 null 或樣本天數不足 → unknown（不當 0）；典型流量真的是 0（夜間無車）→ 不產生貢獻（＝0，資料有效）。
 * - 無座標 VD 不建 record（不合成座標）。
 */
import { withLoading } from "../../lib/loadingRegistry";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { MODEL_VERSION, TYPICAL_TRAFFIC } from "../model/soundProfiles";
import { haversineM } from "../engines/geometryDistance";
import { proximityPotential } from "../engines/relativePotentialKernel";
import type { Receiver, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceCoverage } from "../types";

export interface VdBaselineEntry {
  id: string;
  road: string | null;
  lanes?: number | null;
  lon: number;
  lat: number;
  /** 平日每小時典型流量（輛／小時）；null＝該小時無有效流量 */
  wd_flow: (number | null)[];
  wd_flow_days: number[];
  wd_speed: (number | null)[];
}

export interface VdBaselineFile {
  meta: { period?: { start: string; end: string }; weekday_flow_days_median?: number; [k: string]: unknown };
  vds: VdBaselineEntry[];
}

export type TypicalTrafficPayload =
  | { kind: "vd_typical"; vdId: string; road: string | null; lon: number; lat: number; flow: (number | null)[]; flowDays: number[] }
  | { kind: "vd_not_applicable"; vdId: string; road: string | null; lon: number; lat: number; reason: string };

export type TypicalTrafficRecord = SoundSourceRecord<TypicalTrafficPayload, "road_traffic">;

export const VD_TYPICAL_PROVIDER = "vd_typical_taipei";
export const VD_NOT_APPLICABLE_ID = "road_traffic:vd_typical_not_applicable";

export function isTypicalTrafficRecord(r: SoundSourceRecord<unknown, "road_traffic">): r is TypicalTrafficRecord {
  const k = (r.payload as { kind?: unknown } | null)?.kind;
  return k === "vd_typical" || k === "vd_not_applicable";
}

/** 該日能否套用平日典型值；不能時回機器可讀原因 */
export function typicalDayVerdict(date: string): { applies: true } | { applies: false; reason: string } {
  const anomaly = TYPICAL_TRAFFIC.anomalyDays.value[date];
  if (anomaly) return { applies: false, reason: "anomaly_day" };
  const cov = TYPICAL_TRAFFIC.calendarCoverage.value;
  if (date < cov.start || date > cov.end) return { applies: false, reason: "calendar_not_covered" };
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return { applies: false, reason: "weekend" };
  if (TYPICAL_TRAFFIC.nonWorkdays.value.includes(date)) return { applies: false, reason: "national_holiday" };
  return { applies: true };
}

export function vdBaselineToRecords(file: VdBaselineFile, date: string): TypicalTrafficRecord[] {
  const start = taipeiMidnightMs(date) / 1000;
  const verdict = typicalDayVerdict(date);
  const out: TypicalTrafficRecord[] = [];
  for (const v of file.vds) {
    if (!Number.isFinite(v.lon) || !Number.isFinite(v.lat)) continue; // 無座標 → 剔除，不合成
    const common = { vdId: v.id, road: v.road ?? null, lon: v.lon, lat: v.lat };
    out.push({
      id: `road_traffic:vd:${v.id}`,
      family: "road_traffic",
      geometryKind: "point",
      payload: verdict.applies
        ? { kind: "vd_typical", ...common, flow: v.wd_flow, flowDays: v.wd_flow_days }
        : { kind: "vd_not_applicable", ...common, reason: verdict.reason },
      validFrom: start,
      validUntil: start + 86_400,
      modelVersion: MODEL_VERSION,
      provenance: { provider: VD_TYPICAL_PROVIDER, originalId: v.id },
      quality: { location: "exact_observed", time: "estimated", emission: "proxy" },
      visibility: "public",
    });
  }
  return out;
}

/** 臺灣當地小時（0–23） */
const taipeiHour = (t: number) => new Date((t + 8 * 3600) * 1000).getUTCHours();
const iso = (t: number) => new Date(t * 1000).toISOString();

/** 時間 t 該 VD 的典型流量；null＝缺值或樣本不足（不是 0） */
export function typicalFlowAt(p: Extract<TypicalTrafficPayload, { kind: "vd_typical" }>, t: number): { vehPerHour: number; days: number } | { missing: "flow_null" | "sample_insufficient" } {
  const h = taipeiHour(t);
  const q = p.flow[h];
  if (q == null || !Number.isFinite(q)) return { missing: "flow_null" };
  const days = p.flowDays[h] ?? 0;
  if (days < TYPICAL_TRAFFIC.minFlowDays.value) return { missing: "sample_insufficient" };
  return { vehPerHour: q, days };
}

export const typicalVolumePotential = (q: number) => 1 - Math.exp(-Math.max(0, q) / TYPICAL_TRAFFIC.volumeScaleVehPerHour.value);

export function vdWithinRadius(r: TypicalTrafficRecord, receiver: Receiver): number | null {
  const d = haversineM(receiver.longitude, receiver.latitude, r.payload.lon, r.payload.lat);
  return d <= TYPICAL_TRAFFIC.candidateRadiusM.value ? d : null;
}

/** 區間查詢：區間涵蓋的各小時取最大典型流量 */
export function queryTypicalTrafficInterval(
  records: readonly TypicalTrafficRecord[],
  receiver: Receiver,
  t0: number,
  t1: number,
): { contributions: SourceContribution<"road_traffic">[]; notes: string[] } {
  const contributions: SourceContribution<"road_traffic">[] = [];
  let notApplicable: { d: number; reason: string } | null = null;
  const half = TYPICAL_TRAFFIC.halfPotentialDistanceM.value;
  const period = TYPICAL_TRAFFIC.baselinePeriod.value;
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    const d = vdWithinRadius(r, receiver);
    if (d == null) continue;
    const p = r.payload;
    if (p.kind === "vd_not_applicable") {
      if (!notApplicable || d < notApplicable.d) notApplicable = { d, reason: p.reason };
      continue;
    }
    const base = {
      sourceId: r.id,
      family: "road_traffic" as const,
      spatialDistanceM: d,
      modeledDbA: null,
      evidence: "estimated" as const,
      spatialPrecision: "vd_point",
      proxyKind: "typical_weekday_volume" as const,
    };
    let best: { vehPerHour: number; days: number; t: number } | null = null;
    let missing: string | null = null;
    const ta = Math.max(t0, r.validFrom);
    const tb = Math.min(t1, r.validUntil);
    for (let t = ta; ; t = Math.min(tb, (Math.floor((t + 8 * 3600) / 3600) + 1) * 3600 - 8 * 3600)) {
      const v = typicalFlowAt(p, t);
      if ("missing" in v) missing ??= v.missing;
      else if (!best || v.vehPerHour > best.vehPerHour) best = { ...v, t };
      if (t >= tb) break;
    }
    const notes = [`vd:${p.vdId}`, `road:${p.road ?? ""}`, `baseline:${period.start}..${period.end}(weekday)`, "typical_value_not_same_day_observation"];
    if (!best) {
      contributions.push({
        ...base, status: "unknown", unknownReason: `typical_${missing ?? "flow_null"}`, sourceTime: iso(ta), relativePotential: null,
        temporalPrecision: "typical_weekday_hourly", acousticConfidence: "unmeasured", notes,
      });
      continue;
    }
    if (best.vehPerHour <= 0) continue; // 典型流量 0＝該時段通常無車（有效值），不產生貢獻
    contributions.push({
      ...base,
      status: "active",
      sourceTime: iso(best.t),
      relativePotential: proximityPotential(d, half) * typicalVolumePotential(best.vehPerHour),
      temporalPrecision: "typical_weekday_hourly",
      acousticConfidence: "proxy",
      notes: [...notes, `typical_veh_per_hour:${best.vehPerHour}`, `flow_days:${best.days}`],
    });
  }
  if (notApplicable && contributions.length === 0) {
    contributions.push({
      sourceId: VD_NOT_APPLICABLE_ID,
      family: "road_traffic",
      status: "unknown",
      unknownReason: `typical_not_applicable(${notApplicable.reason})`,
      sourceTime: iso(t0),
      spatialDistanceM: notApplicable.d,
      relativePotential: null,
      modeledDbA: null,
      evidence: "estimated",
      spatialPrecision: "vd_point",
      temporalPrecision: "none(typical_not_applicable)",
      acousticConfidence: "unmeasured",
      proxyKind: "typical_weekday_volume",
      notes: [`typical_not_applicable:${notApplicable.reason}`],
    });
  }
  return { contributions, notes: [] };
}

export async function loadTypicalTraffic(
  ctx: { date: string },
  fetcher: () => Promise<VdBaselineFile> = fetchVdBaseline,
): Promise<SoundSourceSet<TypicalTrafficPayload, "road_traffic">> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const verdict = typicalDayVerdict(ctx.date);
  const base = { family: "road_traffic" as const, provider: VD_TYPICAL_PROVIDER, dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "static_schedule" as const };
  try {
    const file = await fetcher();
    const records = vdBaselineToRecords(file, ctx.date);
    const cov: SourceCoverage<"road_traffic"> = {
      ...base,
      status: records.length ? "ok" : "empty",
      reason: verdict.applies ? "typical_weekday_baseline" : `typical_not_applicable:${verdict.reason}`,
    };
    return { family: "road_traffic", dateKey: ctx.date, records, coverage: [cov] };
  } catch (e) {
    return { family: "road_traffic", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

let filePromise: Promise<VdBaselineFile> | null = null;
export function fetchVdBaseline(): Promise<VdBaselineFile> {
  filePromise ??= withLoading(
    "sound:vd-baseline",
    "臺北 VD 典型車流",
    fetch(TYPICAL_TRAFFIC.assetUrl.value).then((r) => {
      if (!r.ok) throw new Error(`vd baseline HTTP ${r.status}`);
      return r.json() as Promise<VdBaselineFile>;
    }),
  ).catch((e) => {
    filePromise = null;
    throw e;
  });
  return filePromise;
}
