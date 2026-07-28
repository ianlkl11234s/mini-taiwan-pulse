import { useState, useEffect, useMemo, useRef, memo, createContext, useContext, type CSSProperties, type ComponentType } from "react";
import { FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import {
  Activity, Layers, MapPin, CalendarDays, Settings, X,
  Plane, Ship, TrainFront, Bus, Bike, Route, Anchor, PlaneTakeoff,
  BarChart3, Users, AlertTriangle, CloudSun, Wind,
  ChevronDown, ChevronRight, Search, Navigation,
  Lightbulb, CircleDot, RailSymbol, Thermometer,
  GraduationCap, Store, Play, Cable, Radio, Mountain,
  Mail, PackageCheck,
  BookOpen, HeartHandshake, ShoppingBasket, Toilet,
  Cloud, CloudRain,
  Droplets, Droplet, Waves, GitBranch, Dam, Factory, Gauge, Shield, ShieldCheck, Container,
  Flame, Trash2, Truck, MapPinned, Battery, Recycle, Shirt, Brush,
  Timer,
  Hospital, Stethoscope, Pill, HeartPulse, Accessibility, Clock, AlertCircle, Bed,
  Sprout,
  Video, Receipt, Coffee, Car, SquareParking, CircleParking,
  ShoppingCart, Warehouse, Fish,
  // FORESTRY icons
  Trees, TreePine, TreeDeciduous, TreePalm, Flower2, Hammer, Signal, PawPrint, Footprints,
  Ruler,
  Satellite,
  // ENERGY icons
  Zap, PlugZap, Power, Spline, TowerControl, Sun, Sparkles, Building2, Fuel, LayoutGrid,
  // HAZARD icons
  CloudLightning, Atom,
  // GLOBAL CLIMATE icons
  Tornado,
  // POLICE / JUSTICE / CIVIL DEFENSE icons（新增；既有 Shield/Search/MapPinned/PlaneTakeoff/Anchor/AlertTriangle/AlertCircle 已 import 復用）
  ShieldAlert, Gavel, Scale, Lock, Hexagon, Crosshair,
  Ban,
  // 環境污染 icons
  Biohazard,
  // 🎭 CULTURE icons（Building2 / CalendarDays 已 import 復用）
  Landmark, Theater, Library,
  // 🧳 TOURISM icons（Mountain / Factory 已 import 復用）
  Camera, ThermometerSun, Castle, Church, PartyPopper, FerrisWheel, Tent, BedDouble, UtensilsCrossed,
  // 🗺️ 土地使用分區 icons
  LandPlot, Map,
  // 🌍 世界 World icon（複合 rail icon 用）
  Globe,
  // 🏢 房地產總市值 icons（layer toggle 用 Coins、rail panel 用 PiggyBank）
  Coins, PiggyBank,
  type LucideIcon,
} from "lucide-react";
import type {
  LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode,
} from "../types";
import type { ParamControl } from "../hooks/useTransportParams";
import type { DataRegistry } from "../hooks/useDataRegistry";
import { ALL_PRESETS, AIRPORT_INFO } from "../map/cameraPresets";
// 圖層目錄常數單一真實來源（與 LayerSidebar 共用，消除漂移）
import { LAYER_COLORS, TRANSPORT_LABELS, THEMES, WORLD_TAB_THEME_TITLES, type ThemeDef } from "./sidebar/layerCatalog";

// 「世界」rail tab 與桌機主 Layers panel 的主題分流：
// - 主 Layers panel 只渲染非世界 tab 主題（MAIN_THEMES）
// - 世界 tab 只渲染 WORLD_TAB_THEME_TITLES 的主題（含全球氣候），順序照該陣列
const WORLD_THEMES = THEMES.filter((t) => WORLD_TAB_THEME_TITLES.includes(t.title))
  .sort((a, b) => WORLD_TAB_THEME_TITLES.indexOf(a.title) - WORLD_TAB_THEME_TITLES.indexOf(b.title));
const MAIN_THEMES = THEMES.filter((t) => !WORLD_TAB_THEME_TITLES.includes(t.title));

// ── Color Config ──

const LAYER_ICONS: Record<keyof LayerVisibility, LucideIcon> = {
  flights: Plane,
  ships: Ship,
  rail: TrainFront,
  stationsTHSR: TrainFront,
  stationsTRA: RailSymbol,
  stationsMetro: CircleDot,
  busStationsCity: Bus,
  busStationsIntercity: Bus,
  bikeStations: Bike,
  highways: Route,
  provincialRoads: Route,
  cyclingRoutes: Bike,
  cctv: Video,
  etcGantry: Receipt,
  serviceArea: Coffee,
  serviceAreaPolygon: Coffee,
  taxiStand: Car,
  ports: Anchor,
  airports: PlaneTakeoff,
  lighthouses: Lightbulb,
  aviationControl: Plane,
  aviationRestricted: Hexagon,
  droneNoFlyZone: Ban,
  droneRestrictedZone: AlertTriangle,
  h3Population: Activity,
  popCount: Users,
  indicators: BarChart3,
  socioeconomic: BarChart3,
  spatialEconomy: Store,
  freewayCongestion: AlertTriangle,
  weatherStations: CloudSun,
  windPlan: Wind,
  temperatureWave: Thermometer,
  schools: GraduationCap,
  convenienceStores: Store,
  postOffices: Mail,
  iPostBoxes: PackageCheck,
  communityCenters: Users,
  govServiceOffices: Landmark,
  publicLibraries: BookOpen,
  welfareCenters: HeartHandshake,
  retailMarkets: ShoppingBasket,
  publicToilets: Toilet,
  submarineCables: Cable,
  landingStations: Radio,
  activeFaults: Mountain,
  newsEvents: Radio,
  youbikeFullness: Bike,
  earthquakes: Activity,
  lifelineAlerts: Lightbulb,
  floodAlerts: Waves,
  weatherAlerts: CloudRain,
  transitAlerts: TrainFront,
  safetyAlerts: AlertTriangle,
  roadEvents: AlertTriangle,
  roadCongestion: AlertTriangle,
  cwaCloudImagery: Cloud,
  cwaRadarImagery: CloudRain,
  aqiImagery: Wind,
  aqiStations: CircleDot,
  aqiMicroSensors: Activity,
  busLive: Bus,
  busIntercityLive: Bus,
  touristShuttleLive: Bus,
  waterBasins: Waves,
  waterRivers: GitBranch,
  waterLevees: Shield,
  waterCanals: Droplets,
  waterProtectionZones: ShieldCheck,
  waterReservoirs: Dam,
  waterFacilities: Factory,
  waterMonitorStations: Gauge,
  waterFloodExtreme: AlertTriangle,
  waterDetentionBasins: Container,
  rainGauge: CloudRain,
  riverLevel: Waves,
  groundwater: Droplet,
  groundwaterWells: Droplet,
  iotWraRiver: Waves,
  iotWraStructure: Gauge,
  lakesPondsOsm: Waves,
  floodSensor: Droplets,
  floodSensorIsochrone: Timer,
  taipeiSewer: Waves,
  taipeiEvacuate: Gauge,
  taipeiPumb: Droplets,
  precipRaster: CloudRain,
  fireEvents: Flame,
  fireLatest: Flame,
  fireStations: Truck,
  fireHydrants: Droplet,
  fireIsochrone: Timer,
  medHospital: Hospital,
  medClinic: Stethoscope,
  medPharmacy: Pill,
  medAED: HeartPulse,
  medLTC: Accessibility,
  medIsochrone: Clock,
  medDesert: AlertCircle,
  erHospital: Activity,
  parkingOnstreet: SquareParking,
  parkingOffstreet: CircleParking,
  medICUBeds: Bed,
  agriculture: Sprout,
  agriSoil: Mountain,
  agriSoilFertility: Sprout,
  agriLeisureFarmZones: Sprout,
  agriRuralRegen: MapPinned,
  agriCropSuitability: Sprout,
  agriPOI: Store,
  agriRetail: ShoppingCart,
  agriProduceWholesale: Truck,
  agriWholesaleMarket: Warehouse,
  livestockFarmPig: PawPrint,
  livestockFarmChicken: PawPrint,
  livestockFarmCattle: PawPrint,
  livestockFarmDuck: PawPrint,
  livestockFarmGoose: PawPrint,
  livestockFarmSheep: PawPrint,
  livestockFarmOther: PawPrint,
  livestockSlaughter: Factory,
  livestockFeed: Warehouse,
  livestockMarket: ShoppingCart,
  aquaculturePonds: Fish,
  aquacultureZone: Fish,
  aquacultureCageNet: Fish,
  aquacultureWaterSatellite: Satellite,
  aquacultureWaterSatelliteMoa: ShieldCheck,
  aquacultureWaterUnion: Layers,
  aquacultureIntegrated: Fish,
  streetTreesTaipeiDiff: TreePine,
  protectedTreesNational: TreeDeciduous,
  riversideTreesTaipei: Waves,
  parksTaipei: Trees,
  streetTreesTaipei3epoch: Sprout,
  streetTreesNational: TreePalm,
  treePitsTaipei: Flower2,
  buildingsGba: Building2,
  urbanFormGrid: LayoutGrid,
  urbanZoningTaipei: LandPlot,
  urbanZoningNewTaipei: Map,
  // 🏟️ 運動場館 Sports
  sportsSchool: GraduationCap,
  sportsPublicOther: Activity,
  sportsPrivate: Activity,
  sportsPark: Trees,
  sportsCenter: Building2,
  // 🎭 文化 Culture
  culturalFacilities: Landmark,
  culturalMuseums: Building2,
  artsEvents: CalendarDays,
  performingVenues: Theater,
  librarySeats: Library,
  // 🧳 觀光 Tourism
  tourAttractions: Camera,
  tourHotSprings: Droplets,
  tourHotSpringZones: ThermometerSun,
  tourScenicAreas: Mountain,
  tourHeritage: Castle,
  tourReligion: Church,
  tourEvents: PartyPopper,
  tourFactories: Factory,
  tourAmusementParks: FerrisWheel,
  tourCamping: Tent,
  tourHotels: BedDouble,
  tourRestaurants: UtensilsCrossed,
  farmRoads: Route,
  ecoNetworkZones: Mountain,
  // FORESTRY 12 base
  forestCompartments: Trees,
  forestReserve: Shield,
  forestRecreation: TreePine,
  forestRoads: Route,
  forestTreatmentWorks: Hammer,
  forestTrailSigns: MapPin,
  forestSignalPoints: Signal,
  forestEducationCenters: GraduationCap,
  forestWildlife: PawPrint,
  forestDamLakes: Waves,
  forestFlatParks: Sprout,
  forestAlishanRail: TrainFront,
  hikingTrails: Footprints,
  canopyHeight: Ruler,
  canopyGiants: TreePine,
  wasteTruck: Truck,
  wasteSchedule: CalendarDays,
  wasteScheduleNote: CalendarDays,
  wasteStopsStatic: MapPinned,
  wasteCleaningSquads: Brush,
  wasteRoute: Route,
  wasteStop: MapPinned,
  wfIncinerator: Flame,
  wfLandfill: Mountain,
  wfLandfillCoastal: Waves,
  wfTransfer: Truck,
  wfMedical: AlertTriangle,
  wfMonitoring: Gauge,
  wfRecycling: Recycle,
  wfScrapYard: Trash2,
  wfOther: MapPinned,
  wdClothes: Shirt,
  wdMixed: Trash2,
  wdRecyclingContainer: Recycle,
  wdBattery: Battery,
  satellitesYaogan: Satellite,
  satellitesJilin: Satellite,
  satellitesGaofen: Satellite,
  satellitesTJS: Satellite,
  satellitesBeidou: Satellite,
  satellitesShiyan: Satellite,
  satellitesTaiwan: Satellite,
  satellitesUSA: Satellite,
  satellitesJapan: Satellite,
  satellitesRussia: Satellite,
  satellitesIndia: Satellite,
  satellitesKorea: Satellite,
  satellitesFrance: Satellite,
  satellitesGermany: Satellite,
  satellitesItaly: Satellite,
  satellitesIsrael: Satellite,
  // 能源 ENERGY MVP
  powerPlants: Zap,
  powerPlantGlow: Zap,
  substationEhvGlow: Zap,
  powerLinesGlow: Zap,
  aviationRestrictedGlow: Zap,
  powerStatusHud: Activity,
  powerRegionDemand: BarChart3,
  powerGenerationUnit: Power,
  osmSubstations: Cable,
  osmSubstationsEhv: Cable,
  osmPowerLines: Spline,
  osmPowerTowers: TowerControl,
  powerPoles: TowerControl,
  osmWindTurbines: Wind,
  osmSolarFarms: Sun,
  osmPowerPlantsStatic: Factory,
  offshoreWindZones: Waves,
  islandPowerGrid: Anchor,
  fossilFuelInfra: Container,
  geothermalWells: Sparkles,
  renewablePermitsTaipei: Building2,
  evChargingStations: PlugZap,
  // Phase 8 SSOT 6-layer（重用既有 icons）
  facPrimary: Zap,           // 主要電廠（綠閃電）
  facOffshore: Waves,        // 離岸風場 polygon
  facPlanned: Clock,         // 規劃 / 未來
  facHistorical: Power,      // 歷史退役
  facSecondary: CircleDot,   // 次要小型
  facOsmSupplement: MapPin,  // OSM 無名單機
  // 化石燃料 13 layer（重用既有 icons）
  gasStationCpc: Fuel,
  gasStationFpcc: Fuel,
  gasStationTaisugar: Fuel,
  gasStationOther: Fuel,
  gasStationCanonical: Fuel,
  lpgSubpackaging: Container,
  lpgRetailers: Flame,
  lngTerminal: Container,
  pipelineGas: Spline,
  pipelineOilGas: Spline,
  industrialRefinery: Factory,
  industrialStorageTank: Container,
  industrialPowerPlant: Factory,
  coalTerminal: Anchor,
  // 雲林 POC 覆蓋分析（30km isochrone）
  gasCoverageAll: Fuel,
  gasCoverageCpc: Fuel,
  gasCoverageFpcc: Fuel,
  gasCoverageTaisugar: Fuel,
  evIsland: PlugZap,
  lightning: CloudLightning,
  nuclearRadiation: Atom,
  // 全球氣候 GLOBAL CLIMATE
  earthquakesGlobal: AlertTriangle,
  typhoonTracks: Tornado,
  dustForecast: Cloud,
  oceanCurrents: Waves,
  windField: Wind,
  // 房地產（格用 Building2、點用 MapPin）
  realEstateRentalGrid: Building2,
  realEstateRentalPoint: MapPin,
  realEstateSaleGrid: Building2,
  realEstateSalePoint: MapPin,
  realEstatePresaleGrid: Building2,
  realEstatePresalePoint: MapPin,
  propertyValueGrid: Coins,
  // Base map
  countyBoundary: MapPinned,
  townshipBoundary: MapPinned,
  villageBoundary: MapPinned,
  contour25k: Mountain,
  contourDtm20: Mountain,
  osmRoadDrive: Route,
  osmExpressway: Route,
  hillshade: Mountain,
  slopeVector: Mountain,
  aspectVector: Mountain,
  // 警政司法民防 17 layer
  policeStation: ShieldAlert,
  womenChildWarning: AlertTriangle,
  speedCamera: Crosshair,
  speedZoneSegment: Timer,
  court: Gavel,
  prosecutorsOffice: Scale,
  correctionalFacility: Lock,
  courtJurisdiction: MapPinned,
  crimeAreaMonthly: Hexagon,
  theftTaoyuan: Search,
  trafficAccidentYearly: AlertTriangle,
  accidentTaipei: AlertCircle,
  a1AccidentRealtime: AlertTriangle,
  investigationBureau: Search,
  antiCorruptionOffice: Sparkles,
  immigrationOffice: PlaneTakeoff,
  coastGuardStation: Anchor,
  civilDefenseShelter: ShieldCheck,
  // 警察覆蓋分析
  policeIsoSubstation: Hexagon,
  policeIsoPrecinct: Hexagon,
  policeIsoCityDept: Hexagon,
  // 環境污染
  pollutionFacility: Factory,
  pollutionPenaltyCritical: AlertTriangle,
  pollutionPenaltyGeneral: AlertCircle,
  pollutionPenaltyMobile: Car,
  pollutionSite: Biohazard,
  // 🌍 世界 World
  worldTrashDebris: Trash2,
};

// ── IATA Map for Locations Panel ──

const IATA_MAP: Record<string, string> = {};
for (const [icao, info] of Object.entries(AIRPORT_INFO)) {
  IATA_MAP[icao] = info.iata;
}

// ── Props ──

interface IconRailSidebarProps {
  visibility: LayerVisibility;
  /** 主題模式：白底地圖時傳 false，rail / panel 切淺色 palette（預設深色） */
  isDarkTheme?: boolean;
  /** 對目前使用者上鎖的圖層 keys（動態 gating，見 lib/layerGates）：命中 → 顯示鎖頭 + 禁 toggle */
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  counts: { flights: number; ships: number; trains: number; buses: number; busesIntercity?: number; wasteTrucks?: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  onAllOff: () => void;
  /** 批次設定多 layer 可見性（Theme 級全開/全關用） */
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onWidthChange?: (width: number) => void;
  dataRegistry?: DataRegistry;
  selectedDate?: Date;
  onDateSelect?: (d: Date) => void;
  /** 即時情報 Intel panel toggle（外部渲染，rail 只負責切換） */
  onIntelToggle?: () => void;
  intelActive?: boolean;
  /** 衛星情報 Satellite Console panel toggle */
  onSatelliteToggle?: () => void;
  satelliteActive?: boolean;
  /** 🏢 房地產總市值 PropertyValuePanel toggle（縣市長條圖，非地圖層） */
  onPropertyValueToggle?: () => void;
  propertyValueActive?: boolean;
  /** 由外部觸發強制收起 rail panel（4-way panel mutex 用）— epoch 變動就收 */
  externalCloseEpoch?: number;
}

// ── Shared Styles ──

interface RailPalette {
  ACCENT: string; ACCENT_TOGGLE: string; BG_RAIL: string; BG_PANEL: string;
  BORDER: string; DIM: string; INACTIVE_TEXT: string;
  TEXT_STRONG: string; SUB_LABEL: string; BANNER_BG: string; SEARCH_BG: string;
  TOGGLE_OFF: string; TOGGLE_KNOB_ON: string; TOGGLE_KNOB_OFF: string;
  ROW_HOVER: string; ROW_ACTIVE: string; RAIL_ICON_ACTIVE: string;
  CTRL_ACTIVE_BG: string; CTRL_INACTIVE_BG: string; CTRL_ACTIVE_BORDER: string; CTRL_INACTIVE_BORDER: string;
  SELECT_BG: string; OPTION_BG: string; ALLOFF_BG: string; ALLOFF_BORDER: string;
}

const DARK_PALETTE: RailPalette = {
  ACCENT: "#E5E7EB", ACCENT_TOGGLE: "#FFFFFF", BG_RAIL: "#0D0E10", BG_PANEL: "rgba(0,0,0,0.45)",
  BORDER: "#2A2D32", DIM: "#6B7280", INACTIVE_TEXT: "#9CA3AF",
  TEXT_STRONG: "#fff", SUB_LABEL: "#D1D5DB", BANNER_BG: "rgba(20,21,24,0.95)", SEARCH_BG: "#1A1C20",
  TOGGLE_OFF: "#4B5563", TOGGLE_KNOB_ON: "#1a1a1a", TOGGLE_KNOB_OFF: "#fff",
  ROW_HOVER: "rgba(255,255,255,0.03)", ROW_ACTIVE: "rgba(255,255,255,0.06)", RAIL_ICON_ACTIVE: "rgba(255,255,255,0.08)",
  CTRL_ACTIVE_BG: "rgba(255,255,255,0.12)", CTRL_INACTIVE_BG: "rgba(0,0,0,0.4)",
  CTRL_ACTIVE_BORDER: "rgba(255,255,255,0.25)", CTRL_INACTIVE_BORDER: "rgba(255,255,255,0.15)",
  SELECT_BG: "rgba(0,0,0,0.5)", OPTION_BG: "#1a1a1a", ALLOFF_BG: "rgba(255,255,255,0.06)", ALLOFF_BORDER: "rgba(255,255,255,0.12)",
};

const LIGHT_PALETTE: RailPalette = {
  ACCENT: "#374151", ACCENT_TOGGLE: "#1F2937", BG_RAIL: "#FFFFFF", BG_PANEL: "rgba(255,255,255,0.92)",
  BORDER: "rgba(0,0,0,0.10)", DIM: "#9CA3AF", INACTIVE_TEXT: "#6B7280",
  TEXT_STRONG: "#111827", SUB_LABEL: "#4B5563", BANNER_BG: "rgba(243,244,246,0.96)", SEARCH_BG: "#F3F4F6",
  TOGGLE_OFF: "#D1D5DB", TOGGLE_KNOB_ON: "#fff", TOGGLE_KNOB_OFF: "#fff",
  ROW_HOVER: "rgba(0,0,0,0.04)", ROW_ACTIVE: "rgba(0,0,0,0.05)", RAIL_ICON_ACTIVE: "rgba(0,0,0,0.07)",
  CTRL_ACTIVE_BG: "rgba(0,0,0,0.10)", CTRL_INACTIVE_BG: "rgba(0,0,0,0.03)",
  CTRL_ACTIVE_BORDER: "rgba(0,0,0,0.22)", CTRL_INACTIVE_BORDER: "rgba(0,0,0,0.12)",
  SELECT_BG: "#FFFFFF", OPTION_BG: "#FFFFFF", ALLOFF_BG: "rgba(0,0,0,0.04)", ALLOFF_BORDER: "rgba(0,0,0,0.10)",
};

const RailThemeContext = createContext<RailPalette>(DARK_PALETTE);
const useRailTheme = () => useContext(RailThemeContext);

type PanelId = "layers" | "locations" | "world";

// ── Main Component ──

const RAIL_WIDTH = 56;
const PANEL_WIDTH = 288;

export function IconRailSidebar({
  visibility, lockedKeys, expandedLayer, viewMode, displayMode,
  counts, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onHideTransport, onAllOff,
  onBulkSetVisibility,
  getControls, currentLocationId, onLocationJump, onWidthChange,
  onIntelToggle, intelActive,
  onSatelliteToggle, satelliteActive,
  onPropertyValueToggle, propertyValueActive,
  externalCloseEpoch,
  isDarkTheme = true,
}: IconRailSidebarProps) {
  const palette = isDarkTheme ? DARK_PALETTE : LIGHT_PALETTE;
  const { BG_RAIL, BORDER, BG_PANEL } = palette;
  const [activePanel, setActivePanel] = useState<PanelId | null>("layers");
  const [locationSearch, setLocationSearch] = useState("");
  const [layerSearch, setLayerSearch] = useState("");
  const [worldSearch, setWorldSearch] = useState("");
  const [comingSoon, setComingSoon] = useState(false);

  // 齒輪「規劃中」提示：顯示後 2 秒自動消失
  useEffect(() => {
    if (!comingSoon) return;
    const t = setTimeout(() => setComingSoon(false), 2000);
    return () => clearTimeout(t);
  }, [comingSoon]);

  // 4-way panel mutex：外部（Intel / Satellite）打開時，epoch 變動 → 收 rail panel
  const firstEpochRunRef = useRef(true);
  useEffect(() => {
    if (firstEpochRunRef.current) { firstEpochRunRef.current = false; return; }
    if (externalCloseEpoch === undefined) return;
    setActivePanel(null);
  }, [externalCloseEpoch]);

  const panelOpen = activePanel !== null;

  // Floating panel doesn't push content — always report rail width only
  useEffect(() => {
    onWidthChange?.(RAIL_WIDTH);
  }, [onWidthChange]);

  const togglePanel = (panel: PanelId) => {
    // 是否為「開啟」動作（切到別的 panel 或開啟目前關閉的）。activePanel === panel 才是關閉。
    const willOpen = activePanel !== panel;
    // 開啟 Layers/Locations 時，關掉 Intel / Satellite（左側 panel 互斥）。
    // ⚠️ 副作用必須放在 setState updater 外：StrictMode 下 updater 會被呼叫兩次，
    // 若在其中 toggle，Intel/Satellite 會開了又關（淨零）→ 關不掉。
    if (willOpen) {
      if (intelActive && onIntelToggle) onIntelToggle();
      if (satelliteActive && onSatelliteToggle) onSatelliteToggle();
      if (propertyValueActive && onPropertyValueToggle) onPropertyValueToggle();
    }
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setActivePanel(null);

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "flights": return counts.flights;
      case "ships": return counts.ships;
      case "rail": return counts.trains;
      case "busLive": return counts.buses;
      case "busIntercityLive": return counts.busesIntercity;
      case "wasteTruck": return counts.wasteTrucks;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  // Filter presets
  const overviewPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "overview"), []);
  const cityPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "city"), []);
  const airportPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "airport"), []);
  const scenePresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "scene"), []);

  const filteredCities = useMemo(() => {
    if (!locationSearch) return cityPresets;
    const q = locationSearch.toLowerCase();
    return cityPresets.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [cityPresets, locationSearch]);

  const filteredAirports = useMemo(() => {
    if (!locationSearch) return airportPresets;
    const q = locationSearch.toLowerCase();
    return airportPresets.filter((p) =>
      p.name.toLowerCase().includes(q)
      || p.id.toLowerCase().includes(q)
      || (IATA_MAP[p.id] ?? "").toLowerCase().includes(q),
    );
  }, [airportPresets, locationSearch]);

  const filteredOverviews = useMemo(() => {
    if (!locationSearch) return overviewPresets;
    const q = locationSearch.toLowerCase();
    return overviewPresets.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [overviewPresets, locationSearch]);

  const filteredScenes = useMemo(() => {
    if (!locationSearch) return scenePresets;
    const q = locationSearch.toLowerCase();
    return scenePresets.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [scenePresets, locationSearch]);

  return (
    <RailThemeContext.Provider value={palette}>
    <div style={{ position: "relative", height: "100%", pointerEvents: "auto" }}>
      {/* ── Icon Rail ── */}
      <div
        style={{
          width: RAIL_WIDTH,
          background: BG_RAIL,
          borderRight: `1px solid ${BORDER}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 8,
          paddingBottom: 8,
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        {/* Logo / Activity */}
        <RailIcon icon={Activity} active={false} onClick={() => {}} tooltip="Mini Taiwan Pulse" />

        {/* Divider */}
        <div style={{ width: 32, height: 1, background: BORDER, margin: "8px 0" }} />

        {/* Layers */}
        <RailIcon
          icon={Layers}
          active={activePanel === "layers"}
          onClick={() => togglePanel("layers")}
          tooltip="Layers"
        />

        {/* Locations */}
        <RailIcon
          icon={MapPin}
          active={activePanel === "locations"}
          onClick={() => togglePanel("locations")}
          tooltip="Locations"
        />

        {/* 即時情報 Intel */}
        {onIntelToggle && (
          <RailIcon
            icon={Radio}
            active={!!intelActive}
            onClick={() => {
              if (!intelActive) closePanel();
              onIntelToggle();
            }}
            tooltip="即時情報 Intel"
          />
        )}

        {/* 衛星情報 Satellite Console */}
        {onSatelliteToggle && (
          <RailIcon
            icon={Satellite}
            active={!!satelliteActive}
            onClick={() => {
              if (!satelliteActive) closePanel();
              onSatelliteToggle();
            }}
            tooltip="衛星情報 Satellite"
          />
        )}

        {/* 🏢 房地產總市值 Property Value（縣市長條圖面板） */}
        {onPropertyValueToggle && (
          <RailIcon
            icon={PiggyBank}
            active={!!propertyValueActive}
            onClick={() => {
              if (!propertyValueActive) closePanel();
              onPropertyValueToggle();
            }}
            tooltip="房地產總市值 Property Value"
          />
        )}

        {/* 🌍 世界 World（獨立圖層清單，只顯示世界主題） */}
        <RailIcon
          icon={WorldGlyph}
          active={activePanel === "world"}
          onClick={() => togglePanel("world")}
          tooltip="世界 World"
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Settings（規劃中） */}
        <RailIcon icon={Settings} active={false} onClick={() => setComingSoon(true)} tooltip="Settings" />
      </div>

      {/* 齒輪「規劃中」提示 */}
      {comingSoon && (
        <div
          style={{
            position: "absolute",
            left: RAIL_WIDTH + 8,
            bottom: 12,
            padding: "8px 14px",
            background: "rgba(17,24,39,0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: RADIUS.xl,
            color: "#fff",
            fontSize: FONT_SIZE.lg,
            whiteSpace: "nowrap",
            zIndex: 5,
            pointerEvents: "none",
            animation: "panelFadeIn 0.2s ease-out",
          }}
        >
          ⚙️ 設定功能規劃中
        </div>
      )}

      {/* ── Floating Panel ── */}
      {panelOpen && (
        <>
          <style>{`
            @keyframes panelFadeIn {
              from { opacity: 0; transform: translateX(-12px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              left: RAIL_WIDTH + 8,
              top: 92,
              width: PANEL_WIDTH,
              maxHeight: "70vh",
              background: BG_PANEL,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRadius: RADIUS.xl,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 3,
              pointerEvents: "auto",
              animation: "panelFadeIn 0.25s ease-out",
            }}
          >
            {activePanel === "layers" && (
              <LayersPanel
                search={layerSearch}
                onSearchChange={setLayerSearch}
                themes={MAIN_THEMES}
                visibility={visibility}
                lockedKeys={lockedKeys}
                expandedLayer={expandedLayer}
                viewMode={viewMode}
                displayMode={displayMode}
                getCount={getCount}
                onLayerClick={onLayerClick}
                onToggleVisibility={onToggleVisibility}
                onViewModeChange={onViewModeChange}
                onDisplayModeChange={onDisplayModeChange}
                onHideTransport={onHideTransport}
                onAllOff={onAllOff}
                onBulkSetVisibility={onBulkSetVisibility}
                getControls={getControls}
                onClose={closePanel}
              />
            )}
            {activePanel === "world" && (
              <LayersPanel
                search={worldSearch}
                onSearchChange={setWorldSearch}
                themes={WORLD_THEMES}
                title="世界 World"
                visibility={visibility}
                lockedKeys={lockedKeys}
                expandedLayer={expandedLayer}
                viewMode={viewMode}
                displayMode={displayMode}
                getCount={getCount}
                onLayerClick={onLayerClick}
                onToggleVisibility={onToggleVisibility}
                onViewModeChange={onViewModeChange}
                onDisplayModeChange={onDisplayModeChange}
                onHideTransport={onHideTransport}
                onAllOff={onAllOff}
                onBulkSetVisibility={onBulkSetVisibility}
                getControls={getControls}
                onClose={closePanel}
              />
            )}
            {activePanel === "locations" && (
              <LocationsPanel
                search={locationSearch}
                onSearchChange={setLocationSearch}
                overviewPresets={filteredOverviews}
                cityPresets={filteredCities}
                airportPresets={filteredAirports}
                scenePresets={filteredScenes}
                currentLocationId={currentLocationId}
                onLocationJump={onLocationJump}
                onClose={closePanel}
              />
            )}
          </div>
        </>
      )}
    </div>
    </RailThemeContext.Provider>
  );
}

// ── Rail Icon Button ──

// 「世界」複合 icon：Layers 底 + 右下疊小 Globe（沿用 currentColor 隨 active/dim 變色）。
function WorldGlyph({ size = 20 }: { size?: number }) {
  const badge = Math.round(size * 0.58);
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <Layers size={size} />
      <Globe
        size={badge}
        style={{ position: "absolute", right: -3, bottom: -3, strokeWidth: 2.5 }}
      />
    </span>
  );
}

function RailIcon({
  icon: Icon, active, onClick, tooltip,
}: {
  icon: ComponentType<{ size?: number }>; active: boolean; onClick: () => void; tooltip: string;
}) {
  const { ACCENT, DIM, RAIL_ICON_ACTIVE } = useRailTheme();
  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        width: 40,
        height: 40,
        borderRadius: RADIUS.xl,
        border: "none",
        background: active ? RAIL_ICON_ACTIVE : "transparent",
        color: active ? ACCENT : DIM,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        marginBottom: 4,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <Icon size={20} />
    </button>
  );
}

// ── Panel Header ──

function PanelHeader({
  title, onClose,
}: {
  title: string; onClose: () => void;
}) {
  const { BORDER, DIM, TEXT_STRONG } = useRailTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 12px 10px",
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}
    >
      <span style={{ color: TEXT_STRONG, fontSize: FONT_SIZE.lg, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>
        {title}
      </span>
      <div style={{ flex: 1 }} />
      <button
        onClick={onClose}
        style={{
          width: 24,
          height: 24,
          borderRadius: RADIUS.md,
          border: "none",
          background: "transparent",
          color: DIM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}


// ── Toggle Switch ──

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  const { ACCENT_TOGGLE, TOGGLE_OFF, TOGGLE_KNOB_ON, TOGGLE_KNOB_OFF } = useRailTheme();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 28,
        height: 16,
        borderRadius: RADIUS.xl,
        border: "none",
        background: on ? ACCENT_TOGGLE : TOGGLE_OFF,
        position: "relative",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: RADIUS.full,
          background: on ? TOGGLE_KNOB_ON : TOGGLE_KNOB_OFF,
          position: "absolute",
          top: 2,
          left: on ? 14 : 2,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

// ══════════════════════════════════
//  LAYERS PANEL
// ══════════════════════════════════

interface LayersPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  /** 只渲染這批主題（預設全部 THEMES）。世界 tab 傳世界主題、主 Layers panel 傳非世界主題。 */
  themes?: ThemeDef[];
  /** PanelHeader 標題（預設 "Layers"）。 */
  title?: string;
  visibility: LayerVisibility;
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  getCount: (key: keyof LayerVisibility) => number | undefined;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  onAllOff: () => void;
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
  onClose: () => void;
}

// 單一 layer row — memo 後只在該 row 的 props 真變動時才 re-render。
// 這讓 LayersPanel 每次被動 re-render（例如 count 變動）時，
// 大多數 row 跳過、只有 count 變化的少數 row 重繪。
interface LayerRowProps {
  layerKey: keyof LayerVisibility;
  label: string;
  expandable: boolean;
  active: boolean;
  /** owner-only 私人圖層且當前 viewer 非 owner → 顯示鎖頭、禁 toggle */
  locked: boolean;
  color: string;
  count: number | undefined;
  isExpanded: boolean;
  Icon: LucideIcon;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
}

const LayerRow = memo(function LayerRow({
  layerKey, label, expandable, active, locked, color, count, isExpanded, Icon,
  onLayerClick, onToggleVisibility,
}: LayerRowProps) {
  const { DIM, INACTIVE_TEXT, TEXT_STRONG, ROW_HOVER } = useRailTheme();
  // locked：點整列一律走 onToggleVisibility → App 端 gate（未登入導登入 / 已登入顯示提示）
  const handleClick = () =>
    locked ? onToggleVisibility(layerKey)
      : expandable ? onLayerClick(layerKey) : onToggleVisibility(layerKey);
  const handleToggle = () => onToggleVisibility(layerKey);

  return (
    <div
      onClick={handleClick}
      title={locked ? "私人圖層，僅擁有者可檢視" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px 5px 0",
        cursor: "pointer",
        borderLeft: active ? `2px solid ${color}` : "2px solid transparent",
        paddingLeft: 10,
        opacity: locked ? 0.5 : 1,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = ROW_HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <Icon size={14} color={active ? color : DIM} style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: FONT_SIZE.md,
          fontFamily: "Inter, system-ui, sans-serif",
          color: active ? TEXT_STRONG : INACTIVE_TEXT,
          transition: "color 0.15s",
        }}
      >
        {label}
      </span>
      {count != null && count > 0 && !locked && (
        <span
          style={{
            fontFamily: FONT_DATA,
            fontSize: FONT_SIZE.base,
            color: active ? color : INACTIVE_TEXT,
            marginRight: 4,
          }}
        >
          {count.toLocaleString()}
        </span>
      )}
      {expandable && !locked && (
        <span style={{ color: DIM, flexShrink: 0, display: "flex" }}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      )}
      {locked
        ? <Lock size={13} color={DIM} style={{ flexShrink: 0 }} />
        : <ToggleSwitch on={active} onChange={handleToggle} />}
    </div>
  );
});

function ThemeBanner({
  title, isCollapsed, onCount, totalCount, onToggleCollapse, onBulkToggle,
}: {
  title: string;
  isCollapsed: boolean;
  onCount: number;
  totalCount: number;
  onToggleCollapse: () => void;
  onBulkToggle: () => void;
}) {
  const { DIM, BORDER, TEXT_STRONG, INACTIVE_TEXT, BANNER_BG } = useRailTheme();
  const allOn = onCount === totalCount;
  const someOn = onCount > 0;
  // tri-state visual: 全開 / 部分開 / 全關
  const indicatorColor = allOn ? TEXT_STRONG : someOn ? INACTIVE_TEXT : DIM;
  return (
    <div
      onClick={onToggleCollapse}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        // sticky：滾到該 theme 內容時 banner 黏在頂部，直到下一個 theme banner 把它推出
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: BANNER_BG,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderTop: `1px solid ${BORDER}`,
        borderBottom: isCollapsed ? `1px solid ${BORDER}` : `1px solid ${BORDER}`,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span style={{ color: DIM, flexShrink: 0, display: "flex" }}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: FONT_DATA,
          fontSize: FONT_SIZE.md,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: TEXT_STRONG,
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: FONT_DATA,
          fontSize: FONT_SIZE.xs,
          color: indicatorColor,
          marginRight: 4,
        }}
      >
        {onCount}/{totalCount}
      </span>
      <ToggleSwitch on={someOn} onChange={onBulkToggle} />
    </div>
  );
}

