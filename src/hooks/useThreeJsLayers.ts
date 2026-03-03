import { useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Flight, Ship, RailTrain, RenderMode, RailData, LayerVisibility } from "../types";
import type { FlightScene } from "../three/FlightScene";
import type { ShipScene } from "../three/ShipScene";
import type { RailScene } from "../three/RailScene";
import type { StationPillarData } from "../three/StationPillarScene";
import { createFlightLayer, createShipLayer, createRailLayer } from "../map/customLayer";
import { createLighthouseLayer } from "../map/lighthouseCustomLayer";
import { createCombinedStationPillarLayer } from "../map/stationPillarCustomLayer";
import { createTemperatureWaveLayer } from "../map/temperatureWaveCustomLayer";
import type { TemperatureGridData } from "../data/temperatureLoader";

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
  thsrPillarDataRef: React.RefObject<StationPillarData[]>;
  traPillarDataRef: React.RefObject<StationPillarData[]>;
  metroPillarDataRef: React.RefObject<StationPillarData[]>;
  airportPillarDataRef: React.RefObject<StationPillarData[]>;
  portPillarDataRef: React.RefObject<StationPillarData[]>;
  temperatureDataRef: React.RefObject<TemperatureGridData | null>;
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
    railTrainVisible: React.RefObject<boolean>;
    railTrackMode: React.RefObject<string>;
    beamVisible: React.RefObject<boolean>;
    beamDistance: React.RefObject<number>;
    beamOpacity: React.RefObject<number>;
    thsrPillarVisible: React.RefObject<boolean>;
    thsrPillarHeight: React.RefObject<number>;
    traPillarVisible: React.RefObject<boolean>;
    traPillarHeight: React.RefObject<number>;
    metroPillarVisible: React.RefObject<boolean>;
    metroPillarHeight: React.RefObject<number>;
    airportPillarVisible: React.RefObject<boolean>;
    airportPillarHeight: React.RefObject<number>;
    portPillarVisible: React.RefObject<boolean>;
    portPillarHeight: React.RefObject<number>;
    tempHeight: React.RefObject<number>;
    tempZOffset: React.RefObject<number>;
    tempExtruded: React.RefObject<boolean>;
    tempOpacity: React.RefObject<number>;
    tempWireframe: React.RefObject<boolean>;
  };
}

export function useThreeJsLayers({
  timeRef, flightsRef, renderModeRef, isDarkThemeRef, showTrailsRef,
  shipsRef, activeTrainsRef, railDataRef,
  lighthousePositionsRef, thsrPillarDataRef, traPillarDataRef, metroPillarDataRef,
  airportPillarDataRef, portPillarDataRef, temperatureDataRef,
  playingRef, layerVisibilityRef,
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
      getTrainVisible: () => paramRefs.railTrainVisible.current,
      getTrackMode: () => paramRefs.railTrackMode.current,
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

  const addTemperatureWaveLayer = (map: MapboxMap) => {
    const id = "temperature-wave-3d";
    if (map.getLayer(id)) map.removeLayer(id);
    const layer = createTemperatureWaveLayer({
      getData: () => temperatureDataRef.current,
      getIsVisible: () => layerVisibilityRef.current.temperatureWave,
      getHeightScale: () => paramRefs.tempHeight.current,
      getZOffset: () => paramRefs.tempZOffset.current,
      getExtruded: () => paramRefs.tempExtruded.current,
      getOpacity: () => paramRefs.tempOpacity.current,
      getCurrentTime: () => timeRef.current,
      getWireframe: () => paramRefs.tempWireframe.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
    });
    map.addLayer(layer);
  };

  const addStationPillarLayer = (map: MapboxMap) => {
    const id = "station-pillar-3d";
    if (map.getLayer(id)) map.removeLayer(id);
    const layer = createCombinedStationPillarLayer({
      getIsDarkTheme: () => isDarkThemeRef.current,
      groups: {
        thsr: {
          pillarColor: { dark: 0xff8c00, light: 0xcc7000 },
          getPositions: () => thsrPillarDataRef.current,
          getPillarVisible: () => paramRefs.thsrPillarVisible.current,
          getPillarHeight: () => paramRefs.thsrPillarHeight.current,
          getIsVisible: () => layerVisibilityRef.current.stationsTHSR,
        },
        tra: {
          pillarColor: { dark: 0xfff5e0, light: 0xb8a070 },
          getPositions: () => traPillarDataRef.current,
          getPillarVisible: () => paramRefs.traPillarVisible.current,
          getPillarHeight: () => paramRefs.traPillarHeight.current,
          getIsVisible: () => layerVisibilityRef.current.stationsTRA,
        },
        metro: {
          pillarColor: { dark: 0xfffde7, light: 0xc8b060 }, // near-white yellow
          getPositions: () => metroPillarDataRef.current,
          getPillarVisible: () => paramRefs.metroPillarVisible.current,
          getPillarHeight: () => paramRefs.metroPillarHeight.current,
          getIsVisible: () => layerVisibilityRef.current.stationsMetro,
        },
        airport: {
          pillarColor: { dark: 0xffd54f, light: 0xc8a030 }, // yellow
          getPositions: () => airportPillarDataRef.current,
          getPillarVisible: () => paramRefs.airportPillarVisible.current,
          getPillarHeight: () => paramRefs.airportPillarHeight.current,
          getIsVisible: () => layerVisibilityRef.current.airports,
        },
        port: {
          pillarColor: { dark: 0x64b5f6, light: 0x2979b0 }, // blue
          getPositions: () => portPillarDataRef.current,
          getPillarVisible: () => paramRefs.portPillarVisible.current,
          getPillarHeight: () => paramRefs.portPillarHeight.current,
          getIsVisible: () => layerVisibilityRef.current.ports,
        },
      },
    });
    map.addLayer(layer);
  };

  const addAllLayers = (map: MapboxMap) => {
    addFlightLayer(map);
    addShipLayer(map);
    addRailLayer(map);
    addLighthouseLayer(map);
    addStationPillarLayer(map);
    addTemperatureWaveLayer(map);
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
    addTemperatureWaveLayer,
    addAllLayers,
  };
}
