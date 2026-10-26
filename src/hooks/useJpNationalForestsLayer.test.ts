import { describe, expect, it } from "vitest";
import { JP_FOREST_BLANK_COLOR, JP_FOREST_COLOR_EXPRESSION, JP_FOREST_FUNCTION_TYPES } from "../data/jpNationalForestTypes";

describe("日本国有林 PMTiles 契約", () => {
  it("機能類型 6 類分色，其餘（空白）灰", () => {
    expect(JP_FOREST_FUNCTION_TYPES.map((f) => f.value)).toEqual([
      "water_conservation", "disaster_prevention_sediment", "disaster_prevention_weather",
      "forest_recreation", "nature_preservation", "amenity_environment",
    ]);
    expect(JP_FOREST_COLOR_EXPRESSION.slice(0, 2)).toEqual(["match", ["get", "function_type_en"]]);
    expect(JP_FOREST_COLOR_EXPRESSION[JP_FOREST_COLOR_EXPRESSION.length - 1]).toBe(JP_FOREST_BLANK_COLOR);
  });
});
