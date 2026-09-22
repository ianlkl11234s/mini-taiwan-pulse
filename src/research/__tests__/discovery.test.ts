import { describe, expect, it } from "vitest";
import { describeLayer, discoverLayers, findPlaces } from "../discovery";

describe("research discovery", () => {
  it("derives searchable layers from the manifest and hides unauthorized metadata", () => {
    const context = { locked: new Set(["schools"]), visible: new Set<string>() };
    const result = discoverLayers("學校", 0, 20, context);
    expect(result.layers.some(layer => layer.key === "schools")).toBe(false);
    expect(describeLayer("schools", context)).toBeNull();
    expect(describeLayer("eduSchoolElementary", context)?.dataReadSupport).toMatchObject({ status: "not_registered", queryEnabled: false, authorization: "unknown" });
  });
  it("returns local camera candidates without claiming a geocoder result", () => {
    const result = findPlaces("台北");
    expect(result.candidates.some(place => place.id === "taipei" && place.coordinates.lng === 121.53)).toBe(true);
    expect(findPlaces("臺北 101").candidates).toEqual(expect.arrayContaining([expect.objectContaining({ id: "taipei-101", coordinates: { lng: 121.564781, lat: 25.033651 } })]));
    expect(findPlaces("台北車站").candidates).toEqual(expect.arrayContaining([expect.objectContaining({ id: "taipei-main-station", coordinates: { lng: 121.51436, lat: 25.04874 } })]));
  });
});

it("derives dataset IDs and release-selector requirements from the registered dataset contracts", () => {
  expect(describeLayer("schools")?.datasetIds).toContain("tw-schools");
  const statistics = describeLayer("statsEducationCountyStudentTeacherRatio");
  expect(statistics?.datasetIds).toContain("regional-statistics:statsEducationCountyStudentTeacherRatio");
  expect(statistics?.dataReadSupport).toMatchObject({ status: "parameters_required", queryEnabled: true, requiredParameters: ["releaseId"], authorization: "public" });
  expect(describeLayer("statsEducationCountyStudentTeacherRatio", { locked: new Set(["statsEducationCountyStudentTeacherRatio"]), visible: new Set() })).toBeNull();
});

it("lists bounded catalogue pages and never describes prototype properties as layers", () => {
  expect(discoverLayers("",0,2).returned).toBe(2);
  expect(discoverLayers("",0,2).truncated).toBe(true);
  expect(describeLayer("toString")).toBeNull();
  expect(findPlaces("臺北").candidates[0]?.id).toBe("taipei");
});

it("returns a continuation offset without silently dropping layers after the first page", () => {
  const first = discoverLayers("", 0, 20);
  expect(first.nextOffset).toBe(20);
  const second = discoverLayers("", first.nextOffset!, 20);
  expect(new Set([...first.layers, ...second.layers].map(layer => layer.key)).size).toBe(first.returned + second.returned);
});
