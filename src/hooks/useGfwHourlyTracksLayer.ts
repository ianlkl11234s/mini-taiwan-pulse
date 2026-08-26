import { useEffect, useRef } from "react";
import type { CircleLayer, ExpressionSpecification, GeoJSONSource, LineLayer, Map as MapboxMap, SymbolLayer } from "mapbox-gl";
import {
  gfwHourlyTracksFrame,
  gfwHourlyTrackFrameTrail,
  gfwHourlyTracksUtcDate,
  loadGfwHourlyTracksFrame,
  loadGfwHourlyTrackManifest,
  loadGfwHourlyTracksDay,
  type GfwHourlyTrackCollection,
  type GfwHourlyTrackManifest,
} from "../data/gfwHourlyTracksLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  SHIP_TYPE_COLORS_DARK,
  SHIP_TYPE_COLORS_LIGHT,
  type ShipTypeBucket,
} from "../data/shipTrails";
import { showTransientNotice } from "../components/TransientNotice";
import { setGfwHourlyTracksDetailContext } from "../data/gfwHourlyDetailLoader";

export const GFW_HOURLY_TRACKS_SOURCE_ID = "gfw-hourly-tracks-source";
export const GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID = "gfw-hourly-tracks-endpoint-source";
export const GFW_HOURLY_TRACKS_LINE_LAYER_ID = "gfw-hourly-tracks-line";
export const GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID = "gfw-hourly-tracks-endpoint";
export const GFW_HOURLY_TRACKS_ENDPOINT_COUNT_LAYER_ID = "gfw-hourly-tracks-endpoint-count";
export const GFW_HOURLY_TRACKS_CLICK_LAYERS = [
  GFW_HOURLY_TRACKS_ENDPOINT_COUNT_LAYER_ID,
  GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID,
  GFW_HOURLY_TRACKS_LINE_LAYER_ID,
] as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const BUCKETS: readonly ShipTypeBucket[] = ["cargo", "tanker", "passenger", "fishing", "special"];

function colorExpression(isDarkTheme: boolean): ExpressionSpecification {
  const palette = isDarkTheme ? SHIP_TYPE_COLORS_DARK : SHIP_TYPE_COLORS_LIGHT;
  return [
    "match", ["get", "ship_type_bucket"],
    ...BUCKETS.flatMap((bucket) => [bucket, palette[bucket]]),
    palette.other,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDarkTheme: boolean): void {
  const colors = colorExpression(isDarkTheme);
  if (!map.getSource(GFW_HOURLY_TRACKS_SOURCE_ID)) {
    map.addSource(GFW_HOURLY_TRACKS_SOURCE_ID, {
      type: "geojson",
      data: EMPTY,
      attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>',
    });
  }
  if (!map.getSource(GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID)) {
    map.addSource(GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID, { type: "geojson", data: EMPTY });
  }
  // Line first, selected-hour endpoint second: current observation remains the visual focus.
  if (!map.getLayer(GFW_HOURLY_TRACKS_LINE_LAYER_ID)) {
    map.addLayer({
      id: GFW_HOURLY_TRACKS_LINE_LAYER_ID,
      type: "line",
      source: GFW_HOURLY_TRACKS_SOURCE_ID,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 7, 1.5, 11, 2.8],
        "line-opacity": 0.55,
      },
    } as LineLayer);
  }
  if (!map.getLayer(GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID)) {
    map.addLayer({
      id: GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID,
      type: "circle",
      source: GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID,
      paint: {
        "circle-radius": [
          // Mapbox requires zoom to be the direct input of the outermost step/interpolate.
          // Keep the vessel-count multiplier in each stop output; nesting zoom under `*`
          // makes Mapbox reject the entire endpoint layer at runtime.
          "interpolate", ["linear"], ["zoom"],
          4, ["*", 1.8, ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]]],
          8, ["*", 3.5, ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]]],
          12, ["*", 5.5, ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]]],
        ],
        "circle-color": colors,
        "circle-opacity": 0.9,
        "circle-stroke-color": "#134e4a",
        "circle-stroke-width": 0.9,
        "circle-stroke-opacity": 0.9,
      },
      layout: { visibility: "none" },
    } as CircleLayer);
  }
  if (!map.getLayer(GFW_HOURLY_TRACKS_ENDPOINT_COUNT_LAYER_ID)) {
    map.addLayer({
      id: GFW_HOURLY_TRACKS_ENDPOINT_COUNT_LAYER_ID,
      type: "symbol",
      source: GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID,
      layout: {
        visibility: "none",
        "text-field": ["case", [">", ["get", "vessel_count"], 1], ["to-string", ["get", "vessel_count"]], ""],
        "text-size": 10,
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": "#f0fdfa", "text-halo-color": "#134e4a", "text-halo-width": 0.8, "text-opacity": 0.9 },
    } as SymbolLayer);
  }
}

