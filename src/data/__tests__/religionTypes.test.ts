import { describe, expect, it } from "vitest";
import { DEITY_FAMILIES, deityFamilyFilter, templeFilter } from "../religionTypes";

describe("宗教主祀多選 filter", () => {
  it("全選維持原本的 no-op filter，部分選取與全關都產生明確集合", () => {
    const allMask = (1 << DEITY_FAMILIES.length) - 1;
    expect(deityFamilyFilter(allMask)).toEqual(["has", "entity_id"]);
    expect(deityFamilyFilter(0)).toEqual([
      "in", ["coalesce", ["get", "deity_family"], "unknown"], ["literal", []],
    ]);
    expect(deityFamilyFilter(0b101)).toEqual([
      "in", ["coalesce", ["get", "deity_family"], "unknown"],
      ["literal", [DEITY_FAMILIES[0]!.value, DEITY_FAMILIES[2]!.value]],
    ]);
  });

  it("temple filter 保留登記狀態與主祀多選的交集", () => {
    expect(templeFilter(1, 1)).toEqual([
      "all",
      ["==", ["get", "in_moi_registry"], true],
      ["in", ["coalesce", ["get", "deity_family"], "unknown"], ["literal", [DEITY_FAMILIES[0]!.value]]],
    ]);
  });
});
