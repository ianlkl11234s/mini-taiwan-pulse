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

class GfwPmTilesSource extends PmTilesSource {
  constructor(...args: any[]) {
    super(...args);
    cacheProtocolTileReads((this as unknown as SourceInternals)._protocol);
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
export const __test__ = { cacheProtocolTileReads };
