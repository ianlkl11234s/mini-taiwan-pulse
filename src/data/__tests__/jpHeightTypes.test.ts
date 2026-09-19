import { describe, expect, it } from "vitest";
import {
  JP_BUILDING_MISSING_HEIGHT_COLOR,
  jpBuildingHasHeightExpr,
  jpBuildingHeightBandColor,
  jpBuildingHeightColorExpr,
} from "../jpHeightTypes";

describe("jp building height missingness", () => {
  it("keeps null, missing-like and invalid JS values neutral while retaining 0", () => {
    expect(jpBuildingHeightBandColor(null)).toBe(JP_BUILDING_MISSING_HEIGHT_COLOR);
    expect(jpBuildingHeightBandColor(undefined)).toBe(JP_BUILDING_MISSING_HEIGHT_COLOR);
    expect(jpBuildingHeightBandColor(Number.NaN)).toBe(JP_BUILDING_MISSING_HEIGHT_COLOR);
    expect(jpBuildingHeightBandColor(-9999)).toBe(JP_BUILDING_MISSING_HEIGHT_COLOR);
    expect(jpBuildingHeightBandColor(0)).not.toBe(JP_BUILDING_MISSING_HEIGHT_COLOR);
  });

  it("uses the explicit map expression guard for 2D color and 3D eligibility", () => {
    const guard = jpBuildingHasHeightExpr();
    expect(guard).toContainEqual(["has", "height"]);
    expect(guard).toContainEqual(["!=", ["get", "height"], null]);
    expect(guard).toContainEqual([">=", ["get", "height"], 0]);
    expect(jpBuildingHeightColorExpr()).toEqual(["case", guard, expect.any(Array), JP_BUILDING_MISSING_HEIGHT_COLOR]);
  });
});


it("grid colors use the median field and preserve its missingness", () => {
  expect(jpBuildingHeightColorExpr("height_median")).toEqual([
    "case", jpBuildingHasHeightExpr("height_median"), expect.any(Array), JP_BUILDING_MISSING_HEIGHT_COLOR,
  ]);
});
