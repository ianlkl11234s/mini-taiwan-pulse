/**
 * 線與面規格的集中套用（design-system map-layers §3.2、§3.3，R3a）。
 *
 * OVERLAY_REGISTRY 匯出前每個 config 過一次 withLineFillSpec()（接在 withPointSpec 之後）：
 *  - 線：寬度換成 L-1 三階（z10→z14 插值）、透明度換成 L-4 階，不低於 LINE_OPACITY.min
 *  - 面：透明度換成 F-1 四階；同 config 的外框線照 F-2 依面的階畫
 *  - 虛線 [2,1] → [2,2]（L-2）；一般線加圓頭圓角（L-3），行政界尖角
 *  - K-4：寬度與透明度不再依暗淡分支，只有顏色隨底圖換
 *
 * 滑桿照舊有效：新值 × (原 paint 在目前參數的值 ÷ 原 paint 在規格預設參數的值)。
 * 用原 paint 的比值而不是找滑桿名稱，同一條線受多個滑桿影響（例：透明度 × 光暈）也正確。
 * 依資料變化的寬度／透明度（isDataDriven）＝資料編碼，保留原值。
 *
 * ⚠️ 因此 overlayRegistry.ts 裡這些圖層的 line-width／line-opacity／fill-opacity 字面值只剩「比例」作用，
 *    改大小請改 lineFillTiers.ts。
 */
import type { ExpressionSpecification } from "mapbox-gl";
import type { OverlayConfig, OverlayLayerSpec } from "../types";
import { getParamsSpec, specOutKey } from "../data/layerParamsSpec";
import {
  BOUNDARY_GRAY, FILL_OPACITY, FILL_OUTLINE, GRADED_SEAM, LINE_DASH, LINE_OPACITY, lineWidthExpr, mapSeamColor,
} from "./mapStyleScale";
import { FILL_TIERS, LINE_TIERS, HOOK_LINE_TIERS, HOOK_FILL_TIERS, type FillTier, type LineTierSpec } from "./lineFillTiers";
import { DECORATION_SUFFIX_RE, isDataDriven } from "./pointSpec";

type Paint = Record<string, unknown>;
type Params = Record<string, number> | undefined;

/** 行政界（L-5）：寬度與透明度 key 用 config id（顏色在 overlayRegistry 明寫中性灰）。 */
const BOUNDARY_KEYS: ReadonlySet<string> = new Set(["countyBoundary", "townshipBoundary", "villageBoundary"]);
/** L-3：界線維持尖角（行政界、海域界、流域界）；其他主體線圓頭圓角。 */
const SHARP_KEYS: ReadonlySet<string> = new Set([...BOUNDARY_KEYS, "maritimeBoundary", "waterBasins"]);
const LINE_ROUND = { "line-cap": "round", "line-join": "round" } as const;
const LINE_SHARP = { "line-cap": "butt", "line-join": "miter" } as const;

/** 以 z14 取值：數字直接回；zoom 的 interpolate／step 在 z14 求值；其他（含依資料）回 NaN。 */
export function valueAtZ14(v: unknown): number {
  if (typeof v === "number") return v;
  if (!Array.isArray(v) || isDataDriven(v)) return NaN;
  const [op] = v;
  const isZoom = (x: unknown) => Array.isArray(x) && x[0] === "zoom";
  if (op === "interpolate" && isZoom(v[2])) {
    const stops = v.slice(3);
    if (stops.length < 2 || stops.some((s) => typeof s !== "number")) return NaN;
    const at = (i: number) => stops[i] as number;
    if (14 <= at(0)) return at(1);
    for (let i = 2; i + 1 < stops.length; i += 2) {
      if (14 <= at(i)) return at(i - 1) + ((at(i + 1) - at(i - 1)) * (14 - at(i - 2))) / (at(i) - at(i - 2));
    }
    return at(stops.length - 1);
  }
  if (op === "step" && isZoom(v[1])) {
    let out = v[2] as number;
    for (let i = 3; i < v.length; i += 2) if (14 >= (v[i] as number)) out = v[i + 1] as number;
    return typeof out === "number" ? out : NaN;
  }
  return NaN;
}

/** 這個圖層所有滑桿都在規格預設值的參數（其他參數沿用目前值）。 */
function defaultSliderParams(key: string, params: Params): Record<string, number> {
  const out: Record<string, number> = { ...(params ?? {}) };
  for (const s of getParamsSpec(key) ?? []) {
    if (s.kind !== "slider") continue;
    const k = specOutKey(s);
    if (k != null) out[k] = Number(s.default);
  }
  return out;
}

