/**
 * 雷聲波前（概念視覺，計畫書 §6.2 wavefront_overlay）：半徑 = (t − 閃光時刻) × 聲速。
 * **示意，不是聲壓範圍**；只畫到候選半徑（THUNDER.candidateRadiusM）為止。
 * 同時波前數有上限（T14）：超過時保留離中心最近的幾個。
 */
import { COMMON, THUNDER } from "../model/soundProfiles";
import { haversineM } from "./geometryDistance";

export interface WavefrontStrike {
  id: string;
  lon: number;
  lat: number;
  flashTime: number;
}

export interface Wavefront {
  id: string;
  lon: number;
  lat: number;
  radiusM: number;
  /** 0–1：越外圈越淡（只給視覺用） */
  fade: number;
}

export const WAVEFRONT_DEFAULT_CAP = 12;

export function activeWavefronts(
  strikes: readonly WavefrontStrike[],
  t: number,
  center: { lon: number; lat: number } | null,
  cap: number = WAVEFRONT_DEFAULT_CAP,
  maxRadiusM: number = THUNDER.candidateRadiusM.value,
  speedMps: number = COMMON.speedOfSoundMps.value,
): { fronts: Wavefront[]; activeCount: number } {
  const maxAge = maxRadiusM / speedMps;
  const live: (Wavefront & { d: number })[] = [];
  for (const s of strikes) {
    const age = t - s.flashTime;
    if (age < 0 || age > maxAge) continue;
    const radiusM = age * speedMps;
    const d = center ? haversineM(center.lon, center.lat, s.lon, s.lat) : 0;
    live.push({ id: s.id, lon: s.lon, lat: s.lat, radiusM, fade: 1 - radiusM / maxRadiusM, d });
  }
  live.sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
  const fronts = live.slice(0, Math.max(0, cap)).map(({ d: _d, ...w }) => w);
  return { fronts, activeCount: live.length };
}

const DEG = Math.PI / 180;

/** 測地圓環（destination point 公式），回傳 [lon, lat][]（首尾相同） */
export function geodesicRing(lon: number, lat: number, radiusM: number, steps = 64): [number, number][] {
  const R = COMMON.earthRadiusM.value;
  const δ = radiusM / R;
  const φ1 = lat * DEG;
  const λ1 = lon * DEG;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = ((i % steps) / steps) * 2 * Math.PI;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    out.push([λ2 / DEG, φ2 / DEG]);
  }
  return out;
}
