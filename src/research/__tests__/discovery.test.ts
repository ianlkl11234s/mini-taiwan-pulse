import { describe, expect, it } from "vitest";
import { describeLayer, discoverLayers, findPlaces } from "../discovery";

describe("research discovery", () => {
  it("derives searchable layers from the manifest and hides unauthorized metadata", () => {
    const context = { locked: new Set(["schools"]), visible: new Set<string>() };
    const result = discoverLayers("學校", 0, 20, context);
    expect(result.layers.some(layer => layer.key === "schools")).toBe(false);
    expect(describeLayer("schools", context)).toBeNull();
    // playgrounds has no bespoke research dataset registered (unlike eduSchoolElementary, which later
    // gained one in src/research/eduSchoolsOwnerDatasets.ts and became "readable" instead of "not_registered").
    expect(describeLayer("playgrounds", context)?.dataReadSupport).toMatchObject({ status: "not_registered", queryEnabled: false, authorization: "unknown" });
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

// An empty query matches every manifest layer, so discoverLayers() maps asDiscovery()
// over the whole catalogue; asDiscovery() calls registeredDatasetsForLayer() twice per
// layer, and that rebuilds + revalidates the entire dataset descriptor registry on every
// call (see researchDatasets.ts allDescriptors(), which is uncached). That's O(layers *
// descriptors) work per empty-query call and measures ~1.2-1.3s alone; under full-suite
// or CI load it can exceed vitest's default 5000ms timeout (observed CI failure at
// 5086ms). Reported as a production perf candidate, not fixed here per task scope —
// widen the timeout so this test doesn't flake under load.
it("lists bounded catalogue pages and never describes prototype properties as layers", () => {
  expect(discoverLayers("",0,2).returned).toBe(2);
  expect(discoverLayers("",0,2).truncated).toBe(true);
  expect(describeLayer("toString")).toBeNull();
  expect(findPlaces("臺北").candidates[0]?.id).toBe("taipei");
}, 15_000);

// Same empty-query cost as above, doubled (two discoverLayers("", ...) calls).
it("returns a continuation offset without silently dropping layers after the first page", () => {
  const first = discoverLayers("", 0, 20);
  expect(first.nextOffset).toBe(20);
  const second = discoverLayers("", first.nextOffset!, 20);
  expect(new Set([...first.layers, ...second.layers].map(layer => layer.key)).size).toBe(first.returned + second.returned);
}, 15_000);
