// 純前端 SGP4 計算（搬自 satellite-art）。
// 不依賴任何 React/Mapbox/Supabase，方便測試 + 在 hook 任何地方呼叫。

import * as satellite from "satellite.js";

/** TLE line1 epoch → unix ms */
export function parseTleEpoch(line1: string): number {
  const yy = parseInt(line1.substring(18, 20), 10);
  const doy = parseFloat(line1.substring(20, 32));
  if (!isFinite(yy) || !isFinite(doy)) return 0;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const jan1 = Date.UTC(year, 0, 1);
  return jan1 + (doy - 1) * 86400 * 1000;
}

/** TLE epoch 是否在 maxAgeDays 內（過期衛星通常已 decay 或失追） */
export function isTleActive(line1: string, maxAgeDays = 30, now = Date.now()): boolean {
  const epochMs = parseTleEpoch(line1);
  if (epochMs === 0) return false;
  return (now - epochMs) < maxAgeDays * 86400 * 1000;
}

export interface GeoPos {
  lat: number;
  lng: number;
  altKm: number;
}

/** 用 SGP4 propagate 單個時刻的位置（失敗或數值異常回 null） */
export function propagate(satrec: satellite.SatRec, date: Date): GeoPos | null {
  const posVel = satellite.propagate(satrec, date);
  if (!posVel.position || typeof posVel.position === "boolean") return null;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(posVel.position, gmst);
  const altKm = geo.height; // satellite.js geo.height 單位為 km
  // sanity check：500,000 km 顯然炸了（GEO 也才 36,000）
  if (!isFinite(altKm) || altKm < 0 || altKm > 500000) return null;
  return {
    lat: satellite.degreesLat(geo.latitude),
    lng: satellite.degreesLong(geo.longitude),
    altKm,
  };
}

/** 算一條軌跡：從 startTime 起，durationMin 內每 stepSec 一個點 */
export function computeOrbitPath(
  satrec: satellite.SatRec,
  startTime: Date,
  durationMin: number,
  stepSec: number,
): GeoPos[] {
  const out: GeoPos[] = [];
  const totalSteps = Math.floor((durationMin * 60) / stepSec);
  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(startTime.getTime() + i * stepSec * 1000);
    const p = propagate(satrec, t);
    if (p) out.push(p);
  }
  return out;
}

/**
 * 在換日線（±180° 經度跳變）處拆分路徑成多段，避免畫橫跨地圖的直線。
 */
export function splitAtDateline(path: GeoPos[]): GeoPos[][] {
  if (path.length < 2) return path.length === 0 ? [] : [path];
  const segs: GeoPos[][] = [];
  let cur: GeoPos[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const diff = Math.abs(path[i]!.lng - path[i - 1]!.lng);
    if (diff > 180) {
      if (cur.length >= 2) segs.push(cur);
      cur = [path[i]!];
    } else {
      cur.push(path[i]!);
    }
  }
  if (cur.length >= 2) segs.push(cur);
  return segs;
}

/** 軌道類型分類（用 period 粗判 LEO/MEO/GEO） */
export function classifyOrbit(periodMin: number, inclinationDeg: number): "LEO" | "MEO" | "GEO" | "HEO" {
  if (periodMin >= 1400 && periodMin <= 1500 && Math.abs(inclinationDeg) < 10) return "GEO";
  if (periodMin > 200) return "MEO";
  if (periodMin < 200 && periodMin > 70) return "LEO";
  return "HEO";
}
