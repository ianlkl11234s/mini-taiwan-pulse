/**
 * 30 天地圖挑戰 Day 8「烏托邦 Utopia」（模擬入口，公開，2026-11-08）：三層的色、方案、選項單一資料源，
 * overlayRegistry（paint／filter）、圖例、說明框、hook 都從這裡 import（此檔被 layerManifest 引用，不可 import map/mapStyleScale）。
 *
 * 題目：新北市中和＋永和，如果要讓每個人走 10 分鐘就到一座 ≥1 ha 的公園（含河濱公園，但河濱公園只能從穿過堤防的入口進入），要在哪裡開、要拆多少、花多少。
 * 資料（scripts/preprocess/build-mapchallenge-day08.py 產製；上游 taipei-gis-analytics
 * pipelines/analysis/mapchallenge_2026_day08_utopia，數字取自 web/day08_summary.json）：
 * - day08_access_v2.geojson：2,673 個最小統計區（2024 人口），t0／t0s＝現況、t_<S>／ts_<S>＝方案 S 後的步行分鐘
 *   （一般 4.8 km/h／長幼 3.6 km/h；>30 或走不到記為 30）
 * - day08_sites_v2.geojson：方案 A／B／B2／C 各 5 處用地（cls＝T1／T2／T3）＋1955 公園（D、Dfull）與綠地（Dfull）
 * - day08_parks.geojson：現有 ≥1 ha 公園面（cls＝park／riverside）與河濱公園穿堤入口點（cls＝entrance，kind＝bridge／tunnel／steps／gate）
 * - day08_plan1955.jpg：1955 中和鄉都市計畫圖（國家文化記憶庫，永和社區大學，CC BY-NC 3.0 TW），仿射對位
 *
 * 配色（map-layers.md §3.2；2026-11-08 使用者拍板第三輪）：
 * - 步行分鐘四級：深淺底圖共用獨立小站（mapchallenge-utopia src/app.js）的藍 → 紅色票，近＝藍、遠＝紅，
 *   10 分鐘為冷暖分界（CIE76 ΔE 兩兩 ≥30）。
 * - 選址類別：避開步行分鐘的藍、黃、紅，用紫（T3、1955 公園）、粉（T2）、萊姆綠（T1、1955 綠地），
 *   與步行四級 ΔE 皆 ≥44。同色的兩類不會出現在
 *   同一個方案（T3 只在 A／B／B2，公園只在 D／Dfull；T1 只在 C，綠地只在 Dfull），圖例只列當下方案有的類別。
 *   填色 0.35＋外框 1px（FILL_TIERS coverage 預設），外框用與底圖反差的中性色（暗底 #f8fafc）。
 */

export const MAPCHALLENGE_DAY08_ACCESS_URL = "./mapchallenge/day08_access_v2.geojson";
export const MAPCHALLENGE_DAY08_SITES_URL = "./mapchallenge/day08_sites_v2.geojson";
export const MAPCHALLENGE_DAY08_PARKS_URL = "./mapchallenge/day08_parks.geojson";
export const MAPCHALLENGE_DAY08_PLAN_URL = "./mapchallenge/day08_plan1955.jpg";

/** sidebar 代表色（viridis 中段青綠） */
export const MAPCHALLENGE_DAY08_COLOR = "#1f9a8a";

// ── 方案 ─────────────────────────────────────────────────────
/**
 * 方案清單（順序＝select 選項＝encode 索引）。base＝現況（只有步行可及層有）。
 * covered／vulCovered＝10 分鐘內可達人口比例（≥1 ha 公園含河濱，河濱公園只走穿堤入口；2026-11-08 B 口徑）（一般 4.8 km/h × 全人口／長幼 3.6 km/h × 65+ 與 0–14 歲），
 * costYi＝總代價（土地＋建物＋戶別給付＋公園工程，億元，low／base／high），取自 day08_summary.json。
 */
export const MAPCHALLENGE_DAY08_SCENARIOS = [
  { value: "base", zh: "現況", covered: 85.7, vulCovered: 64.2, costYi: null, classes: [] },
  { value: "A", zh: "A 效率", covered: 99.3, vulCovered: 84.1, costYi: { low: 116.5, base: 231.1, high: 374.2 }, classes: ["T3"] },
  { value: "B", zh: "B 公平", covered: 98.8, vulCovered: 84.1, costYi: { low: 103.4, base: 205.6, high: 332.9 }, classes: ["T2", "T3"] },
  { value: "B2", zh: "B2 長幼優先", covered: 96.8, vulCovered: 89.2, costYi: { low: 128.6, base: 239.2, high: 399.4 }, classes: ["T3"] },
  { value: "C", zh: "C 未開闢公園地", covered: 91.9, vulCovered: 73.1, costYi: { low: 4.7, base: 95.6, high: 227.5 }, classes: ["T1"] },
  { value: "D", zh: "D 1955 七公園", covered: 90.7, vulCovered: 78.9, costYi: { low: 601.5, base: 1005.3, high: 1491.9 }, classes: ["park"] },
  { value: "Dfull", zh: "Dfull 1955 公園＋綠地", covered: 93.9, vulCovered: 86.3, costYi: { low: 797.5, base: 1357.8, high: 1959.2 }, classes: ["park", "greenbelt"] },
] as const;
export type MapchallengeDay08Scenario = (typeof MAPCHALLENGE_DAY08_SCENARIOS)[number]["value"];
/**
 * 方案選擇兩層共用（layerParamsSpec sharedGroup，選一邊另一邊跟著變）：同一個參數名、選項、encode。
 * 預設 A（選址層在「現況」沒有用地可畫）。
 */
