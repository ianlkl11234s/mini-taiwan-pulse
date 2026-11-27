// 愛爾蘭國家包：clicks.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GisLayerEntry } from "../../map/gisClickRegistry";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("IE", n)。 */
export const IE_PACK_CLICK_SLOTS: Readonly<Record<number, readonly GisLayerEntry[]>> = {
  1: [
  // 愛爾蘭第 1 波（規格驅動，layer id 見 data/ieDataLayers.ts；公園代表點 circle 由 repPointClickLayerIds 補）。點層在前，面層（Gaeltacht、公園）最後才命中
  { layers: ["ie-place-names-circle"], type: "iePlaceNames" },
  { layers: ["ie-activity-locations-circle"], type: "ieActivityLocations" },
  { layers: ["ie-graveyards-circle"], type: "ieGraveyards" },
  { layers: ["ie-commercial-valuations-circle"], type: "ieCommercialValuations" },
  { layers: ["ie-hydrometric-stations-circle"], type: "ieHydrometricStations" },
  { layers: ["ie-water-monitoring-circle"], type: "ieWaterMonitoring" },
  // 第 3b 波：浴場、漁業調查站位（點）
  { layers: ["ie-bathing-waters-circle"], type: "ieBathingWaters" },
  { layers: ["ie-marine-survey-stations-circle"], type: "ieMarineSurveyStations" },
  { layers: ["ie-maritime-boundaries-line"], type: "ieMaritimeBoundaries" },
  { layers: ["ie-arterial-drainage-line"], type: "ieArterialDrainage" },
  { layers: ["ie-coastal-erosion-line"], type: "ieCoastalErosion" },
  // 第 4 波：交通（點在線之前，點擊點優先）
  { layers: ["ie-transit-stops-circle"], type: "ieTransitStops" },
  { layers: ["ie-dublinbikes-stations-circle"], type: "ieDublinbikesStations" },
  { layers: ["ie-road-markers-circle"], type: "ieRoadMarkers" },
  { layers: ["ie-traffic-counters-circle"], type: "ieTrafficCounters" },
  { layers: ["ie-airports-ports-circle"], type: "ieAirportsPorts" },
  // 第 6 波：能源（點在線之前，點擊點優先）
  { layers: ["ie-power-plants-circle"], type: "iePowerPlants" },
  { layers: ["ie-substations-circle"], type: "ieSubstations" },
  { layers: ["ie-wind-farms-circle"], type: "ieWindFarms" },
  { layers: ["ie-ev-charging-circle"], type: "ieEvCharging" },
  { layers: ["ie-fuel-stations-circle"], type: "ieFuelStations" },
  // 第 7b 波：醫療照護、消防警政、司法
  { layers: ["ie-health-facilities-circle"], type: "ieHealthFacilities" },
  { layers: ["ie-care-homes-circle"], type: "ieCareHomes" },
  { layers: ["ie-fire-stations-circle"], type: "ieFireStations" },
  { layers: ["ie-garda-stations-circle"], type: "ieGardaStations" },
  { layers: ["ie-courts-circle"], type: "ieCourts" },
  // 第 10 波：工商（點）
  { layers: ["ie-industrial-facilities-circle"], type: "ieIndustrialFacilities" },
  // 第 9 波：規劃申請、回收點、PRTR（點）；分區、廢棄物設施、噪音（面）在面段
  { layers: ["ie-planning-applications-circle"], type: "iePlanningApplications" },
  { layers: ["ie-recycling-points-circle"], type: "ieRecyclingPoints" },
  { layers: ["ie-prtr-facilities-circle"], type: "iePrtrFacilities" },
  // 第 11 波：點（AED、監獄）
  { layers: ["ie-defibrillators-circle"], type: "ieDefibrillators" },
  { layers: ["ie-prisons-circle"], type: "iePrisons" },
  { layers: ["ie-road-rail-network-line"], type: "ieRoadRailNetwork" },
  // 第 5 波：點（輻射站、樹木、崩塌事件）→ 線（步道、Wild Atlantic Way）；面在後（代表點 circle 由 repPointClickLayerIds 補）
  { layers: ["ie-radiation-stations-circle"], type: "ieRadiationStations" },
  { layers: ["ie-landslide-events-circle"], type: "ieLandslideEvents" },
  { layers: ["ie-street-trees-circle"], type: "ieStreetTrees" },
  { layers: ["ie-coillte-recreation-site-circle", "ie-coillte-recreation-entrance-circle"], type: "ieCoillteRecreation" },
  { layers: ["ie-national-trails-line"], type: "ieNationalTrails" },
  { layers: ["ie-coillte-forest-roads-line"], type: "ieCoillteForestRoads" },
  { layers: ["ie-wild-atlantic-way-line"], type: "ieWildAtlanticWay" },
  { layers: ["ie-power-lines-line"], type: "iePowerLines" },
  // 第 7a 波：學校、托育點（點優先）
  { layers: ["ie-schools-circle"], type: "ieSchools" },
  { layers: ["ie-childcare-services-circle"], type: "ieChildcareServices" },
  // 第 8 波：文化遺產與生活據點（點優先）
  { layers: ["ie-museums-circle"], type: "ieMuseums" },
  { layers: ["ie-arts-venues-circle"], type: "ieArtsVenues" },
  { layers: ["ie-public-facilities-circle"], type: "iePublicFacilities" },
  { layers: ["ie-religious-sites-circle"], type: "ieReligiousSites" },
  { layers: ["ie-heritage-sites-circle"], type: "ieHeritageSites" },
  { layers: ["ie-river-water-bodies-line"], type: "ieRiverWaterBodies" },
  { layers: ["ie-parks-fill"], type: "ieParks" },
  { layers: ["ie-gaeltacht-fill"], type: "ieGaeltacht" },
  // 第 2 波：國有登記土地面（代表點 circle 由 repPointClickLayerIds 補）
  { layers: ["ie-state-assets-fill"], type: "ieStateAssets" },
  // 第 3a 波：淹水、湖泊面
  { layers: ["ie-lake-water-bodies-fill"], type: "ieLakeWaterBodies" },
  // 第 11 波：郡議會淹水分區（小，代表點 circle 由 repPointClickLayerIds 補）、GSI 地下水淹水，在 OPW 河川淹水之前
  { layers: ["ie-flood-zones-fill"], type: "ieFloodZones" },
  { layers: ["ie-groundwater-flooding-fill"], type: "ieGroundwaterFlooding" },
  { layers: ["ie-river-flood-extents-fill"], type: "ieRiverFloodExtents" },
  // 第 3b 波：受保護海域（代表點 circle 由 repPointClickLayerIds 補）、離岸能源、海床調查範圍（大面最後命中）
  { layers: ["ie-protected-marine-sites-fill"], type: "ieProtectedMarineSites" },
  { layers: ["ie-offshore-renewables-fill"], type: "ieOffshoreRenewables" },
  { layers: ["ie-seabed-survey-coverage-fill"], type: "ieSeabedSurveyCoverage" },
  // 第 5 波面：崩塌範圍（小）→ 保護區 → 國家公園 → 氡氣（鋪滿國土，最後命中）
  { layers: ["ie-landslide-extents-fill"], type: "ieLandslideExtents" },
  { layers: ["ie-protected-sites-fill"], type: "ieProtectedSites" },
  // 第 11 波：提議中自然遺產區（代表點 circle 由 repPointClickLayerIds 補）
  { layers: ["ie-proposed-nha-fill"], type: "ieProposedNha" },
  { layers: ["ie-national-parks-fill"], type: "ieNationalParks" },
  { layers: ["ie-radon-risk-fill"], type: "ieRadonRisk" },
  // 第 10 波面：養殖場（小，代表點 circle 由 repPointClickLayerIds 補）→ 泥炭土壤 → 土壤圖（鋪滿國土）
  { layers: ["ie-aquaculture-fill"], type: "ieAquaculture" },
  // 第 11 波：泥炭開採沼地（代表點 circle 由 repPointClickLayerIds 補），在泥炭土壤之前
  { layers: ["ie-peat-extraction-bogs-fill"], type: "iePeatExtractionBogs" },
  { layers: ["ie-peat-soils-fill"], type: "iePeatSoils" },
  { layers: ["ie-soils-fill"], type: "ieSoils" },
  // 第 7a 波：學校規劃區（鋪滿國土，在行政界之前）
  { layers: ["ie-school-planning-areas-fill"], type: "ieSchoolPlanningAreas" },
  { layers: ["ie-waste-facilities-fill"], type: "ieWasteFacilities" },
  { layers: ["ie-zoning-fill"], type: "ieZoning" },
  { layers: ["ie-noise-maps-fill"], type: "ieNoiseMaps" },
  { layers: ["ie-admin-sa-fill", "ie-admin-ed-fill", "ie-admin-la-fill"], type: "ieAdminBoundaries" },
  ],
  // <codemod:append IE_PACK_CLICK_SLOTS>
};
