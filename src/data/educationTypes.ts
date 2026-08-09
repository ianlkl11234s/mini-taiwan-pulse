/**
 * 教育 Education（第 38 主題）— 分色 / 篩選 / 標籤 SSOT
 *
 * 上游契約：`taipei-gis-analytics/docs/handoff/education-layers.md`
 * 資料：`public/education/schools.geojson`（4,315 點）
 *      `public/education/campus_polygon.pmtiles`（4,336 面，layer `campus_polygon`）
 *
 * ⚠️ 三個必須寫在這裡而不是散在 registry 的理由：
 *  1. schools 的 `school_level` 有 9 種值，要 fold 成 5 級才不會漏點（見 SCHOOL_LEVEL_GROUPS）
 *  2. `region_type` 的 key 在全部 4,315 筆都存在，非偏遠是 JSON null → 不能用 ["has"] 判斷
 *  3. campus_polygon 的 `non_school` 12 筆是上游刻意保留的標記，濾除是前端責任
 */

// ─────────────────────────────────────────────────────────────
// 學制 5 級（schools.geojson）
// ─────────────────────────────────────────────────────────────

/**
 * `school_level` 的 9 種原始值 → 5 級。
 *
 * 🔴 9 種值必須全部落到某一級，否則那批點會靜默消失。
 * handoff 表列的 2614/736/508/140/28 只是「主類別」，加總 4,026，
 * 少掉附設國小 42／附設國中 228／空大進修 10／宗教研修 9 共 289 校。
 * 下方 fold 後合計 = 4,315 = GeoJSON 總點數。
 */
export const SCHOOL_LEVEL_GROUPS = {
  elementary: ["國民小學", "附設國民小學"],
  junior: ["國民中學", "附設國民中學"],
  senior: ["高級中等學校"],
  university: ["大專校院", "空大及大專校院附設進修學校", "宗教研修學院"],
  special: ["特殊教育學校"],
} as const;

export type SchoolLevelGroup = keyof typeof SCHOOL_LEVEL_GROUPS;

export const SCHOOL_LEVEL_ORDER: SchoolLevelGroup[] = [
  "elementary",
  "junior",
  "senior",
  "university",
  "special",
];

export const SCHOOL_LEVEL_COLORS: Record<SchoolLevelGroup, string> = {
  elementary: "#66bb6a",
  junior: "#ffa726",
  senior: "#ef5350",
  university: "#ab47bc",
  special: "#78909c",
};

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevelGroup, string> = {
  elementary: "國小",
  junior: "國中",
  senior: "高中職",
  university: "大專",
  special: "特教",
};

/** 接線後自檢用 baseline（fold 後，合計 4,315） */
export const SCHOOL_LEVEL_COUNTS: Record<SchoolLevelGroup, number> = {
  elementary: 2656,
  junior: 964,
  senior: 508,
  university: 159,
  special: 28,
};

const LEVEL_TO_GROUP: Record<string, SchoolLevelGroup> = Object.fromEntries(
  SCHOOL_LEVEL_ORDER.flatMap((g) => SCHOOL_LEVEL_GROUPS[g].map((v) => [v, g])),
) as Record<string, SchoolLevelGroup>;

/** 原始 `school_level` 字串 → 5 級之一；未知值回 null（popup 用） */
export function schoolLevelGroupOf(level: unknown): SchoolLevelGroup | null {
  return typeof level === "string" ? LEVEL_TO_GROUP[level] ?? null : null;
}

/** 單一分級的 Mapbox filter（5 個 eduSchool* sublayer 各用一個） */
export function schoolLevelFilter(group: SchoolLevelGroup): unknown[] {
  return ["in", ["get", "school_level"], ["literal", [...SCHOOL_LEVEL_GROUPS[group]]]];
}

/** 依學制上色的 match 表（總覽層 schoolLevelColor 模式 + 偏遠層描邊用） */
export function schoolLevelColorExpr(fallback: string): unknown[] {
  const arms = SCHOOL_LEVEL_ORDER.flatMap((g) => [
    [...SCHOOL_LEVEL_GROUPS[g]],
    SCHOOL_LEVEL_COLORS[g],
  ]);
  return ["match", ["get", "school_level"], ...arms, fallback];
}

// ─────────────────────────────────────────────────────────────
// 偏遠地區標記（schools.geojson 的 region_type）
// ─────────────────────────────────────────────────────────────

export const REGION_TYPES = ["偏遠", "特偏", "極偏"] as const;
export type RegionType = (typeof REGION_TYPES)[number];

export const REGION_TYPE_COLORS: Record<RegionType, string> = {
  偏遠: "#ffd54f",
  特偏: "#ff8f00",
  極偏: "#d84315",
};

