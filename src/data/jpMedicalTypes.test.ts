import { describe, expect, it } from "vitest";
import { JP_MEDICAL_AREA_LEVELS, JP_MEDICAL_CARE_GROUPS, JP_MEDICAL_CARE_TYPES, JP_MEDICAL_CATEGORIES, JP_MEDICAL_GRID_BANDS, jpMedicalGridColorExpression } from "./jpMedicalTypes";

describe("日本醫療分類契約", () => {
  it("保留五種 Navii record_kind 與固定顏色", () => {
    expect(JP_MEDICAL_CATEGORIES.map((item) => item.value)).toEqual(["hospital", "clinic", "dental", "maternity", "pharmacy"]);
    expect(new Set(JP_MEDICAL_CATEGORIES.map((item) => item.color)).size).toBe(5);
  });
  it("保留 H17 的 35 個來源 service_type，不以名稱推測或合併", () => {
    expect(JP_MEDICAL_CARE_TYPES).toHaveLength(35);
    const grouped = JP_MEDICAL_CARE_GROUPS.flatMap(group => group.serviceTypes);
    expect(grouped).toHaveLength(35);
    expect(new Set(grouped).size).toBe(35);
    expect(new Set(grouped)).toEqual(new Set(JP_MEDICAL_CARE_TYPES.map(item => item.value)));
    expect(new Set(JP_MEDICAL_CARE_GROUPS.map(item => item.color)).size).toBe(6);
  });
  it("三種醫療圈各自成層並使用不同顏色", () => {
    expect(JP_MEDICAL_AREA_LEVELS.map(item => item.value)).toEqual(["1", "2", "3"]);
    expect(new Set(JP_MEDICAL_AREA_LEVELS.map(item => item.key)).size).toBe(3);
    expect(new Set(JP_MEDICAL_AREA_LEVELS.map(item => item.color)).size).toBe(3);
  });
  it("低縮放格網使用固定且遞增的密度級距", () => {
    expect(JP_MEDICAL_GRID_BANDS.map(item => item.min)).toEqual([1, 5, 20, 100, 500, 2_000, 10_000]);
    expect(new Set(JP_MEDICAL_GRID_BANDS.map(item => item.color)).size).toBe(JP_MEDICAL_GRID_BANDS.length);
    expect(JSON.stringify(jpMedicalGridColorExpression())).toContain("aggregate_count");
  });
});
