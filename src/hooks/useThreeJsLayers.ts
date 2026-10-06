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
import { subscribeThreeRepaint } from "../state/threeRepaintSignal";
import { createFlatMovingController } from "../map/flatMovingController";

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

/**
 * R6 段 1：非移動物件圖層的「立體效果」開關（參數名沿用既有，見 layerParamsSpec）。
 * 關閉時該層的 Three.js 不畫、不 repaint，也不會因它觸發 3D bundle 下載。
 * R6 段 3：移動物件（列車、垃圾車 GPS）也加入；它們預設開。列車另有軌道 2D／3D（railTrack3D），
 * 兩者都會讓 rail-3d 這個 Three 圖層有東西畫。
 */
export interface ThreeStereoToggles {
  fireStations3D: boolean;
  beamVisible: boolean;
  thsrPillarVisible: boolean;
  traPillarVisible: boolean;
  metroPillarVisible: boolean;
  airportPillarVisible: boolean;
  portPillarVisible: boolean;
  tempExtruded: boolean;
  wfMonitoring3D: boolean;
  railTrainVisible: boolean;
  railTrain3D: boolean;
  railTrack3D: boolean;
  wasteTruck3D: boolean;
}

/** 目前 paramRefs 的立體開關快照。 */
export function stereoTogglesFromRefs(): ThreeStereoToggles {
  return {
    fireStations3D: paramRefs.fireStations3D.current,
    beamVisible: paramRefs.beamVisible.current,
    thsrPillarVisible: paramRefs.thsrPillarVisible.current,
    traPillarVisible: paramRefs.traPillarVisible.current,
    metroPillarVisible: paramRefs.metroPillarVisible.current,
    airportPillarVisible: paramRefs.airportPillarVisible.current,
    portPillarVisible: paramRefs.portPillarVisible.current,
    tempExtruded: paramRefs.tempExtruded.current,
    wfMonitoring3D: paramRefs.wfMonitoring3D.current,
    railTrainVisible: paramRefs.railTrainVisible.current,
    railTrain3D: paramRefs.railTrain3D.current,
    railTrack3D: paramRefs.railTrackMode.current === "3d",
    wasteTruck3D: paramRefs.wasteTruck3D.current,
  };
}

/** rail-3d 有東西畫：3D 軌道，或列車顯示且立體效果開（R6 段 3）。 */
export const railThreeVisible = (railOn: boolean, t: Pick<ThreeStereoToggles, "railTrainVisible" | "railTrain3D" | "railTrack3D">) =>
  railOn && (t.railTrack3D || (t.railTrainVisible && t.railTrain3D));

