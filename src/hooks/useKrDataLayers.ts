import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { KR_CONGESTION_BREAKS, type KrLayerSpec } from "../data/krDataLayers";
import { useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

/**
 * 南韓第 3–5 波 18 層的共用 hook：每層一個 PMTiles source（各自開關、靜態資料、不訂閱時間）。
 * 規格（來源檔、source-layer、分類、顏色）在 `data/krDataLayers.ts`；點層用 P-2 描邊與 P-1 尺寸、線層用 L-1 寬度、
 * 面層用 F-1 覆蓋面階。layer id 由規格以字面值給出（gisClickRegistry／lineFillTiers 以字面值比對）。
 */
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

export function useKrDataLayer(mapRef: React.RefObject<MapboxMap | null>, spec: KrLayerSpec, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const source = krSourceSpec(spec);
  useGbPmtilesLayers(mapRef, source, visible, () => {
    const base = { source: source.id, "source-layer": spec.sourceLayer, minzoom: spec.minzoom };
    if (spec.geom === "point") {
      return [{
        id: spec.layerId,
        layer: () => ({ id: spec.layerId, type: "circle", ...base, layout: { visibility: "none" }, paint: pointPaint(spec, isDark, opacity, scale) } as unknown as AnyLayer),
        update: (map: MapboxMap) => { for (const [k, v] of Object.entries(pointPaint(spec, isDark, opacity, scale))) map.setPaintProperty(spec.layerId, k as any, v as any); },
      }] satisfies LayerBuild[];
    }
    if (spec.geom === "line") {
      const paint = (op: number) => hookLinePaint(spec.key, spec.layerId,
        { "line-color": krColorExpr(spec), "line-width": lineWidth(spec), "line-opacity": clamp01(op) },
        { "line-color": krColorExpr(spec), "line-width": lineWidth(spec), "line-opacity": opacityDefault(spec.key, 0.85) }, isDark);
      return [{
        id: spec.layerId,
        layer: () => ({ id: spec.layerId, type: "line", ...base, layout: { visibility: "none", ...hookLineLayout(spec.key, spec.layerId) }, paint: paint(opacity) } as unknown as AnyLayer),
        update: (map: MapboxMap) => map.setPaintProperty(spec.layerId, "line-opacity", paint(opacity)["line-opacity"] as any),
      }] satisfies LayerBuild[];
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
        layer: () => ({ id: spec.layerId, type: "fill", ...base, layout: { visibility: "none" }, paint: fillPaint(opacity) } as unknown as AnyLayer),
        update: (map: MapboxMap) => map.setPaintProperty(spec.layerId, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
      },
      {
        id: outlineId,
        layer: () => ({ id: outlineId, type: "line", ...base, layout: { visibility: "none", ...hookLineLayout(spec.key, outlineId) }, paint: outlinePaint(Math.min(1, opacity + 0.25)) } as unknown as AnyLayer),
        update: (map: MapboxMap) => map.setPaintProperty(outlineId, "line-opacity", outlinePaint(Math.min(1, opacity + 0.25))["line-opacity"] as any),
      },
    ] satisfies LayerBuild[];
  }, [spec.key, opacity, scale, isDark]);
}
