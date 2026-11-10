/**
 * 30 天地圖挑戰 Day 9「城鄉 Urban-rural」（模擬入口，公開，2026-11-09）：指標、色、級距的單一資料源，
 * overlayRegistry（paint）、圖例、說明框都從這裡 import（此檔被 layerManifest 引用，不可 import map/mapStyleScale）。
 *
 * 資料：public/mapchallenge/day09_urban_rural.geojson（scripts/preprocess/build-mapchallenge-day09.py 產製）
 * 368 鄉鎮，每個鄉鎮 q（0–4 人口密度五等份，低→高）、c_<key> 計數、r_<key>＝log2(該鄉鎮每萬人數／全國每萬人數)（計數 0 為 null）。
 * 數字與口徑正本：taipei-gis-analytics docs/topic-research/mapchallenge_2026_day09_urban_rural/THREADS_SOURCE.md。
 *
 * 配色（使用者 2026-11-09 選定方案 A「越亮越多」）：
 * - 人口密度五等份：深藍→淺綠白 5 色（Q1 最稀疏最暗）。
 * - 設施：log2 比值 7 階（切點 ±2／±1／±0.33），暗藍→亮黃；計數 0（鄉鎮內一個都沒有）另用中性灰，
 *   不落進「約等於全國平均」那一格（r 為 null 時 to-number 會變 0，所以先判計數）。
 */
export const MAPCHALLENGE_DAY09_URL = "./mapchallenge/day09_urban_rural.geojson";

/** sidebar 代表色（設施色階中段） */
export const MAPCHALLENGE_DAY09_COLOR = "#3b9c99";

/** 人口密度五等份色（Q1 最稀疏 → Q5 最密集） */
export const MAPCHALLENGE_DAY09_DENSITY_COLORS = ["#34406a", "#3f6f96", "#5fa3b8", "#a8d5cf", "#f1f5e8"] as const;
/** 各組密度範圍（人/km²，THREADS_SOURCE §4；腳本輸出已核對） */
export const MAPCHALLENGE_DAY09_DENSITY_RANGES = ["4–133", "137–387", "387–894", "904–2,837", "2,872–33,877"] as const;

/** 設施 log2 比值切點與 7 色（低 → 高） */
export const MAPCHALLENGE_DAY09_RATIO_CUTS = [-2, -1, -0.33, 0.33, 1, 2] as const;
export const MAPCHALLENGE_DAY09_RATIO_COLORS = ["#1d2a3a", "#22476b", "#286f8f", "#3b9c99", "#71c387", "#bddf6a", "#f7f38a"] as const;
/**
 * 暗底版（2026-11-10 使用者同意重開「維持 0.55」）：最低兩、三階原本是深藍黑，疊在暗陸上等於底圖；
 * 改成同色相、較亮的靛藍，仍是「越亮越多」，相鄰級 ΔE ≥ 8。上面三階（綠→黃）不變。淡底維持原色。
 */
export const MAPCHALLENGE_DAY09_RATIO_COLORS_DARK = ["#4a4f9c", "#3f6cb3", "#3290b8", "#45aea6", "#78c88a", "#bddf6a", "#f7f38a"] as const;
export const MAPCHALLENGE_DAY09_DENSITY_COLORS_DARK = ["#4a4f9c", "#3f78b0", "#5fa3b8", "#a8d5cf", "#f1f5e8"] as const;
export const mapchallengeDay09RatioColors = (isDark: boolean) => (isDark ? MAPCHALLENGE_DAY09_RATIO_COLORS_DARK : MAPCHALLENGE_DAY09_RATIO_COLORS);
export const mapchallengeDay09DensityColors = (isDark: boolean) => (isDark ? MAPCHALLENGE_DAY09_DENSITY_COLORS_DARK : MAPCHALLENGE_DAY09_DENSITY_COLORS);
/** 計數 0：中性灰（和最低階深藍黑分得開） */
export const MAPCHALLENGE_DAY09_ZERO_COLOR = "#6b7280";

export type MapchallengeDay09FacilityKey = "elem" | "police" | "post" | "hc" | "cram" | "clinic" | "pharm" | "bank" | "cvs";
export type MapchallengeDay09Group = "public" | "market" | "exception";
export type MapchallengeDay09Metric = "density" | MapchallengeDay09FacilityKey;

export interface MapchallengeDay09Facility {
  key: MapchallengeDay09FacilityKey;
  zh: string;
  group: MapchallengeDay09Group;
  /** 全國每萬人數（2026-08-31 戶籍人口 23,224,721；腳本輸出） */
  national: number;
  /** 全台總數 */
  total: number;
}

