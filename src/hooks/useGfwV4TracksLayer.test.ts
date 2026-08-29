import { describe, expect, it } from "vitest";
import { gfwV4TrackHitCollection } from "./useGfwV4TracksLayer";

describe("formal GFW v4 Tracks popup contract", () => {
  it("labels Passenger canonically and retains its namespaced detail identity", () => {
    const feature = gfwV4TrackHitCollection([{
      lon: 121, lat: 31, buckets: [2], trackIds: ["passenger-track"],
      members: [{ vessel_id: "v-p", mmsi: "123", ship_name: "P", vessel_type: "PASSENGER", flag: "TW" }],
    }], "2026-08-21", Date.parse("2026-08-21T12:30:00Z") / 1000).features[0]!;
    expect(feature.properties).toMatchObject({ ship_type_bucket: "passenger", ship_type_label: "客船 Passenger", vessel_count: 1, interpolated: 1 });
    expect(JSON.parse(String(feature.properties?.track_buckets_json))).toEqual([["passenger-track", "passenger"]]);
  });

  it("preserves every same-coordinate member and maps each detail lookup namespace", () => {
    const feature = gfwV4TrackHitCollection([{
      lon: 121, lat: 31, buckets: [0, 1, 2], trackIds: ["f", "c", "p"],
      members: [{ vessel_id: "f" }, { vessel_id: "c" }, { vessel_id: "p" }],
    }], "2026-08-21", Date.parse("2026-08-21T12:00:00Z") / 1000).features[0]!;
    expect(feature.properties).toMatchObject({ vessel_count: 3, ship_type_bucket: "mixed", ship_type_label: "混合船種 Mixed" });
    expect(JSON.parse(String(feature.properties?.track_ids_json))).toEqual(["f", "c", "p"]);
    expect(JSON.parse(String(feature.properties?.track_buckets_json))).toEqual([["f", "fishing"], ["c", "cargo"], ["p", "passenger"]]);
  });
});
