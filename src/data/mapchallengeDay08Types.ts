/**
 * 30 天地圖挑戰 Day 8「烏托邦 Utopia」（模擬入口，公開，2026-11-08）：三層的色、方案、選項單一資料源，
 * overlayRegistry（paint／filter）、圖例、說明框、hook 都從這裡 import（此檔被 layerManifest 引用，不可 import map/mapStyleScale）。
 *
 * 題目：新北市中和＋永和，如果要讓每個人走 10 分鐘就到一座 ≥1 ha 的非河濱公園，要在哪裡開、要拆多少、花多少。
 * 資料（scripts/preprocess/build-mapchallenge-day08.py 產製；上游 taipei-gis-analytics
 * pipelines/analysis/mapchallenge_2026_day08_utopia，數字取自 web/day08_summary.json）：
 * - day08_access.geojson：2,673 個最小統計區（2024 人口），t0／t0s＝現況、t_<S>／ts_<S>＝方案 S 後的步行分鐘
 *   （一般 4.8 km/h／長幼 3.6 km/h；>30 或走不到記為 30）
 * - day08_sites.geojson：方案 A／B／B2／C 各 5 處用地（cls＝T1／T2／T3）＋1955 公園（D、Dfull）與綠地（Dfull）
 * - day08_plan1955.jpg：1955 中和鄉都市計畫圖（國家文化記憶庫，永和社區大學，CC BY-NC 3.0 TW），仿射對位
 *
 * 配色（map-layers.md §3.2；沒有新增色票，全部取自站上既有值）：
 * - 步行分鐘四級：專案既有 viridis 7 階（src/map/palettes.ts，ramp-validation 驗過）取第 1、3、5、7 階，
 *   暗底圖越久越亮（>15 分＝亮黃，缺口最顯眼）、淡底圖越久越深；色盲安全。
 * - 選址類別：viz-library C2 類別色（docs/features/viz-library/DECISIONS.md §1.3，暗／淡兩組）的
 *   紫（T1）、橘（T2）、洋紅（T3）、金（1955 公園）、綠（1955 綠地）；外框用與底圖反差的中性色（同 Day 6 今日位置點），
 *   疊在 viridis 步行分鐘面上也分得開。
 */

export const MAPCHALLENGE_DAY08_ACCESS_URL = "./mapchallenge/day08_access.geojson";
export const MAPCHALLENGE_DAY08_SITES_URL = "./mapchallenge/day08_sites.geojson";
export const MAPCHALLENGE_DAY08_PLAN_URL = "./mapchallenge/day08_plan1955.jpg";

/** sidebar 代表色（viridis 中段青綠） */
export const MAPCHALLENGE_DAY08_COLOR = "#1f9a8a";

// ── 方案 ─────────────────────────────────────────────────────
/**
 * 方案清單（順序＝select 選項＝encode 索引）。base＝現況（只有步行可及層有）。
 * covered／vulCovered＝10 分鐘內可達人口比例（一般 4.8 km/h × 全人口／長幼 3.6 km/h × 65+ 與 0–14 歲），
 * costYi＝總代價（土地＋建物＋戶別給付＋公園工程，億元，low／base／high），取自 day08_summary.json。
 */
