/**
 * 雙北大眾運輸可及性（G28，taipei-gis-analytics transit_access P1＋P2）共用常數、型別與純函式。
 * 原型：taipei-gis-analytics pipelines/analysis/transit_access/viewer/{p1,p2}.html；
 * 口徑：docs/topic-research/transit_access/{_status,p2,p3}.md。資料走公開模擬資料家族（`simBundle.ts`，slug＝transit_access）。
 *
 * 分級（最近據點時間的分階、三級分區門檻、比較差值）都在前端算，bundle 只放原始分位數、據點數與開車時間；
 * 預設門檻與分階讀 bundle.json layers[access_grid].classification，沒有才用本檔的退路常數（與原型 p2.html 相同）。
 */
import type { SimBundleManifest } from "./simBundleTypes";

export const TRANSIT_ACCESS_SLUG = "transit_access";
export const TRANSIT_ACCESS_GRID_KEY = "transitAccessGrid" as const;
export const TRANSIT_ACCESS_PLAYBACK_KEY = "transitAccessPlayback" as const;
export const TRANSIT_ACCESS_CLOCK_ID = "transitAccessPlayback";
/** 代表色：viridis 綠段（與全台交通可及性的中段區隔） */
export const TRANSIT_ACCESS_COLOR = "#35b779";
/** uint8 分鐘：不可達（網格 120 分、單起點 240 分內到不了；不是 0） */
export const TRANSIT_ACCESS_NA = 255;
export const TRANSIT_ACCESS_NA16 = 0xffff;
/** 到不了（不是缺資料）：同全台交通可及性的中性灰 */
export const TRANSIT_ACCESS_UNREACHED_COLOR = "#9ca3af";

/** viridis 10 色（同 transitReach；map-layers F-3） */
export const VIRIDIS = ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"] as const;
/** magma 7 色（原型 p2.html 等車不確定／深夜比例；暗→亮） */
export const MAGMA = ["#37106c", "#5a167e", "#7e2482", "#a4317e", "#ca3e72", "#e95561", "#f9795d"] as const;
/** PuOr 7 色（spec §5.40 S-4 雙向差異；負＝橘、正＝紫） */
export const PUOR = ["#b35806", "#e08214", "#fdb863", "#d8daeb", "#b2abd2", "#8073ac", "#542788"] as const;
export const PUOR_NEG = [PUOR[0], PUOR[1], PUOR[2]] as const;
export const PUOR_POS = [PUOR[4], PUOR[5], PUOR[6]] as const;
/** 三級分區：序位三階取自 viridis（可行最亮）；規格沒有對應類別色，見 p4_pulse.md 規格缺口 */
export const TIER_COLORS = { ok: "#fde725", edge: "#21918c", dep: "#440154" } as const;
export type TransitAccessTier = keyof typeof TIER_COLORS;
export const TIERS: readonly TransitAccessTier[] = ["ok", "edge", "dep"];

// ══════════════════════════════════════════════════════════════════
//  控制項選項
// ══════════════════════════════════════════════════════════════════

export const TRANSIT_ACCESS_GROUPS = ["hospital", "supermarket", "school", "school_e", "school_j", "school_s", "finance"] as const;
export type TransitAccessGroup = (typeof TRANSIT_ACCESS_GROUPS)[number];
export const TRANSIT_ACCESS_GROUP_LABELS: Record<TransitAccessGroup, string> = {
  hospital: "醫院", supermarket: "超市（中大型）", school: "學校（任一學段）", school_e: "國小", school_j: "國中", school_s: "高中職", finance: "金融（分行＋郵局）",
};

export const TRANSIT_ACCESS_SLOTS = ["wkdy_peak", "wkdy_off", "wkdy_night", "sat", "sun"] as const;
export type TransitAccessSlot = (typeof TRANSIT_ACCESS_SLOTS)[number];
export const TRANSIT_ACCESS_SLOT_LABELS: Record<TransitAccessSlot, string> = {
  wkdy_peak: "平日尖峰", wkdy_off: "平日離峰", wkdy_night: "平日深夜", sat: "週六", sun: "週日",
};

