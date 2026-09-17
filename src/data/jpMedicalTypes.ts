import type { ExpressionSpecification } from "mapbox-gl";

export type JpMedicalRecordKind = "hospital" | "clinic" | "dental" | "maternity" | "pharmacy";

/** Navii `record_kind` 的固定分類、圖例與 popup 共同 SSOT。 */
export const JP_MEDICAL_CATEGORIES = [
  { value: "hospital", label: "醫院", color: "#dc2626" },
  { value: "clinic", label: "診所", color: "#2563eb" },
  { value: "dental", label: "牙科", color: "#8b5cf6" },
  { value: "maternity", label: "助產所", color: "#ec4899" },
  { value: "pharmacy", label: "藥局", color: "#16a34a" },
] as const satisfies readonly { value: JpMedicalRecordKind; label: string; color: string }[];

export const JP_MEDICAL_CATEGORY_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "record_kind"],
  ...JP_MEDICAL_CATEGORIES.flatMap((type) => [type.value, type.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

/** H17 原始 service_type。value 保留來源字串，不能用顯示 label 回推或合併。 */
export const JP_MEDICAL_CARE_TYPES = [
  "介護医療院", "介護療養型医療施設", "介護老人保健施設", "介護老人福祉施設",
  "地域密着型介護老人福祉施設入所者生活介護", "地域密着型特定施設入居者生活介護（有料老人ホーム（サービス付き高齢者向け住宅））",
  "地域密着型特定施設入居者生活介護（有料老人ホーム）", "地域密着型特定施設入居者生活介護（軽費老人ホーム）", "地域密着型通所介護",
  "夜間対応型訪問介護", "定期巡回・随時対応型訪問介護看護", "小規模多機能型居宅介護", "居宅介護支援", "指定療養通所介護",
  "特定施設入居者生活介護（有料老人ホーム（サービス付き高齢者向け住宅（外部サービス利用型））)", "特定施設入居者生活介護（有料老人ホーム（サービス付き高齢者向け住宅））",
  "特定施設入居者生活介護（有料老人ホーム（外部サービス利用型））", "特定施設入居者生活介護（有料老人ホーム）", "特定施設入居者生活介護（軽費老人ホーム（外部サービス利用型））", "特定施設入居者生活介護（軽費老人ホーム）",
  "特定福祉用具販売", "看護小規模多機能型居宅介護（複合型サービス）", "短期入所生活介護", "短期入所療養介護(療養病床を有する病院等）", "短期入所療養介護（介護医療院）", "短期入所療養介護（介護老人保健施設）",
  "福祉用具貸与", "訪問リハビリテーション", "訪問介護", "訪問入浴介護", "訪問看護", "認知症対応型共同生活介護", "認知症対応型通所介護", "通所リハビリテーション", "通所介護",
].map((value) => ({ value, label: value })) as readonly { value: string; label: string }[];

export const JP_MEDICAL_AREA_LEVELS: { value: "1" | "2" | "3"; label: string }[] = [
  { value: "1", label: "一次醫療圈" },
  { value: "2", label: "二次醫療圈" },
  { value: "3", label: "三次醫療圈" },
];

export const JP_MEDICAL_AREA_COLOR = "#f59e0b";
export const JP_MEDICAL_CARE_COLOR = "#0ea5e9";

export function jpMedicalCategory(value: unknown) {
  return JP_MEDICAL_CATEGORIES.find((item) => item.value === value);
}

export function jpMedicalCareTypeFromIndex(index: number): string | null {
  return JP_MEDICAL_CARE_TYPES[index - 1]?.value ?? null;
}

export function jpMedicalAreaLevelFromIndex(index: number): "1" | "2" | "3" | null {
  return JP_MEDICAL_AREA_LEVELS[index]?.value ?? null;
}
