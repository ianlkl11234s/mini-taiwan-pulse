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

/**
 * 特例：全台 8–18 萬點的 allzoom 點層（2026-09-30，效能）。
 * factoryLocations 約 8 萬、manufacturingCompanyPoints／regulatedFacilities 各約 18 萬，全台視角合計約 35 萬點；
 * 1d1b6938（2026-09-28）統一成固定 M 4.5px＋1px 描邊後，低 zoom 填充率暴增、風扇狂轉。
 * 特例：半徑與描邊改隨縮放（z0 0.7／z7 1／z11 2／z14 起回到階的半徑），描邊 z11 以下為 0、z13 起 1px。
 * 大小滑桿照舊乘上去。其餘 tier 不變；要移出特例就刪掉這裡的登記。
 */
export const DENSE_POINT_OVERRIDES: ReadonlySet<string> = new Set([
  "factoryLocations", "manufacturingCompanyPoints", "regulatedFacilities",
]);
export const DENSE_RADIUS_STOPS = [[0, 0.7], [7, 1], [11, 2]] as const; // z14 起接階的半徑（M 4.5）
export const DENSE_STROKE_ZOOM = { none: 11, full: 13 } as const;
const denseRadius = (tierR: number, scale: number) => ["interpolate", ["linear"], ["zoom"],
  ...DENSE_RADIUS_STOPS.flatMap(([z, r]) => [z, r * scale]), 14, tierR * scale];
const denseStrokeWidth = ["interpolate", ["linear"], ["zoom"], DENSE_STROKE_ZOOM.none, 0, DENSE_STROKE_ZOOM.full, POINT_STROKE.width];

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

/** 會讀 feature 資料的 expression 運算子：描邊用到它們＝資料編碼（例：有 ICU、資料過期、依狀態變色）。 */
const DATA_OPERATORS = new Set(["get", "has", "feature-state", "properties", "geometry-type", "id"]);

/** 值（或巢狀 expression 任一層）有讀 feature 資料。只讀 zoom 的插值不算。 */
export function isDataDriven(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (typeof value[0] === "string" && DATA_OPERATORS.has(value[0])) return true;
  return value.some(isDataDriven);
}

/** 填色透明度讀 feature 的 `alpha`（落雷、輻射等隨時間淡出）時，描邊要一起淡出，否則只剩一圈不透明外框。 */
function fadesByAlpha(value: unknown): boolean {
  return isDataDriven(value) && JSON.stringify(value).includes('["get","alpha"]');
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
  const dense = DENSE_POINT_OVERRIDES.has(config.id);
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
        // 描邊依資料屬性變化＝資料編碼（spec：map-layers §3 P-2 例外），保留原值；固定描邊才換成底圖色細縫
        const keep = (prop: string) => isDataDriven(base[prop]);
        return {
          ...base,
          ...(tier === "B" ? {} : { "circle-radius": dense ? denseRadius(pointRadius(tier), sliderFactor(sizeSpec, params)) : pointRadius(tier, sliderFactor(sizeSpec, params)) }),
          ...(keep("circle-stroke-color") ? {} : { "circle-stroke-color": mapSeamColor(isDark) }),
          ...(keep("circle-stroke-width") ? {} : { "circle-stroke-width": dense ? denseStrokeWidth : POINT_STROKE.width }),
          ...(keep("circle-stroke-opacity") ? {} : { "circle-stroke-opacity": fadesByAlpha(base["circle-opacity"])
            ? ["*", Math.min(1, POINT_STROKE.opacity[theme] * opacity), ["coalesce", ["get", "alpha"], 1]]
            : Math.min(1, POINT_STROKE.opacity[theme] * opacity) }),
        };
      },
    };
  });
  return { ...config, layers };
}