export const MAPCHALLENGE_DAY08_SCENARIOS = [
  { value: "base", zh: "現況", covered: 78.2, vulCovered: 57.3, costYi: null },
  { value: "A", zh: "A 效率", covered: 98.9, vulCovered: 81.8, costYi: { low: 131.0, base: 254.8, high: 378.4 } },
  { value: "B", zh: "B 公平", covered: 98.4, vulCovered: 81.8, costYi: { low: 117.9, base: 229.4, high: 337.1 } },
  { value: "B2", zh: "B2 長幼優先", covered: 96.7, vulCovered: 87.2, costYi: { low: 154.1, base: 282.1, high: 423.5 } },
  { value: "C", zh: "C 低拆遷", covered: 84.4, vulCovered: 66.2, costYi: { low: 4.7, base: 95.6, high: 227.5 } },
  { value: "D", zh: "D 1955 七公園", covered: 89.9, vulCovered: 76.7, costYi: { low: 601.5, base: 1005.3, high: 1491.9 } },
  { value: "Dfull", zh: "Dfull 1955 公園＋綠地", covered: 93.9, vulCovered: 86.2, costYi: { low: 797.5, base: 1357.8, high: 1959.2 } },
] as const;
export type MapchallengeDay08Scenario = (typeof MAPCHALLENGE_DAY08_SCENARIOS)[number]["value"];
export const MAPCHALLENGE_DAY08_ACCESS_SCENARIO_ENCODE = MAPCHALLENGE_DAY08_SCENARIOS.map((s) => s.value);
/** 選址層沒有「現況」：A／B／B2／C／D／Dfull */
export const MAPCHALLENGE_DAY08_SITE_SCENARIOS = MAPCHALLENGE_DAY08_SCENARIOS.filter((s) => s.value !== "base");
export const MAPCHALLENGE_DAY08_SITE_SCENARIO_ENCODE = MAPCHALLENGE_DAY08_SITE_SCENARIOS.map((s) => s.value);

export function mapchallengeDay08AccessScenarioAt(idx: number | undefined) {
  return MAPCHALLENGE_DAY08_SCENARIOS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY08_SCENARIOS[0];
}
export function mapchallengeDay08SiteScenarioAt(idx: number | undefined) {
  return MAPCHALLENGE_DAY08_SITE_SCENARIOS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY08_SITE_SCENARIOS[0]!;
}
export function mapchallengeDay08ScenarioByValue(v: string) {
  return MAPCHALLENGE_DAY08_SCENARIOS.find((s) => s.value === v) ?? MAPCHALLENGE_DAY08_SCENARIOS[0];
}

// ── 步速 ─────────────────────────────────────────────────────
export const MAPCHALLENGE_DAY08_SPEEDS = [
  { value: "normal", zh: "一般 4.8 km/h" },
  { value: "slow", zh: "長幼 3.6 km/h" },
] as const;
export type MapchallengeDay08Speed = (typeof MAPCHALLENGE_DAY08_SPEEDS)[number]["value"];
export const MAPCHALLENGE_DAY08_SPEED_ENCODE = MAPCHALLENGE_DAY08_SPEEDS.map((s) => s.value);
export function mapchallengeDay08SpeedAt(idx: number | undefined): MapchallengeDay08Speed {
  return Math.trunc(idx ?? 0) === 1 ? "slow" : "normal";
}

/** (方案, 步速) → 屬性名：現況 t0／t0s，方案 t_<S>／ts_<S> */
export function mapchallengeDay08TimeProp(scenario: MapchallengeDay08Scenario, speed: MapchallengeDay08Speed): string {
  if (scenario === "base") return speed === "slow" ? "t0s" : "t0";
  return `${speed === "slow" ? "ts" : "t"}_${scenario}`;
}

// ── 步行分鐘四級 ─────────────────────────────────────────────
/** 走不到（或 >30 分）的記值 */
export const MAPCHALLENGE_DAY08_UNREACHABLE = 30;
/** 級距上限（含）：≤5／5–10／10–15／>15；資料到 0.1 分，step 斷點放在 .05 */
export const MAPCHALLENGE_DAY08_BINS = [5, 10, 15] as const;
export const MAPCHALLENGE_DAY08_BIN_LABELS = ["≤5", "5–10", "10–15", ">15"] as const;
/** viridis 7 階（palettes.ts）取第 1、3、5、7 階 */
const BIN_COLORS = {
  dark: ["#365c8d", "#1f9a8a", "#6fcf58", "#fde725"],
  light: ["#46c06f", "#238a8d", "#3c4e8a", "#46085c"],
} as const;
export function mapchallengeDay08BinColors(isDark: boolean): readonly string[] {
  return isDark ? BIN_COLORS.dark : BIN_COLORS.light;
}
export function mapchallengeDay08BinColor(minutes: number, isDark: boolean): string {
  const c = mapchallengeDay08BinColors(isDark);
  const i = MAPCHALLENGE_DAY08_BINS.findIndex((b) => minutes <= b);
  return c[i === -1 ? 3 : i]!;
}
export function mapchallengeDay08AccessColorExpr(prop: string, isDark: boolean): unknown[] {
  const c = mapchallengeDay08BinColors(isDark);
  return ["step", ["to-number", ["coalesce", ["get", prop], MAPCHALLENGE_DAY08_UNREACHABLE]],
    c[0], 5.05, c[1], 10.05, c[2], 15.05, c[3]];
}

