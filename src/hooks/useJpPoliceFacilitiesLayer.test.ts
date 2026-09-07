import { describe, expect, it } from "vitest";
import {
  JP_POLICE_DEGRADED_COLOR,
  JP_POLICE_FACILITY_TYPES,
  JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION,
} from "../data/jpPoliceFacilityTypes";
import {
  jpPoliceFacilityInitialFilter,
  jpPoliceFacilityTypeFilter,
} from "./useJpPoliceFacilitiesLayer";

describe("日本警察設施 PMTiles 契約", () => {
  it("維持四種上游 facility_type 的共用色票", () => {
    expect(JP_POLICE_FACILITY_TYPES).toEqual([
      { value: "headquarters", label: "警察本部", color: "#7c3aed" },
      { value: "police_station", label: "警察署", color: "#2563eb" },
      { value: "koban", label: "交番", color: "#f59e0b" },
      { value: "chuzai", label: "駐在所", color: "#14b8a6" },
    ]);
    expect(JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION).toEqual(
      expect.arrayContaining(["match", ["get", "facility_type"]]),
    );
    expect(JP_POLICE_DEGRADED_COLOR).toBe("#fb923c");
  });

  it("將 0–4 select index 映射為全部或單一 facility_type，無效值 fail closed", () => {
    expect(jpPoliceFacilityTypeFilter(0)).toBeNull();
    expect(jpPoliceFacilityTypeFilter(1)).toEqual(["==", ["get", "facility_type"], "headquarters"]);
    expect(jpPoliceFacilityTypeFilter(4)).toEqual(["==", ["get", "facility_type"], "chuzai"]);
    expect(jpPoliceFacilityTypeFilter(-1)).toEqual(["literal", false]);
    expect(jpPoliceFacilityTypeFilter(5)).toEqual(["literal", false]);
  });

  it("初次 addLayer 在全部類型時省略 filter，避免 Mapbox 拒絕 filter:null", () => {
    expect(jpPoliceFacilityInitialFilter(0)).toBeUndefined();
    expect(jpPoliceFacilityInitialFilter(2)).toEqual(["==", ["get", "facility_type"], "police_station"]);
  });
});
