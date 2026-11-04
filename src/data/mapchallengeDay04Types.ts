/**
 * 30 天地圖挑戰 Day 4「群聚 Clusters」（模擬入口，2026-11-04）：色、級距、熱區類別、重疊率的單一資料源，
 * overlayRegistry（paint）、圖例、說明框三邊都從這裡 import。
 *
 * 資料：public/mapchallenge/day04_clusters_r7.geojson（H3 r7，只含人口密度 ≥100 人/km² 的 2,773 格）、
 * day04_clusters_r8_tc_ch.geojson（H3 r8，臺中市＋彰化縣 2,652 格，只有工廠欄位）。
 * 產製：taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day04_clusters。
 *
 * 配色（map-layers.md §3.3 F-3 分析結果、§3.4 G-3 網格）：
 * - 人口密度：magma 5 級（暗底越密越亮、淡底越密越深，照色盤庫方向）。
 * - 設施群聚：每種設施一組色盤（使用者 2026-11-04 要求：切換設施時一眼看得出是哪一類），7 階以
 *   `resampleRamp` 取 5 級。六組是暗底最高階兩兩 CIE76 ΔE 最大的組合（最小 19.8，次高階 21.2）；
 *   色盤庫的暗底最高階都收斂到淡黃白，到不了 20，圖例色塊改用第 4 階（兩兩距離較大）。
 * - 熱區重疊：四類固定色（不是序列色），0「都不是」用低透明灰當參考底。
 */
import { paletteRamp, resampleRamp, type PaletteId } from "../map/palettes";

export const MAPCHALLENGE_DAY04_R7_URL = "./mapchallenge/day04_clusters_r7.geojson";
export const MAPCHALLENGE_DAY04_R8_URL = "./mapchallenge/day04_clusters_r8_tc_ch.geojson";

/** sidebar 代表色（magma 中段） */
export const MAPCHALLENGE_DAY04_COLOR = "#e24d66";

export const MAPCHALLENGE_DAY04_LEVELS = 5;

/** 數量 0／熱區「都不是」：中性灰 #6b7280，透明度烘進顏色（fill-opacity 維持均一，透明度滑桿照 F-1 生效）。 */
export const MAPCHALLENGE_DAY04_ZERO_COLOR = "rgba(107,114,128,0.35)";
export const MAPCHALLENGE_DAY04_ZERO_SWATCH = "#6b7280";
export const MAPCHALLENGE_DAY04_ZERO_SWATCH_OPACITY = 0.35;

// ── 人口密度基準 ─────────────────────────────────────────────
/** 人口密度切點（人/km²）：100–300、300–1k、1k–3k、3k–10k、≥10k */
export const MAPCHALLENGE_DAY04_PD_CUTS = [300, 1000, 3000, 10000] as const;
export const MAPCHALLENGE_DAY04_PD_LABELS = ["100–300", "300–1k", "1k–3k", "3k–10k", "≥10k"] as const;

export function mapchallengePopulationRamp(isDark: boolean): string[] {
  return resampleRamp(paletteRamp("magma", isDark)!, MAPCHALLENGE_DAY04_LEVELS);
}

function stepExpr(prop: string, cuts: readonly number[], colors: readonly string[], below?: string): unknown[] {
  const value = ["to-number", ["get", prop], 0];
  const expr: unknown[] = ["step", value, below ?? colors[0]];
  if (below !== undefined) expr.push(1, colors[0]);
  cuts.forEach((c, i) => expr.push(c, colors[i + 1]));
  return expr;
}

export function mapchallengePopulationColorExpr(isDark: boolean): unknown[] {
  return stepExpr("pd", MAPCHALLENGE_DAY04_PD_CUTS, mapchallengePopulationRamp(isDark));
}

// ── 設施群聚 ─────────────────────────────────────────────────
export type MapchallengeFacilityKey = "convenience" | "cram" | "clinic" | "factory" | "temple" | "school";

export interface MapchallengeFacility {
  key: MapchallengeFacilityKey;
  /** 控件選項與 popup 的中文名（英日文在 legend.mapchallenge.json） */
  zh: string;
  /** 每格數量的 4 個切點 → 5 級（第 1 級從 1 起；0 另畫淡灰） */
  cuts: readonly [number, number, number, number];
  palette: PaletteId;
  /** 熱區重疊率（人口熱區裡也是設施熱區的比例），出處 analytics pipelines/analysis/mapchallenge_2026_day04_clusters 報告 */
  overlapPct: number;
}