export const TRANSIT_ACCESS_NETWORKS = ["scheduled", "observed", "cmp"] as const;
export type TransitAccessNetwork = (typeof TRANSIT_ACCESS_NETWORKS)[number];
export const TRANSIT_ACCESS_NETWORK_LABELS: Record<TransitAccessNetwork, string> = {
  scheduled: "公車表定", observed: "公車 GPS 實際行駛", cmp: "比較：GPS−表定",
};

export const TRANSIT_ACCESS_METRICS = ["near", "count", "spread", "ratio", "tier", "night"] as const;
export type TransitAccessMetric = (typeof TRANSIT_ACCESS_METRICS)[number];
export const TRANSIT_ACCESS_METRIC_LABELS: Record<TransitAccessMetric, string> = {
  near: "到最近據點時間", count: "時間內可達據點數", spread: "等車不確定（P95−P5）", ratio: "大眾運輸÷開車", tier: "三級分區", night: "時間內可達比例",
};
/** 比較模式支援的指標；其餘指標在比較模式下改看最近據點時間差 */
export const COMPARE_METRICS: readonly TransitAccessMetric[] = ["near", "spread", "tier"];

export const GRID_PERCENTILES = ["5", "25", "50", "75", "95"] as const;
export type GridPercentile = (typeof GRID_PERCENTILES)[number];
export const GRID_PERCENTILE_LABELS: Record<GridPercentile, string> = { 5: "P5 運氣好", 25: "P25", 50: "P50 一般", 75: "P75", 95: "P95 運氣差" };
export const COUNT_THRESHOLDS = ["30", "45", "60"] as const;
export type CountThreshold = (typeof COUNT_THRESHOLDS)[number];
export const COUNT_THRESHOLD_LABELS: Record<CountThreshold, string> = { 30: "30 分內", 45: "45 分內", 60: "60 分內" };

export const SINGLE_PERCENTILES = ["5", "50", "95"] as const;
export type SinglePercentile = (typeof SINGLE_PERCENTILES)[number];

/** P1 的 8 個起點（bundle single/origins.json 同順序；選單選項須是靜態清單） */
export const TRANSIT_ACCESS_ORIGINS = ["taipei", "banqiao", "tamsui", "xizhi", "sanxia", "ankeng", "neihu", "dingpu"] as const;
export type TransitAccessOriginKey = (typeof TRANSIT_ACCESS_ORIGINS)[number];
export const TRANSIT_ACCESS_ORIGIN_LABELS: Record<TransitAccessOriginKey, string> = {
  taipei: "臺北車站", banqiao: "板橋車站", tamsui: "淡水捷運站", xizhi: "汐止火車站", sanxia: "三峽老街", ankeng: "新店安坑（達觀社區）", neihu: "內湖科學園區（港墘）", dingpu: "土城頂埔站",
};

// ══════════════════════════════════════════════════════════════════
//  分級（bundle classification；退路＝原型 p2.html）
// ══════════════════════════════════════════════════════════════════

export interface TransitAccessClassification {
  nearBreaks: number[];
  countBreaks: number[];
  spreadBreaks: number[];
  ratioBreaks: number[];
  defaultThresholds: Record<string, [number, number]>;
  defaultRatio: number;
  defaultOverhead: number;
  peakFactor: number;
  compareTol: number;
}

export const DEFAULT_CLASSIFICATION: TransitAccessClassification = {
  nearBreaks: [5, 10, 15, 20, 30, 45, 60, 90],
  countBreaks: [1, 2, 4, 6, 11, 21],
  spreadBreaks: [5, 10, 15, 20, 30, 45],
  ratioBreaks: [1, 1.5, 2, 2.5, 3, 4],
  defaultThresholds: { hospital: [30, 60], supermarket: [15, 30], school: [15, 30], school_e: [15, 30], school_j: [20, 40], school_s: [30, 60], finance: [20, 40] },
  defaultRatio: 3,
  defaultOverhead: 5,
  peakFactor: 0.78,
  compareTol: 5,
};

