import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PANEL_REGISTRY } from "../../components/featureInfo/registry";
import type { MessageKey } from "../../i18n/keys";
import { LAYER_SOURCE_INFO, POPUP_PER_FEATURE_SOURCE, popupSourceMode, resolveSourceText, type SourceText } from "../layerSourceInfo";

/**
 * 站主 2026-11-23：來源與資料說明放圖層的「說明・來源」，popup 只放使用者需要的資料。
 * popup 拿掉來源列的前提是圖層側（src/data/layerSourceInfo.ts）已能顯示機關＋授權。
 * 這裡守兩件事：圖層側補不到的 popup 都列在 POPUP_SOURCE_PENDING（仍掛一行來源）；
 * 來源表每一列的機關都解析得出字、引用的 i18n key 都存在。
 */

/** 圖層側還補不到機關＋授權（多為目錄無條目或缺欄），popup 仍掛一行「機關 · 授權 · 來源」。補上來源表後從這裡移除。 */
const POPUP_SOURCE_PENDING = new Set<string>([
  "accessibleParkFacilities", "accidentTaipei", "agricultureField", "airport", "aisstreamVessel", "allenCoralAtlas", "analysisResult",
  "animalShelterPressure", "animalWelfarePoints", "antiCorruptionOffice", "aquacultureIntegrated", "aquacultureWaterSatellite",
  "aquacultureWaterSatelliteMoa", "aquacultureWaterUnion", "aspectVector", "bicycleSupport", "bridgeComparisonNewTaipei",
  "bridgeResilienceTwinCity", "bssNationalBridgePointsPreview", "bssNationalBridgePreview", "canopyGiants", "changhuaTrafficSignals",
  "chatHighlight", "civilDefenseShelter", "coastGuardStation", "communityCenter", "contourDtm20", "coralReefDistribution",
  "correctionalFacility", "councilDistricts2026", "countyStreetlights", "countyWelfarePoints", "court", "courtJurisdiction",
  "disasterResourceSites", "disasterShelters", "drinkingWaterPoints", "eduDistrictK12", "erHospital", "evIsland", "evMotorcycleCharging",
  "factoryDensityGrid", "factoryLocations", "fireHydrant", "fireStation", "firingNoticeAreas", "gasCoverageAll", "gbAquaculture",
  "gbArtsVenues", "gbBathingWaters", "gbCareHomes", "gbCareServices", "gbCoastalErosionRisk", "gbCourts", "gbCulturalFacilities",
  "gbFireStations", "gbFloodDefenceAssets", "gbForestRecreation", "gbHealthFacilities", "gbHydroStations", "gbMajorRoads",
  "gbMarineProtectedAreas", "gbNoise", "gbOpenAccessLand", "gbPlanningConstraints", "gbProtectedAreas", "gbRoadFacilities", "gbSchools",
  "gbSmallAreaBoundaries", "gbStationUsage", "gbTrails", "gbTransportHubs", "gbTreeProtection", "gbVisitorExperience", "gbWastePermits",
  "gbWoodland", "gfwDarkVessel", "gfwFishingEffort", "gfwHourlyGrid", "gfwHourlyTrack", "gfwVesselPresence", "globalEvent",
  "harmReductionCondomOutlets", "harmReductionHivTesting", "harmReductionTreatment", "hikingTrails", "historicalFlightTrails",
  "industrialParkBoundaries", "industrialParkComparison", "investigationBureau", "iotWraRiver", "islandPowerFacility",
  "jpAccommodationCanonical", "jpAccommodationDensity", "jpAccommodationJta", "jpAccommodationLocal", "jpAccommodationOsm",
  "jpAdminBoundaries", "jpAdminPrefecture", "jpAirports", "jpBuildingHeight", "jpCareCombined", "jpCareDayServices", "jpCareEquipment",
  "jpCareHomeVisit", "jpCarePlanning", "jpCareResidential", "jpDid", "jpHistoricalFlightTrails", "jpMarineEbsaCoastal", "jpMedicalClinics",
  "jpMedicalDental", "jpMedicalHospitals", "jpMedicalMaternity", "jpMedicalPharmacies", "jpNaturalParksNational",
  "jpNaturalParksPrefectural", "jpNaturalParksQuasiNational", "jpNatureConservationArea", "jpNatureConservationSpecialDistrict",
  "jpPoliceFacilities", "jpPrimitiveNatureEnvironmentArea", "jpRailways", "jpRamsarSites", "jpReligionGsi", "jpReligionOsm", "jpSchools",
  "jpStations", "jpWaterAgriculturalPonds", "jpWaterDams", "jpWaterGroundwaterSites", "jpWaterLakes", "jpWaterLevelStations",
  "jpWaterLocalFacilities", "jpWaterNilimDams", "jpWaterQualityStations", "jpWaterRivers", "jpWaterSewerFacilities", "jpWaterSupplyAreas",
  "jpWaterSupplyFacilities", "jpWildlifeProtectionNational", "jpWildlifeSpecialProtectionDesignatedArea",
  "jpWildlifeSpecialProtectionDistrict", "jpWorldHeritageCultural", "jpWorldHeritageNatural", "jpWorldNaturalHeritageHistorical",
  "librarySeats", "lightningStrike", "manufacturingCompanyDensityGrid", "manufacturingCompanyPoints", "mapchallengeDay23TasteTerms",
  "mapchallengeDay23TasteVariants", "marineObservation", "materialRecyclingPoints", "medicalIsochrone", "mountainHut", "nationalParks",
  "newsEvent", "nuclearEpzEvacuation", "officialBridgesHsinchu", "officialBridgesNewTaipei", "ooklaFixedGrid", "ooklaMobileGrid",
  "osmBridgeCarriers", "osmBridgeFootprints", "osmExpressway", "osmPowerPlantStatic", "osmSolarFarm", "parkingOffstreet",
  "parkingOnstreet", "phOpenaqAir", "playgrounds", "powerPlant", "propertyValueAdmin", "propertyValueGrid", "prosecutorsOffice",
  "publicLifeOsmCoverage", "publicWasteBaskets", "railRoutes", "rasterProbe", "regionalStatistic", "regulatedFacilities",
  "regulatedFacilityDensityGrid", "ripeAtlasProbe", "slopeVector", "socioeconomic", "spatialEconomy", "speedCamera", "speedZoneSegment",
  "tainanBridgeInspections", "taipeiEvacuate", "taipeiPumb", "taipeiSewer", "theftTaoyuan", "tideSwellAlert", "trafficAccidentYearly",
  "transitAccessGrid", "transitReachGrid", "tsunamiSirens", "twMarineHeat", "visitorCentres", "waterDetentionBasin",
  "welfareChildServices", "welfareChildcare", "welfareDisability", "welfareElderlyHomes", "welfareGovOffices", "welfareLtcInstitutions",
  "welfareMentalHealth", "welfareNursingHomes", "welfareSocialWorkOrgs", "womenChildWarning",
]);

