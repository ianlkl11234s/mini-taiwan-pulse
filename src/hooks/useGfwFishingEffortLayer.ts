import { useEffect, useRef } from "react";
import type { FillLayer, GeoJSONSource, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  loadGfwFishingEffortDay,
  loadGfwFishingEffortManifest,
  type GfwFishingEffortManifest,
} from "../data/gfwFishingEffortLoader";
import { showTransientNotice } from "../components/TransientNotice";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

export const GFW_FISHING_EFFORT_SOURCE_ID = "gfw-fishing-effort-source";
export const GFW_FISHING_EFFORT_FILL_LAYER_ID = "gfw-fishing-effort-fill";
export const GFW_FISHING_EFFORT_OUTLINE_LAYER_ID = "gfw-fishing-effort-outline";
export const GFW_FISHING_EFFORT_CLICK_LAYERS = [GFW_FISHING_EFFORT_FILL_LAYER_ID] as const;

/**
 * Sequential apparent-hours ramp.  The input is log1p(hours), rather than a
 * linear count scale, so sparse low-activity cells remain visible without
 * letting a few extreme cells flatten the rest of the layer.  `max` and
 * `coalesce` keep malformed/null tile properties from producing NaN paint.
 */
export const GFW_FISHING_EFFORT_COLOR_EXPRESSION = [
  "interpolate", ["linear"],
  ["ln", ["+", 1, ["max", ["coalesce", ["to-number", ["get", "apparent_fishing_hours"]], 0], 0]]],
  0, "#0f766e",
  Math.log1p(1), "#22d3ee",
  Math.log1p(12), "#facc15",
  Math.log1p(48), "#fb7185",
] as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function utcDateForSeconds(timeSeconds: number): string | null {
  const date = new Date(timeSeconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function ensureLayers(map: MapboxMap): void {
  if (!map.getSource(GFW_FISHING_EFFORT_SOURCE_ID)) {
    map.addSource(GFW_FISHING_EFFORT_SOURCE_ID, {
      type: "geojson",
      data: EMPTY,
      attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Global Fishing Watch</a>',
    });
  }
  if (!map.getLayer(GFW_FISHING_EFFORT_FILL_LAYER_ID)) {
    map.addLayer({
      id: GFW_FISHING_EFFORT_FILL_LAYER_ID,
      type: "fill",
      source: GFW_FISHING_EFFORT_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "fill-color": GFW_FISHING_EFFORT_COLOR_EXPRESSION as unknown as NonNullable<FillLayer["paint"]>["fill-color"],
        "fill-opacity": 0.55,
      },
    } as FillLayer);
  }
  if (!map.getLayer(GFW_FISHING_EFFORT_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: GFW_FISHING_EFFORT_OUTLINE_LAYER_ID,
      type: "line",
      source: GFW_FISHING_EFFORT_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#a5f3fc",
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.25, 10, 0.8],
        "line-opacity": 0.72,
      },
    } as LineLayer);
  }
}

function setVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of [GFW_FISHING_EFFORT_FILL_LAYER_ID, GFW_FISHING_EFFORT_OUTLINE_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}

export function useGfwFishingEffortLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.55,
): void {
  const mapTick = useMapReadyTick(mapRef, visible);
  const manifestRef = useRef<GfwFishingEffortManifest | null>(null);
  const dataRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Polygon> | null>(null);
  const loadedDateRef = useRef<string | null>(null);
  const pendingDateRef = useRef<string | null>(null);
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
      dataRef.current = null;
      loadedDateRef.current = null;
      pendingDateRef.current = null;
    }

    const source = () => map.getSource(GFW_FISHING_EFFORT_SOURCE_ID) as GeoJSONSource | undefined;
    const clear = () => {
      dataRef.current = null;
      loadedDateRef.current = null;
      source()?.setData(EMPTY);
      setVisibility(map, false);
    };
    const showData = (data: GeoJSON.FeatureCollection<GeoJSON.Polygon>) => {
      dataRef.current = data;
      source()?.setData(data);
      setVisibility(map, true);
      keepLoadingUntilMapIdle(
        map,
        "gfw-fishing-effort:render",
        "GFW 漁撈活動繪製",
        GFW_FISHING_EFFORT_SOURCE_ID,
      );
    };
    const notifyManifest = (manifest: GfwFishingEffortManifest) => {
      if (!visible || activation !== activationRef.current || noticeActivationRef.current === activation) return;
      noticeActivationRef.current = activation;
      showTransientNotice(
        `GFW 漁撈活動 sample：${manifest.selectedUtcDate} UTC；最新觀測 active date ${manifest.latestObservedActiveDate}，未提供 finalized 狀態且 API 資料可能修訂`,
      );
    };
    const loadForTime = async (timeSeconds: number) => {
      if (!visible || disposed) return;
      const manifest = manifestRef.current;
      const selectedDate = utcDateForSeconds(timeSeconds);
      if (!manifest || selectedDate !== manifest.selectedUtcDate) {
        requestRef.current += 1;
        pendingDateRef.current = null;
        clear();
        return;
      }
      if (loadedDateRef.current === selectedDate || pendingDateRef.current === selectedDate) return;
      const requestId = ++requestRef.current;
      pendingDateRef.current = selectedDate;
      clear();
      const data = await loadGfwFishingEffortDay(manifest);
      if (disposed || requestId !== requestRef.current) return;
      pendingDateRef.current = null;
      loadedDateRef.current = data ? selectedDate : null;
      if (data) showData(data);
      else clear();
    };
    const refreshManifest = async () => {
      manifestRefreshStarted = true;
      const requestId = ++requestRef.current;
      manifestRef.current = null;
      pendingDateRef.current = null;
      clear();
      const manifest = await loadGfwFishingEffortManifest();
      if (disposed || requestId !== requestRef.current) return;
      manifestRef.current = manifest;
      if (manifest) notifyManifest(manifest);
      await loadForTime(timeStore.getTime());
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
        ensureLayers(map);
        source()?.setData(dataRef.current ?? EMPTY);
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        map.setPaintProperty(GFW_FISHING_EFFORT_FILL_LAYER_ID, "fill-opacity", clampedOpacity);
        map.setPaintProperty(GFW_FISHING_EFFORT_OUTLINE_LAYER_ID, "line-opacity", clampedOpacity);
        const selectedDate = utcDateForSeconds(timeStore.getTime());
        setVisibility(map, Boolean(dataRef.current && selectedDate === manifestRef.current?.selectedUtcDate));
        if (!manifestRef.current && !manifestRefreshStarted) void refreshManifest();
        else if (manifestRef.current) void loadForTime(timeStore.getTime());
      } catch {
        scheduleRetry();
      }
    };

    applyStyle();
    map.on("style.load", applyStyle);
    const unsubscribe = timeStore.subscribeThrottled(250, loadForTime);
    return () => {
      disposed = true;
      requestRef.current += 1;
      pendingDateRef.current = null;
      unsubscribe();
      map.off("style.load", applyStyle);
      if (retryPending) map.off("idle", retry);
    };
  }, [mapRef, visible, opacity, mapTick]);
}
