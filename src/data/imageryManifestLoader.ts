/**
 * imageryManifestLoader.ts — 讀 R2 上的影像每日幀清單（CWA 衛星／雷達、空品色階、累積雨量柵格）
 *
 * 契約：data-collectors docs/IMAGERY_R2_MANIFEST.md
 *   - `${IMAGERY_CDN_BASE}/imagery/<source>/manifest-<UTC YYYY-MM-DD>.json`
 *   - frames[] = { product, observed_at(UTC Z), key, mime_type, image_size, bbox:[lonMin,latMin,lonMax,latMax] }
 *   - 影像 URL = `${IMAGERY_CDN_BASE}/${key}`
 *
 * 過渡期：時間窗涵蓋的 manifest 一份都讀不到（collector 還沒上線／還沒 bootstrap／R2 讀取失敗）時回 null，
 * 呼叫端退回原本的 Supabase RPC。DB 影像表退役時再拿掉退路。
 */

import { withLoading } from "../lib/loadingRegistry";

/** R2 公開網域（bucket mini-tw-pulse）；與 statistics／sim／layers 同一個網域。 */
export const DEFAULT_IMAGERY_CDN_BASE = "https://data.itsmigu.com";

/** env 只當覆寫（本機演練）；未設時用正式網域，避免部署漏帶 env 時整條影像路徑失效。 */
export const IMAGERY_CDN_BASE = (import.meta.env.VITE_IMAGERY_CDN_BASE || DEFAULT_IMAGERY_CDN_BASE).replace(/\/+$/, "");

export type ImagerySource = "cwa" | "aqi" | "precip";

export interface ImageryManifestFrame {
  product: string;
  observedAtIso: string;
  observedAtMs: number;
  url: string;
  mimeType: string;
  imageSize: number;
  lonMin: number;
  latMin: number;
  lonMax: number;
  latMax: number;
}

interface RawManifestFrame {
  product: string;
  observed_at: string;
  key: string;
  mime_type: string;
  image_size: number | null;
  bbox: [number, number, number, number];
}

interface RawManifest {
  version: number;
  frames: RawManifestFrame[];
}

/** 時間窗 [since, until) 涵蓋的 UTC 日（YYYY-MM-DD，升序）。 */
export function utcDaysInWindow(sinceMs: number, untilMs: number): string[] {
  const days: string[] = [];
  if (!(untilMs > sinceMs)) return days;
  const d = new Date(sinceMs);
  d.setUTCHours(0, 0, 0, 0);
  for (let t = d.getTime(); t < untilMs; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export function imageryManifestUrl(source: ImagerySource, day: string, base = IMAGERY_CDN_BASE): string {
  return `${base}/imagery/${source}/manifest-${day}.json`;
}

/** manifest 列 → frame；壞列（時間或 bbox 不合法、缺 key）略過，不補 0。 */
export function manifestFramesToFrames(raw: readonly RawManifestFrame[], base = IMAGERY_CDN_BASE): ImageryManifestFrame[] {
  const out: ImageryManifestFrame[] = [];
  for (const f of raw) {
    const ms = new Date(f.observed_at).getTime();
    const bbox = f.bbox;
    if (!Number.isFinite(ms) || !f.key || !Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) continue;
    out.push({
      product: f.product,
      observedAtIso: f.observed_at,
      observedAtMs: ms,
      url: `${base}/${f.key}`,
      mimeType: f.mime_type,
      imageSize: f.image_size ?? 0,
      lonMin: bbox[0],
      latMin: bbox[1],
      lonMax: bbox[2],
      latMax: bbox[3],
    });
  }
  return out;
}

/** 單日 manifest；404／403 回 null（當天還沒有幀或尚未上線），其他錯誤 throw（由呼叫端記警告）。 */
async function fetchManifest(source: ImagerySource, day: string): Promise<RawManifest | null> {
  const res = await fetch(imageryManifestUrl(source, day), { cache: "no-cache" });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`imagery manifest ${source}/${day}: HTTP ${res.status}`);
  const json = (await res.json()) as RawManifest;
  if (!json || !Array.isArray(json.frames)) throw new Error(`imagery manifest ${source}/${day}: 格式不符`);
  return json;
}

export interface ImageryManifestQuery {
  source: ImagerySource;
  products: readonly string[];
  sinceIso: string;
  untilIso: string;
  /** 抽稀：只取 epoch 分鐘數整除 step 的幀（與 RPC p_step_minutes 同義）；null = 全部 */
  stepMinutes?: number | null;
  loadingKey: string;
  loadingLabel: string;
  /** true = 背景預載，不灌 LOADING 面板 */
  silent?: boolean;
}

/**
 * 依時間窗讀 1–N 份 UTC 日 manifest，過濾 product 與 [since, until)，依 product、時間升序回傳。
 * 回 null = 時間窗內一份 manifest 都沒有 → 呼叫端退回 RPC。
 */
export async function loadImageryManifestFrames(q: ImageryManifestQuery): Promise<ImageryManifestFrame[] | null> {
  const sinceMs = new Date(q.sinceIso).getTime();
  const untilMs = new Date(q.untilIso).getTime();
  const days = utcDaysInWindow(sinceMs, untilMs);
  if (days.length === 0) return [];

  // 單日讀取失敗（網路、5xx、格式）當成該日沒有 manifest 並記警告；全部讀不到才退回 RPC。
  const task = Promise.all(days.map((day) => fetchManifest(q.source, day).catch((err: unknown) => {
    console.warn(`[imageryManifest] ${q.source}/${day} 讀取失敗`, err);
    return null;
  })));
  const manifests = await (q.silent ? task : withLoading(q.loadingKey, q.loadingLabel, task));
  if (manifests.every((m) => m === null)) return null;

  const wanted = new Set(q.products);
  const step = q.stepMinutes ?? null;
  const frames = manifests
    .flatMap((m) => (m ? manifestFramesToFrames(m.frames) : []))
    .filter((f) => wanted.has(f.product))
    .filter((f) => f.observedAtMs >= sinceMs && f.observedAtMs < untilMs)
    .filter((f) => step === null || Math.floor(f.observedAtMs / 60_000) % step === 0);
  frames.sort((a, b) => (a.product === b.product ? a.observedAtMs - b.observedAtMs : a.product < b.product ? -1 : 1));
  return frames;
}
