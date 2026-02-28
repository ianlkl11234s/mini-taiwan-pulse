import type { CameraPreset } from "../types";

/** 全台機場資訊（名稱 + IATA），涵蓋所有資料中可能出現的台灣機場 */
export const AIRPORT_INFO: Record<string, { name: string; iata: string }> = {
  RCTP: { name: "桃園國際機場", iata: "TPE" },
  RCSS: { name: "松山機場", iata: "TSA" },
  RCKH: { name: "高雄國際機場", iata: "KHH" },
  RCMQ: { name: "台中清泉崗", iata: "RMQ" },
  RCYU: { name: "花蓮機場", iata: "HUN" },
  RCBS: { name: "金門尚義機場", iata: "KNH" },
  RCFG: { name: "馬祖南竿機場", iata: "LZN" },
  RCFN: { name: "台東豐年機場", iata: "TTT" },
  RCKU: { name: "嘉義機場", iata: "CYI" },
  RCNN: { name: "台南機場", iata: "TNN" },
  RCQC: { name: "澎湖馬公機場", iata: "MZG" },
  RCCM: { name: "七美機場", iata: "CMJ" },
  RCGI: { name: "綠島機場", iata: "GNI" },
  RCMT: { name: "馬祖北竿機場", iata: "MFK" },
};

export function getAirportInfo(icao: string): { name: string; iata: string } | undefined {
  return AIRPORT_INFO[icao];
}

export const DEFAULT_CAMERA: CameraPreset = {
  name: "全台總覽",
  icao: "",
  center: [121.1189, 23.4339],
  zoom: 7.9,
  pitch: 48,
  bearing: -21,
};

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: "桃園國際機場",
    icao: "RCTP",
    center: [121.2281, 25.0927],
    zoom: 10.4,
    pitch: 57,
    bearing: 16,
  },
  {
    name: "松山機場",
    icao: "RCSS",
    center: [121.555, 25.0697],
    zoom: 12.8,
    pitch: 57,
    bearing: 48,
  },
  {
    name: "高雄國際機場",
    icao: "RCKH",
    center: [120.3562, 22.5703],
    zoom: 11.6,
    pitch: 54,
    bearing: -137,
  },
  {
    name: "台中清泉崗",
    icao: "RCMQ",
    center: [120.612, 24.2787],
    zoom: 10.7,
    pitch: 51,
    bearing: -26,
  },
  {
    name: "花蓮機場",
    icao: "RCYU",
    center: [121.6162, 24.0231],
    zoom: 12,
    pitch: 51,
    bearing: 84,
  },
  {
    name: "金門尚義機場",
    icao: "RCBS",
    center: [118.3655, 24.4269],
    zoom: 11,
    pitch: 51,
    bearing: 111,
  },
  {
    name: "馬祖南竿機場",
    icao: "RCFG",
    center: [119.9576, 26.1643],
    zoom: 11.1,
    pitch: 30,
    bearing: 88,
  },
  {
    name: "台東豐年機場",
    icao: "RCFN",
    center: [121.0967, 22.7566],
    zoom: 11.5,
    pitch: 59,
    bearing: 79,
  },
  {
    name: "台南機場",
    icao: "RCNN",
    center: [120.2099, 22.9469],
    zoom: 12,
    pitch: 36,
    bearing: -27,
  },
  {
    name: "澎湖馬公機場",
    icao: "RCQC",
    center: [119.6389, 23.5673],
    zoom: 11.5,
    pitch: 46,
    bearing: 59,
  },
  {
    name: "七美機場",
    icao: "RCCM",
    center: [119.4078, 23.208],
    zoom: 11.9,
    pitch: 39,
    bearing: 55,
  },
  {
    name: "綠島機場",
    icao: "RCGI",
    center: [121.4666, 22.6717],
    zoom: 13,
    pitch: 30,
    bearing: -54,
  },
  {
    name: "嘉義機場",
    icao: "RCKU",
    center: [120.3898, 23.4544],
    zoom: 11.6,
    pitch: 48,
    bearing: -36,
  },
  {
    name: "馬祖北竿機場",
    icao: "RCMT",
    center: [119.9881, 26.2228],
    zoom: 12.8,
    pitch: 33,
    bearing: 91,
  },
];

export function getPresetByIcao(icao: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.icao === icao);
}
