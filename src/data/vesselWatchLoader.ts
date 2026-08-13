import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";
import { filterGpsAnomalies } from "./shipTrails";
import { vesselClassColor, vesselClassLabel } from "./vesselWatchTypes";
import type { TrailPoint } from "../types";

/**
 * 特殊船舶（Vessel Watch）loader
 *
 * 來源：`live.vessel_watch_positions` / `live.vessel_watch_registry`
 *      （gis-platform migration 339/340，已 apply 到 production）
 * RPC：
 *   - `get_vessel_watch_current(p_max_age interval)` —— 一船一列的最後已知位置
 *   - `get_vessel_watch_trails(p_from timestamptz, p_to timestamptz)` —— 軌跡視窗
 *   - `get_vessel_watch_classes()` —— 分類統計（本層目前未用，圖例走靜態 12 類）
 *
 * ⚠️ **軌跡是斷續取樣，不是連續航跡**：AIS 每艘約 15 分鐘一筆，離岸遠就收不到。
 *    因此 line 層一律直線連點，**不做 Catmull-Rom 等任何平滑插值**
 *    （PRINCIPLES：平滑只用於真實連續軌跡）。點與點之間發生了什麼，資料沒說。
 *
 * ⚠️ **分類是規則推斷不是官方認定**：`ship_type` 船方自報、可造假也常填錯。
 *    色票與顯示文字的 SSOT 在 `vesselWatchTypes.ts`（loader / 圖例 / popup 共用）。
 *
 * ⚠️ `destination`（目的地）是**船方自報**、可任意填寫 —— popup 端必須標註。
 */

/** 最後已知位置（一船一列） */
export interface VesselWatchPosition {
  mmsi: string;
  shipName: string | null;
  vesselClass: string | null;
  flag: string | null;
  lat: number;
  lng: number;
  /** 節 */
  speed: number | null;
  /** 度（0-359），null = 未回報 */
  heading: number | null;
  navStatus: string | null;
  /** ⚠️ 自報欄位，可造假 */
  destination: string | null;
  /** ISO 字串（RPC 直接回 timestamptz） */
  collectedAt: string | null;
  imo: string | null;
  callSign: string | null;
  lengthM: number | null;
  /**
   * confirmed（人工）> verified（網路查證有實據）> rule_strong（MID×船名雙重印證）
   * > presumed（僅自報 ship_type，或 MMSI 形態可疑）
   */
  confidence: string;
  /** 規則判定依據：name / ship_type / ship_type_only / unmatched / invalid_mmsi */
  matchedBy: string | null;
  /** 查證佐證連結（僅 verified 有） */
  evidenceUrl: string | null;
}

/** 一艘船在視窗內的軌跡 */
export interface VesselWatchTrail {
  mmsi: string;
  shipName: string | null;
  vesselClass: string | null;
  flag: string | null;
  /** confirmed / verified / presumed —— 見 VesselWatchPosition.confidence */
  confidence: string;
  /** `[lat, lng, 0, unix_ts]`（與 ship / flight trail 同一個 TrailPoint 慣例） */
  path: TrailPoint[];
}

/** 分類統計（圖例的「目前有幾艘」用；本層 skeleton 未接） */
export interface VesselWatchClassStat {
  vesselClass: string;
  shipCount: number;
  active24h: number;
}

const TTL = 5 * 60_000;

// ── 最後已知位置 ────────────────────────────────────────────

async function fetchCurrentUncached(): Promise<VesselWatchPosition[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "vessel-watch:current",
    "特殊船舶位置",
    supabase.rpc("get_vessel_watch_current", { p_max_age: "24 hours" }),
  );
  if (error) {
    console.warn("[VesselWatch] get_vessel_watch_current failed:", error.message);
    return [];
  }
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
  const out: VesselWatchPosition[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      mmsi: String(r.mmsi ?? ""),
      shipName: str(r.ship_name),
      vesselClass: str(r.vessel_class),
      flag: str(r.flag),
      lat,
      lng,
      speed: num(r.speed),
      heading: num(r.heading),
      navStatus: str(r.nav_status),
      destination: str(r.destination),
      collectedAt: str(r.collected_at),
      imo: str(r.imo),
      callSign: str(r.call_sign),
      lengthM: num(r.length_m),
      confidence: String(r.confidence ?? 'presumed'),
      matchedBy: str(r.matched_by),
      evidenceUrl: str(r.evidence_url),
    });
  }
  return out;
}

