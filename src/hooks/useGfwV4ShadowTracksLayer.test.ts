import { describe, expect, it } from "vitest";
import { parseGfwHourlyGridVessels } from "../data/gfwHourlyGridTypes";
import { gfwV4HitCollection, gfwV4ShadowEpoch } from "./useGfwV4ShadowTracksLayer";

describe("gfw v4 shadow hook contracts", () => {
  it("maps the global scrub clock onto the selected immutable POC day", () => {
    const source = Date.parse("2026-08-28T13:45:30Z") / 1_000;
    expect(new Date(gfwV4ShadowEpoch(source, "2026-08-21") * 1_000).toISOString()).toBe("2026-08-21T13:45:30.000Z");
  });

  it("puts all same-coordinate popup members and optional fields on the hit feature", () => {
    const collection = gfwV4HitCollection([{
      lon: 121, lat: 24, buckets: ["cargo", "fishing"], members: [
        { vesselId: "a", mmsi: "123", shipName: "A", vesselType: "CARGO", flag: "TWN", hours: 1.5,
          imo: "IMO1", callsign: null, dataset: "public-global-presence", geartype: null,
          firstTransmissionDate: "2020-01-01T00:00:00Z", lastTransmissionDate: "2026-08-21T23:00:00Z",
          entryTimestamp: "2026-08-21T00:00:00Z", exitTimestamp: "2026-08-21T23:00:00Z" },
        { vesselId: "b", mmsi: null, shipName: null, vesselType: "FISHING", flag: null, hours: 2,
          imo: null, callsign: null, dataset: "public-global-presence", geartype: "drifting_longlines",
          firstTransmissionDate: null, lastTransmissionDate: null,
          entryTimestamp: "2026-08-21T00:00:00Z", exitTimestamp: "2026-08-21T23:00:00Z" },
      ],
    }], "2026-08-21", Date.parse("2026-08-21T13:45:30Z") / 1_000, 1);
    const properties = collection.features[0]?.properties;
    expect(properties?.vessel_count).toBe(2);
    const members = JSON.parse(String(properties?.members_json));
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ vessel_id: "a", hours: 1.5, imo: "IMO1" });
    expect(members[1]).toMatchObject({ vessel_id: "b", geartype: "drifting_longlines" });
    expect(parseGfwHourlyGridVessels(properties?.vessels_json)).toHaveLength(2);
    expect(properties).toMatchObject({
      selected_time: "2026-08-21T13:45:30.000Z", start_at: "2026-08-21T12:45:30.000Z",
      end_at: "2026-08-21T13:45:30.000Z", source_dataset: "public-global-presence", full_fidelity: 1,
    });
  });

  it("fails closed rather than emitting a partial extended popup member", () => {
    expect(() => gfwV4HitCollection([{
      lon: 121, lat: 24, buckets: ["cargo"],
      members: [{ vesselId: "partial", mmsi: null, shipName: null, vesselType: null, flag: null, hours: 1 }],
    }], "2026-08-21")).toThrow(/neither legacy-5 nor complete-14/);
  });
});
