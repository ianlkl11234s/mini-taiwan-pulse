/**
 * City Sound Atlas — UI 端的資料編排（載入哪個來源、接收點周邊預篩）。
 * 不 import React；hook 呼叫這裡，測試可直接打。
 */
import { fetchAirspaceDayArrow } from "../data/airspaceLoader";
import { flightRowsToFlights } from "../data/flightTrails";
import { fetchLightningDay, type LightningSource, type LightningStrike } from "../data/lightningLoader";
import { fetchRainGaugeDay } from "../data/rainGaugeLoader";
import { taipeiMidnightMs } from "../lib/taipeiDay";
import type { Flight } from "../types";
import { AVIATION, RAIN, THUNDER } from "./model/soundProfiles";
import { clipCoverageEnd } from "./engines/coverageWindow";
import { haversineM } from "./engines/geometryDistance";
import { aviationPositionAt, flightsToAviationRecords, loadAviation, type AviationRecord } from "./sourceAdapters/aviationAdapter";
import {
  isRadarRainRecord, loadRain, nearestRainStation, radarRainRecord, rainRowsToRecords, type AnyRainRecord, type RainRecord,
} from "./sourceAdapters/rainFieldAdapter";
import { fetchRadarRainPack, RADAR_RAIN_PROVIDER, RADAR_FRAME_STEP_S, type RadarRainPack } from "./grid/radarRainPack";
import {
  fetchThunderSourceResults,
  loadThunder,
  thunderSetFromResults,
  type ThunderRecord,
  type ThunderSourceResult,
} from "./sourceAdapters/thunderAdapter";
import { loadWaste, type WasteRecord } from "./sourceAdapters/wasteAdapter";
import { snapshotApplies, type SnapshotHealth, type SoundSceneSnapshot } from "./scenes";
import { loadMvpBFamily, parseMvpBSceneBlocks } from "./mvpBSources";
import { loadAdvancedFamily, naturalBlockFor } from "./advancedSources";
import type { WindVegetationRecord } from "./sourceAdapters/windVegetationAdapter";
import type { CoastalWaveRecord } from "./sourceAdapters/coastalWaveAdapter";
import type { RiverWaterRecord } from "./sourceAdapters/riverWaterAdapter";
import { evaluateRail, railProgressAt, type RailRecord } from "./sourceAdapters/railAdapter";
import { interpolateOnLineString } from "../engines/railUtils";
import type { RoadworkRecord } from "./sourceAdapters/roadworkAdapter";
import type { Receiver, SoundSourceFamily, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceCoverage } from "./types";
import { GRID_SOURCE_FAMILIES, gridSourceApplies, loadGridSourceFamily } from "./grid/gridSources";

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

/**
 * 雨 set 加上雷達每日包（W6-1）：有包 → 多一筆 radar record＋一筆 coverage（provider cwa_radar_grid）；
 * 沒有包（即時、其他日期）→ coverage 記 unavailable（no_radar_pack_for_date），雨量站照常、來源只標雨量站。
 */
export async function withRadarRain(
  set: SoundSourceSet,
  date: string,
  fetchPack: (date: string) => Promise<RadarRainPack | null> = fetchRadarRainPack,
): Promise<SoundSourceSet> {
  const pack = await fetchPack(date).catch(() => null);
  const start = taipeiMidnightMs(date) / 1000;
  if (!pack) {
    return {
      ...set,
      coverage: [...set.coverage, {
        family: "rain", provider: RADAR_RAIN_PROVIDER, dateKey: date, status: "unavailable",
        windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series", reason: "no_radar_pack_for_date",
      }],
    };
  }
  return {
    ...set,
    records: [...set.records, radarRainRecord(pack) as SoundSourceRecord],
    coverage: [...set.coverage, {
      family: "rain", provider: RADAR_RAIN_PROVIDER, dateKey: date, status: "ok",
      windowStart: pack.firstSlot, windowEnd: pack.firstSlot + pack.frameCount * RADAR_FRAME_STEP_S, temporalKind: "day_series",
    }],
  };
}

/** scene＝接收點附近的場景快照；grid＝W6-3 全北北來源檔（網格與接收點同一份）；live＝即時 RPC／靜態檔 */
export type SetOrigin = "scene" | "grid" | "live";

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
  // W6-3：全北北來源檔可能存在（讀不到才退回 scenePart）；接收點換位置不換資料
  if (GRID_SOURCE_FAMILIES.has(family) && gridSourceApplies(receiver)) return `${family}|${date}|grid|${scenePart}`;
  return `${family}|${date}|${scenePart}`;
}

