/**
 * 暗底圖點／線的亮度下限（design-system map-layers §3.9 C-4，2026-11-10 使用者同意「點的部分可以修正」）。
 *
 * OVERLAY_REGISTRY 匯出前每個 config 過一次 withDarkContrast()（在 withLineFillSpec 之後，透明度已是最終值）：
 *  - 主體 circle／line 子圖層的字面色，在「該子圖層暗底預設透明度」下疊在暗陸 `#292828` 的對比 < 3 時，
 *    保留色相、提高 OKLab 亮度（超出色域時降彩度）到對比 ≥ DARK_CONTRAST.target。
 *  - match／case（類別）逐色提亮；step／interpolate（連續色階）整段壓縮進可見範圍，保留深淺順序。
 *  - 讀資料的顏色（["get","color"]）、裝飾子圖層、面不處理。
 * 淡底：預設不動（兩套色）。提亮後的顏色在淡底預設透明度下對比也 ≥ 3、且不在 LIGHT_KEEP（品牌、官方圖例色）時，
 * 兩種底圖共用新色（C-4「共用」）。
 *
 * 圖例（LegendPanel → legendKit SwatchDot／SwatchLine）以 liftedColorMap() 取同一份「原色 → 新色」對照，地圖與圖例同步。
 */
import type { OverlayConfig, OverlayLayerSpec } from "../types";
import { BASEMAP_LAND } from "./mapStyleScale";
import { compositeOver, contrastRatio, deltaE, fromOklch, normalizeColor, oklch, parseColor, toHex, type Rgb } from "./colorContrast";
import { isDecorativeSuffix } from "./decorativeSuffix";
import { DECORATION_SUFFIX_RE } from "./pointSpec";

/** min：對比下限；target：提亮目標（留捨入餘裕）；categoryDeltaE：同層類別提亮後彼此至少的 ΔE（OKLab×100）；rampDeltaE：連續色階壓縮後相鄰兩級至少的 ΔE。 */
export const DARK_CONTRAST = { min: 3, target: 3.15, categoryDeltaE: 8, rampDeltaE: 6 } as const;

const DARK_LAND = parseColor(BASEMAP_LAND.dark)!.rgb;
const LIGHT_LAND = parseColor(BASEMAP_LAND.light)!.rgb;

/**
 * 兩種底圖分開配色（淡底維持原色）的圖層：顏色有外部語意（品牌、官方圖例、選舉陣營）或刻意的淡底設計。
 * 原因寫在值。
 */
export const LIGHT_KEEP: Readonly<Record<string, string>> = {
  gasStationFpcc: "台塑石化品牌藍",
  gasStationCpc: "中油品牌綠",
};

/**
 * 連續色階「下限優先」的圖層（原因寫在值）：級數多、相鄰級距本來就小，寧可級距再縮也要每級都看得到。
 * 其他色階預設「級距優先」（壓縮後相鄰 ΔE 不小於 rampDeltaE，做不到時最深一級可不到下限）。
 */
export const RAMP_FLOOR_FIRST: Readonly<Record<string, string>> = {
  isobath: "12 級等深線，近岸淺水段（-20～-200 m）原本是近黑藍，疊暗陸與暗海都看不到",
};

/** 不提亮的圖層（原因寫在值）；對比契約基準照列。 */
export const DARK_LIFT_EXEMPT: Readonly<Record<string, string>> = {};

type Paint = Record<string, unknown>;

/** 子圖層透明度：數字；表達式取輸出位置 0–1 的最大值（同對比契約）。 */
export function maxOpacityOf(expr: unknown): number {
  if (typeof expr === "number") return expr;
  if (expr == null) return 1;
  const nums: number[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "number") { if (x >= 0 && x <= 1) nums.push(x); return; }
    if (!Array.isArray(x) || x.length === 0) return;
    const op = x[0];
    if (typeof op === "string" && op.startsWith("interpolate")) { for (let i = 4; i < x.length; i += 2) walk(x[i]); }
    else if (op === "step") { walk(x[2]); for (let i = 4; i < x.length; i += 2) walk(x[i]); }
    else if (op === "match") { for (let i = 3; i < x.length - 1; i += 2) walk(x[i]); walk(x[x.length - 1]); }
    else if (op === "case") { for (let i = 2; i < x.length - 1; i += 2) walk(x[i]); walk(x[x.length - 1]); }
    else if (op === "*" || op === "min" || op === "max" || op === "coalesce" || op === "+") { for (const y of x.slice(1)) walk(y); }
  };
  walk(expr);
  return nums.length ? Math.max(...nums) : 1;
}

const contrastOn = (rgb: Rgb, land: Rgb, alpha: number) => contrastRatio(compositeOver(rgb, land, alpha), land);

