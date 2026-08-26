import { describe, expect, it } from "vitest";
import { __testOnly } from "../gfwHourlyDetailLoader";
import { gfwHourlyTrackFrameEndpoints, gfwHourlyTrackFrameTrail, parseGfwHourlyTrackFrame } from "../gfwHourlyTracksLoader";

const vessels = [{ vessel_id: "v-1", mmsi: "123", ship_name: "ONE", vessel_type: "fishing", flag: "TW" }];
const epoch = Date.parse("2026-08-15T00:00:00Z") / 1000;

describe("GFW v3 detail/frame contract", () => {
  it("grid bucket 必須和 release/hour/bucket/count/member 全部相符", () => {
    const raw = {
      schema_version: 1, release_id: "2026-08-15", observed_at: "2026-08-15T00:00:00Z", bucket: "a", key: "cell_id",
      entry_count: 1, vessel_count: 1, entries: { "cell-a": { vessel_count: 1, vessels } },
    };
    expect(__testOnly.parseGridEntries(raw, { releaseId: "2026-08-15", observedAt: "2026-08-15T00:00:00Z", bucket: "a" })?.get("cell-a")?.vessels).toHaveLength(1);
    raw.vessel_count = 2;
    expect(__testOnly.parseGridEntries(raw, { releaseId: "2026-08-15", observedAt: "2026-08-15T00:00:00Z", bucket: "a" })).toBeNull();
  });

  it("track sidecar 拒絕 point count/time order 不自洽", () => {
    const raw = {
      schema_version: 1, release_id: "2026-08-15", display_date: "2026-08-15", bucket: "b", key: "track_id",
      entry_count: 1, point_count: 2, entries: { "t-1": {
        track_id: "t-1", vessel_id: "v-1", mmsi: "123", ship_name: "ONE", vessel_type: "fishing", flag: "TW",
        start_at: "2026-08-15T00:00:00Z", end_at: "2026-08-15T01:00:00Z", point_count: 2,
        observed_times: ["2026-08-15T00:00:00Z", "2026-08-15T01:00:00Z"],
      } },
    };
    expect(__testOnly.parseTrackEntries(raw, { releaseId: "2026-08-15", displayDate: "2026-08-15", bucket: "b" })?.get("t-1")?.pointCount).toBe(2);
    raw.entries["t-1"].observed_times.reverse();
    expect(__testOnly.parseTrackEntries(raw, { releaseId: "2026-08-15", displayDate: "2026-08-15", bucket: "b" })).toBeNull();
  });

  it("frame 僅在同 segment 的 to_* 全欄位有效時內插，並保留同座標所有成員", () => {
    const raw = { type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: { track_id: "t-1", vessel_id: "v-1", vessel_type: "fishing", ship_type_bucket: "special", observed_epoch: epoch, to_epoch: epoch + 3600, to_lon: 121, to_lat: 24 } },
      { type: "Feature", geometry: { type: "Point", coordinates: [120.5, 23.5] }, properties: { track_id: "t-2", vessel_id: "v-2", vessel_type: "cargo", observed_epoch: epoch, to_epoch: epoch + 3600, to_lon: 121, to_lat: 24 } },
    ] };
    const nodes = parseGfwHourlyTrackFrame(raw, "2026-08-15T00:00:00Z");
    expect(nodes).not.toBeNull();
    const endpoints = gfwHourlyTrackFrameEndpoints(nodes!, epoch + 3600, true);
    expect(endpoints.features).toHaveLength(1);
    expect(endpoints.features[0]?.properties).toMatchObject({ vessel_count: 2, mixed_type: 1, full_fidelity: 1 });
    expect(endpoints.features[0]?.properties?.ship_type_bucket).toBe("mixed");
    (raw.features[0]!.properties as Record<string, unknown>).to_lon = undefined;
    expect(parseGfwHourlyTrackFrame(raw, "2026-08-15T00:00:00Z")).toBeNull();
  });

  it("半小時 trail 只裁出已發生的 segment，不把無 to_* 的觀測 hold 成未來線", () => {
    const parsed = parseGfwHourlyTrackFrame({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: { track_id: "t-1", vessel_id: "v-1", vessel_type: "cargo", ship_type_bucket: "special", observed_epoch: epoch, to_epoch: epoch + 3600, to_lon: 122, to_lat: 25 } },
      { type: "Feature", geometry: { type: "Point", coordinates: [119, 22] }, properties: { track_id: "t-2", vessel_id: "v-2", vessel_type: "fishing", observed_epoch: epoch } },
    ] }, "2026-08-15T00:00:00Z")!;
    const frame = gfwHourlyTrackFrameTrail(new Map([[epoch, parsed]]), epoch + 1800, 0.5, true, "2026-08-15");
    expect(frame.lines.features).toHaveLength(1);
    expect(frame.lines.features[0]?.geometry).toMatchObject({ coordinates: [[120, 23], [121, 24]] });
    // End is clipped at 00:30; no coordinate after selected time appears.
    expect(frame.lines.features[0]?.properties).toMatchObject({ display_date: "2026-08-15", ship_type_bucket: "special" });
    expect(frame.endpoints.features).toHaveLength(1);
  });
});
