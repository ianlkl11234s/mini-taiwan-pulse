import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import {
  JMA_QUAKE_LOOKBACK_DAYS, JMA_WARNING_INACTIVE_STATUS, JMA_WARNING_LEVELS,
  jmaVolcanoLevel, jmaWarningLevel, normalizeJmaIntensity, type JmaWarningLevel,
} from "./jmaTypes";

/**
 * 日本氣象廳（JMA）即時 4 層 loader（gis-platform migration 435；public view，select * from live.*）。
 *
 *   - jma_amedas_current     AMeDAS 每站最新一筆（10 分鐘）
 *   - jma_warnings_current   最新一版 control_datetime 的警報・注意報列（5 分鐘）
 *   - jma_quake_latest       每個地震事件最新一報（2 分鐘；底層永久表 → 一律帶時間窗）
 *   - jma_volcano_current    每座火山最新一筆
 *
 * 四層都是「當下快照」：不接 timeStore（比照 erHospital／環境即時層）。
 * 缺值一律保留 null（不補 0）；座標 NULL 的列不畫，筆數記在狀態裡讓圖例揭露。
 * 查詢失敗：狀態記 error、hook 清空 source，不畫舊資料。view 尚未建立（PGRST205）時明講「尚未上線」。
 */

export type JmaLiveKey = "jmaAmedas" | "jmaWarnings" | "jmaQuakes" | "jmaVolcanoes";
export type JmaPointKey = Exclude<JmaLiveKey, "jmaWarnings">;

export interface JmaLiveStatus {
  state: "idle" | "loading" | "ok" | "error";
  message?: string;
  loadedAt?: number;
  /** 查詢回傳列數（對帳用） */
  rows?: number;
  /** 有畫上地圖的筆數（警報＝對到市町村界的區域數） */
  drawn?: number;
  /** 座標 NULL 未畫（警報＝對不到市町村界的區域數） */
  noCoord?: number;
  latestAt?: string | null;
}

const statuses = new Map<JmaLiveKey, JmaLiveStatus>();
const listeners = new Set<() => void>();
const IDLE: JmaLiveStatus = { state: "idle" };

export function getJmaLiveStatus(key: JmaLiveKey): JmaLiveStatus {
  return statuses.get(key) ?? IDLE;
}
export function subscribeJmaLiveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function setJmaLiveStatus(key: JmaLiveKey, next: JmaLiveStatus) {
  statuses.set(key, next);
  for (const listener of listeners) listener();
}

type Row = Record<string, unknown>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point>;

export function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function maxIso(rows: Row[], field: string): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const v = row[field];
    if (typeof v !== "string") continue;
    const ms = Date.parse(v);
    if (Number.isFinite(ms) && ms > bestMs) { bestMs = ms; best = v; }
  }
  return best;
}

interface PgError { code?: string; message?: string }

/** 使用者看得懂的錯誤訊息（不印表名）。 */
function humanError(err: PgError | null | undefined): string {
  if (err?.code === "PGRST205" || err?.code === "42P01") return "資料表尚未上線（上游建置中），圖層開著會自動重試";
  return "資料服務回應失敗，請稍後重新開啟圖層";
}

class JmaQueryError extends Error {
  readonly human: string;
  constructor(view: string, err: PgError) {
    super(`${view}: ${err.message ?? err.code ?? "unknown"}`);
    this.human = humanError(err);
  }
}

async function query(view: string, label: string, build: (q: ReturnType<typeof supabase.from>) => PromiseLike<{ data: unknown; error: PgError | null }>): Promise<Row[]> {
  const { data, error } = await withLoading(`jma-live:${view}`, label, build(supabase.from(view)));
  if (error) throw new JmaQueryError(view, error);
  return (Array.isArray(data) ? data : []) as Row[];
}

async function withStatus<T>(key: JmaLiveKey, run: () => Promise<{ value: T; status: Omit<JmaLiveStatus, "state" | "loadedAt"> }>): Promise<T> {
  const prev = getJmaLiveStatus(key);
  setJmaLiveStatus(key, { ...prev, state: "loading", message: undefined });
  try {
    const { value, status } = await run();
    setJmaLiveStatus(key, { state: "ok", loadedAt: Date.now(), ...status });
    return value;
  } catch (err) {
    setJmaLiveStatus(key, { state: "error", message: err instanceof JmaQueryError ? err.human : humanError(null) });
    throw err;
  }
}

/** rows → Point FC（座標 NULL 不畫，不合成座標）。 */
export function rowsToPointFC(rows: Row[], toProps: (row: Row) => Record<string, unknown>): { fc: PointFC; noCoord: number } {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let noCoord = 0;
  for (const row of rows) {
    const lon = finiteOrNull(row.lon);
    const lat = finiteOrNull(row.lat);
    if (lon == null || lat == null) { noCoord += 1; continue; }
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: toProps(row) });
  }
  return { fc: { type: "FeatureCollection", features }, noCoord };
}

