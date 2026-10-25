import { describe, expect, it } from "vitest";
import {
  JP_PUBLIC_OFFICE_CLASSES,
  JP_PUBLIC_OFFICE_CLASS_COLOR_EXPRESSION,
  jpPublicOfficeFilter,
} from "../data/jpPublicOfficeTypes";

describe("日本役所與公民館 PMTiles 契約", () => {
  it("5 類分色，筆數合計 79,532", () => {
    expect(JP_PUBLIC_OFFICE_CLASSES.map((c) => c.value)).toEqual([
      "main_office", "branch_office", "other_service", "public_hall", "assembly_facility",
    ]);
    expect(JP_PUBLIC_OFFICE_CLASSES.reduce((n, c) => n + c.count, 0)).toBe(79_532);
    expect(JP_PUBLIC_OFFICE_CLASS_COLOR_EXPRESSION).toEqual(expect.arrayContaining(["match", ["get", "facility_class"]]));
  });

  it("預設（index 0）隱藏集會施設；1=全部；2–6 單選一類；無效值 fail closed", () => {
    expect(jpPublicOfficeFilter(0)).toEqual(["!=", ["get", "facility_class"], "assembly_facility"]);
    expect(jpPublicOfficeFilter(1)).toBeNull();
    expect(jpPublicOfficeFilter(2)).toEqual(["==", ["get", "facility_class"], "main_office"]);
    expect(jpPublicOfficeFilter(6)).toEqual(["==", ["get", "facility_class"], "assembly_facility"]);
    expect(jpPublicOfficeFilter(7)).toEqual(["literal", false]);
    expect(jpPublicOfficeFilter(-1)).toEqual(["literal", false]);
  });
});