/** 接線後自檢用 baseline（合計 1,152） */
export const REGION_TYPE_COUNTS: Record<RegionType, number> = {
  偏遠: 830,
  特偏: 192,
  極偏: 130,
};

/**
 * 偏遠學校 filter。
 *
 * 🔴 不能寫成 `["has", "region_type"]` —— 這個 key 在全部 4,315 筆都存在，
 * 非偏遠的 3,163 筆值是 JSON `null`，`has` 會全數命中。
 */
export const REMOTE_SCHOOL_FILTER: unknown[] = [
  "match",
  ["get", "region_type"],
  [...REGION_TYPES],
  true,
  false,
];

export function regionTypeColorExpr(fallback: string): unknown[] {
  const arms = REGION_TYPES.flatMap((t) => [t, REGION_TYPE_COLORS[t]]);
  return ["match", ["get", "region_type"], ...arms, fallback];
}

// ─────────────────────────────────────────────────────────────
// 校地面（campus_polygon.pmtiles）
// ─────────────────────────────────────────────────────────────

/**
 * campus 的 `school_level` 是英文代碼，10 類（與 schools.geojson 的中文欄位不同一套）。
 * 分色收斂成 6 組：九年一貫併入國中、實驗/國際併為「其他」、幼兒園單獨。
 * `non_school` 保留在表中僅為分色完整性（實際被 CAMPUS_NON_SCHOOL_FILTER 濾掉）。
 */
export const CAMPUS_LEVEL_COLORS: Record<string, string> = {
  elementary: "#66bb6a",
  junior: "#ffa726",
  combined_k9: "#ffa726",
  senior: "#ef5350",
  university: "#ab47bc",
  special: "#78909c",
  international: "#7986cb",
  experimental: "#7986cb",
  kindergarten: "#4dd0e1",
  non_school: "#bdbdbd",
};

/** 圖例列（收斂後 6 組，非 10 類逐一列出） */
export const CAMPUS_LEGEND_ROWS: { color: string; label: string }[] = [
  { color: "#66bb6a", label: "國小 2,635" },
  { color: "#ffa726", label: "國中 714（含九年一貫 43）" },
  { color: "#ef5350", label: "高中職 539" },
  { color: "#ab47bc", label: "大專 326" },
  { color: "#78909c", label: "特教 29" },
  { color: "#7986cb", label: "實驗／國際 36" },
];

/**
 * 上游刻意保留、由前端負責濾除的 12 筆非學校設施
 * （國家漫畫博物館、退輔會訓練中心、臺大實驗林管理處…）。
 * 濾除後渲染 4,324 面。
 */
export const CAMPUS_NON_SCHOOL_FILTER: unknown[] = [
  "!=",
  ["get", "school_level"],
  "non_school",
];

export function campusLevelColorExpr(fallback: string): unknown[] {
  const arms = Object.entries(CAMPUS_LEVEL_COLORS).flatMap(([k, c]) => [k, c]);
  return ["match", ["get", "school_level"], ...arms, fallback];
}

/** PMTiles 切片實際 zoom 範圍（`pmtiles show` 實測；registry.minzoom 不得小於此值） */
export const CAMPUS_PMTILES_MINZOOM = 8;
export const CAMPUS_PMTILES_MAXZOOM = 15;

// ─────────────────────────────────────────────────────────────
// 學區面（school_district_k12 / school_district_senior）
// ─────────────────────────────────────────────────────────────

/**
 * 🔴 學區面**不是精確邊界**，而且**面與面本來就重疊** —— 這是制度事實不是資料錯誤。
 *
 * - `precision=village_partial`（654 面）：該里只有部分「鄰」屬這所學校，但村里 polygon
 *   無法表達鄰級切分 → **整個里都被畫進該校面**。實際歸屬看 popup 的 `lin_specs`。
 * - 共同學區（`is_shared=true`，292 面）：一個里同時屬 2-3 校，每校各自成面。
 *   實測 1,115 組「一里多校」。**不要 dedup。**
 *
 * 🔴 只有 4 縣市有資料，另 11 縣市完全沒有公告 —— 圖例必須區分「無資料」與「無學區」。
 * 🔴 臺北是 **110 學年度**，比其他三縣市舊。
 */
export const DISTRICT_K12_COUNTIES = ["臺北市", "新北市", "臺中市", "新竹市"] as const;

export type DistrictK12Level = "elementary" | "junior";

/** 接線後自檢用 baseline（合計 860） */
export const DISTRICT_K12_LEVEL_COUNTS: Record<DistrictK12Level, number> = {
  elementary: 621,
  junior: 239,
};

/** 接線後自檢用 baseline（合計 860） */
export const DISTRICT_PRECISION_COUNTS = { village_full: 206, village_partial: 654 } as const;

