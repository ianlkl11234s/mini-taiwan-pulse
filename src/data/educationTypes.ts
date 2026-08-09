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

/**
 * 校地**面積**分級（面量圖 `eduCampusArea`）——與 `eduCampusPolygon` 同一份切片、
 * 同一個 sourceId，差別只在讀法：前者按學制分色，後者按 `area_ha` 分級。
 *
 * 門檻取 1/2/5/10 ha（實測濾除 non_school 後 4,324 面：
 * median 2.08、p90 4.80、p99 24.86、max 293.48），各級筆數見 label。
 * 色階用 YlGnBu 5 階（sequential，與主題其他圖層的類別色不衝突）。
 */
export const CAMPUS_AREA_BUCKETS: { min: number; color: string; label: string }[] = [
  { min: 0, color: "#ffffcc", label: "< 1 公頃 708" },
  { min: 1, color: "#a1dab4", label: "1 ~ 2 公頃 1,337" },
  { min: 2, color: "#41b6c4", label: "2 ~ 5 公頃 1,883" },
  { min: 5, color: "#2c7fb8", label: "5 ~ 10 公頃 260" },
  { min: 10, color: "#253494", label: "≥ 10 公頃 136" },
];

/** `step` 的第一個值是「小於第一個門檻」的顏色，故 buckets[0].min 不進表達式 */
export function campusAreaColorExpr(): unknown[] {
  const rest = CAMPUS_AREA_BUCKETS.slice(1).flatMap((b) => [b.min, b.color]);
  return [
    "step",
    ["coalesce", ["to-number", ["get", "area_ha"], 0], 0],
    CAMPUS_AREA_BUCKETS[0]!.color,
    ...rest,
  ];
}

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
// 幼托與補習（kindergartens / cram_schools / afterschool_care / mutual_care）
// ─────────────────────────────────────────────────────────────

/**
 * ⚠️ 這四個 dataset 保留**原始中文欄位名**（`學校名稱`／`短期補習班名稱`／`地址`…），
 * popup 直接取中文 key。只有 `university_students` 是英文欄位，別搞混。
 *
 * 四者都有 geocode 的 `precision` 欄（`exact` / `cached` / `tgos` / `interpolated`）。
 * `interpolated` 是同路段內插出來的**估計位置**，全體僅 84 筆，
 * 我們用降低 opacity 表示「別把它當成跟 exact 一樣可信」（見 GEOCODE_FADE_INTERPOLATED）。
 */

/** 幼兒園公私立（合計 6,689） */
export const KINDERGARTEN_OWNERSHIP_COLORS = {
  公立: "#26a69a",
  私立: "#ec407a",
} as const;

/** 接線後自檢用 baseline */
export const KINDERGARTEN_OWNERSHIP_COUNTS = { 公立: 2392, 私立: 4297 } as const;

/** 課後照顧／互助教保無分色維度（互助教保 148 筆全數私立），只需總數供圖例用 */
export const AFTERSCHOOL_CARE_COUNT = 782;
export const MUTUAL_CARE_COUNT = 148;

export function kindergartenOwnershipColorExpr(fallback: string): unknown[] {
  const arms = Object.entries(KINDERGARTEN_OWNERSHIP_COLORS).flatMap(([k, c]) => [k, c]);
  return ["match", ["get", "公/私立"], ...arms, fallback];
}

/**
 * 短期補習班 `短期補習班類別` 的 **14 種**原始值 → 5 組。
 * 文理類一家獨大（12,554 / 73%），其餘長尾若逐一列圖例會有 14 列且多數 < 250 筆。
 * 🔴 14 種值必須全部落到某一組，否則那批點會靜默落 fallback 色。fold 後合計 = 17,137。
 */
export const CRAM_CATEGORY_GROUPS = {
  academic: ["文理類"],
  language: ["外語類"],
  arts: ["音樂、舞蹈類", "美術、書法、攝影、美工設計、圍棋類"],
  vocational: [
    "商類：珠算、心算、會計", "資訊類", "美容、美髮理髮類",
    "電機、汽車修護、建築、工藝、製圖類", "家政、插花、烹飪類", "縫紉類",
  ],
  other: ["法政類", "其他類", "瑜珈類", "速讀類"],
} as const;

export type CramCategoryGroup = keyof typeof CRAM_CATEGORY_GROUPS;

export const CRAM_CATEGORY_ORDER: CramCategoryGroup[] = [
  "academic", "language", "arts", "vocational", "other",
];

export const CRAM_CATEGORY_COLORS: Record<CramCategoryGroup, string> = {
  academic: "#5c6bc0",
  language: "#26a69a",
  arts: "#ec407a",
  vocational: "#ffa726",
  other: "#90a4ae",
};

export const CRAM_CATEGORY_LABELS: Record<CramCategoryGroup, string> = {
  academic: "文理",
  language: "外語",
  arts: "藝術",
  vocational: "技職",
  other: "其他",
};

