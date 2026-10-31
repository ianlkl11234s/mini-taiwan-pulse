/**
 * map-layers.md §3.8 全國視角可見性契約（ratchet）：既有違規列在基準清單，只准減少、不准增加。
 * - 新違規 → 紅：修圖層（降 minzoom／加熱區、補類別篩選），真的有理由就在基準加一筆並在 PR 說明。
 * - 基準裡的層已經修好 → 也紅：把它從基準刪掉（清單只會變短）。
 * 判斷範圍與方法見 `src/map/visibilityAudit.ts`（registry overlay＋南韓資料層；其他 hook 圖層不涵蓋）。
 */
import { describe, expect, it } from "vitest";
import { categoryFilterViolations, zoomLagViolations } from "../visibilityAudit";

/**
 * V-2 基準（2026-10-31）：layer 最早出現縮放比圖磚 minzoom 晚超過 1 級。
 * 行政界（county／township／village）與工商密度網格（z4 起）屬「有理由」的刻意設定；
 * 南韓 kr* 由南韓前端軌修正後移除。
 */
const V2_BASELINE: readonly string[] = [
  "aquaculturePonds", "contourDtm20", "countyBoundary", "factoryDensityGrid", "farmRoads", "forestRoads",
  "hikingTrails", "krBridges", "krChildProtectionZones", "krCoastalErosionFacilities", "krMarineEnvSites",
  "krMarinePollutionIncidents", "krMarineProtectedAreas", "krNationalParks", "krNpLocationSigns", "krNpTrails",
  "krParkingLots", "krPublicBicycleStations", "krRiversOsm", "krSeoulSubwayCongestion", "krSluiceGates",
  "krSpeedCameras", "krWaterLevelStations", "krWaterQualityStations", "landslideAnnual",
  "manufacturingCompanyDensityGrid", "regulatedFacilityDensityGrid", "townshipBoundary", "villageBoundary",
];

/**
 * V-4 基準（2026-10-31）：paint 以字串 match 分 ≥2 類（或南韓 `cats` ≥2）但規格沒有資料篩選控件。
 * 判斷不了「字串的序位分級」（例：UV 等級、水質等級），所以本清單是上限，逐層檢視時可登記為不適用。
 */
const V4_BASELINE: readonly string[] = [
  "accidentTaipei", "anfrWirelessSites", "antiCorruptionOffice", "aquacultureIntegrated", "batterySwapStations",
  "beachWaterQuality", "cctv", "cemeteryZoning", "cemsStackLive", "civilDefenseShelter", "coastGuardStation",
  "correctionalFacility", "court", "cwaUvDaily", "drinkingWaterProtectionZones", "ecoNetworkZones",
  "eduCampusPolygon", "eduCramSchool", "eduDistrictElementary", "eduDistrictJunior", "eduKindergarten",
  "eduRemoteSchools", "emergencyHospitals", "erHospital", "evIsland", "exclusiveFisheryRightAreas", "facOffshore",
  "fireHydrants", "fireStations", "forestReserve", "fossilFuelInfra", "freewayEcoSensitive", "freewayInterchanges",
  "gasCoverageAll", "gasCoverageCpc", "gasCoverageFpcc", "gasCoverageTaisugar", "govServiceOffices",
  "hakkaCulturalZones", "hikingTrails", "importantWetlands", "indigenousIsolationRisk", "indigenousLanguageDialects",
  "indigenousTribes", "internetExchangePoints", "iowStructureMonitoring", "islandPowerGrid", "jmaQuakes",
  "jmaVolcanoes", "krBridges", "krChildProtectionZones", "krCoastalErosionFacilities", "krMarineEnvSites",
  "krMarinePollutionIncidents", "krMarineProtectedAreas", "krNpTrails", "krParkingLots", "krPublicBicycleStations",
  "krRiversOsm", "krSeoulSubwayCongestion", "krSpeedCameras", "krStreetTrees", "krWaterLevelStations",
  "krWaterQualityStations", "lakesPondsOsm", "majorOccupationalAccidents", "marinePollutionIncidents",
  "marineWildlifeAreas", "maritimeBoundary", "mountainHuts", "noiseEnforcementEvents", "nuclearRadiation",
  "osmCommunicationSites", "osmPowerPlantsStatic", "osmRoadDrive", "osmSubstations", "osmSubstationsEhv",
  "policeStation", "ports", "prosecutorsOffice", "renewablePermitsNational", "renewablePermitsTaipei",
  "riverRpiSegments", "seaWaterQualityStations", "speedCamera", "sportsCenter", "sportsPark", "sportsPrivate",
  "sportsPublicOther", "sportsSchool", "theftTaoyuan", "tourAttractions", "tourHeritage", "triangulationPoints",
  "waterCanals", "waterEffluentLive", "waterFacilities", "waterMonitorStations", "waterProtectionZones",
  "waterRecreationRestrictedAreas", "waterReservoirs", "wraDredgingPoints",
];

function ratchet(current: readonly string[], baseline: readonly string[]) {
  const base = new Set(baseline);
  const now = new Set(current);
  return {
    added: current.filter((k) => !base.has(k)),
    fixed: baseline.filter((k) => !now.has(k)),
  };
}

describe("§3.8 全國視角可見性（ratchet）", () => {
  it("V-2 縮放連續：layer minzoom 不得比圖磚 minzoom 晚超過 1 級", () => {
    const v = zoomLagViolations();
    const { added, fixed } = ratchet(v.map((x) => x.key), V2_BASELINE);
    expect(added.map((k) => {
      const x = v.find((y) => y.key === k)!;
      return `${k}：圖磚 z${x.sourceMinzoom}、圖層 z${x.firstDrawZoom}`;
    }), "新增 V-2 違規").toEqual([]);
    expect(fixed, "已修好，請從 V2_BASELINE 刪掉").toEqual([]);
  });

  it("V-4 分類圖例＝可篩選：≥2 名目類別要有類別篩選", () => {
    const v = categoryFilterViolations();
    const { added, fixed } = ratchet(v.map((x) => x.key), V4_BASELINE);
    expect(added, "新增 V-4 違規（補 multiSelect 類別篩選）").toEqual([]);
    expect(fixed, "已修好，請從 V4_BASELINE 刪掉").toEqual([]);
  });
});
