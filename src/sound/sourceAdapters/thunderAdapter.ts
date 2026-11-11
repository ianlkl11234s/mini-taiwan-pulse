/**
 * 雷聲 adapter（N02，脈衝事件＋延遲傳播）。
 *
 * 資料：重用 lightningLoader.fetchLightningDay(dateKey, source)（get_lightning_day）。
 * - 預設讀 cwa＋taipower 兩源（THUNDER.sources）；jma 只涵蓋日本，不納入。
 *   2026-11 查核：cwa 近期筆數很少、taipower 有資料（與 loader 檔頭「台電 2026-07-10 起回空」
 *   的舊結論不同），所以兩源都讀，各自記 source_health。
 * - 每源各自 ok／empty／error；**某源空集合不等於無雷**（T07）。
 * - 同源以 source+event_id 去重；跨源時間 ±1 s 且距離 <1 km 建 possible-link，只計一次（T08）。
 * - intensity_ka 不換算聲壓。
 */
import {
  fetchLightningDay,
  type LightningSource,
  type LightningStrike,
} from "../../data/lightningLoader";
import { MODEL_VERSION, THUNDER } from "../model/soundProfiles";
import { haversineM } from "../engines/geometryDistance";
import { proximityPotential, thunderEnvelope } from "../engines/relativePotentialKernel";
import { thunderTiming } from "../engines/thunderDelayKernel";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import type {
  IntervalQuery,
  SoundSourceAdapter,
  SoundSourceRecord,
  SoundSourceSet,
  SourceContribution,
  SourceCoverage,
  SourceEvaluation,
} from "../types";

export interface ThunderPayload {
  source: LightningSource;
  eventId: number;
  flashTime: number;
  lon: number;
  lat: number;
  strikeType: number;
  /** possible-link 到的其他來源 record id（同一事件，只計一次） */
  linkedRecordIds: string[];
}

export type ThunderRecord = SoundSourceRecord<ThunderPayload>;

/** 任何接收者可能聽到的最晚時間 = 閃光 + 候選半徑傳播延遲 + envelope */
const maxActiveSpanS = () =>
  thunderTiming(0, THUNDER.candidateRadiusM.value).envelopeEndTime;

function strikeToRecord(source: LightningSource, s: LightningStrike): ThunderRecord {
  return {
    id: `thunder:${source}:${s.event_id}`,
    family: "thunder",
    geometryKind: "impulse_event",
    payload: { source, eventId: s.event_id, flashTime: s.strike_ts, lon: s.lon, lat: s.lat, strikeType: s.strike_type, linkedRecordIds: [] },
    validFrom: s.strike_ts,
    validUntil: s.strike_ts + maxActiveSpanS(),
    modelVersion: MODEL_VERSION,
    provenance: { provider: source, originalId: String(s.event_id), observedAt: s.strike_ts },
    quality: { location: "exact_observed", time: "observed", emission: "unmeasured" },
    visibility: "public",
  };
}

/**
 * 去重＋跨源 possible-link（純函式，順序依 sources 參數＝優先序）。
 * 回傳只含「代表」records；被連結者的 id 記在代表的 linkedRecordIds。
 */
