import { describe, expect, it } from "vitest";
import {
  animalWelfarePointMapboxProperties,
  animalWelfarePointRadius,
  animalWelfarePointStroke,
} from "../useAnimalWelfarePointsLayer";

describe("animal welfare point Mapbox properties", () => {
  it("uses the fixed M tier and theme-aware point stroke (dark light ring, P-2 2026-11-10)", () => {
    expect(animalWelfarePointRadius(2)).toBe(9);
    expect(animalWelfarePointStroke(true, 0.8)).toEqual({
      "circle-stroke-color": "#e5e7eb",
      "circle-stroke-width": 1,
      "circle-stroke-opacity": 0.45,
    });
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
