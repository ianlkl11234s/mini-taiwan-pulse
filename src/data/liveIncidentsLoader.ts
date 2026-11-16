import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import {
  FIRE119_PULSE_CAP,
  FIRE119_RETURNED_FADE_MIN,
  asFire119Category,
  asFire119Precision,
  asFire119Status,
  asPbsCategory,
  asPbsStatus,
  fire119Mark,
  isoMs,
  type Fire119Category,
  type Fire119Precision,
  type Fire119Status,
} from "./liveIncidentsTypes";

/**
 * 即時 119 案件／警廣即時路況 owner-only 載入器（見 docs/features/owner-gated-layers）。
 *
 * public.get_fire119_live(p_since_minutes) → jsonb FeatureCollection（gis-platform mig 555）
 * public.get_pbs_road_events_live(p_since_minutes) → jsonb FeatureCollection
 * 兩支 RPC 都登記在 public.gated_layers（owner）；非站主前端 toggle 已擋（不會呼叫本檔），
 * 後端 enforce_layer_access 另擋 42501。
 *
 * 語意（照 mig 555 欄位註解）：
 * - geometry 為 null ≠ 沒有案件：geom_precision=district 只到鄉鎮（看 town_code），none 完全沒有位置
 *   （新北只有送醫中救護車的目的醫院 dest_lon／dest_lat）。這些列不畫事發點，但要被計數，不可靜默消失。
 * - road 精度的點是路段中點，不是事發地；fuzzy 是臺北站方模糊點。
 * - 判斷新舊看 received_at（屏東、苗栗、臺南清單帶數月前舊案），不看 first_seen_at。
 */

// ── RPC ───────────────────────────────────────────────

/** RPC 錯誤：保留 PostgREST code，讓 hook 分辨無權限（42501）與函式不存在（PGRST202） */
export class LiveIncidentsError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "LiveIncidentsError";
    this.code = code;
    this.status = status;
  }
}

/** 函式尚未部署：PostgREST 回 PGRST202／404 */
export function isMissingRpc(err: unknown): boolean {
  const v = err as { code?: unknown; status?: unknown; message?: unknown } | null;
  return String(v?.code ?? "") === "PGRST202" || v?.status === 404
    || /could not find the function/i.test(String(v?.message ?? ""));
}

/** 撈最大時間窗（360 分鐘，RPC clamp 上限），時間範圍篩選在前端做（切換不重抓） */
const SINCE_MINUTES = 360;

export async function fetchFire119Live(): Promise<unknown> {
  const { data, error, status } = await withLoading(
    "fire119:live",
    "即時 119 案件",
    supabase.rpc("get_fire119_live", { p_since_minutes: SINCE_MINUTES }),
  );
  if (error) throw new LiveIncidentsError(`get_fire119_live: ${error.message}`, String(error.code ?? ""), status);
  return data;
}

export async function fetchPbsRoadEventsLive(): Promise<unknown> {
  const { data, error, status } = await withLoading(
    "pbs:live",
    "警廣即時路況",
    supabase.rpc("get_pbs_road_events_live", { p_since_minutes: SINCE_MINUTES }),
  );
  if (error) throw new LiveIncidentsError(`get_pbs_road_events_live: ${error.message}`, String(error.code ?? ""), status);
  return data;
}

// ── 119：正規化 ───────────────────────────────────────

export interface Fire119Case {
  key: string;
  county: string;
  category: Fire119Category;
  categoryRaw: string | null;
  status: Fire119Status;
  statusRaw: string | null;
  /** [[ISO 時間, 原文狀態], ...] */
  history: [string, string][];
  receivedMs: number | null;
  updatedMs: number | null;
  locationText: string | null;
  precision: Fire119Precision;
  roadKey: string | null;
  townCode: string | null;
  units: string[];
  hospital: string | null;
  coord: [number, number] | null;
  dest: [number, number] | null;
}

