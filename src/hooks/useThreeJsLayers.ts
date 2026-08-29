import { useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Flight, Ship, RailTrain, BusVehicle, RenderMode, RailData, LayerVisibility } from "../types";
import type { FlightScene } from "../three/FlightScene";
import type { ShipScene } from "../three/ShipScene";
import type { RailScene } from "../three/RailScene";
import type { BusScene } from "../three/BusScene";
import type { WasteTruckScene } from "../three/WasteTruckScene";
import type { WasteMusicNoteScene } from "../three/WasteMusicNoteScene";
import type { WasteScheduleScene } from "../three/WasteScheduleScene";
import type { WasteTrailRow, WasteFacilityRow } from "../data/wasteLoader";
import type { WasteScheduleRoute } from "../data/wasteScheduleLoader";
import type { StationPillarData } from "../three/StationPillarScene";
import { createFlightLayer, createShipLayer, createRailLayer } from "../map/customLayer";
import { createBusLayer } from "../map/busCustomLayer";
import { createWasteTruckLayer } from "../map/wasteTruckCustomLayer";
import { createWasteScheduleLayer } from "../map/wasteScheduleCustomLayer";
// AR-22 P4：參數鏡像改吃模組級 ref（由 layerParamsStore 的訂閱者維護），
// 不再由 App 經 props 傳入 —— Three.js 的 RAF 迴圈本來就不需要 render 才拿得到新值。
import { layerParamRefs as paramRefs } from "../state/layerParamRefs";
import {
  createWasteFacilityLayer,
  type WasteFacility3DScenes,
  type WasteFacility3DKey,
  type WasteFacilityLayerParams,
} from "../map/wasteFacilityCustomLayer";
import { createLighthouseLayer } from "../map/lighthouseCustomLayer";
import { createCombinedStationPillarLayer } from "../map/stationPillarCustomLayer";
import { createTemperatureWaveLayer } from "../map/temperatureWaveCustomLayer";
import type { TemperatureGridData } from "../data/temperatureLoader";
import { createFireStationLayer } from "../map/fireStationCustomLayer";
import type { FireStationScene } from "../three/FireStationScene";

interface UseThreeJsLayersArgs {
  timeRef: React.RefObject<number>;
  flightsRef: React.RefObject<Flight[]>;
  renderModeRef: React.RefObject<RenderMode>;
  isDarkThemeRef: React.RefObject<boolean>;
  showTrailsRef: React.RefObject<boolean>;
  shipsRef: React.RefObject<Ship[]>;
  activeTrainsRef: React.RefObject<RailTrain[]>;
  activeBusesRef: React.RefObject<BusVehicle[]>;
  activeBusesIntercityRef: React.RefObject<BusVehicle[]>;
  activeBusesTouristShuttleRef: React.RefObject<BusVehicle[]>;
  wasteTrailsRef: React.RefObject<WasteTrailRow[]>;
  wasteScheduleRoutesRef: React.RefObject<WasteScheduleRoute[]>;
  wasteFacilityByTypeRef: React.RefObject<Map<string, WasteFacilityRow[]>>;
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
}

