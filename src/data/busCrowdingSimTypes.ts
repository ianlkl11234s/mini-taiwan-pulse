/**
 * 公車擁擠模擬（模擬面板「臺北 307 走廊公車擁擠」，站主限定、研究中）的常數與純函式 SSOT。
 * 地圖 paint、圖例、popup 三邊都從這裡 import（development-rules §4 #4）。
 *
 * 資料：scripts/preprocess/build-bus-crowding-sim.py 由 taipei-gis-analytics bus_crowding P3 匯出產生，
 * 放在 gitignored 的 public/sim/bus-crowding/（資料公開與否尚未拍板）。
 * 數值是「平日 7–9 時離開該站的班次中，負載比 ≥ 1.0（容量假設 65 人）的比例」，模擬推估，非實測。
 */
import { paletteRamp, resampleRamp } from "../map/palettes";

export const BUS_CROWDING_SIM_KEY = "busCrowdingSim" as const;
export const BUS_CROWDING_SIM_SOURCE_ID = "bus-crowding-sim";
export const BUS_CROWDING_SIM_LAYER_IDS = {
  line: "bus-crowding-sim-line",
  /** 透明加寬命中層（四鐵則③：細線點擊命中率差）。 */
  hit: "bus-crowding-sim-hit",
} as const;

const BASE = `${import.meta.env?.BASE_URL ?? "/"}sim/bus-crowding`;
export const busCrowdingSimUrl = (path: string) => `${BASE}/${path}`;

/** 參數版本：7–9 時佔全日比例。資料夾對應寫死（上游 meta.json 沒記 am_share）。 */
export const BUS_CROWDING_VERSIONS = ["v137", "v180"] as const;
export type BusCrowdingVersion = (typeof BUS_CROWDING_VERSIONS)[number];
export const BUS_CROWDING_VERSION_LABELS: Record<BusCrowdingVersion, string> = {
  v137: "較寬鬆 13.7%（YouBike 推估）",
  v180: "較擁擠 18.0%（捷運推估）",
};

/** 方案：基準＋7 個情境（id 與上游 scenarios/index.json 相同；中文 title 照上游 scenario.json）。 */
export const BUS_CROWDING_SCENARIOS = [
  "base", "s1_307_headway", "s2_307_short_turn", "s3_yonghe_shuttle",
  "s4_307_regular", "s4_307_regular_fl", "s5_all_regular", "s5_all_regular_fl",
] as const;
export type BusCrowdingScenario = (typeof BUS_CROWDING_SCENARIOS)[number];
export const BUS_CROWDING_SCENARIO_LABELS: Record<BusCrowdingScenario, string> = {
  base: "基準（現況）",
  s1_307_headway: "307 往臺北早尖峰加密 50%",
  s2_307_short_turn: "307 華中橋→臺北車站區間車",
  s3_yonghe_shuttle: "永和—臺北車站尖峰接駁線",
  s4_307_regular: "307 往臺北班距等距化",
  s4_307_regular_fl: "307 往臺北班距等距化（首末班錨定）",
  s5_all_regular: "全部臺北路線班距等距化",
  s5_all_regular_fl: "全部臺北路線班距等距化（首末班錨定）",
};

/** 靜態資產（相對 public/；manifest staticAssets 與 deployContract 豁免共用）。 */
export const BUS_CROWDING_SIM_ASSETS: readonly string[] = [
  "sim/bus-crowding/segments.geojson",
  ...BUS_CROWDING_VERSIONS.flatMap((v) => BUS_CROWDING_SCENARIOS.map((s) => `sim/bus-crowding/${v}/${s}.json`)),
];

/** 班次少於此數的路段不畫（比例太不穩）。 */
export const BUS_CROWDING_MIN_TRIPS = 5;
/** 分級門檻（同上游原型）：0｜(0, 20%)｜[20%, 40%)｜≥ 40%。基準與情境共用（spec §5.40 S-3）。 */
export const BUS_CROWDING_BREAKS = [0.2, 0.4] as const;
/** 側欄色票等不分底圖的單一代表色：magma（palettes.ts）暗底圖 3 階取樣的中間級；完整四級色與 paint 在 busCrowdingSimStyle.ts。 */
export const BUS_CROWDING_REPRESENTATIVE_COLOR = resampleRamp(paletteRamp("magma", true)!, 3)[1]!;
/** 0 與「> 0」的分界：上游最小非零值 0.037，用 epsilon 區分。 */
export const BUS_CROWDING_NONZERO = 0.0001;

/** 一個方案一個版本的數值：依 segments.geojson feature 順序對齊。 */
export interface BusCrowdingValues { ov: (number | null)[]; n: number[] }
/** 目前方案兩版都載（popup 寫範圍、不受目前選的版本影響）。 */
export interface BusCrowdingScenarioData { scenario: BusCrowdingScenario; values: Record<BusCrowdingVersion, BusCrowdingValues> }

/** 路段 feature 屬性（segments.geojson）。 */
export interface BusCrowdingSegmentProps { li: number; sj: number; n: string; sn: string; a: string; b: string; syn?: number }

/** 是否會畫出來（同 opacity expression 的判斷；給點擊過濾與 popup 用）。 */
export function isDrawn(ov: unknown, n: unknown): boolean {
  return typeof ov === "number" && ov >= 0 && typeof n === "number" && n >= BUS_CROWDING_MIN_TRIPS;
}

/** 0–3 級；不畫回 null。 */
export function busCrowdingLevel(ov: unknown, n: unknown): number | null {
  if (!isDrawn(ov, n)) return null;
  const v = ov as number;
  if (v < BUS_CROWDING_NONZERO) return 0;
  return v < BUS_CROWDING_BREAKS[0] ? 1 : v < BUS_CROWDING_BREAKS[1] ? 2 : 3;
}

export const segmentKey = (li: number, sj: number) => `${li}_${sj}`;
