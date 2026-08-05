/**
 * 殯葬主題群 5 層的分類、配色與 Mapbox 表達式單一真實來源。
 * 給 overlayRegistry 配色/篩選、LegendPanel 圖例、featureInfo popup 三處共用
 * （同 religionTypes.ts / urbanZoningTypes.ts 慣例）。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step。
 *
 * 🔴 A／B／C 三源分開，前端**不做**跨源合併/去重（2026-08-05 用戶拍板）：
 *   A = 官方名冊（設施點 + 業者點 + 區級密度）· OGDL
 *   B = OpenStreetMap 墓區面 · **ODbL，UI 必須標示**
 *   C = 都市計畫墓葬類法定用地 · OGDL，**僅臺北＋新北**
 * 契約 SSOT：taipei-gis-analytics/docs/handoff/funeral-layers.md
 */

// ── A 源 · 設施 facility_type 6 類（分色主軸）────────────────────────
//
// count = 2026-08-05 成品實測（已定位的 3,707 筆；上游母體 4,145 含 438 筆無座標）。

export const FUNERAL_FACILITY_MISSING_COLOR = "#8a8a8a";

export const FUNERAL_FACILITY_TYPES: { value: string; label: string; color: string; count: number }[] = [
  { value: "cemetery",    label: "公墓",       color: "#6d8b74", count: 2928 },
  { value: "columbarium", label: "納骨堂塔",   color: "#8e7cc3", count: 607 },
  { value: "eco_burial",  label: "環保葬",     color: "#7cb342", count: 66 },
  { value: "funeral_home", label: "殯儀館",    color: "#4d8fcc", count: 64 },
  { value: "crematorium", label: "火化場",     color: "#e07b39", count: 41 },
  { value: "ritual_hall", label: "禮廳／靈堂", color: "#c2185b", count: 1 },
];

/** facility_type → 6 色（未列入值與缺值落中性灰） */
export function facilityTypeColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "facility_type"], "unknown"],
    ...FUNERAL_FACILITY_TYPES.flatMap((t) => [t.value, t.color]),
    FUNERAL_FACILITY_MISSING_COLOR,
  ];
}

