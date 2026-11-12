/**
 * W6-3 全北北來源檔：有這份檔的日期，網格與接收點、格 popup、24h 構成圖都讀**同一份** set
 * （不再用接收點 ±30 km 的場景快照），網格值＝queryReceiver(格心, t) 才在全範圍成立。
 *
 * 檔案（public/sound-atlas/grid/，gitignore，public-assets lock 登記；scripts/preprocess/build-sound-grid-sources.py 產生）：
 *   aviation-src-<D>.json  飛機航跡（pulse-sound-aviation-src-v1）＋ aviation-<D>.{meta.json,class.bin} 預算網格（同一份來源的雜湊）
 *   rain-gauge-<D>.json    雨量站逐時列（pulse-sound-rain-gauge-v1）
 *   natural-<D>.json       風、浪、河川觀測＋近岸海域面＋河道線（pulse-sound-natural-grid-v1，natural 區塊同場景快照）
 *   canopy-cells-v1.{meta.json,bin}  每格樹冠覆蓋（靜態，不隨日期；TS 預處理用 canopyCover 在格心算）
 *
 * 適用條件：接收點不存在或在網格外框內（臺中和平等網格外的場景照舊走快照／即時）。
 * 檔案不存在（404、開發伺服器回 HTML、schema 不符）→ null，呼叫端照舊走快照／即時。
 */
import { withLoading } from "../../lib/loadingRegistry";
import { flightRowsToFlights, type FlightTrailRow } from "../../data/flightTrails";
import type { RainGaugeDayRow } from "../../data/rainGaugeLoader";
import { loadAviation } from "../sourceAdapters/aviationAdapter";
import { loadRain } from "../sourceAdapters/rainFieldAdapter";
import { canopyCellsRecord, type CanopyCells } from "../sourceAdapters/windVegetationAdapter";
import { naturalSnapshotSet, parseNaturalBlock } from "../advancedSources";
import type { Receiver, SoundSourceFamily, SoundSourceSet } from "../types";
import { GRID_BBOX, GRID_CELLS, GRID_SPEC } from "./gridSpec";

export const GRID_SOURCE_FAMILIES: ReadonlySet<SoundSourceFamily> = new Set<SoundSourceFamily>([
  "aviation", "rain", "wind_vegetation", "coastal_wave", "river_water",
]);

const BASE = "/sound-atlas/grid";
export const gridSourceUrl = (name: string) => `${BASE}/${name}`;

