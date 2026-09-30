import { useEffect, useRef } from "react";
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
// AR-22 P4：參數鏡像改吃模組級 ref（由 layerParamsStore 的訂閱者維護），
// 不再由 App 經 props 傳入 —— Three.js 的 RAF 迴圈本來就不需要 render 才拿得到新值。
import { layerParamRefs as paramRefs } from "../state/layerParamRefs";
import type {
  createWasteFacilityLayer,
  WasteFacility3DScenes,
  WasteFacility3DKey,
  WasteFacilityLayerParams,
} from "../map/wasteFacilityCustomLayer";
import type { TemperatureGridData } from "../data/temperatureLoader";
import type { FireStationScene } from "../three/FireStationScene";
import { withLoading } from "../lib/loadingRegistry";
import { loadH3 } from "../map/h3Runtime";
import { installLayerChunkPrewarm } from "../lib/prewarmLayerChunks";
import { layerParamsStore } from "../state/layerParamsStore";
import { layerVisibilityStore } from "../state/layerVisibilityStore";

// ── C1：three.js 相關 chunk 按需載入 ──
// 這 13 個 custom layer 不再於開站時掛上；第一次有 3D 圖層可見才 import + 加入。
// 開站時先放一個不畫任何東西的錨點圖層，佔住原本 addAllLayers 的位置，
// 延後加入的 3D 圖層都插在錨點之前 → 圖層順序與開站即加入時完全相同。
type ThreeLayerBundle = typeof import("../map/threeLayerBundle");
let threeBundle: ThreeLayerBundle | null = null;
let threeBundlePromise: Promise<ThreeLayerBundle> | null = null;

export function loadThreeLayerBundle(): Promise<ThreeLayerBundle> {
  if (threeBundle) return Promise.resolve(threeBundle);
  if (!threeBundlePromise) {
    threeBundlePromise = import("../map/threeLayerBundle").then(
      (mod) => { threeBundle = mod; return mod; },
      (err) => { threeBundlePromise = null; throw err; },
    );
  }
  return threeBundlePromise;
}

export const THREE_LAYERS_ANCHOR_ID = "three-layers-anchor";

