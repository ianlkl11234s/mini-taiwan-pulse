/**
 * 英國建成區與綠地（第 1 波 C023／C044／C043／C052，Ordnance Survey OpenData）：類別、色票、署名 SSOT。
 * 圖例、popup 與 hook paint 共用。授權原句見 taipei-gis-analytics
 * `docs/data-catalog/urban_composite/gb_built_up_areas.md`、`urban_open_space/gb_greenspace.md`（2026-10-29 讀 zip 內 licence.txt）。
 *
 * 色票全部沿用台灣同語意圖層的既有色：
 *   公園＝parksTaipei、遊戲場＝playgrounds、市民農園＝休閒農場（agriPOITypes leisure_farm）；
 *   運動 5 類＝台灣運動場館 5 層（sportsPark／sportsPublicOther／sportsSchool／sportsPrivate／sportsCenter）；
 *   墓園＝cemeteryOsm（FUNERAL_LAYER_COLORS）、宗教場地＝religionChurches；建成區＝buildingsGba 中性藍灰。
 */

export const GB_OS_ATTRIBUTION = "Contains OS data © Crown copyright and database right 2026";
export const GB_OS_LICENSE = "Open Government Licence v3.0";
export const GB_OS_FETCHED_AT = "2026-10-29";
export const GB_BUILT_UP_SOURCE_URL = "https://api.os.uk/downloads/v1/products/BuiltUpAreas";
export const GB_GREENSPACE_SOURCE_URL = "https://api.os.uk/downloads/v1/products/OpenGreenspace";
export const GB_BUILT_UP_VERSION = "OS Open Built Up Areas 2026-04";
export const GB_GREENSPACE_VERSION = "OS Open Greenspace 2026-04";

export const GB_BUILT_UP_COLOR = "#78909c";

/** `category` 欄位值＝三個圖層 key 各自的 filter。 */
export type GbGreenspaceCategory = "park" | "sports" | "burial";
export type GbGreenspaceKey = "gbGreenspace" | "gbSportsFacilities" | "gbCemeteries";

export type GbGreenspaceFunctionId =
  | "Park" | "Play" | "Allotment" | "PlayingField" | "OtherSports" | "Tennis" | "Bowling" | "Golf" | "Cemetery" | "Religious";

export interface GbGreenspaceFunction {
  /** `function` 欄位原值（OS 產品的英文分類名） */
  value: string;
  /** 圖例與 popup 的 i18n key 對照（legend.urban.gbFn<id>／popup.baseMap.gbFn<id>） */
  id: GbGreenspaceFunctionId;
  color: string;
  /** 切片內筆數（taipei-gis-analytics layer-plan 2026-10-29 自查） */
  count: number;
}

export const GB_GREENSPACE_CATEGORIES: Readonly<Record<GbGreenspaceKey, {
  category: GbGreenspaceCategory; layerColor: string; minzoom: number; functions: readonly GbGreenspaceFunction[];
}>> = {
  gbGreenspace: {
    category: "park", layerColor: "#7cb342", minzoom: 9,
    functions: [
      { value: "Public Park Or Garden", id: "Park", color: "#7cb342", count: 22_106 },
      { value: "Play Space", id: "Play", color: "#ec4899", count: 45_034 },
      { value: "Allotments Or Community Growing Spaces", id: "Allotment", color: "#2e7d32", count: 13_778 },
    ],
  },
  gbSportsFacilities: {
    category: "sports", layerColor: "#66bb6a", minzoom: 10,
    functions: [
      { value: "Playing Field", id: "PlayingField", color: "#66bb6a", count: 21_855 },
      { value: "Other Sports Facility", id: "OtherSports", color: "#26a69a", count: 16_303 },
      { value: "Tennis Court", id: "Tennis", color: "#5c6bc0", count: 7_173 },
      { value: "Bowling Green", id: "Bowling", color: "#ef6c00", count: 6_541 },
      { value: "Golf Course", id: "Golf", color: "#ec407a", count: 2_980 },
    ],
  },
  gbCemeteries: {
    category: "burial", layerColor: "#4a7c59", minzoom: 10,
    functions: [
      { value: "Cemetery", id: "Cemetery", color: "#4a7c59", count: 7_748 },
      { value: "Religious Grounds", id: "Religious", color: "#7986cb", count: 22_460 },
    ],
  },
};

export const GB_GREENSPACE_KEYS = Object.keys(GB_GREENSPACE_CATEGORIES) as GbGreenspaceKey[];
export const GB_GREENSPACE_FALLBACK_COLOR = "#94a3b8";

const FUNCTION_BY_VALUE = new Map(
  Object.values(GB_GREENSPACE_CATEGORIES).flatMap((c) => c.functions).map((f) => [f.value, f]),
);

export function gbGreenspaceFunction(value: unknown): GbGreenspaceFunction | undefined {
  return typeof value === "string" ? FUNCTION_BY_VALUE.get(value) : undefined;
}

/** `["match", ["get","function"], …]` 分色表達式。 */
export function gbGreenspaceColorExpr(key: GbGreenspaceKey): unknown[] {
  const expr: unknown[] = ["match", ["get", "function"]];
  for (const f of GB_GREENSPACE_CATEGORIES[key].functions) expr.push(f.value, f.color);
  expr.push(GB_GREENSPACE_FALLBACK_COLOR);
  return expr;
}
