/**
 * 英國列車重播（倫敦與東南部，前一日 Darwin 實際／預估時刻）：資料型別、時間對應與內插純函式。
 *
 * 資料包格式正本：taipei-gis-analytics `docs/topic-research/uk_rail_darwin/SCHEMA.md`（v1.1）。
 * - 所有時間是 UTC unix 秒；`pts[i]` = [TIPLOC, ta, td, flag, sa, sd, dm, sp]（4–7 為 v1.1 追加，可能不存在）。
 * - `segs[i]`＝pts[i]→pts[i+1] 用的 `lines` 索引；-1＝同一點不移動。
 *
 * 時間對應（站主預設 A）：timeStore 目前時刻 → 英國當地時分秒 → 服務日同一當地時刻；
 * 英國當地 00:00–03:59 對應到服務日隔天凌晨（跨午夜班次）。
 * 本檔不讀 timeStore，呼叫端傳入時間（可測）。
 */

export type GbRailPoint = [
  tpl: string, ta: number, td: number, flag: string,
  sa?: number, sd?: number, dm?: number | null, sp?: number,
];

export interface GbRailTrip {
  rid: string;
  uid: string;
  hc: string;
  toc: string;
  cat: string;
  pts: GbRailPoint[];
  segs: number[];
  cx?: string[];
  partly_cancelled?: boolean;
  dly?: number | null;
}

export interface GbRailLine {
  id: string;
  g: [number, number][];
  gm: number[];
  fb: boolean;
}

export interface GbRailGeometry {
  lines: GbRailLine[];
  tiplocs: Record<string, [number, number, string]>;
}

export interface GbRailTripsFile {
  service_date: string;
  trips: GbRailTrip[];
}

/** 載入後建好的索引：5 分鐘桶 → 該時段在線的班次索引。 */
export interface GbRailReplayData {
  serviceDate: string;
  geometry: GbRailGeometry;
  trips: GbRailTrip[];
  bucketStart: number;
  buckets: number[][];
  /** 時間來源比例（以時間值計，a／e／s），0–100。 */
  sourcePct: { a: number; e: number; s: number };
  /** 是否含 v1.1 誤點欄位。 */
  hasDelay: boolean;
}

export const GB_RAIL_BUCKET_SEC = 300;
/** 建索引時預留的淡入淡出秒數（＝GB_RAIL_FADE_SECONDS；常數宣告在後段，這裡用字面值避免 TDZ）。 */
const GB_RAIL_FADE_SECONDS_IDX = 60;
/** 英國當地這個小時之前，對應到服務日隔天凌晨。 */
export const GB_RAIL_NIGHT_CUTOFF_HOUR = 4;

// ── 顏色（資料色，不進 designTokens；map-layers §3.16）─────────────

/** 無誤點欄位時的單色（設計規範 accent 系）。 */
export const GB_RAIL_COLOR = "#64aaff";
/** 背景鐵軌路網（淡）。 */
export const GB_RAIL_TRACK_COLOR = { dark: "#7c8aa5", light: "#64748b" } as const;
/** 點選列車的整條路徑。 */
export const GB_RAIL_SELECTED_COLOR = { dark: "#ffffff", light: "#111827" } as const;

export type GbRailDelayTier = "onTime" | "minor" | "moderate" | "severe" | "noData";

/** 誤點分級：配色沿用站上台鐵誤點看板（TraDelayBoard）的綠／黃／橘／紅語意；無資料灰。 */
export const GB_RAIL_DELAY_TIERS: ReadonlyArray<{ tier: GbRailDelayTier; color: string }> = [
  { tier: "onTime", color: "#22c55e" },   // < 1 分（含提早）
  { tier: "minor", color: "#eab308" },    // 1–5 分
  { tier: "moderate", color: "#ff9800" }, // 5–15 分
  { tier: "severe", color: "#ef4444" },   // ≥ 15 分
  { tier: "noData", color: "#9ca3af" },
];

export function gbRailDelayTier(dm: number | null | undefined): GbRailDelayTier {
  if (typeof dm !== "number" || !Number.isFinite(dm)) return "noData";
  if (dm < 1) return "onTime";
  if (dm < 5) return "minor";
  if (dm < 15) return "moderate";
  return "severe";
}

