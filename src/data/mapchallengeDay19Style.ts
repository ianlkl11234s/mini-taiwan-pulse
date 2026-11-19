/**
 * 30 天地圖挑戰 Day 19「氣味」的顏色與 paint 運算式（依賴 map/mapStyleScale 的 C-5 類別色盤，所以和 layerManifest 會
 * import 的 mapchallengeDay19Types.ts 分開）。overlayRegistry、hook、圖例、說明框共用。
 */
import { categoricalColor, categoricalNeutral } from "../map/mapStyleScale";
import {
  MAPCHALLENGE_DAY19_DENS_CUTS, MAPCHALLENGE_DAY19_DENS_OPACITY, MAPCHALLENGE_DAY19_FACILITY_KINDS, MAPCHALLENGE_DAY19_PENALTY_RADIUS,
  MAPCHALLENGE_DAY19_RATIO_CUTS, type MapchallengeDay19Category,
} from "./mapchallengeDay19Types";

// ── 陳情六類色（C-5 類別色盤；其他或不明＝中性） ──
const CATEGORY_COLOR_IDX: Readonly<Record<Exclude<MapchallengeDay19Category, "other">, number>> = {
  cooking: 3, burning: 1, industry: 0, farm: 6, incense: 4,
};
export function mapchallengeDay19CategoryColor(key: MapchallengeDay19Category, isDark: boolean): string {
  return key === "other" ? categoricalNeutral(isDark) : categoricalColor(CATEGORY_COLOR_IDX[key], isDark);
}
export function mapchallengeDay19TopColorExpr(isDark: boolean): unknown[] {
  return ["match", ["get", "top"],
    ...(Object.keys(CATEGORY_COLOR_IDX) as Exclude<MapchallengeDay19Category, "other">[]).flatMap((k) => [k, mapchallengeDay19CategoryColor(k, isDark)]),
    categoricalNeutral(isDark)];
}

/** 密度 → 5 級透明度（step；dens 由「全部」讀 dens 欄、單一類別讀 該類件數 ÷ area） */
export function mapchallengeDay19DensOpacityExpr(category: MapchallengeDay19Category | "all", factor: number): unknown[] {
  const dens = category === "all"
    ? ["to-number", ["get", "dens"], 0]
    : ["/", ["to-number", ["get", category], 0], ["max", ["to-number", ["get", "area"], 1], 0.001]];
  const step: unknown[] = ["step", dens, MAPCHALLENGE_DAY19_DENS_OPACITY[0] * factor];
  MAPCHALLENGE_DAY19_DENS_CUTS.forEach((cut, i) => step.push(cut, MAPCHALLENGE_DAY19_DENS_OPACITY[i + 1]! * factor));
  return step;
}

// ── 設施五類 ──
export function mapchallengeDay19FacilityColor(kind: string, isDark: boolean): string {
  const k = MAPCHALLENGE_DAY19_FACILITY_KINDS.find((f) => f.kind === kind);
  return k ? categoricalColor(k.colorIdx, isDark) : categoricalNeutral(isDark);
}
export function mapchallengeDay19FacilityColorExpr(isDark: boolean): unknown[] {
  return ["match", ["get", "kind"], ...MAPCHALLENGE_DAY19_FACILITY_KINDS.flatMap((f) => [f.kind, categoricalColor(f.colorIdx, isDark)]), categoricalNeutral(isDark)];
}
/** 棄置場址：中性淺色（暗底）／深灰（淡底），比設施小一階 */
export const mapchallengeDay19DumpingColor = (isDark: boolean) => (isDark ? "#e5e7eb" : "#374151");
/** 盛行風箭頭：暗底淺藍白、淡底深靛 */
export const mapchallengeDay19WindColor = (isDark: boolean) => (isDark ? "#dbeafe" : "#1e3a8a");

// ── 裁罰：最高超標倍數 3 級暖色＋未載明灰 ──
export const MAPCHALLENGE_DAY19_RATIO_COLORS_DARK = ["#fee391", "#fe9929", "#e8590c"] as const;
export const MAPCHALLENGE_DAY19_RATIO_COLORS_LIGHT = ["#fec44f", "#ec7014", "#993404"] as const;
export const mapchallengeDay19RatioColors = (isDark: boolean) => (isDark ? MAPCHALLENGE_DAY19_RATIO_COLORS_DARK : MAPCHALLENGE_DAY19_RATIO_COLORS_LIGHT);
export const MAPCHALLENGE_DAY19_RATIO_NULL_COLOR = "#9ca3af";
export function mapchallengeDay19RatioColorExpr(isDark: boolean): unknown[] {
  const c = mapchallengeDay19RatioColors(isDark);
  const v = ["get", "max_ratio"];
  return ["case", ["!=", ["typeof", v], "number"], MAPCHALLENGE_DAY19_RATIO_NULL_COLOR,
    ["step", ["to-number", v], c[0], MAPCHALLENGE_DAY19_RATIO_CUTS[0] + 1e-9, c[1], MAPCHALLENGE_DAY19_RATIO_CUTS[1] + 1e-9, c[2]]];
}
export function mapchallengeDay19RatioColor(ratio: unknown, isDark: boolean): string {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return MAPCHALLENGE_DAY19_RATIO_NULL_COLOR;
  return mapchallengeDay19RatioColors(isDark)[MAPCHALLENGE_DAY19_RATIO_CUTS.filter((cut) => ratio > cut).length]!;
}
/** 半徑運算式（同 mapchallengeDay19PenaltyRadius） */
export function mapchallengeDay19PenaltyRadiusExpr(scale: number): unknown[] {
  const r = MAPCHALLENGE_DAY19_PENALTY_RADIUS;
  return ["*", ["+", r.base, ["*", r.k, ["sqrt", ["max", 1, ["min", ["to-number", ["get", "n"], 1], r.cap]]]]], scale];
}