/** 任一 3D custom layer 會畫東西（對應各 layer 的 getIsVisible）。 */
export function anyThreeLayerVisible(vis: LayerVisibility, t: ThreeStereoToggles): boolean {
  return vis.flights || vis.ships || railThreeVisible(vis.rail, t)
    || vis.busLive || vis.busIntercityLive || vis.touristShuttleLive
    || (vis.wasteTruck && t.wasteTruck3D) || vis.wasteSchedule || vis.wasteScheduleNote
    || vis.wfIncinerator || vis.wfLandfill || vis.wfLandfillCoastal || vis.wfTransfer || vis.wfMedical
    || (vis.wfMonitoring && t.wfMonitoring3D)
    || (vis.lighthouses && t.beamVisible)
    || (vis.stationsTHSR && t.thsrPillarVisible) || (vis.stationsTRA && t.traPillarVisible)
    || (vis.stationsMetro && t.metroPillarVisible) || (vis.airports && t.airportPillarVisible)
    || (vis.ports && t.portPillarVisible)
    || (vis.temperatureWave && t.tempExtruded)
    || (vis.fireStations && t.fireStations3D);
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
  //   - 資料／主題／模式：threeRepaintSignal（PF-9）—— App 以帶明確 deps 的 effect 發訊號，
  //     engine / 垃圾車 hook 在非時間 tick 換掉資料 ref 時發訊號；不再依賴「App 有 render」
  // Mapbox 會把同一幀內多次 triggerRepaint 合併，多叫一次只多畫一幀。
  const mapInstanceRef = useRef<MapboxMap | null>(null);
  const repaint = () => mapInstanceRef.current?.triggerRepaint();

  // R6 段 3：列車／垃圾車「立體效果」關時的 Mapbox 平面版（自帶 timeStore 節流訂閱，見 flatMovingController）
  const flatMovingRef = useRef<ReturnType<typeof createFlatMovingController> | null>(null);
  useEffect(() => {
    const ctrl = createFlatMovingController({
      getTrains: () => activeTrainsRef.current ?? [],
      getWasteTrails: () => wasteTrailsRef.current ?? [],
      getIsDark: () => isDarkThemeRef.current ?? true,
      // 直接讀 store（不是 App render 才更新的 ref）：store 通知當下就要看到新開關
      getVisibility: () => layerVisibilityStore.getAll(),
    });
    flatMovingRef.current = ctrl;
    if (mapInstanceRef.current) ctrl.attach(mapInstanceRef.current);
    return () => { ctrl.dispose(); flatMovingRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 參數／可見性變動：重畫一次；若因此第一次有 3D 圖層可見 → 載入 three chunk 並加圖層
    const onParams = () => { repaint(); ensureThreeLayersIfNeeded(); };
    const onVis = () => { repaint(); ensureThreeLayersIfNeeded(); };
    const unsubParams = layerParamsStore.subscribe(onParams);
    const unsubVis = layerVisibilityStore.subscribe(onVis);
    const unsubData = subscribeThreeRepaint(repaint);
    // 第一次開任一圖層後，背景預載 3D／H3 基礎工具，之後開圖層只等資料
    const uninstallPrewarm = installLayerChunkPrewarm([loadThreeLayerBundle, loadH3]);
    return () => { unsubParams(); unsubVis(); unsubData(); uninstallPrewarm(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFlightLayer = (map: MapboxMap, beforeId?: string) => {
    const bundle = threeBundle;
    if (!bundle) return;
    // 單獨重建（App 換機場／模式，未帶 beforeId）只在 3D 圖層組已加入時才做；
    // 否則 bundle 被預載但圖層組未加入時會單獨加出 flight-3d，讓 ensureThreeLayersIfNeeded 誤判已加入
    if (beforeId === undefined && !map.getLayer("flight-3d")) return;
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
      // R6 段 3：列車立體效果關 → Three 只剩 3D 軌道（railTrackMode=3d 時，行為不變）；兩者都沒有就不畫
      getIsVisible: () => railThreeVisible(layerVisibilityRef.current.rail, stereoTogglesFromRefs()),
      getTrainVisible: () => paramRefs.railTrainVisible.current && paramRefs.railTrain3D.current,
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
      // R6：燈塔 Three.js 只有光束 → 立體效果關時整層不畫（也停掉每幀 repaint）
      getIsVisible: () => layerVisibilityRef.current.lighthouses && paramRefs.beamVisible.current,
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
      // R6 段 3：立體效果關 → 光球與音符都不畫（平面版由 flatMovingController 負責，音符不顯示）
      getIsVisible: () => layerVisibilityRef.current.wasteTruck && paramRefs.wasteTruck3D.current,
      getAltOffset: () => 0,
      getOpacity: () => paramRefs.wasteTruckOpacity.current,
      getMusicNoteEnabled: () => layerVisibilityRef.current.wasteTruck && paramRefs.wasteTruck3D.current,
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
        // R6 段 1：監測井的 Three.js 只在「立體效果」開啟時畫（平面由 wasteMapboxLayers 負責）
        out.wfMonitoring = out.wfMonitoring && paramRefs.wfMonitoring3D.current;
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
      // R6 段 1：立體效果關 → 改由 TemperatureGridHost 畫 Mapbox 溫度網格，Three.js 不畫
      getIsVisible: () => layerVisibilityRef.current.temperatureWave && paramRefs.tempExtruded.current,
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
          getIsVisible: () => layerVisibilityRef.current.stationsTHSR && paramRefs.thsrPillarVisible.current,
        },
        tra: {
          pillarColor: { dark: 0xfff5e0, light: 0xb8a070 },
          getPositions: () => traPillarDataRef.current,
          getPillarVisible: () => paramRefs.traPillarVisible.current,
          getPillarHeight: () => paramRefs.traPillarHeight.current,
          getOpacity: () => paramRefs.traOpacity.current,
          getIsVisible: () => layerVisibilityRef.current.stationsTRA && paramRefs.traPillarVisible.current,
        },
        metro: {
          pillarColor: { dark: 0xffffff, light: 0xe0e0e0 }, // 白色
          getPositions: () => metroPillarDataRef.current,
          getPillarVisible: () => paramRefs.metroPillarVisible.current,
          getPillarHeight: () => paramRefs.metroPillarHeight.current,
          getOpacity: () => paramRefs.metroOpacity.current,
          getIsVisible: () => layerVisibilityRef.current.stationsMetro && paramRefs.metroPillarVisible.current,
        },
        airport: {
          pillarColor: { dark: 0xffd54f, light: 0xc8a030 }, // yellow
          getPositions: () => airportPillarDataRef.current,
          getPillarVisible: () => paramRefs.airportPillarVisible.current,
          getPillarHeight: () => paramRefs.airportPillarHeight.current,
          getIsVisible: () => layerVisibilityRef.current.airports && paramRefs.airportPillarVisible.current,
        },
        port: {
          pillarColor: { dark: 0x64b5f6, light: 0x2979b0 }, // blue
          getPositions: () => portPillarDataRef.current,
          getPillarVisible: () => paramRefs.portPillarVisible.current,
          getPillarHeight: () => paramRefs.portPillarHeight.current,
          getOpacity: () => paramRefs.portOpacity.current,
          getIsVisible: () => layerVisibilityRef.current.ports && paramRefs.portPillarVisible.current,
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

  const threeEnsurePendingRef = useRef(false);
  /** 有 3D 圖層可見、錨點在、但 3D 圖層還沒加 → 載入 bundle（掛 loading UI）後加入。 */
  const ensureThreeLayersIfNeeded = () => {
    const map = mapInstanceRef.current;
    if (!map || !map.getLayer(THREE_LAYERS_ANCHOR_ID) || map.getLayer("flight-3d")) return;
    if (!anyThreeLayerVisible(layerVisibilityStore.getAll(), stereoTogglesFromRefs())) return;
    if (threeEnsurePendingRef.current) return; // 載入中：參數／可見性連續變動不重複掛 loading
    threeEnsurePendingRef.current = true;
    const pending = threeBundle ? Promise.resolve(threeBundle) : withLoading("three-layers", "3D 圖層工具", loadThreeLayerBundle());
    pending.finally(() => { threeEnsurePendingRef.current = false; }).then(
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
    flatMovingRef.current?.attach(map);
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