export function gbRailDelayColor(dm: number | null | undefined): string {
  const tier = gbRailDelayTier(dm);
  return GB_RAIL_DELAY_TIERS.find((t) => t.tier === tier)!.color;
}

// ── 署名（SCHEMA §6）────────────────────────────────────

/** 署名四條（SCHEMA §6）；文字在 legend.transport.gbRailAttr1–4（中文為 §6 原文，英日用英文譯文）。 */
export const GB_RAIL_ATTRIBUTION_KEYS = [
  "legend.transport.gbRailAttr1", "legend.transport.gbRailAttr2", "legend.transport.gbRailAttr3", "legend.transport.gbRailAttr4",
] as const;
export const GB_RAIL_ATTRIBUTION_SHORT = "National Rail Enquiries (Darwin) · © OpenStreetMap contributors (ODbL) · NaPTAN (OGL) · YA_Tiploc_List (CC BY-SA 4.0)";

/** 營運公司代碼 → 名稱（ATOC 代碼，公開資訊）；查不到時呼叫端顯示原代碼。 */
export const GB_RAIL_TOC_NAMES: Readonly<Record<string, string>> = {
  LO: "London Overground", SN: "Southern", SE: "Southeastern", SW: "South Western Railway",
  LE: "Greater Anglia", GW: "Great Western Railway", LT: "London Underground", XR: "Elizabeth line",
  TL: "Thameslink", GN: "Great Northern", VT: "Avanti West Coast", LM: "West Midlands Trains",
  CC: "c2c", CH: "Chiltern Railways", EM: "East Midlands Railway", GR: "LNER", HX: "Heathrow Express",
  GX: "Gatwick Express", XC: "CrossCountry", ES: "Eurostar", GC: "Grand Central", HT: "Hull Trains", LD: "Lumo",
};

// ── 時間對應 ────────────────────────────────────────────────

const LONDON_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

interface WallClock { y: number; mo: number; d: number; h: number; mi: number; s: number }

function londonWall(unixSec: number): WallClock {
  const parts = LONDON_FMT.formatToParts(new Date(Math.floor(unixSec) * 1000));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** 英國當地時間相對 UTC 的偏移秒（GMT＝0、BST＝3600）。 */
function londonOffsetSec(unixSec: number): number {
  const w = londonWall(unixSec);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) / 1000 - Math.floor(unixSec);
}

const midnightCache = new Map<string, number>();

/** 某英國日期（YYYY-MM-DD，可加 dayOffset）當地 00:00 的 UTC 秒。 */
export function londonMidnightUtc(date: string, dayOffset = 0): number {
  const key = `${date}+${dayOffset}`;
  const hit = midnightCache.get(key);
  if (hit !== undefined) return hit;
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d! + dayOffset) / 1000;
  let t = guess - londonOffsetSec(guess);
  t = guess - londonOffsetSec(t);
  midnightCache.set(key, t);
  return t;
}

/** 英國當地「一天中的秒數」（含小數）與小時。 */
export function londonClock(unixSec: number): { secOfDay: number; hour: number } {
  const w = londonWall(unixSec);
  const frac = unixSec - Math.floor(unixSec);
  return { secOfDay: w.h * 3600 + w.mi * 60 + w.s + frac, hour: w.h };
}

/** 時間軸時刻 → 重播資料裡的 UTC 秒（服務日同一英國當地時刻；00:00–03:59 → 隔天凌晨）。 */
export function gbRailReplayTime(unixSec: number, serviceDate: string): number {
  const { secOfDay, hour } = londonClock(unixSec);
  const dayOffset = hour < GB_RAIL_NIGHT_CUTOFF_HOUR ? 1 : 0;
  return londonMidnightUtc(serviceDate, dayOffset) + secOfDay;
}

const HHMM_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
/** UTC 秒 → 英國時間 HH:MM。 */
export function formatLondonHHMM(unixSec: number): string {
  return HHMM_FMT.format(new Date(unixSec * 1000));
}

// ── 索引 ────────────────────────────────────────────────────

const tripStart = (t: GbRailTrip) => t.pts[0]![1];
const tripEnd = (t: GbRailTrip) => t.pts[t.pts.length - 1]![2];

