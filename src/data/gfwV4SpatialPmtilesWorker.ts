/// <reference lib="webworker" />
import { PMTiles, type RangeResponse, type Source } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { GFW_V4_TRACK_FRAME_SOURCE_LAYER, parseGfwV4TrackFrameMvtFeature } from "./gfwV4SpatialMvt";
import { buildGfwV4SpatialFrame, type GfwV4SpatialObservation } from "./gfwV4SpatialFrame";

type LoadRequest = { type: "load"; assets: readonly { url: string; bucket: number; identity: string }[]; tiles: readonly { z: number; x: number; y: number }[]; epoch: number; trailingSeconds: number };
type RenderRequest = { type: "render"; epoch: number; trailingSeconds: number };
type Request = LoadRequest | RenderRequest;
type WireTelemetry = { requestCount: number; wireBytes: number; decodedBytes: number; status206: number; status200: number; };
const toLngLat = (x: number, y: number, extent: number, tile: { z: number; x: number; y: number }) => { const scale = 2 ** tile.z; const worldX = (tile.x + x / extent) / scale; const worldY = (tile.y + y / extent) / scale; return { lon: worldX * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180 / Math.PI }; };

/** Every PMTiles header, directory and tile Range is counted before decode. */
function measuredSource(url: string, telemetry: WireTelemetry): Source {
  return {
    getKey: () => url,
    async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
      const headers = new Headers({ Range: `bytes=${offset}-${offset + length - 1}` });
      if (etag) headers.set("If-Match", etag);
      const response = await fetch(url, { headers, signal, cache: "default" });
      if (response.status !== 206 && response.status !== 200) throw new Error(`PMTiles Range HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const contentLength = Number(response.headers.get("Content-Length"));
      telemetry.requestCount += 1;
      telemetry.wireBytes += Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : data.byteLength;
      if (response.status === 206) telemetry.status206 += 1; else telemetry.status200 += 1;
      return { data, etag: response.headers.get("ETag") ?? undefined, expires: response.headers.get("Expires") ?? undefined, cacheControl: response.headers.get("Cache-Control") ?? undefined };
    },
  };
}

let loadedObservations: GfwV4SpatialObservation[] = [];

function postFrame(epoch: number, trailingSeconds: number, telemetry?: { cold: WireTelemetry; warm: WireTelemetry; started: number }) {
  const frame = buildGfwV4SpatialFrame(loadedObservations, epoch, trailingSeconds);
  const value = { ok: true, frameEpoch: epoch, ...frame, cold: telemetry?.cold, warm: telemetry?.warm, rangeBytes: telemetry?.cold.wireBytes ?? 0, decodedBytes: telemetry?.cold.decodedBytes ?? 0, workerMs: telemetry ? performance.now() - telemetry.started : 0 };
  (self as unknown as { postMessage: (value: unknown, transfer: Transferable[]) => void }).postMessage(value, [frame.points.buffer, frame.buckets.buffer, frame.memberCounts.buffer, frame.segments.buffer, frame.segmentBuckets.buffer]);
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const started = performance.now();
  try {
    if (data.type === "render") { postFrame(data.epoch, data.trailingSeconds); return; }
    const observations: GfwV4SpatialObservation[] = []; const identities = new Set<string>();
    const cold: WireTelemetry = { requestCount: 0, wireBytes: 0, decodedBytes: 0, status206: 0, status200: 0 };
    const archives = data.assets.map((asset) => ({ ...asset, archive: new PMTiles(measuredSource(asset.url, cold)) }));
    for (const asset of archives) {
      for (const tileRef of data.tiles) {
        const tile = await asset.archive.getZxy(tileRef.z, tileRef.x, tileRef.y);
        if (!tile) continue;
        cold.decodedBytes += tile.data.byteLength;
        // pbf 4.x starts DataView at the backing buffer origin; PMTiles may return
        // a non-zero Uint8Array view, so copy before decoding float successor fields.
        const layer = new VectorTile(new Pbf(tile.data.slice())).layers[GFW_V4_TRACK_FRAME_SOURCE_LAYER];
        if (!layer) throw new Error(`missing required MVT layer ${GFW_V4_TRACK_FRAME_SOURCE_LAYER}`);
        for (let index = 0; index < layer.length; index++) {
          const feature = layer.feature(index); const geometry = feature.loadGeometry(); const point = geometry[0]?.[0];
          if (!point) throw new Error("invalid MVT point geometry");
          const lngLat = toLngLat(point.x, point.y, layer.extent, tileRef);
          const parsed = parseGfwV4TrackFrameMvtFeature({ id: feature.id, type: feature.type, properties: feature.properties, geometry }, lngLat.lon, lngLat.lat);
          if (!parsed) throw new Error("invalid frozen GFW v4 MVT feature");
          // A fixed-z PMTiles feature may occur in neighbouring viewport tiles.
          // Keep distinct hourly observations for truthful trail reconstruction.
          const identity = `${asset.identity}|${parsed.vesselId}`;
          if (identities.has(identity)) continue;
          identities.add(identity);
          observations.push({ ...parsed, bucket: asset.bucket });
        }
      }
    }
    // A second pass reuses exactly the same PMTiles archives. It proves the in-worker
    // warm path (header/directory cache) separately from cold HTTP wire cost.
    const warm: WireTelemetry = { requestCount: 0, wireBytes: 0, decodedBytes: 0, status206: 0, status200: 0 };
    for (const asset of archives) for (const tileRef of data.tiles) {
      const tile = await asset.archive.getZxy(tileRef.z, tileRef.x, tileRef.y);
      if (tile) warm.decodedBytes += tile.data.byteLength;
    }
    loadedObservations = observations;
    postFrame(data.epoch, data.trailingSeconds, { cold, warm, started });
  } catch (error) { (self as unknown as { postMessage: (value: unknown) => void }).postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
};
