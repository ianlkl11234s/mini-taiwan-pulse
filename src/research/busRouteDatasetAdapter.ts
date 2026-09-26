import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import { createLineDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

const ASSET_URL = "/bus/chiayi_bus_routes.json";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROUTES = 2_000;
const MAX_VERTICES = 100_000;
const TIMEOUT_MS = 15_000;

type RouteEntry = { routeId: string; routeUid: string; routeName: string; direction: number; coords: readonly (readonly number[])[] };
export type BusRouteFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const chiayiBusRouteDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tdx-chiayi-city-bus-route-shapes",
  label: "嘉義市公車路線形", description: "TDX published route shape 的嘉義市 bounded static snapshot；每列是一條 route direction 的已發布 path，不是車輛軌跡、即時位置或行駛距離。",
  layerRefs: ["busLive"], kind: "line", recordGrain: "feature", primaryKey: ["route_id"],
  fields: [
    { name: "route_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "route_uid", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "route_label", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "direction", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "LineString", crs: "EPSG:4326", role: "actual", precision: "TDX Shape path transformed from WKT then quantized to five decimal places; published path geometry, not measured vehicle tracking.", spatialAnalysisEligible: true },
  timeFields: [], coverage: "31 route-direction shapes in one same-origin Chiayi City snapshot. TDX upstream sourceVersion is unknown; session identity is the acquired asset SHA-256.", license: "OGDL-Taiwan-1.0; attribution required to Ministry of Transportation and Communications TDX.",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "A route absent from this bounded asset is not proof that no TDX route exists.", null: "Route fields are required by this adapter; null is rejected rather than inferred." },
  versions: [], source: { publisher: "交通部運輸資料流通服務平臺（TDX）", reference: ASSET_URL, lineage: "TDX Bus Shape WKT LINESTRING -> WGS84 GeoJSON -> five-decimal static route asset -> bounded research route snapshot" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["route_id", "route_uid", "route_label", "direction", "geometry"], filters: ["route_id", "route_uid"], maxRowsPerQuery: 1, maxScanRows: MAX_ROUTES, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records", "line_intersects", "aggregate"], adapterId: "tdx-chiayi-city-bus-shape-v1",
};

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError");
}

async function nextChunk(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) throw abortReason(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => { void reader.cancel(signal.reason); reject(abortReason(signal)); };
    signal.addEventListener("abort", onAbort, { once: true });
    void reader.read().then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("DATASET_TOO_LARGE");
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("DATASET_TOO_LARGE");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await nextChunk(reader, signal);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("DATASET_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function position(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;
}

function parseRoutes(bytes: Uint8Array): RouteEntry[] {
  const text = new TextDecoder().decode(bytes);
  if (text.slice(0, 100).trimStart().startsWith("<")) throw new Error("DATASET_ASSET_MISSING");
  let raw: unknown; try { raw = JSON.parse(text); } catch { throw new Error("INVALID_DATASET"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_DATASET");
  const entries = Object.entries(raw);
  if (entries.length > MAX_ROUTES) throw new Error("ROUTE_SCAN_BUDGET_EXCEEDED");
  let vertices = 0;
  return entries.map(([routeId, value]) => {
    if (!routeId || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_ROUTE_RECORD");
    const route = value as Partial<RouteEntry>;
    if (typeof route.routeUid !== "string" || !route.routeUid || typeof route.routeName !== "string" || !route.routeName || !Number.isInteger(route.direction)
      || !Array.isArray(route.coords) || route.coords.length < 2 || !route.coords.every(position)) throw new Error("INVALID_ROUTE_RECORD");
    vertices += route.coords.length;
    if (vertices > MAX_VERTICES) throw new Error("ROUTE_VERTEX_BUDGET_EXCEEDED");
    return { routeId, routeUid: route.routeUid, routeName: route.routeName, direction: route.direction as number, coords: route.coords };
  });
}

export function createChiayiBusRouteAdapter(fetcher: BusRouteFetch = fetch): QueryAdapter {
  return createLineDatasetAdapter(chiayiBusRouteDescriptor, async (_parameters, signal): Promise<AdapterSnapshot> => withLoading("research:bus-routes:chiayi", "載入嘉義市公車路線形", (async () => {
    if (signal?.aborted) throw abortReason(signal);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(ASSET_URL, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
      if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) throw new Error("DATASET_ASSET_MISSING");
      if (!response.ok) throw new Error("DATASET_UNAVAILABLE");
      const bytes = await boundedBytes(response, controller.signal); const routes = parseRoutes(bytes); const checksumSha256 = await sha256(bytes);
      const rows: Record<string, unknown>[] = [];
      for (const route of routes) {
        rows.push({ route_id: route.routeId, route_uid: route.routeUid, route_label: route.routeName, direction: route.direction, geometry: { type: "LineString", coordinates: route.coords } });
      }
      const acquiredAt = new Date().toISOString(); const source: SourceReceipt = { sourceId: "tdx-chiayi-city-bus-shape", version: `tdx-source-version-unknown;sha256:${checksumSha256}`, acquiredAt, checksumSha256, reference: ASSET_URL };
      return { rows, source, coverage: chiayiBusRouteDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: routes.length, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      if (controller.signal.aborted) throw new Error("REQUEST_TIMEOUT");
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", forwardAbort); }
  })()));
}

export const chiayiBusRouteAdapter = createChiayiBusRouteAdapter();