function sceneHasBlock(snapshot: SoundSceneSnapshot, family: SoundSourceFamily): boolean {
  if (family === "roadwork") return !!parseMvpBSceneBlocks(snapshot.raw).roadwork;
  if (family === "aviation") return !!snapshot.aviation;
  if (family === "thunder") return !!snapshot.thunder;
  if (family === "rain") return !!snapshot.rain;
  if (family === "wind_vegetation" || family === "coastal_wave" || family === "river_water") return naturalBlockFor(snapshot.raw, family) != null;
  return false;
}

type LightningFetcher = (date: string, source: LightningSource) => Promise<LightningStrike[]>;

function snapshotCoverage(
  family: SoundSourceFamily,
  provider: string,
  date: string,
  status: SnapshotHealth,
  nowUnix: number,
): SourceCoverage {
  const start = taipeiMidnightMs(date) / 1000;
  const base = { family, provider, dateKey: date, windowStart: start, windowEnd: clipCoverageEnd(start, nowUnix), temporalKind: "day_series" as const };
  return status === "ok" ? { ...base, status } : { ...base, status, reason: `scene_snapshot_health_${status}` };
}

/**
 * 場景快照區塊 → SoundSourceSet（與 scripts/preprocess/verify-sound-scenes.ts 的 sceneToSets 同規則）：
 * - coverage 一律取快照 health，**不可**用 bbox 內筆數重判：快照只留接收點附近的資料，
 *   health=ok 但 0 筆 ＝ 附近真的沒有（inactive），不是 empty／unknown；
 * - aviation／rain 沒寫 health 的舊快照：有列 → ok、沒列 → empty；
 * - 落雷：health=error 的來源不採事件；THUNDER.sources 裡快照沒寫 health 的來源改走即時 RPC。
 * 回傳 null ＝ 快照沒有這個區塊（呼叫端走即時）。
 */
