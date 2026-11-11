/**
 * City Sound Atlas — UI 端的資料編排（載入哪個來源、接收點周邊預篩）。
 * 不 import React；hook 呼叫這裡，測試可直接打。
 */
import { fetchAirspaceDayArrow } from "../data/airspaceLoader";
import { fetchLightningDay } from "../data/lightningLoader";
import { fetchRainGaugeDay } from "../data/rainGaugeLoader";
import type { Flight } from "../types";
import { AVIATION, RAIN } from "./model/soundProfiles";
import { haversineM } from "./engines/geometryDistance";
import { aviationPositionAt, loadAviation, type AviationRecord } from "./sourceAdapters/aviationAdapter";
import { loadRain, nearestRainStation, type RainRecord } from "./sourceAdapters/rainFieldAdapter";
import { loadThunder, type ThunderRecord } from "./sourceAdapters/thunderAdapter";
import { loadWaste, type WasteRecord } from "./sourceAdapters/wasteAdapter";
import { snapshotApplies, snapshotFetchers, type SoundSceneSnapshot } from "./scenes";
import type { Receiver, SoundSourceFamily, SoundSourceRecord, SoundSourceSet } from "./types";

// ── 垃圾車：只讀接收點所在（含附近）縣市 ───────────────────

/**
 * 縣市外框（[w,s,e,n]，取整並外擴，**刻意偏大**）：只用來決定讀哪些垃圾車分組檔，
 * 是超集合篩選；實際候選仍由 adapter 以 500 m 半徑判定。
 */
const CITY_BBOX: Record<string, [number, number, number, number]> = {
  臺北市: [121.44, 24.96, 121.67, 25.21],
  新北市: [121.28, 24.67, 122.01, 25.3],
  桃園市: [120.98, 24.59, 121.48, 25.13],
  臺中市: [120.46, 23.99, 121.46, 24.45],
  臺南市: [120.03, 22.88, 120.66, 23.42],
  高雄市: [120.17, 22.47, 121.05, 23.47],
  基隆市: [121.62, 25.05, 121.8, 25.2],
  新竹市: [120.88, 24.7, 121.03, 24.86],
  嘉義市: [120.39, 23.44, 120.5, 23.52],
  新竹縣: [120.9, 24.4, 121.42, 24.95],
  苗栗縣: [120.62, 24.26, 121.27, 24.75],
  彰化縣: [120.22, 23.78, 120.71, 24.21],
  南投縣: [120.62, 23.44, 121.35, 24.26],
  雲林縣: [120.13, 23.5, 120.73, 23.84],
  嘉義縣: [120.1, 23.15, 120.95, 23.65],
  屏東縣: [120.35, 21.89, 120.92, 22.89],
  宜蘭縣: [121.31, 24.3, 121.96, 24.99],
  花蓮縣: [121.03, 23.09, 121.67, 24.38],
  臺東縣: [120.73, 21.94, 121.62, 23.45],
  澎湖縣: [119.3, 23.18, 119.73, 23.8],
  金門縣: [118.2, 24.37, 118.5, 24.53],
  連江縣: [119.88, 25.93, 120.52, 26.39],
};
const CITY_PAD_DEG = 0.03;

export function citiesNearReceiver(receiver: { longitude: number; latitude: number }): string[] {
  const { longitude: x, latitude: y } = receiver;
  return Object.entries(CITY_BBOX)
    .filter(([, [w, s, e, n]]) => x >= w - CITY_PAD_DEG && x <= e + CITY_PAD_DEG && y >= s - CITY_PAD_DEG && y <= n + CITY_PAD_DEG)
    .map(([c]) => c)
    .sort();
}

// ── 載入 ─────────────────────────────────────────────────

export type SetOrigin = "scene" | "live";

export interface LoadedFamily {
  set: SoundSourceSet;
  origin: SetOrigin;
}

const aviationDayCache = new Map<string, Promise<{ flights: Flight[] }>>();
/** get_flight_trails 整日一次（同日重開圖層不重抓；失敗不快取） */
function cachedAviationDay(date: string): Promise<{ flights: Flight[] }> {
  let p = aviationDayCache.get(date);
  if (!p) {
    p = fetchAirspaceDayArrow(date).then((d) => ({ flights: d.flights }));
    p.catch(() => aviationDayCache.delete(date));
    aviationDayCache.set(date, p);
    while (aviationDayCache.size > 3) aviationDayCache.delete(aviationDayCache.keys().next().value!);
  }
  return p;
}

/** 這個家族本次載入的快取鍵（相同鍵 → 同一份資料） */
export function familyLoadKey(
  family: SoundSourceFamily,
  date: string,
  receiver: Receiver | null,
  snapshot: SoundSceneSnapshot | null,
): string | null {
  if (family === "waste_collection") {
    if (!receiver) return null; // 垃圾車只讀接收點附近縣市；沒有接收點不載
    return `${family}|${date}|${citiesNearReceiver(receiver).join(",")}`;
  }
  const applies = snapshotApplies(snapshot, date, receiver);
  const scenePart = applies && snapshot && sceneHasBlock(snapshot, family) ? `scene:${snapshot.id}` : "live";
  return `${family}|${date}|${scenePart}`;
}

function sceneHasBlock(snapshot: SoundSceneSnapshot, family: SoundSourceFamily): boolean {
  if (family === "aviation") return !!snapshot.aviation;
  if (family === "thunder") return !!snapshot.thunder;
  if (family === "rain") return !!snapshot.rain;
  return false;
}

/**
 * 載入一個家族：場景快照適用且有該區塊 → 快照；否則即時 RPC／靜態檔。
 * 回傳 null 表示這個家族目前不需要載入（垃圾車沒有接收點）。
 */
