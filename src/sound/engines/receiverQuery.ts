/**
 * 接收者查詢（純函式，不 import React／timeStore；時間由呼叫端傳 unix 秒）。
 *
 * 流程（每個家族）：
 *   1. coverage gate：查詢時間不在任何來源涵蓋窗內 → unavailable（例：歷史日只有最新快照，T12）；
 *      涵蓋窗內沒有任何 status=ok 的來源 → unknown（例：落雷各源皆空／錯誤，T07）。
 *   2. 只把 status=ok 來源的 records 交給 adapter 的區間查詢（只回半徑內候選）。
 *   3. 有任何 active 貢獻 → active（潛勢取最大）；否則有 unknown 候選 → unknown（null）；
 *      否則 inactive（0）。unknown／unavailable 一律 null，不會被顯示成 0／安靜（T18）。
 */
import { MODEL_VERSION, PROFILE } from "../model/soundProfiles";
import { aviationAdapter } from "../sourceAdapters/aviationAdapter";
import { rainFieldAdapter } from "../sourceAdapters/rainFieldAdapter";
import { thunderAdapter } from "../sourceAdapters/thunderAdapter";
import { wasteAdapter } from "../sourceAdapters/wasteAdapter";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import type {
  FamilyResult,
  FamilyStatus,
  IntervalQuery,
  Receiver,
  SoundSourceFamily,
  SoundSourceRecord,
  SoundSourceSet,
  SourceContribution,
} from "../types";

export const SOUND_FAMILIES: readonly SoundSourceFamily[] = ["aviation", "rain", "thunder", "waste_collection"];

const QUERIES: Record<SoundSourceFamily, IntervalQuery<never>> = {
  aviation: aviationAdapter.queryInterval as IntervalQuery<never>,
  rain: rainFieldAdapter.queryInterval as IntervalQuery<never>,
  thunder: thunderAdapter.queryInterval as IntervalQuery<never>,
  waste_collection: wasteAdapter.queryInterval as IntervalQuery<never>,
};

function receiverNotes(receiver: Receiver): string[] {
  return receiver.environment === "indoor_unknown" ? ["receiver:indoor_unknown(insulation unknown; outdoor proxy only)"] : [];
}

/** 單一家族在 [t0, t1] 區間的結果；t0 === t1 即瞬時查詢 */
export function queryFamilyInterval(
  family: SoundSourceFamily,
  sets: readonly SoundSourceSet[],
  receiver: Receiver,
  t0: number,
  t1: number,
): FamilyResult {
  const familySets = sets.filter((s) => s.family === family);
  const coverages = familySets.flatMap((s) => s.coverage);
  const overlapping = coverages.filter((c) => c.windowStart <= t1 && t0 < c.windowEnd);
  const base = { family, contributions: [] as SourceContribution[], notes: receiverNotes(receiver) };
  if (overlapping.length === 0) {
    return {
      ...base,
      status: "unavailable",
      relativePotential: null,
      reason: coverages.length === 0 ? "source_not_loaded" : "outside_source_time_coverage",
    };
  }
  const ok = overlapping.filter((c) => c.status === "ok");
  const degraded = overlapping.filter((c) => c.status !== "ok").map((c) => `${c.provider}:${c.status}`);
  if (ok.length === 0) {
    return { ...base, status: "unknown", relativePotential: null, reason: `no_healthy_source(${degraded.join(",")})` };
  }
  const okProviders = new Set(ok.map((c) => c.provider));
  const records: SoundSourceRecord[] = [];
  const seenIds = new Set<string>();
  const push = (r: SoundSourceRecord) => {
    // 多日 sets 一起傳入時，跨午夜的停點等可能以同一 id 出現兩次
    if (seenIds.has(r.id)) return;
    seenIds.add(r.id);
    records.push(r);
  };
  for (const s of familySets) {
    // 單一 coverage 的集合：整組依該 coverage 判定；多源集合（落雷）：依 record 的 provider 判定
    if (s.coverage.length === 1) {
      if (okProviders.has(s.coverage[0]!.provider) && s.coverage[0]!.status === "ok") s.records.forEach(push);
      continue;
    }
    for (const r of s.records) if (okProviders.has(r.provenance.provider)) push(r);
  }
  const { contributions, notes } = QUERIES[family](records as never[], receiver, t0, t1);
  contributions.sort((a, b) => (b.relativePotential ?? -1) - (a.relativePotential ?? -1));
  const extraNotes = [...notes, ...degraded.map((d) => `degraded_source:${d}`)];
  const active = contributions.filter((c) => c.status === "active" && (c.relativePotential ?? 0) > 0);
  let status: FamilyStatus;
  let relativePotential: number | null;
  if (active.length) {
    status = "active";
    relativePotential = Math.max(...active.map((c) => c.relativePotential!));
  } else if (contributions.some((c) => c.status === "unknown")) {
    status = "unknown";
    relativePotential = null;
  } else {
    status = "inactive";
    relativePotential = 0;
  }
  return {
    ...base,
    status,
    relativePotential,
    reason: status === "unknown" ? contributions.find((c) => c.status === "unknown")?.unknownReason ?? "unknown_candidate" : undefined,
    contributions,
    notes: [...base.notes, ...extraNotes],
  };
}