/** 接線後自檢用 baseline（fold 後，合計 17,137） */
export const CRAM_CATEGORY_COUNTS: Record<CramCategoryGroup, number> = {
  academic: 12554,
  language: 2585,
  arts: 1401,
  vocational: 490,
  other: 107,
};

const CRAM_TO_GROUP: Record<string, CramCategoryGroup> = Object.fromEntries(
  CRAM_CATEGORY_ORDER.flatMap((g) => CRAM_CATEGORY_GROUPS[g].map((v) => [v, g])),
) as Record<string, CramCategoryGroup>;

/** 原始類別字串 → 5 組之一；未知值回 null（popup 用） */
export function cramCategoryGroupOf(cat: unknown): CramCategoryGroup | null {
  return typeof cat === "string" ? CRAM_TO_GROUP[cat] ?? null : null;
}

export function cramCategoryColorExpr(): unknown[] {
  const arms = CRAM_CATEGORY_ORDER.flatMap((g) => [
    [...CRAM_CATEGORY_GROUPS[g]],
    CRAM_CATEGORY_COLORS[g],
  ]);
  return ["match", ["get", "短期補習班類別"], ...arms, CRAM_CATEGORY_COLORS.other];
}

/** cram_schools 切片實測 zoom 範圍 */
export const CRAM_PMTILES_MINZOOM = 8;
export const CRAM_PMTILES_MAXZOOM = 15;

/**
 * 🔴 `各地短期補習班數量` 欄是**全國總數 17772**（每一列的值都一樣），
 * 不是該縣市的數量 —— popup **絕對不要顯示這個欄位**。
 */
export const CRAM_FORBIDDEN_POPUP_FIELD = "各地短期補習班數量";

/**
 * geocode 精度淡化：`interpolated` 是同路段內插的估計位置（全體 84 筆），
 * 用 45% opacity 與其他精度區隔，popup 也會標示。
 */
export function geocodeFadeOpacity(base: number): unknown[] {
  return [
    "case",
    ["==", ["get", "precision"], "interpolated"], base * 0.45,
    base,
  ];
}

export const GEOCODE_PRECISION_LABELS: Record<string, string> = {
  exact: "門牌精確命中",
  cached: "官方座標（快取）",
  tgos: "TGOS 批次解析",
  interpolated: "⚠️ 同路段內插（位置是估計值）",
};

// ─────────────────────────────────────────────────────────────
// 大專校別學生數（university_students；⚠️ 英文欄位）
// ─────────────────────────────────────────────────────────────

export const UNIVERSITY_BUBBLE_COLOR = "#ab47bc";

/** 🔴 21 筆 `students_total` 是 null，用灰色小點畫出來而非當成 0 或整筆丟掉 */
export const UNIVERSITY_NO_DATA_COLOR = "#90a4ae";

/** 接線後自檢用 baseline：159 筆＝有值 138 ＋ null 21（368 ~ 34,941 人） */
export const UNIVERSITY_STUDENTS_COUNTS = { total: 159, withValue: 138, nullValue: 21 } as const;

/**
 * bubble 半徑：面積正比於人數 → 對 `students_total` 開根號後線性內插。
 * null 的 21 筆走 `case` 分支給固定小半徑，**不能落進 interpolate**（會被當成 0）。
 * null 全部可解釋：進修學院/空大 10（學生數歸母校）／宗教研修學院 9（不在統計範圍）／停辦改名 2。
 */
export function universityBubbleRadius(scale: number): unknown[] {
  return [
    "case",
    ["==", ["get", "students_total"], null], 3 * scale,
    [
      "interpolate", ["linear"],
      ["sqrt", ["to-number", ["get", "students_total"], 0]],
      0, 3 * scale,
      190, 22 * scale,
    ],
  ];
}

export function universityBubbleColorExpr(): unknown[] {
  return [
    "case",
    ["==", ["get", "students_total"], null], UNIVERSITY_NO_DATA_COLOR,
    UNIVERSITY_BUBBLE_COLOR,
  ];
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
  // 校地面積面量圖：取色階中段代表整層
  eduCampusArea: "#41b6c4",
  // 學區面：沿用該級距的「整里皆屬」飽和色代表整層
  eduDistrictElementary: DISTRICT_COLORS.elementary.full,
  eduDistrictJunior: DISTRICT_COLORS.junior.full,
  eduDistrictSenior: DISTRICT_SENIOR_CYCLE_COLORS[0],
  // 幼托補習：各以該層的主色代表
  eduKindergarten: KINDERGARTEN_OWNERSHIP_COLORS.私立,
  eduCramSchool: CRAM_CATEGORY_COLORS.academic,
  eduAfterschoolCare: "#8d6e63",
  eduMutualCare: "#4dd0e1",
  eduUniversityStudents: UNIVERSITY_BUBBLE_COLOR,
} as const;
