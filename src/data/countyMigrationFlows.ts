// 縣市間遷徙流向（twCountyMigrationFlows，台灣圖層延伸 B5 N11，2026-11-21）。
// 資料：src/data/countyMigrationOd.json（scripts/preprocess/build-county-migration-od.py 由 analytics county_migration_od 產生，lazy import）。
// 口徑：戶籍登記的跨縣市遷徙（內政部 data.gov.tw 168209，月檔加總成年），不含國外遷入遷出、初設戶籍、縣市內跨鄉鎮。
// 底色是統計層 statsCountyOdNetMigration（同一份 OD 加總，淨遷入＝流入弧線總和－流出弧線總和）。
import { withLoading } from "../lib/loadingRegistry";

export const COUNTY_MIGRATION_FLOWS_KEY = "twCountyMigrationFlows";
export const COUNTY_MIGRATION_DATASET_ID = "county_migration_od";
export const COUNTY_MIGRATION_SOURCE_URL = "https://data.gov.tw/dataset/168209";
export const COUNTY_MIGRATION_PUBLISHER = "內政部戶政司";
export const COUNTY_MIGRATION_LICENSE = "政府資料開放授權條款-第1版";

/** 年份選單（2026 年只有 1–10 月，本輪不出）。 */
export const COUNTY_MIGRATION_YEARS = ["2025", "2024"] as const;
export type CountyMigrationYear = typeof COUNTY_MIGRATION_YEARS[number];
export const COUNTY_MIGRATION_DEFAULT_YEAR: CountyMigrationYear = "2025";

/** 底色統計層（同一份 OD 加總）；流向層換年份時，開著的這幾層跟著換期別。 */
export const COUNTY_MIGRATION_BASE_KEYS = [
  "statsCountyOdNetMigration", "statsCountyOdNetMigrationRate", "statsCountyOdInMigration", "statsCountyOdOutMigration",
] as const;

/**
 * 弧線端點＝縣市政府所在地（依各縣市政府地址取的約略座標，誤差約數百公尺，只作端點示意）。
 * 不用面的幾何內點：臺北被新北包住、嘉義市／新竹市被同名縣包住，內點會讓最大的流向縮成一小段。
 * 2026-11-21 已用 COUNTY_MOI_1140318 檢查 22 點都落在自己縣市的主島內。
 */
export const COUNTY_SEATS: Readonly<Record<string, { lngLat: [number, number]; name: string }>> = {
  "63000": { lngLat: [121.5645, 25.0375], name: "臺北市" },
  "65000": { lngLat: [121.4652, 25.0120], name: "新北市" },
  "68000": { lngLat: [121.3010, 24.9932], name: "桃園市" },
  "66000": { lngLat: [120.6469, 24.1617], name: "臺中市" },
  "67000": { lngLat: [120.1850, 22.9920], name: "臺南市" },
  "64000": { lngLat: [120.3013, 22.6211], name: "高雄市" },
  "10002": { lngLat: [121.7532, 24.7302], name: "宜蘭縣" },
  "10004": { lngLat: [121.0045, 24.8270], name: "新竹縣" },
  "10005": { lngLat: [120.8205, 24.5650], name: "苗栗縣" },
  "10007": { lngLat: [120.5425, 24.0763], name: "彰化縣" },
  "10008": { lngLat: [120.6838, 23.9025], name: "南投縣" },
  "10009": { lngLat: [120.5274, 23.6995], name: "雲林縣" },
  "10010": { lngLat: [120.3330, 23.4590], name: "嘉義縣" },
  "10013": { lngLat: [120.4880, 22.6830], name: "屏東縣" },
  "10014": { lngLat: [121.1465, 22.7560], name: "臺東縣" },
  "10015": { lngLat: [121.6040, 23.9915], name: "花蓮縣" },
  "10016": { lngLat: [119.5665, 23.5655], name: "澎湖縣" },
  "10017": { lngLat: [121.7400, 25.1315], name: "基隆市" },
  "10018": { lngLat: [120.9690, 24.8065], name: "新竹市" },
  "10020": { lngLat: [120.4535, 23.4810], name: "嘉義市" },
  "09020": { lngLat: [118.3185, 24.4335], name: "金門縣" },
  "09007": { lngLat: [119.9500, 26.1580], name: "連江縣" },
};