const isColorLiteral = (value: unknown): value is string =>
  typeof value === "string" && (value.startsWith("#") || value.startsWith("rgb")) && parseColor(value) !== null;

function format(rgb: Rgb, alpha: number): string {
  if (alpha >= 1) return toHex(rgb);
  const c = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/** 同色相、同彩度（色域內）下，暗底對比達標的最低 OKLab 亮度。 */
function floorLightness(rgb: Rgb, alpha: number, target: number = DARK_CONTRAST.target): number {
  const [L0, C, h] = oklch(rgb);
  if (contrastOn(rgb, DARK_LAND, alpha) >= target) return L0;
  let lo = L0;
  let hi = 1;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (contrastOn(fromOklch(mid, C, h), DARK_LAND, alpha) >= target) hi = mid; else lo = mid;
  }
  return hi;
}

/** 單色：暗底對比不足時提亮（保留色相）；已達標回原字串。 */
export function liftForDark(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const a = alpha * parsed.alpha;
  if (a <= 0 || contrastOn(parsed.rgb, DARK_LAND, a) >= DARK_CONTRAST.min) return color;
  const [, C, h] = oklch(parsed.rgb);
  return format(fromOklch(floorLightness(parsed.rgb, a), C, h), parsed.alpha);
}

/** 連續色階：整段亮度線性壓縮進可見範圍（保留深淺順序），再逐色補到下限。 */
export function liftRampForDark(colors: readonly string[], alpha: number, floorFirst = false): string[] {
  const parsed = colors.map((c) => parseColor(c));
  if (parsed.some((p) => !p)) return colors.map((c) => liftForDark(c, alpha));
  const ok = parsed.every((p) => contrastOn(p!.rgb, DARK_LAND, alpha * p!.alpha) >= DARK_CONTRAST.min);
  if (ok) return [...colors];
  const lch = parsed.map((p) => oklch(p!.rgb));
  const Ls = lch.map(([L]) => L);
  const floor = Math.max(...parsed.map((p) => floorLightness(p!.rgb, alpha * p!.alpha)));
  const minL = Math.min(...Ls);
  const maxL = Math.max(...Ls);
  const span = maxL - minL;
  const build = (lo: number) => {
    const hiL = Math.min(0.97, Math.max(maxL, lo + 0.15));
    return lch.map(([L, C, h]) => {
      const t = span > 0 ? (L - minL) / span : 1;
      return fromOklch(lo + t * (hiL - lo), C, h);
    });
  };
  const rgbs0 = parsed.map((p) => p!.rgb);
  // 相鄰＝依原亮度排序後相鄰（match 當色階用時，表達式裡的順序不一定是深淺順序）
  const byL = Ls.map((_, i) => i).sort((a, b) => Ls[a]! - Ls[b]!);
  const minStep = (rgbs: Rgb[]) => {
    const sorted = byL.map((i) => rgbs[i]!);
    const steps = sorted.slice(1).map((c, i) => deltaE(c, sorted[i]!)).filter((d) => d > 0.01);
    return steps.length ? Math.min(...steps) : Infinity;
  };
  // 色階相鄰級距：壓縮後不可小於 rampDeltaE（原本就小於則以原值為準）；做不到時寧可最深一級不到下限，也要分得出級距。
  const need = floorFirst ? 0 : Math.min(DARK_CONTRAST.rampDeltaE, minStep(rgbs0));
  let lo = floor;
  if (minStep(build(floor)) < need) {
    let a = minL;
    let b = floor;
    for (let i = 0; i < 24; i += 1) {
      const mid = (a + b) / 2;
      if (minStep(build(mid)) >= need) a = mid; else b = mid;
    }
    lo = a;
  }
  const out = build(lo).map((rgb, i) => format(rgb, parsed[i]!.alpha));
  return lo >= floor ? out.map((c) => liftForDark(c, alpha)) : out;
}

/**
 * 類別色（match／case 的輸出）：逐色提亮，提亮後與同層其他色太近（ΔE < categoryDeltaE，例：法院 6 種紫都撞到同一亮度下限）時，
 * 依原本深淺順序再往上錯開亮度，直到分得開或最多再加 0.12。已達標的顏色不動。
 * 同色相家族（有彩色的色相差 ≤ 45°、至少 3 色，例：淹水深度 5 級紅、資本額 5 級藍）視為有序色階，改走 liftRampForDark。
 */
