/**
 * 交通可及性「全台網格可及性」圖層 hook（模擬面板，公開）：H3 res 7 一般 fill＋step 分階。
 *
 * 仿 `h3LayerFactory`：h3 runtime 延遲載入、cellToBoundary 產面；所有指標×版本×車速先寫進 properties，
 * 切指標只改 paint 的 `get` 欄位與 step 斷點（斷點讀 bundle.json layers[reach_grid].breaks，沒有才現算）。
 * 未涵蓋（720 分內到不了或無資料）另用中性灰，不當 0。
 */
import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import { loadH3 } from "../map/h3Runtime";
import { keepLoadingUntilMapIdle, withLoading } from "../lib/loadingRegistry";
import { loadTransitReachGrid } from "../data/transitReachStore";
import { reportSimBundleError } from "../data/simBundle";
import type { LoadedSimBundle } from "../data/simBundleTypes";
import {
  TRANSIT_REACH_GRID_METRICS, TRANSIT_REACH_GRID_VIEWS, TRANSIT_REACH_SLUG, TRANSIT_REACH_SPEEDS, TRANSIT_REACH_UNCOVERED_COLOR,
  bundleGridBreaks, computeGridBreaks, gridClassColors, gridPropName, gridValue,
  type TransitReachGridData, type TransitReachGridMetric, type TransitReachGridView, type TransitReachSpeed,
} from "../data/transitReachTypes";
import { useMapReadyTick } from "./useMapReadyTick";

export const TRANSIT_REACH_GRID_IDS = { fill: "transit-reach-grid-fill", outline: "transit-reach-grid-outline" } as const;
const SRC = "transit-reach-grid-src";

export interface TransitReachGridControls { metric: TransitReachGridMetric; view: TransitReachGridView; speed: TransitReachSpeed }

/** 圖例與 paint 共用：目前組合的斷點與各階顏色 */
export interface TransitReachGridClasses { breaks: number[]; colors: string[]; source: "bundle" | "computed" }

const classCache = new Map<string, TransitReachGridClasses>();
export function transitReachGridClasses(bundle: LoadedSimBundle | null, grid: TransitReachGridData, c: TransitReachGridControls): TransitReachGridClasses {
  const key = `${bundle?.base ?? ""}|${c.metric}|${c.view}|${c.speed}`;
  const cached = classCache.get(key);
  if (cached) return cached;
  const fromBundle = bundleGridBreaks(bundle?.manifest, c.metric, c.view, c.speed);
  let breaks = fromBundle;
  if (!breaks) {
    const values: number[] = [];
    for (let i = 0; i < grid.ids.length; i++) { const v = gridValue(grid, i, c.metric, c.view, c.speed); if (v !== null) values.push(v); }
    breaks = computeGridBreaks(values, c.metric, c.view);
  }
  const out: TransitReachGridClasses = { breaks, colors: gridClassColors(breaks.length + 1, c.metric, c.view), source: fromBundle ? "bundle" : "computed" };
  classCache.set(key, out);
  return out;
}

/** fill-color：有值走 step、缺值（屬性不存在）走未涵蓋灰 */
export function gridFillColor(prop: string, classes: TransitReachGridClasses): ExpressionSpecification {
  const step: unknown[] = ["step", ["get", prop], classes.colors[0]!];
  classes.breaks.forEach((b, k) => step.push(b, classes.colors[k + 1]!));
  return ["case", ["==", ["typeof", ["get", prop]], "number"], step, TRANSIT_REACH_UNCOVERED_COLOR] as unknown as ExpressionSpecification;
}

export function gridFillOpacity(prop: string, opacity: number): ExpressionSpecification {
  const o = Math.max(0, Math.min(1, opacity));
  return ["case", ["==", ["typeof", ["get", prop]], "number"], o, 0.45 * o] as unknown as ExpressionSpecification;
}

