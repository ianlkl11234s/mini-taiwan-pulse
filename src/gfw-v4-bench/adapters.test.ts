import { describe, expect, it } from "vitest";
import { BINARY_TRACK_PACK_MAGIC, decodeBinaryTrackPack, decodeJsonGzipTrackPack } from "./adapters";

const vessel = {
  vessel_id: "v-1", mmsi: null, ship_name: "Cargo A", vessel_type: "CARGO", flag: "TW",
  hours: 2.5, entry_timestamp: "2026-08-20T00:00:00Z", exit_timestamp: "2026-08-20T02:30:00Z",
  imo: "IMO1234567", callsign: "CALL123", first_transmission_date: "2026-08-20T00:00:00Z",
  last_transmission_date: "2026-08-20T02:30:00Z", dataset: "gfw", geartype: "trawlers",
};

function binaryFixture(vesselRecord: Record<string, unknown> = vessel): ArrayBuffer {
  const rawMetadata = JSON.stringify({
    schema_version: 1,
    display_date: "2026-08-20",
    bucket: "cargo",
    vessels: [vesselRecord],
    segments: [{ track_id: "t-1", vessel_index: 0, point_offset: 0, point_count: 2 }],
  });
  const padding = " ".repeat((4 - (new TextEncoder().encode(rawMetadata).byteLength % 4)) % 4);
  const metadata = new TextEncoder().encode(rawMetadata + padding);
  const buffer = new ArrayBuffer(24 + metadata.byteLength + 24);
  new Uint8Array(buffer, 0, 8).set(new TextEncoder().encode(BINARY_TRACK_PACK_MAGIC));
  const header = new DataView(buffer);
  header.setUint32(8, 1, true);
  header.setUint32(12, metadata.byteLength, true);
  header.setUint32(16, 2, true);
  header.setUint32(20, 1, true);
  new Uint8Array(buffer, 24, metadata.byteLength).set(metadata);
  const base = 24 + metadata.byteLength;
  new Float32Array(buffer, base, 2).set([120, 121]);
  new Float32Array(buffer, base + 8, 2).set([23, 24]);
  new Uint32Array(buffer, base + 16, 2).set([100, 200]);
  return buffer;
}

describe("GFW v4 day-pack adapters", () => {
  it("decodes plain fixture bytes through the JSON.gz adapter boundary", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      schema_version: 1, display_date: "2026-08-20", bucket: "cargo", segment_count: 1, point_count: 2,
      segments: [{
        track_id: "t-1",
        vessel: { vessel_id: "v-1", mmsi: null, ship_name: "Cargo A", vessel_type: "CARGO", flag: "TW" },
        points: [[120, 23, 100], [121, 24, 200]],
      }],
    })).buffer;
    const pack = await decodeJsonGzipTrackPack(bytes, "2026-08-20", "cargo");
    expect(pack.pointCount).toBe(2);
    expect(pack.segments[0]?.vessel.vesselId).toBe("v-1");
  });

  it("decodes the compact typed envelope into the same internal pack", () => {
    const pack = decodeBinaryTrackPack(binaryFixture(), "2026-08-20", "cargo");
    expect(pack.segments[0]?.points).toEqual([
      { lon: 120, lat: 23, epoch: 100 },
      { lon: 121, lat: 24, epoch: 200 },
    ]);
    expect(pack.segments[0]?.vessel).toMatchObject({
      vesselId: "v-1",
      hours: 2.5,
      entryTimestamp: "2026-08-20T00:00:00Z",
      exitTimestamp: "2026-08-20T02:30:00Z",
      imo: "IMO1234567",
      callsign: "CALL123",
      firstTransmissionDate: "2026-08-20T00:00:00Z",
      lastTransmissionDate: "2026-08-20T02:30:00Z",
      dataset: "gfw",
      geartype: "trawlers",
    });
  });

  it("fails closed when expected day or bucket differs", () => {
    expect(() => decodeBinaryTrackPack(binaryFixture(), "2026-08-19", "cargo")).toThrow(/metadata/);
    expect(() => decodeBinaryTrackPack(binaryFixture(), "2026-08-20", "tanker")).toThrow(/metadata/);
  });

  it("fails closed on malformed popup metadata in the binary vessel table", () => {
    expect(() => decodeBinaryTrackPack(
      binaryFixture({ ...vessel, hours: "2.5" }),
      "2026-08-20",
      "cargo",
    )).toThrow(/vessel table/);
  });
});
