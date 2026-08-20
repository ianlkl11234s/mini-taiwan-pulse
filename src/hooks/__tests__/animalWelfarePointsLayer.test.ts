import { describe, expect, it } from "vitest";
import { animalWelfarePointMapboxProperties, animalWelfarePointRadius } from "../useAnimalWelfarePointsLayer";

describe("animal welfare point Mapbox properties", () => {
  it("keeps zoom as the top-level interpolate input", () => {
    expect(animalWelfarePointRadius(2)).toEqual([
      "interpolate", ["linear"], ["zoom"], 6, 6, 12, 12, 16, 16,
    ]);
  });

  it("keeps canonical nested columns query-safe instead of relying on Mapbox object coercion", () => {
    expect(animalWelfarePointMapboxProperties({
      source_dataset_id: "8705", source_record_key: "row-1", canonical_entity_key: "animal:row-1",
      point_type: "veterinary_clinic", service_tags: ["診療", "絕育"], name: "測試醫院",
      county_code: null, county_name: null, address: null, phone: null, status: null,
      valid_from: null, valid_to: null, longitude: 121.5, latitude: 25.05,
      geom: { type: "Point" }, geocode_metadata: { method: "official" }, details: { note: "保留" },
      availability_state: "listed", last_seen_at: null, source_record_count: 1,
    })).toMatchObject({
      service_tags: '["診療","絕育"]', geom: '{"type":"Point"}',
      geocode_metadata: '{"method":"official"}', details: '{"note":"保留"}',
    });
  });
});