// ── AMeDAS ─────────────────────────────────────────────────────────
const AMEDAS_NUMERIC = [
  "alt_m", "temp", "precip10m", "precip1h", "precip3h", "precip24h", "wind", "wind_dir", "gust",
  "humidity", "pressure", "sun1h", "snow", "snow1h", "snow6h", "snow12h", "snow24h",
] as const;

export function amedasProps(row: Row): Record<string, unknown> {
  const props: Record<string, unknown> = {
    station_id: row.station_id ?? null,
    station_name: row.station_name ?? null,
    station_name_en: row.station_name_en ?? null,
    observed_at: row.observed_at ?? null,
    has_snow_gauge: row.has_snow_gauge === true,
  };
  for (const field of AMEDAS_NUMERIC) props[field] = finiteOrNull(row[field]);
  return props;
}

const fetchAmedas = cachedOnce(() => withStatus("jmaAmedas", async () => {
  const rows = await query("jma_amedas_current", "日本 AMeDAS 即時觀測", (q) => q.select("*").limit(3000));
  const { fc, noCoord } = rowsToPointFC(rows, amedasProps);
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "observed_at") } };
}), 60_000);

// ── 地震 ───────────────────────────────────────────────────────────
export function quakeProps(row: Row): Record<string, unknown> {
  const intensity = normalizeJmaIntensity(row.max_intensity);
  return {
    json_id: row.json_id ?? null,
    event_id: row.event_id ?? null,
    report_time: row.report_time ?? null,
    origin_time: row.origin_time ?? null,
    title: row.title ?? null,
    hypocenter_name: row.hypocenter_name ?? null,
    depth_km: finiteOrNull(row.depth_km),
    magnitude: finiteOrNull(row.magnitude),
    max_intensity: intensity,
    max_intensity_raw: row.max_intensity ?? null,
    intensity_by_pref: row.intensity_by_pref == null ? null : JSON.stringify(row.intensity_by_pref),
  };
}

const fetchQuakes = cachedOnce(() => withStatus("jmaQuakes", async () => {
  const since = new Date(Date.now() - JMA_QUAKE_LOOKBACK_DAYS * 86_400_000).toISOString();
  const rows = await query("jma_quake_latest", `日本地震（近 ${JMA_QUAKE_LOOKBACK_DAYS} 天）`, (q) => q
    .select("*")
    .gte("report_time", since)
    .order("report_time", { ascending: false })
    .limit(1000));
  const { fc, noCoord } = rowsToPointFC(rows, quakeProps);
  // 大震畫在上面：依規模升冪（null 最先）
  fc.features.sort((a, b) => (Number(a.properties?.magnitude ?? -1)) - (Number(b.properties?.magnitude ?? -1)));
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "report_time") } };
}), 30_000);

// ── 火山 ───────────────────────────────────────────────────────────
export function volcanoProps(row: Row): Record<string, unknown> {
  return {
    volcano_code: row.volcano_code ?? null,
    volcano_name: row.volcano_name ?? null,
    level_code: row.level_code ?? null,
    level_name: row.level_name ?? null,
    warning_kind: row.warning_kind ?? null,
    report_time: row.report_time ?? null,
    level: jmaVolcanoLevel(row.level_name, row.level_code),
  };
}

const fetchVolcanoes = cachedOnce(() => withStatus("jmaVolcanoes", async () => {
  const rows = await query("jma_volcano_current", "日本火山噴火警戒", (q) => q.select("volcano_code,volcano_name,lat,lon,level_code,level_name,warning_kind,report_time").limit(500));
  const { fc, noCoord } = rowsToPointFC(rows, volcanoProps);
  fc.features.sort((a, b) => String(a.properties?.level).localeCompare(String(b.properties?.level)));
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "report_time") } };
}), 60_000);

const POINT_FETCHERS: Record<JmaPointKey, ReturnType<typeof cachedOnce<PointFC>>> = {
  jmaAmedas: fetchAmedas,
  jmaQuakes: fetchQuakes,
  jmaVolcanoes: fetchVolcanoes,
};

export function fetchJmaPointFC(key: JmaPointKey): Promise<PointFC> {
  return POINT_FETCHERS[key]();
}
export function invalidateJmaPoint(key: JmaPointKey): void {
  POINT_FETCHERS[key].invalidate();
}

// ── 警報・注意報 ────────────────────────────────────────────────────
export interface JmaWarningRow {
  control_datetime: string | null;
  report_datetime: string | null;
  office_name: string | null;
  area_code: string;
  area_name: string | null;
  area_level: string | null;
  kind_code: string | null;
  kind_name: string | null;
  status: string | null;
  level: JmaWarningLevel;
  active: boolean;
}