export interface Fire119Raw {
  cases: Fire119Case[];
  truncated: boolean;
  generatedAt: string | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** RPC 原始回應 → 案件陣列（純函式，測試用） */
export function normalizeFire119(raw: unknown): Fire119Raw {
  const obj = (raw ?? {}) as { features?: unknown; meta?: Record<string, unknown> };
  const feats = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const cases: Fire119Case[] = [];
  for (const f of feats) {
    const p = (f?.properties ?? {}) as Record<string, unknown>;
    const key = str(p.incident_key);
    if (!key) continue;
    const category = asFire119Category(p.category);
    const precision = asFire119Precision(p.geom_precision);
    const g = f.geometry;
    const coord = g && g.type === "Point" && Number.isFinite(g.coordinates[0]) && Number.isFinite(g.coordinates[1])
      ? [g.coordinates[0]!, g.coordinates[1]!] as [number, number]
      : null;
    const dLon = num(p.dest_lon);
    const dLat = num(p.dest_lat);
    const history = Array.isArray(p.status_history)
      ? (p.status_history as unknown[]).flatMap((h) => Array.isArray(h) && typeof h[0] === "string" ? [[h[0], String(h[1] ?? "")] as [string, string]] : [])
      : [];
    cases.push({
      key,
      county: String(p.county ?? ""),
      category,
      categoryRaw: str(p.category_raw),
      status: asFire119Status(p.status),
      statusRaw: str(p.status_raw),
      history,
      receivedMs: isoMs(p.received_at),
      updatedMs: isoMs(p.updated_at) ?? isoMs(p.last_seen_at),
      locationText: str(p.location_text),
      // 精度與幾何不一致時（理論上 CHECK 擋掉）以「有沒有點」為準
      precision: coord ? precision : precision === "district" ? "district" : "none",
      roadKey: str(p.road_key),
      townCode: str(p.town_code),
      units: Array.isArray(p.units) ? (p.units as unknown[]).map(String) : [],
      hospital: str(p.hospital),
      coord: coord && (precision === "exact" || precision === "fuzzy" || precision === "road") ? coord : null,
      dest: dLon !== null && dLat !== null ? [dLon, dLat] : null,
    });
  }
  const meta = obj.meta ?? {};
  return { cases, truncated: meta.truncated === true, generatedAt: str(meta.generated_at) };
}

// ── 119：上圖 ─────────────────────────────────────────

export interface Fire119Display {
  /** 點（exact／fuzzy／road）：properties 帶 _color 用的 category、_mark、_fade、_pulse */
  points: GeoJSON.FeatureCollection;
  /** 只到鄉鎮的案件：town_code → 案件（不畫點，面量＋件數徽章） */
  districts: Map<string, Fire119Case[]>;
  /** 新北送醫中：醫院座標鍵 → { 醫院名、座標、案件 } */
  hospitals: Map<string, { name: string | null; coord: [number, number]; cases: Fire119Case[] }>;
  /** 時間範圍內、但地圖上畫不出來的案件數（none 且沒有醫院、district 沒有鄉鎮碼） */
  unmapped: number;
  /** 時間範圍內的案件總數 */
  total: number;
  signature: string;
}

/** 依受理時間判斷是否在時間範圍內；沒有受理時間（新北）看最後一次內容變化 */
export function inLiveWindow(c: Fire119Case, nowMs: number, windowMin: number): boolean {
  const ref = c.receivedMs ?? c.updatedMs;
  return ref !== null && ref >= nowMs - windowMin * 60_000 && ref <= nowMs + 10 * 60_000;
}

/**
 * 返隊淡出係數：返隊當下 1，依 updated_at 經過 FIRE119_RETURNED_FADE_MIN 分鐘線性到 0；
 * 0＝不上圖。非返隊一律 1。
 */
export function returnedFade(c: Fire119Case, nowMs: number): number {
  if (c.status !== "returned") return 1;
  if (c.updatedMs === null) return 0;
  const age = (nowMs - c.updatedMs) / 60_000;
  return Math.max(0, Math.min(1, 1 - age / FIRE119_RETURNED_FADE_MIN));
}

/** 案件 → popup 用的扁平屬性（Mapbox properties 只收純值；陣列存 JSON 字串） */
export function fire119CaseProps(c: Fire119Case): Record<string, string | number | null> {
  return {
    incident_key: c.key,
    county: c.county,
    category: c.category,
    category_raw: c.categoryRaw,
    status: c.status,
    status_raw: c.statusRaw,
    status_history: JSON.stringify(c.history),
    received_ms: c.receivedMs,
    updated_ms: c.updatedMs,
    location_text: c.locationText,
    geom_precision: c.precision,
    road_key: c.roadKey,
    town_code: c.townCode,
    units: JSON.stringify(c.units),
    hospital: c.hospital,
  };
}

/** 依目前時間與時間範圍產生上圖資料（純函式，測試用） */
export function buildFire119Display(raw: Fire119Raw, nowMs: number, windowMin: number): Fire119Display {
  const inWindow = raw.cases.filter((c) => inLiveWindow(c, nowMs, windowMin));
  const pointCases: { c: Fire119Case; fade: number }[] = [];
  const districts = new Map<string, Fire119Case[]>();
  const hospitals = new Map<string, { name: string | null; coord: [number, number]; cases: Fire119Case[] }>();
  let unmapped = 0;
  for (const c of inWindow) {
    if (c.coord) {
      const fade = returnedFade(c, nowMs);
      if (fade > 0) pointCases.push({ c, fade });
    } else if (c.precision === "district" && c.townCode) {
      const list = districts.get(c.townCode);
      if (list) list.push(c); else districts.set(c.townCode, [c]);
    } else if (c.dest && c.status === "transporting") {
      const k = `${c.dest[0]},${c.dest[1]}`;
      const h = hospitals.get(k);
      if (h) h.cases.push(c); else hospitals.set(k, { name: c.hospital, coord: c.dest, cases: [c] });
    } else {
      unmapped += 1;
    }
  }
  // 脈動只給最新受理的 FIRE119_PULSE_CAP 件
  const pulseKeys = new Set(
    pointCases
      .filter(({ c }) => fire119Mark(c.status) === "pulse")
      .sort((a, b) => (b.c.receivedMs ?? 0) - (a.c.receivedMs ?? 0))
      .slice(0, FIRE119_PULSE_CAP)
      .map(({ c }) => c.key),
  );
  const sig: string[] = [];
  const features: GeoJSON.Feature[] = pointCases.map(({ c, fade }) => {
    const fadeQ = Math.round(fade * 10) / 10;
    sig.push(`${c.key}:${c.status}:${fadeQ}`);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: c.coord! },
      properties: { ...fire119CaseProps(c), _mark: fire119Mark(c.status), _fade: fadeQ, _pulse: pulseKeys.has(c.key) ? 1 : 0 },
    };
  });
  for (const [k, list] of districts) sig.push(`d${k}:${list.length}`);
  for (const [k, h] of hospitals) sig.push(`h${k}:${h.cases.length}`);
  sig.push(`u${unmapped}`);
  return {
    points: { type: "FeatureCollection", features },
    districts,
    hospitals,
    unmapped,
    total: inWindow.length,
    signature: sig.join(","),
  };
}