/** 最後已知位置（近 24h）。5min TTL，toggle 不重抓 */
export const fetchVesselWatchCurrent = cachedOnce(fetchCurrentUncached, TTL);

// ── 軌跡視窗 ────────────────────────────────────────────────

/**
 * RPC 的 `trail` 是 **JSONB 陣列**，元素已經是 `[lat, lng, 0, unix_ts]`
 * —— 與 `get_ship_trails` 的字串版不同，**不需要 parser**，只要防守型別。
 * 仍套 `filterGpsAnomalies`（>40 節跳點）：AIS 座標亂碼在本資料集同樣存在，
 * 且與 shipTrails 共用同一支純函數避免兩份漂移。
 */
function parseTrail(raw: unknown): TrailPoint[] {
  const arr = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(arr)) return [];
  const path: TrailPoint[] = [];
  for (const p of arr) {
    if (!Array.isArray(p) || p.length < 4) continue;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    const ts = Number(p[3]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(ts)) continue;
    path.push([lat, lng, 0, ts]);
  }
  return filterGpsAnomalies(path);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** key = `${toIso}|${days}` —— 由 `fetchVesselWatchTrails` 組出，快取以它為單位 */
async function fetchTrailsUncached(key: string): Promise<VesselWatchTrail[]> {
  if (!supabaseConfigured) return [];
  const [toIso, daysStr] = key.split("|");
  const days = Number(daysStr) || 1;
  const toMs = Date.parse(toIso!);
  const fromIso = new Date(toMs - days * 86_400_000).toISOString();
  const { data, error } = await withLoading(
    `vessel-watch:trails:${key}`,
    `特殊船舶軌跡 ${days} 天`,
    supabase.rpc("get_vessel_watch_trails", { p_from: fromIso, p_to: toIso }),
  );
  if (error) {
    console.warn(`[VesselWatch] get_vessel_watch_trails(${key}) failed:`, error.message);
    return [];
  }
  const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
  const out: VesselWatchTrail[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const path = parseTrail(r.trail);
    // 單點畫不出線 —— 留著只會讓 LineString 幾何非法
    if (path.length < 2) continue;
    out.push({
      mmsi: String(r.mmsi ?? ""),
      shipName: str(r.ship_name),
      vesselClass: str(r.vessel_class),
      flag: str(r.flag),
      confidence: String(r.confidence ?? 'presumed'),
      path,
    });
  }
  return out;
}

const fetchTrailsCached = cachedByKey(fetchTrailsUncached, TTL);

/**
 * 取視窗結束時刻往前 `days` 天的軌跡。5min TTL。
 *
 * ⚠️ `endIso` 由呼叫端（hook）依 timeStore 的日期算出當日 23:59:59 —— RPC 只會
 * 回傳實際存在的資料，超過「現在」的區間自然是空的，不必在前端分支判斷今天。
 */
export function fetchVesselWatchTrails(endIso: string, days = 3): Promise<VesselWatchTrail[]> {
  return fetchTrailsCached(`${endIso}|${days}`);
}

// ── 分類統計（選用）────────────────────────────────────────

async function fetchClassesUncached(): Promise<VesselWatchClassStat[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "vessel-watch:classes",
    "特殊船舶分類統計",
    supabase.rpc("get_vessel_watch_classes"),
  );
  if (error) {
    console.warn("[VesselWatch] get_vessel_watch_classes failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    vesselClass: String(r.vessel_class ?? ""),
    shipCount: Number(r.ship_count ?? 0),
    active24h: Number(r.active_24h ?? 0),
  }));
}

/**
 * 名冊分類統計。**目前沒有消費者** —— 圖例走 `vesselWatchTypes` 的靜態 12 類，
 * 不需要為了畫圖例多打一支 RPC。保留 export 供之後「圖例帶艘數」時接。
 */
export const fetchVesselWatchClasses = cachedOnce(fetchClassesUncached, TTL);

// ── GeoJSON ────────────────────────────────────────────────

/**
 * 位置 → 點 FeatureCollection。
 * 色票／分類文字**在 loader 端烤進 properties**（同 plaTracksLoader 的 kind_color）：
 * paint 直接 `["get", "class_color"]`，popup 也讀同一份，不必在三處各查一次表。
 */
