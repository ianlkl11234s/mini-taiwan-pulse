export type JpMedicalRecordKind = "hospital" | "clinic" | "dental" | "maternity" | "pharmacy";

/** Navii `record_kind` 的固定分類、圖例與 popup 共同 SSOT。 */
export const JP_MEDICAL_CATEGORIES = [
  { value: "hospital", key: "jpMedicalHospitals", label: "醫院 病院", color: "#dc2626", aggregateField: "hospital_count" },
  { value: "clinic", key: "jpMedicalClinics", label: "診所 診療所", color: "#2563eb", aggregateField: "clinic_count" },
  { value: "dental", key: "jpMedicalDental", label: "牙科 歯科", color: "#8b5cf6", aggregateField: "dental_count" },
  { value: "maternity", key: "jpMedicalMaternity", label: "助產所 助産所", color: "#ec4899", aggregateField: "maternity_count" },
  { value: "pharmacy", key: "jpMedicalPharmacies", label: "藥局 薬局", color: "#16a34a", aggregateField: "pharmacy_count" },
] as const satisfies readonly { value: JpMedicalRecordKind; key: string; label: string; color: string; aggregateField: string }[];

/**
 * 低縮放醫療／長照格網共用固定級距。數值是目前開啟分類在同一 10 km 等面積格的
 * 可繪製 record／服務登記數；不是容量、病床數、服務人次或唯一機構數。
 */
export const JP_MEDICAL_GRID_BANDS = [
  { min: 1, label: "1–4", color: "#433e85" },
  { min: 5, label: "5–19", color: "#32648e" },
  { min: 20, label: "20–99", color: "#25858e" },
  { min: 100, label: "100–499", color: "#21a685" },
  { min: 500, label: "500–1,999", color: "#52c569" },
  { min: 2_000, label: "2,000–9,999", color: "#a5db36" },
  { min: 10_000, label: "10,000+", color: "#fde725" },
] as const;

export function jpMedicalGridColorExpression(): unknown[] {
  return [
    "step", ["to-number", ["get", "aggregate_count"], 0], "rgba(0,0,0,0)",
    ...JP_MEDICAL_GRID_BANDS.flatMap(({ min, color }) => [min, color]),
  ];
}

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

export const JP_MEDICAL_CARE_GROUPS = [
  { key: "jpCarePlanning", label: "照護諮詢／計畫 介護の相談・ケアプラン", color: "#f59e0b", aggregateField: "planning_count", serviceTypes: ["居宅介護支援"] },
  { key: "jpCareHomeVisit", label: "到宅服務 自宅に訪問", color: "#0ea5e9", aggregateField: "home_visit_count", serviceTypes: ["訪問介護", "訪問入浴介護", "訪問看護", "訪問リハビリテーション", "定期巡回・随時対応型訪問介護看護", "夜間対応型訪問介護"] },
  { key: "jpCareDayServices", label: "日間服務 施設に通う", color: "#22c55e", aggregateField: "day_services_count", serviceTypes: ["通所介護", "地域密着型通所介護", "認知症対応型通所介護", "通所リハビリテーション", "指定療養通所介護"] },
  { key: "jpCareResidential", label: "住宿／短期入住 施設で生活・宿泊", color: "#a855f7", aggregateField: "residential_count", serviceTypes: [
    "介護医療院", "介護療養型医療施設", "介護老人保健施設", "介護老人福祉施設",
    "地域密着型介護老人福祉施設入所者生活介護", "地域密着型特定施設入居者生活介護（有料老人ホーム（サービス付き高齢者向け住宅））",
    "地域密着型特定施設入居者生活介護（有料老人ホーム）", "地域密着型特定施設入居者生活介護（軽費老人ホーム）",
    "特定施設入居者生活介護（有料老人ホーム（サービス付き高齢者向け住宅（外部サービス利用型））)", "特定施設入居者生活介護（有料老人ホーム（サービス付き高齢者向け住宅））",
    "特定施設入居者生活介護（有料老人ホーム（外部サービス利用型））", "特定施設入居者生活介護（有料老人ホーム）",
    "特定施設入居者生活介護（軽費老人ホーム（外部サービス利用型））", "特定施設入居者生活介護（軽費老人ホーム）",
    "短期入所生活介護", "短期入所療養介護(療養病床を有する病院等）", "短期入所療養介護（介護医療院）", "短期入所療養介護（介護老人保健施設）",
    "認知症対応型共同生活介護",
  ] },
  { key: "jpCareCombined", label: "複合服務 訪問・通い・宿泊の組合せ", color: "#f43f5e", aggregateField: "combined_count", serviceTypes: ["小規模多機能型居宅介護", "看護小規模多機能型居宅介護（複合型サービス）"] },
  { key: "jpCareEquipment", label: "福祉用具 福祉用具", color: "#14b8a6", aggregateField: "equipment_count", serviceTypes: ["福祉用具貸与", "特定福祉用具販売"] },
] as const;

export const JP_MEDICAL_AREA_LEVELS = [
  { value: "1", key: "jpMedicalAreasPrimary", label: "一次醫療圈 一次医療圏", color: "#38bdf8" },
  { value: "2", key: "jpMedicalAreasSecondary", label: "二次醫療圈 二次医療圏", color: "#f59e0b" },
  { value: "3", key: "jpMedicalAreasTertiary", label: "三次醫療圈 三次医療圏", color: "#ef4444" },
] as const;

export function jpMedicalCategory(value: unknown) {
  return JP_MEDICAL_CATEGORIES.find((item) => item.value === value);
}

export type JpMedicalCategoryKey = typeof JP_MEDICAL_CATEGORIES[number]["key"];
export type JpMedicalCareKey = typeof JP_MEDICAL_CARE_GROUPS[number]["key"];
export type JpMedicalAreaKey = typeof JP_MEDICAL_AREA_LEVELS[number]["key"];