export function liftCategoricalForDark(colors: readonly string[], alpha: number): string[] {
  const parsed = colors.map((c) => parseColor(c));
  const out = colors.map((c) => liftForDark(c, alpha));
  const changed = out.map((c, i) => c !== colors[i] && parsed[i] !== null);
  if (!changed.some(Boolean)) return out;
  const rgbOf = (c: string) => parseColor(c)!.rgb;
  const placed: Rgb[] = out.filter((_, i) => !changed[i] && parsed[i]).map(rgbOf);
  const order = out.map((_, i) => i).filter((i) => changed[i] && colors.indexOf(colors[i]!) === i).sort((a, b) => oklch(parsed[a]!.rgb)[0] - oklch(parsed[b]!.rgb)[0]);
  for (const i of order) {
    const p = parsed[i]!;
    const [, C, h] = oklch(p.rgb);
    let L = oklch(rgbOf(out[i]!))[0];
    let rgb = rgbOf(out[i]!);
    const minDe = (x: Rgb) => (placed.length ? Math.min(...placed.map((q) => deltaE(x, q))) : Infinity);
    // 最多再往上錯開 0.12：推到近白就失去色相；分不開時取最遠的位置（列入報告）
    const cap = Math.min(0.95, L + 0.12);
    let best = { rgb, d: minDe(rgb) };
    for (; best.d < DARK_CONTRAST.categoryDeltaE && L < cap; ) {
      L = Math.min(cap, L + 0.01);
      const cand = fromOklch(L, C, h);
      const d = minDe(cand);
      if (d > best.d) best = { rgb: cand, d };
    }
    rgb = best.rgb;
    if (rgb !== rgbOf(out[i]!)) out[i] = format(rgb, p.alpha);
    placed.push(rgb);
  }
  // 原本就同色的類別（同一色給多個值）維持同色
  colors.forEach((c, i) => { const j = colors.indexOf(c); if (j !== i) out[i] = out[j]!; });
  return out;
}

/** 對 color 表達式的「輸出位置」字面色套用轉換（條件裡的值不動）。 */
function mapColorExpr(expr: unknown, single: (c: string) => string, ramp: (cs: string[]) => string[], cats: (cs: string[]) => string[] = (cs) => cs.map(single)): unknown {
  if (isColorLiteral(expr)) return single(expr);
  if (!Array.isArray(expr) || expr.length === 0) return expr;
  const op = expr[0];
  const next = [...expr];
  let outs: number[];
  if (op === "match") outs = [...range(3, expr.length - 1, 2), expr.length - 1];
  else if (op === "case") outs = [...range(2, expr.length - 1, 2), expr.length - 1];
  else if (op === "step") outs = [2, ...range(4, expr.length, 2)];
  else if (typeof op === "string" && op.startsWith("interpolate")) outs = range(4, expr.length, 2);
  else if (op === "coalesce" || op === "to-color") outs = range(1, expr.length, 1);
  else return expr;
  const isRamp = op === "step" || (typeof op === "string" && op.startsWith("interpolate"));
  const literalIdx = outs.filter((i) => isColorLiteral(expr[i]));
  const isCats = op === "match" || op === "case";
  if (literalIdx.length >= 2 && (isRamp || isCats)) {
    const values = literalIdx.map((i) => expr[i] as string);
    const lifted = (isRamp || isHueFamily(values) ? ramp : cats)(values);
    literalIdx.forEach((i, k) => { next[i] = lifted[k]; });
  } else {
    for (const i of literalIdx) next[i] = single(expr[i] as string);
  }
  for (const i of outs) if (!isColorLiteral(expr[i])) next[i] = mapColorExpr(expr[i], single, ramp, cats);
  return next;
}

/** match／case 的輸出是否其實是同色相的有序色階。 */
export function isHueFamily(colors: readonly string[]): boolean {
  const uniq = [...new Set(colors.map(normalizeColor))];
  if (uniq.length < 3) return false;
  const hues: number[] = [];
  for (const c of uniq) {
    const p = parseColor(c);
    if (!p) return false;
    const [, C, h] = oklch(p.rgb);
    if (C >= 0.03) hues.push(h);
  }
  if (hues.length < 3) return false;
  hues.sort((a, b) => a - b);
  const gaps = hues.map((h, i) => (i === 0 ? h + 360 - hues[hues.length - 1]! : h - hues[i - 1]!));
  return 360 - Math.max(...gaps) <= 45;
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i += step) out.push(i);
  return out;
}

function collectPairs(before: unknown, after: unknown, out: Map<string, string>): void {
  if (isColorLiteral(before) && isColorLiteral(after)) {
    if (before !== after) out.set(normalizeColor(before), after);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((b, i) => collectPairs(b, after[i], out));
  }
}

const COLOR_PROP: Record<string, [string, string]> = { circle: ["circle-color", "circle-opacity"], line: ["line-color", "line-opacity"] };

export type LiftMode = "shared" | "dual";

/** 原色 → 新色對照＋共用／兩套分類（預設參數、暗底）。 */
interface LiftInfo { map: Map<string, string>; mode: LiftMode }
const LIFT_INFO = new Map<string, () => LiftInfo>();
const LIFT_CACHE = new Map<string, LiftInfo>();

