/**
 * 登山安全兩層（山域事故 mountainRescueIncidents + 山屋 mountainHuts）的
 * 分類、配色與 Mapbox 表達式單一真實來源。
 * 給 overlayRegistry 配色/篩選、LegendPanel 圖例、featureInfo popup 三處共用
 * （同 urbanZoningTypes.ts 慣例）。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（同 urbanZoningTypes.ts 註）。
 */

// ── 山域事故 cause（上游 17 個原始值 → 9 族）────────────────────────────

/** 缺值 / 未歸類共用中性灰 */
export const MOUNTAIN_RESCUE_MISSING_COLOR = "#8a8a8a";

/**
 * cause 9 族。`raw` 列出上游出現過的所有原始值（2026-08-01 成品實測 17 種），
 * 新增原始值若沒列進來會落到「其他・不明」灰色 —— 不會消失，但要記得補。
 */
export const MOUNTAIN_RESCUE_CAUSES: { value: string; label: string; color: string; raw: string[] }[] = [
  { value: "lost",       label: "迷路",      color: "#f2c94c", raw: ["迷路", "迷路,遲歸", "迷路,其他"] },
  { value: "trauma",     label: "創傷",      color: "#eb5757", raw: ["創傷"] },
  { value: "fall",       label: "墜谷",      color: "#a855f7", raw: ["墜谷"] },
  { value: "illness",    label: "疾病",      color: "#4d9de0", raw: ["疾病"] },
  { value: "exhaustion", label: "疲勞",      color: "#f2994a", raw: ["疲勞"] },
  { value: "altitude",   label: "高山症",    color: "#2dd4bf", raw: ["高山症"] },
  { value: "overdue",    label: "遲歸",      color: "#84cc16", raw: ["遲歸"] },
  { value: "nature",     label: "天候・落石・動物", color: "#9aa5b1", raw: ["天候惡劣", "落石", "落雷", "動物或昆蟲攻擊", "物或昆蟲"] },
  { value: "other",      label: "其他・不明", color: MOUNTAIN_RESCUE_MISSING_COLOR, raw: ["其他", "不明"] },
];

/** 出動人次欄（6 個 int；另 4 欄是直升機/搜救犬/無人機「架次・次數」不計入人數） */
const RESCUE_PERSON_FIELDS = [
  "fire_local_persons", "fire_support_persons", "police_persons",
  "npark_persons", "forestry_persons", "civilian_persons",
] as const;

/** 出動總人次表達式（null 視為 0） */
export function rescuePersonsExpr(): unknown[] {
  return ["+", ...RESCUE_PERSON_FIELDS.map((f) => ["coalesce", ["get", f], 0])];
}

/** cause 原始值 → 9 族色（未列入的原始值與 null 落中性灰） */
export function mountainRescueColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "cause"], "—"],
    ...MOUNTAIN_RESCUE_CAUSES.flatMap((c) => [c.raw, c.color]),
    MOUNTAIN_RESCUE_MISSING_COLOR,
  ];
}

/**
 * 半徑倍率：出動總人次 4 級（中位數 7、p90 24、max 799）。
 * 乘在 zoom interpolate 外層，避免 ["zoom"] 進到 step 內。
 */
export function rescueScaleByPersonsExpr(): unknown[] {
  return ["step", rescuePersonsExpr(), 1, 10, 1.25, 30, 1.6, 80, 2];
}

/** cause 原始值 → 中文族 label（popup / 圖例共用，純 JS 不進 mapbox 表達式） */
export function mountainRescueCauseLabel(raw: string | null | undefined): string {
  if (!raw) return "不明";
  return MOUNTAIN_RESCUE_CAUSES.find((c) => c.raw.includes(raw))?.label ?? raw;
}

/** cause 原始值 → 代表色（popup Title 上色，純 JS 版） */
export function mountainRescueCauseColor(raw: string | null | undefined): string {
  if (!raw) return MOUNTAIN_RESCUE_MISSING_COLOR;
  return MOUNTAIN_RESCUE_CAUSES.find((c) => c.raw.includes(raw))?.color ?? MOUNTAIN_RESCUE_MISSING_COLOR;
}

/** 事故年份選項（上游涵蓋 2019-2024；`all` = 不篩） */
export const MOUNTAIN_RESCUE_YEARS = [2019, 2020, 2021, 2022, 2023, 2024] as const;

/** 年份篩選表達式：idx 0=全部，1..6 對應 MOUNTAIN_RESCUE_YEARS（未選中的點被濾除而非淡化） */
export function mountainRescueYearFilter(idx: number): unknown[] {
  const year = idx > 0 ? MOUNTAIN_RESCUE_YEARS[idx - 1] : undefined;
  return year === undefined ? ["has", "year"] : ["==", ["get", "year"], year];
}

// ── 山屋 facility_type（4 類）────────────────────────────────────────

export const MOUNTAIN_HUT_TYPES: { value: string; label: string; color: string }[] = [
  { value: "hut",      label: "山屋",     color: "#ec4899" },
  { value: "lodge",    label: "山莊",     color: "#fb923c" },
  { value: "campsite", label: "營地",     color: "#2dd4bf" },
  { value: "shelter",  label: "避難山屋", color: "#94a3b8" },
];

export const MOUNTAIN_HUT_MISSING_COLOR = "#8a8a8a";

/** facility_type → 4 色 */
export function mountainHutColorExpr(): unknown[] {
  return [
    "match", ["get", "facility_type"],
    ...MOUNTAIN_HUT_TYPES.flatMap((t) => [t.value, t.color]),
    MOUNTAIN_HUT_MISSING_COLOR,
  ];
}

/** facility_type → 中文 label（純 JS 版） */
export function mountainHutTypeLabel(value: string | null | undefined): string {
  if (!value) return "未分類";
  return MOUNTAIN_HUT_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** facility_type → 代表色（純 JS 版） */
export function mountainHutTypeColor(value: string | null | undefined): string {
  if (!value) return MOUNTAIN_HUT_MISSING_COLOR;
  return MOUNTAIN_HUT_TYPES.find((t) => t.value === value)?.color ?? MOUNTAIN_HUT_MISSING_COLOR;
}
