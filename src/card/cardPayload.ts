/**
 * 分析卡 payload v1（viz-library 4b，docs/features/viz-library/DECISIONS.md §6.1）。
 *
 * 型別對照 mcp `src/warehouse/cardPayload.ts` 的 `CardPayloadV1`；驗證規則對照 gis-platform
 * migration 414 的 `analysis_card_payload_is_valid`。瀏覽器端再驗一次，是因為卡片頁與面板
 * 都只信任「形狀正確」的資料：未知版本、禁止欄位、超出上限一律拒絕，不嘗試修補。
 *
 * 本檔不得 import `lib/supabase` 或任何主站模組（卡片頁是獨立 entry）。
 */

export const CARD_SCHEMA_VERSION = 1;
export const CARD_MAX_BYTES = 32 * 1024;

export type CardValueKind = "count" | "ratio" | "percent" | "currency" | "number";
export type CardStat = { label: string; value: number | null; unit: string | null; value_kind: CardValueKind };
export type CardTopItem = { name: string; value: number | null; class_index: number | null; /** 行政區代碼（選填，mcp／414 已支援） */ code?: string };
export type CardGeometryRef = {
  level: "county" | "township";
  boundary_version: string;
  code_scheme: string;
  resource_url: string;
  sha256: string;
  code_property: string | null;
};
export type CardAreaMap = {
  geometry: CardGeometryRef;
  /** [area_code, class_index | null（缺值 → 斜線）] */
  areas: [string, number | null][];
  ramp: string;
  scheme: "sequential" | "diverging";
  breaks: number[];
  class_labels: string[];
};
export type CardPoints = {
  items: { name: string | null; lnglat: [number, number]; class_index: number | null }[];
  ramp: string | null;
  breaks: number[];
};
export type CardSource = { dataset_label: string; publisher: string | null; data_time: string | null; license: string; attribution: string | null };
export type CardPayloadV1 = {
  schema_version: 1;
  kind: "area" | "points";
  title: string;
  generated_at: string;
  data_period: { start: string; end: string | null; label: string } | null;
  stats: CardStat[];
  top: CardTopItem[];
  map: CardAreaMap | null;
  points: CardPoints | null;
  query_scope: { center: [number, number]; radius_m: number | null } | null;
  legend: { title: string; unit: string | null; method: "quantile" | "equal" | "category"; missing_count: number };
  sources: CardSource[];
  caveats: string[];
};

export type CardValidation = { ok: true; payload: CardPayloadV1 } | { ok: false; reason: string };

const TOP_KEYS = ["schema_version", "kind", "title", "generated_at", "data_period", "stats", "top", "map", "points", "query_scope", "legend", "sources", "caveats"];
const REQUIRED_TOP_KEYS = ["schema_version", "kind", "title", "generated_at", "legend", "sources"];
/** 任何深度都不得出現（對照 migration 414）；`map.geometry` 參照物件是唯一例外。 */
const FORBIDDEN_KEYS = new Set(["address", "addr", "phone", "tel", "email", "properties", "features", "coordinates", "raw", "mmsi", "owner_id", "sql", "params"]);
const GEOMETRY_URL = /^https:\/\/data\.itsmigu\.com\/statistics\/v1\/geometries\/[0-9a-f]{64}\.geojson$/;
const AREA_CODE = /^[A-Za-z0-9_-]{1,20}$/;
const VALUE_KINDS = new Set(["count", "ratio", "percent", "currency", "number"]);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, min: number, max: number) => typeof value === "string" && [...value.trim()].length >= min && [...value].length <= max;
const nullableText = (value: unknown, max: number) => value === null || value === undefined || text(value, 0, max);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nullableFinite = (value: unknown) => value === null || finite(value);
const classIndex = (value: unknown) => value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 11);
const lngLat = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;

