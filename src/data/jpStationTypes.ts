import type { ExpressionSpecification } from "mapbox-gl";

// ── 種類（operator_types 正規化）──
export interface JpStationType { value: string; label: string; color: string; }
export const JP_STATION_TYPES: JpStationType[] = [
  { value: "新幹線",       label: "新幹線",       color: "#22c55e" },
  { value: "JR在来線",     label: "JR 在来線",    color: "#3b82f6" },
  { value: "民営鉄道",     label: "民営鉄道",     color: "#f97316" },
  { value: "第三セクター", label: "第三セクター", color: "#a855f7" },
  { value: "公営鉄道",     label: "公営鉄道",     color: "#14b8a6" },
];
export const JP_STATION_TYPE_OTHER = { value: "その他", label: "その他", color: "#94a3b8" };
const TYPE_PRIORITY = ["新幹線", "JR在来線", "民営鉄道", "第三セクター", "公営鉄道"];
/** 陣列 operator_types → 主類（優先序）；查無回「その他」 */
export function classifyJpStationType(operatorTypes: unknown): string {
  const arr = Array.isArray(operatorTypes) ? operatorTypes.map(String) : [];
  for (const t of TYPE_PRIORITY) if (arr.includes(t)) return t;
  return JP_STATION_TYPE_OTHER.value;
}
export const JP_STATION_TYPE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "jp_type"],
  ...JP_STATION_TYPES.flatMap((t) => [t.value, t.color]),
  JP_STATION_TYPE_OTHER.color,
] as unknown as ExpressionSpecification;

// ── 運量（人/日）級距 ──
export const JP_STATION_PAX_NO_DATA = { label: "無資料", color: "#6b7280" };
export interface JpPaxBucket { min: number; label: string; color: string; }
export const JP_STATION_PAX_BUCKETS: JpPaxBucket[] = [
  { min: 0,      label: "< 1,000",   color: "#fde047" },
  { min: 1000,   label: "1千–1萬",   color: "#fb923c" },
  { min: 10000,  label: "1萬–5萬",   color: "#ef4444" },
  { min: 50000,  label: "5萬–20萬",  color: "#b91c1c" },
  { min: 200000, label: "≥ 20萬",    color: "#7f1d1d" },
];
// step：input < 0（無資料 sentinel -1）→ base 灰；否則落各級距
export const JP_STATION_PAX_COLOR_EXPRESSION: ExpressionSpecification = [
  "step", ["get", "jp_pax"],
  JP_STATION_PAX_NO_DATA.color,
  ...JP_STATION_PAX_BUCKETS.flatMap((b) => [b.min, b.color]),
] as unknown as ExpressionSpecification;
/** 逐年 fallback 取運量；全 null 回 -1（無資料 sentinel） */
export function jpStationPax(props: Record<string, unknown>): number {
  const num = (v: unknown) => { if (v == null || v === "" || v === "null") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  return num(props.passengers_2024) ?? num(props.passengers_2023) ?? num(props.passengers_2022) ?? -1;
}
// select 模式（value 給 encode 用；label 給 UI）
export const JP_STATION_COLOR_MODES = [
  { label: "種類", value: "type" },
  { label: "運量", value: "ridership" },
];