export async function snapshotSet(
  snapshot: SoundSceneSnapshot,
  family: SoundSourceFamily,
  nowUnix: number = Date.now() / 1000,
  liveThunder: LightningFetcher = fetchLightningDay,
): Promise<SoundSourceSet | null> {
  const date = snapshot.date;
  if (family === "aviation" && snapshot.aviation) {
    const { rows, health } = snapshot.aviation;
    const status = health ?? (rows.length ? "ok" : "empty");
    const records = status === "error" ? [] : flightsToAviationRecords(flightRowsToFlights(rows).flights);
    return { family, dateKey: date, records, coverage: [snapshotCoverage(family, "flight_trails", date, status, nowUnix)] };
  }
  if (family === "rain" && snapshot.rain) {
    const { rows, health } = snapshot.rain;
    const status = health ?? (rows.length ? "ok" : "empty");
    const records = status === "error" ? [] : rainRowsToRecords(rows);
    return { family, dateKey: date, records, coverage: [snapshotCoverage(family, "cwa_rain_gauge", date, status, nowUnix)] };
  }
  if (family === "thunder" && snapshot.thunder) {
    const th = snapshot.thunder;
    const sources = THUNDER.sources.value;
    const missing = sources.filter((src) => !th.health?.[src]);
    const live = missing.length ? await fetchThunderSourceResults(date, liveThunder, missing) : [];
    const results = sources.map((source): ThunderSourceResult => {
      const h = th.health?.[source];
      if (!h) return live.find((r) => r.source === source)!;
      if (h === "error") return { source, status: "error", reason: "scene_snapshot_health_error" };
      const strikes = h === "ok" ? th.events.filter((e) => e.source === source) : [];
      return h === "ok" ? { source, status: "ok", strikes } : { source, status: "empty", strikes, reason: "scene_snapshot_health_empty" };
    });
    return thunderSetFromResults({ date, nowUnix }, results);
  }
  return null;
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
  if (family === "waste_collection") {
    if (!receiver) return null;
    return { set: await loadWaste({ date, cities: citiesNearReceiver(receiver) }), origin: "live" };
  }
  const applies = !!snapshot && snapshotApplies(snapshot, date, receiver);
  // W6-3：這天有全北北來源檔、接收點在網格外框內 → 網格、接收點、popup 都讀這一份（比場景快照範圍大、同一來源）
  if (GRID_SOURCE_FAMILIES.has(family) && gridSourceApplies(receiver)) {
    const set = await loadGridSourceFamily(family, date, nowUnix);
    if (set) return { set: family === "rain" ? await withRadarRain(set, date) : set, origin: "grid" };
  }
  if (family === "rail" || family === "road_traffic" || family === "roadwork") {
    // MVP-B（W4）：鐵道依班表即時算、道路類型不進快照、施工快照適用才傳原始 JSON
    const r = await loadMvpBFamily(family, date, applies ? snapshot!.raw : null);
    return { set: r.set as SoundSourceSet, origin: r.origin };
  }
  if (family === "wind_vegetation" || family === "coastal_wave" || family === "river_water") {
    // W5 自然三族：時變觀測只在場景快照（S3 正本裁切）；即時：風、浪 unavailable，河川讀 RPC 但缺河道與分位 → unknown
    if (family === "river_water" && !(applies && snapshot && naturalBlockFor(snapshot.raw, family))) {
      // 河川即時：RPC 有水位，但河道幾何與歷史分位檔尚未發布 → 一律無法判斷；直接標「僅場景快照提供」，不白打 RPC
      const start = taipeiMidnightMs(date) / 1000;
      return {
        set: {
          family, dateKey: date, records: [],
          coverage: [{ family, provider: "wra_river_water_level", dateKey: date, status: "unavailable", windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series", reason: "river_assets_not_published(snapshot_only)" }],
        } as SoundSourceSet,
        origin: "live",
      };
    }
    const r = await loadAdvancedFamily(family, date, applies ? snapshot!.raw : null);
    return { set: r.set as SoundSourceSet, origin: r.origin };
  }
  if (applies) {
    const set = await snapshotSet(snapshot!, family, nowUnix);
    if (set) return { set: family === "rain" ? await withRadarRain(set, date) : set, origin: "scene" };
  }
  switch (family) {
    case "aviation":
      return { set: await loadAviation({ date, nowUnix }, cachedAviationDay), origin: "live" };
    case "rain":
      return { set: await withRadarRain(await loadRain({ date }, fetchRainGaugeDay) as SoundSourceSet, date), origin: "live" };
    case "thunder":
      return { set: await loadThunder({ date, nowUnix }, fetchLightningDay), origin: "live" };
  }
  return null;
}

// ── 面板「此刻主要來源」列表 ─────────────────────────────

export interface TopContributions {
  rows: SourceContribution[];
  /** 低於顯示門檻、併成一行的遠方航機（count=0 → 不顯示） */
  farAviation: { count: number; maxPotential: number };
  /** 逐筆只列第一架「無法判斷」航機，其餘併成計數（count=0 → 不顯示） */
  unknownAviation: { count: number };
}

/**
 * 只為顯示：相對潛勢低於 AVIATION.displayMinPotential 的 active 航機不逐筆列，併成「遠方航機」。
 * unknown（潛勢 null）不被當成「遠」：第一架照常逐筆列，其餘併成「另有 N 架無法判斷」，
 * 避免航跡缺口的航機把雨、雷、垃圾車擠出列表。其他家族不受影響。
 */
export function topContributionsForDisplay(
  contributions: readonly SourceContribution[],
  limit: number,
  minAviation: number = AVIATION.displayMinPotential.value,
): TopContributions {
  const rows: SourceContribution[] = [];
  let count = 0;
  let maxPotential = 0;
  let unknownListed = false;
  let unknownMore = 0;
  for (const c of contributions) {
    if (c.family === "aviation" && c.status === "active" && c.relativePotential != null && c.relativePotential < minAviation) {
      count++;
      maxPotential = Math.max(maxPotential, c.relativePotential);
      continue;
    }
    if (c.family === "aviation" && c.status === "unknown") {
      if (unknownListed) {
        unknownMore++;
        continue;
      }
      unknownListed = true;
    }
    if (rows.length < limit) rows.push(c);
  }
  return { rows, farAviation: { count, maxPotential }, unknownAviation: { count: unknownMore } };
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

/** 雨只看最近一站：保留最近站的列（最近站超過門檻時也照樣保留，讓引擎回 unknown）；雷達包（整個網格一筆）一律保留 */
export function prefilterRain(records: readonly AnyRainRecord[], receiver: Receiver): AnyRainRecord[] {
  const nearest = nearestRainStation(records, receiver.longitude, receiver.latitude);
  return records.filter((r) => isRadarRainRecord(r) || (nearest != null && r.payload.stationId === nearest.stationId));
}

/** 對已載入的 sets 做接收點預篩；coverage 原封不動（健康狀態不受篩選影響） */
export function prefilterSetsForReceiver(sets: readonly SoundSourceSet[], receiver: Receiver): SoundSourceSet[] {
  return sets.map((s) => {
    if (s.family === "aviation") return { ...s, records: prefilterAviation(s.records as AviationRecord[], receiver) };
    if (s.family === "rain") return { ...s, records: prefilterRain(s.records as AnyRainRecord[], receiver) as SoundSourceRecord[] };
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
      // 雷達包是整個網格的場，沒有單一來源點 → 不畫
      if (isRadarRainRecord(record)) return null;
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
    case "rail": {
      // 班表推算的軌道上位置；結構不明段也有位置（畫灰點），地下段 inactive 不畫；班表缺 → null
      const r = record as unknown as RailRecord;
      const p = r.payload;
      if (p.kind !== "train") return null;
      const ev = evaluateRail(r, t);
      const label = `${p.system.toUpperCase()} ${p.trainId}`;
      if (ev.status === "active") return { lon: ev.geometry.lon, lat: ev.geometry.lat, altitudeM: null, label };
      const st = railProgressAt(r, t);
      if (ev.status === "unknown" && st.status === "on_track") {
        const [lon, lat] = interpolateOnLineString(p.track.coords, st.progress);
        return { lon, lat, altitudeM: null, label };
      }
      return null;
    }
    case "road_traffic":
      // W6-2：路網 record 沒有單一位置（接收點連線用 roadContributionLine 取該路段）
      return null;
    case "roadwork": {
      const p = (record as unknown as RoadworkRecord).payload;
      if (p.kind !== "permit") return null;
      const pt = firstCoordinate(p.event.geometry);
      return pt ? { lon: pt[0], lat: pt[1], altitudeM: null, label: p.event.title ?? p.event.road_name ?? p.event.event_id } : null;
    }
    // W5 自然三族：位置＝測站原座標（氣象站／浮標／水位站）；靜態脈絡（樹冠格、海岸、河道、範圍）不是來源點 → null
    case "wind_vegetation": {
      const p = (record as unknown as WindVegetationRecord).payload;
      return p.kind === "wind_obs" ? { lon: p.lon, lat: p.lat, altitudeM: null, label: p.stationName ?? p.stationId } : null;
    }
    case "coastal_wave": {
      const p = (record as unknown as CoastalWaveRecord).payload;
      return p.kind === "wave_obs" ? { lon: p.lon, lat: p.lat, altitudeM: null, label: p.stationName ?? p.stationId } : null;
    }
    case "river_water": {
      const p = (record as unknown as RiverWaterRecord).payload;
      return p.kind === "river_obs" ? { lon: p.lon, lat: p.lat, altitudeM: null, label: p.stationName ?? p.stationId } : null;
    }
  }
  return null;
}

/** 幾何的代表點（Point 本身；線／面取第一個頂點）——只用來源原座標，不合成 */
function firstCoordinate(g: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!g) return null;
  if (g.type === "GeometryCollection") return g.geometries.length ? firstCoordinate(g.geometries[0]) : null;
  let c: unknown = g.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number" ? [c[0], c[1]] : null;
}

/** 接收點到任意幾何最近點（線／面逐段、點取自身）；施工許可的連線端點用——許可常是長線段，第一個頂點可能在數公里外 */
export function nearestPointOnGeometry(g: GeoJSON.Geometry | null | undefined, lon: number, lat: number): [number, number] | null {
  if (!g) return null;
  const lines: [number, number][][] = [];
  const collect = (geom: GeoJSON.Geometry) => {
    switch (geom.type) {
      case "Point": lines.push([geom.coordinates as [number, number]]); break;
      case "MultiPoint": for (const c of geom.coordinates) lines.push([c as [number, number]]); break;
      case "LineString": lines.push(geom.coordinates as [number, number][]); break;
      case "MultiLineString": case "Polygon": for (const l of geom.coordinates) lines.push(l as [number, number][]); break;
      case "MultiPolygon": for (const poly of geom.coordinates) for (const l of poly) lines.push(l as [number, number][]); break;
      case "GeometryCollection": for (const x of geom.geometries) collect(x); break;
    }
  };
  collect(g);
  const kx = M_PER_DEG_LAT * Math.cos(lat * (Math.PI / 180));
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const l of lines) {
    const p = nearestPointOnLine(l, lon, lat);
    if (!p) continue;
    const d = ((p[0] - lon) * kx) ** 2 + ((p[1] - lat) * M_PER_DEG_LAT) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** 接收點到折線最近點（局部等距投影；道路 proxy 的連線端點用） */
export function nearestPointOnLine(coords: readonly [number, number][], lon: number, lat: number): [number, number] | null {
  if (!coords.length) return null;
  const kx = M_PER_DEG_LAT * Math.cos(lat * (Math.PI / 180));
  let best: [number, number] = coords[0]!;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i]!;
    const b = coords[i + 1] ?? a;
    const ax = (a[0] - lon) * kx, ay = (a[1] - lat) * M_PER_DEG_LAT;
    const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * M_PER_DEG_LAT;
    const len2 = dx * dx + dy * dy;
    const u = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + u * dx, py = ay + u * dy;
    const d = px * px + py * py;
    if (d < bestD) {
      bestD = d;
      best = [lon + px / kx, lat + py / M_PER_DEG_LAT];
    }
  }
  return best;
}
