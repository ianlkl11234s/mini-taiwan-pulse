/**
 * 雷達雨每日包（W6-1；Python 產生：scripts/preprocess/build-sound-radar-rain.py --publish）。
 *
 * - `public/sound-atlas/grid/radar-rain-<臺灣日>.meta.json`（schema pulse-sound-radar-rain-v1）
 * - `public/sound-atlas/grid/radar-rain-<臺灣日>.class.bin`：gzip 的 uint8 分級碼（0–4、255），
 *   frame-major，第 k 幀＝[first_slot + k·600 s, +600 s)，格序同 gridSpec（row·cols + col，全 bbox）。
 *   正式站對 .bin 不自動壓縮所以預先 gzip；開發伺服器或 CDN 若已解壓，依 1f 8b 魔數判斷要不要再解。
 * - 缺幀、雜波（時間一致性濾波）＝255。
 *
 * 讀不到（404、開發伺服器回 HTML、schema／網格／門檻不符）一律回 null，呼叫端退回只用雨量站並標示來源。
 */
import { withLoading } from "../../lib/loadingRegistry";
import { GRID_CELLS, GRID_SPEC, GRID_UNKNOWN } from "./gridSpec";
import { RAIN_CLASS_EDGES_MM_H, RAIN_CLASS_SPEC, foldRainClasses, type RainClassCode } from "./rainClass";

export const RADAR_RAIN_SCHEMA = "pulse-sound-radar-rain-v1";
export const RADAR_RAIN_PROVIDER = "cwa_radar_grid";
export const RADAR_FRAME_STEP_S = 600;

export interface RadarRainMeta {
  schema: string;
  date_taiwan: string;
  grid: { id: string; west: number; north: number; dLon: number; dLat: number; cols: number; rows: number; sha256?: string };
  payload: { file: string; encoding: string; bytes: number; raw_bytes: number; sha256?: string };
  frames: { count: number; step_s: number; first_slot_utc: string };
  frames_missing: { index: number; utc: string; status: string }[];
  classes: { version: string; edges_mm_h: number[]; unknown: number };
  clutter?: { rule: string; cells_flagged_bbox: number; cells_flagged_in_scope: number };
  palette?: { path: string; retrieved: string };
  zr?: { a: number; b: number };
  generated_at?: string;
}

export interface RadarRainPack {
  dateKey: string;
  /** 第 0 幀起點（unix 秒） */
  firstSlot: number;
  frameCount: number;
  /** frameCount × GRID_CELLS */
  classes: Uint8Array;
  meta: RadarRainMeta;
}

export function radarRainUrls(dateKey: string): { meta: string; payload: string } {
  const stem = `/sound-atlas/grid/radar-rain-${encodeURIComponent(dateKey)}`;
  return { meta: `${stem}.meta.json`, payload: `${stem}.class.bin` };
}

/** meta 驗證：schema、網格定義、分級門檻都要和前端一致，否則拒用（不硬套） */
export function validateRadarRainMeta(meta: unknown, dateKey: string): RadarRainMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as RadarRainMeta;
  if (m.schema !== RADAR_RAIN_SCHEMA || m.date_taiwan !== dateKey) return null;
  const g = m.grid;
  if (!g || g.id !== GRID_SPEC.id || g.cols !== GRID_SPEC.cols || g.rows !== GRID_SPEC.rows
    || g.west !== GRID_SPEC.west || g.north !== GRID_SPEC.north || g.dLon !== GRID_SPEC.dLon || g.dLat !== GRID_SPEC.dLat) return null;
  const e = m.classes?.edges_mm_h;
  if (!Array.isArray(e) || e.length !== RAIN_CLASS_EDGES_MM_H.length || e.some((x, i) => x !== RAIN_CLASS_EDGES_MM_H[i])) return null;
  if (m.classes.version !== RAIN_CLASS_SPEC.version || m.classes.unknown !== GRID_UNKNOWN) return null;
  if (!m.frames || m.frames.step_s !== RADAR_FRAME_STEP_S || !(m.frames.count > 0) || !Number.isFinite(Date.parse(m.frames.first_slot_utc))) return null;
  return m;
}

async function gunzipIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** meta＋payload 位元組 → 每日包；長度或內容不符回 null */
export async function decodeRadarRainPack(meta: unknown, payload: Uint8Array, dateKey: string): Promise<RadarRainPack | null> {
  const m = validateRadarRainMeta(meta, dateKey);
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
    if (v > 4 && v !== GRID_UNKNOWN) return null;
  }
  return { dateKey, firstSlot: Date.parse(m.frames.first_slot_utc) / 1000, frameCount: m.frames.count, classes: raw, meta: m };
}

/** 讀每日包（loadingRegistry 顯示「雷達雨勢」）；沒有包或格式不符 → null */
export async function fetchRadarRainPack(dateKey: string, fetchImpl: typeof fetch = fetch): Promise<RadarRainPack | null> {
  const urls = radarRainUrls(dateKey);
  return withLoading(`sound-radar-rain:${dateKey}`, `聲景雷達雨勢 ${dateKey}`, (async () => {
    try {
      const mr = await fetchImpl(urls.meta);
      if (!mr.ok) return null;
      let meta: unknown;
      try { meta = JSON.parse(await mr.text()); } catch { return null; } // 開發伺服器對缺檔可能回 200 HTML
      if (!validateRadarRainMeta(meta, dateKey)) return null;
      const pr = await fetchImpl(urls.payload);
      if (!pr.ok) return null;
      return await decodeRadarRainPack(meta, new Uint8Array(await pr.arrayBuffer()), dateKey);
    } catch {
      return null;
    }
  })());
}

/** 時間 t 所在幀索引（不在當日包範圍 → -1） */
export function radarFrameIndex(pack: RadarRainPack, t: number): number {
  const k = Math.floor((t - pack.firstSlot) / RADAR_FRAME_STEP_S);
  return k >= 0 && k < pack.frameCount ? k : -1;
}

/**
 * 一格在 [t0, t1] 的雷達分級：每 10 分一幀，區間取重疊各幀的「最大值」（foldRainClasses）。
 * 回 null＝區間完全不在包的時間範圍（不是 unknown，是沒有這個來源）。
 */
export function radarClassAt(pack: RadarRainPack, cell: number, t0: number, t1: number): { rainClass: RainClassCode; slotStart: number } | null {
  if (cell < 0 || cell >= GRID_CELLS) return null;
  const k0 = Math.max(0, Math.floor((t0 - pack.firstSlot) / RADAR_FRAME_STEP_S));
  const k1 = Math.min(pack.frameCount - 1, Math.floor((t1 - pack.firstSlot) / RADAR_FRAME_STEP_S));
  if (k1 < k0) return null;
  const codes: RainClassCode[] = [];
  let bestK = k0;
  let bestV = -1;
  for (let k = k0; k <= k1; k++) {
    const v = pack.classes[k * GRID_CELLS + cell]! as RainClassCode;
    codes.push(v);
    if (v !== GRID_UNKNOWN && v > bestV) { bestV = v; bestK = k; }
  }
  const rainClass = foldRainClasses(codes)!;
  return { rainClass, slotStart: pack.firstSlot + bestK * RADAR_FRAME_STEP_S };
}

/** 一幀（整個 bbox）的分級；超出範圍回 null */
export function radarFrame(pack: RadarRainPack, k: number): Uint8Array | null {
  if (k < 0 || k >= pack.frameCount) return null;
  return pack.classes.subarray(k * GRID_CELLS, (k + 1) * GRID_CELLS);
}
