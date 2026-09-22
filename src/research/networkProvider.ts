type Center = readonly [number, number];
type Position = [number, number];
type MultiPolygonCoordinates = Position[][][];

export type ValhallaGraphReceipt = {
  engineVersion: string;
  tilesetLastModified: string;
  osmChangeset: number | null;
  checksumSha256: null;
  provenanceCompleteness: "provider_status_without_checksum";
  observedAt: string;
};

type NetworkReceiptBase = {
  provider: "valhalla";
  mode: "pedestrian";
  endpointClass: "public_demo";
  sendsCoordinatesExternally: true;
  externalConsent: boolean;
  limitations: string[];
  guarantees: string[];
};

export type WalkingIsochroneExecution = NetworkReceiptBase & {
  status: "READY";
  operation: "walking_isochrone";
  request: { center: Center; contoursMinutes: number[] };
  graph: ValhallaGraphReceipt;
  contours: { minutes: number; geometry: { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates }; vertexCount: number }[];
  snapDistanceM: null;
  unreachable: false;
  disconnected: null;
  warnings: string[];
};

export type NetworkProviderReceipt = NetworkReceiptBase & {
  status: "HOLD" | "UNAVAILABLE" | "READY";
  operation: "route_distance" | "walking_isochrone";
  reason?: string;
  graph: ValhallaGraphReceipt | { engineVersion: null; tilesetLastModified: null; osmChangeset: null; checksumSha256: null; provenanceCompleteness: "unavailable"; observedAt: string };
  request: Record<string, unknown>;
  result: null | { distanceM: number; durationSeconds: number; units: { distanceM: "m"; durationSeconds: "s" } };
  snapDistanceM: null;
  unreachable: boolean | null;
  disconnected: boolean | null;
  warnings: string[];
  guarantees: string[];
};

const DEFAULT_BASE_URL = "https://valhalla1.openstreetmap.de";
const CLIENT_ID = "mini-taiwan-pulse-local-poc";
const MAX_STATUS_BYTES = 32 * 1024;
const MAX_ROUTE_BYTES = 256 * 1024;
const MAX_ISOCHRONE_BYTES = 2 * 1024 * 1024;
const MAX_ISOCHRONE_VERTICES = 100_000;
const LIMITATIONS = [
  "Coordinates are sent to the public FOSSGIS Valhalla demo only when this operation is explicitly requested.",
  "The public demo is fair-use infrastructure with no availability or production SLA.",
  "The provider status exposes engine version and tileset timestamp but no graph checksum; reproducibility is partial.",
  "Walking results use Valhalla pedestrian costing over its OpenStreetMap-derived graph; they are modeled accessibility, not observed travel.",
];
const GUARANTEES = ["no_haversine_fallback", "no_synthetic_isochrone", "fixed_provider_endpoint", "bounded_provider_response"];

