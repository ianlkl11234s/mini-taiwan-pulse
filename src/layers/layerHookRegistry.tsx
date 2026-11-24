import { countrySlot, slottedList } from "../countries/slots";
import { CoralReefDistributionHost } from "./hosts/coralReefHost";
import { HistoricalFlightTrailsHost } from "./hosts/historicalFlightHosts";
import { AllenCoralAtlasHost } from "./hosts/allenCoralHost";
// ══════════════════════════════════════════════════════════════════
//  Layer Hook Registry — 「哪些 hook 把圖層掛起來」的單一真實來源（AR-22 P1）
// ══════════════════════════════════════════════════════════════════
//
// P1 之前這份清單是 App.tsx 裡 66 行手寫 `use*Layer(...)`。它是**隱性**的：
// 漏 call 一個沒有任何機械訊號（tsc 綠、測試綠、畫面只是少一層，
// 而且多半要等使用者回報「這層點不出來」才發現）。
//
// 搬成資料之後，`__tests__/layerHookRegistry.test.ts` 就守得住：
// 本表的 keys ∪ `HOOKS_IN_APP_LEDGER` ∪ `NO_HOOK_LEDGER` **雙向等於** `MANIFEST_KEYS`。
// 新層進 manifest 卻沒接掛載機制 → 紅；接好了還留在 ledger → 紅（ratchet 只進不退）。
//
// ⚠️ **順序 = 凍結的 App.tsx 呼叫順序，嚴禁重排。**
// mount / effect 觸發順序是潛在的行為向量（同一張地圖上誰先 addLayer 決定疊放次序，
// 誰先 addSource 決定另一支 hook 拿不拿得到 source）。本棒是等價重構，
// 順序一動就不再是「等價」了。每個 entry 的註解記著它在 App.tsx 的原始行號。
//
// ⚠️ **`keys` 是「這支 hook 服務哪些 manifest key」**，不是「它讀了哪些參數」。
// 判準：該 hook 負責這個 key 的 source / layer 建立與 visibility 切換。
// 一支 hook 服務多個 key（`useEnergyPoiLayer` 20 個）、多支 hook 服務同一個 key
// （`newsEvents` 由 `useNewsEventsLayer` 供資料、`useNewsTimeline` 做時間過濾）
// 都是正常的 —— 完整性測試比的是**聯集**。
//
// ⚠️ 純基礎設施的 hook（icon 註冊、跨圖層光暈）沒有自己的 key，寫 `keys: []`
// 並在註解說明理由 —— 不要為了「湊一個 key」硬掛給某個圖層。

import type { ManifestKey } from "../data/layerManifest";
import type { LayerHostComponent } from "./layerHostDeps";

import {
  RealEstateTimelineHost, RealEstatePointsHost, PropertyValueAdminHost, SelectedFeatureHaloHost, LandOfficeHighlightHost,
} from "./hosts/realEstateHosts";
import {
  ReservoirStatusHost, RainGaugeHost, BridgeRainHost, FloodSensorHost, FloodSensorIsochroneHost,
  TaipeiSewerHost, TaipeiEvacuateHost, TaipeiPumbHost, PrecipRasterHost,
  RiverLevelHost, MarineObservationHost, GroundwaterWellsHost, GroundwaterHost,
  TwMarineHeatwavesHost, TwCoralBleachingHeatStressHost,
  IotWraRiverHost, IotWraStructureHost,
} from "./hosts/waterHosts";
import { NewsEventsHost, NewsTimelineHost } from "./hosts/newsHosts";
import { CouncilDistrictsHost, ElectionEventsHost, PollingStationsHost } from "./hosts/politicsHosts";
import { Fire119LiveHost, PbsRoadEventsLiveHost } from "./hosts/liveIncidentsHosts";
import { DengueClustersHost, NavNoticesHost, TideSwellAlertsHost } from "./hosts/twLiveHosts";
import {
  EnergyPoiHost, FossilFuelHost, LivestockHost, A1AccidentRealtimeHost,
  SubstationDiamondIconHost, OsmPowerLinesGlowHost, PowerPolesHost,
  AviationAirspaceHost, DroneZonesHost, PollutionHost, PowerRegionBarsHost,
  PowerGenerationBeamHost, PowerPlantGlowHost, BuildingsNightBloomHost,
  SubstationEhvGlowHost, PowerLinesGlowTestHost, AviationRestrictedGlowHost,
} from "./hosts/energyHosts";
import {
  LightningHost, LightningCwaHost, NuclearHost, ErHospitalHost,
  LibrarySeatsHost, ParkingHost, EarthquakeHost, EarthquakeReplayHost, SoilLiquefactionHost,
} from "./hosts/hazardHosts";
import { BridgeResilienceHost, BssBridgeHost } from "./hosts/bridgeHosts";
import { BusCrowdingSimHost } from "./hosts/busCrowdingSimHost";
import { TransitReachGridHost, TransitReachPlaybackHost } from "./hosts/transitReachHosts";
import { HistoricalMapSinicaHost } from "./hosts/historicalMapHosts";
import { CountyMigrationFlowsHost } from "./hosts/countyMigrationHosts";
import { MapchallengeDay08PlanHost, MapchallengeDay17DarkSkyHost, MapchallengeDay17NightFallHost, MapchallengeDay19PotentialHost } from "./hosts/mapchallengeHosts";
import { FreewayTdcsSimHost } from "./hosts/freewayTdcsSimHost";
import { TransitAccessGridHost, TransitAccessPlaybackHost } from "./hosts/transitAccessHosts";
import {
  NuscGammaRadiationHost, WaterEffluentLiveHost, CemsStackLiveHost, CwaUvDailyHost,
} from "./hosts/environmentHosts";
import {
  JmaAmedasHost, JmaQuakesHost, JmaSnowDepthHost, JmaVolcanoesHost, JmaWarningsHost,
  JmaRadarHost, JmaRasrfHost, JmaRiskLandHost, JmaRiskInundHost, JmaUvIndexHost, JmaSstHost, JmaSeaIceHost, JmaHimawariHost,
  JmaAnaSnowFirstHost, JmaAnaSnowDaysHost, JmaAnaRainDaysHost, JmaAnaRiskLandHoursHost, JmaAnaRiskInundHoursHost,
  GibsSnowCoverHost, JmaRiskFloodHost,
} from "./hosts/jmaHosts";
import {
  JmaLightningHost, JmaWbgtHost, JmaSnowcapHost, JmaAutumnLeavesHost, JmaSakuraHost, JmaRainySeasonHost,
} from "./hosts/jmaPointHosts";
import {
  EarthquakesGlobalHost, TyphoonTracksHost, TyphoonAgencyForecastsHost, WorldTrashDebrisHost, JpReligionHost,
  GlobalEventsHost,
  WindFieldHost, OceanCurrentsHost, DustForecastHost,
  DisasterAlertHost, PlaActivityHost, VesselWatchHost,
} from "./hosts/climateHosts";
import { GlobalMaritimeHost, GfwDarkVesselsHost, GfwFishingEffortHost, GfwHourlyGridHost, GfwHourlyTracksHost } from "./hosts/globalMaritimeHosts";
import {
  SatellitesHost, RoadEventsHost, FireEventsHost, FireLatestHost,
  WasteCleaningSquadHost, FreewayHost, RoadCongestionHost,
  FuneralDensityHost, TemperatureGridHost,
} from "./hosts/miscHosts";
import {
  HillshadeHost, GibsNightLightsHost, SlopeVectorHost, AspectVectorHost, CwaImageryHost,
  AqiImageryHost, AqiStationsHost, MicroSensorsHost,
} from "./hosts/imageryHosts";
import {
  RailTracksHost, H3PopulationHost, PopCountHost, IndicatorsHost,
  SocioeconomicHost, SpatialEconomyHost, YoubikeHost,
} from "./hosts/gridHosts";
import { AnimalAdoptionHost, AnimalShelterPressureHost, AnimalWelfarePointsHost } from "./hosts/animalWelfareHosts";
import {
  JpMedicalHost, JpAdminHost, JpStationsHost, JpAirportsHost, JpRailwaysHost, JpSchoolsHost, JpPoliceFacilitiesHost,
  JpEvacuationSitesHost, JpPublicOfficesHost, JpBusStopsHost, JpLandslideWarningAreasHost, JpInlandFloodAreasHost, JpZoningUseDistrictsHost, JpNationalForestsHost,
  JpWelfareFacilitiesHost, JpMajorRoadsHost, JpMunicipalRoadsHost, JpExpresswaysHost, JpGsiTerrainHost,
  JpPopulationMeshHost,
  JpTourismHost, JpWaterHost,
} from "./hosts/japanHosts";
import { IdAdminHost, IdPopulationHost, IdRuralDevelopmentHost, IdStationsHost, IdRailLinesHost, IdTransportHubsHost, IdPowerPlantsHost, IdPowerGridHost, IdRenewablesHost, IdFuelStationsHost, IdPlaceNamesHost, IdOuterIslandsHost, IdFaultsHost, IdMountainRescueHost, IdDibiHydrometHost, IdBridgesHost, IdWaterFacilitiesHost, IdWatershedsHost, IdSubsidenceHost, IdNatureSpotsHost, IdConservationForestHost, IdCampsHost, IdTerrainHillshadeHost, IdTerrainReliefHost, IdInariskLandslideHost, IdInariskFloodHost, IdInariskMultiHost, IdSchoolsHost, IdHealthFacilitiesHost, IdFireStationsHost, IdPoliceStationsHost, IdPrisonsCourtsHost, IdImmigrationOfficesHost, IdTransjakartaHost, IdSpecialEconomicZonesHost, IdIknHost, IdPostOfficesHost, IdMarketsHost, IdBanksHost, IdCulturalFacilitiesHost, IdHeritageSitesHost, IdCommTowersHost, IdPlacesOfWorshipHost, IdExperiencesHost, IdAccommodationHost, IdWeatherStationsHost, IdFactoriesHost, IdSportsVenuesHost, IdParksHost, IdCemeteriesHost, IdAquacultureHost, IdFarmlandHost, IdVeterinaryHost } from "./hosts/indonesiaHosts";
import { VnAdminHost, VnPopulationHost, VnStationsHost, VnTransportHubsHost, VnMajorRoadsHost, VnPowerPlantsHost, VnRenewablesHost, VnPowerGridHost, VnFuelStationsHost, VnOilGasHost, VnEnvisoftStationsHost, VnAngiangDemoHost,
  VnTourAttractionsHost, VnTourNatureHost, VnTourServicesHost, VnNationalTouristAreasHost, VnPlaceNamesHost, VnBicycleRentalHost, VnBridgesHost, VnParkingHost, VnGlideEventsHost, VnDamsHost, VnRiversHost, VnWaterSupplyHost, VnWaterStructuresHost, VnRiverbankErosionHost, VnSchoolsHost, VnSchoolCampusesHost, VnKindergartensHost, VnHealthFacilitiesHost, VnPoliceHost, VnCourtsPrisonsHost, VnPostalServicesHost, VnPublicAmenitiesHost, VnFinancialServicesHost, VnPlacesOfWorshipHost, VnParksHost, VnProtectedAreasOdmHost, VnAngiangAquacultureHost, VnFieldBoundariesHost, VnSoilHost, VnFarmTracksHost, VnCoalMinesHost, VnTerrainHillshadeHost, VnTerrainReliefHost, VnLandslideSusceptibilityHost, VnWdpcaHost } from "./hosts/vietnamHosts";
