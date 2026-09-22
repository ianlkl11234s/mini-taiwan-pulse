const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FEATURES = 20_000;
const TIMEOUT_MS = 15_000;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_PARALLEL_FETCHES = 4;

export type PointBbox = readonly [number, number, number, number];

export interface PointSpatialPartitionConfig {
  manifestUrl: string;
  manifestSha256: string;
  sourceSha256: string;
}

interface PartitionManifest {
  schemaVersion: "pulse-point-partitions/1";
  source: { sha256: string; bytes: number; featureCount: number; reference: string };
  cellDegrees: number;
  shards: readonly { path: string; sha256: string; bytes: number; featureCount: number; bbox: PointBbox | null }[];
}

export interface PointPartitionRows {
  features: readonly unknown[];
  bytes: number;
  downloadedBytes: number;
  requests: number;
  cacheHit: boolean;
}

interface CachedAsset { bytes: Uint8Array; }
interface PendingAsset { promise: Promise<CachedAsset>; controller: AbortController; subscribers: number; settled: boolean; }
const assets = new Map<string, CachedAsset>();
const inFlight = new Map<string, PendingAsset>();
let cachedBytes = 0;

function fail(code: string): never { throw new Error(code); }
function hashLike(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function countLike(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_FEATURES; }
function byteLike(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_BYTES; }

function rootPath(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("//") || value.includes("?") || value.includes("#")) return false;
  const segments = value.slice(1).split("/");
  return segments.length > 0 && segments.every(segment => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(segment) && segment !== "." && segment !== "..");
}

function validBbox(value: unknown): value is PointBbox {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(part => typeof part === "number" && Number.isFinite(part))) return false;
  const bbox = value as number[];
  return bbox[0]! >= -180 && bbox[2]! <= 180 && bbox[1]! >= -90 && bbox[3]! <= 90 && bbox[0]! <= bbox[2]! && bbox[1]! <= bbox[3]!;
}

function intersects(left: PointBbox, right: PointBbox): boolean {
  return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1];
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function boundedBytes(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) fail("DATASET_TOO_LARGE");
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) fail("DATASET_TOO_LARGE");
    return bytes;
  }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); fail("DATASET_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function cacheAsset(key: string, asset: CachedAsset): void {
  const previous = assets.get(key);
  if (previous) cachedBytes -= previous.bytes.byteLength;
  assets.set(key, asset); cachedBytes += asset.bytes.byteLength;
  while (cachedBytes > MAX_CACHE_BYTES) {
    const oldest = assets.entries().next().value as [string, CachedAsset] | undefined;
    if (!oldest) break;
    assets.delete(oldest[0]); cachedBytes -= oldest[1].bytes.byteLength;
  }
}

async function fetchAsset(url: string, expectedSha256: string, signal?: AbortSignal): Promise<CachedAsset> {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  const key = `${url}#${expectedSha256}`;
  const cached = assets.get(key);
  if (cached) { assets.delete(key); assets.set(key, cached); return cached; }
  const pending = inFlight.get(key);
  if (pending && !pending.controller.signal.aborted) return waitForAsset(pending, signal);
  if (pending) inFlight.delete(key);
  const controller = new AbortController();
  const created = { controller, subscribers: 0, settled: false } as PendingAsset;
  created.promise = (async () => {
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
      if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) fail("DATASET_ASSET_MISSING");
      if (!response.ok) fail("DATASET_UNAVAILABLE");
      const bytes = await boundedBytes(response);
      if (await sha256(bytes) !== expectedSha256) fail("PARTITION_SHA_MISMATCH");
      const asset = { bytes };
      if (controller.signal.aborted) throw new DOMException("aborted", "AbortError");
      cacheAsset(key, asset);
      return asset;
    } catch (error) {
      if (timedOut && error instanceof Error && error.name === "AbortError") fail("REQUEST_TIMEOUT");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })();
  inFlight.set(key, created);
  created.promise.finally(() => { created.settled = true; if (inFlight.get(key) === created) inFlight.delete(key); }).catch(() => undefined);
  return waitForAsset(created, signal);
}

