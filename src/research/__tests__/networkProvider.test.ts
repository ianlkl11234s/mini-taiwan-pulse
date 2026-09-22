import { describe, expect, it, vi } from "vitest";
import { networkProviderHold, ValhallaNetworkProvider } from "../networkProvider";

describe("networkProviderHold", () => {
  it("returns a reproducible HOLD without inventing walking distance", () => {
    expect(networkProviderHold("route_distance", { origin: [121.5, 25], destination: [121.6, 25.1], provider: "valhalla" })).toMatchObject({
      status: "HOLD", provider: "valhalla", mode: "pedestrian", reason: "VALHALLA_GRAPH_NOT_REGISTERED",
      graph: { engineVersion: null, checksumSha256: null, provenanceCompleteness: "unavailable" }, result: null, snapDistanceM: null,
      guarantees: expect.arrayContaining(["no_haversine_fallback"]),
    });
  });

  it("retains bounded contour intent but returns no synthetic polygon", () => {
    expect(networkProviderHold("walking_isochrone", { center: [121.5, 25], contoursMinutes: [5, 10, 15], provider: "valhalla" })).toMatchObject({
      status: "HOLD", request: { contoursMinutes: [5, 10, 15] }, result: null,
      guarantees: expect.arrayContaining(["no_synthetic_isochrone"]),
    });
  });

  it("rejects arbitrary providers, invalid coordinates and unordered contours", () => {
    expect(() => networkProviderHold("route_distance", { origin: [121.5, 25], destination: [121.6, 25.1], provider: "https://example.test" })).toThrow("NETWORK_PROVIDER_NOT_ALLOWED");
    expect(() => networkProviderHold("route_distance", { origin: [999, 25], destination: [121.6, 25.1], provider: "valhalla" })).toThrow("INVALID_NETWORK_COORDINATE");
    expect(() => networkProviderHold("walking_isochrone", { center: [121.5, 25], contoursMinutes: [10, 5], provider: "valhalla" })).toThrow("INVALID_NETWORK_CONTOURS");
  });
});

describe("ValhallaNetworkProvider", () => {
  const status = { version: "3.5.1", tileset_last_modified: 1_789_000_000, has_tiles: true, osm_changeset: 123 };
  const polygon = (minutes: number, offset: number) => ({
    type: "Feature",
    properties: { contour: minutes, metric: "time" },
    geometry: { type: "Polygon", coordinates: [[
      [121.5 - offset, 25 - offset], [121.5 + offset, 25 - offset], [121.5 + offset, 25 + offset], [121.5 - offset, 25 + offset], [121.5 - offset, 25 - offset],
    ]] },
  });

  it("requests bounded pedestrian polygons from the fixed provider and retains graph provenance", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: "FeatureCollection", features: [polygon(5, 0.01), polygon(10, 0.02)] }), { status: 200 }));
    const provider = new ValhallaNetworkProvider({ baseUrl: "https://valhalla.test", fetcher });

    const result = await provider.walkingIsochrone({ center: [121.5, 25], contoursMinutes: [5, 10], provider: "valhalla", externalConsent: true });

    expect(result).toMatchObject({
      status: "READY", mode: "pedestrian", sendsCoordinatesExternally: true,
      graph: { engineVersion: "3.5.1", osmChangeset: 123, checksumSha256: null, provenanceCompleteness: "provider_status_without_checksum" },
      contours: [{ minutes: 10, geometry: { type: "MultiPolygon" }, vertexCount: 5 }, { minutes: 5, vertexCount: 5 }],
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://valhalla.test/status", "https://valhalla.test/isochrone"]);
    const request = fetcher.mock.calls[1]![1]!;
    expect(JSON.parse(String(request.body))).toMatchObject({ costing: "pedestrian", polygons: true, contours: [{ time: 5 }, { time: 10 }] });
    expect(request.headers).toMatchObject({ "x-client-id": "mini-taiwan-pulse-local-poc" });
  });

  it("returns route distance without substituting straight-line distance", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ trip: { summary: { length: 1.234, time: 987.4 } } }), { status: 200 }));
    const provider = new ValhallaNetworkProvider({ baseUrl: "https://valhalla.test", fetcher });

    await expect(provider.routeDistance({ origin: [121.5, 25], destination: [121.51, 25.01], provider: "valhalla", externalConsent: true })).resolves.toMatchObject({
      status: "READY", result: { distanceM: 1234, durationSeconds: 987 }, unreachable: false, disconnected: false,
    });
  });

  it("fails closed when status or geometry is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    const provider = new ValhallaNetworkProvider({ baseUrl: "https://valhalla.test", fetcher });

    await expect(provider.walkingIsochrone({ center: [121.5, 25], contoursMinutes: [5], provider: "valhalla", externalConsent: true })).resolves.toMatchObject({
      status: "UNAVAILABLE", reason: "VALHALLA_STATUS_UNAVAILABLE", result: null,
      guarantees: expect.arrayContaining(["no_haversine_fallback", "no_synthetic_isochrone"]),
    });
  });

  it("does not contact the public demo without explicit coordinate consent", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new ValhallaNetworkProvider({ baseUrl: "https://valhalla.test", fetcher });

    await expect(provider.walkingIsochrone({ center: [121.5, 25], contoursMinutes: [5], provider: "valhalla" }))
      .rejects.toThrow("NETWORK_EXTERNAL_CONSENT_REQUIRED");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
