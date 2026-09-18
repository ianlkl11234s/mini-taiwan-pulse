import { useEffect, useRef, useState } from "react";
import type { CircleLayer, FillLayer, Map as MapboxMap } from "mapbox-gl";
import { fetchJpWaterGeoJsonAsset } from "../data/jpWaterLoader";
import { JP_WATER_RELEASED_LAYER_KEYS } from "../data/jpWaterTypes";
import { useMapReadyTick } from "./useMapReadyTick";

const ACTIVE_KEYS = JP_WATER_RELEASED_LAYER_KEYS;
type ActiveKey = typeof ACTIVE_KEYS[number];
const COLORS: Record<ActiveKey, string> = { jpWaterLakes: "#0ea5e9", jpWaterLocalFacilities: "#0284c7", jpWaterQualityStations: "#7c3aed", jpWaterLevelStations: "#0369a1" };
const layerId = (key: ActiveKey) => `jp-water-${key}`;
const sourceId = (key: ActiveKey) => `jp-water-${key}-source`;
const isPolygon = (key: ActiveKey) => key === "jpWaterLakes";
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function layer(key: ActiveKey, opacity: number): CircleLayer | FillLayer {
  if (isPolygon(key)) return { id: layerId(key), type: "fill", source: sourceId(key), layout: { visibility: "none" }, paint: { "fill-color": COLORS[key], "fill-opacity": clamp(opacity), "fill-outline-color": COLORS[key] } } as FillLayer;
  return { id: layerId(key), type: "circle", source: sourceId(key), layout: { visibility: "none" }, paint: { "circle-color": COLORS[key], "circle-opacity": clamp(opacity), "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 7], "circle-stroke-color": "rgba(15,23,42,.55)", "circle-stroke-width": 0.5 } } as CircleLayer;
}

/** Four released Japan-water GeoJSON layers. Other contract keys are intentionally absent. */
export function useJpWaterLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: Record<ActiveKey, boolean>, opacity: Record<ActiveKey, number>) {
  const visible = ACTIVE_KEYS.some((key) => visibility[key]);
  const mapTick = useMapReadyTick(mapRef, visible);
  const data = useRef<Partial<Record<ActiveKey, GeoJSON.FeatureCollection>>>({});
  const [dataTick, setDataTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    for (const key of ACTIVE_KEYS) if (visibility[key] && !data.current[key]) fetchJpWaterGeoJsonAsset(key).then((result) => {
      if (!cancelled) { data.current[key] = result; setDataTick((value) => value + 1); }
    }).catch((error) => console.warn(`[JpWater] ${key} load failed:`, error));
    return () => { cancelled = true; };
  }, [visibility.jpWaterLakes, visibility.jpWaterLocalFacilities, visibility.jpWaterQualityStations, visibility.jpWaterLevelStations]);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => ACTIVE_KEYS.forEach((key) => {
      const active = visibility[key]; const geojson = data.current[key];
      if (!active || !geojson) { if (map.getLayer(layerId(key))) map.setLayoutProperty(layerId(key), "visibility", "none"); return; }
      if (!map.getSource(sourceId(key))) map.addSource(sourceId(key), { type: "geojson", data: geojson });
      if (!map.getLayer(layerId(key))) map.addLayer(layer(key, opacity[key]));
      map.setLayoutProperty(layerId(key), "visibility", "visible");
      map.setPaintProperty(layerId(key), isPolygon(key) ? "fill-opacity" : "circle-opacity", clamp(opacity[key]));
    });
    mount(); map.on("style.load", mount); return () => { map.off("style.load", mount); };
  }, [mapRef, mapTick, dataTick, visibility, opacity]);
}
