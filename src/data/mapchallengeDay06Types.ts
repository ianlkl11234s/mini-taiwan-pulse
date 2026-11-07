/**
 * 30 天地圖挑戰 Day 6「復古 Vintage」（模擬入口，公開，2026-11-06）：四層的色、類別、選項單一資料源，
 * overlayRegistry（paint／filter）、圖例、說明框都從這裡 import（此檔被 layerManifest 引用，不可 import map/mapStyleScale）。
 *
 * 資料（scripts/preprocess/build-mapchallenge-day06.py 產製，THCTS 衍生資料，CC BY-NC-SA 3.0 臺灣版）：
 * - day06_coast.geojson：西南海岸線三代（kind=coast，era 1／2／3）＋當年海岸線以西的今日地名（kind=place，鯤鯓／塭／汕）
 * - day06_taipei_1932.geojson：1932 臺北市町界 74 面（kind=zone）＋町名標籤點（kind=label）
 * - day06_temples_1921.geojson：1921 地形圖祠廟 1,439 點
 * - day06_lighthouse_weather.geojson：燈塔 16＋測候所 5（role=hist／today／link）
 *
 * 配色（map-layers.md §3.2；沒有新增色票，全部取自站上既有值）：
 * - 海岸線三代：取 viz-library C2 類別色（docs/features/viz-library/DECISIONS.md §1.3，暗／淡兩組）的
 *   洋紅（17–18 世紀）／藍（19 世紀）／綠（20 世紀初），三個色相分得開（2026-11-06 使用者要求，原 YlOrBr 同色系三階
 *   疊在淺色古地圖上亮黃看不清）。避開金、橘：和 1904 堡圖的米黃紙色、YlOrBr 寺廟色撞。最舊一代線寬 ×1.4（略粗），
 *   年代先後靠線寬與圖例順序表達。今日地名點跟同一套色。
 * - 町界「仍在里名／已消失」、燈塔「原址／遷移／清單無對應」：Day 4 熱區類別色（#d95926 橘、#3987e5 藍）＋
 *   Day 4「都不是」中性灰 #6b7280；「留下來的」用橘（主角），消失的用灰。
 * - 祠廟「原址 100 m 內仍有寺廟」取 YlOrBr 亮階 #fea332（暗淡共用，同站上寺廟暖色系），「沒有」用中性灰。
 */
import { MAPCHALLENGE_DAY04_ZERO_SWATCH } from "./mapchallengeDay04Types";

export const MAPCHALLENGE_DAY06_COAST_URL = "./mapchallenge/day06_coast.geojson";
export const MAPCHALLENGE_DAY06_TAIPEI_URL = "./mapchallenge/day06_taipei_1932.geojson";
export const MAPCHALLENGE_DAY06_TEMPLES_URL = "./mapchallenge/day06_temples_1921.geojson";
export const MAPCHALLENGE_DAY06_LIGHTHOUSE_URL = "./mapchallenge/day06_lighthouse_weather.geojson";

/** sidebar 代表色（YlOrBr 中段） */
export const MAPCHALLENGE_DAY06_COLOR = "#db5d0b";
export const MAPCHALLENGE_DAY06_GRAY = MAPCHALLENGE_DAY04_ZERO_SWATCH;
export const MAPCHALLENGE_DAY06_ORANGE = "#d95926";
export const MAPCHALLENGE_DAY06_BLUE = "#3987e5";

// ── 1. 臺南海岸線三代 ─────────────────────────────────────────
/** 順序＝圖例＝multiSelect bitmask（舊→新）；value 是 era 屬性值字串 */
export const MAPCHALLENGE_DAY06_ERAS = [
  { value: 1, zh: "17–18 世紀" },
  { value: 2, zh: "19 世紀" },
  { value: 3, zh: "20 世紀初" },
] as const;
export type MapchallengeDay06Era = (typeof MAPCHALLENGE_DAY06_ERAS)[number]["value"];
/** viz-library C2 類別色：暗底圖／淡底圖兩組（洋紅、藍、綠），值抄 DECISIONS.md §1.3 */
const ERA_COLORS: Record<MapchallengeDay06Era, { dark: string; light: string }> = {
  1: { dark: "#b64d8e", light: "#963372" },
  2: { dark: "#2e81d5", light: "#3a8ce0" },
  3: { dark: "#5ba74a", light: "#77c466" },
};

export function mapchallengeDay06EraColor(era: number, isDark: boolean): string {
  const c = ERA_COLORS[(era in ERA_COLORS ? era : 3) as MapchallengeDay06Era];
  return isDark ? c.dark : c.light;
}

export function mapchallengeDay06EraColorExpr(isDark: boolean, prop = "era"): unknown[] {
  return ["match", ["to-number", ["get", prop], 3],
    1, mapchallengeDay06EraColor(1, isDark), 2, mapchallengeDay06EraColor(2, isDark), mapchallengeDay06EraColor(3, isDark)];
}

/** 海岸線寬：L-1 強調階（z10 2／z14 3.5，再補 z7 1.5 讓全台視角看得到），最舊一代 ×1.4；scale＝線寬滑桿 */
export const MAPCHALLENGE_DAY06_OLDEST_WIDTH_MUL = 1.4;
export function mapchallengeDay06CoastWidthExpr(scale = 1): unknown[] {
  const w = (base: number) => ["*", base * scale, ["case", ["==", ["to-number", ["get", "era"], 3], 1], MAPCHALLENGE_DAY06_OLDEST_WIDTH_MUL, 1]];
  return ["interpolate", ["linear"], ["zoom"], 7, w(1.5), 10, w(2), 14, w(3.5)];
}

