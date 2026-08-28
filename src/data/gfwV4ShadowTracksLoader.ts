import { loadPackWithLru, DayPackLru, ForegroundRequestGate } from "../gfw-v4-bench/cache";
import { findAsset, parseBenchManifest } from "../gfw-v4-bench/contract";
import {
  TRACK_BUCKETS,
  type BenchManifest,
  type TrackAssetFormat,
  type TrackBucket,
  type TrackPack,
} from "../gfw-v4-bench/types";

export const GFW_V4_SHADOW_MANIFEST_URL = "/gfw-v4-browser-manifest.json";

export interface GfwV4ShadowLoadResult {
  displayDate: string;
  packs: TrackPack[];
  transferBytes: number;
  fetchMs: number;
  decodeMs: number;
  assembleMs: number;
  cacheDays: number;
  cachePacks: number;
}

export function isGfwV4ShadowRuntimeEnabled(
  isDev: boolean,
  search = globalThis.location?.search ?? "",
): boolean {
  return isDev && new URLSearchParams(search).get("gfwV4Shadow") === "1";
}

export function normalizeGfwV4Buckets(values: readonly TrackBucket[]): TrackBucket[] {
  const selected = new Set(values);
  return TRACK_BUCKETS.filter((bucket) => selected.has(bucket));
}

export function selectGfwV4ShadowAssets(
  manifest: BenchManifest,
  displayDate: string,
  buckets: readonly TrackBucket[],
  format: TrackAssetFormat,
) {
  return normalizeGfwV4Buckets(buckets).map((bucket) => {
    const entry = findAsset(manifest, displayDate, bucket, format);
    if (!entry) throw new Error(`GFW v4 shadow asset missing: ${displayDate}/${bucket}/${format}`);
    return entry;
  });
}

/**
 * Foreground-only loader for the local v4 shadow layer. Disabled buckets never
 * enter the request list. A new timeline day/bucket selection aborts the old
 * foreground request while decoded immutable packs remain in the 3-day LRU.
 */
export class GfwV4ShadowTracksLoader {
  private readonly cache = new DayPackLru(3);
  private readonly requests = new ForegroundRequestGate();
  private manifestPromise: Promise<BenchManifest> | null = null;

  constructor(
    private readonly manifestUrl = GFW_V4_SHADOW_MANIFEST_URL,
    // Native Window.fetch 必須保留 receiver；把裸函式存成 instance method 後呼叫會 Illegal invocation。
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  loadManifest(): Promise<BenchManifest> {
    this.manifestPromise ??= this.fetchImpl(this.manifestUrl, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(`GFW v4 shadow manifest HTTP ${response.status}`);
      const parsed = parseBenchManifest(await response.json(), new URL(this.manifestUrl, globalThis.location?.origin ?? "http://localhost").toString());
      if (!parsed) throw new Error("Invalid GFW v4 shadow manifest contract");
      return parsed;
    }).catch((error) => {
      this.manifestPromise = null;
      throw error;
    });
    return this.manifestPromise;
  }

  async loadDay(
    displayDate: string,
    buckets: readonly TrackBucket[],
    format: TrackAssetFormat = "binary",
  ): Promise<GfwV4ShadowLoadResult> {
    const controller = this.requests.next();
    const manifest = await this.loadManifest();
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const entries = selectGfwV4ShadowAssets(manifest, displayDate, buckets, format);
    const loaded = await Promise.all(entries.map((entry) =>
      loadPackWithLru(this.cache, manifest, entry, "warm", controller.signal),
    ));
    return {
      displayDate,
      packs: loaded.map((item) => item.pack),
      transferBytes: loaded.reduce((sum, item) => sum + item.timing.transferBytes, 0),
      fetchMs: loaded.reduce((sum, item) => sum + item.timing.fetchMs, 0),
      decodeMs: loaded.reduce((sum, item) => sum + item.timing.decodeMs, 0),
      assembleMs: loaded.reduce((sum, item) => sum + item.timing.assembleMs, 0),
      cacheDays: this.cache.dayCount(),
      cachePacks: this.cache.packCount(),
    };
  }

  abort(): void { this.requests.abort(); }
  clear(): void { this.requests.abort(); this.cache.clear(); this.manifestPromise = null; }
}
