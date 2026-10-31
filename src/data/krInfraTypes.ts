/**
 * 南韓第 1 波（國土基礎）13 個圖層 key／14 個 tile layer 的類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 交通：krBusStops、krRailStations、krAirports、krPorts、krNationalRoads、krRailLines；
 * 能源：krFuelStations、krPowerPlants、krRenewables、krPowerLines／krSubstations／krPowerTowers、krOilGas（設施＋管線）。
 * 授權原句、筆數、涵蓋驗算見 taipei-gis-analytics `docs/data-catalog/{transportation,energy}/kr_*.md` 與
 * `docs/topic-research/south_korea_opendata/waves/w1/layer-plan.md`（2026-10-31）。
 *
 * 色票沿用台灣／日本／英國同語意（資料色，spec §3.16）：燃料別＝`FUEL_COLORS`；電壓分級＝台灣 osmPowerLines 4 色；
 * 公車站＝日本公車站主色；機場／港口／國道／鐵道線＝英國同類色票。
 */
import { FACILITY_STATUS_PAINT_COLORS, FOSSIL_PAINT_COLORS } from "../map/layerPaintColors";
import { FUEL_COLORS, FUEL_FALLBACK_COLOR } from "./energyLoader";
import { JP_BUS_STOP_CLASSES } from "./jpBusStopTypes";

export const KR_FETCHED_AT = "2026-10-31";
export const KR_OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const KR_OSM_URL = "https://www.openstreetmap.org/copyright";
/** 授權寫成各語言都通用的中性字串（SourceFooter 直接顯示）。 */
export const KR_OSM_LICENSE = "ODbL 1.0";
export const KR_PORTAL_LICENSE_URL = "https://www.data.go.kr/ugs/selectPortalPolicyView.do";
/** data.go.kr 官方層授權：平台標籤「이용허락범위 제한 없음」（非 KOGL 類型，商用未標）；中性寫成韓文原句＋英文。 */
export const KR_PORTAL_LICENSE = "이용허락범위 제한 없음 (No usage restriction, data.go.kr)";
export const KR_FALLBACK_COLOR = FUEL_FALLBACK_COLOR;

const fuel = (key: string) => FUEL_COLORS[key] ?? FUEL_FALLBACK_COLOR;
const portal = (title: string, pk: string) => `${title}（공공데이터포털 ${pk}）`;

/** OSM 空值寫法一律視為缺值。 */
export function krText(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return /^(none|nan|nat|null|\?)$/i.test(s) ? "" : s;
}
export function krNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────── 交通 ───────────────────────────

export const KR_BUS_STOPS_COLOR = JP_BUS_STOP_CLASSES[0].color;
export const KR_BUS_STOPS_COUNT = 227_059;
export const KR_BUS_STOPS_ATTRIBUTION = portal("국토교통부_전국 버스정류장 위치정보", "15067528");
export const KR_BUS_STOPS_URL = "https://www.data.go.kr/data/15067528/fileData.do";

export type KrRailNetwork = "korail_only" | "urban_only" | "both";
/** 宣告順序＝圖例順序；count＝去重後站數（KORAIL 202 站＋都市鐵道 898 列）。 */
export const KR_RAIL_NETWORKS: readonly { value: KrRailNetwork; color: string; count: number }[] = [
  { value: "korail_only", color: "#b8a080", count: 181 },
  { value: "urban_only", color: "#00bcd4", count: 753 },
  { value: "both", color: "#ab47bc", count: 21 },
];
export const KR_RAIL_STATIONS_COLOR = "#b8a080";
export const KR_RAIL_STATIONS_ATTRIBUTION = `${portal("한국철도공사_역 위치 정보", "15127532")}／${portal("전국도시철도역사정보표준데이터", "15013205")}`;
export const KR_RAIL_STATIONS_URL = "https://www.data.go.kr/data/15127532/fileData.do";
export const krRailNetwork = (value: unknown) => KR_RAIL_NETWORKS.find((n) => n.value === value);

export const KR_AIRPORT_COLOR = "#daa520";
export const KR_AIRPORTS_ATTRIBUTION = `${portal("한국공항공사_공항 위치정보", "15002851")}／${KR_OSM_ATTRIBUTION}（仁川 Incheon）`;
export const KR_AIRPORTS_URL = "https://www.data.go.kr/data/15002851/fileData.do";