function forbiddenKeyPath(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const hit = forbiddenKeyPath(value[index], `${path}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key) || (key === "geometry" && path !== "$.map")) return `${path}.${key}`;
    const hit = forbiddenKeyPath(child, `${path}.${key}`);
    if (hit) return hit;
  }
  return null;
}

/** 驗證任意 JSON 是否為可顯示的 v1 卡片；不符就回傳原因（給測試與除錯看，不直接顯示給收件人）。 */
export function validateCardPayload(value: unknown): CardValidation {
  const fail = (reason: string): CardValidation => ({ ok: false, reason });
  if (!isObject(value)) return fail("NOT_OBJECT");
  if (value.schema_version !== CARD_SCHEMA_VERSION) return fail("UNKNOWN_SCHEMA_VERSION");
  if (!onlyKeys(value, TOP_KEYS) || !REQUIRED_TOP_KEYS.every(key => key in value)) return fail("TOP_LEVEL_KEYS");
  let bytes: number;
  try { bytes = new TextEncoder().encode(JSON.stringify(value)).length; } catch { return fail("NOT_SERIALIZABLE"); }
  if (bytes > CARD_MAX_BYTES) return fail("TOO_LARGE");
  const forbidden = forbiddenKeyPath(value, "$");
  if (forbidden) return fail(`FORBIDDEN_KEY:${forbidden}`);
  if (value.kind !== "area" && value.kind !== "points") return fail("KIND");
  if (!text(value.title, 1, 80)) return fail("TITLE");
  if (typeof value.generated_at !== "string" || Number.isNaN(Date.parse(value.generated_at))) return fail("GENERATED_AT");

  const period = value.data_period;
  if (period !== undefined && period !== null && !(isObject(period) && typeof period.start === "string" && (period.end === null || period.end === undefined || typeof period.end === "string") && text(period.label, 1, 40))) return fail("DATA_PERIOD");

  const stats = value.stats ?? [];
  if (!Array.isArray(stats) || stats.length > 3 || !stats.every(stat => isObject(stat) && text(stat.label, 1, 20) && nullableFinite(stat.value) && nullableText(stat.unit, 12) && VALUE_KINDS.has(String(stat.value_kind)))) return fail("STATS");
  const top = value.top ?? [];
  if (!Array.isArray(top) || top.length > 5 || !top.every(item => isObject(item) && onlyKeys(item, ["name", "value", "class_index", "code"]) && text(item.name, 1, 40) && nullableFinite(item.value) && classIndex(item.class_index ?? null) && (item.code === undefined || (typeof item.code === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(item.code))))) return fail("TOP");

  const sources = value.sources;
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 6 || !sources.every(source => isObject(source) && onlyKeys(source, ["dataset_label", "publisher", "data_time", "license", "attribution"]) && text(source.dataset_label, 1, 80) && text(source.license, 1, 40) && nullableText(source.publisher, 200) && nullableText(source.data_time, 200) && nullableText(source.attribution, 200))) return fail("SOURCES");
  const caveats = value.caveats ?? [];
  if (!Array.isArray(caveats) || caveats.length > 3 || !caveats.every(caveat => text(caveat, 1, 120))) return fail("CAVEATS");

  const legend = value.legend;
  if (!isObject(legend) || !text(legend.title, 1, 40) || !nullableText(legend.unit, 12) || !["quantile", "equal", "category"].includes(String(legend.method)) || !(typeof legend.missing_count === "number" && Number.isInteger(legend.missing_count) && legend.missing_count >= 0)) return fail("LEGEND");

  if (value.kind === "area") {
    const map = value.map;
    if (!isObject(map) || !onlyKeys(map, ["geometry", "areas", "ramp", "scheme", "breaks", "class_labels"])) return fail("MAP");
    const geometry = map.geometry;
    if (!isObject(geometry) || !onlyKeys(geometry, ["level", "boundary_version", "code_scheme", "resource_url", "sha256", "code_property"])
      || (geometry.level !== "county" && geometry.level !== "township")
      || typeof geometry.resource_url !== "string" || !GEOMETRY_URL.test(geometry.resource_url)
      || typeof geometry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(geometry.sha256)
      || !(geometry.code_property === null || geometry.code_property === undefined || text(geometry.code_property, 1, 40))) return fail("MAP_GEOMETRY");
    if (!Array.isArray(map.areas) || map.areas.length < 1 || map.areas.length > 400 || !map.areas.every(area => Array.isArray(area) && area.length === 2 && typeof area[0] === "string" && AREA_CODE.test(area[0]) && classIndex(area[1]))) return fail("MAP_AREAS");
    if (typeof map.ramp !== "string" || !Array.isArray(map.breaks) || map.breaks.length > 8 || !map.breaks.every(finite)) return fail("MAP_RAMP");
    if (map.class_labels !== undefined && !(Array.isArray(map.class_labels) && map.class_labels.length <= 9 && map.class_labels.every(label => typeof label === "string"))) return fail("MAP_LABELS");
  } else {
    const points = value.points;
    if (!isObject(points) || !Array.isArray(points.items) || points.items.length < 1 || points.items.length > 50
      || !points.items.every(item => isObject(item) && onlyKeys(item, ["name", "lnglat", "class_index"]) && (item.name === null || item.name === undefined || text(item.name, 1, 40)) && lngLat(item.lnglat) && classIndex(item.class_index ?? null))) return fail("POINTS");
    if (!(points.ramp === null || points.ramp === undefined || typeof points.ramp === "string") || !(points.breaks === undefined || (Array.isArray(points.breaks) && points.breaks.length <= 8 && points.breaks.every(finite)))) return fail("POINTS_RAMP");
  }

  const scope = value.query_scope;
  if (scope !== undefined && scope !== null && !(isObject(scope) && onlyKeys(scope, ["center", "radius_m", "center_source"]) && lngLat(scope.center) && (scope.radius_m === null || scope.radius_m === undefined || (finite(scope.radius_m) && scope.radius_m > 0 && scope.radius_m <= 500_000)))) return fail("QUERY_SCOPE");

  const payload = value as unknown as CardPayloadV1;
  return {
    ok: true,
    payload: {
      ...payload,
      data_period: payload.data_period ?? null,
      stats: payload.stats ?? [],
      top: payload.top ?? [],
      map: payload.kind === "area" ? payload.map : null,
      points: payload.kind === "points" ? { ...payload.points!, ramp: payload.points!.ramp ?? null, breaks: payload.points!.breaks ?? [] } : null,
      query_scope: payload.query_scope ?? null,
      caveats: payload.caveats ?? [],
    },
  };
}

/** `/card/<slug>`：slug 為 16 字元 URL-safe（伺服器產生，migration 414）；格式不符回 null。 */
export function parseCardSlug(pathname: string): string | null {
  const match = /^\/card\/([A-Za-z0-9_-]{16})\/?$/.exec(pathname);
  return match ? match[1]! : null;
}
