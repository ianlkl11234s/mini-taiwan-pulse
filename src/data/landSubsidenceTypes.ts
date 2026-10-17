/**
 * 地層下陷＋海堤（G19，2026-10-17）分類、色票與 Mapbox filter SSOT —— manifest／overlay／legend／popup 共用。
 * 資料由 scripts/preprocess/build-land-subsidence-public.py 從 taipei-gis-analytics water_resources 成品產出；
 * 規格 SSOT：analytics docs/topic-research/land_subsidence/layer-plan.md。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step。
 */
import type { AtlasOption } from "./atlasLayerTypes";

// ── 測站 ──────────────────────────────────────────────────────────────

/** station_type 三類（量測方式不同，數值不可互比）。label 與上游 station_type_label 同字。 */
export const STATION_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "gnss", label: "GNSS 測站", color: "#0ea5e9" },
  { value: "magnetic_ring", label: "磁環分層監測井", color: "#a855f7" },
  { value: "deep_pile", label: "深層水準樁", color: "#f59e0b" },
];
/** 各類監測涵蓋期（圖例用；layer-plan §1）。 */
export const STATION_COVERAGE = { gnss: "2011-01～2025-12", magnetic_ring: "1995-07～2026-03", deep_pile: "2016-05～2025-04" } as const;

// ── 等值線（PMTiles source-layer contours；z9 起 696 條完整，z5–z8 少數短線被簡化掉）──

export const CONTOUR_SOURCE_LAYER = "contours";
export type ContourType = "cumulative" | "rate";