/** 順序＝popup 列順序（公共、市場、例外） */
export const MAPCHALLENGE_DAY09_FACILITIES: readonly MapchallengeDay09Facility[] = [
  { key: "elem", zh: "國小", group: "public", national: 1.13, total: 2614 },
  { key: "police", zh: "派出所／分駐所", group: "public", national: 0.66, total: 1540 },
  { key: "post", zh: "郵局", group: "public", national: 0.55, total: 1278 },
  { key: "hc", zh: "有健保門診的衛生所", group: "public", national: 0.18, total: 407 },
  { key: "cram", zh: "短期補習班", group: "market", national: 7.38, total: 17137 },
  { key: "clinic", zh: "診所", group: "market", national: 9.37, total: 21765 },
  { key: "pharm", zh: "藥局", group: "market", national: 3.31, total: 7680 },
  { key: "bank", zh: "銀行等金融分支", group: "market", national: 2.15, total: 4988 },
  { key: "cvs", zh: "超商（設 ATM 的門市）", group: "exception", national: 5.87, total: 13629 },
];

const GROUP_ZH: Record<MapchallengeDay09Group, string> = { public: "公共服務", market: "市場服務", exception: "例外" };

/** select 選項（順序＝encode 索引）；label 帶分組前綴 */
export const MAPCHALLENGE_DAY09_METRIC_OPTIONS: readonly { value: MapchallengeDay09Metric; label: string }[] = [
  { value: "density", label: "人口密度五等份" },
  ...MAPCHALLENGE_DAY09_FACILITIES.map((f) => ({ value: f.key, label: `${GROUP_ZH[f.group]}：${f.zh}` })),
];
export const MAPCHALLENGE_DAY09_METRIC_ENCODE = MAPCHALLENGE_DAY09_METRIC_OPTIONS.map((o) => o.value);
export const MAPCHALLENGE_DAY09_DEFAULT_METRIC: MapchallengeDay09Metric = "police";

export function mapchallengeDay09MetricAt(idx: number | undefined): MapchallengeDay09Metric {
  return MAPCHALLENGE_DAY09_METRIC_ENCODE[Math.trunc(idx ?? 1)] ?? MAPCHALLENGE_DAY09_DEFAULT_METRIC;
}

export function mapchallengeDay09MetricByKey(key: string | undefined): MapchallengeDay09Metric {
  return MAPCHALLENGE_DAY09_METRIC_ENCODE.find((m) => m === key) ?? MAPCHALLENGE_DAY09_DEFAULT_METRIC;
}

export function mapchallengeDay09Facility(key: MapchallengeDay09FacilityKey): MapchallengeDay09Facility {
  return MAPCHALLENGE_DAY09_FACILITIES.find((f) => f.key === key)!;
}

export function mapchallengeDay09DensityColorExpr(isDark = false): unknown[] {
  const c = mapchallengeDay09DensityColors(isDark);
  return ["match", ["to-number", ["get", "q"], 0], 0, c[0], 1, c[1], 2, c[2], 3, c[3], c[4]];
}

export function mapchallengeDay09RatioColorExpr(key: MapchallengeDay09FacilityKey, isDark = false): unknown[] {
  const colors = mapchallengeDay09RatioColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", `r_${key}`], 0], colors[0]];
  MAPCHALLENGE_DAY09_RATIO_CUTS.forEach((cut, i) => step.push(cut, colors[i + 1]));
  return ["case", ["<=", ["to-number", ["get", `c_${key}`], 0], 0], MAPCHALLENGE_DAY09_ZERO_COLOR, step];
}

export function mapchallengeDay09ColorExpr(metric: MapchallengeDay09Metric, isDark = false): unknown[] {
  return metric === "density" ? mapchallengeDay09DensityColorExpr(isDark) : mapchallengeDay09RatioColorExpr(metric, isDark);
}

/** 說明框標題色點：依目前指標算單一鄉鎮的顏色 */
export function mapchallengeDay09FeatureColor(metric: MapchallengeDay09Metric, props: Record<string, unknown>, isDark = false): string {
  if (metric === "density") return mapchallengeDay09DensityColors(isDark)[Math.min(4, Math.max(0, Number(props.q) || 0))]!;
  if (!(Number(props[`c_${metric}`]) > 0)) return MAPCHALLENGE_DAY09_ZERO_COLOR;
  const r = Number(props[`r_${metric}`]);
  const i = MAPCHALLENGE_DAY09_RATIO_CUTS.filter((cut) => r >= cut).length;
  return mapchallengeDay09RatioColors(isDark)[i]!;
}