function waitForAsset(asset: PendingAsset, signal?: AbortSignal): Promise<CachedAsset> {
  if (signal?.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
  asset.subscribers++;
  return new Promise((resolve, reject) => {
    let released = false;
    const release = (cancelled: boolean) => {
      if (released) return; released = true; asset.subscribers--;
      signal?.removeEventListener("abort", onAbort);
      if (cancelled && asset.subscribers === 0 && !asset.settled) asset.controller.abort();
    };
    const onAbort = () => { release(true); reject(new DOMException("aborted", "AbortError")); };
    signal?.addEventListener("abort", onAbort, { once: true });
    asset.promise.then(value => { release(false); resolve(value); }, error => { release(false); reject(error); });
  });
}

function parseJson(bytes: Uint8Array): unknown {
  if (new TextDecoder().decode(bytes.slice(0, 100)).trimStart().startsWith("<")) fail("DATASET_ASSET_MISSING");
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return fail("INVALID_PARTITION"); }
}

function manifestFor(value: unknown, config: PointSpatialPartitionConfig, sourceReference: string): PartitionManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_PARTITION_MANIFEST");
  const manifest = value as Partial<PartitionManifest>;
  if (manifest.schemaVersion !== "pulse-point-partitions/1" || !manifest.source || !Array.isArray(manifest.shards)
    || !hashLike(manifest.source.sha256) || manifest.source.sha256 !== config.sourceSha256 || !byteLike(manifest.source.bytes)
    || !countLike(manifest.source.featureCount) || manifest.source.reference !== sourceReference
    || typeof manifest.cellDegrees !== "number" || !Number.isFinite(manifest.cellDegrees) || manifest.cellDegrees <= 0 || manifest.cellDegrees > 180
    || manifest.shards.length === 0 || manifest.shards.length > 1024) fail("INVALID_PARTITION_MANIFEST");
  const paths = new Set<string>(); let featureCount = 0; let nullShards = 0;
  for (const shard of manifest.shards) {
    if (!shard || typeof shard !== "object" || !hashLike(shard.sha256) || shard.path !== `${shard.sha256}.geojson` || !byteLike(shard.bytes)
      || !countLike(shard.featureCount) || paths.has(shard.path) || !(shard.bbox === null || validBbox(shard.bbox))) fail("INVALID_PARTITION_MANIFEST");
    paths.add(shard.path); featureCount += shard.featureCount;
    if (shard.bbox === null) nullShards++;
  }
  if (featureCount !== manifest.source.featureCount || nullShards > 1) fail("INVALID_PARTITION_MANIFEST");
  return manifest as PartitionManifest;
}

function directory(url: string): string {
  if (!rootPath(url)) fail("INVALID_PARTITION_MANIFEST_URL");
  return url.slice(0, url.lastIndexOf("/") + 1);
}

function collectionFeatures(value: unknown, shard: PartitionManifest["shards"][number]): readonly unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value) || (value as { type?: unknown }).type !== "FeatureCollection"
    || !Array.isArray((value as { features?: unknown }).features)) fail("INVALID_PARTITION_SHARD");
  const features = (value as { features: unknown[] }).features;
  if (features.length !== shard.featureCount || features.length > MAX_FEATURES) fail("INVALID_PARTITION_SHARD");
  return features;
}

function pointWithinShard(feature: object, bbox: PointBbox): boolean {
  const geometry = (feature as { geometry?: unknown }).geometry;
  if (!geometry || typeof geometry !== "object" || Array.isArray(geometry) || (geometry as { type?: unknown }).type !== "Point") return false;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  return Array.isArray(coordinates) && coordinates.length === 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number"
    && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]) && coordinates[0] >= -180 && coordinates[0] <= 180 && coordinates[1] >= -90 && coordinates[1] <= 90
    && coordinates[0] >= bbox[0] && coordinates[0] <= bbox[2] && coordinates[1] >= bbox[1] && coordinates[1] <= bbox[3];
}