/** 每格 Polygon，properties：i、pop、全部 metric×view×speed（缺值不寫＝未涵蓋） */
export function buildGridGeoJSON(grid: TransitReachGridData, cellToBoundary: (id: string, geoJson: boolean) => number[][]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: grid.ids.map((id, i) => {
      const ring = cellToBoundary(id, true);
      ring.push(ring[0]!);
      const properties: Record<string, number> = { i };
      for (const metric of TRANSIT_REACH_GRID_METRICS) for (const view of TRANSIT_REACH_GRID_VIEWS) for (const speed of TRANSIT_REACH_SPEEDS) {
        const v = gridValue(grid, i, metric, view, speed);
        if (v !== null) properties[gridPropName(metric, view, speed)] = Math.round(v * 10) / 10;
      }
      return { type: "Feature", id: i, properties, geometry: { type: "Polygon", coordinates: [ring] } };
    }),
  };
}

function removeAll(map: MapboxMap) {
  for (const id of [TRANSIT_REACH_GRID_IDS.outline, TRANSIT_REACH_GRID_IDS.fill]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* style replaced */ }
}

export function useTransitReachGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: TransitReachGridControls,
  isDark = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [loaded, setLoaded] = useState<{ bundle: LoadedSimBundle; grid: TransitReachGridData; fc: GeoJSON.FeatureCollection } | null>(null);
  const [mountRevision, setMountRevision] = useState(0);
  const latest = useRef({ controls, opacity, isDark });
  latest.current = { controls, opacity, isDark };

  useEffect(() => {
    if (!visible || loaded) return;
    let cancelled = false;
    loadTransitReachGrid().then(({ bundle, grid }) => withLoading("transit-reach-grid-geometry", "交通可及性網格幾何", loadH3().then((h3) => {
      if (cancelled) return;
      setLoaded({ bundle, grid, fc: buildGridGeoJSON(grid, (id, g) => h3.cellToBoundary(id, g)) });
    }))).catch((error: unknown) => {
      if (!cancelled) reportSimBundleError(TRANSIT_REACH_SLUG, "grid", error);
    });
    return () => { cancelled = true; };
  }, [visible, loaded]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      if (!visible || !loaded) { removeAll(map); return; }
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: loaded.fc });
        keepLoadingUntilMapIdle(map, `${SRC}:render`, "交通可及性網格繪製中", SRC);
      }
      const { controls: c, opacity: o, isDark: dark } = latest.current;
      const prop = gridPropName(c.metric, c.view, c.speed);
      const classes = transitReachGridClasses(loaded.bundle, loaded.grid, c);
      if (!map.getLayer(TRANSIT_REACH_GRID_IDS.fill)) map.addLayer({
        id: TRANSIT_REACH_GRID_IDS.fill, type: "fill", source: SRC,
        paint: { "fill-color": gridFillColor(prop, classes), "fill-opacity": gridFillOpacity(prop, o) },
      });
      if (!map.getLayer(TRANSIT_REACH_GRID_IDS.outline)) map.addLayer({
        id: TRANSIT_REACH_GRID_IDS.outline, type: "line", source: SRC, minzoom: 8,
        paint: { "line-color": dark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.2)", "line-width": 0.5 },
      });
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, loaded, mapTick]);

  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 切指標／版本／車速／透明度：只改 paint（`get` 欄位與斷點）
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !loaded || !map.getLayer(TRANSIT_REACH_GRID_IDS.fill)) return;
    const prop = gridPropName(controls.metric, controls.view, controls.speed);
    map.setPaintProperty(TRANSIT_REACH_GRID_IDS.fill, "fill-color", gridFillColor(prop, transitReachGridClasses(loaded.bundle, loaded.grid, controls)));
    map.setPaintProperty(TRANSIT_REACH_GRID_IDS.fill, "fill-opacity", gridFillOpacity(prop, opacity));
    map.setPaintProperty(TRANSIT_REACH_GRID_IDS.outline, "line-color", isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.2)");
  }, [mapRef, visible, loaded, controls.metric, controls.view, controls.speed, opacity, isDark, mountRevision, mapTick]);
}
