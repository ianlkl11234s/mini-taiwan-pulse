import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { KR_CONGESTION_BREAKS, krSpecCatFilter, type KrLayerSpec } from "../data/krDataLayers";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

/**
 * 南韓第 3–5 波 18 層的共用 hook：每層一個 PMTiles source（各自開關、靜態資料、不訂閱時間）。
 * 規格（來源檔、source-layer、分類、顏色）在 `data/krDataLayers.ts`；點層用 P-2 描邊與 P-1 尺寸、線層用 L-1 寬度、
 * 面層用 F-1 覆蓋面階。layer id 由規格以字面值給出（gisClickRegistry／lineFillTiers 以字面值比對）。
 * V-1（全國視角看得到）：點層 minzoom 降到圖磚起點；≥1 萬點的層（橋梁、停車場…）與使用者點名者拉遠改熱區（`spec.heat`，
 * 出點縮放＝`densePointsFromZoom`）。V-4：圖例有名目分類的層加類別多選篩選（`${key}CatMask`），點／線／面與熱區共用同一個 filter。
 */
export const krHeatmapId = (spec: KrLayerSpec) => spec.layerId.replace(/-circle$/, "-heatmap");
/** 河川低縮放（z5–8）只畫 `waterway=river`，小溪、運河 z8 起才出（否則 2.2 萬條線糊成一片）。 */
export const KR_RIVERS_MAJOR_LINE_ID = "kr-rivers-osm-major-line";
const RIVERS_MAJOR_FROM = 5;
const RIVERS_ALL_FROM = 8;
type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);

/** 圖層分類色：match(catProp) → 色；X003 以平日尖峰擁擠度分 4 級。 */
export function krColorExpr(spec: KrLayerSpec): Expr | string {
  if (spec.key === "krSeoulSubwayCongestion") {
    const [a, b, c] = KR_CONGESTION_BREAKS;
    const cats = spec.cats!;
    return ["case", ["has", "peak_wkd"], ["step", ["to-number", ["get", "peak_wkd"], 0], cats[0]!.color, a, cats[1]!.color, b, cats[2]!.color, c, cats[3]!.color], spec.otherColor ?? spec.color];
  }
  if (!spec.cats || !spec.catProp) return spec.color;
  const expr: unknown[] = ["match", ["coalesce", ["get", spec.catProp], ""]];
  for (const c of spec.cats) expr.push([...c.values], c.color);
  expr.push(spec.otherColor ?? spec.color);
  return expr;
}

function zoomWidth(at: (idx: 0 | 1) => unknown): Expr {
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

/** 線寬（L-1 三階）：河川依 waterway（river 標準、其餘細）；步道依設施（探訪路標準、其餘細）。 */
function lineWidth(spec: KrLayerSpec): Expr | number {
  if (spec.key === "krRiversOsm") return zoomWidth((i) => ["match", ["get", "waterway"], "river", LINE_WIDTH.standard[i], LINE_WIDTH.thin[i]]);
  if (spec.key === "krNpTrails") return zoomWidth((i) => ["match", ["get", "facility"], "탐방로", LINE_WIDTH.standard[i], LINE_WIDTH.thin[i]]);
  return LINE_WIDTH.thin[1];
}

export function krSourceSpec(spec: KrLayerSpec, locale: "zh" | "en" | "ja" = "zh"): SourceSpec {
  return { id: `kr-${spec.sourceLayer.replace(/^kr_/, "").replace(/_/g, "-")}`, file: spec.file, minzoom: spec.srcMinzoom, maxzoom: spec.srcMaxzoom, attribution: spec.sourceOrg, loading: spec.loading[locale] };
}

function pointPaint(spec: KrLayerSpec, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault(spec.key, 0.8));
  return { "circle-radius": pointRadius(spec.tier ?? "M", scale / scaleDefault(spec.key)), "circle-color": krColorExpr(spec), "circle-opacity": op, ...seam };
}

const withFilter = (filter: unknown[] | null) => (filter ? { filter } : {});
const setFilter = (map: MapboxMap, id: string, filter: unknown[] | null) => map.setFilter(id, (filter ?? null) as any);

/** 低縮放熱區的 weight：格網計數（count）分段，避免首爾單格壓過全國。 */
export const KR_DENSITY_WEIGHT = ["interpolate", ["linear"], ["coalesce", ["get", "count"], 1], 1, 0.05, 100, 0.3, 1000, 0.6, 10000, 1];

