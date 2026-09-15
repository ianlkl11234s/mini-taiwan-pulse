import { describe, expect, it } from "vitest";
import { JP_MEDICAL_CARE_TYPES, JP_MEDICAL_CATEGORIES, jpMedicalAreaLevelFromIndex, jpMedicalCareTypeFromIndex } from "./jpMedicalTypes";

describe("日本醫療分類契約", () => {
  it("保留五種 Navii record_kind 與固定顏色", () => {
    expect(JP_MEDICAL_CATEGORIES.map((item) => item.value)).toEqual(["hospital", "clinic", "dental", "maternity", "pharmacy"]);
    expect(new Set(JP_MEDICAL_CATEGORIES.map((item) => item.color)).size).toBe(5);
  });
  it("保留 H17 的 35 個來源 service_type，不以名稱推測或合併", () => {
    expect(JP_MEDICAL_CARE_TYPES).toHaveLength(35);
    expect(jpMedicalCareTypeFromIndex(1)).toBe("介護医療院");
    expect(jpMedicalCareTypeFromIndex(35)).toBe("通所介護");
    expect(jpMedicalCareTypeFromIndex(36)).toBeNull();
  });
  it("area select index 直接對應三種醫療圈，無效值 fail closed", () => {
    expect(jpMedicalAreaLevelFromIndex(0)).toBe("1");
    expect(jpMedicalAreaLevelFromIndex(1)).toBe("2");
    expect(jpMedicalAreaLevelFromIndex(2)).toBe("3");
    expect(jpMedicalAreaLevelFromIndex(3)).toBeNull();
  });
});