import { PhAdminHost, PhPopulationHost, PhOpenaqAirHost, PhTransportHubsHost, PhStationsHost, PhMajorRoadsHost, PhPowerPlantsHost, PhPowerGridHost, PhRenewablesHost, PhFuelStationsHost, PhPipelinesHost, PhBusStopsHost, PhUrbanRailHost, PhExpresswaysHost,
  PhTouristAttractionsHost, PhCoastIslandsHost, PhNatureSpotsHost, PhTourismServicesHost, PhTourismDevelopmentAreasHost, PhPlaceNamesHost, PhPovertyHost, PhEarthquakesHost, PhNoahFlood100yrHost, PhNoahLandslideHost, PhWaterPermitsHost, PhLakesHost, PhDamsHost, PhBridgesHost, PhParkingHost, PhKmPostsHost, PhEcozonesHost, PhReclamationHost, PhSchoolsHost, PhSchoolCampusesHost, PhHealthFacilitiesHost, PhFireStationsHost, PhNcrSafeOpenSpacesHost, PhPoliceStationsHost, PhJailsHost, PhTreesHost, PhTrailsHost, PhKbaHost, PhWetlandsHost, PhForestryProgramsHost, PhCoastalResourcesHost, PhMarineStationsHost, PhWdpcaHost, PhWasteFacilitiesHost, PhPollutionSourcesHost, PhArtsVenuesHost, PhPostOfficesHost, PhPublicFacilitiesHost, PhFinancialServicesHost, PhPlacesOfWorshipHost, PhSportsVenuesHost, PhParksHost, PhCemeteriesHost, PhFishPortsHost, PhAquacultureHost, PhTerrainHillshadeHost, PhTerrainReliefHost, PhBuiltSurfaceHost, PhForestLossHost } from "./hosts/philippinesHosts";

export interface LayerHookEntry {
  /** hook 名（同名多次呼叫加 `:後綴` 區分）—— 也是 `window.__layerRenderCounts` 的 key */
  id: string;
  /** 這支 hook 服務的 manifest key */
  keys: readonly ManifestKey[];
  Host: LayerHostComponent;
}