export interface JmaWarningArea {
  /** class20 前 5 碼（JIS 市区町村コード） */
  code5: string;
  areaName: string | null;
  level: JmaWarningLevel;
  rows: JmaWarningRow[];
}

export interface JmaWarningsSnapshot {
  rows: JmaWarningRow[];
  /** 發表中、可對到市町村界的區域（key＝5 碼） */
  areas: Map<string, JmaWarningArea>;
  /** 政令市「分區」（如 横浜市北部）沒有對應的區界 → 以「縣碼 2 碼＋市名」對整個市（key 例：14横浜市） */
  cityNameKeys: Map<string, JmaWarningArea>;
  /** 發表中但不是市町村層級（class10/15 等）或代碼格式不明的列 */
  unmatched: JmaWarningRow[];
  controlDatetime: string | null;
}

const LEVEL_RANK = new Map<string, number>(JMA_WARNING_LEVELS.map((l) => [l.value, l.rank]));

function text(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

/** 政令市分區（如「横浜市北部」「静岡市南部」）→ 回傳市名；一般市町村或區（神戸市中央区）→ null。 */
export function designatedCityName(areaName: string | null, code5: string): string | null {
  if (!areaName) return null;
  if (code5[2] !== "1" || code5[4] !== "0") return null;
  const base = areaName.replace(/(東部|西部|南部|北部)$/, "");
  return /^[^区]+市$/.test(base) ? base : null;
}

export function buildJmaWarningsSnapshot(raw: Row[]): JmaWarningsSnapshot {
  const rows: JmaWarningRow[] = raw.map((r) => {
    const status = text(r.status);
    return {
      control_datetime: text(r.control_datetime),
      report_datetime: text(r.report_datetime),
      office_name: text(r.office_name),
      area_code: String(r.area_code ?? ""),
      area_name: text(r.area_name),
      area_level: text(r.area_level),
      kind_code: text(r.kind_code),
      kind_name: text(r.kind_name),
      status,
      level: jmaWarningLevel(text(r.kind_name)),
      active: status == null || !(JMA_WARNING_INACTIVE_STATUS as readonly string[]).includes(status),
    };
  });
  const areas = new Map<string, JmaWarningArea>();
  const cityNameKeys = new Map<string, JmaWarningArea>();
  const unmatched: JmaWarningRow[] = [];
  for (const row of rows) {
    if (!row.active) continue;
    // class20 = 7 碼數字（前 5 碼＝JIS 市区町村コード）；其他層級的代碼位數不同，不硬對
    const isClass20 = /^\d{7}$/.test(row.area_code) && (row.area_level == null || row.area_level === "class20");
    if (!isClass20) { unmatched.push(row); continue; }
    const code5 = row.area_code.slice(0, 5);
    let area = areas.get(code5);
    if (!area) { area = { code5, areaName: row.area_name, level: row.level, rows: [] }; areas.set(code5, area); }
    area.rows.push(row);
    if ((LEVEL_RANK.get(row.level) ?? 0) > (LEVEL_RANK.get(area.level) ?? 0)) area.level = row.level;
  }
  // 政令市分區（横浜市北部／南部同為 14100）已在同一個 5 碼 area 內合併；再掛一把「縣碼＋市名」的鑰匙給區界用
  for (const area of areas.values()) {
    const city = area.rows.map((r) => designatedCityName(r.area_name, area.code5)).find((c) => c != null);
    if (city) cityNameKeys.set(`${area.code5.slice(0, 2)}${city}`, area);
  }
  return { rows, areas, cityNameKeys, unmatched, controlDatetime: maxIso(raw, "control_datetime") };
}

let latestWarnings: JmaWarningsSnapshot | null = null;
/** popup 用：最近一次成功載入的警報快照（未載入或失敗 → null）。 */
export function getLatestJmaWarnings(): JmaWarningsSnapshot | null {
  return latestWarnings;
}

const fetchWarnings = cachedOnce(() => withStatus("jmaWarnings", async () => {
  const raw = await query("jma_warnings_current", "日本警報・注意報", (q) => q.select("*").limit(20000));
  const snapshot = buildJmaWarningsSnapshot(raw);
  latestWarnings = snapshot;
  return { value: snapshot, status: { rows: raw.length, drawn: snapshot.areas.size, noCoord: snapshot.unmatched.length, latestAt: snapshot.controlDatetime } };
}), 60_000);

export function fetchJmaWarnings(): Promise<JmaWarningsSnapshot> {
  return fetchWarnings().catch((err) => { latestWarnings = null; throw err; });
}
export function invalidateJmaWarnings(): void {
  fetchWarnings.invalidate();
}
