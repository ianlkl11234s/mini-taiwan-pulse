import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * 停車 parking loader（Batch 3 hybrid v1，RPC 287）
 *
 * 兩支 public RPC（前端一律走 public）：
 *   - get_parking_segments_current()  → 路邊 3084 段（當下快照）
 *   - get_parking_lots_current()      → 場外 2083 場（當下快照）
 *
 * 此層是「當下快照」（比照急診 er_hospital / 核安 LIVE，不接 timeStore、不做 timeline scrub）。
 *
 * 資料現實（hybrid v1，已實測）：
 *   路邊：台北 2347 段有 POLYGON geom（geom 為 GeoJSON 字串）但 availability_rate=null
 *         （即時 available 全 -1）；新北 553 + 台中 184 無 geom（只有 lon/lat 點），有 availability_rate。
 *   場外：city 2011 / tourism 57 / freeway_service_area 15，全點座標，多數有 availability_rate（35 筆 null）。
 *
 * 分流策略：路邊一個 FeatureCollection，有 geom → Polygon feature（fill 層，台北中性容量色）；
 * 無 geom → Point feature（circle 層，空位率染色）。render 端用 geometry-type filter 拆兩層。
 */

// ── 空位率色階（綠=空位多／停得進、紅=滿）─────────────────────────────
// 對齊 youbike RdYlGn 反向：服務可得性高=綠、低=紅（youbike 有車率、停車空位率，方向一致）。
export const AVAILABILITY_COLOR_STOPS: [number, string][] = [
  [0.0, "#d73027"],  // 滿，紅
  [0.15, "#fc8d59"],
  [0.35, "#fee08b"], // 中等，黃
  [0.6, "#91cf60"],
  [1.0, "#1a9850"],  // 空位多，綠
];
/** 無即時空位資料（含台北路邊）→ 中性灰 */
export const AVAILABILITY_NULL_COLOR = "#9ca3af";

// ── 台北路邊：無即時空位 → 依 total_spaces 深淺表容量（中性藍灰）──────────
export const PARKING_NEUTRAL_STOPS: [number, string][] = [
  [5, "#cbd5e1"],   // 容量少，淺藍灰
  [100, "#475569"], // 容量多，深藍灰
];

// ── 場外 source_category（circle-stroke ring 分類 + 圖例）──────────────
export const SOURCE_CATEGORY_META: Record<string, { label: string; ring: string }> = {
  city:                 { label: "縣市路外", ring: "rgba(255,255,255,0.35)" },
  tourism:              { label: "觀光景點", ring: "#38bdf8" },
  freeway_service_area: { label: "國道服務區", ring: "#f59e0b" },
};

/** JS 版空位率→色（給圖例 / popup 色塊），與 mapbox interpolate 同一組 stops */
export function parkingAvailabilityColor(rate: number | null | undefined): string {
  if (rate == null || rate < 0) return AVAILABILITY_NULL_COLOR;
  const r = Math.max(0, Math.min(1, rate));
  const stops = AVAILABILITY_COLOR_STOPS;
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i]!;
    const [v1, c1] = stops[i + 1]!;
    if (r <= v1) return lerpHex(c0, c1, (r - v0) / (v1 - v0));
  }
  return stops[stops.length - 1]![1];
}

