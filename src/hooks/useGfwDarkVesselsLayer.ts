import { useEffect, useRef } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { floorUtcHourIso } from "../data/gfwHourlyGridLoader";
import {
  loadGfwDarkVesselsHour,
  loadGfwDarkVesselsManifest,
  type GfwDarkVesselsManifest,
} from "../data/gfwDarkVesselsLoader";
import { showTransientNotice } from "../components/TransientNotice";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

export const GFW_DARK_VESSELS_SOURCE_ID = "gfw-dark-vessels-source";
export const GFW_DARK_VESSELS_LAYER_ID = "gfw-dark-vessels-circle";
export const GFW_DARK_VESSELS_CLICK_LAYERS = [GFW_DARK_VESSELS_LAYER_ID] as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function ensureLayer(map: MapboxMap): void {
  if (!map.getSource(GFW_DARK_VESSELS_SOURCE_ID)) {
    map.addSource(GFW_DARK_VESSELS_SOURCE_ID, {
      type: "geojson",
      data: EMPTY,
      attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Global Fishing Watch</a>',
    });
  }
  if (!map.getLayer(GFW_DARK_VESSELS_LAYER_ID)) {
    map.addLayer({
      id: GFW_DARK_VESSELS_LAYER_ID,
      type: "circle",
      source: GFW_DARK_VESSELS_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"],
          ["sqrt", ["max", 1, ["to-number", ["get", "detections"], 1]]],
          1, 5, 2, 8, 3, 12, 5, 18, 10, 26,
        ],
        "circle-color": "#f43f5e",
        "circle-opacity": 0.86,
        "circle-stroke-color": "#fff1f2",
        "circle-stroke-width": 1.2,
        "circle-stroke-opacity": 0.95,
      },
    } as CircleLayer);
  }
}

export function useGfwDarkVesselsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.86,
): void {
  const mapTick = useMapReadyTick(mapRef, visible);
  const manifestRef = useRef<GfwDarkVesselsManifest | null>(null);
  const loadedHourRef = useRef<string | null>(null);
  const pendingHourRef = useRef<string | null>(null);
  const dataRef = useRef<GeoJSON.FeatureCollection>(EMPTY);
  const requestRef = useRef(0);
  const wasVisibleRef = useRef(false);
  const activationRef = useRef(0);
  const noticeActivationRef = useRef(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    let retryPending = false;
    let manifestRefreshStarted = false;
    const opening = visible && !wasVisibleRef.current;
    if (opening) activationRef.current += 1;
    wasVisibleRef.current = visible;
    const activation = activationRef.current;
    if (opening) {
      manifestRef.current = null;
      loadedHourRef.current = null;
      pendingHourRef.current = null;
      dataRef.current = EMPTY;
    }

    const clear = () => {
      dataRef.current = EMPTY;
      (map.getSource(GFW_DARK_VESSELS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(EMPTY);
    };
    const notifyLatest = (manifest: GfwDarkVesselsManifest) => {
      if (!visible || activation !== activationRef.current || noticeActivationRef.current === activation) return;
      noticeActivationRef.current = activation;
      showTransientNotice(`GFW SAR 未匹配 AIS 資料最新完整日：${manifest.latestCompleteDate}（UTC，非即時）`);
    };
    const loadHour = async (timeSeconds: number) => {
      if (!visible || disposed) return;
      const hourIso = floorUtcHourIso(timeSeconds);
      if (loadedHourRef.current === hourIso || pendingHourRef.current === hourIso) return;
      const manifest = manifestRef.current;
      if (!manifest) { clear(); return; }
      const requestId = ++requestRef.current;
      pendingHourRef.current = hourIso;
      loadedHourRef.current = null;
      clear();
      const data = await loadGfwDarkVesselsHour(manifest, hourIso);
      if (disposed || requestId !== requestRef.current) return;
      pendingHourRef.current = null;
      loadedHourRef.current = data ? hourIso : null;
      dataRef.current = data ?? EMPTY;
      (map.getSource(GFW_DARK_VESSELS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(dataRef.current);
      if (data) keepLoadingUntilMapIdle(map, "gfw-dark-vessels:render", "GFW SAR 未匹配 AIS 繪製", GFW_DARK_VESSELS_SOURCE_ID);
    };
    const refreshManifest = async () => {
      manifestRefreshStarted = true;
      const requestId = ++requestRef.current;
      manifestRef.current = null;
      loadedHourRef.current = null;
      pendingHourRef.current = null;
      clear();
      const manifest = await loadGfwDarkVesselsManifest();
      if (disposed || requestId !== requestRef.current) return;
      manifestRef.current = manifest;
      if (manifest) notifyLatest(manifest);
      await loadHour(timeStore.getTime());
    };
    const retry = () => { retryPending = false; if (!disposed) applyStyle(); };
    const scheduleRetry = () => {
      if (disposed || retryPending) return;
      retryPending = true;
      map.once("idle", retry);
    };
    const applyStyle = () => {
      try {
        if (!visible) {
          if (map.getLayer(GFW_DARK_VESSELS_LAYER_ID)) map.setLayoutProperty(GFW_DARK_VESSELS_LAYER_ID, "visibility", "none");
          return;
        }
        if (!map.isStyleLoaded()) { scheduleRetry(); return; }
        ensureLayer(map);
        map.setLayoutProperty(GFW_DARK_VESSELS_LAYER_ID, "visibility", "visible");
        (map.getSource(GFW_DARK_VESSELS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(dataRef.current);
        const value = Math.max(0, Math.min(1, opacity));
        map.setPaintProperty(GFW_DARK_VESSELS_LAYER_ID, "circle-opacity", value);
        map.setPaintProperty(GFW_DARK_VESSELS_LAYER_ID, "circle-stroke-opacity", value);
        if (!manifestRef.current && !manifestRefreshStarted) void refreshManifest();
        else if (manifestRef.current) void loadHour(timeStore.getTime());
      } catch { scheduleRetry(); }
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
