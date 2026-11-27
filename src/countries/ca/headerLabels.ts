// 加拿大國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CaPopupType } from "./popupTypes";
import { CA_WAVE_SPECS } from "./caWavesLayers";
import { type CaWaveKey } from "./keys";

const CA_WAVE_HEADER_LABELS = Object.fromEntries(CA_WAVE_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<CaWaveKey, string>;


export const CA_PACK_HEADER_LABELS = {
  caAdminBoundaries: "行政邊界 Administrative Boundaries",
  ...CA_WAVE_HEADER_LABELS,
  caTransitStops: "公共運輸站點 Transit Stops",
  caAirportsPorts: "機場與港口 Airports & Ports",
  caMajorRoads: "主要道路 Major Roads",
  caRailways: "鐵路 Railways",
  caPowerPlants: "電廠 Power Plants",
  caWindTurbines: "風機 Wind Turbines",
  caPowerGrid: "電網 Power Grid",
  caOilGas: "油氣設施 Oil & Gas",
  caPopulationCentres: "人口中心 Population Centres",
  caFederalDistricts: "聯邦選區 Federal Electoral Districts",
  caPostalFsa: "郵遞分區 Forward Sortation Areas",
  caIndigenousLands: "原住民法定土地 Indigenous Lands",
  caDeprivation: "剝奪指數 Deprivation Index",
  caRents: "平均月租 Average Rents",
  caPlaceNames: "地名 Geographical Names",
  caClimateStations: "氣象站 Climate Stations",
  caAqhiStations: "AQHI 地點 AQHI Locations",
  caRadiationStations: "輻射監測站 Radiation Monitoring",
  caNpriFacilities: "NPRI 申報設施 NPRI Facilities",
  caWastewaterSystems: "污水處理系統 Wastewater Systems",
  caEarthquakes: "地震 Earthquakes",
  caEarthquakesLive: "即時地震 Recent Earthquakes",
  caPopulationGrid: "人口網格 Population Grid",
  // <codemod:append CA_PACK_HEADER_LABELS>
} satisfies Record<CaPopupType, string>;
