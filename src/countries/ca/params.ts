// 加拿大國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CaLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { categoryMultiSelect, displayModeSelect, gridPalette, heatmapPalette, krMulti, type KrOpt, opacitySlider, scaleSlider, serializeMultiSelectValues } from "../../data/layerParamsSpec";
import { phCatOptions } from "../ph/phDataLayers";
import { densePointOpacity, RASTER } from "../../map/mapStyleScale";
import { CA_WAVE_SPECS } from "./caWavesLayers";

// ── 加拿大類別多選（V-4）：id 與 zh 標籤同 `data/caInfraTypes.ts`（不在此 import，避免規格檔牽入 energyLoader）──
const CA_OPT_TRANSIT: KrOpt = [["0", "站牌／月台"], ["1", "車站"]];

const CA_OPT_AIRPORT: KrOpt = [["large", "大型機場"], ["medium", "中型機場"], ["small", "小型機場"], ["heliport", "直升機場"], ["seaplane", "水上飛機基地"]];

const CA_OPT_PORT: KrOpt = [["port", "港口"], ["mixed", "綜合港（含漁港）"], ["marina", "遊艇港"]];

const CA_OPT_ROAD: KrOpt = [["freeway", "高速公路（Freeway）"], ["expressway", "快速公路／幹線公路"], ["arterial", "有編號的省道級幹道（Arterial）"]];

const CA_OPT_RAIL_TRACK: KrOpt = [["main", "幹線"], ["connecting", "聯絡線"], ["ferry", "鐵路渡輪航線"], ["minor", "側線／調車場／支線等"]];

const CA_OPT_RAIL_STATION: KrOpt = [["passenger", "客運站"], ["mixed", "客貨／聯運站"], ["other", "貨運／維修／其他"]];

const CA_OPT_PLANT_FUEL: KrOpt = [
  ["hydro", "水力"], ["wind", "風力"], ["solar", "太陽光電"], ["bioenergy", "生質能"], ["gas", "燃氣"], ["coal", "燃煤"],
  ["nuclear", "核能"], ["oil", "燃油"], ["pumped_hydro", "抽蓄水力"], ["other", "潮汐／其他"],
];

const CA_OPT_GRID_PART: KrOpt = [["above", "電力線（架空，不分電壓）"], ["under", "電力線（水下）"], ["substation", "變電站"]];

const CA_OPT_OIL_GAS_PART: KrOpt = [
  ["major_pipelines", "主要管線（CanVec）"], ["major_facilities", "主要石化設施（2017）"], ["wells", "油氣井（部分，非全量）"],
  ["facilities", "井場與集輸設施"], ["pipelines", "集輸／輸送管線"], ["pipeline_points", "管線附屬設施（riser、valve…）"],
];

const CA_OPT_PIPE_SUBSTANCE: KrOpt = [["gas", "天然氣"], ["oil", "石油／油井流體"], ["other", "多用途／其他／未標"]];

const CA_OPT_MAJOR_FACILITY: KrOpt = [["refinery", "煉油廠"], ["gas_processing", "天然氣處理廠"], ["lng_terminal", "LNG 終端"], ["gas_storage", "地下儲氣"]];

const CA_OPT_POP_CLASS: KrOpt = [["large_urban", "大都會人口中心（≥10 萬）"], ["medium", "中型人口中心（3–10 萬）"], ["small", "小型人口中心（1,000–29,999）"]];

const CA_OPT_FSA: KrOpt = [["urban", "都市 FSA（1,462）"], ["rural", "農村 FSA（181）"]];

const CA_OPT_INDIGENOUS: KrOpt = [["reserve", "印第安保留地（Indian Reserve，3,289）"], ["inuit", "因紐特人所有地（27）"], ["claim", "其他土地索償協定土地（27）"], ["sechelt", "Sechelt／Indian Land（34）"]];

const CA_OPT_PLACE_GROUP: KrOpt = [
  ["settlement", "聚落（29,754）"], ["admin", "行政區與原住民保留地（10,278）"], ["park", "公園與保護區（10,301）"], ["water", "水體（224,426）"],
  ["terrain", "山岳、地形與冰川（75,865）"], ["constructed", "人工設施（11,281）"], ["other", "其他（2,831）"],
];

// 加拿大第 3 波（2026-11-06）
const CA_OPT_CLIMATE_STATUS: KrOpt = [["active", "現役（1,160）"], ["historical", "歷史站（7,275）"]];

const CA_OPT_NPRI_GROUP: KrOpt = [
  ["oil_gas", "油氣開採、管線與煉製（15,673）"], ["manufacturing", "製造業（5,310）"], ["mining_metals", "礦業與金屬（1,009）"],
  ["electricity", "電力（381）"], ["waste_water", "廢棄物與污水處理（674）"], ["other", "其他（1,493）"],
];

