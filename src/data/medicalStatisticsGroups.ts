import type { LayerVisibility } from "../types";

export const MEDICAL_STATISTICS_GROUPS = [
  {
    key: "hospitalBeds",
    label: "醫院病床",
    options: [
      { key: "statsHealthHospitalBedTotal", label: "全部" },
      { key: "statsHealthAcuteBedTotal", label: "急性" },
      { key: "statsHealthIcuBedTotal", label: "加護" },
      { key: "statsHealthHospiceBedTotal", label: "安寧" },
    ],
  },
  {
    key: "hospitalWorkforce",
    label: "醫院人力",
    options: [
      { key: "statsHealthHealthProfessionalTotal", label: "醫事人員總計" },
      { key: "statsHealthWesternPhysicianCount", label: "西醫師" },
      { key: "statsHealthRegisteredNurseCount", label: "護理師" },
    ],
  },
] as const;

export type MedicalStatisticsGroup = (typeof MEDICAL_STATISTICS_GROUPS)[number];
export type MedicalStatisticsGroupKey = MedicalStatisticsGroup["key"];
export type MedicalStatisticsOptionKey = MedicalStatisticsGroup["options"][number]["key"];

type MedicalStatisticsVisibility = Pick<LayerVisibility, MedicalStatisticsOptionKey>;

export function getMedicalStatisticsGroup(key: string): MedicalStatisticsGroup | undefined {
  return MEDICAL_STATISTICS_GROUPS.find((group) => group.key === key || group.options.some((option) => option.key === key));
}

/**
 * Resolves a detail key without mutating visibility. Active options always win;
 * when several are active this only chooses the detail target and preserves all
 * active layers for the caller to render.
 */
export function resolveMedicalStatisticsGroupKey(
  group: MedicalStatisticsGroup | MedicalStatisticsGroupKey | undefined,
  visibility: MedicalStatisticsVisibility,
  expandedKey?: string,
  preferredKey?: string,
): MedicalStatisticsOptionKey | null {
  const resolvedGroup = typeof group === "string" ? getMedicalStatisticsGroup(group) : group;
  if (!resolvedGroup) return null;

  const activeKeys = resolvedGroup.options
    .map((option) => option.key)
    .filter((key) => visibility[key]);
  if (activeKeys.length === 0) return null;
  if (expandedKey && activeKeys.includes(expandedKey as MedicalStatisticsOptionKey)) {
    return expandedKey as MedicalStatisticsOptionKey;
  }
  if (preferredKey && activeKeys.includes(preferredKey as MedicalStatisticsOptionKey)) {
    return preferredKey as MedicalStatisticsOptionKey;
  }
  return activeKeys[0] ?? null;
}
