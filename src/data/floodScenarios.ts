/**
 * 淹水潛勢 10 種降雨情境（水利署淹水潛勢圖，G29 方向 A）。
 *
 * 單一出處：layerParamsSpec 的情境 select（encode 順序）、overlayRegistry 的
 * `sourceUrlByParam.urls`、圖例標題與 popup 都從這份取，順序即 `floodScenarioIdx`。
 * 每個情境一支 PMTiles（scripts/export/export-flood-scenarios.sh 產出，同一個 source-layer），
 * 切換情境時換 source url，不把 10 情境打成同一支再 filter。
 * 新增／改名要和匯出腳本的 SCENARIOS 同步。
 */
export interface FloodScenario {
  /** select 的 value，也是檔名尾段與切片內 `scenario` 屬性 */
  value: string;
  durationHr: number;
  rainfallMm: number;
}

export const FLOOD_SCENARIOS: readonly FloodScenario[] = [
  { value: "150mm_6hr", durationHr: 6, rainfallMm: 150 },
  { value: "250mm_6hr", durationHr: 6, rainfallMm: 250 },
  { value: "350mm_6hr", durationHr: 6, rainfallMm: 350 },
  { value: "200mm_12hr", durationHr: 12, rainfallMm: 200 },
  { value: "300mm_12hr", durationHr: 12, rainfallMm: 300 },
  { value: "400mm_12hr", durationHr: 12, rainfallMm: 400 },
  { value: "200mm_24hr", durationHr: 24, rainfallMm: 200 },
  { value: "350mm_24hr", durationHr: 24, rainfallMm: 350 },
  { value: "500mm_24hr", durationHr: 24, rainfallMm: 500 },
  { value: "650mm_24hr", durationHr: 24, rainfallMm: 650 },
];

/** 預設情境：維持改版前唯一的 650mm/24h，既有網址與畫面不變 */
export const FLOOD_SCENARIO_DEFAULT = "650mm_24hr";
export const FLOOD_SCENARIO_DEFAULT_INDEX = FLOOD_SCENARIOS.findIndex((s) => s.value === FLOOD_SCENARIO_DEFAULT);

export const floodScenarioUrl = (value: string): string => `./geo/water_flood_${value}.pmtiles`;

/** 「650 mm / 24 h」：數字與單位三語共用（純 ASCII，不需 param 翻譯） */
export function floodScenarioLabel(s: Pick<FloodScenario, "durationHr" | "rainfallMm">): string {
  return `${s.rainfallMm} mm / ${s.durationHr} h`;
}

/** overlayParams 的 `floodScenarioIdx` → 情境；越界退回預設 */
export function floodScenarioAt(index: number | undefined): FloodScenario {
  return FLOOD_SCENARIOS[index ?? FLOOD_SCENARIO_DEFAULT_INDEX] ?? FLOOD_SCENARIOS[FLOOD_SCENARIO_DEFAULT_INDEX]!;
}

/** popup 來源列（tile 不帶來源欄，panel 端補；FeatureInfoPanel 的 FOOTER_SELF_MANAGED_LAYER_TYPES） */
export const FLOOD_HAZARD_SOURCE = {
  source_org: "經濟部水利署 淹水潛勢圖（data.gov.tw 25766）",
  source_url: "https://data.gov.tw/dataset/25766",
  license: "政府資料開放授權條款第1版",
} as const;
