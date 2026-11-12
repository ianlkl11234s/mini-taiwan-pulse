/**
 * W6-3 連續潛勢每日包（目前只有飛機需要預算；TS 預處理 scripts/preprocess/sound/build-sound-grid-packs.ts 產生）。
 *
 * - `public/sound-atlas/grid/<family>-<臺灣日>.meta.json`（schema pulse-sound-potential-v1）
 * - `public/sound-atlas/grid/<family>-<臺灣日>.class.bin`：gzip 的 uint8 潛勢碼（potentialCode：0／1–250／255），
 *   frame-major，第 k 幀＝[first_slot + k·600 s, +600 s) 的區間最大值，格序同 gridSpec（全 bbox，範圍外 255）。
 * - meta.source.sha256＝產生這個包的來源檔（例：aviation-src-<D>.json）雜湊：前端 set 讀的來源檔雜湊不同就拒用，
 *   避免網格和接收點各用各的資料。
 *
 * 讀不到（404、開發伺服器回 HTML、schema／網格／碼表不符）一律回 null → 呼叫端整幀畫無法判斷並說明。
 */
import { withLoading } from "../../lib/loadingRegistry";
import { GRID_CELLS, GRID_SPEC, GRID_UNKNOWN } from "./gridSpec";
import { POTENTIAL_CODE_MAX, POTENTIAL_CODE_SCALE } from "./potentialCode";

export const POTENTIAL_PACK_SCHEMA = "pulse-sound-potential-v1";
export const POTENTIAL_FRAME_STEP_S = 600;

export interface PotentialPackMeta {
  schema: string;
  family: string;
  date_taiwan: string;
  model_version: string;
  grid: { id: string; west: number; north: number; dLon: number; dLat: number; cols: number; rows: number };
  payload: { file: string; encoding: string; bytes: number; raw_bytes: number; sha256: string };
  frames: { count: number; step_s: number; first_slot_utc: string; rule: string };
  code: { scale: number; max: number; unknown: number; rule: string };
  source: { file: string; sha256: string; schema: string };
  receiver_height_m: number;
  stats?: Record<string, unknown>;
  generated_at?: string;
}

export interface PotentialPack {
  family: string;
  dateKey: string;
  firstSlot: number;
  frameCount: number;
  /** frameCount × GRID_CELLS */
  codes: Uint8Array;
  meta: PotentialPackMeta;
}

export function potentialPackUrls(family: string, dateKey: string): { meta: string; payload: string } {
  const stem = `/sound-atlas/grid/${family}-${encodeURIComponent(dateKey)}`;
  return { meta: `${stem}.meta.json`, payload: `${stem}.class.bin` };
}

export function validatePotentialPackMeta(meta: unknown, family: string, dateKey: string): PotentialPackMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as PotentialPackMeta;
  if (m.schema !== POTENTIAL_PACK_SCHEMA || m.family !== family || m.date_taiwan !== dateKey) return null;
  const g = m.grid;
  if (!g || g.id !== GRID_SPEC.id || g.cols !== GRID_SPEC.cols || g.rows !== GRID_SPEC.rows
    || g.west !== GRID_SPEC.west || g.north !== GRID_SPEC.north || g.dLon !== GRID_SPEC.dLon || g.dLat !== GRID_SPEC.dLat) return null;
  if (!m.code || m.code.scale !== POTENTIAL_CODE_SCALE || m.code.max !== POTENTIAL_CODE_MAX || m.code.unknown !== GRID_UNKNOWN) return null;
  if (!m.frames || m.frames.step_s !== POTENTIAL_FRAME_STEP_S || !(m.frames.count > 0) || !Number.isFinite(Date.parse(m.frames.first_slot_utc))) return null;
  if (!m.source || typeof m.source.sha256 !== "string") return null;
  return m;
}

async function gunzipIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodePotentialPack(meta: unknown, payload: Uint8Array, family: string, dateKey: string): Promise<PotentialPack | null> {
  const m = validatePotentialPackMeta(meta, family, dateKey);
  if (!m) return null;
  let raw: Uint8Array;
  try {
    raw = await gunzipIfNeeded(payload);
  } catch {
    return null;
  }
  if (raw.length !== m.frames.count * GRID_CELLS) return null;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i]!;
    if (v > POTENTIAL_CODE_MAX && v !== GRID_UNKNOWN) return null;
  }
  return { family, dateKey, firstSlot: Date.parse(m.frames.first_slot_utc) / 1000, frameCount: m.frames.count, codes: raw, meta: m };
}

/** 讀每日包（loadingRegistry 顯示）；沒有包或格式不符 → null */
export async function fetchPotentialPack(family: string, dateKey: string, fetchImpl: typeof fetch = fetch): Promise<PotentialPack | null> {
  const urls = potentialPackUrls(family, dateKey);
  return withLoading(`sound-potential-pack:${family}:${dateKey}`, `聲景網格每日包 ${family} ${dateKey}`, (async () => {
    try {
      const mr = await fetchImpl(urls.meta);
      if (!mr.ok) return null;
      let meta: unknown;
      try { meta = JSON.parse(await mr.text()); } catch { return null; }
      if (!validatePotentialPackMeta(meta, family, dateKey)) return null;
      const pr = await fetchImpl(urls.payload);
      if (!pr.ok) return null;
      return await decodePotentialPack(meta, new Uint8Array(await pr.arrayBuffer()), family, dateKey);
    } catch {
      return null;
    }
  })());
}

/** 時間 t 所在幀（不在包內 → null） */
export function potentialPackFrame(pack: PotentialPack, t: number): Uint8Array | null {
  const k = Math.floor((t - pack.firstSlot) / POTENTIAL_FRAME_STEP_S);
  if (k < 0 || k >= pack.frameCount) return null;
  return pack.codes.subarray(k * GRID_CELLS, (k + 1) * GRID_CELLS);
}
