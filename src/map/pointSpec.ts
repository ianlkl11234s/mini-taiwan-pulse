/**
 * 點圖層規格的集中套用（design-system-map-layers §3.1，R2）。
 *
 * OVERLAY_REGISTRY 匯出前每個 config 過一次 withPointSpec()：
 *  - 主體 circle 子圖層（suffix 不是光暈／點擊熱區等裝飾）的半徑改成 POINT_TIERS 的固定階（P-1 B，不隨縮放）
 *  - 描邊統一底圖色 1px（P-2 A）
 * 大小滑桿照舊：半徑 = 階 × (滑桿值 ÷ 滑桿預設)，所以預設值剛好是階的半徑。
 * 描邊透明度跟著透明度滑桿，同樣以預設值為基準。
 *
 * ⚠️ 因此 overlayRegistry.ts 裡這些圖層的 circle-radius／circle-stroke-* 字面值已不生效，
 *    改大小請改 pointTiers.ts；字面值會在逐層調整時清除（design-system §10.3）。
 */
import type { OverlayConfig, OverlayLayerSpec } from "../types";
import { getParamsSpec, specOutKey, type LayerParamSpec } from "../data/layerParamsSpec";
import { POINT_STROKE, mapSeamColor, pointRadius } from "./mapStyleScale";
import { POINT_TIERS } from "./pointTiers";

/** 裝飾子圖層（光暈、漣漪、點擊熱區、選取…）不套主體規格；與 design:audit-layers 同一條規則。整詞比對（manufacturing-circle 不是 ring）。 */
export const DECORATION_SUFFIX_RE = /(?:^|[-_])(?:glow\d*|halo|ripple|pulse|hit|range|shadow|casing|highlight|select(?:ed)?|hover|bloom|aura|ring)(?:$|[-_\d])/i;

function sliderFactor(spec: LayerParamSpec | undefined, params?: Record<string, number>): number {
  if (!spec || spec.kind !== "slider") return 1;
  const def = Number(spec.default);
  if (!Number.isFinite(def) || def <= 0) return 1;
  const outKey = specOutKey(spec);
  if (outKey == null) return 1; // 參數不進 overlayParams（out: null）＝由 hook 自行消化
  const value = Number(params?.[outKey] ?? def);
  return Number.isFinite(value) ? value / def : 1;
}

function findSlider(key: string, re: RegExp): LayerParamSpec | undefined {
  return (getParamsSpec(key) ?? []).find((s) => s.kind === "slider" && re.test(s.name));
}

/**
 * P-6：光暈、漣漪只留給即時資料（2026-09-28 逐層檢視 92 層）。
 * 「即時」看資料本身是否是進行中的事件／讀值，不是看資料是不是由程式載入
 * （能源設施、工業設施雖然 dynamicData，但資料是靜態設施）。
 */
export const LIVE_DECORATION_LAYERS: ReadonlySet<string> = new Set([
  "newsEvents", "lightning", "lightningCwa", "nuclearRadiation", "a1AccidentRealtime",
]);
/**
 * 整組不套點規格的子圖層（使用者指定的呈現方式）：
 * 捷運站「實際範圍（光暈示意）」模式用 metro-pt-* 光暈表示站點範圍（沒有站體面資料），2026-09-28 使用者要求保留。
 */
export const POINT_SPEC_EXEMPT: Readonly<Record<string, RegExp>> = {
  stationsMetro: /^metro-pt-/,
};

export const LIVE_DECORATION_CAP = { radiusFactor: 2, opacity: 0.35, minBlur: 0.6 } as const;

const hasZoom = (v: unknown) => JSON.stringify(v ?? null).includes('"zoom"');

/** 靜態資料的光暈改透明（子圖層保留：很多被 gisClickRegistry 當點擊範圍用）；即時資料限制大小與透明度。 */
function decorationPaint(
  layer: OverlayLayerSpec, live: boolean, tierRadius: number | null, sizeFactor: (p?: Record<string, number>) => number,
): OverlayLayerSpec["paint"] {
  const paint = layer.paint;
  const t = layer.type;
  return (isDark, params) => {
    const base = paint(isDark, params);
    if (/(?:^|[-_])hit(?:$|[-_])/i.test(layer.suffix)) return base;
    if (t !== "circle" && t !== "line") return base;
    const opKey = `${t}-opacity`;
    if (!live) return { ...base, [opKey]: 0 };
    if (t !== "circle") return base;
    const op = base[opKey];
    const blur = base["circle-blur"];
    const r = base["circle-radius"];
    return {
      ...base,
      [opKey]: typeof op === "number" ? Math.min(op, LIVE_DECORATION_CAP.opacity) : hasZoom(op) || op === undefined ? op ?? LIVE_DECORATION_CAP.opacity : ["min", op, LIVE_DECORATION_CAP.opacity],
      "circle-blur": typeof blur === "number" ? Math.max(blur, LIVE_DECORATION_CAP.minBlur) : blur ?? LIVE_DECORATION_CAP.minBlur,
      ...(tierRadius !== null ? { "circle-radius": typeof r === "number" && !hasZoom(r) ? Math.min(r, tierRadius * LIVE_DECORATION_CAP.radiusFactor * sizeFactor(params)) : tierRadius * LIVE_DECORATION_CAP.radiusFactor * sizeFactor(params) } : {}),
    };
  };
}

export function withPointSpec(config: OverlayConfig): OverlayConfig {
  const tier = POINT_TIERS[config.id];
  const hasDecoration = config.layers.some((l) => DECORATION_SUFFIX_RE.test(l.suffix));
  if (!tier && !hasDecoration) return config;
  const sizeSpec = findSlider(config.id, /scale|radius|size/i);
  const opacitySpec = findSlider(config.id, /opacity/i);
  const tierRadius = tier && tier !== "B" ? pointRadius(tier) : null;
  const sizeFactor = (p?: Record<string, number>) => sliderFactor(sizeSpec, p);
  const live = LIVE_DECORATION_LAYERS.has(config.id);
  const exempt = POINT_SPEC_EXEMPT[config.id];
  const layers = config.layers.map((layer): OverlayLayerSpec => {
    if (exempt?.test(layer.suffix)) return layer;
    if (DECORATION_SUFFIX_RE.test(layer.suffix)) return { ...layer, paint: decorationPaint(layer, live, tierRadius, sizeFactor) };
    if (layer.type !== "circle" || !tier) return layer;
    const paint = layer.paint;
    return {
      ...layer,
      paint: (isDark, params) => {
        const base = paint(isDark, params);
        const theme = isDark ? "dark" : "light";
        // opacityParam 登記的圖層由 applyLayerOpacity 再乘一次滑桿值，這裡只除掉預設值
        const opacity = config.opacityParam
          ? 1 / (Number(opacitySpec?.default) || 1)
          : sliderFactor(opacitySpec, params);
        return {
          ...base,
          ...(tier === "B" ? {} : { "circle-radius": pointRadius(tier, sliderFactor(sizeSpec, params)) }),
          "circle-stroke-color": mapSeamColor(isDark),
          "circle-stroke-width": POINT_STROKE.width,
          "circle-stroke-opacity": Math.min(1, POINT_STROKE.opacity[theme] * opacity),
        };
      },
    };
  });
  return { ...config, layers };
}
