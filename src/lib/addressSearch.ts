/**
 * 側欄門牌搜尋（地址搜尋第二階段）的純函式：正規化、解析、分片查詢。
 *
 * 正規化與解析規則必須和建置腳本一字不差：tw-address-geocoder
 * `src/tw_geocoder/search_index.py`。兩邊共用 fixture
 * `src/lib/__tests__/fixtures/addressParseCases.json`（由建置腳本 `--emit-fixture` 產生）。
 *
 * 只查索引裡有的門牌；找不到就是找不到，不內插、不猜座標。
 */

const CN_DIGITS: Record<string, number> = {
  零: 0, 〇: 0, "○": 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const CN_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_CHARS = "零〇○一二兩三四五六七八九十百千";

export function cnToInt(s: string): number | null {
  if (!s) return null;
  const chars = [...s];
  if (!chars.some((ch) => ch in CN_UNITS)) {
    let out = "";
    for (const ch of chars) {
      if (!(ch in CN_DIGITS)) return null;
      out += String(CN_DIGITS[ch]);
    }
    return Number.parseInt(out, 10);
  }
  let total = 0;
  let current = 0;
  for (const ch of chars) {
    const digit = CN_DIGITS[ch];
    const unit = CN_UNITS[ch];
    if (digit !== undefined) current = digit;
    else if (unit !== undefined) { total += (current || 1) * unit; current = 0; }
    else return null;
  }
  return total + current;
}

const CN_BEFORE = new RegExp(`[${CN_CHARS}]+(?=[段巷弄號之鄰])`, "g");
const CN_AFTER_ZHI = new RegExp(`(?<=之)[${CN_CHARS}]+`, "g");
const cnSub = (m: string) => { const n = cnToInt(m); return n == null ? m : String(n); };

/** 查詢與建置共用的字串正規化（NFKC、臺→台、去空白、段巷弄號之前的中文數字、「-」→之、去前導 0） */
export function normalizeAddressText(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(CN_BEFORE, cnSub)
    .replace(CN_AFTER_ZHI, cnSub)
    .replace(/(?<=\d)[-‐–—─~](?=\d)/g, "之")
    .replace(/(?<!\d)0+(?=\d)/g, "");
}

const REST_RE = /(?:(?:\d+|[^\d路街段道巷弄號之]{1,3})巷)?(?:\d+弄)?\d+(?:之\d+)*號$/;
const REST_PARTIAL_RE = /(?:(?:\d+|[^\d路街段道巷弄號之]{1,3})巷)?(?:\d+弄)?(?:\d+(?:之\d*)*號?)?$/;

export interface AddressGazetteer {
  /** county key（台北市）→ 顯示名（臺北市），依索引原順序 */
  counties: Map<string, string>;
  /** county key → (town key → 顯示名) */
  towns: Map<string, Map<string, string>>;
  /** `${county}|${town}` → village keys */
  villages: Map<string, Set<string>>;
}

export interface GazetteerRow { name: string; kind: string; parent: string }

export function buildAddressGazetteer(rows: readonly GazetteerRow[]): AddressGazetteer {
  const counties = new Map<string, string>();
  const towns = new Map<string, Map<string, string>>();
  const villages = new Map<string, Set<string>>();
  for (const r of rows) if (r.kind === "county") counties.set(normalizeAddressText(r.name), r.name);
  for (const r of rows) {
    if (r.kind !== "town") continue;
    const ck = normalizeAddressText(r.parent);
    if (!towns.has(ck)) towns.set(ck, new Map());
    towns.get(ck)!.set(normalizeAddressText(r.name), r.name);
  }
  for (const r of rows) {
    if (r.kind !== "village") continue;
    const p = normalizeAddressText(r.parent);
    for (const ck of counties.keys()) {
      const rest = p.slice(ck.length);
      if (p.startsWith(ck) && towns.get(ck)?.has(rest)) {
        const key = `${ck}|${rest}`;
        if (!villages.has(key)) villages.set(key, new Set());
        villages.get(key)!.add(normalizeAddressText(r.name));
        break;
      }
    }
  }
  return { counties, towns, villages };
}

export interface ParsedAddress {
  county: string | null;
  town: string | null;
  road: string;
  rest: string;
  complete: boolean;
}

const byLenDesc = (a: string, b: string) => b.length - a.length;

function stripVillage(g: AddressGazetteer, county: string | null, town: string | null, s: string): [string, string | null] {
  let village: string | null = null;
  if (county && town) {
    const vs = [...(g.villages.get(`${county}|${town}`) ?? [])].sort(byLenDesc);
    for (const v of vs) {
      if (!s.startsWith(v)) continue;
      const next = s.slice(v.length);
      if (next && "路街道段".includes(next.charAt(0))) continue;
      village = v;
      s = next;
      break;
    }
  }
  return [s.replace(/^\d+鄰/, ""), village];
}

export function parseAddress(
  g: AddressGazetteer, text: string, hints: { county?: string | null; town?: string | null } = {},
): ParsedAddress {
  let s = normalizeAddressText(text)
    .replace(/^\d{3,6}/, "")
    .replace(/(嘉義|基隆|新竹)市\1市/, "$1市")
    .replace(/^台灣省?|^台灣/, "")
    .replace(/\([^)]*\)?/g, "")
    .replace(/(\d+(?:之\d+)*)(?:[、,;]\d+(?:之\d+)*)+(?=號)/, "$1")
    .replace(/(?<=號).*$/, "");
  let county = hints.county ?? null;
  if (county == null) {
    const found = [...g.counties.keys()].sort(byLenDesc).find((ck) => s.startsWith(ck));
    if (found) { county = found; s = s.slice(found.length); }
    else {
      for (const ck of g.counties.keys()) {
        const short = ck.slice(0, -1);
        if (short.length < 2 || !s.startsWith(short)) continue;
        const after = s.slice(short.length);
        if ([...(g.towns.get(ck)?.keys() ?? [])].some((tk) => after.startsWith(tk))) { county = ck; s = after; break; }
      }
    }
  } else if (s.startsWith(county)) s = s.slice(county.length);
  let town = hints.town ?? null;
  if (town == null && county) {
    const found = [...(g.towns.get(county)?.keys() ?? [])].sort(byLenDesc).find((tk) => s.startsWith(tk));
    if (found) { town = found; s = s.slice(found.length); }
  } else if (town && s.startsWith(town)) s = s.slice(town.length);
  const [stripped, village] = stripVillage(g, county, town, s);
  s = stripped;
  let road: string;
  let rest: string;
  let complete: boolean;
  const m = REST_RE.exec(s);
  if (m) { road = s.slice(0, m.index); rest = m[0]; complete = true; }
  else {
    const m2 = REST_PARTIAL_RE.exec(s);
    const start = m2 && m2[0] ? m2.index : s.length;
    road = s.slice(0, start); rest = s.slice(start); complete = false;
  }
  if (!road && village) road = village;
  return { county, town, road, rest, complete };
}

