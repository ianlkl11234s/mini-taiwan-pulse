// 計算衛星「下次通過台灣」的 ETA 與最小距離

import * as satellite from "satellite.js";
import { propagate } from "../data/satelliteSGP4";

/** 台灣中心點（粗略，取在台中附近） */
export const TAIWAN_CENTER: [number, number] = [121.0, 23.5];

/** ±300 km buffer 視為「通過台灣」 */
export const TAIWAN_PASS_RADIUS_KM = 300;

/** Haversine 球面距離 (km) */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface PassInfo {
  /** 距 fromTime 多少分鐘後通過（不在 windowMin 內找到則 -1） */
  etaMin: number;
  /** 最近通過時與台灣中心的距離 (km) */
  minDistKm: number;
}

/**
 * 掃 fromTime 起 windowMin 分鐘內，每 stepSec 算一個位置，
 * 找出第一個「進入 ±300km buffer」的時刻當 ETA。
 * 若整個 window 內都不進入，回 etaMin: -1, minDistKm: 全 window 內最小距離。
 */
export function nextPassToTaiwan(
  satrec: satellite.SatRec,
  fromTime: Date,
  windowMin = 180,
  stepSec = 60,
): PassInfo {
  const totalSteps = Math.floor((windowMin * 60) / stepSec);
  let minDist = Infinity;
  let firstHitStep = -1;
  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(fromTime.getTime() + i * stepSec * 1000);
    const p = propagate(satrec, t);
    if (!p) continue;
    const d = haversineKm([p.lng, p.lat], TAIWAN_CENTER);
    if (d < minDist) minDist = d;
    if (d <= TAIWAN_PASS_RADIUS_KM && firstHitStep < 0) {
      firstHitStep = i;
      break;
    }
  }
  return {
    etaMin: firstHitStep < 0 ? -1 : (firstHitStep * stepSec) / 60,
    minDistKm: isFinite(minDist) ? minDist : -1,
  };
}
