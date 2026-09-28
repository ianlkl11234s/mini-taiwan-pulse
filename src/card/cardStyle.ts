/**
 * 卡片的配色、界線處理與日期格式（純函式，無 DOM／MapLibre 依賴，可在 node 測試）。
 *
 * 配色：一律取 `vizSpec`（viz-spec.json）的暗色組。級距數 = breaks.length + 1，
 * 與 mcp `resultStyle.ts` 的 `rampColors` 同一套取色規則，所以卡片顏色與主站地圖一致。
 */
import { categoricalFor, nullHatchFor, rampFor, VIZ_SPEC } from "../research/vizSpec";
import type { VizNumberKind } from "../research/vizFormat";
import type { CardAreaMap, CardPayloadV1, CardValueKind } from "./cardPayload";

export const CARD_THEME = "dark" as const;
const FALLBACK_RAMP = "viridis";

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** 與 mcp `rampColors`（src/warehouse/resultStyle.ts）相同：少於色階數時等距取樣，多於時線性內插。 */
export function rampColors(ramp: readonly string[], count: number): string[] {
  if (count <= 1) return [ramp[ramp.length - 1]!];
  if (count <= ramp.length) return Array.from({ length: count }, (_, index) => ramp[Math.round(index * (ramp.length - 1) / (count - 1))]!);
  return Array.from({ length: count }, (_, index) => {
    const position = index * (ramp.length - 1) / (count - 1);
    const lower = Math.floor(position);
    const upper = Math.min(ramp.length - 1, lower + 1);
    const [r1, g1, b1] = hexToRgb(ramp[lower]!);
    const [r2, g2, b2] = hexToRgb(ramp[upper]!);
    const t = position - lower;
    return `#${[r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t].map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  });
}

/** 未知色階名稱退回 viridis（不 throw：收件人的卡片不該因色階改名而整頁壞掉）。 */
export function cardRamp(name: string | null | undefined): string[] {
  const key = name && VIZ_SPEC.ramps[name] ? name : FALLBACK_RAMP;
  return rampFor(key, CARD_THEME);
}

export function classColors(ramp: string | null | undefined, breaks: readonly number[]): string[] {
  return rampColors(cardRamp(ramp), breaks.length + 1);
}

/** class_index → 顏色；null 或超出範圍 → null（由呼叫端畫缺值斜線或灰色）。 */
export function colorForClass(colors: readonly string[], classIndex: number | null): string | null {
  return classIndex === null || classIndex < 0 || classIndex >= colors.length ? null : colors[classIndex]!;
}

export function cardOtherColor(): string { return categoricalFor(CARD_THEME).other; }
export function cardNullStroke(): string { return nullHatchFor(CARD_THEME).stroke; }
export function cardSurface(): string { return VIZ_SPEC.surfaces[CARD_THEME]; }
export function cardRing(): string { return VIZ_SPEC.ring[CARD_THEME]; }

/** 卡片 value_kind → 共用數字格式種類（currency／number 沒有專屬規則，取最保守的寫法）。 */
export function vizKindForCard(kind: CardValueKind | undefined): VizNumberKind {
  if (kind === "count" || kind === "currency") return "count";
  if (kind === "percent") return "percent";
  return "ratio";
}

export function legendMethodLabel(method: CardPayloadV1["legend"]["method"]): string {
  return method === "quantile" ? "分位數分級" : method === "equal" ? "等距分級" : "類別";
}

/** 台灣時間 YYYY-MM-DD（到期日、產生日一律 Asia/Taipei）。無效輸入回 null。 */
export function taipeiDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
}

export function taipeiDateTime(iso: string | null | undefined): string | null {
  const date = taipeiDate(iso);
  if (!date || !iso) return null;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(Date.parse(iso)));
  return `${date} ${time}`;
}

// ── 界線 ────────────────────────────────────────────────────────────────────

type GeoFeature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> | null };
export type CardAreaFeature = { type: "Feature"; geometry: unknown; properties: { area_code: string; area_name: string | null; class_index: number | null; fill: string | null; label: string | null } };

/** 統計 CDN 幾何缺省的代碼欄位是 `area_code`（statisticsGeometryCache 同一預設），其餘為常見別名。 */
const CODE_PROPERTIES = ["area_code", "COUNTYCODE", "TOWNCODE", "行政區域代碼", "code"];
const NAME_PROPERTIES = ["area_name", "名稱", "COUNTYNAME", "TOWNNAME", "name"];

function pickProperty(features: readonly GeoFeature[], preferred: string | null, candidates: readonly string[], wanted?: ReadonlySet<string>): string | null {
  const ordered = preferred ? [preferred, ...candidates.filter(name => name !== preferred)] : candidates;
  for (const name of ordered) {
    const hits = features.filter(feature => {
      const value = feature.properties?.[name];
      return value !== undefined && value !== null && (!wanted || wanted.has(String(value)));
    }).length;
    if (hits > 0) return name;
  }
  return null;
}

function nameOf(properties: Record<string, unknown> | null, nameProperty: string | null): string | null {
  if (!properties || !nameProperty) return null;
  const value = properties[nameProperty];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * 從完整界線檔挑出 payload.areas 列到的區域並上色；標籤只給前 5 名（E2 K0：只標名稱）。
 *
 * 優先以 top[].code 對應界線代碼欄位；沒有 code（舊卡片）才退回名稱比對：
 * 鄉鎮名稱跨縣市會重複（例如兩個「中正區」），所以同名時以 class_index 相同者優先，
 * 仍有多個時全部標上（寧可多標，也不猜錯一個）。
 */
export function buildCardAreaFeatures(geojson: unknown, map: CardAreaMap, top: CardPayloadV1["top"]): CardAreaFeature[] {
  const collection = geojson as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new Error("CARD_GEOMETRY_SHAPE");
  const features = collection.features as GeoFeature[];
  const classes = new Map(map.areas.map(([code, index]) => [code, index]));
  const codeProperty = pickProperty(features, map.geometry.code_property ?? null, CODE_PROPERTIES, new Set(classes.keys()));
  if (!codeProperty) throw new Error("CARD_GEOMETRY_NO_CODES");
  const nameProperty = pickProperty(features, null, NAME_PROPERTIES);
  const colors = classColors(map.ramp, map.breaks);
  const picked = features.filter(feature => classes.has(String(feature.properties?.[codeProperty])));

  const labelled = new Set<GeoFeature>();
  for (const item of top.slice(0, 5)) {
    if (item.code) {
      for (const feature of picked) if (String(feature.properties?.[codeProperty]) === item.code) labelled.add(feature);
      continue;
    }
    const named = picked.filter(feature => {
      const name = nameOf(feature.properties, nameProperty);
      return name !== null && (name === item.name || item.name.endsWith(name));
    });
    const sameClass = named.filter(feature => classes.get(String(feature.properties?.[codeProperty])) === item.class_index);
    for (const feature of (sameClass.length ? sameClass : named)) labelled.add(feature);
  }

  return picked.map(feature => {
    const code = String(feature.properties?.[codeProperty]);
    const classIndex = classes.get(code) ?? null;
    const name = nameOf(feature.properties, nameProperty);
    return { type: "Feature", geometry: feature.geometry, properties: { area_code: code, area_name: name, class_index: classIndex, fill: colorForClass(colors, classIndex), label: labelled.has(feature) ? name : null } };
  });
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** 抓界線檔並驗內容雜湊（檔名＝雜湊，不符代表 CDN 內容被換掉）。失敗一律 throw，由地圖區顯示容錯訊息。 */
export async function loadCardGeometry(map: CardAreaMap, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<unknown> {
  const response = await fetchImpl(map.geometry.resource_url, { signal });
  if (!response.ok) throw new Error(`CARD_GEOMETRY_HTTP_${response.status}`);
  const bytes = await response.arrayBuffer();
  if (await sha256Hex(bytes) !== map.geometry.sha256) throw new Error("CARD_GEOMETRY_SHA256");
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** 直線距離圈（大圓近似），給 query_scope 畫虛線半徑用。 */
export function geodesicCircle(center: [number, number], radiusM: number, segments = 64): [number, number][] {
  const [lng, lat] = center;
  const earth = 6_371_008.8;
  const angular = radiusM / earth;
  const phi1 = lat * Math.PI / 180;
  const lambda1 = lng * Math.PI / 180;
  const ring: [number, number][] = [];
  for (let step = 0; step <= segments; step++) {
    const bearing = (step % segments) / segments * 2 * Math.PI;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angular) + Math.cos(phi1) * Math.sin(angular) * Math.cos(bearing));
    const lambda2 = lambda1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(phi1), Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2));
    ring.push([Math.round(lambda2 * 180 / Math.PI * 1e6) / 1e6, Math.round(phi2 * 180 / Math.PI * 1e6) / 1e6]);
  }
  return ring;
}

/** 地圖該框的範圍（[west, south, east, north]）；沒有座標可用時回 null（交給界線檔 bounds）。 */
export function pointBounds(payload: CardPayloadV1): [number, number, number, number] | null {
  const coords: [number, number][] = [...(payload.points?.items.map(item => item.lnglat) ?? [])];
  if (payload.query_scope) {
    const { center, radius_m } = payload.query_scope;
    if (radius_m) coords.push(...geodesicCircle(center, radius_m, 16)); else coords.push(center);
  }
  if (!coords.length) return null;
  const lngs = coords.map(coord => coord[0]);
  const lats = coords.map(coord => coord[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
