/**
 * 領土格原型：attributes.json 契約型別、載入、色階與 Mapbox 上色表達式。
 *
 * 契約（taipei-gis-analytics data/processed/analysis/tw_h3_grid/）：
 *   - 磚內每格屬性缺席＝未涵蓋／無資料；0＝確實是 0 → 上色一律先 `["has", key]`，絕不 coalesce 成 0。
 *   - 斷點全部從 attributes.json 的 stats[res] 讀，這裡不寫死任何資料數值；
 *     只有「比例 0–1」「分數 0–100」兩類依契約的值域線性切 5 階。
 */
import type { ExpressionSpecification } from "mapbox-gl";
import { withLoading } from "../lib/loadingRegistry";
import { STATISTICS_SEQUENTIAL_SCHEMES } from "../data/statisticsVisuals";
import { categoricalColor, categoricalNeutral } from "../map/mapStyleScale";
import { TERRITORY_TEXT } from "./territoryText";

// 一對資產一起換版（S3／R2 只寫不覆蓋）：資料重產時兩個檔名的日期一起改
export const TERRITORY_ATTRIBUTES_URL = "./geo/h3_territory/attributes_20261127.json";
export const TERRITORY_PMTILES_URL = "./geo/h3_territory/tw_h3_grid_20261127.pmtiles";
export const TERRITORY_SOURCE_LAYER = "cells";
export const TERRITORY_RESOLUTIONS = [7, 8, 9] as const;
export type TerritoryRes = (typeof TERRITORY_RESOLUTIONS)[number];

export type AttrKind = "count" | "length" | "ratio" | "median" | "mean" | "distance" | "village_value" | "category" | "score";

export interface AttrStats {
  non_null?: number;
  min?: number;
  max?: number;
  /** p10、p20、p50、p95… 有幾個用幾個 */
  [percentile: `p${number}`]: number | undefined;
}

export interface TerritoryAttribute {
  key: string;
  label: string;
  tag: string;
  kind: AttrKind;
  unit?: string;
  source?: string;
  source_date?: string;
  /** "全台"、縣市陣列，或一句說明文字（例 DEM 範圍） */
  coverage?: string | string[];
  rollup?: string;
  min_res?: number;
  formula?: string;
  note?: string;
  stats?: Partial<Record<string, AttrStats>>;
  /** 形狀契約未定：接受字串陣列或 { value|key, label?, count? } 物件陣列 */
  categories?: unknown;
}

export interface TerritoryAttributesFile {
  version?: string;
  generated_at?: string;
  cell_counts?: Record<string, number>;
  attributes: TerritoryAttribute[];
}

let attributesPromise: Promise<TerritoryAttributesFile> | null = null;

export function loadTerritoryAttributes(): Promise<TerritoryAttributesFile> {
  if (!attributesPromise) {
    attributesPromise = withLoading(
      "territory-attributes",
      TERRITORY_TEXT.loadingLabel,
      fetch(TERRITORY_ATTRIBUTES_URL).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TerritoryAttributesFile>;
      }),
    ).catch((err) => {
      attributesPromise = null; // 失敗可重試
      throw err;
    });
  }
  return attributesPromise;
}

// ── 色系 ──────────────────────────────────────────────────────────
// 單色系 5 階（ColorBrewer），沿用統計圖層已調好暗底版的 STATISTICS_SEQUENTIAL_SCHEMES，不另造色號（spec §3.16 資料色）。
type SchemeId = keyof typeof STATISTICS_SEQUENTIAL_SCHEMES;

const SCORE_SCHEME: Record<string, SchemeId> = {
  score_response: "health", // 綠：救得到
  score_wealth: "housing", // 橘金：財力
  score_convenience: "education", // 紫：便利
};