export async function loadSoundFamily(
  family: SoundSourceFamily,
  date: string,
  receiver: Receiver | null,
  snapshot: SoundSceneSnapshot | null,
  nowUnix: number = Date.now() / 1000,
): Promise<LoadedFamily | null> {
  const applies = snapshotApplies(snapshot, date, receiver);
  const fx = applies && snapshot ? snapshotFetchers(snapshot, fetchLightningDay) : {};
  switch (family) {
    case "aviation":
      return { set: await loadAviation({ date, nowUnix }, fx.aviation ?? cachedAviationDay), origin: fx.aviation ? "scene" : "live" };
    case "rain":
      return { set: await loadRain({ date }, fx.rain ?? fetchRainGaugeDay), origin: fx.rain ? "scene" : "live" };
    case "thunder":
      return { set: await loadThunder({ date, nowUnix }, fx.thunder ?? fetchLightningDay), origin: fx.thunder ? "scene" : "live" };
    case "waste_collection":
      if (!receiver) return null;
      return { set: await loadWaste({ date, cities: citiesNearReceiver(receiver) }), origin: "live" };
  }
}

// ── 接收點周邊預篩（只為效能；結果必須與不篩相同）──────────

const M_PER_DEG_LAT = 111_195;

/** 點到線段的近似平面距離（公尺，局部等距投影；短距離夠用，外加安全係數） */
function pointSegmentM(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const kx = M_PER_DEG_LAT * Math.cos(py * (Math.PI / 180));
  const x1 = (ax - px) * kx, y1 = (ay - py) * M_PER_DEG_LAT;
  const x2 = (bx - px) * kx, y2 = (by - py) * M_PER_DEG_LAT;
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const u = len2 > 0 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / len2)) : 0;
  return Math.hypot(x1 + u * dx, y1 + u * dy);
}

const PREFILTER_SAFETY = 1.15;

/** 保留「軌跡任一點或任一段（含跨段缺口兩端）落在候選半徑內」的航班 */
export function prefilterAviation(records: readonly AviationRecord[], receiver: Receiver): AviationRecord[] {
  const limit = AVIATION.candidateRadiusM.value * PREFILTER_SAFETY;
  const { longitude: px, latitude: py } = receiver;
  return records.filter((r) => {
    for (const seg of r.payload.segments) {
      if (seg.length === 1 && pointSegmentM(px, py, seg[0]![1], seg[0]![0], seg[0]![1], seg[0]![0]) <= limit) return true;
      for (let i = 0; i + 1 < seg.length; i++) {
        const a = seg[i]!, b = seg[i + 1]!;
        if (pointSegmentM(px, py, a[1], a[0], b[1], b[0]) <= limit) return true;
      }
    }
    return false;
  });
}

/** 雨只看最近一站：保留最近站的列（最近站超過門檻時也照樣保留，讓引擎回 unknown） */
export function prefilterRain(records: readonly RainRecord[], receiver: Receiver): RainRecord[] {
  const nearest = nearestRainStation(records, receiver.longitude, receiver.latitude);
  if (!nearest) return [];
  return records.filter((r) => r.payload.stationId === nearest.stationId);
}

/** 對已載入的 sets 做接收點預篩；coverage 原封不動（健康狀態不受篩選影響） */
export function prefilterSetsForReceiver(sets: readonly SoundSourceSet[], receiver: Receiver): SoundSourceSet[] {
  return sets.map((s) => {
    if (s.family === "aviation") return { ...s, records: prefilterAviation(s.records as AviationRecord[], receiver) };
    if (s.family === "rain") return { ...s, records: prefilterRain(s.records as RainRecord[], receiver) };
    return s;
  });
}

/** 雨量站距離門檻（面板文案用） */
export const RAIN_STATION_LIMIT_M = RAIN.maxStationDistanceM.value;

/** 測地距離（面板／地圖共用） */
export const distanceM = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => haversineM(a.lon, a.lat, b.lon, b.lat);

// ── 貢獻 → 地圖位置與名稱（只用來源原座標，不合成位置）──────

export interface ContributionPlace {
  lon: number;
  lat: number;
  /** 飛機：該時刻高度（公尺；單位未知為 null） */
  altitudeM: number | null;
  /** 人讀名稱：航班呼號／雨量站名／落雷來源／垃圾車路線與停點 */
  label: string;
}

export function indexRecords(sets: readonly SoundSourceSet[]): Map<string, SoundSourceRecord> {
  const m = new Map<string, SoundSourceRecord>();
  for (const s of sets) for (const r of s.records) m.set(r.id, r);
  return m;
}

/** 位置未知（例：航跡缺口）回 null —— 不畫，不補座標 */
export function contributionPlace(record: SoundSourceRecord | undefined, t: number): ContributionPlace | null {
  if (!record) return null;
  switch (record.family) {
    case "aviation": {
      const p = (record as AviationRecord).payload;
      const pos = aviationPositionAt(p, t);
      if (pos.status !== "position") return null;
      return { lon: pos.lon, lat: pos.lat, altitudeM: pos.altitudeM, label: p.callsign || p.flightId };
    }
    case "rain": {
      const p = (record as RainRecord).payload;
      return { lon: p.lon, lat: p.lat, altitudeM: null, label: p.stationName ?? p.stationId };
    }
    case "thunder": {
      const p = (record as ThunderRecord).payload;
      return { lon: p.lon, lat: p.lat, altitudeM: null, label: p.source };
    }
    case "waste_collection": {
      const p = (record as WasteRecord).payload;
      const route = p.routeName ?? p.routeId;
      return { lon: p.lon, lat: p.lat, altitudeM: null, label: p.stopName ? `${route}・${p.stopName}` : route };
    }
  }
}
