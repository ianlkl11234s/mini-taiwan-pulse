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
  RealEstateTimelineHost, RealEstatePointsHost, SelectedFeatureHaloHost,
} from "./hosts/realEstateHosts";
import {
  ReservoirStatusHost, RainGaugeHost, FloodSensorHost, FloodSensorIsochroneHost,
  TaipeiSewerHost, TaipeiEvacuateHost, TaipeiPumbHost, PrecipRasterHost,
  RiverLevelHost, GroundwaterWellsHost, GroundwaterHost,
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
  LibrarySeatsHost, ParkingHost, EarthquakeHost, EarthquakeReplayHost,
} from "./hosts/hazardHosts";
import {
  EarthquakesGlobalHost, TyphoonTracksHost, WorldTrashDebrisHost, JpReligionHost,
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
import { JpAdminHost, JpStationsHost, JpAirportsHost } from "./hosts/japanHosts";

export interface LayerHookEntry {
  /** hook 名（同名多次呼叫加 `:後綴` 區分）—— 也是 `window.__layerRenderCounts` 的 key */
  id: string;
  /** 這支 hook 服務的 manifest key */
  keys: readonly ManifestKey[];
  Host: LayerHostComponent;
}

/** ⚠️ 有序陣列。順序 = 凍結的 App.tsx 呼叫順序（見檔頭），嚴禁重排。 */
export const LAYER_HOOK_REGISTRY: readonly LayerHookEntry[] = [
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

  // ── 互動裝飾（L781）：跨圖層的點選光暈，不屬於任何單一 layer ──
  { id: "useSelectedFeatureHalo", keys: [], Host: SelectedFeatureHaloHost },

  // ── 水資源 / 水利（L784-897）──
  { id: "useReservoirStatusLayer", keys: ["waterReservoirs"], Host: ReservoirStatusHost },
  { id: "useRainGaugeLayer", keys: ["rainGauge"], Host: RainGaugeHost },
  { id: "useFloodSensorLayer", keys: ["floodSensor"], Host: FloodSensorHost },
  { id: "useFloodSensorIsochroneLayer", keys: ["floodSensorIsochrone"], Host: FloodSensorIsochroneHost },
  { id: "useTaipeiSewerLayer", keys: ["taipeiSewer"], Host: TaipeiSewerHost },
  { id: "useTaipeiEvacuateLayer", keys: ["taipeiEvacuate"], Host: TaipeiEvacuateHost },
  { id: "useTaipeiPumbLayer", keys: ["taipeiPumb"], Host: TaipeiPumbHost },
  { id: "usePrecipRasterLayer", keys: ["precipRaster"], Host: PrecipRasterHost },
  { id: "useRiverLevelLayer", keys: ["riverLevel"], Host: RiverLevelHost },
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
  { id: "useLibrarySeatsLayer", keys: ["librarySeats"], Host: LibrarySeatsHost },
  { id: "useParkingLayer", keys: ["parkingOnstreet", "parkingOffstreet"], Host: ParkingHost },

  // ── 新聞時間過濾 + 地震（L1062-1082）──
  { id: "useNewsTimeline", keys: ["newsEvents"], Host: NewsTimelineHost },
  { id: "useEarthquakeLayer", keys: ["earthquakes"], Host: EarthquakeHost },
  { id: "useEarthquakeReplayLayer", keys: ["earthquakeReplay"], Host: EarthquakeReplayHost },

  // ── 全球氣候 / 世界（L1088-1154）──
  { id: "useEarthquakesGlobalLayer", keys: ["earthquakesGlobal"], Host: EarthquakesGlobalHost },
  { id: "useTyphoonTracksLayer", keys: ["typhoonTracks"], Host: TyphoonTracksHost },
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
  { id: "useTemperatureGridLayer", keys: ["temperatureGrid"], Host: TemperatureGridHost },

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
