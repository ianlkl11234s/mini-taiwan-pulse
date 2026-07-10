/** 單一軌跡點：[緯度, 經度, 高度(公尺), Unix timestamp] */
export type TrailPoint = [number, number, number, number];

/** 航班資料（來自 OpenSky 空域快照） */
export interface Flight {
  fr24_id: string;
  callsign: string;
  registration: string;
  aircraft_type: string;
  origin_icao: string;
  origin_iata: string;
  dest_icao: string;
  dest_iata: string;
  dep_time: number;
  arr_time: number;
  status: string;
  trail_points: number;
  path: TrailPoint[];
}

/** 地點預設視角 */
export interface CameraPreset {
  name: string;
  id: string;
  category: "overview" | "city" | "airport" | "scene";
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  /** 場景專用：跳到的 unix timestamp */
  time?: number;
  /** 場景專用：播放倍速 */
  speed?: number;
  /** 場景專用：是否自動播放 */
  autoPlay?: boolean;
  /** 場景描述（顯示於 subtitle） */
  description?: string;
  /** 場景專用：切換時設定圖層開關（未指定的保持不變） */
  layers?: Partial<LayerVisibility>;
}

/** 時間軸狀態 */
export interface TimelineState {
  playing: boolean;
  currentTime: number;
  startTime: number;
  endTime: number;
  speed: number;
}

/** 時間模式：replay = 歷史回放, live = 即時模式 */
export type TimeMode = "replay" | "live";

/** App 大模式：realtime = 即時 24h, historical = 歷史長時序（年/日/月） */
export type AppMode = "realtime" | "historical";

/** 歷史模式狀態：年份（民國年）+ 後續可擴日期粒度 */
export interface HistoricalState {
  year: number; // 民國年，例如 113 = 西元 2024
}

/** 資料源的時間行為類型 */
export type TimeType =
  | "track"     // 有軌跡的動態資料（航班、船舶）
  | "snapshot"  // 快照資料（YouBike、國道壅塞）
  | "cyclic"    // 每日循環（鐵道時刻表）
  | "event"     // 事件資料（新聞）
  | "static";   // 靜態資料（車站、道路）

/** 資料源時間範圍 */
export interface TimeRange {
  start: number;  // unix timestamp
  end: number;    // unix timestamp
}

/** 資料源元資料 */
export interface DataSourceMeta {
  id: string;
  timeType: TimeType;
  timeRanges: TimeRange[];
  supportsLive: boolean;
  refreshInterval?: number; // 秒，Live 模式下的更新頻率
}

/** 顯示模式 */
export type ViewMode = "all-taiwan" | "time-window";

/** 運具類型 */
export type TransportType = "flights" | "ships" | "rail" | "busLive" | "busIntercityLive";

