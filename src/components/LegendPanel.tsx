import { COMPARISON_ENABLED_RECIPES } from "../data/comparisonStatisticsRecipes";
import { JP_MEDICAL_AREA_LEVELS, JP_MEDICAL_CARE_GROUPS, JP_MEDICAL_CATEGORIES } from "../data/jpMedicalTypes";
import { StatisticsLegend } from "./sidebar/StatisticsDetails";
import { Fragment, memo, useEffect, useState } from "react";
import { useLocale, type LocaleSnapshot } from "../state/localeStore";
import { DARK_LEGEND, LIGHT_LEGEND, LegendCompactCtx, LegendThemeCtx } from "./legend/legendKit";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BORDER, COLORS, ELEVATION, LIGHT, SURFACE, FONT_CJK, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { type LayerVisibility } from "../types";
import { useLayerVisibilityAll } from "../state/layerVisibilityStore";
import { useOverlayParams } from "../layers/layerParamsAccess";
import { PUBLIC_LIFE_COLORS } from "../data/publicLifePalette";
import { useAnalysisLegend } from "../research/analysisLegendStore";
import { AnalysisLegendSection } from "../research/AnalysisLegendSection";
import { legendKeys } from "../data/legendGroups";
import { AGRI_ENABLED_STATISTICS_RECIPES } from "../data/agriStatisticsRecipes";
import { SOCIAL_ENABLED_STATISTICS_RECIPES } from "../data/socialStatisticsRecipes";
import { LABOR_ENABLED_STATISTICS_RECIPES } from "../data/laborStatisticsRecipes";
import { ENVIRONMENT_ENABLED_STATISTICS_RECIPES } from "../data/environmentStatisticsRecipes";
import { ADDICTION_ENABLED_STATISTICS_RECIPES } from "../data/addictionStatisticsRecipes";
import { LANDSLIDE_ENABLED_STATISTICS_RECIPES } from "../data/landslideStatisticsRecipes";
import { ATLAS_ENABLED_STATISTICS_RECIPES } from "../data/atlasStatisticsRecipes";
import { DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES } from "../data/demographicsStatisticsRecipes";
import { type StatisticsRenderKey } from "../data/regionalStatisticsRecipes";
import { EDUCATION_PRESENTATION_VIEWS } from "../data/statisticsPresentationViews";
import { INFERNO, VIRIDIS, MAGMA } from "../map/demographicsLayerFactory";
import { CARRIER_KINDS, MATCH_STATUSES, NETWORK_STRUCTURES_COLORS } from "../data/networkStructuresTypes";
import { SeaWaterQualityStationsLegend, RiverRpiSegmentsLegend, Pm25ManualStationsLegend, DioxinStationsLegend, IncineratorEmissionsLegend, NuscGammaRadiationLegend, WaterEffluentLiveLegend, CemsStackLiveLegend, CwaUvDailyLegend } from "./legend/environmentLegends";
import { HarmReductionHivSelftestLegend, HarmReductionHivTestingLegend, HarmReductionNeedleLegend, HarmReductionPreventionCentersLegend, HarmReductionTreatmentLegend, HarmReductionAlcoholLegend, HarmReductionPrepLegend, HarmReductionInternetAddictionLegend, HarmReductionAftercareLegend, HarmReductionSmokingCessationLegend, HarmReductionAntiDrugPharmaciesLegend, HarmReductionCondomOutletsLegend, HarmReductionTherapeuticCommunitiesLegend, HarmReductionDuiCrashesLegend } from "./legend/harmReductionLegends";
import { RailRoutesLegend, MetroStationsLegend } from "./legend/railRoutesLegend";
import { JmaAmedasLegend, JmaImageryLegend, JmaQuakesLegend, JmaSnowDepthLegend, JmaVolcanoesLegend, JmaWarningsLegend } from "./legend/jmaLegends";
import { HighwayDisasterHistoryLegend, LandslideAnnualLegend, LandslideDodAreasLegend, LandslideDodImpactLegend } from "./legend/landslideLegends";
import { ATLAS_LEGENDS } from "./legend/atlasLegends";
import { AqiLegend, AviationNoiseZonesLegend, DustForecastLegend, H3RampLegend, LightningCwaLegend, LightningLegend, MicroSensorLegend, NoiseCaptureGridLegend, NoiseControlZonesLegend, NoiseEnforcementEventsLegend, OceanCurrentsLegend, OfficialNoiseMonitoringLegend, PollutionPenaltyLegend, PollutionSeverityLegend, SoundCameraLocationsLegend, TemperatureGridLegend, TemperatureWaveLegend, UrbanHeatLegend, WasteFacilityLegend, WasteTruckLegend, WindFieldLegend } from "./legend/environmentWeatherLegends";
import { AisstreamVesselsLegend, AllenCoralAtlasLegend, AquacultureIntegratedLegend, AquacultureLegend, AquacultureWaterSatelliteMoaLegend, AquacultureWaterUnionLegend, CoralReefDistributionLegend, GfwDarkVesselsLegend, GfwFishingEffortLegend, GfwHourlyGridLegend, GfwHourlyTracksLegend, GfwVesselPresenceLegend, IsobathLegend, MarineObservationLegend, MaritimeBoundaryLegend, PlaActivityLegend, ShipsLegend, VesselWatchLegend, WorldTrashDebrisLegend } from "./legend/maritimeLegends";
import { AviationAirspaceLegend, CctvLegend, DroneZonesLegend, FlightsLegend, FreewayCongestionLegend, HistoricalFlightTrailsLegend, JpRailwaysLegend, JpStationsLegend, OsmRoadDriveLegend, ParkingLegend, PortsLegend, RailLegend, RoadCongestionLegend, RoadEventsLegend, SatelliteLegend, TouristShuttleLegend } from "./legend/transportLegends";
import { AspectVectorLegend, BridgeResilienceLegend, BssBridgeLineLegend, BssBridgePointLegend, DisasterAlertLegend, EarthquakeGlobalLegend, EarthquakeLegend, EarthquakeReplayLegend, ErCongestionLegend, FireEventLegend, FireHydrantLegend, FireIsochroneLegend, FireStationLegend, FloodSensorLegend, GlobalEventsLegend, LiquefactionMonitoringLegend, MountainRescueLegend, NewsEventsLegend, NuclearLegend, SlopeVectorLegend, SoilLiquefactionPotentialLegend, TyphoonTrackLegend, WeakSoilLegend } from "./legend/hazardLegends";
import { AgriCompanyLegend, AgriPOILegend, CommonRegistrationAddressesLegend, CompanyAgeStructureLegend, CompanyCapitalGridLegend, CompanyIndustryDistributionLegend, CompanyPointsLegend, CropSuitabilityLegend, FactoryLocationsLegend, ForestryLegend, IndustrialDensityGridLegend, IndustrialParkBoundariesLegend, IndustrialParkComparisonLegend, LivestockFacilityLegend, LivestockFarmLegend, RegulatedFacilitiesLegend, SoilFertilityLegend } from "./legend/agriIndustryLegends";
import { DrinkingWaterProtectionZonesLegend, GroundwaterLegend, IotRiverLegend, IotStructureLegend, JpWaterFloodHazardLegend, JpWaterLegend, LakesPondsLegend, RainGaugeLegend, ReservoirStatusLegend, RiverLevelLegend, RiverRpiStationsLegend, SewageTreatmentPlantsLegend, TaipeiEvacuateLegend, TaipeiPumbLegend, TaipeiSewerLegend, WaterCanalLegend, WaterFacilityLegend, WaterFloodExtremeLegend, WaterMonitorStationLegend, WaterProtectionZoneLegend, WaterQualityStationsLegend } from "./legend/waterLegends";
import { AnfrWirelessSitesLegend, CoverageLegend, EnergyFuelLegend, EnergyReserveLegend, EnergySpecialtyLegend, FacOffshoreLegend, FacilityFuelLegend, FossilFuelLegend, InternetExchangePointsLegend, LandingStationLegend, NetworkStructuresLegend, OoklaPerformanceGridLegend, OsmCommunicationSitesLegend, PowerGridLegend, PowerPolesLegend, RenewablePoiLegend, RipeAtlasProbesLegend, SubmarineCableLegend, SubstationEhvLegend, SubstationLocalLegend } from "./legend/energyTelecomLegends";
import { AccessibleParkLegend, AnimalAdoptionLegend, AnimalShelterPressureLegend, AnimalWelfarePointsLegend, BicycleSupportLegend, EducationLegend, GovServiceOfficeLegend, GovernmentLifeLegend, JpMedicalLegend, JpPoliceFacilitiesLegend, JpSchoolsLegend, MedicalIsochroneLegend, MedicalLegend, PoliceIsochroneLegend, PoliceJusticeLegend, PublicLifeCoverageLegend, PublicLifeOsmLegend, PublicToiletLegend, WelfareLegend } from "./legend/civicServiceLegends";
import { BuildingsGbaLegend, CanopyGiantsLegend, CanopyHeightLegend, EcoNetworkZonesLegend, JpBuildingHeightLegend, JpCanopyHeightLegend, JpPopulationMeshLegend, NonUrbanZoningLegend, ParksTaipeiLegend, PropertyValueAdminLegend, PropertyValueGridLegend, ProtectedTreesNationalLegend, RealEstateLegend, RiversideTreesTaipeiLegend, StreetTrees3epochLegend, StreetTreesNationalLegend, StreetTreesTaipeiDiffLegend, TreePitsTaipeiLegend, UrbanFormGridLegend, UrbanZoningLegend } from "./legend/urbanFormLegends";
import { ArtsEventsLegend, CulturalFacilitiesLegend, CulturalMuseumsLegend, FuneralLegend, JpAccommodationDensityLegend, JpAccommodationTypesLegend, JpReligionLegend, LibrarySeatsLegend, PerformingVenuesLegend, ReligionLegend, SportsVenueLegend, TourAttractionsLegend, TourEventsLegend, TourHeritageLegend, TourHotelsLegend } from "./legend/cultureLegends";
import { DenseSingleColorLegend } from "./legend/legendShared";


