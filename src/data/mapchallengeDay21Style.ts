/**
 * 30 天地圖挑戰 Day 21「OSM 道路畫進的年份」的 Mapbox 運算式（依賴 map/mapStyleScale 的 L-1 token，所以和
 * layerManifest 會 import 的 mapchallengeDay21Types.ts 分開；overlayRegistry 與圖例用）。
 *
 * - 色：year → 20 色 match（定案動畫色帶）。暗底由 withDarkContrast 依 C-4 提亮（保留色相與順序），圖例同步查表。
 * - 寬：道路等級三級＝L-1 emphasis／standard／thin（資料編碼，LINE_TIERS keep）。
 * - 篩選：拉到某年只畫 year ≤ 該年；「只看當年新增」畫 year ＝ 該年。
 */
import { LINE_WIDTH } from "../map/mapStyleScale";
import {
  MAPCHALLENGE_DAY21_MAJOR, MAPCHALLENGE_DAY21_MID, MAPCHALLENGE_DAY21_YEARS, mapchallengeDay21YearColor,
} from "./mapchallengeDay21Types";

export const MAPCHALLENGE_DAY21_WIDTH = { major: LINE_WIDTH.emphasis, mid: LINE_WIDTH.standard, local: LINE_WIDTH.thin } as const;

export function mapchallengeDay21ColorExpr(): unknown[] {
  return ["match", ["to-number", ["get", "year"], 0], ...MAPCHALLENGE_DAY21_YEARS.flatMap((y) => [y, mapchallengeDay21YearColor(y)]), mapchallengeDay21YearColor(0)];
}

const classMatch = (z: 0 | 1) => [
  "match", ["get", "highway"],
  [...MAPCHALLENGE_DAY21_MAJOR], MAPCHALLENGE_DAY21_WIDTH.major[z],
  [...MAPCHALLENGE_DAY21_MID], MAPCHALLENGE_DAY21_WIDTH.mid[z],
  MAPCHALLENGE_DAY21_WIDTH.local[z],
];

export function mapchallengeDay21WidthExpr(): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 10, classMatch(0), 14, classMatch(1)];
}

/** 粗線畫在上面 */
export function mapchallengeDay21SortKeyExpr(): unknown[] {
  return ["match", ["get", "highway"], [...MAPCHALLENGE_DAY21_MAJOR], 2, [...MAPCHALLENGE_DAY21_MID], 1, 0];
}

export function mapchallengeDay21YearFilter(year: number, newOnly: boolean): unknown[] {
  return [newOnly ? "==" : "<=", ["to-number", ["get", "year"], 0], year];
}
