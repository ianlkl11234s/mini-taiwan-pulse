import { useEffect, useRef } from "react";
import type { CircleLayer, Map as MapboxMap, SymbolLayer } from "mapbox-gl";
import {
  floorUtcHourIso,
  loadGfwHourlyGridHour,
  loadGfwHourlyGridManifest,
  type GfwHourlyGridManifest,
} from "../data/gfwHourlyGridLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

export const GFW_HOURLY_GRID_SOURCE_ID = "gfw-hourly-grid-source";
export const GFW_HOURLY_GRID_CIRCLE_LAYER_ID = "gfw-hourly-grid-circle";
export const GFW_HOURLY_GRID_COUNT_LAYER_ID = "gfw-hourly-grid-count";
export const GFW_HOURLY_GRID_CLICK_LAYERS = [
  GFW_HOURLY_GRID_COUNT_LAYER_ID,
  GFW_HOURLY_GRID_CIRCLE_LAYER_ID,
] as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function ensureLayer(map: MapboxMap): void {
  if (!map.getSource(GFW_HOURLY_GRID_SOURCE_ID)) {
    map.addSource(GFW_HOURLY_GRID_SOURCE_ID, {
      type: "geojson",
      data: EMPTY,
      attribution: "Global Fishing Watch",
    });
  }
  if (!map.getLayer(GFW_HOURLY_GRID_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: GFW_HOURLY_GRID_CIRCLE_LAYER_ID,
      type: "circle",
      source: GFW_HOURLY_GRID_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"],
          ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]],
          1, 5,
          2, 7,
          3, 10,
          5, 14,
          10, 22,
        ],
        "circle-color": "#fb923c",
        "circle-opacity": 0.8,
        "circle-stroke-color": "#7c2d12",
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.9,
      },
      layout: { visibility: "none" },
    } as CircleLayer);
  }
  if (!map.getLayer(GFW_HOURLY_GRID_COUNT_LAYER_ID)) {
    map.addLayer({
      id: GFW_HOURLY_GRID_COUNT_LAYER_ID,
      type: "symbol",
      source: GFW_HOURLY_GRID_SOURCE_ID,
      layout: {
        visibility: "none",
        "text-field": ["case", [">", ["get", "vessel_count"], 1], ["to-string", ["get", "vessel_count"]], ""],
        "text-size": ["step", ["get", "vessel_count"], 10, 10, 11, 50, 12],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#fff7ed",
        "text-halo-color": "#431407",
        "text-halo-width": 0.8,
        "text-opacity": 0.9,
      },
    } as SymbolLayer);
  }
}

function setVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  if (map.getLayer(GFW_HOURLY_GRID_CIRCLE_LAYER_ID)) {
    map.setLayoutProperty(GFW_HOURLY_GRID_CIRCLE_LAYER_ID, "visibility", value);
  }
  if (map.getLayer(GFW_HOURLY_GRID_COUNT_LAYER_ID)) {
    map.setLayoutProperty(GFW_HOURLY_GRID_COUNT_LAYER_ID, "visibility", value);
  }
}

export function useGfwHourlyGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.8,
): void {
  const mapTick = useMapReadyTick(mapRef, visible);
  const loadedHourRef = useRef<string | null>(null);
  const pendingHourRef = useRef<string | null>(null);
  const manifestRef = useRef<GfwHourlyGridManifest | null>(null);
  const dataRef = useRef<GeoJSON.FeatureCollection>(EMPTY);
  const requestRef = useRef(0);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    let retryPending = false;
    let manifestRefreshStarted = false;
    const opening = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (opening) {
      manifestRef.current = null;
      loadedHourRef.current = null;
      pendingHourRef.current = null;
      dataRef.current = EMPTY;
    }

    const clearData = () => {
      dataRef.current = EMPTY;
      const source = map.getSource(GFW_HOURLY_GRID_SOURCE_ID) as { setData?: (value: GeoJSON.FeatureCollection) => void } | undefined;
      source?.setData?.(EMPTY);
    };

    const loadHour = async (timeSeconds: number) => {
      if (!visible || disposed) return;
      const hourIso = floorUtcHourIso(timeSeconds);
      if (loadedHourRef.current === hourIso) return;
      if (pendingHourRef.current === hourIso) return;
      const manifest = manifestRef.current;
      if (!manifest) {
        clearData();
        return;
      }
      const requestId = ++requestRef.current;
      pendingHourRef.current = hourIso;
      loadedHourRef.current = null;
      clearData();
      const data = await loadGfwHourlyGridHour(manifest, hourIso);
      if (disposed || requestId !== requestRef.current) return;
      pendingHourRef.current = null;
      loadedHourRef.current = data ? hourIso : null;
      dataRef.current = data ?? EMPTY;
      const source = map.getSource(GFW_HOURLY_GRID_SOURCE_ID) as { setData?: (value: GeoJSON.FeatureCollection) => void } | undefined;
      source?.setData?.(dataRef.current);
      if (data) {
        keepLoadingUntilMapIdle(map, "gfw-hourly-grid:render", "GFW 小時網格繪製", GFW_HOURLY_GRID_SOURCE_ID);
      }
    };

    const refreshManifest = async () => {
      manifestRefreshStarted = true;
      const requestId = ++requestRef.current;
      manifestRef.current = null;
      loadedHourRef.current = null;
      pendingHourRef.current = null;
      clearData();
      const manifest = await loadGfwHourlyGridManifest();
      if (disposed || requestId !== requestRef.current) return;
      manifestRef.current = manifest;
      await loadHour(timeStore.getTime());
    };

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
        if (!visible) {
          setVisibility(map, false);
          return;
        }
        if (!map.isStyleLoaded()) {
          scheduleRetry();
          return;
        }
        ensureLayer(map);
        setVisibility(map, true);
        const source = map.getSource(GFW_HOURLY_GRID_SOURCE_ID) as { setData?: (value: GeoJSON.FeatureCollection) => void } | undefined;
        source?.setData?.(dataRef.current);
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        map.setPaintProperty(GFW_HOURLY_GRID_CIRCLE_LAYER_ID, "circle-opacity", clampedOpacity);
        map.setPaintProperty(GFW_HOURLY_GRID_CIRCLE_LAYER_ID, "circle-stroke-opacity", clampedOpacity);
        map.setPaintProperty(GFW_HOURLY_GRID_COUNT_LAYER_ID, "text-opacity", clampedOpacity);
        if (!manifestRef.current && !manifestRefreshStarted) void refreshManifest();
        else if (manifestRef.current) void loadHour(timeStore.getTime());
      } catch {
        scheduleRetry();
      }
    };

    applyStyle();
    map.on("style.load", applyStyle);
    const unsubscribe = timeStore.subscribeThrottled(250, loadHour);
    return () => {
      disposed = true;
      requestRef.current += 1;
      pendingHourRef.current = null;
      unsubscribe();
      map.off("style.load", applyStyle);
      if (retryPending) map.off("idle", retry);
    };
  }, [mapRef, visible, opacity, mapTick]);
}
