import { describe, expect, it } from "vitest";
import { describeLayer, discoverLayers, findPlaces } from "../discovery";

describe("research discovery", () => {
  it("derives searchable layers from the manifest and keeps access separate from read support", () => {
    const context = { locked: new Set(["schools"]), visible: new Set<string>() };
    const result = discoverLayers("學校", 0, 20, context);
    expect(result.layers.some(layer => layer.key === "schools" && layer.locked && layer.dataReadSupport === "supported")).toBe(true);
    expect(describeLayer("eduSchoolElementary", context)?.dataReadSupport).toBe("supported");
  });
  it("returns local camera candidates without claiming a geocoder result", () => {
    const result = findPlaces("台北");
    expect(result.candidates.some(place => place.id === "taipei" && place.coordinates.lng === 121.53)).toBe(true);
  });
});

it("lists bounded catalogue pages and never describes prototype properties as layers", () => {
  expect(discoverLayers("",0,2).returned).toBe(2);
  expect(discoverLayers("",0,2).truncated).toBe(true);
  expect(describeLayer("toString")).toBeNull();
  expect(findPlaces("臺北").candidates[0]?.id).toBe("taipei");
});