/** 預設畫法：全國前 30 條 ∪ 每縣市最大遷出 1 條；點縣市：遷入、遷出各前 5；未滿 100 人不畫。 */
export const COUNTY_MIGRATION_TOP_K = 30;
export const COUNTY_MIGRATION_FOCUS_N = 5;
export const COUNTY_MIGRATION_MIN_PERSONS = 100;

/** 線寬分級（人）：<1,000／1,000–4,999／5,000–19,999／≥20,000。 */
export const COUNTY_MIGRATION_WIDTH_TIERS = [
  { min: COUNTY_MIGRATION_MIN_PERSONS, width: 1 },
  { min: 1000, width: 2 },
  { min: 5000, width: 3.5 },
  { min: 20000, width: 6 },
] as const;

/** 方向色：避開底色 PuOr（紫／棕）。預設（未選縣市）一色；選縣市時遷入青、遷出黃。 */
export const COUNTY_MIGRATION_COLORS = { flow: "#e2e8f0", in: "#22d3ee", out: "#facc15", seat: "#f8fafc", seatFocus: "#22d3ee" } as const;

/** [origin, dest, persons, male, female] */
export type CountyMigrationRow = readonly [string, string, number, number, number];
export interface CountyMigrationDocument { dataset_id: string; source: string; license: string; unit: string; years: Record<string, CountyMigrationRow[]> }

let docPromise: Promise<CountyMigrationDocument> | null = null;
export function loadCountyMigrationOd(): Promise<CountyMigrationDocument> {
  docPromise ??= withLoading(
    "county-migration-od", "縣市間遷徙流向載入中",
    import("./countyMigrationOd.json").then((m) => m.default as unknown as CountyMigrationDocument),
  ).catch((error: unknown) => { docPromise = null; throw error; });
  return docPromise;
}

export type CountyMigrationRole = "flow" | "in" | "out";
export interface SelectedFlow { row: CountyMigrationRow; role: CountyMigrationRole }

const drawable = (row: CountyMigrationRow) => row[2] >= COUNTY_MIGRATION_MIN_PERSONS && Boolean(COUNTY_SEATS[row[0]] && COUNTY_SEATS[row[1]]);
const byPersons = (a: CountyMigrationRow, b: CountyMigrationRow) => b[2] - a[2] || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]);

/** 未選縣市：全國前 K 條 ∪ 每個遷出縣市最大的 1 條（去重），都要 ≥100 人。 */
export function defaultCountyFlows(rows: readonly CountyMigrationRow[], topK = COUNTY_MIGRATION_TOP_K): SelectedFlow[] {
  const sorted = rows.filter(drawable).sort(byPersons);
  const picked = new Set<CountyMigrationRow>(sorted.slice(0, topK));
  const seenOrigin = new Set<string>();
  for (const row of sorted) {
    if (seenOrigin.has(row[0])) continue;
    seenOrigin.add(row[0]);
    picked.add(row);
  }
  return sorted.filter((row) => picked.has(row)).map((row) => ({ row, role: "flow" as const }));
}

/** 選縣市：該縣市遷入前 N、遷出前 N（各自 ≥100 人）。 */
export function focusCountyFlows(rows: readonly CountyMigrationRow[], code: string, n = COUNTY_MIGRATION_FOCUS_N): SelectedFlow[] {
  const sorted = rows.filter(drawable).sort(byPersons);
  const inbound = sorted.filter((row) => row[1] === code).slice(0, n).map((row) => ({ row, role: "in" as const }));
  const outbound = sorted.filter((row) => row[0] === code).slice(0, n).map((row) => ({ row, role: "out" as const }));
  return [...inbound, ...outbound];
}

export interface CountyMigrationTotals { inflow: number; outflow: number; net: number }
export function countyMigrationTotals(rows: readonly CountyMigrationRow[], code: string): CountyMigrationTotals {
  let inflow = 0; let outflow = 0;
  for (const row of rows) {
    if (row[1] === code) inflow += row[2];
    if (row[0] === code) outflow += row[2];
  }
  return { inflow, outflow, net: inflow - outflow };
}

