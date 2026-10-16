// 上游直連 3 層的純邏輯與 fetch：洪水キキクル targetTimes、黃砂予測清單。
// 狀態沿用 jmaImageryLoader 的 status store（key：risk_flood／gibs_snow），圖例以 useSyncExternalStore 讀。

import { withLoading } from "../lib/loadingRegistry";
import { JMA_FLOOD_TARGET_TIMES_URL, JMA_KOSA_LIST_URL } from "./jmaTypes";

export const FLOOD_STATUS_KEY = "risk_flood";
export const GIBS_SNOW_STATUS_KEY = "gibs_snow";

// ── 洪水キキクル ──────────────────────────────────────────────────

export interface JmaRiskFrame {
  basetime: string;
  validtime: string;
  member: string;
  /** validtime（UTC，YYYYMMDDHHmmss）的 epoch ms */
  validMs: number;
}

/** 上游時間字串 YYYYMMDDHHmmss 是 UTC */
export function jmaUtcStampMs(stamp: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!m) return null;
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
}

/** targetTimes.json → 有 flood 元素的幀，validMs 由舊到新；格式不對的列略過 */
export function parseRiskTargetTimes(json: unknown): JmaRiskFrame[] {
  if (!Array.isArray(json)) return [];
  const out: JmaRiskFrame[] = [];
  for (const row of json) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const elements = Array.isArray(r.elements) ? r.elements : [];
    if (!elements.includes("flood")) continue;
    if (typeof r.basetime !== "string" || typeof r.validtime !== "string") continue;
    const validMs = jmaUtcStampMs(r.validtime);
    if (validMs == null || jmaUtcStampMs(r.basetime) == null) continue;
    const member = typeof r.member === "string" && /^[a-z0-9]+$/.test(r.member) ? r.member : "none";
    out.push({ basetime: r.basetime, validtime: r.validtime, member, validMs });
  }
  return out.sort((a, b) => a.validMs - b.validMs);
}

/** 上游約 10 分一幀；回放時刻早於最舊一幀超過此值 → 只提供即時 */
export const FLOOD_FRAME_TOLERANCE_MS = 10 * 60_000;
/** 即時：最新一幀距現在超過此值 → 未涵蓋（上游停更時不把舊幀當現況） */
export const FLOOD_LIVE_MAX_STALE_MS = 60 * 60_000;

export type FloodPick =
  | { kind: "frame"; frame: JmaRiskFrame }
  | { kind: "uncovered"; reason: "no_frame" | "live_only" | "stale" };

/** 即時：最晚的 ≤ now；回放：最晚的 ≤ t，t 早於上游保留範圍 → live_only */
export function pickFloodFrame(frames: readonly JmaRiskFrame[], tMs: number, live: boolean): FloodPick {
  if (frames.length === 0) return { kind: "uncovered", reason: "no_frame" };
  if (!live && tMs < frames[0]!.validMs - FLOOD_FRAME_TOLERANCE_MS) return { kind: "uncovered", reason: "live_only" };
  let chosen: JmaRiskFrame | null = null;
  for (const f of frames) if (f.validMs <= tMs) chosen = f;
  if (!chosen) chosen = frames[0]!;
  if (live && tMs - chosen.validMs > FLOOD_LIVE_MAX_STALE_MS) return { kind: "uncovered", reason: "stale" };
  return { kind: "frame", frame: chosen };
}

export async function fetchFloodTargetTimes(): Promise<JmaRiskFrame[]> {
  const res = await withLoading("jma-risk-flood:times", "洪水キキクル 時刻", fetch(JMA_FLOOD_TARGET_TIMES_URL, { cache: "no-cache" }));
  if (!res.ok) throw new Error(`targetTimes HTTP ${res.status}`);
  return parseRiskTargetTimes(await res.json());
}

// ── 黃砂予測 ──────────────────────────────────────────────────────

/** s_jpjp_list.js 的 `imgFcst[i++] = "YYYYMMDDHHmm";`：只用 regex 取字串，不 eval；回傳由舊到新、去重 */
export function parseKosaList(js: string): string[] {
  const out = new Set<string>();
  for (const m of js.matchAll(/imgFcst\[\s*i\+\+\s*\]\s*=\s*["'](\d{12})["']/g)) {
    if (kosaStampMs(m[1]!) != null) out.add(m[1]!);
  }
  return [...out].sort();
}

/** 黃砂時刻 YYYYMMDDHHmm 是日本時間（JST） */
export function kosaStampMs(stamp: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!m) return null;
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!) - 9 * 3600_000;
  return Number.isNaN(ms) ? null : ms;
}

/** 最接近 t 的預報時刻（同距取較早）；清單空 → null */
export function nearestKosaStamp(stamps: readonly string[], tMs: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const s of stamps) {
    const ms = kosaStampMs(s);
    if (ms == null) continue;
    const d = Math.abs(ms - tMs);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** 時間軸時刻是否落在清單範圍外（前後各容許 3 小時，預報間隔） */
export function kosaOutOfRange(stamps: readonly string[], tMs: number): boolean {
  if (stamps.length === 0) return true;
  const first = kosaStampMs(stamps[0]!)!;
  const last = kosaStampMs(stamps[stamps.length - 1]!)!;
  const slack = 3 * 3600_000;
  return tMs < first - slack || tMs > last + slack;
}

export async function fetchKosaList(): Promise<string[]> {
  const res = await withLoading("jma-kosa:list", "黃砂予測 清單", fetch(JMA_KOSA_LIST_URL, { cache: "no-cache" }));
  if (!res.ok) throw new Error(`kosa list HTTP ${res.status}`);
  return parseKosaList(await res.text());
}
