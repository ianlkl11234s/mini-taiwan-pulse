/// <reference lib="webworker" />
import { PMTiles, type RangeResponse, type Source } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { GFW_V4_TRACK_FRAME_SOURCE_LAYER, parseGfwV4TrackFrameMvtFeature } from "./gfwV4SpatialMvt";
import { buildGfwV4SpatialFrame, type GfwV4SpatialObservation } from "./gfwV4SpatialFrame";
import type {
  GfwV4TrackAssetRef, GfwV4TrackLoadRequest, GfwV4TrackShardTileRef, GfwV4TrackTileCacheTelemetry,
  GfwV4TrackWireTelemetry, GfwV4TrackWorkerMessage,
} from "./gfwV4TrackFrameProtocol";

/**
 * 常駐 Worker：與 layer 同壽命，換小時不重建。
 * PMTiles archive（header/directory）與已解碼的 (url, tile) 觀測都跨小時保留，
 * 相鄰小時的 H-1/H/H+1 視窗因此只有真正新增的那一小時會發 Range request。
 */
// 一次 load 是「enabled bucket × H-1/H/H+1」個 asset ×「視窗內的 z6 tile」，
// 東亞 bbox 全開約 18 × 16 ≈ 288 筆。上限必須遠大於單次 load，否則同一批
// tile 會在同一次 load 內互相擠掉，快取等於沒有。
const MAX_CACHED_ARCHIVES = 192;
const MAX_CACHED_TILES = 1_024;

const toLngLat = (x: number, y: number, extent: number, tile: GfwV4TrackShardTileRef) => { const scale = 2 ** tile.z; const worldX = (tile.x + x / extent) / scale; const worldY = (tile.y + y / extent) / scale; return { lon: worldX * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180 / Math.PI }; };

/** 每一次 PMTiles header / directory / tile Range 都在 decode 前先計數。 */
const wire: GfwV4TrackWireTelemetry = { requestCount: 0, wireBytes: 0, decodedBytes: 0, status206: 0, status200: 0 };
const wireDelta = (before: GfwV4TrackWireTelemetry): GfwV4TrackWireTelemetry => ({
  requestCount: wire.requestCount - before.requestCount, wireBytes: wire.wireBytes - before.wireBytes,
  decodedBytes: wire.decodedBytes - before.decodedBytes, status206: wire.status206 - before.status206, status200: wire.status200 - before.status200,
});

