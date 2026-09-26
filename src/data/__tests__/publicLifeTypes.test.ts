import { describe, expect, it } from "vitest";
import {
  ACCESSIBILITY_STATUS_VALUES, ACCESSIBLE_FACILITY_TYPE_VALUES,
  BICYCLE_SUPPORT_SERVICE_VALUES, DISASTER_SHELTER_TYPE_VALUES,
  PUBLIC_TOILET_TYPE_VALUES, RECYCLING_MATERIAL_VALUES,
  accessibleFacilityFilter, bicycleSupportServiceFilter, disasterShelterTypeFilter,
  publicToiletTypeFilter, recyclingMaterialFilter,
} from "../publicLifeTypes";
import { allMultiSelectBitmask } from "../multiSelectMapbox";

describe("public life multi-select filters", () => {
  it("公廁場所類別支援全選、單選與全關", () => {
    expect(publicToiletTypeFilter(allMultiSelectBitmask(PUBLIC_TOILET_TYPE_VALUES))).toEqual(["has", "type2"]);
    expect(publicToiletTypeFilter(1)).toEqual(["in", ["get", "type2"], ["literal", ["商業營業場所"]]]);
    expect(publicToiletTypeFilter(0)).toEqual(["==", ["get", "type2"], "__multi_select_none__"]);
  });

  it("回收材質只比對來源明列的原始 materials array", () => {
    expect(recyclingMaterialFilter(allMultiSelectBitmask(RECYCLING_MATERIAL_VALUES))).toEqual(["has", "feature_type"]);
    expect(JSON.stringify(recyclingMaterialFilter(1))).toContain("paper_packaging");
    expect(JSON.stringify(recyclingMaterialFilter(1))).not.toContain("plastic_bottles");
    expect(recyclingMaterialFilter(0)).toEqual(["==", ["get", "feature_type"], "__multi_select_none__"]);
  });

  it("避難災種、無障礙類型＋狀態與單車服務保留多選語意", () => {
    expect(JSON.stringify(disasterShelterTypeFilter(1))).toContain("水災");
    expect(disasterShelterTypeFilter(0)).toEqual(["==", ["get", "name"], "__multi_select_none__"]);

    const accessible = accessibleFacilityFilter(1, 2);
    expect(accessible).toEqual(["all",
      ["in", ["get", "feature_type"], ["literal", [ACCESSIBLE_FACILITY_TYPE_VALUES[0]]]],
      ["in", ["get", "accessibility_status"], ["literal", [ACCESSIBILITY_STATUS_VALUES[1]]]],
    ]);

    expect(JSON.stringify(bicycleSupportServiceFilter(1))).toContain("has_repair");
    expect(bicycleSupportServiceFilter(allMultiSelectBitmask(BICYCLE_SUPPORT_SERVICE_VALUES))).toEqual(["has", "feature_type"]);
    expect(disasterShelterTypeFilter(allMultiSelectBitmask(DISASTER_SHELTER_TYPE_VALUES))).toEqual(["has", "name"]);
  });
});