export function buildGbRailReplayData(geometry: GbRailGeometry, file: GbRailTripsFile): GbRailReplayData {
  const trips = file.trips.filter((t) => t.pts.length >= 2);
  let minStart = Infinity;
  for (const t of trips) minStart = Math.min(minStart, tripStart(t));
  const bucketStart = Math.floor((minStart - GB_RAIL_FADE_SECONDS_IDX) / GB_RAIL_BUCKET_SEC) * GB_RAIL_BUCKET_SEC;
  const buckets: number[][] = [];
  const src = { a: 0, e: 0, s: 0 };
  let hasDelay = false;
  trips.forEach((t, i) => {
    // 含首尾淡入淡出（GB_RAIL_FADE_SECONDS）
    const b0 = Math.max(0, Math.floor((tripStart(t) - GB_RAIL_FADE_SECONDS_IDX - bucketStart) / GB_RAIL_BUCKET_SEC));
    const b1 = Math.floor((tripEnd(t) + GB_RAIL_FADE_SECONDS_IDX - bucketStart) / GB_RAIL_BUCKET_SEC);
    for (let b = b0; b <= b1; b++) (buckets[b] ??= []).push(i);
    for (const p of t.pts) {
      for (const c of p[3] ?? "") if (c === "a" || c === "e" || c === "s") src[c]++;  // 每點兩碼（到站、離站）
      if (!hasDelay && p.length > 6 && typeof p[6] === "number") hasDelay = true;
    }
  });
  const total = src.a + src.e + src.s || 1;
  return {
    serviceDate: file.service_date, geometry, trips, bucketStart, buckets, hasDelay,
    sourcePct: { a: (src.a / total) * 100, e: (src.e / total) * 100, s: (src.s / total) * 100 },
  };
}

/** t（重播 UTC 秒）時可能在線的班次索引（桶內候選，呼叫端再精確判斷）。 */
export function candidateTrips(data: GbRailReplayData, t: number): readonly number[] {
  const b = Math.floor((t - data.bucketStart) / GB_RAIL_BUCKET_SEC);
  return data.buckets[b] ?? [];
}

// ── 內插 ────────────────────────────────────────────────────

/** 尾巴長度（公尺，沿整班路徑；拉近時畫成尾巴，指出行進方向）。 */
export const GB_RAIL_TAIL_M = 180;

