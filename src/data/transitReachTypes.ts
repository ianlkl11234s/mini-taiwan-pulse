/**
 * 交通可及性（理想規則，G28 P5）共用常數、型別與純函式。
 * 原型：taipei-gis-analytics pipelines/analysis/transit_reach/viewer/{reach,grid}.html；
 * 口徑：docs/topic-research/transit_reach/_status.md。資料走公開模擬資料家族（`simBundle.ts`，slug＝transit_reach）。
 */
import type { SimBundleManifest } from "./simBundleTypes";

export const TRANSIT_REACH_SLUG = "transit_reach";
export const TRANSIT_REACH_GRID_KEY = "transitReachGrid" as const;
export const TRANSIT_REACH_PLAYBACK_KEY = "transitReachPlayback" as const;
export const TRANSIT_REACH_CLOCK_ID = "transitReachPlayback";
/** 起點連動選單 provider id（`state/transitReachOriginSelect.ts` 註冊） */
export const TRANSIT_REACH_ORIGIN_PROVIDER = "transitReachOrigin";
/** 代表色：viridis 中段 */
export const TRANSIT_REACH_COLOR = "#21918c";

/** 時間軸上限（分）＝預算上限 720 分 */
export const TRANSIT_REACH_T_MAX_MIN = 720;
/** Uint16 未到／未涵蓋（不是 0） */
export const TRANSIT_REACH_NA = 0xffff;
/** 比較模式：提早至少這麼多分鐘才算「多出」（同原型 GAIN_MIN） */
export const TRANSIT_REACH_GAIN_MIN = 10;
/** 前緣：剛到 30 分內較亮（同原型 FRONT） */
export const TRANSIT_REACH_FRONT_MIN = 30;

/** viridis 10 色（原型 reach.html／grid.html 同一組；map-layers F-3 指定 viridis） */
export const TRANSIT_REACH_VIRIDIS = ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"] as const;
/** 比較模式：其餘＝藍、多出＝橘（同原型 COL_TRA／COL_GAIN） */
export const TRANSIT_REACH_COMPARE_COLORS = { base: "#64aaff", gain: "#ff9800" } as const;
/** 航班、船班虛線（同原型 COL_AIR／COL_SHIP） */
export const TRANSIT_REACH_ROUTE_COLORS = { air: "#a78bfa", ship: "#22c55e" } as const;
/** 未涵蓋（網格）：中性灰，不當 0 */
export const TRANSIT_REACH_UNCOVERED_COLOR = "#9ca3af";

export const TRANSIT_REACH_SPEEDS = ["free", "peak"] as const;
export type TransitReachSpeed = (typeof TRANSIT_REACH_SPEEDS)[number];
export const TRANSIT_REACH_SPEED_LABELS: Record<TransitReachSpeed, string> = { free: "自由車流", peak: "尖峰（推估）" };

// ══════════════════════════════════════════════════════════════════
//  (a) 網格可及性
// ══════════════════════════════════════════════════════════════════

export const TRANSIT_REACH_GRID_METRICS = ["pop1h", "pop2h", "pop3h", "thub", "avg"] as const;
export type TransitReachGridMetric = (typeof TRANSIT_REACH_GRID_METRICS)[number];
export const TRANSIT_REACH_GRID_METRIC_LABELS: Record<TransitReachGridMetric, string> = {
  pop1h: "1 小時內可達人口",
  pop2h: "2 小時內可達人口",
  pop3h: "3 小時內可達人口",
  thub: "到最近大都市主站",
  avg: "人口加權平均旅行時間",
};
/** 版本：全運具／純開車／增益（全運具相對純開車） */
export const TRANSIT_REACH_GRID_VIEWS = ["abs", "drv", "gain"] as const;
export type TransitReachGridView = (typeof TRANSIT_REACH_GRID_VIEWS)[number];
export const TRANSIT_REACH_GRID_VIEW_LABELS: Record<TransitReachGridView, string> = {
  abs: "全運具",
  drv: "純開車",
  gain: "增益（全運具比純開車）",
};

export interface TransitReachGridData {
  res: number;
  ids: string[];
  pop: number[];
  /** townNames 索引；-1＝無 */
  town: number[];
  hubs: string[];
  townNames: string[];
  combos: string[];
  keys: string[];
  /** v[combo][key][i]；combo＝all_free|all_peak|drv_free|drv_peak；負值＝未涵蓋 */
  v: Record<string, Record<string, number[]>>;
}

export const isTimeMetric = (metric: TransitReachGridMetric) => metric === "thub" || metric === "avg";

