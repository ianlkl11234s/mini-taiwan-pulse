/**
 * 英國海域界線（第 1 波 C002，UKHO Maritime Limits and Boundaries）：類別、色票、線型 SSOT。
 * 圖例（legend）、popup（featureInfo）與 hook paint 三邊共用，避免各抄一份。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/marine/gb_maritime_limits.md`（2026-10-29 讀取）。
 *
 * 色票沿用台灣「領海界線」（maritimeBoundaryTypes.ts）同一組色：
 *   紅＝領海（12 浬、6 浬）、琥珀＝基線（直線基線、海灣封口線）、
 *   藍＝英國管轄外界（EEZ 實線、大陸棚虛線）、紫＝與鄰國分界／中間線、中性灰虛線＝四地海域分區線。
 * `line-dasharray` 不支援 data-driven → 虛線類（大陸棚、四地分區）與封口線（z8 起）各自成層。
 */
import { BOUNDARY_GRAY, type LineTier } from "../map/mapStyleScale";

/** `limit_type` 欄位值（切片 tilestats 實際出現的 9 種全集）。 */
export type GbMaritimeLimitKind =
  | "territorial_sea" | "six_nm" | "baseline" | "closing_line"
  | "eez" | "continental_shelf" | "boundary" | "median_line" | "national_limit";

export interface GbMaritimeLimitType {
  value: GbMaritimeLimitKind;
  /** 暗底色；`null`＝中性灰（隨暗／淡底圖切換，L-5） */
  color: string | null;
  width: LineTier;
  dashed: boolean;
}

/** 宣告順序＝圖例順序（由岸向外，再列分界與分區）。 */
export const GB_MARITIME_LIMIT_TYPES: readonly GbMaritimeLimitType[] = [
  { value: "baseline", color: "#f59e0b", width: "thin", dashed: false },
  { value: "closing_line", color: "#f59e0b", width: "thin", dashed: false },
  { value: "six_nm", color: "#ef4444", width: "thin", dashed: false },
  { value: "territorial_sea", color: "#ef4444", width: "standard", dashed: false },
  { value: "eez", color: "#38bdf8", width: "emphasis", dashed: false },
  { value: "continental_shelf", color: "#38bdf8", width: "standard", dashed: true },
  { value: "boundary", color: "#a78bfa", width: "standard", dashed: false },
  { value: "median_line", color: "#a78bfa", width: "standard", dashed: false },
  { value: "national_limit", color: null, width: "thin", dashed: true },
];

export const GB_MARITIME_LAYER_COLOR = "#38bdf8";
export const GB_MARITIME_FALLBACK_COLOR = "#94a3b8";

/** 實線主層、虛線層、封口線層（封口線 290 條多為短線，z8 起才顯示）。 */
export const GB_MARITIME_SOLID_KINDS: GbMaritimeLimitKind[] = ["baseline", "six_nm", "territorial_sea", "eez", "boundary", "median_line"];
export const GB_MARITIME_DASHED_KINDS: GbMaritimeLimitKind[] = ["continental_shelf", "national_limit"];
export const GB_MARITIME_CLOSING_KINDS: GbMaritimeLimitKind[] = ["closing_line"];
export const GB_MARITIME_CLOSING_MINZOOM = 8;

const BY_VALUE = new Map(GB_MARITIME_LIMIT_TYPES.map((type) => [type.value as string, type]));

export function gbMaritimeLimitType(value: unknown): GbMaritimeLimitType | undefined {
  return typeof value === "string" ? BY_VALUE.get(value) : undefined;
}

export function gbMaritimeLimitColor(type: GbMaritimeLimitType, isDark: boolean): string {
  return type.color ?? BOUNDARY_GRAY[isDark ? "dark" : "light"];
}

export const GB_MARITIME_ATTRIBUTION =
  "United Kingdom, Overseas Territories and Crown Dependencies Limits and Boundaries Dataset, UK Hydrographic Office, licensed under the Open Government Licence v3.0";
export const GB_MARITIME_SOURCE_URL = "https://datahub.admiralty.co.uk/portal/home/item.html?id=bf77b2ac1b654efc95dc3665c0501e23";
export const GB_MARITIME_LICENSE = "Open Government Licence v3.0";
/** 切片 `source_date` 只有一個值 20260107。 */
export const GB_MARITIME_SOURCE_DATE = "2026-01-07";
export const GB_MARITIME_FETCHED_AT = "2026-10-29";
