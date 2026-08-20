import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchAnimalWelfarePoints, type AnimalWelfarePointRow } from "../data/animalWelfarePointsLoader";
import { ANIMAL_WELFARE_POINT_COLOR_EXPR, animalWelfarePointTypeFilter } from "../data/animalWelfarePointsTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "animal-welfare-points";
const GLOW_ID = "animal-welfare-points-glow";
const CIRCLE_ID = "animal-welfare-points-circle";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function animalWelfarePointRadius(scale: number): unknown[] {
  // Mapbox only permits ["zoom"] as the input of a top-level interpolate/step.
  // Scale the stops themselves instead of wrapping the expression in multiplication.
  return ["interpolate", ["linear"], ["zoom"], 6, 3 * scale, 12, 6 * scale, 16, 8 * scale];
}

function ensureLayers(map: MapboxMap, opacity: number, scale: number, pointTypeIndex: number) {
  if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
  if (!map.getLayer(GLOW_ID)) map.addLayer({
    id: GLOW_ID, type: "circle", source: SOURCE_ID, filter: animalWelfarePointTypeFilter(pointTypeIndex) as never,
    paint: { "circle-radius": animalWelfarePointRadius(scale * 1.75) as never, "circle-color": ANIMAL_WELFARE_POINT_COLOR_EXPR as never, "circle-opacity": opacity * 0.22, "circle-blur": 0.72 },
  });
  if (!map.getLayer(CIRCLE_ID)) map.addLayer({
    id: CIRCLE_ID, type: "circle", source: SOURCE_ID, filter: animalWelfarePointTypeFilter(pointTypeIndex) as never,
    paint: {
      "circle-radius": animalWelfarePointRadius(scale) as never, "circle-color": ANIMAL_WELFARE_POINT_COLOR_EXPR as never, "circle-opacity": opacity,
      "circle-stroke-color": "rgba(255,255,255,0.9)",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 11, 0.5, 15, 0.9],
    },
  });
}

function updatePaint(map: MapboxMap, opacity: number, scale: number, pointTypeIndex: number) {
  for (const id of [GLOW_ID, CIRCLE_ID]) {
    if (map.getLayer(id)) map.setFilter(id, animalWelfarePointTypeFilter(pointTypeIndex) as never);
  }
  if (map.getLayer(GLOW_ID)) {
    map.setPaintProperty(GLOW_ID, "circle-opacity", opacity * 0.22);
    map.setPaintProperty(GLOW_ID, "circle-radius", animalWelfarePointRadius(scale * 1.75) as never);
  }
  if (map.getLayer(CIRCLE_ID)) {
    map.setPaintProperty(CIRCLE_ID, "circle-opacity", opacity);
    map.setPaintProperty(CIRCLE_ID, "circle-radius", animalWelfarePointRadius(scale) as never);
  }
}

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [GLOW_ID, CIRCLE_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/**
 * Mapbox's queried GeoJSON feature properties are reliably scalar only. Preserve every canonical
 * RPC field while JSON-encoding nested values, so popup queries never depend on implementation-
 * specific object/array coercion.
 */
export function animalWelfarePointMapboxProperties(row: AnimalWelfarePointRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    value != null && typeof value === "object" ? JSON.stringify(value) : value,
  ]));
}

function setData(map: MapboxMap, rows: AnimalWelfarePointRow[]) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: animalWelfarePointMapboxProperties(row),
    })),
  });
}

/** ~7k point POI layer: deliberately no clustering so type color and click selection remain exact. */
export function useAnimalWelfarePointsLayer(
  mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity = 0.85, scale = 1, pointTypeIndex = 0,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const loaded = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    const run = async () => {
      ensureLayers(map, opacity, scale, pointTypeIndex);
      if (!visible) { setVisible(map, false); return; }
      if (!loaded.current) {
        const rows = await fetchAnimalWelfarePoints();
        if (cancelled) return;
        setData(map, rows);
        loaded.current = true;
        keepLoadingUntilMapIdle(map, "animal-welfare-points-render", "動物福利服務點圖層渲染中", SOURCE_ID);
      }
      updatePaint(map, opacity, scale, pointTypeIndex);
      setVisible(map, true);
    };
    run().catch((error) => console.warn("[AnimalWelfarePoints] service points unavailable", error));
    return () => { cancelled = true; };
  }, [mapRef, visible, opacity, scale, pointTypeIndex, mapTick]);
}