/** 輸入像門牌（含路／街／段／巷／弄／號／大道）才去查門牌分片 */
export function looksLikeAddress(text: string): boolean {
  return /[路街段巷弄號]|大道/.test(normalizeAddressText(text));
}

// ── 分片 ─────────────────────────────────────────────────────────────

export type AddressSourceKind = "gov" | "osm";

export interface AddressCountySource {
  kind: AddressSourceKind;
  provider: string;
  dataset: string;
  dataset_version?: string | null;
  dataset_url?: string;
  data_date: string;
  year?: number;
  license: { name: string; url: string; attribution?: string; copyright_url?: string };
  precision: string;
}

export interface AddressManifest {
  version: 1;
  coord_scale: number;
  counties: Record<string, {
    name: string;
    source: AddressCountySource;
    towns: Record<string, { file: string; rows: number; bytes: number; sha256: string }>;
  }>;
  roads: { file: string };
}

export interface AddressRoadsFile { v: 1; counties: Record<string, Record<string, string[]>> }

/** [門牌鍵, lng×scale, lat×scale]；站主版多一欄來源標記 */
export type AddressRow = [string, number, number] | [string, number, number, string];

export interface AddressShardFile { v: 1; county: string; town: string; roads: Record<string, AddressRow[]> }
export interface AddressOwnerFile { v: 1; county: string; tags?: Record<string, string>; towns: Record<string, Record<string, AddressRow[]>> }

export interface IndexedRoad { display: string; rows: Map<string, AddressRow>; list: AddressRow[] }
/** 路名鍵 → 路 */
export type IndexedShard = Map<string, IndexedRoad>;

export function indexShardRoads(roads: Record<string, AddressRow[]>): IndexedShard {
  const out: IndexedShard = new Map();
  for (const [display, list] of Object.entries(roads)) {
    const key = normalizeAddressText(display);
    const existing = out.get(key);
    const road: IndexedRoad = existing ?? { display, rows: new Map(), list: [] };
    for (const row of list) {
      if (!road.rows.has(row[0])) { road.rows.set(row[0], row); road.list.push(row); }
    }
    out.set(key, road);
  }
  return out;
}

export type AddressHitSource = "gov" | "osm" | "owner";

export interface AddressHit {
  kind: "address" | "road";
  /** 顯示名：縣市區＋路＋門牌 */
  label: string;
  countyCode: string;
  county: string;
  town: string;
  center: [number, number];
  bbox?: [number, number, number, number];
  source: AddressHitSource;
  /** 站主版的細分來源（t＝TGOS、b＝稅籍／公司） */
  ownerTag?: string;
}

export interface ShardRef {
  countyCode: string;
  county: string;
  town: string;
  source: AddressHitSource;
  shard: IndexedShard;
}

function pointOf(row: AddressRow, scale: number): [number, number] {
  return [row[1] / scale, row[2] / scale];
}