// ── 排名方式（全台／縣市內）────────────────────────────────────────
export type RankScope = "nation" | "county";
const CTY_SUFFIX = "_cty";
const baseScoreKey = (key: string) => key.endsWith(CTY_SUFFIX) ? key.slice(0, -CTY_SUFFIX.length) : key;
export const isScoreKey = (key: string) => baseScoreKey(key) in SCORE_SCHEME;
/** 標籤分數在該排名方式下的磚內欄名（縣市內＝score_*_cty） */
export const scoreFieldFor = (key: string, scope: RankScope) => scope === "county" && isScoreKey(key) ? `${key}${CTY_SUFFIX}` : key;

/** 不是屬性、是其他欄位的說明（例：房價中位數取自哪個解析度），面板與卡片不列 */
export const META_KEYS: ReadonlySet<string> = new Set(["sale_median_src_res"]);

/** 目前上色的屬性：縣市內排名時標籤分數換成 *_cty 欄（attributes.json 有就用它，沒有就沿用全台那筆的說明）、標題加「（縣市內）」 */
export function resolveActiveAttr(list: readonly TerritoryAttribute[], activeKey: string | null, scope: RankScope, countySuffix: string): TerritoryAttribute | null {
  if (!activeKey) return null;
  const base = list.find((a) => a.key === activeKey) ?? null;
  const field = scoreFieldFor(activeKey, scope);
  if (!base || field === activeKey) return base;
  const cty = list.find((a) => a.key === field);
  return { ...(cty ?? base), key: field, label: `${base.label}${countySuffix}` };
}

const TAG_SCHEME: Record<string, SchemeId> = {
  交通: "transport",
  生活機能: "education",
  應變: "health",
  房價: "housing",
  產業: "livestock",
  土地: "agriculture",
  人口: "population",
  地形: "forestry",
  標籤: "fallback",
};

export function rampFor(attr: TerritoryAttribute, isDark: boolean): readonly string[] {
  const scheme = STATISTICS_SEQUENTIAL_SCHEMES[SCORE_SCHEME[baseScoreKey(attr.key)] ?? TAG_SCHEME[attr.tag] ?? "fallback"];
  return isDark ? scheme.darkColors : shiftDeeper(scheme.colors);
}

/** 淡色底圖：最淺階（近白）和淡底圖對比太弱 → 五階各往下一階移 LIGHT_SHIFT（同一組色號內插，不另造色），最淺仍明顯淺於中間階 */
const LIGHT_SHIFT = 0.35;
function shiftDeeper(colors: readonly string[]): string[] {
  return colors.map((c, i) => mixHex(c, colors[Math.min(i + 1, colors.length - 1)]!, i < colors.length - 1 ? LIGHT_SHIFT : 0));
}
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, k) => Math.round(v + (y[k]! - v) * t).toString(16).padStart(2, "0")).join("");
}

/** 選中按鈕／能力條用的代表色（色階第 4 階，夠飽和又不沉進底圖） */
export function accentFor(attr: TerritoryAttribute | { key: string; tag: string }, isDark: boolean): string {
  const scheme = STATISTICS_SEQUENTIAL_SCHEMES[SCORE_SCHEME[baseScoreKey(attr.key)] ?? TAG_SCHEME[attr.tag] ?? "fallback"];
  const colors: readonly string[] = isDark ? scheme.darkColors : scheme.colors;
  return colors[Math.min(3, colors.length - 1)]!;
}

/** 灰格底（未上色、或該格沒有該屬性＝未涵蓋）：深淺底圖各一組，細邊＋低透明度 */
export const GRID_BASE = {
  dark: { fill: "#9ca3af", fillOpacity: 0.07, line: "#9ca3af", lineOpacity: 0.28 },
  light: { fill: "#6b7280", fillOpacity: 0.06, line: "#4b5563", lineOpacity: 0.3 },
} as const;
export const gridBase = (isDark: boolean) => (isDark ? GRID_BASE.dark : GRID_BASE.light);

// ── 斷點 ──────────────────────────────────────────────────────────

export type ColorScale =
  | {
    type: "steps"; colors: string[]; breaksByRes: Partial<Record<TerritoryRes, number[]>>;
    /** 該解析度是「0 一階＋非零值對數分級」（零值極多、分位數全是 0 時） */
    zeroSplitRes: TerritoryRes[];
  }
  | { type: "categories"; entries: { value: string; label: string; color: string }[]; otherColor: string };