export class ValhallaNetworkProvider {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl?: string; fetcher?: typeof fetch; timeoutMs?: number } = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  capability(): Record<string, unknown> {
    return {
      status: "configured_external_demo",
      provider: "valhalla",
      mode: "pedestrian",
      endpointClass: "public_demo",
      sendsCoordinatesExternally: true,
      requiresExplicitConsent: true,
      graph: { version: "checked_per_request", checksumSha256: null, builtAt: "checked_per_request" },
      limitations: [...LIMITATIONS],
      guarantees: [...GUARANTEES],
    };
  }

  async routeDistance(args: Record<string, unknown>): Promise<NetworkProviderReceipt> {
    externalConsent(args.externalConsent);
    const requestedProvider = provider(args.provider);
    const origin = center(args.origin);
    const destination = center(args.destination);
    const request = { origin, destination };
    const graph = await this.status();
    if (!graph) return unavailable("route_distance", request, "VALHALLA_STATUS_UNAVAILABLE");
    const payload = await this.json("/route", {
      method: "POST",
      body: JSON.stringify({
        locations: [{ lat: origin[1], lon: origin[0], type: "break" }, { lat: destination[1], lon: destination[0], type: "break" }],
        costing: "pedestrian", units: "kilometers", directions_type: "none",
      }),
    }, MAX_ROUTE_BYTES);
    if (!payload || !record(payload.trip) || !record(payload.trip.summary)) return unavailable("route_distance", request, "VALHALLA_ROUTE_UNAVAILABLE", graph);
    const lengthKm = payload.trip.summary.length;
    const durationSeconds = payload.trip.summary.time;
    if (!finite(lengthKm) || lengthKm < 0 || !finite(durationSeconds) || durationSeconds < 0) return unavailable("route_distance", request, "VALHALLA_INVALID_ROUTE_RESPONSE", graph);
    return {
      ...base(true), status: "READY", operation: "route_distance", provider: requestedProvider, request, graph,
      result: { distanceM: Math.round(lengthKm * 1000), durationSeconds: Math.round(durationSeconds), units: { distanceM: "m", durationSeconds: "s" } },
      snapDistanceM: null, unreachable: false, disconnected: false,
      warnings: ["Valhalla's normalized route summary does not expose input snap distance in this receipt."],
    };
  }

  async walkingIsochrone(args: Record<string, unknown>): Promise<WalkingIsochroneExecution | NetworkProviderReceipt> {
    externalConsent(args.externalConsent);
    const requestedProvider = provider(args.provider);
    const requestedCenter = center(args.center);
    const contoursMinutes = contours(args.contoursMinutes);
    const request = { center: requestedCenter, contoursMinutes };
    const graph = await this.status();
    if (!graph) return unavailable("walking_isochrone", request, "VALHALLA_STATUS_UNAVAILABLE");
    const payload = await this.json("/isochrone", {
      method: "POST",
      body: JSON.stringify({
        locations: [{ lat: requestedCenter[1], lon: requestedCenter[0] }], costing: "pedestrian",
        contours: contoursMinutes.map(time => ({ time })), polygons: true, denoise: 0.5, generalize: 25, show_locations: false,
      }),
    }, MAX_ISOCHRONE_BYTES);
    const normalized = normalizeIsochrones(payload, contoursMinutes);
    if (!normalized) return unavailable("walking_isochrone", request, "VALHALLA_INVALID_ISOCHRONE_RESPONSE", graph);
    return {
      ...base(true), status: "READY", operation: "walking_isochrone", provider: requestedProvider, request, graph, contours: normalized,
      snapDistanceM: null, unreachable: false, disconnected: null,
      warnings: ["Isochrone success proves polygon generation, but the normalized response does not expose input snap distance or disconnected subgraphs."],
    };
  }

  private async status(): Promise<ValhallaGraphReceipt | null> {
    const payload = await this.json("/status", { method: "GET" }, MAX_STATUS_BYTES);
    if (!payload || typeof payload.version !== "string" || !payload.version.trim() || !Number.isSafeInteger(payload.tileset_last_modified) || (payload.tileset_last_modified as number) <= 0 || payload.has_tiles === false) return null;
    const tilesetSeconds = payload.tileset_last_modified as number;
    return {
      engineVersion: payload.version.slice(0, 100),
      tilesetLastModified: new Date(tilesetSeconds * 1000).toISOString(),
      osmChangeset: Number.isSafeInteger(payload.osm_changeset) ? payload.osm_changeset as number : null,
      checksumSha256: null,
      provenanceCompleteness: "provider_status_without_checksum",
      observedAt: new Date().toISOString(),
    };
  }

  private async json(path: "/status" | "/route" | "/isochrone", init: { method: "GET" | "POST"; body?: string }, maxBytes: number): Promise<Record<string, unknown> | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: init.method,
        ...(init.body !== undefined ? { body: init.body } : {}),
        signal: controller.signal,
        headers: { accept: "application/json", ...(init.body !== undefined ? { "content-type": "application/json" } : {}), "x-client-id": CLIENT_ID },
      });
      if (!response.ok) return null;
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) return null;
      const parsed = JSON.parse(text) as unknown;
      return record(parsed) ? parsed : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Explicit fail-closed receipt retained for disabled deployments and tests. */
export function networkProviderHold(operation: "route_distance" | "walking_isochrone", args: Record<string, unknown>): NetworkProviderReceipt {
  const requestedProvider = provider(args.provider);
  const request = operation === "route_distance"
    ? { origin: center(args.origin), destination: center(args.destination) }
    : { center: center(args.center), contoursMinutes: contours(args.contoursMinutes) };
  return {
    ...base(false), status: "HOLD", operation, provider: requestedProvider, reason: "VALHALLA_GRAPH_NOT_REGISTERED",
    graph: emptyGraph(), request, result: null, snapDistanceM: null, unreachable: null, disconnected: null,
    warnings: ["No versioned Valhalla graph/profile is registered in this runtime."],
  };
}