/** 可展開面板的圖層 key */
export type ExpandableLayerKey =
  TransportType | "windPlan" | "lighthouses"
  | "stationsTHSR" | "stationsTRA" | "stationsMetro"
  | "busStationsCity" | "busStationsIntercity"
  | "bikeStations"
  | "cyclingRoutes" | "freewayCongestion" | "weatherStations"
  | "highways" | "provincialRoads" | "ports" | "airports"
  | "cctv" | "etcGantry" | "serviceArea" | "serviceAreaPolygon" | "taxiStand"
  | "h3Population" | "popCount" | "indicators"
  | "socioeconomic" | "spatialEconomy"
  | "temperatureWave"
  | "schools" | "convenienceStores"
  | "submarineCables" | "landingStations"
  | "activeFaults"
  | "newsEvents"
  | "livestockFarmPig" | "livestockFarmChicken" | "livestockFarmCattle"
  | "livestockFarmDuck" | "livestockFarmGoose" | "livestockFarmSheep" | "livestockFarmOther"
  | "livestockSlaughter" | "livestockFeed" | "livestockMarket"
  // 🐟 養殖漁業 Aquaculture（靜態 overlay polygon）
  | "aquaculturePonds" | "aquacultureZone" | "aquacultureCageNet"
  // 運動場館 SPORTS（5 sublayer 共用 sports-venues source + layer filter）
  | "sportsSchool" | "sportsPublicOther" | "sportsPrivate" | "sportsPark" | "sportsCenter"
  | "youbikeFullness"
  | "cwaCloudImagery"
  | "cwaRadarImagery"
  | "aqiImagery"
  | "aqiStations"
  | "aqiMicroSensors"
  | "earthquakes"
  | "earthquakesGlobal"
  | "typhoonTracks"
  | "dustForecast"
  | "oceanCurrents"
  | "windField"
  | "lifelineAlerts"
  | "floodAlerts"
  | "weatherAlerts"
  | "transitAlerts"
  | "safetyAlerts"
  | "roadEvents"
  | "busLive"
  | "waterBasins"
  | "waterRivers"
  | "waterLevees"
  | "waterCanals"
  | "waterProtectionZones"
  | "waterReservoirs"
  | "waterFacilities"
  | "waterMonitorStations"
  | "waterFloodExtreme"
  | "waterDetentionBasins"
  | "rainGauge"
  | "riverLevel"
  | "groundwater"
  | "groundwaterWells"
  | "iotWraRiver"
  | "iotWraStructure"
  | "floodSensor"
  | "floodSensorIsochrone"
  | "taipeiSewer"
  | "taipeiEvacuate"
  | "taipeiPumb"
  | "precipRaster"
  | "fireEvents"
  | "fireLatest"
  | "fireStations"
  | "fireHydrants"
  | "fireIsochrone"
  | "medDesert"
  | "medHospital"
  | "medClinic"
  | "medPharmacy"
  | "medAED"
  | "medLTC"
  | "medIsochrone"
  | "agriculture"
  | "agriSoil"
  | "agriSoilFertility"
  | "agriLeisureFarmZones"
  | "agriRuralRegen"
  | "agriCropSuitability"
  | "agriPOI"
  | "agriRetail"
  | "agriProduceWholesale"
  | "agriWholesaleMarket"
  | "farmRoads"
  | "ecoNetworkZones"
  // FORESTRY 12 base + 3 衍生
  | "forestCompartments"
  | "forestReserve"
  | "forestRecreation"
  | "forestRoads"
  | "forestTreatmentWorks"
  | "forestTrailSigns"
  | "forestSignalPoints"
  | "forestEducationCenters"
  | "forestWildlife"
  | "forestDamLakes"
  | "forestFlatParks"
  | "forestAlishanRail"
  | "hikingTrails"
  // ENERGY MVP
  | "powerPlants"
  | "powerPlantGlow"
  | "substationEhvGlow"
  | "powerLinesGlow"
  | "aviationRestrictedGlow"
  | "powerGenerationUnit"
  | "osmSubstations"
  | "osmSubstationsEhv"
  | "osmPowerLines"
  | "osmPowerTowers"
  | "powerPoles"
  | "osmWindTurbines"
  | "osmSolarFarms"
  | "osmPowerPlantsStatic"
  | "offshoreWindZones"
  | "islandPowerGrid"
  | "fossilFuelInfra"
  | "geothermalWells"
  | "renewablePermitsTaipei"
  | "evChargingStations"
  // Phase 8 SSOT facilities 6-layer 重構
  | "facPrimary"
  | "facOffshore"
  | "facPlanned"
  | "facHistorical"
  | "facSecondary"
  | "facOsmSupplement"
  // 化石燃料 14 layer
  | "gasStationCpc" | "gasStationFpcc" | "gasStationTaisugar" | "gasStationOther"
  | "gasStationCanonical"
  | "lpgSubpackaging" | "lpgRetailers"
  | "lngTerminal"
  | "pipelineGas" | "pipelineOilGas"
  | "industrialRefinery" | "industrialStorageTank" | "industrialPowerPlant"
  | "coalTerminal"
  // 雲林 POC 覆蓋分析
  | "gasCoverageAll"
  | "gasCoverageCpc"
  | "gasCoverageFpcc"
  | "gasCoverageTaisugar"
  | "evIsland"
  // HAZARD（v2 Phase B）
  | "lightning"
  | "nuclearRadiation"
  | "wasteTruck"
  | "wasteSchedule"
  | "wasteScheduleNote"
  | "wasteStopsStatic"
  | "wasteCleaningSquads"
  // waste facility 8 sub-types（每種有 size/opacity/altitude slider）
  | "wfIncinerator"
  | "wfLandfill"
  | "wfLandfillCoastal"
  | "wfTransfer"
  | "wfMedical"
  | "wfMonitoring"
  | "wfRecycling"
  | "wfScrapYard"
  | "wfOther"
  // waste disposal point 4 sub-types
  | "wdClothes"
  | "wdMixed"
  | "wdRecyclingContainer"
  | "wdBattery"
  // 衛星 SPACE — CN 6 群 + TW + 9 國 LEO 遙測
  | "satellitesYaogan"
  | "satellitesJilin"
  | "satellitesGaofen"
  | "satellitesTJS"
  | "satellitesBeidou"
  | "satellitesShiyan"
  | "satellitesTaiwan"
  | "satellitesUSA"
  | "satellitesJapan"
  | "satellitesRussia"
  | "satellitesIndia"
  | "satellitesKorea"
  | "satellitesFrance"
  | "satellitesGermany"
  | "satellitesItaly"
  | "satellitesIsrael"
  | "realEstateRentalGrid"
  | "realEstateRentalPoint"
  | "realEstateSaleGrid"
  | "realEstateSalePoint"
  | "realEstatePresaleGrid"
  | "realEstatePresalePoint"
  // Base map
  | "countyBoundary" | "townshipBoundary" | "villageBoundary"
  | "contour25k" | "contourDtm20" | "osmRoadDrive"
  | "osmExpressway" | "hillshade" | "slope" | "aspect"
  // 警政司法民防 17 layer（slider 接 useTransportParams）
  | "policeStation" | "womenChildWarning" | "speedCamera" | "speedZoneSegment"
  | "court" | "prosecutorsOffice" | "correctionalFacility" | "courtJurisdiction"
  | "crimeAreaMonthly" | "theftTaoyuan" | "trafficAccidentYearly" | "accidentTaipei"
  | "a1AccidentRealtime"
  | "investigationBureau" | "antiCorruptionOffice" | "immigrationOffice" | "coastGuardStation"
  | "civilDefenseShelter"
  // 航空器空域（eAIP AIRAC，9 種 layer 拆兩 toggle）
  | "aviationControl"        // FIR + TMA（情報 / 終端管制，FIR 只邊框）
  | "aviationRestricted"     // CTR/CONTROL/SURFACE + RCR + DANGER + ULZ + CIRCUIT
  // 航空安全 — 無人機禁/限航區（共用 PMTiles + filter 拆兩 toggle）
  | "droneNoFlyZone" | "droneRestrictedZone"
  // 警察覆蓋分析 isochrone × 3 層級
  | "policeIsoSubstation" | "policeIsoPrecinct" | "policeIsoCityDept"
  // 環境污染
  | "pollutionFacility"
  | "pollutionPenaltyCritical" | "pollutionPenaltyGeneral" | "pollutionPenaltyMobile"
  | "pollutionSite";

/** 渲染模式：3D（Three.js 含高度）或 2D（Mapbox 原生平面） */
export type RenderMode = "3d" | "2d";

/** 顯示模式：trails 顯示完整軌跡、status 只顯示飛機位置 */
export type DisplayMode = "trails" | "status";

/** Mapbox 底圖樣式 */
export interface MapStyle {
  id: string;
  name: string;
  url: string;
}

// ── 船舶 ──

export interface Ship {
  mmsi: string;
  vessel_type: number;
  path: TrailPoint[]; // 復用 [lat, lng, 0, unix_ts]
}

export interface ShipData {
  metadata: { date: string; ship_count: number; time_range: [number, number] };
  ships: Ship[];
}

// ── 軌道運輸 ──

export interface RailTrain {
  trainId: string;
  trackId: string;
  systemId: string; // "trtc" | "thsr" | "tra" | "krtc" | "klrt" | "tmrt"
  position: [number, number]; // [lng, lat]
  color: string;
  status: "running" | "stopped";
  trainTypeCode?: string; // TRA 車種代碼 "PP" | "TC" | "CK" | "LC" 等
}

export interface RailSystem {
  id: string;
  tracks: Map<string, GeoJSON.Feature>;
  schedules: Map<string, RailSchedule>;
  stationProgress: Record<string, Record<string, number>>;
}

