import type { CameraPreset } from "../types";

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