/** 期別清單（由預處理腳本印出後貼上；fname 唯一，county／period 為上游值）。 */
export const CONTOUR_PERIODS: readonly { type: ContourType; fname: string; county: string; period: string }[] = [
  { type: "cumulative", fname: "CY80104", county: "嘉義縣", period: "民國80–104年" },
  { type: "cumulative", fname: "CY80109", county: "嘉義縣", period: "民國80–109年" },
  { type: "cumulative", fname: "CY80110", county: "嘉義縣", period: "民國80–110年" },
  { type: "cumulative", fname: "CY80111", county: "嘉義縣", period: "民國80–111年" },
  { type: "cumulative", fname: "CY80112", county: "嘉義縣", period: "民國80–112年" },
  { type: "cumulative", fname: "CY80113", county: "嘉義縣", period: "民國80–113年" },
  { type: "cumulative", fname: "IL81103", county: "宜蘭縣", period: "民國81–103年" },
  { type: "cumulative", fname: "IL81112", county: "宜蘭縣", period: "民國81–112年" },
  { type: "cumulative", fname: "PT83104", county: "屏東縣", period: "民國83–104年" },
  { type: "cumulative", fname: "PT83110", county: "屏東縣", period: "民國83–110年" },
  { type: "cumulative", fname: "PT83111", county: "屏東縣", period: "民國83–111年" },
  { type: "cumulative", fname: "PT83112", county: "屏東縣", period: "民國83–112年" },
  { type: "cumulative", fname: "PT83113", county: "屏東縣", period: "民國83–113年" },
  { type: "cumulative", fname: "PT90109", county: "屏東縣", period: "民國90–109年" },
  { type: "cumulative", fname: "CH81104", county: "彰化縣", period: "民國81–104年" },
  { type: "cumulative", fname: "CH81109", county: "彰化縣", period: "民國81–109年" },
  { type: "cumulative", fname: "CH81110", county: "彰化縣", period: "民國81–110年" },
  { type: "cumulative", fname: "CH81111", county: "彰化縣", period: "民國81–111年" },
  { type: "cumulative", fname: "CH81112", county: "彰化縣", period: "民國81–112年" },
  { type: "cumulative", fname: "CH81113", county: "彰化縣", period: "民國81–113年" },
  { type: "cumulative", fname: "TY9199", county: "桃園市", period: "民國91–99年" },
  { type: "cumulative", fname: "TY91110", county: "桃園市", period: "民國91–110年" },
  { type: "cumulative", fname: "TP83103", county: "臺北市", period: "民國83–103年" },
  { type: "cumulative", fname: "TP83109", county: "臺北市", period: "民國83–109年" },
  { type: "cumulative", fname: "TP83112", county: "臺北市", period: "民國83–112年" },
  { type: "cumulative", fname: "TP83113", county: "臺北市", period: "民國83–113年" },
  { type: "cumulative", fname: "TN90103", county: "臺南市", period: "民國90–103年" },
  { type: "cumulative", fname: "TN90112", county: "臺南市", period: "民國90–112年" },
  { type: "cumulative", fname: "ML96111", county: "苗栗縣", period: "民國96–111年" },
  { type: "cumulative", fname: "YL81104", county: "雲林縣", period: "民國81–104年" },
  { type: "cumulative", fname: "YL81109", county: "雲林縣", period: "民國81–109年" },
  { type: "cumulative", fname: "YL81110", county: "雲林縣", period: "民國81–110年" },
  { type: "cumulative", fname: "YL81111", county: "雲林縣", period: "民國81–111年" },
  { type: "cumulative", fname: "YL81112", county: "雲林縣", period: "民國81–112年" },
  { type: "cumulative", fname: "YL81113", county: "雲林縣", period: "民國81–113年" },
  { type: "cumulative", fname: "KH9198", county: "高雄市", period: "民國91–98年" },
  { type: "cumulative", fname: "KH95104", county: "高雄市", period: "民國95–104年" },
  { type: "cumulative", fname: "KH95109", county: "高雄市", period: "民國95–109年" },
  { type: "cumulative", fname: "KH95113", county: "高雄市", period: "民國95–113年" },
  { type: "rate", fname: "TW9091", county: "全台", period: "民國90–91年" },
  { type: "rate", fname: "TW9192", county: "全台", period: "民國91–92年" },
  { type: "rate", fname: "TW9293", county: "全台", period: "民國92–93年" },
  { type: "rate", fname: "TW9394", county: "全台", period: "民國93–94年" },
  { type: "rate", fname: "TW9495", county: "全台", period: "民國94–95年" },
  { type: "rate", fname: "TW9596", county: "全台", period: "民國95–96年" },
  { type: "rate", fname: "TW9697", county: "全台", period: "民國96–97年" },
  { type: "rate", fname: "TW9798", county: "全台", period: "民國97–98年" },
  { type: "rate", fname: "TW9899", county: "全台", period: "民國98–99年" },
  { type: "rate", fname: "TW9900", county: "全台", period: "民國99–100年" },
  { type: "rate", fname: "TW0001", county: "全台", period: "民國100–101年" },
  { type: "rate", fname: "TW0102", county: "全台", period: "民國101–102年" },
  { type: "rate", fname: "TW0203", county: "全台", period: "民國102–103年" },
  { type: "rate", fname: "TW0304", county: "全台", period: "民國103–104年" },
  { type: "rate", fname: "TW0607", county: "全台", period: "民國106–107年" },
  { type: "rate", fname: "TW108109", county: "全台", period: "民國108–109年" },
  { type: "rate", fname: "CY106107", county: "嘉義縣", period: "民國106–107年" },
  { type: "rate", fname: "CY108109", county: "嘉義縣", period: "民國108–109年" },
  { type: "rate", fname: "CY109110", county: "嘉義縣", period: "民國109–110年" },
  { type: "rate", fname: "CY110111", county: "嘉義縣", period: "民國110–111年" },
  { type: "rate", fname: "CY111112", county: "嘉義縣", period: "民國111–112年" },
  { type: "rate", fname: "CY112113", county: "嘉義縣", period: "民國112–113年" },
  { type: "rate", fname: "IL106107", county: "宜蘭縣", period: "民國106–107年" },
  { type: "rate", fname: "IL107112", county: "宜蘭縣", period: "民國107–112年" },
  { type: "rate", fname: "PT106107", county: "屏東縣", period: "民國106–107年" },
  { type: "rate", fname: "PT108109", county: "屏東縣", period: "民國108–109年" },
  { type: "rate", fname: "PT109110", county: "屏東縣", period: "民國109–110年" },
  { type: "rate", fname: "PT110111", county: "屏東縣", period: "民國110–111年" },
  { type: "rate", fname: "PT111112", county: "屏東縣", period: "民國111–112年" },
  { type: "rate", fname: "PT112113", county: "屏東縣", period: "民國112–113年" },
  { type: "rate", fname: "CH106107", county: "彰化縣", period: "民國106–107年" },
  { type: "rate", fname: "CH108109", county: "彰化縣", period: "民國108–109年" },
  { type: "rate", fname: "CH109110", county: "彰化縣", period: "民國109–110年" },
  { type: "rate", fname: "CH110111", county: "彰化縣", period: "民國110–111年" },
  { type: "rate", fname: "CH111112", county: "彰化縣", period: "民國111–112年" },
  { type: "rate", fname: "CH112113", county: "彰化縣", period: "民國112–113年" },
  { type: "rate", fname: "TC107111", county: "臺中市", period: "民國107–111年" },
  { type: "rate", fname: "TP111112", county: "臺北市", period: "民國111–112年" },
  { type: "rate", fname: "TP112113", county: "臺北市", period: "民國112–113年" },
  { type: "rate", fname: "TN108112", county: "臺南市", period: "民國108–112年" },
  { type: "rate", fname: "ML107111", county: "苗栗縣", period: "民國107–111年" },
  { type: "rate", fname: "YL106107", county: "雲林縣", period: "民國106–107年" },
  { type: "rate", fname: "YL108109", county: "雲林縣", period: "民國108–109年" },
  { type: "rate", fname: "YL109110", county: "雲林縣", period: "民國109–110年" },
  { type: "rate", fname: "YL110111", county: "雲林縣", period: "民國110–111年" },
  { type: "rate", fname: "YL111112", county: "雲林縣", period: "民國111–112年" },
  { type: "rate", fname: "YL112113", county: "雲林縣", period: "民國112–113年" },
  { type: "rate", fname: "KH109113", county: "高雄市", period: "民國109–113年" },
];

