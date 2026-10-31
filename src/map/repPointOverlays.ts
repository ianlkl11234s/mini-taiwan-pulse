/**
 * map-layers.md §3.8 V-5：registry 面圖層的「點／面」切換（資料表見 `data/repPointLayers.ts`）。
 *
 * OVERLAY_REGISTRY 匯出前過一次 `withRepPoints()`（接在 withPointSpec 之前）：
 * - 面層 config：每個子圖層的 layout 加上「樣式＝面才可見」；
 * - 緊接著插入第二個 config（同 id、sourceId 加 `-points`，照 airports 的先例），指向 analytics 的代表點檔：
 *   - ≥ 1 萬點畫熱區（P-4），出點縮放以下熱區、以上代表點 circle；
 *   - 「面」樣式：熱區（或 < 1 萬點時的代表點）只畫到面出現的縮放（面層子圖層最小 minzoom），之後交給面；
 *   - 「點」樣式：面不畫（隱藏的 layer 不載圖磚）。
 * 顏色取面層 fill-color（點與面同色、含類別色）；篩選沿用面層子圖層的 filter（欄位在代表點檔都保留）。
 */
import type { OverlayConfig, OverlayLayerSpec } from "../types";
import { paramDefault } from "../data/layerParamsSpec";
import {
  REP_POINT_LAYERS, repPointDense, repPointHeatIntensity, repPointModeFromIdx, repPointThinnedWeight, repPointUrl,
  type RepPointDisplayMode, type RepPointLayer,
} from "../data/repPointLayers";
import { FLOOD_SCENARIOS } from "../data/floodScenarios";
import { heatmapRampFor, heatmapStackFactor } from "../state/layerPalette";
import { densePointOpacity, densePointsFromZoom, heatmapMaxzoom, heatmapPaint, pointStrokePaint, pointRadius } from "./mapStyleScale";

const registryLayers = REP_POINT_LAYERS.filter((l) => l.family === "registry");