const CA_OPT_NPRI_RECENT: KrOpt = [["recent", "2023–2025 年仍申報（8,790）"], ["past", "2022 年以前停止申報（15,750）"]];

const CA_OPT_WSER_STATUS: KrOpt = [["operational", "運轉中（2,475）"], ["decommissioned", "已除役（62）"]];

const CA_OPT_QUAKE_LIVE_TYPE: KrOpt = [["earthquake", "地震"], ["industry", "疑似產業活動誘發"], ["mining", "礦場事件"], ["blast", "爆破（含採石）"]];

const CA_OPT_QUAKE_CLASS: KrOpt = [["lt2", "規模 <2"], ["m2", "規模 2–3"], ["m3", "規模 3–4"], ["m4", "規模 4–5"], ["m5", "規模 ≥5"]];


export const CA_PACK_PARAMS = {
  // 加拿大第 3–8 波（2026-11-17）：類別多選（順序＝規格 cats＋「其他」＝bitmask；catDefault 者預設部分勾選）、透明度、點層大小
  ...Object.fromEntries(CA_WAVE_SPECS.map((spec) => {
    const hasPoint = spec.parts.some((p) => p.geom === "point");
    const pointOnly = spec.parts.every((p) => p.geom === "point");
    return [spec.key, [
      categoryMultiSelect(spec.key, phCatOptions(spec), spec.catDefault ? serializeMultiSelectValues([...spec.catDefault]) : undefined),
      ...(spec.heat ? [heatmapPalette(spec.key)] : []),
      opacitySlider(`${spec.key}Opacity`, spec.opacity ?? (pointOnly ? densePointOpacity(spec.count) : 0.85)),
      ...(hasPoint ? [scaleSlider(`${spec.key}Scale`, 1)] : []),
    ]];
  })),
  // 加拿大第 0＋1 波（2026-11-04）：多選選項 id／順序必須同 `data/caInfraTypes.ts` 的類別陣列（caLayers 測試守）
  caAdminBoundaries: [
    opacitySlider("caAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "caAdminBoundariesLevel", label: "行政層級", default: "pr",
      options: [{ label: "省／地區（Province／territory）", value: "pr" }, { label: "普查區（Census division）", value: "cd" }, { label: "普查分區（Census subdivision）", value: "csd" }],
      out: "caAdminBoundariesLevelIdx", encode: ["pr", "cd", "csd"],
    },
  ],
  caTransitStops: [krMulti("caTransitStopsCatMask", "站型", CA_OPT_TRANSIT), heatmapPalette("caTransitStops"), opacitySlider("caTransitStopsOpacity", densePointOpacity(133_029)), scaleSlider("caTransitStopsScale", 1)],
  caAirportsPorts: [krMulti("caAirportsPortsCatMask", "機場類型", CA_OPT_AIRPORT), krMulti("caAirportsPortsPortMask", "港口類型", CA_OPT_PORT), opacitySlider("caAirportsPortsOpacity", densePointOpacity(3_690)), scaleSlider("caAirportsPortsScale", 1)],
  caMajorRoads: [krMulti("caMajorRoadsCatMask", "道路等級", CA_OPT_ROAD), opacitySlider("caMajorRoadsOpacity", 0.85)],
  caRailways: [krMulti("caRailwaysCatMask", "軌道等級", CA_OPT_RAIL_TRACK), krMulti("caRailwaysStationMask", "車站類型", CA_OPT_RAIL_STATION), opacitySlider("caRailwaysOpacity", 0.85), scaleSlider("caRailwaysScale", 1)],
  caPowerPlants: [krMulti("caPowerPlantsCatMask", "燃料別", CA_OPT_PLANT_FUEL), opacitySlider("caPowerPlantsOpacity", densePointOpacity(1_125)), scaleSlider("caPowerPlantsScale", 1)],
  caWindTurbines: [opacitySlider("caWindTurbinesOpacity", densePointOpacity(7_841)), scaleSlider("caWindTurbinesScale", 1)],
  caPowerGrid: [krMulti("caPowerGridCatMask", "子項", CA_OPT_GRID_PART), opacitySlider("caPowerGridOpacity", 0.85), scaleSlider("caPowerGridScale", 1)],
  caOilGas: [
    krMulti("caOilGasPartMask", "子項", CA_OPT_OIL_GAS_PART), krMulti("caOilGasPipeMask", "管線物質", CA_OPT_PIPE_SUBSTANCE), krMulti("caOilGasCatMask", "主要設施類別", CA_OPT_MAJOR_FACILITY),
    heatmapPalette("caOilGas"), opacitySlider("caOilGasOpacity", densePointOpacity(96_466)), scaleSlider("caOilGasScale", 1),
  ],
  caPopulationCentres: [displayModeSelect("caPopulationCentres", "polygon"), krMulti("caPopulationCentresCatMask", "規模", CA_OPT_POP_CLASS), opacitySlider("caPopulationCentresOpacity", 0.55), scaleSlider("caPopulationCentresScale", 1)],
  // 加拿大第 2 波（2026-11-04）：面資料與社經、地名與地形
  caFederalDistricts: [opacitySlider("caFederalDistrictsOpacity", 0.85)],
  caPostalFsa: [krMulti("caPostalFsaCatMask", "都市／農村", CA_OPT_FSA), heatmapPalette("caPostalFsa"), opacitySlider("caPostalFsaOpacity", 0.7)],
  caIndigenousLands: [displayModeSelect("caIndigenousLands", "polygon"), krMulti("caIndigenousLandsCatMask", "土地類型", CA_OPT_INDIGENOUS), opacitySlider("caIndigenousLandsOpacity", 0.55), scaleSlider("caIndigenousLandsScale", 1)],
  caDeprivation: [
    {
      kind: "select", category: "data", name: "caDeprivationDimension", label: "剝奪面向", default: "econ_dep",
      options: [{ label: "經濟依賴", value: "econ_dep" }, { label: "居住不穩定", value: "res_inst" }, { label: "族裔文化組成", value: "ethno_cult" }, { label: "情境脆弱性", value: "sit_vuln" }],
      out: "caDeprivationDimensionIdx", encode: ["econ_dep", "res_inst", "ethno_cult", "sit_vuln"],
    },
    opacitySlider("caDeprivationOpacity", 0.55), scaleSlider("caDeprivationScale", 1),
  ],
  caRents: [
    {
      kind: "select", category: "data", name: "caRentsUnit", label: "房型", default: "br2",
      options: [{ label: "2 房", value: "br2" }, { label: "套房（Bachelor）", value: "bachelor" }, { label: "1 房", value: "br1" }, { label: "3 房以上", value: "br3" }],
      out: "caRentsUnitIdx", encode: ["br2", "bachelor", "br1", "br3"],
    },
    opacitySlider("caRentsOpacity", 0.55), scaleSlider("caRentsScale", 1),
  ],
  caPlaceNames: [krMulti("caPlaceNamesCatMask", "地名類別", CA_OPT_PLACE_GROUP), opacitySlider("caPlaceNamesOpacity", 0.85), scaleSlider("caPlaceNamesScale", 1)],
  caHillshade: [{ kind: "slider", name: "caHillshadeOpacity", labelPrefix: "透明度", digits: 2, default: 0.5, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  // 加拿大第 3 波（環境氣候、災害）＋GHSL 人口網格
  caClimateStations: [krMulti("caClimateStationsCatMask", "狀態", CA_OPT_CLIMATE_STATUS), opacitySlider("caClimateStationsOpacity", densePointOpacity(8_435)), scaleSlider("caClimateStationsScale", 1)],
  caAqhiStations: [opacitySlider("caAqhiStationsOpacity", 0.9), scaleSlider("caAqhiStationsScale", 1)],
  caRadiationStations: [opacitySlider("caRadiationStationsOpacity", 0.9), scaleSlider("caRadiationStationsScale", 1)],
  caNpriFacilities: [
    krMulti("caNpriFacilitiesCatMask", "產業群", CA_OPT_NPRI_GROUP), krMulti("caNpriFacilitiesRecentMask", "申報狀態", CA_OPT_NPRI_RECENT),
    heatmapPalette("caNpriFacilities"), opacitySlider("caNpriFacilitiesOpacity", densePointOpacity(24_540)), scaleSlider("caNpriFacilitiesScale", 1),
  ],
  caWastewaterSystems: [krMulti("caWastewaterSystemsCatMask", "狀態", CA_OPT_WSER_STATUS), opacitySlider("caWastewaterSystemsOpacity", 0.85), scaleSlider("caWastewaterSystemsScale", 1)],
  caEarthquakesLive: [krMulti("caEarthquakesLiveTypeMask", "事件類型", CA_OPT_QUAKE_LIVE_TYPE), opacitySlider("caEarthquakesLiveOpacity", 0.85), scaleSlider("caEarthquakesLiveScale", 1)],
  caEarthquakes: [krMulti("caEarthquakesCatMask", "規模", CA_OPT_QUAKE_CLASS), heatmapPalette("caEarthquakes"), opacitySlider("caEarthquakesOpacity", densePointOpacity(101_365)), scaleSlider("caEarthquakesScale", 1)],
  caPopulationGrid: [gridPalette("caPopulationGridPalette", "YlOrBr"), opacitySlider("caPopulationGridOpacity", 0.6)],
  // <codemod:append CA_PACK_PARAMS>
} satisfies Partial<Record<CaLayerKey, LayerParamSpec[]>>;