function percentileEntries(stats: AttrStats): [number, number][] {
  return Object.entries(stats)
    .filter(([k, v]) => /^p\d+$/.test(k) && typeof v === "number" && Number.isFinite(v))
    .map(([k, v]) => [Number(k.slice(1)), v as number] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

/** 嚴格遞增（step 表達式要求）：重複或倒退的斷點丟掉，級數跟著變少 */
function strictlyAscending(values: number[]): number[] {
  const out: number[] = [];
  for (const v of values) if (Number.isFinite(v) && (out.length === 0 || v > out[out.length - 1]!)) out.push(v);
  return out;
}

/**
 * 分位數斷點（個數／長度／距離／中位數／村里值）。
 * 理想：stats 有 p20/p40/p60/p80 → 直接用。契約目前只保證 min/p50/p95/max →
 * 退而用 [min~p50 中點, p50, p50~p95 中點, p95]（皆由 stats 推得，不寫死數值）。
 */
export function quantileBreaks(stats: AttrStats | undefined): number[] {
  if (!stats) return [];
  return insideRange(rawQuantileBreaks(stats), stats.min, stats.max);
}

/** 零值極多時第一個斷點（「>0」）；個數類直接用 1 */
export const ZERO_SPLIT_EPS = 1e-9;

/**
 * 零值極多（p20…p80 全是 0）時分位數切不出級距：改成「0 一階＋非零值依對數分 4 階」。
 * 非零下界：個數類 1、其他連續值 max/1000；上界 max。全部由 stats 推得。
 */
export function zeroSplitBreaks(stats: AttrStats | undefined, kind: AttrKind): number[] | null {
  if (!stats || stats.min !== 0 || !(typeof stats.max === "number" && stats.max > 0)) return null;
  if (quantileBreaks(stats).length >= 2) return null;
  const max = stats.max;
  const integer = kind === "count";
  const lo = integer ? 1 : max / 1000;
  if (lo >= max) return integer ? [] : null;
  const geo = [1, 2, 3].map((i) => lo * (max / lo) ** (i / 4)).map((v) => (integer ? Math.ceil(v) : Number(v.toPrecision(2))));
  return strictlyAscending([integer ? 1 : ZERO_SPLIT_EPS, ...geo]).filter((b) => b < max);
}

/**
 * 斷點等於最小值（零值很多時 min＝p50＝0 常見）會讓「確實是 0」的格子跳過最淺一階、圖例印出「0 0 …」；
 * 等於最大值同理。只留 min < b < max 的斷點。
 */
function insideRange(breaks: number[], min: number | undefined, max: number | undefined): number[] {
  return breaks.filter((b) => (min === undefined || b > min) && (max === undefined || b < max));
}

function rawQuantileBreaks(stats: AttrStats): number[] {
  const ps = percentileEntries(stats);
  const wanted = [20, 40, 60, 80];
  const exact = wanted.map((p) => ps.find(([q]) => q === p)?.[1]);
  if (exact.every((v) => v !== undefined)) return strictlyAscending(exact as number[]);
  const p50 = ps.find(([q]) => q === 50)?.[1];
  const p95 = ps.find(([q]) => q === 95)?.[1];
  const min = stats.min;
  if (p50 === undefined || p95 === undefined || min === undefined) return strictlyAscending(ps.map(([, v]) => v));
  return strictlyAscending([(min + p50) / 2, p50, (p50 + p95) / 2, p95]);
}

const LINEAR_5 = (lo: number, hi: number) => [1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 5);

function normaliseCategories(raw: unknown): { value: string; label: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { value: string; label: string; count: number }[] = [];
  for (const item of raw) {
    if (typeof item === "string" || typeof item === "number") out.push({ value: String(item), label: String(item), count: 0 });
    else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const value = o.value ?? o.key ?? o.code ?? o.label;
      if (value === undefined || value === null) continue;
      // count 可能是數字或 {"9":n,"8":n,"7":n}（契約 v0）：物件取最細一級排序
      const rawCount = o.count ?? o.n ?? 0;
      const count = rawCount && typeof rawCount === "object"
        ? Number((rawCount as Record<string, unknown>)["9"] ?? Object.values(rawCount as Record<string, unknown>)[0] ?? 0)
        : Number(rawCount);
      out.push({ value: String(value), label: String(o.label ?? o.name ?? value), count: Number.isFinite(count) ? count : 0 });
    }
  }
  // 有 count 就由多到少排，取前 8 色；沒 count 保留檔案順序
  return out.some((c) => c.count > 0) ? [...out].sort((a, b) => b.count - a.count) : out;
}

export function buildColorScale(attr: TerritoryAttribute, isDark: boolean): ColorScale {
  if (attr.kind === "category") {
    const cats = normaliseCategories(attr.categories).slice(0, 8);
    return {
      type: "categories",
      entries: cats.map((c, i) => ({ value: c.value, label: c.label, color: categoricalColor(i, isDark) })),
      otherColor: categoricalNeutral(isDark),
    };
  }
  const colors = [...rampFor(attr, isDark)];
  const breaksByRes: Partial<Record<TerritoryRes, number[]>> = {};
  const zeroSplitRes: TerritoryRes[] = [];
  for (const res of TERRITORY_RESOLUTIONS) {
    if (attr.kind === "ratio") breaksByRes[res] = LINEAR_5(0, 1);
    else if (attr.kind === "score") breaksByRes[res] = LINEAR_5(0, 100);
    else {
      const stats = attr.stats?.[String(res)];
      if (!stats) continue;
      const zero = zeroSplitBreaks(stats, attr.kind);
      if (zero) { breaksByRes[res] = zero; zeroSplitRes.push(res); }
      else breaksByRes[res] = quantileBreaks(stats);
    }
  }
  return { type: "steps", colors, breaksByRes, zeroSplitRes };
}

/** 斷點 n 個 → 用色 n+1 階；從 5 階中平均取，保留最淺與最深 */
export function colorsForBreaks(colors: readonly string[], nBreaks: number): string[] {
  const n = nBreaks + 1;
  if (n >= colors.length) return [...colors];
  if (n <= 1) return [colors[Math.floor(colors.length / 2)]!];
  return Array.from({ length: n }, (_, i) => colors[Math.round((i * (colors.length - 1)) / (n - 1))]!);
}

function stepExpr(key: string, colors: readonly string[], breaks: number[]): ExpressionSpecification {
  const cs = colorsForBreaks(colors, breaks.length);
  if (breaks.length === 0) return cs[0]! as unknown as ExpressionSpecification;
  const expr: unknown[] = ["step", ["to-number", ["get", key]], cs[0]];
  breaks.forEach((b, i) => expr.push(b, cs[i + 1]));
  return expr as ExpressionSpecification;
}

/** fill-color：有該屬性才上色，缺席維持灰底（未涵蓋）；斷點依格子本身的 res 選 */
export function fillColorExpr(attr: TerritoryAttribute, scale: ColorScale, isDark: boolean): ExpressionSpecification {
  const gray = gridBase(isDark).fill;
  if (scale.type === "categories") {
    const match: unknown[] = ["match", ["to-string", ["get", attr.key]]];
    for (const e of scale.entries) match.push(e.value, e.color);
    match.push(scale.otherColor);
    const colored = scale.entries.length ? match : scale.otherColor;
    return ["case", ["has", attr.key], colored, gray] as unknown as ExpressionSpecification;
  }
  const byRes: unknown[] = ["match", ["to-number", ["get", "res"]]];
  let fallback: ExpressionSpecification | null = null;
  for (const res of TERRITORY_RESOLUTIONS) {
    const breaks = scale.breaksByRes[res];
    if (!breaks) continue;
    const e = stepExpr(attr.key, scale.colors, breaks);
    byRes.push(res, e);
    fallback = e;
  }
  if (!fallback) return gray as unknown as ExpressionSpecification; // 三個解析度都沒 stats：整層灰
  byRes.push(fallback);
  return ["case", ["has", attr.key], byRes, gray] as unknown as ExpressionSpecification;
}

/** fill-opacity：有值＝滑桿值（各階一致，圖例色塊即地圖實色；最淺一階不再調淡，免得和灰底／未涵蓋混淆）；未涵蓋＝灰底透明度 */
export function fillOpacityExpr(attr: TerritoryAttribute | null, opacity: number, isDark: boolean): ExpressionSpecification | number {
  const base = gridBase(isDark).fillOpacity;
  if (!attr) return base;
  return ["case", ["has", attr.key], opacity, base] as unknown as ExpressionSpecification;
}

/** 退路用：此 PMTiles source 實測以 round(zoom) 取磚（z8.5 已是 res8 磚），不是 floor */
export function zoomToRes(zoom: number): TerritoryRes {
  const z = Math.round(zoom);
  if (z <= 8) return 7;
  if (z <= 10) return 8;
  return 9;
}

// ── 數值顯示 ──────────────────────────────────────────────────────

/** 契約的 unit 欄給人看的版本：值域說明（0–1、0–100）不當單位；括號內換算說明拿掉；m → 公尺 */
export function displayUnit(attr: TerritoryAttribute): string {
  const u = (attr.unit ?? "").replace(/（.*$/, "").trim();
  if (!u || u === "0–1" || u === "0–100" || u === "%" || u === "比例") return "";
  return u === "m" ? "公尺" : u === "km" ? "公里" : u;
}

/** 0–1 的比例（kind ratio，或村里值單位寫 0–1）以百分比顯示 */
export function isFraction(attr: TerritoryAttribute): boolean {
  return attr.kind === "ratio" || attr.unit === "0–1";
}

/** 這個屬性在這個解析度是否有資料（min_res＝最細可用級；更細的級磚內沒有該欄） */
export function availableAtRes(attr: TerritoryAttribute, res: number): boolean {
  if (attr.min_res !== undefined && Number.isFinite(res) && res > attr.min_res) return false;
  return attr.kind === "ratio" || attr.kind === "score" || attr.kind === "category" || !!attr.stats?.[String(res)] || !attr.stats;
}

export function formatAttrValue(attr: TerritoryAttribute, raw: unknown, formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (attr.kind === "category") return categoryLabel(attr, raw);
  const v = Number(raw);
  if (!Number.isFinite(v)) return String(raw);
  if (isFraction(attr)) return `${formatNumber(v * 100, { maximumFractionDigits: 1 })}%`;
  const unit = displayUnit(attr);
  if (unit === "公尺" && Math.abs(v) >= 1000) return `${formatNumber(v / 1000, { maximumFractionDigits: 1 })} 公里`;
  const abs = Math.abs(v);
  const digits = attr.kind === "score" || (attr.kind === "count" && Number.isInteger(v)) ? 0 : abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const num = formatNumber(v, { maximumFractionDigits: digits });
  return unit ? `${num} ${unit}` : num;
}

export function categoryLabel(attr: TerritoryAttribute, raw: unknown): string {
  const value = String(raw);
  return normaliseCategories(attr.categories).find((c) => c.value === value)?.label ?? value;
}

const ALL_COUNTIES = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"];

/** 涵蓋範圍白話：全台→null；縣市清單多於一半→「不含 X」；說明文字照原文 */
export function coverageText(attr: TerritoryAttribute): string | null {
  const cov = attr.coverage;
  if (!cov || cov === "全台") return null;
  if (typeof cov === "string") return cov;
  if (!cov.length) return null;
  if (cov.length > ALL_COUNTIES.length / 2) {
    const missing = ALL_COUNTIES.filter((c) => !cov.includes(c));
    return missing.length ? `全台（不含${missing.join("、")}）` : null;
  }
  return cov.join("、");
}
