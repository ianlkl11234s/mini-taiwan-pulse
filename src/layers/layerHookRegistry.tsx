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
  RealEstateTimelineHost, RealEstatePointsHost, PropertyValueAdminHost, SelectedFeatureHaloHost,
} from "./hosts/realEstateHosts";
import {
  ReservoirStatusHost, RainGaugeHost, BridgeRainHost, FloodSensorHost, FloodSensorIsochroneHost,
  TaipeiSewerHost, TaipeiEvacuateHost, TaipeiPumbHost, PrecipRasterHost,
  RiverLevelHost, MarineObservationHost, GroundwaterWellsHost, GroundwaterHost,
  IotWraRiverHost, IotWraStructureHost,
} from "./hosts/waterHosts";
import { NewsEventsHost, NewsTimelineHost } from "./hosts/newsHosts";
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
  HillshadeHost, SlopeVectorHost, AspectVectorHost, CwaImageryHost,
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
  JpWelfareFacilitiesHost, JpMajorRoadsHost, JpExpresswaysHost, JpGsiTerrainHost,
  JpPopulationMeshHost,
  JpTourismHost, JpWaterHost,
} from "./hosts/japanHosts";
import { GbArtsVenuesHost, GbCulturalFacilitiesHost, GbMajorRoadsHost, GbTrafficCountsAadfHost, GbVisitorExperienceHost } from "./hosts/ukHosts";
import { GbSurplusLandHost, GbTerrainHost } from "./hosts/ukHosts";
import { GbAquacultureHost, GbCompaniesHost, GbFuneralHost, GbManufacturingHost, GbSoilParentMaterialHost } from "./hosts/ukHosts";
import { GbBrownfieldHost, GbNoiseHost, GbPlanningConstraintsHost, GbPollutionInventoryHost, GbRecyclingCentresHost, GbWastePermitsHost } from "./hosts/ukHosts";
import { GbEarthquakesHost, GbGroundStabilityHost, GbLandslideHost, GbRadiationHost, GbRadonHost } from "./hosts/ukHosts";
import { GbCareHomesHost, GbCareServicesHost, GbCourtsHost, GbFireStationsHost, GbHealthFacilitiesHost, GbSchoolsHost } from "./hosts/ukHosts";
import { KrAdminHost, KrBusStopsHost, KrRailStationsHost, KrAirportsHost, KrPortsHost, KrNationalRoadsHost, KrRailLinesHost, KrFuelStationsHost, KrPowerPlantsHost, KrRenewablesHost, KrPowerLinesHost, KrSubstationsHost, KrPowerTowersHost, KrOilGasHost } from "./hosts/koreaHosts";
import { GbAdminHost, GbFuelStationsHost, GbOilGasFieldsHost, GbPowerLinesHost, GbPowerPlantsHost, GbRenewablesHost, GbSubstationsHost, GbBathingWatersHost, GbCoastalErosionHost, GbFloodDefencesHost, GbForestRecreationHost, GbHydroStationsHost, GbMarineProtectedAreasHost, GbOpenAccessLandHost, GbProtectedAreasHost, GbTrailsHost, GbTreeProtectionHost, GbWoodlandHost, GbLondonBikePointsHost, GbLondonChargingZonesHost, GbLondonJamCamsHost, GbLondonRailHost, GbMaritimeLimitsHost, GbOpenSpaceHost, GbRiversHost, GbTransportHubsHost } from "./hosts/ukHosts";

export interface LayerHookEntry {
  /** hook 名（同名多次呼叫加 `:後綴` 區分）—— 也是 `window.__layerRenderCounts` 的 key */
  id: string;
  /** 這支 hook 服務的 manifest key */
  keys: readonly ManifestKey[];
  Host: LayerHostComponent;
}