/** 目前參數下的值 ÷ 規格預設參數下的值；算不出來（依資料、0、非數字）回 1。 */
function ratio(now: unknown, def: unknown): number {
  const a = valueAtZ14(now);
  const b = valueAtZ14(def);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 1;
  return a / b;
}

/** opacityParam 登記的圖層由 applyLayerOpacity 再乘一次滑桿值，這裡先除掉預設值（同 pointSpec）。 */
function opacityParamDivisor(config: OverlayConfig): number {
  if (!config.opacityParam) return 1;
  const spec = (getParamsSpec(config.id) ?? []).find((s) => s.kind === "slider" && specOutKey(s) === config.opacityParam);
  const def = Number(spec?.default);
  return Number.isFinite(def) && def > 0 ? def : 1;
}

const isHidden = (v: unknown) => v === 0;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const numericDash = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === "number");
const dashFix = (v: unknown) => (numericDash(v) && v.length === 2 && v[0] === 2 && v[1] === 1 ? [...LINE_DASH.general] : v);

function withLayout(layer: OverlayLayerSpec, extra: Record<string, unknown>): OverlayLayerSpec["layout"] {
  const layout = layer.layout;
  if (typeof layout === "function") return (isDark, params) => ({ ...layout(isDark, params), ...extra });
  return { ...(layout ?? {}), ...extra };
}

type Wrap = (base: Paint, def: Paint, isDark: boolean, opDiv: number) => Paint;

function wrapPaint(config: OverlayConfig, layer: OverlayLayerSpec, fn: Wrap): OverlayLayerSpec["paint"] {
  const paint = layer.paint;
  const opDiv = opacityParamDivisor(config);
  return (isDark, params) => {
    const base = paint(isDark, params);
    const def = paint(isDark, defaultSliderParams(config.id, params));
    return fn(base, def, isDark, opDiv);
  };
}

/** 主體線（L-1／L-4）。 */
function lineWrap(tier: LineTierSpec): Wrap {
  return (base, def, _isDark, opDiv) => {
    const out: Paint = { ...base, "line-dasharray": dashFix(base["line-dasharray"]) };
    if (out["line-dasharray"] === undefined) delete out["line-dasharray"];
    const w = base["line-width"];
    if (tier.width !== "keep" && !isDataDriven(w)) out["line-width"] = lineWidthExpr(tier.width, ratio(w, def["line-width"]));
    const o = base["line-opacity"];
    if (tier.opacity !== "keep" && !isDataDriven(o) && !isHidden(def["line-opacity"])) {
      out["line-opacity"] = clamp01(Math.max(LINE_OPACITY[tier.opacity], LINE_OPACITY.min) * ratio(o, def["line-opacity"]) / opDiv);
    }
    return out;
  };
}

/** 面（F-1）。 */
function fillWrap(tier: FillTier): Wrap {
  return (base, def, _isDark, opDiv) => {
    const o = base["fill-opacity"];
    if (isDataDriven(o) || isHidden(def["fill-opacity"])) return base;
    const out: Paint = { ...base, "fill-opacity": clamp01(FILL_OPACITY[tier] * ratio(o, def["fill-opacity"]) / opDiv) };
    delete out["fill-outline-color"];
    return out;
  };
}

/** 面的外框（F-2）。顏色：覆蓋＝原色（同面）；背景＝中性灰；分級、網格＝底圖色細縫。 */
function outlineWrap(tier: FillTier): Wrap {
  return (base, def, isDark, opDiv) => {
    const theme = isDark ? "dark" : "light";
    const out: Paint = { ...base, "line-dasharray": dashFix(base["line-dasharray"]) };
    if (out["line-dasharray"] === undefined) delete out["line-dasharray"];
    const w = base["line-width"];
    const o = base["line-opacity"];
    const wf = isDataDriven(w) ? 1 : ratio(w, def["line-width"]);
    const of = isDataDriven(o) ? 1 : ratio(o, def["line-opacity"]) / opDiv;
    if (isHidden(def["line-opacity"])) return out;
    if (tier === "coverage") {
      out["line-width"] = FILL_OUTLINE.coverage.width * wf;
      out["line-opacity"] = clamp01(FILL_OUTLINE.coverage.opacity * of);
    } else if (tier === "background") {
      // 外框顏色依資料（例：離岸風場依狀態、港口依等級）＝資料編碼，保留
      if (!isDataDriven(base["line-color"])) out["line-color"] = BOUNDARY_GRAY[theme];
      out["line-width"] = FILL_OUTLINE.background.width * wf;
      out["line-opacity"] = clamp01(FILL_OUTLINE.background.opacity * of);
    } else {
      // 分級面、網格的底圖色細縫不綁透明度滑桿（同 R1 gradedSeamPaint）
      if (!isDataDriven(base["line-color"])) out["line-color"] = mapSeamColor(isDark);
      out["line-width"] = (tier === "grid" ? FILL_OUTLINE.gridSeamWidth : GRADED_SEAM.width) * wf;
      out["line-opacity"] = GRADED_SEAM.opacity[theme];
    }
    return out;
  };
}