/** 某格某指標的值；null＝未涵蓋（照原型 grid.html value()） */
export function gridValue(grid: TransitReachGridData, i: number, metric: TransitReachGridMetric, view: TransitReachGridView, speed: TransitReachSpeed): number | null {
  const a = grid.v[`all_${speed}`]?.[metric]?.[i];
  const b = grid.v[`drv_${speed}`]?.[metric]?.[i];
  const bad = (x: number | undefined): x is undefined => x === undefined || x === null || !Number.isFinite(x) || x < 0; // 所有指標：負值＝未涵蓋（人口也一樣）
  if (view === "abs") return bad(a) ? null : a;
  if (view === "drv") return bad(b) ? null : b;
  if (bad(a) || bad(b)) return null;
  return isTimeMetric(metric) ? b - a : a - b; // 時間：少了幾分；人口：多出的可達人口
}

/** 屬性名（GeoJSON properties；切指標只改 paint 的 `get`） */
export const gridPropName = (metric: TransitReachGridMetric, view: TransitReachGridView, speed: TransitReachSpeed) => `${metric}_${view}_${speed}`;

/** 原型 makeBreaks（bundle 沒附斷點時的退路）：人口＝分位數 9 階；到主站＝2 小時內每 15 分、之後每 30 分；其餘時間＝每 15 分 */
export function computeGridBreaks(values: readonly number[], metric: TransitReachGridMetric, view: TransitReachGridView): number[] {
  const s = [...values].sort((x, y) => x - y);
  if (!s.length) return [];
  const mx = s[s.length - 1]!;
  if (!isTimeMetric(metric)) {
    const b: number[] = [];
    for (let k = 1; k < 9; k++) { const v = s[Math.floor((k / 9) * (s.length - 1))]!; if (!b.length || v > b[b.length - 1]!) b.push(v); }
    return b;
  }
  const b: number[] = [];
  if (metric === "thub" && view !== "gain") {
    for (let v = 15; v < mx && v <= 120; v += 15) b.push(v);
    for (let v = 150; v < mx; v += 30) b.push(v);
    return b;
  }
  for (let v = 15 * Math.ceil(Math.max(0, s[0]!) / 15 + 1e-9); v < mx; v += 15) b.push(v);
  return b;
}

/** bundle.json layers[reach_grid].breaks 的鍵：`<metric>|<speed>|<abs|drv|gain>` */
export function bundleGridBreaks(manifest: SimBundleManifest | null | undefined, metric: TransitReachGridMetric, view: TransitReachGridView, speed: TransitReachSpeed): number[] | null {
  const layer = manifest?.layers?.find((l) => l.id === "reach_grid") as { breaks?: Record<string, { breaks?: unknown }> } | undefined;
  const entry = layer?.breaks?.[`${metric}|${speed}|${view}`];
  const b = entry?.breaks;
  return Array.isArray(b) && b.every((x) => typeof x === "number" && Number.isFinite(x)) ? (b as number[]) : null;
}

