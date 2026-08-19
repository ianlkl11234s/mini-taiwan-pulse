import { describe, expect, it } from "vitest";
import { parseAnimalAdoptionDaily, parseAnimalAdoptionSummary } from "../animalAdoptionLoader";

describe("animal adoption RPC contract", () => {
  it("maps migration 353 shelter summary fields", () => {
    const row = parseAnimalAdoptionSummary({
      canonical_shelter_id: "animal_shelter:PS00000001",
      shelter_name: "臺北市動物之家",
      county_code: "2",
      county_name: "臺北市",
      longitude: 121.5,
      latitude: 25.1,
      listed_count: 12,
      species_counts: { 狗: 8, 貓: 4 },
      latest_snapshot_date: "2026-08-19",
      latest_collected_at: "2026-08-19T01:00:00Z",
    });
    expect(row).toMatchObject({
      canonical_shelter_id: "animal_shelter:PS00000001",
      lng: 121.5,
      lat: 25.1,
      listed_count: 12,
      latest_snapshot_date: "2026-08-19",
    });
  });

  it("maps daily animal_count and does not invent missing dates", () => {
    expect(parseAnimalAdoptionDaily({ snapshot_date: "2026-08-19", animal_count: 8190 }))
      .toEqual({ snapshot_date: "2026-08-19", listed_count: 8190 });
  });

  it("rejects summary rows without valid coordinates", () => {
    expect(parseAnimalAdoptionSummary({ shelter_name: "unknown" })).toBeNull();
  });
});
