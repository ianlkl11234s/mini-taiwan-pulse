import { describe, expect, it } from "vitest";
import { parseGfwV4TrackFrameMvtFeature } from "./gfwV4SpatialMvt";
const base = () => ({ type: 1, geometry: [[{ x: 1, y: 2 }]], properties: { vessel_id: "v-1", track_id: "t-1", ship_type_bucket: "fishing", vessel_type: "FISHING", observed_at: "2026-08-21T00:00:00+00:00", observed_epoch: 1, mmsi: "123", ship_name: "A", flag: "TWN" } });
describe("GFW v4 spatial MVT frame contract", () => {
  it("accepts the frozen point identity schema and a singleton", () => expect(parseGfwV4TrackFrameMvtFeature(base(), 121, 25)).toMatchObject({ vesselId: "v-1" }));
  it("rejects wrong layer feature shape, identity, or partial successor", () => { const wrong = base(); wrong.type = 2; expect(parseGfwV4TrackFrameMvtFeature(wrong, 121, 25)).toBeNull(); const partial = base(); Object.assign(partial.properties, { to_at: "x" }); expect(parseGfwV4TrackFrameMvtFeature(partial, 121, 25)).toBeNull(); });
});
