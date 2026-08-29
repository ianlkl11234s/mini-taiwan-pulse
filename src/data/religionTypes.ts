/**
 * 宗教主題群 6 層的分類、配色與 Mapbox 表達式單一真實來源。
 * 給 overlayRegistry 配色/篩選、LegendPanel 圖例、featureInfo popup 三處共用
 * （同 urbanZoningTypes.ts 慣例）。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step。
 */

// ── 主祀神祇 9 族（temples 分色主軸）────────────────────────────────
//
// ⚠️ 分族是**上游算好的 `deity_family` 欄**，不是 `main_deity`：後者是自由填寫的
// 1,950 種，Mapbox `match` 沒有 regex 歸併不了。規則 SSOT 在
// taipei-gis-analytics `pipelines/religion/_shared/deity_family.py`，改那邊要同步這裡。

export const DEITY_FAMILY_MISSING_COLOR = "#8a8a8a";

/** 9 族（count = 2026-08-01 成品實測，供圖例比例感；順序即圖例順序） */
export const DEITY_FAMILIES: { value: string; label: string; color: string; count: number }[] = [
  { value: "mazu",     label: "媽祖",     color: "#e91e63", count: 1039 },
  { value: "tudi",     label: "土地公",   color: "#f2c94c", count: 1385 },
  { value: "guanyin",  label: "觀音",     color: "#4dd0e1", count: 1043 },
  { value: "guangong", label: "關聖帝君", color: "#eb5757", count: 555 },
  { value: "xuantian", label: "玄天上帝", color: "#5c6bc0", count: 772 },
  { value: "wangye",   label: "王爺千歲", color: "#ff8a3d", count: 1559 },
  { value: "buddha",   label: "佛教諸佛", color: "#ffd54f", count: 1717 },
  { value: "other",    label: "其他神祇", color: "#a1887f", count: 4276 },
  { value: "unknown",  label: "未標示",   color: DEITY_FAMILY_MISSING_COLOR, count: 6855 },
];

/** deity_family → 9 色（未列入值與缺值落中性灰） */
export function deityFamilyColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "deity_family"], "unknown"],
    ...DEITY_FAMILIES.flatMap((d) => [d.value, d.color]),
    DEITY_FAMILY_MISSING_COLOR,
  ];
}

/** deity_family → 中文 label（popup / 圖例共用，純 JS 版） */
export function deityFamilyLabel(value: string | null | undefined): string {
  if (!value) return "未標示";
  return DEITY_FAMILIES.find((d) => d.value === value)?.label ?? value;
}

/** deity_family → 代表色（popup Title 上色，純 JS 版） */
export function deityFamilyColor(value: string | null | undefined): string {
  if (!value) return DEITY_FAMILY_MISSING_COLOR;
  return DEITY_FAMILIES.find((d) => d.value === value)?.color ?? DEITY_FAMILY_MISSING_COLOR;
}

// ── in_moi_registry 雙態（temples / churches / ancestral_halls 三層）──────
//
// 這是本主題群的設計重點：一個開關切「官方登記版」vs「含登記制度外的全量版」。
// temples 差 6,802 筆（OSM 民間宮壇，土地公祠約 2,300）、churches 差 1,102 筆（OSM 教會聚會點）。
// ⚠️ ancestral_halls 的 false 語意不同——是**文資祠堂**（96 筆 boch_heritage）不是 OSM，
//    故該層的選項標籤另外寫（見 REGISTRY_MODES_ANCESTRAL）。

export const REGISTRY_MODES: { value: string; label: string }[] = [
  { value: "all",          label: "全部" },
  { value: "registered",   label: "官方登記" },
  { value: "unregistered", label: "登記制度外" },
];

export const REGISTRY_MODES_ANCESTRAL: { value: string; label: string }[] = [
  { value: "all",          label: "全部" },
  { value: "registered",   label: "登記宗祠" },
  { value: "unregistered", label: "文資祠堂" },
];

/**
 * 登記狀態篩選：idx 0=全部、1=in_moi_registry true、2=false。
 * 用 `["==", ["get",...], true]` 而非 truthiness —— PMTiles 的 boolean 欄可能缺值。
 */
export function registryModeFilter(idx: number): unknown[] {
  if (idx === 1) return ["==", ["get", "in_moi_registry"], true];
  if (idx === 2) return ["==", ["get", "in_moi_registry"], false];
  return ["has", "entity_id"];
}

/** 主祀神祇多選篩選：bit 位元依 DEITY_FAMILIES 順序；全選保留原有 no-op filter。 */
export function deityFamilyFilter(mask: number): unknown[] {
  const allMask = (1 << DEITY_FAMILIES.length) - 1;
  if (mask === allMask) return ["has", "entity_id"];
  const selected = DEITY_FAMILIES
    .filter((_, index) => (mask & (1 << index)) !== 0)
    .map((family) => family.value);
  return ["in", ["coalesce", ["get", "deity_family"], "unknown"], ["literal", selected]];
}

/** temples 的 filter = 登記狀態 ∩ 主祀神祇多選 */
export function templeFilter(registryIdx: number, deityMask: number): unknown[] {
  return ["all", registryModeFilter(registryIdx), deityFamilyFilter(deityMask)];
}

// ── 宗祠 facility_type 3 類 ────────────────────────────────────────

export const ANCESTRAL_HALL_TYPES: { value: string; label: string; color: string }[] = [
  { value: "宗祠",             label: "登記宗祠",     color: "#8d6e63" },
  { value: "宗祠基金會",       label: "宗祠基金會",   color: "#bcaaa4" },
  { value: "文資祠堂（未登記）", label: "文資祠堂",   color: "#d4a017" },
];

export const ANCESTRAL_HALL_MISSING_COLOR = "#8a8a8a";

export function ancestralHallColorExpr(): unknown[] {
  return [
    "match", ["get", "facility_type"],
    ...ANCESTRAL_HALL_TYPES.flatMap((t) => [t.value, t.color]),
    ANCESTRAL_HALL_MISSING_COLOR,
  ];
}

export function ancestralHallTypeLabel(value: string | null | undefined): string {
  if (!value) return "未分類";
  return ANCESTRAL_HALL_TYPES.find((t) => t.value === value)?.label ?? value;
}

// ── 各層單色（temples 以外皆單色，色票同時進 LAYER_COLORS）──────────

export const RELIGION_LAYER_COLORS = {
  religionTemples: "#e91e63",
  religionChurches: "#7986cb",
  religionAncestralHalls: "#8d6e63",
  religionFoundations: "#4db6ac",
  religionOtherWorship: "#9575cd",
  religionTop100: "#7b1fa2",
} as const;