const numArr = (x: unknown): number[] | null => (Array.isArray(x) && x.length > 0 && x.every((v) => typeof v === "number" && Number.isFinite(v)) ? x as number[] : null);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** bundle.json layers[access_grid].classification → 分級設定（欄位缺就用退路） */
export function gridClassification(manifest: SimBundleManifest | null | undefined): TransitAccessClassification {
  const layer = manifest?.layers?.find((l) => l.id === "access_grid") as { classification?: Record<string, unknown> } | undefined;
  const c = layer?.classification ?? {};
  const tier = (c.tier ?? {}) as Record<string, unknown>;
  const cmp = (c.compare ?? {}) as Record<string, unknown>;
  const d = DEFAULT_CLASSIFICATION;
  const th: Record<string, [number, number]> = { ...d.defaultThresholds };
  const raw = tier.default_thresholds;
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const a = numArr(v); if (a && a.length === 2) th[k] = [a[0]!, a[1]!];
  }
  return {
    nearBreaks: numArr(c.near_breaks) ?? d.nearBreaks,
    countBreaks: numArr(c.count_breaks) ?? d.countBreaks,
    spreadBreaks: numArr(c.spread_breaks) ?? d.spreadBreaks,
    ratioBreaks: numArr(c.ratio_breaks) ?? d.ratioBreaks,
    defaultThresholds: th,
    defaultRatio: num(tier.default_ratio) ?? d.defaultRatio,
    defaultOverhead: num(tier.default_car_overhead_min) ?? d.defaultOverhead,
    peakFactor: num(tier.peak_factor) ?? d.peakFactor,
    compareTol: num(cmp.tol_min) ?? d.compareTol,
  };
}

/** 面板滑桿值（0＝依類別預設）→ 實際三級門檻 */
export interface TierSettings { a: number; b: number; r: number; overhead: number; peak: boolean }
export function resolveTierSettings(
  cls: TransitAccessClassification, group: TransitAccessGroup,
  raw: { a: number; b: number; r: number; overhead: number; peak: boolean },
): TierSettings {
  const [da, db] = cls.defaultThresholds[group] ?? [30, 60];
  const a = raw.a > 0 ? raw.a : da;
  const b = raw.b > 0 ? raw.b : db;
  return { a, b: Math.max(a, b), r: raw.r > 0 ? raw.r : cls.defaultRatio, overhead: Math.max(0, raw.overhead), peak: raw.peak };
}

/** 開車基準（分）：自由車流÷係數（尖峰）＋附加時間；null＝開車也到不了 */
export function carMinutes(carRaw: number, s: TierSettings, cls: TransitAccessClassification): number | null {
  if (carRaw === TRANSIT_ACCESS_NA) return null;
  return carRaw / (s.peak ? cls.peakFactor : 1) + s.overhead;
}

/** 三級分區（同 p2.html tierAt）：t＝所選分位數的最近據點時間（NA＝到不了） */
export function tierOf(t: number, carRaw: number, s: TierSettings, cls: TransitAccessClassification): TransitAccessTier {
  if (t === TRANSIT_ACCESS_NA) return "dep";
  if (t <= s.a) return "ok";
  if (t > s.b) return "dep";
  const car = carMinutes(carRaw, s, cls);
  if (car !== null && car > 0 && t / car > s.r) return "dep";
  return "edge";
}

/** 深夜（任一時段）T 分內可達比例的區間索引 0..5（<5%、5–25%、25–50%、50–75%、75–95%、≥95%）；ps 依 P5..P95 */
export function nightBucket(ps: readonly number[], T: number): number {
  for (let k = ps.length - 1; k >= 0; k--) { const v = ps[k]!; if (v !== TRANSIT_ACCESS_NA && v <= T) return k + 1; }
  return 0;
}
export const NIGHT_BUCKET_LABELS = ["<5%", "5–25%", "25–50%", "50–75%", "75–95%", "≥95%"] as const;

/** 分階索引（v ≥ breaks[k] 的個數） */
export const binOf = (v: number, breaks: readonly number[]) => { let k = 0; while (k < breaks.length && v >= breaks[k]!) k++; return k; };

