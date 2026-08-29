// GFW hourly Grid keeps an immutable archive mounted across a UTC hour. Mapbox can
// request a vector tile again when only a paint expression changes; mapbox-pmtiles
// otherwise forwards that request to a fresh HTTP Range read. Cache decoded archive
// tile bytes per retained source so timeline crossfade remains a pure GPU repaint.
import mapboxgl from "mapbox-gl";
// @ts-expect-error mapbox-pmtiles does not ship declarations for its ESM build.
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

export const GFW_PMTILES_SOURCE_TYPE = "gfw-pmtile-source";

type ProtocolCallback = (error?: unknown, data?: Uint8Array, cacheControl?: string, expires?: string) => void;
type ProtocolRequest = { url: string };
type ProtocolCancel = { cancel: () => void };
type Protocol = {
  tile: (request: ProtocolRequest, callback: ProtocolCallback) => ProtocolCancel;
};
type CachedTile = { data: Uint8Array; cacheControl: string; expires: string };
type SourceInternals = { _protocol: Protocol };

const MAX_CACHED_TILES_PER_ARCHIVE = 192;

function cloneBytes(data: Uint8Array): Uint8Array {
  // Worker transfer may detach the byte buffer passed to Mapbox. The cache owns an
  // independent copy and every consumer receives another independent view.
  return data.slice();
}

function cacheProtocolTileReads(protocol: Protocol): void {
  const original = protocol.tile.bind(protocol);
  const settled = new Map<string, CachedTile>();
  const pending = new Map<string, Promise<CachedTile>>();

  const touch = (key: string, value: CachedTile) => {
    settled.delete(key);
    settled.set(key, value);
    while (settled.size > MAX_CACHED_TILES_PER_ARCHIVE) {
      const oldest = settled.keys().next().value;
      if (oldest === undefined) break;
      settled.delete(oldest);
    }
  };

  protocol.tile = (request, callback) => {
    const key = request.url;
    let cancelled = false;
    const cached = settled.get(key);
    const deliver = (value: CachedTile) => {
      if (!cancelled) callback(undefined, cloneBytes(value.data), value.cacheControl, value.expires);
    };
    if (cached) {
      touch(key, cached);
      queueMicrotask(() => deliver(cached));
      return { cancel: () => { cancelled = true; } };
    }

    let read = pending.get(key);
    if (!read) {
      read = new Promise<CachedTile>((resolve, reject) => {
        original(request, (error, data, cacheControl = "", expires = "") => {
          if (error) {
            reject(error);
            return;
          }
          if (!data) {
            reject(new Error("PMTiles protocol returned no tile data"));
            return;
          }
          const value = { data: cloneBytes(data), cacheControl, expires };
          touch(key, value);
          resolve(value);
        });
      });
      pending.set(key, read);
      void read.then(
        () => pending.delete(key),
        () => pending.delete(key),
      );
    }
    void read.then(deliver, (error) => {
      if (!cancelled) callback(error);
    });
    // A cancelled Mapbox tile must not abort the shared archive read: another repaint
    // can immediately need the same immutable bytes, and the completed result is warm.
    return { cancel: () => { cancelled = true; } };
  };
}

type WorkerActor = { send: (name: string, params: unknown, callback: unknown, ...rest: unknown[]) => unknown };
type PmTile = {
  uid: number;
  state: string;
  tileID: { canonical: { url: (tiles: unknown, scheme: unknown) => string }; overscaledZ: number; overscaleFactor: () => number };
  tileZoom: number;
  actor?: WorkerActor;
  aborted?: boolean;
  request?: unknown;
  resourceTiming?: unknown;
  isSymbolTile?: boolean;
  isExtraShadowCaster?: boolean;
  reloadCallback?: ((error?: unknown, data?: unknown) => void) | null;
  loadVectorData: (data: unknown, painter: unknown) => void;
  setExpiryData: (data: unknown) => void;
};
type TileCallback = (error?: unknown, data?: unknown) => void;

/**
 * True for the branch native `VectorTileSource.loadTile` answers with a `reloadTile` message:
 * the worker still owns a parsed tile for this uid, so only re-evaluation is needed.
 */