export function positionsToGeoJSON(rows: readonly VesselWatchPosition[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        mmsi: p.mmsi,
        ship_name: p.shipName,
        vessel_class: p.vesselClass,
        confidence: p.confidence,
        presumed: p.confidence === "presumed" ? 1 : 0,
        matched_by: p.matchedBy,
        evidence_url: p.evidenceUrl,
        class_label: vesselClassLabel(p.vesselClass),
        class_color: vesselClassColor(p.vesselClass),
        flag: p.flag,
        speed: p.speed,
        heading: p.heading,
        nav_status: p.navStatus,
        destination: p.destination,
        collected_at: p.collectedAt,
        imo: p.imo,
        call_sign: p.callSign,
        length_m: p.lengthM,
      },
    })),
  };
}

/**
 * 軌跡 → LineString FeatureCollection。
 * ⚠️ 逐點直線相連，**不插值** —— 見檔頭「斷續取樣」說明。
 */
/**
 * 訊號中斷判定門檻（秒）。超過就把軌跡切段，不連線。
 *
 * ⚠️ 這個切段不是美觀問題，是**正確性**問題：AIS 是岸基接收，船離開覆蓋範圍就沒訊號。
 * 實測 3 天窗口 16,847 個相鄰點對裡，346 對間隔 > 1 小時、99 對 > 6 小時、
 * 最大間隔達 67 小時 —— 直接連線會畫出一條橫跨台灣海峽、實際上不存在的「航跡」。
 * 正常取樣是每艘約 15 分鐘一筆，取 60 分鐘為界仍保留 94.5% 的正常連線。
 */
const TRAIL_GAP_SEC = 60 * 60;

/** 依訊號中斷切段。回傳的每個 segment 至少 2 點（單點無法成線）。 */
function splitOnGaps(path: readonly TrailPoint[]): number[][][] {
  const segments: number[][][] = [];
  let cur: number[][] = [];
  let prevTs: number | null = null;

  for (const pt of path) {
    if (prevTs !== null && pt[3] - prevTs > TRAIL_GAP_SEC) {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    }
    cur.push([pt[1], pt[0]]);
    prevTs = pt[3];
  }
  if (cur.length >= 2) segments.push(cur);
  return segments;
}

export function trailsToGeoJSON(rows: readonly VesselWatchTrail[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const t of rows) {
    const segments = splitOnGaps(t.path);
    if (segments.length === 0) continue;   // 全程只有孤點 → 船位圓點還在，只是沒有軌跡線

    features.push({
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: segments },
      properties: {
        mmsi: t.mmsi,
        ship_name: t.shipName,
        vessel_class: t.vesselClass,
        class_label: vesselClassLabel(t.vesselClass),
        class_color: vesselClassColor(t.vesselClass),
        flag: t.flag,
        confidence: t.confidence,
        presumed: t.confidence === "presumed" ? 1 : 0,
        point_count: t.path.length,
        segment_count: segments.length,   // > 1 表示中間有訊號中斷
      },
    });
  }

  return { type: "FeatureCollection", features };
}

// ────────────────────────────────────────────────────────────
// 時間軸播放：依 currentTime 算出每艘船當下位置（像 ships 圖層那樣會動）
// ────────────────────────────────────────────────────────────

export interface VesselAtTime {
  lat: number;
  lng: number;
  /** true = 失聯過久，這是「最後已知位置」而非當下位置。前端應淡化顯示。 */
  stale: boolean;
  /** 距離最後一筆回報幾秒（0 = 正在插值移動中）。popup 顯示「N 分鐘前回報」用。 */
  ageSec: number;
  /** 拖尾座標 [lng, lat][]，已避開訊號中斷，不足 2 點時為空陣列 */
  trail: number[][];
}

/**
 * 判定「失聯」的門檻（秒）——比 `TRAIL_GAP_SEC` 寬得多，兩者用途不同：
 *   - `TRAIL_GAP_SEC`（1h）決定**軌跡線要不要斷開**：寧可斷，因為連起來是虛構航跡。
 *   - `STALE_SEC`（3h）決定**船點要不要淡化**：太嚴會讓整層都是淡的。
 *
 * 為什麼需要分開：岸基 AIS 的覆蓋是常態性進出的——實測任一時刻只有 20~33 艘在線，
 * 但 3 天視窗內有 150+ 艘。若沿用 1 小時，畫面上幾乎每艘船都會被判失聯而淡化，
 * 等於這個視覺區隔完全失效。3 小時留給「真的消失了」的船。
 */
