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
// AR-22 P4：`useLayerParamsRuntime` 已整支退役。參數的消費端各自 per-key 訂閱
// （圖層在 LayerHost、面板在自己內部、Three.js 走 layerParamRefs 模組級鏡像）。
import { layerParamsStore } from "./state/layerParamsStore";
import { layerParamRefs } from "./state/layerParamRefs";
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
// ⚠️ AR-22 P1：67 支 layer hook 的呼叫已搬進 `src/layers/`（Host 元件 + 有序 registry）。
//    它們的 import 隨之遷出本檔 —— 要找某層掛在哪，查 layerHookRegistry.ts 的 id。
import { useReservoirContextLayer } from "./hooks/useReservoirContextLayer";
import type { ReservoirScene } from "./three/ReservoirScene";
import type { ReservoirStatus } from "./data/reservoirStatusLoader";
import { todayTaiwan } from "./lib/supabase";
// Energy MVP：dashboard 資料源留在 App（dataRef 餵 LayerHost 的 region bars）
import { usePowerDashboard } from "./hooks/usePowerDashboard";
import { AqiProductSwitcher } from "./components/AqiProductSwitcher";
import type { AqiProduct } from "./types";
import { useH3Data } from "./hooks/useH3Data";
import { useTemperatureData } from "./hooks/useTemperatureData";
import { useDemographicsH3, useDemographicsYearlyH3 } from "./hooks/useDemographicsH3";
import { useH3Socioeconomic } from "./hooks/useH3Socioeconomic";
import { useH3SpatialEconomy } from "./hooks/useH3SpatialEconomy";
import { useYoubikeH3 } from "./hooks/useYoubikeH3";
import { getH3Resolution } from "./map/h3LayerFactory";
import { DEFAULT_CAMERA, getPresetById } from "./map/cameraPresets";
// filterByTimeWindow removed — airspace shows all flights, isFlightActive handles visibility
import { LocationJump } from "./components/AirportSelector";
import { LayerSidebar } from "./components/LayerSidebar";
import { IconRailSidebar } from "./components/IconRailSidebar";
import { DataSourceBrowser } from "./components/DataSourceBrowser";
import { IntelPanel } from "./components/intel/IntelPanel";
import { MonitorPanel } from "./components/intel/monitor/MonitorPanel";
import { MONITOR_SPLIT_CAMERA, MONITOR_SPLIT_DOCK, type MonitorMode } from "./components/intel/monitor/monitorSplitLayout";
import { SatelliteConsole } from "./components/satelliteConsole/SatelliteConsole";
import { PropertyValuePanel } from "./components/PropertyValuePanel";
import { EarthquakeReplayPanel } from "./components/EarthquakeReplayPanel";
import { earthquakeReplayClock } from "./state/earthquakeReplayClock";
import { satelliteConsoleStore, useSatelliteConsole } from "./state/satelliteConsoleStore";
import { useSatelliteManeuvers } from "./hooks/useSatelliteManeuvers";
import { TimelineControls } from "./components/TimelineControls";
import { HistoricalTimeline, type HistoricalGranularity } from "./components/HistoricalTimeline";
import { RANGE_START, RANGE_END, DAY, reLabel, snapQuarterStart, tsToDate, type ReGran } from "./lib/realEstateTime";
import { ModeToggle } from "./components/ModeToggle";
import { StyleSelector, getStyleUrl } from "./components/StyleSelector";
import { parseUrlState, buildUrl, type UrlState } from "./lib/urlState";
import { ShareModal } from "./components/ShareModal";
import { MobileBottomSheet } from "./components/MobileBottomSheet";
import { InfoModal } from "./components/InfoModal";
import { UserAvatar } from "./components/auth/UserAvatar";
import { AdminPanel } from "./components/admin/AdminPanel";
import { useMemberGate, signInWithGoogle } from "./lib/auth";
import { GATED_LAYERS } from "./components/sidebar/layerCatalog";
import { useLayerGates, loadLayerGates, isLayerLocked } from "./lib/layerGates";
import { FeatureInfoPanel } from "./components/FeatureInfoPanel";
import { HEADER_LABELS } from "./components/featureInfo/registry";
import { ChatPanel } from "./components/chat/ChatPanel";
import { runChatTurn, testKey } from "./chat/agent";
import type { MapBridge } from "./chat/types";
import { MessageSquare } from "lucide-react";
import { LegendPanel } from "./components/LegendPanel";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { LoadingScreen } from "./components/LoadingScreen";
import { LayerHosts } from "./layers/LayerHost";
import { bumpHostRender, type LayerHostDeps } from "./layers/layerHostDeps";

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
  // dev-only render 計數（`window.__layerRenderCounts`）——
  // 第 4 階段（App 端解除全店訂閱）要證明「拖一個 slider 只有那一個 Host 重跑」。
  // 現況 App 與所有 Host 是同步跳動的，那就是要被打破的基準線。
  bumpHostRender("App");

  // EM-03 深連結：mount 時解析一次即凍結。**刻意用 ref 不用 state** ——
  // URL 只是「初始畫面」，之後使用者的操作才是真實狀態；若讓它進 deps
  // 會在每次操作後把鏡頭拉回網址指定的位置。
  const urlStateRef = useRef<UrlState>(parseUrlState(window.location.search));

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

  // 3D 溫度波與 2D 溫度網格共用同一份資料（任一層開啟就抓）
  const temperatureEnabled = layerVisibility.temperatureWave || layerVisibility.temperatureGrid;
  const { temperatureData, temperatureLoading, temperatureTimeRange } = useTemperatureData(temperatureEnabled);

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
  // EM-19：底圖樣式吃網址的 style=（未知 id 由 getStyleUrl 自行 fallback 到預設）
  const [mapStyleId, setMapStyleId] = useState(() => urlStateRef.current.style ?? "dark");
  const [renderMode, setRenderMode] = useState<RenderMode>("3d");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("status");
  const [captureMode, setCaptureMode] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
    // registry id 沿用 "temperatureWave"（= 溫度資料源）；2D 網格共用同一份，任一層開啟都要納入 timeline
    if (layerVisibility.temperatureWave || layerVisibility.temperatureGrid) enabledIds.push("temperatureWave");
    const range = dataRegistry.getTimelineRange(enabledIds);
    // fallback: 如果 registry 還沒資料，用航班的 timeRange
    if (range.start === 0 && range.end === 0) return timeRange;
    return range;
  }, [dataRegistry.sources, layerVisibility.flights, layerVisibility.ships, layerVisibility.newsEvents, layerVisibility.temperatureWave, layerVisibility.temperatureGrid, timeRange]);

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
  const { busCount, activeBusesRef, loadDay: loadBusTrailDay } = useBusLayer(layerVisibility.busLive, timeline.timeMode);
  const { busCount: busIntercityCount, activeBusesRef: activeBusesIntercityRef, loadDay: loadBusIntercityTrailDay } =
    useBusIntercityLayer(layerVisibility.busIntercityLive, timeline.timeMode);
  const { busCount: touristShuttleCount, activeBusesRef: activeBusesTouristShuttleRef, loadDay: loadTouristShuttleTrailDay } =
    useTouristShuttleLayer(layerVisibility.touristShuttleLive, timeline.timeMode);

  // ── 垃圾車（高雄主城，60s polling 軌跡 + 後端去噪/stop snapping）+ 音符特效 ──
  const { trailsRef: wasteTrailsRef, count: wasteCount, loadDay: loadWasteTrailDay } =
    useWasteLayer(layerVisibility.wasteTruck, timeline.timeMode, ["高雄市", "臺南市"]);

  // ── 垃圾車表定（22 城時刻表動畫，獨立於 GPS 圖層；day-of-week 驅動）──
  // cities（8 區分組 toggle）由 hook 自己從 store 讀
  const { routesRef: wasteScheduleRoutesRef } =
    useWasteScheduleLayer(layerVisibility.wasteSchedule);

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
  // ── 房地產總市值面板（縣市長條圖，IconRail 開關；非地圖層） ──
  const [propertyValueOpen, setPropertyValueOpen] = useState(false);
  // 4-way panel mutex：每次 Intel/Satellite/PropertyValue 開啟時 +1，IconRailSidebar 收起 Layers/Locations
  const [railCloseEpoch, setRailCloseEpoch] = useState(0);
  // ── Monitor Mode（戰情看板，底部上拉） ──
  const [monitorOpen, setMonitorOpen] = useState(false);
  // Monitor 呈現模式：dock（底部浮層，預設）/ wall（近全屏）/ split（右半邊，rail icon 入口）
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("dock");
  const splitActive = monitorOpen && monitorMode === "split";
  /**
   * 進入 split 時把鏡頭帶到「台灣整島落在左半可視區」的預設視角，並套用視野讓位。
   *
   * 兩件事**必須在同一個動畫裡**：分成 `easeTo({padding})` ＋ `flyTo({center})`
   * 兩個 effect 的話，後發的 flyTo 會立刻取消前一個 easeTo，padding 過渡半路夭折。
   *
   * deps 只有 splitActive → 之後手動平移縮放不會被拉回；退出 split 不還原視角，
   * 只把 padding 歸零（視野讓位是 dock 造成的，dock 收起來就該還原）。
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const right = splitActive ? MONITOR_SPLIT_DOCK.mapPaddingRight : 0;
    const padding = { left: 0, top: 0, bottom: 0, right };
    if (splitActive && MONITOR_SPLIT_CAMERA.autoFrame) {
      map.flyTo({
        center: MONITOR_SPLIT_CAMERA.center,
        zoom: MONITOR_SPLIT_CAMERA.zoom,
        pitch: MONITOR_SPLIT_CAMERA.pitch,
        bearing: MONITOR_SPLIT_CAMERA.bearing,
        duration: MONITOR_SPLIT_CAMERA.durationMs,
        padding,
      });
      return;
    }
    // 沒有要飛（autoFrame 關掉、或正在退出 split）→ 只處理 padding，且沒變就別動
    if (right === 0 && !map.getPadding().right) return;
    map.easeTo({ padding, duration: 400 });
  }, [splitActive]);
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
  // 民國年。114/115（2025/2026）是為共機活動區加的 —— 人口 104~113、
  // 火災 111~113 在那兩年沒有資料，但「該年該圖層沒東西」本來就是常態
  //（例如火災在 104~110 也是空的），不需要為此拆成 per-layer 年份清單。
  const HISTORICAL_YEARS = useMemo(
    () => [104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115],
    [],
  );
  // 火災資料覆蓋範圍（民國 111~113）— 月/日推進的上限
  const FIRE_MAX_YEAR = 113;
  // 共機活動區已向量化到 115 年（2026）。開著它時月/日推進要能走到 115，
  // 沒開就維持火災的 113 上限，不改變既有行為。
  const monthDayMaxYear = layerVisibility.plaActivity ? 115 : FIRE_MAX_YEAR;

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
            if (y >= monthDayMaxYear) {
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
          if (ny > monthDayMaxYear) {
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
  }, [appMode, historicalPlaying, historicalSpeed, historicalGranularity, historicalYear, historicalMonth, HISTORICAL_YEARS, monthDayMaxYear, realEstateActive]);

  // 切到 historical mode 時，記住既有 layerVisibility 並切到「歷史專屬」可見集合；
  // 切回 realtime 時還原。避免使用者在歷史模式看到大量無法解讀的即時圖層。
  const layerVisBeforeHistoricalRef = useRef<LayerVisibility | null>(null);
  useEffect(() => {
    if (appMode === "historical") {
      if (layerVisBeforeHistoricalRef.current === null) {
        layerVisBeforeHistoricalRef.current = layerVisibilityRef.current;
      }
      // 全部關掉、預設打開人口。共機活動區例外 —— 它本來就是逐日回顧型資料，
      // 在歷史模式完全可解讀，關掉反而是把使用者剛開的圖層吃掉
      const current = layerVisibilityRef.current;
      const allOff = { ...current };
      for (const k of Object.keys(allOff) as (keyof LayerVisibility)[]) {
        allOff[k] = false;
      }
      setLayerVisibility({ ...allOff, popCount: true, plaActivity: current.plaActivity });
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

  // 房地產時間軸 / 「點」CustomLayer 的 hook 已搬進 LayerHost
  //（useRealEstateTimeline / useRealEstatePointsLayer，見 layerHookRegistry）
  const stopHistorical = useCallback(() => setHistoricalPlaying(false), []);

  const { socioDataMap, loadSocioResolution } = useH3Socioeconomic();
  const { spatialDataMap, loadSpatialResolution } = useH3SpatialEconomy();

  // H3 resolution state (driven by zoom) — 必須在 useYoubikeH3 之前宣告
  const [h3Resolution, setH3Resolution] = useState(7);
  const [demoResolution, setDemoResolution] = useState(7);

  const { getCellsForTime: getYoubikeCellsForTime } = useYoubikeH3(layerVisibility.youbikeFullness);

  const {
    flightSceneRef, shipSceneRef, railSceneRef, busSceneRef,
    busIntercitySceneRef,
    touristShuttleSceneRef,
    wasteTruckSceneRef,
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
  });

  const { tooltipInfo, setTooltipInfo, trainTooltipInfo, busTooltipInfo, wasteScheduleTooltipInfo, realEstateTooltipInfo, featureInfo, setFeatureInfo, bindEvents } =
    useMapInteraction(mapRef, flightSceneRef, flightsRef, timeRef, railSceneRef, busSceneRef, shipSceneRef, layerVisibilityRef, reservoirSceneRef, wasteScheduleSceneRef, touristShuttleSceneRef, busIntercitySceneRef, wasteTruckSceneRef);

  // ── 水庫 context 動態疊層 + panel 資料 ──
  // 點水庫（waterDam / waterReservoirPoly）且 feature 帶 compare_id → 打 get_reservoir_context
  const activeReservoirId: number | null = (() => {
    if (!featureInfo) return null;
    if (featureInfo.layerType !== "waterDam" && featureInfo.layerType !== "waterReservoirPoly") return null;
    const id = featureInfo.properties.compare_id;
    return typeof id === "number" && id > 0 ? id : null;
  })();
  const reservoirContext = useReservoirContextLayer(mapRef, activeReservoirId);

  // 點選光暈 + 水庫水位計 + 水資源 12 層的 hook 已搬進 LayerHost
  //（useSelectedFeatureHalo / useReservoirStatusLayer / useRainGauge… 見 layerHookRegistry）

  // News 三軸 filter 已無 App 端消費者：圖層在 LayerHost、兩個情報面板
  // 各自 per-key 訂閱同一個 store slot（見 hooks/useNewsFilter.ts）。

  // ── Energy MVP（Phase C/D/E）──
  // dashboard 共用：HUD + region bars 不同時 toggle 也只拉一次。
  // ⚠️ 留在 App：`dataRef` 是餵給 LayerHost 的 usePowerRegionBarsLayer 的跨 hook 依賴
  //（見 HOOKS_IN_APP_LEDGER），經 hostDeps 傳下去。
  const energyDashboardActive =
    layerVisibility.powerStatusHud || layerVisibility.powerRegionDemand;
  const { dataRef: powerDashboardRef } =
    usePowerDashboard(energyDashboardActive);

  // 能源 20 層 / 化石燃料 / 畜牧 / 電力光暈 / 航空管制 / 無人機 / 環境污染、
  // HAZARD、地震、全球氣候、世界、災防告警的 hook 全部搬進 LayerHost（見 layerHookRegistry）。
  // 雲林 POC 覆蓋分析 5 layer 改 PMTiles — 由 overlayRegistry pmtiles 設定自動處理

  // ── 地震回放（scoped 播放器，時鐘在 earthquakeReplayClock，不掛 timeStore）──
  //    state 留在 App（EarthquakeReplayPanel 綁它），圖層本體在 LayerHost
  const [eqReplaySelectedId, setEqReplaySelectedId] = useState<string | null>(null);
  const [eqReplayPlaying, setEqReplayPlaying] = useState(false);
  const stopEqReplay = useCallback(() => setEqReplayPlaying(false), []);

  // ── 共機活動區（航跡示意圖向量化；依日期回放 + 30/60/90/120 天疊加）──
  //
  // 歷史模式走 HistoricalTimeline 的 年/月/日（它不寫 timeStore），所以要把日期
  // 算成視窗結束日交給圖層；同時停掉圖層自己的回放，避免兩個 clock 互相打架
  //（歷史時間軸的 ▶ 推進日期 = 疊加視窗往前滑，本身就是一種回放）。
  const plaHistoricalDate = useMemo(() => {
    if (appMode !== "historical") return null;
    const y = historicalYear + 1911;
    const today = todayTaiwan();
    const clamp = (d: string) => (d > today ? today : d);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (historicalGranularity === "day") {
      return clamp(`${y}-${pad(historicalMonth)}-${pad(historicalDay)}`);
    }
    // 年/月粒度取該區間最後一天（未來日期夾到今天），視窗才涵蓋整段
    const end =
      historicalGranularity === "month"
        ? new Date(y, historicalMonth, 0)
        : new Date(y, 11, 31);
    return clamp(
      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    );
  }, [appMode, historicalYear, historicalMonth, historicalDay, historicalGranularity]);

  // 共機活動區 / 衛星 / 路況 / 火災 / 清潔隊 / 地形 raster / 坡度坡向 /
  // 氣象空品影像 / 壅塞 / 殯葬密度 / 溫度網格的 hook 全部搬進 LayerHost
  //（見 layerHookRegistry；hostDeps 帶入 plaHistoricalDate 等跨切面依賴）

  // ── 空氣品質色階 raster 的 product 切換（AqiProductSwitcher 綁它，state 留在 App）──
  const [aqiProduct, setAqiProduct] = useState<AqiProduct>("AQI");

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
    syncWasteMapboxParams(map, layerParamRefs.wasteSubParams.current);
  }, [anyWasteFacilityOn, mapPrepared, isDarkTheme, wasteDisposalByType]);
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
  // ⚠️ 參數同步走**命令式 store 訂閱**，不經 React：13 個子層的 size/opacity/altitude
  //    只餵 Mapbox paint，沒有任何 React 狀態依賴它。掛成 useEffect + deps 的話，
  //    App 就得訂閱參數 → 拖任一 slider 整棵樹 reconcile（P4 要拆掉的正是這個）。
  //    `layerParamRefs` 的模組級訂閱者先註冊（import 時），所以這裡讀到的必定是新值。
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!styleReady(map) || !wasteMapboxSetupRef.current) return;
      syncWasteMapboxParams(map, layerParamRefs.wasteSubParams.current);
    };
    apply();
    return layerParamsStore.subscribe(apply);
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady(map) || !wasteMapboxSetupRef.current) return;
    syncWasteMapboxTheme(map, isDarkTheme);
  }, [isDarkTheme]);

  // ── Derived values ──

  const preset = useMemo(() => {
    // EM-03：網址帶相機時作為「初始視角」。selectedAirport 一旦被選（地點選單／chat 跳點）
    // 就交還既有邏輯，因此使用者操作永遠優先於網址。
    const urlCam = urlStateRef.current.camera;
    if (urlCam && !selectedAirport) {
      return {
        ...DEFAULT_CAMERA,
        id: "url", name: "URL", category: "city" as const,
        center: urlCam.center, zoom: urlCam.zoom,
        pitch: urlCam.pitch, bearing: urlCam.bearing,
      };
    }
    return getPresetById(selectedAirport) ?? DEFAULT_CAMERA;
  }, [selectedAirport]);

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

  // 軌道靜態線（2D Mapbox）已搬進 LayerHost 的 RailTracksHost

  // Three.js 圖層可見性由各 custom layer 內部 getIsVisible 控制
  // layers 常駐，不做 remove/re-add（避免 WebGL dispose/reinit 問題）

  // H3: load resolution when it changes
  useEffect(() => {
    if (layerVisibility.h3Population) {
      loadResolution(h3Resolution);
    }
  }, [h3Resolution, layerVisibility.h3Population, loadResolution]);

  // H3 網格上圖已搬進 LayerHost 的 H3PopulationHost

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

  // 人口 / 指標 / 社經 / 空間經濟 四張網格的上圖 effect 已搬進 LayerHost
  //（PopCountHost / IndicatorsHost / SocioeconomicHost / SpatialEconomyHost）

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

  // YouBike 網格上圖已搬進 LayerHost 的 YoubikeHost（youbikeTimeKey 經 hostDeps 傳入）

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
    ...(temperatureEnabled ? [{ label: "溫度場 Temperature", done: !temperatureLoading }] : []),
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

  // EM-03 深連結：套用網址指定的圖層與日期。**只跑一次**（deps 空陣列）——
  // 相機走 preset 那條路，這裡只處理 setter 型的狀態。
  // 走 handleBulkSetVisibility 而非直接 setLayerVisibility，是為了沿用其 gated 攔截與 session 記錄。
  const urlStateAppliedRef = useRef(false);
  useEffect(() => {
    if (urlStateAppliedRef.current) return;
    urlStateAppliedRef.current = true;
    const { layers, date, hour } = urlStateRef.current;
    if (layers?.length) handleBulkSetVisibility(layers, true);
    if (date) {
      // 台北時區當日 hh:00（timelineSeek 收 unix 秒，同 handleLocationJump 的 p.time）
      const hh = String(hour ?? 0).padStart(2, "0");
      const ts = Date.parse(`${date}T${hh}:00:00+08:00`);
      if (Number.isFinite(ts)) timelineSeek(Math.floor(ts / 1000));
    }
  }, [handleBulkSetVisibility, timelineSeek]);

  // ── EM-19 網址雙向同步（分享用）────────────────────────────────────────
  //
  // 三個必守的點（見 docs/proposal/embed-dynamic-layers.md 討論）：
  // 1. **replaceState 不是 pushState** —— pushState 會讓拖曳地圖塞爆上一頁歷史，
  //    使用者要按上千次才能離開。
  // 2. **綁 moveend 不綁 move** —— move 是每幀觸發（60fps），瀏覽器對 history API
  //    有頻率保護（Safari 特別嚴），會直接拋錯或忽略。
  // 3. **不寫進任何 React state** —— 只改網址列，不觸發 re-render，故成本趨近於零、
  //    不產生任何網路請求（Mapbox map load 只在 Map 初始化時計費，與此無關）。
  const syncUrlRef = useRef<() => void>(() => {});
  syncUrlRef.current = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const keys = (Object.entries(layerVisibilityRef.current) as [keyof LayerVisibility, boolean][])
      .filter(([, on]) => on)
      .map(([k]) => k);
    // 只有「使用者刻意看過去某一天」才把日期寫進網址。
    // ⚠️ 不能用 timeMode 判斷 —— TimeMode 只有 "replay" | "live" 且**預設就是 replay**，
    //    拿它當條件會讓每條分享連結都被凍上今天的日期，明天別人打開就變成看昨天。
    //    改為直接比對「時間軸所在日期 vs 今天（台北時區）」，不同才寫。
    const tpeParts = (ms: number) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", hour12: false,
      }).formatToParts(new Date(ms));
      const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
      return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
    };
    const cur = tpeParts(timeStore.getTime() * 1000);
    const today = tpeParts(Date.now()).date;
    const isPastDay = cur.date !== today;
    const date = isPastDay ? cur.date : undefined;
    const hour = isPastDay && Number.isFinite(cur.hour) ? cur.hour % 24 : undefined;
    const next = buildUrl(
      {
        camera: {
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        },
        layers: keys,
        style: mapStyleId,
        date,
        hour,
      },
      window.location.pathname,
    );
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPrepared) return;
    const onMoveEnd = () => syncUrlRef.current();
    map.on("moveend", onMoveEnd);
    syncUrlRef.current();   // 圖層/底圖變動時也立即反映（本 effect 的 deps）
    return () => { map.off("moveend", onMoveEnd); };
  }, [mapPrepared, layerVisibility, mapStyleId]);

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

  // ── LayerHost 的跨切面依賴（AR-22 P1）────────────────────────────
  // 圖層自己的參數**不在這裡** —— 每個 Host 用 `useLayerParams(key)` 自己訂閱。
  // ⚠️ 刻意不 memo：Host 沒有 React.memo，identity 換不換都會重跑，
  //    加 memo 只是多一份 deps 清單要維護（且漏一項就是靜默不更新）。
  const hostDeps: LayerHostDeps = {
    mapRef,
    layerVisibility,
    isDarkTheme,
    mapStyleId,
    timeMode: timeline.timeMode,

    appMode,
    historicalYear,
    historicalMonth,
    historicalDay,
    historicalGranularity,
    historicalPlaying,
    historicalSpeed,
    plaHistoricalDate,

    realEstateActive,
    reGran,
    reCursorTs,
    onReCursorChange: setReCursorTs,
    onHistoricalStop: stopHistorical,

    featureInfo,
    activeReservoirId,
    aqiProduct,
    eqReplaySelectedId,
    eqReplayPlaying,
    onEqReplayEnd: stopEqReplay,
    satConsoleOpen: satConsole.open,
    satShowAllOrbits: satConsole.showAllOrbits,
    maneuverNorads,

    temperatureData,
    reservoirSceneRef,
    reservoirStatusesRef,
    powerDashboardRef,

    railData,
    h3DataMap,
    h3Resolution,
    demographicsDataMap,
    demoResolution,
    getYearlyCells,
    socioDataMap,
    spatialDataMap,
    getYoubikeCellsForTime,
    youbikeTimeKey,
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {showLoadingScreen && <LoadingScreen steps={loadingSteps} />}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} isDarkTheme={isDarkTheme} />
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
      {/* AR-21：layerVisibility 不再經由 prop —— MapView 直接訂閱 layerVisibilityStore */}
      <MapView
        preset={preset}
        styleUrl={styleUrl}
        pureBlack={mapStyleId === "black"}
        flights={displayedFlights}
        renderMode={renderMode}
        isDarkTheme={isDarkTheme}
        showTrails={showTrails}

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

              currentLocationId={selectedAirport}
              onLocationJump={handleLocationJump}
              onWidthChange={handleSidebarWidthChange}
              dataRegistry={dataRegistry}
              selectedDate={timeline.selectedDate}
              onDateSelect={timeline.setSelectedDate}
              onIntelToggle={() => {
                if (!intelOpen) {
                  // 開啟 Intel → 同時關 Satellite / PropertyValue + 收 rail Layers/Locations panel
                  satelliteConsoleStore.setOpen(false);
                  setPropertyValueOpen(false);
                  setRailCloseEpoch((e) => e + 1);
                }
                setIntelOpen((v) => !v);
              }}
              intelActive={intelOpen}
              onSatelliteToggle={() => {
                if (!satConsole.open) {
                  // 開啟 Satellite → 同時關 Intel / PropertyValue + 收 rail Layers/Locations panel
                  setIntelOpen(false);
                  setPropertyValueOpen(false);
                  setRailCloseEpoch((e) => e + 1);
                }
                satelliteConsoleStore.toggleOpen();
              }}
              satelliteActive={satConsole.open}
              onPropertyValueToggle={() => {
                if (!propertyValueOpen) {
                  // 開啟總市值 → 同時關 Intel / Satellite + 收 rail Layers/Locations panel
                  setIntelOpen(false);
                  satelliteConsoleStore.setOpen(false);
                  setRailCloseEpoch((e) => e + 1);
                }
                setPropertyValueOpen((v) => !v);
              }}
              propertyValueActive={propertyValueOpen}
              externalCloseEpoch={railCloseEpoch}
              onMonitorSplitToggle={() => {
                if (monitorOpen && monitorMode === "split") {
                  setMonitorOpen(false);
                } else {
                  // 開啟 split Monitor → 同上方 Monitor 按鈕的開啟衛生：關 Intel / Satellite
                  setIntelOpen(false);
                  satelliteConsoleStore.setOpen(false);
                  setMonitorOpen(true);
                  setMonitorMode("split");
                }
              }}
              monitorSplitActive={monitorOpen && monitorMode === "split"}
              compactLayers={monitorOpen && monitorMode === "split"}
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

          {/* 🏢 房地產總市值 Property Value（縣市長條圖） */}
          <PropertyValuePanel
            open={propertyValueOpen}
            onClose={() => setPropertyValueOpen(false)}
          />

          {/* 🌋 地震回放 Earthquake Replay（事件清單 + 播放控制） */}
          <EarthquakeReplayPanel
            open={layerVisibility.earthquakeReplay}
            onClose={() => setLayerVisibility((prev) => ({ ...prev, earthquakeReplay: false }))}
            selectedId={eqReplaySelectedId}
            onSelect={(ev) => {
              setEqReplaySelectedId(ev.event_id);
              setEqReplayPlaying(true);
              earthquakeReplayClock.reset();
            }}
            playing={eqReplayPlaying}
            onTogglePlay={() => setEqReplayPlaying((p) => !p)}
            onReplay={() => {
              earthquakeReplayClock.reset();
              setEqReplayPlaying(true);
            }}
          />

          {/* 即時情報 Intel Panel */}
          <IntelPanel
            open={intelOpen}
            onClose={() => setIntelOpen(false)}
            onSelectLocation={(lon, lat) => {
              mapRef.current?.flyTo({ center: [lon, lat], zoom: 12, speed: 1.2 });
            }}
          />

          {/* Monitor Mode 戰情看板（底部上拉） */}
          <MonitorPanel
            open={monitorOpen}
            onClose={() => setMonitorOpen(false)}
            mode={monitorMode}
            onModeChange={setMonitorMode}
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
              plaActive={layerVisibility.plaActivity}
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
              onClick={() => { syncUrlRef.current(); setShareOpen(true); }}
              title="分享目前畫面 / 取得嵌入碼"
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
              Share
            </button>
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
                  setMonitorMode("dock");
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
              onClick={() => { syncUrlRef.current(); setShareOpen(true); }}
              title="分享目前畫面 / 取得嵌入碼"
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
              }}
            >
              Share
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
                plaActive={layerVisibility.plaActivity}
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
                {/* W2：欄位裁到 buffer 內真實存在的三項。原本這裡還有行政區 /
                    地址 / 總價 / 坪數，但 `real_estate_points_buffer.bin` 改成
                    interleaved Float32 [lng, lat, tradeTsRel, price, packed] 後
                    那四欄就不在檔案裡了 —— 顯示它們只會永遠印「—」。 */}
                <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: accent, letterSpacing: 1 }}>
                  {typeLabel}
                </div>
                <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDefault, marginTop: 4 }}>
                  單價 {num(p.price_per_sqm)} 元/m²
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

      {/* ── Bottom-right stack: Feature Info + AQI controls + Legend ──
          split 模式要整組讓到 dock 左邊：這疊是 zIndex 30、Monitor 面板是 40，
          不讓位的話點地圖跳出來的事件 popup 與 LEGEND 會整個被蓋掉。
          用 % 而不是算好的 px —— dock 寬度本身就是視窗寬的 widthPct，跟著縮放才對得準。 */}
      <div
        style={{
          position: "absolute",
          bottom: 64,
          right: splitActive
            ? `calc(${MONITOR_SPLIT_DOCK.widthPct * 100}% + ${MONITOR_SPLIT_DOCK.right + 12}px)`
            : 16,
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
        {/* AQI 色階圖例已收編進 LegendPanel 的 LEGEND_REGISTRY（AqiLegend），
            這裡只留產品切換器這個「控制項」。
            LASS 微感測則走 MicroSensorLegend（三模式各自色階）。 */}
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
          {/* AR-21：不再傳 visibility —— LegendPanel 自己訂閱 layerVisibilityStore，
              App 因無關狀態重繪時 memo 可整個跳過本面板 */}
          <LegendPanel isDarkTheme={isDarkTheme} />
        </div>
      </div>

      {/* ── 全域 loading 指示器 ── */}
      <LoadingIndicator
        rightOffset={splitActive
          ? `calc(${MONITOR_SPLIT_DOCK.widthPct * 100}% + ${MONITOR_SPLIT_DOCK.right + 12}px)`
          : "16px"}
      />

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

      {/*
        ── 圖層掛載（AR-22 P1）────────────────────────────────────
        67 支 layer hook 由 layerHookRegistry 的有序陣列驅動，不再手寫在上方。
        ⚠️ **放在最後是刻意的**：effect 是 children 先於 parent，掛在末尾時
        觸發順序（其他子元件 → LayerHosts → App 自己）與搬移前差異最小。
        理由詳見 src/layers/LayerHost.tsx 檔頭。
      */}
      <LayerHosts deps={hostDeps} />
    </div>
  );
}