export function dedupeAndLinkStrikes(
  bySource: ReadonlyArray<{ source: LightningSource; strikes: readonly LightningStrike[] }>,
): ThunderRecord[] {
  const seen = new Set<string>();
  const kept: ThunderRecord[] = [];
  const maxDt = THUNDER.possibleLinkMaxDtS.value;
  const maxD = THUNDER.possibleLinkMaxDistanceM.value;
  for (const { source, strikes } of bySource) {
    const fromThisSource: ThunderRecord[] = [];
    for (const s of strikes) {
      const key = `${source}|${s.event_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rec = strikeToRecord(source, s);
      const link = kept.find(
        (k) =>
          k.payload.source !== source &&
          Math.abs(k.payload.flashTime - rec.payload.flashTime) <= maxDt &&
          haversineM(k.payload.lon, k.payload.lat, rec.payload.lon, rec.payload.lat) < maxD,
      );
      if (link) link.payload.linkedRecordIds.push(rec.id);
      else fromThisSource.push(rec);
    }
    kept.push(...fromThisSource);
  }
  return kept.sort((a, b) => a.payload.flashTime - b.payload.flashTime);
}

export function evaluateThunder(record: ThunderRecord, t: number): SourceEvaluation {
  if (t < record.validFrom || t > record.validUntil) return { status: "inactive" };
  return {
    status: "active",
    geometry: { lon: record.payload.lon, lat: record.payload.lat, altitudeM: null },
    relativeActivity: 1,
  };
}

const iso = (t: number) => new Date(t * 1000).toISOString();

export const queryThunderInterval: IntervalQuery<ThunderPayload> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution[] = [];
  const radius = THUNDER.candidateRadiusM.value;
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    const d = haversineM(receiver.longitude, receiver.latitude, r.payload.lon, r.payload.lat);
    if (d > radius) continue;
    const timing = thunderTiming(r.payload.flashTime, d, null);
    // 區間 [t0,t1] 與聽到雷聲的 envelope [arrival, envelopeEnd] 重疊才算
    const from = Math.max(t0, timing.perceivedArrivalTime);
    const to = Math.min(t1, timing.envelopeEndTime);
    if (from > to) continue;
    const env = thunderEnvelope(from - timing.perceivedArrivalTime);
    const pot = proximityPotential(d, THUNDER.halfPotentialDistanceM.value) * env;
    if (pot <= 0) continue;
    const { distanceM: _d, ...thunderTimingOut } = timing;
    contributions.push({
      sourceId: r.id,
      family: "thunder",
      status: "active",
      sourceTime: iso(r.payload.flashTime),
      spatialDistanceM: d,
      relativePotential: pot,
      modeledDbA: null,
      evidence: "modeled",
      spatialPrecision: "strike_point_2d",
      temporalPrecision: "strike_ts_plus_modeled_delay",
      acousticConfidence: "proxy",
      propagationApproximation: "2d",
      thunderTiming: thunderTimingOut,
      notes: [
        `source:${r.payload.source}`,
        "idealized_point_event_constant_speed_of_sound",
        ...(r.payload.linkedRecordIds.length ? [`possible_link:${r.payload.linkedRecordIds.join(",")}`] : []),
      ],
    });
  }
  return { contributions, notes: [] };
};

/** 讀多源；每源各自 coverage（ok／empty／error）。fetcher 可注入以便測試。 */
export async function loadThunder(
  ctx: { date: string },
  fetcher: (date: string, source: LightningSource) => Promise<LightningStrike[]> = fetchLightningDay,
  sources: readonly LightningSource[] = THUNDER.sources.value,
): Promise<SoundSourceSet<ThunderPayload>> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const settled = await Promise.allSettled(sources.map((s) => fetcher(ctx.date, s)));
  const coverage: SourceCoverage[] = [];
  const bySource: { source: LightningSource; strikes: LightningStrike[] }[] = [];
  settled.forEach((res, i) => {
    const source = sources[i]!;
    const base = { family: "thunder" as const, provider: source, dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
    if (res.status === "rejected") {
      coverage.push({ ...base, status: "error", reason: String(res.reason) });
      return;
    }
    const strikes = res.value ?? [];
    coverage.push(
      strikes.length
        ? { ...base, status: "ok" }
        : { ...base, status: "empty", reason: "source_returned_empty_set_cannot_distinguish_no_strikes_from_outage" },
    );
    bySource.push({ source, strikes });
  });
  return { family: "thunder", dateKey: ctx.date, records: dedupeAndLinkStrikes(bySource), coverage };
}

export const thunderAdapter: SoundSourceAdapter<ThunderPayload> = {
  family: "thunder",
  load: loadThunder,
  evaluate: evaluateThunder,
  queryInterval: queryThunderInterval,
};