// ── 119：圖例與 popup 共用的即時快照（useSyncExternalStore）──

export interface Fire119Snapshot {
  total: number;
  unmapped: number;
  truncated: boolean;
  districts: Map<string, Fire119Case[]>;
  hospitals: Map<string, { name: string | null; coord: [number, number]; cases: Fire119Case[] }>;
  /** road_key → 路名與長度（從路段圖磚查到才有） */
  roads: Map<string, { name: string | null; lengthM: number | null }>;
}

let fire119Snapshot: Fire119Snapshot | null = null;
const fire119Listeners = new Set<() => void>();

export function setFire119Snapshot(next: Fire119Snapshot | null): void {
  fire119Snapshot = next;
  for (const cb of fire119Listeners) cb();
}

export const fire119SnapshotStore = {
  subscribe(cb: () => void): () => void {
    fire119Listeners.add(cb);
    return () => { fire119Listeners.delete(cb); };
  },
  getSnapshot(): Fire119Snapshot | null {
    return fire119Snapshot;
  },
};

// ── 警廣 ──────────────────────────────────────────────

export interface PbsRaw {
  fc: GeoJSON.FeatureCollection;
  truncated: boolean;
}

/** RPC 原始回應 → 上圖用資料（純函式）；無座標的列另計 */
export function normalizePbs(raw: unknown): PbsRaw & { unmappedAll: GeoJSON.Feature[] } {
  const obj = (raw ?? {}) as { features?: unknown; meta?: Record<string, unknown> };
  const feats = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const features: GeoJSON.Feature[] = [];
  const unmappedAll: GeoJSON.Feature[] = [];
  for (const f of feats) {
    const p = { ...(f?.properties ?? {}) } as Record<string, unknown>;
    if (!str(p.uid)) continue;
    p.category = asPbsCategory(p.category);
    p.status = asPbsStatus(p.status);
    p.happened_ms = isoMs(p.happened_at) ?? isoMs(p.first_seen_at);
    p.status_history = JSON.stringify(Array.isArray(p.status_history) ? p.status_history : []);
    const g = f.geometry;
    if (g && g.type === "Point") features.push({ type: "Feature", geometry: g, properties: p });
    else unmappedAll.push({ type: "Feature", geometry: null as unknown as GeoJSON.Geometry, properties: p });
  }
  return { fc: { type: "FeatureCollection", features }, truncated: obj.meta?.truncated === true, unmappedAll };
}

/** 時間範圍篩選（依發生時間；沒有發生時間看第一次看到）：回傳上圖點與範圍內無座標筆數 */
export function buildPbsDisplay(raw: PbsRaw & { unmappedAll: GeoJSON.Feature[] }, nowMs: number, windowMin: number) {
  const since = nowMs - windowMin * 60_000;
  const keep = (f: GeoJSON.Feature) => {
    const t = Number(f.properties?.happened_ms);
    return Number.isFinite(t) && t >= since;
  };
  const features = raw.fc.features.filter(keep);
  return {
    fc: { type: "FeatureCollection", features } as GeoJSON.FeatureCollection,
    unmapped: raw.unmappedAll.filter(keep).length,
    total: features.length,
    signature: features.map((f) => `${String(f.properties?.uid)}:${String(f.properties?.status)}`).join(","),
  };
}

export interface PbsSnapshot {
  total: number;
  unmapped: number;
  truncated: boolean;
}
let pbsSnapshot: PbsSnapshot | null = null;
const pbsListeners = new Set<() => void>();
export function setPbsSnapshot(next: PbsSnapshot | null): void {
  pbsSnapshot = next;
  for (const cb of pbsListeners) cb();
}
export const pbsSnapshotStore = {
  subscribe(cb: () => void): () => void {
    pbsListeners.add(cb);
    return () => { pbsListeners.delete(cb); };
  },
  getSnapshot(): PbsSnapshot | null {
    return pbsSnapshot;
  },
};