export const KR_PORT_COLOR = "#4a90d9";
export const KR_PORTS_ATTRIBUTION = portal("해양수산부 국립해양조사원_항만구역", "15130180");
export const KR_PORTS_URL = "https://www.data.go.kr/data/15130180/fileData.do";

export const KR_NATIONAL_ROAD_COLOR = "#fcd34d";
export const KR_NATIONAL_ROADS_ATTRIBUTION = portal("국토교통부_일반국도 도로중심선", "15122482");
export const KR_NATIONAL_ROADS_URL = "https://www.data.go.kr/data/15122482/fileData.do";

export type KrRailLineClass = "main" | "branch" | "subway" | "light_rail" | "yard_service" | "other";
/** `line_class` 原值（industrial／military／tourism／test／unclassified）併入「其他」。宣告順序＝圖例順序；length＝路段長 km。 */
export const KR_RAIL_LINE_CLASSES: readonly { value: KrRailLineClass; raw: readonly string[]; color: string; width: "emphasis" | "standard" | "thin"; opacity: number; count: number }[] = [
  { value: "main", raw: ["main"], color: "#b8a080", width: "emphasis", opacity: 0.95, count: 12_099 },
  { value: "branch", raw: ["branch"], color: "#b8a080", width: "standard", opacity: 0.85, count: 1_093 },
  { value: "subway", raw: ["subway"], color: "#3b82f6", width: "standard", opacity: 0.9, count: 2_220 },
  { value: "light_rail", raw: ["light_rail"], color: "#14b8a6", width: "standard", opacity: 0.9, count: 351 },
  { value: "yard_service", raw: ["yard_service"], color: "#9ca3af", width: "thin", opacity: 0.55, count: 8_127 },
  { value: "other", raw: ["industrial", "military", "tourism", "test", "unclassified"], color: "#9ca3af", width: "thin", opacity: 0.7, count: 596 },
];
export const KR_RAIL_LINES_COLOR = "#b8a080";
export const krRailLineClass = (value: unknown) => KR_RAIL_LINE_CLASSES.find((c) => c.raw.includes(String(value)));

// ─────────────────────────── 能源 ───────────────────────────

/** 燃料別（OSM plant:source／generator:source 正規化後）；宣告順序＝圖例順序。 */
export type KrFuelGroup = "solar" | "wind" | "hydro" | "pumped_hydro" | "biomass" | "marine" | "geothermal" | "nuclear" | "coal" | "gas" | "oil" | "other" | "unknown";
export const KR_FUEL_GROUPS: readonly { value: KrFuelGroup; color: string }[] = [
  { value: "solar", color: fuel("solar") },
  { value: "wind", color: fuel("wind") },
  { value: "hydro", color: fuel("hydro") },
  { value: "pumped_hydro", color: fuel("storage") },
  { value: "biomass", color: fuel("bioenergy") },
  { value: "marine", color: fuel("other") },
  { value: "geothermal", color: fuel("geothermal") },
  { value: "nuclear", color: fuel("nuclear") },
  { value: "coal", color: fuel("coal") },
  { value: "gas", color: fuel("natural_gas") },
  { value: "oil", color: fuel("oil") },
  { value: "other", color: fuel("other") },
];
/** 電廠圖例的燃料別（含火力與核能）／再生能源圖例的子集。 */
export const KR_PLANT_FUELS: readonly KrFuelGroup[] = ["solar", "wind", "hydro", "pumped_hydro", "biomass", "marine", "nuclear", "coal", "gas", "oil", "other"];
export const KR_RENEWABLE_FUELS: readonly KrFuelGroup[] = ["solar", "wind", "hydro", "biomass"];
export const KR_POWER_PLANTS_COLOR = fuel("natural_gas");
export const KR_RENEWABLES_COLOR = fuel("solar");
export const krFuelGroup = (value: unknown) => KR_FUEL_GROUPS.find((g) => g.value === value);
/** 裝置容量分級（MW），半徑沿用台灣電廠 `CAPACITY_RADIUS`；未標容量用最小級。 */
export const KR_CAPACITY_BANDS: readonly { min: number; radius: number; label: string }[] = [
  { min: 0, radius: 3, label: "<10" },
  { min: 10, radius: 4.5, label: "10–100" },
  { min: 100, radius: 7, label: "100–1,000" },
  { min: 1000, radius: 11, label: "≥1,000" },
];

