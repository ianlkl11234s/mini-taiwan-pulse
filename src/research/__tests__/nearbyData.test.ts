import { afterEach, describe, expect, it, vi } from "vitest";
import { clearNearbyDataCache, queryNearby, readLayer } from "../nearbyData";

const fixture = { type: "FeatureCollection", features: [
  { type: "Feature", geometry: { type: "Point", coordinates: [121, 25] }, properties: { code: "same", school_name: "A", city: "X", secret: "no" } },
  { type: "Feature", geometry: { type: "Point", coordinates: [121.00899, 25] }, properties: { code: "same", school_name: "B", city: "X" } },
  { type: "Feature", geometry: null, properties: { school_name: "missing" } },
  { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
  { type: "Feature", geometry: { type: "Point", coordinates: [999, 25] }, properties: {} },
] };

function mockFetch(data: unknown = fixture) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { headers: { "content-length": "1000" } }));
  vi.stubGlobal("fetch", fetchMock); return fetchMock;
}
afterEach(() => { clearNearbyDataCache(); vi.unstubAllGlobals(); });

describe("nearby schools data", () => {
  it("includes radius boundary, preserves exclusions, safe fields, and stable unique rows", async () => {
    mockFetch();
    const result = await queryNearby("schools", { lng: 121, lat: 25 }, 1_000, 50);
    expect(result.totalMatched).toBe(2);
    expect(result.rows.map(row => row.id)).toEqual(expect.arrayContaining([expect.stringMatching(/-0$/), expect.stringMatching(/-1$/)]));
    expect(result.rows[0]?.properties.secret).toBeUndefined();
    expect(result.exclusions).toEqual({ missingGeometry: 1, nonPoint: 1, invalidCoordinates: 1 });
  });
  it("does not refetch an already loaded source and reports unsupported or locked access as errors", async () => {
    const fetchMock = mockFetch();
    await readLayer("schools", 0, 1); await queryNearby("schools", { lng: 121, lat: 25 }, 1, 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(readLayer("medHospital")).rejects.toThrow("LAYER_READ_UNSUPPORTED");
    await expect(readLayer("schools", 0, 1, undefined, { locked: new Set(["schools"]), visible: new Set() })).rejects.toThrow("LAYER_DENIED");
  });
  it("rejects missing collections and read bounds rather than returning zero", async () => {
    mockFetch({ type: "nope", features: [] });
    await expect(readLayer("schools")).rejects.toThrow("INVALID_DATASET");
    await expect(readLayer("schools", 0, 21)).rejects.toThrow("limit");
  });
});
