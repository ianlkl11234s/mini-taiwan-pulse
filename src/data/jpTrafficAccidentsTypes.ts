// 日本第二輪 C083（2026-11-06）：警察庁 交通事故統計情報のオープンデータ 2025 本票 → jpTrafficAccidents2025。
// 色票與地圖 paint、圖例、popup 同源；件數來自 analytics jp_traffic_accidents_2025_qa.json。
import { allMultiSelectBitmask, multiSelectFilter } from "./multiSelectMapbox";

const valuesOf = (options: readonly { value: string }[]) => options.map((option) => option.value);

/** 事故内容：死亡（24 小時內死亡）／負傷。色票沿用台灣 trafficAccidents2025 的 A1／A2。 */
export const JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS = [
  { value: "fatal", label: "死亡事故（24 小時內死亡）", color: "#dc2626", count: 2_495 },
  { value: "injury", label: "負傷事故", color: "#f97316", count: 284_525 },
] as const;

/** 事故類型（本票），依件數排序。 */
export const JP_TRAFFIC_ACCIDENT_TYPE_OPTIONS = [
  { value: "veh", label: "車輛相撞（車両相互）", count: 235_947 },
  { value: "ped", label: "人車事故（人対車両）", count: 38_693 },
  { value: "single", label: "車輛單獨（車両単独）", count: 12_325 },
  { value: "train", label: "平交道列車（列車）", count: 55 },
] as const;

/** 当事者種別粗分（tile 屬性 pa／pb）。 */
export const JP_TRAFFIC_ACCIDENT_PARTY_LABELS: Record<string, string> = {
  car: "乘用車", truck: "貨車", special: "特種車", motorcycle: "機車（自動二輪）", moped: "輕型機車（原付）",
  eScooter: "特定小型原付（電動滑板車等）", bicycle: "自行車", otherLight: "其他輕車輛", train: "列車／路面電車",
  pedestrian: "行人", object: "物件（電桿、護欄、停放車輛等）", none: "無對象（自摔、翻覆）",
};
export const JP_TRAFFIC_ACCIDENT_LIGHT_LABELS: Record<string, string> = { day: "白天", night: "夜間" };
export const JP_TRAFFIC_ACCIDENT_WEATHER_LABELS: Record<string, string> = { clear: "晴", cloudy: "陰", rain: "雨", fog: "霧", snow: "雪" };
export const JP_TRAFFIC_ACCIDENT_SURFACE_LABELS: Record<string, string> = {
  dry: "乾燥", wet: "濕滑", frozen: "結冰", snow: "積雪", unpaved: "非鋪裝",
};
export const JP_TRAFFIC_ACCIDENT_ROAD_LABELS: Record<string, string> = {
  intersection: "交叉路口", nearIntersection: "路口附近（30 m 內）", tunnel: "隧道", bridge: "橋梁", curve: "彎道",
  straight: "一般路段", crossing: "平交道", offRoad: "一般通行場所（道路外）",
};

export const JP_TRAFFIC_ACCIDENT_SEVERITY_VALUES = valuesOf(JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS);
export const JP_TRAFFIC_ACCIDENT_TYPE_VALUES = valuesOf(JP_TRAFFIC_ACCIDENT_TYPE_OPTIONS);
export const JP_TRAFFIC_ACCIDENT_TOTAL = 287_020;
export const JP_TRAFFIC_ACCIDENT_PERIOD = "2025-01-01～2025-12-31";
export const JP_TRAFFIC_ACCIDENT_SOURCE = {
  source_org: "警察庁 交通事故統計情報のオープンデータ（2025 本票）",
  source_url: "https://www.npa.go.jp/publications/statistics/koutsuu/opendata/index_opendata.html",
  license: "公共データ利用規約 第1.0版（PDL1.0）",
  fetched_at: "2026-11-06",
} as const;

export function jpTrafficAccidentFilter(
  severityMask = allMultiSelectBitmask(JP_TRAFFIC_ACCIDENT_SEVERITY_VALUES),
  typeMask = allMultiSelectBitmask(JP_TRAFFIC_ACCIDENT_TYPE_VALUES),
): unknown[] {
  return ["all",
    multiSelectFilter("sev", severityMask, JP_TRAFFIC_ACCIDENT_SEVERITY_VALUES),
    multiSelectFilter("type", typeMask, JP_TRAFFIC_ACCIDENT_TYPE_VALUES),
  ];
}