/** facility_type → 中文 label（popup / 圖例共用，純 JS 版） */
export function facilityTypeLabel(value: string | null | undefined): string {
  if (!value) return "未分類";
  return FUNERAL_FACILITY_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** facility_type → 代表色（popup Title 上色，純 JS 版） */
export function facilityTypeColor(value: string | null | undefined): string {
  if (!value) return FUNERAL_FACILITY_MISSING_COLOR;
  return FUNERAL_FACILITY_TYPES.find((t) => t.value === value)?.color ?? FUNERAL_FACILITY_MISSING_COLOR;
}

/** 設施類型篩選：idx 0=全部，1..6 對應 FUNERAL_FACILITY_TYPES */
export function facilityTypeFilter(idx: number): unknown[] {
  const t = idx > 0 ? FUNERAL_FACILITY_TYPES[idx - 1]?.value : undefined;
  if (!t) return ["has", "facility_uid"];
  return ["==", ["get", "facility_type"], t];
}

/** 公私別（operator_type）：public 3,461／private 246 */
export function operatorTypeLabel(value: string | null | undefined): string {
  if (value === "public") return "公立";
  if (value === "private") return "私立";
  return value ? String(value) : "";
}

// ── ⚠️ precision：42% 的設施點是概略座標 ──────────────────────────────
//
// 點位是四段 fallback 拼出來的。`parcel_centroid`（1,576 筆，地籍 bbox 中心，
// 誤差 1.4–126 m）與 `approximate`（429 筆，鄉鎮／路段中心，可能差數百公尺）
// **不可用於距離分析**（「最近的火化場」「500m 內設施」）。
// 純密度/分布展示則無妨 → 做成可切換的 filter，預設全顯示但 popup 誠實標示。

export const FUNERAL_PRECISION_LABELS: Record<string, string> = {
  source: "官方原生座標",
  exact: "門牌級（OSM／Google ROOFTOP）",
  cached: "門牌級（TGOS 快取）",
  tgos: "TGOS 官方比對",
  interpolated: "同路段內插",
  parcel_centroid: "地籍範圍中心（誤差 1.4–126 m）",
  approximate: "鄉鎮／路段中心（可能差數百公尺）",
};

/** 概略座標（做距離分析必須排除） */
export const FUNERAL_APPROX_PRECISIONS = ["parcel_centroid", "approximate"] as const;

/** precision 是否為概略值 → popup 加註、距離分析要排除 */
export function isApproxPrecision(value: unknown): boolean {
  return (FUNERAL_APPROX_PRECISIONS as readonly string[]).includes(String(value ?? ""));
}

export function precisionLabel(value: string | null | undefined): string {
  if (!value) return "";
  return FUNERAL_PRECISION_LABELS[value] ?? value;
}

export const PRECISION_MODES: { value: string; label: string }[] = [
  { value: "all",    label: "全部" },
  { value: "exact",  label: "僅精確定位" },
  { value: "approx", label: "僅概略座標" },
];

/**
 * 定位精度篩選：idx 0=全部、1=排除概略、2=只看概略。
 * 用 `["in", ...]` 對 precision 字串比對（欄位 100% 有值，無缺值分支）。
 */
export function precisionModeFilter(idx: number, idField: string): unknown[] {
  const approx = ["literal", [...FUNERAL_APPROX_PRECISIONS]];
  if (idx === 1) return ["!", ["in", ["get", "precision"], approx]];
  if (idx === 2) return ["in", ["get", "precision"], approx];
  return ["has", idField];
}

// ── A 源 · 禮儀業者 entity_type 2 類 + is_active 三態 ──────────────────
//
// 🔴 `is_active` 不過濾會多畫 1,638 個已歇業業者 —— 資料層刻意保留（產業消長分析用），
//    但圖層**預設只畫 true**（4,595 筆仍營業）。故 idx 0 = 仍營業，不是「全部」。

export const OPERATOR_ENTITY_MISSING_COLOR = "#8a8a8a";

export const FUNERAL_OPERATOR_ENTITY_TYPES: { value: string; label: string; color: string; count: number }[] = [
  { value: "business", label: "獨資合夥", color: "#b08968", count: 4199 },
  { value: "company",  label: "公司法人", color: "#6a8caf", count: 2034 },
];

export function operatorEntityColorExpr(): unknown[] {
  return [
    "match", ["coalesce", ["get", "entity_type"], "unknown"],
    ...FUNERAL_OPERATOR_ENTITY_TYPES.flatMap((t) => [t.value, t.color]),
    OPERATOR_ENTITY_MISSING_COLOR,
  ];
}

export function operatorEntityLabel(value: string | null | undefined): string {
  if (!value) return "未分類";
  return FUNERAL_OPERATOR_ENTITY_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function operatorEntityColor(value: string | null | undefined): string {
  if (!value) return OPERATOR_ENTITY_MISSING_COLOR;
  return FUNERAL_OPERATOR_ENTITY_TYPES.find((t) => t.value === value)?.color ?? OPERATOR_ENTITY_MISSING_COLOR;
}

/** ⚠️ idx 0（預設）= 仍營業 —— 順序不可調換，調換等於預設多畫 1,638 個已歇業業者 */
export const OPERATOR_STATUS_MODES: { value: string; label: string }[] = [
  { value: "active",   label: "仍營業 (4,595)" },
  { value: "inactive", label: "已歇業 (1,638)" },
  { value: "all",      label: "全部 (6,233)" },
];

/**
 * 營業狀態篩選：idx 1=已歇業、2=全部，其餘（含 0 與 -1）一律回「仍營業」。
 * 用 `["==", ["get",...], true]` 而非 truthiness —— boolean 欄缺值時不可靠。
 */
export function operatorStatusFilter(idx: number): unknown[] {
  if (idx === 1) return ["==", ["get", "is_active"], false];
  if (idx === 2) return ["has", "operator_id"];
  return ["==", ["get", "is_active"], true];
}

/** 業者 filter = 營業狀態 ∩ 定位精度（兩個 select 可同時作用） */
export function operatorFilter(statusIdx: number, precisionIdx: number): unknown[] {
  return ["all", operatorStatusFilter(statusIdx), precisionModeFilter(precisionIdx, "operator_id")];
}

/** 設施 filter = 設施類型 ∩ 定位精度 */
export function facilityFilter(typeIdx: number, precisionIdx: number): unknown[] {
  return ["all", facilityTypeFilter(typeIdx), precisionModeFilter(precisionIdx, "facility_uid")];
}

// ── A 源 · 區級業者密度（無幾何，join township_boundary.pmtiles）────────
//
// ⚠️ 語意是業者「**登記地**」家數，不是服務涵蓋率 —— 業者常跨區服務，不可當可及性指標。
// 值走 Mapbox feature-state（key = TOWNCODE，上游已驗證 325/325 全對）。

export const FUNERAL_DENSITY_BUCKETS: { min: number; color: string; label: string }[] = [
  { min: 0,   color: "#f2f0f7", label: "0（未登記業者）" },
  { min: 1,   color: "#dadaeb", label: "1–4 家" },
  { min: 5,   color: "#bcbddc", label: "5–9 家" },
  { min: 10,  color: "#9e9ac8", label: "10–19 家" },
  { min: 20,  color: "#807dba", label: "20–49 家" },
  { min: 50,  color: "#6a51a3", label: "50–99 家" },
  { min: 100, color: "#4a1486", label: "100+ 家（最高 218）" },
];

/**
 * feature-state.operatorCount → 分級色（無 state 視為 0）。
 * step 的第一個值是「< 第一個門檻」的顏色，故從 buckets[0] 起手、其餘逐級展開。
 */
export function funeralDensityColorExpr(): unknown[] {
  const rest = FUNERAL_DENSITY_BUCKETS.slice(1).flatMap((b) => [b.min, b.color]);
  return [
    "step",
    ["coalesce", ["feature-state", "operatorCount"], 0],
    FUNERAL_DENSITY_BUCKETS[0]!.color,
    ...rest,
  ];
}

// ── B 源 · OSM 墓區面（單色；🔴 ODbL 必須標示）──────────────────────
//
// ⚠️ 僅 34.5% 有 name → 不做以名稱為主的 popup/搜尋；popup 一律有 osm_id 兜底。

export const CEMETERY_OSM_ODBL_NOTE = "© OpenStreetMap contributors（ODbL）";

// ── C 源 · 都市計畫墓葬類法定用地（zone_label 9 種原始值 → 3 群）────────
//
// ⚠️ 僅臺北（12）＋新北（102），其他 20 縣市空白**是正常的**（都計分區只做了這兩市，
//    且只含都市土地；山區大型公墓在非都市土地的「墳墓用地」編定，該份資料尚未取得）。
// raw 攤平後給 classificationCoverage 測試比對——上游新增 zone_label 會被擋下。

export const CEMETERY_ZONING_MISSING_COLOR = "#8a8a8a";

export const CEMETERY_ZONING_CLASSES: { value: string; label: string; color: string; raw: string[] }[] = [
  {
    value: "grave",
    label: "公墓／墓地用地",
    color: "#a1554b",
    raw: ["公墓用地", "墓地", "墓地用地", "墳墓用地", "軍人公墓用地"],
  },
  {
    value: "facility",
    label: "殯葬設施用地",
    color: "#d18c5c",
    raw: ["殯葬設施用地", "殯葬設施專用區", "殯葬用地"],
  },
  {
    value: "parlor",
    label: "殯儀館用地",
    color: "#8d6e63",
    raw: ["殯儀館用地"],
  },
];

/** zone_label（原始中文）→ 3 群色（未列入值落中性灰） */
export function cemeteryZoningColorExpr(): unknown[] {
  return [
    "match", ["get", "zone_label"],
    ...CEMETERY_ZONING_CLASSES.flatMap((c) => [c.raw, c.color]),
    CEMETERY_ZONING_MISSING_COLOR,
  ];
}

export function cemeteryZoningClassLabel(zoneLabel: string | null | undefined): string {
  if (!zoneLabel) return "未分類";
  return CEMETERY_ZONING_CLASSES.find((c) => c.raw.includes(zoneLabel))?.label ?? zoneLabel;
}

export function cemeteryZoningColor(zoneLabel: string | null | undefined): string {
  if (!zoneLabel) return CEMETERY_ZONING_MISSING_COLOR;
  return CEMETERY_ZONING_CLASSES.find((c) => c.raw.includes(zoneLabel))?.color ?? CEMETERY_ZONING_MISSING_COLOR;
}

// ── 各層代表色（同時進 LAYER_COLORS）────────────────────────────────

export const FUNERAL_LAYER_COLORS = {
  funeralFacilities: "#6d8b74",
  funeralOperators: "#b08968",
  funeralOperatorDensity: "#6a51a3",
  cemeteryOsm: "#4a7c59",
  cemeteryZoning: "#a1554b",
} as const;