export interface RailSchedule {
  track_id: string;
  route_id: string;
  name: string;
  train_color: string;
  stations: string[];
  departures: RailDeparture[];
}

export interface RailDeparture {
  departure_time: string;
  train_id: string;
  total_travel_time: number;
  stations: RailStationTime[];
}

export interface RailStationTime {
  station_id: string;
  arrival: number;
  departure: number;
}

export interface RailData {
  systems: RailSystem[];
  traData: TraData | null;
  allTracks: GeoJSON.FeatureCollection;
}

// ── TRA 專用 ──

/** TRA 班次（含車種資訊） */
export interface TraDeparture {
  departure_time: string;
  train_id: string;
  train_no?: string;
  train_type?: string;
  train_type_code?: string;
  total_travel_time: number;
  origin_station: string;
  destination_station: string;
  od_track_id: string;
  stations: RailStationTime[];
}

/** TRA 單軌道時刻表 */
export interface TraSchedule {
  departures: TraDeparture[];
}

/** TraTrainEngine 所需的完整資料 */
export interface TraData {
  schedules: Map<string, TraSchedule>;
  odTracks: Map<string, GeoJSON.Feature>;
  stationProgress: Record<string, Record<string, number>>;
  goldenTracks: GeoJSON.Feature[];
}

// ── 公車即時 (GPS-based) ──

export type BusCity =
  // 直轄市
  | "Taipei" | "NewTaipei" | "Taoyuan"
  | "Taichung" | "Tainan" | "Kaohsiung"
  // 省轄市
  | "Keelung" | "Hsinchu" | "Chiayi"
  // 縣
  | "HsinchuCounty" | "MiaoliCounty"
  | "ChanghuaCounty" | "NantouCounty"
  | "YunlinCounty" | "ChiayiCounty"
  | "PingtungCounty" | "YilanCounty"
  | "HualienCounty" | "TaitungCounty"
  // 離島
  | "PenghuCounty" | "KinmenCounty" | "LienchiangCounty";
export type BusColorMode = "route" | "speed" | "density";

/**
 * 公車 UI group：依台灣常見區域分組（8 組），每個 group 展開為多個 BusCity。
 * RPC 接收 BusCity[] 展開值。
 */
export type BusGroup =
  | "TaipeiMetro"          // 雙北
  | "KeelungYilan"         // 基宜
  | "TaoyuanHsinchuMiaoli" // 桃竹苗
  | "CentralTaiwan"        // 中彰投
  | "YunChiaNan"           // 雲嘉南
  | "Kaoping"              // 高屏
  | "HualienTaitung"       // 花東
  | "OffshoreIslands";     // 離島

export const BUS_GROUP_CITIES: Record<BusGroup, BusCity[]> = {
  TaipeiMetro:          ["Taipei", "NewTaipei"],
  KeelungYilan:         ["Keelung", "YilanCounty"],
  TaoyuanHsinchuMiaoli: ["Taoyuan", "Hsinchu", "HsinchuCounty", "MiaoliCounty"],
  CentralTaiwan:        ["Taichung", "ChanghuaCounty", "NantouCounty"],
  YunChiaNan:           ["YunlinCounty", "Chiayi", "ChiayiCounty", "Tainan"],
  Kaoping:              ["Kaohsiung", "PingtungCounty"],
  HualienTaitung:       ["HualienCounty", "TaitungCounty"],
  OffshoreIslands:      ["PenghuCounty", "KinmenCounty", "LienchiangCounty"],
};

export const BUS_GROUP_LABELS: Record<BusGroup, string> = {
  TaipeiMetro:          "雙北",
  KeelungYilan:         "基宜",
  TaoyuanHsinchuMiaoli: "桃竹苗",
  CentralTaiwan:        "中彰投",
  YunChiaNan:           "雲嘉南",
  Kaoping:              "高屏",
  HualienTaitung:       "花東",
  OffshoreIslands:      "離島",
};

/** 垃圾車表定用：BusGroup → 中文城名（spatial.waste_collection_stops.city 用 utf-8「臺」字） */
export const WASTE_GROUP_CITIES: Record<BusGroup, string[]> = {
  TaipeiMetro:          ["臺北市", "新北市"],
  KeelungYilan:         ["基隆市", "宜蘭縣"],
  TaoyuanHsinchuMiaoli: ["桃園市", "新竹市", "新竹縣", "苗栗縣"],
  CentralTaiwan:        ["臺中市", "彰化縣", "南投縣"],
  YunChiaNan:           ["雲林縣", "嘉義市", "嘉義縣", "臺南市"],
  Kaoping:              ["高雄市", "屏東縣"],
  HualienTaitung:       ["花蓮縣", "臺東縣"],
  OffshoreIslands:      ["澎湖縣", "金門縣", "連江縣"],
};

export const BUS_CITY_CONFIG: Record<BusCity, { label: string; jsonFile: string }> = {
  Taipei:           { label: "台北", jsonFile: "./bus/taipei_bus_routes.json" },
  NewTaipei:        { label: "新北", jsonFile: "./bus/newtaipei_bus_routes.json" },
  Taoyuan:          { label: "桃園", jsonFile: "./bus/taoyuan_bus_routes.json" },
  Taichung:         { label: "台中", jsonFile: "./bus/taichung_bus_routes.json" },
  Tainan:           { label: "台南", jsonFile: "./bus/tainan_bus_routes.json" },
  Kaohsiung:        { label: "高雄", jsonFile: "./bus/kaohsiung_bus_routes.json" },
  Keelung:          { label: "基隆", jsonFile: "./bus/keelung_bus_routes.json" },
  Hsinchu:          { label: "新竹市", jsonFile: "./bus/hsinchu_bus_routes.json" },
  Chiayi:           { label: "嘉義市", jsonFile: "./bus/chiayi_bus_routes.json" },
  HsinchuCounty:    { label: "新竹縣", jsonFile: "./bus/hsinchucounty_bus_routes.json" },
  MiaoliCounty:     { label: "苗栗", jsonFile: "./bus/miaolicounty_bus_routes.json" },
  ChanghuaCounty:   { label: "彰化", jsonFile: "./bus/changhuacounty_bus_routes.json" },
  NantouCounty:     { label: "南投", jsonFile: "./bus/nantoucounty_bus_routes.json" },
  YunlinCounty:     { label: "雲林", jsonFile: "./bus/yunlincounty_bus_routes.json" },
  ChiayiCounty:     { label: "嘉義縣", jsonFile: "./bus/chiayicounty_bus_routes.json" },
  PingtungCounty:   { label: "屏東", jsonFile: "./bus/pingtungcounty_bus_routes.json" },
  YilanCounty:      { label: "宜蘭", jsonFile: "./bus/yilancounty_bus_routes.json" },
  HualienCounty:    { label: "花蓮", jsonFile: "./bus/hualiencounty_bus_routes.json" },
  TaitungCounty:    { label: "台東", jsonFile: "./bus/taitungcounty_bus_routes.json" },
  PenghuCounty:     { label: "澎湖", jsonFile: "./bus/penghucounty_bus_routes.json" },
  KinmenCounty:     { label: "金門", jsonFile: "./bus/kinmencounty_bus_routes.json" },
  LienchiangCounty: { label: "連江", jsonFile: "./bus/lienchiangcounty_bus_routes.json" },
};

