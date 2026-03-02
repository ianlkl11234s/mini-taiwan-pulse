import { useRef, useState } from "react";
import type { LayerVisibility } from "../types";

export function useLayerVisibility() {
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    flights: true,
    ships: true,
    rail: true,
    stationsTHSR: true,
    stationsTRA: true,
    stationsMetro: true,
    ports: true,
    lighthouses: true,
    airports: true,
    highways: false,
    provincialRoads: false,
    windPlan: false,
    busStationsCity: false,
    busStationsIntercity: false,
    bikeStations: false,
    cyclingRoutes: false,
    freewayCongestion: false,
    weatherStations: false,
    h3Population: false,
  });
  const layerVisibilityRef = useRef(layerVisibility);
  layerVisibilityRef.current = layerVisibility;

  const toggleVisibility = (layer: keyof LayerVisibility) => {
    setLayerVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return { layerVisibility, layerVisibilityRef, setLayerVisibility, toggleVisibility };
}
