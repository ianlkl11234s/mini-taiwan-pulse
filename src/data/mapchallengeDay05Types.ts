/**
 * 30 天地圖挑戰 Day 5「視野 Perspectives」（模擬入口，2026-11-05）：海景路段與最長連續海景的
 * 色、線寬、類別、範圍選項的單一資料源，overlayRegistry（paint／filter）、圖例、說明框三邊都從這裡 import。
 *
 * 資料：public/mapchallenge/day05_sea_view_segments.geojson（10,369 條線，鐵路／道路逐段判定）、
 * day05_sea_view_runs.geojson（139 條 MultiLineString，scope×kind 內前 30 名連續海景）。
 * 產製：taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day05_sea_view。
 *
 * 配色（map-layers.md §3.2 L-1／L-4／L-5；沒有新增色票，全部取自站上既有值）：
 * - 海景路段（有序五類）：開闊／有海景 取 YlGnBu 色盤（Day 4 同類序列色的作法，暗底越亮越強、淡底越深越強）；
 *   樹縫間看得到（被路邊樹叢部分遮擋）取同色盤再低一階並烘入透明度 0.7，強調度低於「看得到海」；
 *   看不到海／隧道 用 Day 4「都不是」同一個中性灰 #6b7280，透明度烘進顏色（line-opacity 維持 L-4 標準 0.85）。
 * - 最長連續海景：鐵路／道路兩色取 Day 4 熱區類別色（#d95926 橘、#3987e5 藍），色相與路段層的青藍序列錯開。
 * - 線寬見 mapchallengeDay05Style.ts（此檔被 layerManifest 引用，不可 import map/mapStyleScale，否則 vite config 載入鏈會拉進 i18n）。
 */
import { paletteRamp } from "../map/palettes";
import { MAPCHALLENGE_DAY04_ZERO_SWATCH } from "./mapchallengeDay04Types";

export const MAPCHALLENGE_DAY05_SEGMENTS_URL = "./mapchallenge/day05_sea_view_segments.geojson";
export const MAPCHALLENGE_DAY05_RUNS_URL = "./mapchallenge/day05_sea_view_runs.geojson";

/** sidebar 代表色（YlGnBu 中段） */
export const MAPCHALLENGE_DAY05_COLOR = "#2196c0";

// ── 運具 ─────────────────────────────────────────────────────
export type MapchallengeDay05Kind = "rail" | "road";
/** 運具下拉：encode 索引 0＝全部、1＝鐵路、2＝道路（兩層共用） */
export const MAPCHALLENGE_DAY05_KIND_ENCODE = ["all", "rail", "road"] as const;
export const MAPCHALLENGE_DAY05_KIND_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "鐵路", value: "rail" },
  { label: "道路", value: "road" },
] as const;
export const MAPCHALLENGE_DAY05_KIND_COLORS: Record<MapchallengeDay05Kind, string> = { rail: "#d95926", road: "#3987e5" };

export function mapchallengeDay05KindAt(idx: number | undefined): "all" | MapchallengeDay05Kind {
  return MAPCHALLENGE_DAY05_KIND_ENCODE[Math.trunc(idx ?? 0)] ?? "all";
}

/** 運具篩選：全部回 null（不加篩選） */
export function mapchallengeDay05KindFilter(idx: number | undefined): unknown[] | null {
  const k = mapchallengeDay05KindAt(idx);
  return k === "all" ? null : ["==", ["get", "kind"], k];
}

// ── 海景路段 ─────────────────────────────────────────────────
/** 順序＝圖例＝multiSelect bitmask（由強到弱）；value 是 tier 屬性值的字串 */
export const MAPCHALLENGE_DAY05_TIERS = [
  { value: 2, zh: "開闊海景" },
  { value: 1, zh: "看得到海" },
  { value: 3, zh: "樹縫間看得到" },
  { value: 0, zh: "看不到海" },
  { value: -1, zh: "隧道" },
] as const;
export type MapchallengeDay05Tier = (typeof MAPCHALLENGE_DAY05_TIERS)[number]["value"];

/** 樹縫間看得到：YlGnBu 低一階（暗底較暗、淡底較淺）＋透明度 0.7，兩種底圖都弱於「看得到海」 */
export const MAPCHALLENGE_DAY05_TREE_OPACITY = 0.7;

/** 灰的透明度烘進顏色：看不到海 0.6、隧道 0.35（× 線透明度 0.85 ≈ 0.51／0.30，不低於 L-4 的 0.3） */
/** 與 Day 4 ZERO_SWATCH（#6b7280）同一個灰的 RGB */
const GRAY = "107,114,128";
export const MAPCHALLENGE_DAY05_NO_VIEW_COLOR = `rgba(${GRAY},0.6)`;
export const MAPCHALLENGE_DAY05_TUNNEL_COLOR = `rgba(${GRAY},0.35)`;

