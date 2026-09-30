// 記憶體 GeoJSON 查詢引擎 — 靜態資料集只 fetch 一次、快取，之後在記憶體做統計。
// 絕不把整份 features 回給 LLM：所有清單類輸出都過 capToolResult。

import { withLoading } from "../../lib/loadingRegistry";
import { DATASET_WHITELIST } from "./datasets";
import { capToolResult } from "./truncate";

export interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface FeatureCollection {
  features?: GeoFeature[];
}

// ── module-level 快取（同 fireLoader pattern）──
const cache = new Map<string, GeoFeature[]>();

/** fetch 白名單資料集 → features 陣列，含快取 + withLoading。未授權 id 直接 throw。 */
export async function fetchDataset(id: string): Promise<GeoFeature[]> {
  const cached = cache.get(id);
  if (cached) return cached;

  const meta = DATASET_WHITELIST[id];
  if (!meta) throw new Error(`未授權的資料集：${id}`);

  const features = await withLoading(
    `chat-dataset:${id}`,
    `載入 ${meta.label}`,
    fetchFeatures(meta.url),
  );
  cache.set(id, features);
  return features;
}

async function fetchFeatures(url: string): Promise<GeoFeature[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`載入資料失敗（${res.status}）：${url}`);
  return parseDatasetPayload(await res.json(), url);
}

/**
 * 解析資料集 payload：GeoJSON FeatureCollection 或 columnar 點位（PF-14）。
 * 無法辨識的格式直接 throw，避免被當成「0 筆」的有效結果。
 */
export function parseDatasetPayload(payload: unknown, url = "(inline)"): GeoFeature[] {
  const p = payload as { type?: unknown; format?: unknown; features?: unknown };
  if (p && p.format === COLUMNAR_FORMAT) return decodeColumnarPoints(payload as ColumnarPoints);
  if (p && p.type === "FeatureCollection") return ((p as FeatureCollection).features ?? []);
  throw new Error(`無法辨識的資料集格式：${url}`);
}

// ── columnar 點位格式（scripts/preprocess/build-waste-stops-chat.py 產出）──
// lng/lat 平行陣列 + properties：字串欄位為 { dict, codes } 字典編碼，數值欄位為原值陣列。
// 解碼後的 properties 欄位順序即檔案內宣告順序（availableFields 依此）。

export const COLUMNAR_FORMAT = "pulse-columnar-points/v1";

type ColumnarColumn = { dict: unknown[]; codes: number[] } | unknown[];
export interface ColumnarPoints {
  format: typeof COLUMNAR_FORMAT;
  count: number;
  lng: number[];
  lat: number[];
  properties: Record<string, ColumnarColumn>;
}

export function decodeColumnarPoints(data: ColumnarPoints): GeoFeature[] {
  const n = data.count;
  if (data.lng.length !== n || data.lat.length !== n) {
    throw new Error(`columnar 座標長度與 count（${n}）不符`);
  }
  const cols = Object.entries(data.properties).map(([key, col]) => {
    const get = Array.isArray(col)
      ? (i: number) => col[i]
      : (i: number) => col.dict[col.codes[i] as number];
    const len = Array.isArray(col) ? col.length : col.codes.length;
    if (len !== n) throw new Error(`columnar 欄位 ${key} 長度與 count（${n}）不符`);
    return [key, get] as const;
  });
  const features: GeoFeature[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const properties: Record<string, unknown> = {};
    for (const [key, get] of cols) properties[key] = get(i);
    features[i] = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [data.lng[i], data.lat[i]] },
      properties,
    };
  }
  return features;
}

/** 測試 / 重載用 */
export function clearDatasetCache(): void {
  cache.clear();
}

// ── 純函式（可直接餵 features 做單元測試）──

