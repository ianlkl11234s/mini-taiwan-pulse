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

function ensureSources(map: MapboxMap): void {
  if (!map.getSource(AIS_SOURCE)) map.addSource(AIS_SOURCE, { type: "geojson", data: EMPTY_FC, attribution: "AISStream" });
  if (!map.getSource(GFW_SOURCE)) map.addSource(GFW_SOURCE, { type: "geojson", data: EMPTY_FC, attribution: "Global Fishing Watch" });
  if (!map.getLayer(AIS_LAYER)) {
    map.addLayer({
      id: AIS_LAYER,
      type: "circle",
      source: AIS_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 5, 3.5, 10, 6, 14, 9],
        "circle-color": "#22d3ee",
        "circle-opacity": 0.9,
        "circle-stroke-color": "#083344",
        "circle-stroke-width": 0.7,
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 5, 3.5, 10, 6, 14, 9],
        "circle-color": "#f59e0b",
        "circle-opacity": 0.75,
        "circle-stroke-color": "#451a03",
        "circle-stroke-width": 0.7,
      },
      layout: { visibility: "none" },
    } as CircleLayer);
  }
}

export function useGlobalMaritimeLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  aisVisible: boolean,
  gfwVisible: boolean,
  aisOpacity = 0.9,
  gfwOpacity = 0.75,
): void {
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
    const applyStyle = () => {
      if (!map.isStyleLoaded()) return;
      ensureSources(map);
      if (map.getLayer(AIS_LAYER)) {
        map.setLayoutProperty(AIS_LAYER, "visibility", aisVisible ? "visible" : "none");
        map.setPaintProperty(AIS_LAYER, "circle-opacity", Math.max(0, Math.min(1, aisOpacity)));
      }
      if (map.getLayer(GFW_LAYER)) {
        map.setLayoutProperty(GFW_LAYER, "visibility", gfwVisible ? "visible" : "none");
        map.setPaintProperty(GFW_LAYER, "circle-opacity", Math.max(0, Math.min(1, gfwOpacity)));
      }
      if (aisVisible || gfwVisible) void update();
    };
    map.on("style.load", applyStyle);
    applyStyle();
    const onMoveEnd = () => { if (aisVisible || gfwVisible) void update(); };
    map.on("moveend", onMoveEnd);
    const interval = window.setInterval(() => { if (aisVisible || gfwVisible) void update(); }, aisVisible ? 60_000 : 6 * 60 * 60_000);
    return () => {
      map.off("style.load", applyStyle);
      map.off("moveend", onMoveEnd);
      window.clearInterval(interval);
    };
  }, [aisVisible, gfwVisible, aisOpacity, gfwOpacity, mapRef, mapTick, update]);
}