/** 最近據點時間 9 階顏色：越短越亮（同全台交通可及性時間類） */
export const nearColors = (n: number) => Array.from({ length: n }, (_, k) => VIRIDIS[Math.round((1 - k / Math.max(1, n - 1)) * 9)]!);
/** 據點數 7 階（0、1、2–3…）：0＝灰，越多越亮 */
export const countColors = (n: number) => Array.from({ length: n }, (_, k) => (k === 0 ? TRANSIT_ACCESS_UNREACHED_COLOR : VIRIDIS[Math.round((k / Math.max(1, n - 1)) * 9)]!));
/** 等車不確定 7 階：越大越亮（magma） */
export const spreadColors = (n: number) => Array.from({ length: n }, (_, k) => MAGMA[Math.round((k / Math.max(1, n - 1)) * 6)]!);
/** 深夜比例 6 階：比例越高越亮 */
export const NIGHT_COLORS = [MAGMA[0], MAGMA[1], MAGMA[2], MAGMA[3], MAGMA[4], MAGMA[6]] as const;

// ══════════════════════════════════════════════════════════════════
//  資料
// ══════════════════════════════════════════════════════════════════

export interface TransitAccessCells { h3: string[]; pop: number[]; town: number[]; towns: string[] }
export interface TransitAccessFacilities { lng: number[]; lat: number[]; outside: number[]; names: Record<string, string[][]> }
export interface TransitAccessSlotData { near: Uint8Array; count: Uint16Array; arg: Uint16Array }
export interface TransitAccessOrigin { key: string; name: string; lng: number; lat: number }

export interface TransitAccessGridMeta {
  groups: string[];
  percentiles: number[];
  thresholds: number[];
  done: Set<string>;
  maxMin: number;
}

export function gridMeta(manifest: SimBundleManifest | null | undefined): TransitAccessGridMeta {
  const layer = (manifest?.layers?.find((l) => l.id === "access_grid") ?? {}) as Record<string, unknown>;
  const groups = Array.isArray(layer.groups) ? (layer.groups as Array<{ key?: unknown }>).map((g) => String(g.key)) : [...TRANSIT_ACCESS_GROUPS];
  return {
    groups,
    percentiles: numArr(layer.percentiles) ?? [5, 25, 50, 75, 95],
    thresholds: numArr(layer.thresholds) ?? [30, 45, 60],
    done: new Set(Array.isArray(layer.done) ? (layer.done as unknown[]).map(String) : []),
    maxMin: num(layer.max_min) ?? 120,
  };
}

export function singleDone(manifest: SimBundleManifest | null | undefined): Set<string> {
  const layer = (manifest?.layers?.find((l) => l.id === "access_single") ?? {}) as Record<string, unknown>;
  return new Set(Array.isArray(layer.done) ? (layer.done as unknown[]).map(String) : []);
}

/** 檔名樣板（bundle layers[].files／file）；沒給用預設 */
export function gridFilePath(manifest: SimBundleManifest | null | undefined, kind: "near" | "count" | "arg", network: string, slot: string): string {
  const layer = manifest?.layers?.find((l) => l.id === "access_grid") as { files?: Record<string, unknown> } | undefined;
  const tpl = typeof layer?.files?.[kind] === "string" ? layer.files[kind] as string : `grid/{network}/{slot}/${kind === "near" ? "near.u8" : `${kind}.u16`}`;
  return tpl.replace("{network}", network).replace("{slot}", slot);
}
export function singleFilePath(manifest: SimBundleManifest | null | undefined, network: string, slot: string, origin: string): string {
  const layer = manifest?.layers?.find((l) => l.id === "access_single") as { file?: unknown } | undefined;
  const tpl = typeof layer?.file === "string" ? layer.file : "single/{network}/{slot}/{origin}.u8";
  return tpl.replace("{network}", network).replace("{slot}", slot).replace("{origin}", origin);
}

/** 單起點 u8 [3][N]（P5、P50、P95）取出一個分位數，轉成 transitReach 自訂圖層吃的 Uint16（0.1 分；0xFFFF 未到） */
export function singleSlice(bytes: Uint8Array, n: number, pct: SinglePercentile): Uint16Array {
  const k = SINGLE_PERCENTILES.indexOf(pct);
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) { const v = bytes[k * n + i]!; out[i] = v === TRANSIT_ACCESS_NA ? TRANSIT_ACCESS_NA16 : v * 10; }
  return out;
}

/** 字串是否為允許值之一（popup 讀點擊快照用；不合法回 null） */
export function oneOfOrNull<T extends string>(v: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(v) ? v as T : null;
}