/** 取點座標 [lng, lat]；非 Point geometry 回 null。 */
export function pointOf(f: GeoFeature): [number, number] | null {
  if (!f.geometry || f.geometry.type !== "Point") return null;
  const c = f.geometry.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

const NAME_KEYS = ["name", "NAME", "Name", "title", "名稱", "站名", "場站名稱", "機關名稱"];
/** 盡量取一個可讀名稱。 */
export function nameOf(props: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = props[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** count：回總數 + 首筆的可用欄位（讓 LLM 知道能 groupBy / filter 哪些欄位）。 */
export function countDataset(features: GeoFeature[]): {
  total: number;
  availableFields: string[];
} {
  const availableFields = features[0] ? Object.keys(features[0].properties ?? {}) : [];
  return { total: features.length, availableFields };
}

// ── 教學性工具回饋（FX-5）──
// 查 0 筆 / 欄位不存在時，回可用欄位 + 樣本值 + 建議下一步，讓 LLM 能自我修正
// 而不是放棄。抽樣上限 SAMPLE_SIZE 筆，避免大資料集拖慢。

const SAMPLE_SIZE = 200;
const SAMPLE_VALUES_PER_FIELD = 3;

/** 抽前 SAMPLE_SIZE 筆，算每個欄位的前 SAMPLE_VALUES_PER_FIELD 個 distinct 值。 */
function sampleFieldValues(features: GeoFeature[]): Record<string, string[]> {
  const seen = new Map<string, Set<string>>();
  for (const f of features.slice(0, SAMPLE_SIZE)) {
    for (const [k, v] of Object.entries(f.properties ?? {})) {
      if (v === null || v === undefined || v === "") continue;
      let set = seen.get(k);
      if (!set) {
        set = new Set();
        seen.set(k, set);
      }
      if (set.size < SAMPLE_VALUES_PER_FIELD) set.add(String(v));
    }
  }
  const result: Record<string, string[]> = {};
  for (const [k, set] of seen) result[k] = [...set];
  return result;
}

/** 可用欄位（首筆的欄位名）+ 各欄位樣本值，供查 0 筆 / 欄位不存在時附在回傳裡。 */
function fieldFeedback(features: GeoFeature[]) {
  return {
    availableFields: features[0] ? Object.keys(features[0].properties ?? {}) : [],
    fieldSamples: sampleFieldValues(features),
  };
}

/** 欄位是否存在於資料集（只要有一筆帶這個 key 就算存在）。 */
function fieldExists(features: GeoFeature[], field: string): boolean {
  return features.some((f) => field in (f.properties ?? {}));
}

/** groupBy：依欄位分組計數，由多到少排序。欄位不存在時回 availableFields + 樣本值 + hint 讓 LLM 改用。 */
export function groupByField(features: GeoFeature[], field: string) {
  const counts = new Map<string, number>();
  let missing = 0;
  for (const f of features) {
    const props = f.properties ?? {};
    if (!(field in props)) missing++;
    const raw = props[field];
    const key = raw === null || raw === undefined || raw === "" ? "(未填)" : String(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (missing === features.length && features[0]) {
    return {
      field,
      error: `欄位「${field}」不存在`,
      hint: "欄位不存在，可用欄位見 availableFields，或改用 filterContains 模糊比對地址/名稱類欄位",
      ...fieldFeedback(features),
    };
  }
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
  return { field, distinct: groups.length, total: features.length, groups: capToolResult(groups) };
}

/** filterEq：欄位 == 值 的筆數 + 前 N 筆樣本（name + 座標）。0 筆或欄位不存在時回可用欄位 + 樣本值 + hint。 */
export function filterEqField(features: GeoFeature[], field: string, value: string) {
  if (features.length && !fieldExists(features, field)) {
    return {
      field,
      value,
      matched: 0,
      error: `欄位「${field}」不存在`,
      hint: "欄位不存在，可用欄位見 availableFields，或改用 filterContains 模糊比對",
      ...fieldFeedback(features),
    };
  }
  const matched = features.filter((f) => String((f.properties ?? {})[field]) === String(value));
  if (matched.length === 0) {
    return {
      field,
      value,
      matched: 0,
      hint: "欄位或值可能不對，可改用 groupBy 探索值域，或用 filterContains 模糊比對",
      ...fieldFeedback(features),
    };
  }
  const sample = matched.map((f) => {
    const pt = pointOf(f);
    return { name: nameOf(f.properties ?? {}), lng: pt?.[0], lat: pt?.[1] };
  });
  return { field, value, matched: matched.length, sample: capToolResult(sample) };
}

/** filterContains：欄位值（轉字串）包含 value 的筆數 + 前 N 筆樣本，不分大小寫。0 筆或欄位不存在時同 filterEq 回饋。 */
export function filterContainsField(features: GeoFeature[], field: string, value: string) {
  if (features.length && !fieldExists(features, field)) {
    return {
      field,
      value,
      matched: 0,
      error: `欄位「${field}」不存在`,
      hint: "欄位不存在，可用欄位見 availableFields，或改用 groupBy 探索值域",
      ...fieldFeedback(features),
    };
  }
  const needle = value.toLowerCase();
  const matched = features.filter((f) => {
    const raw = (f.properties ?? {})[field];
    return raw !== null && raw !== undefined && String(raw).toLowerCase().includes(needle);
  });
  if (matched.length === 0) {
    return {
      field,
      value,
      matched: 0,
      hint: "值可能不對，可改用 groupBy 探索值域",
      ...fieldFeedback(features),
    };
  }
  const sample = matched.map((f) => {
    const pt = pointOf(f);
    return { name: nameOf(f.properties ?? {}), lng: pt?.[0], lat: pt?.[1] };
  });
  return { field, value, matched: matched.length, sample: capToolResult(sample) };
}

/** Haversine 距離（km）。 */
export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** nearest：離 (lng,lat) 最近的 k 個點，回距離 km（由近到遠）。 */
export function nearestPoints(features: GeoFeature[], lng: number, lat: number, k: number) {
  const scored: { name: string; lng: number; lat: number; distanceKm: number }[] = [];
  for (const f of features) {
    const pt = pointOf(f);
    if (!pt) continue;
    scored.push({
      name: nameOf(f.properties ?? {}),
      lng: pt[0],
      lat: pt[1],
      distanceKm: Math.round(haversineKm(lng, lat, pt[0], pt[1]) * 100) / 100,
    });
  }
  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const top = scored.slice(0, Math.max(1, k));
  return { origin: { lng, lat }, k, points: capToolResult(top, { maxItems: k }) };
}
