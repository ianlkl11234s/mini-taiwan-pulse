import { useCallback, useEffect, useRef } from "react";
import type { CircleLayer, Map as MapboxMap } from "mapbox-gl";
import {
  aisstreamToGeoJSON,
  fetchAisstreamVessels,
  fetchGfwVesselPresence,
  gfwToGeoJSON,
  type MaritimeBounds,
} from "../data/globalMaritimeLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";

const AIS_SOURCE = "global-maritime-aisstream-current";
const AIS_LAYER = "global-maritime-aisstream-circle";
const GFW_SOURCE = "global-maritime-gfw-presence";
const GFW_LAYER = "global-maritime-gfw-circle";

export const GLOBAL_MARITIME_CLICK_LAYERS = [AIS_LAYER, GFW_LAYER] as const;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function safeBounds(map: MapboxMap): MaritimeBounds {
  const b = map.getBounds();
  if (!b) return { minLon: -180, minLat: -85, maxLon: 180, maxLat: 85 };
  const minLon = Math.max(-180, Math.min(180, b.getWest()));
  const maxLon = Math.max(-180, Math.min(180, b.getEast()));
  const minLat = Math.max(-85, Math.min(85, b.getSouth()));
  const maxLat = Math.max(-85, Math.min(85, b.getNorth()));
  return {
    minLon: Math.min(minLon, maxLon),
    minLat: Math.min(minLat, maxLat),
    maxLon: Math.max(minLon, maxLon),
    maxLat: Math.max(minLat, maxLat),
  };
}

const AIS_DEFAULT_OPACITY = Number(paramDefault("aisstreamVessels", "aisstreamVesselsOpacity") ?? 1);
const GFW_DEFAULT_OPACITY = Number(paramDefault("gfwVesselPresence", "gfwVesselPresenceOpacity") ?? 1);

/** 主題／透明度只走 setPaintProperty；不進抓資料的 effect。 */
function applyPaint(
  map: MapboxMap,
  aisOpacity: number,
  gfwOpacity: number,
  isDarkTheme: boolean,
): void {
  const entries: [string, number, number][] = [
    [AIS_LAYER, aisOpacity, AIS_DEFAULT_OPACITY],
    [GFW_LAYER, gfwOpacity, GFW_DEFAULT_OPACITY],
  ];
  for (const [id, opacity, def] of entries) {
    if (!map.getLayer(id)) continue;
    const clamped = Math.max(0, Math.min(1, opacity));
    map.setPaintProperty(id, "circle-opacity", clamped);
    const stroke = pointStrokePaint(isDarkTheme, clamped / def);
    for (const prop of ["circle-stroke-color", "circle-stroke-width", "circle-stroke-opacity"] as const) map.setPaintProperty(id, prop, stroke[prop]);
  }
}

function ensureSources(map: MapboxMap, isDarkTheme: boolean): void {
  if (!map.getSource(AIS_SOURCE)) map.addSource(AIS_SOURCE, { type: "geojson", data: EMPTY_FC, attribution: "AISStream" });
  if (!map.getSource(GFW_SOURCE)) map.addSource(GFW_SOURCE, { type: "geojson", data: EMPTY_FC, attribution: "Global Fishing Watch" });
  if (!map.getLayer(AIS_LAYER)) {
    map.addLayer({
      id: AIS_LAYER,
      type: "circle",
      source: AIS_SOURCE,
      paint: {
        "circle-radius": pointRadius("L"),
        "circle-color": "#22d3ee",
        "circle-opacity": 0.9,
        ...pointStrokePaint(isDarkTheme),
      },
      layout: { visibility: "none" },
    } as CircleLayer);
  }
  if (!map.getLayer(GFW_LAYER)) {
    map.addLayer({
      id: GFW_LAYER,
      type: "circle",
      source: GFW_SOURCE,
      paint: {
        "circle-radius": pointRadius("L"),
        "circle-color": "#f59e0b",
        "circle-opacity": 0.75,
        ...pointStrokePaint(isDarkTheme),
      },
      layout: { visibility: "none" },
    } as CircleLayer);
  }
}

