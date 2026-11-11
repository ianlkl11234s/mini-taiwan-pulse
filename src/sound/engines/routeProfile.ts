/**
 * 路線剖面（移動接收者，計畫 §6.2 route_profile、§8C）。純函式，不 import React／timeStore。
 *
 * 規則：
 * - 沿 LineString 依**距離等距**取樣（ROUTE.sampleSpacingM，含起點與終點）；點數超過 maxSamples 時加大間距，不截斷路線。
 * - 每點時間 = 出發時間 + 累積距離 ÷ 速度（**不可每點共用同一時間**）。速度由移動模式決定（步行 1.3、自行車 4 m/s，
 *   custom 由呼叫端給），等速假設，不含停等。
 * - 每點呼叫 queryReceiver（瞬時查詢）。跨午夜的路線：呼叫端要把兩天的來源集合都傳進來，
 *   引擎依各來源 coverage 時間窗自動挑對的那天；只傳一天 → 過午夜的點 unavailable，不會當 0。
 * - 輸出是「沿途主要接觸哪些聲源」，**不是噪音暴露量**（未校準，不累加成劑量）。
 */
import { MODEL_VERSION, ROUTE, type RouteMode } from "../model/soundProfiles";
import { haversineM } from "./geometryDistance";
import { queryReceiver, SOUND_FAMILIES } from "./receiverQuery";
import type { AnySoundFamily, SoundSourceFamily, FamilyResult, FamilyStatus, SoundSourceSet, SourceContribution } from "../types";

export interface RouteProfileOptions<F extends AnySoundFamily> {
  mode: RouteMode;
  /** mode=custom 必填（m/s）；其他模式忽略 */
  speedMps?: number;
  sampleSpacingM?: number;
  families?: readonly F[];
  /** 接收者耳高（m），預設沿用 COMMON.receiverDefaultHeightM（由 queryReceiver 端處理） */
  heightM?: number;
}

export interface RouteSample<F extends AnySoundFamily> {
  index: number;
  distanceM: number;
  unixSeconds: number;
  lon: number;
  lat: number;
  families: FamilyResult<F>[];
  /** 此點相對潛勢最高的 active 來源；沒有 → null */
  dominant: { family: F; sourceId: string; relativePotential: number } | null;
}

export interface RouteFamilySeries<F extends AnySoundFamily> {
  family: F;
  values: (number | null)[];
  statuses: FamilyStatus[];
  unknownRatio: number;
}

export interface RouteProfile<F extends AnySoundFamily> {
  modelVersion: string;
  mode: RouteMode;
  speedMps: number;
  speedAssumption: string;
  departUnix: number;
  arriveUnix: number;
  totalDistanceM: number;
  sampleSpacingM: number;
  samples: RouteSample<F>[];
  families: RouteFamilySeries<F>[];
  /** 沿途各家族 active 點數（主要接觸哪些聲源）；不是暴露量 */
  activeSampleCount: Record<string, number>;
}

export function resolveSpeed(mode: RouteMode, speedMps?: number): number {
  if (mode === "custom") {
    if (speedMps == null || !Number.isFinite(speedMps) || speedMps <= 0) throw new Error("custom mode requires a positive speedMps");
    return speedMps;
  }
  return ROUTE.speedMps.value[mode];
}

/** 沿線等距取樣點（含起終點）：回 [lon, lat, 累積距離] */
export function sampleLineByDistance(coords: readonly (readonly number[])[], spacingM: number): [number, number, number][] {
  if (coords.length < 2) throw new Error("route needs at least 2 coordinates");
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1]! + haversineM(coords[i - 1]![0]!, coords[i - 1]![1]!, coords[i]![0]!, coords[i]![1]!));
  const total = cum[cum.length - 1]!;
  const targets: number[] = [];
  for (let d = 0; d < total; d += spacingM) targets.push(d);
  targets.push(total);
  const out: [number, number, number][] = [];
  let seg = 0;
  for (const d of targets) {
    while (seg < coords.length - 2 && cum[seg + 1]! < d) seg++;
    const a = coords[seg]!;
    const b = coords[seg + 1]!;
    const L = cum[seg + 1]! - cum[seg]!;
    const f = L > 0 ? Math.min(1, Math.max(0, (d - cum[seg]!) / L)) : 0;
    // 數十公尺內線性內插經緯度，誤差遠小於來源定位精度
    out.push([a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f, d]);
  }
  return out;
}

export function routeProfile<F extends AnySoundFamily = SoundSourceFamily>(
  line: GeoJSON.LineString | readonly (readonly number[])[],
  departUnix: number,
  sets: readonly SoundSourceSet<unknown, AnySoundFamily>[],
  opts: RouteProfileOptions<F>,
): RouteProfile<F> {
  const coords = Array.isArray(line) ? (line as readonly (readonly number[])[]) : (line as GeoJSON.LineString).coordinates;
  const speed = resolveSpeed(opts.mode, opts.speedMps);
  const families = (opts.families ?? (SOUND_FAMILIES as readonly AnySoundFamily[])) as readonly F[];
  let spacing = opts.sampleSpacingM ?? ROUTE.sampleSpacingM.value;
  if (!(spacing > 0)) throw new Error("sampleSpacingM must be > 0");
  let pts = sampleLineByDistance(coords, spacing);
  const maxN = ROUTE.maxSamples.value;
  if (pts.length > maxN) {
    spacing = pts[pts.length - 1]![2] / (maxN - 1);
    pts = sampleLineByDistance(coords, spacing);
  }
  const samples: RouteSample<F>[] = pts.map(([lon, lat, d], index) => {
    const t = departUnix + d / speed;
    const q = queryReceiver<F>({ id: `route:${index}`, longitude: lon, latitude: lat, heightM: opts.heightM, environment: "outdoor" }, t, sets, families);
    const top = q.contributions.find((c: SourceContribution<F>) => c.status === "active" && (c.relativePotential ?? 0) > 0);
    return {
      index,
      distanceM: d,
      unixSeconds: t,
      lon,
      lat,
      families: q.families,
      dominant: top ? { family: top.family, sourceId: top.sourceId, relativePotential: top.relativePotential! } : null,
    };
  });
  const series = families.map((family): RouteFamilySeries<F> => {
    const rs = samples.map((s) => s.families.find((f) => f.family === family)!);
    const statuses = rs.map((r) => r.status);
    const unknownCount = statuses.filter((s) => s === "unknown" || s === "unavailable").length;
    return { family, values: rs.map((r) => r.relativePotential), statuses, unknownRatio: samples.length ? unknownCount / samples.length : 0 };
  });
  const activeSampleCount: Record<string, number> = {};
  for (const s of series) activeSampleCount[s.family] = s.statuses.filter((x) => x === "active").length;
  const total = pts[pts.length - 1]![2];
  return {
    modelVersion: MODEL_VERSION,
    mode: opts.mode,
    speedMps: speed,
    speedAssumption: ROUTE.speedMps.assumption,
    departUnix,
    arriveUnix: departUnix + total / speed,
    totalDistanceM: total,
    sampleSpacingM: spacing,
    samples,
    families: series,
    activeSampleCount,
  };
}
