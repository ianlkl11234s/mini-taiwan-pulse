// 日本國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { JpBusStopsLegend, JpEvacuationSitesLegend, JpInlandFloodAreasLegend, JpLandslideWarningAreasLegend, JpNationalForestsLegend, JpPoliceFacilitiesLegend, JpPublicOfficesLegend, JpSchoolsLegend, JpWelfareFacilitiesLegend, JpZoningUseDistrictsLegend } from "../../components/legend/civicServiceLegends";
import { JpAccommodationTypesLegend, JpReligionLegend } from "../../components/legend/cultureLegends";
import { HistoricalFlightTrailsLegend, JpExpresswaysLegend, JpMajorRoadsLegend, JpMunicipalRoadsLegend, JpRailwaysLegend, JpStationsLegend } from "../../components/legend/transportLegends";
import { JpBuildingHeightLegend, JpCanopyHeightLegend, JpGsiHillshadeLegend, JpGsiReliefLegend, JpPopulationMeshLegend } from "../../components/legend/urbanFormLegends";
import { JpWaterFloodHazardLegend, JpWaterLegend } from "../../components/legend/waterLegends";
import { GibsSnowCoverLegend, JmaAmedasLegend, JmaImageryLegend, JmaKosaLegend, JmaQuakesLegend, JmaRiskFloodLegend, JmaSnowDepthLegend, JmaVolcanoesLegend, JmaWarningsLegend } from "./jmaLegends";
import { JmaAutumnLeavesLegend, JmaLightningLegend, JmaRainySeasonLegend, JmaSakuraLegend, JmaSnowcapLegend, JmaWbgtLegend } from "./jmaPointLegends";
import { JpDidLegend, JpNationalParksMoeLegend, JpNaturalParkAreas2015Legend, JpWildlifeProtectionMoeLegend } from "./jpNatureR2Legends";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("JP", n)。 */
export const JP_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "jpReligion", render: ({ visibility }) => <JpReligionLegend visibility={visibility} /> },
  { id: "jpStations", render: ({ overlayParams }) => <JpStationsLegend modeIdx={overlayParams.jpStationsColorModeIdx ?? 0} /> },
  { id: "jpRailways", render: () => <JpRailwaysLegend /> },
  { id: "jpWaterLakes", render: () => <JpWaterLegend layerKey="jpWaterLakes" /> },
  { id: "jpWaterDams", render: () => <JpWaterLegend layerKey="jpWaterDams" /> },
  { id: "jpWaterRivers", render: () => <JpWaterLegend layerKey="jpWaterRivers" /> },
  { id: "jpWaterSupplyFacilities", render: () => <JpWaterLegend layerKey="jpWaterSupplyFacilities" /> },
  { id: "jpWaterSupplyAreas", render: () => <JpWaterLegend layerKey="jpWaterSupplyAreas" /> },
  { id: "jpWaterSewerFacilities", render: () => <JpWaterLegend layerKey="jpWaterSewerFacilities" /> },
  { id: "jpWaterGroundwaterSites", render: () => <JpWaterLegend layerKey="jpWaterGroundwaterSites" /> },
  { id: "jpWaterNilimDams", render: () => <JpWaterLegend layerKey="jpWaterNilimDams" /> },
  { id: "jpWaterAgriculturalPonds", render: () => <JpWaterLegend layerKey="jpWaterAgriculturalPonds" /> },
  { id: "jpWaterFloodHazard", render: () => <JpWaterFloodHazardLegend /> },
  { id: "jpWaterLocalFacilities", render: () => <JpWaterLegend layerKey="jpWaterLocalFacilities" /> },
  { id: "jpWaterQualityStations", render: () => <JpWaterLegend layerKey="jpWaterQualityStations" /> },
  { id: "jpWaterLevelStations", render: () => <JpWaterLegend layerKey="jpWaterLevelStations" /> },
  ],
  2: [
  { id: "jpPoliceFacilities", render: () => <JpPoliceFacilitiesLegend /> },
  { id: "jpEvacuationSites", render: () => <JpEvacuationSitesLegend /> },
  { id: "jpPublicOffices", render: () => <JpPublicOfficesLegend /> },
  { id: "jpBusStops", render: () => <JpBusStopsLegend /> },
  { id: "jpLandslideWarningAreas", render: () => <JpLandslideWarningAreasLegend /> },
  { id: "jpInlandFloodAreas", render: () => <JpInlandFloodAreasLegend /> },
  { id: "jpZoningUseDistricts", render: () => <JpZoningUseDistrictsLegend /> },
  { id: "jpNationalForests", render: () => <JpNationalForestsLegend /> },
  { id: "jpNaturalParkAreas2015", render: () => <JpNaturalParkAreas2015Legend /> },
  { id: "jpNationalParksMoe", render: () => <JpNationalParksMoeLegend /> },
  { id: "jpWildlifeProtectionMoe", render: () => <JpWildlifeProtectionMoeLegend /> },
  { id: "jpDid", render: () => <JpDidLegend /> },
  { id: "jpWelfareDisability", render: () => <JpWelfareFacilitiesLegend layerKey="jpWelfareDisability" /> },
  { id: "jpWelfareChild", render: () => <JpWelfareFacilitiesLegend layerKey="jpWelfareChild" /> },
  { id: "jpMajorRoads", render: () => <JpMajorRoadsLegend /> },
  { id: "jpMunicipalRoads", render: () => <JpMunicipalRoadsLegend /> },
  { id: "jpExpressways", render: () => <JpExpresswaysLegend /> },
  { id: "jpGsiHillshade", render: () => <JpGsiHillshadeLegend /> },
  { id: "jpGsiRelief", render: () => <JpGsiReliefLegend /> },
  ],
  3: [
  { id: "jmaAmedas", render: () => <JmaAmedasLegend /> },
  { id: "jmaWarnings", render: () => <JmaWarningsLegend /> },
  { id: "jmaQuakes", render: () => <JmaQuakesLegend /> },
  { id: "jmaVolcanoes", render: () => <JmaVolcanoesLegend /> },
  { id: "jmaLightning", render: () => <JmaLightningLegend /> },
  { id: "jmaWbgt", render: () => <JmaWbgtLegend /> },
  { id: "jmaSnowcap", render: () => <JmaSnowcapLegend /> },
  { id: "jmaAutumnLeaves", render: () => <JmaAutumnLeavesLegend /> },
  { id: "jmaSakura", render: () => <JmaSakuraLegend /> },
  { id: "jmaRainySeason", render: () => <JmaRainySeasonLegend /> },
  { id: "jmaSnowDepth", render: () => <JmaSnowDepthLegend /> },
  { id: "jmaRadar", render: () => <JmaImageryLegend layerKey="jmaRadar" /> },
  { id: "jmaRasrf", render: () => <JmaImageryLegend layerKey="jmaRasrf" /> },
  { id: "jmaRiskLand", render: () => <JmaImageryLegend layerKey="jmaRiskLand" /> },
  { id: "jmaRiskInund", render: () => <JmaImageryLegend layerKey="jmaRiskInund" /> },
  { id: "jmaUvIndex", render: () => <JmaImageryLegend layerKey="jmaUvIndex" /> },
  { id: "jmaSst", render: () => <JmaImageryLegend layerKey="jmaSst" /> },
  ],
  4: [
  { id: "jmaSeaIce", render: () => <JmaImageryLegend layerKey="jmaSeaIce" /> },
  { id: "jmaHimawari", render: () => <JmaImageryLegend layerKey="jmaHimawari" /> },
  { id: "jmaAnaSnowFirst", render: () => <JmaImageryLegend layerKey="jmaAnaSnowFirst" /> },
  { id: "jmaAnaSnowDays", render: () => <JmaImageryLegend layerKey="jmaAnaSnowDays" /> },
  { id: "jmaAnaRainDays", render: () => <JmaImageryLegend layerKey="jmaAnaRainDays" /> },
  { id: "jmaAnaRiskLandHours", render: () => <JmaImageryLegend layerKey="jmaAnaRiskLandHours" /> },
  { id: "jmaAnaRiskInundHours", render: () => <JmaImageryLegend layerKey="jmaAnaRiskInundHours" /> },
  { id: "gibsSnowCover", render: () => <GibsSnowCoverLegend /> },
  { id: "jmaRiskFlood", render: () => <JmaRiskFloodLegend /> },
  { id: "jmaKosa", render: () => <JmaKosaLegend /> },
  { id: "jpSchools", render: () => <JpSchoolsLegend /> },
  { id: "jpPopulationMesh1km", render: ({ overlayParams }) => <JpPopulationMeshLegend modeIdx={overlayParams.jpPopulationMeshModeIdx ?? 0} /> },
  { id: "jpAccommodationCanonical", render: () => <JpAccommodationTypesLegend source="canonical" /> },
  { id: "jpAccommodationOsm", render: () => <JpAccommodationTypesLegend source="osm" /> },
  ],
  5: [
  { id: "historicalFlightTrails", render: () => <HistoricalFlightTrailsLegend /> },
  ],
  6: [
  { id: "jpBuildingHeight", render: () => <JpBuildingHeightLegend /> },
  ],
  7: [
  { id: "jpCanopyHeight", render: () => <JpCanopyHeightLegend /> },
  ],
  // <codemod:append JP_PACK_LEGEND_SLOTS>
};
