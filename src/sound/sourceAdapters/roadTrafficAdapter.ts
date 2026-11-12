/**
 * 道路車流 adapter（T01，線聲源；W6-2 起改為「路網＋當日國道 VD」單一 record）。
 *
 * 估計規則全部在 src/sound/grid/roadNetwork.ts（網格、接收點、格 popup 共用同一支）：
 * 國道當日實測／臺北 VD 典型沿路延伸（假設）／新北等級推估三級，有路但沒資料＝無法判斷，離道路遠＝0。
 * 決策與假設見 docs/features/city-sound-atlas/MODEL_DECISIONS.md §8。
 *
 * 集合形狀：records＝[一筆 road_network record]（payload 帶編譯後路網與當日流量脈絡）；
 * coverage＝一筆 provider sound_road_network（路網讀不到 → error → 家族無法判斷）。
 * 國道每日包缺、臺北非平日等「部分來源不可用」不影響 coverage，而是在估計裡變成無法判斷的候選。
 */
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { MODEL_VERSION } from "../model/soundProfiles";
import {
  fetchFreewayVdPack, fetchRoadNetwork, makeRoadDayContext, nearRoadSources, roadEstimateFromNear,
  type FreewayVdPack, type NearRoads, type RoadDayContext, type RoadEstimate, type RoadNetwork, type RoadSource,
} from "../grid/roadNetwork";
import type { IntervalQuery, SoundSourceAdapter, SoundSourceRecord, SoundSourceSet, SourceContribution } from "../types";
import { fetchVdBaseline, type VdBaselineFile } from "./typicalTrafficAdapter";

export interface RoadNetworkPayload {
  kind: "road_network";
  net: RoadNetwork;
  ctx: RoadDayContext;
}

export type RoadNetworkRecord = SoundSourceRecord<RoadNetworkPayload, "road_traffic">;
/** 舊名保留給既有呼叫端（型別即路網 record） */
export type RoadTrafficPayload = RoadNetworkPayload;

export const ROAD_TRAFFIC_PROVIDER = "sound_road_network";
const SOURCE_PREFIX = "road_traffic:";

export function isRoadNetworkRecord(r: SoundSourceRecord<unknown, "road_traffic">): r is RoadNetworkRecord {
  return (r.payload as { kind?: unknown } | null)?.kind === "road_network";
}

export function roadNetworkRecord(net: RoadNetwork, ctx: RoadDayContext): RoadNetworkRecord {
  return {
    id: `${SOURCE_PREFIX}network:${ctx.dateKey}`,
    family: "road_traffic",
    geometryKind: "line",
    payload: { kind: "road_network", net, ctx },
    validFrom: ctx.dayStart,
    validUntil: ctx.dayStart + 86_400,
    modelVersion: MODEL_VERSION,
    provenance: { provider: ROAD_TRAFFIC_PROVIDER, originalId: ctx.dateKey },
    quality: { location: "exact_observed", time: "estimated", emission: "proxy" },
    visibility: "public",
  };
}

// 同一點反覆查（24h 構成 144 格）只算一次候選
const nearCache = new WeakMap<RoadNetwork, Map<string, NearRoads>>();
export function nearRoadsCached(net: RoadNetwork, lon: number, lat: number): NearRoads {
  let m = nearCache.get(net);
  if (!m) nearCache.set(net, (m = new Map()));
  const k = `${lon},${lat}`;
  let v = m.get(k);
  if (!v) {
    if (m.size > 256) m.clear();
    v = nearRoadSources(net, lon, lat);
    m.set(k, v);
  }
  return v;
}

/** 單點估計（網格點格 popup 與 queryInterval 共用） */
export function roadTrafficEstimateAt(rec: RoadNetworkRecord, lon: number, lat: number, t0: number, t1: number): RoadEstimate {
  const { net, ctx } = rec.payload;
  return roadEstimateFromNear(net, ctx, nearRoadsCached(net, lon, lat), t0, t1);
}

const iso = (t: number) => new Date(t * 1000).toISOString();

const PROXY_KIND = { observed: "observed_volume", estimated: "typical_weekday_volume", inferred: "road_type_no_volume" } as const;
const SPATIAL = { freeway: "freeway_section_by_vd_mileage", taipei: "vd_extended_along_road(assumption)", taipei_uncovered: "road_without_vd", estimate: "osm_road_class" } as const;
const TEMPORAL = { observed: "vd_1min_sample_per_10min", estimated: "typical_weekday_hourly", inferred: "none(road_class_static)" } as const;

function sourceNotes(s: RoadSource): string[] {
  const n: string[] = [`road_kind:${s.kind}`];
  if (s.name) n.push(`road:${s.name}${s.dir ? `(${s.dir})` : ""}`);
  if (s.vdId) n.push(`vd:${s.vdId}`);
  if (s.cls) n.push(`road_class:${s.cls}`);
  return n;
}

