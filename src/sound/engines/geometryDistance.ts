/**
 * 測地距離（haversine，公尺）與 3D 斜距。不可用經緯度度數直接相減當公尺。
 */
import { COMMON } from "../model/soundProfiles";

const DEG = Math.PI / 180;

/** 兩點大圓距離（公尺）；參數順序 lon, lat */
export function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * COMMON.earthRadiusM.value * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 水平距離＋高差 → 斜距（公尺） */
export function slantDistanceM(horizontalM: number, verticalDeltaM: number): number {
  return Math.hypot(horizontalM, verticalDeltaM);
}