/** 公路客運（InterCity）路線靜態檔路徑（全國單一檔案，無 city 切換） */
export const BUS_INTERCITY_ROUTES_JSON = "./bus/intercity_bus_routes.json";

export interface BusRouteGeometry {
  routeUid: string;
  routeName: string;
  direction: number;
  coords: [number, number][];
  cumDist: number[];
  totalDist: number;
  stopProgress: number[];
  stopNames: string[];
  subRouteName: string;
  /** 固定班次/小時（由 preprocess 從 schedule CSV 算出），density 色階用 */
  frequency?: number;
}

export interface BusPosition {
  plateNumb: string;
  routeUid: string;
  routeName: string;
  direction: number;
  lat: number;
  lng: number;
  speed: number;
  collectedAt: number;
  /** 市區公車：BusCity 代號；公路客運：SubAuthorityID 業者代號 */
  city: string;
}

export interface BusVehicle {
  plateNumb: string;
  routeUid: string;
  routeName: string;
  position: [number, number]; // [lng, lat]
  color: string;
  status: "running" | "stopped";
  speed: number;
  progress: number;
  direction: number;
  city: string;
  /** 視覺透明度 0~1；未提供視為 1（不淡入淡出） */
  fadeAlpha?: number;
  /** 路線的班次/小時（從 route.frequency 帶入，density colorMode 固定查值） */
  density?: number;
}

export interface BusRouteData {
  routes: Map<string, BusRouteGeometry>;
  routeIndex: Map<string, string[]>; // routeUid → [routeUid_0, routeUid_1]
}

export interface BusDateInfo {
  day: string;       // "YYYY-MM-DD"
  records: number;
  buses: number;
}

/** 公車歷史軌跡（來自 bus_trails_daily pre-aggregate） */
export interface BusTrail {
  plateNumb: string;
  routeUid: string | null;
  routeName: string | null;
  direction: number;
  city: string | null;
  path: TrailPoint[];   // [lat, lng, 0, unix_ts]
}

// ── Overlay Registry ──

export interface OverlayLayerSpec {
  suffix: string;
  type: "line" | "fill" | "circle" | "fill-extrusion" | "symbol";
  layout?: Record<string, unknown> | ((isDark: boolean, params?: Record<string, number>) => Record<string, unknown>);
  paint: (isDark: boolean, params?: Record<string, number>) => Record<string, unknown>;
  minzoom?: number;
  /** 同 sourceId 多 layer 各自 sub-filter（疊在 OverlayConfig.filter 之上 → all 串接） */
  filter?: unknown[];
}

export interface OverlayConfig {
  id: keyof LayerVisibility;
  sourceUrl: string;
  sourceId: string;
  layers: OverlayLayerSpec[];
  rebuildOnParamChange?: string[];
  filter?: unknown[];
  /**
   * 設定後 sourceUrl 視為 PMTiles 向量切片（HTTP Range Request 按需載入），
   * 取代預設的 GeoJSON 全量載入。大型 line/polygon 圖層（>5MB GeoJSON）應採用。
   * minzoom/maxzoom 對應 tippecanoe 的 -Z/-z；超過 maxzoom 由 Mapbox 自動 overzoom。
   */
  pmtiles?: { sourceLayer: string; minzoom: number; maxzoom: number };
  /**
   * 設定後 source 以空 FeatureCollection 初始化（不載入 sourceUrl），
   * 資料由對應 loader/hook 按日 setData 餵入（如 newsEvents 走 Supabase RPC）。
   * sourceUrl 保留作為 loader 端 Supabase 未設定時的靜態 fallback 路徑。
   */
  dynamicData?: boolean;
}

// ── 房地產 hover tooltip ──
export interface RealEstateTooltipInfo {
  x: number;
  y: number;
  kind: "grid" | "point";
  properties: Record<string, unknown>;
}

// ── 點擊特徵資訊 ──