/** ⚠️ 有序陣列。順序 = 凍結的 App.tsx 呼叫順序（見檔頭），嚴禁重排。 */
export const LAYER_HOOK_REGISTRY: readonly LayerHookEntry[] = [
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
  { id: "useJpExpresswaysLayer", keys: ["jpExpressways"], Host: JpExpresswaysHost },
  { id: "useJpGsiTerrainLayers", keys: ["jpGsiHillshade", "jpGsiRelief"], Host: JpGsiTerrainHost },
  { id: "useJpPopulationMeshLayer", keys: ["jpPopulationMesh1km"], Host: JpPopulationMeshHost },
  // 英國（2026-10-29 第 0b 波）
  { id: "useGbAdminLayers", keys: ["gbAdminBoundaries", "gbSmallAreaBoundaries"], Host: GbAdminHost },
  // 南韓（2026-10-31 第 0 波）
  { id: "useKrAdminLayers", keys: ["krAdminBoundaries"], Host: KrAdminHost },
  // 南韓第 1 波（國土基礎：交通＋能源）
  { id: "useKrBusStopsLayer", keys: ["krBusStops"], Host: KrBusStopsHost },
  { id: "useKrRailStationsLayer", keys: ["krRailStations"], Host: KrRailStationsHost },
  { id: "useKrAirportsLayer", keys: ["krAirports"], Host: KrAirportsHost },
  { id: "useKrPortsLayer", keys: ["krPorts"], Host: KrPortsHost },
  { id: "useKrNationalRoadsLayer", keys: ["krNationalRoads"], Host: KrNationalRoadsHost },
  { id: "useKrRailLinesLayer", keys: ["krRailLines"], Host: KrRailLinesHost },
  { id: "useKrFuelStationsLayer", keys: ["krFuelStations"], Host: KrFuelStationsHost },
  { id: "useKrPowerPlantsLayer", keys: ["krPowerPlants"], Host: KrPowerPlantsHost },
  { id: "useKrRenewablesLayer", keys: ["krRenewables"], Host: KrRenewablesHost },
  { id: "useKrPowerLinesLayer", keys: ["krPowerLines"], Host: KrPowerLinesHost },
  { id: "useKrSubstationsLayer", keys: ["krSubstations"], Host: KrSubstationsHost },
  { id: "useKrPowerTowersLayer", keys: ["krPowerTowers"], Host: KrPowerTowersHost },
  { id: "useKrOilGasLayer", keys: ["krOilGas"], Host: KrOilGasHost },
  // 英國第 1 波（海域界線、建成區、綠地三層）
  { id: "useGbMaritimeLimitsLayer", keys: ["gbMaritimeLimits"], Host: GbMaritimeLimitsHost },
  { id: "useGbOpenSpaceLayers", keys: ["gbBuiltUpAreas", "gbGreenspace", "gbSportsFacilities", "gbCemeteries"], Host: GbOpenSpaceHost },
  // 英國第 3 波（河川、水文測站、防洪設施、海岸侵蝕、浴場）
  { id: "useGbRiversLayer", keys: ["gbRivers"], Host: GbRiversHost },
  { id: "useGbHydroStationsLayer", keys: ["gbHydroStations"], Host: GbHydroStationsHost },
  { id: "useGbFloodDefencesLayer", keys: ["gbFloodDefenceAssets"], Host: GbFloodDefencesHost },
  { id: "useGbCoastalErosionLayer", keys: ["gbCoastalErosionRisk"], Host: GbCoastalErosionHost },
  { id: "useGbBathingWatersLayer", keys: ["gbBathingWaters"], Host: GbBathingWatersHost },
  // 英國第 4 波（交通樞紐＋站客流、倫敦軌道線＋車站、單車站、攝影機、收費區）
  { id: "useGbTransportHubsLayer", keys: ["gbTransportHubs", "gbStationUsage"], Host: GbTransportHubsHost },
  { id: "useGbLondonRailLayers", keys: ["gbLondonRailLines", "gbLondonStations"], Host: GbLondonRailHost },
  { id: "useGbLondonBikePointsLayer", keys: ["gbLondonBikePoints"], Host: GbLondonBikePointsHost },
  { id: "useGbLondonJamCamsLayer", keys: ["gbLondonJamCams"], Host: GbLondonJamCamsHost },
  { id: "useGbLondonChargingZonesLayer", keys: ["gbLondonChargingZones"], Host: GbLondonChargingZonesHost },
  // 英國第 12 波（公司登記、製造業、殯葬、養殖、土壤母質）
  { id: "useGbCompaniesLayer", keys: ["gbCompanies"], Host: GbCompaniesHost },
  { id: "useGbManufacturingLayer", keys: ["gbManufacturing"], Host: GbManufacturingHost },
  { id: "useGbFuneralLayer", keys: ["gbFuneral"], Host: GbFuneralHost },
  { id: "useGbAquacultureLayer", keys: ["gbAquaculture"], Host: GbAquacultureHost },
  { id: "useGbSoilParentMaterialLayer", keys: ["gbSoilParentMaterial"], Host: GbSoilParentMaterialHost },
  // 英國第 11 波（規劃限制區、棕地、回收點、廢棄物許可、污染排放、噪音）
  { id: "useGbPlanningConstraintsLayer", keys: ["gbPlanningConstraints"], Host: GbPlanningConstraintsHost },
  { id: "useGbBrownfieldLayer", keys: ["gbBrownfield"], Host: GbBrownfieldHost },
  { id: "useGbRecyclingCentresLayer", keys: ["gbRecyclingCentres"], Host: GbRecyclingCentresHost },
  { id: "useGbWastePermitsLayer", keys: ["gbWastePermits"], Host: GbWastePermitsHost },
  { id: "useGbPollutionInventoryLayer", keys: ["gbPollutionInventory"], Host: GbPollutionInventoryHost },
  { id: "useGbNoiseLayer", keys: ["gbNoise"], Host: GbNoiseHost },
  // 英國第 10 波（主要路網、AADF 交通計數點）
  { id: "useGbMajorRoadsLayer", keys: ["gbMajorRoads"], Host: GbMajorRoadsHost },
  { id: "useGbTrafficCountsAadfLayer", keys: ["gbTrafficCountsAadf"], Host: GbTrafficCountsAadfHost },
  // 英國第 5 波（保護區、海洋保護區、林地、森林遊憩、步道、開放進入地、樹木保護）
  { id: "useGbProtectedAreasLayer", keys: ["gbProtectedAreas"], Host: GbProtectedAreasHost },
  { id: "useGbMarineProtectedAreasLayer", keys: ["gbMarineProtectedAreas"], Host: GbMarineProtectedAreasHost },
  { id: "useGbWoodlandLayer", keys: ["gbWoodland"], Host: GbWoodlandHost },
  { id: "useGbForestRecreationLayer", keys: ["gbForestRecreation"], Host: GbForestRecreationHost },
  { id: "useGbTrailsLayer", keys: ["gbTrails"], Host: GbTrailsHost },
  { id: "useGbOpenAccessLandLayer", keys: ["gbOpenAccessLand"], Host: GbOpenAccessLandHost },
  { id: "useGbTreeProtectionLayer", keys: ["gbTreeProtection"], Host: GbTreeProtectionHost },
  // 英國第 6 波（電廠、再生能源、電網線、變電所、加油站、離岸油氣田）
  { id: "useGbPowerPlantsLayer", keys: ["gbPowerPlants"], Host: GbPowerPlantsHost },
  { id: "useGbRenewablesLayer", keys: ["gbRenewables"], Host: GbRenewablesHost },
  { id: "useGbPowerLinesLayer", keys: ["gbPowerLines"], Host: GbPowerLinesHost },
  { id: "useGbSubstationsLayer", keys: ["gbSubstations"], Host: GbSubstationsHost },
  { id: "useGbFuelStationsLayer", keys: ["gbFuelStations"], Host: GbFuelStationsHost },
  { id: "useGbOilGasFieldsLayer", keys: ["gbOilGasFields"], Host: GbOilGasFieldsHost },
  // 英國第 7 波（學校、醫療、照護之家、長照服務、消防站、法院）
  { id: "useGbSchoolsLayer", keys: ["gbSchools"], Host: GbSchoolsHost },
  { id: "useGbHealthFacilitiesLayer", keys: ["gbHealthFacilities"], Host: GbHealthFacilitiesHost },
  { id: "useGbCareHomesLayer", keys: ["gbCareHomes"], Host: GbCareHomesHost },
  { id: "useGbCareServicesLayer", keys: ["gbCareServices"], Host: GbCareServicesHost },
  { id: "useGbFireStationsLayer", keys: ["gbFireStations"], Host: GbFireStationsHost },
  { id: "useGbCourtsLayer", keys: ["gbCourts"], Host: GbCourtsHost },
  // 英國第 8 波（文化設施、藝文場館、觀光體驗）
  { id: "useGbCulturalFacilitiesLayer", keys: ["gbCulturalFacilities"], Host: GbCulturalFacilitiesHost },
  { id: "useGbArtsVenuesLayer", keys: ["gbArtsVenues"], Host: GbArtsVenuesHost },
  { id: "useGbVisitorExperienceLayer", keys: ["gbVisitorExperience"], Host: GbVisitorExperienceHost },
  // 英國 C003 地形（raster 兩層）、C028 公有地標售
  { id: "useGbTerrainLayers", keys: ["gbTerrainHillshade", "gbTerrainRelief"], Host: GbTerrainHost },
  { id: "useGbSurplusLandLayer", keys: ["gbSurplusLand"], Host: GbSurplusLandHost },
  // 英國第 9 波災害地質
  { id: "useGbGroundStabilityLayer", keys: ["gbGroundStability"], Host: GbGroundStabilityHost },
  { id: "useGbLandslideLayer", keys: ["gbLandslide"], Host: GbLandslideHost },
  { id: "useGbRadonLayer", keys: ["gbRadon"], Host: GbRadonHost },
  { id: "useGbRadiationLayer", keys: ["gbRadiation"], Host: GbRadiationHost },
  { id: "useGbEarthquakesLayer", keys: ["gbEarthquakes"], Host: GbEarthquakesHost },
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
];
