import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, LineLayer, CircleLayer, ExpressionSpecification } from "mapbox-gl";
import {
  fetchTyphoonPoints,
  typhoonPointsToGeoJSON,
  type TyphoonPoint,
} from "../data/typhoonTracksLoader";

// 颱風軌跡 — observed 實線 + forecast 虛線 + 軌跡點。
// 先做最簡：載入所有點 → 兩條 source（line / point）→ filter by point_type。

const SRC_LINES = "typhoon-tracks-lines";
const SRC_POINTS = "typhoon-tracks-points";
const LAYER_LINE_OBS = "typhoon-tracks-line-observed";
const LAYER_LINE_FCST = "typhoon-tracks-line-forecast";
const LAYER_POINTS = "typhoon-tracks-points";

const POINT_COLOR_EXPR = [
  "case",
  ["==", ["get", "point_type"], "forecast"], "#c084fc",
  "#a855f7",
] as unknown as ExpressionSpecification;

export function useTyphoonTracksLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
) {
  const dataRef = useRef<TyphoonPoint[]>([]);
  const dataReadyRef = useRef(false);
  const layersReadyRef = useRef(false);

  useEffect(() => {
    if (!visible || dataReadyRef.current) return;
    let cancelled = false;
    fetchTyphoonPoints()
      .then((pts) => {
        if (cancelled) return;
        dataRef.current = pts;
        dataReadyRef.current = true;
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) ensureSource(map);
      })
      .catch((err) => console.warn("[TyphoonTracks] load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    const { lines, points } = typhoonPointsToGeoJSON(dataRef.current);
    if (!map.getSource(SRC_LINES)) {
      map.addSource(SRC_LINES, { type: "geojson", data: lines });
    }
    if (!map.getSource(SRC_POINTS)) {
      map.addSource(SRC_POINTS, { type: "geojson", data: points });
    }
    if (!map.getLayer(LAYER_LINE_OBS)) {
      map.addLayer({
        id: LAYER_LINE_OBS,
        type: "line",
        source: SRC_LINES,
        filter: ["==", ["get", "point_type"], "observed"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#a855f7",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 3] as unknown as ExpressionSpecification,
          "line-opacity": 0.9,
        },
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_LINE_FCST)) {
      map.addLayer({
        id: LAYER_LINE_FCST,
        type: "line",
        source: SRC_LINES,
        filter: ["==", ["get", "point_type"], "forecast"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#c084fc",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 8, 2] as unknown as ExpressionSpecification,
          "line-opacity": 0.7,
          "line-dasharray": [2, 2],
        },
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_POINTS)) {
      map.addLayer({
        id: LAYER_POINTS,
        type: "circle",
        source: SRC_POINTS,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 5] as unknown as ExpressionSpecification,
          "circle-color": POINT_COLOR_EXPR,
          "circle-opacity": 0.85,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.5,
          "circle-stroke-opacity": 0.6,
        },
      } as CircleLayer);
    }
    layersReadyRef.current = true;
    return true;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ensureSource(map)) return;
    const v = visible ? "visible" : "none";
    for (const id of [LAYER_LINE_OBS, LAYER_LINE_FCST, LAYER_POINTS]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(LAYER_LINE_OBS)) map.setPaintProperty(LAYER_LINE_OBS, "line-opacity", 0.9 * o);
    if (map.getLayer(LAYER_LINE_FCST)) map.setPaintProperty(LAYER_LINE_FCST, "line-opacity", 0.7 * o);
    if (map.getLayer(LAYER_POINTS)) map.setPaintProperty(LAYER_POINTS, "circle-opacity", 0.85 * o);
  }, [visible, opacity, ensureSource, mapRef]);
}