/** 估計 → 引擎的貢獻清單（潛勢 >0 的已知來源、各無法判斷候選；潛勢 0 的已知來源不列＝有效的 0） */
export function roadEstimateContributions(net: RoadNetwork, est: RoadEstimate, t0: number): SourceContribution<"road_traffic">[] {
  const out: SourceContribution<"road_traffic">[] = [];
  for (const p of est.parts) {
    const s = net.sources[p.source]!;
    const base = {
      sourceId: `${SOURCE_PREFIX}${p.source}`,
      family: "road_traffic" as const,
      spatialDistanceM: p.distanceM,
      modeledDbA: null,
      spatialPrecision: SPATIAL[s.kind],
    };
    if (p.flow.known) {
      if (!(p.potential! > 0)) continue;
      out.push({
        ...base,
        status: "active",
        sourceTime: iso(p.flow.sampleT ?? t0),
        relativePotential: p.potential,
        evidence: p.flow.evidence,
        temporalPrecision: TEMPORAL[p.flow.evidence],
        acousticConfidence: "proxy",
        proxyKind: PROXY_KIND[p.flow.evidence],
        notes: [...sourceNotes(s), `veh_per_hour:${p.flow.vehPerHour ?? ""}`, ...(p.flow.flowDays != null ? [`flow_days:${p.flow.flowDays}`] : [])],
      });
    } else {
      out.push({
        ...base,
        status: "unknown",
        unknownReason: p.flow.reason,
        sourceTime: iso(t0),
        relativePotential: null,
        evidence: p.flow.evidence ?? "inferred",
        temporalPrecision: "none",
        acousticConfidence: "unmeasured",
        ...(p.flow.evidence ? { proxyKind: PROXY_KIND[p.flow.evidence] } : {}),
        notes: sourceNotes(s),
      });
    }
  }
  if (est.minor) {
    out.push({
      sourceId: `${SOURCE_PREFIX}minor_roads`,
      family: "road_traffic",
      status: "unknown",
      unknownReason: "minor_road_no_data",
      sourceTime: iso(t0),
      spatialDistanceM: null,
      relativePotential: null,
      modeledDbA: null,
      evidence: "inferred",
      spatialPrecision: "grid_cell_250m",
      temporalPrecision: "none",
      acousticConfidence: "unmeasured",
      notes: ["minor_streets_in_cell_no_volume_data"],
    });
  }
  return out;
}

export const queryRoadTrafficInterval: IntervalQuery<RoadNetworkPayload, "road_traffic"> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution<"road_traffic">[] = [];
  for (const r of records) {
    if (!isRoadNetworkRecord(r) || r.validUntil < t0 || r.validFrom > t1) continue;
    const est = roadTrafficEstimateAt(r, receiver.longitude, receiver.latitude, t0, t1);
    contributions.push(...roadEstimateContributions(r.payload.net, est, t0));
  }
  return { contributions, notes: [] };
};

/** 貢獻 sourceId → 路段座標（接收點連線／路段光暈用）；不是路段 → null */
export function roadContributionLine(records: readonly SoundSourceRecord<unknown, "road_traffic">[], sourceId: string): { coords: [number, number][]; label: string } | null {
  const m = /^road_traffic:(\d+)$/.exec(sourceId);
  if (!m) return null;
  const rec = records.find(isRoadNetworkRecord);
  const s = rec?.payload.net.sources[Number(m[1])];
  if (!s) return null;
  const coords: [number, number][] = [];
  for (let i = 0; i < s.flat.length; i += 2) coords.push([s.flat[i]!, s.flat[i + 1]!]);
  return { coords, label: s.name ?? s.vdId ?? s.cls ?? s.kind };
}

export interface RoadTrafficFetchers {
  network: () => Promise<RoadNetwork>;
  pack: (date: string) => Promise<FreewayVdPack | null>;
  baseline: () => Promise<VdBaselineFile>;
}

const liveFetchers: RoadTrafficFetchers = {
  network: () => fetchRoadNetwork(),
  pack: (d) => fetchFreewayVdPack(d),
  baseline: () => fetchVdBaseline(),
};

export async function loadRoadTraffic(ctx: { date: string }, f: RoadTrafficFetchers = liveFetchers): Promise<SoundSourceSet<RoadNetworkPayload, "road_traffic">> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const base = { family: "road_traffic" as const, provider: ROAD_TRAFFIC_PROVIDER, dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
  try {
    const [net, pack, baseline] = await Promise.all([
      f.network(),
      f.pack(ctx.date),
      f.baseline().catch(() => ({ meta: {}, vds: [] }) as VdBaselineFile),
    ]);
    const dctx = makeRoadDayContext(ctx.date, start, pack, baseline.vds);
    const reason = [
      pack ? "freeway_vd_day_ok" : "freeway_vd_day_missing",
      dctx.typical.applies ? "taipei_typical_applies" : `taipei_typical_not_applicable:${dctx.typical.reason}`,
      baseline.vds.length ? "" : "taipei_baseline_missing",
    ].filter(Boolean).join(";");
    return { family: "road_traffic", dateKey: ctx.date, records: [roadNetworkRecord(net, dctx)], coverage: [{ ...base, status: "ok", reason }] };
  } catch (e) {
    return { family: "road_traffic", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const roadTrafficAdapter: SoundSourceAdapter<RoadNetworkPayload, "road_traffic"> = {
  family: "road_traffic",
  load: (c) => loadRoadTraffic(c),
  // 路網是整片線聲源的集合，沒有單一位置；位置與潛勢只經 queryInterval（接收點）或網格
  evaluate: () => ({ status: "inactive" }),
  queryInterval: queryRoadTrafficInterval,
};
