import { describe, expect, it } from "vitest";
import { facilitiesFilter, mergedAggregate } from "../useJpMedicalLayers";

const square = (x: number, y: number): GeoJSON.Polygon => ({ type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] });
describe("jp medical national aggregates", () => {
  it("converts selected polygon cells to one center point per grid and only sums mapped counts", () => {
    const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [
      { type: "Feature", geometry: square(0, 0), properties: { grid_id: "a", record_kind: "hospital", mapped_point_count: 2, source_record_count: 9, excluded_no_coordinate_count: 7 } },
      { type: "Feature", geometry: square(0, 0), properties: { grid_id: "a", record_kind: "clinic", mapped_point_count: 3, source_record_count: 12, excluded_no_coordinate_count: 9 } },
      { type: "Feature", geometry: square(10, 10), properties: { grid_id: "b", record_kind: "hospital", mapped_point_count: 5 } },
    ] };
    const result = mergedAggregate(data, "record_kind", ["hospital", "clinic"]);
    expect(result.features).toHaveLength(2);
    expect(result.features[0]!.geometry).toEqual({ type: "Point", coordinates: [0.5, 0.5] });
    expect(result.features[0]!.properties).toEqual({ grid_id: "a", mapped_point_count: 5 });
    expect(result.features[1]!.properties).toEqual({ grid_id: "b", mapped_point_count: 5 });
  });
  it("keeps empty selection empty and maps the Midwife control to maternity", () => {
    const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [{ type: "Feature", geometry: square(0, 0), properties: { grid_id: "a", record_kind: "maternity", mapped_point_count: 1 } }] };
    expect(mergedAggregate(data, "record_kind", [])).toEqual({ type: "FeatureCollection", features: [] });
    expect(facilitiesFilter({ jpMedicalMidwife: 1 })).toEqual(["in", ["get", "record_kind"], ["literal", ["maternity"]]]);
    expect(facilitiesFilter({})).toEqual(["literal", false]);
  });
});
