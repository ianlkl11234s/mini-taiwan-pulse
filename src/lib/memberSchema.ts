/** Private member-storage payload contract.  It deliberately has no map/renderer imports. */
export const SCENE_SNAPSHOT_VERSION = 1 as const;

export type MemberPlaceGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "Polygon"; coordinates: [number, number][][] };

export type MemberPlaceContent = {
  name: string;
  geometry: MemberPlaceGeometry;
  source_kind: "manual" | "map";
  precision: "user_selected";
};

export type MemberPlaceRow = MemberPlaceContent & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type SceneScalar = string | number | boolean;
export type MemberSceneSnapshot = {
  version: typeof SCENE_SNAPSHOT_VERSION;
  camera: { lng: number; lat: number; zoom: number; pitch: number; bearing: number };
  basemap: string;
  layers: string[];
  params: Record<string, Record<string, SceneScalar>>;
  time: {
    mode: "realtime" | "historical";
    playback?: "live" | "replay";
    cursorISO: string;
    windowDays: number;
    historical?: { year: number; month: number; day: number; granularity: "year" | "month" | "day" };
  };
};

export type MemberSceneRow = {
  id: string;
  user_id: string;
  name: string;
  snapshot_version: typeof SCENE_SNAPSHOT_VERSION;
  snapshot: MemberSceneSnapshot;
  created_at: string;
  updated_at: string;
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
export type SceneValidationOptions = { allowedLayerKeys?: ReadonlySet<string>; allowedParams?: ReadonlyMap<string, ReadonlySet<string>> };

const MAX_NAME = 120;
const MAX_LAYERS = 500;
const MAX_PARAMS_PER_LAYER = 64;
const MAX_POLYGON_POSITIONS = 2_000;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).length === expected.length && expected.every((key) => key in value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validCoordinate = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
const validIso = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)); const month = Number(value.slice(5, 7)); const day = Number(value.slice(8, 10));
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && new Date(Date.UTC(year, month - 1, day)).getUTCFullYear() === year && new Date(Date.UTC(year, month - 1, day)).getUTCMonth() === month - 1 && new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
};
const validKey = (value: unknown, max = 120): value is string => typeof value === "string" && value.length > 0 && value.length <= max && /^[A-Za-z0-9_.-]+$/.test(value);
const fail = <T>(...errors: string[]): ValidationResult<T> => ({ ok: false, errors });

function parseGeometry(value: unknown): ValidationResult<MemberPlaceGeometry> {
  if (!isRecord(value) || !keysAre(value, ["type", "coordinates"])) return fail("geometry 必須是僅含 type 與 coordinates 的 GeoJSON 物件。");
  if (value.type === "Point") return validCoordinate(value.coordinates) ? { ok: true, value: { type: "Point", coordinates: value.coordinates } } : fail("Point 座標必須是有限的 WGS84 [lng, lat]。");
  if (value.type !== "Polygon" || !Array.isArray(value.coordinates) || value.coordinates.length === 0 || value.coordinates.length > 10) return fail("geometry 僅接受至少一個環的 Polygon。");
  let positions = 0;
  const rings: [number, number][][] = [];
  for (const ring of value.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) return fail("Polygon 的每個環至少需要四個座標。");
    const parsed: [number, number][] = [];
    for (const coordinate of ring) {
      if (!validCoordinate(coordinate)) return fail("Polygon 含有無效或超出 WGS84 範圍的座標。");
      positions += 1;
      if (positions > MAX_POLYGON_POSITIONS) return fail(`Polygon 最多 ${MAX_POLYGON_POSITIONS} 個座標。`);
      parsed.push(coordinate);
    }
    const first = parsed[0]!; const last = parsed[parsed.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) return fail("Polygon 的每個環必須封閉。");
    rings.push(parsed);
  }
  return { ok: true, value: { type: "Polygon", coordinates: rings } };
}

export function validatePlace(input: unknown): ValidationResult<MemberPlaceContent> {
  if (!isRecord(input) || !keysAre(input, ["name", "geometry", "source_kind", "precision"])) return fail("地點欄位必須是 name、geometry、source_kind、precision。");
  if (typeof input.name !== "string" || input.name.trim().length === 0 || input.name.trim().length > MAX_NAME) return fail(`地點名稱必須是 1 至 ${MAX_NAME} 個字元。`);
  if (input.source_kind !== "manual" && input.source_kind !== "map") return fail("source_kind 必須是 manual 或 map。");
  if (input.precision !== "user_selected") return fail("precision 必須是 user_selected。");
  const geometry = parseGeometry(input.geometry);
  return geometry.ok ? { ok: true, value: { name: input.name.trim(), geometry: geometry.value, source_kind: input.source_kind, precision: input.precision } } : geometry;
}

