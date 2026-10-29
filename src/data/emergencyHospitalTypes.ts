/**
 * 急救責任醫院分級（emergencyHospitals）—— 分級、配色與 Mapbox 表達式單一真實來源。
 * 給 overlayRegistry 配色、LegendPanel 圖例、featureInfo popup 三處共用。
 *
 * 資料：public/geo/emergency_hospitals.geojson（252 家，產生腳本 scripts/export/export_emergency_hospitals.py）。
 * 屬性 `level_group`：heavy／moderate／general／unrated；`level` 為原文（重度級／中度級／一般級），
 * 來源沒標分級的 29 家沒有 `level`、`level_group` 為 unrated —— 未標分級不是「一般級」，也不是「非急救責任醫院」。
 *
 * 配色：三級是「急救能力等級」的序列，不是危險程度，所以不用紅橙黃綠（map-layers K-3）。
 * 暗／淡底圖方向相反（F-3）：暗底越重度越亮、淡底越重度越深；未標分級一律中性灰。
 */
import type { ExpressionSpecification } from "mapbox-gl";

export type EmergencyHospitalLevelGroup = "heavy" | "moderate" | "general" | "unrated";

export interface EmergencyHospitalLevel {
  value: EmergencyHospitalLevelGroup;
  /** 中文正本（enumLabel("emergencyHospitalLevel", value, label) 翻譯） */
  label: string;
  dark: string;
  light: string;
  /** 全部 252 家中的家數（2026-05-16 匯入快照） */
  count: number;
}

export const EMERGENCY_HOSPITAL_LEVELS = [
  { value: "heavy", label: "重度級", dark: "#e0e7ff", light: "#312e81", count: 58 },
  { value: "moderate", label: "中度級", dark: "#a5b4fc", light: "#6366f1", count: 79 },
  { value: "general", label: "一般級", dark: "#6366f1", light: "#a5b4fc", count: 86 },
  { value: "unrated", label: "未標分級", dark: "#6b7280", light: "#6b7280", count: 29 },
] as const satisfies readonly EmergencyHospitalLevel[];

export const EMERGENCY_HOSPITAL_TOTAL = EMERGENCY_HOSPITAL_LEVELS.reduce((s, l) => s + l.count, 0);

export const EMERGENCY_HOSPITAL_UNRATED_COLOR = "#6b7280";

export function emergencyHospitalLevelOf(value: unknown): EmergencyHospitalLevel {
  return EMERGENCY_HOSPITAL_LEVELS.find((l) => l.value === value) ?? EMERGENCY_HOSPITAL_LEVELS[3];
}

export function emergencyHospitalColor(value: unknown, isDark: boolean): string {
  const l = emergencyHospitalLevelOf(value);
  return isDark ? l.dark : l.light;
}

export function emergencyHospitalColorExpression(isDark: boolean): ExpressionSpecification {
  return [
    "match", ["get", "level_group"],
    ...EMERGENCY_HOSPITAL_LEVELS.slice(0, 3).flatMap((l) => [l.value, isDark ? l.dark : l.light]),
    EMERGENCY_HOSPITAL_UNRATED_COLOR,
  ] as unknown as ExpressionSpecification;
}

export const EMERGENCY_HOSPITAL_DATA_AS_OF = "2026-05";