function measuredSource(url: string): Source {
  return {
    getKey: () => url,
    async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
      const headers = new Headers({ Range: `bytes=${offset}-${offset + length - 1}` });
      if (etag) headers.set("If-Match", etag);
      const response = await fetch(url, { headers, signal, cache: "default" });
      if (response.status !== 206 && response.status !== 200) throw new Error(`PMTiles Range HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const contentLength = Number(response.headers.get("Content-Length"));
      wire.requestCount += 1;
      wire.wireBytes += Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : data.byteLength;
      if (response.status === 206) wire.status206 += 1; else wire.status200 += 1;
      return { data, etag: response.headers.get("ETag") ?? undefined, expires: response.headers.get("Expires") ?? undefined, cacheControl: response.headers.get("Cache-Control") ?? undefined };
    },
  };
}

/** 插入序即 LRU 序；命中時 re-set 讓當下 H-1/H/H+1 視窗不會被自己擠掉。 */
function touch<K, V>(cache: Map<K, V>, key: K, value: V, limit: number, onEvict?: () => void): V {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) { const oldest = cache.keys().next(); if (oldest.done) break; cache.delete(oldest.value); onEvict?.(); }
  return value;
}

const archives = new Map<string, PMTiles>();
const tileCache = new Map<string, readonly GfwV4SpatialObservation[]>();
/**
 * 曾經真的抓過的 (url, tile) key。用來把「同 tile 重複請求數」量出來 ——
 * 那是 bench 第二 pass 刪掉之後，快取有效性的等價驗證點。
 * 自己也用 LRU 上限，避免長 session 無限成長；飽和時如實回報可能低估。
 */
const MAX_TRACKED_TILE_KEYS = 8_192;
const fetchedTileKeys = new Map<string, true>();
const tileStats = { lookups: 0, cacheHits: 0, networkFetches: 0, duplicateFetches: 0, evictions: 0 };
const tileDelta = (before: typeof tileStats) => ({
  lookups: tileStats.lookups - before.lookups, cacheHits: tileStats.cacheHits - before.cacheHits,
  networkFetches: tileStats.networkFetches - before.networkFetches,
  duplicateFetches: tileStats.duplicateFetches - before.duplicateFetches,
  evictions: tileStats.evictions - before.evictions,
  trackingSaturated: fetchedTileKeys.size >= MAX_TRACKED_TILE_KEYS,
});

const archiveFor = (url: string): PMTiles => {
  const cached = archives.get(url);
  return cached ? touch(archives, url, cached, MAX_CACHED_ARCHIVES) : touch(archives, url, new PMTiles(measuredSource(url)), MAX_CACHED_ARCHIVES);
};

async function decodeTile(asset: GfwV4TrackAssetRef, tileRef: GfwV4TrackShardTileRef): Promise<readonly GfwV4SpatialObservation[]> {
  const tile = await archiveFor(asset.url).getZxy(tileRef.z, tileRef.x, tileRef.y);
  if (!tile) return [];
  wire.decodedBytes += tile.data.byteLength;
  // pbf 4.x starts DataView at the backing buffer origin; PMTiles may return
  // a non-zero Uint8Array view, so copy before decoding float successor fields.
  const layer = new VectorTile(new Pbf(tile.data.slice())).layers[GFW_V4_TRACK_FRAME_SOURCE_LAYER];
  if (!layer) throw new Error(`missing required MVT layer ${GFW_V4_TRACK_FRAME_SOURCE_LAYER}`);
  const observations: GfwV4SpatialObservation[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index); const geometry = feature.loadGeometry(); const point = geometry[0]?.[0];
    if (!point) throw new Error("invalid MVT point geometry");
    const lngLat = toLngLat(point.x, point.y, layer.extent, tileRef);
    const parsed = parseGfwV4TrackFrameMvtFeature({ id: feature.id, type: feature.type, properties: feature.properties, geometry }, lngLat.lon, lngLat.lat);
    if (!parsed) throw new Error("invalid frozen GFW v4 MVT feature");
    observations.push({ ...parsed, bucket: asset.bucket });
  }
  return observations;
}

/** 最後一個「收到」的 load generation；用來丟棄被後續 load 取代的完成結果。 */
let latestLoadGeneration = -1;
/** 已 commit 到 loadedObservations 的 generation；render 只服務這一個。 */
let committedGeneration = -1;
let loadedObservations: readonly GfwV4SpatialObservation[] = [];
/** A short epoch-keyed cache lets clicks resolve against the exact applied frame. */
const pickFrames = new Map<string, readonly ReturnType<typeof buildGfwV4SpatialFrame>["hitGroups"][number][]>();
const rememberPickFrame = (generation: number, epoch: number, groups: ReturnType<typeof buildGfwV4SpatialFrame>["hitGroups"]) => {
  const key = `${generation}|${epoch}`;
  pickFrames.delete(key); pickFrames.set(key, groups);
  // With one render in flight, three frames cover applied + current + one queued
  // message without retaining several full metadata copies on dense viewports.
  while (pickFrames.size > 3) {
    const oldest = pickFrames.keys().next();
    if (oldest.done) break;
    pickFrames.delete(oldest.value);
  }
};

function postFrame(generation: number, epoch: number, trailingSeconds: number, includeHits: boolean, telemetry?: { wire: GfwV4TrackWireTelemetry; tiles: GfwV4TrackTileCacheTelemetry; started: number }) {
  const frame = buildGfwV4SpatialFrame(loadedObservations, epoch, trailingSeconds);
  rememberPickFrame(generation, epoch, frame.hitGroups);
  const value = {
    ok: true as const, generation, loaded: true, frameEpoch: epoch,
    points: frame.points, buckets: frame.buckets, memberCounts: frame.memberCounts, pointAlphas: frame.pointAlphas,
    segments: frame.segments, segmentBuckets: frame.segmentBuckets, segmentAlphas: frame.segmentAlphas,
    // 只有「新 generation 首次 apply」需要 hit group；同小時的插值 tick 不重建，
    // 也就不必把 ~11k 個 member 物件做 structured clone 送回 main thread。
    hitGroups: includeHits ? frame.hitGroups : null,
    wire: telemetry?.wire, tiles: telemetry?.tiles, workerMs: telemetry ? performance.now() - telemetry.started : undefined,
  };
  (self as unknown as { postMessage: (value: unknown, transfer: Transferable[]) => void })
    .postMessage(value, [
      frame.points.buffer, frame.buckets.buffer, frame.memberCounts.buffer, frame.pointAlphas.buffer,
      frame.segments.buffer, frame.segmentBuckets.buffer, frame.segmentAlphas.buffer,
    ]);
}

/** 這個 generation 還沒 commit：明確回 `loaded:false`，main thread 會保留現有畫面。 */
function postNotReady(generation: number, epoch: number) {
  const value = {
    ok: true as const, generation, loaded: false, frameEpoch: epoch,
    points: new Float32Array(0), buckets: new Uint8Array(0), memberCounts: new Uint16Array(0), pointAlphas: new Uint8Array(0),
    segments: new Float32Array(0), segmentBuckets: new Uint8Array(0), segmentAlphas: new Uint8Array(0), hitGroups: null,
  };
  (self as unknown as { postMessage: (value: unknown) => void }).postMessage(value);
}

async function handleLoad(request: GfwV4TrackLoadRequest, started: number) {
  // 同步認領：兩個 load 交錯時，較舊的那個完成後不得覆蓋較新的資料。
  latestLoadGeneration = request.generation;
  const before = { ...wire };
  const tilesBefore = { ...tileStats };
  const evicted = () => { tileStats.evictions += 1; };
  const collected: { identity: string; observations: readonly GfwV4SpatialObservation[] }[] = [];
  for (const asset of request.assets) {
    for (const tileRef of request.tiles) {
      const key = `${asset.url}|${tileRef.z}/${tileRef.x}/${tileRef.y}`;
      tileStats.lookups += 1;
      const cached = tileCache.get(key);
      if (cached) { tileStats.cacheHits += 1; collected.push({ identity: asset.identity, observations: touch(tileCache, key, cached, MAX_CACHED_TILES, evicted) }); continue; }
      tileStats.networkFetches += 1;
      if (fetchedTileKeys.has(key)) tileStats.duplicateFetches += 1;
      touch(fetchedTileKeys, key, true, MAX_TRACKED_TILE_KEYS);
      const decoded = await decodeTile(asset, tileRef);
      // 每個 await 都是讓步點：被後續 load 取代就立刻停手，不寫任何共用狀態。
      if (request.generation !== latestLoadGeneration) return;
      collected.push({ identity: asset.identity, observations: touch(tileCache, key, decoded, MAX_CACHED_TILES, evicted) });
    }
  }
  if (request.generation !== latestLoadGeneration) return;
  // 同一個固定 z 的 PMTiles feature 可能出現在相鄰 viewport tile。
  // 逐 asset 去重，保留每個小時各自的觀測以還原真實航跡。
  const identities = new Set<string>();
  const observations: GfwV4SpatialObservation[] = [];
  for (const entry of collected) {
    for (const observation of entry.observations) {
      const identity = `${entry.identity}|${observation.vesselId}`;
      if (identities.has(identity)) continue;
      identities.add(identity);
      observations.push(observation);
    }
  }
  loadedObservations = observations;
  committedGeneration = request.generation;
  postFrame(request.generation, request.epoch, request.trailingSeconds, false, { wire: wireDelta(before), tiles: tileDelta(tilesBefore), started });
}

self.onmessage = async ({ data }: MessageEvent<GfwV4TrackWorkerMessage>) => {
  const started = performance.now();
  try {
    if (data.type === "pick") {
      const groups = pickFrames.get(`${data.generation}|${data.frameEpoch}`);
      (self as unknown as { postMessage: (value: unknown) => void }).postMessage({
        type: "pick", ok: true, pickRequestId: data.pickRequestId,
        generation: data.generation, frameEpoch: data.frameEpoch,
        group: groups?.[data.pointIndex] ?? null,
      });
      return;
    }
    if (data.type === "render") {
      if (data.generation !== committedGeneration) { postNotReady(data.generation, data.epoch); return; }
      postFrame(data.generation, data.epoch, data.trailingSeconds, data.includeHits);
      return;
    }
    await handleLoad(data, started);
  } catch (error) {
    if (data.type === "pick") {
      (self as unknown as { postMessage: (value: unknown) => void }).postMessage({
        type: "pick", ok: false, pickRequestId: data.pickRequestId,
        generation: data.generation, frameEpoch: data.frameEpoch,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    (self as unknown as { postMessage: (value: unknown) => void })
      .postMessage({ ok: false, generation: data.generation, error: error instanceof Error ? error.message : String(error) });
  }
};