export const repPointSourceId = (l: RepPointLayer) => `${l.sourceId}-points`;
/** 代表點 circle 的 map layer id（點擊彈窗用） */
export const repPointCircleIds = (l: RepPointLayer): string[] =>
  [`${repPointSourceId(l)}-circle-point`, `${repPointSourceId(l)}-circle-polygon`];
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** 農業 factory 自建 source 的面層 id 前綴（面層 `<prefix>-fill`、代表點 `<prefix>-points-circle`） */
const AGRI_PREFIX: Readonly<Record<string, string>> = {
  agriCropSuitability: "agri-crop-suitability", agriculture: "agri-ftw-fields", agriSoil: "agri-soil",
  agriLeisureFarmZones: "agri-leisure-farm-zones", agriRuralRegen: "agri-rural-regen",
};
/** 面層 map layer id → 要加進去的代表點 circle id（gisClickRegistry 用；各家族命名不同） */
export function repPointClickLayerIds(): { polygonLayerId: string; circleIds: string[] }[] {
  return REP_POINT_LAYERS.flatMap((l): { polygonLayerId: string; circleIds: string[] }[] => {
    if (l.family === "registry") return [{ polygonLayerId: `${l.sourceId}-fill`, circleIds: repPointCircleIds(l) }];
    if (l.family === "agri") return [{ polygonLayerId: `${AGRI_PREFIX[l.key]}-fill`, circleIds: [`${AGRI_PREFIX[l.key]}-points-circle`] }];
    if (l.family === "jpTourism") return [{ polygonLayerId: `jp-tourism-${kebab(l.key)}-fill`, circleIds: [`${kebab(l.key)}-point-circle`] }];
    // jpHook：土砂警戒沒有代表點 circle（點檔只到 z7，z8 起由面接手）
    return l.key === "jpLandslideWarningAreas" ? [] : [{ polygonLayerId: `${kebab(l.key)}-fill`, circleIds: [`${kebab(l.key)}-point-circle`] }];
  });
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const POLYGON_TYPES = new Set(["fill", "line", "fill-extrusion"]);

/** 目前樣式（params 沒帶時用表上的預設） */
export const repPointModeOf = (l: RepPointLayer, params?: Record<string, number>): RepPointDisplayMode =>
  repPointModeFromIdx(params?.[`${l.key}DisplayModeIdx`], l.def);

const modeLayout = (l: RepPointLayer, show: RepPointDisplayMode, base?: OverlayLayerSpec["layout"]): OverlayLayerSpec["layout"] =>
  (isDark, params) => {
    const b = typeof base === "function" ? base(isDark, params) : (base ?? {});
    const baseHidden = b.visibility === "none";
    return { ...b, visibility: !baseHidden && repPointModeOf(l, params) === show ? "visible" : "none" };
  };

function resolveCircleColor(l: RepPointLayer, fill: OverlayLayerSpec | undefined, isDark: boolean, params?: Record<string, number>): unknown {
  if (l.color !== undefined) return l.color;
  const c = fill?.paint(isDark, params)["fill-color"];
  return c ?? "#94a3b8";
}

function companion(config: OverlayConfig, l: RepPointLayer): OverlayConfig {
  const polygonSpecs = config.layers.filter((s) => POLYGON_TYPES.has(s.type));
  const fillSpec = config.layers.find((s) => s.type === "fill") ?? polygonSpecs[0];
  const specFilter = polygonSpecs.find((s) => s.filter)?.filter;
  const polygonFrom = Math.min(...polygonSpecs.map((s) => s.minzoom ?? config.pmtiles?.minzoom ?? 0));
  const dense = repPointDense(l);
  const pointsFrom = densePointsFromZoom(l.count, 0);
  const opacityKey = l.opacityParam ?? `${l.key}Opacity`;
  const opacityDef = () => Number(paramDefault(l.key, opacityKey) ?? 0.5) || 0.5;
  const rel = (p?: Record<string, number>) => clamp01(p?.[opacityKey] ?? opacityDef()) / opacityDef();
  const tier = dense ? "S" : "M";
  const filterProp = (specFilter ? { filter: specFilter } : {}) as Pick<OverlayLayerSpec, "filter">;
  // 面出現前才需要補代表點（面最小縮放已 ≤ 代表點檔的 minzoom 4＝面全程可見，不補）
  const needPolygonLead = polygonFrom > 4;

  const heat = (suffix: string, show: RepPointDisplayMode, maxzoom: number): OverlayLayerSpec => ({
    suffix, type: "heatmap", maxzoom: heatmapMaxzoom(maxzoom), layout: modeLayout(l, show), ...filterProp,
    paint: (isDark, p) => heatmapPaint(
      rel(p), repPointHeatIntensity(l), l.thinned ? repPointThinnedWeight(l.thinned) : 1,
      heatmapRampFor(l.key, isDark), heatmapStackFactor(),
    ),
  });
  const circle = (suffix: string, show: RepPointDisplayMode, range: { min?: number; max?: number }): OverlayLayerSpec => ({
    suffix, type: "circle", layout: modeLayout(l, show), ...filterProp,
    ...(range.min ? { minzoom: range.min } : {}), ...(range.max ? { maxzoom: range.max } : {}),
    paint: (isDark, p) => {
      const r = rel(p);
      const scaleDef = Number(paramDefault(l.key, `${l.key}Scale`) ?? 1) || 1;
      return {
        "circle-radius": pointRadius(tier, (p?.[`${l.key}Scale`] ?? scaleDef) / scaleDef),
        "circle-color": resolveCircleColor(l, fillSpec, isDark, p),
        "circle-opacity": clamp01(densePointOpacity(l.count) * r),
        ...pointStrokePaint(isDark, r),
      };
    },
  });

  const layers: OverlayLayerSpec[] = dense
    ? [
      heat("heat-point", "point", pointsFrom),
      ...(needPolygonLead ? [heat("heat-polygon", "polygon", polygonFrom)] : []),
      circle("circle-point", "point", { min: pointsFrom }),
    ]
    : [
      circle("circle-point", "point", {}),
      ...(needPolygonLead ? [circle("circle-polygon", "polygon", { max: polygonFrom })] : []),
    ];

  const byParam = config.sourceUrlByParam
    ? { sourceUrlByParam: { param: config.sourceUrlByParam.param, urls: FLOOD_SCENARIOS.map((s) => `./geo/water_flood_${s.value}_points.pmtiles`) } }
    : {};
  const filterSuffixes = layers.filter((s) => typeof s.filter === "function").map((s) => s.suffix);
  return {
    id: config.id,
    sourceUrl: repPointUrl(l),
    ...byParam,
    sourceId: repPointSourceId(l),
    pmtiles: { sourceLayer: l.sourceLayer, minzoom: 4, maxzoom: l.maxzoom ?? 10 },
    ...(config.attribution ? { attribution: config.attribution } : {}),
    ...(config.filter ? { filter: config.filter } : {}),
    ...(filterSuffixes.length ? { rebuildOnParamChange: filterSuffixes } : {}),
    ...(config.rebuildOnParamKeys && filterSuffixes.length ? { rebuildOnParamKeys: config.rebuildOnParamKeys } : {}),
    layers,
  };
}

export function withRepPoints(configs: OverlayConfig[]): OverlayConfig[] {
  return configs.flatMap((config) => {
    const l = registryLayers.find((x) => x.key === config.id && x.sourceId === config.sourceId);
    if (!l) return [config];
    const layers = config.layers.map((s): OverlayLayerSpec => ({ ...s, layout: modeLayout(l, "polygon", s.layout) }));
    return [{ ...config, layers }, companion(config, l)];
  });
}