/** ⚠️ 有序陣列。順序 = 凍結的 App.tsx 呼叫順序（見檔頭），嚴禁重排。 */
export const LAYER_HOOK_REGISTRY: readonly LayerHookEntry[] = slottedList<LayerHookEntry>("layerHosts", [
  { id: "useHistoricalFlightTrailsLayer", keys: ["historicalFlightTrails", "jpHistoricalFlightTrails"], Host: HistoricalFlightTrailsHost },
  { id: "useJpWaterLayers", keys: ["jpWaterDams", "jpWaterLakes", "jpWaterRivers", "jpWaterSupplyFacilities", "jpWaterSupplyAreas", "jpWaterSewerFacilities", "jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds", "jpWaterFloodHazard", "jpWaterLocalFacilities", "jpWaterQualityStations", "jpWaterLevelStations"], Host: JpWaterHost },
  { id: "useJpMedicalLayers", keys: [
    "jpMedicalHospitals", "jpMedicalClinics", "jpMedicalDental", "jpMedicalMaternity", "jpMedicalPharmacies",
    "jpCarePlanning", "jpCareHomeVisit", "jpCareDayServices", "jpCareResidential", "jpCareCombined", "jpCareEquipment",
    "jpMedicalAreasPrimary", "jpMedicalAreasSecondary", "jpMedicalAreasTertiary",
  ], Host: JpMedicalHost },
  { id: "useCoralReefDistributionLayer", keys: ["coralReefDistribution"], Host: CoralReefDistributionHost },
  { id: "useAllenCoralAtlasLayer", keys: ["allenCoralAtlas"], Host: AllenCoralAtlasHost },
  // ── 房地產（App.tsx 原 L719 / L732）──
  {
    id: "useRealEstateTimeline",
    keys: [
      "realEstateRentalGrid", "realEstateRentalPoint",
      "realEstateSaleGrid", "realEstateSalePoint",
      "realEstatePresaleGrid", "realEstatePresalePoint",
    ],
    Host: RealEstateTimelineHost,
  },
  {
    id: "useRealEstatePointsLayer",
    keys: ["realEstateRentalPoint", "realEstateSalePoint", "realEstatePresalePoint"],
    Host: RealEstatePointsHost,
  },
  { id: "usePropertyValueAdminLayer", keys: ["propertyValueAdmin"], Host: PropertyValueAdminHost },

  // ── 互動裝飾（L781）：跨圖層的點選選取圈，不屬於任何單一 layer ──
  { id: "useSelectedFeatureHalo", keys: [], Host: SelectedFeatureHaloHost },
  // 台灣圖層延伸 B3：點地政事務所點 → 高亮轄區面（跨 govServiceOffices 與 landOfficeJurisdiction）
  { id: "useLandOfficeHighlight", keys: [], Host: LandOfficeHighlightHost },

  // ── 水資源 / 水利（L784-897）──
  { id: "useReservoirStatusLayer", keys: ["waterReservoirs"], Host: ReservoirStatusHost },
  { id: "useRainGaugeLayer", keys: ["rainGauge"], Host: RainGaugeHost },
  { id: "useBridgeRainLayer", keys: ["bridgeRainThresholds"], Host: BridgeRainHost },
  { id: "useFloodSensorLayer", keys: ["floodSensor"], Host: FloodSensorHost },
  { id: "useFloodSensorIsochroneLayer", keys: ["floodSensorIsochrone"], Host: FloodSensorIsochroneHost },
  { id: "useTaipeiSewerLayer", keys: ["taipeiSewer"], Host: TaipeiSewerHost },
  { id: "useTaipeiEvacuateLayer", keys: ["taipeiEvacuate"], Host: TaipeiEvacuateHost },
  { id: "useTaipeiPumbLayer", keys: ["taipeiPumb"], Host: TaipeiPumbHost },
  { id: "usePrecipRasterLayer", keys: ["precipRaster"], Host: PrecipRasterHost },
  { id: "useRiverLevelLayer", keys: ["riverLevel"], Host: RiverLevelHost },
  {
    id: "useMarineObservationLayers",
    keys: ["marineObservationCwa", "marineObservationIsohe"],
    Host: MarineObservationHost,
  },
  { id: "useTwMarineHeatLayer:twMarineHeatwaves", keys: ["twMarineHeatwaves"], Host: TwMarineHeatwavesHost },
  { id: "useTwMarineHeatLayer:twCoralBleachingHeatStress", keys: ["twCoralBleachingHeatStress"], Host: TwCoralBleachingHeatStressHost },
  { id: "useGroundwaterWellsLayer", keys: ["groundwaterWells"], Host: GroundwaterWellsHost },
  { id: "useGroundwaterLayer", keys: ["groundwater"], Host: GroundwaterHost },
  { id: "useIotWraRiverLayer", keys: ["iotWraRiver"], Host: IotWraRiverHost },
  { id: "useIotWraStructureLayer", keys: ["iotWraStructure"], Host: IotWraStructureHost },

  // ── 新聞事件資料層（L908；時間過濾在下方 useNewsTimeline，原 L1062）──
  { id: "useNewsEventsLayer", keys: ["newsEvents"], Host: NewsEventsHost },

  // ── 能源 / 電力 / 航空管制 / 環境污染（L916-1033）──
  {
    id: "useEnergyPoiLayer",
    keys: [
      "powerPlants", "osmSubstations", "osmSubstationsEhv", "osmPowerLines",
      "osmPowerTowers", "osmWindTurbines", "osmSolarFarms", "osmPowerPlantsStatic",
      "offshoreWindZones", "islandPowerGrid", "fossilFuelInfra", "geothermalWells",
      "renewablePermitsTaipei", "evChargingStations",
      // Phase 8 SSOT 6-layer
      "facPrimary", "facOffshore", "facPlanned", "facHistorical",
      "facSecondary", "facOsmSupplement",
    ],
    Host: EnergyPoiHost,
  },
  {
    // 加油站 5 層（公開）+ 石化 9 層（owner-gated）—— key 清單即 loader 的
    // GAS_STATION_FE_KEYS / FOSSIL_LOCKED_FE_KEYS
    id: "useFossilFuelLayers",
    keys: [
      "gasStationCpc", "gasStationFpcc", "gasStationTaisugar",
      "gasStationOther", "gasStationCanonical",
      "lpgSubpackaging", "lpgRetailers", "lngTerminal", "pipelineGas", "pipelineOilGas",
      "industrialRefinery", "industrialStorageTank", "industrialPowerPlant", "coalTerminal",
    ],
    Host: FossilFuelHost,
  },
  {
    id: "useLivestockLayers",
    keys: [
      "livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle",
      "livestockFarmDuck", "livestockFarmGoose", "livestockFarmSheep",
      "livestockFarmOther", "livestockSlaughter",
    ],
    Host: LivestockHost,
  },
  { id: "useA1AccidentRealtimeLayer", keys: ["a1AccidentRealtime"], Host: A1AccidentRealtimeHost },
  {
    // 菱形 SDF icon 註冊：osmSubstations 的 symbol layer 前置作業，
    // 但不吃 visibility（missing-image 事件驅動、冪等）→ 不宣稱服務任何 key
    id: "useSubstationDiamondIcon",
    keys: [],
    Host: SubstationDiamondIconHost,
  },
  { id: "useOsmPowerLinesGlowLayer", keys: ["osmPowerLines"], Host: OsmPowerLinesGlowHost },
  { id: "usePowerPolesLayer", keys: ["powerPoles"], Host: PowerPolesHost },
  {
    id: "useAviationAirspaceLayer",
    keys: ["aviationControl", "aviationRestricted"],
    Host: AviationAirspaceHost,
  },
  {
    id: "useDroneZonesLayer",
    keys: ["droneNoFlyZone", "droneRestrictedZone"],
    Host: DroneZonesHost,
  },
  {
    id: "usePollutionLayers",
    keys: [
      "pollutionFacility", "pollutionPenaltyCritical", "pollutionPenaltyGeneral",
      "pollutionPenaltyMobile", "pollutionSite",
    ],
    Host: PollutionHost,
  },
  { id: "usePowerRegionBarsLayer", keys: ["powerRegionDemand"], Host: PowerRegionBarsHost },
  { id: "usePowerGenerationBeamLayer", keys: ["powerGenerationUnit"], Host: PowerGenerationBeamHost },
  { id: "usePowerPlantGlowLayer", keys: ["powerPlantGlow"], Host: PowerPlantGlowHost },
  { id: "useBuildingsNightBloomLayer", keys: ["buildingsGba"], Host: BuildingsNightBloomHost },
  { id: "useSubstationEhvGlowLayer", keys: ["substationEhvGlow"], Host: SubstationEhvGlowHost },
  { id: "usePowerLinesGlowTestLayer", keys: ["powerLinesGlow"], Host: PowerLinesGlowTestHost },
  { id: "useAviationRestrictedGlowLayer", keys: ["aviationRestrictedGlow"], Host: AviationRestrictedGlowHost },

  // ── HAZARD（L1040-1059）──
  { id: "useLightningLayer:tpc", keys: ["lightning"], Host: LightningHost },
  { id: "useLightningLayer:cwa", keys: ["lightningCwa"], Host: LightningCwaHost },
  { id: "useNuclearLayer", keys: ["nuclearRadiation"], Host: NuclearHost },
  { id: "useErHospitalLayer", keys: ["erHospital"], Host: ErHospitalHost },
  // 環境即時 4 層（migration 419–422）：當下快照，共用 useEnvironmentLiveLayer
  { id: "useEnvironmentLiveLayer:nuscGammaRadiation", keys: ["nuscGammaRadiation"], Host: NuscGammaRadiationHost },
  { id: "useEnvironmentLiveLayer:waterEffluentLive", keys: ["waterEffluentLive"], Host: WaterEffluentLiveHost },
  { id: "useEnvironmentLiveLayer:cemsStackLive", keys: ["cemsStackLive"], Host: CemsStackLiveHost },
  { id: "useEnvironmentLiveLayer:cwaUvDaily", keys: ["cwaUvDaily"], Host: CwaUvDailyHost },
  { id: "useLibrarySeatsLayer", keys: ["librarySeats"], Host: LibrarySeatsHost },
  { id: "useParkingLayer", keys: ["parkingOnstreet", "parkingOffstreet"], Host: ParkingHost },

  // ── 新聞時間過濾 + 地震（L1062-1082）──
  { id: "useNewsTimeline", keys: ["newsEvents"], Host: NewsTimelineHost },
  { id: "useEarthquakeLayer", keys: ["earthquakes"], Host: EarthquakeHost },
  { id: "useEarthquakeReplayLayer", keys: ["earthquakeReplay"], Host: EarthquakeReplayHost },
  { id: "useSoilLiquefactionLayers", keys: ["soilLiquefactionPotential", "weakSoilClay0To5", "weakSoilSand0To5", "weakSoilClay5To10", "weakSoilSand5To10", "weakSoilClay10To20", "weakSoilSand10To20", "liquefactionMonitoringSites"], Host: SoilLiquefactionHost },
  { id: "useBssBridgeLayers", keys: ["bssNationalBridgePreview", "bssNationalBridgePointsPreview"], Host: BssBridgeHost },
  { id: "useBridgeResilienceLayers", keys: ["bridgeResilienceTwinCity"], Host: BridgeResilienceHost },
  { id: "useBusCrowdingSimLayer", keys: ["busCrowdingSim"], Host: BusCrowdingSimHost },
  { id: "useTransitReachGridLayer", keys: ["transitReachGrid"], Host: TransitReachGridHost },
  { id: "useTransitReachPlaybackLayer", keys: ["transitReachPlayback"], Host: TransitReachPlaybackHost },
  { id: "useFreewayTdcsSimLayer", keys: ["freewayTdcsSim"], Host: FreewayTdcsSimHost },
  { id: "useTransitAccessGridLayer", keys: ["transitAccessGrid"], Host: TransitAccessGridHost },
  { id: "useTransitAccessPlaybackLayer", keys: ["transitAccessPlayback"], Host: TransitAccessPlaybackHost },

  // ── 全球氣候 / 世界（L1088-1154）──
  { id: "useEarthquakesGlobalLayer", keys: ["earthquakesGlobal"], Host: EarthquakesGlobalHost },
  { id: "useTyphoonTracksLayer", keys: ["typhoonTracks"], Host: TyphoonTracksHost },
  { id: "useTyphoonAgencyForecastsLayer", keys: ["typhoonAgencyForecasts"], Host: TyphoonAgencyForecastsHost },
  { id: "useWorldTrashDebrisLayer", keys: ["worldTrashDebris"], Host: WorldTrashDebrisHost },
  { id: "useGlobalEventsLayer", keys: ["globalEvents"], Host: GlobalEventsHost },
  {
    id: "useJpReligionLayers",
    keys: ["jpReligionGsi", "jpReligionOsm", "jpReligionWikidata"],
    Host: JpReligionHost,
  },
  {
    id: "useJpAdminLayers",
    keys: ["jpAdminPrefecture", "jpAdminBoundaries"],
    Host: JpAdminHost,
  },
  { id: "useJpStationsLayer", keys: ["jpStations"], Host: JpStationsHost },
  { id: "useJpAirportsLayer", keys: ["jpAirports"], Host: JpAirportsHost },
  { id: "useJpRailwaysLayer", keys: ["jpRailways"], Host: JpRailwaysHost },
  { id: "useJpPoliceFacilitiesLayer", keys: ["jpPoliceFacilities"], Host: JpPoliceFacilitiesHost },
  { id: "useJpSchoolsLayer", keys: ["jpSchools"], Host: JpSchoolsHost },
  { id: "useJpEvacuationSitesLayer", keys: ["jpEvacuationSites"], Host: JpEvacuationSitesHost },
  { id: "useJpPublicOfficesLayer", keys: ["jpPublicOffices"], Host: JpPublicOfficesHost },
  { id: "useJpBusStopsLayer", keys: ["jpBusStops"], Host: JpBusStopsHost },
  { id: "useJpLandslideWarningAreasLayer", keys: ["jpLandslideWarningAreas"], Host: JpLandslideWarningAreasHost },
  { id: "useJpInlandFloodAreasLayer", keys: ["jpInlandFloodAreas"], Host: JpInlandFloodAreasHost },
  { id: "useJpZoningUseDistrictsLayer", keys: ["jpZoningUseDistricts"], Host: JpZoningUseDistrictsHost },
  { id: "useJpNationalForestsLayer", keys: ["jpNationalForests"], Host: JpNationalForestsHost },
  { id: "useJpWelfareFacilitiesLayer", keys: ["jpWelfareDisability", "jpWelfareChild"], Host: JpWelfareFacilitiesHost },
  { id: "useJpMajorRoadsLayer", keys: ["jpMajorRoads"], Host: JpMajorRoadsHost },
  { id: "useJpMunicipalRoadsLayer", keys: ["jpMunicipalRoads"], Host: JpMunicipalRoadsHost },
  { id: "useJpExpresswaysLayer", keys: ["jpExpressways"], Host: JpExpresswaysHost },
  { id: "useHistoricalMapSinicaLayer", keys: ["historicalMapSinica", "historicalMapPostwar", "historicalImagery", "historicalBoundaries", "historicalLandUse", "historicalThematic"], Host: HistoricalMapSinicaHost },
  { id: "useJpGsiTerrainLayers", keys: ["jpGsiHillshade", "jpGsiRelief"], Host: JpGsiTerrainHost },
  { id: "useJpPopulationMeshLayer", keys: ["jpPopulationMesh1km"], Host: JpPopulationMeshHost },
  countrySlot("GB", 1), // 英國國家包（src/countries/gb/）
  countrySlot("KR", 1), // 南韓國家包（src/countries/kr/）
  countrySlot("CA", 1), // 加拿大國家包（src/countries/ca/）
  countrySlot("IE", 1), // 愛爾蘭國家包（src/countries/ie/）
  // 菲律賓（2026-11-13 第 0–1 波：行政邊界、人口、交通 3 層、能源 5 層）
  { id: "usePhAdminLayers", keys: ["phAdminBoundaries"], Host: PhAdminHost },
  { id: "usePhPopulationLayers", keys: ["phPopulation"], Host: PhPopulationHost },
  { id: "usePhTransportHubsLayer", keys: ["phTransportHubs"], Host: PhTransportHubsHost },
  { id: "usePhStationsLayer", keys: ["phStations"], Host: PhStationsHost },
  { id: "usePhMajorRoadsLayer", keys: ["phMajorRoads"], Host: PhMajorRoadsHost },
  { id: "usePhPowerPlantsLayer", keys: ["phPowerPlants"], Host: PhPowerPlantsHost },
  { id: "usePhPowerGridLayer", keys: ["phPowerGrid"], Host: PhPowerGridHost },
  { id: "usePhRenewablesLayer", keys: ["phRenewables"], Host: PhRenewablesHost },
  { id: "usePhFuelStationsLayer", keys: ["phFuelStations"], Host: PhFuelStationsHost },
  { id: "usePhPipelinesLayer", keys: ["phPipelines"], Host: PhPipelinesHost },
  // 泰國（2026-11-22 第 0–1 波：行政邊界、人口、交通 3 層、能源 5 層）
  { id: "useIdAdminLayers", keys: ["idAdminBoundaries"], Host: IdAdminHost },
  { id: "useIdPopulationLayers", keys: ["idPopulation"], Host: IdPopulationHost },
  { id: "useIdRuralDevelopmentLayers", keys: ["idRuralDevelopment"], Host: IdRuralDevelopmentHost },
  { id: "useIdStationsLayer", keys: ["idStations"], Host: IdStationsHost },
  { id: "useIdRailLinesLayer", keys: ["idRailLines"], Host: IdRailLinesHost },
  { id: "useIdTransportHubsLayer", keys: ["idTransportHubs"], Host: IdTransportHubsHost },
  { id: "useIdPowerPlantsLayer", keys: ["idPowerPlants"], Host: IdPowerPlantsHost },
  { id: "useIdPowerGridLayer", keys: ["idPowerGrid"], Host: IdPowerGridHost },
  { id: "useIdRenewablesLayer", keys: ["idRenewables"], Host: IdRenewablesHost },
  { id: "useIdFuelStationsLayer", keys: ["idFuelStations"], Host: IdFuelStationsHost },
  { id: "useIdPlaceNamesLayer", keys: ["idPlaceNames"], Host: IdPlaceNamesHost },
  { id: "useIdOuterIslandsLayer", keys: ["idOuterIslands"], Host: IdOuterIslandsHost },
  { id: "useIdFaultsLayer", keys: ["idFaults"], Host: IdFaultsHost },
  { id: "useIdMountainRescueLayer", keys: ["idMountainRescue"], Host: IdMountainRescueHost },
  { id: "useIdDibiHydrometLayer", keys: ["idDibiHydromet"], Host: IdDibiHydrometHost },
  { id: "useIdBridgesLayer", keys: ["idBridges"], Host: IdBridgesHost },
  { id: "useIdWaterFacilitiesLayer", keys: ["idWaterFacilities"], Host: IdWaterFacilitiesHost },
  { id: "useIdWatershedsLayer", keys: ["idWatersheds"], Host: IdWatershedsHost },
  { id: "useIdSubsidenceLayer", keys: ["idSubsidence"], Host: IdSubsidenceHost },
  { id: "useIdNatureSpotsLayer", keys: ["idNatureSpots"], Host: IdNatureSpotsHost },
  { id: "useIdConservationForestLayer", keys: ["idConservationForest"], Host: IdConservationForestHost },
  { id: "useIdCampsLayer", keys: ["idCamps"], Host: IdCampsHost },
  { id: "useIdTerrainHillshadeLayer", keys: ["idTerrainHillshade"], Host: IdTerrainHillshadeHost },
  { id: "useIdTerrainReliefLayer", keys: ["idTerrainRelief"], Host: IdTerrainReliefHost },
  { id: "useIdInariskLandslideLayer", keys: ["idInariskLandslide"], Host: IdInariskLandslideHost },
  { id: "useIdInariskFloodLayer", keys: ["idInariskFlood"], Host: IdInariskFloodHost },
  { id: "useIdInariskMultiLayer", keys: ["idInariskMulti"], Host: IdInariskMultiHost },
  { id: "useIdSchoolsLayer", keys: ["idSchools"], Host: IdSchoolsHost },
  { id: "useIdHealthFacilitiesLayer", keys: ["idHealthFacilities"], Host: IdHealthFacilitiesHost },
  { id: "useIdFireStationsLayer", keys: ["idFireStations"], Host: IdFireStationsHost },
  { id: "useIdPoliceStationsLayer", keys: ["idPoliceStations"], Host: IdPoliceStationsHost },
  { id: "useIdPrisonsCourtsLayer", keys: ["idPrisonsCourts"], Host: IdPrisonsCourtsHost },
  { id: "useIdImmigrationOfficesLayer", keys: ["idImmigrationOffices"], Host: IdImmigrationOfficesHost },
  { id: "useIdTransjakartaLayer", keys: ["idTransjakarta"], Host: IdTransjakartaHost },
  { id: "useIdSpecialEconomicZonesLayer", keys: ["idSpecialEconomicZones"], Host: IdSpecialEconomicZonesHost },
  { id: "useIdIknLayer", keys: ["idIkn"], Host: IdIknHost },
  { id: "useIdPostOfficesLayer", keys: ["idPostOffices"], Host: IdPostOfficesHost },
  { id: "useIdMarketsLayer", keys: ["idMarkets"], Host: IdMarketsHost },
  { id: "useIdBanksLayer", keys: ["idBanks"], Host: IdBanksHost },
  { id: "useIdCulturalFacilitiesLayer", keys: ["idCulturalFacilities"], Host: IdCulturalFacilitiesHost },
  { id: "useIdHeritageSitesLayer", keys: ["idHeritageSites"], Host: IdHeritageSitesHost },
  { id: "useIdCommTowersLayer", keys: ["idCommTowers"], Host: IdCommTowersHost },
  { id: "useIdPlacesOfWorshipLayer", keys: ["idPlacesOfWorship"], Host: IdPlacesOfWorshipHost },
  { id: "useIdExperiencesLayer", keys: ["idExperiences"], Host: IdExperiencesHost },
  { id: "useIdAccommodationLayer", keys: ["idAccommodation"], Host: IdAccommodationHost },
  { id: "useIdWeatherStationsLayer", keys: ["idWeatherStations"], Host: IdWeatherStationsHost },
  { id: "useIdFactoriesLayer", keys: ["idFactories"], Host: IdFactoriesHost },
  { id: "useIdSportsVenuesLayer", keys: ["idSportsVenues"], Host: IdSportsVenuesHost },
  { id: "useIdParksLayer", keys: ["idParks"], Host: IdParksHost },
  { id: "useIdCemeteriesLayer", keys: ["idCemeteries"], Host: IdCemeteriesHost },
  { id: "useIdAquacultureLayer", keys: ["idAquaculture"], Host: IdAquacultureHost },
  { id: "useIdFarmlandLayer", keys: ["idFarmland"], Host: IdFarmlandHost },
  { id: "useIdVeterinaryLayer", keys: ["idVeterinary"], Host: IdVeterinaryHost },
  countrySlot("TH", 1), // 泰國國家包（src/countries/th/）
  // 越南（2026-11-13 第 0–1 波：行政邊界、人口、交通 3 層、能源 5 層、環境監測站、安江示範）
  { id: "useVnAdminLayers", keys: ["vnAdminBoundaries"], Host: VnAdminHost },
  { id: "useVnPopulationLayers", keys: ["vnPopulation"], Host: VnPopulationHost },
  { id: "useVnStationsLayer", keys: ["vnStations"], Host: VnStationsHost },
  { id: "useVnTransportHubsLayer", keys: ["vnTransportHubs"], Host: VnTransportHubsHost },
  { id: "useVnMajorRoadsLayer", keys: ["vnMajorRoads"], Host: VnMajorRoadsHost },
  { id: "useVnPowerPlantsLayer", keys: ["vnPowerPlants"], Host: VnPowerPlantsHost },
  { id: "useVnRenewablesLayer", keys: ["vnRenewables"], Host: VnRenewablesHost },
  { id: "useVnPowerGridLayer", keys: ["vnPowerGrid"], Host: VnPowerGridHost },
  { id: "useVnFuelStationsLayer", keys: ["vnFuelStations"], Host: VnFuelStationsHost },
  { id: "useVnOilGasLayer", keys: ["vnOilGas"], Host: VnOilGasHost },
  { id: "useVnEnvisoftStationsLayer", keys: ["vnEnvisoftStations"], Host: VnEnvisoftStationsHost },
  { id: "useVnAngiangDemoLayer", keys: ["vnAngiangDemo"], Host: VnAngiangDemoHost },
  // 越南觀光波與第 2–7 波＋raster 4 層（2026-11-17）
  { id: "useVnTourAttractionsLayer", keys: ["vnTourAttractions"], Host: VnTourAttractionsHost },
  { id: "useVnTourNatureLayer", keys: ["vnTourNature"], Host: VnTourNatureHost },
  { id: "useVnTourServicesLayer", keys: ["vnTourServices"], Host: VnTourServicesHost },
  { id: "useVnNationalTouristAreasLayer", keys: ["vnNationalTouristAreas"], Host: VnNationalTouristAreasHost },
  { id: "useVnPlaceNamesLayer", keys: ["vnPlaceNames"], Host: VnPlaceNamesHost },
  { id: "useVnBicycleRentalLayer", keys: ["vnBicycleRental"], Host: VnBicycleRentalHost },
  { id: "useVnBridgesLayer", keys: ["vnBridges"], Host: VnBridgesHost },
  { id: "useVnParkingLayer", keys: ["vnParking"], Host: VnParkingHost },
  { id: "useVnGlideEventsLayer", keys: ["vnGlideEvents"], Host: VnGlideEventsHost },
  { id: "useVnDamsLayer", keys: ["vnDams"], Host: VnDamsHost },
  { id: "useVnRiversLayer", keys: ["vnRivers"], Host: VnRiversHost },
  { id: "useVnWaterSupplyLayer", keys: ["vnWaterSupply"], Host: VnWaterSupplyHost },
  { id: "useVnWaterStructuresLayer", keys: ["vnWaterStructures"], Host: VnWaterStructuresHost },
  { id: "useVnRiverbankErosionLayer", keys: ["vnRiverbankErosion"], Host: VnRiverbankErosionHost },
  { id: "useVnSchoolsLayer", keys: ["vnSchools"], Host: VnSchoolsHost },
  { id: "useVnSchoolCampusesLayer", keys: ["vnSchoolCampuses"], Host: VnSchoolCampusesHost },
  { id: "useVnKindergartensLayer", keys: ["vnKindergartens"], Host: VnKindergartensHost },
  { id: "useVnHealthFacilitiesLayer", keys: ["vnHealthFacilities"], Host: VnHealthFacilitiesHost },
  { id: "useVnPoliceLayer", keys: ["vnPolice"], Host: VnPoliceHost },
  { id: "useVnCourtsPrisonsLayer", keys: ["vnCourtsPrisons"], Host: VnCourtsPrisonsHost },
  { id: "useVnPostalServicesLayer", keys: ["vnPostalServices"], Host: VnPostalServicesHost },
  { id: "useVnPublicAmenitiesLayer", keys: ["vnPublicAmenities"], Host: VnPublicAmenitiesHost },
  { id: "useVnFinancialServicesLayer", keys: ["vnFinancialServices"], Host: VnFinancialServicesHost },
  { id: "useVnPlacesOfWorshipLayer", keys: ["vnPlacesOfWorship"], Host: VnPlacesOfWorshipHost },
  { id: "useVnParksLayer", keys: ["vnParks"], Host: VnParksHost },
  { id: "useVnProtectedAreasOdmLayer", keys: ["vnProtectedAreasOdm"], Host: VnProtectedAreasOdmHost },
  { id: "useVnAngiangAquacultureLayer", keys: ["vnAngiangAquaculture"], Host: VnAngiangAquacultureHost },
  { id: "useVnFieldBoundariesLayer", keys: ["vnFieldBoundaries"], Host: VnFieldBoundariesHost },
  { id: "useVnSoilLayer", keys: ["vnSoil"], Host: VnSoilHost },
  { id: "useVnFarmTracksLayer", keys: ["vnFarmTracks"], Host: VnFarmTracksHost },
  { id: "useVnCoalMinesLayer", keys: ["vnCoalMines"], Host: VnCoalMinesHost },
  { id: "useVnTerrainHillshadeLayer", keys: ["vnTerrainHillshade"], Host: VnTerrainHillshadeHost },
  { id: "useVnTerrainReliefLayer", keys: ["vnTerrainRelief"], Host: VnTerrainReliefHost },
  { id: "useVnLandslideSusceptibilityLayer", keys: ["vnLandslideSusceptibility"], Host: VnLandslideSusceptibilityHost },
  { id: "useVnWdpcaLayer", keys: ["vnWdpca"], Host: VnWdpcaHost },
  // 菲律賓第 2 波補充（2026-11-14：公車站、LRT／MRT、高速公路）
  { id: "usePhBusStopsLayer", keys: ["phBusStops"], Host: PhBusStopsHost },
  { id: "usePhUrbanRailLayer", keys: ["phUrbanRail"], Host: PhUrbanRailHost },
  { id: "usePhExpresswaysLayer", keys: ["phExpressways"], Host: PhExpresswaysHost },
  // 菲律賓觀光波與第 2–9 波（2026-11-16）
  { id: "usePhTouristAttractionsLayer", keys: ["phTouristAttractions"], Host: PhTouristAttractionsHost },
  { id: "usePhCoastIslandsLayer", keys: ["phCoastIslands"], Host: PhCoastIslandsHost },
  { id: "usePhNatureSpotsLayer", keys: ["phNatureSpots"], Host: PhNatureSpotsHost },
  { id: "usePhTourismServicesLayer", keys: ["phTourismServices"], Host: PhTourismServicesHost },
  { id: "usePhTourismDevelopmentAreasLayer", keys: ["phTourismDevelopmentAreas"], Host: PhTourismDevelopmentAreasHost },
  { id: "usePhPlaceNamesLayer", keys: ["phPlaceNames"], Host: PhPlaceNamesHost },
  { id: "usePhPovertyLayer", keys: ["phPoverty"], Host: PhPovertyHost },
  { id: "usePhEarthquakesLayer", keys: ["phEarthquakes"], Host: PhEarthquakesHost },
  { id: "usePhNoahFlood100yrLayer", keys: ["phNoahFlood100yr"], Host: PhNoahFlood100yrHost },
  { id: "usePhNoahLandslideLayer", keys: ["phNoahLandslide"], Host: PhNoahLandslideHost },
  { id: "usePhWaterPermitsLayer", keys: ["phWaterPermits"], Host: PhWaterPermitsHost },
  { id: "usePhLakesLayer", keys: ["phLakes"], Host: PhLakesHost },
  { id: "usePhDamsLayer", keys: ["phDams"], Host: PhDamsHost },
  { id: "usePhBridgesLayer", keys: ["phBridges"], Host: PhBridgesHost },
  { id: "usePhParkingLayer", keys: ["phParking"], Host: PhParkingHost },
  { id: "usePhKmPostsLayer", keys: ["phKmPosts"], Host: PhKmPostsHost },
  { id: "usePhEcozonesLayer", keys: ["phEcozones"], Host: PhEcozonesHost },
  { id: "usePhReclamationLayer", keys: ["phReclamation"], Host: PhReclamationHost },
  { id: "usePhSchoolsLayer", keys: ["phSchools"], Host: PhSchoolsHost },
  { id: "usePhSchoolCampusesLayer", keys: ["phSchoolCampuses"], Host: PhSchoolCampusesHost },
  { id: "usePhHealthFacilitiesLayer", keys: ["phHealthFacilities"], Host: PhHealthFacilitiesHost },
  { id: "usePhFireStationsLayer", keys: ["phFireStations"], Host: PhFireStationsHost },
  { id: "usePhNcrSafeOpenSpacesLayer", keys: ["phNcrSafeOpenSpaces"], Host: PhNcrSafeOpenSpacesHost },
  { id: "usePhPoliceStationsLayer", keys: ["phPoliceStations"], Host: PhPoliceStationsHost },
  { id: "usePhJailsLayer", keys: ["phJails"], Host: PhJailsHost },
  { id: "usePhTreesLayer", keys: ["phTrees"], Host: PhTreesHost },
  { id: "usePhTrailsLayer", keys: ["phTrails"], Host: PhTrailsHost },
  { id: "usePhKbaLayer", keys: ["phKba"], Host: PhKbaHost },
  { id: "usePhWetlandsLayer", keys: ["phWetlands"], Host: PhWetlandsHost },
  { id: "usePhForestryProgramsLayer", keys: ["phForestryPrograms"], Host: PhForestryProgramsHost },
  { id: "usePhCoastalResourcesLayer", keys: ["phCoastalResources"], Host: PhCoastalResourcesHost },
  { id: "usePhMarineStationsLayer", keys: ["phMarineStations"], Host: PhMarineStationsHost },
  { id: "usePhWdpcaLayer", keys: ["phWdpca"], Host: PhWdpcaHost },
  { id: "usePhWasteFacilitiesLayer", keys: ["phWasteFacilities"], Host: PhWasteFacilitiesHost },
  { id: "usePhPollutionSourcesLayer", keys: ["phPollutionSources"], Host: PhPollutionSourcesHost },
  { id: "usePhOpenaqAirLayer", keys: ["phOpenaqAir"], Host: PhOpenaqAirHost },
  { id: "usePhArtsVenuesLayer", keys: ["phArtsVenues"], Host: PhArtsVenuesHost },
  { id: "usePhPostOfficesLayer", keys: ["phPostOffices"], Host: PhPostOfficesHost },
  { id: "usePhPublicFacilitiesLayer", keys: ["phPublicFacilities"], Host: PhPublicFacilitiesHost },
  { id: "usePhFinancialServicesLayer", keys: ["phFinancialServices"], Host: PhFinancialServicesHost },
  { id: "usePhPlacesOfWorshipLayer", keys: ["phPlacesOfWorship"], Host: PhPlacesOfWorshipHost },
  { id: "usePhSportsVenuesLayer", keys: ["phSportsVenues"], Host: PhSportsVenuesHost },
  { id: "usePhParksLayer", keys: ["phParks"], Host: PhParksHost },
  { id: "usePhCemeteriesLayer", keys: ["phCemeteries"], Host: PhCemeteriesHost },
  { id: "usePhFishPortsLayer", keys: ["phFishPorts"], Host: PhFishPortsHost },
  { id: "usePhAquacultureLayer", keys: ["phAquaculture"], Host: PhAquacultureHost },
  { id: "usePhTerrainHillshadeLayer", keys: ["phTerrainHillshade"], Host: PhTerrainHillshadeHost },
  { id: "usePhTerrainReliefLayer", keys: ["phTerrainRelief"], Host: PhTerrainReliefHost },
  { id: "usePhBuiltSurfaceLayer", keys: ["phBuiltSurface"], Host: PhBuiltSurfaceHost },
  { id: "usePhForestLossLayer", keys: ["phForestLoss"], Host: PhForestLossHost },
  countrySlot("CN", 1), // 中國國家包（src/countries/cn/）
  countrySlot("CA", 2), // 加拿大國家包（src/countries/ca/）
  countrySlot("GB", 2), // 英國國家包（src/countries/gb/）
  // 日本氣象廳即時 4 層（gis-platform migration 435）：當下快照
  { id: "useJmaLiveLayer:jmaAmedas", keys: ["jmaAmedas"], Host: JmaAmedasHost },
  { id: "useJmaWarningsLayer", keys: ["jmaWarnings"], Host: JmaWarningsHost },
  { id: "useJmaLiveLayer:jmaQuakes", keys: ["jmaQuakes"], Host: JmaQuakesHost },
  { id: "useJmaLiveLayer:jmaVolcanoes", keys: ["jmaVolcanoes"], Host: JmaVolcanoesHost },
  { id: "useLightningLayer:jma", keys: ["jmaLightning"], Host: JmaLightningHost },
  { id: "useJmaLiveLayer:jmaWbgt", keys: ["jmaWbgt"], Host: JmaWbgtHost },
  { id: "useJmaLiveLayer:jmaSnowcap", keys: ["jmaSnowcap"], Host: JmaSnowcapHost },
  { id: "useJmaLiveLayer:jmaAutumnLeaves", keys: ["jmaAutumnLeaves"], Host: JmaAutumnLeavesHost },
  { id: "useJmaLiveLayer:jmaSakura", keys: ["jmaSakura"], Host: JmaSakuraHost },
  { id: "useJmaRainySeasonLayer", keys: ["jmaRainySeason"], Host: JmaRainySeasonHost },
  { id: "useJmaImageryLayer:jmaSnowDepth", keys: ["jmaSnowDepth"], Host: JmaSnowDepthHost },
  { id: "useJmaImageryLayer:jmaRadar", keys: ["jmaRadar"], Host: JmaRadarHost },
  { id: "useJmaImageryLayer:jmaRasrf", keys: ["jmaRasrf"], Host: JmaRasrfHost },
  { id: "useJmaImageryLayer:jmaRiskLand", keys: ["jmaRiskLand"], Host: JmaRiskLandHost },
  { id: "useJmaImageryLayer:jmaRiskInund", keys: ["jmaRiskInund"], Host: JmaRiskInundHost },
  { id: "useJmaImageryLayer:jmaUvIndex", keys: ["jmaUvIndex"], Host: JmaUvIndexHost },
  { id: "useJmaImageryLayer:jmaSst", keys: ["jmaSst"], Host: JmaSstHost },
  { id: "useJmaImageryLayer:jmaSeaIce", keys: ["jmaSeaIce"], Host: JmaSeaIceHost },
  { id: "useJmaImageryLayer:jmaHimawari", keys: ["jmaHimawari"], Host: JmaHimawariHost },
  { id: "useJmaImageryLayer:jmaAnaSnowFirst", keys: ["jmaAnaSnowFirst"], Host: JmaAnaSnowFirstHost },
  { id: "useJmaImageryLayer:jmaAnaSnowDays", keys: ["jmaAnaSnowDays"], Host: JmaAnaSnowDaysHost },
  { id: "useJmaImageryLayer:jmaAnaRainDays", keys: ["jmaAnaRainDays"], Host: JmaAnaRainDaysHost },
  { id: "useJmaImageryLayer:jmaAnaRiskLandHours", keys: ["jmaAnaRiskLandHours"], Host: JmaAnaRiskLandHoursHost },
  { id: "useJmaImageryLayer:jmaAnaRiskInundHours", keys: ["jmaAnaRiskInundHours"], Host: JmaAnaRiskInundHoursHost },
  { id: "useGibsSnowCoverLayer", keys: ["gibsSnowCover"], Host: GibsSnowCoverHost },
  { id: "useJmaRiskFloodLayer", keys: ["jmaRiskFlood"], Host: JmaRiskFloodHost },
  {
    id: "useJpTourismLayers",
    keys: [
      "jpAccommodationCanonical", "jpAccommodationJta", "jpAccommodationLocal", "jpAccommodationOsm",
      "jpNaturalParksNational", "jpNaturalParksQuasiNational", "jpNaturalParksPrefectural",
      "jpNatureConservationArea", "jpPrimitiveNatureEnvironmentArea", "jpNatureConservationSpecialDistrict",
      "jpWildlifeProtectionNational", "jpWildlifeSpecialProtectionDistrict", "jpWildlifeSpecialProtectionDesignatedArea",
      "jpWorldHeritageCultural", "jpWorldHeritageNatural", "jpWorldNaturalHeritageHistorical",
      "jpRamsarSites", "jpMarineEbsaCoastal",
    ],
    Host: JpTourismHost,
  },
  { id: "useClimateParticleLineLayer:wind", keys: ["windField"], Host: WindFieldHost },
  { id: "useClimateParticleLineLayer:ocean", keys: ["oceanCurrents"], Host: OceanCurrentsHost },
  { id: "useDustForecastLayer", keys: ["dustForecast"], Host: DustForecastHost },

  // ── 災防告警 + 共機活動區（L1157 / L1193）──
  {
    id: "useDisasterAlertLayer",
    keys: ["lifelineAlerts", "floodAlerts", "weatherAlerts", "transitAlerts", "safetyAlerts"],
    Host: DisasterAlertHost,
  },
  { id: "usePlaActivityLayer", keys: ["plaActivity"], Host: PlaActivityHost },
  // 新層（2026-08-12）：插在 plaActivity 之後 —— 既有 entry 的相對順序不變，
  // 本層的 source/layer 因此加在共機活動區之上（船點要壓在活動區面之上才點得到）
  { id: "useVesselWatchLayer", keys: ["vesselWatch"], Host: VesselWatchHost },
  {
    id: "useGlobalMaritimeLayers",
    keys: ["aisstreamVessels", "gfwVesselPresence"],
    Host: GlobalMaritimeHost,
  },
  { id: "useGfwHourlyGridLayer", keys: ["gfwHourlyGrid"], Host: GfwHourlyGridHost },
  { id: "useGfwHourlyTracksLayer", keys: ["gfwHourlyTracks"], Host: GfwHourlyTracksHost },
  { id: "useGfwFishingEffortLayer", keys: ["gfwFishingEffort"], Host: GfwFishingEffortHost },
  { id: "useGfwDarkVesselsLayer", keys: ["gfwDarkVessels"], Host: GfwDarkVesselsHost },

  // ── 衛星（L1204）──
  {
    id: "useSatellitesLayer",
    keys: [
      "satellitesYaogan", "satellitesJilin", "satellitesGaofen", "satellitesTJS",
      "satellitesBeidou", "satellitesShiyan", "satellitesTaiwan", "satellitesUSA",
      "satellitesJapan", "satellitesRussia", "satellitesIndia", "satellitesKorea",
      "satellitesFrance", "satellitesGermany", "satellitesItaly", "satellitesIsrael",
    ],
    Host: SatellitesHost,
  },

  // ── 路況 / 火災 / 清潔隊（L1230-1261）──
  { id: "useRoadEventsLayer", keys: ["roadEvents"], Host: RoadEventsHost },
  { id: "useFireEventsLayer", keys: ["fireEvents"], Host: FireEventsHost },
  { id: "useFireLatestLayer", keys: ["fireLatest"], Host: FireLatestHost },
  { id: "useWasteCleaningSquadLayer", keys: ["wasteCleaningSquads"], Host: WasteCleaningSquadHost },

  // ── 地形 raster / 坡度坡向 / 氣象空品影像（L1264-1306）──
  { id: "useStaticRasterLayer:hillshade", keys: ["hillshade"], Host: HillshadeHost },
  { id: "useGibsNightLightsLayer", keys: ["gibsNightLights"], Host: GibsNightLightsHost },
  { id: "useSlopeVectorLayer", keys: ["slopeVector"], Host: SlopeVectorHost },
  { id: "useAspectVectorLayer", keys: ["aspectVector"], Host: AspectVectorHost },
  {
    id: "useCwaImageryLayer",
    keys: ["cwaCloudImagery", "cwaRadarImagery"],
    Host: CwaImageryHost,
  },
  { id: "useAqiImageryLayer", keys: ["aqiImagery"], Host: AqiImageryHost },
  { id: "useAqiStationsLayer", keys: ["aqiStations"], Host: AqiStationsHost },
  { id: "useMicroSensorsLayer", keys: ["aqiMicroSensors"], Host: MicroSensorsHost },

  // ── 道路壅塞 / 殯葬密度 / 溫度網格（L1309-1337）──
  { id: "useFreewayLayer", keys: ["freewayCongestion"], Host: FreewayHost },
  { id: "useRoadCongestionLayer", keys: ["roadCongestion"], Host: RoadCongestionHost },
  { id: "useFuneralDensityLayer", keys: ["funeralOperatorDensity"], Host: FuneralDensityHost },
  // R6 段 1：溫度波「立體效果」關時的平面網格也由這支 host 畫（同一個 Mapbox 層 id）
  { id: "useTemperatureGridLayer", keys: ["temperatureGrid", "temperatureWave"], Host: TemperatureGridHost },

  // ── AR-22 P4 新增：原本是 App.tsx 的 inline useEffect ──────────────
  // 它們吃 `transportParams.<xxx>Params`，留在 App 等於「拖任一 slider →
  // 整棵樹 reconcile」。資料源（loader ＋ zoom 驅動的 resolution）仍在 App，
  // 經 hostDeps 傳入；這裡只負責「把資料畫上去」那一段。
  // ⚠️ 順序沿用 App.tsx 原本的 effect 宣告順序（rail → h3 → popCount →
  //    indicators → socio → spatial → youbike）。
  { id: "railTracks", keys: ["rail"], Host: RailTracksHost },
  { id: "h3Population", keys: ["h3Population"], Host: H3PopulationHost },
  { id: "popCount", keys: ["popCount"], Host: PopCountHost },
  { id: "indicators", keys: ["indicators"], Host: IndicatorsHost },
  { id: "socioeconomic", keys: ["socioeconomic"], Host: SocioeconomicHost },
  { id: "spatialEconomy", keys: ["spatialEconomy"], Host: SpatialEconomyHost },
  { id: "youbikeFullness", keys: ["youbikeFullness"], Host: YoubikeHost },
  { id: "useAnimalAdoptionLayer", keys: ["animalAdoption"], Host: AnimalAdoptionHost },
  { id: "useAnimalShelterPressureLayer", keys: ["animalShelterPressure"], Host: AnimalShelterPressureHost },
  { id: "useAnimalWelfarePointsLayer", keys: ["animalWelfarePoints"], Host: AnimalWelfarePointsHost },
  // 政治：2026 選舉活動（owner-only RPC；時間軸只改資料的 _past，不改 paint）
  { id: "useElectionEventsLayer", keys: ["electionEvents2026"], Host: ElectionEventsHost },
  // 政治：2024 投開票所（公開 bbox RPC；moveend debounce、zoom ≥ 12 才查）
  { id: "usePollingStationsLayer", keys: ["pollingStations2024"], Host: PollingStationsHost },
  // 政治：2026 議員選區（公開 RPC，一次抓全臺）
  { id: "useCouncilDistrictsLayer", keys: ["councilDistricts2026"], Host: CouncilDistrictsHost },
  // 即時 119 案件／警廣即時路況（owner-only RPC mig 555；當下快照，每分鐘重抓，不接時間軸）
  { id: "useFire119LiveLayer", keys: ["fire119Live"], Host: Fire119LiveHost },
  { id: "usePbsRoadEventsLiveLayer", keys: ["pbsRoadEventsLive"], Host: PbsRoadEventsLiveHost },
  // 台灣圖層延伸 B8（2026-11-22）：R2 即時快照
  { id: "useDengueClusterLayer", keys: ["dengueClusters"], Host: DengueClustersHost },
  { id: "useNavNoticesLayer", keys: ["navNotices"], Host: NavNoticesHost },
  { id: "useTideSwellAlertsLayer", keys: ["tideSwellAlerts"], Host: TideSwellAlertsHost },
  // 30 天地圖挑戰 Day 8：1955 中和鄉都市計畫圖（單張 image source）
  { id: "useMapchallengeDay08PlanLayer", keys: ["mapchallengeDay08Plan1955"], Host: MapchallengeDay08PlanHost },
  // 30 天地圖挑戰 Day 17 光與暗：真正的黑夜（image source＋保護區面）、入夜變亮（canvas source，timeStore 訂閱）
  { id: "useMapchallengeDay17DarkSkyLayer", keys: ["mapchallengeDay17DarkSky"], Host: MapchallengeDay17DarkSkyHost },
  { id: "useMapchallengeDay17NightFallLayer", keys: ["mapchallengeDay17NightFall"], Host: MapchallengeDay17NightFallHost },
  { id: "useMapchallengeDay19PotentialLayer", keys: ["mapchallengeDay19Potential"], Host: MapchallengeDay19PotentialHost },
  // 台灣圖層延伸 B5：縣市間遷徙流向（geojson 弧線＋端點，年份與統計底色連動）
  { id: "useCountyMigrationFlowsLayer", keys: ["twCountyMigrationFlows"], Host: CountyMigrationFlowsHost },
]);
