import { useCallback, useEffect, useRef, useState } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchGlobalEvents, globalEventsToGeoJSON } from "../data/globalEventsLoader";
import {
  GLOBAL_EVENT_CATEGORY_COLOR_EXPR,
  GLOBAL_EVENT_SEVERITY_RADIUS_EXPR,
} from "../data/globalEventsTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "global-events-current";
export const GLOBAL_EVENTS_LAYER_ID = "global-events-current-circle";

export function useGlobalEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity = 0.9,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null);
  const [dataTick, setDataTick] = useState(0);

  const ensureLayer = useCallback((map: MapboxMap) => {
    if (!dataRef.current) return false;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: dataRef.current });
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
    return true;
  }, []);

  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    fetchGlobalEvents()
      .then((events) => {
        if (cancelled) return;
        const collection = globalEventsToGeoJSON(events);
        dataRef.current = collection;
        const map = mapRef.current;
        if (map?.isStyleLoaded()) {
          const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          if (source) source.setData(collection);
          else ensureLayer(map);
          keepLoadingUntilMapIdle(map, "global-events:render", "全球重要事件 渲染中", SOURCE_ID);
        }
        setDataTick((tick) => tick + 1);
      })
      .catch((error) => console.warn("[GlobalEvents] load failed:", error));
    return () => { cancelled = true; };
  }, [ensureLayer, mapRef, mapTick, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ensureLayer(map)) return;
    map.setLayoutProperty(GLOBAL_EVENTS_LAYER_ID, "visibility", visible ? "visible" : "none");
    const safeOpacity = Math.max(0, Math.min(1, opacity));
    map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-opacity", safeOpacity);
    map.setPaintProperty(GLOBAL_EVENTS_LAYER_ID, "circle-stroke-opacity", safeOpacity * 0.9);
  }, [dataTick, ensureLayer, mapRef, mapTick, opacity, visible]);
}
