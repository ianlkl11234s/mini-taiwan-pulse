// 南韓國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { KrLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { heatmapPalette, krCatFilterSpecs, krMulti, type KrOpt, opacitySlider, scaleSlider } from "../../data/layerParamsSpec";
import { densePointOpacity } from "../../map/mapStyleScale";
import { KR_DATA_SPECS } from "./krDataLayers";

const KR_OPT_RAIL_NETWORK: KrOpt = [["korail_only", "KORAIL 幹線車站"], ["urban_only", "都市鐵道車站"], ["both", "KORAIL 與都市鐵道共站"]];

const KR_OPT_RAIL_CLASS: KrOpt = [["main", "幹線"], ["branch", "支線"], ["subway", "地鐵"], ["light_rail", "輕軌"], ["yard_service", "側線／車庫線"], ["other", "其他（工業、軍用、觀光、測試）"]];

const KR_OPT_FUEL_TYPE: KrOpt = [["ev_kepco", "電動車充電站（KEPCO 營運）"], ["lpg", "LPG 充電站"], ["hydrogen", "氫能充電站"], ["cng_lng", "CNG／LNG 充電站"]];

const KR_OPT_PLANT_FUEL: KrOpt = [
  ["solar", "太陽光電"], ["wind", "風力"], ["hydro", "水力"], ["pumped_hydro", "抽蓄水力"], ["biomass", "生質能／廢棄物"], ["marine", "海洋能"],
  ["nuclear", "核能"], ["coal", "燃煤"], ["gas", "燃氣"], ["oil", "燃油"], ["other", "其他／未標"],
];

const KR_OPT_VOLTAGE: KrOpt = [["ehv_765", "765 kV"], ["hv_345", "345 kV"], ["hv_154", "154 kV"], ["mv_lt100", "<100 kV（配電、鐵路牽引）"], ["unknown", "OSM 未標電壓"]];

const KR_OPT_OIL_GAS: KrOpt = [["refinery", "煉油廠"], ["oil_depot", "油庫／油品儲存區"], ["gas", "天然氣設施"], ["lng_terminal", "LNG 接收基地"], ["storage_tank", "油氣儲槽"]];

const KR_OPT_PIPELINE: KrOpt = [["gas", "天然氣管線"], ["oil", "輸油管線"], ["hydrocarbons", "碳氫化合物管線"]];


export const KR_PACK_PARAMS = {
  // 南韓第 3–5 波（2026-10-31）：點層＝透明度＋大小，線／面層＝透明度。預設不透明度點層依筆數（P-3）。
  // V-4：圖例有名目分類者加類別多選（`${key}CatMask`）；V-1：拉遠改熱區者加熱區顏色（P-4）。
  ...Object.fromEntries(KR_DATA_SPECS.map((spec) => [spec.key, [
    ...krCatFilterSpecs(spec),
    ...(spec.heat ? [heatmapPalette(spec.key)] : []),
    ...(spec.geom === "point"
      ? [opacitySlider(`${spec.key}Opacity`, densePointOpacity(spec.count)), scaleSlider(`${spec.key}Scale`, 1)]
      : [opacitySlider(`${spec.key}Opacity`, spec.geom === "polygon" ? (spec.key === "krNationalParks" ? 0.5 : spec.key === "krPopulationH3" ? 0.6 : spec.key === "krSchoolDistricts" ? 0.35 : spec.key === "krSeoulZoning" ? 0.32 : 0.7) : 0.85)]),
  ]])),
  // 南韓 KRH-1：生態自然圖（拍板透明度 0.55）、垃圾排出規則（淡色面）
  krEcologyNaturalness: [opacitySlider("krEcologyNaturalnessOpacity", 0.55)],
  krWasteDisposalRules: [opacitySlider("krWasteDisposalRulesOpacity", 0.3)],
  krAdminBoundaries: [
    opacitySlider("krAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "krAdminBoundariesLevel", label: "行政層級", default: "sido",
      options: [{ label: "道級（시·도）", value: "sido" }, { label: "市郡區（시군구）", value: "sgg" }, { label: "行政洞（행정동）", value: "emd" }],
      out: "krAdminBoundariesLevelIdx", encode: ["sido", "sgg", "emd"],
    },
  ],
  // 南韓第 1 波（國土基礎）：公車站（P-4 熱區）、點層（透明度＋大小）、線／面（透明度）
  krBusStops: [heatmapPalette("krBusStops"), opacitySlider("krBusStopsOpacity", densePointOpacity(227_059)), scaleSlider("krBusStopsScale", 1)],
  krRailStations: [krMulti("krRailStationsCatMask", "營運網", KR_OPT_RAIL_NETWORK), opacitySlider("krRailStationsOpacity", densePointOpacity(955)), scaleSlider("krRailStationsScale", 1)],
  krAirports: [opacitySlider("krAirportsOpacity", 0.85), scaleSlider("krAirportsScale", 1)],
  krPorts: [opacitySlider("krPortsOpacity", 0.45)],
  krNationalRoads: [opacitySlider("krNationalRoadsOpacity", 0.85)],
  krRailLines: [krMulti("krRailLinesCatMask", "線別", KR_OPT_RAIL_CLASS), opacitySlider("krRailLinesOpacity", 0.85)],
  krFuelStations: [krMulti("krFuelStationsCatMask", "燃料別", KR_OPT_FUEL_TYPE), heatmapPalette("krFuelStations"), opacitySlider("krFuelStationsOpacity", densePointOpacity(7_106)), scaleSlider("krFuelStationsScale", 1)],
  krPowerPlants: [krMulti("krPowerPlantsCatMask", "燃料別", KR_OPT_PLANT_FUEL), opacitySlider("krPowerPlantsOpacity", densePointOpacity(4_308)), scaleSlider("krPowerPlantsScale", 1)],
  krRenewables: [krMulti("krRenewablesCatMask", "燃料別", KR_OPT_PLANT_FUEL.filter(([v]) => ["solar", "wind", "hydro", "biomass"].includes(v))), opacitySlider("krRenewablesOpacity", densePointOpacity(8_578)), scaleSlider("krRenewablesScale", 1)],
  krPowerLines: [krMulti("krPowerLinesCatMask", "電壓等級", KR_OPT_VOLTAGE), opacitySlider("krPowerLinesOpacity", 0.85)],
  krSubstations: [krMulti("krSubstationsCatMask", "電壓等級", KR_OPT_VOLTAGE), opacitySlider("krSubstationsOpacity", densePointOpacity(1_199)), scaleSlider("krSubstationsScale", 1)],
  krPowerTowers: [opacitySlider("krPowerTowersOpacity", densePointOpacity(42_252)), scaleSlider("krPowerTowersScale", 1)],
  krOilGas: [krMulti("krOilGasCatMask", "設施類別", KR_OPT_OIL_GAS), krMulti("krOilGasPipeMask", "管線物質", KR_OPT_PIPELINE), opacitySlider("krOilGasOpacity", 0.6)],
  // <codemod:append KR_PACK_PARAMS>
} satisfies Partial<Record<KrLayerKey, LayerParamSpec[]>>;