/** popup 原本就沒有授權的來源（研究推估、即時快照、站內模擬等）：圖層側顯示「授權未明示」。 */
const LICENSE_UNSTATED = new Set<string>([
  "busCrowdingSim", "canopyHeight", "dengueClusters", "electionEvents2026", "fire119Live", "fireIsochrone", "freewayTdcsSim",
  "gbFloodDefenceAssets", "gbOilGasFields", "h3Population", "iotWraRiver", "jpMedicalAreasPrimary", "jpMedicalAreasSecondary",
  "jpMedicalAreasTertiary", "jpReligionGsi", "jpReligionOsm", "mapchallengeDay04Facility", "mapchallengeDay04Overlap",
  "mapchallengeDay04Population", "mapchallengeDay04ScaleTcCh", "mapchallengeDay05SeaView", "mapchallengeDay05SeaViewRuns",
  "mapchallengeDay06Coast", "mapchallengeDay06Lighthouses", "mapchallengeDay06Taipei1932", "mapchallengeDay06Temples1921",
  "mapchallengeDay08Access", "mapchallengeDay08Parks", "mapchallengeDay08Sites", "mapchallengeDay09UrbanRural",
  "mapchallengeDay17DarkRoads", "mapchallengeDay17DarkSky", "mapchallengeDay17LedShare", "mapchallengeDay19Complaints",
  "mapchallengeDay19Penalties", "mapchallengeDay19Potential", "mapchallengeDay21OsmRoads", "navNotices", "pbsRoadEventsLive",
  "pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile", "popCount", "ripeAtlasProbes", "satellitesBeidou",
  "satellitesFrance", "satellitesGaofen", "satellitesGermany", "satellitesIndia", "satellitesIsrael", "satellitesItaly", "satellitesJapan",
  "satellitesJilin", "satellitesKorea", "satellitesRussia", "satellitesShiyan", "satellitesTJS", "satellitesTaiwan", "satellitesUSA",
  "satellitesYaogan", "taipeiPumb", "transitAccessPlayback", "transitReachPlayback", "youbikeFullness",
]);