/** 順序＝「設施」下拉選單順序＝select encode 索引，新增請加在最後。 */
export const MAPCHALLENGE_DAY04_FACILITIES: readonly MapchallengeFacility[] = [
  { key: "convenience", zh: "便利商店", cuts: [2, 4, 10, 30], palette: "viridis", overlapPct: 82 },
  { key: "cram", zh: "補習班", cuts: [3, 10, 30, 100], palette: "batlow", overlapPct: 75 },
  { key: "clinic", zh: "診所", cuts: [3, 10, 30, 100], palette: "PuBuGn", overlapPct: 77 },
  { key: "factory", zh: "工廠", cuts: [5, 15, 50, 200], palette: "YlOrBr", overlapPct: 41 },
  { key: "temple", zh: "寺廟", cuts: [3, 5, 10, 20], palette: "Burg", overlapPct: 41 },
  { key: "school", zh: "國中小", cuts: [2, 3, 4, 6], palette: "tokyo", overlapPct: 72 },
];

export const MAPCHALLENGE_DAY04_FACILITY_KEYS = MAPCHALLENGE_DAY04_FACILITIES.map((f) => f.key);
export const MAPCHALLENGE_DAY04_DEFAULT_FACILITY: MapchallengeFacilityKey = "convenience";

/** select 編碼後的索引 → 設施（越界退回第一項） */
export function mapchallengeFacilityAt(idx: number | undefined): MapchallengeFacility {
  return MAPCHALLENGE_DAY04_FACILITIES[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY04_FACILITIES[0]!;
}

export function mapchallengeFacilityByKey(key: string | undefined): MapchallengeFacility {
  return MAPCHALLENGE_DAY04_FACILITIES.find((f) => f.key === key) ?? MAPCHALLENGE_DAY04_FACILITIES[0]!;
}

export function mapchallengeFacilityRamp(f: MapchallengeFacility, isDark: boolean): string[] {
  return resampleRamp(paletteRamp(f.palette, isDark)!, MAPCHALLENGE_DAY04_LEVELS);
}

/** 圖例色塊、說明框標題色點：第 4 階（暗底最高階兩兩太接近，見檔頭） */
export function mapchallengeFacilitySwatch(f: MapchallengeFacility, isDark: boolean): string {
  return mapchallengeFacilityRamp(f, isDark)[MAPCHALLENGE_DAY04_LEVELS - 2]!;
}

/** 級距標籤：1–(c1-1)、c1–(c2-1)…、c4+（區間只有一個整數時只寫一個數） */
export function mapchallengeFacilityLabels(f: MapchallengeFacility): string[] {
  const edges = [1, ...f.cuts];
  return edges.map((lo, i) => {
    const next = edges[i + 1];
    if (next === undefined) return `${lo}+`;
    return next - 1 === lo ? String(lo) : `${lo}–${next - 1}`;
  });
}

export function mapchallengeFacilityColorExpr(f: MapchallengeFacility, isDark: boolean): unknown[] {
  return stepExpr(f.key, f.cuts, mapchallengeFacilityRamp(f, isDark), MAPCHALLENGE_DAY04_ZERO_COLOR);
}

// ── 熱區重疊 ─────────────────────────────────────────────────
/** `<k>_c` 熱區類別：3 兩邊都是熱區、1 只有人口熱區、2 只有設施熱區、0 都不是。順序＝圖例＝篩選 bitmask 順序。 */
export const MAPCHALLENGE_DAY04_HOTSPOT_CLASSES = [
  { value: 3, zh: "兩邊都是熱區", color: "#199e70" },
  { value: 1, zh: "只有人口熱區", color: "#3987e5" },
  { value: 2, zh: "只有設施熱區", color: "#d95926" },
  { value: 0, zh: "都不是", color: MAPCHALLENGE_DAY04_ZERO_COLOR },
] as const;

export function mapchallengeHotspotColorExpr(prop: string): unknown[] {
  const expr: unknown[] = ["match", ["to-number", ["get", prop], 0]];
  for (const c of MAPCHALLENGE_DAY04_HOTSPOT_CLASSES) if (c.value !== 0) expr.push(c.value, c.color);
  expr.push(MAPCHALLENGE_DAY04_ZERO_COLOR);
  return expr;
}

export function mapchallengeHotspotClass(v: unknown) {
  return MAPCHALLENGE_DAY04_HOTSPOT_CLASSES.find((c) => c.value === Number(v)) ?? MAPCHALLENGE_DAY04_HOTSPOT_CLASSES[3];
}

/** 臺中／彰化 r8 細格的工廠熱區重疊率（各縣市自己的前 10%，同出處） */
export const MAPCHALLENGE_DAY04_TC_CH_OVERLAP = { taichung: 18, changhua: 45 } as const;
