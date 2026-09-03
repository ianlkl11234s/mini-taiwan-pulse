import { useCallback, useEffect, useRef } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import {
  fetchGlobalEventsCurrent,
  fetchGlobalEventsWindow,
  globalEventsToGeoJSON,
  selectGlobalEventPlacesAt,
  type GlobalEventPoint,
  type GlobalEventTransitionKind,
} from "../data/globalEventsLoader";
import {
  GLOBAL_EVENT_CATEGORY_COLOR_EXPR,
  GLOBAL_EVENT_SEVERITY_RADIUS_EXPR,
} from "../data/globalEventsTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import type { TimeMode } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "global-events-current";
export const GLOBAL_EVENTS_LAYER_ID = "global-events-current-circle";
export const GLOBAL_EVENTS_PULSE_LAYER_ID = "global-events-current-pulse";

const EMPTY: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: [],
};
const PULSE_DURATION_MS = 1_800;

function parseTimestampSeconds(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value) / 1000;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function globalEventTransitions(
  visibleEvents: readonly GlobalEventPoint[],
  previousTime: number | null,
  nextTime: number,
): Map<string, GlobalEventTransitionKind> {
  const transitions = new Map<string, GlobalEventTransitionKind>();
  if (previousTime === null || !Number.isFinite(nextTime) || nextTime <= previousTime) return transitions;
  for (const event of visibleEvents) {
    if (transitions.has(event.eventId)) continue;
    const displayFrom = parseTimestampSeconds(event.displayFrom);
    if (displayFrom === null || displayFrom <= previousTime || displayFrom > nextTime) continue;
    transitions.set(event.eventId, event.publicationNo === 1 ? "new_event" : "version_update");
  }
  return transitions;
}

