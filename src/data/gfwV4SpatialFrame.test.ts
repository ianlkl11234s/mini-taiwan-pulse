import { describe, expect, it } from "vitest";
import { buildGfwV4SpatialFrame, type GfwV4SpatialObservation } from "./gfwV4SpatialFrame";

const observation = (overrides: Partial<GfwV4SpatialObservation> = {}): GfwV4SpatialObservation => ({
  lon: 120, lat: 24, vesselId: "vessel-a", trackId: "track-a", mmsi: "1", shipName: null, vesselType: "CARGO", flag: null,
  shipTypeBucket: "cargo", observedAt: "2026-08-21T00:00:00+00:00", observedEpoch: 0,
  toLon: 121, toLat: 24, toEpoch: 3600, bucket: 1, ...overrides,
});

describe("schema-4 spatial track local-time frame", () => {
  it("interpolates an exact fractional time and clips every trail endpoint at now", () => {
    const frame = buildGfwV4SpatialFrame([
      observation({ lon: 119, observedEpoch: -3600, observedAt: "2026-08-20T23:00:00+00:00", toLon: 120, toEpoch: 0 }),
      observation(),
    ], 1800, 3600);
    expect(frame.points).toEqual(new Float32Array([120.5, 24]));
    // start=23:30 and end=00:30: the final endpoint is now, never 01:00.
    expect(frame.segments).toEqual(new Float32Array([119.5, 24, 120, 24, 120, 24, 120.5, 24]));
  });

  it("keeps the true 30-minute boundary instead of rounding it to an hour", () => {
    const frame = buildGfwV4SpatialFrame([
      observation({ lon: 118, observedEpoch: -7200, toLon: 119, toEpoch: -3600 }),
      observation({ lon: 119, observedEpoch: -3600, toLon: 120, toEpoch: 0 }),
      observation(),
    ], 900, 1800);
    // 23:45 → 00:00 → 00:15, never includes the older 23:00 geometry.
    expect(frame.segments).toEqual(new Float32Array([119.75, 24, 120, 24, 120, 24, 120.25, 24]));
  });

  it("aggregates same-coordinate endpoints while retaining every popup member", () => {
    const frame = buildGfwV4SpatialFrame([observation(), observation({ vesselId: "vessel-b", trackId: "track-b", mmsi: "2" })], 0, 1800);
    expect(frame.points).toHaveLength(2);
    expect(frame.memberCounts).toEqual(new Uint16Array([2]));
    expect(frame.hitGroups[0]?.members.map((member) => member.vessel_id)).toEqual(["vessel-a", "vessel-b"]);
  });
});
