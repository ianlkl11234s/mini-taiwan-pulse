import { describe, expect, it } from "vitest";
import { parseGfwTrackCollection } from "./gfwTrackContract";

const VALID_TRACK = {
  type: "FeatureCollection",
  metadata: {
    bbox: [122.434, 23.22953, 132.85274, 34.35812],
    date_start: "2026-08-15",
    date_end_inclusive: "2026-08-21",
    vessel_count: 1,
    displayed_segment_count: 1,
  },
  features: [{
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[125, 25], [126, 26], [127, 27]] },
    properties: {
      vessel_id: "vessel-1",
      mmsi: "416000001",
      ship_name: "POC SHIP",
      start_at: "2026-08-14T00:00:00Z",
      end_at: "2026-08-14T02:00:00Z",
      point_count: 3,
      segment_index: 0,
      approximate: true,
      source_dataset: "public-global-presence:v4.0",
    },
  }],
};

describe("GFW track contract", () => {
  it("parses line features, metadata and two clickable endpoints", () => {
    const parsed = parseGfwTrackCollection(VALID_TRACK);

    expect(parsed.collection.features).toHaveLength(1);
    expect(parsed.metadata.bbox).toEqual([122.434, 23.22953, 132.85274, 34.35812]);
    expect(parsed.metadata.date_end).toBe("2026-08-21");
    expect(parsed.endpoints.features.map((feature) => feature.properties.endpoint))
      .toEqual(["start", "end"]);
  });

  it("allows missing public vessel identity fields", () => {
    const input = structuredClone(VALID_TRACK);
    input.features[0]!.properties.mmsi = null as unknown as string;
    input.features[0]!.properties.ship_name = null as unknown as string;

    const feature = parseGfwTrackCollection(input).collection.features[0]!;
    expect(feature.properties.mmsi).toBeNull();
    expect(feature.properties.ship_name).toBeNull();
  });

  it("rejects non-LineString geometry and mismatched point_count", () => {
    const wrongGeometry = structuredClone(VALID_TRACK) as Record<string, unknown>;
    ((wrongGeometry.features as Array<Record<string, unknown>>)[0]!.geometry as Record<string, unknown>).type = "Point";
    expect(() => parseGfwTrackCollection(wrongGeometry)).toThrow("LineString");

    const wrongCount = structuredClone(VALID_TRACK);
    wrongCount.features[0]!.properties.point_count = 2;
    expect(() => parseGfwTrackCollection(wrongCount)).toThrow("point_count");
  });

  it("rejects malformed collection contracts", () => {
    expect(() => parseGfwTrackCollection({ type: "FeatureCollection", features: "nope" }))
      .toThrow("FeatureCollection");
  });
});
