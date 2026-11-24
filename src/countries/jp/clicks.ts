// 日本國家包：clicks.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GisLayerEntry } from "../../map/gisClickRegistry";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("JP", n)。 */
export const JP_PACK_CLICK_SLOTS: Readonly<Record<number, readonly GisLayerEntry[]>> = {
  1: [
  { layers: ["hazard-lightning-core", "hazard-lightning-halo"], type: "lightningStrike" },
  { layers: ["hazard-lightning-cwa-core", "hazard-lightning-cwa-halo"], type: "lightningStrike" },
  { layers: ["jma-lightning-core", "jma-lightning-halo"], type: "lightningStrike" },
  ],
  2: [
  // 日本 Japan：車站點層排在所有面層之前（first-hit-wins）。
  // 日本氣象廳即時點層（火山／AMeDAS 小點排在地震大泡泡之前）
  { layers: ["jma-volcanoes-circle"], type: "jmaVolcanoes" },
  { layers: ["jma-snowcap-circle"], type: "jmaSnowcap" },
  { layers: ["jma-sakura-circle"], type: "jmaSakura" },
  { layers: ["jma-autumn-leaves-circle"], type: "jmaAutumnLeaves" },
  { layers: ["jma-wbgt-circle"], type: "jmaWbgt" },
  { layers: ["jma-amedas-circle"], type: "jmaAmedas" },
  { layers: ["jma-quakes-circle"], type: "jmaQuakes" },
  { layers: ["jp-medical-facilities-hospital"], type: "jpMedicalHospitals" },
  { layers: ["jp-medical-facilities-clinic"], type: "jpMedicalClinics" },
  { layers: ["jp-medical-facilities-dental"], type: "jpMedicalDental" },
  { layers: ["jp-medical-facilities-maternity"], type: "jpMedicalMaternity" },
  { layers: ["jp-medical-facilities-pharmacy"], type: "jpMedicalPharmacies" },
  { layers: ["jp-medical-care-jpCarePlanning"], type: "jpCarePlanning" },
  { layers: ["jp-medical-care-jpCareHomeVisit"], type: "jpCareHomeVisit" },
  { layers: ["jp-medical-care-jpCareDayServices"], type: "jpCareDayServices" },
  { layers: ["jp-medical-care-jpCareResidential"], type: "jpCareResidential" },
  { layers: ["jp-medical-care-jpCareCombined"], type: "jpCareCombined" },
  { layers: ["jp-medical-care-jpCareEquipment"], type: "jpCareEquipment" },
  { layers: ["jp-stations-circle"], type: "jpStations" },
  { layers: ["jp-tourism-jp-accommodation-canonical-circle"], type: "jpAccommodationCanonical" },
  { layers: ["jp-tourism-jp-accommodation-jta-circle"], type: "jpAccommodationJta" },
  { layers: ["jp-tourism-jp-accommodation-local-circle"], type: "jpAccommodationLocal" },
  { layers: ["jp-tourism-jp-accommodation-osm-circle"], type: "jpAccommodationOsm" },
  { layers: ["jp-tourism-jp-world-heritage-cultural-circle"], type: "jpWorldHeritageCultural" },
  { layers: ["jp-tourism-jp-world-heritage-natural-circle"], type: "jpWorldHeritageNatural" },
  { layers: ["jp-tourism-jp-ramsar-sites-circle"], type: "jpRamsarSites" },
  // raw 三源之間優先命中內容最完整者，避免 GSI 無名記號點搶走 popup。
  { layers: ["jp-religion-wikidata-circle"], type: "jpReligionWikidata" },
  { layers: ["jp-religion-osm-circle"], type: "jpReligionOsm" },
  { layers: ["jp-religion-gsi-circle"], type: "jpReligionGsi" },
  // 學校 56,807 點排在宗教三源之後：三源同為點層互不遮蔽，此處僅維持「點層群組」的末位。
  { layers: ["jp-police-facilities-circle"], type: "jpPoliceFacilities" },
  { layers: ["jp-schools-circle"], type: "jpSchools" },
  { layers: ["jp-evacuation-sites-circle"], type: "jpEvacuationSites" },
  { layers: ["jp-public-offices-circle"], type: "jpPublicOffices" },
  { layers: ["jp-bus-stops-circle"], type: "jpBusStops" },
  { layers: ["jp-landslide-warning-areas-fill"], type: "jpLandslideWarningAreas" },
  { layers: ["jp-inland-flood-areas-fill"], type: "jpInlandFloodAreas" },
  { layers: ["jp-zoning-use-districts-fill"], type: "jpZoningUseDistricts" },
  { layers: ["jp-national-forests-fill"], type: "jpNationalForests" },
  { layers: ["jp-natural-park-areas-2015-fill"], type: "jpNaturalParkAreas2015" },
  { layers: ["jp-national-parks-moe-fill"], type: "jpNationalParksMoe" },
  { layers: ["jp-wildlife-protection-moe-fill"], type: "jpWildlifeProtectionMoe" },
  { layers: ["jp-did-fill"], type: "jpDid" },
  { layers: ["jp-welfare-disability-circle"], type: "jpWelfareDisability" },
  { layers: ["jp-welfare-child-circle"], type: "jpWelfareChild" },
  { layers: ["jp-expressway-junctions-circle", "jp-expressways-line"], type: "jpExpressways" },
  { layers: ["jp-major-roads-line", "jp-major-roads-z5-line"], type: "jpMajorRoads" },
  { layers: ["jp-municipal-roads-hokkaido_tohoku-line", "jp-municipal-roads-kanto-line", "jp-municipal-roads-chubu-line", "jp-municipal-roads-kinki-line", "jp-municipal-roads-chugoku_shikoku-line", "jp-municipal-roads-kyushu_okinawa-line"], type: "jpMunicipalRoads" },
  { layers: ["jp-water-jpWaterDams"], type: "jpWaterDams" },
  { layers: ["jp-water-jpWaterSupplyFacilities"], type: "jpWaterSupplyFacilities" },
  { layers: ["jp-water-jpWaterSewerFacilities"], type: "jpWaterSewerFacilities" },
  { layers: ["jp-water-jpWaterGroundwaterSites"], type: "jpWaterGroundwaterSites" },
  { layers: ["jp-water-jpWaterNilimDams"], type: "jpWaterNilimDams" },
  { layers: ["jp-water-jpWaterAgriculturalPonds"], type: "jpWaterAgriculturalPonds" },
  { layers: ["jp-water-jpWaterLocalFacilities"], type: "jpWaterLocalFacilities" },
  { layers: ["jp-water-jpWaterQualityStations"], type: "jpWaterQualityStations" },
  { layers: ["jp-water-jpWaterLevelStations"], type: "jpWaterLevelStations" },
  ],
  3: [
  // 日本 Japan 線層：鐵道線是細目標，排在所有點層之後、所有面層之前
  // （面層若搶先會吃掉線上的點擊）。
  { layers: ["jp-railways-line"], type: "jpRailways" },
  { layers: ["jp-water-jpWaterRivers"], type: "jpWaterRivers" },
  { layers: ["jma-warnings-fill"], type: "jmaWarnings" },
  { layers: ["jma-rainy-season-fill"], type: "jmaRainySeason" },
  { layers: ["jp-medical-areas-1-fill"], type: "jpMedicalAreasPrimary" },
  { layers: ["jp-medical-areas-2-fill"], type: "jpMedicalAreasSecondary" },
  { layers: ["jp-medical-areas-3-fill"], type: "jpMedicalAreasTertiary" },
  { layers: ["jp-water-jpWaterLakes"], type: "jpWaterLakes" },
  ],
  4: [
  // 日本 Japan 面層：小面 → 大面，排在**所有點層之後**（車站 / 宗教三源 / 學校 / 鐵道線）。
  // ⚠️ 縣界 fill 覆蓋全日本且 tab 開啟時預設開，若排在點層之前會吃掉所有點擊
  // → 車站與宗教點永遠開不出 popup。機場 footprint 也是面，同理排點層後。
  { layers: ["jp-airports-circle", "jp-airports-fill"], type: "jpAirports" },
  { layers: ["jp-tourism-jp-natural-parks-national-fill"], type: "jpNaturalParksNational" },
  { layers: ["jp-tourism-jp-natural-parks-quasi-national-fill"], type: "jpNaturalParksQuasiNational" },
  { layers: ["jp-tourism-jp-natural-parks-prefectural-fill"], type: "jpNaturalParksPrefectural" },
  { layers: ["jp-tourism-jp-nature-conservation-area-fill"], type: "jpNatureConservationArea" },
  { layers: ["jp-tourism-jp-primitive-nature-environment-area-fill"], type: "jpPrimitiveNatureEnvironmentArea" },
  { layers: ["jp-tourism-jp-nature-conservation-special-district-fill"], type: "jpNatureConservationSpecialDistrict" },
  { layers: ["jp-tourism-jp-wildlife-protection-national-fill"], type: "jpWildlifeProtectionNational" },
  { layers: ["jp-tourism-jp-wildlife-special-protection-district-fill"], type: "jpWildlifeSpecialProtectionDistrict" },
  { layers: ["jp-tourism-jp-wildlife-special-protection-designated-area-fill"], type: "jpWildlifeSpecialProtectionDesignatedArea" },
  { layers: ["jp-tourism-jp-world-natural-heritage-historical-fill"], type: "jpWorldNaturalHeritageHistorical" },
  { layers: ["jp-tourism-jp-marine-ebsa-coastal-fill"], type: "jpMarineEbsaCoastal" },
  ],
  5: [
  // 人口網格 1km 格小於 1.5km 旅宿密度格、市区町村與都道府県，依「小面 → 大面」排序。
  // ⚠️ 縣界 tab 開啟時預設開且與網格同樣無縫鋪滿全日本；若人口網格排在行政區界後，
  // first-hit-wins 會由縣界吃掉每一次點擊。
  { layers: ["jp-population-mesh-fill"], type: "jpPopulationMesh1km" },
  ],
  6: [
  { layers: ["jp-admin-municipality-fill"], type: "jpAdminBoundaries" },
  ],
  7: [
  { layers: ["jp-admin-prefecture-fill"], type: "jpAdminPrefecture" },
  ],
  8: [
  { layers: ["jp-building-height-grid-fill", "jp-building-height-fill", "jp-building-height-extrusion"], type: "jpBuildingHeight" },
  ],
  9: [
  // Transparent supply areas are intentionally the final click candidate across the map,
  // so a coverage polygon never intercepts any detailed point, line, or other fill.
  { layers: ["jp-water-jpWaterSupplyAreas"], type: "jpWaterSupplyAreas" },
  ],
  // <codemod:append JP_PACK_CLICK_SLOTS>
};
