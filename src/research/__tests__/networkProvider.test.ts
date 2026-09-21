import { describe, expect, it } from "vitest";
import { networkProviderHold } from "../networkProvider";

describe("networkProviderHold", () => {
  it("returns a reproducible HOLD without inventing walking distance", () => {
    expect(networkProviderHold("route_distance", { origin: [121.5, 25], destination: [121.6, 25.1], provider: "valhalla" })).toMatchObject({
      status: "HOLD", provider: "valhalla", mode: "pedestrian", reason: "VALHALLA_GRAPH_NOT_REGISTERED",
      graph: { version: null, checksum: null }, result: null, snapDistanceM: null,
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
