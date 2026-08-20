import { describe, expect, it } from "vitest";
import {
  ANIMAL_WELFARE_POINTS_PAGE_SIZE,
  defaultAnimalWelfarePointHistoryArgs,
  defaultAnimalWelfarePointPageArgs,
  loadAnimalWelfarePointPages,
  parseAnimalWelfarePoint,
} from "../animalWelfarePointsLoader";

const point = (id: number) => ({
  source_dataset_id: "8705",
  source_record_key: `row-${id}`,
  canonical_entity_key: `animal_welfare:row-${id}`,
  point_type: "veterinary_clinic",
  service_tags: ["診療"],
  name: `動物醫院 ${id}`,
  county_code: "63000",
  county_name: "臺北市",
  address: "測試路 1 號",
  phone: "02-0000-0000",
  status: "營業中",
  longitude: 121.5,
  latitude: 25.05,
  geom: { type: "Point", coordinates: [121.5, 25.05] },
  geocode_metadata: { method: "official" },
  details: { note: "保留" },
  availability_state: "listed",
  last_seen_at: "2026-08-20T00:00:00Z",
  source_record_count: 1,
});

describe("animal welfare point RPC contract", () => {
  it("uses every documented default named argument", () => {
    expect(defaultAnimalWelfarePointPageArgs()).toEqual({
      p_point_types: null, p_county_codes: null, p_bbox: null,
      p_include_inactive: false, p_include_unlocated: false,
      p_limit: 5000, p_offset: 0,
    });
  });

  it("limits popup-only history RPC to 400 rows", () => {
    expect(defaultAnimalWelfarePointHistoryArgs("8705", "row-1")).toEqual({
      p_source_dataset_id: "8705", p_source_record_key: "row-1",
      p_from_date: null, p_to_date: null, p_limit: 400,
    });
  });

  it("paginates 5,000 rows and stops only at a short page", async () => {
    const calls: number[] = [];
    const rows = await loadAnimalWelfarePointPages(async (args) => {
      calls.push(args.p_offset);
      expect(args.p_limit).toBe(ANIMAL_WELFARE_POINTS_PAGE_SIZE);
      return args.p_offset === 0
        ? Array.from({ length: ANIMAL_WELFARE_POINTS_PAGE_SIZE }, (_, index) => point(index))
        : [point(ANIMAL_WELFARE_POINTS_PAGE_SIZE)];
    });
    expect(calls).toEqual([0, 5000]);
    expect(rows).toHaveLength(5001);
  });

  it("preserves canonical facility fields and rejects invalid coordinates", () => {
    expect(parseAnimalWelfarePoint(point(1))).toMatchObject({
      source_dataset_id: "8705", source_record_key: "row-1",
      canonical_entity_key: "animal_welfare:row-1", point_type: "veterinary_clinic",
      service_tags: ["診療"], address: "測試路 1 號", phone: "02-0000-0000",
      status: "營業中", availability_state: "listed", source_record_count: 1,
    });
    expect(parseAnimalWelfarePoint({ ...point(2), longitude: 999 })).toBeNull();
    expect(parseAnimalWelfarePoint({ ...point(3), latitude: null })).toBeNull();
  });
});