function liftDark(base: Paint, type: string, floorFirst = false): Paint {
  const [cProp, oProp] = COLOR_PROP[type]!;
  if (!(cProp in base)) return base;
  const alpha = maxOpacityOf(base[oProp]);
  const lifted = mapColorExpr(base[cProp], (c) => liftForDark(c, alpha), (cs) => liftRampForDark(cs, alpha, floorFirst), (cs) => liftCategoricalForDark(cs, alpha));
  return lifted === base[cProp] ? base : { ...base, [cProp]: lifted };
}

function applyMap(base: Paint, type: string, map: Map<string, string>): Paint {
  const [cProp] = COLOR_PROP[type]!;
  if (!(cProp in base) || map.size === 0) return base;
  const next = mapColorExpr(base[cProp], (c) => map.get(normalizeColor(c)) ?? c, (cs) => cs.map((c) => map.get(normalizeColor(c)) ?? c));
  return { ...base, [cProp]: next };
}

function targets(config: OverlayConfig, layer: OverlayLayerSpec): boolean {
  if (DARK_LIFT_EXEMPT[config.id]) return false;
  if (layer.type !== "circle" && layer.type !== "line") return false;
  return !isDecorativeSuffix(layer.suffix) && !DECORATION_SUFFIX_RE.test(layer.suffix);
}

function computeInfo(config: OverlayConfig, originals: Array<[OverlayLayerSpec, OverlayLayerSpec["paint"]]>): LiftInfo {
  const map = new Map<string, string>();
  let shared = !LIGHT_KEEP[config.id];
  for (const [layer, paint] of originals) {
    const [cProp, oProp] = COLOR_PROP[layer.type]!;
    let dark: Paint;
    let light: Paint;
    try { dark = paint(true); light = paint(false); } catch { continue; }
    const before = dark[cProp];
    const after = liftDark(dark, layer.type, config.id in RAMP_FLOOR_FIRST)[cProp];
    const local = new Map<string, string>();
    collectPairs(before, after, local);
    const lightAlpha = maxOpacityOf(light[oProp]);
    for (const [orig, next] of local) {
      map.set(orig, next);
      const p = parseColor(next)!;
      if (contrastOn(p.rgb, LIGHT_LAND, lightAlpha * p.alpha) < DARK_CONTRAST.min) shared = false;
    }
  }
  return { map, mode: shared && map.size > 0 ? "shared" : "dual" };
}

function infoOf(id: string): LiftInfo | undefined {
  const cached = LIFT_CACHE.get(id);
  if (cached) return cached;
  const make = LIFT_INFO.get(id);
  if (!make) return undefined;
  const info = make();
  LIFT_CACHE.set(id, info);
  return info;
}

/** 圖例同步用：該圖層「原色 → 目前底圖下的地圖色」對照；沒提亮回空表。 */
export function liftedColorMap(key: string, isDark: boolean): ReadonlyMap<string, string> {
  const info = infoOf(key);
  if (!info || (!isDark && info.mode !== "shared")) return EMPTY;
  return info.map;
}
const EMPTY: ReadonlyMap<string, string> = new Map();

/** 測試／報告用：圖層的提亮分類（沒提亮回 undefined）。 */
export function liftModeOf(key: string): LiftMode | undefined {
  const info = infoOf(key);
  return info && info.map.size > 0 ? info.mode : undefined;
}

export function withDarkContrast(config: OverlayConfig): OverlayConfig {
  const originals: Array<[OverlayLayerSpec, OverlayLayerSpec["paint"]]> = [];
  for (const layer of config.layers) if (targets(config, layer)) originals.push([layer, layer.paint]);
  if (!originals.length) return config;
  const id = config.id;
  const previous = LIFT_INFO.get(id);
  // 同一 key 可能有多個 config（多尺度）：對照表合併
  LIFT_INFO.set(id, () => {
    const own = computeInfo(config, originals);
    const prev = previous?.();
    if (!prev) return own;
    return { map: new Map([...prev.map, ...own.map]), mode: prev.mode === "dual" || own.mode === "dual" ? "dual" : "shared" };
  });
  LIFT_CACHE.delete(id);
  const layers = config.layers.map((layer): OverlayLayerSpec => {
    if (!targets(config, layer)) return layer;
    const paint = layer.paint;
    return {
      ...layer,
      paint: (isDark, params) => {
        const base = paint(isDark, params);
        if (isDark) return liftDark(base, layer.type, id in RAMP_FLOOR_FIRST);
        const info = infoOf(id);
        return info?.mode === "shared" ? applyMap(base, layer.type, info.map) : base;
      },
    };
  });
  return { ...config, layers };
}
