// 越南國家包：clicks.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GisLayerEntry } from "../../map/gisClickRegistry";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("VN", n)。 */
export const VN_PACK_CLICK_SLOTS: Readonly<Record<number, readonly GisLayerEntry[]>> = {
  1: [
  // 越南（2026-11-13 第 0–1 波）：點、線在前，面（安江工業群、人口、行政界）最後
  { layers: ["vn-airports-circle", "vn-ports-circle", "vn-airports-osm-circle"], type: "vnTransportHubs" },
  { layers: ["vn-stations-circle"], type: "vnStations" },
  { layers: ["vn-power-plants-circle"], type: "vnPowerPlants" },
  { layers: ["vn-renewables-wind-solar-circle", "vn-renewables-solar-tz-circle", "vn-charging-circle"], type: "vnRenewables" },
  { layers: ["vn-power-substations-circle", "vn-power-lines-line", "vn-power-cables-line"], type: "vnPowerGrid" },
  { layers: ["vn-fuel-stations-circle"], type: "vnFuelStations" },
  { layers: ["vn-lng-terminals-circle", "vn-coal-terminals-circle", "vn-refineries-circle", "vn-tanks-circle", "vn-pipelines-gem-line", "vn-pipelines-osm-line"], type: "vnOilGas" },
  { layers: ["vn-envisoft-stations-circle"], type: "vnEnvisoftStations" },
  // 越南觀光波與第 2–7 波（2026-11-17）：點、線
  { layers: ["vn-tour-attractions-circle"], type: "vnTourAttractions" },
  { layers: ["vn-tour-nature-circle"], type: "vnTourNature" },
  { layers: ["vn-tour-services-circle"], type: "vnTourServices" },
  { layers: ["vn-national-tourist-areas-circle"], type: "vnNationalTouristAreas" },
  { layers: ["vn-glide-events-circle"], type: "vnGlideEvents" },
  { layers: ["vn-riverbank-erosion-circle"], type: "vnRiverbankErosion" },
  { layers: ["vn-coal-mines-circle"], type: "vnCoalMines" },
  { layers: ["vn-bicycle-rental-circle"], type: "vnBicycleRental" },
  { layers: ["vn-parking-circle"], type: "vnParking" },
  { layers: ["vn-water-supply-circle"], type: "vnWaterSupply" },
  { layers: ["vn-water-structures-circle"], type: "vnWaterStructures" },
  { layers: ["vn-schools-circle"], type: "vnSchools" },
  { layers: ["vn-kindergartens-circle"], type: "vnKindergartens" },
  { layers: ["vn-health-facilities-circle"], type: "vnHealthFacilities" },
  { layers: ["vn-police-circle"], type: "vnPolice" },
  { layers: ["vn-courts-prisons-circle"], type: "vnCourtsPrisons" },
  { layers: ["vn-postal-services-circle"], type: "vnPostalServices" },
  { layers: ["vn-public-amenities-circle"], type: "vnPublicAmenities" },
  { layers: ["vn-financial-services-circle"], type: "vnFinancialServices" },
  { layers: ["vn-places-of-worship-circle"], type: "vnPlacesOfWorship" },
  { layers: ["vn-place-names-circle"], type: "vnPlaceNames" },
  { layers: ["vn-bridges-line"], type: "vnBridges" },
  { layers: ["vn-rivers-line"], type: "vnRivers" },
  { layers: ["vn-farm-tracks-line"], type: "vnFarmTracks" },
  { layers: ["vn-angiang-flood-circle", "vn-angiang-clusters-outline", "vn-angiang-clusters-fill"], type: "vnAngiangDemo" },
  { layers: ["vn-major-roads-line", "vn-major-rail-line", "vn-major-rail-construction-line"], type: "vnMajorRoads" },
  // 越南第 2–7 波（2026-11-17）：含面者（小面在前、土壤與保護區大面在後）
  { layers: ["vn-dams-circle", "vn-reservoirs-fill"], type: "vnDams" },
  { layers: ["vn-parks-circle", "vn-parks-fill"], type: "vnParks" },
  { layers: ["vn-school-campuses-line", "vn-school-campuses-fill"], type: "vnSchoolCampuses" },
  { layers: ["vn-angiang-aquaculture-fill"], type: "vnAngiangAquaculture" },
  { layers: ["vn-field-boundaries-line", "vn-field-boundaries-fill"], type: "vnFieldBoundaries" },
  { layers: ["vn-protected-areas-odm-line", "vn-protected-areas-odm-fill"], type: "vnProtectedAreasOdm" },
  { layers: ["vn-soil-fill"], type: "vnSoil" },
  ],
  2: [
  { layers: ["vn-population-province-fill"], type: "vnPopulation" },
  { layers: ["vn-admin-province-fill"], type: "vnAdminBoundaries" },
  ],
  // <codemod:append VN_PACK_CLICK_SLOTS>
};
