/**
 * Authenticated PMTiles source dedicated to the private coral archive.
 *
 * `mapbox-pmtiles` creates `new PMTiles(url)` internally, whose FetchSource cannot
 * refresh Authorization headers.  This source replaces that instance before Mapbox
 * calls `load()`.  Do not register it for public PMTiles sources.
 */
import mapboxgl from "mapbox-gl";
import { PMTiles, Protocol, type RangeResponse, type Source } from "pmtiles";
// @ts-expect-error mapbox-pmtiles does not ship declarations for its ESM build.
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

export const PRIVATE_CORAL_PMTILES_SOURCE_TYPE = "private-coral-pmtile-source";
export const MAX_PRIVATE_CORAL_RANGE_BYTES = 8 * 1024 * 1024;
export const PRIVATE_CORAL_REQUEST_TIMEOUT_MS = 30_000;

export type PrivateCoralPmtilesOptions = {
  url: string;
  /** Called for every HTTP Range request, so expired credentials are never retained. */
  getToken?: () => Promise<string | null | undefined> | string | null | undefined;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function httpError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  if (status !== undefined) error.status = status;
  return error;
}

function linkAbortSignal(external: AbortSignal | undefined, local: AbortController): () => void {
  if (!external) return () => undefined;
  const abort = () => local.abort(external.reason);
  if (external.aborted) abort();
  else external.addEventListener("abort", abort, { once: true });
  return () => external.removeEventListener("abort", abort);
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Private coral PMTiles request aborted", "AbortError");
}

async function awaitAbortable<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw abortError(signal);
  return await new Promise<T>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(abortError(signal));
    };
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(
      (value) => { cleanup(); resolve(value); },
      (error: unknown) => { cleanup(); reject(error); },
    );
  });
}

function cancelResponseBody(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}

/** A per-mounted-source PMTiles Source; it is intentionally never shared by URL. */
export class PrivateCoralFetchSource implements Source {
  private readonly controllers = new Set<AbortController>();
  private disposed = false;

  constructor(
    readonly url: string,
    private readonly getToken: NonNullable<PrivateCoralPmtilesOptions["getToken"]>,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  getKey(): string {
    // This instance owns a new PMTiles cache. The URL is only a key inside that instance,
    // therefore entries can never be re-used by another account's mounted source.
    return this.url;
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async getBytes(offset: number, length: number, passedSignal?: AbortSignal): Promise<RangeResponse> {
    if (this.disposed) throw httpError("Private coral PMTiles source was disposed");
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0 || length > MAX_PRIVATE_CORAL_RANGE_BYTES) {
      throw httpError(`Private coral PMTiles refused invalid Range ${offset}+${length}`);
    }

    const controller = new AbortController();
    this.controllers.add(controller);
    const unlinkAbort = linkAbortSignal(passedSignal, controller);
    const timeout = setTimeout(
      () => controller.abort(httpError(`Private coral PMTiles request timed out after ${PRIVATE_CORAL_REQUEST_TIMEOUT_MS}ms`)),
      PRIVATE_CORAL_REQUEST_TIMEOUT_MS,
    );
    try {
      const token = await awaitAbortable(Promise.resolve().then(() => this.getToken()), controller.signal);
      if (this.disposed) throw httpError("Private coral PMTiles source was disposed");
      if (!token?.trim()) throw httpError("Private coral PMTiles token is unavailable", 401);
      const end = offset + length - 1;
      const response = await awaitAbortable(this.fetchFn(this.url, {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          Range: `bytes=${offset}-${end}`,
        },
      }), controller.signal);
      if (this.disposed) {
        cancelResponseBody(response);
        throw httpError("Private coral PMTiles source was disposed");
      }
      if (response.status === 401 || response.status === 403) {
        // Never read the body: no authenticated partial response is handed to Mapbox.
        cancelResponseBody(response);
        throw httpError(`Private coral PMTiles access denied (${response.status})`, response.status);
      }
      if (response.status !== 206) {
        cancelResponseBody(response);
        throw httpError(`Private coral PMTiles requires HTTP 206, received ${response.status}`, response.status);
      }

      const expectedRange = `bytes ${offset}-${end}/`;
      const contentRange = response.headers.get("Content-Range");
      if (!contentRange?.startsWith(expectedRange) || !/^bytes \d+-\d+\/\d+$/.test(contentRange)) {
        cancelResponseBody(response);
        throw httpError(`Private coral PMTiles received invalid Content-Range: ${contentRange ?? "missing"}`);
      }
      const data = await response.arrayBuffer();
      if (this.disposed) throw httpError("Private coral PMTiles source was disposed");
      if (data.byteLength !== length) {
        throw httpError(`Private coral PMTiles range length mismatch: expected ${length}, received ${data.byteLength}`);
      }
      return {
        data,
        etag: response.headers.get("ETag") || undefined,
        cacheControl: response.headers.get("Cache-Control") || undefined,
        expires: response.headers.get("Expires") || undefined,
      };
    } finally {
      clearTimeout(timeout);
      unlinkAbort();
      this.controllers.delete(controller);
    }
  }
}

type PmTilesInternals = { _instance: PMTiles; _protocol: Protocol };

class PrivateCoralPmTilesSource extends PmTilesSource {
  private readonly privateFetchSource: PrivateCoralFetchSource;

  constructor(id: string, options: PrivateCoralPmtilesOptions, dispatcher: unknown, eventedParent: unknown) {
    super(id, options, dispatcher, eventedParent);
    if (!options.getToken) throw httpError("Private coral PMTiles requires getToken", 401);

    this.privateFetchSource = new PrivateCoralFetchSource(options.url, options.getToken);
    const instance = new PMTiles(this.privateFetchSource);
    const protocol = new Protocol();
    protocol.add(instance);
    // mapbox-pmtiles does no I/O in its constructor. Replace both together before load().
    const internals = this as unknown as PmTilesInternals;
    internals._instance = instance;
    internals._protocol = protocol;
  }

  onRemove(...args: unknown[]): void {
    this.privateFetchSource.dispose();
    // PmTilesSource inherits VectorTileSource.onRemove(map); preserve its worker/cache cleanup.
    const parentOnRemove = (PmTilesSource.prototype as { onRemove?: (...parentArgs: unknown[]) => void }).onRemove;
    parentOnRemove?.apply(this, args);
  }
}

let registered = false;

/** Register once, before adding a source with `PRIVATE_CORAL_PMTILES_SOURCE_TYPE`. */
export function registerPrivateCoralSourceOnce(): void {
  if (registered) return;
  registered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (type: string, implementation: unknown) => void };
    }).Style;
    Style.setSourceType(PRIVATE_CORAL_PMTILES_SOURCE_TYPE, PrivateCoralPmTilesSource);
  } catch {
    // Another map in this JS realm may already have registered the dedicated type.
  }
}

export const __test__ = { PrivateCoralFetchSource, linkAbortSignal };