export function useGlobalMaritimeLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  aisVisible: boolean,
  gfwVisible: boolean,
  aisOpacity = AIS_DEFAULT_OPACITY,
  gfwOpacity = GFW_DEFAULT_OPACITY,
  isDarkTheme = true,
): void {
  const styleRef = useRef({ aisOpacity, gfwOpacity, isDarkTheme });
  styleRef.current = { aisOpacity, gfwOpacity, isDarkTheme };
  const mapTick = useMapReadyTick(mapRef, aisVisible || gfwVisible);
  const aisDataRef = useRef<GeoJSON.FeatureCollection>(EMPTY_FC);
  const gfwDataRef = useRef<GeoJSON.FeatureCollection>(EMPTY_FC);
  const requestRef = useRef(0);

  const update = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || (!aisVisible && !gfwVisible)) return;
    const bounds = safeBounds(map);
    const requestId = ++requestRef.current;
    const [ais, gfw] = await Promise.all([
      aisVisible ? fetchAisstreamVessels(bounds) : Promise.resolve([]),
      gfwVisible ? fetchGfwVesselPresence(bounds) : Promise.resolve([]),
    ]);
    if (requestId !== requestRef.current) return;
    aisDataRef.current = aisstreamToGeoJSON(ais);
    gfwDataRef.current = gfwToGeoJSON(gfw);
    const aisSource = map.getSource(AIS_SOURCE) as { setData?: (fc: GeoJSON.FeatureCollection) => void } | undefined;
    const gfwSource = map.getSource(GFW_SOURCE) as { setData?: (fc: GeoJSON.FeatureCollection) => void } | undefined;
    aisSource?.setData?.(aisDataRef.current);
    gfwSource?.setData?.(gfwDataRef.current);
    keepLoadingUntilMapIdle(map, "global-maritime:render", "全球海事圖層繪製", null);
  }, [aisVisible, gfwVisible, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    let retryPending = false;
    const retry = () => {
      retryPending = false;
      if (!disposed) applyStyle();
    };
    const scheduleRetry = () => {
      if (disposed || retryPending) return;
      retryPending = true;
      map.once("idle", retry);
    };
    const applyStyle = () => {
      try {
        // All Off / 單層關閉先處理既有 layer，不等待 style readiness。
        if (map.getLayer(AIS_LAYER) && !aisVisible) map.setLayoutProperty(AIS_LAYER, "visibility", "none");
        if (map.getLayer(GFW_LAYER) && !gfwVisible) map.setLayoutProperty(GFW_LAYER, "visibility", "none");
        if (!aisVisible && !gfwVisible) return;
        if (!map.isStyleLoaded()) { scheduleRetry(); return; }
        const style = styleRef.current;
        ensureSources(map, style.isDarkTheme);
        if (map.getLayer(AIS_LAYER)) map.setLayoutProperty(AIS_LAYER, "visibility", aisVisible ? "visible" : "none");
        if (map.getLayer(GFW_LAYER)) map.setLayoutProperty(GFW_LAYER, "visibility", gfwVisible ? "visible" : "none");
        applyPaint(map, style.aisOpacity, style.gfwOpacity, style.isDarkTheme);
      } catch {
        scheduleRetry();
        return;
      }
      if (aisVisible || gfwVisible) void update();
    };
    map.on("style.load", applyStyle);
    applyStyle();
    const onMoveEnd = () => { if (aisVisible || gfwVisible) void update(); };
    map.on("moveend", onMoveEnd);
    const interval = window.setInterval(() => { if (aisVisible || gfwVisible) void update(); }, aisVisible ? 60_000 : 6 * 60 * 60_000);
    return () => {
      disposed = true;
      map.off("style.load", applyStyle);
      map.off("moveend", onMoveEnd);
      if (retryPending) map.off("idle", retry);
      window.clearInterval(interval);
    };
  }, [aisVisible, gfwVisible, mapRef, mapTick, update]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!aisVisible && !gfwVisible)) return;
    try { applyPaint(map, aisOpacity, gfwOpacity, isDarkTheme); } catch { /* style 切換中；style.load 會重套 */ }
  }, [aisVisible, gfwVisible, aisOpacity, gfwOpacity, isDarkTheme, mapRef, mapTick]);
}
