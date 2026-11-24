/**
 * 規格驅動圖層引擎（菲律賓第 0–1 波寫的 usePhDataLayer，中國、泰國、越南、加拿大重用；B1 P2b，2026-11-24）。
 * 原本放在 usePhLayers.ts，搬到中性檔，國家 hook／host 不再互相 import；原檔 re-export 同名符號。
 * 本檔不得 import 任何國家模組。
 */
import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { LINE_DASH, POINT_STROKE_DATA_ENCODED, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { selectedMultiSelectValues } from "../data/multiSelectMapbox";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { PH_CAT_OTHER_ID, phCatOptionIds, phText, type PhLayerSpec, type PhPart } from "../data/intlLayerShared";
import { gbAllOf, gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./intlPmtilesLayers";

export type Expr = unknown[];
/** 全關時的永假 filter（不移除 layer，換底圖重掛也一致）。 */
export const NONE: Expr = ["==", ["literal", "__ph_none__"], "__ph_part__"];
export function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}

export type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const sig = (v: unknown) => JSON.stringify(v);

/** 子圖層的類別色：match(類別值) → 色；不屬於已列類別 → otherColor（或主色）。 */
export function phColorExpr(spec: PhLayerSpec<string>, part: PhPart): Expr {
  const expr: unknown[] = ["match", part.cat.expr];
  const seen = new Set<string>();
  for (const c of spec.cats) {
    if (c.parts && !c.parts.includes(part.id)) continue;
    const values = c.values.filter((v) => !seen.has(v));
    values.forEach((v) => seen.add(v));
    if (values.length) expr.push(values.length === 1 ? values[0] : values, c.color);
  }
  expr.push(spec.otherColor ?? spec.color);
  return expr;
}

/** 類別多選 → 子圖層 filter：全選／未給＝null；該子圖層的類別全關＝永假；選了「其他」補上「不屬於已列類別」。 */
export function phPartCatFilter(spec: PhLayerSpec<string>, part: PhPart, mask: number | undefined): Expr | null {
  if (mask === undefined || !Number.isFinite(mask)) return null;
  const ids = phCatOptionIds(spec);
  const selected = new Set(selectedMultiSelectValues(mask, ids));
  const mine = spec.cats.filter((c) => !c.parts || c.parts.includes(part.id));
  const withOther = !!spec.otherLabel;
  const allOn = mine.every((c) => selected.has(c.id)) && (!withOther || selected.has(PH_CAT_OTHER_ID));
  if (allOn) return null;
  const chosen = mine.filter((c) => selected.has(c.id)).flatMap((c) => [...c.values]);
  const hit: Expr | null = chosen.length ? ["in", part.cat.expr, ["literal", chosen]] : null;
  const other: Expr | null = withOther && selected.has(PH_CAT_OTHER_ID) ? ["!", ["in", part.cat.expr, ["literal", mine.flatMap((c) => [...c.values])]]] : null;
  if (hit && other) return ["any", hit, other];
  return hit ?? other ?? NONE;
}


function pointRadiusExpr(spec: PhLayerSpec<string>, part: PhPart, scale: number): Expr | number {
  const k = scale / scaleDefault(spec.key);
  if (part.size) {
    const bands = part.size.bands;
    const step: unknown[] = ["step", ["to-number", ["get", part.size.prop], 0], bands[0]!.radius];
    for (const b of bands.slice(1)) step.push(b.min, b.radius);
    // 規格同一子圖層混有不帶該數值的點（微電網）：沒有欄位者用 M 階
    return ["*", ["case", ["has", part.size.prop], step, pointRadius("M")], k];
  }
  const sized = spec.cats.filter((c) => c.radius !== undefined && (!c.parts || c.parts.includes(part.id)));
  if (sized.length) {
    const m: unknown[] = ["match", part.cat.expr];
    for (const c of sized) m.push(c.values.length === 1 ? c.values[0] : [...c.values], c.radius);
    m.push(pointRadius("S"));
    return ["*", m, k];
  }
  return pointRadius(part.small || spec.key === "phFuelStations" || spec.key === "phBusStops" || part.id === "ph-tanks-circle" || part.id === "ph-power-substations-circle" ? "S" : "M", k);
}

function pointPaint(spec: PhLayerSpec<string>, part: PhPart, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const def = opacityDefault(spec.key, 0.85);
  const base = { "circle-radius": pointRadiusExpr(spec, part, scale), "circle-color": phColorExpr(spec, part), "circle-opacity": op, ...pointStrokePaint(isDark, op / def) };
  if (part.hollow) {
    // 空心＝填色透明、外框用類別色（第 3–9 波：OSM 補缺、DOT 近似座標、里程牌）
    const when = part.hollow.when ?? true;
    return {
      ...base,
      "circle-opacity": ["case", when, 0, op],
      "circle-stroke-color": ["case", when, phColorExpr(spec, part), base["circle-stroke-color"]],
      "circle-stroke-width": ["case", when, 1.5, base["circle-stroke-width"]],
      "circle-stroke-opacity": ["case", when, op, base["circle-stroke-opacity"]],
    };
  }
  if (!part.ring) return base;
  // 描邊＝資料編碼（mapStyleScale POINT_STROKE_DATA_ENCODED）：符合者白框 2px，其餘底圖色細縫
  const theme = isDark ? "dark" : "light";
  return {
    ...base,
    "circle-stroke-color": ["case", part.ring.when, isDark ? "#ffffff" : "#111827", POINT_STROKE_DATA_ENCODED.color[theme]],
    "circle-stroke-width": ["case", part.ring.when, 2, 1],
    "circle-stroke-opacity": Math.min(1, POINT_STROKE_DATA_ENCODED.opacity[theme] * (op / def)),
  };
}

function lineWidthExpr(part: PhPart): Expr | number {
  if (!part.lineWidth) return ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2];
  const at = (i: 0 | 1) => {
    const m: unknown[] = ["match", part.cat.expr];
    for (const [v, w] of Object.entries(part.lineWidth!)) m.push(v, w[i]);
    m.push(i === 0 ? 0.5 : 1);
    return m;
  };
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

export const phHeatmapId = (spec: PhLayerSpec<string>) => `${spec.parts[0]!.id.replace(/-circle$/, "")}-heatmap`;

export function phSourceSpec(spec: PhLayerSpec<string>): SourceSpec {
  return { id: spec.sourceId, file: spec.file, minzoom: spec.srcMinzoom, maxzoom: spec.srcMaxzoom, attribution: phText(spec.sourceOrg), loading: spec.loading.zh };
}

/** 規格驅動層：每個子圖層一個 layer（同一個 source）；`extraFilter`（電廠狀態）疊在所有子圖層上。 */
export function usePhDataLayer(mapRef: MapRef, spec: PhLayerSpec<string>, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number, extraFilter?: Expr | null) {
  const source = phSourceSpec(spec);
  const heatStyle = useHeatmapStyleSignature(spec.heat ? [spec.key] : []);
  const filters = spec.parts.map((part) => gbAllOf(part.filter, phPartCatFilter(spec, part, catMask), extraFilter ?? null));
  const def = opacityDefault(spec.key, 0.85);
  useGbPmtilesLayers(mapRef, source, visible, () => {
    const builds: LayerBuild[] = [];
    spec.parts.forEach((part, i) => {
      const filter = filters[i] ?? null;
      const pointsFrom = spec.heat && part.geom === "point" ? densePointsFromZoom(spec.count, part.minzoom) : part.minzoom;
      if (spec.heat && part.geom === "point") {
        builds.push(gbHeatmapBuild({
          id: spec.parts.filter((x) => x.geom === "point").length > 1 ? `${part.id.replace(/-circle$/, "")}-heatmap` : phHeatmapId(spec), key: spec.key, sourceId: source.id, sourceLayer: part.sourceLayer, maxzoom: heatmapMaxzoom(pointsFrom), filter,
          isDark, opacityScale: clamp01(opacity) / def, intensity: spec.heat.intensity,
        }));
      }
      const base = { source: source.id, "source-layer": part.sourceLayer, minzoom: pointsFrom, ...(filter ? { filter } : {}) };
      if (part.geom === "point") {
        builds.push({
          id: part.id,
          layer: () => ({ id: part.id, type: "circle", ...base, layout: { visibility: "none", ...(part.size ? { "circle-sort-key": ["-", 0, ["to-number", ["get", part.size.prop], 0]] } : {}) },
            paint: pointPaint(spec, part, isDark, opacity, scale) } as unknown as AnyLayer),
          update: (map) => { map.setFilter(part.id, (filter ?? null) as any); setPaint(map, part.id, pointPaint(spec, part, isDark, opacity, scale)); },
        });
        return;
      }
      if (part.geom === "fill") {
        const k = part.fillOpacity ?? 1;
        const fillPaint = () => hookFillPaint(spec.key, part.id, { "fill-color": phColorExpr(spec, part), "fill-opacity": clamp01(opacity) * k },
          { "fill-color": phColorExpr(spec, part), "fill-opacity": def * k }, isDark);
        builds.push({
          id: part.id,
          layer: () => ({ id: part.id, type: "fill", ...base, layout: { visibility: "none" }, paint: fillPaint() } as unknown as AnyLayer),
          update: (map) => { map.setFilter(part.id, (filter ?? null) as any); setPaint(map, part.id, fillPaint()); },
        });
        if (part.lowZoomHalo) {
          const haloId = `${part.id}-halo`;
          const { maxzoom } = part.lowZoomHalo;
          const haloPaint = () => ({
            "line-color": phColorExpr(spec, part),
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 7, maxzoom, 3],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 4, maxzoom, 1.5],
            "line-opacity": clamp01(opacity),
          });
          builds.push({
            id: haloId,
            layer: () => ({ id: haloId, type: "line", ...base, maxzoom, layout: { visibility: "none", "line-join": "round" }, paint: haloPaint() } as unknown as AnyLayer),
            update: (map) => { map.setFilter(haloId, (filter ?? null) as any); setPaint(map, haloId, haloPaint()); },
          });
        }
        return;
      }
      const paint = () => hookLinePaint(spec.key, part.id,
        { "line-color": phColorExpr(spec, part), "line-width": lineWidthExpr(part), "line-opacity": clamp01(opacity), ...(part.dashed ? { "line-dasharray": [...LINE_DASH.general] } : {}) },
        { "line-color": phColorExpr(spec, part), "line-width": lineWidthExpr(part), "line-opacity": def, ...(part.dashed ? { "line-dasharray": [...LINE_DASH.general] } : {}) }, isDark);
      builds.push({
        id: part.id,
        layer: () => ({ id: part.id, type: "line", ...base, layout: { visibility: "none", ...hookLineLayout(spec.key, part.id) }, paint: paint() } as unknown as AnyLayer),
        update: (map) => { map.setFilter(part.id, (filter ?? null) as any); map.setPaintProperty(part.id, "line-opacity", paint()["line-opacity"] as any); },
      });
    });
    return builds;
  }, [spec.key, opacity, scale, isDark, heatStyle, sig(filters)]);
}

