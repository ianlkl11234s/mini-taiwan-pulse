import { useEffect, useRef, useCallback, useState } from "react";
import type {
  Map as MapboxMap,
  LineLayer,
  CircleLayer,
  SymbolLayer,
  ExpressionSpecification,
  FilterSpecification,
} from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { timeStore } from "../state/timeStore";
import {
  agencyForecastsToGeoJSON,
  fetchTyphoonAgencyForecasts,
  groupAgencyTracks,
  type AgencyForecastTrack,
} from "../data/typhoonAgencyForecastsLoader";
import { TYPHOON_AGENCIES, TYPHOON_AGENCY_COLORS } from "../data/typhoonTypes";
import { badgeLabelLayout, labelHaloPaint, pointRadius, pointStrokePaint } from "../map/mapStyleScale";

// 各國颱風預報（NCDR 五家）— 每家一色的線＋6 點，終點標「機構 發佈時間」。
// 跟著時間軸走（currentTime 不進 deps，走 timeStore 訂閱）：每家只畫 issued_at ≤ t 的最新一版
// （feature 帶 [valid_from, valid_until)，見 typhoonAgencyForecastsLoader）。

const SRC_LINES = "typhoon-agency-forecasts-lines";
const SRC_POINTS = "typhoon-agency-forecasts-points";
const LAYER_LINE = "typhoon-agency-forecasts-line";
const LAYER_POINTS = "typhoon-agency-forecasts-points";
const LAYER_LABEL = "typhoon-agency-forecasts-label";
const ALL_LAYER_IDS = [LAYER_LINE, LAYER_POINTS, LAYER_LABEL];

const AGENCY_COLOR: ExpressionSpecification = [
  "match", ["get", "agency"],
  ...TYPHOON_AGENCIES.flatMap((a) => [a, TYPHOON_AGENCY_COLORS[a]]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

const LINE_WIDTH = ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 3] as unknown as ExpressionSpecification;

export function useTyphoonAgencyForecastsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
  isDark: boolean = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const tracksRef = useRef<AgencyForecastTrack[]>([]);
  const dataReadyRef = useRef(false);
  const layersReadyRef = useRef(false);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || dataReadyRef.current) return;
    let cancelled = false;
    fetchTyphoonAgencyForecasts()
      .then((rows) => {
        if (cancelled) return;
        tracksRef.current = groupAgencyTracks(rows);
        dataReadyRef.current = true;
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) ensureSource(map);
        setDataTick((v) => v + 1);
      })
      .catch((err) => console.warn("[TyphoonAgencyForecasts] load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    const { lines, points } = agencyForecastsToGeoJSON(tracksRef.current);
    if (!map.getSource(SRC_LINES)) map.addSource(SRC_LINES, { type: "geojson", data: lines });
    if (!map.getSource(SRC_POINTS)) map.addSource(SRC_POINTS, { type: "geojson", data: points });
    if (!map.getLayer(LAYER_LINE)) {
      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SRC_LINES,
        layout: hookLineLayout("typhoonAgencyForecasts", LAYER_LINE),
        paint: hookLinePaint("typhoonAgencyForecasts", LAYER_LINE, {
          "line-color": AGENCY_COLOR,
          "line-width": LINE_WIDTH,
          "line-opacity": 0.9,
        }, { "line-color": AGENCY_COLOR, "line-width": LINE_WIDTH, "line-opacity": 0.9 }),
      } as LineLayer);
    }
    if (!map.getLayer(LAYER_POINTS)) {
      map.addLayer({
        id: LAYER_POINTS,
        type: "circle",
        source: SRC_POINTS,
        paint: {
          "circle-radius": pointRadius("S"),
          "circle-color": AGENCY_COLOR,
          "circle-opacity": 0.95,
          ...pointStrokePaint(isDarkRef.current, 1),
        },
      } as CircleLayer);
    }
    if (!map.getLayer(LAYER_LABEL)) {
      map.addLayer({
        id: LAYER_LABEL,
        type: "symbol",
        source: SRC_POINTS,
        filter: ["==", ["get", "is_last"], true],
        layout: {
          "text-field": ["get", "label"],
          ...badgeLabelLayout(),
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-anchor": "left",
          "text-offset": [0.8, 0],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        },
        paint: { "text-color": AGENCY_COLOR, ...labelHaloPaint(isDarkRef.current) },
      } as SymbolLayer);
    }
    layersReadyRef.current = true;
    return true;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ensureSource(map)) return;
    const v = visible ? "visible" : "none";
    for (const id of ALL_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
    if (!visible) return;
    const applyFilter = (t: number) => {
      const active = ["all", ["<=", ["get", "valid_from"], t], [">", ["get", "valid_until"], t]];
      if (map.getLayer(LAYER_LINE)) map.setFilter(LAYER_LINE, active as unknown as FilterSpecification);
      if (map.getLayer(LAYER_POINTS)) map.setFilter(LAYER_POINTS, active as unknown as FilterSpecification);
      if (map.getLayer(LAYER_LABEL)) {
        map.setFilter(LAYER_LABEL, [...active, ["==", ["get", "is_last"], true]] as unknown as FilterSpecification);
      }
    };
    applyFilter(timeStore.getTime());
    return timeStore.subscribeThrottled(500, applyFilter);
  }, [visible, ensureSource, mapRef, mapTick, dataTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(LAYER_LINE)) {
      map.setPaintProperty(LAYER_LINE, "line-opacity", hookLineOpacity("typhoonAgencyForecasts", LAYER_LINE, o, 0.9));
    }
    if (map.getLayer(LAYER_POINTS)) {
      map.setPaintProperty(LAYER_POINTS, "circle-opacity", 0.95 * o);
      for (const [k, val] of Object.entries(pointStrokePaint(isDark, o / 0.9))) {
        map.setPaintProperty(LAYER_POINTS, k as "circle-stroke-color", val as never);
      }
    }
    if (map.getLayer(LAYER_LABEL)) {
      map.setPaintProperty(LAYER_LABEL, "text-opacity", o);
      const halo = labelHaloPaint(isDark);
      map.setPaintProperty(LAYER_LABEL, "text-halo-color", halo["text-halo-color"]);
    }
  }, [opacity, isDark, visible, mapRef, mapTick, dataTick]);
}