export function shouldReloadPmTile(tile: Pick<PmTile, "actor" | "state">): boolean {
  return Boolean(tile.actor) && tile.state !== "expired" && tile.state !== "loading";
}

type PmSourceInternals = {
  map?: Record<string, any>;
  tiles: unknown;
  scheme: unknown;
  tileSize: number;
  id: string;
  scope: unknown;
  promoteId: unknown;
};

/**
 * Upstream defect (mapbox-pmtiles dist `loadVectorTile`): every worker message is sent as
 * `loadTile`, including for a tile the worker has already parsed. Native mapbox-gl 3.18.1
 * sends `reloadTile` in that branch, so a second `loadTile` on a live uid re-enters the
 * worker's load path and can race the in-flight parse into a loaded-but-empty tile.
 *
 * Any paint change on a data-driven property and *every* layout change (including a
 * `visibility` flip) makes mapbox-gl reload the source cache, so this branch is reachable
 * even though the timeline path no longer triggers relayouts. Mirror the native branch and
 * leave everything else — first load, expired, in-flight, unexpected shapes — to the library
 * by returning `false`.
 */
function reloadPmVectorTile(
  source: PmSourceInternals,
  tile: PmTile,
  callback: TileCallback,
  retry: (tile: PmTile, callback: TileCallback) => void,
): boolean {
  const map = source.map;
  if (!shouldReloadPmTile(tile) || !map?.painter || typeof tile.loadVectorData !== "function") return false;
  let params: Record<string, unknown>;
  try {
    const url = map._requestManager.normalizeTileURL(tile.tileID.canonical.url(source.tiles, source.scheme));
    params = {
      request: map._requestManager.transformRequest(url, "Tile"),
      // Native reload sends no bytes: the worker re-parses the tile it already holds.
      data: undefined,
      uid: tile.uid,
      tileID: tile.tileID,
      tileZoom: tile.tileZoom,
      zoom: tile.tileID.overscaledZ,
      tileSize: source.tileSize * tile.tileID.overscaleFactor(),
      type: "vector",
      source: source.id,
      scope: source.scope,
      showCollisionBoxes: map.showCollisionBoxes,
      promoteId: source.promoteId,
      isSymbolTile: tile.isSymbolTile,
      extraShadowCaster: tile.isExtraShadowCaster,
    };
  } catch {
    return false;
  }
  const done: TileCallback = (error, data) => {
    delete tile.request;
    if (tile.aborted) {
      callback(null);
      return;
    }
    if (error && (error as { status?: number }).status !== 404) {
      callback(error);
      return;
    }
    if (data && (data as { resourceTiming?: unknown }).resourceTiming) {
      tile.resourceTiming = (data as { resourceTiming?: unknown }).resourceTiming;
    }
    if (map._refreshExpiredTiles && data) tile.setExpiryData(data);
    tile.loadVectorData(data, map.painter);
    callback(null, data);
    if (tile.reloadCallback) {
      const pending = tile.reloadCallback;
      tile.reloadCallback = null;
      retry(tile, pending);
    }
  };
  tile.request = tile.actor!.send("reloadTile", params, done);
  return true;
}

class GfwPmTilesSource extends PmTilesSource {
  constructor(...args: any[]) {
    super(...args);
    cacheProtocolTileReads((this as unknown as SourceInternals)._protocol);
  }

  loadVectorTile(tile: PmTile, callback: TileCallback): void {
    const self = this as unknown as PmSourceInternals;
    const retry = (nextTile: PmTile, nextCallback: TileCallback) => { this.loadVectorTile(nextTile, nextCallback); };
    if (reloadPmVectorTile(self, tile, callback, retry)) return;
    super.loadVectorTile(tile, callback);
  }
}

let registered = false;

export function registerGfwPmtilesSourceTypeOnce(): void {
  if (registered) return;
  registered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (type: string, implementation: unknown) => void };
    }).Style;
    Style.setSourceType(GFW_PMTILES_SOURCE_TYPE, GfwPmTilesSource);
  } catch {
    // A previously initialized map may have registered this type already.
  }
}

// Exported for a focused no-Range regression test without depending on Mapbox internals.
export const __test__ = { cacheProtocolTileReads, reloadPmVectorTile };