function unavailable(operation: "route_distance" | "walking_isochrone", request: Record<string, unknown>, reason: string, graph?: ValhallaGraphReceipt): NetworkProviderReceipt {
  return {
    ...base(true), status: "UNAVAILABLE", operation, reason, graph: graph ?? emptyGraph(), request, result: null,
    snapDistanceM: null, unreachable: null, disconnected: null,
    warnings: ["The external pedestrian graph did not return a valid bounded response; no straight-line or synthetic substitute was produced."],
  };
}

function base(consent: boolean): NetworkReceiptBase {
  return { provider: "valhalla", mode: "pedestrian", endpointClass: "public_demo", sendsCoordinatesExternally: true, externalConsent: consent, limitations: [...LIMITATIONS], guarantees: [...GUARANTEES] };
}

function emptyGraph(): NetworkProviderReceipt["graph"] {
  return { engineVersion: null, tilesetLastModified: null, osmChangeset: null, checksumSha256: null, provenanceCompleteness: "unavailable", observedAt: new Date().toISOString() };
}

function center(value: unknown): Center {
  if (!Array.isArray(value) || value.length !== 2
    || typeof value[0] !== "number" || !Number.isFinite(value[0]) || Math.abs(value[0]) > 180
    || typeof value[1] !== "number" || !Number.isFinite(value[1]) || Math.abs(value[1]) > 85) throw new Error("INVALID_NETWORK_COORDINATE");
  return [value[0], value[1]];
}

function provider(value: unknown): "valhalla" {
  if (value !== "valhalla") throw new Error("NETWORK_PROVIDER_NOT_ALLOWED");
  return value;
}

function externalConsent(value: unknown): true {
  if (value !== true) throw new Error("NETWORK_EXTERNAL_CONSENT_REQUIRED");
  return true;
}

function contours(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) throw new Error("INVALID_NETWORK_CONTOURS");
  const result = value.map(item => {
    if (!Number.isInteger(item) || (item as number) < 1 || (item as number) > 100) throw new Error("INVALID_NETWORK_CONTOURS");
    return item as number;
  });
  if (new Set(result).size !== result.length || result.some((item, index) => index > 0 && item <= result[index - 1]!)) throw new Error("INVALID_NETWORK_CONTOURS");
  return result;
}

function normalizeIsochrones(payload: Record<string, unknown> | null, requested: readonly number[]): WalkingIsochroneExecution["contours"] | null {
  if (!payload || payload.type !== "FeatureCollection" || !Array.isArray(payload.features) || payload.features.length < requested.length || payload.features.length > requested.length + 1) return null;
  const allowed = new Set(requested);
  const found = new Map<number, WalkingIsochroneExecution["contours"][number]>();
  let totalVertices = 0;
  for (const feature of payload.features) {
    if (!record(feature) || !record(feature.properties) || !record(feature.geometry)) continue;
    const minutes = feature.properties.contour;
    if (!finite(minutes) || !allowed.has(minutes) || found.has(minutes)) continue;
    const geometry = normalizeMultiPolygon(feature.geometry);
    if (!geometry) return null;
    totalVertices += geometry.vertexCount;
    if (totalVertices > MAX_ISOCHRONE_VERTICES) return null;
    found.set(minutes, { minutes, geometry: { type: "MultiPolygon", coordinates: geometry.coordinates }, vertexCount: geometry.vertexCount });
  }
  if (found.size !== requested.length) return null;
  return [...found.values()].sort((left, right) => right.minutes - left.minutes);
}

function normalizeMultiPolygon(value: Record<string, unknown>): { coordinates: MultiPolygonCoordinates; vertexCount: number } | null {
  const polygons = value.type === "Polygon" ? [value.coordinates] : value.type === "MultiPolygon" ? value.coordinates : null;
  if (!Array.isArray(polygons) || polygons.length < 1) return null;
  const normalized: MultiPolygonCoordinates = [];
  let vertexCount = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length < 1) return null;
    const normalizedPolygon: Position[][] = [];
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) return null;
      const normalizedRing: Position[] = [];
      for (const position of ring) {
        if (!Array.isArray(position) || position.length < 2 || !finite(position[0]) || Math.abs(position[0]) > 180 || !finite(position[1]) || Math.abs(position[1]) > 90) return null;
        normalizedRing.push([position[0], position[1]]);
      }
      const first = normalizedRing[0]!; const last = normalizedRing[normalizedRing.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) return null;
      vertexCount += normalizedRing.length;
      normalizedPolygon.push(normalizedRing);
    }
    normalized.push(normalizedPolygon);
  }
  return { coordinates: normalized, vertexCount };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
