import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONT_DATA, RADIUS, FONT_SIZE } from "./styles/designTokens";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ViewMode, RenderMode, DisplayMode, Flight, ExpandableLayerKey, LayerVisibility, AppMode, FeatureInfo } from "./types";
import type { StationPillarData } from "./three/StationPillarScene";
import { MapView } from "./map/MapView";
import { useAirspaceData } from "./hooks/useAirspaceData";
import { useShipData } from "./hooks/useShipData";
import { useRailData } from "./hooks/useRailData";
import { useTimeline } from "./hooks/useTimeline";
import { timeStore } from "./state/timeStore";
import { useIsMobile } from "./hooks/useIsMobile";
import { useTransportParams } from "./hooks/useTransportParams";
import { useRailEngine } from "./hooks/useRailEngine";
import { useBusLayer } from "./hooks/useBusLayer";
import { useWasteLayer } from "./hooks/useWasteLayer";
import { useWasteScheduleLayer } from "./hooks/useWasteScheduleLayer";
import { TRIP_BREAK_S as WASTE_SCHEDULE_TRIP_BREAK_S } from "./three/WasteScheduleScene";
import { useWasteFacilityLayer } from "./hooks/useWasteFacilityLayer";
import { useWasteDisposalPointLayer } from "./hooks/useWasteDisposalPointLayer";
import {
  setupWasteMapboxLayers,
  syncWasteMapboxData,
  syncWasteMapboxVisibility,
  syncWasteMapboxParams,
  syncWasteMapboxTheme,
} from "./map/wasteMapboxLayers";
import { useBusIntercityLayer } from "./hooks/useBusIntercityLayer";
import { useTouristShuttleLayer } from "./hooks/useTouristShuttleLayer";
import { useLayerVisibility } from "./hooks/useLayerVisibility";
import { sessionTracker } from "./lib/sessionTracker";
import { useDataRegistry } from "./hooks/useDataRegistry";
import { useThreeJsLayers } from "./hooks/useThreeJsLayers";
import { useMapInteraction } from "./hooks/useMapInteraction";
import { useNewsTimeline } from "./hooks/useNewsTimeline";
import { useNewsEventsLayer } from "./hooks/useNewsEventsLayer";
import { useSelectedFeatureHalo } from "./hooks/useSelectedFeatureHalo";
import { useSatellitesLayer } from "./hooks/useSatellitesLayer";
import { useEarthquakeLayer } from "./hooks/useEarthquakeLayer";
import { useEarthquakesGlobalLayer } from "./hooks/useEarthquakesGlobalLayer";
import { useTyphoonTracksLayer, type TyphoonSource } from "./hooks/useTyphoonTracksLayer";
import { useClimateParticleLineLayer } from "./hooks/useClimateParticleLineLayer";
import { useDustForecastLayer } from "./hooks/useDustForecastLayer";
// 色帶集中在 climateRamps（module-level 常數，避免每次 render 新 object 觸發 hook re-mount）；
// LegendPanel 圖例吃同一份，改色階兩邊自動同步。
import { WIND_FIELD_RAMP, WIND_SPEED_MAX, OCEAN_CURRENTS_RAMP, OCEAN_SPEED_MAX } from "./map/climateRamps";
import { useFreewayLayer } from "./hooks/useFreewayLayer";
import { useRoadCongestionLayer } from "./hooks/useRoadCongestionLayer";
import { useReservoirContextLayer } from "./hooks/useReservoirContextLayer";
import { useReservoirStatusLayer } from "./hooks/useReservoirStatusLayer";
import type { ReservoirScene } from "./three/ReservoirScene";
import type { ReservoirStatus } from "./data/reservoirStatusLoader";
import { useRainGaugeLayer } from "./hooks/useRainGaugeLayer";
import { useRiverLevelLayer } from "./hooks/useRiverLevelLayer";
import { useFloodSensorLayer } from "./hooks/useFloodSensorLayer";
import { useFloodSensorIsochroneLayer } from "./hooks/useFloodSensorIsochroneLayer";
import { useTaipeiSewerLayer } from "./hooks/useTaipeiSewerLayer";
import { useTaipeiEvacuateLayer } from "./hooks/useTaipeiEvacuateLayer";
import { useTaipeiPumbLayer } from "./hooks/useTaipeiPumbLayer";
import { usePrecipRasterLayer } from "./hooks/usePrecipRasterLayer";
import { useGroundwaterLayer } from "./hooks/useGroundwaterLayer";
import { useGroundwaterWellsLayer } from "./hooks/useGroundwaterWellsLayer";
import { useIotWraRiverLayer } from "./hooks/useIotWraRiverLayer";
import { useIotWraStructureLayer } from "./hooks/useIotWraStructureLayer";
import { useFireEventsLayer } from "./hooks/useFireEventsLayer";
import { useFireLatestLayer } from "./hooks/useFireLatestLayer";
import { useWasteCleaningSquadLayer } from "./hooks/useWasteCleaningSquadLayer";
import { useDisasterAlertLayer } from "./hooks/useDisasterAlertLayer";
// Energy MVP
import { useEnergyPoiLayer } from "./hooks/useEnergyPoiLayer";
import { useFossilFuelLayers } from "./hooks/useFossilFuelLayers";
import { useA1AccidentRealtimeLayer } from "./hooks/useA1AccidentRealtimeLayer";
import { useOsmPowerLinesGlowLayer } from "./hooks/useOsmPowerLinesGlowLayer";
import { usePowerPolesLayer } from "./hooks/usePowerPolesLayer";
import { usePollutionLayers } from "./hooks/usePollutionLayers";
import { useAviationAirspaceLayer } from "./hooks/useAviationAirspaceLayer";
import { useDroneZonesLayer } from "./hooks/useDroneRestrictedZonesLayer";
import { useSubstationDiamondIcon } from "./hooks/useSubstationDiamondIcon";
import { usePowerDashboard } from "./hooks/usePowerDashboard";
import { usePowerRegionBarsLayer } from "./hooks/usePowerRegionBarsLayer";
import { usePowerGenerationBeamLayer } from "./hooks/usePowerGenerationBeamLayer";
import { usePowerPlantGlowLayer } from "./hooks/usePowerPlantGlowLayer";
import { useSubstationEhvGlowLayer } from "./hooks/useSubstationEhvGlowLayer";
import { usePowerLinesGlowTestLayer } from "./hooks/usePowerLinesGlowTestLayer";
import { useAviationRestrictedGlowLayer } from "./hooks/useAviationRestrictedGlowLayer";
import { useLightningLayer, useNuclearLayer } from "./hooks/useHazardLayer";
import { useErHospitalLayer } from "./hooks/useErHospitalLayer";
import { useParkingLayer } from "./hooks/useParkingLayer";
// PowerStatusHud 已暫離地圖（搬 monitor），import 待整合時加回
import { useRoadEventsLayer } from "./hooks/useRoadEventsLayer";
import { useCwaImageryLayer } from "./hooks/useCwaImageryLayer";
import { useStaticRasterLayer } from "./hooks/useStaticRasterLayer";

// 全臺 raster bbox（WGS84，繼承自 dtm_20m 上游 EPSG:3826 → 3857）
const TERRAIN_BBOX = {
  lonMin: 120.0166,
  lonMax: 122.0096,
  latMin: 21.8938,
  latMax: 25.3015,
} as const;
import { useAqiImageryLayer } from "./hooks/useAqiImageryLayer";
import { useAqiStationsLayer } from "./hooks/useAqiStationsLayer";
import { useMicroSensorsLayer } from "./hooks/useMicroSensorsLayer";
import { AqiProductSwitcher } from "./components/AqiProductSwitcher";
import { AqiLegend } from "./components/AqiLegend";
import type { AqiProduct } from "./types";
import { useH3Data } from "./hooks/useH3Data";
import { useTemperatureData } from "./hooks/useTemperatureData";
import { useDemographicsH3, useDemographicsYearlyH3 } from "./hooks/useDemographicsH3";
import { useH3Socioeconomic } from "./hooks/useH3Socioeconomic";
import { useH3SpatialEconomy } from "./hooks/useH3SpatialEconomy";
import { useYoubikeH3 } from "./hooks/useYoubikeH3";
import { updateH3Layer, getH3Resolution, ensureH3Layers } from "./map/h3LayerFactory";
import { ensureYoubikeLayers, updateYoubikeLayer } from "./map/youbikeLayerFactory";
import { ensurePopCountLayers, ensureIndicatorsLayers, updatePopCountLayer, updateIndicatorsLayer, ensureSocioLayers, updateSocioLayer, ensureSpatialLayers, updateSpatialLayer } from "./map/demographicsLayerFactory";
import { DEFAULT_CAMERA, getPresetById } from "./map/cameraPresets";
// filterByTimeWindow removed — airspace shows all flights, isFlightActive handles visibility
import { updateRailTracks, removeRailTracks, setRailTracksVisible } from "./map/railTracks";
import { LocationJump } from "./components/AirportSelector";
import { LayerSidebar } from "./components/LayerSidebar";
import { IconRailSidebar } from "./components/IconRailSidebar";
import { DataSourceBrowser } from "./components/DataSourceBrowser";
import { IntelPanel } from "./components/intel/IntelPanel";
import { MonitorPanel } from "./components/intel/monitor/MonitorPanel";
import { SatelliteConsole } from "./components/satelliteConsole/SatelliteConsole";
import { satelliteConsoleStore, useSatelliteConsole } from "./state/satelliteConsoleStore";
import { useSatelliteManeuvers } from "./hooks/useSatelliteManeuvers";
import { TimelineControls } from "./components/TimelineControls";
import { HistoricalTimeline, type HistoricalGranularity } from "./components/HistoricalTimeline";
import { useRealEstateTimeline } from "./hooks/useRealEstateTimeline";
import { useRealEstatePointsLayer } from "./hooks/useRealEstatePointsLayer";
import { RANGE_START, RANGE_END, DAY, reLabel, snapQuarterStart, tsToDate, type ReGran } from "./lib/realEstateTime";
import { ModeToggle } from "./components/ModeToggle";
import { StyleSelector, getStyleUrl } from "./components/StyleSelector";
import { MobileBottomSheet } from "./components/MobileBottomSheet";
import { InfoModal } from "./components/InfoModal";
import { UserAvatar } from "./components/auth/UserAvatar";
import { AdminPanel } from "./components/admin/AdminPanel";
import { useMemberGate, signInWithGoogle } from "./lib/auth";
import { GATED_LAYERS } from "./components/sidebar/layerCatalog";
import { useLayerGates, loadLayerGates, isLayerLocked } from "./lib/layerGates";
import { useLivestockLayers } from "./hooks/useLivestockLayers";
import { FeatureInfoPanel } from "./components/FeatureInfoPanel";
import { HEADER_LABELS } from "./components/featureInfo/registry";
import { ChatPanel } from "./components/chat/ChatPanel";
import { runChatTurn, testKey } from "./chat/agent";
import type { MapBridge } from "./chat/types";
import { MessageSquare } from "lucide-react";
import { LegendPanel } from "./components/LegendPanel";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { LoadingScreen } from "./components/LoadingScreen";

// setStyle 進行中時 getStyle() 會 throw "Style is not done loading"
// → 換底圖期間的 re-render 不能再裸呼 map.getStyle()
function styleReady(map: MapboxMap | null): map is MapboxMap {
  if (!map) return false;
  try {
    return !!map.getStyle();
  } catch {
    return false;
  }
}