/** Loads only shards that can intersect a validated bbox.  Parsing and row semantics remain in pointDatasetAdapter. */
async function loadPointPartitionsWithinDeadline(config: PointSpatialPartitionConfig, sourceReference: string, bbox: PointBbox, signal?: AbortSignal): Promise<PointPartitionRows> {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (!hashLike(config.manifestSha256) || !hashLike(config.sourceSha256) || !validBbox(bbox) || !rootPath(sourceReference) || !rootPath(config.manifestUrl)) fail("INVALID_PARTITION_CONFIG");
  const base = directory(config.manifestUrl);
  const manifestCached = assets.has(`${config.manifestUrl}#${config.manifestSha256}`);
  const manifestAsset = await fetchAsset(config.manifestUrl, config.manifestSha256, signal);
  const manifest = manifestFor(parseJson(manifestAsset.bytes), config, sourceReference);
  const selected = manifest.shards.filter(shard => shard.bbox === null || intersects(shard.bbox, bbox));
  if (manifestAsset.bytes.byteLength + selected.reduce((total, shard) => total + shard.bytes, 0) > MAX_BYTES) fail("DATASET_TOO_LARGE");
  const shardCached = selected.map(shard => assets.has(`${base}${shard.path}#${shard.sha256}`));
  const assetsForShard: CachedAsset[] = [];
  for (let index = 0; index < selected.length; index += MAX_PARALLEL_FETCHES) {
    assetsForShard.push(...await Promise.all(selected.slice(index, index + MAX_PARALLEL_FETCHES).map(shard => fetchAsset(`${base}${shard.path}`, shard.sha256, signal))));
  }
  let bytes = manifestAsset.bytes.byteLength;
  let downloadedBytes = manifestCached ? 0 : manifestAsset.bytes.byteLength;
  let requests = manifestCached ? 0 : 1;
  const ordinals = new Set<number>();
  const features: unknown[] = [];
  for (let index = 0; index < selected.length; index++) {
    const shard = selected[index]!; const asset = assetsForShard[index]!;
    if (asset.bytes.byteLength !== shard.bytes) fail("PARTITION_BYTE_MISMATCH");
    bytes += asset.bytes.byteLength;
    if (!shardCached[index]) { downloadedBytes += asset.bytes.byteLength; requests++; }
    for (const feature of collectionFeatures(parseJson(asset.bytes), shard)) {
      if (!feature || typeof feature !== "object" || Array.isArray(feature) || !Number.isSafeInteger((feature as { sourceOrdinal?: unknown }).sourceOrdinal)
        || (feature as { sourceOrdinal: number }).sourceOrdinal < 0 || (feature as { sourceOrdinal: number }).sourceOrdinal >= manifest.source.featureCount || ordinals.has((feature as { sourceOrdinal: number }).sourceOrdinal)) fail("INVALID_PARTITION_ORDINAL");
      if (shard.bbox !== null && !pointWithinShard(feature, shard.bbox)) fail("INVALID_PARTITION_SHARD_SCOPE");
      ordinals.add((feature as { sourceOrdinal: number }).sourceOrdinal);
      features.push(feature);
    }
  }
  if (features.length > MAX_FEATURES || bytes > MAX_BYTES) fail("DATASET_TOO_LARGE");
  features.sort((left, right) => (left as { sourceOrdinal: number }).sourceOrdinal - (right as { sourceOrdinal: number }).sourceOrdinal);
  return { features, bytes, downloadedBytes, requests, cacheHit: manifestCached && shardCached.every(Boolean) };
}

/** One deadline covers manifest discovery and every selected shard. */
export async function loadPointPartitions(config: PointSpatialPartitionConfig, sourceReference: string, bbox: PointBbox, signal?: AbortSignal): Promise<PointPartitionRows> {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  const controller = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  const onAbort = () => controller.abort(); signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await loadPointPartitionsWithinDeadline(config, sourceReference, bbox, controller.signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut && error instanceof Error && error.name === "AbortError") fail("REQUEST_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", onAbort);
  }
}

export function clearPointPartitionCache(): void { assets.clear(); inFlight.clear(); cachedBytes = 0; }