// ── 選址類別 ─────────────────────────────────────────────────
/** 順序＝圖例＝multiSelect bitmask */
export const MAPCHALLENGE_DAY08_SITE_CLASSES = [
  { value: "T1", zh: "T1 未開闢公園用地" },
  { value: "T2", zh: "T2 工業區" },
  { value: "T3", zh: "T3 住宅商業街廓" },
  { value: "park", zh: "1955 計畫公園" },
  { value: "greenbelt", zh: "1955 計畫綠地" },
] as const;
export type MapchallengeDay08SiteClass = (typeof MAPCHALLENGE_DAY08_SITE_CLASSES)[number]["value"];
/** viz-library C2：紫、橘、洋紅、金、綠（暗／淡兩組） */
const SITE_COLORS: Record<MapchallengeDay08SiteClass, { dark: string; light: string }> = {
  T1: { dark: "#8466c8", light: "#6f50b2" },
  T2: { dark: "#b75600", light: "#b95700" },
  T3: { dark: "#b64d8e", light: "#963372" },
  park: { dark: "#b38c15", light: "#d0a83e" },
  greenbelt: { dark: "#5ba74a", light: "#77c466" },
};
export function mapchallengeDay08SiteColor(cls: string, isDark: boolean): string {
  const c = SITE_COLORS[(cls in SITE_COLORS ? cls : "T3") as MapchallengeDay08SiteClass];
  return isDark ? c.dark : c.light;
}
export function mapchallengeDay08SiteColorExpr(isDark: boolean): unknown[] {
  return ["match", ["get", "cls"],
    ...MAPCHALLENGE_DAY08_SITE_CLASSES.slice(0, 4).flatMap((c) => [c.value, mapchallengeDay08SiteColor(c.value, isDark)]),
    mapchallengeDay08SiteColor("greenbelt", isDark)];
}
/** 用地外框：與底圖反差的中性色（暗底近白、淡底近黑，同 Day 6 今日位置點），2px */
export function mapchallengeDay08SiteOutline(isDark: boolean): string {
  return isDark ? "#f8fafc" : "#0f172a";
}
/**
 * 填色 0.7＋外框 2px（FILL_TIERS keep）：用地多半約 1 ha，疊在步行分鐘面（viridis 0.55）上，
 * coverage 階的 0.35／1px 會被底下的色塊吃掉、看不出類別色（2026-11-08 本機截圖確認）。
 */
export const MAPCHALLENGE_DAY08_SITE_FILL_OPACITY = 0.7;

// ── 1955 計畫原圖 ────────────────────────────────────────────
/** 四角（TL、TR、BR、BL，lng/lat），取自 day08_summary.json plan_image（仿射對位，控制點 RMS 約 30 m、檢核點約 55 m） */
export const MAPCHALLENGE_DAY08_PLAN_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [121.488347, 25.023671], [121.535609, 25.023509], [121.535453, 24.987487], [121.488204, 24.98765],
];
export const MAPCHALLENGE_DAY08_PLAN_ATTRIBUTION = "1955 中和鄉都市計畫圖，國家文化記憶庫（永和社區大學），CC BY-NC 3.0 TW";
