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

// ── All Presets ──

export const ALL_PRESETS: CameraPreset[] = [
  // Overview
  {
    name: "全台總覽",
    id: "overview",
    category: "overview",
    center: [120.3795, 23.6081],
    zoom: 6.9,
    pitch: 0,
    bearing: 0,
  },
  // Cities
  {
    name: "台北",
    id: "taipei",
    category: "city",
    center: [121.53, 25.05],
    zoom: 12,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "桃園",
    id: "taoyuan",
    category: "city",
    center: [121.30, 24.99],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "台中",
    id: "taichung",
    category: "city",
    center: [120.68, 24.15],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "台南",
    id: "tainan",
    category: "city",
    center: [120.21, 23.00],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "高雄",
    id: "kaohsiung",
    category: "city",
    center: [120.30, 22.63],
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "台東",
    id: "taitung",
    category: "city",
    center: [121.15, 22.76],
    zoom: 11,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "花蓮",
    id: "hualien",
    category: "city",
    center: [121.60, 23.98],
    zoom: 11,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "澎湖",
    id: "penghu",
    category: "city",
    center: [119.58, 23.57],
    zoom: 11,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "馬祖",
    id: "matsu",
    category: "city",
    center: [119.95, 26.17],
    zoom: 12,
    pitch: 0,
    bearing: 0,
  },
  {
    name: "金門",
    id: "kinmen",
    category: "city",
    center: [118.38, 24.44],
    zoom: 12,
    pitch: 0,
    bearing: 0,
  },
  // Airports
  {
    name: "桃園國際機場",
    id: "RCTP",
    category: "airport",
    center: [121.2281, 25.0927],
    zoom: 10.4,
    pitch: 57,
    bearing: 16,
  },
  {
    name: "松山機場",
    id: "RCSS",
    category: "airport",
    center: [121.555, 25.0697],
    zoom: 12.8,
    pitch: 57,
    bearing: 48,
  },
  {
    name: "高雄國際機場",
    id: "RCKH",
    category: "airport",
    center: [120.3562, 22.5703],
    zoom: 11.6,
    pitch: 54,
    bearing: -137,
  },
  {
    name: "台中清泉崗",
    id: "RCMQ",
    category: "airport",
    center: [120.612, 24.2787],
    zoom: 10.7,
    pitch: 51,
    bearing: -26,
  },
  {
    name: "花蓮機場",
    id: "RCYU",
    category: "airport",
    center: [121.6162, 24.0231],
    zoom: 12,
    pitch: 51,
    bearing: 84,
  },
  {
    name: "金門尚義機場",
    id: "RCBS",
    category: "airport",
    center: [118.3655, 24.4269],
    zoom: 11,
    pitch: 51,
    bearing: 111,
  },
  {
    name: "馬祖南竿機場",
    id: "RCFG",
    category: "airport",
    center: [119.9576, 26.1643],
    zoom: 11.1,
    pitch: 30,
    bearing: 88,
  },
  {
    name: "台東豐年機場",
    id: "RCFN",
    category: "airport",
    center: [121.0967, 22.7566],
    zoom: 11.5,
    pitch: 59,
    bearing: 79,
  },
  {
    name: "台南機場",
    id: "RCNN",
    category: "airport",
    center: [120.2099, 22.9469],
    zoom: 12,
    pitch: 36,
    bearing: -27,
  },
  {
    name: "澎湖馬公機場",
    id: "RCQC",
    category: "airport",
    center: [119.6389, 23.5673],
    zoom: 11.5,
    pitch: 46,
    bearing: 59,
  },
  {
    name: "七美機場",
    id: "RCCM",
    category: "airport",
    center: [119.4078, 23.208],
    zoom: 11.9,
    pitch: 39,
    bearing: 55,
  },
  {
    name: "綠島機場",
    id: "RCGI",
    category: "airport",
    center: [121.4666, 22.6717],
    zoom: 13,
    pitch: 30,
    bearing: -54,
  },
  {
    name: "嘉義機場",
    id: "RCKU",
    category: "airport",
    center: [120.3898, 23.4544],
    zoom: 11.6,
    pitch: 48,
    bearing: -36,
  },
  {
    name: "馬祖北竿機場",
    id: "RCMT",
    category: "airport",
    center: [119.9881, 26.2228],
    zoom: 12.8,
    pitch: 33,
    bearing: 91,
  },
  // ── Scenes（時空場景） ──
  {
    name: "桃機起降忙碌時段",
    id: "scene-taoyuan-rush",
    category: "scene",
    description: "桃園國際機場密集起降",
    center: [121.3564, 25.1915],
    zoom: 10.1,
    pitch: 74,
    bearing: 78,
    time: 1771458900, // 2026-02-19 07:55 TST
    speed: 60,
    autoPlay: true,
    layers: { flights: true, ships: false, rail: false },
  },
  {
    name: "澎湖夜間捕撈",
    id: "scene-penghu-fishing",
    category: "scene",
    description: "漁船群集澎湖海域作業",
    center: [119.2899, 23.3291],
    zoom: 10,
    pitch: 52,
    bearing: 16,
    time: 1771496220, // 2026-02-19 18:17 TST
    speed: 60,
    autoPlay: true,
    layers: { ships: true, flights: false, rail: false },
  },
];

// 開站預設鏡位：台北市中心 z12.5（行道樹圖層預設開啟，進站直接落在主場景；
// 「全台總覽」preset 本身不動，仍可從鏡位選單切換）
export const DEFAULT_CAMERA: CameraPreset = {
  ...ALL_PRESETS[0]!,
  center: [121.5318, 25.0464],
  zoom: 12.5,
};

/**
 * 「日本 Japan」rail tab 打開時 flyTo 的相機（clone SatelliteConsole 自動飛台灣模式）。
 * 刻意不放進 ALL_PRESETS —— 只給 App 的 onJapanOpen flyTo 用，不在 Locations 面板多長一顆按鈕。
 * 座標為主要島嶼中心估算；含沖繩可改用 fitBounds([[127.6,26.2],[146.5,45.8]])。上瀏覽器目視微調。
 */
export const JAPAN_CAMERA: CameraPreset = {
  name: "日本",
  id: "japan",
  category: "overview",
  center: [137.5, 37.5],
  zoom: 4.7,
  pitch: 0,
  bearing: 0,
};

export function getPresetById(id: string): CameraPreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}
