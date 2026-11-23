/**
 * 30 天地圖挑戰 Day 23「味覺 Taste」的 Mapbox 運算式（overlayRegistry 用；常數與色在 mapchallengeDay23Types.ts）。
 *
 * - 色：詞（或寫法）→ 類別色 match；暗底＝原型色，淡底＝同色相加深。
 * - 半徑：k × √n × 大小滑桿（面積正比於家數，POINT_TIERS B 泡泡）。
 * - 篩選：選單選的詞（或組）＋格網級別 res（res 6／7 兩個子圖層以 minzoom／maxzoom 在 z9 交接）。
 * - 光暈：同半徑 ×2.1 的模糊圓（靜態光暈例外，map-layers §3.1 P-6；站主 2026-11-22 指定「發光圓點」）。
 */
import {
  MAPCHALLENGE_DAY23_ARC, MAPCHALLENGE_DAY23_GLOW, MAPCHALLENGE_DAY23_RADIUS_K, MAPCHALLENGE_DAY23_TERMS, mapchallengeDay23TermColor,
  type MapchallengeDay23Foreign, type MapchallengeDay23Place, type MapchallengeDay23Term, type MapchallengeDay23VariantGroup,
} from "./mapchallengeDay23Types";

const N = ["max", 1, ["to-number", ["get", "n"], 1]];

export function mapchallengeDay23RadiusExpr(scale: number, factor = 1, k: number = MAPCHALLENGE_DAY23_RADIUS_K): unknown[] {
  return ["*", k * scale * factor, ["sqrt", N]];
}

/** 大圓畫在下面，小圓不被蓋住 */
export function mapchallengeDay23SortKeyExpr(): unknown[] {
  return ["-", 0, ["to-number", ["get", "n"], 0]];
}

export function mapchallengeDay23TermColorExpr(isDark: boolean): unknown[] {
  const fallback = mapchallengeDay23TermColor(MAPCHALLENGE_DAY23_TERMS[0], isDark);
  return ["match", ["get", "term"], ...MAPCHALLENGE_DAY23_TERMS.flatMap((t) => [t.value, mapchallengeDay23TermColor(t, isDark)]), fallback];
}

export function mapchallengeDay23TermFilter(term: MapchallengeDay23Term, res: number): unknown[] {
  return ["all", ["==", ["get", "term"], term.value], ["==", ["to-number", ["get", "res"], 0], res]];
}

/** 同物異字：色依寫法序號 w（只含目前選的那一組的寫法） */
export function mapchallengeDay23VariantColorExpr(group: MapchallengeDay23VariantGroup, isDark: boolean): unknown[] {
  const [first, ...rest] = group.words;
  return ["match", ["to-number", ["get", "w"], 0], ...rest.flatMap((w, i) => [i + 1, mapchallengeDay23TermColor(w, isDark)]), mapchallengeDay23TermColor(first, isDark)];
}

export function mapchallengeDay23VariantFilter(group: MapchallengeDay23VariantGroup, res: number): unknown[] {
  return ["all", ["==", ["get", "group"], group.value], ["==", ["to-number", ["get", "res"], 0], res]];
}

/** 光暈透明度：設計值 × 圖層透明度滑桿，淡底減半（同 Day 17 光暈） */
export function mapchallengeDay23GlowOpacity(isDark: boolean, opacity: number): number {
  return MAPCHALLENGE_DAY23_GLOW.opacity * (isDark ? 1 : 0.5) * opacity;
}

/**
 * 店名裡的地名：同一個檔有三種 feature（kind＝cell 格心點／origin 原產地點／arc 弧線）。
 * circle 圖層會在 LineString 的每個頂點畫圓，所以每個子圖層的 filter 都要帶 kind。
 */
export function mapchallengeDay23PlaceFilter(place: MapchallengeDay23Place, kind: "cell" | "arc", res: number): unknown[] {
  return ["all", ["==", ["get", "kind"], kind], ["==", ["get", "sign"], place.value], ["==", ["to-number", ["get", "res"], 0], res]];
}
export function mapchallengeDay23OriginFilter(place: MapchallengeDay23Place): unknown[] {
  return ["all", ["==", ["get", "kind"], "origin"], ["==", ["get", "sign"], place.value]];
}
/** 弧線寬＝(base＋perStore×該格家數)×大小滑桿 */
export function mapchallengeDay23ArcWidthExpr(scale: number): unknown[] {
  return ["*", scale, ["+", MAPCHALLENGE_DAY23_ARC.base, ["*", MAPCHALLENGE_DAY23_ARC.perStore, N]]];
}
export function mapchallengeDay23ArcOpacity(isDark: boolean, opacity: number): number {
  return (isDark ? MAPCHALLENGE_DAY23_ARC.opacityDark : MAPCHALLENGE_DAY23_ARC.opacityLight) * opacity;
}

export function mapchallengeDay23ForeignFilter(group: MapchallengeDay23Foreign, res: number): unknown[] {
  return ["all", ["==", ["get", "group"], group.value], ["==", ["to-number", ["get", "res"], 0], res]];
}
