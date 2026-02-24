/** 單一軌跡點：[緯度, 經度, 高度(公尺), Unix timestamp] */
export type TrailPoint = [number, number, number, number];

/** 航班資料（來自 aviation_data.json） */
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

/** 機場預設視角 */
export interface CameraPreset {
  name: string;
  icao: string;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/** 時間軸狀態 */
export interface TimelineState {
  playing: boolean;
  currentTime: number;
  startTime: number;
  endTime: number;
  speed: number;
}

/** 顯示模式 */
export type ViewMode = "airport" | "all-taiwan" | "time-window" | "single";

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

// ── 圖層控制 ──

export interface LayerVisibility {
  flights: boolean;
  ships: boolean;
  rail: boolean;
  stations: boolean;
}