export function globalEventWindowBounds(
  dateKeys: readonly string[],
): { start: string; end: string } | null {
  const keys = [...new Set(dateKeys)].filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return null;
  const start = new Date(`${first}T00:00:00+08:00`);
  const lastStart = new Date(`${last}T00:00:00+08:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(lastStart.getTime())) return null;
  return {
    start: start.toISOString(),
    end: new Date(lastStart.getTime() + 86_400_000).toISOString(),
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureLayers(map: MapboxMap): void {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
  }
  if (!map.getLayer(GLOBAL_EVENTS_LAYER_ID)) {
    map.addLayer({
      id: GLOBAL_EVENTS_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": GLOBAL_EVENT_SEVERITY_RADIUS_EXPR,
        "circle-color": GLOBAL_EVENT_CATEGORY_COLOR_EXPR,
        "circle-opacity": 0.9,
        "circle-stroke-color": "rgba(15, 23, 42, 0.8)",
        "circle-stroke-width": ["match", ["get", "severity"], 3, 2, 2, 1.5, 1],
        "circle-stroke-opacity": 0.85,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(GLOBAL_EVENTS_PULSE_LAYER_ID)) {
    map.addLayer({
      id: GLOBAL_EVENTS_PULSE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["in", ["get", "transition_kind"], ["literal", ["new_event", "version_update"]]],
      paint: {
        "circle-radius": 8,
        "circle-color": "transparent",
        "circle-stroke-color": [
          "match", ["get", "transition_kind"],
          "new_event", "#facc15",
          "version_update", "#38bdf8",
          "transparent",
        ],
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": 0,
      },
    } as CircleLayer);
  }
}

function setLayerVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of [GLOBAL_EVENTS_LAYER_ID, GLOBAL_EVENTS_PULSE_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}

function visibleSignature(events: readonly GlobalEventPoint[]): string {
  return events
    .map((event) => `${event.eventId}/${event.versionId}/${event.displayPlaceId ?? event.eventPlaceId}`)
    .sort()
    .join("|");
}

export function useGlobalEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.9,
  timeMode: TimeMode = "live",
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const allEventsRef = useRef<GlobalEventPoint[]>([]);
  const activeCollectionRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point>>(EMPTY);
  const previousTimeRef = useRef<number | null>(null);
  const signatureRef = useRef("");
  const requestRef = useRef(0);
  const rafRef = useRef(0);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const stopPulse = useCallback((map?: MapboxMap) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (map?.getLayer(GLOBAL_EVENTS_PULSE_LAYER_ID)) {
      map.setPaintProperty(GLOBAL_EVENTS_PULSE_LAYER_ID, "circle-stroke-opacity", 0);
    }
  }, []);

  const startPulse = useCallback((map: MapboxMap, transitions: ReadonlyMap<string, GlobalEventTransitionKind>) => {
    stopPulse(map);
    if (transitions.size === 0 || prefersReducedMotion()) return;
    const startedAt = performance.now();
    const animate = (now: number) => {
      if (!map.getLayer(GLOBAL_EVENTS_PULSE_LAYER_ID)) {
        rafRef.current = 0;
        return;
      }
      const phase = Math.min(1, (now - startedAt) / PULSE_DURATION_MS);
      map.setPaintProperty(GLOBAL_EVENTS_PULSE_LAYER_ID, "circle-radius", 8 + phase * 22);
      map.setPaintProperty(
        GLOBAL_EVENTS_PULSE_LAYER_ID,
        "circle-stroke-opacity",
        Math.sin(Math.PI * phase) * Math.max(0, Math.min(1, opacityRef.current)),
      );
      if (phase < 1) rafRef.current = requestAnimationFrame(animate);
      else {
        rafRef.current = 0;
        map.setPaintProperty(GLOBAL_EVENTS_PULSE_LAYER_ID, "circle-stroke-opacity", 0);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [stopPulse]);

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    let unsubscribeWindow = () => {};
    let unsubscribeTime = () => {};
    ensureLayers(map);
    setLayerVisibility(map, true);
    previousTimeRef.current = timeStore.getTime();

    const feed = (events: readonly GlobalEventPoint[], transitions = new Map<string, GlobalEventTransitionKind>()) => {
      const collection = globalEventsToGeoJSON(events, transitions);
      activeCollectionRef.current = collection;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(collection);
      startPulse(map, transitions);
    };

    const renderAt = (timelineSeconds: number) => {
      const previousTime = previousTimeRef.current;
      const events = timeMode === "live"
        ? allEventsRef.current
        : selectGlobalEventPlacesAt(allEventsRef.current, timelineSeconds);
      const transitions = timeMode === "replay"
        ? globalEventTransitions(events, previousTime, timelineSeconds)
        : new Map<string, GlobalEventTransitionKind>();
      const signature = visibleSignature(events);
      previousTimeRef.current = timelineSeconds;
      if (previousTime !== null && timelineSeconds <= previousTime) stopPulse(map);
      if (signature === signatureRef.current && transitions.size === 0) return;
      signatureRef.current = signature;
      feed(events, transitions);
    };

    const acceptRows = (events: GlobalEventPoint[], loadingKey: string) => {
      if (cancelled) return;
      allEventsRef.current = events;
      signatureRef.current = "";
      previousTimeRef.current = timeStore.getTime();
      renderAt(timeStore.getTime());
      keepLoadingUntilMapIdle(map, `global-events:render:${loadingKey}`, "全球重要事件 渲染中", SOURCE_ID);
    };

    const loadCurrent = () => {
      const request = ++requestRef.current;
      fetchGlobalEventsCurrent()
        .then((events) => {
          if (request !== requestRef.current) return;
          acceptRows(events, "current");
        })
        .catch((error) => console.warn("[GlobalEvents] current load failed:", error));
    };

    const loadWindow = (dateKeys: readonly string[]) => {
      const bounds = globalEventWindowBounds(dateKeys);
      const request = ++requestRef.current;
      allEventsRef.current = [];
      signatureRef.current = "";
      feed([]);
      if (!bounds) return;
      fetchGlobalEventsWindow(bounds.start, bounds.end)
        .then((events) => {
          if (request !== requestRef.current) return;
          acceptRows(events, `${bounds.start}/${bounds.end}`);
        })
        .catch((error) => console.warn("[GlobalEvents] window load failed:", error));
    };

    const onStyleLoad = () => {
      ensureLayers(map);
      setLayerVisibility(map, true);
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(activeCollectionRef.current);
    };
    map.on("style.load", onStyleLoad);

    if (timeMode === "live") {
      loadCurrent();
    } else {
      loadWindow(timeStore.getWindowDateKeys());
      unsubscribeWindow = timeStore.subscribeWindowDateKeys(loadWindow);
      unsubscribeTime = timeStore.subscribeThrottled(200, renderAt);
    }

    return () => {
      cancelled = true;
      requestRef.current += 1;
      unsubscribeWindow();
      unsubscribeTime();
      map.off("style.load", onStyleLoad);
      stopPulse(map);
      setLayerVisibility(map, false);
    };
  }, [mapRef, mapTick, startPulse, stopPulse, timeMode, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const safeOpacity = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(GLOBAL_EVENTS_LAYER_ID)) {
      map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-opacity", safeOpacity);
      map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-stroke-opacity", safeOpacity * 0.9);
    }
  }, [mapRef, mapTick, opacity, visible]);
}