export function useKrDataLayer(mapRef: React.RefObject<MapboxMap | null>, spec: KrLayerSpec, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const source = krSourceSpec(spec);
  const heatStyle = useHeatmapStyleSignature(spec.heat ? [spec.key] : []);
  const filter = krSpecCatFilter(spec, catMask);
  const filterSig = JSON.stringify(filter);
  // 行道樹：z13 以下用格網計數檔畫熱區（獨立 source；先呼叫＝熱區 layer 先加、在點下面）
  const dens = spec.heat?.density;
  const densSource: SourceSpec = dens
    ? { id: `${source.id}-density`, file: dens.file, minzoom: dens.srcMinzoom, maxzoom: dens.srcMaxzoom, attribution: dens.attribution, loading: spec.loading.zh }
    : source;
  useGbPmtilesLayers(mapRef, densSource, visible && !!dens, () => {
    if (!dens || !spec.heat) return [];
    return [gbHeatmapBuild({
      id: krHeatmapId(spec), key: spec.key, sourceId: densSource.id, sourceLayer: dens.sourceLayer, maxzoom: heatmapMaxzoom(densePointsFromZoom(spec.count, spec.minzoom)),
      isDark, opacityScale: clamp01(opacity) / opacityDefault(spec.key, 0.8), intensity: spec.heat.intensity, weight: KR_DENSITY_WEIGHT,
    })];
  }, [spec.key, opacity, isDark, heatStyle]);
  useGbPmtilesLayers(mapRef, source, visible, () => {
    const pointsFrom = spec.heat ? densePointsFromZoom(spec.count, spec.minzoom) : spec.minzoom;
    const base = { source: source.id, "source-layer": spec.sourceLayer, minzoom: spec.heat ? pointsFrom : spec.key === "krRiversOsm" ? RIVERS_ALL_FROM : spec.minzoom };
    if (spec.geom === "point") {
      const heat: LayerBuild[] = spec.heat && !spec.heat.density ? [gbHeatmapBuild({
        id: krHeatmapId(spec), key: spec.key, sourceId: source.id, sourceLayer: spec.sourceLayer, maxzoom: heatmapMaxzoom(pointsFrom), filter,
        isDark, opacityScale: clamp01(opacity) / opacityDefault(spec.key, 0.8), intensity: spec.heat.intensity,
      })] : [];
      return [...heat, {
        id: spec.layerId,
        layer: () => ({ id: spec.layerId, type: "circle", ...base, ...withFilter(filter), layout: { visibility: "none" }, paint: pointPaint(spec, isDark, opacity, scale) } as unknown as AnyLayer),
        update: (map: MapboxMap) => {
          setFilter(map, spec.layerId, filter);
          for (const [k, v] of Object.entries(pointPaint(spec, isDark, opacity, scale))) map.setPaintProperty(spec.layerId, k as any, v as any);
        },
      }] satisfies LayerBuild[];
    }
    if (spec.geom === "line") {
      const paint = (op: number) => hookLinePaint(spec.key, spec.layerId,
        { "line-color": krColorExpr(spec), "line-width": lineWidth(spec), "line-opacity": clamp01(op) },
        { "line-color": krColorExpr(spec), "line-width": lineWidth(spec), "line-opacity": opacityDefault(spec.key, 0.85) }, isDark);
      const main: LayerBuild = {
        id: spec.layerId,
        layer: () => ({ id: spec.layerId, type: "line", ...base, ...withFilter(filter), layout: { visibility: "none", ...hookLineLayout(spec.key, spec.layerId) }, paint: paint(opacity) } as unknown as AnyLayer),
        update: (map: MapboxMap) => { setFilter(map, spec.layerId, filter); map.setPaintProperty(spec.layerId, "line-opacity", paint(opacity)["line-opacity"] as any); },
      };
      if (spec.key !== "krRiversOsm") return [main] satisfies LayerBuild[];
      // 河川：z5–8 只畫 river（+0.01 讓 z8 tile 仍建 bucket），z8 起全畫（main 的 minzoom＝8）
      const majorFilter = ["all", ["==", ["get", "waterway"], "river"], ...(filter ? [filter] : [])];
      const major: LayerBuild = {
        id: KR_RIVERS_MAJOR_LINE_ID,
        layer: () => ({
          id: KR_RIVERS_MAJOR_LINE_ID, type: "line", source: source.id, "source-layer": spec.sourceLayer, minzoom: RIVERS_MAJOR_FROM, maxzoom: RIVERS_ALL_FROM + 0.01,
          filter: majorFilter, layout: { visibility: "none", ...hookLineLayout(spec.key, spec.layerId) }, paint: paint(opacity),
        } as unknown as AnyLayer),
        update: (map: MapboxMap) => { setFilter(map, KR_RIVERS_MAJOR_LINE_ID, majorFilter); map.setPaintProperty(KR_RIVERS_MAJOR_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any); },
      };
      return [major, main] satisfies LayerBuild[];
    }
    const fillPaint = (op: number) => hookFillPaint(spec.key, spec.layerId, { "fill-color": krColorExpr(spec), "fill-opacity": clamp01(op) },
      { "fill-color": krColorExpr(spec), "fill-opacity": opacityDefault(spec.key, 0.7) }, isDark);
    const outlineId = spec.outlineId!;
    const outlinePaint = (op: number) => hookLinePaint(spec.key, outlineId,
      { "line-color": krColorExpr(spec), "line-width": 1, "line-opacity": clamp01(op) + 0 },
      { "line-color": krColorExpr(spec), "line-width": 1, "line-opacity": opacityDefault(spec.key, 0.7) }, isDark);
    return [
      {
        id: spec.layerId,
        layer: () => ({ id: spec.layerId, type: "fill", ...base, ...withFilter(filter), layout: { visibility: "none" }, paint: fillPaint(opacity) } as unknown as AnyLayer),
        update: (map: MapboxMap) => { setFilter(map, spec.layerId, filter); map.setPaintProperty(spec.layerId, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any); },
      },
      {
        id: outlineId,
        layer: () => ({ id: outlineId, type: "line", ...base, ...withFilter(filter), layout: { visibility: "none", ...hookLineLayout(spec.key, outlineId) }, paint: outlinePaint(Math.min(1, opacity + 0.25)) } as unknown as AnyLayer),
        update: (map: MapboxMap) => { setFilter(map, outlineId, filter); map.setPaintProperty(outlineId, "line-opacity", outlinePaint(Math.min(1, opacity + 0.25))["line-opacity"] as any); },
      },
    ] satisfies LayerBuild[];
  }, [spec.key, opacity, scale, isDark, heatStyle, filterSig]);
}