/**
 * 依 `precision` 分色：整里皆屬 = 飽和色、部分鄰屬 = 淡色。
 * 淡色直接把「這個面的邊界是模糊的」畫進視覺，不必等使用者點開 popup 才知道。
 * 主色沿用 SCHOOL_LEVEL_COLORS 的國小綠／國中橘，讓學區與學校點位在同一色系。
 */
export const DISTRICT_COLORS: Record<DistrictK12Level, { full: string; partial: string }> = {
  elementary: { full: "#66bb6a", partial: "#a5d6a7" },
  junior: { full: "#ffa726", partial: "#ffcc80" },
};

export function districtPrecisionColorExpr(level: DistrictK12Level): unknown[] {
  const c = DISTRICT_COLORS[level];
  return [
    "match", ["get", "precision"],
    "village_full", c.full,
    "village_partial", c.partial,
    c.partial,
  ];
}

export function districtLevelFilter(level: DistrictK12Level): unknown[] {
  return ["==", ["get", "level"], level];
}

/** k12 切片實測 zoom 範圍（`pmtiles show`；registry.minzoom 不得小於此值） */
export const DISTRICT_K12_PMTILES_MINZOOM = 6;
export const DISTRICT_K12_PMTILES_MAXZOOM = 13;

/**
 * 高中就學區 15 區 —— **縣市級**，與 k12 的里級完全不同粒度，不放同一個 toggle 群組。
 * 15 色圖例列不完且沒有語意，改用 5 色循環：顏色只為區分相鄰區域。
 */
export const DISTRICT_SENIOR_CYCLE_COLORS = [
  "#5c6bc0", "#26a69a", "#8d6e63", "#ec407a", "#7e57c2",
] as const;

export function districtSeniorColorExpr(): unknown[] {
  const n = DISTRICT_SENIOR_CYCLE_COLORS.length;
  const arms = DISTRICT_SENIOR_CYCLE_COLORS.flatMap((c, i) => [i, c]);
  return [
    "match",
    // 🔴 `to-number` 不能拿掉：`district_no` 上游給的是**字串**（15 筆實測全 str，
    //    上游 06_enrich.py 排序時也要 .astype(int)）。Mapbox 算術運算子對字串做 number
    //    assertion 會 evaluation error → 整個 match 回 null → 15 個面全落預設黑色。
    //    （實測：`["%", ["get","district_no"], 5]` 餵 "9" 回 null，加 to-number 後正常。）
    ["%", ["to-number", ["get", "district_no"]], n],
    ...arms,
    DISTRICT_SENIOR_CYCLE_COLORS[0],
  ];
}

/** 圖例與 popup **都必須**出現這句（上游 handoff 明確要求） */
export const DISTRICT_DISCLAIMER = "僅供參考，實際學區以各校公告為準";

/**
 * `lin_specs`（鄰別文字）**只有 village_partial 的 654 筆有值**，
 * village_full 的 206 筆是**空字串**（不是 null）—— popup 不能直接印，要走這個函式。
 */
export function linSpecsLabel(linSpecs: unknown, precision: unknown): string {
  const s = typeof linSpecs === "string" ? linSpecs.trim() : "";
  if (s) return s;
  return precision === "village_full" ? "整里皆屬本校" : "—";
}

// ─────────────────────────────────────────────────────────────
// Sidebar 色票（layerCatalog.LAYER_COLORS 展開用）
// ─────────────────────────────────────────────────────────────

/**
 * 教育主題 7 個新 layer 的 sidebar 色點。
 * 全部引用上方常數而非重打 hex —— 圖例／地圖／sidebar 三處同色由建構保證。
 * （`schools` 總覽層沿用既有 `#42a5f5`，留在 layerCatalog 不搬進來。）
 */
export const EDUCATION_LAYER_COLORS = {
  eduSchoolElementary: SCHOOL_LEVEL_COLORS.elementary,
  eduSchoolJunior: SCHOOL_LEVEL_COLORS.junior,
  eduSchoolSenior: SCHOOL_LEVEL_COLORS.senior,
  eduSchoolUniversity: SCHOOL_LEVEL_COLORS.university,
  eduSchoolSpecial: SCHOOL_LEVEL_COLORS.special,
  // 偏遠三級（偏遠／特偏／極偏）的中間色，代表整層
  eduRemoteSchools: REGION_TYPE_COLORS.特偏,
  // 校地面：與 CAMPUS_LEVEL_COLORS 的「實驗／國際」同色系靛藍，代表整層
  eduCampusPolygon: "#7986cb",
  // 學區面：沿用該級距的「整里皆屬」飽和色代表整層
  eduDistrictElementary: DISTRICT_COLORS.elementary.full,
  eduDistrictJunior: DISTRICT_COLORS.junior.full,
  eduDistrictSenior: DISTRICT_SENIOR_CYCLE_COLORS[0],
} as const;
