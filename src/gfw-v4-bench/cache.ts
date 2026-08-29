import { decodeTrackAsset } from "./adapters";
import { resolveAssetUrl } from "./contract";
import type { BenchAssetEntry, BenchManifest, TrackPack } from "./types";

export type CacheMode = "cold" | "warm";

export interface AssetLoadTiming {
  url: string;
  transferBytes: number;
  fetchMs: number;
  decodeMs: number;
  assembleMs: number;
  fromAppCache: boolean;
}

export interface LoadedPack {
  pack: TrackPack;
  timing: AssetLoadTiming;
}

interface CachedDay {
  accessedAt: number;
  packs: Map<string, TrackPack>;
}

export class DayPackLru {
  private readonly days = new Map<string, CachedDay>();

  constructor(readonly maxDays: number) {
    if (!Number.isInteger(maxDays) || maxDays < 2 || maxDays > 3) throw new Error("GFW bench LRU must retain 2-3 days");
  }

  get(date: string, key: string): TrackPack | null {
    const day = this.days.get(date);
    const pack = day?.packs.get(key) ?? null;
    if (pack && day) day.accessedAt = performance.now();
    return pack;
  }

  put(date: string, key: string, pack: TrackPack): void {
    const day = this.days.get(date) ?? { accessedAt: performance.now(), packs: new Map<string, TrackPack>() };
    day.accessedAt = performance.now();
    day.packs.set(key, pack);
    this.days.set(date, day);
    while (this.days.size > this.maxDays) {
      let oldestDate: string | null = null;
      let oldestAccess = Infinity;
      for (const [candidate, value] of this.days) {
        if (value.accessedAt < oldestAccess) {
          oldestDate = candidate;
          oldestAccess = value.accessedAt;
        }
      }
      if (oldestDate) this.days.delete(oldestDate);
      else break;
    }
  }

  clear(): void { this.days.clear(); }
  dayCount(): number { return this.days.size; }
  packCount(): number { return [...this.days.values()].reduce((sum, day) => sum + day.packs.size, 0); }
  dates(): string[] { return [...this.days.keys()]; }
}

export class ForegroundRequestGate {
  private controller: AbortController | null = null;

  next(): AbortController {
    this.controller?.abort();
    this.controller = new AbortController();
    return this.controller;
  }

  abort(): void {
    this.controller?.abort();
    this.controller = null;
  }
}

const assetCacheKey = (entry: BenchAssetEntry): string => `${entry.bucket}|${entry.format}|${entry.path}`;
let loadSequence = 0;

async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function fetchDecodePack(
  manifest: BenchManifest,
  entry: BenchAssetEntry,
  mode: CacheMode,
  signal: AbortSignal,
): Promise<LoadedPack> {
  const url = resolveAssetUrl(manifest, entry);
  const mark = `gfw-v4:${entry.bucket}:${entry.format}:${++loadSequence}`;
  performance.mark(`${mark}:fetch:start`);
  const fetchStart = performance.now();
  const response = await fetch(url, { signal, cache: mode === "cold" ? "no-store" : "force-cache" });
  if (!response.ok) throw new Error(`Track-pack HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const fetchMs = performance.now() - fetchStart;
  if (entry.bytes !== null && entry.bytes !== bytes.byteLength) throw new Error("Track-pack compressed byte count mismatch");
  if (entry.sha256 !== null) {
    const actual = await sha256Hex(bytes);
    if (!actual || actual.toLowerCase() !== entry.sha256.toLowerCase()) throw new Error("Track-pack SHA-256 mismatch");
  }
  performance.mark(`${mark}:fetch:end`);
  performance.measure(`${mark}:fetch`, `${mark}:fetch:start`, `${mark}:fetch:end`);
  performance.mark(`${mark}:decode:start`);
  const decodeStart = performance.now();
  const pack = await decodeTrackAsset(bytes, entry.format, packDate(entry.path, manifest), entry.bucket);
  const decodeMs = performance.now() - decodeStart;
  performance.mark(`${mark}:decode:end`);
  performance.measure(`${mark}:decode`, `${mark}:decode:start`, `${mark}:decode:end`);
  performance.mark(`${mark}:assemble:start`);
  const assembleStart = performance.now();
  // Touch all points so typed/binary and JSON variants include equivalent JS assembly work.
  let checksum = 0;
  for (const segment of pack.segments) for (const point of segment.points) checksum += point.lon + point.lat + point.epoch;
  if (!Number.isFinite(checksum)) throw new Error("Track-pack assembly checksum invalid");
  performance.mark(`${mark}:assemble:end`);
  performance.measure(`${mark}:assemble`, `${mark}:assemble:start`, `${mark}:assemble:end`);
  return {
    pack,
    timing: { url, transferBytes: bytes.byteLength, fetchMs, decodeMs, assembleMs: performance.now() - assembleStart, fromAppCache: false },
  };
}

function packDate(path: string, manifest: BenchManifest): string {
  for (const [date, day] of manifest.days) {
    if ([...day.assets.values()].some((entry) => entry.path === path)) return date;
  }
  throw new Error("Track-pack is not indexed by manifest day");
}

export async function loadPackWithLru(
  cache: DayPackLru,
  manifest: BenchManifest,
  entry: BenchAssetEntry,
  mode: CacheMode,
  signal: AbortSignal,
): Promise<LoadedPack> {
  const date = packDate(entry.path, manifest);
  const key = assetCacheKey(entry);
  const cached = cache.get(date, key);
  if (cached) {
    return { pack: cached, timing: { url: resolveAssetUrl(manifest, entry), transferBytes: 0, fetchMs: 0, decodeMs: 0, assembleMs: 0, fromAppCache: true } };
  }
  const loaded = await fetchDecodePack(manifest, entry, mode, signal);
  cache.put(date, key, loaded.pack);
  return loaded;
}

export function adjacentDates(manifest: BenchManifest, selectedDate: string): string[] {
  const dates = [...manifest.days.keys()].sort();
  const index = dates.indexOf(selectedDate);
  if (index < 0) return [];
  return [dates[index - 1], dates[index + 1]].filter((value): value is string => Boolean(value));
}
