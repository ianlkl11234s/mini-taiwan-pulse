import { describe, expect, it } from "vitest";
import {
  MEDICAL_STATISTICS_GROUPS,
  getMedicalStatisticsGroup,
  resolveMedicalStatisticsGroupKey,
  type MedicalStatisticsOptionKey,
} from "../medicalStatisticsGroups";

function visibility(...active: MedicalStatisticsOptionKey[]) {
  return Object.fromEntries(
    MEDICAL_STATISTICS_GROUPS.flatMap((group) => group.options.map((option) => [option.key, active.includes(option.key)])),
  ) as Parameters<typeof resolveMedicalStatisticsGroupKey>[1];
}

describe("medical statistics groups", () => {
  it("defines the two explicit comparison groups with their original layer keys", () => {
    expect(MEDICAL_STATISTICS_GROUPS).toEqual([
      { key: "hospitalBeds", label: "醫院病床", options: [
        { key: "statsHealthHospitalBedTotal", label: "全部" },
        { key: "statsHealthAcuteBedTotal", label: "急性" },
        { key: "statsHealthIcuBedTotal", label: "加護" },
        { key: "statsHealthHospiceBedTotal", label: "安寧" },
      ] },
      { key: "hospitalWorkforce", label: "醫院人力", options: [
        { key: "statsHealthHealthProfessionalTotal", label: "醫事人員總計" },
        { key: "statsHealthWesternPhysicianCount", label: "西醫師" },
        { key: "statsHealthRegisteredNurseCount", label: "護理師" },
      ] },
    ]);
    expect(getMedicalStatisticsGroup("statsHealthIcuBedTotal")?.key).toBe("hospitalBeds");
    expect(getMedicalStatisticsGroup("statsHealthRegisteredNurseCount")?.key).toBe("hospitalWorkforce");
    expect(getMedicalStatisticsGroup("unknown")).toBeUndefined();
  });

  it("only lets a visible expanded option override the active fallback", () => {
    const current = visibility("statsHealthHospitalBedTotal", "statsHealthAcuteBedTotal");
    expect(resolveMedicalStatisticsGroupKey("hospitalBeds", current, "statsHealthAcuteBedTotal")).toBe("statsHealthAcuteBedTotal");
    expect(resolveMedicalStatisticsGroupKey("hospitalBeds", current, "statsHealthIcuBedTotal")).toBe("statsHealthHospitalBedTotal");
  });

  it("uses an active preferred option, otherwise first active option, and never changes visibility", () => {
    const current = visibility("statsHealthHospitalBedTotal", "statsHealthHospiceBedTotal");
    const before = { ...current };
    expect(resolveMedicalStatisticsGroupKey("hospitalBeds", current, undefined, "statsHealthHospiceBedTotal")).toBe("statsHealthHospiceBedTotal");
    expect(resolveMedicalStatisticsGroupKey("hospitalBeds", current, undefined, "statsHealthIcuBedTotal")).toBe("statsHealthHospitalBedTotal");
    expect(current).toEqual(before);
  });

  it("returns null when the group has no active layer", () => {
    expect(resolveMedicalStatisticsGroupKey("hospitalWorkforce", visibility(), "statsHealthRegisteredNurseCount", "statsHealthRegisteredNurseCount")).toBeNull();
    expect(resolveMedicalStatisticsGroupKey(undefined, visibility())).toBeNull();
  });
});