/**
 * 右下角圖例面板 — 只顯示目前開啟的圖層對應圖例
 */

// 文字主題色、色票與標題元件在 ./legend/legendKit（LG-1–LG-11）。

// ── Earthquake depth color stops ──
interface LegendPanelProps {
  /** LG-9：停靠 popup 開著時為 true，所有圖例只留標題與色票（註記、來源收起）。 */
  compact?: boolean;
  /**
   * 圖層開關。**主站不傳** —— 改由本元件自己訂閱 `layerVisibilityStore`
   * （AR-21 試點），這樣 App 因無關狀態重繪時 memo 能整個跳過本面板。
   *
   * `/embed` 仍要傳：embed 的 visibility 是 mount 時從網址參數凍結的 ref，
   * 完全不進 store（embed 從不寫 store）。有 prop 就以 prop 為準。
   */
  visibility?: LayerVisibility;
  /**
   * 圖例要照當下 paint 畫色階，讀的是整包編碼後的參數。**主站不傳** ——
   * 改由本元件自己訂閱 `layerParamsStore`（AR-22 P4，比照上方 visibility 的 AR-21 試點），
   * 這樣 App 因無關狀態重繪時 memo 能整個跳過本面板，拖 slider 也只重繪這裡。
   *
   * `/embed` 仍要傳：embed 的參數是 mount 時從網址凍結的，完全不進 store。
   */
  overlayParams?: Record<string, number>;
  /** 淺色底圖時傳 false 讓面板外殼切成淺色 chrome（色票資料兩主題共用，不受影響）*/
  isDarkTheme?: boolean;
  /**
   * `/embed` 的 `rsys=`：鐵路只顯示這幾個系統。主站不傳（六系統恆全開），
   * undefined ＝ 全部，圖例維持原樣。
   */
  railSystems?: readonly string[];
}

export interface LegendContext {
  visibility: LayerVisibility;
  overlayParams: Record<string, number>;
  /**
   * 與 overlayRegistry paint 的 `isDark` 同一個值（App.tsx 的 isDarkTheme → MapView →
   * updateAllOverlayThemes）。paint 有明暗雙色的圖層，圖例必須用同一邊的 hex，
   * 否則色票會跟地圖對不上。
   */
  isDark: boolean;
  /** 見 LegendPanelProps.railSystems。只有 RailLegend 消費。 */
  railSystems?: readonly string[];
  /** 目前語系（render 不是元件，不能呼叫 hook；registry 裡 inline 傳入的文字用它翻譯）。 */
  i18n: LocaleSnapshot;
}

export interface LegendEntry {
  /**
   * 圖例群組 id —— 成員名單**不在這裡寫**，由 manifest 的 `legend` 欄位反查
   * （`legendKeys(id)`）。任一成員 key 開啟即顯示此圖例。
   *
   * ⚠️ id 必須在 manifest 至少有一個成員，否則這筆圖例永遠不顯示（死 entry）——
   * `layerManifest.test.ts` 雙向擋。id 也必須唯一：兩筆同 id 會拿到同一份成員名單、
   * 同時顯示兩份圖例。
   */
  id: string;
  render: (ctx: LegendContext) => React.ReactNode;
}

/**
 * Legend registry — 單一接線點：新 layer 要圖例就在這裡加一行
 * （元件寫在 `src/components/legend/<domain>Legends.tsx`），manifest 那筆的 `legend` 填同一個 id 即完成接線。
 * layerConsistency 測試以 manifest 的 `legend` 為覆蓋依據。
 * 順序 = 面板顯示順序。
 *
 * ⚠️ AR-22 Phase 4b 起 `keys` 不再手寫 —— 見 `data/legendGroups.ts` 檔頭
 * （含「派生的代價：填錯 id 會自我實現」那段）。
 */