export default function App() {
  // layer visibility 必須早於動態資料 hook 宣告：供 boot lazy gating（圖層關 → 不抓資料）
  const { layerVisibility, layerVisibilityRef, setLayerVisibility, toggleVisibility } = useLayerVisibility();

  // owner-only 私人圖層閘門（見 docs/features/owner-gated-layers）：
  // tier 載入完成前 isOwner=false（顯示鎖）。非 owner 點鎖層 → 未登入導 Google 登入 / 已登入顯示提示。
  const { user: memberUser, tier: memberTier, isOwner } = useMemberGate();
  const memberUserRef = useRef(memberUser);
  memberUserRef.current = memberUser;
  const [gatedNotice, setGatedNotice] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  useEffect(() => {
    if (!gatedNotice) return;
    const t = setTimeout(() => setGatedNotice(false), 2600);
    return () => clearTimeout(t);
  }, [gatedNotice]);

  // 動態 gating（Phase 2）：啟動拉一次公開 get_layer_gates()（fail-safe：失敗維持靜態 GATED_LAYERS）。
  useEffect(() => { void loadLayerGates(); }, []);
  const layerGates = useLayerGates();
  // 對「目前使用者」上鎖的 keys（tier + 動態清單解析）。owner → 空集合。
  const lockedKeys = useMemo(() => {
    const s = new Set<keyof LayerVisibility>();
    const candidates = new Set<keyof LayerVisibility>([
      ...GATED_LAYERS,
      ...((layerGates ? [...layerGates.keys()] : []) as (keyof LayerVisibility)[]),
    ]);
    for (const key of candidates) {
      if (isLayerLocked(key, memberTier, layerGates)) s.add(key);
    }
    return s;
  }, [memberTier, layerGates]);
  const lockedKeysRef = useRef(lockedKeys);
  lockedKeysRef.current = lockedKeys;

  const {
    flights: allFlights,
    timeRange,
    loading,
    dayLoading: flightsDayLoading,
    loadDay: loadFlightDay,
    prefetch: prefetchFlight,
  } = useAirspaceData(layerVisibility.flights);

  const { ships, timeRange: shipTimeRange, loading: shipsLoading, dayLoading: shipsDayLoading, loadDay: loadShipDay, prefetch: prefetchShip } = useShipData(layerVisibility.ships);

  // 地點選擇（用於攝影機定位，不影響資料過濾）
  const [selectedAirport, setSelectedAirport] = useState("");

  // ── Data Source Registry ──
  const dataRegistry = useDataRegistry();
  // 燈塔座標（lazy：toggle 開啟才抓）
  const [lighthousePositions, setLighthousePositions] = useState<[number, number][]>([]);
  const lighthouseFetchedRef = useRef(false);
  useEffect(() => {
    if (!layerVisibility.lighthouses || lighthouseFetchedRef.current) return;
    lighthouseFetchedRef.current = true;
    fetch("./geo/lighthouse.geojson")
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection<GeoJSON.Point>) => {
        const positions = geojson.features.map((f) => f.geometry.coordinates.slice(0, 2) as [number, number]);
        setLighthousePositions(positions);
      })
      .catch((err) => {
        lighthouseFetchedRef.current = false;
        console.warn("Lighthouse data not available:", err);
      });
  }, [layerVisibility.lighthouses]);

  // 車站光柱資料 — 三體系各自獨立
  const [thsrPillarData, setThsrPillarData] = useState<StationPillarData[]>([]);
  const [traPillarData, setTraPillarData] = useState<StationPillarData[]>([]);
  const [metroPillarData, setMetroPillarData] = useState<StationPillarData[]>([]);
  // 機場 / 碼頭光柱資料（從 polygon GeoJSON 算質心）
  const [airportPillarData, setAirportPillarData] = useState<StationPillarData[]>([]);
  const [portPillarData, setPortPillarData] = useState<StationPillarData[]>([]);

  // 資料載入後向 Registry 註冊時間資訊
  useEffect(() => {
    if (timeRange.start > 0) {
      dataRegistry.register({
        id: "flights",
        timeType: "track",
        timeRanges: [timeRange],
        supportsLive: false,
      });
    }
  }, [timeRange, dataRegistry.register]);

  useEffect(() => {
    if (shipTimeRange.start > 0) {
      dataRegistry.register({
        id: "ships",
        timeType: "track",
        timeRanges: [shipTimeRange],
        supportsLive: false,
      });
    }
  }, [shipTimeRange, dataRegistry.register]);

  // ── 鐵道：活躍日期驅動時刻表切換（Supabase daily_schedules） ──
  const [railActiveDate, setRailActiveDate] = useState<string | undefined>();
  const { railData, loading: railLoading, scheduleLoading: railScheduleLoading, } = useRailData(railActiveDate, layerVisibility.rail);

  useEffect(() => {
    if (railData) {
      dataRegistry.register({
        id: "rail",
        timeType: "cyclic",
        timeRanges: [{ start: -Infinity, end: Infinity }],
        supportsLive: true,
      });
    }
  }, [railData, dataRegistry.register]);

  const { temperatureData, temperatureLoading, temperatureTimeRange } = useTemperatureData(layerVisibility.temperatureWave);

  useEffect(() => {
    if (temperatureTimeRange.start > 0) {
      dataRegistry.register({
        id: "temperatureWave",
        timeType: "snapshot",
        timeRanges: [temperatureTimeRange],
        supportsLive: false,
        refreshInterval: 3600,
      });
    }
  }, [temperatureTimeRange, dataRegistry.register]);

  // 預計算光柱資料（靜態 JSON，不依賴 railData；lazy：任一車站 toggle 開才抓）
  const stationPillarFetchedRef = useRef(false);
  const needStationPillars = layerVisibility.stationsTHSR || layerVisibility.stationsTRA || layerVisibility.stationsMetro;
  useEffect(() => {
    if (!needStationPillars || stationPillarFetchedRef.current) return;
    stationPillarFetchedRef.current = true;
    fetch("./station_pillars.json")
      .then((r) => r.json())
      .then((data: Record<string, { lng: number; lat: number; height: number }[]>) => {
        const toArr = (entries: { lng: number; lat: number; height: number }[]): StationPillarData[] =>
          entries.map((e) => ({ position: [e.lng, e.lat], height: e.height }));
        setThsrPillarData(toArr(data.thsr ?? []));
        setTraPillarData(toArr(data.tra ?? []));
        setMetroPillarData(toArr(data.metro ?? []));
      })
      .catch((err) => {
        stationPillarFetchedRef.current = false;
        console.warn("Station pillar data:", err);
      });
  }, [needStationPillars]);

  // 機場光柱 — 從 airports.geojson 算質心，高度依起降量排序（lazy：airports toggle 開才抓）
  const airportPillarFetchedRef = useRef(false);
  useEffect(() => {
    if (!layerVisibility.airports || airportPillarFetchedRef.current) return;
    airportPillarFetchedRef.current = true;
    const AIRPORT_HEIGHTS: Record<string, number> = {
      RCTP: 1.0, RCSS: 0.85, RCKH: 0.7, RCMQ: 0.55,
      RCBS: 0.45, RCNN: 0.35, RCFN: 0.3, RCKU: 0.25,
      RCLY: 0.2, RCGI: 0.2, RCMT: 0.2, RCFG: 0.2,
    };
    fetch("./geo/airports.geojson")
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const data: StationPillarData[] = geojson.features.map((f) => {
          const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
          const ring = geom.type === "MultiPolygon"
            ? geom.coordinates[0]![0]!
            : geom.coordinates[0]!;
          const lng = ring.reduce((s, c) => s + c[0]!, 0) / ring.length;
          const lat = ring.reduce((s, c) => s + c[1]!, 0) / ring.length;
          const icao = (f.properties?.icao as string) ?? "";
          return { position: [lng, lat], height: AIRPORT_HEIGHTS[icao] ?? 0.2 };
        });
        setAirportPillarData(data);
      })
      .catch((err) => {
        airportPillarFetchedRef.current = false;
        console.warn("Airport pillar data:", err);
      });
  }, [layerVisibility.airports]);

  // 碼頭光柱 — 從 port_polygons.geojson 算質心（lazy：ports toggle 開才抓）
  const portPillarFetchedRef = useRef(false);
  useEffect(() => {
    if (!layerVisibility.ports || portPillarFetchedRef.current) return;
    portPillarFetchedRef.current = true;
    fetch("./geo/port_polygons.geojson")
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const data: StationPillarData[] = geojson.features.map((f) => {
          const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
          const coords = geom.type === "MultiPolygon"
            ? geom.coordinates[0]![0]!
            : geom.coordinates[0]!;
          const lng = coords.reduce((s, c) => s + c[0]!, 0) / coords.length;
          const lat = coords.reduce((s, c) => s + c[1]!, 0) / coords.length;
          return { position: [lng, lat], height: 1 };
        });
        setPortPillarData(data);
      })
      .catch((err) => {
        portPillarFetchedRef.current = false;
        console.warn("Port pillar data:", err);
      });
  }, [layerVisibility.ports]);

  const { isMobile, isLandscape } = useIsMobile();

  // 圖層可見性變化時踢 Mapbox 一次，確保從 idle 喚醒渲染循環
  useEffect(() => {
    mapRef.current?.triggerRepaint();
  }, [layerVisibility]);

  const [viewMode, setViewMode] = useState<ViewMode>("all-taiwan");
  const [expandedLayer, setExpandedLayer] = useState<ExpandableLayerKey | null>(null);
  const [mapStyleId, setMapStyleId] = useState("dark");
  const [renderMode, setRenderMode] = useState<RenderMode>("3d");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("status");
  const [captureMode, setCaptureMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(56); // rail only by default
  const handleSidebarWidthChange = useCallback((w: number) => setSidebarWidth(w), []);
  const [cameraInfo, setCameraInfo] = useState({ lng: 0, lat: 0, zoom: 0, pitch: 0, bearing: 0 });

  // 從 Registry 計算整體資料範圍（供日期導航參考）
  const dataTimeRange = useMemo(() => {
    const enabledIds: string[] = [];
    if (layerVisibility.flights) enabledIds.push("flights");
    if (layerVisibility.ships) enabledIds.push("ships");
    if (layerVisibility.newsEvents) enabledIds.push("newsEvents");
    if (layerVisibility.temperatureWave) enabledIds.push("temperatureWave");
    const range = dataRegistry.getTimelineRange(enabledIds);
    // fallback: 如果 registry 還沒資料，用航班的 timeRange
    if (range.start === 0 && range.end === 0) return timeRange;
    return range;
  }, [dataRegistry.sources, layerVisibility.flights, layerVisibility.ships, layerVisibility.newsEvents, layerVisibility.temperatureWave, timeRange]);

  const timeline = useTimeline({
    dataStartTime: dataTimeRange.start,
    dataEndTime: dataTimeRange.end,
  });

  // ── 活躍日追蹤：訂閱 timeStore 日期粒度（不走 React re-render） ──
  // 注意：handler 內 loadShipDay / loadFlightDay 看似 mount 就 fire，
  // 但下游 useShipData / useAirspaceData 用 apiAvailable.current 守門，
  // layer 關著時 silent no-op；保留訂閱是為了切日時已開啟的 layer 能立即跟上。
  useEffect(() => {
    const handler = (dayStr: string) => {
      if (!dayStr) return;
      const date = new Date(dayStr + "T00:00:00+08:00");
      loadShipDay(date);
      loadFlightDay(date);
      setRailActiveDate(dayStr);
    };
    handler(timeStore.getDateKey()); // 初始化
    return timeStore.subscribeDate(handler);
  }, [loadShipDay, loadFlightDay, setRailActiveDate]);

  // ── 多日模式預載：切換 rangeDays 或 selectedDate 時，背景預載所有天數 ──
  useEffect(() => {
    if (timeline.rangeDays <= 1) return;
    for (let i = 0; i < timeline.rangeDays; i++) {
      const d = new Date(timeline.selectedDate);
      d.setDate(d.getDate() + i);
      prefetchShip(d);
      prefetchFlight(d);
    }
  }, [timeline.selectedDate, timeline.rangeDays, prefetchShip, prefetchFlight]);

  // ── Custom Hooks ──

  const transportParams = useTransportParams();

  const isDarkTheme = !["light", "streets"].includes(mapStyleId);
  const showTrails = displayMode === "trails";

  // Refs for Three.js render loops
  const mapRef = useRef<MapboxMap | null>(null);
  const flightsRef = useRef<Flight[]>([]);
  const shipsRef = useRef(ships);
  const timeRef = useRef(timeline.currentTime);
  const renderModeRef = useRef(renderMode);
  const isDarkThemeRef = useRef(isDarkTheme);
  const showTrailsRef = useRef(showTrails);
  const railDataRef = useRef(railData);
  const lighthousePositionsRef = useRef(lighthousePositions);
  const thsrPillarDataRef = useRef(thsrPillarData);
  const traPillarDataRef = useRef(traPillarData);
  const metroPillarDataRef = useRef(metroPillarData);
  const airportPillarDataRef = useRef(airportPillarData);
  const portPillarDataRef = useRef(portPillarData);
  const reservoirSceneRef = useRef<ReservoirScene | null>(null);
  const reservoirStatusesRef = useRef<ReservoirStatus[]>([]);
  const temperatureDataRef = useRef(temperatureData);
  const playingRef = useRef(timeline.playing);

  // 空域快照：直接顯示全部（isFlightActive 負責時間過濾）
  const displayedFlights = allFlights;

  flightsRef.current = displayedFlights;
  shipsRef.current = ships;
  // timeRef 不走 React 4Hz 節流；直接訂閱 timeStore 維持 60Hz（見下方 useEffect）
  renderModeRef.current = renderMode;
  isDarkThemeRef.current = isDarkTheme;
  showTrailsRef.current = showTrails;
  railDataRef.current = railData;
  lighthousePositionsRef.current = lighthousePositions;
  thsrPillarDataRef.current = thsrPillarData;
  traPillarDataRef.current = traPillarData;
  metroPillarDataRef.current = metroPillarData;
  airportPillarDataRef.current = airportPillarData;
  portPillarDataRef.current = portPillarData;
  temperatureDataRef.current = temperatureData;
  playingRef.current = timeline.playing;

  // 60Hz 同步 timeRef 給各 RAF 動畫迴圈使用（不經 React re-render）
  useEffect(() => timeStore.subscribe((t) => { timeRef.current = t; }), []);

  const { trainCount, activeTrainsRef } = useRailEngine(railData, layerVisibility.rail);
  const { busCount, activeBusesRef, loadDay: loadBusTrailDay } = useBusLayer(layerVisibility.busLive, timeline.timeMode, transportParams.enabledBusCities);
  const { busCount: busIntercityCount, activeBusesRef: activeBusesIntercityRef, loadDay: loadBusIntercityTrailDay } =
    useBusIntercityLayer(layerVisibility.busIntercityLive, timeline.timeMode);
  const { busCount: touristShuttleCount, activeBusesRef: activeBusesTouristShuttleRef, loadDay: loadTouristShuttleTrailDay } =
    useTouristShuttleLayer(layerVisibility.touristShuttleLive, timeline.timeMode);

  // ── 垃圾車（高雄主城，60s polling 軌跡 + 後端去噪/stop snapping）+ 音符特效 ──
  const { trailsRef: wasteTrailsRef, count: wasteCount, loadDay: loadWasteTrailDay } =
    useWasteLayer(layerVisibility.wasteTruck, timeline.timeMode, ["高雄市", "臺南市"]);

  // ── 垃圾車表定（22 城時刻表動畫，獨立於 GPS 圖層；day-of-week 驅動）──
  // cities 由 transportParams.enabledWasteScheduleCities 控制（8 區分組 toggle）
  const { routesRef: wasteScheduleRoutesRef } = useWasteScheduleLayer(
    layerVisibility.wasteSchedule,
    transportParams.enabledWasteScheduleCities,
  );

  // ── 垃圾處理設施 / 投放點（靜態，第一個 sub-toggle 開時 lazy fetch） ──
  const wasteFacilityVis =
    layerVisibility.wfIncinerator || layerVisibility.wfLandfill || layerVisibility.wfLandfillCoastal
    || layerVisibility.wfTransfer || layerVisibility.wfMedical || layerVisibility.wfMonitoring
    || layerVisibility.wfRecycling || layerVisibility.wfScrapYard || layerVisibility.wfOther;
  const wasteDisposalVis =
    layerVisibility.wdClothes || layerVisibility.wdMixed
    || layerVisibility.wdRecyclingContainer || layerVisibility.wdBattery;
  const { byType: wasteFacilityByType } = useWasteFacilityLayer(wasteFacilityVis);
  const { byType: wasteDisposalByType } = useWasteDisposalPointLayer(wasteDisposalVis);
  const wasteFacilityByTypeRef = useRef(wasteFacilityByType);
  wasteFacilityByTypeRef.current = wasteFacilityByType;

  // 公車 replay: 跨日載入歷史軌跡（訂閱日期粒度，避免 currentTime cascade）
  useEffect(() => {
    if (!layerVisibility.busLive || timeline.timeMode !== "replay") return;
    const handler = (dayStr: string) => {
      if (dayStr) loadBusTrailDay(dayStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [timeline.timeMode, layerVisibility.busLive, loadBusTrailDay]);

  // 公路客運 replay: 同步
  useEffect(() => {
    if (!layerVisibility.busIntercityLive || timeline.timeMode !== "replay") return;
    const handler = (dayStr: string) => {
      if (dayStr) loadBusIntercityTrailDay(dayStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [timeline.timeMode, layerVisibility.busIntercityLive, loadBusIntercityTrailDay]);

  // 台灣好行 replay: 同步
  useEffect(() => {
    if (!layerVisibility.touristShuttleLive || timeline.timeMode !== "replay") return;
    const handler = (dayStr: string) => {
      if (dayStr) loadTouristShuttleTrailDay(dayStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [timeline.timeMode, layerVisibility.touristShuttleLive, loadTouristShuttleTrailDay]);

  // 垃圾車 replay: 載入 timeline 當天整日軌跡；live 則維持近 60 分鐘 polling
  useEffect(() => {
    if (!layerVisibility.wasteTruck || timeline.timeMode !== "replay") return;
    const handler = (dayStr: string) => {
      if (dayStr) loadWasteTrailDay(dayStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [timeline.timeMode, layerVisibility.wasteTruck, loadWasteTrailDay]);

  const { h3DataMap, loadResolution } = useH3Data();
  const { demographicsDataMap, loadDemographicsResolution } = useDemographicsH3();
  const { getCells: getYearlyCells, loadYear: loadDemoYear } = useDemographicsYearlyH3();

  // ── Intel Panel（即時情報，IconRail 開關） ──
  const [intelOpen, setIntelOpen] = useState(false);
  // 4-way panel mutex：每次 Intel/Satellite 開啟時 +1，IconRailSidebar 收起 Layers/Locations
  const [railCloseEpoch, setRailCloseEpoch] = useState(0);
  // ── Monitor Mode（戰情看板，底部上拉） ──
  const [monitorOpen, setMonitorOpen] = useState(false);
  const satConsole = useSatelliteConsole();
  const satManeuvers = useSatelliteManeuvers(satConsole.open);
  const maneuverNorads = useMemo(() => {
    const s = new Set<number>();
    for (const m of satManeuvers) s.add(m.norad_id);
    return s;
  }, [satManeuvers]);
  // 打開 Console 時：飛去台灣俯瞰 + 自動打開 Taiwan 圖層（其餘 CN 群維持使用者既有設定）
  const satConsoleOpen = satConsole.open;
  useEffect(() => {
    if (!satConsoleOpen) return;
    const map = mapRef.current;
    if (map) map.flyTo({ center: [121.5, 24.5], zoom: 4.5, pitch: 0, bearing: 0, speed: 1.0 });
    // 自動開 Taiwan toggle（Console 開啟 = 想看 TW 衛星）
    setLayerVisibility((prev) => (prev.satellitesTaiwan ? prev : { ...prev, satellitesTaiwan: true }));
  }, [satConsoleOpen]);

  // ── App 大模式：即時 vs 歷史長時序 ──
  const [appMode, setAppMode] = useState<AppMode>("realtime");
  const [historicalYear, setHistoricalYear] = useState<number>(113); // 民國年
  const [historicalMonth, setHistoricalMonth] = useState<number>(1); // 1~12（月/日粒度時用）
  const [historicalDay, setHistoricalDay] = useState<number>(1);     // 1~31（日粒度時用）
  const [historicalPlaying, setHistoricalPlaying] = useState<boolean>(false);
  const [historicalSpeed, setHistoricalSpeed] = useState<number>(1); // 倍速
  const [historicalGranularity, setHistoricalGranularity] = useState<HistoricalGranularity>("year");
  // 房地產時間軸：季/月/週 粒度 + 連續日期游標 ts（grid 按季、point 月/週漸入漸出）
  const [reGran, setReGran] = useState<ReGran>("quarter");
  const [reCursorTs, setReCursorTs] = useState<number>(RANGE_END);
  // 房地產任一 layer 開啟（決定歷史時間軸是否顯示 RE 季/月/週 控制）
  const realEstateActive =
    layerVisibility.realEstateRentalGrid || layerVisibility.realEstateRentalPoint ||
    layerVisibility.realEstateSaleGrid || layerVisibility.realEstateSalePoint ||
    layerVisibility.realEstatePresaleGrid || layerVisibility.realEstatePresalePoint;
  const HISTORICAL_YEARS = useMemo(
    () => [104, 105, 106, 107, 108, 109, 110, 111, 112, 113],
    [],
  );
  // 火災資料覆蓋範圍（民國 111~113）— 月/日推進的上限
  const FIRE_MAX_YEAR = 113;

  // 歷史模式自動播放：依粒度推進年/月/日，到頂暫停
  // （房地產的播放交給 useRealEstateTimeline 的 RAF 引擎，這裡略過）
  useEffect(() => {
    if (appMode !== "historical" || !historicalPlaying || realEstateActive) return;
    const interval = Math.max(200, 2000 / historicalSpeed);
    const yearMax = HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1] ?? 113;

    const id = window.setInterval(() => {
      if (historicalGranularity === "year") {
        setHistoricalYear((y) => {
          if (y >= yearMax) {
            setHistoricalPlaying(false);
            return y;
          }
          return y + 1;
        });
      } else if (historicalGranularity === "month") {
        setHistoricalMonth((m) => {
          if (m < 12) return m + 1;
          // roll over to next year, month 1
          let stop = false;
          setHistoricalYear((y) => {
            if (y >= FIRE_MAX_YEAR) {
              stop = true;
              return y;
            }
            return y + 1;
          });
          if (stop) {
            setHistoricalPlaying(false);
            return m;
          }
          return 1;
        });
      } else {
        // day
        setHistoricalDay((d) => {
          // 用 AD Date 算下一天，自動處理大小月與閏年
          const ad = new Date(historicalYear + 1911, historicalMonth - 1, d + 1);
          const ny = ad.getFullYear() - 1911;
          const nm = ad.getMonth() + 1;
          const nd = ad.getDate();
          if (ny > FIRE_MAX_YEAR) {
            setHistoricalPlaying(false);
            return d;
          }
          if (ny !== historicalYear) setHistoricalYear(ny);
          if (nm !== historicalMonth) setHistoricalMonth(nm);
          return nd;
        });
      }
    }, interval);
    return () => window.clearInterval(id);
  }, [appMode, historicalPlaying, historicalSpeed, historicalGranularity, historicalYear, historicalMonth, HISTORICAL_YEARS, realEstateActive]);

  // 切到 historical mode 時，記住既有 layerVisibility 並切到「歷史專屬」可見集合；
  // 切回 realtime 時還原。避免使用者在歷史模式看到大量無法解讀的即時圖層。
  const layerVisBeforeHistoricalRef = useRef<LayerVisibility | null>(null);
  useEffect(() => {
    if (appMode === "historical") {
      if (layerVisBeforeHistoricalRef.current === null) {
        layerVisBeforeHistoricalRef.current = layerVisibilityRef.current;
      }
      // 全部關掉、預設打開人口
      const current = layerVisibilityRef.current;
      const allOff = { ...current };
      for (const k of Object.keys(allOff) as (keyof LayerVisibility)[]) {
        allOff[k] = false;
      }
      setLayerVisibility({ ...allOff, popCount: true });
    } else {
      const snapshot = layerVisBeforeHistoricalRef.current;
      if (snapshot) {
        setLayerVisibility(snapshot);
        layerVisBeforeHistoricalRef.current = null;
      }
    }
    // setLayerVisibility / layerVisibilityRef 都是 stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  // 房地產時間軸：realtime→ALL 全期 / historical→游標所在季(grid)+點漸入漸出(月/週)
  const stopHistorical = useCallback(() => setHistoricalPlaying(false), []);
  useRealEstateTimeline(mapRef, {
    appMode,
    gran: reGran,
    cursorTs: reCursorTs,
    excludeTaipei: !!transportParams.overlayParams.realEstateExcludeTaipei,
    baseOpacity: transportParams.overlayParams.realEstateOpacity ?? 0.85,
    playing: historicalPlaying,
    speed: historicalSpeed,
    onCursorChange: setReCursorTs,
    onStop: stopHistorical,
  });
  // 房地產「點」WebGL CustomLayer（GPU fade，取代 3 個 PMTiles circle）
  useRealEstatePointsLayer(mapRef, {
    showRental: layerVisibility.realEstateRentalPoint,
    showSale: layerVisibility.realEstateSalePoint,
    showPresale: layerVisibility.realEstatePresalePoint,
    excludeTaipei: !!transportParams.overlayParams.realEstateExcludeTaipei,
    baseOpacity: transportParams.overlayParams.realEstateOpacity ?? 0.85,
  });

  const { socioDataMap, loadSocioResolution } = useH3Socioeconomic();
  const { spatialDataMap, loadSpatialResolution } = useH3SpatialEconomy();

  // H3 resolution state (driven by zoom) — 必須在 useYoubikeH3 之前宣告
  const [h3Resolution, setH3Resolution] = useState(7);
  const [demoResolution, setDemoResolution] = useState(7);

  const { getCellsForTime: getYoubikeCellsForTime } = useYoubikeH3(layerVisibility.youbikeFullness, transportParams.ybResolution);

  const {
    flightSceneRef, shipSceneRef, railSceneRef, busSceneRef,
    touristShuttleSceneRef,
    wasteScheduleSceneRef,
    wasteFacilityLayerRef,
    addFlightLayer,
    addAllLayers,
  } = useThreeJsLayers({
    timeRef, flightsRef, renderModeRef, isDarkThemeRef, showTrailsRef,
    shipsRef, activeTrainsRef, activeBusesRef, activeBusesIntercityRef, activeBusesTouristShuttleRef, wasteTrailsRef,
    wasteScheduleRoutesRef,
    wasteFacilityByTypeRef, railDataRef,
    lighthousePositionsRef, thsrPillarDataRef, traPillarDataRef, metroPillarDataRef,
    airportPillarDataRef, portPillarDataRef, temperatureDataRef,
    playingRef, layerVisibilityRef,
    paramRefs: transportParams.refs,
  });

  const { tooltipInfo, setTooltipInfo, trainTooltipInfo, busTooltipInfo, wasteScheduleTooltipInfo, realEstateTooltipInfo, featureInfo, setFeatureInfo, bindEvents } =
    useMapInteraction(mapRef, flightSceneRef, flightsRef, timeRef, railSceneRef, busSceneRef, shipSceneRef, layerVisibilityRef, reservoirSceneRef, wasteScheduleSceneRef, touristShuttleSceneRef);

  // ── 水庫 context 動態疊層 + panel 資料 ──
  // 點水庫（waterDam / waterReservoirPoly）且 feature 帶 compare_id → 打 get_reservoir_context
  const activeReservoirId: number | null = (() => {
    if (!featureInfo) return null;
    if (featureInfo.layerType !== "waterDam" && featureInfo.layerType !== "waterReservoirPoly") return null;
    const id = featureInfo.properties.compare_id;
    return typeof id === "number" && id > 0 ? id : null;
  })();
  const reservoirContext = useReservoirContextLayer(mapRef, activeReservoirId);

  // 點選的圖層點 → 淡黃色脈動光暈
  useSelectedFeatureHalo(mapRef, featureInfo);

  // ── 水庫 3D 水位計（Three.js cylinder：外殼 = 容量、內水位 = 蓄水率） ──
  useReservoirStatusLayer(
    mapRef,
    layerVisibility.waterReservoirs,
    isDarkTheme,
    transportParams.overlayParams.reservoirPillarHeight ?? 1,
    reservoirSceneRef,
    reservoirStatusesRef,
    activeReservoirId,
  );

  // ── Phase 2.1：即時雨量（Mapbox circle，0 bubble size for 無雨） ──
  useRainGaugeLayer(
    mapRef,
    layerVisibility.rainGauge,
    isDarkTheme,
    transportParams.overlayParams.rainGaugeScale ?? 1,
    transportParams.overlayParams.rainGaugeOpacity ?? 1,
  );

  // ── 都市淹水感測器 USWG（Mapbox circle + 500m/1km buffer） ──
  useFloodSensorLayer(
    mapRef,
    layerVisibility.floodSensor,
    isDarkTheme,
    transportParams.overlayParams.floodSensorScale ?? 1,
    transportParams.overlayParams.floodSensorOpacity ?? 1,
  );

  // ── 雙北 USWG 3-min 步行等時圈（PMTiles，依站即時 depth_cm 著色） ──
  useFloodSensorIsochroneLayer(
    mapRef,
    layerVisibility.floodSensorIsochrone,
    transportParams.overlayParams.floodSensorIsochroneOpacity ?? 0.55,
  );

  // ── 北市水利處水情即時三本柱（每 60s 重抓 latest） ──
  useTaipeiSewerLayer(
    mapRef,
    layerVisibility.taipeiSewer,
    transportParams.overlayParams.taipeiSewerScale ?? 1,
    transportParams.overlayParams.taipeiSewerOpacity ?? 0.85,
  );
  useTaipeiEvacuateLayer(
    mapRef,
    layerVisibility.taipeiEvacuate,
    transportParams.overlayParams.taipeiEvacuateScale ?? 1,
    transportParams.overlayParams.taipeiEvacuateOpacity ?? 0.9,
  );
  useTaipeiPumbLayer(
    mapRef,
    layerVisibility.taipeiPumb,
    transportParams.overlayParams.taipeiPumbScale ?? 1,
    transportParams.overlayParams.taipeiPumbOpacity ?? 0.9,
  );

  // ── 累積雨量柵格（PNG raster image source，dropdown 切 1/3/6/24h） ──
  usePrecipRasterLayer(
    mapRef,
    layerVisibility.precipRaster,
    (transportParams.overlayParams.precipRasterHours as 1 | 3 | 6 | 24) ?? 24,
    transportParams.overlayParams.precipRasterOpacity ?? 0.6,
  );

  // ── Phase 2.2：河川水位（Mapbox circle，check_result=0 異常紅） ──
  useRiverLevelLayer(
    mapRef,
    layerVisibility.riverLevel,
    isDarkTheme,
    transportParams.overlayParams.riverLevelScale ?? 1,
    transportParams.overlayParams.riverLevelOpacity ?? 1,
  );

  // ── W002：地下水井靜態 backdrop（站位灰點，always visible 不受 timeline 影響） ──
  useGroundwaterWellsLayer(
    mapRef,
    layerVisibility.groundwaterWells,
    isDarkTheme,
    transportParams.overlayParams.groundwaterWellsScale ?? 1,
    transportParams.overlayParams.groundwaterWellsOpacity ?? 1,
  );

  // ── W002：地下水井動態層（當前 vs 當日起始水位 delta 著色，timeline 驅動） ──
  useGroundwaterLayer(
    mapRef,
    layerVisibility.groundwater,
    isDarkTheme,
    transportParams.overlayParams.groundwaterScale ?? 1,
    transportParams.overlayParams.groundwaterOpacity ?? 1,
  );

  // ── IoT 河川（補強 riverLevel；migration 063 預聚合表，timeline 驅動） ──
  useIotWraRiverLayer(
    mapRef,
    layerVisibility.iotWraRiver,
    isDarkTheme,
    transportParams.overlayParams.iotWraRiverScale ?? 1,
    transportParams.overlayParams.iotWraRiverOpacity ?? 1,
    !!(transportParams.overlayParams.iotWraRiverShowMeasured ?? 1),
    !!(transportParams.overlayParams.iotWraRiverShowForecast ?? 1),
  );

  // ── IoT 水工結構（流量/閘門/堤防/沖刷/揚塵 5 in 1，純 latest snapshot） ──
  useIotWraStructureLayer(
    mapRef,
    layerVisibility.iotWraStructure,
    isDarkTheme,
    transportParams.overlayParams.iotWraStructureScale ?? 1,
    transportParams.overlayParams.iotWraStructureOpacity ?? 1,
    !!(transportParams.overlayParams.iotWraStructureFlow ?? 1),
    !!(transportParams.overlayParams.iotWraStructureGate ?? 1),
    !!(transportParams.overlayParams.iotWraStructureDam ?? 1),
    !!(transportParams.overlayParams.iotWraStructureErosion ?? 1),
    !!(transportParams.overlayParams.iotWraStructureDust ?? 1),
  );

  // ── News events 按日載入（Supabase；餵 overlayRegistry 的 news-events source） ──
  const newsFilter = useMemo(
    () => ({
      minRelevance: transportParams.newsMinRelevance,
      eventsOnly: transportParams.newsEventsOnly,
      minSeverity: transportParams.newsMinSeverity,
    }),
    [transportParams.newsMinRelevance, transportParams.newsEventsOnly, transportParams.newsMinSeverity],
  );
  useNewsEventsLayer(mapRef, layerVisibility.newsEvents, newsFilter);

  // ── Energy MVP（Phase C/D/E）──
  // dashboard 共用：HUD + region bars 不同時 toggle 也只拉一次
  const energyDashboardActive =
    layerVisibility.powerStatusHud || layerVisibility.powerRegionDemand;
  const { dataRef: powerDashboardRef } =
    usePowerDashboard(energyDashboardActive);
  useEnergyPoiLayer(mapRef, {
    showPlants: layerVisibility.powerPlants,
    showSubstations: layerVisibility.osmSubstations,
    showSubstationsEhv: layerVisibility.osmSubstationsEhv,
    showPowerLines: layerVisibility.osmPowerLines,
    showPowerTowers: layerVisibility.osmPowerTowers,
    showWindTurbines: layerVisibility.osmWindTurbines,
    showSolarFarms: layerVisibility.osmSolarFarms,
    showOsmPowerPlantsStatic: layerVisibility.osmPowerPlantsStatic,
    showOffshoreWindZones: layerVisibility.offshoreWindZones,
    showIslandPowerGrid: layerVisibility.islandPowerGrid,
    showFossilFuelInfra: layerVisibility.fossilFuelInfra,
    showGeothermalWells: layerVisibility.geothermalWells,
    showRenewablePermitsTaipei: layerVisibility.renewablePermitsTaipei,
    showEvCharging: layerVisibility.evChargingStations,
    // Phase 8 SSOT 6-layer
    showFacPrimary: layerVisibility.facPrimary,
    showFacOffshore: layerVisibility.facOffshore,
    showFacPlanned: layerVisibility.facPlanned,
    showFacHistorical: layerVisibility.facHistorical,
    showFacSecondary: layerVisibility.facSecondary,
    showFacOsmSupplement: layerVisibility.facOsmSupplement,
  });
  // 化石燃料：加油站（公開 get_gas_station_layers）+ 石化（owner-gated get_fossil_fuel_layers）
  useFossilFuelLayers({ mapRef, visibility: layerVisibility });
  // 畜牧 owner-only 動態層（get_livestock_farms / get_livestock_slaughterhouses）
  useLivestockLayers({ mapRef, visibility: layerVisibility });
  // A1 即時死亡事故（rpc_a1_by_bbox，每 12h 更新）
  useA1AccidentRealtimeLayer(mapRef, layerVisibility.a1AccidentRealtime);
  // 雲林 POC 覆蓋分析 5 layer 改 PMTiles — 由 overlayRegistry pmtiles 設定自動處理
  // 變電所菱形 SDF icon 註冊（osmSubstations symbol layer 用）
  useSubstationDiamondIcon(mapRef);
  // Three.js bloom layer for 高壓輸電線（取代 Mapbox stacking）
  useOsmPowerLinesGlowLayer(
    mapRef,
    layerVisibility.osmPowerLines,
    transportParams.overlayParams.osmPowerLinesOpacity ?? 0.4,
    transportParams.overlayParams.osmPowerLinesWidth ?? 1,
  );
  usePowerPolesLayer(
    mapRef,
    layerVisibility.powerPoles,
    transportParams.overlayParams.powerPolesOpacity ?? 0.7,
    transportParams.overlayParams.powerPolesSize ?? 1,
    transportParams.overlayParams.powerPolesHeat ?? 1,
    transportParams.overlayParams.powerPolesZ5Reveal ?? 0,
  );
  useAviationAirspaceLayer(
    mapRef,
    layerVisibility.aviationControl,
    layerVisibility.aviationRestricted,
    transportParams.overlayParams.aviationControlOpacity ?? 0.7,
    transportParams.overlayParams.aviationRestrictedOpacity ?? 0.7,
  );
  useDroneZonesLayer(
    mapRef,
    layerVisibility.droneNoFlyZone,
    layerVisibility.droneRestrictedZone,
    transportParams.overlayParams.droneNfzOpacity ?? 0.45,
    transportParams.overlayParams.droneRestrictedOpacity ?? 0.45,
  );
  // 環境污染三層 filter（介質 / 嚴重度 / 年份時間軸 / 列管中）— paint 走 overlayManager
  usePollutionLayers(
    mapRef,
    {
      pollutionFacility: layerVisibility.pollutionFacility,
      pollutionPenaltyCritical: layerVisibility.pollutionPenaltyCritical,
      pollutionPenaltyGeneral: layerVisibility.pollutionPenaltyGeneral,
      pollutionPenaltyMobile: layerVisibility.pollutionPenaltyMobile,
      pollutionSite: layerVisibility.pollutionSite,
    },
    {
      facilityMedia: transportParams.pollutionFacilityMedia,
      facilityMinSev: transportParams.pollutionFacilityMinSev,
      penaltyMediumIdx: transportParams.pollutionPenaltyMediumIdx,
      penaltyYear: transportParams.pollutionPenaltyYear,
      penaltyMode: transportParams.pollutionPenaltyMode,
      siteActiveOnly: transportParams.pollutionSiteActiveOnly,
    },
  );
  usePowerRegionBarsLayer(
    mapRef,
    layerVisibility.powerRegionDemand,
    0.55,
    powerDashboardRef,
  );
  usePowerGenerationBeamLayer(
    mapRef,
    layerVisibility.powerGenerationUnit,
    transportParams.overlayParams.powerGenerationOpacity ?? 0.7,
    transportParams.overlayParams.powerGenerationHeight ?? 1,
  );
  usePowerPlantGlowLayer(
    mapRef,
    layerVisibility.powerPlantGlow,
    transportParams.overlayParams.powerPlantGlowOpacity ?? 0.9,
    transportParams.overlayParams.powerPlantGlowSize ?? 1,
  );
  useSubstationEhvGlowLayer(
    mapRef,
    layerVisibility.substationEhvGlow,
    transportParams.overlayParams.substationEhvGlowOpacity ?? 0.9,
    transportParams.overlayParams.substationEhvGlowSize ?? 1,
  );
  usePowerLinesGlowTestLayer(
    mapRef,
    layerVisibility.powerLinesGlow,
    transportParams.overlayParams.powerLinesGlowOpacity ?? 0.7,
    transportParams.overlayParams.powerLinesGlowWidth ?? 2,
  );
  useAviationRestrictedGlowLayer(
    mapRef,
    layerVisibility.aviationRestrictedGlow,
    transportParams.overlayParams.aviationRestrictedGlowOpacity ?? 0.85,
  );

  // ── HAZARD（v2 Phase B）──
  useLightningLayer(
    mapRef,
    layerVisibility.lightning,
    transportParams.overlayParams.lightningMinutes ?? 60,
  );
  useNuclearLayer(mapRef, layerVisibility.nuclearRadiation);

  // ── 急診壅塞（當下快照，比照核安 LIVE）──
  useErHospitalLayer(mapRef, layerVisibility.erHospital);

  // ── 停車 Parking（路邊 + 場外 當下快照，比照急診 LIVE）──
  useParkingLayer(mapRef, layerVisibility.parkingOnstreet, layerVisibility.parkingOffstreet, timeline.timeMode);

  // ── News timeline (time-based filter + ripple animation) ──
  useNewsTimeline(mapRef, layerVisibility.newsEvents, transportParams.newsTimeBased, transportParams.newsRipple);

  // ── Earthquake events timeline ──
  useEarthquakeLayer(
    mapRef,
    layerVisibility.earthquakes,
    transportParams.eqOpacity,
    transportParams.eqShowHistory,
  );

  // ── 全球氣候 GLOBAL CLIMATE（migration 261）──
  // earthquakesGlobal（USGS）+ typhoonTracks（JMA/JTWC）走 Supabase；
  // windField / oceanCurrents / dustForecast 讀 public/climate/*_latest.png UV/raster
  //（scripts/preprocess/extract_climate_uv.py 烤圖，S3 deploy-assets/climate/ 同步）。
  useEarthquakesGlobalLayer(
    mapRef,
    layerVisibility.earthquakesGlobal,
    transportParams.overlayParams.earthquakesGlobalOpacity ?? 0.9,
  );
  useTyphoonTracksLayer(
    mapRef,
    layerVisibility.typhoonTracks,
    transportParams.overlayParams.typhoonTracksOpacity ?? 0.9,
    (["all", "jma", "jtwc"][transportParams.overlayParams.typhoonSourceIdx ?? 0] ?? "all") as TyphoonSource,
  );

  const windBaseOpacity = transportParams.overlayParams.windFieldOpacity ?? 0.8;
  const oceanBaseOpacity = transportParams.overlayParams.oceanCurrentsOpacity ?? 0.65;

  // 風場：地理座標 WebGL instanced 細線，全 zoom 涵蓋（drape 已移除，mercator 投影下線層各 zoom 皆正確）。
  useClimateParticleLineLayer(mapRef, {
    layerId: "climate-windfield",
    pngUrl: "/climate/wind10m_latest.png",
    metaUrl: "/climate/wind10m_latest.json",
    visible: layerVisibility.windField,
    opacity: windBaseOpacity,
    animationSpeed: transportParams.overlayParams.windAnimationSpeed ?? 1.0,
    particleCount: Math.floor(transportParams.overlayParams.windParticleCount ?? 7_000),
    lineWidth: transportParams.overlayParams.windLineWidth ?? 1.15,
    speedMax: WIND_SPEED_MAX,
    rampColors: WIND_FIELD_RAMP,
    timeScaleSeconds: 18_000,
    trailPoints: 22,
    particleAlpha: 0.66,
  });

  // 海流：地理座標 WebGL instanced 細線 + strict ocean mask，全 zoom 涵蓋。
  useClimateParticleLineLayer(mapRef, {
    layerId: "climate-ocean-currents",
    pngUrl: "/climate/currents_latest.png",
    metaUrl: "/climate/currents_latest.json",
    visible: layerVisibility.oceanCurrents,
    opacity: oceanBaseOpacity,
    animationSpeed: transportParams.overlayParams.oceanAnimationSpeed ?? 1.0,
    particleCount: Math.floor(transportParams.overlayParams.oceanParticleCount ?? 8_000),
    lineWidth: transportParams.overlayParams.oceanLineWidth ?? 1.05,
    speedMax: OCEAN_SPEED_MAX,
    rampColors: OCEAN_CURRENTS_RAMP,
    timeScaleSeconds: 86_400,
    trailPoints: 20,
    maskErodePx: 1,
    particleAlpha: 0.62,
  });

  // 沙塵預報 raster overlay（CAMS duaod550 預烤棕色色階 + alpha mask）
  useDustForecastLayer(
    mapRef,
    layerVisibility.dustForecast,
    transportParams.overlayParams.dustForecastOpacity ?? 0.7,
  );

  // ── NCDR Disaster Alerts timeline（5 主題群組共用 source）──
  useDisasterAlertLayer(
    mapRef,
    {
      lifelineAlerts: layerVisibility.lifelineAlerts,
      floodAlerts: layerVisibility.floodAlerts,
      weatherAlerts: layerVisibility.weatherAlerts,
      transitAlerts: layerVisibility.transitAlerts,
      safetyAlerts: layerVisibility.safetyAlerts,
    },
    transportParams.daOpacity,
  );

  // ── 衛星圖層（Supabase satellite_classified + SGP4 即時計算） ──
  useSatellitesLayer(mapRef, {
    visibility: {
      china_yaogan: layerVisibility.satellitesYaogan,
      china_jilin: layerVisibility.satellitesJilin,
      china_gaofen: layerVisibility.satellitesGaofen,
      china_tjs: layerVisibility.satellitesTJS,
      china_beidou: layerVisibility.satellitesBeidou,
      china_shiyan: layerVisibility.satellitesShiyan,
      taiwan: layerVisibility.satellitesTaiwan,
      usa: layerVisibility.satellitesUSA,
      japan: layerVisibility.satellitesJapan,
      russia: layerVisibility.satellitesRussia,
      india: layerVisibility.satellitesIndia,
      korea: layerVisibility.satellitesKorea,
      france: layerVisibility.satellitesFrance,
      germany: layerVisibility.satellitesGermany,
      italy: layerVisibility.satellitesItaly,
      israel: layerVisibility.satellitesIsrael,
    },
    opacity: transportParams.satOpacity,
    consoleFilter: satConsole.open
      ? { featuredNorads: maneuverNorads, showAllOrbits: satConsole.showAllOrbits }
      : null,
  });

  // ── TDX 即時路況事件 timeline ──
  useRoadEventsLayer(
    mapRef,
    layerVisibility.roadEvents,
    transportParams.reOpacity,
  );

  // ── 火災歷史事件（僅在 historical mode + toggle 開啟時實際 fetch） ──
  useFireEventsLayer(
    mapRef,
    appMode === "historical" && layerVisibility.fireEvents,
    historicalYear,
    historicalMonth,
    historicalDay,
    historicalGranularity,
    isDarkTheme,
    transportParams.overlayParams.fireEventsOpacity ?? 1,
  );

  // ── 火災最新年度（任何模式可見，不需歷史時間軸）──
  useFireLatestLayer(
    mapRef,
    layerVisibility.fireLatest,
    isDarkTheme,
    transportParams.overlayParams.fireLatestOpacity ?? 1,
  );

  // ── 全國清潔隊辦公點 359 / 23 縣市（spatial.waste_cleaning_squads）──
  useWasteCleaningSquadLayer(
    mapRef,
    layerVisibility.wasteCleaningSquads,
    isDarkTheme,
  );

  // ── Base map 地形 raster（hillshade / slope / aspect，單張 PNG 預烤 colormap）──
  useStaticRasterLayer({
    mapRef,
    sourceId: "base-hillshade-src",
    layerId: "base-hillshade-layer",
    url: "./base_map/hillshade.png",
    bbox: TERRAIN_BBOX,
    visible: layerVisibility.hillshade,
    opacity: transportParams.hillshadeOpacity,
  });
  useStaticRasterLayer({
    mapRef,
    sourceId: "base-slope-src",
    layerId: "base-slope-layer",
    url: "./base_map/slope.png",
    bbox: TERRAIN_BBOX,
    visible: layerVisibility.slope,
    opacity: transportParams.slopeOpacity,
  });
  useStaticRasterLayer({
    mapRef,
    sourceId: "base-aspect-src",
    layerId: "base-aspect-layer",
    url: "./base_map/aspect.png",
    bbox: TERRAIN_BBOX,
    visible: layerVisibility.aspect,
    opacity: transportParams.aspectOpacity,
  });

  // ── CWA 衛星雲圖 / 雷達回波 ──
  useCwaImageryLayer({
    mapRef,
    cloudVisible: layerVisibility.cwaCloudImagery,
    radarVisible: layerVisibility.cwaRadarImagery,
    cloudOpacity: transportParams.cwaCloudOpacity,
    radarOpacity: transportParams.cwaRadarOpacity,
  });

  // ── 空氣品質：色階 raster + 77 站 + LASS 微型感測 ──
  const [aqiProduct, setAqiProduct] = useState<AqiProduct>("AQI");
  useAqiImageryLayer({
    mapRef,
    visible: layerVisibility.aqiImagery,
    product: aqiProduct,
    opacity: transportParams.aqiImageryOpacity,
  });
  useAqiStationsLayer(mapRef, layerVisibility.aqiStations, isDarkTheme);
  useMicroSensorsLayer(mapRef, layerVisibility.aqiMicroSensors, isDarkTheme, transportParams.aqiMicroCluster);

  // ── Freeway congestion (動態 timeline 回放) ──
  useFreewayLayer(
    mapRef,
    layerVisibility.freewayCongestion,
    transportParams.overlayParams.freewayWidth ?? 1,
    isDarkTheme,
  );

  // ── 省道路況 v1（PMTiles + feature-state 染色） ──
  useRoadCongestionLayer(
    mapRef,
    layerVisibility.roadCongestion,
    transportParams.overlayParams.roadCongestionWidth ?? 1,
    transportParams.overlayParams.roadCongestionOpacity ?? 0.85,
  );

  // 地圖首次渲染完成（idle 或 4s 保底）— 需在下方 waste lazy setup effect 之前宣告
  const [mapPrepared, setMapPrepared] = useState(false);

  // ── 垃圾設施 / 投放點 Mapbox circle（8 個量級大子類型） ──
  // Lazy setup：任一 wf* toggle 開 + map 已 ready 才建 8 sources + 16 layers
  const wasteMapboxSetupRef = useRef(false);
  const anyWasteFacilityOn = layerVisibility.wfIncinerator || layerVisibility.wfLandfill
    || layerVisibility.wfLandfillCoastal || layerVisibility.wfTransfer
    || layerVisibility.wfMedical || layerVisibility.wfMonitoring;
  useEffect(() => {
    if (!anyWasteFacilityOn || wasteMapboxSetupRef.current) return;
    const map = mapRef.current;
    if (!styleReady(map)) return;
    setupWasteMapboxLayers(map, {
      isDark: isDarkTheme,
      onFeatureClick: setFeatureInfo,
    });
    wasteMapboxSetupRef.current = true;
    // setup 完立刻把目前 byType / visibility / params 同步進去
    syncWasteMapboxData(map, wasteFacilityByTypeRef.current ?? new Map(), wasteDisposalByType);
    syncWasteMapboxVisibility(map, layerVisibilityRef.current);
    syncWasteMapboxParams(map, transportParams.wasteSubParams);
  }, [anyWasteFacilityOn, mapPrepared, isDarkTheme, wasteDisposalByType, transportParams.wasteSubParams]);
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map) || !wasteMapboxSetupRef.current) return;
    syncWasteMapboxData(map, wasteFacilityByType, wasteDisposalByType);
  }, [wasteFacilityByType, wasteDisposalByType]);
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map) || !wasteMapboxSetupRef.current) return;
    syncWasteMapboxVisibility(map, layerVisibility);
  }, [layerVisibility]);
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map) || !wasteMapboxSetupRef.current) return;
    syncWasteMapboxParams(map, transportParams.wasteSubParams);
  }, [transportParams.wasteSubParams]);
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map) || !wasteMapboxSetupRef.current) return;
    syncWasteMapboxTheme(map, isDarkTheme);
  }, [isDarkTheme]);

  // ── Derived values ──

  const preset = useMemo(
    () => getPresetById(selectedAirport) ?? DEFAULT_CAMERA,
    [selectedAirport],
  );

  const styleUrl = useMemo(() => getStyleUrl(mapStyleId), [mapStyleId]);

  // ── Map ready handler ──

  // 地圖首次渲染完成（idle 或 4s 保底）才允許 LoadingScreen 收掉，
  // 避免「資料 RPC 完成但場景還沒畫出來」的空窗 — state 宣告已上移至 waste lazy setup 前

  const handleMapReady = (map: MapboxMap) => {
    mapRef.current = map;
    addAllLayers(map);
    map.once("idle", () => setMapPrepared(true));
    setTimeout(() => setMapPrepared(true), 4000);
    sessionTracker.init("mini-taiwan-pulse");
    sessionTracker.logWithSnapshot("session_start", { appMode }, layerVisibilityRef.current);

    const updateCamera = () => {
      const c = map.getCenter();
      const z = +map.getZoom().toFixed(1);
      const lat = +c.lat.toFixed(4);
      const lng = +c.lng.toFixed(4);
      const p = +map.getPitch().toFixed(0);
      setCameraInfo({ lng, lat, zoom: z, pitch: p, bearing: +map.getBearing().toFixed(0) });
      sessionTracker.logMapView(z, lat, lng, p);
    };
    map.on("move", updateCamera);
    updateCamera();

    // H3 zoom-based resolution switching
    const onZoomH3 = () => {
      const res = getH3Resolution(map.getZoom());
      setH3Resolution(res);
      setDemoResolution(Math.min(res, 8)); // cap at 8 for demographics
    };
    map.on("zoomend", onZoomH3);
    onZoomH3(); // initial
    // H3 res 預載已移除 — 各 h3* subscriber（L1086 / L1105 / L1119 / L1126）會在 visibility 開啟時自行 loadResolution

    bindEvents(map);

    // 垃圾設施 / 投放點 Mapbox circle setup 已移至獨立 effect（lazy：任一 wf* toggle 開才 setup）

    // 3D 垃圾處理設施 click pick（5 sub-scene 任一命中 → popup）
    map.on("click", (e) => {
      const layer = wasteFacilityLayerRef.current;
      if (!layer) return;
      // 只在任一 facility 3D toggle 開時嘗試 pick（避免命中隱形物件）
      const v = layerVisibilityRef.current;
      if (!(v.wfIncinerator || v.wfLandfill || v.wfLandfillCoastal || v.wfTransfer || v.wfMedical || v.wfMonitoring)) return;
      const canvas = map.getCanvas();
      const hit = layer.pickFacility(
        e.point.x, e.point.y,
        canvas.clientWidth, canvas.clientHeight,
      );
      if (!hit) return;
      const r = hit.row;
      setFeatureInfo({
        layerType: "wasteFacility",
        properties: {
          kind: "facility",
          id: r.id,
          facility_name: r.facility_name,
          facility_type: r.facility_type,
          city: r.city,
          operator: r.operator,
          address: r.address,
          capacity_tpd: r.capacity_tpd,
          status: r.status,
          start_year: r.start_year,
          source_url: r.source_url,
          is_coastal: r.is_coastal,
          distance_to_sea_m: r.distance_to_sea_m,
        },
      });
    });
  };

  // ── Effects ──

  // 航班資料或模式變更時重建 layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addFlightLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAirport, viewMode]);

  // 軌道靜態線（2D Mapbox）
  const { railTrackMode } = transportParams;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (railData && layerVisibility.rail) {
      updateRailTracks(map, railData.allTracks, isDarkTheme);
      setRailTracksVisible(map, railTrackMode === "2d");
    } else {
      removeRailTracks(map);
    }
  }, [railData, isDarkTheme, layerVisibility.rail, railTrackMode]);

  // Three.js 圖層可見性由各 custom layer 內部 getIsVisible 控制
  // layers 常駐，不做 remove/re-add（避免 WebGL dispose/reinit 問題）

  // H3: load resolution when it changes
  useEffect(() => {
    if (layerVisibility.h3Population) {
      loadResolution(h3Resolution);
    }
  }, [h3Resolution, layerVisibility.h3Population, loadResolution]);

  // H3: update native Mapbox layers
  // Guard: getStyle() returns truthy after style parse (unaffected by tile loading),
  // undefined before style loads. This avoids both isStyleLoaded() false-during-tiles
  // and addSource-before-style-ready crashes.
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureH3Layers(map);
    const cells = h3DataMap.get(h3Resolution) ?? [];
    updateH3Layer(map, cells, transportParams.h3Params, layerVisibility.h3Population);
  }, [h3DataMap, h3Resolution, layerVisibility.h3Population, transportParams.h3Params]);

  // Demographics: load resolution when it changes
  useEffect(() => {
    if (layerVisibility.popCount || layerVisibility.indicators) {
      loadDemographicsResolution(demoResolution);
    }
  }, [demoResolution, layerVisibility.popCount, layerVisibility.indicators, loadDemographicsResolution]);

  // Historical mode: 預載當前選定年份的人口 cells
  useEffect(() => {
    if (appMode !== "historical") return;
    if (!layerVisibility.popCount && !layerVisibility.indicators) return;
    loadDemoYear(historicalYear, demoResolution);
  }, [appMode, historicalYear, demoResolution, layerVisibility.popCount, layerVisibility.indicators, loadDemoYear]);

  // Socioeconomic: load resolution when visible
  useEffect(() => {
    if (layerVisibility.socioeconomic) {
      loadSocioResolution(demoResolution);
    }
  }, [demoResolution, layerVisibility.socioeconomic, loadSocioResolution]);

  // Spatial Economy: load resolution when visible
  useEffect(() => {
    if (layerVisibility.spatialEconomy) {
      loadSpatialResolution(demoResolution);
    }
  }, [demoResolution, layerVisibility.spatialEconomy, loadSpatialResolution]);

  // Demographics: update popCount layer
  // historical mode 用 yearly RPC cells；realtime mode 用本機 JSON snapshot
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensurePopCountLayers(map);
    const cells =
      appMode === "historical"
        ? (getYearlyCells(historicalYear, demoResolution) ?? [])
        : (demographicsDataMap.get(demoResolution) ?? []);
    updatePopCountLayer(map, cells, transportParams.popCountParams, layerVisibility.popCount);
  }, [appMode, historicalYear, demographicsDataMap, demoResolution, layerVisibility.popCount, transportParams.popCountParams, getYearlyCells]);

  // Demographics: update indicators layer
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureIndicatorsLayers(map);
    const cells =
      appMode === "historical"
        ? (getYearlyCells(historicalYear, demoResolution) ?? [])
        : (demographicsDataMap.get(demoResolution) ?? []);
    updateIndicatorsLayer(map, cells, transportParams.indicatorsParams, layerVisibility.indicators);
  }, [appMode, historicalYear, demographicsDataMap, demoResolution, layerVisibility.indicators, transportParams.indicatorsParams, getYearlyCells]);

  // Socioeconomic: update layer
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureSocioLayers(map);
    const cells = socioDataMap.get(demoResolution) ?? [];
    updateSocioLayer(map, cells, transportParams.socioParams, layerVisibility.socioeconomic);
  }, [socioDataMap, demoResolution, layerVisibility.socioeconomic, transportParams.socioParams]);

  // Spatial Economy: update layer
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureSpatialLayers(map);
    const cells = spatialDataMap.get(demoResolution) ?? [];
    updateSpatialLayer(map, cells, transportParams.spatialParams, layerVisibility.spatialEconomy);
  }, [spatialDataMap, demoResolution, layerVisibility.spatialEconomy, transportParams.spatialParams]);

  // YouBike Fullness: sync with main timeline
  // 訂閱 timeStore 分鐘粒度（不走 React 4Hz re-render），每 60 秒模擬時間更新一次
  const [youbikeTimeKey, setYoubikeTimeKey] = useState(
    () => Math.floor(timeStore.getTime() / 60) * 60,
  );
  useEffect(() => {
    let lastMinute = Math.floor(timeStore.getTime() / 60);
    return timeStore.subscribe((t) => {
      const minute = Math.floor(t / 60);
      if (minute !== lastMinute) {
        lastMinute = minute;
        setYoubikeTimeKey(minute * 60);
      }
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map)) return;
    ensureYoubikeLayers(map);
    const cells = getYoubikeCellsForTime(timeStore.getTime());
    updateYoubikeLayer(map, cells, transportParams.youbikeParams, layerVisibility.youbikeFullness);
  }, [getYoubikeCellsForTime, youbikeTimeKey, layerVisibility.youbikeFullness, transportParams.youbikeParams]);

  // ESC 退出拍攝模式
  useEffect(() => {
    if (!captureMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCaptureMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [captureMode]);

  // 預載進度：只顯示「預設開啟」的動態源（boot lazy 後通常只剩地圖場景）
  const loadingSteps = [
    ...(layerVisibility.flights ? [{ label: "空域 Airspace", done: !loading, count: allFlights.length }] : []),
    ...(layerVisibility.ships ? [{ label: "船舶 Ships", done: !shipsLoading, count: ships.length }] : []),
    ...(layerVisibility.rail ? [{ label: "鐵道 Rail", done: !railLoading, count: railData ? railData.systems.length : 0 }] : []),
    ...(layerVisibility.temperatureWave ? [{ label: "溫度場 Temperature", done: !temperatureLoading }] : []),
    { label: "地圖場景 Map", done: mapPrepared },
  ];
  const allReady = loadingSteps.every((s) => s.done);

  // allReady 後延遲 600ms 再 unmount LoadingScreen，讓使用者看到 100%
  const [dismissedLoading, setDismissedLoading] = useState(false);
  useEffect(() => {
    if (!allReady) return;
    const t = setTimeout(() => setDismissedLoading(true), 600);
    return () => clearTimeout(t);
  }, [allReady]);

  // 30 秒 timeout：避免任一資料源掛掉導致永遠卡在 loading
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimedOut(true), 30_000);
    return () => clearTimeout(timer);
  }, []);

  // 全部資料載入完成後自動播放
  useEffect(() => {
    if (allReady && timeRange.start > 0) {
      timeline.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady, timeRange.start]);

  // ── Sidebar props 穩定化（讓 IconRailSidebar / LayersPanel 能用 React.memo） ──

  const sidebarCounts = useMemo(() => ({
    flights: displayedFlights.length,
    ships: shipSceneRef.current?.getVisibleCount() ?? ships.length,
    trains: trainCount,
    buses: busCount,
    busesIntercity: busIntercityCount,
    wasteTrucks: wasteCount,
  }), [displayedFlights.length, ships.length, trainCount, busCount, busIntercityCount, wasteCount]);

  // owner-only 圖層：非 owner 的開啟意圖一律攔截（回 true = 呼叫端直接 return no-op）。
  // 未登入 → 導 Google 登入；已登入非 owner → 顯示「私人圖層」提示。
  const handleGatedIntercept = useCallback((layer: keyof LayerVisibility): boolean => {
    // lockedKeys 已內含 tier 判定（owner / 授權 tier → 不在集合）
    if (!lockedKeysRef.current.has(layer)) return false;
    if (!memberUserRef.current) {
      void signInWithGoogle().catch((err) => console.error("[owner-gate] signIn failed", err));
    } else {
      setGatedNotice(true);
    }
    return true;
  }, []);

  const handleLayerClick = useCallback((layer: keyof LayerVisibility) => {
    if (handleGatedIntercept(layer)) return;
    const isVisible = layerVisibilityRef.current[layer];
    if (!isVisible) {
      setLayerVisibility((prev) => ({ ...prev, [layer]: true }));
      setExpandedLayer(layer as ExpandableLayerKey);
      sessionTracker.logWithSnapshot("layer_toggle", { layer, on: true }, layerVisibilityRef.current);
    } else {
      setExpandedLayer((prevExpanded) =>
        prevExpanded === layer ? null : (layer as ExpandableLayerKey),
      );
    }
    // 點 layer 時自動關掉即時情報 / 衛星情報 panel（與點 location 一致）
    setIntelOpen(false);
    satelliteConsoleStore.setOpen(false);
  }, [layerVisibilityRef, setLayerVisibility, handleGatedIntercept]);

  const handleToggleVisibility = useCallback((layer: keyof LayerVisibility) => {
    // 已開啟的圖層允許關閉；只攔截「開啟」意圖（gated 且非 owner 恆為關閉態，故等同全攔）
    if (!layerVisibilityRef.current[layer] && handleGatedIntercept(layer)) return;
    const wasVisible = layerVisibilityRef.current[layer];
    toggleVisibility(layer);
    sessionTracker.logWithSnapshot("layer_toggle", { layer, on: !wasVisible }, layerVisibilityRef.current);
    setIntelOpen(false);
    satelliteConsoleStore.setOpen(false);
  }, [toggleVisibility, layerVisibilityRef, handleGatedIntercept]);

  const handleDisplayModeChange = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
    setTooltipInfo(null);
  }, [setTooltipInfo]);

  const handleHideTransport = useCallback(() => {
    setExpandedLayer((prevExpanded) => {
      if (prevExpanded) {
        sessionTracker.logWithSnapshot("layer_toggle", { layer: prevExpanded, on: false }, layerVisibilityRef.current);
        setLayerVisibility((prev) => ({ ...prev, [prevExpanded]: false }));
      }
      return null;
    });
  }, [setLayerVisibility, layerVisibilityRef]);

  const handleAllOff = useCallback(() => {
    sessionTracker.logWithSnapshot("all_off", {}, layerVisibilityRef.current);
    setLayerVisibility((prev) => {
      const next = { ...prev };
      for (const k in next) next[k as keyof typeof next] = false;
      return next;
    });
    setExpandedLayer(null);
  }, [setLayerVisibility, layerVisibilityRef]);

  const handleBulkSetVisibility = useCallback(
    (keys: (keyof LayerVisibility)[], value: boolean) => {
      // 開啟時（value=true）過濾掉對此使用者上鎖的 key（Theme 全開 / chat bridge 亦走此路徑）
      const effectiveKeys = value
        ? keys.filter((k) => !lockedKeysRef.current.has(k))
        : keys;
      setLayerVisibility((prev) => {
        const next = { ...prev };
        for (const k of effectiveKeys) next[k] = value;
        return next;
      });
      sessionTracker.logWithSnapshot(
        "layer_toggle",
        { bulk: true, keys: effectiveKeys, on: value },
        layerVisibilityRef.current,
      );
    },
    [setLayerVisibility, layerVisibilityRef],
  );

  const { seek: timelineSeek, setSpeed: timelineSetSpeed, play: timelinePlay } = timeline;
  const handleLocationJump = useCallback((id: string) => {
    const p = getPresetById(id);
    if (p && mapRef.current) {
      if (p.category === "airport") setSelectedAirport(p.id);
      mapRef.current.flyTo({
        center: p.center,
        zoom: p.zoom,
        pitch: p.pitch,
        bearing: p.bearing,
        duration: 2000,
      });
      if (p.time != null) timelineSeek(p.time);
      if (p.speed != null) timelineSetSpeed(p.speed);
      if (p.autoPlay) timelinePlay();
      if (p.layers) {
        setLayerVisibility((prev) => ({ ...prev, ...p.layers }));
      }
    }
  }, [timelineSeek, timelineSetSpeed, timelinePlay, setLayerVisibility]);

  // BYOK 對話 agent 的地圖操作橋接：把既有 handler 注入白名單 tool（無新增地圖邏輯）。
  const chatBridge = useMemo<MapBridge>(() => ({
    bulkSetVisibility: (keys, visible) =>
      handleBulkSetVisibility(keys as (keyof LayerVisibility)[], visible),
    allOff: handleAllOff,
    flyTo: (lng, lat, zoom) =>
      mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom ?? 11, speed: 1.2 }),
    jumpToPlace: (presetId) => {
      if (!getPresetById(presetId)) return false;
      handleLocationJump(presetId);
      return true;
    },
    highlightPoint: (lng, lat, layerType, properties) => {
      // 已知 layerType → 走該圖層專屬 popup；未知（含 chat 標記）→ 通用 chatHighlight
      const known = typeof layerType === "string" && layerType in HEADER_LABELS;
      const lt = known ? (layerType as FeatureInfo["layerType"]) : "chatHighlight";
      const props = known ? (properties ?? {}) : { ...(properties ?? {}), lng, lat };
      setFeatureInfo({ layerType: lt, properties: props, coords: [lng, lat] });
    },
    getVisibleLayerKeys: () =>
      Object.entries(layerVisibilityRef.current)
        .filter(([, v]) => v)
        .map(([k]) => k),
    getCurrentTimeISO: () => new Date(timeStore.getTime() * 1000).toISOString(),
    getCamera: () => {
      const map = mapRef.current;
      if (!map) {
        return { lng: DEFAULT_CAMERA.center[0], lat: DEFAULT_CAMERA.center[1], zoom: DEFAULT_CAMERA.zoom };
      }
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat, zoom: map.getZoom() };
    },
  }), [handleBulkSetVisibility, handleAllOff, handleLocationJump, setFeatureInfo, layerVisibilityRef]);

  // ── Render ──

  // LoadingScreen 改為 overlay（fixed, zIndex 9999）蓋在主 UI 上，
  // 讓 Mapbox + Three.js 場景在 loading 期間於底下平行初始化；
  // 舊版 early return 會讓地圖等 loading 收掉才開始載，造成進場後動態點空窗。
  //
  // 一次性：只在初次 mount 顯示，dismissedLoading=true 後絕不重開。
  // 之後使用者 toggle 動態圖層的 loading 由 loadingRegistry 的小型 indicator 處理，
  // 不再用 full-screen splash 蓋整個畫面（會打斷已經在用地圖的使用者）。
  const showLoadingScreen = !loadingTimedOut && !dismissedLoading;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {showLoadingScreen && <LoadingScreen steps={loadingSteps} />}
      {/* owner-only 私人圖層：已登入非 owner 點鎖層時的提示（未登入則直接導 Google 登入，不走這裡） */}
      {gatedNotice && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3000,
            padding: "9px 16px",
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 10,
            color: "#E5E7EB",
            fontSize: 13,
            fontFamily: "Inter, system-ui, sans-serif",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
          }}
        >
          私人圖層，僅擁有者可檢視
        </div>
      )}
      {/* Day-loading overlay — 半透明遮罩 */}
      {(shipsDayLoading || flightsDayLoading || railScheduleLoading) && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            background: "rgba(0,0,0,0.8)", borderRadius: 12, padding: "24px 36px",
            color: "#fff", textAlign: "center", fontFamily: FONT_DATA,
          }}>
            <div style={{
              width: 32, height: 32, margin: "0 auto 12px",
              border: "3px solid rgba(255,255,255,0.15)",
              borderTop: "3px solid #64aaff",
              borderRadius: RADIUS.full,
              animation: "day-loading-spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes day-loading-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 600, marginBottom: 6 }}>
              資料更新中
            </div>
            <div style={{ fontSize: FONT_SIZE.md, opacity: 0.7 }}>
              {[
                shipsDayLoading && "船舶",
                flightsDayLoading && "航班",
                railScheduleLoading && "鐵道時刻表",
              ].filter(Boolean).join("、") + "資料載入中…"}
            </div>
          </div>
        </div>
      )}
      <MapView
        preset={preset}
        styleUrl={styleUrl}
        pureBlack={mapStyleId === "black"}
        flights={displayedFlights}
        renderMode={renderMode}
        isDarkTheme={isDarkTheme}
        showTrails={showTrails}
        layerVisibility={layerVisibility}
        overlayParams={transportParams.overlayParams}
        onMapReady={handleMapReady}
      />

      {/* ── 拍攝模式 vignette + 標題 ── */}
      {captureMode && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.6) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: isMobile ? 16 : 32,
              left: isMobile ? 16 : 32,
              zIndex: 21,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 20 : 28,
                fontFamily: FONT_DATA,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: isMobile ? 2 : 4,
                textShadow: "0 2px 12px rgba(0,0,0,0.6)",
              }}
            >
              Mini Taiwan Pulse
            </div>
            <div
              style={{
                fontSize: FONT_SIZE.xl,
                fontFamily: FONT_DATA,
                fontWeight: 600,
                color: COLORS.textDefault,
                letterSpacing: 2,
                marginTop: 6,
                textShadow: "0 1px 8px rgba(0,0,0,0.5)",
              }}
            >
              Taiwan Transport Visualization
            </div>
            <div
              style={{
                fontSize: FONT_SIZE.lg,
                fontFamily: FONT_DATA,
                color: COLORS.textDim,
                letterSpacing: 1,
                marginTop: 4,
                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              }}
            >
              {new Date(timeline.currentTime * 1000).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </div>
            <div
              style={{
                fontSize: FONT_SIZE.lg,
                fontFamily: FONT_DATA,
                color: COLORS.textDim,
                letterSpacing: 1,
                marginTop: 4,
                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              }}
            >
              {cameraInfo.lat}, {cameraInfo.lng} z{cameraInfo.zoom} pitch {cameraInfo.pitch} bearing {cameraInfo.bearing}
            </div>
          </div>
          <button
            onClick={() => setCaptureMode(false)}
            style={isMobile ? {
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 21,
              width: 48,
              height: 48,
              borderRadius: 24,
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: FONT_SIZE.xxl,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            } : {
              position: "absolute",
              bottom: 32,
              right: 32,
              zIndex: 21,
              padding: "4px 12px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: RADIUS.md,
              color: COLORS.textDim,
              fontSize: FONT_SIZE.base,
              fontFamily: FONT_DATA,
              cursor: "pointer",
            }}
          >
            {isMobile ? "✕" : "ESC"}
          </button>
        </>
      )}

      {/* ── 一般模式 UI ── */}
      {!captureMode && !isMobile && (
        <>
          {/* Row 1: 標題 + 樣式 + 地點跳轉 */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: sidebarWidth + 16,
              zIndex: 10,
              display: "flex",
              gap: 10,
              alignItems: "center",
              transition: "left 0.2s ease",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: FONT_SIZE.xl,
                color: isDarkTheme ? "#fff" : "#333",
                fontFamily: FONT_DATA,
                letterSpacing: 2,
              }}
            >
              Mini Taiwan Pulse
            </h1>

            <StyleSelector
              selected={mapStyleId}
              isDarkTheme={isDarkTheme}
              onChange={setMapStyleId}
            />

            {loading && (
              <span style={{ color: isDarkTheme ? COLORS.textMuted : "rgba(0,0,0,0.45)", fontSize: FONT_SIZE.lg }}>
                Loading...
              </span>
            )}
          </div>

          {/* Energy MVP: 供電燈號 HUD 已搬 monitor 面板（v1.5 TODO），
              hooks/類型保留供整合時複用，地圖上不渲染卡片 */}

          {/* Icon Rail + Sliding Panel Sidebar */}
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 11, pointerEvents: "none" }}>
            <IconRailSidebar
              isDarkTheme={isDarkTheme}
              visibility={layerVisibility}
              lockedKeys={lockedKeys}
              expandedLayer={expandedLayer}
              viewMode={viewMode}
              displayMode={displayMode}
              counts={sidebarCounts}
              onLayerClick={handleLayerClick}
              onToggleVisibility={handleToggleVisibility}
              onViewModeChange={setViewMode}
              onDisplayModeChange={handleDisplayModeChange}
              onHideTransport={handleHideTransport}
              onAllOff={handleAllOff}
              onBulkSetVisibility={handleBulkSetVisibility}
              getControls={transportParams.getControls}
              currentLocationId={selectedAirport}
              onLocationJump={handleLocationJump}
              onWidthChange={handleSidebarWidthChange}
              dataRegistry={dataRegistry}
              selectedDate={timeline.selectedDate}
              onDateSelect={timeline.setSelectedDate}
              onIntelToggle={() => {
                if (!intelOpen) {
                  // 開啟 Intel → 同時關 Satellite + 收 rail Layers/Locations panel
                  satelliteConsoleStore.setOpen(false);
                  setRailCloseEpoch((e) => e + 1);
                }
                setIntelOpen((v) => !v);
              }}
              intelActive={intelOpen}
              onSatelliteToggle={() => {
                if (!satConsole.open) {
                  // 開啟 Satellite → 同時關 Intel + 收 rail Layers/Locations panel
                  setIntelOpen(false);
                  setRailCloseEpoch((e) => e + 1);
                }
                satelliteConsoleStore.toggleOpen();
              }}
              satelliteActive={satConsole.open}
              externalCloseEpoch={railCloseEpoch}
            />
          </div>

          {/* 衛星情報 Satellite Console */}
          <SatelliteConsole
            open={satConsole.open}
            onClose={() => satelliteConsoleStore.setOpen(false)}
            layerVisibility={layerVisibility}
            setLayerVisibility={(next) => setLayerVisibility({ ...layerVisibility, ...next })}
            onFlyTo={(lon, lat) => mapRef.current?.flyTo({ center: [lon, lat], zoom: 3.5, speed: 1.4, pitch: 0 })}
          />

          {/* 即時情報 Intel Panel */}
          <IntelPanel
            open={intelOpen}
            onClose={() => setIntelOpen(false)}
            filter={newsFilter}
            onFilterChange={(next) => {
              transportParams.setNewsMinRelevance(next.minRelevance);
              transportParams.setNewsEventsOnly(next.eventsOnly);
              transportParams.setNewsMinSeverity(next.minSeverity);
            }}
            onSelectLocation={(lon, lat) => {
              mapRef.current?.flyTo({ center: [lon, lat], zoom: 12, speed: 1.2 });
            }}
          />

          {/* Monitor Mode 戰情看板（底部上拉） */}
          <MonitorPanel
            open={monitorOpen}
            onClose={() => setMonitorOpen(false)}
            filter={newsFilter}
            onFilterChange={(next) => {
              transportParams.setNewsMinRelevance(next.minRelevance);
              transportParams.setNewsEventsOnly(next.eventsOnly);
              transportParams.setNewsMinSeverity(next.minSeverity);
            }}
            onSelectLocation={(lon, lat) => {
              mapRef.current?.flyTo({ center: [lon, lat], zoom: 11, speed: 1.2 });
            }}
          />


          {/* 時間軸：依 mode 切換 realtime / historical */}
          {appMode === "realtime" ? (
            <TimelineControls
              playing={timeline.playing}
              speed={timeline.speed}
              progress={timeline.progress}
              currentTime={timeline.currentTime}
              timeMode={timeline.timeMode}
              selectedDate={timeline.selectedDate}
              rangeDays={timeline.rangeDays}
              windowStart={timeline.windowStart}
              windowEnd={timeline.windowEnd}
              isDarkTheme={isDarkTheme}
              leftOffset={sidebarWidth + 16}
              onToggle={timeline.toggle}
              onSpeedChange={timeline.setSpeed}
              onSeekByProgress={timeline.seekByProgress}
              onTimeModeChange={timeline.setTimeMode}
              onDateChange={timeline.setSelectedDate}
              onShiftDate={timeline.shiftDate}
              onRangeDaysChange={timeline.setRangeDays}
            />
          ) : (
            <HistoricalTimeline
              year={historicalYear}
              month={historicalMonth}
              day={historicalDay}
              availableYears={HISTORICAL_YEARS}
              playing={historicalPlaying}
              speed={historicalSpeed}
              granularity={historicalGranularity}
              isDarkTheme={isDarkTheme}
              leftOffset={sidebarWidth + 16}
              onTogglePlay={() => setHistoricalPlaying((v) => !v)}
              onSpeedChange={setHistoricalSpeed}
              onYearChange={setHistoricalYear}
              onMonthChange={setHistoricalMonth}
              onDayChange={setHistoricalDay}
              onGranularityChange={setHistoricalGranularity}
              reActive={realEstateActive}
              reGran={reGran}
              onReGranChange={(g) => { setReGran(g); if (g === "quarter") setReCursorTs((t) => snapQuarterStart(t)); }}
              reCursorTs={reCursorTs}
              reCursorMin={RANGE_START}
              reCursorMax={RANGE_END}
              reCursorStep={DAY}
              reCursorLabel={reLabel(reGran, reCursorTs)}
              onReCursorChange={(ts) => setReCursorTs(reGran === "quarter" ? snapQuarterStart(ts) : ts)}
            />
          )}

          {/* 右上角按鈕群 */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <ModeToggle
              appMode={appMode}
              isDarkTheme={isDarkTheme}
              onAppModeChange={(mode: AppMode) => {
                sessionTracker.log("mode_switch", { from: appMode, to: mode });
                setAppMode(mode);
              }}
            />
            <button
              onClick={() => setCaptureMode(true)}
              style={{
                padding: "6px 14px",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                borderRadius: RADIUS.lg,
                color: isDarkTheme ? "#fff" : "#333",
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              Capture
            </button>
            <button
              onClick={() => {
                if (!monitorOpen) {
                  setIntelOpen(false);
                  satelliteConsoleStore.setOpen(false);
                }
                setMonitorOpen((v) => !v);
              }}
              title="監看模式 Monitor"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: monitorOpen
                  ? "#64aaff"
                  : (isDarkTheme ? "rgba(80,140,255,0.25)" : "rgba(80,140,255,0.15)"),
                border: `1px solid ${monitorOpen ? "#64aaff" : "rgba(80,140,255,0.5)"}`,
                borderRadius: RADIUS.lg,
                color: monitorOpen ? "#04121f" : (isDarkTheme ? "#fff" : "#333"),
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                fontWeight: monitorOpen ? 700 : 400,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              <svg
                width={13} height={13} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M3 3h7v7H3z" />
                <path d="M14 3h7v7h-7z" />
                <path d="M14 14h7v7h-7z" />
                <path d="M3 14h7v7H3z" />
              </svg>
              Monitor
              <span
                style={{
                  marginLeft: 2,
                  padding: "1px 5px",
                  borderRadius: RADIUS.md,
                  background: monitorOpen
                    ? "rgba(4,18,31,0.18)"
                    : "rgba(255,152,0,0.18)",
                  border: `1px solid ${monitorOpen ? "rgba(4,18,31,0.35)" : "rgba(255,152,0,0.55)"}`,
                  fontSize: FONT_SIZE.xs,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: monitorOpen ? "#04121f" : "#ff9800",
                }}
              >
                BETA
              </span>
            </button>
            <button
              onClick={() => setChatOpen((v) => !v)}
              title="AI 助手 BYOK Chat"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: chatOpen
                  ? "#64aaff"
                  : (isDarkTheme ? "rgba(80,140,255,0.25)" : "rgba(80,140,255,0.15)"),
                border: `1px solid ${chatOpen ? "#64aaff" : "rgba(80,140,255,0.5)"}`,
                borderRadius: RADIUS.lg,
                color: chatOpen ? "#04121f" : (isDarkTheme ? "#fff" : "#333"),
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                fontWeight: chatOpen ? 700 : 400,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              <MessageSquare size={13} />
              AI
            </button>
          </div>

          {/* 右上角第二排 */}
          <div
            style={{
              position: "absolute",
              top: 52,
              right: 16,
              zIndex: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setShowInfo(true)}
              style={{
                padding: "6px 14px",
                background: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                borderRadius: RADIUS.lg,
                color: isDarkTheme ? "#fff" : "#333",
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: 1,
              }}
            >
              Info
            </button>
            <UserAvatar isOwner={isOwner} onOpenAdmin={() => setAdminOpen(true)} isDarkTheme={isDarkTheme} />
          </div>

          {/* 操作提示 */}
          <div
            style={{
              position: "absolute",
              top: 84,
              right: 16,
              zIndex: 10,
              color: isDarkTheme ? COLORS.textFaint : "rgba(0,0,0,0.2)",
              fontSize: FONT_SIZE.sm,
              fontFamily: FONT_DATA,
              letterSpacing: 0.5,
              textAlign: "right",
            }}
          >
            Right-drag to rotate · Scroll to zoom
          </div>

          {/* 統計 + 相機角度 */}
          <div
            style={{
              position: "absolute",
              top: 48,
              left: sidebarWidth + 16,
              zIndex: 10,
              background: isDarkTheme ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)",
              backdropFilter: "blur(8px)",
              borderRadius: RADIUS.lg,
              padding: "4px 10px",
              transition: "left 0.2s ease",
            }}
          >
            <div
              style={{
                color: isDarkTheme ? COLORS.textDim : "rgba(0,0,0,0.45)",
                fontSize: FONT_SIZE.base,
                fontFamily: FONT_DATA,
              }}
            >
              {displayedFlights.length} flights
              {layerVisibility.ships && ` · ${shipSceneRef.current?.getVisibleCount() ?? 0} ships`}
              {layerVisibility.rail && ` · ${trainCount} trains`}
              {layerVisibility.busLive && ` · ${busCount} buses`}
              {layerVisibility.busIntercityLive && ` · ${busIntercityCount} intercity`}
              {layerVisibility.touristShuttleLive && ` · ${touristShuttleCount} 台灣好行`}
              {layerVisibility.wasteTruck && ` · ${wasteCount} waste`}
              {viewMode === "time-window" && " (±12h)"}
            </div>
            <div
              style={{
                color: isDarkTheme ? COLORS.textDim : "rgba(0,0,0,0.3)",
                fontSize: FONT_SIZE.base,
                fontFamily: FONT_DATA,
              }}
            >
              {cameraInfo.lat}, {cameraInfo.lng} z{cameraInfo.zoom} pitch {cameraInfo.pitch} bearing {cameraInfo.bearing}
            </div>
          </div>
        </>
      )}

      {/* ── 手機版 UI ── */}
      {!captureMode && isMobile && (
        <>
          {/* Compact Header */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 44,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              paddingTop: "env(safe-area-inset-top, 0px)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <span style={{ color: "#fff", fontSize: FONT_SIZE.lg, fontFamily: FONT_DATA, fontWeight: 700, letterSpacing: 1 }}>
              MTP
            </span>

            <div style={{ flex: 1 }} />

            {loading && (
              <span style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.base, fontFamily: FONT_DATA }}>
                Loading...
              </span>
            )}

            <button
              onClick={() => setShowInfo(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: RADIUS.xl,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Info
            </button>

            <button
              onClick={() => setCaptureMode(true)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: RADIUS.xl,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              Capture
            </button>

            <button
              onClick={() => setChatOpen((v) => !v)}
              title="AI 助手"
              style={{
                width: 36,
                height: 36,
                borderRadius: RADIUS.xl,
                background: chatOpen ? "#64aaff" : "rgba(80,140,255,0.25)",
                border: `1px solid ${chatOpen ? "#64aaff" : "rgba(80,140,255,0.5)"}`,
                color: chatOpen ? "#04121f" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageSquare size={16} />
            </button>

            <button
              onClick={() => setRenderMode((m) => (m === "3d" ? "2d" : "3d"))}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: RADIUS.xl,
                background: renderMode === "3d"
                  ? "rgba(80,140,255,0.25)"
                  : "rgba(255,170,68,0.25)",
                border: `1px solid ${renderMode === "3d" ? "rgba(80,140,255,0.5)" : "rgba(255,170,68,0.5)"}`,
                color: "#fff",
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_DATA,
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              {renderMode === "3d" ? "3D" : "2D"}
            </button>

            <UserAvatar isOwner={isOwner} onOpenAdmin={() => setAdminOpen(true)} />
          </div>

          {/* Timeline */}
          <div
            style={{
              position: "absolute",
              top: 44,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: "8px 12px",
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {appMode === "realtime" ? (
              <TimelineControls
                playing={timeline.playing}
                speed={timeline.speed}
                progress={timeline.progress}
                currentTime={timeline.currentTime}
                timeMode={timeline.timeMode}
                selectedDate={timeline.selectedDate}
                rangeDays={timeline.rangeDays}
                windowStart={timeline.windowStart}
                windowEnd={timeline.windowEnd}
                isDarkTheme={true}
                isMobile={true}
                onToggle={timeline.toggle}
                onSpeedChange={timeline.setSpeed}
                onSeekByProgress={timeline.seekByProgress}
                onTimeModeChange={timeline.setTimeMode}
                onDateChange={timeline.setSelectedDate}
                onShiftDate={timeline.shiftDate}
                onRangeDaysChange={timeline.setRangeDays}
              />
            ) : (
              <HistoricalTimeline
                year={historicalYear}
                month={historicalMonth}
                day={historicalDay}
                availableYears={HISTORICAL_YEARS}
                playing={historicalPlaying}
                speed={historicalSpeed}
                granularity={historicalGranularity}
                isDarkTheme={true}
                isMobile={true}
                onTogglePlay={() => setHistoricalPlaying((v) => !v)}
                onSpeedChange={setHistoricalSpeed}
                onYearChange={setHistoricalYear}
                onMonthChange={setHistoricalMonth}
                onDayChange={setHistoricalDay}
                onGranularityChange={setHistoricalGranularity}
              />
            )}
          </div>

          {/* Bottom Sheet */}
          <MobileBottomSheet isLandscape={isLandscape}>
            {(level) => (
              <>
                {(level === "half" || level === "full") && (
                  <div style={{ marginTop: 12 }}>
                    <LayerSidebar
                      visibility={layerVisibility}
                      lockedKeys={lockedKeys}
                      expandedLayer={expandedLayer}
                      viewMode={viewMode}
                      displayMode={displayMode}
                      isDarkTheme={true}
                      isMobile={true}
                      counts={{
                        flights: displayedFlights.length,
                        ships: shipSceneRef.current?.getVisibleCount() ?? ships.length,
                        trains: trainCount,
                        buses: busCount,
                        busesIntercity: busIntercityCount,
                        wasteTrucks: wasteCount,
                      }}
                      onLayerClick={(layer) => {
                        const isVisible = layerVisibility[layer];
                        if (!isVisible && handleGatedIntercept(layer)) return;
                        if (!isVisible) {
                          setLayerVisibility((prev) => ({ ...prev, [layer]: true }));
                          setExpandedLayer(layer as ExpandableLayerKey);
                        } else if (expandedLayer === layer) {
                          setExpandedLayer(null);
                        } else {
                          setExpandedLayer(layer as ExpandableLayerKey);
                        }
                        sessionTracker.logWithSnapshot("layer_toggle", { layer, on: !isVisible }, layerVisibilityRef.current);
                      }}
                      onToggleVisibility={handleToggleVisibility}
                      onViewModeChange={setViewMode}
                      onDisplayModeChange={(mode) => { setDisplayMode(mode); setTooltipInfo(null); }}
                      onHideTransport={() => {
                        if (expandedLayer) {
                          setLayerVisibility((prev) => ({ ...prev, [expandedLayer]: false }));
                          setExpandedLayer(null);
                        }
                      }}
                      onBulkSetVisibility={handleBulkSetVisibility}
                      getControls={transportParams.getControls}
                    />
                  </div>
                )}

                {level === "full" && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.base, fontFamily: FONT_DATA }}>Style</span>
                      <StyleSelector
                        selected={mapStyleId}
                        isDarkTheme={true}
                        onChange={setMapStyleId}
                      />
                    </div>
                    <LocationJump
                      isDarkTheme={true}
                      currentId={selectedAirport}
                      onJump={(id) => {
                        const p = getPresetById(id);
                        if (p && mapRef.current) {
                          if (p.category === "airport") setSelectedAirport(p.id);
                          mapRef.current.flyTo({
                            center: p.center,
                            zoom: p.zoom,
                            pitch: p.pitch,
                            bearing: p.bearing,
                            duration: 2000,
                          });
                        }
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </MobileBottomSheet>
        </>
      )}

      {/* ── 飛機 Tooltip ── */}
      {tooltipInfo && (
        <div
          style={{
            position: "absolute",
            left: tooltipInfo.x + 12,
            top: tooltipInfo.y - 10,
            zIndex: 30,
            background: "rgba(10,10,20,0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(100,170,255,0.4)",
            borderRadius: RADIUS.xl,
            padding: "10px 14px",
            pointerEvents: "none",
            fontFamily: FONT_DATA,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
            {tooltipInfo.flight.callsign}
          </div>
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault, marginTop: 4 }}>
            {tooltipInfo.flight.origin_iata} → {tooltipInfo.flight.dest_iata}
          </div>
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted, marginTop: 2 }}>
            {tooltipInfo.flight.aircraft_type}
            {tooltipInfo.altitude != null && ` · ${tooltipInfo.altitude}m`}
          </div>
          <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(100,170,255,0.6)", marginTop: 4 }}>
            double-click to track
          </div>
        </div>
      )}

      {/* ── 列車 Tooltip ── */}
      {trainTooltipInfo && (
        <div
          style={{
            position: "absolute",
            left: trainTooltipInfo.x + 12,
            top: trainTooltipInfo.y - 10,
            zIndex: 30,
            background: "rgba(10,10,20,0.9)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${trainTooltipInfo.train.color}66`,
            borderRadius: RADIUS.xl,
            padding: "10px 14px",
            pointerEvents: "none",
            fontFamily: FONT_DATA,
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: trainTooltipInfo.train.color, letterSpacing: 1 }}>
            {trainTooltipInfo.train.trainId}
          </div>
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault, marginTop: 4 }}>
            {trainTooltipInfo.train.systemId.toUpperCase()} · {trainTooltipInfo.train.trackId}
          </div>
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted, marginTop: 2 }}>
            {trainTooltipInfo.train.status === "running" ? "行駛中" : "停靠中"}
            {trainTooltipInfo.train.trainTypeCode && ` · ${trainTooltipInfo.train.trainTypeCode}`}
          </div>
          <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 2 }}>
            {trainTooltipInfo.train.position[0].toFixed(4)}, {trainTooltipInfo.train.position[1].toFixed(4)}
          </div>
        </div>
      )}

      {/* ── 公車 Tooltip ── */}
      {busTooltipInfo && (
        <div
          style={{
            position: "absolute",
            left: busTooltipInfo.x + 12,
            top: busTooltipInfo.y - 10,
            zIndex: 30,
            background: "rgba(10,10,20,0.9)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${busTooltipInfo.bus.color}66`,
            borderRadius: RADIUS.xl,
            padding: "10px 14px",
            pointerEvents: "none",
            fontFamily: FONT_DATA,
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: busTooltipInfo.bus.color, letterSpacing: 1 }}>
            {busTooltipInfo.bus.routeName}
          </div>
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault, marginTop: 4 }}>
            {busTooltipInfo.bus.plateNumb} · {busTooltipInfo.bus.city}
          </div>
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted, marginTop: 2 }}>
            {busTooltipInfo.bus.status === "running" ? "行駛中" : "停靠中"}
            {busTooltipInfo.bus.speed > 0 && ` · ${busTooltipInfo.bus.speed.toFixed(0)} km/h`}
          </div>
          <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 2 }}>
            {busTooltipInfo.bus.position[1].toFixed(4)}, {busTooltipInfo.bus.position[0].toFixed(4)}
          </div>
        </div>
      )}

      {/* ── 房地產 hover Tooltip ── */}
      {realEstateTooltipInfo && (() => {
        const { x, y, kind, properties: p } = realEstateTooltipInfo;
        const typeStr = String(p.type ?? "");
        const typeLabel = typeStr === "rental" ? "租賃" : typeStr === "sale" ? "買賣" : typeStr === "presale" ? "預售" : typeStr;
        const accent = typeStr === "rental" ? "#38bdf8" : typeStr === "sale" ? "#16a34a" : "#9333ea";
        const num = (v: unknown) => (v == null || v === "" ? "—" : Number(v).toLocaleString());
        const periodStr = String(p.period ?? "");
        const periodLabel = periodStr === "ALL" ? "全期" : periodStr;
        return (
          <div
            style={{
              position: "absolute",
              left: x + 12,
              top: y - 10,
              zIndex: 30,
              background: "rgba(10,10,20,0.9)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${accent}66`,
              borderRadius: RADIUS.xl,
              padding: "10px 14px",
              pointerEvents: "none",
              fontFamily: FONT_DATA,
              minWidth: 200,
            }}
          >
            {kind === "grid" ? (
              <>
                <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: accent, letterSpacing: 1 }}>
                  {typeLabel} · {periodLabel}
                </div>
                <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 2 }}>
                  格 {String(p.grid_id ?? "—")} · {num(p.n_tx)} 筆
                </div>
                <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault, marginTop: 4 }}>
                  單價中位 {num(p.price_per_sqm_median)} 元/m²
                </div>
                <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted, marginTop: 2 }}>
                  總價中位 {num(p.price_median)} 元
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: accent, letterSpacing: 1 }}>
                  {typeLabel} · {String(p.district ?? "")}
                </div>
                <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 2 }}>
                  {String(p.address ?? "—")}
                </div>
                <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault, marginTop: 4 }}>
                  單價 {num(p.price_per_sqm)} 元/m²
                </div>
                <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted, marginTop: 2 }}>
                  總價 {num(p.total_price)} 元 · {num(p.area_sqm)} m²
                </div>
                {p.trade_ts != null && Number(p.trade_ts) > 0 && (
                  <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 2 }}>
                    交易日 {tsToDate(Number(p.trade_ts))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── 垃圾車表定 Tooltip (debug) ── */}
      {wasteScheduleTooltipInfo && (() => {
        const { frame, x, y } = wasteScheduleTooltipInfo;
        const fmt = (sec: number) => {
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = Math.floor(sec % 60);
          return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
        };
        const fmtGap = (sec: number) => {
          if (sec < 60) return `${Math.round(sec)}s`;
          if (sec < 3600) return `${Math.floor(sec/60)}m ${Math.round(sec%60)}s`;
          return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;
        };
        const stateColor =
          frame.state === "moving" ? "#a78bfa" :
          frame.state === "waiting" ? "#fbbf24" :
          "#94a3b8";
        const isTripBreak = frame.gapToNextSec > WASTE_SCHEDULE_TRIP_BREAK_S && frame.state === "moving";
        return (
          <div
            style={{
              position: "absolute",
              left: x + 12,
              top: y - 10,
              zIndex: 30,
              background: "rgba(10,10,20,0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid #a78bfa66",
              borderRadius: RADIUS.xl,
              padding: "10px 14px",
              pointerEvents: "none",
              fontFamily: FONT_DATA,
              minWidth: 280,
              maxWidth: 360,
            }}
          >
            <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#a78bfa", letterSpacing: 1 }}>
              {frame.route.city} · {frame.route.routeName ?? frame.route.routeId}
            </div>
            <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 2 }}>
              route_id: {frame.route.routeId} · {frame.totalStops} stops · {frame.route.vehicleType}
            </div>

            {frame.route.scheduleInferred && (
              <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: "#fbbf24", fontWeight: 600 }}>
                ⚠ 此路線無精確時刻，時間為推算（直線距離×1.4 ÷ 15km/h + 每站停 3 min）
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: FONT_SIZE.base, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: stateColor, fontWeight: 700 }}>
                {frame.state === "moving" ? "● 移動中" :
                 frame.state === "waiting" ? "● 停留中" :
                 frame.state === "before-route" ? "○ 路線未開始" : "○ 路線已結束"}
              </span>
              <span style={{ color: COLORS.textMuted }}>now {fmt(frame.nowSec)}</span>
            </div>

            {isTripBreak && (
              <div style={{ marginTop: 6, fontSize: FONT_SIZE.base, color: "#ef4444", fontWeight: 700 }}>
                ⚠ 班次切換 gap={fmtGap(frame.gapToNextSec)}（&gt; {Math.round(WASTE_SCHEDULE_TRIP_BREAK_S / 60)}min 應 invisible）
              </div>
            )}

            <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(255,255,255,0.15)", fontSize: FONT_SIZE.base, color: COLORS.textStrong }}>
              <div style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 }}>
                ↓ 上一站 (#{frame.prevStop.stopSeq}/{frame.totalStops})
              </div>
              <div>{frame.prevStop.stopName ?? "(no name)"}</div>
              <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 }}>
                arrival {fmt(frame.prevStop.arrivalSec)} · departure {fmt(frame.prevStop.departureSec)}
                {frame.prevStop.departureSec > frame.prevStop.arrivalSec &&
                  ` · 停 ${fmtGap(frame.prevStop.departureSec - frame.prevStop.arrivalSec)}`}
              </div>
            </div>

            {frame.nextStop && (
              <div style={{ marginTop: 6, fontSize: FONT_SIZE.base, color: COLORS.textStrong }}>
                <div style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 }}>
                  ↓ 下一站 (#{frame.nextStop.stopSeq}/{frame.totalStops})
                </div>
                <div>{frame.nextStop.stopName ?? "(no name)"}</div>
                <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 }}>
                  arrival {fmt(frame.nextStop.arrivalSec)}
                  {" · gap "}
                  <span style={{ color: isTripBreak ? "#ef4444" : COLORS.textMuted }}>
                    {fmtGap(frame.gapToNextSec)}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Bottom-right stack: Feature Info + AQI controls + Legend ── */}
      <div
        style={{
          position: "absolute",
          bottom: 64,
          right: 16,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {featureInfo && (
          <div style={{ pointerEvents: "auto" }}>
            <FeatureInfoPanel
              feature={featureInfo}
              onClose={() => setFeatureInfo(null)}
              reservoirContext={reservoirContext}
              isDarkTheme={isDarkTheme}
            />
          </div>
        )}
        {(layerVisibility.aqiImagery || layerVisibility.aqiStations || layerVisibility.aqiMicroSensors) && (
          <>
            {layerVisibility.aqiImagery && (
              <div style={{ pointerEvents: "auto" }}>
                <AqiProductSwitcher
                  current={aqiProduct}
                  onChange={setAqiProduct}
                  isDark={isDarkTheme}
                />
              </div>
            )}
            <div style={{ pointerEvents: "auto" }}>
              <AqiLegend
                isDark={isDarkTheme}
                caption={layerVisibility.aqiMicroSensors ? "LASS 點位以 PM2.5 濃度配色" : undefined}
              />
            </div>
          </>
        )}
        <div style={{ pointerEvents: "auto" }}>
          <LegendPanel visibility={layerVisibility} overlayParams={transportParams.overlayParams} isDarkTheme={isDarkTheme} />
        </div>
      </div>

      {/* ── 全域 loading 指示器 ── */}
      <LoadingIndicator />

      {/* ── Info Modal ── */}
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} isMobile={isMobile} isDarkTheme={isDarkTheme} />
      {isOwner && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} selfId={memberUser?.id ?? null} />}

      {/* ── BYOK 對話浮層（桌機右側 / 手機底部上拉，自帶 mobile 版型）── */}
      <ChatPanel
        isDarkTheme={isDarkTheme}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        bridge={chatBridge}
        runChatTurn={runChatTurn}
        onTestKey={testKey}
        compact={featureInfo !== null}
      />

      {/* ── 資料來源總覽（Step 4 SSOT bridge UI，右下浮動按鈕）── */}
      <DataSourceBrowser isDarkTheme={isDarkTheme} />
    </div>
  );
}