export interface ReceiverQueryResult {
  receiver: Receiver;
  unixSeconds: number;
  modelVersion: string;
  families: FamilyResult[];
  /** 所有家族的候選貢獻，依潛勢排序（unknown 在後） */
  contributions: SourceContribution[];
}

/** 給接收者＋時間 t＋已載入來源，回各家族結果與 SourceContribution[] */
export function queryReceiver(
  receiver: Receiver,
  unixSeconds: number,
  sets: readonly SoundSourceSet[],
  families: readonly SoundSourceFamily[] = SOUND_FAMILIES,
): ReceiverQueryResult {
  const results = families.map((f) => queryFamilyInterval(f, sets, receiver, unixSeconds, unixSeconds));
  const contributions = results
    .flatMap((r) => r.contributions)
    .sort((a, b) => (b.relativePotential ?? -1) - (a.relativePotential ?? -1));
  return { receiver, unixSeconds, modelVersion: MODEL_VERSION, families: results, contributions };
}

export interface FamilyDaySeries {
  family: SoundSourceFamily;
  /** 每格最大相對潛勢；inactive=0；unknown／unavailable=null（不是 0） */
  values: (number | null)[];
  statuses: FamilyStatus[];
  /** (unknown + unavailable 格數) / 總格數 */
  unknownRatio: number;
}

export interface DayProfile {
  receiver: Receiver;
  dateKey: string;
  stepMinutes: number;
  /** 每格起點 unix 秒；格為 [binStart, binStart + step) */
  binStarts: number[];
  modelVersion: string;
  binRule: string;
  families: FamilyDaySeries[];
}

/**
 * 24h 構成：每格以區間聚合（雷／垃圾車用區間重疊、飛機格內細取樣、雨逐小時），
 * 不在格點瞬時取樣，避免把短暫事件漏成「安靜」。
 */
export function dayProfile(
  receiver: Receiver,
  dateKey: string,
  stepMinutes: number = PROFILE.defaultStepMinutes.value,
  sets: readonly SoundSourceSet[] = [],
  families: readonly SoundSourceFamily[] = SOUND_FAMILIES,
): DayProfile {
  if (!(stepMinutes > 0) || 1440 % stepMinutes !== 0) {
    throw new Error(`stepMinutes must divide 1440, got ${stepMinutes}`);
  }
  const start = taipeiMidnightMs(dateKey) / 1000;
  const step = stepMinutes * 60;
  const binStarts: number[] = [];
  for (let t = start; t < start + 86_400; t += step) binStarts.push(t);
  const series = families.map((family): FamilyDaySeries => {
    const statuses: FamilyStatus[] = [];
    const values: (number | null)[] = [];
    for (const b of binStarts) {
      const r = queryFamilyInterval(family, sets, receiver, b, b + step - 1e-6);
      statuses.push(r.status);
      values.push(r.relativePotential);
    }
    const unknownCount = statuses.filter((s) => s === "unknown" || s === "unavailable").length;
    return { family, values, statuses, unknownRatio: unknownCount / binStarts.length };
  });
  return { receiver, dateKey, stepMinutes, binStarts, modelVersion: MODEL_VERSION, binRule: PROFILE.binRule.value, families: series };
}
