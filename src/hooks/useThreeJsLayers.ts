import { useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Flight, Ship, RailTrain, RenderMode, RailData, LayerVisibility } from "../types";
import type { FlightScene } from "../three/FlightScene";
import type { ShipScene } from "../three/ShipScene";
import type { RailScene } from "../three/RailScene";
import type { StationPillarData } from "../three/StationPillarScene";
import { createFlightLayer, createShipLayer, createRailLayer } from "../map/customLayer";
import { createLighthouseLayer } from "../map/lighthouseCustomLayer";
import { createStationPillarLayer } from "../map/stationPillarCustomLayer";

interface UseThreeJsLayersArgs {
  timeRef: React.RefObject<number>;
  flightsRef: React.RefObject<Flight[]>;
  renderModeRef: React.RefObject<RenderMode>;
  isDarkThemeRef: React.RefObject<boolean>;
  showTrailsRef: React.RefObject<boolean>;
  shipsRef: React.RefObject<Ship[]>;
  activeTrainsRef: React.RefObject<RailTrain[]>;
  railDataRef: React.RefObject<RailData | null>;
  lighthousePositionsRef: React.RefObject<[number, number][]>;
  stationPillarDataRef: React.RefObject<StationPillarData[]>;
  playingRef: React.RefObject<boolean>;
  layerVisibilityRef: React.RefObject<LayerVisibility>;
  paramRefs: {
    altExag: React.RefObject<number>;
    altOffset: React.RefObject<number>;
    staticOpacity: React.RefObject<number>;
    orbScale: React.RefObject<number>;
    shipOrbScale: React.RefObject<number>;
    shipTrailOpacity: React.RefObject<number>;
    railAltOffset: React.RefObject<number>;
    railOrbScale: React.RefObject<number>;
    railTrackOpacity: React.RefObject<number>;
    beamVisible: React.RefObject<boolean>;
    beamDistance: React.RefObject<number>;
    beamOpacity: React.RefObject<number>;
    pillarVisible: React.RefObject<boolean>;
    pillarHeight: React.RefObject<number>;
  };
}

export function useThreeJsLayers({
  timeRef, flightsRef, renderModeRef, isDarkThemeRef, showTrailsRef,
  shipsRef, activeTrainsRef, railDataRef,
  lighthousePositionsRef, stationPillarDataRef, playingRef, layerVisibilityRef,
  paramRefs,
}: UseThreeJsLayersArgs) {
  const flightSceneRef = useRef<FlightScene | null>(null);
  const shipSceneRef = useRef<ShipScene | null>(null);
  const railSceneRef = useRef<RailScene | null>(null);

  const addFlightLayer = (map: MapboxMap) => {
    if (map.getLayer("flight-3d")) map.removeLayer("flight-3d");
    const layer = createFlightLayer({
      getCurrentTime: () => timeRef.current,
      getFlights: () => flightsRef.current,
      getRenderMode: () => renderModeRef.current,
      getAltExaggeration: () => paramRefs.altExag.current,
      getAltOffset: () => paramRefs.altOffset.current,
      getStaticOpacity: () => paramRefs.staticOpacity.current,
      getOrbScale: () => paramRefs.orbScale.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getShowTrails: () => showTrailsRef.current,
      getIsVisible: () => layerVisibilityRef.current.flights,
      onSceneReady: (scene) => { flightSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addShipLayer = (map: MapboxMap) => {
    if (map.getLayer("ship-3d")) map.removeLayer("ship-3d");
    const layer = createShipLayer({
      getCurrentTime: () => timeRef.current,
      getShips: () => shipsRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => paramRefs.shipOrbScale.current,
      getTrailOpacity: () => paramRefs.shipTrailOpacity.current,
      getIsVisible: () => layerVisibilityRef.current.ships,
      getMapBounds: () => {
        const b = map.getBounds();
        if (!b) return null;
        return {
          minLng: b.getWest(),
          maxLng: b.getEast(),
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
        };
      },
      onSceneReady: (scene) => { shipSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addRailLayer = (map: MapboxMap) => {
    if (map.getLayer("rail-3d")) map.removeLayer("rail-3d");
    const layer = createRailLayer({
      getTrains: () => activeTrainsRef.current,
      getCurrentTime: () => timeRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => paramRefs.railOrbScale.current,
      getTrackOpacity: () => paramRefs.railTrackOpacity.current,
      getRailAltOffset: () => paramRefs.railAltOffset.current,
      getTrackFeatures: () => railDataRef.current?.allTracks ?? null,
      getIsVisible: () => layerVisibilityRef.current.rail,
      onSceneReady: (scene) => { railSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addLighthouseLayer = (map: MapboxMap) => {
    if (map.getLayer("lighthouse-3d")) map.removeLayer("lighthouse-3d");
    const layer = createLighthouseLayer({
      getPositions: () => lighthousePositionsRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getIsPlaying: () => playingRef.current,
      getIsVisible: () => layerVisibilityRef.current.lighthouses,
      getBeamVisible: () => paramRefs.beamVisible.current,
      getBeamDistance: () => paramRefs.beamDistance.current,
      getBeamOpacity: () => paramRefs.beamOpacity.current,
    });
    map.addLayer(layer);
  };

  const addStationPillarLayer = (map: MapboxMap) => {
    if (map.getLayer("station-pillar-3d")) map.removeLayer("station-pillar-3d");
    const layer = createStationPillarLayer({
      getPositions: () => stationPillarDataRef.current,
      getPillarVisible: () => paramRefs.pillarVisible.current,
      getPillarHeight: () => paramRefs.pillarHeight.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getIsVisible: () => layerVisibilityRef.current.stations,
    });
    map.addLayer(layer);
  };

  const addAllLayers = (map: MapboxMap) => {
    addFlightLayer(map);
    addShipLayer(map);
    addRailLayer(map);
    addLighthouseLayer(map);
    addStationPillarLayer(map);
  };

  return {
    flightSceneRef,
    shipSceneRef,
    railSceneRef,
    addFlightLayer,
    addShipLayer,
    addRailLayer,
    addLighthouseLayer,
    addStationPillarLayer,
    addAllLayers,
  };
}
