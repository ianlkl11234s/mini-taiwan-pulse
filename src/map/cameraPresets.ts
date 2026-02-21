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
    center: [121.5525, 25.0694],
    zoom: 13,
    pitch: 75,
    bearing: 100,
  },
  {
    name: "高雄國際機場",
    icao: "RCKH",
    center: [120.3506, 22.5771],
    zoom: 12,
    pitch: 80,
    bearing: 190,
  },
  {
    name: "台中清泉崗",
    icao: "RCMQ",
    center: [120.6208, 24.2647],
    zoom: 12,
    pitch: 78,
    bearing: 30,
  },
  {
    name: "花蓮機場",
    icao: "RCYU",
    center: [121.6162, 24.0231],
    zoom: 12,
    pitch: 78,
    bearing: 350,
  },
  {
    name: "金門尚義機場",
    icao: "RCBS",
    center: [118.38, 24.43],
    zoom: 11,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "馬祖南竿機場",
    icao: "RCFG",
    center: [119.97, 26.16],
    zoom: 12,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "台東豐年機場",
    icao: "RCFN",
    center: [121.10, 22.76],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "台南機場",
    icao: "RCNN",
    center: [120.22, 22.95],
    zoom: 12,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "澎湖馬公機場",
    icao: "RCQC",
    center: [119.63, 23.57],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "七美機場",
    icao: "RCCM",
    center: [119.52, 23.21],
    zoom: 13,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "綠島機場",
    icao: "RCGI",
    center: [121.49, 22.67],
    zoom: 13,
    pitch: 0,
    bearing: 0,
  },
];

export function getPresetByIcao(icao: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.icao === icao);
}