/** 虛線 [2,1] → [2,2] 對所有線都做（含「保留」的層）。 */
const dashOnlyWrap: Wrap = (base) => {
  if (base["line-dasharray"] === undefined) return base;
  return { ...base, "line-dasharray": dashFix(base["line-dasharray"]) };
};

export function withLineFillSpec(config: OverlayConfig): OverlayConfig {
  const fillTier = FILL_TIERS[config.id];
  const hasFill = config.layers.some((l) => l.type === "fill");
  const touches = fillTier !== undefined || config.layers.some((l) => LINE_TIERS[`${config.id}/${l.suffix}`] || (l.type === "line" && BOUNDARY_KEYS.has(config.id)));
  if (!touches) return config;
  const boundary = BOUNDARY_KEYS.has(config.id);
  const layers = config.layers.map((layer): OverlayLayerSpec => {
    if (DECORATION_SUFFIX_RE.test(layer.suffix)) return layer;
    if (layer.type === "fill" && fillTier && fillTier !== "keep") {
      return { ...layer, paint: wrapPaint(config, layer, fillWrap(fillTier)) };
    }
    if (layer.type !== "line") return layer;
    const lineTier = boundary ? LINE_TIERS[config.id] : LINE_TIERS[`${config.id}/${layer.suffix}`];
    if (lineTier) {
      return {
        ...layer,
        layout: withLayout(layer, SHARP_KEYS.has(config.id) ? LINE_SHARP : LINE_ROUND),
        paint: wrapPaint(config, layer, lineWrap(lineTier)),
      };
    }
    if (hasFill && fillTier && fillTier !== "keep") return { ...layer, paint: wrapPaint(config, layer, outlineWrap(fillTier)) };
    if (hasFill && fillTier === "keep") return { ...layer, paint: wrapPaint(config, layer, dashOnlyWrap) };
    return layer;
  });
  return { ...config, layers };
}


/** R3b hook 與 registry 共用上方 wrap 計算。defaults 必須是同主題、原 paint 的滑桿預設值。 */
export function hookLinePaint(key: string, id: string, base: Paint, defaults: Paint, isDark = true): Paint {
  const tier = HOOK_LINE_TIERS[`${key}/${id}`];
  if (!tier) return base;
  const out = tier.outline
    ? outlineWrap(tier.outline)(base, defaults, isDark, 1)
    : lineWrap(tier)(base, defaults, isDark, 1);
  // 外框也可能用資料編碼寬度、透明度或虛線；不可被 F-2 的固定值抹除。
  for (const property of ["line-width", "line-opacity", "line-color", "line-dasharray"]) {
    if (isDataDriven(base[property])) out[property] = base[property];
  }
  return out;
}

export function hookFillPaint(key: string, id: string, base: Paint, defaults: Paint, isDark = true): Paint {
  const tier = HOOK_FILL_TIERS[`${key}/${id}`];
  if (!tier || tier === "keep") return base;
  return fillWrap(tier)(base, defaults, isDark, 1);
}

/** 只改 layout，不改 layer id、filter、source 或資料。 */
export function hookLineLayout(key: string, id: string) {
  const tier = HOOK_LINE_TIERS[`${key}/${id}`];
  if (!tier) return {};
  return tier.outline || /(?:Admin|Boundary|Boundaries|Basins|Airspace|aviationControl|aviationRestricted)/.test(key)
    ? LINE_SHARP : LINE_ROUND;
}

/** setPaintProperty 的單屬性更新同樣走完整 paint 計算，不能覆蓋已套用的階。 */
export function hookLineWidth(key: string, id: string, now: unknown, def: unknown): number | ExpressionSpecification {
  return hookLinePaint(key, id, { "line-width": now }, { "line-width": def })["line-width"] as number | ExpressionSpecification;
}
export function hookLineOpacity(key: string, id: string, now: unknown, def: unknown, isDark = true): number | ExpressionSpecification {
  return hookLinePaint(key, id, { "line-opacity": now }, { "line-opacity": def }, isDark)["line-opacity"] as number | ExpressionSpecification;
}
export function hookFillOpacity(key: string, id: string, now: unknown, def: unknown): number | ExpressionSpecification {
  return hookFillPaint(key, id, { "fill-opacity": now }, { "fill-opacity": def })["fill-opacity"] as number | ExpressionSpecification;
}
