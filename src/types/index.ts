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
  | "h3Population" | "popCount" | "indicators"
  | "socioeconomic" | "spatialEconomy"
  | "temperatureWave"
  | "schools" | "convenienceStores"
  | "submarineCables" | "landingStations"
  | "activeFaults"
  | "newsEvents"
  | "youbikeFullness"
  | "cwaCloudImagery"
  | "cwaRadarImagery"
  | "aqiImagery"
  | "aqiStations"
  | "aqiMicroSensors"
  | "earthquakes"
  | "disasterAlerts"
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
  | "rainGauge"
  | "riverLevel"
  | "groundwater"
  | "groundwaterWells"
  | "iotWraRiver"
  | "iotWraStructure";

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
  type: "line" | "fill" | "circle" | "fill-extrusion";
  layout?: Record<string, unknown>;
  paint: (isDark: boolean, params?: Record<string, number>) => Record<string, unknown>;
  minzoom?: number;
}

export interface OverlayConfig {
  id: keyof LayerVisibility;
  sourceUrl: string;
  sourceId: string;
  layers: OverlayLayerSpec[];
  rebuildOnParamChange?: string[];
  filter?: unknown[];
}

// ── 點擊特徵資訊 ──

export interface FeatureInfo {
  layerType: "submarineCable" | "landingStation" | "school" | "convenienceStore"
    | "weatherStation" | "bikeStation" | "busStation" | "lighthouse" | "railStation"
    | "port" | "airport" | "activeFault" | "newsEvent" | "disasterAlert"
    | "aqiStation" | "microSensor"
    | "waterFacility" | "waterMonitor" | "waterDam" | "waterReservoirPoly"
    | "rainGauge" | "riverLevel" | "groundwater" | "groundwaterWell"
    | "iotWraRiver" | "iotWraStructure";
  properties: Record<string, unknown>;
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
  disasterAlerts: boolean;
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
  rainGauge: boolean;
  riverLevel: boolean;
  groundwater: boolean;
  groundwaterWells: boolean;
  iotWraRiver: boolean;
  iotWraStructure: boolean;
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
