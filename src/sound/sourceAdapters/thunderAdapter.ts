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
import { clipCoverageEnd } from "../engines/coverageWindow";
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
  /** 原始事件 id 字串（CWA event_id 會超過 2^53，數字會失真，一律以字串比對） */
  eventId: string;
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

/** 事件 id：優先用 event_id_str（>2^53 時 number 已失真），否則 String(event_id) */
export const strikeEventId = (s: LightningStrike): string => s.event_id_str ?? String(s.event_id);

function strikeToRecord(source: LightningSource, s: LightningStrike): ThunderRecord {
  const eventId = strikeEventId(s);
  return {
    id: `thunder:${source}:${eventId}`,
    family: "thunder",
    geometryKind: "impulse_event",
    payload: { source, eventId, flashTime: s.strike_ts, lon: s.lon, lat: s.lat, strikeType: s.strike_type, linkedRecordIds: [] },
    validFrom: s.strike_ts,
    validUntil: s.strike_ts + maxActiveSpanS(),
    modelVersion: MODEL_VERSION,
    provenance: { provider: source, originalId: eventId, observedAt: s.strike_ts },
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
  // kept 永遠依 flashTime 排序；跨源比對只看 ±maxDt 視窗（雷雨季單源可達數萬筆，避免 O(n×m)）
  let kept: ThunderRecord[] = [];
  const maxDt = THUNDER.possibleLinkMaxDtS.value;
  const maxD = THUNDER.possibleLinkMaxDistanceM.value;
  const lowerBound = (ts: number) => {
    let lo = 0;
    let hi = kept.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (kept[mid]!.payload.flashTime < ts) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  for (const { source, strikes } of bySource) {
    const fromThisSource: ThunderRecord[] = [];
    for (const s of strikes) {
      const key = `${source}|${strikeEventId(s)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rec = strikeToRecord(source, s);
      let link: ThunderRecord | undefined;
      for (let i = lowerBound(rec.payload.flashTime - maxDt); i < kept.length; i++) {
        const k = kept[i]!;
        if (k.payload.flashTime > rec.payload.flashTime + maxDt) break;
        if (k.payload.source !== source && haversineM(k.payload.lon, k.payload.lat, rec.payload.lon, rec.payload.lat) < maxD) {
          link = k;
          break;
        }
      }
      if (link) link.payload.linkedRecordIds.push(rec.id);
      else fromThisSource.push(rec);
    }
    kept = [...kept, ...fromThisSource].sort((a, b) => a.payload.flashTime - b.payload.flashTime);
  }
  return kept;
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

/** 單一來源的讀取結果（即時 RPC 或場景快照的 health 都轉成這個） */
export type ThunderSourceResult =
  | { source: LightningSource; status: "ok" | "empty"; strikes: readonly LightningStrike[]; reason?: string }
  | { source: LightningSource; status: "error"; reason: string };

/**
 * 各源結果 → SoundSourceSet。status 由呼叫端決定（不以筆數重判）：
 * 場景快照只留接收點附近的事件，health=ok 但 0 筆 ＝ 附近真的沒雷（inactive），不是 empty。
 */
export function thunderSetFromResults(
  ctx: { date: string; nowUnix?: number },
  results: readonly ThunderSourceResult[],
): SoundSourceSet<ThunderPayload> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  // 今天：涵蓋窗只到現在；落雷稀疏，無法以最後一筆判斷收集進度
  const windowEnd = clipCoverageEnd(start, ctx.nowUnix ?? Date.now() / 1000);
  const coverage: SourceCoverage[] = [];
  const bySource: { source: LightningSource; strikes: readonly LightningStrike[] }[] = [];
  for (const r of results) {
    const base = { family: "thunder" as const, provider: r.source, dateKey: ctx.date, windowStart: start, windowEnd, temporalKind: "day_series" as const };
    coverage.push(r.reason ? { ...base, status: r.status, reason: r.reason } : { ...base, status: r.status });
    if (r.status !== "error") bySource.push({ source: r.source, strikes: r.strikes });
  }
  return { family: "thunder", dateKey: ctx.date, records: dedupeAndLinkStrikes(bySource), coverage };
}

/** 即時讀多源：拿到資料 → ok、空集合 → empty（無法區分無雷與斷供）、失敗 → error */
export async function fetchThunderSourceResults(
  date: string,
  fetcher: (date: string, source: LightningSource) => Promise<LightningStrike[]>,
  sources: readonly LightningSource[],
): Promise<ThunderSourceResult[]> {
  const settled = await Promise.allSettled(sources.map((s) => fetcher(date, s)));
  return settled.map((res, i): ThunderSourceResult => {
    const source = sources[i]!;
    if (res.status === "rejected") return { source, status: "error", reason: String(res.reason) };
    const strikes = res.value ?? [];
    return strikes.length
      ? { source, status: "ok", strikes }
      : { source, status: "empty", strikes, reason: "source_returned_empty_set_cannot_distinguish_no_strikes_from_outage" };
  });
}

/** 讀多源；每源各自 coverage（ok／empty／error）。fetcher 可注入以便測試。 */
export async function loadThunder(
  ctx: { date: string; nowUnix?: number },
  fetcher: (date: string, source: LightningSource) => Promise<LightningStrike[]> = fetchLightningDay,
  sources: readonly LightningSource[] = THUNDER.sources.value,
): Promise<SoundSourceSet<ThunderPayload>> {
  return thunderSetFromResults(ctx, await fetchThunderSourceResults(ctx.date, fetcher, sources));
}

export const thunderAdapter: SoundSourceAdapter<ThunderPayload> = {
  family: "thunder",
  load: loadThunder,
  evaluate: evaluateThunder,
  queryInterval: queryThunderInterval,
};