/** 電網電壓分級（OSM voltage，韓國 765／345／154kV 輸電）；色票沿用台灣 osmPowerLines 4 色。 */
export type KrVoltageClass = "ehv_765" | "hv_345" | "hv_154" | "mv_lt100" | "unknown";
export const KR_VOLTAGE_CLASSES: readonly { value: KrVoltageClass; color: string; width: number; opacity: number; radius: number }[] = [
  { value: "ehv_765", color: "#1AB6D9", width: 3.6, opacity: 1, radius: 7 },
  { value: "hv_345", color: "#1AB6D9", width: 3, opacity: 1, radius: 6 },
  { value: "hv_154", color: "#62D9AD", width: 1.8, opacity: 1, radius: 4.5 },
  { value: "mv_lt100", color: "#468BA6", width: 0.8, opacity: 0.55, radius: 2.5 },
  { value: "unknown", color: "#DFE0DC", width: 0.8, opacity: 0.7, radius: 2.5 },
];
export const KR_POWER_LINES_COLOR = "#62D9AD";
export const KR_SUBSTATIONS_COLOR = "#1AB6D9";
export const KR_TOWERS_COLOR = "#468BA6";
export const KR_TOWERS_MINZOOM = 11;
export const krVoltageClass = (value: unknown) => KR_VOLTAGE_CLASSES.find((v) => v.value === value);

export type KrFuelType = "ev_kepco" | "lpg" | "hydrogen" | "cng_lng";
/** 宣告順序＝圖例順序；count＝原始座標有效筆數。 */
export const KR_FUEL_TYPES: readonly { value: KrFuelType; color: string; count: number }[] = [
  { value: "ev_kepco", color: "#10b981", count: 4_672 },
  { value: "lpg", color: FOSSIL_PAINT_COLORS.lpgRetailers, count: 1_964 },
  { value: "hydrogen", color: FOSSIL_PAINT_COLORS.industrialStorageTank, count: 278 },
  { value: "cng_lng", color: FOSSIL_PAINT_COLORS.pipelineGas, count: 192 },
];
export const KR_FUEL_STATIONS_COLOR = FOSSIL_PAINT_COLORS.gasStationCanonical;
export const krFuelType = (value: unknown) => KR_FUEL_TYPES.find((f) => f.value === value);
export const KR_FUEL_STATIONS_ATTRIBUTION =
  `${portal("한국가스안전공사 LPG·도시가스·수소충전소 현황", "15001643/15001508/15066838")}／${portal("한국전력공사_전기차충전소위경도", "15102458")}`;
export const KR_FUEL_STATIONS_URL = "https://www.data.go.kr/data/15001643/fileData.do";

export type KrOilGasType = "refinery" | "oil_depot" | "gas" | "lng_terminal" | "storage_tank";
export const KR_OIL_GAS_TYPES: readonly { value: KrOilGasType; color: string; count: number }[] = [
  { value: "refinery", color: FOSSIL_PAINT_COLORS.industrialRefinery, count: 1 },
  { value: "oil_depot", color: fuel("oil"), count: 7 },
  { value: "gas", color: fuel("natural_gas"), count: 15 },
  { value: "lng_terminal", color: FOSSIL_PAINT_COLORS.lngTerminal, count: 9 },
  { value: "storage_tank", color: FOSSIL_PAINT_COLORS.industrialStorageTank, count: 114 },
];
export const KR_OIL_GAS_COLOR = fuel("oil");
export const KR_PIPELINE_COLORS = { gas: FOSSIL_PAINT_COLORS.pipelineGas, oil: fuel("oil"), hydrocarbons: FOSSIL_PAINT_COLORS.pipelineOilGas } as const;
export const krOilGasType = (value: unknown) => KR_OIL_GAS_TYPES.find((t) => t.value === value);

export { FACILITY_STATUS_PAINT_COLORS };