export function useThreeJsLayers({
  timeRef, flightsRef, renderModeRef, isDarkThemeRef, showTrailsRef,
  shipsRef, activeTrainsRef, activeBusesRef, activeBusesIntercityRef, activeBusesTouristShuttleRef, wasteTrailsRef,
  wasteScheduleRoutesRef,
  wasteFacilityByTypeRef, railDataRef,
  lighthousePositionsRef, thsrPillarDataRef, traPillarDataRef, metroPillarDataRef,
  airportPillarDataRef, portPillarDataRef, temperatureDataRef,
  playingRef, layerVisibilityRef,
}: UseThreeJsLayersArgs) {
  const flightSceneRef = useRef<FlightScene | null>(null);
  const shipSceneRef = useRef<ShipScene | null>(null);
  const railSceneRef = useRef<RailScene | null>(null);
  const busSceneRef = useRef<BusScene | null>(null);
  const busIntercitySceneRef = useRef<BusScene | null>(null);
  const touristShuttleSceneRef = useRef<BusScene | null>(null);
  const wasteTruckSceneRef = useRef<WasteTruckScene | null>(null);
  const wasteMusicNoteSceneRef = useRef<WasteMusicNoteScene | null>(null);
  const wasteScheduleSceneRef = useRef<WasteScheduleScene | null>(null);
  const wasteScheduleNoteSceneRef = useRef<WasteMusicNoteScene | null>(null);
  const wasteFacilityScenesRef = useRef<WasteFacility3DScenes | null>(null);
  const wasteFacilityLayerRef = useRef<ReturnType<typeof createWasteFacilityLayer> | null>(null);
  const fireStationSceneRef = useRef<FireStationScene | null>(null);

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

  const addBusLayer = (map: MapboxMap) => {
    if (map.getLayer("bus-3d")) map.removeLayer("bus-3d");
    const layer = createBusLayer({
      id: "bus-3d",
      getBuses: () => activeBusesRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => paramRefs.busOrbScale.current,
      getIsVisible: () => layerVisibilityRef.current.busLive,
      getColorMode: () => paramRefs.busColorMode.current as import("../types").BusColorMode,
      getAltOffset: () => paramRefs.busAltOffset.current,
      getOpacityMultiplier: () => paramRefs.busOpacity.current,
      onSceneReady: (scene) => { busSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addBusIntercityLayer = (map: MapboxMap) => {
    if (map.getLayer("bus-intercity-3d")) map.removeLayer("bus-intercity-3d");
    const layer = createBusLayer({
      id: "bus-intercity-3d",
      getBuses: () => activeBusesIntercityRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => paramRefs.busIntercityOrbScale.current,
      getIsVisible: () => layerVisibilityRef.current.busIntercityLive,
      getColorMode: () => paramRefs.busIntercityColorMode.current as import("../types").BusColorMode,
      getAltOffset: () => paramRefs.busIntercityAltOffset.current,
      getOpacityMultiplier: () => paramRefs.busIntercityOpacity.current,
      onSceneReady: (scene) => { busIntercitySceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addTouristShuttleLayer = (map: MapboxMap) => {
    if (map.getLayer("tourist-shuttle-3d")) map.removeLayer("tourist-shuttle-3d");
    const layer = createBusLayer({
      id: "tourist-shuttle-3d",
      getBuses: () => activeBusesTouristShuttleRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getOrbScale: () => paramRefs.touristShuttleOrbScale.current,
      getIsVisible: () => layerVisibilityRef.current.touristShuttleLive,
      getColorMode: () => paramRefs.touristShuttleColorMode.current as import("../types").BusColorMode,
      getAltOffset: () => paramRefs.touristShuttleAltOffset.current,
      getOpacity: () => paramRefs.touristShuttleOpacity.current,
      onSceneReady: (scene) => { touristShuttleSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addWasteTruckLayer = (map: MapboxMap) => {
    if (map.getLayer("waste-truck-3d")) map.removeLayer("waste-truck-3d");
    const layer = createWasteTruckLayer({
      id: "waste-truck-3d",
      getTrails: () => wasteTrailsRef.current ?? [],
      getCurrentTime: () => timeRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      // base 0.000020，可由 slider 0.3~4 倍乘
      getOrbScale: () => 0.000020 * (paramRefs.wasteOrbScale.current ?? 1),
      getIsVisible: () => layerVisibilityRef.current.wasteTruck,
      getAltOffset: () => 0,
      getOpacity: () => paramRefs.wasteTruckOpacity.current,
      getMusicNoteEnabled: () => layerVisibilityRef.current.wasteTruck,
      getMusicNoteSize: () => paramRefs.wasteNoteSize.current ?? 1,
      getMusicNoteZOffset: () => paramRefs.wasteNoteZOffset.current ?? 70,
      onSceneReady: (truckScene, noteScene) => {
        wasteTruckSceneRef.current = truckScene;
        wasteMusicNoteSceneRef.current = noteScene;
      },
    });
    map.addLayer(layer);
  };

  const addWasteScheduleLayer = (map: MapboxMap) => {
    if (map.getLayer("waste-schedule-3d")) map.removeLayer("waste-schedule-3d");
    const layer = createWasteScheduleLayer({
      id: "waste-schedule-3d",
      getRoutes: () => wasteScheduleRoutesRef.current ?? [],
      getCurrentTime: () => timeRef.current ?? Date.now() / 1000,
      getIsDarkTheme: () => isDarkThemeRef.current ?? true,
      // 共用 wasteOrbScale slider，跟 GPS 圖層一致大小
      getOrbScale: () => 0.000020 * (paramRefs.wasteOrbScale.current ?? 1),
      getIsVisible: () => layerVisibilityRef.current.wasteSchedule,
      getAltOffset: () => 0,
      getOpacity: () => paramRefs.wasteScheduleOpacity.current,
      // 音符獨立 toggle（跟主 schedule toggle 分離），共用 GPS 的音符 size / zOffset
      getMusicNoteEnabled: () => layerVisibilityRef.current.wasteScheduleNote,
      getMusicNoteSize: () => paramRefs.wasteNoteSize.current ?? 1,
      getMusicNoteZOffset: () => paramRefs.wasteNoteZOffset.current ?? 70,
      onSceneReady: (scene, noteScene) => {
        wasteScheduleSceneRef.current = scene;
        wasteScheduleNoteSceneRef.current = noteScene;
      },
    });
    map.addLayer(layer);
  };

  const addWasteFacilityLayer = (map: MapboxMap) => {
    if (map.getLayer("waste-facility-3d")) map.removeLayer("waste-facility-3d");
    const FACILITY_KEYS: WasteFacility3DKey[] = [
      "wfIncinerator", "wfLandfill", "wfLandfillCoastal", "wfTransfer", "wfMedical", "wfMonitoring",
    ];
    const layer = createWasteFacilityLayer({
      id: "waste-facility-3d",
      getFacilityByType: () => wasteFacilityByTypeRef.current ?? new Map(),
      getVisibility: () => {
        const vis = layerVisibilityRef.current;
        const out: Record<WasteFacility3DKey, boolean> = {
          wfIncinerator: false, wfLandfill: false, wfLandfillCoastal: false,
          wfTransfer: false, wfMedical: false, wfMonitoring: false,
        };
        for (const k of FACILITY_KEYS) out[k] = !!vis[k];
        return out;
      },
      getParams: () => {
        const wp = paramRefs.wasteSubParams.current ?? {};
        const out: Record<WasteFacility3DKey, WasteFacilityLayerParams> = {
          wfIncinerator: wp["wfIncinerator"] ?? { size: 1, opacity: 0.85, altitude: 0, ringSize: 1 },
          wfLandfill: wp["wfLandfill"] ?? { size: 1, opacity: 0.45, altitude: 0 },
          wfLandfillCoastal: wp["wfLandfillCoastal"] ?? { size: 1, opacity: 0.55, altitude: 0 },
          wfTransfer: wp["wfTransfer"] ?? { size: 1, opacity: 0.85, altitude: 0 },
          wfMedical: wp["wfMedical"] ?? { size: 1, opacity: 0.85, altitude: 0 },
          wfMonitoring: wp["wfMonitoring"] ?? { size: 1, opacity: 0.7, altitude: 0 },
        };
        return out;
      },
      onSceneReady: (scenes) => { wasteFacilityScenesRef.current = scenes; },
    });
    wasteFacilityLayerRef.current = layer;
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
          getOpacity: () => paramRefs.thsrOpacity.current,
          getIsVisible: () => layerVisibilityRef.current.stationsTHSR,
        },
        tra: {
          pillarColor: { dark: 0xfff5e0, light: 0xb8a070 },
          getPositions: () => traPillarDataRef.current,
          getPillarVisible: () => paramRefs.traPillarVisible.current,
          getPillarHeight: () => paramRefs.traPillarHeight.current,
          getOpacity: () => paramRefs.traOpacity.current,
          getIsVisible: () => layerVisibilityRef.current.stationsTRA,
        },
        metro: {
          pillarColor: { dark: 0xffffff, light: 0xe0e0e0 }, // 白色
          getPositions: () => metroPillarDataRef.current,
          getPillarVisible: () => paramRefs.metroPillarVisible.current,
          getPillarHeight: () => paramRefs.metroPillarHeight.current,
          getOpacity: () => paramRefs.metroOpacity.current,
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
          getOpacity: () => paramRefs.portOpacity.current,
          getIsVisible: () => layerVisibilityRef.current.ports,
        },
      },
    });
    map.addLayer(layer);
  };

  const addFireStationLayer = (map: MapboxMap) => {
    const id = "fire-station-3d";
    if (map.getLayer(id)) map.removeLayer(id);
    const layer = createFireStationLayer({
      id,
      getIsVisible: () => layerVisibilityRef.current.fireStations && paramRefs.fireStations3D.current,
      getOpacity: () => paramRefs.fireStationsOpacity.current,
      getScale: () => paramRefs.fireStationsScale.current,
      onSceneReady: (scene) => { fireStationSceneRef.current = scene; },
    });
    map.addLayer(layer);
  };

  const addAllLayers = (map: MapboxMap) => {
    addFlightLayer(map);
    addShipLayer(map);
    addRailLayer(map);
    addBusLayer(map);
    addBusIntercityLayer(map);
    addTouristShuttleLayer(map);
    addWasteTruckLayer(map);
    addWasteScheduleLayer(map);
    addWasteFacilityLayer(map);
    addLighthouseLayer(map);
    addStationPillarLayer(map);
    addTemperatureWaveLayer(map);
    addFireStationLayer(map);
  };

  return {
    flightSceneRef,
    shipSceneRef,
    railSceneRef,
    busSceneRef,
    busIntercitySceneRef,   // W2：useMapInteraction 的公路客運 pick 分支要用
    touristShuttleSceneRef,
    wasteTruckSceneRef,
    wasteMusicNoteSceneRef,
    wasteScheduleSceneRef,
    wasteScheduleNoteSceneRef,
    wasteFacilityScenesRef,
    wasteFacilityLayerRef,
    addFlightLayer,
    addShipLayer,
    addRailLayer,
    addBusLayer,
    addBusIntercityLayer,
    addTouristShuttleLayer,
    addWasteTruckLayer,
    addWasteScheduleLayer,
    addWasteFacilityLayer,
    addLighthouseLayer,
    addStationPillarLayer,
    addTemperatureWaveLayer,
    addFireStationLayer,
    fireStationSceneRef,
    addAllLayers,
  };
}