export const MAPCHALLENGE_DAY08_SCENARIO_ENCODE = MAPCHALLENGE_DAY08_SCENARIOS.map((s) => s.value);
export const MAPCHALLENGE_DAY08_DEFAULT_SCENARIO: MapchallengeDay08Scenario = "A";

export function mapchallengeDay08ScenarioAt(idx: number | undefined) {
  return MAPCHALLENGE_DAY08_SCENARIOS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY08_SCENARIOS[0];
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
/** 近＝藍、遠＝紅（10 分鐘分界），深淺底圖同一套，與獨立小站一致；色值出處見檔頭 */
const BIN_COLORS = {
  dark: ["#1d5f8a", "#6aaed6", "#f2b84b", "#c8553d"],
  light: ["#1d5f8a", "#6aaed6", "#f2b84b", "#c8553d"],
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
/** 紫、粉、萊姆綠（暗／淡兩組），避開步行分鐘的藍、黃、紅；同色兩類不在同一方案出現（見檔頭） */
const SITE_PURPLE = { dark: "#a855f7", light: "#7e22ce" };
const SITE_PINK = { dark: "#ec4899", light: "#db2777" };
const SITE_LIME = { dark: "#a3e635", light: "#65a30d" };
const SITE_COLORS: Record<MapchallengeDay08SiteClass, { dark: string; light: string }> = {
  T1: SITE_LIME, T2: SITE_PINK, T3: SITE_PURPLE, park: SITE_PURPLE, greenbelt: SITE_LIME,
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
/** 填色 0.35、外框 1px（F-1 coverage 預設；FILL_TIERS coverage 實際套用） */
export const MAPCHALLENGE_DAY08_SITE_FILL_OPACITY = 0.35;

// ── 現有公園與河濱入口 ───────────────────────────────────────
/** 順序＝圖例＝multiSelect bitmask（新增請加在最後） */
export const MAPCHALLENGE_DAY08_PARK_CLASSES = [
  { value: "park", zh: "一般公園（≥1 ha）" },
  { value: "riverside", zh: "河濱公園（≥1 ha）" },
  { value: "entrance", zh: "河濱穿堤入口" },
] as const;
export type MapchallengeDay08ParkClass = (typeof MAPCHALLENGE_DAY08_PARK_CLASSES)[number]["value"];
/** 入口種類（資料 kind）：陸橋、地下道、上堤階梯、疏散門 */
export const MAPCHALLENGE_DAY08_ENTRANCE_KINDS = ["bridge", "tunnel", "steps", "gate"] as const;
export type MapchallengeDay08EntranceKind = (typeof MAPCHALLENGE_DAY08_ENTRANCE_KINDS)[number];
export const MAPCHALLENGE_DAY08_ENTRANCE_KIND_KEYS = {
  bridge: "popup.mapchallenge.day08.kind.bridge",
  tunnel: "popup.mapchallenge.day08.kind.tunnel",
  steps: "popup.mapchallenge.day08.kind.steps",
  gate: "popup.mapchallenge.day08.kind.gate",
} as const;
/**
 * 配色（站上既有色系挑選，與步行分鐘藍／黃／紅、選址紫／粉／萊姆錯開）：
 * 一般公園綠（tailwind green 500／700）、河濱公園青綠（teal 400／700，與一般公園 ΔE ≥ 20）、入口亮黃（yellow 400／amber 600，加深色描邊）。
 * 填色 0.35＋外框 1px（FILL_TIERS coverage 預設）。
 */
const PARK_COLORS: Record<MapchallengeDay08ParkClass, { dark: string; light: string }> = {
  park: { dark: "#22c55e", light: "#15803d" },
  riverside: { dark: "#2dd4bf", light: "#0f766e" },
  entrance: { dark: "#facc15", light: "#d97706" },
};
export function mapchallengeDay08ParkColor(cls: string, isDark: boolean): string {
  const c = PARK_COLORS[(cls in PARK_COLORS ? cls : "park") as MapchallengeDay08ParkClass];
  return isDark ? c.dark : c.light;
}
export function mapchallengeDay08ParkColorExpr(isDark: boolean): unknown[] {
  return ["match", ["get", "cls"],
    "riverside", mapchallengeDay08ParkColor("riverside", isDark),
    "entrance", mapchallengeDay08ParkColor("entrance", isDark),
    mapchallengeDay08ParkColor("park", isDark)];
}
export const MAPCHALLENGE_DAY08_PARK_FILL_OPACITY = 0.35;

// ── 1955 計畫原圖 ────────────────────────────────────────────
/** 四角（TL、TR、BR、BL，lng/lat；2026-11-08 裁掉掃描黑邊後的版本），取自 day08_summary.json plan_image（仿射對位，控制點 RMS 約 30 m、檢核點約 55 m） */
export const MAPCHALLENGE_DAY08_PLAN_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [121.489829, 25.022052], [121.53409, 25.021899], [121.533948, 24.989], [121.489698, 24.989152],
];
export const MAPCHALLENGE_DAY08_PLAN_ATTRIBUTION = "1955 中和鄉都市計畫圖，國家文化記憶庫（永和社區大學），CC BY-NC 3.0 TW";

/** 億元 → 十億元（en 用 NT$…B）；顯示一律 1 位小數＋千分位（MAPCHALLENGE_DAY08_COST_FORMAT） */
export function mapchallengeDay08YiToBillion(yi: number): number {
  return yi / 10;
}
/** 代價數字格式：三語一律 1 位小數＋千分位（131.0、1,005.3） */
export const MAPCHALLENGE_DAY08_COST_FORMAT: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true };