/**
 * 發光（2026-11-05 使用者選設計稿 G5）：暗底圖的開闊／看得到海線芯往白混 40%（像燈管），淡底圖維持 YlGnBu 原色。
 * 偏離 YlGnBu 是登記例外（map-layers.md §3.1 P-6），圖例、說明框、光暈子圖層都用同一個色。
 */
export const MAPCHALLENGE_DAY05_DARK_CORE_WHITEN = 0.4;
function mixWhite(hex: string, t: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const m = (c: number) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0");
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`;
}

/** 類別多選預設只勾開闊海景＋看得到海（2026-11-05 使用者選 G5）；其他類可在篩選勾回 */
export const MAPCHALLENGE_DAY05_DEFAULT_TIERS: readonly MapchallengeDay05Tier[] = [2, 1];

export function mapchallengeDay05TierColor(tier: number, isDark: boolean): string {
  const ramp = paletteRamp("YlGnBu", isDark)!;
  const core = (c: string) => (isDark ? mixWhite(c, MAPCHALLENGE_DAY05_DARK_CORE_WHITEN) : c);
  if (tier === 2) return core(ramp[isDark ? 4 : 5]!);
  if (tier === 1) return core(ramp[2]!);
  if (tier === 3) {
    const n = Number.parseInt(ramp[1]!.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${MAPCHALLENGE_DAY05_TREE_OPACITY})`;
  }
  return tier === 0 ? MAPCHALLENGE_DAY05_NO_VIEW_COLOR : MAPCHALLENGE_DAY05_TUNNEL_COLOR;
}

/** 圖例／說明框色塊用的不透明版本 */
export function mapchallengeDay05TierSwatch(tier: number, isDark: boolean): { color: string; opacity: number } {
  if (tier === 0) return { color: MAPCHALLENGE_DAY04_ZERO_SWATCH, opacity: 0.6 };
  if (tier === -1) return { color: MAPCHALLENGE_DAY04_ZERO_SWATCH, opacity: 0.35 };
  if (tier === 3) return { color: paletteRamp("YlGnBu", isDark)![1]!, opacity: MAPCHALLENGE_DAY05_TREE_OPACITY };
  return { color: mapchallengeDay05TierColor(tier, isDark), opacity: 1 };
}

export function mapchallengeDay05TierColorExpr(isDark: boolean): unknown[] {
  return ["match", ["to-number", ["get", "tier"], 0],
    2, mapchallengeDay05TierColor(2, isDark),
    1, mapchallengeDay05TierColor(1, isDark),
    3, mapchallengeDay05TierColor(3, isDark),
    -1, MAPCHALLENGE_DAY05_TUNNEL_COLOR,
    MAPCHALLENGE_DAY05_NO_VIEW_COLOR];
}

/** 繪製順序：強的在上（line-sort-key），鐵路壓在同判定的道路上；強弱 2 > 1 > 3 > 0 > -1 */
export const MAPCHALLENGE_DAY05_SORT_KEY: unknown[] = ["+",
  ["*", 2, ["match", ["to-number", ["get", "tier"], 0], 2, 4, 1, 3, 3, 2, 0, 1, 0]],
  ["case", ["==", ["get", "kind"], "rail"], 1, 0]];

export function mapchallengeDay05TierLabel(tier: unknown): { zh: string; value: MapchallengeDay05Tier } {
  return MAPCHALLENGE_DAY05_TIERS.find((t) => t.value === Number(tier)) ?? MAPCHALLENGE_DAY05_TIERS[3];
}

// ── 最長連續海景 ─────────────────────────────────────────────
export const MAPCHALLENGE_DAY05_SCOPES = [
  { value: "all", zh: "不限距離" },
  { value: "d200", zh: "離海 ≤200 m" },
  { value: "d100", zh: "離海 ≤100 m" },
] as const;
export const MAPCHALLENGE_DAY05_SCOPE_ENCODE = MAPCHALLENGE_DAY05_SCOPES.map((s) => s.value);
export const MAPCHALLENGE_DAY05_DEFAULT_SCOPE = "all";

export function mapchallengeDay05ScopeAt(idx: number | undefined): string {
  return MAPCHALLENGE_DAY05_SCOPE_ENCODE[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY05_DEFAULT_SCOPE;
}

/** 名次 ≤ 此值畫更粗 */
export const MAPCHALLENGE_DAY05_TOP_RANK = 3;

export function mapchallengeDay05RunColorExpr(): unknown[] {
  return ["match", ["get", "kind"], "rail", MAPCHALLENGE_DAY05_KIND_COLORS.rail, MAPCHALLENGE_DAY05_KIND_COLORS.road];
}

export const MAPCHALLENGE_DAY05_RUN_SORT_KEY: unknown[] = ["-", 31, ["to-number", ["get", "rank"], 30]];

/** 高架比例 ≥ 此值（%）時 popup 補一句「主要靠高架視高」 */
export const MAPCHALLENGE_DAY05_VIADUCT_NOTE_PCT = 50;