/** 最後一個 arr[i] ≤ x 的索引（arr 遞增）；全部大於 x 回 -1。 */
function lastLE(n: number, at: (i: number) => number, x: number): number {
  let lo = 0, hi = n - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (at(mid) <= x) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function bearingDeg(a: [number, number], b: [number, number]): number | null {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return null;
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

/** 目前所在路段「前一點」的誤點分（SCHEMA v1.1 §1.1）；沒有欄位回 null。 */
export function gbRailCurrentDelay(trip: GbRailTrip, idx: number): number | null {
  const dm = trip.pts[idx]?.[6];
  return typeof dm === "number" && Number.isFinite(dm) ? dm : null;
}

/** 該點的時間來源（離站那一碼；a 實際／e 預估／s 時刻表）。 */
export function gbRailPointSource(trip: GbRailTrip, idx: number, which: "arr" | "dep" = "dep"): "a" | "e" | "s" | null {
  const flag = trip.pts[idx]?.[3] ?? "";
  const c = which === "arr" ? flag[0] : flag[1] ?? flag[0];
  return c === "a" || c === "e" || c === "s" ? c : null;
}

/** 整班路徑（點選高亮用）：依序串接 segs 的線形。 */
export function gbRailTripPath(trip: GbRailTrip, geom: GbRailGeometry): [number, number][] {
  const out: [number, number][] = [];
  const push = (c: [number, number]) => {
    const last = out[out.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  };
  trip.segs.forEach((s, i) => {
    if (s >= 0 && geom.lines[s]) { for (const c of geom.lines[s]!.g) push(c); return; }
    const c = geom.tiplocs[trip.pts[i]![0]];
    if (c) push([c[0], c[1]]);
  });
  return out;
}

/** TIPLOC → 顯示站名（去掉 NaPTAN 的「Rail Station」尾綴）。 */
export function gbRailPlaceName(geom: GbRailGeometry, tpl: string): string {
  const raw = geom.tiplocs[tpl]?.[2];
  if (!raw) return tpl;
  return raw.replace(/\s+Rail Station$/i, "");
}

const isStationName = (geom: GbRailGeometry, tpl: string) => /Rail Station$/i.test(geom.tiplocs[tpl]?.[2] ?? "");

/** 下一個停靠點：idx 之後第一個有停站時間或是車站的點；都沒有就終點。 */
export function gbRailNextStop(trip: GbRailTrip, geom: GbRailGeometry, idx: number): number | null {
  const p = trip.pts;
  for (let j = idx + 1; j < p.length; j++) {
    if (j === p.length - 1) return j;
    if (p[j]![2] > p[j]![1] || isStationName(geom, p[j]![0])) return j;
  }
  return null;
}

// ── 平滑：每幀模擬時間外推（資料層 lerp，不改共用 timeStore）──────────────

/**
 * 依最近兩次 timeStore tick 推估播放速度，在兩次 tick 之間外推「這一幀的模擬時間」。
 * - 連續兩次 tick 的速度一致（比值 0.5–2）才外推；拖時間軸、跳轉、倒退 → 不外推，直接停在新時刻。
 * - 外推最多一個 tick 間隔（避免暫停瞬間衝過頭）；超過兩個間隔沒有新 tick（暫停）→ 回到最後 tick 的時刻。
 * - 即時模式 1 秒一跳、回放模式每幀一跳都適用。
 */
export class GbRailTickClock {
  private lastSim = Number.NaN;
  private lastWall = 0;
  private interval = 0;
  private lastRate = 0;
  private rate = 0;

  tick(sim: number, wallMs: number): void {
    if (!Number.isNaN(this.lastSim)) {
      const dw = wallMs - this.lastWall;
      const ds = sim - this.lastSim;
      const r = dw > 0 ? ds / (dw / 1000) : 0;
      const consistent = r > 0 && this.lastRate > 0 && r / this.lastRate >= 0.5 && r / this.lastRate <= 2;
      this.rate = consistent && dw <= 2000 ? r : 0;
      this.lastRate = dw > 0 && dw <= 2000 && ds > 0 ? r : 0;
      this.interval = dw;
    }
    this.lastSim = sim;
    this.lastWall = wallMs;
  }

  /** tick 是否每幀都來（重播模式 useTimeline 每個 RAF 推進）：此時不外推，直接用該幀 tick 的值，避免兩個 RAF 先後順序造成抖動。 */
  perFrame(): boolean {
    return this.interval > 0 && this.interval < GbRailTickClock.PER_FRAME_MS;
  }
  static readonly PER_FRAME_MS = 50;

  /** 每幀模式下，這一幀還在等 tick（最近 100ms 內有 tick＝仍在播放）→ 由訂閱端畫，迴圈這幀略過。 */
  awaitingTick(frameMs: number): boolean {
    return this.perFrame() && frameMs - this.lastWall < 100 && frameMs > this.lastWall;
  }

  now(wallMs: number): number {
    if (Number.isNaN(this.lastSim)) return Number.NaN;
    if (this.perFrame()) return this.lastSim;
    const dt = wallMs - this.lastWall;
    if (this.rate <= 0 || dt <= 0 || dt > Math.max(2 * this.interval, 50)) return this.lastSim;
    return this.lastSim + (this.rate * Math.min(dt, this.interval)) / 1000;
  }

  reset(): void {
    this.lastSim = Number.NaN;
    this.rate = 0;
    this.lastRate = 0;
  }
}

// ── Progress-based（比照公車 docs/features/bus/design.md §2：狀態是「沿路線的距離」，位置一律由折線插值）──

/** 淡入淡出時長（模擬秒）：同公車 BusEngine FADE_SECONDS。首站發車前淡入、終點到站後淡出。 */
export const GB_RAIL_FADE_SECONDS = 60;

/** 一班車的整條路徑（串接 segs 線形，含路段間的接縫）＋累積公尺；segStart/segEnd＝每段在 cum 上的起訖距離。 */
export interface GbRailTripPath {
  coords: [number, number][];
  cum: number[];
  segStart: number[];
  segEnd: number[];
  /** pts[i] 停站時的路徑距離（下一段起點；終點用上一段終點）。 */
  stopAt: number[];
}

function segMeters(a: [number, number], b: [number, number]): number {
  const kx = 111_320 * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 110_574);
}

const pathCache = new WeakMap<GbRailTrip, GbRailTripPath>();

export function gbRailBuildTripPath(trip: GbRailTrip, geom: GbRailGeometry): GbRailTripPath {
  const hit = pathCache.get(trip);
  if (hit) return hit;
  const coords: [number, number][] = [];
  const cum: number[] = [];
  const push = (c: [number, number]) => {
    const last = coords[coords.length - 1];
    if (last && last[0] === c[0] && last[1] === c[1]) return;
    cum.push(last ? cum[cum.length - 1]! + segMeters(last, c) : 0);
    coords.push(c);
  };
  const segStart: number[] = [];
  const segEnd: number[] = [];
  // 路段起點取「接上這段之前」的距離：前段終點到本段起點的接縫算進本段行駛，停站點＝前段終點，位置全程連續
  trip.segs.forEach((s, i) => {
    const line = s >= 0 ? geom.lines[s] : undefined;
    segStart[i] = cum.length ? cum[cum.length - 1]! : 0;
    if (line) {
      for (const c of line.g) push(c);
    } else {
      const c = geom.tiplocs[trip.pts[i]![0]];
      const c2 = geom.tiplocs[trip.pts[i + 1]?.[0] ?? ""];
      if (c) push([c[0], c[1]]);
      if (c2) push([c2[0], c2[1]]);
    }
    segEnd[i] = cum.length ? cum[cum.length - 1]! : 0;
  });
  if (coords.length === 0) {
    const c = geom.tiplocs[trip.pts[0]![0]];
    if (c) { coords.push([c[0], c[1]]); cum.push(0); }
  }
  const stopAt = trip.pts.map((_, i) => (i < trip.segs.length ? segStart[i]! : segEnd[i - 1] ?? 0));
  const path = { coords, cum, segStart, segEnd, stopAt };
  pathCache.set(trip, path);
  return path;
}

export interface GbRailProgress {
  /** 沿路徑距離（公尺）。 */
  dist: number;
  /** 0–1：首站前、終點後的淡入淡出（同公車 §3.1）。 */
  alpha: number;
  idx: number;
  dwelling: boolean;
  fallback: boolean;
}

/** t 時這班車在路徑上的距離與淡入淡出；超出淡入淡出範圍回 null。 */
export function gbRailTripProgress(trip: GbRailTrip, geom: GbRailGeometry, t: number): GbRailProgress | null {
  const p = trip.pts;
  if (p.length < 2) return null;
  const path = gbRailBuildTripPath(trip, geom);
  const start = p[0]![1], end = p[p.length - 1]![2];
  if (t < start) {
    const gap = start - t;
    return gap > GB_RAIL_FADE_SECONDS ? null : { dist: path.stopAt[0]!, alpha: 1 - gap / GB_RAIL_FADE_SECONDS, idx: 0, dwelling: true, fallback: false };
  }
  if (t > end) {
    const gap = t - end;
    const last = p.length - 1;
    return gap > GB_RAIL_FADE_SECONDS ? null : { dist: path.stopAt[last]!, alpha: 1 - gap / GB_RAIL_FADE_SECONDS, idx: last, dwelling: true, fallback: false };
  }
  const i = Math.max(0, lastLE(p.length, (j) => p[j]![1], t));
  const td = p[i]![2];
  if (t <= td || i === p.length - 1) return { dist: path.stopAt[i]!, alpha: 1, idx: i, dwelling: true, fallback: false };
  const t1 = p[i + 1]![1];
  const f = t1 > td ? Math.min(1, Math.max(0, (t - td) / (t1 - td))) : 1;
  const s = trip.segs[i];
  const a = path.segStart[i] ?? 0, b = path.segEnd[i] ?? a;
  return { dist: a + (b - a) * f, alpha: 1, idx: i, dwelling: false, fallback: s !== undefined && s >= 0 ? !!geom.lines[s]?.fb : false };
}

/** 路徑距離 → 位置與方位（折線插值）；tailM>0 時一併回傳往回 tailM 公尺的尾巴折線。 */
export function gbRailPathPoint(path: GbRailTripPath, dist: number, tailM = 0): { lng: number; lat: number; bearing: number | null; tail: [number, number][] | null } {
  const { coords, cum } = path;
  const n = coords.length;
  if (n === 1) return { lng: coords[0]![0], lat: coords[0]![1], bearing: null, tail: null };
  const total = cum[n - 1]!;
  const d = Math.max(0, Math.min(total, dist));
  const at = (x: number): [number, number, number] => {
    const k = Math.max(0, Math.min(n - 2, lastLE(n, (j) => cum[j]!, x)));
    const span = cum[k + 1]! - cum[k]!;
    const r = span > 0 ? (x - cum[k]!) / span : 0;
    const a = coords[k]!, b = coords[k + 1]!;
    return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, k];
  };
  const [lng, lat, k] = at(d);
  let bearing: number | null = null;
  for (let j = k; j < n - 1 && bearing === null; j++) bearing = bearingDeg(coords[j]!, coords[j + 1]!);
  let tail: [number, number][] | null = null;
  if (tailM > 0 && d > 1) {
    const d0 = Math.max(0, d - tailM);
    const [x0, y0, k0] = at(d0);
    tail = [[x0, y0]];
    for (let j = k0 + 1; j <= k; j++) tail.push(coords[j]!);
    tail.push([lng, lat]);
  }
  return { lng, lat, bearing, tail };
}

/**
 * 顯示平滑（比照公車 BusScene：smoothFactor 0.15／16.7ms、以實際經過時間計算、dt 上限 100ms）。
 * 狀態在「路徑距離」空間：顯示距離＝目標距離＋殘差；殘差每幀指數衰減（約 0.3 秒收斂），
 * 所以位置永遠沿鐵軌、不切角。目標距離每幀的變化超過物理上可能的量（資料時間跳動、單調化修正、
 * 停站↔行駛切換、路段接縫）時，把跳動吸收到殘差裡慢慢滑過去；使用者大幅拖動時間軸（seek）才直接跳。
 */
export class GbRailSmoother {
  static readonly SMOOTH_FACTOR = 0.15;
  /** 一幀內合理的最大前進（公尺／模擬秒）：英國客運最高約 200 km/h ≈ 56 m/s，取 70 留餘裕。 */
  static readonly MAX_SPEED_MPS = 70;
  /** 每幀模擬時間跳超過這個秒數（或倒退）視為拖動時間軸 → 直接跳。 */
  static readonly SEEK_SECONDS = 300;
  private state = new Map<string, { target: number; offset: number }>();
  private lastSim = Number.NaN;
  private lastMs = 0;

  /** 每幀開頭呼叫一次；回傳這一幀的衰減係數。 */
  beginFrame(sim: number, nowMs: number): { keep: number; simDelta: number; seek: boolean } {
    const dtMs = this.lastMs ? Math.min(100, Math.max(0, nowMs - this.lastMs)) : 16.7;
    this.lastMs = nowMs;
    const simDelta = Number.isNaN(this.lastSim) ? 0 : sim - this.lastSim;
    this.lastSim = sim;
    // 暫停瞬間外推回退約 1 個 tick（60× 約 1 秒）屬正常，當成跳動吸收；倒退超過 5 秒才算拖動
    const seek = simDelta < -5 || simDelta > GbRailSmoother.SEEK_SECONDS;
    if (seek) this.state.clear();
    return { keep: Math.pow(1 - GbRailSmoother.SMOOTH_FACTOR, dtMs / 16.7), simDelta, seek };
  }

  /** 回傳這班車這一幀要顯示的路徑距離。 */
  displayDist(key: string, target: number, frame: { keep: number; simDelta: number }): number {
    const st = this.state.get(key);
    if (!st) { this.state.set(key, { target, offset: 0 }); return target; }
    const step = target - st.target;
    const maxStep = GbRailSmoother.MAX_SPEED_MPS * Math.abs(frame.simDelta) + 5;
    let offset = st.offset;
    if (Math.abs(step) > maxStep) offset = st.target + st.offset - target; // 跳動吸收到殘差：顯示位置不動
    offset *= frame.keep;
    if (Math.abs(offset) < 0.05) offset = 0;
    st.target = target;
    st.offset = offset;
    return target + offset;
  }

  /** 移除這一幀沒出現的車（淡出結束後）。 */
  retain(alive: Set<string>): void {
    for (const k of this.state.keys()) if (!alive.has(k)) this.state.delete(k);
  }

  /** 是否還有車在滑動（暫停時仍要繼續畫幾幀直到收斂）。 */
  settling(): boolean {
    for (const s of this.state.values()) if (s.offset !== 0) return true;
    return false;
  }
}