/** 有資料但沒畫的組數（未滿門檻或不在前 N）。 */
export function hiddenFlowCount(rows: readonly CountyMigrationRow[], shown: number, code: string | null): number {
  const pool = code ? rows.filter((row) => row[0] === code || row[1] === code) : rows;
  return Math.max(0, pool.filter((row) => row[2] > 0).length - shown);
}

/**
 * 二次貝茲弧（33 點）：控制點往 from→to 的垂直方向偏 bend，A→B 與 B→A 自動彎向兩側不疊在一起。
 * 台灣尺度不跨換日線（同 globalEventAssociationArc 的公式，bend 調小）。
 */
export function quadraticArc(from: readonly [number, number], to: readonly [number, number], bend = 0.15): [number, number][] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const control = [(from[0] + to[0]) / 2 - dy * bend, (from[1] + to[1]) / 2 + dx * bend] as const;
  return Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    return [(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0] + t ** 2 * to[0],
      (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1] + t ** 2 * to[1]] as [number, number];
  });
}

export function countyFlowWidth(persons: number): number {
  let width: number = COUNTY_MIGRATION_WIDTH_TIERS[0].width;
  for (const tier of COUNTY_MIGRATION_WIDTH_TIERS) if (persons >= tier.min) width = tier.width;
  return width;
}

/** 弧線 GeoJSON：properties 給 popup（雙向人數、淨流向）與繪圖（role、寬度）。 */
export function countyFlowsGeoJSON(flows: readonly SelectedFlow[], rows: readonly CountyMigrationRow[], year: string): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const reverse = new Map(rows.map((row) => [`${row[0]}>${row[1]}`, row[2]]));
  return {
    type: "FeatureCollection",
    features: flows.map(({ row, role }) => {
      const [o, d, persons, male, female] = row;
      const back = reverse.get(`${d}>${o}`) ?? 0;
      return {
        type: "Feature",
        properties: {
          kind: "flow", role, year, o, d, o_name: COUNTY_SEATS[o]!.name, d_name: COUNTY_SEATS[d]!.name,
          persons, male, female, reverse: back, net: persons - back, w: countyFlowWidth(persons),
        },
        geometry: { type: "LineString", coordinates: quadraticArc(COUNTY_SEATS[o]!.lngLat, COUNTY_SEATS[d]!.lngLat) },
      };
    }),
  };
}

/** 端點（縣市政府所在地）：點選縣市的備援入口，popup 顯示該縣市當年合計。 */
export function countySeatsGeoJSON(rows: readonly CountyMigrationRow[], year: string, focus: string | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: Object.entries(COUNTY_SEATS).map(([code, seat]) => {
      const totals = countyMigrationTotals(rows, code);
      return {
        type: "Feature",
        properties: { kind: "seat", code, name: seat.name, year, focus: code === focus, inflow: totals.inflow, outflow: totals.outflow, net: totals.net },
        geometry: { type: "Point", coordinates: [...seat.lngLat] },
      };
    }),
  };
}

/** 統計底色期別（release_id 開頭 y2024-／y2025-）→ 年份。 */
export function countyMigrationYearOfRelease(releaseId: string | null | undefined): CountyMigrationYear | null {
  const year = /^y(\d{4})-/.exec(releaseId ?? "")?.[1];
  return (COUNTY_MIGRATION_YEARS as readonly string[]).includes(year ?? "") ? year as CountyMigrationYear : null;
}

// ── 選取縣市與目前畫面（hook 寫、圖例讀）────────────────────────────
export interface CountyMigrationView { year: string; focus: string | null; shown: number; hidden: number; totals: CountyMigrationTotals | null; loaded: boolean }
let view: CountyMigrationView = { year: COUNTY_MIGRATION_DEFAULT_YEAR, focus: null, shown: 0, hidden: 0, totals: null, loaded: false };
const viewListeners = new Set<() => void>();
export const countyMigrationViewStore = {
  get: () => view,
  set(next: Partial<CountyMigrationView>) {
    const merged = { ...view, ...next };
    if (Object.keys(merged).every((k) => merged[k as keyof CountyMigrationView] === view[k as keyof CountyMigrationView])) return;
    view = merged;
    viewListeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) { viewListeners.add(listener); return () => { viewListeners.delete(listener); }; },
};