export const normalizePlace = validatePlace;

export function validateScene(input: unknown, options: SceneValidationOptions = {}): ValidationResult<MemberSceneSnapshot> {
  if (!isRecord(input) || !keysAre(input, ["version", "camera", "basemap", "layers", "params", "time"])) return fail("場景欄位必須是 version、camera、basemap、layers、params、time。");
  if (input.version !== SCENE_SNAPSHOT_VERSION) return fail("不支援的場景版本。");
  if (!isRecord(input.camera) || !keysAre(input.camera, ["lng", "lat", "zoom", "pitch", "bearing"]) || !finite(input.camera.lng) || !finite(input.camera.lat) || !finite(input.camera.zoom) || !finite(input.camera.pitch) || !finite(input.camera.bearing) || input.camera.lng < -180 || input.camera.lng > 180 || input.camera.lat < -90 || input.camera.lat > 90 || input.camera.zoom < 0 || input.camera.zoom > 24 || input.camera.pitch < 0 || input.camera.pitch > 85 || input.camera.bearing < -360 || input.camera.bearing > 360) return fail("camera 含有無效的有限 WGS84 或視角數值。");
  if (!validKey(input.basemap, 80)) return fail("basemap 格式無效。");
  if (!Array.isArray(input.layers) || input.layers.length > MAX_LAYERS || input.layers.some((layer) => !validKey(layer)) || new Set(input.layers).size !== input.layers.length) return fail("layers 必須是去重且格式正確的圖層 key 陣列。");
  if (options.allowedLayerKeys && input.layers.some((layer) => !options.allowedLayerKeys!.has(layer))) return fail("場景含有目前不可保存的圖層。");
  if (!isRecord(input.params) || Object.keys(input.params).length > MAX_LAYERS) return fail("params 格式或圖層數量無效。");
  for (const [layer, params] of Object.entries(input.params)) {
    if (!validKey(layer) || !isRecord(params) || Object.keys(params).length > MAX_PARAMS_PER_LAYER) return fail("params 含有無效的圖層或過多參數。");
    const allowed = options.allowedParams?.get(layer);
    for (const [name, value] of Object.entries(params)) {
      if (!validKey(name) || !(typeof value === "string" || typeof value === "boolean" || finite(value)) || (typeof value === "string" && value.length > 200) || (allowed && !allowed.has(name))) return fail("params 含有未允許或非 scalar 的值。");
    }
  }
  if (!isRecord(input.time) || !Object.keys(input.time).every((key) => ["mode", "playback", "cursorISO", "windowDays", "historical"].includes(key)) || !(["realtime", "historical"] as const).includes(input.time.mode as "realtime" | "historical") || (input.time.playback !== undefined && input.time.playback !== "live" && input.time.playback !== "replay") || !validIso(input.time.cursorISO) || !finite(input.time.windowDays) || !Number.isInteger(input.time.windowDays) || input.time.windowDays < 1 || input.time.windowDays > 7) return fail("time 必須有合法 mode、playback、cursorISO 與 windowDays。");
  if ("historical" in input.time && input.time.historical !== undefined) {
    const historical = input.time.historical;
    if (!isRecord(historical) || !keysAre(historical, ["year", "month", "day", "granularity"]) || !finite(historical.year) || !Number.isInteger(historical.year) || historical.year < 1900 || historical.year > 2100 || !finite(historical.month) || !Number.isInteger(historical.month) || historical.month < 1 || historical.month > 12 || !finite(historical.day) || !Number.isInteger(historical.day) || historical.day < 1 || historical.day > 31 || !(["year", "month", "day"] as const).includes(historical.granularity as "year" | "month" | "day") || new Date(Date.UTC(historical.year, historical.month - 1, historical.day)).getUTCMonth() !== historical.month - 1) return fail("historical 必須是合法的年、月、日與 granularity。");
  }
  return { ok: true, value: input as MemberSceneSnapshot };
}

export const normalizeScene = validateScene;
