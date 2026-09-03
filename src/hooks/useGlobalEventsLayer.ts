import { useCallback, useEffect, useRef } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import {
  fetchGlobalEventsCurrent,
  fetchGlobalEventsWindow,
  fetchGlobalEventCandidatesWindow,
  selectGlobalSituationEntries,
  selectGlobalEventPlacesAt,
  type GlobalEventPoint,
  type GlobalEventTransitionKind,
  type GlobalEventCandidate,
  type GlobalEventRecord,
} from "../data/globalEventsLoader";
import {
  GLOBAL_EVENT_CATEGORY_COLOR_EXPR,
  GLOBAL_EVENT_SEVERITY_RADIUS_EXPR,
} from "../data/globalEventsTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import type { TimeMode } from "../types";
import { useMapReadyTick } from "./useMapReadyTick";
import { globalEventRelations, layoutGlobalEventPoints, recentGlobalEventWindow, selectGlobalEventsOverview, type GlobalEventsView } from "../data/globalEventsPresentation";
import { globalEventsViewStore } from "../state/globalEventsViewStore";

const SOURCE_ID = "global-events-current";
export const GLOBAL_EVENTS_LAYER_ID = "global-events-current-circle";
export const GLOBAL_EVENTS_PULSE_LAYER_ID = "global-events-current-pulse";
export const GLOBAL_EVENTS_RELATIONS_LAYER_ID = "global-events-relations-line";
export const GLOBAL_EVENTS_CLUSTER_LAYER_ID = "global-events-clusters-circle";
const RELATIONS_SOURCE_ID = "global-events-relations";
const CONNECTORS_SOURCE_ID = "global-events-connectors";
const CLUSTERS_SOURCE_ID = "global-events-clusters";
const CONNECTORS_LAYER_ID = "global-events-connectors-line";
const CLUSTER_LABEL_LAYER_ID = "global-events-clusters-label";

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
  previouslyVisible: ReadonlySet<string> = new Set(),
): Map<string, GlobalEventTransitionKind> {
  const transitions = new Map<string, GlobalEventTransitionKind>();
  if (previousTime === null || !Number.isFinite(nextTime) || nextTime <= previousTime) return transitions;
  for (const event of visibleEvents) {
    if (transitions.has(event.eventId)) continue;
    const displayFrom = parseTimestampSeconds(event.displayFrom);
    if (displayFrom === null || displayFrom <= previousTime || displayFrom > nextTime) continue;
    transitions.set(event.eventId, event.candidateId
      ? previouslyVisible.has(event.eventId) ? "version_update" : "new_event"
      : event.publicationNo === 1 ? "new_event" : "version_update");
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
  for (const id of [RELATIONS_SOURCE_ID, CONNECTORS_SOURCE_ID, CLUSTERS_SOURCE_ID]) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY });
  }
  if (!map.getLayer(GLOBAL_EVENTS_RELATIONS_LAYER_ID)) map.addLayer({
    id: GLOBAL_EVENTS_RELATIONS_LAYER_ID, type: "line", source: RELATIONS_SOURCE_ID,
    paint: { "line-color": "#94a3b8", "line-width": 1, "line-opacity": 0.22 },
  });
  if (!map.getLayer(CONNECTORS_LAYER_ID)) map.addLayer({
    id: CONNECTORS_LAYER_ID, type: "line", source: CONNECTORS_SOURCE_ID,
    paint: { "line-color": "#94a3b8", "line-width": 0.8, "line-opacity": 0.5 },
  });
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
        "circle-stroke-color": ["case", ["==", ["get", "research_status"], "ai_assessed"], "#e2e8f0", "#0f172a"],
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
  if (!map.getLayer(GLOBAL_EVENTS_CLUSTER_LAYER_ID)) map.addLayer({
    id: GLOBAL_EVENTS_CLUSTER_LAYER_ID, type: "circle", source: CLUSTERS_SOURCE_ID,
    paint: { "circle-radius": 15, "circle-color": "#334155", "circle-stroke-color": "#cbd5e1", "circle-stroke-width": 1.5 },
  });
  if (!map.getLayer(CLUSTER_LABEL_LAYER_ID)) map.addLayer({
    id: CLUSTER_LABEL_LAYER_ID, type: "symbol", source: CLUSTERS_SOURCE_ID,
    layout: { "text-field": ["to-string", ["get", "point_count"]], "text-size": 11, "text-allow-overlap": true },
    paint: { "text-color": "#f8fafc" },
  });
}