function SubGroupLabel({ children }: { children: string }) {
  const { SUB_LABEL } = useRailTheme();
  return (
    <div
      style={{
        color: SUB_LABEL,
        fontFamily: FONT_DATA,
        fontSize: FONT_SIZE.sm,
        fontWeight: 600,
        letterSpacing: 1.2,
        padding: "10px 12px 4px 22px",
      }}
    >
      └ {children}
    </div>
  );
}

function LayersPanel({
  search, onSearchChange, themes, title = "Layers",
  visibility, lockedKeys, expandedLayer, viewMode: _viewMode, displayMode,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange: _onViewModeChange, onDisplayModeChange, onHideTransport,
  onAllOff, onBulkSetVisibility, getControls, onClose,
}: LayersPanelProps) {
  const { ALLOFF_BG, ALLOFF_BORDER, INACTIVE_TEXT, SEARCH_BG, DIM, TEXT_STRONG } = useRailTheme();
  const q = search.trim().toLowerCase();
  const themesToRender = themes ?? THEMES;
  // Theme 摺疊狀態：預設摺疊 defaultCollapsed=true 的（目前僅環境氣候 Environment 預設展開）
  const [collapsedThemes, setCollapsedThemes] = useState<Set<string>>(
    () => new Set(themesToRender.filter((t) => t.defaultCollapsed).map((t) => t.title)),
  );

  const toggleTheme = (title: string) => {
    setCollapsedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  return (
    <>
      <PanelHeader title={title} onClose={onClose} />
      <div style={{ padding: "4px 12px 4px" }}>
        <button
          onClick={onAllOff}
          style={{
            width: "100%",
            padding: "5px 0",
            background: ALLOFF_BG,
            border: `1px solid ${ALLOFF_BORDER}`,
            borderRadius: RADIUS.lg,
            color: INACTIVE_TEXT,
            fontSize: FONT_SIZE.base,
            cursor: "pointer",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          All Off
        </button>
      </div>
      {/* Search Bar（仿 Locations，主題感知）*/}
      <div style={{ padding: "0 12px 4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: SEARCH_BG,
            borderRadius: RADIUS.lg,
            padding: "6px 8px",
          }}
        >
          <Search size={13} color={DIM} style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜尋圖層… Search layers…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: TEXT_STRONG,
              fontSize: FONT_SIZE.md,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          />
        </div>
      </div>
      <div
        className="layer-sidebar-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 0 8px",
        }}
      >
        {themesToRender.map((theme) => {
          const isCollapsed = q ? false : collapsedThemes.has(theme.title);
          const allKeys = theme.groups.flatMap((g) => g.layers.map((l) => l.key));
          const onCount = allKeys.filter((k) => visibility[k]).length;
          const someOn = onCount > 0;

          // 搜尋過濾：query 非空時只保留符合的 group/layer；整組/整 theme 空則不渲染
          const groups = q
            ? theme.groups
                .map((g) => ({
                  ...g,
                  layers: g.layers.filter(
                    (l) =>
                      l.label.toLowerCase().includes(q) ||
                      (l.labelMobile?.toLowerCase().includes(q) ?? false) ||
                      l.key.toLowerCase().includes(q),
                  ),
                }))
                .filter((g) => g.layers.length > 0)
            : theme.groups;
          if (q && groups.length === 0) return null;

          const handleBulkToggle = () => {
            // 有任何一個 on → 全部 off；全部 off → 全部 on
            if (onBulkSetVisibility) {
              onBulkSetVisibility(allKeys, !someOn);
            } else {
              // fallback: 逐一 toggle 還沒對齊的 key
              for (const k of allKeys) {
                if (visibility[k] === someOn) continue;
                if ((!someOn && !visibility[k]) || (someOn && visibility[k])) {
                  onToggleVisibility(k);
                }
              }
            }
          };

          return (
            <div key={theme.title}>
              <ThemeBanner
                title={theme.title}
                isCollapsed={isCollapsed}
                onCount={onCount}
                totalCount={allKeys.length}
                onToggleCollapse={() => toggleTheme(theme.title)}
                onBulkToggle={handleBulkToggle}
              />
              {!isCollapsed && groups.map((group) => (
                <div key={group.title}>
                  <SubGroupLabel>{group.title}</SubGroupLabel>
                  {group.layers.map(({ key, label, expandable }) => {
                    const active = visibility[key];
                    const isExpanded = expandedLayer === key;
                    const isTransport = key in TRANSPORT_LABELS;
                    return (
                      <div key={key}>
                        <LayerRow
                          layerKey={key}
                          label={label}
                          expandable={!!expandable}
                          active={active}
                          locked={!!lockedKeys?.has(key)}
                          color={LAYER_COLORS[key]}
                          count={getCount(key)}
                          isExpanded={isExpanded}
                          Icon={LAYER_ICONS[key]}
                          onLayerClick={onLayerClick}
                          onToggleVisibility={onToggleVisibility}
                        />
                        {isExpanded && expandable && (
                          <ExpandedControls
                            layerKey={key as ExpandableLayerKey}
                            isTransport={isTransport}
                            displayMode={displayMode}
                            onDisplayModeChange={onDisplayModeChange}
                            onHide={onHideTransport}
                            controls={getControls(key as ExpandableLayerKey)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Expanded Controls (param sliders / toggles / selects) ──

interface ExpandedControlsProps {
  layerKey: ExpandableLayerKey;
  isTransport: boolean;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHide: () => void;
  controls: ParamControl[];
}

function ExpandedControls({
  layerKey, isTransport, displayMode,
  onDisplayModeChange, onHide, controls,
}: ExpandedControlsProps) {
  const {
    TEXT_STRONG, CTRL_ACTIVE_BG, CTRL_INACTIVE_BG, CTRL_ACTIVE_BORDER, CTRL_INACTIVE_BORDER,
    SELECT_BG, OPTION_BG, INACTIVE_TEXT, DIM, ACCENT_TOGGLE,
  } = useRailTheme();
  const btnBase: CSSProperties = {
    fontSize: FONT_SIZE.xs,
    padding: "2px 6px",
    borderRadius: RADIUS.md,
    fontFamily: FONT_DATA,
    cursor: "pointer",
    border: "1px solid transparent",
  };

  const activeBtn: CSSProperties = {
    ...btnBase,
    background: CTRL_ACTIVE_BG,
    border: `1px solid ${CTRL_ACTIVE_BORDER}`,
    color: TEXT_STRONG,
  };

  const inactiveBtn: CSSProperties = {
    ...btnBase,
    background: CTRL_INACTIVE_BG,
    color: INACTIVE_TEXT,
  };

  return (
    <div style={{ padding: "6px 12px 8px 36px", display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Display mode (flights only) + Hide */}
      {isTransport && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {layerKey === "flights" && (
            <>
              <button
                style={displayMode === "status" ? activeBtn : inactiveBtn}
                onClick={() => onDisplayModeChange("status")}
              >
                Live Status
              </button>
              <button
                style={displayMode === "trails" ? activeBtn : inactiveBtn}
                onClick={() => onDisplayModeChange("trails")}
              >
                Trails
              </button>
            </>
          )}
          <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>Hide</button>
        </div>
      )}
      {!isTransport && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>Hide</button>
        </div>
      )}

      {/* Controls */}
      {controls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {controls.map((ctrl) => {
            if (ctrl.type === "select") {
              // options ≥ 4 一律改用原生 <select> dropdown，避免橫向 button 超出 sidebar
              if (ctrl.options.length > 3) {
                return (
                  <div
                    key={ctrl.label}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      color: INACTIVE_TEXT, fontSize: FONT_SIZE.sm, fontFamily: FONT_DATA,
                    }}
                  >
                    <span style={{ minWidth: 50, flexShrink: 0 }}>{ctrl.label}</span>
                    <select
                      value={ctrl.value}
                      onChange={(e) => ctrl.onChange(e.target.value)}
                      style={{
                        flex: 1, fontSize: FONT_SIZE.sm, padding: "1px 6px",
                        background: SELECT_BG, color: TEXT_STRONG,
                        border: `1px solid ${CTRL_INACTIVE_BORDER}`,
                        borderRadius: RADIUS.md, fontFamily: FONT_DATA,
                      }}
                    >
                      {ctrl.options.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ background: OPTION_BG }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div
                  key={ctrl.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    color: INACTIVE_TEXT, fontSize: FONT_SIZE.sm, fontFamily: FONT_DATA,
                  }}
                >
                  <span style={{ minWidth: 50, flexShrink: 0 }}>{ctrl.label}</span>
                  {ctrl.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => ctrl.onChange(opt.value)}
                      style={{
                        ...btnBase,
                        fontSize: FONT_SIZE.xs,
                        padding: "1px 8px",
                        background: ctrl.value === opt.value
                          ? CTRL_ACTIVE_BG
                          : CTRL_INACTIVE_BG,
                        border: ctrl.value === opt.value
                          ? `1px solid ${CTRL_ACTIVE_BORDER}`
                          : `1px solid ${CTRL_INACTIVE_BORDER}`,
                        color: ctrl.value === opt.value ? TEXT_STRONG : DIM,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              );
            }

            if (ctrl.type === "toggle") {
              return (
                <div
                  key={ctrl.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    color: INACTIVE_TEXT, fontSize: FONT_SIZE.sm, fontFamily: FONT_DATA,
                  }}
                >
                  <span style={{ minWidth: 50, flexShrink: 0 }}>{ctrl.label}</span>
                  <button
                    onClick={() => ctrl.onChange(!ctrl.value)}
                    style={{
                      ...btnBase,
                      fontSize: FONT_SIZE.xs,
                      padding: "1px 8px",
                      background: ctrl.value ? CTRL_ACTIVE_BG : CTRL_INACTIVE_BG,
                      border: ctrl.value
                        ? `1px solid ${CTRL_ACTIVE_BORDER}`
                        : `1px solid ${CTRL_INACTIVE_BORDER}`,
                      color: ctrl.value ? TEXT_STRONG : DIM,
                    }}
                  >
                    {ctrl.value ? "ON" : "OFF"}
                  </button>
                </div>
              );
            }

            // Slider
            const s = ctrl;
            return (
              <label
                key={s.label}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  color: INACTIVE_TEXT, fontSize: FONT_SIZE.sm, fontFamily: FONT_DATA,
                }}
              >
                <span style={{ minWidth: 50, flexShrink: 0 }}>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.onChange(Number(e.target.value))}
                  style={{
                    flex: 1, height: 3,
                    accentColor: ACCENT_TOGGLE,
                    cursor: "pointer",
                  }}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════
//  LOCATIONS PANEL
// ══════════════════════════════════

interface LocationsPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  overviewPresets: typeof ALL_PRESETS;
  cityPresets: typeof ALL_PRESETS;
  airportPresets: typeof ALL_PRESETS;
  scenePresets: typeof ALL_PRESETS;
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onClose: () => void;
}

/** 可收合的 section */
function CollapsibleSection({
  title, count, defaultOpen = true, children,
}: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const { DIM } = useRailTheme();
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 12px 2px", cursor: "pointer", userSelect: "none",
        }}
      >
        {open
          ? <ChevronDown size={12} color={DIM} />
          : <ChevronRight size={12} color={DIM} />}
        <span style={{
          fontSize: FONT_SIZE.sm, fontWeight: 700, letterSpacing: 1.5,
          color: DIM, fontFamily: "Inter, system-ui, sans-serif",
        }}>
          {title}
        </span>
        <span style={{ fontSize: FONT_SIZE.xs, color: DIM, fontFamily: FONT_DATA, marginLeft: 4 }}>
          {count}
        </span>
      </div>
      {open && children}
    </>
  );
}

function LocationsPanel({
  search, onSearchChange, overviewPresets, cityPresets, airportPresets, scenePresets,
  currentLocationId, onLocationJump, onClose,
}: LocationsPanelProps) {
  const { DIM, SEARCH_BG, TEXT_STRONG, BORDER } = useRailTheme();
  return (
    <>
      <PanelHeader title="Locations" onClose={onClose} />

      {/* Search Bar */}
      <div style={{ padding: "8px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: SEARCH_BG,
            borderRadius: RADIUS.lg,
            padding: "6px 8px",
          }}
        >
          <Search size={13} color={DIM} style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search locations..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: TEXT_STRONG,
              fontSize: FONT_SIZE.md,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          />
        </div>
      </div>

      {/* Body */}
      <div
        className="layer-sidebar-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}
      >
        {/* Scenes */}
        <CollapsibleSection title="SCENE" count={scenePresets.length} defaultOpen={false}>
          {scenePresets.map((p) => (
            <LocationItem
              key={p.id}
              name={p.name}
              subtitle={p.description ?? ""}
              active={currentLocationId === p.id}
              onClick={() => onLocationJump(p.id)}
              icon={Play}
            />
          ))}
        </CollapsibleSection>
        {scenePresets.length > 0 && overviewPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Overview */}
        <CollapsibleSection title="OVERVIEW" count={overviewPresets.length} defaultOpen={true}>
          {overviewPresets.map((p) => (
            <LocationItem
              key={p.id}
              name={p.name}
              subtitle={`${p.center[1].toFixed(2)}, ${p.center[0].toFixed(2)}`}
              active={currentLocationId === p.id}
              onClick={() => onLocationJump(p.id)}
            />
          ))}
        </CollapsibleSection>
        {overviewPresets.length > 0 && cityPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Major Cities */}
        <CollapsibleSection title="MAJOR CITIES" count={cityPresets.length}>
          {cityPresets.map((p) => (
            <LocationItem
              key={p.id}
              name={p.name}
              subtitle={`${p.center[1].toFixed(2)}, ${p.center[0].toFixed(2)}`}
              active={currentLocationId === p.id}
              onClick={() => onLocationJump(p.id)}
            />
          ))}
        </CollapsibleSection>
        {cityPresets.length > 0 && airportPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Airports */}
        <CollapsibleSection title="AIRPORT" count={airportPresets.length} defaultOpen={false}>
          {airportPresets.map((p) => {
            const iata = IATA_MAP[p.id];
            return (
              <LocationItem
                key={p.id}
                name={p.name}
                subtitle={iata ? `IATA: ${iata}` : p.id}
                active={currentLocationId === p.id}
                onClick={() => onLocationJump(p.id)}
              />
            );
          })}
        </CollapsibleSection>
      </div>
    </>
  );
}

// ── Location Item ──

function LocationItem({
  name, subtitle, active, onClick, icon: Icon = MapPin,
}: {
  name: string; subtitle: string; active: boolean; onClick: () => void; icon?: LucideIcon;
}) {
  const { ACCENT, DIM, INACTIVE_TEXT, TEXT_STRONG, ROW_HOVER, ROW_ACTIVE } = useRailTheme();
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        cursor: "pointer",
        background: active ? ROW_ACTIVE : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = ROW_HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = active ? ROW_ACTIVE : "transparent";
      }}
    >
      <Icon size={14} color={active ? ACCENT : DIM} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: FONT_SIZE.md,
            fontWeight: 600,
            color: active ? TEXT_STRONG : INACTIVE_TEXT,
            fontFamily: "Inter, system-ui, sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: FONT_SIZE.sm,
            color: DIM,
            fontFamily: FONT_DATA,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{
          width: 24,
          height: 24,
          borderRadius: RADIUS.md,
          border: "none",
          background: "transparent",
          color: active ? ACCENT : DIM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <Navigation size={12} />
      </button>
    </div>
  );
}