/** viridis 取色（f 0–1，線性內插） */
export function viridisAt(f: number): string {
  const ramp = TRANSIT_REACH_VIRIDIS;
  const p = Math.max(0, Math.min(1, f)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(p));
  const t = p - i;
  const h = (c: string) => [1, 3, 5].map((k) => parseInt(c.substr(k, 2), 16));
  const a = h(ramp[i]!), b = h(ramp[i + 1]!);
  return `#${a.map((x, k) => Math.round(x + (b[k]! - x) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** n 階的顏色（由低到高）；時間類絕對值反轉＝越短越亮（同原型 colorOf） */
export function gridClassColors(nClasses: number, metric: TransitReachGridMetric, view: TransitReachGridView): string[] {
  const reverse = isTimeMetric(metric) && view !== "gain";
  return Array.from({ length: nClasses }, (_, k) => {
    const f = nClasses > 1 ? k / (nClasses - 1) : 0;
    return viridisAt(reverse ? 1 - f : f);
  });
}

// ══════════════════════════════════════════════════════════════════
//  (b) 單一起點播放
// ══════════════════════════════════════════════════════════════════

export const TRANSIT_REACH_MODES = ["all", "tra_thsr_drive", "tra_drive", "drive_only", "cmp_air", "cmp_thsr"] as const;
export type TransitReachMode = (typeof TRANSIT_REACH_MODES)[number];
export type TransitReachOdMode = "tra_drive" | "tra_thsr_drive" | "all" | "drive_only";
export const TRANSIT_REACH_MODE_LABELS: Record<TransitReachMode, string> = {
  all: "全運具（鐵道＋航班＋船班＋開車）",
  tra_thsr_drive: "台鐵＋高鐵＋開車",
  tra_drive: "台鐵＋開車",
  drive_only: "純開車",
  cmp_air: "比較：航班／船班多出",
  cmp_thsr: "比較：高鐵多出",
};
export const isCompareMode = (mode: TransitReachMode) => mode === "cmp_air" || mode === "cmp_thsr";

/** 主檔與比較基準檔（比較：橘＝主檔比基準提早 ≥10 分） */
export function modeFiles(mode: TransitReachMode): { main: TransitReachOdMode; base: TransitReachOdMode | null } {
  if (mode === "cmp_air") return { main: "all", base: "tra_thsr_drive" };
  if (mode === "cmp_thsr") return { main: "tra_thsr_drive", base: "tra_drive" };
  return { main: mode, base: null };
}

export const TRANSIT_REACH_RANGES = ["auto", "fixed"] as const;
export type TransitReachRange = (typeof TRANSIT_REACH_RANGES)[number];
export const TRANSIT_REACH_RANGE_LABELS: Record<TransitReachRange, string> = { auto: "依起點自動", fixed: "固定 0–8 小時" };
export const TRANSIT_REACH_FIXED_RANGE_H = 8;

export interface TransitReachOrigin {
  id: string;
  /** 檔名用 key（例 tra_1000） */
  key: string;
  name: string;
  name_en?: string;
  county?: string;
  mode: "tra" | "thsr" | string;
  lng: number;
  lat: number;
  modes_available: TransitReachOdMode[];
}

export interface TransitReachCells {
  res: number;
  ids: string[];
  /** 0 本島路網；1 無路網（>1 km）；2 離島路網 */
  u: number[];
}

export interface TransitReachRoute {
  kind: "air" | "ship";
  from: string;
  to: string;
  from_xy: [number, number];
  to_xy: [number, number];
  minutes: number;
  minutes_basis?: string;
  weekly_each_way_avg?: number | null;
  weekly_each_way?: number | null;
  weekly_basis?: string;
}

/** origins.json 正規化（-3 版欄位是 `modes`、沒有 county／name_en） */
export function normalizeOrigins(raw: unknown): TransitReachOrigin[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o): TransitReachOrigin[] => {
    const r = o as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.key !== "string" || typeof r.name !== "string" || !Number.isFinite(r.lng) || !Number.isFinite(r.lat)) return [];
    const modes = (Array.isArray(r.modes_available) ? r.modes_available : Array.isArray(r.modes) ? r.modes : []) as TransitReachOdMode[];
    return [{
      id: r.id, key: r.key, name: r.name, mode: String(r.mode ?? ""), lng: r.lng as number, lat: r.lat as number, modes_available: modes,
      ...(typeof r.name_en === "string" && r.name_en ? { name_en: r.name_en } : {}),
      ...(typeof r.county === "string" && r.county ? { county: r.county } : {}),
    }];
  });
}

/** 起點檔路徑（bundle.json layers[reach_time].file 的樣板；沒給就用預設） */
export function odPath(manifest: SimBundleManifest | null | undefined, speed: TransitReachSpeed, mode: TransitReachOdMode, originKey: string): string {
  const layer = manifest?.layers?.find((l) => l.id === "reach_time") as { file?: unknown } | undefined;
  const template = typeof layer?.file === "string" ? layer.file : "od/{speed}/{mode}/{origin}.u16";
  return template.replace("{speed}", speed).replace("{mode}", mode).replace("{origin}", originKey);
}

/** 分階：前 2 小時每 15 分一階，之後每 30 分一階（bundle classification.step_formula） */
export const stepOf = (t: number) => (t < 120 ? Math.floor(t / 15) : 8 + Math.floor((t - 120) / 30));
/** 色階範圍 H 小時的階數 */
export const nStepsFor = (hours: number) => 8 + Math.ceil((hours * 60 - 120) / 30);
/** 整點 h 在階序上的位置（圖例刻度） */
export const stepIdxOfHour = (h: number) => (h <= 2 ? h * 4 : 8 + (h - 2) * 2);

/** 依起點自動範圍：有路網格最後到達時間無條件進位到整點，2–12 小時 */
export function autoRangeHours(maxReachedMin: number | null): number {
  if (maxReachedMin === null || !Number.isFinite(maxReachedMin)) return TRANSIT_REACH_FIXED_RANGE_H;
  return Math.max(2, Math.min(12, Math.ceil(maxReachedMin / 60)));
}

/** 有路網格（u≠1）中最晚到達的分鐘數；全部未到回 null */
export function maxReachedMinutes(times: Uint16Array, u: readonly number[]): number | null {
  let mx = -1;
  for (let i = 0; i < times.length; i++) {
    const v = times[i]!;
    if (v === TRANSIT_REACH_NA || u[i] === 1) continue;
    if (v > mx) mx = v;
  }
  return mx < 0 ? null : mx / 10;
}
