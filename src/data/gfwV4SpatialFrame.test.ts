import { describe, expect, it } from "vitest";
import { buildGfwV4SpatialFrame, GFW_V4_TRACK_LIFECYCLE_FADE_SECONDS, type GfwV4SpatialObservation } from "./gfwV4SpatialFrame";

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

  it("keeps a quantized predecessor trail across the exact hour rollover", () => {
    const observations = [
      observation({ lon: 120, toLon: 121.0007, toLat: 24.0007, toEpoch: 3600 }),
      observation({
        lon: 121,
        lat: 24,
        observedEpoch: 3600,
        observedAt: "2026-08-21T01:00:00+00:00",
        toLon: 122.0007,
        toLat: 24.0007,
        toEpoch: 7200,
      }),
    ];

    const before = buildGfwV4SpatialFrame(observations, 3599, 1800);
    const boundary = buildGfwV4SpatialFrame(observations, 3600, 1800);
    const after = buildGfwV4SpatialFrame(observations, 3601, 1800);

    // The matching decoded child is the canonical knot on both sides.
    expect(before.points[0]).toBeCloseTo(120.99972, 4);
    expect(boundary.points).toEqual(new Float32Array([121, 24]));
    // The 30-minute tail is still present at and after the boundary; it does
    // not reset to an empty frame and regrow from the new hour.
    expect(boundary.segments).toEqual(new Float32Array([120.5, 24, 121, 24]));
    expect(after.segments).toHaveLength(8);
    expect(after.segments[2]).toBeCloseTo(121, 6);
    expect(after.segments[4]).toBeCloseTo(121, 6);
  });

  it("still hard-splits materially mismatched or invalid predecessor links", () => {
    const current = observation({
      lon: 121,
      observedEpoch: 3600,
      observedAt: "2026-08-21T01:00:00+00:00",
      toLon: 122,
      toEpoch: 7200,
    });
    const mismatched = buildGfwV4SpatialFrame([
      observation({ toLon: 121.1, toEpoch: 3600 }),
      current,
    ], 3600, 1800);
    const wrongEpoch = buildGfwV4SpatialFrame([
      observation({ toLon: 121, toEpoch: 3599 }),
      current,
    ], 3600, 1800);

    expect(mismatched.segments).toHaveLength(0);
    expect(wrongEpoch.segments).toHaveLength(0);
  });

  it("fades a newly observed track in over five simulated minutes", () => {
    const start = buildGfwV4SpatialFrame([observation()], 0, 1800);
    const middle = buildGfwV4SpatialFrame([observation()], GFW_V4_TRACK_LIFECYCLE_FADE_SECONDS / 2, 1800);
    const end = buildGfwV4SpatialFrame([observation()], GFW_V4_TRACK_LIFECYCLE_FADE_SECONDS, 1800);

    expect(start.pointAlphas).toEqual(new Uint8Array([0]));
    expect(middle.pointAlphas[0]).toBeCloseTo(128, 0);
    expect(end.pointAlphas).toEqual(new Uint8Array([255]));
    expect(middle.segmentAlphas).toEqual(new Uint8Array([128]));
  });

  it("fades a track without a matching next observation out before rollover", () => {
    const start = buildGfwV4SpatialFrame([observation()], 3300, 1800);
    const middle = buildGfwV4SpatialFrame([observation()], 3450, 1800);
    const end = buildGfwV4SpatialFrame([observation()], 3599.999, 1800);

    expect(start.pointAlphas).toEqual(new Uint8Array([255]));
    expect(middle.pointAlphas[0]).toBeCloseTo(128, 0);
    expect(end.pointAlphas).toEqual(new Uint8Array([0]));
    expect(middle.segmentAlphas).toEqual(new Uint8Array([128]));
  });

  it("keeps a continuously linked track fully opaque through the boundary", () => {
    const observations = [
      observation({ lon: 119, observedEpoch: -3600, toLon: 120.0007, toLat: 24.0007, toEpoch: 0 }),
      observation(),
      observation({ lon: 121, observedEpoch: 3600, observedAt: "2026-08-21T01:00:00+00:00", toLon: 122, toEpoch: 7200 }),
    ];

    expect(buildGfwV4SpatialFrame(observations, 1, 1800).pointAlphas).toEqual(new Uint8Array([255]));
    expect(buildGfwV4SpatialFrame(observations, 3599, 1800).pointAlphas).toEqual(new Uint8Array([255]));
    expect(buildGfwV4SpatialFrame(observations, 3600, 1800).pointAlphas).toEqual(new Uint8Array([255]));
  });

  it("aggregates same-coordinate endpoints while retaining every popup member", () => {
    const frame = buildGfwV4SpatialFrame([observation(), observation({ vesselId: "vessel-b", trackId: "track-b", mmsi: "2" })], 0, 1800);
    expect(frame.points).toHaveLength(2);
    expect(frame.memberCounts).toEqual(new Uint16Array([2]));
    expect(frame.hitGroups[0]?.members.map((member) => member.vessel_id)).toEqual(["vessel-a", "vessel-b"]);
  });

  it("keeps an aggregate marker visible when any colocated member is continuous", () => {
    const frame = buildGfwV4SpatialFrame([
      observation({ lon: 119, observedEpoch: -3600, toLon: 120, toEpoch: 0 }),
      observation(),
      observation({ vesselId: "vessel-b", trackId: "track-b", mmsi: "2" }),
    ], 1, 1800);

    expect(frame.memberCounts).toEqual(new Uint16Array([2]));
    expect(frame.pointAlphas).toEqual(new Uint8Array([255]));
  });
});
