import { describe, expect, it } from "vitest";
import { findAsset, parseBenchManifest, parseJsonTrackPack, workloadCoverage } from "./contract";
import { TRACK_BUCKETS } from "./types";

const member = { vessel_id: "v-1", mmsi: null, ship_name: "A", vessel_type: "CARGO", flag: "TW" };
const popupMember = {
  ...member,
  hours: 2.5,
  entry_timestamp: "2026-08-20T00:00:00Z",
  exit_timestamp: "2026-08-20T02:30:00Z",
  imo: "IMO1234567",
  callsign: "CALL123",
  first_transmission_date: "2026-08-20T00:00:00Z",
  last_transmission_date: "2026-08-20T02:30:00Z",
  dataset: "public-global-fishing-vessels:v3.0",
  geartype: "trawlers",
};

describe("GFW v4 bench contract boundary", () => {
  it("accepts independently indexed vessel-type and format assets", () => {
    const manifest = parseBenchManifest({
      schema_version: 1,
      release_id: "2026-08-21",
      bbox: [115.93462, 20.36314, 134.73486, 36.52495],
      days: [{
        display_date: "2026-08-20",
        assets: [
          { bucket: "cargo", format: "json.gz", path: "tracks/2026-08-20/cargo.json.gz", bytes: 10, points: 9, segments: 3, sha256: null },
          { bucket: "cargo", format: "binary", path: "tracks/2026-08-20/cargo.bin", bytes: 8, points: 9, segments: 3, sha256: "a".repeat(64) },
        ],
      }],
    }, "http://localhost/gfw-v4-poc/manifest.json");
    expect(manifest?.bbox).toEqual([115.93462, 20.36314, 134.73486, 36.52495]);
    expect(findAsset(manifest!, "2026-08-20", "cargo", "json.gz")?.path).toBe("tracks/2026-08-20/cargo.json.gz");
    expect(findAsset(manifest!, "2026-08-20", "tanker", "json.gz")).toBeNull();
  });

  it("rejects unsafe paths and duplicate type/format assets", () => {
    const base = {
      schema_version: 1,
      release_id: "2026-08-21",
      bbox: [115, 20, 134, 36],
      days: [{ display_date: "2026-08-20", assets: [
        { bucket: "cargo", format: "binary", path: "../secret", bytes: null, points: 1, segments: 1, sha256: null },
      ] }],
    };
    expect(parseBenchManifest(base, "http://localhost/manifest.json")).toBeNull();
    base.days[0]!.assets = [
      { bucket: "cargo", format: "binary", path: "a.bin", bytes: null, points: 1, segments: 1, sha256: null },
      { bucket: "cargo", format: "binary", path: "b.bin", bytes: null, points: 1, segments: 1, sha256: null },
    ];
    expect(parseBenchManifest(base, "http://localhost/manifest.json")).toBeNull();
  });

  it.each([
    [{ segments: 1 }],
    [{ points: 1 }],
    [{ points: -1, segments: 1 }],
    [{ points: 1, segments: 1.5 }],
  ])("rejects missing or invalid points/segments counts: %o", (counts) => {
    expect(parseBenchManifest({
      schema_version: 1,
      release_id: "2026-08-21",
      bbox: [115, 20, 134, 36],
      days: [{
        display_date: "2026-08-20",
        assets: [{ bucket: "cargo", format: "binary", path: "a.bin", bytes: 1, sha256: null, ...counts }],
      }],
    }, "http://localhost/manifest.json")).toBeNull();
  });

  it("reports enabled and total points/segments coverage for default and all presets", () => {
    const assets = [
      { bucket: "cargo", points: 100, segments: 10 },
      { bucket: "tanker", points: 0, segments: 0 },
      { bucket: "passenger", points: 50, segments: 5 },
      { bucket: "fishing", points: 250, segments: 25 },
      { bucket: "other", points: 400, segments: 40 },
    ].map((asset) => ({ ...asset, format: "binary", path: `${asset.bucket}.bin`, bytes: 1, sha256: null }));
    const manifest = parseBenchManifest({
      schema_version: 1,
      release_id: "2026-08-21",
      bbox: [115, 20, 134, 36],
      days: [{ display_date: "2026-08-20", assets }],
    }, "http://localhost/manifest.json")!;
    expect(workloadCoverage(manifest, "2026-08-20", new Set(["cargo", "tanker", "passenger"]), "binary")).toEqual({
      preset: "default",
      enabled: { points: 150, segments: 15 },
      total: { points: 800, segments: 80 },
      pointFraction: 0.1875,
      segmentFraction: 0.1875,
    });
    expect(workloadCoverage(manifest, "2026-08-20", new Set(TRACK_BUCKETS), "binary")?.preset).toBe("all");
  });

  it("keeps segment boundaries and requires strictly increasing UTC epochs", () => {
    const valid = {
      schema_version: 1,
      display_date: "2026-08-20",
      bucket: "cargo",
      segment_count: 2,
      point_count: 4,
      segments: [
        { track_id: "a", vessel: member, points: [[120, 23, 100], [121, 24, 200]] },
        { track_id: "b", vessel: { ...member, vessel_id: "v-2" }, points: [[130, 30, 300], [131, 31, 400]] },
      ],
    };
    expect(parseJsonTrackPack(valid, "2026-08-20", "cargo")?.segments).toHaveLength(2);
    valid.segments[1]!.points[1]![2] = 300;
    expect(parseJsonTrackPack(valid, "2026-08-20", "cargo")).toBeNull();
  });

  it("preserves every popup field while accepting legacy five-field members", () => {
    const pack = (vessel: object) => ({
      schema_version: 1,
      display_date: "2026-08-20",
      bucket: "cargo",
      segment_count: 1,
      point_count: 1,
      segments: [{ track_id: "a", vessel, points: [[120, 23, 100]] }],
    });
    expect(parseJsonTrackPack(pack(member), "2026-08-20", "cargo")?.segments[0]?.vessel).toEqual({
      vesselId: "v-1", mmsi: null, shipName: "A", vesselType: "CARGO", flag: "TW",
    });
    expect(parseJsonTrackPack(pack(popupMember), "2026-08-20", "cargo")?.segments[0]?.vessel).toEqual({
      vesselId: "v-1",
      mmsi: null,
      shipName: "A",
      vesselType: "CARGO",
      flag: "TW",
      hours: 2.5,
      entryTimestamp: "2026-08-20T00:00:00Z",
      exitTimestamp: "2026-08-20T02:30:00Z",
      imo: "IMO1234567",
      callsign: "CALL123",
      firstTransmissionDate: "2026-08-20T00:00:00Z",
      lastTransmissionDate: "2026-08-20T02:30:00Z",
      dataset: "public-global-fishing-vessels:v3.0",
      geartype: "trawlers",
    });
  });

  it.each([
    ["hours", "2.5"],
    ["entry_timestamp", 123],
    ["exit_timestamp", {}],
    ["imo", 123],
    ["callsign", false],
    ["first_transmission_date", []],
    ["last_transmission_date", 123],
    ["dataset", {}],
    ["geartype", 9],
  ])("fails closed when optional popup field %s has a wrong type", (field, value) => {
    const raw = {
      schema_version: 1,
      display_date: "2026-08-20",
      bucket: "cargo",
      segment_count: 1,
      point_count: 1,
      segments: [{ track_id: "a", vessel: { ...member, [field]: value }, points: [[120, 23, 100]] }],
    };
    expect(parseJsonTrackPack(raw, "2026-08-20", "cargo")).toBeNull();
  });
});