/** 今日地名點：顯示／隱藏（select，idx 0＝顯示） */
export const MAPCHALLENGE_DAY06_PLACES_ENCODE = ["show", "hide"] as const;
export const MAPCHALLENGE_DAY06_PLACES_OPTIONS = [
  { label: "顯示", value: "show" },
  { label: "隱藏", value: "hide" },
] as const;
/** 名稱標籤一律 z13 起（map-layers.md §3.5 T-3：POI 名稱 minzoom ≥ 13） */
export const MAPCHALLENGE_DAY06_LABEL_MINZOOM = 13;
/** 町名 z12 起（T-3 登記例外，map-layers.md §3.5）：町界是本層主體，z12 一眼看完整個舊城 74 町 */
export const MAPCHALLENGE_DAY06_TAIPEI_LABEL_MINZOOM = 12;

// ── 2. 1932 臺北市町界 ───────────────────────────────────────
export const MAPCHALLENGE_DAY06_SURVIVE = [
  { value: 1, zh: "町名今天仍在里名" },
  { value: 0, zh: "町名已消失" },
] as const;
export function mapchallengeDay06SurviveColor(v: number): string {
  return v === 1 ? MAPCHALLENGE_DAY06_ORANGE : MAPCHALLENGE_DAY06_GRAY;
}
export const MAPCHALLENGE_DAY06_SURVIVE_COLOR_EXPR: unknown[] = ["match", ["to-number", ["get", "survives"], 0], 1, MAPCHALLENGE_DAY06_ORANGE, MAPCHALLENGE_DAY06_GRAY];
/** 面填色透明度（面＋類別色 0.35，§5 組合範例）；外框 1px 同色 */
export const MAPCHALLENGE_DAY06_ZONE_FILL_OPACITY = 0.35;
export const MAPCHALLENGE_DAY06_TAIPEI_COUNTS = { total: 74, survives: 13 } as const;

// ── 3. 廟不搬家：1921 祠廟 ───────────────────────────────────
export const MAPCHALLENGE_DAY06_TEMPLE_CLASSES = [
  { value: 1, zh: "原址 100 m 內今天仍有寺廟" },
  { value: 0, zh: "100 m 內沒有登記寺廟" },
] as const;
export const MAPCHALLENGE_DAY06_TEMPLE_COLOR = "#fea332";
export function mapchallengeDay06TempleColor(v: number): string {
  return v === 1 ? MAPCHALLENGE_DAY06_TEMPLE_COLOR : MAPCHALLENGE_DAY06_GRAY;
}
export const MAPCHALLENGE_DAY06_TEMPLE_COLOR_EXPR: unknown[] = ["match", ["to-number", ["get", "cont"], 0], 1, MAPCHALLENGE_DAY06_TEMPLE_COLOR, MAPCHALLENGE_DAY06_GRAY];
/** 統計（FINDINGS.md 5-religion）：原址 vs 整批平移 300／600 m × 8 方向的對照組 */
/** 同名原址外圈（14 處）：中性對比色（同今日位置點），半徑 z7 6／z10 7.5／z14 10 px（主體 M 4.5 外面一圈），描邊 1.5 */
export const MAPCHALLENGE_DAY06_SAME_RING = { radius: [[7, 6], [10, 7.5], [14, 10]] as const, strokeWidth: 1.5 } as const;
export const MAPCHALLENGE_DAY06_TEMPLE_STATS = { total: 1439, cont: 1007, contPct: 70, controlPct: 9, sameName: 14 } as const;

// ── 4. 燈塔與測候所今昔 ───────────────────────────────────────
export const MAPCHALLENGE_DAY06_STATUSES = [
  { value: "same", zh: "原址（150 m 內）" },
  { value: "moved", zh: "遷移" },
  { value: "none", zh: "今日清單無對應" },
] as const;
export type MapchallengeDay06Status = (typeof MAPCHALLENGE_DAY06_STATUSES)[number]["value"];
export const MAPCHALLENGE_DAY06_STATUS_COLORS: Record<MapchallengeDay06Status, string> = {
  same: MAPCHALLENGE_DAY06_BLUE, moved: MAPCHALLENGE_DAY06_ORANGE, none: MAPCHALLENGE_DAY06_GRAY,
};
export const MAPCHALLENGE_DAY06_STATUS_COLOR_EXPR: unknown[] = ["match", ["get", "status"],
  "same", MAPCHALLENGE_DAY06_STATUS_COLORS.same, "moved", MAPCHALLENGE_DAY06_STATUS_COLORS.moved, MAPCHALLENGE_DAY06_STATUS_COLORS.none];
/** 今日位置點：與底圖反差的中性色（暗底近白、淡底近黑），和歷史點的狀態色分開 */
export function mapchallengeDay06TodayColor(isDark: boolean): string {
  return isDark ? "#f8fafc" : "#0f172a";
}
export const MAPCHALLENGE_DAY06_TYPE_ENCODE = ["all", "lighthouse", "station"] as const;
export const MAPCHALLENGE_DAY06_TYPE_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "燈塔", value: "lighthouse" },
  { label: "測候所", value: "station" },
] as const;
export function mapchallengeDay06TypeFilter(idx: number | undefined): unknown[] | null {
  const t = MAPCHALLENGE_DAY06_TYPE_ENCODE[Math.trunc(idx ?? 0)] ?? "all";
  return t === "all" ? null : ["==", ["get", "type"], t];
}
export const MAPCHALLENGE_DAY06_LINK_DASH = [2, 2] as const;
