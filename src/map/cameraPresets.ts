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
  RCFN: { name: "台南機場", iata: "TNN" },
  RCKU: { name: "嘉義機場", iata: "CYI" },
  RCNN: { name: "台東豐年機場", iata: "TTT" },
  RCQC: { name: "澎湖馬公機場", iata: "MZG" },
};

export function getAirportInfo(icao: string): { name: string; iata: string } | undefined {
  return AIRPORT_INFO[icao];
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: "桃園國際機場",
    icao: "RCTP",
    center: [121.2342, 25.0797],
    zoom: 12,
    pitch: 80,
    bearing: 60,
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
];

export function getPresetByIcao(icao: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.icao === icao);
}