function bboxOf(rows: readonly AddressRow[], scale: number): [number, number, number, number] {
  let w = Infinity; let s = Infinity; let e = -Infinity; let n = -Infinity;
  for (const r of rows) {
    const [x, y] = pointOf(r, scale);
    if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
  }
  return [w, s, e, n];
}

/** 片內查詢：完整門牌先找完全相符，找不到給同號開頭的門牌；只有路名給路段範圍。 */
export function searchShard(ref: ShardRef, parsed: ParsedAddress, scale: number, limit: number): AddressHit[] {
  const { shard } = ref;
  const roadKey = parsed.road;
  if (!roadKey) return [];
  const exactRoad = shard.get(roadKey);
  const roads: IndexedRoad[] = exactRoad
    ? [exactRoad]
    : [...shard.entries()].filter(([k]) => k.startsWith(roadKey)).sort(([a], [b]) => a.length - b.length || a.localeCompare(b)).map(([, r]) => r);
  const hits: AddressHit[] = [];
  const base = { countyCode: ref.countyCode, county: ref.county, town: ref.town, source: ref.source };
  const label = (road: IndexedRoad, rest: string) => `${ref.county}${ref.town}${road.display}${rest}`;
  const addRow = (road: IndexedRoad, row: AddressRow) => hits.push({
    ...base, kind: "address", label: label(road, row[0]), center: pointOf(row, scale),
    ...(row.length > 3 ? { ownerTag: row[3] } : {}),
  });
  if (!parsed.rest) {
    for (const road of roads.slice(0, limit)) {
      if (!road.list.length) continue;
      const bbox = bboxOf(road.list, scale);
      hits.push({ ...base, kind: "road", label: label(road, ""), bbox, center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] });
    }
    return hits;
  }
  for (const road of roads) {
    if (parsed.complete) {
      const row = road.rows.get(parsed.rest);
      if (row) { addRow(road, row); continue; }
    }
    // 只打到一半（12、5巷）或完整門牌沒有：列出以它開頭的門牌（122號、122之1號…）
    const prefix = parsed.rest.replace(/號$/, "");
    for (const row of road.list) {
      if (hits.length >= limit) break;
      if (row[0].startsWith(prefix) && /^[號之巷弄\d]/.test(row[0].slice(prefix.length) || "號")) addRow(road, row);
    }
    if (hits.length >= limit) break;
  }
  return hits.slice(0, limit);
}

export interface ShardTarget { countyCode: string; townKey: string }

/**
 * 決定要抓哪些分片：
 * - 有縣市＋區：該區一片。
 * - 只有縣市：路名索引裡有這條路（或以它開頭）的區。
 * - 沒有縣市：先看開頭是不是某縣市的區名（中正區…，可能多個縣市）；都不是就用路名索引全台找。
 * 回傳候選與每個候選對應的解析結果（區名前綴時要用該縣市重新解析）。
 */
export function resolveShardTargets(
  g: AddressGazetteer, query: string, countyCodeByKey: ReadonlyMap<string, string>,
  roads: AddressRoadsFile | null, maxTargets: number,
): { targets: (ShardTarget & { parsed: ParsedAddress })[]; needsRoads: boolean } {
  const parsed = parseAddress(g, query);
  if (parsed.county && parsed.town) {
    const code = countyCodeByKey.get(parsed.county);
    return { targets: code ? [{ countyCode: code, townKey: parsed.town, parsed }] : [], needsRoads: false };
  }
  if (!parsed.county) {
    const s = normalizeAddressText(query).replace(/^\d{3,6}/, "");
    const byTown: (ShardTarget & { parsed: ParsedAddress })[] = [];
    for (const [ck, towns] of g.towns) {
      const code = countyCodeByKey.get(ck);
      if (!code) continue;
      const tk = [...towns.keys()].sort(byLenDesc).find((t) => s.startsWith(t));
      if (tk) byTown.push({ countyCode: code, townKey: tk, parsed: parseAddress(g, s, { county: ck, town: tk }) });
    }
    if (byTown.length) return { targets: byTown.slice(0, maxTargets), needsRoads: false };
  }
  if (!parsed.road) return { targets: [], needsRoads: false };
  if (!roads) return { targets: [], needsRoads: true };
  const targets: (ShardTarget & { parsed: ParsedAddress })[] = [];
  const exact: typeof targets = [];
  for (const [code, towns] of Object.entries(roads.counties)) {
    const countyName = [...countyCodeByKey].find(([, c]) => c === code)?.[0];
    if (!countyName || (parsed.county && parsed.county !== countyName)) continue;
    for (const [townName, list] of Object.entries(towns)) {
      const keys = list.map(normalizeAddressText);
      const townKey = normalizeAddressText(townName);
      const t = { countyCode: code, townKey, parsed: { ...parsed, county: countyName, town: townKey } };
      if (keys.includes(parsed.road)) exact.push(t);
      else if (keys.some((k) => k.startsWith(parsed.road))) targets.push(t);
    }
  }
  return { targets: [...exact, ...targets].slice(0, maxTargets), needsRoads: false };
}