/** 接收點不存在或在網格外框內 → 可用全北北來源 */
export function gridSourceApplies(receiver: Pick<Receiver, "longitude" | "latitude"> | null): boolean {
  if (!receiver) return true;
  const [w, s, e, n] = GRID_BBOX;
  return receiver.longitude >= w && receiver.longitude < e && receiver.latitude > s && receiver.latitude <= n;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Fetched { json: Record<string, unknown>; sha256: string }

/** 讀 JSON 來源檔並算位元組雜湊；缺檔、非 JSON、schema 不符 → null */
async function fetchSourceJson(name: string, schema: string, dateKey: string | null, fetchImpl: typeof fetch): Promise<Fetched | null> {
  try {
    const res = await fetchImpl(gridSourceUrl(name));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let json: unknown;
    try { json = JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
    if (!json || typeof json !== "object") return null;
    const j = json as Record<string, unknown>;
    if (j.schema !== schema || (dateKey != null && j.date_taiwan !== dateKey)) return null;
    return { json: j, sha256: await sha256Hex(bytes) };
  } catch {
    return null;
  }
}

/** 來源檔雜湊（飛機網格包比對用；family|date → sha256） */
const sourceSha = new Map<string, string>();
export const gridSourceSha = (family: SoundSourceFamily, dateKey: string) => sourceSha.get(`${family}|${dateKey}`) ?? null;

// ── 飛機 ──

export async function loadAviationGridSource(date: string, nowUnix: number, fetchImpl: typeof fetch = fetch): Promise<SoundSourceSet | null> {
  const f = await withLoading(`sound-grid-src:aviation:${date}`, `聲景全範圍航跡 ${date}`,
    fetchSourceJson(`aviation-src-${encodeURIComponent(date)}.json`, "pulse-sound-aviation-src-v1", date, fetchImpl));
  if (!f || !Array.isArray(f.json.rows)) return null;
  sourceSha.set(`aviation|${date}`, f.sha256);
  const rows = f.json.rows as FlightTrailRow[];
  const health = f.json.health;
  if (health === "error") return null;
  return (await loadAviation({ date, nowUnix }, async () => ({ flights: flightRowsToFlights(rows).flights }))) as SoundSourceSet;
}

// ── 雨量站 ──

export async function loadRainGridSource(date: string, fetchImpl: typeof fetch = fetch): Promise<SoundSourceSet | null> {
  const f = await withLoading(`sound-grid-src:rain:${date}`, `聲景全範圍雨量站 ${date}`,
    fetchSourceJson(`rain-gauge-${encodeURIComponent(date)}.json`, "pulse-sound-rain-gauge-v1", date, fetchImpl));
  if (!f || !Array.isArray(f.json.rows) || f.json.health === "error") return null;
  sourceSha.set(`rain|${date}`, f.sha256);
  const rows = f.json.rows as RainGaugeDayRow[];
  return (await loadRain({ date }, async () => rows)) as SoundSourceSet;
}

// ── 樹冠覆蓋（靜態） ──

export const CANOPY_CELLS_SCHEMA = "pulse-sound-canopy-cells-v1";
let canopyPromise: Promise<CanopyCells | null> | null = null;

export function decodeCanopyCells(meta: unknown, bytes: Uint8Array): CanopyCells | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as { schema?: string; grid?: { id?: string }; payload?: { raw_bytes?: number }; origin?: string; cover_scale?: number };
  if (m.schema !== CANOPY_CELLS_SCHEMA || m.grid?.id !== GRID_SPEC.id || bytes.length !== GRID_CELLS || m.cover_scale !== 250) return null;
  return { gridId: GRID_SPEC.id, codes: bytes, origin: m.origin };
}

export function fetchCanopyCells(fetchImpl: typeof fetch = fetch): Promise<CanopyCells | null> {
  canopyPromise ??= withLoading("sound-grid-src:canopy", "聲景樹冠覆蓋", (async () => {
    try {
      const mr = await fetchImpl(gridSourceUrl("canopy-cells-v1.meta.json"));
      if (!mr.ok) return null;
      let meta: unknown;
      try { meta = JSON.parse(await mr.text()); } catch { return null; }
      const pr = await fetchImpl(gridSourceUrl("canopy-cells-v1.bin"));
      if (!pr.ok) return null;
      let bytes = new Uint8Array(await pr.arrayBuffer());
      if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      return decodeCanopyCells(meta, bytes);
    } catch {
      return null;
    }
  })());
  canopyPromise.then((c) => { if (!c) canopyPromise = null; }, () => { canopyPromise = null; });
  return canopyPromise;
}

// ── 自然三族 ──

const naturalCache = new Map<string, Promise<Fetched | null>>();

export async function loadNaturalGridSource(
  family: "wind_vegetation" | "coastal_wave" | "river_water",
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SoundSourceSet | null> {
  let p = naturalCache.get(date);
  if (!p) {
    p = withLoading(`sound-grid-src:natural:${date}`, `聲景全範圍自然聲源 ${date}`,
      fetchSourceJson(`natural-${encodeURIComponent(date)}.json`, "pulse-sound-natural-grid-v1", date, fetchImpl));
    naturalCache.set(date, p);
    p.then((r) => { if (!r) naturalCache.delete(date); }, () => naturalCache.delete(date));
    while (naturalCache.size > 3) naturalCache.delete(naturalCache.keys().next().value!);
  }
  const f = await p;
  if (!f) return null;
  const block = parseNaturalBlock(f.json);
  if (!block) return null;
  sourceSha.set(`${family}|${date}`, f.sha256);
  const set = naturalSnapshotSet(block, family, date);
  if (!set) return null;
  if (family === "wind_vegetation") {
    const cells = await fetchCanopyCells(fetchImpl);
    // 樹冠覆蓋缺 → 不補任何樹冠 record：queryWindVegetationInterval 回 vegetation_not_sampled（無法判斷），不當 0
    if (cells) return { ...set, records: [...set.records, canopyCellsRecord(cells, date)] } as SoundSourceSet;
  }
  return set as SoundSourceSet;
}

/** 有全北北來源檔的家族：讀檔成 set；檔案不存在 → null（呼叫端照舊） */
export async function loadGridSourceFamily(family: SoundSourceFamily, date: string, nowUnix: number): Promise<SoundSourceSet | null> {
  switch (family) {
    case "aviation": return loadAviationGridSource(date, nowUnix);
    case "rain": return loadRainGridSource(date);
    case "wind_vegetation":
    case "coastal_wave":
    case "river_water": return loadNaturalGridSource(family, date);
    default: return null;
  }
}