function setLayerVisibility(map: MapboxMap, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of [GLOBAL_EVENTS_LAYER_ID, GLOBAL_EVENTS_PULSE_LAYER_ID, GLOBAL_EVENTS_RELATIONS_LAYER_ID,
    CONNECTORS_LAYER_ID, GLOBAL_EVENTS_CLUSTER_LAYER_ID, CLUSTER_LABEL_LAYER_ID]) {
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
  view: GlobalEventsView = "timeline",
  showRelations = true,
  selectedEventId: string | null = null,
  includeAI = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const allEventsRef = useRef<GlobalEventRecord[]>([]);
  const candidatesRef = useRef<GlobalEventCandidate[]>([]);
  const previousTimeRef = useRef<number | null>(null);
  const signatureRef = useRef("");
  const listSignatureRef = useRef("");
  const requestRef = useRef(0);
  const rafRef = useRef(0);
  const opacityRef = useRef(opacity);
  const relationsRef = useRef(showRelations);
  relationsRef.current = showRelations;
  const selectedRef = useRef(selectedEventId);
  selectedRef.current = selectedEventId;
  const displayedRowsRef = useRef<GlobalEventPoint[]>([]);
  const expandedGroupsRef = useRef(new Set<string>());
  opacityRef.current = opacity;

  const applyPaint = useCallback((map: MapboxMap) => {
    const safeOpacity = Math.max(0, Math.min(1, opacityRef.current));
    const selected = selectedRef.current ?? "";
    if (map.getLayer(GLOBAL_EVENTS_LAYER_ID)) {
      map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-opacity", safeOpacity);
      map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-stroke-opacity", safeOpacity * 0.9);
      map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-stroke-width", ["case", ["==", ["get", "event_id"], selected], 3, 1.5]);
      map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-stroke-color", ["case", ["==", ["get", "event_id"], selected], "#facc15",
        ["==", ["get", "research_status"], "ai_assessed"], "#e2e8f0", "#0f172a"]);
    }
    if (map.getLayer(GLOBAL_EVENTS_RELATIONS_LAYER_ID)) {
      map.setLayoutProperty(GLOBAL_EVENTS_RELATIONS_LAYER_ID, "visibility", relationsRef.current ? "visible" : "none");
      map.setPaintProperty(GLOBAL_EVENTS_RELATIONS_LAYER_ID, "line-opacity", ["case", ["==", ["get", "event_id"], selected], safeOpacity * 0.9, safeOpacity * 0.22]);
      map.setPaintProperty(GLOBAL_EVENTS_RELATIONS_LAYER_ID, "line-width", ["case", ["==", ["get", "event_id"], selected], 2.5, 1]);
    }
    if (map.getLayer(CONNECTORS_LAYER_ID)) map.setPaintProperty(CONNECTORS_LAYER_ID, "line-opacity", safeOpacity * 0.5);
    if (map.getLayer(GLOBAL_EVENTS_CLUSTER_LAYER_ID)) {
      map.setPaintProperty(GLOBAL_EVENTS_CLUSTER_LAYER_ID, "circle-opacity", safeOpacity);
      map.setPaintProperty(GLOBAL_EVENTS_CLUSTER_LAYER_ID, "circle-stroke-opacity", safeOpacity);
    }
    if (map.getLayer(CLUSTER_LABEL_LAYER_ID)) map.setPaintProperty(CLUSTER_LABEL_LAYER_ID, "text-opacity", safeOpacity);
  }, []);

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
    applyPaint(map);
    previousTimeRef.current = timeStore.getTime();

    const feed = (events: readonly GlobalEventPoint[], transitions = new Map<string, GlobalEventTransitionKind>()) => {
      displayedRowsRef.current = [...events];
      const layout = layoutGlobalEventPoints(events, map, expandedGroupsRef.current);
      const collection = layout.points;
      for (const feature of collection.features) {
        if (feature.properties) feature.properties.transition_kind = transitions.get(String(feature.properties.event_id)) ?? null;
      }
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(collection);
      (map.getSource(CONNECTORS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(layout.connectors);
      (map.getSource(CLUSTERS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(layout.clusters);
      (map.getSource(RELATIONS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(globalEventRelations(events));
      startPulse(map, transitions);
    };

    const renderAt = (timelineSeconds: number) => {
      const previousTime = previousTimeRef.current;
      const published = view === "recent7d" ? selectGlobalEventsOverview(allEventsRef.current) : timeMode === "live"
        ? allEventsRef.current
        : selectGlobalEventPlacesAt(allEventsRef.current, timelineSeconds);
      const asOf = view === "recent7d" || timeMode === "live" ? Date.now() / 1000 : timelineSeconds;
      const entries = selectGlobalSituationEntries(published, includeAI ? candidatesRef.current : [], asOf);
      const events = entries.filter((entry): entry is GlobalEventPoint => entry.coordinates !== null && !entry.mapSuppressed);
      const listSignature = entries.map((entry) => `${entry.eventId}/${entry.versionId}/${entry.eventPlaceId}/${entry.mapSuppressed ?? false}`).sort().join("|");
      if (listSignature !== listSignatureRef.current) {
        listSignatureRef.current = listSignature;
        globalEventsViewStore.set({ ...globalEventsViewStore.getSnapshot(), entries });
      }
      const transitions = view === "timeline" && timeMode === "replay"
        ? globalEventTransitions(events, previousTime, timelineSeconds, new Set(displayedRowsRef.current.map((row) => row.eventId)))
        : new Map<string, GlobalEventTransitionKind>();
      const signature = visibleSignature(events);
      previousTimeRef.current = timelineSeconds;
      if (previousTime !== null && timelineSeconds <= previousTime) stopPulse(map);
      if (signature === signatureRef.current && transitions.size === 0) return;
      signatureRef.current = signature;
      feed(events, transitions);
    };

    const acceptRows = (
      events: GlobalEventRecord[],
      loadingKey: string,
      transitionFromTime = timeStore.getTime(),
    ) => {
      if (cancelled) return;
      allEventsRef.current = events;
      signatureRef.current = "";
      listSignatureRef.current = "";
      previousTimeRef.current = transitionFromTime;
      renderAt(timeStore.getTime());
      keepLoadingUntilMapIdle(map, `global-events:render:${loadingKey}`, "全球重要事件 渲染中", SOURCE_ID);
    };

    const loadSituation = (bounds: { start: string; end: string }, current: boolean, transitionFromTime = timeStore.getTime()) => {
      const request = ++requestRef.current;
      allEventsRef.current = [];
      candidatesRef.current = [];
      signatureRef.current = "";
      feed([]);
      globalEventsViewStore.set({ entries: [], status: "loading", message: null,
        windowLabel: view === "recent7d" ? "最近七天總覽" : current ? "目前情勢（候選近七天）" : "跟隨時間軸" });
      Promise.allSettled([
        current ? fetchGlobalEventsCurrent() : fetchGlobalEventsWindow(bounds.start, bounds.end),
        includeAI ? fetchGlobalEventCandidatesWindow(bounds.start, bounds.end) : Promise.resolve({ rows: [], totalCandidates: 0 }),
      ]).then(([published, candidates]) => {
        if (cancelled || request !== requestRef.current) return;
        candidatesRef.current = candidates.status === "fulfilled" ? candidates.value.rows : [];
        const errors = [published, candidates].filter((result) => result.status === "rejected");
        const formalRows = published.status === "fulfilled" ? published.value : [];
        globalEventsViewStore.set({ ...globalEventsViewStore.getSnapshot(),
          status: errors.length === 2 ? "error" : errors.length ? "partial" : "ready",
          message: errors.length ? `${published.status === "rejected" ? "研究事件" : "AI 初判"}資料載入失敗，並非零件。`
            : new Set(formalRows.map((row) => row.eventId)).size >= 100 ? "研究事件已達單次100件上限；AI初判仍完整分頁載入。" : null,
        });
        acceptRows(formalRows, `${bounds.start}/${bounds.end}`, transitionFromTime);
      });
    };

    const loadCurrent = () => loadSituation(recentGlobalEventWindow(), true);

    const loadWindow = (dateKeys: readonly string[]) => {
      const bounds = view === "recent7d" ? recentGlobalEventWindow() : globalEventWindowBounds(dateKeys);
      // 跨日 scrub 會換 RPC window。保留換窗前的 cursor，等新 rows 回來後仍可
      // 判斷是否向前跨過 display_from；不可在 fetch 完成時重設成新 cursor。
      const transitionFromTime = previousTimeRef.current ?? timeStore.getTime();
      if (!bounds) return;
      loadSituation(bounds, false, transitionFromTime);
    };

    const onStyleLoad = () => {
      ensureLayers(map);
      setLayerVisibility(map, true);
      feed(displayedRowsRef.current);
      applyPaint(map);
    };
    map.on("style.load", onStyleLoad);
    const onMove = () => feed(displayedRowsRef.current);
    const onClick = (event: MapMouseEvent) => {
      if (!map.getLayer(GLOBAL_EVENTS_CLUSTER_LAYER_ID)) return;
      const hit = map.queryRenderedFeatures(event.point, { layers: [GLOBAL_EVENTS_CLUSTER_LAYER_ID] })[0];
      if (!hit?.properties?.group_key) return;
      expandedGroupsRef.current.add(String(hit.properties.group_key));
      feed(displayedRowsRef.current);
    };
    map.on("moveend", onMove);
    map.on("click", onClick);
    globalEventsViewStore.setSelectHandler((entry) => {
      const point = displayedRowsRef.current.find((row) => row.eventId === entry.eventId);
      if (!point) return;
      expandedGroupsRef.current.add(point.coordinates.map((value) => value.toFixed(6)).join(","));
      map.easeTo({ center: point.coordinates, duration: prefersReducedMotion() ? 0 : 500 });
      feed(displayedRowsRef.current);
    });

    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    if (view === "recent7d") {
      loadWindow([]);
      refreshTimer = setInterval(() => loadWindow([]), 5 * 60_000);
    } else if (timeMode === "live") {
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
      map.off("moveend", onMove);
      map.off("click", onClick);
      clearInterval(refreshTimer);
      globalEventsViewStore.setSelectHandler(null);
      stopPulse(map);
      setLayerVisibility(map, false);
    };
  }, [mapRef, mapTick, startPulse, stopPulse, timeMode, view, visible, applyPaint, includeAI]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (visible) applyPaint(map);
  }, [mapRef, mapTick, opacity, visible, showRelations, selectedEventId, view, timeMode, applyPaint]);
}