export const LEGEND_REGISTRY: LegendEntry[] = [
  { id: "landslideDodAreas", render: () => <LandslideDodAreasLegend /> },
  { id: "landslideDodImpact", render: () => <LandslideDodImpactLegend /> },
  { id: "highwayDisasterHistory", render: () => <HighwayDisasterHistoryLegend /> },
  { id: "landslideAnnual", render: () => <LandslideAnnualLegend /> },
  ...Object.entries(ATLAS_LEGENDS).map(([id, render]) => ({ id, render })),
  { id: "harmReductionNeedle", render: () => <HarmReductionNeedleLegend /> },
  { id: "harmReductionTreatment", render: () => <HarmReductionTreatmentLegend /> },
  { id: "harmReductionHivSelftest", render: () => <HarmReductionHivSelftestLegend /> },
  { id: "harmReductionHivTesting", render: () => <HarmReductionHivTestingLegend /> },
  { id: "harmReductionPreventionCenters", render: () => <HarmReductionPreventionCentersLegend /> },
  { id: "harmReductionAlcohol", render: () => <HarmReductionAlcoholLegend /> },
  { id: "harmReductionPrep", render: () => <HarmReductionPrepLegend /> },
  { id: "harmReductionInternetAddiction", render: () => <HarmReductionInternetAddictionLegend /> },
  { id: "harmReductionAftercare", render: () => <HarmReductionAftercareLegend /> },
  { id: "harmReductionSmokingCessation", render: () => <HarmReductionSmokingCessationLegend /> },
  { id: "harmReductionAntiDrugPharmacies", render: () => <HarmReductionAntiDrugPharmaciesLegend /> },
  { id: "harmReductionCondomOutlets", render: () => <HarmReductionCondomOutletsLegend /> },
  { id: "harmReductionTherapeuticCommunities", render: () => <HarmReductionTherapeuticCommunitiesLegend /> },
  { id: "harmReductionDuiCrashes", render: () => <HarmReductionDuiCrashesLegend /> },
  { id: "drinkingWaterPoints", render: ({ i18n }) => <PublicLifeOsmLegend label={i18n.t("legend.registry.drinkingWater")} color={PUBLIC_LIFE_COLORS.drinkingWaterPoints} /> },
  { id: "publicWasteBaskets", render: ({ i18n }) => <PublicLifeOsmLegend label={i18n.t("legend.registry.wasteBaskets")} color={PUBLIC_LIFE_COLORS.publicWasteBaskets} /> },
  { id: "materialRecyclingPoints", render: ({ i18n }) => <PublicLifeOsmLegend label={i18n.t("legend.registry.recyclingPoints")} color={PUBLIC_LIFE_COLORS.materialRecyclingPoints} extra={i18n.t("legend.registry.recyclingExtra")} /> },
  { id: "disasterShelters", render: ({ i18n }) => <GovernmentLifeLegend label={i18n.t("legend.registry.disasterShelters")} color={PUBLIC_LIFE_COLORS.disasterShelters} source={i18n.t("legend.registry.disasterSheltersSource")} extra={i18n.t("legend.registry.disasterSheltersExtra")} /> },
  { id: "playgrounds", render: ({ i18n }) => <PublicLifeOsmLegend label={i18n.t("legend.registry.playgrounds")} color={PUBLIC_LIFE_COLORS.playgrounds} /> },
  { id: "accessibleParkFacilities", render: () => <AccessibleParkLegend /> },
  { id: "bicycleSupport", render: () => <BicycleSupportLegend /> },
  { id: "nationalParks", render: ({ i18n }) => <GovernmentLifeLegend label={i18n.t("legend.registry.nationalParks")} color="#15803d" source={i18n.t("legend.registry.nationalParksSource")} extra={i18n.t("legend.registry.nationalParksExtra")} /> },
  { id: "visitorCentres", render: ({ i18n }) => <PublicLifeOsmLegend label={i18n.t("legend.registry.visitorCentres")} color={PUBLIC_LIFE_COLORS.visitorCentres} /> },
  { id: "publicLifeOsmCoverage", render: () => <PublicLifeCoverageLegend /> },
  ...AGRI_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...COMPARISON_ENABLED_RECIPES.map(recipe => ({id: recipe.layer_key, render: () => <StatisticsLegend layerKey={recipe.layer_key} />})),
  ...SOCIAL_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...LABOR_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...ENVIRONMENT_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...ADDICTION_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...LANDSLIDE_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...ATLAS_ENABLED_STATISTICS_RECIPES.map((recipe) => ({
    id: recipe.layer_key,
    render: () => <StatisticsLegend layerKey={recipe.layer_key as StatisticsRenderKey} />,
  })),
  ...EDUCATION_PRESENTATION_VIEWS.map((view) => ({
    id: view.key,
    render: () => <StatisticsLegend layerKey={view.key} />,
  })),
  { id: "statsMaritimeSubsidyCounty", render: () => <StatisticsLegend layerKey="statsMaritimeSubsidyCounty" /> },
  { id: "statsCivilAeronauticsSubsidyCounty", render: () => <StatisticsLegend layerKey="statsCivilAeronauticsSubsidyCounty" /> },
  { id: "statsTaipeiTrafficViolationCitations", render: () => <StatisticsLegend layerKey="statsTaipeiTrafficViolationCitations" /> },
  { id: "statsTaichungRoadNoiseMonitoringStations", render: () => <StatisticsLegend layerKey="statsTaichungRoadNoiseMonitoringStations" /> },
  { id: "statsBusOperatingRouteLengthKm", render: () => <StatisticsLegend layerKey="statsBusOperatingRouteLengthKm" /> }, { id: "statsBusApprovedRouteCount", render: () => <StatisticsLegend layerKey="statsBusApprovedRouteCount" /> }, { id: "statsUrbanBusOperatorCount", render: () => <StatisticsLegend layerKey="statsUrbanBusOperatorCount" /> }, { id: "statsBusOperatingVehicleCount", render: () => <StatisticsLegend layerKey="statsBusOperatingVehicleCount" /> }, { id: "statsBusAccessibleVehicleCount", render: () => <StatisticsLegend layerKey="statsBusAccessibleVehicleCount" /> }, { id: "statsBusElectricVehicleCount", render: () => <StatisticsLegend layerKey="statsBusElectricVehicleCount" /> }, { id: "statsBusOperatingTripCount", render: () => <StatisticsLegend layerKey="statsBusOperatingTripCount" /> }, { id: "statsBusOperatingVehicleKm", render: () => <StatisticsLegend layerKey="statsBusOperatingVehicleKm" /> }, { id: "statsTmrtStationOutboundCounty", render: () => <StatisticsLegend layerKey="statsTmrtStationOutboundCounty" /> },
  { id: "statsTaipeiUrbanRentalStations", render: () => <StatisticsLegend layerKey="statsTaipeiUrbanRentalStations" /> }, { id: "statsTaipeiUrbanRentalTrips", render: () => <StatisticsLegend layerKey="statsTaipeiUrbanRentalTrips" /> }, { id: "statsTaipeiRiversideRentalStations", render: () => <StatisticsLegend layerKey="statsTaipeiRiversideRentalStations" /> }, { id: "statsTaipeiRiversideBicycles", render: () => <StatisticsLegend layerKey="statsTaipeiRiversideBicycles" /> }, { id: "statsTaipeiRiversideRentalTrips", render: () => <StatisticsLegend layerKey="statsTaipeiRiversideRentalTrips" /> },
  { id: "statsA1AccidentCount", render: () => <StatisticsLegend layerKey="statsA1AccidentCount" /> }, { id: "statsA1DeathCount", render: () => <StatisticsLegend layerKey="statsA1DeathCount" /> }, { id: "statsA1InjuryCount", render: () => <StatisticsLegend layerKey="statsA1InjuryCount" /> },
  { id: "statsAirportTakeoffsLandings", render: () => <StatisticsLegend layerKey="statsAirportTakeoffsLandings" /> }, { id: "statsAirportPassengerMovements", render: () => <StatisticsLegend layerKey="statsAirportPassengerMovements" /> }, { id: "statsAirportCargoTonnes", render: () => <StatisticsLegend layerKey="statsAirportCargoTonnes" /> },
  { id: "statsTaoyuanAirportArrivals", render: () => <StatisticsLegend layerKey="statsTaoyuanAirportArrivals" /> }, { id: "statsTaoyuanAirportDepartures", render: () => <StatisticsLegend layerKey="statsTaoyuanAirportDepartures" /> }, { id: "statsTaoyuanAirportTransit", render: () => <StatisticsLegend layerKey="statsTaoyuanAirportTransit" /> }, { id: "statsTaoyuanAirportPassengerMovements", render: () => <StatisticsLegend layerKey="statsTaoyuanAirportPassengerMovements" /> },
  { id: "statsOffstreetSmallCarParkingSpacesCount", render: () => <StatisticsLegend layerKey="statsOffstreetSmallCarParkingSpacesCount" /> },
  { id: "statsOnstreetSmallCarParkingSpacesCount", render: () => <StatisticsLegend layerKey="statsOnstreetSmallCarParkingSpacesCount" /> },
  { id: "statsMotorcycleRegisteredCount", render: () => <StatisticsLegend layerKey="statsMotorcycleRegisteredCount" /> },
  { id: "statsAutomobileRegisteredCount", render: () => <StatisticsLegend layerKey="statsAutomobileRegisteredCount" /> },
  { id: "statsAutomobileLicenseHoldersCount", render: () => <StatisticsLegend layerKey="statsAutomobileLicenseHoldersCount" /> },
  { id: "statsMotorcycleLicenseHoldersCount", render: () => <StatisticsLegend layerKey="statsMotorcycleLicenseHoldersCount" /> },
  { id: "statsWasteRecyclingRate", render: () => <StatisticsLegend layerKey="statsWasteRecyclingRate" /> },
  { id: "statsResidentialElectricity", render: () => <StatisticsLegend layerKey="statsResidentialElectricity" /> },
  { id: "statsRiceHarvest", render: () => <StatisticsLegend layerKey="statsRiceHarvest" /> },
  { id: "statsBirthsTownship", render: () => <StatisticsLegend layerKey="statsBirthsTownship" /> },
  { id: "statsPigWaterCounty", render: () => <StatisticsLegend layerKey="statsPigWaterCounty" /> },
  { id: "statsWaterSupplyHistorical", render: () => <StatisticsLegend layerKey="statsWaterSupplyHistorical" /> },
  { id: "statsWasteCounty", render: () => <StatisticsLegend layerKey="statsWasteCounty" /> },
  { id: "statsRecyclingCounty", render: () => <StatisticsLegend layerKey="statsRecyclingCounty" /> },
  { id: "earthquakes", render: () => <EarthquakeLegend /> },
  { id: "soilLiquefactionPotential", render: () => <SoilLiquefactionPotentialLegend /> },
  { id: "weakSoilClay", render: () => <WeakSoilLegend type="clay" /> },
  { id: "weakSoilSand", render: () => <WeakSoilLegend type="sand" /> },
  { id: "liquefactionMonitoringSites", render: () => <LiquefactionMonitoringLegend /> },
  { id: "earthquakeReplay", render: () => <EarthquakeReplayLegend /> },
  { id: "earthquakesGlobal", render: () => <EarthquakeGlobalLegend /> },
  { id: "worldTrashDebris", render: () => <WorldTrashDebrisLegend /> },
  { id: "coralReefDistribution", render: () => <CoralReefDistributionLegend /> },
  { id: "allenCoralAtlas", render: () => <AllenCoralAtlasLegend /> },
  { id: "globalEvents", render: () => <GlobalEventsLegend /> },
  ...JP_MEDICAL_CATEGORIES.map(({ key }) => ({ id: key, render: () => <JpMedicalLegend layerKey={key} /> })),
  ...JP_MEDICAL_CARE_GROUPS.map(({ key }) => ({ id: key, render: () => <JpMedicalLegend layerKey={key} /> })),
  ...JP_MEDICAL_AREA_LEVELS.map(({ key }) => ({ id: key, render: () => <JpMedicalLegend layerKey={key} /> })),
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
  { id: "osmBridgeCarriers", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.bridgeCarriers")} rows={CARRIER_KINDS} line /> },
  { id: "osmBridgeFootprints", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.bridgeFootprints")} rows={[{ label: i18n.t("legend.registry.bridgeFootprintsRow"), color: NETWORK_STRUCTURES_COLORS.footprint }]} /> },
  { id: "officialBridgesNewTaipei", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.newTaipeiBridges")} rows={[{ label: i18n.t("legend.registry.newTaipeiBridgesRow1"), color: NETWORK_STRUCTURES_COLORS.official }, { label: i18n.t("legend.registry.newTaipeiBridgesRow2"), color: NETWORK_STRUCTURES_COLORS.official }]} /> },
  { id: "bridgeComparisonNewTaipei", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.bridgeComparison")} rows={MATCH_STATUSES} /> },
  { id: "tainanBridgeInspections", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.tainanInspections")} rows={[{ label: i18n.t("legend.registry.tainanInspectionsRow"), color: "#a855f7" }]} /> },
  { id: "officialBridgesHsinchu", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.hsinchuBridges")} rows={[{ label: i18n.t("legend.registry.hsinchuBridgesRow"), color: "#22d3ee" }]} /> },
  { id: "taipeiRoadTunnels", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.taipeiTunnels")} rows={[{ label: i18n.t("legend.registry.taipeiTunnelsRow"), color: "#f59e0b" }]} /> },
  { id: "tainanRoadTunnels", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.tainanTunnels")} rows={[{ label: i18n.t("legend.registry.tainanTunnelsRow"), color: "#fb923c" }]} /> },
  { id: "changhuaTrafficSignals", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.changhuaSignals")} rows={[{ label: i18n.t("legend.registry.changhuaSignalsRow"), color: "#84cc16" }]} /> },
  { id: "bssNationalBridgePreview", render: () => <BssBridgeLineLegend /> },
  { id: "bssNationalBridgePointsPreview", render: () => <BssBridgePointLegend /> },
  { id: "bridgeResilienceTwinCity", render: ({ overlayParams }) => <BridgeResilienceLegend weightingIdx={overlayParams.bridgeResilienceWeightingIdx ?? 0} metricIdx={overlayParams.bridgeResilienceVillageMetricIdx ?? 0} showVillages={!!overlayParams.bridgeResilienceShowVillages} showRoutes={!!overlayParams.bridgeResilienceShowRoutes} /> },
  { id: "bridgeRainThresholds", render: ({ i18n }) => <NetworkStructuresLegend title={i18n.t("legend.registry.bridgeRain")} rows={[{ label: i18n.t("legend.registry.bridgeRainRow1"), color: "#ef4444" }, { label: i18n.t("legend.registry.bridgeRainRow2"), color: "#3b82f6" }, { label: i18n.t("legend.registry.bridgeRainRow3"), color: "#94a3b8" }]} /> },
  { id: "jpPoliceFacilities", render: () => <JpPoliceFacilitiesLegend /> },
  { id: "jmaAmedas", render: () => <JmaAmedasLegend /> },
  { id: "jmaWarnings", render: () => <JmaWarningsLegend /> },
  { id: "jmaQuakes", render: () => <JmaQuakesLegend /> },
  { id: "jmaVolcanoes", render: () => <JmaVolcanoesLegend /> },
  { id: "jmaSnowDepth", render: () => <JmaSnowDepthLegend /> },
  { id: "jmaRadar", render: () => <JmaImageryLegend layerKey="jmaRadar" /> },
  { id: "jmaRasrf", render: () => <JmaImageryLegend layerKey="jmaRasrf" /> },
  { id: "jmaRiskLand", render: () => <JmaImageryLegend layerKey="jmaRiskLand" /> },
  { id: "jmaRiskInund", render: () => <JmaImageryLegend layerKey="jmaRiskInund" /> },
  { id: "jmaUvIndex", render: () => <JmaImageryLegend layerKey="jmaUvIndex" /> },
  { id: "jmaSst", render: () => <JmaImageryLegend layerKey="jmaSst" /> },
  { id: "jmaSeaIce", render: () => <JmaImageryLegend layerKey="jmaSeaIce" /> },
  { id: "jmaHimawari", render: () => <JmaImageryLegend layerKey="jmaHimawari" /> },
  { id: "jmaAnaSnowFirst", render: () => <JmaImageryLegend layerKey="jmaAnaSnowFirst" /> },
  { id: "jmaAnaSnowDays", render: () => <JmaImageryLegend layerKey="jmaAnaSnowDays" /> },
  { id: "jmaAnaRainDays", render: () => <JmaImageryLegend layerKey="jmaAnaRainDays" /> },
  { id: "jmaAnaRiskLandHours", render: () => <JmaImageryLegend layerKey="jmaAnaRiskLandHours" /> },
  { id: "jmaAnaRiskInundHours", render: () => <JmaImageryLegend layerKey="jmaAnaRiskInundHours" /> },
  { id: "jpSchools", render: () => <JpSchoolsLegend /> },
  { id: "jpPopulationMesh1km", render: ({ overlayParams }) => <JpPopulationMeshLegend modeIdx={overlayParams.jpPopulationMeshModeIdx ?? 0} /> },
  { id: "jpAccommodationCanonical", render: () => <JpAccommodationTypesLegend source="canonical" /> },
  { id: "jpAccommodationOsm", render: () => <JpAccommodationTypesLegend source="osm" /> },
  { id: "jpAccommodationDensity", render: ({ overlayParams, isDark }) => <JpAccommodationDensityLegend scaleIdx={overlayParams.jpAccommodationDensityScaleIdx ?? 0}  isDark={isDark} /> },
  { id: "typhoonTracks", render: () => <TyphoonTrackLegend /> },
  { id: "windField", render: () => <WindFieldLegend /> },
  { id: "oceanCurrents", render: () => <OceanCurrentsLegend /> },
  { id: "dustForecast", render: () => <DustForecastLegend /> },
  { id: "temperatureGrid", render: () => <TemperatureGridLegend /> },
  { id: "temperatureWave", render: ({ visibility }) => <TemperatureWaveLegend gridAlsoOn={!!visibility.temperatureGrid} /> },
  { id: "aqiMicroSensors", render: ({ overlayParams }) => <MicroSensorLegend modeIdx={overlayParams.aqiMicroModeIdx ?? 0} /> },
  { id: "aqiImagery", render: () => <AqiLegend /> },
  { id: "urbanHeat", render: ({ overlayParams }) => <UrbanHeatLegend modeIdx={overlayParams.urbanHeatModeIdx ?? 0} /> },
  { id: "lifelineAlerts", render: ({ visibility }) => <DisasterAlertLegend visibility={visibility} /> },
  { id: "roadEvents", render: () => <RoadEventsLegend /> },
  { id: "roadCongestion", render: () => <RoadCongestionLegend /> },
  { id: "freewayCongestion", render: () => <FreewayCongestionLegend /> },
  { id: "cctv", render: () => <CctvLegend /> },
  // 人口 / 社經 H3 網格：色階由 demographicsLayerFactory 預烤進 properties.color
  { id: "popCount", render: ({ i18n }) => <H3RampLegend title={i18n.t("legend.registry.popCount")} titleEn="Population" ramp={INFERNO} note={i18n.t("legend.registry.popCountNote")} /> },
  { id: "indicators", render: ({ i18n }) => <H3RampLegend title={i18n.t("legend.registry.indicators")} titleEn="Indicators" ramp={INFERNO} note={i18n.t("legend.registry.indicatorsNote")} /> },
  { id: "socioeconomic", render: ({ i18n }) => <H3RampLegend title={i18n.t("legend.registry.socioeconomic")} titleEn="Socio-Econ" ramp={VIRIDIS} note={i18n.t("legend.registry.socioeconomicNote")} /> },
  { id: "spatialEconomy", render: ({ i18n }) => <H3RampLegend title={i18n.t("legend.registry.spatialEconomy")} titleEn="Spatial-Econ" ramp={MAGMA} note={i18n.t("legend.registry.spatialEconomyNote")} /> },
  { id: "touristShuttleLive", render: () => <TouristShuttleLegend /> },
  // EM-16：回放圖層。主站與 /embed 共用本面板，補這兩條就同時補上嵌入版的圖例洞。
  { id: "ships", render: () => <ShipsLegend /> },
  { id: "flights", render: () => <FlightsLegend /> },
  { id: "historicalFlightTrails", render: () => <HistoricalFlightTrailsLegend /> },
  { id: "rail", render: ({ railSystems }) => <RailLegend railSystems={railSystems} /> },
  { id: "wasteTruck", render: () => <WasteTruckLegend /> },
  { id: "railRoutes", render: () => <RailRoutesLegend /> },
  { id: "stationsMetro", render: () => <MetroStationsLegend /> },
  { id: "ports", render: () => <PortsLegend /> },
  { id: "newsEvents", render: ({ isDark }) => <NewsEventsLegend  isDark={isDark} /> },
  { id: "plaActivity", render: () => <PlaActivityLegend /> },
  { id: "vesselWatch", render: () => <VesselWatchLegend /> },
  { id: "aisstreamVessels", render: () => <AisstreamVesselsLegend /> },
  { id: "gfwVesselPresence", render: () => <GfwVesselPresenceLegend /> },
  { id: "gfwHourlyGrid", render: () => <GfwHourlyGridLegend /> },
  { id: "gfwHourlyTracks", render: ({ isDark }) => <GfwHourlyTracksLegend isDark={isDark} /> },
  { id: "gfwFishingEffort", render: () => <GfwFishingEffortLegend /> },
  { id: "gfwDarkVessels", render: () => <GfwDarkVesselsLegend /> },
  { id: "iotWraRiver", render: () => <IotRiverLegend /> },
  { id: "iotWraStructure", render: () => <IotStructureLegend /> },
  { id: "agriCropSuitability", render: ({ overlayParams }) => <CropSuitabilityLegend cropId={overlayParams.agriCropSuitabilityCropId ?? 0} /> },
  { id: "agriPOI", render: () => <AgriPOILegend /> },
  { id: "agriRetail", render: ({ visibility }) => <AgriCompanyLegend visibility={visibility} /> },
  { id: "commonRegistrationAddresses", render: ({ overlayParams }) => <CommonRegistrationAddressesLegend minCompanies={overlayParams.commonRegistrationAddressesMinCompanies ?? 5} /> },
  { id: "companyPoints", render: ({ overlayParams }) => <CompanyPointsLegend manufacturing={false} overlayParams={overlayParams} /> },
  { id: "manufacturingCompanyPoints", render: () => <CompanyPointsLegend manufacturing /> },
  { id: "companyCapitalGrid", render: ({ overlayParams, isDark }) => <CompanyCapitalGridLegend modeIdx={overlayParams.companyGridModeIdx ?? 0} scaleIdx={overlayParams.companyGridScaleIdx ?? 0} isDark={isDark} /> },
  { id: "companyIndustryDistribution", render: ({ overlayParams }) => <CompanyIndustryDistributionLegend modeIdx={overlayParams.companyIndustryDisplayIdx ?? 0} mask={overlayParams.companyIndustryGroupsMask ?? 2047} midIdx={overlayParams.companyIndustryDistributionMidIdx ?? 0} /> },
  { id: "companyAgeStructure", render: ({ overlayParams }) => <CompanyAgeStructureLegend modeIdx={overlayParams.companyAgeStructureModeIdx ?? 0} /> },
  { id: "factoryDensityGrid", render: ({ i18n }) => <IndustrialDensityGridLegend layer="factoryDensityGrid" title={i18n.t("legend.registry.factoryDensity")} titleEn="Factory Density" unit={i18n.t("legend.registry.unitFirms")} note={i18n.t("legend.registry.factoryDensityNote")} /> },
  { id: "manufacturingCompanyDensityGrid", render: ({ i18n }) => <IndustrialDensityGridLegend layer="manufacturingCompanyDensityGrid" title={i18n.t("legend.registry.manufacturingDensity")} unit={i18n.t("legend.registry.unitFirms")} note={i18n.t("legend.registry.manufacturingDensityNote")} /> },
  { id: "factoryLocations", render: () => <FactoryLocationsLegend /> },
  { id: "industrialParkBoundaries", render: ({ isDark }) => <IndustrialParkBoundariesLegend isDark={isDark} /> },
  { id: "regulatedFacilities", render: () => <RegulatedFacilitiesLegend /> },
  { id: "regulatedFacilityDensityGrid", render: ({ i18n }) => <IndustrialDensityGridLegend layer="regulatedFacilityDensityGrid" title={i18n.t("legend.registry.regulatedDensity")} titleEn="Regulated Facility Density" unit={i18n.t("legend.registry.unitRecords")} note={i18n.t("legend.registry.regulatedDensityNote")} /> },
  { id: "industrialParkComparison", render: ({ overlayParams, isDark }) => <IndustrialParkComparisonLegend modeIdx={overlayParams.industrialParkComparisonModeIdx ?? 0} isDark={isDark} /> },
  { id: "agriSoilFertility", render: ({ overlayParams }) => <SoilFertilityLegend metricIdx={overlayParams.agriSoilFertilityMetricIdx ?? 0} /> },
  { id: "fireEvents", render: () => <FireEventLegend /> },
  { id: "realEstateRentalGrid", render: ({ visibility, overlayParams, isDark }) => <RealEstateLegend visibility={visibility} overlayParams={overlayParams} isDark={isDark} /> },
  { id: "fireStations", render: () => <FireStationLegend /> },
  { id: "fireHydrants", render: () => <FireHydrantLegend /> },
  // R5：單色密集點拉遠改熱區，補圖例說明熱區色階（點色與 overlayRegistry 同）
  { id: "busStationsCity", render: ({ isDark, i18n }) => <DenseSingleColorLegend layer="busStationsCity" label={i18n.t("legend.registry.busStationsCity")} color={isDark ? "#66bb6a" : "#388e3c"} /> },
  { id: "busStationsIntercity", render: ({ isDark, i18n }) => <DenseSingleColorLegend layer="busStationsIntercity" label={i18n.t("legend.registry.busStationsIntercity")} color={isDark ? "#ab47bc" : "#7b1fa2"} /> },
  { id: "convenienceStores", render: ({ isDark, i18n }) => <DenseSingleColorLegend layer="convenienceStores" label={i18n.t("legend.registry.convenienceStores")} color={isDark ? "#26c6da" : "#00838f"} /> },
  { id: "wasteStopsStatic", render: ({ isDark, i18n }) => <DenseSingleColorLegend layer="wasteStopsStatic" label={i18n.t("legend.registry.wasteStopsStatic")} color={isDark ? "#fbbf24" : "#d97706"} /> },
  { id: "fireIsochrone", render: () => <FireIsochroneLegend /> },
  { id: "livestockFarmPig", render: () => <LivestockFarmLegend /> },
  { id: "livestockSlaughter", render: () => <LivestockFacilityLegend /> },
  { id: "animalAdoption", render: () => <AnimalAdoptionLegend /> },
  { id: "animalShelterPressure", render: () => <AnimalShelterPressureLegend /> },
  { id: "animalWelfarePoints", render: () => <AnimalWelfarePointsLegend /> },
  { id: "aquaculturePonds", render: ({ visibility }) => <AquacultureLegend visibility={visibility} /> },
  { id: "aquacultureWaterSatelliteMoa", render: () => <AquacultureWaterSatelliteMoaLegend /> },
  { id: "aquacultureWaterUnion", render: () => <AquacultureWaterUnionLegend /> },
  { id: "aquacultureIntegrated", render: () => <AquacultureIntegratedLegend /> },
  { id: "streetTreesTaipeiDiff", render: ({ overlayParams }) => <StreetTreesTaipeiDiffLegend colorModeIdx={overlayParams.streetTreesTaipeiDiffColorModeIdx ?? 0} /> },
  { id: "protectedTreesNational", render: ({ overlayParams }) => <ProtectedTreesNationalLegend colorModeIdx={overlayParams.protectedTreesNationalColorModeIdx ?? 0} /> },
  { id: "riversideTreesTaipei", render: () => <RiversideTreesTaipeiLegend /> },
  { id: "parksTaipei", render: () => <ParksTaipeiLegend /> },
  { id: "streetTreesTaipei3epoch", render: ({ overlayParams }) => <StreetTrees3epochLegend colorModeIdx={overlayParams.streetTreesTaipei3epochColorModeIdx ?? 0} /> },
  { id: "streetTreesNational", render: ({ overlayParams }) => <StreetTreesNationalLegend colorModeIdx={overlayParams.streetTreesNationalColorModeIdx ?? 0} /> },
  { id: "treePitsTaipei", render: () => <TreePitsTaipeiLegend /> },
  { id: "buildingsGba", render: ({ overlayParams }) => <BuildingsGbaLegend modeIdx={overlayParams.buildingsGbaModeIdx ?? 0} /> },
  { id: "jpBuildingHeight", render: () => <JpBuildingHeightLegend /> },
  { id: "urbanFormGrid", render: ({ overlayParams }) => <UrbanFormGridLegend modeIdx={overlayParams.urbanFormGridModeIdx ?? 5} /> },
  { id: "propertyValueAdmin", render: ({ overlayParams }) => <PropertyValueAdminLegend levelIdx={overlayParams.propertyValueAdminLevelIdx ?? 0} /> },
  { id: "propertyValueGrid", render: ({ overlayParams }) => <PropertyValueGridLegend scaleIdx={overlayParams.propertyValueGridScaleIdx ?? 0} modeIdx={overlayParams.propertyValueGridModeIdx ?? 0} extruded={(overlayParams.propertyValueGridExtruded ?? 0) === 1} /> },
  { id: "urbanZoning", render: () => <UrbanZoningLegend /> },
  { id: "nonUrbanZoning", render: () => <NonUrbanZoningLegend /> },
  { id: "canopyHeight", render: () => <CanopyHeightLegend /> },
  { id: "jpCanopyHeight", render: () => <JpCanopyHeightLegend /> },
  { id: "canopyGiants", render: () => <CanopyGiantsLegend /> },
  { id: "sportsSchool", render: ({ visibility }) => <SportsVenueLegend visibility={visibility} /> },
  { id: "culturalFacilities", render: () => <CulturalFacilitiesLegend /> },
  { id: "culturalMuseums", render: () => <CulturalMuseumsLegend /> },
  { id: "artsEvents", render: () => <ArtsEventsLegend /> },
  { id: "performingVenues", render: () => <PerformingVenuesLegend /> },
  { id: "librarySeats", render: () => <LibrarySeatsLegend /> },
  // 🧳 觀光 Tourism — 4 個分類/雙模式圖例（其餘 8 單色/面層走 baseline）
  { id: "tourAttractions", render: ({ overlayParams }) => <TourAttractionsLegend modeIdx={overlayParams.tourAttractionsModeIdx ?? 0} /> },
  { id: "tourHotels", render: () => <TourHotelsLegend /> },
  { id: "tourHeritage", render: () => <TourHeritageLegend /> },
  { id: "tourEvents", render: () => <TourEventsLegend /> },
  {
    id: "religionTemples",
    render: ({ visibility }) => <ReligionLegend visibility={visibility} />,
  },
  {
    id: "funeralFacilities",
    render: ({ visibility }) => <FuneralLegend visibility={visibility} />,
  },
  {
    // 🤝 社福長照：一個元件涵蓋 9 個 key（同 funeral / forestry 同構家族慣例）
    id: "welfareNursingHomes",
    render: ({ visibility }) => <WelfareLegend visibility={visibility} />,
  },
  { id: "govServiceOffices", render: () => <GovServiceOfficeLegend /> },
  { id: "publicToilets", render: () => <PublicToiletLegend /> },
  { id: "ecoNetworkZones", render: ({ isDark }) => <EcoNetworkZonesLegend isDark={isDark} /> },
  {
    id: "forestCompartments",
    render: ({ visibility, isDark }) => <ForestryLegend visibility={visibility} isDark={isDark} />,
  },
  { id: "mountainRescueIncidents", render: () => <MountainRescueLegend /> },
  { id: "satellitesYaogan", render: ({ visibility }) => <SatelliteLegend visibility={visibility} /> },
  // 通訊基礎設施：海纜（線）+ 登陸站（點）
  { id: "submarineCables", render: () => <SubmarineCableLegend /> },
  { id: "landingStations", render: () => <LandingStationLegend /> },
  { id: "internetExchangePoints", render: () => <InternetExchangePointsLegend /> },
  { id: "anfrWirelessSites", render: () => <AnfrWirelessSitesLegend /> },
  { id: "osmCommunicationSites", render: () => <OsmCommunicationSitesLegend /> },
  { id: "ripeAtlasProbes", render: () => <RipeAtlasProbesLegend /> },
  // 四個 Ookla 層共用這張圖例；配色是 per-layer param，取目前開著的第一層
  {
    id: "ooklaPerformanceGrid",
    render: ({ visibility, overlayParams, isDark }) => <OoklaPerformanceGridLegend paletteIdx={
      visibility.ooklaMobilePerformance ? overlayParams.ooklaMobilePerformancePalette
        : visibility.ooklaFixedPerformance ? overlayParams.ooklaFixedPerformancePalette
          : visibility.ooklaMobileTaiwan ? overlayParams.ooklaMobileTaiwanPalette
            : overlayParams.ooklaFixedTaiwanPalette
    } isDark={isDark} taiwanOnly={!visibility.ooklaMobilePerformance && !visibility.ooklaFixedPerformance} />,
  },
  // R6 段 2：水庫即時水情平面圓點（警示等級色＋容量大小）
  { id: "waterReservoirs", render: () => <ReservoirStatusLegend /> },
  { id: "waterCanals", render: ({ isDark }) => <WaterCanalLegend isDark={isDark} /> },
  { id: "lakesPondsOsm", render: () => <LakesPondsLegend /> },
  // 💧 水資源：paint 皆在 overlayRegistry.ts，色票逐條對齊該處的 match 表達式
  { id: "waterProtectionZones", render: ({ isDark }) => <WaterProtectionZoneLegend isDark={isDark} /> },
  { id: "waterMonitorStations", render: () => <WaterMonitorStationLegend /> },
  { id: "waterFacilities", render: () => <WaterFacilityLegend /> },
  { id: "rainGauge", render: () => <RainGaugeLegend /> },
  { id: "riverLevel", render: () => <RiverLevelLegend /> },
  { id: "marineObservationCwa", render: () => <MarineObservationLegend network="cwa" /> },
  { id: "marineObservationIsohe", render: () => <MarineObservationLegend network="isohe" /> },
  { id: "groundwater", render: () => <GroundwaterLegend /> },
  { id: "taipeiSewer", render: () => <TaipeiSewerLegend /> },
  { id: "taipeiPumb", render: () => <TaipeiPumbLegend /> },
  { id: "taipeiEvacuate", render: () => <TaipeiEvacuateLegend /> },
  { id: "waterFloodExtreme", render: ({ overlayParams }) => <WaterFloodExtremeLegend minDepth={overlayParams.floodMinDepth ?? 0} /> },
  { id: "medIsochrone", render: () => <MedicalIsochroneLegend /> },
  { id: "medHospital", render: ({ visibility, isDark }) => <MedicalLegend visibility={visibility} isDark={isDark} /> },
  { id: "erHospital", render: () => <ErCongestionLegend /> },
  { id: "parkingOnstreet", render: ({ visibility }) => <ParkingLegend visibility={visibility} /> },
  { id: "floodSensor", render: () => <FloodSensorLegend /> },
  // R6 段 2：五類廢棄物處理設施平面圓點（LG-1 類別色）
  { id: "wfIncinerator", render: ({ visibility }) => <WasteFacilityLegend visibility={visibility} /> },
  { id: "powerPlants", render: ({ visibility }) => <EnergyFuelLegend visibility={visibility} /> },
  { id: "powerRegionDemand", render: () => <EnergyReserveLegend /> },
  { id: "osmPowerLines", render: ({ visibility }) => <PowerGridLegend visibility={visibility} /> },
  { id: "powerPoles", render: () => <PowerPolesLegend /> },
  { id: "aviationControl", render: ({ visibility }) => <AviationAirspaceLegend visibility={visibility} /> },
  { id: "droneNoFlyZone", render: ({ visibility }) => <DroneZonesLegend visibility={visibility} /> },
  { id: "osmSubstationsEhv", render: () => <SubstationEhvLegend /> },
  { id: "osmSubstations",    render: () => <SubstationLocalLegend /> },
  { id: "facPrimary",
    render: ({ visibility }) => <FacilityFuelLegend visibility={visibility} /> },
  { id: "facOffshore", render: () => <FacOffshoreLegend /> },
  { id: "osmWindTurbines", render: ({ visibility }) => <RenewablePoiLegend visibility={visibility} /> },
  { id: "offshoreWindZones", render: ({ visibility }) => <EnergySpecialtyLegend visibility={visibility} /> },
  // 化石燃料 14 layer（Phase B）— 共用 FossilFuelLegend，按 visibility 過濾顯示行
  {
    id: "gasStationCpc",
    render: ({ visibility }) => <FossilFuelLegend visibility={visibility} />,
  },
  // 雲林 POC 覆蓋分析 5 layer 共用 CoverageLegend，按 visibility 過濾顯示行
  {
    id: "gasCoverageAll",
    render: ({ visibility }) => <CoverageLegend visibility={visibility} />,
  },
  { id: "lightning", render: () => <LightningLegend /> },
  { id: "lightningCwa", render: () => <LightningCwaLegend /> },
  { id: "nuclearRadiation", render: () => <NuclearLegend /> },
  // Base map：OSM 道路 highway 分級分色（其他 base layer 單色，依鐵則 2 不需圖例）
  { id: "osmRoadDrive", render: () => <OsmRoadDriveLegend /> },
  { id: "maritimeBoundary", render: () => <MaritimeBoundaryLegend /> },
  { id: "slopeVector", render: () => <SlopeVectorLegend /> },
  { id: "aspectVector", render: () => <AspectVectorLegend /> },
  { id: "isobath", render: ({ overlayParams }) => <IsobathLegend modeIdx={overlayParams.isobathModeIdx ?? 0} /> },
  // 警察覆蓋分析 isochrone（共用 overlap_count 色階）
  {
    id: "policeIsoSubstation",
    render: ({ visibility }) => <PoliceIsochroneLegend visibility={visibility} />,
  },
  // 警政司法民防 17 layer — 共用 PoliceJusticeLegend，按 visibility 過濾顯示行
  {
    id: "policeStation",
    render: ({ visibility }) => <PoliceJusticeLegend visibility={visibility} />,
  },
  // 環境污染 3 層
  { id: "pollution", render: ({ visibility }) => <PollutionSeverityLegend visibility={visibility} /> },
  {
    id: "pollutionPenaltyCritical",
    render: ({ visibility }) => <PollutionPenaltyLegend visibility={visibility} />,
  },
  // 噪音／聲響六層各自保留觀測、法定分類、裁處、設備清單的獨立語意。
  { id: "officialNoiseMonitoring", render: () => <OfficialNoiseMonitoringLegend /> },
  { id: "noiseCaptureGrid", render: () => <NoiseCaptureGridLegend /> },
  { id: "noiseControlZones", render: () => <NoiseControlZonesLegend /> },
  { id: "aviationNoiseZones", render: () => <AviationNoiseZonesLegend /> },
  { id: "noiseEnforcementEvents", render: () => <NoiseEnforcementEventsLegend /> },
  { id: "soundCameraLocations", render: () => <SoundCameraLocationsLegend /> },
  { id: "riverRpiStations", render: () => <RiverRpiStationsLegend /> },
  { id: "waterQualityStations", render: () => <WaterQualityStationsLegend /> },
  { id: "sewageTreatmentPlants", render: () => <SewageTreatmentPlantsLegend /> },
  { id: "drinkingWaterProtectionZones", render: () => <DrinkingWaterProtectionZonesLegend /> },
  { id: "seaWaterQualityStations", render: () => <SeaWaterQualityStationsLegend /> },
  { id: "riverRpiSegments", render: () => <RiverRpiSegmentsLegend /> },
  { id: "pm25ManualStations", render: () => <Pm25ManualStationsLegend /> },
  { id: "dioxinStations", render: () => <DioxinStationsLegend /> },
  { id: "incineratorEmissions", render: () => <IncineratorEmissionsLegend /> },
  { id: "nuscGammaRadiation", render: () => <NuscGammaRadiationLegend /> },
  { id: "waterEffluentLive", render: () => <WaterEffluentLiveLegend /> },
  { id: "cemsStackLive", render: () => <CemsStackLiveLegend /> },
  { id: "cwaUvDaily", render: () => <CwaUvDailyLegend /> },
  // 🎓 教育 17 layer — 共用 EducationLegend，按 visibility 過濾顯示段落
  {
    id: "schools",
    render: ({ visibility, overlayParams, isDark }) => <EducationLegend schoolLevelColor={overlayParams.schoolLevelColor ?? 0} visibility={visibility}  isDark={isDark} />,
  },
];

export const LegendPanel = memo(function LegendPanel({
  visibility: visibilityProp, overlayParams: overlayParamsProp, isDarkTheme = true, railSystems, compact = false,
}: LegendPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const i18n = useLocale();

  // AR-21：主站走 store 訂閱、embed 走 prop。hook 無條件呼叫（embed 情境下
  // 這份訂閱是惰性的 —— embed 從不寫 store，永遠拿到預設全關的快照）。
  const storeVisibility = useLayerVisibilityAll();
  const visibility = visibilityProp ?? storeVisibility;

  // AR-22 P4：同上模式，參數改自己訂閱。圖例是**真的需要整包**的聚合消費端
  // （每個 sub-legend 讀自己那一格 out key），故用 useOverlayParams 而非 per-key。
  const storeOverlayParams = useOverlayParams();
  const overlayParams = overlayParamsProp ?? storeOverlayParams;

  // 面板外殼 chrome（僅容器與標題文字，色票資料兩主題共用）
  const c = isDarkTheme
    ? { panelBg: SURFACE.strong, panelBorder: BORDER.panel, headerText: COLORS.textMuted, shadow: ELEVATION.lg }
    : { panelBg: LIGHT.surfaceStrong, panelBorder: LIGHT.border, headerText: LIGHT.textMuted, shadow: LIGHT.elevationLg };

  // 子圖例文字主題色（透過 context 分發，色票資料兩主題共用）
  const legendPalette = isDarkTheme ? DARK_LEGEND : LIGHT_LEGEND;

  // G1：Agent 分析結果圖例排最上面一組（不進 LEGEND_REGISTRY；結果是暫時的、沒有 layer key）。
  // G2：停靠 popup 開著時 compact，只留標題＋色階條。/embed 永遠沒有分析結果。
  const analysisLegend = useAnalysisLegend();
  const hasAnalysisLegend = analysisLegend.entries.length > 0;
  // 分析結果剛出現時自動展開一次，否則圖例從 Agent 面板搬過來後會被預設收合藏住。
  useEffect(() => { if (hasAnalysisLegend) setExpanded(true); }, [hasAnalysisLegend]);

  const active = LEGEND_REGISTRY.filter((e) => legendKeys(e.id).some((k) => visibility[k]));
  if (active.length === 0 && !hasAnalysisLegend) return null;

  return (
    <LegendThemeCtx.Provider value={legendPalette}>
    <LegendCompactCtx.Provider value={compact}>
    <div
      style={{
        width: 200,
        background: c.panelBg,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${c.panelBorder}`,
        borderRadius: RADIUS.xl,
        boxShadow: c.shadow,
        fontFamily: FONT_CJK,
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded((p) => !p)}
        aria-label={i18n.t(expanded ? "legend.panel.collapse" : "legend.panel.expand")}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: c.headerText,
          fontSize: FONT_SIZE.sm,
          fontFamily: FONT_CJK,
        }}
      >
        {expanded
          ? <ChevronDown size={12} style={{ flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
        <span>{i18n.t("legend.panel.title")}</span>
      </button>

      {/* Content — registry 驅動，順序即 LEGEND_REGISTRY 順序 */}
      {expanded && (
        <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          <AnalysisLegendSection entries={analysisLegend.entries} compact={analysisLegend.compact} isDark={isDarkTheme} />
          {active.map((entry) => (
            <Fragment key={entry.id}>
              {entry.render({ visibility, overlayParams, isDark: isDarkTheme, railSystems, i18n })}
            </Fragment>
          ))}
        </div>
      )}
    </div>
    </LegendCompactCtx.Provider>
    </LegendThemeCtx.Provider>
  );
});