/** 任一 3D custom layer 會畫東西（對應各 layer 的 getIsVisible）。 */
export function anyThreeLayerVisible(vis: LayerVisibility, fireStations3D: boolean): boolean {
  return vis.flights || vis.ships || vis.rail
    || vis.busLive || vis.busIntercityLive || vis.touristShuttleLive
    || vis.wasteTruck || vis.wasteSchedule || vis.wasteScheduleNote
    || vis.wfIncinerator || vis.wfLandfill || vis.wfLandfillCoastal || vis.wfTransfer || vis.wfMedical || vis.wfMonitoring
    || vis.lighthouses
    || vis.stationsTHSR || vis.stationsTRA || vis.stationsMetro || vis.airports || vis.ports
    || vis.temperatureWave
    || (vis.fireStations && fireStations3D);
}

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

  // ── Wake-up 通道 ──
  // CustomLayer 不再每幀無條件 triggerRepaint，輸入改變時要有人叫醒 Mapbox 重畫一次：
  //   - 時間：各時間驅動圖層在 onAdd 自行訂閱 timeStore（見 customLayer.ts subscribeTimeRepaint）
  //   - 參數：paramRefs 由 layerParamsStore 訂閱者寫入，不一定觸發 App render → 直接訂閱
  //   - 可見性：layerVisibilityStore 訂閱（關閉也要重畫一次，清掉上一幀的 3D 殘影）
  //   - 資料／主題／模式：App render 期間寫入 ref → 每次 render 後比對 identity，有變才重畫
  // Mapbox 會把同一幀內多次 triggerRepaint 合併，多叫一次只多畫一幀。
  const mapInstanceRef = useRef<MapboxMap | null>(null);
  const repaint = () => mapInstanceRef.current?.triggerRepaint();

  useEffect(() => {
    // 參數／可見性變動：重畫一次；若因此第一次有 3D 圖層可見 → 載入 three chunk 並加圖層
    const onParams = () => { repaint(); ensureThreeLayersIfNeeded(); };
    const onVis = () => { repaint(); ensureThreeLayersIfNeeded(); };
    const unsubParams = layerParamsStore.subscribe(onParams);
    const unsubVis = layerVisibilityStore.subscribe(onVis);
    // 第一次開任一圖層後，背景預載 3D／H3 基礎工具，之後開圖層只等資料
    const uninstallPrewarm = installLayerChunkPrewarm([loadThreeLayerBundle, loadH3]);
    return () => { unsubParams(); unsubVis(); uninstallPrewarm(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastInputsRef = useRef<unknown[]>([]);
  useEffect(() => {
    const inputs: unknown[] = [
      flightsRef.current, renderModeRef.current, isDarkThemeRef.current, showTrailsRef.current,
      shipsRef.current, activeTrainsRef.current, activeBusesRef.current,
      activeBusesIntercityRef.current, activeBusesTouristShuttleRef.current, wasteTrailsRef.current, wasteScheduleRoutesRef.current,
      wasteFacilityByTypeRef.current, railDataRef.current, lighthousePositionsRef.current,
      thsrPillarDataRef.current, traPillarDataRef.current, metroPillarDataRef.current,
      airportPillarDataRef.current, portPillarDataRef.current, temperatureDataRef.current,
      playingRef.current, layerVisibilityRef.current,
    ];
    const prev = lastInputsRef.current;
    const changed = inputs.length !== prev.length || inputs.some((v, i) => v !== prev[i]);
    if (changed) {
      lastInputsRef.current = inputs;
      repaint();
    }
  });

  const addFlightLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    mapInstanceRef.current = map;
    if (map.getLayer("flight-3d")) map.removeLayer("flight-3d");
    const layer = bundle.createFlightLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addShipLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("ship-3d")) map.removeLayer("ship-3d");
    const layer = bundle.createShipLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addRailLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("rail-3d")) map.removeLayer("rail-3d");
    const layer = bundle.createRailLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addLighthouseLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("lighthouse-3d")) map.removeLayer("lighthouse-3d");
    const layer = bundle.createLighthouseLayer({
      getPositions: () => lighthousePositionsRef.current,
      getIsDarkTheme: () => isDarkThemeRef.current,
      getIsPlaying: () => playingRef.current,
      getIsVisible: () => layerVisibilityRef.current.lighthouses,
      getBeamVisible: () => paramRefs.beamVisible.current,
      getBeamDistance: () => paramRefs.beamDistance.current,
      getBeamOpacity: () => paramRefs.beamOpacity.current,
    });
    map.addLayer(layer, beforeId);
  };

  const addBusLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("bus-3d")) map.removeLayer("bus-3d");
    const layer = bundle.createBusLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addBusIntercityLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("bus-intercity-3d")) map.removeLayer("bus-intercity-3d");
    const layer = bundle.createBusLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addTouristShuttleLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("tourist-shuttle-3d")) map.removeLayer("tourist-shuttle-3d");
    const layer = bundle.createBusLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addWasteTruckLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("waste-truck-3d")) map.removeLayer("waste-truck-3d");
    const layer = bundle.createWasteTruckLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addWasteScheduleLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("waste-schedule-3d")) map.removeLayer("waste-schedule-3d");
    const layer = bundle.createWasteScheduleLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addWasteFacilityLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    if (map.getLayer("waste-facility-3d")) map.removeLayer("waste-facility-3d");
    const FACILITY_KEYS: WasteFacility3DKey[] = [
      "wfIncinerator", "wfLandfill", "wfLandfillCoastal", "wfTransfer", "wfMedical", "wfMonitoring",
    ];
    const layer = bundle.createWasteFacilityLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addTemperatureWaveLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    const id = "temperature-wave-3d";
    if (map.getLayer(id)) map.removeLayer(id);
    const layer = bundle.createTemperatureWaveLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addStationPillarLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    const id = "station-pillar-3d";
    if (map.getLayer(id)) map.removeLayer(id);
    const layer = bundle.createCombinedStationPillarLayer({
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
    map.addLayer(layer, beforeId);
  };

  const addFireStationLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    const id = "fire-station-3d";
    if (map.getLayer(id)) map.removeLayer(id);
    const layer = bundle.createFireStationLayer({
      id,
      getIsVisible: () => layerVisibilityRef.current.fireStations && paramRefs.fireStations3D.current,
      getOpacity: () => paramRefs.fireStationsOpacity.current,
      getScale: () => paramRefs.fireStationsScale.current,
      onSceneReady: (scene) => { fireStationSceneRef.current = scene; },
    });
    map.addLayer(layer, beforeId);
  };

  /** 13 個 3D 圖層依固定順序插在錨點之前（bundle 未載入時各 add* 為 no-op）。 */
  const addThreeLayersBeforeAnchor = (map: MapboxMap) => {
    const before = THREE_LAYERS_ANCHOR_ID;
    addFlightLayer(map, before);
    addShipLayer(map, before);
    addRailLayer(map, before);
    addBusLayer(map, before);
    addBusIntercityLayer(map, before);
    addTouristShuttleLayer(map, before);
    addWasteTruckLayer(map, before);
    addWasteScheduleLayer(map, before);
    addWasteFacilityLayer(map, before);
    addLighthouseLayer(map, before);
    addStationPillarLayer(map, before);
    addTemperatureWaveLayer(map, before);
    addFireStationLayer(map, before);
  };

  /** 有 3D 圖層可見、錨點在、但 3D 圖層還沒加 → 載入 bundle（掛 loading UI）後加入。 */
  const ensureThreeLayersIfNeeded = () => {
    const map = mapInstanceRef.current;
    if (!map || !map.getLayer(THREE_LAYERS_ANCHOR_ID) || map.getLayer("flight-3d")) return;
    if (!anyThreeLayerVisible(layerVisibilityStore.getAll(), paramRefs.fireStations3D.current)) return;
    const pending = threeBundle ? Promise.resolve(threeBundle) : withLoading("three-layers", "3D 圖層工具", loadThreeLayerBundle());
    pending.then(
      () => {
        // 等待期間換了地圖／切底圖（錨點會在 style.load 後的 addAllLayers 重建，屆時 bundle 已在，直接加）
        if (mapInstanceRef.current !== map || !map.getLayer(THREE_LAYERS_ANCHOR_ID) || map.getLayer("flight-3d")) return;
        addThreeLayersBeforeAnchor(map);
        repaint();
      },
      (err) => console.error("[useThreeJsLayers] failed to load 3D layer bundle", err),
    );
  };

  /**
   * 地圖就緒／切底圖後呼叫（名稱沿用）：放錨點；bundle 已載入 → 立刻同步加入全部 3D 圖層（與改前相同），
   * 否則等到第一次有 3D 圖層可見才載入。
   */
  const addAllLayers = (map: MapboxMap) => {
    mapInstanceRef.current = map;
    if (!map.getLayer(THREE_LAYERS_ANCHOR_ID)) {
      // 佔位層：空 render 的 custom layer（不用 background，避免被 Pure Black 等底圖 paint 覆寫掃到）
      map.addLayer({ id: THREE_LAYERS_ANCHOR_ID, type: "custom", renderingMode: "2d", render: () => {} });
    }
    if (threeBundle) addThreeLayersBeforeAnchor(map);
    else ensureThreeLayersIfNeeded();
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