export interface FeatureInfo {
  layerType: "submarineCable" | "landingStation" | "school" | "convenienceStore"
    | "weatherStation" | "bikeStation" | "busStation" | "lighthouse" | "railStation"
    | "port" | "airport" | "ship" | "cctv" | "etcGantry" | "serviceArea" | "serviceAreaPolygon" | "taxiStand"
    | "activeFault" | "newsEvent" | "disasterAlert" | "roadEvent"
    | "fireEvent" | "fireStation" | "fireHydrant" | "fireIsochrone"
    | "livestockFarm" | "livestockSlaughter" | "livestockFeed" | "livestockMarket"
    | "aquaculturePonds" | "aquacultureZone" | "aquacultureCageNet"
    | "sportsVenue"
    | "medicalPOI"
    | "medicalIsochrone"
    | "aqiStation" | "microSensor"
    | "waterFacility" | "waterMonitor" | "waterDam" | "waterReservoirPoly" | "waterDetentionBasin"
    | "rainGauge" | "riverLevel" | "groundwater" | "groundwaterWell"
    | "iotWraRiver" | "iotWraStructure"
    | "floodSensor" | "floodSensorIsochrone"
    | "taipeiSewer" | "taipeiEvacuate" | "taipeiPumb"
    | "wasteFacility" | "wasteDisposalPoint" | "wasteCleaningSquad"
    | "agriPOI" | "agriRuralRegen"
    | "agriSoil" | "agriSoilFertility" | "agriLeisureFarmZones" | "agriCropSuitability"
    | "agriRetail" | "agriProduceWholesale" | "agriWholesaleMarket"
    | "farmRoads" | "ecoNetworkZones"
    | "forestryPolygon" | "forestryLine" | "forestryPOI"
    | "hikingTrails"
    | "satellite"
    | "powerPlant" | "osmSubstation" | "evCharging"
    | "osmPowerLine" | "osmPowerTower"
    | "osmWindTurbine" | "osmSolarFarm" | "osmPowerPlantStatic"
    | "offshoreWindZone" | "islandPowerFacility" | "fossilFuelFacility"
    | "geothermalWell" | "renewablePermitTaipei"
    // 化石燃料 13 layer（Phase B 接 public.get_fossil_fuel_layers()）
    | "gasStationCpc" | "gasStationFpcc" | "gasStationTaisugar" | "gasStationOther"
    | "gasStationCanonical"
    | "lpgSubpackaging" | "lpgRetailers"
    | "lngTerminal"
    | "pipelineGas" | "pipelineOilGas"
    | "industrialRefinery" | "industrialStorageTank" | "industrialPowerPlant"
    | "coalTerminal"
    // 雲林 POC 覆蓋分析
    | "gasCoverageAll" | "gasCoverageCpc" | "gasCoverageFpcc" | "gasCoverageTaisugar"
    | "evIsland"
    | "lightningStrike" | "nuclearStation"
    | "earthquakeGlobal" | "typhoonTrack" | "climateField"
    // Base map（PMTiles 來自 taipei-gis-analytics）
    | "countyBoundary" | "townshipBoundary" | "villageBoundary"
    | "contour25k" | "contourDtm20" | "osmRoadDrive"
    | "osmExpressway" | "hillshade" | "slope" | "aspect"
    // 警政司法民防 17 layer
    | "policeStation" | "womenChildWarning" | "speedCamera" | "speedZoneSegment"
    | "court" | "prosecutorsOffice" | "correctionalFacility" | "courtJurisdiction"
    | "crimeAreaMonthly" | "theftTaoyuan" | "trafficAccidentYearly" | "accidentTaipei"
    | "a1AccidentRealtime"
    | "investigationBureau" | "antiCorruptionOffice" | "immigrationOffice" | "coastGuardStation"
    | "civilDefenseShelter"
    // 環境污染（PMTiles：設施 × 介質 × 嚴重度 / 裁處事件時間軸 / 污染場址）
    | "pollutionFacility" | "pollutionPenalty" | "pollutionSite"
    // 航空器空域（eAIP，含 floor/ceiling，分管制 vs 禁限航 兩 layerType）
    | "aviationControl" | "aviationRestricted"
    // 無人機禁/限航區（PMTiles polygon，filter 拆兩 layerType）
    | "droneNoFlyZone" | "droneRestrictedZone"
    // 警察覆蓋分析 (PMTiles, 帶 overlap_count)
    | "policeIsoSubstation" | "policeIsoPrecinct" | "policeIsoCityDept"
    // AI 助手 highlight_point tool 標記點（通用標籤 + 座標）
    | "chatHighlight";
  properties: Record<string, unknown>;
  /** 點擊位置 (lng, lat)，給「選中光暈」用 */
  coords?: [number, number];
}

// ── 圖層控制 ──