const STALE_SEC = 3 * 3600;

/**
 * 取某艘船在 `timeSec` 當下的位置與拖尾。
 *
 * ⚠️ **不可改用 utils/interpolation 的 `interpolatePosition`**：那支只找時間區間、
 * 不看兩點相隔多久，跨越訊號中斷時會讓船「緩慢飄過台灣海峽」——播放出一段
 * 完全不存在的航程（實測資料最大間隔達 67 小時）。
 * 這裡改成：中斷期間**停在最後已知點並標記 stale**，由呼叫端淡化呈現。
 * 不虛構移動、也不讓船閃爍消失。
 */
export function vesselAtTime(
  t: VesselWatchTrail,
  timeSec: number,
  trailSec: number,
): VesselAtTime | null {
  const path = t.path;
  if (path.length === 0) return null;

  const first = path[0]!;
  const last = path[path.length - 1]!;

  // 時間軸還沒走到這艘船第一次出現 → 不顯示（而不是讓它提早出現在起點）
  if (timeSec < first[3]) return null;

  let lat: number;
  let lng: number;
  let stale: boolean;
  let ageSec = 0;

  if (timeSec >= last[3]) {
    lat = last[0];
    lng = last[1];
    ageSec = timeSec - last[3];
    stale = ageSec > STALE_SEC;
  } else {
    let a = first;
    let b = last;
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i]!;
      const q = path[i + 1]!;
      if (timeSec >= p[3] && timeSec <= q[3]) {
        a = p;
        b = q;
        break;
      }
    }
    const span = b[3] - a[3];
    if (span > TRAIL_GAP_SEC) {
      // 訊號中斷區間：停在中斷前最後一點，**不插值**（插了就是虛構航程）
      lat = a[0];
      lng = a[1];
      ageSec = timeSec - a[3];
      stale = ageSec > STALE_SEC;
    } else {
      const r = span > 0 ? (timeSec - a[3]) / span : 0;
      lat = a[0] + (b[0] - a[0]) * r;
      lng = a[1] + (b[1] - a[1]) * r;
      stale = false;
    }
  }

  // 拖尾：往前 trailSec 內的原始點，遇訊號中斷即截斷（只留最靠近當下的一段）
  const trail: number[][] = [];
  const from = timeSec - trailSec;
  let prevTs: number | null = null;
  for (const pt of path) {
    if (pt[3] < from) continue;
    if (pt[3] > timeSec) break;
    if (prevTs !== null && pt[3] - prevTs > TRAIL_GAP_SEC) trail.length = 0;
    trail.push([pt[1], pt[0]]);
    prevTs = pt[3];
  }
  if (!stale && trail.length > 0) trail.push([lng, lat]); // 接上當下插值位置
  if (trail.length < 2) trail.length = 0;

  return { lat, lng, stale, ageSec, trail };
}

/** 把「當下時刻」的所有船打包成 GeoJSON（船點 + 拖尾各一份）。 */
export function frameToGeoJSON(
  rows: readonly VesselWatchTrail[],
  timeSec: number,
  trailSec: number,
): { points: GeoJSON.FeatureCollection; trails: GeoJSON.FeatureCollection } {
  const points: GeoJSON.Feature[] = [];
  const trails: GeoJSON.Feature[] = [];

  for (const t of rows) {
    const at = vesselAtTime(t, timeSec, trailSec);
    if (!at) continue;
    const props = {
      mmsi: t.mmsi,
      ship_name: t.shipName,
      vessel_class: t.vesselClass,
      class_label: vesselClassLabel(t.vesselClass),
      class_color: vesselClassColor(t.vesselClass),
      flag: t.flag,
      confidence: t.confidence,
      presumed: t.confidence === "presumed" ? 1 : 0,
      stale: at.stale ? 1 : 0,
      age_sec: Math.round(at.ageSec),
    };
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [at.lng, at.lat] },
      properties: props,
    });
    if (at.trail.length >= 2) {
      trails.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: at.trail },
        properties: props,
      });
    }
  }

  return {
    points: { type: "FeatureCollection", features: points },
    trails: { type: "FeatureCollection", features: trails },
  };
}