function lerpHex(a: string, b: string, t: number): string {
  const tt = Math.max(0, Math.min(1, t));
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((x, i) => Math.round(x + (pb[i]! - x) * tt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Mapbox 表達式：依 availability_rate 內插；null/缺值 → 中性灰 */
export function availabilityColorExpr(): unknown[] {
  return [
    "case",
    ["<", ["to-number", ["get", "availability_rate"], -1], 0], AVAILABILITY_NULL_COLOR,
    ["interpolate", ["linear"], ["to-number", ["get", "availability_rate"], -1],
      ...AVAILABILITY_COLOR_STOPS.flatMap(([v, c]) => [v, c])],
  ];
}

/** Mapbox 表達式：台北路邊容量中性色（依 total_spaces） */
export function neutralCapacityColorExpr(): unknown[] {
  return [
    "interpolate", ["linear"], ["to-number", ["get", "total_spaces"], 0],
    ...PARKING_NEUTRAL_STOPS.flatMap(([v, c]) => [v, c]),
  ];
}

/** Mapbox 表達式：場外 circle-stroke-color 依 source_category 分類 */
export function sourceCategoryRingExpr(): unknown[] {
  return [
    "match", ["get", "source_category"],
    "tourism", SOURCE_CATEGORY_META.tourism!.ring,
    "freeway_service_area", SOURCE_CATEGORY_META.freeway_service_area!.ring,
    SOURCE_CATEGORY_META.city!.ring,
  ];
}

// ── RPC row 型別 ─────────────────────────────────────────────────────
interface ParkingSegmentRow {
  segment_id: string;
  city: string;
  segment_name: string | null;
  lon: number | null;
  lat: number | null;
  geom: string | null;               // 台北 = GeoJSON Polygon 字串；其餘 null
  total_spaces: number | null;
  available_spaces: number | null;
  availability_rate: number | null;  // 台北 null
  full_status: number | null;
  charge_status: number | null;
  space_types: unknown;              // [{type,total,available,occupancy}]
}

interface ParkingLotRow {
  car_park_uid: string;
  car_park_name: string | null;
  source_category: string;
  sub_category: string | null;
  lon: number | null;
  lat: number | null;
  address: string | null;
  car_park_type: string | null;
  ev_charging: boolean | null;
  total_spaces: number | null;
  available_spaces: number | null;
  availability_rate: number | null;
  full_status: number | null;
  charge_status: number | null;
  space_types: unknown;              // [{SpaceType,NumberOfSpaces,AvailableSpaces}]
}

// ── 路邊 segments ────────────────────────────────────────────────────
async function fetchSegmentsUncached(): Promise<GeoJSON.FeatureCollection> {
  const { data, error } = await withLoading(
    "parking:onstreet",
    "路邊停車 3084 段即時",
    supabase.rpc("get_parking_segments_current"),
  );
  if (error) throw new Error(`get_parking_segments_current: ${error.message}`);
  const rows = (data ?? []) as ParkingSegmentRow[];

  const features: GeoJSON.Feature[] = [];
  let badGeom = 0;
  for (const r of rows) {
    const props = {
      segment_id: r.segment_id,
      city: r.city,
      segment_name: r.segment_name,
      total_spaces: r.total_spaces,
      available_spaces: r.available_spaces,
      availability_rate: r.availability_rate,
      full_status: r.full_status,
      charge_status: r.charge_status,
      space_types: r.space_types,
    };
    if (r.geom) {
      // 台北：geom 字串 parse 成 Polygon geometry
      try {
        const geometry = JSON.parse(r.geom) as GeoJSON.Geometry;
        features.push({ type: "Feature", geometry, properties: props });
      } catch {
        badGeom++;
      }
    } else if (r.lon != null && r.lat != null) {
      // 新北 / 台中：無 geom → Point
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: props,
      });
    }
  }
  if (badGeom > 0) console.warn(`[parking] ${badGeom} 段 geom parse 失敗`);
  return { type: "FeatureCollection", features };
}
const fetchSegmentsCached = cachedOnce(fetchSegmentsUncached, 60_000);
export const fetchParkingSegmentsFC = (): Promise<GeoJSON.FeatureCollection> => fetchSegmentsCached();
export const invalidateParkingSegments = (): void => fetchSegmentsCached.invalidate();

// ── 場外 lots ────────────────────────────────────────────────────────
async function fetchLotsUncached(): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const { data, error } = await withLoading(
    "parking:offstreet",
    "場外停車 2083 場即時",
    supabase.rpc("get_parking_lots_current"),
  );
  if (error) throw new Error(`get_parking_lots_current: ${error.message}`);
  const rows = (data ?? []) as ParkingLotRow[];

  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const r of rows) {
    if (r.lon == null || r.lat == null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        car_park_uid: r.car_park_uid,
        car_park_name: r.car_park_name,
        source_category: r.source_category,
        sub_category: r.sub_category,
        address: r.address,
        car_park_type: r.car_park_type,
        ev_charging: r.ev_charging,
        total_spaces: r.total_spaces,
        available_spaces: r.available_spaces,
        availability_rate: r.availability_rate,
        full_status: r.full_status,
        charge_status: r.charge_status,
        space_types: r.space_types,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
const fetchLotsCached = cachedOnce(fetchLotsUncached, 60_000);
export const fetchParkingLotsFC = (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => fetchLotsCached();
export const invalidateParkingLots = (): void => fetchLotsCached.invalidate();

// ════════════════════════════════════════════════════════════════════════
// Timeline 回放（day 模式，RPC 288 get_parking_*_day）
// ════════════════════════════════════════════════════════════════════════
/**
 * timeline：96 字元字串，每字元一個 15 分鐘槽，Asia/Taipei 00:00 對齊。
 *   '0'~'9' = 空位率分級（9=空位多/綠、0=滿/紅）
 *   '-'（或其他非數字）= 無資料（台北路邊全日、當日尚未發生的未來槽）
 *
 * 回放與當下快照共用 overlayRegistry 既有 paint（availabilityColorExpr /
 * neutralCapacityColorExpr）：回放只是把「當前 slot 的字元 → 空位率」就地寫進
 * feature.availability_rate 再 setData，染色邏輯與色軸完全一致。
 */

/** 給定 unix 秒 → 96 槽 index（0~95）。slot = floor((台北當下 − 當日 00:00+08)/900)，clamp 0~95。 */
export function parkingSlotIndexAt(t: number): number {
  const dateKey = new Date(t * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const midnight = Date.parse(`${dateKey}T00:00:00+08:00`) / 1000;
  const slot = Math.floor((t - midnight) / 900);
  return slot < 0 ? 0 : slot > 95 ? 95 : slot;
}

/** timeline 單一字元 → 空位率（0~1）。9=空位多→1.0、0=滿→0.0；'-'/非數字 → null（無資料） */
export function rateFromChar(ch: string | undefined): number | null {
  if (ch == null || ch < "0" || ch > "9") return null;
  return Number(ch) / 9;
}

export interface ParkingDayData {
  date: string;
  /** 靜態幾何 + props 的 FeatureCollection（recolor 時就地改 availability_rate 再 setData） */
  fc: GeoJSON.FeatureCollection;
  /** 與 fc.features 平行對齊的 96 字元 timeline */
  timelines: string[];
  /**
   * 全日「有資料」的最後 slot（跨所有 entity 取 max）。當日回放讀「當下」常落在
   * 尚未刷新的未來槽（全 '-'），clamp 到此才不會全灰（比照 road congestion）。
   */
  lastPopulatedSlot: number;
}

/** 掃 timeline 找該串最後一個有資料 slot，更新全域 max */
function updateLastPopulated(timeline: string, prevMax: number): number {
  for (let i = timeline.length - 1; i > prevMax; i--) {
    if (rateFromChar(timeline[i]) != null) return i;
  }
  return prevMax;
}

// ── 路邊 segments day ────────────────────────────────────────────────
interface ParkingSegmentDayRow {
  segment_id: string;
  city: string;
  segment_name: string | null;
  lon: number | null;
  lat: number | null;
  geom: string | null;           // 台北 = GeoJSON Polygon 字串；其餘 null
  total_spaces: number | null;
  timeline: string | null;
}

async function fetchSegmentsDayUncached(date: string): Promise<ParkingDayData> {
  const { data, error } = await withLoading(
    `parking:onstreet:${date}`,
    `路邊停車 ${date} 回放`,
    supabase.rpc("get_parking_segments_day", { target_date: date }),
  );
  if (error) throw new Error(`get_parking_segments_day(${date}): ${error.message}`);
  const rows = (data ?? []) as ParkingSegmentDayRow[];

  const features: GeoJSON.Feature[] = [];
  const timelines: string[] = [];
  let lastPopulatedSlot = 0;
  let badGeom = 0;
  for (const r of rows) {
    let geometry: GeoJSON.Geometry | null = null;
    if (r.geom) {
      try { geometry = JSON.parse(r.geom) as GeoJSON.Geometry; } catch { badGeom++; continue; }
    } else if (r.lon != null && r.lat != null) {
      geometry = { type: "Point", coordinates: [r.lon, r.lat] };
    }
    if (!geometry) continue;
    features.push({
      type: "Feature",
      geometry,
      properties: {
        segment_id: r.segment_id,
        city: r.city,
        segment_name: r.segment_name,
        total_spaces: r.total_spaces,
        availability_rate: null, // recolor 依 slot 填入
      },
    });
    const timeline = r.timeline ?? "";
    timelines.push(timeline);
    lastPopulatedSlot = updateLastPopulated(timeline, lastPopulatedSlot);
  }
  if (badGeom > 0) console.warn(`[parking] day ${badGeom} 段 geom parse 失敗`);
  return { date, fc: { type: "FeatureCollection", features }, timelines, lastPopulatedSlot };
}
const fetchSegmentsDayCached = cachedByKey(fetchSegmentsDayUncached, 10 * 60_000);
export const fetchParkingSegmentsDay = (date: string): Promise<ParkingDayData> => fetchSegmentsDayCached(date);

// ── 場外 lots day ────────────────────────────────────────────────────
interface ParkingLotDayRow {
  car_park_uid: string;
  car_park_name: string | null;
  source_category: string;
  lon: number | null;
  lat: number | null;
  total_spaces: number | null;
  timeline: string | null;
}

async function fetchLotsDayUncached(date: string): Promise<ParkingDayData> {
  const { data, error } = await withLoading(
    `parking:offstreet:${date}`,
    `場外停車 ${date} 回放`,
    supabase.rpc("get_parking_lots_day", { target_date: date }),
  );
  if (error) throw new Error(`get_parking_lots_day(${date}): ${error.message}`);
  const rows = (data ?? []) as ParkingLotDayRow[];

  const features: GeoJSON.Feature[] = [];
  const timelines: string[] = [];
  let lastPopulatedSlot = 0;
  for (const r of rows) {
    if (r.lon == null || r.lat == null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        car_park_uid: r.car_park_uid,
        car_park_name: r.car_park_name,
        source_category: r.source_category,
        total_spaces: r.total_spaces,
        availability_rate: null,
      },
    });
    const timeline = r.timeline ?? "";
    timelines.push(timeline);
    lastPopulatedSlot = updateLastPopulated(timeline, lastPopulatedSlot);
  }
  return { date, fc: { type: "FeatureCollection", features }, timelines, lastPopulatedSlot };
}
const fetchLotsDayCached = cachedByKey(fetchLotsDayUncached, 10 * 60_000);
export const fetchParkingLotsDay = (date: string): Promise<ParkingDayData> => fetchLotsDayCached(date);

// ── 可用回放日期（parity；供 timeline 可用日 UI 未來使用）────────────────
export interface ParkingDateInfo { day: string; entities: number; }
export async function fetchParkingDates(): Promise<ParkingDateInfo[]> {
  const { data, error } = await withLoading(
    "parking:dates",
    "停車回放日期",
    supabase.rpc("get_parking_dates"),
  );
  if (error) throw new Error(`get_parking_dates: ${error.message}`);
  return (data ?? []) as ParkingDateInfo[];
}
