import { describe, expect, it } from "vitest";
import {
  JP_EVACUATION_FILTERS,
  JP_EVACUATION_SITE_COLOR_EXPRESSION,
  JP_EVACUATION_SITE_TYPES,
  jpEvacuationFilter,
} from "../data/jpEvacuationSiteTypes";

describe("日本避難場所 PMTiles 契約", () => {
  it("兩種場所各一色，色票運算式依 site_type 分色", () => {
    expect(JP_EVACUATION_SITE_TYPES.map((t) => t.value)).toEqual(["emergency_site", "shelter"]);
    expect(JP_EVACUATION_SITE_COLOR_EXPRESSION).toEqual(expect.arrayContaining(["match", ["get", "site_type"]]));
  });

  it("select index 0=全部（不篩）、1–8 災害種別布林欄、9 福祉避難所，無效值 fail closed", () => {
    expect(jpEvacuationFilter(0)).toBeNull();
    expect(jpEvacuationFilter(1)).toEqual(["==", ["get", "hazard_flood"], true]);
    expect(jpEvacuationFilter(8)).toEqual(["==", ["get", "hazard_volcano"], true]);
    expect(jpEvacuationFilter(9)).toEqual(["==", ["get", "is_welfare_shelter"], true]);
    expect(jpEvacuationFilter(-1)).toEqual(["literal", false]);
    expect(jpEvacuationFilter(10)).toEqual(["literal", false]);
    expect(JP_EVACUATION_FILTERS).toHaveLength(9);
  });
});
