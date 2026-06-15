/**
 * Maneuver impact calculator — 給 §A 變軌警報判斷「是否影響台灣」用
 *
 * 用 SGP4 跑 7 天 ground track 數「過台灣次數」（elevation > 10°），
 * 比較變軌前後差異。
 *
 * 與 §F ManeuverCompareModal 同邏輯但只算過台次數（不算 region），更快。
 */
import * as satellite from "satellite.js";
import type { TleHistoryRow } from "../data/satelliteHistoryLoader";

const TW_CENTER = { lon: 121.0, lat: 23.7 };
const R_EARTH = 6371;

function distanceKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

function coverageRadiusKm(altKm: number): number {
  const elev = 10 * Math.PI / 180;
  const ratio = R_EARTH / (R_EARTH + altKm);
  const eta = Math.asin(ratio * Math.cos(elev));
  const lambda = Math.PI / 2 - elev - eta;
  return Math.max(120, R_EARTH * lambda);
}

/** 從一條 TLE 跑 7 天，數過台灣的次數（elevation > 10° 入境邊緣） */
export function countTwPasses(row: TleHistoryRow, anchorMs: number): number | null {
  if (!row.tle_line1 || !row.tle_line2) return null;
  let satrec: satellite.SatRec;
  try {
    satrec = satellite.twoline2satrec(row.tle_line1, row.tle_line2);
  } catch {
    return null;
  }
  const STEP_MIN = 10;
  const SPAN_HOURS = 7 * 24;
  let passes = 0;
  let inside = false;
  for (let m = 0; m <= SPAN_HOURS * 60; m += STEP_MIN) {
    const t = new Date(anchorMs + m * 60 * 1000);
    try {
      const pv = satellite.propagate(satrec, t);
      if (typeof pv.position === "boolean" || !pv.position) continue;
      const gmst = satellite.gstime(t);
      const geo = satellite.eciToGeodetic(pv.position, gmst);
      const lon = satellite.degreesLong(geo.longitude);
      const lat = satellite.degreesLat(geo.latitude);
      const altKm = geo.height;
      const radius = coverageRadiusKm(altKm);
      const dist = distanceKm(lon, lat, TW_CENTER.lon, TW_CENTER.lat);
      const inNow = dist < radius;
      if (inNow && !inside) {
        inside = true;
        passes++;
      } else if (!inNow && inside) {
        inside = false;
      }
    } catch { /* skip */ }
  }
  return passes;
}

export interface ManeuverImpact {
  passBefore: number;
  passAfter: number;
  passDiff: number;
  affectsTw: boolean;
}