/** select 哨兵：各縣市最新期（is_latest=true）。 */
export const CONTOUR_LATEST = "latest";
export const CONTOUR_ALL = "all";

/** 選單 label：「各縣市最新期」「全部期別（重疊）」＋「縣市 民國A–B年」。 */
export function contourPeriodOptions(type: ContourType): { value: string; label: string }[] {
  return [
    { value: CONTOUR_LATEST, label: "各縣市最新期" },
    { value: CONTOUR_ALL, label: "全部期別（重疊）" },
    ...CONTOUR_PERIODS.filter((p) => p.type === type).map((p) => ({ value: p.fname, label: `${p.county} ${p.period}` })),
  ];
}
export const CUMULATIVE_PERIOD_OPTIONS = contourPeriodOptions("cumulative");
export const RATE_PERIOD_OPTIONS = contourPeriodOptions("rate");

/** type + 期別 index → filter（index 對 encode＝options 的 value 順序）。 */
export function contourFilter(type: ContourType, idx: number | undefined): unknown[] {
  const options = type === "cumulative" ? CUMULATIVE_PERIOD_OPTIONS : RATE_PERIOD_OPTIONS;
  const value = options[idx ?? 0]?.value ?? CONTOUR_LATEST;
  const base = ["==", ["get", "contour_type"], type];
  if (value === CONTOUR_ALL) return base;
  if (value === CONTOUR_LATEST) return ["all", base, ["==", ["get", "is_latest"], true]];
  return ["all", base, ["==", ["get", "fname"], value]];
}

/** 色階：負＝下陷（紅系，越深越紅）、0 灰、正＝抬升（藍系）。 */
export const CUMULATIVE_STEPS = [
  { value: -200, color: "#7f1d1d", label: "≤ −200" },
  { value: -100, color: "#dc2626", label: "−100" },
  { value: -50, color: "#f97316", label: "−50" },
  { value: -10, color: "#fdba74", label: "−10" },
  { value: 0, color: "#9ca3af", label: "0" },
  { value: 50, color: "#60a5fa", label: "+50" },
  { value: 150, color: "#1d4ed8", label: "≥ +150" },
] as const;
export const RATE_STEPS = [
  { value: -10, color: "#7f1d1d", label: "≤ −10" },
  { value: -5, color: "#dc2626", label: "−5" },
  { value: -3, color: "#f97316", label: "−3" },
  { value: -1, color: "#fdba74", label: "−1" },
  { value: 0, color: "#9ca3af", label: "0" },
  { value: 1, color: "#60a5fa", label: "+1" },
  { value: 2, color: "#1d4ed8", label: "≥ +2" },
] as const;

export function contourColorExpr(type: ContourType): unknown[] {
  const steps = type === "cumulative" ? CUMULATIVE_STEPS : RATE_STEPS;
  return ["interpolate", ["linear"], ["to-number", ["get", "level_value"], 0], ...steps.flatMap((s) => [s.value, s.color])];
}

// ── 海堤 ──────────────────────────────────────────────────────────────

export const SEAWALL_MIN_ZOOM = 8;
