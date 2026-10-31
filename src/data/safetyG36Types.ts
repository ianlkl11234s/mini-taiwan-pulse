/**
 * G36（2026-10-31）消防、民防、情勢與交通事故 6 層的分類、色票、來源與 Mapbox filter SSOT ——
 * manifest／overlay／legend／popup 四邊共用。產生資料的腳本：scripts/preprocess/build-g36-safety-public.py。
 *
 * 色票是資料語意色（design-system spec §3.16），刻意不進 designTokens。
 */
import { allMultiSelectBitmask, multiSelectFilter } from "./multiSelectMapbox";

const OGDL_TW = "政府資料開放授權條款第1版";

const valuesOf = (options: readonly { value: string }[]) => options.map((option) => option.value);

// ── 2025 A1／A2 交通事故（trafficAccidents2025）────────────────────────
// 嚴重度序列：A1 深紅、A2 橙（與酒駕事故層同一語意色）。
export const TRAFFIC_ACCIDENT_CLASS_OPTIONS = [
  { value: "A1", label: "A1 類（24 小時內死亡）", color: "#dc2626", count: 1_361 },
  { value: "A2", label: "A2 類（受傷或 24 小時後死亡）", color: "#f97316", count: 320_173 },
] as const;

/** 事故主要肇因大類（來源「肇因研判大類別名稱-主要」原值，依件數排序）。 */
export const TRAFFIC_ACCIDENT_CAUSE_OPTIONS = [
  { value: "駕駛者", label: "駕駛者" },
  { value: "其他", label: "其他" },
  { value: "無(車輛駕駛者因素)", label: "無（車輛駕駛者因素）" },
  { value: "非駕駛者", label: "非駕駛者" },
  { value: "機件", label: "機件" },
  { value: "燈光", label: "燈光" },
  { value: "裝載", label: "裝載" },
  { value: "無(非車輛駕駛人因素)", label: "無（非車輛駕駛人因素）" },
  { value: "無(物或動物)", label: "無（物或動物）" },
  { value: "交通管制(設施)", label: "交通管制（設施）" },
] as const;

export const TRAFFIC_ACCIDENT_CLASS_VALUES = valuesOf(TRAFFIC_ACCIDENT_CLASS_OPTIONS);
export const TRAFFIC_ACCIDENT_CAUSE_VALUES = valuesOf(TRAFFIC_ACCIDENT_CAUSE_OPTIONS);
export const TRAFFIC_ACCIDENT_TOTAL = 321_534;
export const TRAFFIC_ACCIDENT_PERIOD = "2025-01-01～2025-11-17";
export const TRAFFIC_ACCIDENT_SOURCE = {
  source_org: "內政部警政署（A1／A2 類道路交通事故資料）",
  source_url: "https://data.gov.tw/dataset/12197",
  license: OGDL_TW,
  fetched_at: "2025-12-03",
} as const;

export function trafficAccidentFilter(
  classMask = allMultiSelectBitmask(TRAFFIC_ACCIDENT_CLASS_VALUES),
  causeMask = allMultiSelectBitmask(TRAFFIC_ACCIDENT_CAUSE_VALUES),
): unknown[] {
  return ["all",
    multiSelectFilter("cat", classMask, TRAFFIC_ACCIDENT_CLASS_VALUES),
    multiSelectFilter("cause", causeMask, TRAFFIC_ACCIDENT_CAUSE_VALUES),
  ];
}

// ── 消防栓全國（fireHydrants）來源 ───────────────────────────────────
export const FIRE_HYDRANT_SOURCES = {
  taipei_water: { org: "臺北自來水事業處（data.gov.tw 128639）", url: "https://data.gov.tw/dataset/128639", fetched: "2026-05-16", license: OGDL_TW },
  kaohsiung_fire: { org: "高雄市政府消防局（data.gov.tw 160481 等 5 份）", url: "https://data.gov.tw/dataset/160481", fetched: "2026-05-16", license: OGDL_TW },
  twc: { org: "台灣自來水公司（data.gov.tw 44642，檔案日期 2026-05-21）", url: "https://data.gov.tw/dataset/44642", fetched: "2026-10-31", license: OGDL_TW },
} as const;

// ── 海嘯警報臺（tsunamiSirens）──────────────────────────────────────
export const TSUNAMI_SIREN_COLOR = "#0891b2";

// ── 核電廠緊急應變計畫區：集結點＋避難收容處所（nuclearEpzEvacuation）──
export const NUCLEAR_EPZ_KIND_OPTIONS = [
  { value: "assembly", label: "集結點", color: "#eab308", count: 182 },
  { value: "shelter", label: "避難收容處所", color: "#7c3aed", count: 18 },
] as const;
export const NUCLEAR_EPZ_KIND_VALUES = valuesOf(NUCLEAR_EPZ_KIND_OPTIONS);
export const nuclearEpzKindFilter = (mask = allMultiSelectBitmask(NUCLEAR_EPZ_KIND_VALUES)) =>
  multiSelectFilter("kind", mask, NUCLEAR_EPZ_KIND_VALUES);

// ── 救災資源據點（disasterResourceSites）──────────────────────────────
// 保管單位依名稱關鍵字粗分（消防／公所／警察／衛生醫療／其他），非來源欄位。
export const DISASTER_RESOURCE_HOLDER_OPTIONS = [
  { value: "fire", label: "消防單位", color: "#e53935", count: 1_276 },
  { value: "township", label: "鄉鎮市區公所", color: "#f59e0b", count: 623 },
  { value: "police", label: "警察單位", color: "#2563eb", count: 934 },
  { value: "health", label: "衛生醫療", color: "#10b981", count: 238 },
  { value: "other", label: "其他（清潔隊、學校、企業等）", color: "#94a3b8", count: 2_308 },
] as const;
export const DISASTER_RESOURCE_HOLDER_VALUES = valuesOf(DISASTER_RESOURCE_HOLDER_OPTIONS);
export const disasterResourceHolderFilter = (mask = allMultiSelectBitmask(DISASTER_RESOURCE_HOLDER_VALUES)) =>
  multiSelectFilter("holder", mask, DISASTER_RESOURCE_HOLDER_VALUES);

// ── 國軍、海巡射擊公告區（firingNoticeAreas）──────────────────────────
export const FIRING_AGENCY_OPTIONS = [
  { value: "navy", label: "海軍實彈射擊公告", color: "#dc2626", count: 94 },
  { value: "coast_guard", label: "海巡署射擊通報", color: "#f59e0b", count: 93 },
] as const;
export const FIRING_AGENCY_VALUES = valuesOf(FIRING_AGENCY_OPTIONS);
export const firingAgencyFilter = (mask = allMultiSelectBitmask(FIRING_AGENCY_VALUES)) =>
  multiSelectFilter("agency", mask, FIRING_AGENCY_VALUES);

/** 分類 → 色的 Mapbox match 表達式 */
export function g36ColorExpression(property: string, options: readonly { value: string; color: string }[]): unknown[] {
  return ["match", ["get", property], ...options.flatMap((option) => [option.value, option.color]), "#94a3b8"];
}

export function g36ColorOf(options: readonly { value: string; color: string }[], value: unknown, fallback = "#94a3b8"): string {
  return options.find((option) => option.value === value)?.color ?? fallback;
}

export function g36LabelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? (value == null ? "" : String(value));
}