export interface LayerVisibility {
  flights: boolean;
  ships: boolean;
  rail: boolean;
  stationsTHSR: boolean;
  stationsTRA: boolean;
  stationsMetro: boolean;
  ports: boolean;
  lighthouses: boolean;
  airports: boolean;
  highways: boolean;
  provincialRoads: boolean;
  cctv: boolean;
  etcGantry: boolean;
  serviceArea: boolean;
  serviceAreaPolygon: boolean;
  taxiStand: boolean;
  windPlan: boolean;
  busStationsCity: boolean;
  busStationsIntercity: boolean;
  bikeStations: boolean;
  cyclingRoutes: boolean;
  freewayCongestion: boolean;
  weatherStations: boolean;
  h3Population: boolean;
  popCount: boolean;
  indicators: boolean;
  socioeconomic: boolean;
  spatialEconomy: boolean;
  temperatureWave: boolean;
  schools: boolean;
  convenienceStores: boolean;
  submarineCables: boolean;
  landingStations: boolean;
  activeFaults: boolean;
  newsEvents: boolean;
  youbikeFullness: boolean;
  earthquakes: boolean;
  // ── 全球氣候 GLOBAL CLIMATE（USGS / JMA / JTWC / CMEMS / CAMS / NOAA GFS）──
  earthquakesGlobal: boolean;    // USGS 全球地震（hourly）
  typhoonTracks: boolean;        // JMA / JTWC 颱風軌跡（observed + forecast）
  dustForecast: boolean;         // CAMS 沙塵預報（PMTiles 待出，stub）
  oceanCurrents: boolean;        // CMEMS 海流（u/v 粒子動畫，PMTiles 待出，stub）
  windField: boolean;            // NOAA GFS 10m 風場（u/v 粒子動畫，PMTiles 待出，stub）
  /** NCDR 災害示警 5 主題群組（共用 disaster-alerts source，見 disasterAlertTypes.ts） */
  lifelineAlerts: boolean;
  floodAlerts: boolean;
  weatherAlerts: boolean;
  transitAlerts: boolean;
  safetyAlerts: boolean;
  roadEvents: boolean;    // TDX 即時路況（live_freeway/highway/city + event_city 預告）
  cwaCloudImagery: boolean;
  cwaRadarImagery: boolean;
  aqiImagery: boolean;
  aqiStations: boolean;
  aqiMicroSensors: boolean;
  busLive: boolean;
  busIntercityLive: boolean;
  waterBasins: boolean;
  waterRivers: boolean;
  waterLevees: boolean;
  waterCanals: boolean;
  waterProtectionZones: boolean;
  waterReservoirs: boolean;
  waterFacilities: boolean;
  waterMonitorStations: boolean;
  waterFloodExtreme: boolean;
  waterDetentionBasins: boolean;
  rainGauge: boolean;
  riverLevel: boolean;
  groundwater: boolean;
  groundwaterWells: boolean;
  iotWraRiver: boolean;
  iotWraStructure: boolean;
  floodSensor: boolean;          // USWG 都市淹水感測器（即時 depth_cm，1999 站）
  floodSensorIsochrone: boolean; // 雙北 USWG 3-min 步行等時圈（PMTiles，依站即時 depth 著色）
  taipeiSewer: boolean;          // 北市雨水下水道水位 233 站（10min，wic.gov.taipei）
  taipeiEvacuate: boolean;       // 北市疏散門 35 站（10min，gate state）
  taipeiPumb: boolean;           // 北市抽水站 97 站（10min，含 risk_ratio 警戒）
  precipRaster: boolean;         // 水利署 IoT 累積雨量柵格 PNG（1/3/6/24h dropdown）
  fireEvents: boolean;
  fireLatest: boolean;     // 最新年度火災點位（113/2024，不限歷史模式）
  fireStations: boolean;   // 消防分隊點位（全台 22 縣市，677 點）
  fireHydrants: boolean;   // 消防栓（僅臺北市 + 高雄市，69,839 點）
  fireIsochrone: boolean;  // 救援等時圈（路網 5/10/15 分鐘，POC：臺北市）
  // 🐷 畜牧 Livestock（靜態 CDN geojson 點層；飼養場 7 層共用 livestock_farms source + 主畜種 filter）
  livestockFarmPig: boolean;      // 畜禽飼養場·豬（4,584）
  livestockFarmChicken: boolean;  // 畜禽飼養場·雞（5,176）
  livestockFarmCattle: boolean;   // 畜禽飼養場·牛（574）
  livestockFarmDuck: boolean;     // 畜禽飼養場·鴨（1,305）
  livestockFarmGoose: boolean;    // 畜禽飼養場·鵝（531）
  livestockFarmSheep: boolean;    // 畜禽飼養場·羊（644）
  livestockFarmOther: boolean;    // 畜禽飼養場·其他（273，鹿/馬/鵪鶉/兔/鴕鳥）
  livestockSlaughter: boolean;    // 屠宰場（185，家畜/家禽分色）
  livestockFeed: boolean;         // 飼料廠（258）
  livestockMarket: boolean;       // 拍賣/批發市場（21）
  // 🐟 養殖漁業 Aquaculture（靜態 overlay；ponds=PMTiles，zone/cageNet=GeoJSON polygon）
  aquaculturePonds: boolean;      // 逐口魚塭（OSM PMTiles，~15k 面）
  aquacultureZone: boolean;       // 養殖漁業生產區（62 面）
  aquacultureCageNet: boolean;    // 海上箱網（42 面）
  // 🏟️ 運動場館 SPORTS（全國 15,000 點靜態 GeoJSON；5 sublayer 共用 sports-venues source + layer filter）
  sportsSchool: boolean;          // 學校場館（12,221）
  sportsPublicOther: boolean;     // 其他公共場館（1,135）
  sportsPrivate: boolean;         // 民營場館（691）
  sportsPark: boolean;            // 運動公園/開放空間（596）
  sportsCenter: boolean;          // 國民運動中心（357）
  // 醫療基礎點位（5 獨立 layer，單一 PMTiles source med_cat filter；全程可見）
  medHospital: boolean;    // 醫院（NHI 醫學中心/區域/地區，451）
  medClinic: boolean;      // 診所 + 其他醫療（NHI clinic 21765 + other_medical 1707）
  medPharmacy: boolean;    // 藥局（NHI pharmacy 7680）
  medAED: boolean;         // AED（15490）
  medLTC: boolean;         // 長照機構（30764）
  medIsochrone: boolean;   // 醫療等時圈（大醫院可及性 1km grid）
  medDesert: boolean;      // 醫療沙漠（>15 min）
  medICUBeds: boolean;     // 急重症床位壓力（即時，Phase 3）
  // 農業
  agriculture: boolean;          // FTW 2025 農田範圍（PMTiles）
  agriSoil: boolean;             // 25539 全台土壤分類
  agriSoilFertility: boolean;    // 112848 土壤肥力 250m 網格
  agriLeisureFarmZones: boolean; // 9809 休閒農業區
  agriRuralRegen: boolean;       // 176846 農村再生社區
  agriCropSuitability: boolean;  // 7294 132 種作物適栽
  agriPOI: boolean;              // 177247+245+246 休農場/田媽媽/特色農旅 POI
  // 農企業登記（spatial.agri_business_registrations，business_type 區分 3 類）
  agriRetail: boolean;             // 37,430 農產零售商
  agriProduceWholesale: boolean;   // 22,843 蔬果批發商
  agriWholesaleMarket: boolean;    // 53 農產批發市場
  farmRoads: boolean;              // 8678 農路 LineString
  ecoNetworkZones: boolean;        // 12 國土綠網地理分區 MultiPolygon
  // 林業 FORESTRY（12 base + 3 衍生）
  forestCompartments: boolean;
  forestReserve: boolean;
  forestRecreation: boolean;
  forestRoads: boolean;
  forestTreatmentWorks: boolean;
  forestTrailSigns: boolean;
  forestSignalPoints: boolean;
  forestEducationCenters: boolean;
  forestWildlife: boolean;
  forestDamLakes: boolean;
  forestFlatParks: boolean;
  forestAlishanRail: boolean;
  hikingTrails: boolean;           // 全台步道 2,818 條（A 林業署 + B OSM + C 國家公園）
  wasteTruck: boolean;
  wasteSchedule: boolean;
  wasteScheduleNote: boolean;
  wasteStopsStatic: boolean;
  wasteCleaningSquads: boolean;
  wasteRoute: boolean;
  wasteStop: boolean;
  // waste_facilities 8 sub-toggles（incinerator/landfill/transfer/medical 走 Three.js 3D；
  // monitoring/recycling/scrap/other 走 Mapbox circle）
  wfIncinerator: boolean;
  wfLandfill: boolean;
  wfLandfillCoastal: boolean;
  wfTransfer: boolean;
  wfMedical: boolean;
  wfMonitoring: boolean;
  wfRecycling: boolean;
  wfScrapYard: boolean;
  wfOther: boolean;
  // waste_disposal_points 4 sub-toggles（全部走 Mapbox circle）
  wdClothes: boolean;
  wdMixed: boolean;
  wdRecyclingContainer: boolean;
  wdBattery: boolean;
  // 衛星 SPACE — CN 6 群 + TW + 9 國 LEO 遙測
  satellitesYaogan: boolean;
  satellitesJilin: boolean;
  satellitesGaofen: boolean;
  satellitesTJS: boolean;
  satellitesBeidou: boolean;
  satellitesShiyan: boolean;
  satellitesTaiwan: boolean;
  satellitesUSA: boolean;
  satellitesJapan: boolean;
  satellitesRussia: boolean;
  satellitesIndia: boolean;
  satellitesKorea: boolean;
  satellitesFrance: boolean;
  satellitesGermany: boolean;
  satellitesItaly: boolean;
  satellitesIsrael: boolean;
  // 能源 ENERGY MVP 第一波（feat/energy-mvp）
  powerPlants: boolean;          // all_power_plants_v 10,665 設施（按 fuel_type 分色 + capacity_mw 分大小）
  powerPlantGlow: boolean;       // 發電廠 Bloom 測試（Three.js CustomLayer 偽 bloom halo）
  substationEhvGlow: boolean;    // 超高壓變電所 Bloom 測試（複用 GlowPointsScene）
  powerLinesGlow: boolean;       // 高壓輸電線 Bloom 測試（複用 OsmPowerLinesGlowScene，開爆炸參數）
  aviationRestrictedGlow: boolean; // 機場管制/限航/危險 rim glow（Mapbox 4-layer stacked）
  powerStatusHud: boolean;       // 供電燈號 KPI HUD（top-left 卡片）
  powerRegionDemand: boolean;    // 北中南東 4 區 3D bars（質心柱，高 ∝ consumption_mw，色 = reserve_indicator）
  powerGenerationUnit: boolean;  // 機組即時出力 3D beam（InstancedMesh，高 ∝ output_load_rate）
  osmSubstations: boolean;       // 變電所（區域）747：PS/DPS/SS/TRACTION/OTHER
  osmSubstationsEhv: boolean;    // 變電所（超高壓）38：EHV_SWITCH + EHV（含 halo 光暈）
  osmPowerLines: boolean;        // OSM 高壓輸電線 2,305（voltage 分色 + line_type 分粗細）
  osmPowerTowers: boolean;       // OSM 高壓鐵塔 26,589（minzoom 8、統一 sky-300）
  powerPoles: boolean;           // 台電全國電桿 PMTiles 2,959,326（pole_type 5 類分色、純靜態 PMTiles 無 DB）
  osmWindTurbines: boolean;      // OSM 風機 812（466 offshore 海上 + 346 onshore 陸上 + 含 null）
  osmSolarFarms: boolean;        // OSM 光電廠 734（POI centroid）
  osmPowerPlantsStatic: boolean; // OSM 電廠 513（補 IPP/小型，與 all_power_plants_v 可能重疊）
  offshoreWindZones: boolean;    // 離岸風電潛力場址 36（MultiPolygon，含 capacity_mw 開發階段）
  islandPowerGrid: boolean;      // 離島電網 14（澎湖 / 金門 / 馬祖 / 蘭嶼 / 綠島 / 琉球）
  fossilFuelInfra: boolean;      // 化石燃料設施 9（gas_power_plant / lng_terminal / oil_refinery 各 3）
  geothermalWells: boolean;      // 地熱井 36（報告 POI，外連 report_url / figure_url）
  renewablePermitsTaipei: boolean; // 北市再生能源設置許可 438（學校 / 國有 / 機關 / 焚化 / 沼氣 / 水力）
  evChargingStations: boolean;   // 充電站 3,060（2D circle）
  // Phase 8 SSOT facilities 6-layer 重構（取代既有單一 powerPlants）
  facPrimary: boolean;           // L1: 主要電廠 209 (operating+construction，火/核/水/大風/大光電)
  facOffshore: boolean;          // L2: 離岸風電場址 polygon 8（大彰化 / Formosa / Hai Long）
  facPlanned: boolean;           // L3: 規劃 / 未來電廠 35 (pre-construction + announced)
  facHistorical: boolean;        // L4: 歷史 - 退役 / 擱置 15 (retired+mothballed+shelved)
  facSecondary: boolean;         // L5: 次要 341（焚化+地熱+小水力+中小光電/風電）
  facOsmSupplement: boolean;     // L6: OSM 補充 1,215 (source_priority=5 無名單機)
  // 化石燃料 13 layer（接 public.get_fossil_fuel_layers() — Phase B）
  gasStationCpc: boolean;          // 加油站（中油 1,971）
  gasStationFpcc: boolean;         // 加油站（台塑系 OSM 348）
  gasStationTaisugar: boolean;     // 加油站（台糖 73）
  gasStationOther: boolean;        // 加油站（其他/私營 41455 商業司 1,179）
  gasStationCanonical: boolean;    // 加油站 SSOT 合併（全品牌 3,053）
  lpgSubpackaging: boolean;        // LPG 分裝/儲存/驗瓶（oil111 113）
  lpgRetailers: boolean;           // LPG 加氣站/瓦斯行（canonical 1,292）
  lngTerminal: boolean;            // LNG 接收站 SSOT（7）
  pipelineGas: boolean;            // 天然氣主幹線（GEM 11）
  pipelineOilGas: boolean;         // OSM 油氣管線（10）
  industrialRefinery: boolean;     // 煉油 / 化工廠 polygon（OSM 98）
  industrialStorageTank: boolean;  // 油氣儲槽 polygon（OSM 72）
  industrialPowerPlant: boolean;   // 火力廠 polygon（OSM 26）
  coalTerminal: boolean;           // 煤炭碼頭（GEM 4）
  // 雲林 POC 覆蓋分析 — 30km 路網可達 (feat coverage POC)
  gasCoverageAll: boolean;       // H3 z8 hex × coverage_count（加油站總覆蓋密度）
  gasCoverageCpc: boolean;       // 中油 158 站 30km union polygon
  gasCoverageFpcc: boolean;      // 台塑 41 站 30km union polygon
  gasCoverageTaisugar: boolean;  // 台糖 1 站 30km union polygon
  evIsland: boolean;             // H3 z8 hex × ev_count（充電站孤島）
  // 災害 HAZARD（v2 Phase B）
  lightning: boolean;            // 落雷最近 60min（cluster + zoom-gate）
  nuclearRadiation: boolean;     // 核安 51 站即時劑量（is_stale 標離線）
  // 房地產 REAL ESTATE（3 類 × {grid 150m, point}；PMTiles 靜態，period filter 切季）
  realEstateRentalGrid: boolean;   // 租賃 150m 格（price_per_sqm_median 上色）
  realEstateRentalPoint: boolean;  // 租賃 交易點（price_per_sqm 上色）
  realEstateSaleGrid: boolean;     // 買賣 150m 格
  realEstateSalePoint: boolean;    // 買賣 交易點
  realEstatePresaleGrid: boolean;  // 預售 150m 格
  realEstatePresalePoint: boolean; // 預售 交易點
  // Base map（行政邊界 + 等高線 + OSM 路網，PMTiles 來自 taipei-gis-analytics SSOT）
  countyBoundary: boolean;     // 22 縣市界（內政部，名稱/行政區域代碼）
  townshipBoundary: boolean;   // 鄉鎮市區界
  villageBoundary: boolean;    // 村里界
  contour25k: boolean;         // 經建版 1:25000 等高線（精度 10m，~21% 全臺覆蓋）
  contourDtm20: boolean;       // DTM 20m 等高線（精度 20m，全臺完整）
  osmRoadDrive: boolean;       // OSM 可駕駛道路（55 萬 edges，按 highway 等級分色）
  osmExpressway: boolean;      // OSM 快速道路 / 高速公路（橘色粗線突顯）
  hillshade: boolean;          // 山體陰影 raster（灰階 PNG，烤過 colormap）
  slope: boolean;              // 坡度 raster（綠→黃→紅 ramp，0-45°）
  aspect: boolean;             // 坡向 raster（HSV 環狀 N=紅 E=黃 S=綠 W=藍）
  // 警政司法民防 17 layer（資料來自 taipei-gis-analytics police_justice/）
  policeStation: boolean;             // 2,065 警察機關（分局/派出所/專業警隊/總局）
  womenChildWarning: boolean;         // 185 婦幼警示點
  speedCamera: boolean;               // 2,056 測速照相
  speedZoneSegment: boolean;          // 25 區間測速路段（LineString）
  court: boolean;                     // 35 法院（最高/高/地方/行政/智慧財產/少年及家事）
  prosecutorsOffice: boolean;         // 29 檢察署
  correctionalFacility: boolean;      // 51 矯正機關（監獄/看守所/戒治所/少觀所/矯正學校）
  courtJurisdiction: boolean;         // 22 法院管轄縣市範圍（MultiPolygon PMTiles）
  crimeAreaMonthly: boolean;          // 368 鄉鎮犯罪統計（Polygon PMTiles，11 年累計 39 萬事件）
  theftTaoyuan: boolean;              // 1,423 桃園竊盜點（住宅/機車/自行車/汽車）
  trafficAccidentYearly: boolean;     // 1,600 A1 死亡事故年度累積（114 年靜態）
  accidentTaipei: boolean;            // 22,918 北市事故點（A1+A2 多年累積）
  a1AccidentRealtime: boolean;        // realtime.traffic_accidents_a1 每 12h（rpc_a1_by_bbox）
  investigationBureau: boolean;       // 29 調查局所屬
  antiCorruptionOffice: boolean;      // 66 廉政署（central/local）
  immigrationOffice: boolean;         // 25 移民署服務站
  coastGuardStation: boolean;         // 269 海巡（巡防隊+漁港）
  civilDefenseShelter: boolean;       // 62,695 防空避難（PMTiles，z≥10 才顯示）
  aviationControl: boolean;           // ✈️ 飛航情報/終端管制（FIR 3 + TMA 6，FIR 只邊框）
  aviationRestricted: boolean;        // ⛔ 禁/限航 + 危險 + 機場管制（CTR/CONTROL/SURFACE/RCR/DANGER/ULZ/CIRCUIT 72）
  droneNoFlyZone: boolean;            // 🚫 無人機禁航區 紅+未分類 5,633（共用 drone_restricted_zones.pmtiles）
  droneRestrictedZone: boolean;       // ⚠️ 無人機限航區 黃 108（需申請）
  // 警察覆蓋分析（isochrone PMTiles，帶 overlap_count）
  policeIsoSubstation: boolean;       // 派出所 isochrone（步行/開車 × 5/10 min）
  policeIsoPrecinct: boolean;         // 分局 isochrone（步行/開車 × 15/30 min）
  policeIsoCityDept: boolean;         // 縣市警局 isochrone（步行/開車 × 30/60 min）
  // 環境污染 POLLUTION（PMTiles，來自 taipei-gis-analytics environment/pollution_source）
  pollutionFacility: boolean;   // 污染潛勢設施（EMS_S_01 × 5 介質 × 嚴重度；152,246）
  pollutionPenaltyCritical: boolean; // 重大裁處事件（severity_event=critical；預設亮點）
  pollutionPenaltyGeneral: boolean;  // 一般裁處事件（severity_event=high/normal；預設背景）
  pollutionPenaltyMobile: boolean;   // 移動污染裁處（severity_event=mobile；預設關閉）
  pollutionSite: boolean;       // 污染場址（EMS_S_07；8,253；S4 確認污染）
}

// ── 空氣品質 ──

/** airtw 色階圖產品 */
export type AqiProduct = "AQI" | "PM25" | "PM10" | "O3" | "NO2";

export const AQI_PRODUCT_LABELS: Record<AqiProduct, string> = {
  AQI: "AQI",
  PM25: "PM2.5",
  PM10: "PM10",
  O3: "O₃",
  NO2: "NO₂",
};

/** 環境部 77 站即時觀測 */
export interface AqiStation {
  stationId: string;
  stationName: string | null;
  county: string | null;
  lon: number;
  lat: number;
  observedAt: string;
  aqi: number | null;
  pollutant: string | null;
  status: string | null;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  windSpeed: number | null;
  windDirection: number | null;
}

/** LASS AirBox / 環境部微感測 */
export interface MicroSensor {
  deviceId: string;
  source: string;
  area: string | null;
  app: string | null;
  lon: number;
  lat: number;
  observedAt: string;
  pm25: number | null;
  pm10: number | null;
  pm1: number | null;
  temperature: number | null;
  humidity: number | null;
}