function setVisibility(map: MapboxMap, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  for (const id of [GFW_HOURLY_TRACKS_LINE_LAYER_ID, GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID, GFW_HOURLY_TRACKS_ENDPOINT_COUNT_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
  }
}

export function useGfwHourlyTracksLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.75,
  trailingHours = 0.5,
  isDarkTheme = true,
): void {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GfwHourlyTrackCollection | null>(null);
  const manifestRef = useRef<GfwHourlyTrackManifest | null>(null);
  const dataDateRef = useRef<string | null>(null);
  const pendingDateRef = useRef<string | null>(null);
  const frameKeyRef = useRef("");
  const requestRef = useRef(0);
  const linesRef = useRef<GeoJSON.FeatureCollection>(EMPTY);
  const endpointsRef = useRef<GeoJSON.FeatureCollection>(EMPTY);
  const wasVisibleRef = useRef(false);
  const activationRef = useRef(0);
  const noticeActivationRef = useRef(0);
  const pmtilesDateRef = useRef<string | null>(null);
  const framePromiseRef = useRef(new Map<string, Promise<Awaited<ReturnType<typeof loadGfwHourlyTracksFrame>>>>());

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
      // 每次重新開層都要 no-cache refresh root manifest，不沿用上次 latest date。
      manifestRef.current = null;
      setGfwHourlyTracksDetailContext(null);
      dataRef.current = null;
      dataDateRef.current = null;
      pendingDateRef.current = null;
      pmtilesDateRef.current = null;
      framePromiseRef.current.clear();
    }

    const showLatestNotice = (manifest: GfwHourlyTrackManifest) => {
      if (!visible || activation !== activationRef.current || noticeActivationRef.current === activation) return;
      noticeActivationRef.current = activation;
      showTransientNotice(`GFW 航跡資料最新完整日：${manifest.latestCompleteDate}（UTC，非即時）`);
    };

    const clearFrame = () => {
      frameKeyRef.current = "";
      linesRef.current = EMPTY;
      endpointsRef.current = EMPTY;
      (map.getSource(GFW_HOURLY_TRACKS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(EMPTY);
      (map.getSource(GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(EMPTY);
    };

    const ensureDay = async (displayDate: string | null) => {
      const manifest = manifestRef.current;
      if (!manifest) {
        dataRef.current = null;
        dataDateRef.current = null;
        pendingDateRef.current = null;
        clearFrame();
        return;
      }
      if (!displayDate) {
        requestRef.current += 1;
        dataRef.current = null;
        dataDateRef.current = null;
        pendingDateRef.current = null;
        clearFrame();
        return;
      }
      if (dataDateRef.current === displayDate && dataRef.current) return;
      if (pendingDateRef.current === displayDate) return;

      dataRef.current = null;
      dataDateRef.current = null;
      clearFrame();
      const requestId = ++requestRef.current;
      pendingDateRef.current = displayDate;
      if (!manifest.days.has(displayDate)) {
        return;
      }
      // v3 PMTiles are immutable archive/detail assets, not a visible timeline source:
      // drawing their all-day edges would expose future geometry. The visible trail comes
      // only from the selected-hour gzip frames below, clipped to the requested window.
      if (manifest.days.get(displayDate)?.format === "pmtiles") {
        pmtilesDateRef.current = displayDate;
        dataDateRef.current = displayDate;
        pendingDateRef.current = null;
        renderFrame(timeStore.getTime());
        return;
      }
      pmtilesDateRef.current = null;
      const data = await loadGfwHourlyTracksDay(manifest, displayDate);
      if (disposed || requestId !== requestRef.current || manifest !== manifestRef.current) return;
      pendingDateRef.current = null;
      dataRef.current = data;
      dataDateRef.current = data ? displayDate : null;
      frameKeyRef.current = "";
      renderFrame(timeStore.getTime());
    };

    const renderFrame = (timeSeconds: number) => {
      if (!visible || disposed) return;
      const displayDate = gfwHourlyTracksUtcDate(timeSeconds);
      if (displayDate && pmtilesDateRef.current === displayDate && manifestRef.current) {
        const manifest = manifestRef.current;
        const selectedEpoch = Math.floor(timeSeconds);
        const startEpoch = selectedEpoch - Math.round(Math.max(0.5, trailingHours) * 3_600);
        const startHour = Math.floor(startEpoch / 3_600) * 3_600;
        const endHour = Math.floor(selectedEpoch / 3_600) * 3_600;
        const key = `${manifest.releaseId}|${startHour}|${endHour}|${selectedEpoch}|${trailingHours}`;
        if (frameKeyRef.current === key) return;
        frameKeyRef.current = key;
        const hours: string[] = [];
        for (let epoch = startHour; epoch <= endHour; epoch += 3_600) {
          hours.push(new Date(epoch * 1_000).toISOString().replace(".000Z", "Z"));
        }
        const pendingFrames = hours.map((hour) => {
          let pending = framePromiseRef.current.get(hour);
          if (!pending) {
            pending = loadGfwHourlyTracksFrame(manifest, hour);
            framePromiseRef.current.set(hour, pending);
          }
          return pending;
        });
        void Promise.all(pendingFrames).then((loaded) => {
          if (disposed || manifest !== manifestRef.current || pmtilesDateRef.current !== displayDate || frameKeyRef.current !== key) return;
          const frames = new Map<number, NonNullable<(typeof loaded)[number]>>();
          loaded.forEach((nodes, index) => {
            if (nodes) frames.set(startHour + index * 3_600, nodes);
          });
          const frame = gfwHourlyTrackFrameTrail(frames, timeSeconds, trailingHours, manifest.fullFidelity, displayDate);
          // Endpoint grouping is frame identity-complete; stamp producer day for later sidecar lookup.
          frame.endpoints.features.forEach((feature) => { feature.properties = { ...feature.properties, display_date: displayDate }; });
          linesRef.current = frame.lines;
          endpointsRef.current = frame.endpoints;
          (map.getSource(GFW_HOURLY_TRACKS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(frame.lines);
          (map.getSource(GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(frame.endpoints);
          keepLoadingUntilMapIdle(map, "gfw-hourly-tracks:render", "GFW 小時近似航跡繪製", GFW_HOURLY_TRACKS_SOURCE_ID);
        });
        return;
      }
      if (!displayDate || dataDateRef.current !== displayDate || !dataRef.current) {
        void ensureDay(displayDate);
        return;
      }
      // timeStore 的時間可含小數秒；統一到 ms 只是防止同一 tick 重複繪製，
      // 不再以 UTC hour 當 key，因此同小時的每次時間軸 tick 都會更新內插船頭。
      const timeMs = Math.round(timeSeconds * 1000);
      const key = `${timeMs}|${trailingHours}`;
      if (frameKeyRef.current === key) return;
      frameKeyRef.current = key;
      const frame = gfwHourlyTracksFrame(dataRef.current, timeSeconds, trailingHours);
      linesRef.current = frame.lines;
      endpointsRef.current = frame.endpoints;
      (map.getSource(GFW_HOURLY_TRACKS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(frame.lines);
      (map.getSource(GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(frame.endpoints);
      keepLoadingUntilMapIdle(map, "gfw-hourly-tracks:render", "GFW 抽樣近似航跡繪製", GFW_HOURLY_TRACKS_SOURCE_ID);
    };

    const refreshManifest = async () => {
      manifestRefreshStarted = true;
      const requestId = ++requestRef.current;
      manifestRef.current = null;
      setGfwHourlyTracksDetailContext(null);
      dataRef.current = null;
      dataDateRef.current = null;
      pendingDateRef.current = null;
      pmtilesDateRef.current = null;
      framePromiseRef.current.clear();
      clearFrame();
      const manifest = await loadGfwHourlyTrackManifest();
      if (disposed || requestId !== requestRef.current) return;
      manifestRef.current = manifest;
      setGfwHourlyTracksDetailContext(manifest);
      if (manifest) showLatestNotice(manifest);
      await ensureDay(gfwHourlyTracksUtcDate(timeStore.getTime()));
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
        ensureLayers(map, isDarkTheme);
        setVisibility(map, true);
        (map.getSource(GFW_HOURLY_TRACKS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(linesRef.current);
        (map.getSource(GFW_HOURLY_TRACKS_ENDPOINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(endpointsRef.current);
        const clamped = Math.max(0, Math.min(1, opacity));
        map.setPaintProperty(GFW_HOURLY_TRACKS_LINE_LAYER_ID, "line-opacity", clamped * 0.45);
        map.setPaintProperty(GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID, "circle-opacity", clamped);
        map.setPaintProperty(GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID, "circle-stroke-opacity", clamped);
        map.setPaintProperty(GFW_HOURLY_TRACKS_ENDPOINT_COUNT_LAYER_ID, "text-opacity", clamped);
        const colors = colorExpression(isDarkTheme);
        map.setPaintProperty(GFW_HOURLY_TRACKS_LINE_LAYER_ID, "line-color", colors);
        map.setPaintProperty(GFW_HOURLY_TRACKS_ENDPOINT_LAYER_ID, "circle-color", colors);
        if (!manifestRef.current && !manifestRefreshStarted) void refreshManifest();
        else if (manifestRef.current) renderFrame(timeStore.getTime());
      } catch {
        scheduleRetry();
      }
    };

    applyStyle();
    map.on("style.load", applyStyle);
    const unsubscribe = timeStore.subscribeThrottled(100, renderFrame);
    return () => {
      disposed = true;
      requestRef.current += 1;
      pendingDateRef.current = null;
      unsubscribe();
      map.off("style.load", applyStyle);
      if (retryPending) map.off("idle", retry);
      setGfwHourlyTracksDetailContext(null);
    };
  }, [mapRef, visible, opacity, trailingHours, isDarkTheme, mapTick]);
}