const LOCALES = join(__dirname, "..", "..", "i18n", "locales");
function messages(locale: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of readdirSync(join(LOCALES, locale))) if (file.endsWith(".json")) Object.assign(out, JSON.parse(readFileSync(join(LOCALES, locale, file), "utf8")));
  return out;
}
const ZH = messages("zh-TW");
const lookup = (key: MessageKey, vars?: Record<string, string | number>) => {
  const raw = ZH[key];
  return raw == null ? null : raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
};

function keysIn(text: SourceText, out: string[] = []): string[] {
  if (typeof text === "string") return out;
  if ("key" in text) { out.push(text.key); for (const v of Object.values(text.vars ?? {})) keysIn(v, out); return out; }
  for (const v of Object.values(text)) keysIn(v, out);
  return out;
}

describe("圖層來源表（popup 來源移到圖層側）", () => {
  it("圖層側補不到機關＋授權的 popup 都在 POPUP_SOURCE_PENDING", () => {
    const full = Object.keys(PANEL_REGISTRY).filter((layerType) => popupSourceMode(layerType) === "full");
    expect(full.filter((layerType) => !POPUP_SOURCE_PENDING.has(layerType))).toEqual([]);
    // 已補上的要從清單移除（避免清單過期）
    expect([...POPUP_SOURCE_PENDING].filter((layerType) => popupSourceMode(layerType) !== "full")).toEqual([]);
  });

  it("逐筆來源不同的 layerType 都是現有 popup", () => {
    expect([...POPUP_PER_FEATURE_SOURCE].filter((layerType) => !(layerType in PANEL_REGISTRY))).toEqual([]);
  });

  it("每一列的機關都解析得出字，引用的 i18n key 都存在", () => {
    const bad: string[] = [];
    for (const [layerKey, info] of Object.entries(LAYER_SOURCE_INFO)) {
      for (const text of [info.org, info.license, info.asOf, ...(info.notes ?? [])]) {
        if (text == null) continue;
        for (const key of keysIn(text)) if (!(key in ZH) && !key.startsWith("enum.")) bad.push(`${layerKey}: ${key}`);
      }
      if (!resolveSourceText(info.org, { active: "zh-TW", lookup }).trim()) bad.push(`${layerKey}: 機關空白`);
    }
    expect(bad).toEqual([]);
  });

  it("沒有授權的列都明列在 LICENSE_UNSTATED", () => {
    const noLicense = Object.entries(LAYER_SOURCE_INFO).filter(([, info]) => info.license == null).map(([key]) => key);
    expect(noLicense.filter((key) => !LICENSE_UNSTATED.has(key))).toEqual([]);
    expect([...LICENSE_UNSTATED].filter((key) => LAYER_SOURCE_INFO[key]?.license != null)).toEqual([]);
  });
});
