type Center = readonly [number, number];

function center(value: unknown): Center {
  if (!Array.isArray(value) || value.length !== 2
    || typeof value[0] !== "number" || !Number.isFinite(value[0]) || Math.abs(value[0]) > 180
    || typeof value[1] !== "number" || !Number.isFinite(value[1]) || Math.abs(value[1]) > 90) throw new Error("INVALID_NETWORK_COORDINATE");
  return [value[0], value[1]];
}

function provider(value: unknown): "valhalla" {
  if (value !== "valhalla") throw new Error("NETWORK_PROVIDER_NOT_ALLOWED");
  return value;
}

export function networkProviderHold(operation: "route_distance" | "walking_isochrone", args: Record<string, unknown>): Record<string, unknown> {
  const requestedProvider = provider(args.provider);
  const request = operation === "route_distance"
    ? { origin: center(args.origin), destination: center(args.destination) }
    : { center: center(args.center), contoursMinutes: contours(args.contoursMinutes) };
  return {
    status: "HOLD",
    operation,
    provider: requestedProvider,
    mode: "pedestrian",
    reason: "VALHALLA_GRAPH_NOT_REGISTERED",
    graph: { version: null, checksum: null, builtAt: null, osmExtractObservedAt: null },
    request,
    result: null,
    snapDistanceM: null,
    unreachable: null,
    disconnected: null,
    warnings: ["No versioned Taiwan Valhalla graph/profile is registered in this browser runtime."],
    guarantees: ["no_haversine_fallback", "no_synthetic_isochrone", "graph_and_profile_required_before_ready"],
  };
}

function contours(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) throw new Error("INVALID_NETWORK_CONTOURS");
  const result = value.map(item => {
    if (!Number.isInteger(item) || (item as number) < 1 || (item as number) > 120) throw new Error("INVALID_NETWORK_CONTOURS");
    return item as number;
  });
  if (new Set(result).size !== result.length || result.some((item, index) => index > 0 && item <= result[index - 1]!)) throw new Error("INVALID_NETWORK_CONTOURS");
  return result;
}
