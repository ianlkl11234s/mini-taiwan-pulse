import { describe, expect, it } from "vitest";
import { buildTrackFrame } from "./frame";
import type { TrackPack } from "./types";

const vessel = (id: string) => ({
  vesselId: id,
  mmsi: null,
  shipName: id,
  vesselType: "CARGO",
  flag: null,
  hours: 2.5,
  entryTimestamp: "2026-08-20T00:00:00Z",
  exitTimestamp: "2026-08-20T02:30:00Z",
  imo: `IMO-${id}`,
  callsign: `CALL-${id}`,
  firstTransmissionDate: "2026-08-20T00:00:00Z",
  lastTransmissionDate: "2026-08-20T02:30:00Z",
  dataset: "gfw",
  geartype: "trawlers",
});
const pack: TrackPack = {
  displayDate: "2026-08-20",
  bucket: "cargo",
  pointCount: 6,
  segments: [
    { trackId: "a", vessel: vessel("a"), points: [{ lon: 120, lat: 23, epoch: 100 }, { lon: 121, lat: 24, epoch: 200 }, { lon: 122, lat: 25, epoch: 300 }] },
    { trackId: "b", vessel: vessel("b"), points: [{ lon: 120, lat: 23, epoch: 100 }, { lon: 121, lat: 24, epoch: 200 }, { lon: 122, lat: 25, epoch: 300 }] },
  ],
};

describe("GFW v4 track frame", () => {
  it("never emits future geometry and only interpolates inside each segment", () => {
    const frame = buildTrackFrame([pack], 250, 500, { maxHeads: 10, maxTrailVertices: 100 });
    expect(frame.heads[0]).toMatchObject({ lon: 121.5, lat: 24.5 });
    expect(frame.trails).toHaveLength(2);
    const firstTrail = frame.trails[0]!;
    expect(firstTrail.coordinates[firstTrail.coordinates.length - 1]).toEqual([121.5, 24.5]);
    expect(frame.trails[0]?.coordinates).not.toContainEqual([122, 25]);
  });

  it("aggregates exact same-coordinate heads without dropping members", () => {
    const frame = buildTrackFrame([pack], 200, 100, { maxHeads: 10, maxTrailVertices: 100 });
    expect(frame.visibleHeadGroups).toBe(1);
    expect(frame.visibleMembers).toBe(2);
    expect(frame.heads[0]?.members.map((member) => member.vesselId)).toEqual(["a", "b"]);
    expect(frame.heads[0]?.members[0]).toEqual(vessel("a"));
    expect(frame.heads[0]?.members[1]).toEqual(vessel("b"));
  });

  it("reports explicit over-budget counts instead of silently claiming completeness", () => {
    const frame = buildTrackFrame([pack], 200, 100, { maxHeads: 0, maxTrailVertices: 2 });
    expect(frame.renderedHeadGroups).toBe(0);
    expect(frame.overBudgetHeads).toBe(1);
    expect(frame.overBudgetTrailVertices).toBeGreaterThan(0);
    expect(frame.visibleMembers).toBe(2);
  });
});
