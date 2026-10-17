import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { applyLayerOpacity } from "../overlayManager";
import { densePointOpacity, densePointsFromZoom, HEATMAP, heatmapMaxzoom, heatmapPaint, POINT_OPACITY } from "../mapStyleScale";
import { paramDefault } from "../../data/layerParamsSpec";
import { paletteRamp } from "../palettes";

const MAGMA_DARK = paletteRamp("magma", true)!;

describe("R5 密集點熱區（P-3／P-4／G-2）", () => {
  it("出點縮放依點數，且不讓點比原本更早出現", () => {
    expect(densePointsFromZoom(5_000, 0)).toBe(0);
    expect(densePointsFromZoom(69_839)).toBe(HEATMAP.pointsFromZoomOver10k);
    expect(densePointsFromZoom(69_839, 12)).toBe(12);
    expect(densePointsFromZoom(167_037)).toBe(HEATMAP.pointsFromZoomOver100k);
  });

  it("熱區 paint：密度 0 透明、透明度隨滑桿比例且上限 1", () => {
    const paint = heatmapPaint(1, 1, 1, MAGMA_DARK);
    const color = paint["heatmap-color"] as unknown[];
    expect(color[3]).toBe(0);
    expect(String(color[4])).toMatch(/,0\.00\)$/);
    expect(paint["heatmap-opacity"]).toBe(HEATMAP.opacity);
    expect(heatmapPaint(0.5, 1, 1, MAGMA_DARK)["heatmap-opacity"]).toBeCloseTo(0.4);
    expect(heatmapPaint(2, 1, 1, MAGMA_DARK)["heatmap-opacity"]).toBe(1);
  });

  it("fireHydrants：熱區 z<12、點 z≥12，熱區透明度跟著透明度滑桿", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "fireHydrants")!;
    const heat = config.layers.find((l) => l.type === "heatmap")!;
    expect(heat.maxzoom).toBeCloseTo(12.01);
    for (const l of config.layers.filter((l) => l.type === "circle")) expect(l.minzoom).toBe(12);
    const def = Number(paramDefault("fireHydrants", "fireHydrantsOpacity"));
    expect(def).toBe(densePointOpacity(69_839));
    expect(heat.paint(true, { fireHydrantsOpacity: def })["heatmap-opacity"]).toBeCloseTo(HEATMAP.opacity);
    expect(heat.paint(true, { fireHydrantsOpacity: def / 2 })["heatmap-opacity"]).toBeCloseTo(HEATMAP.opacity / 2);
  });
});

// ── R5 全面套用（2026-10-02）──────────────────────────────────────
// [layer id, 全資料集點數, 原本點的 minzoom, 透明度滑桿（null＝opacityParam 乘數型，預設 1）]
const REGISTRY_DENSE: readonly (readonly [string, number, number, string | null])[] = [
  ["pollutionPenaltyGeneral", 248_556, 5, "pollutionPenaltyOpacity"],
  ["streetTreesNational", 210_436, 0, "streetTreesNationalOpacity"],
  ["manufacturingCompanyPoints", 184_944, 0, "manufacturingCompanyPointsOpacity"],
  ["pollutionFacility", 152_246, 0, "pollutionFacilityOpacity"],
  ["pollutionPenaltyMobile", 111_067, 5, "pollutionPenaltyOpacity"],
  ["streetTreesTaipei3epoch", 105_675, 0, "streetTreesTaipei3epochOpacity"],
  ["streetTreesTaipeiDiff", 99_527, 0, "streetTreesTaipeiDiffOpacity"],
  ["factoryLocations", 90_652, 0, "factoryLocationsOpacity"],
  ["regulatedFacilities", 80_732, 0, "regulatedFacilitiesOpacity"],
  ["wasteStopsStatic", 73_060, 6, null],
  ["pollutionPenaltyCritical", 55_281, 5, "pollutionPenaltyOpacity"],
  ["busStationsCity", 49_989, 0, null],
  ["agriRetail", 37_430, 8, "agriRetailOpacity"],
  ["medLTC", 31_330, 0, "medLTCOpacity"],
  ["noiseEnforcementEvents", 29_661, 5, "noiseEnforcementEventsOpacity"],
  ["osmPowerTowers", 26_589, 8, "osmPowerTowersOpacity"],
  ["medClinic", 23_704, 0, "medClinicOpacity"],
  ["accidentTaipei", 22_918, 10, "accidentTaipeiOpacity"],
  ["agriProduceWholesale", 22_843, 8, "agriProduceWholesaleOpacity"],
  ["accessibleParkFacilities", 20_870, 0, "accessibleParkFacilitiesOpacity"],
  ["religionTemples", 19_201, 0, "religionTemplesOpacity"],
  ["tourHotels", 15_654, 0, "tourHotelsOpacity"],
  ["medAED", 15_490, 0, "medAEDOpacity"],
  ["busStationsIntercity", 15_383, 0, null],
  ["publicToilets", 13_281, 11, "publicToiletsOpacity"],
  ["convenienceStores", 13_223, 0, null],
  ["sportsSchool", 12_221, 7, "sportsSchoolOpacity"],
  ["bicycleSupport", 11_989, 0, "bicycleSupportOpacity"],
  ["commonRegistrationAddresses", 11_121, 6, "commonRegistrationAddressesOpacity"],
  ["riversideTreesTaipei", 10_917, 0, "riversideTreesTaipeiOpacity"],
];

/** 共用滑桿：一般／移動／重大裁處同一支 pollutionPenaltyOpacity，取多數層（> 100k）的 0.6。 */
const SHARED_OPACITY_COUNT: Record<string, number> = { pollutionPenaltyOpacity: 248_556 };

describe("R5 registry 密集點全面套用", () => {
  it.each(REGISTRY_DENSE)("%s：熱區在出點縮放以下、點在以上", (id, count, existing) => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === id)!;
    const from = densePointsFromZoom(count, existing);
    expect(from).toBe(Math.max(count > 100_000 ? 12 : 10, existing));
    const heats = config.layers.filter((l) => l.type === "heatmap");
    expect(heats).toHaveLength(1);
    expect(heats[0]!.maxzoom).toBe(heatmapMaxzoom(from));
    expect(heats[0]!.minzoom).toBeUndefined();
    const circles = config.layers.filter((l) => l.type === "circle");
    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) expect(c.minzoom).toBe(from);
    // 熱區畫在點下面
    expect(config.layers.indexOf(heats[0]!)).toBeLessThan(config.layers.indexOf(circles[0]!));
  });

  it.each(REGISTRY_DENSE)("%s：熱區 filter 與點一致；函式 filter 會隨參數重建", (id) => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === id)!;
    const heat = config.layers.find((l) => l.type === "heatmap")!;
    const circles = config.layers.filter((l) => l.type === "circle");
    const point = circles[circles.length - 1]!;
    const resolve = (f: typeof heat.filter, p: Record<string, number>) => (typeof f === "function" ? f(p) : f) ?? config.filter ?? null;
    const samples: Record<string, number>[] = [{}, { publicToiletsTypeMask: 1, tourHotelsClassMask: 1, religionTemplesRegistryIdx: 1, religionTemplesDeityMask: 1, accessibleParkFacilitiesTypeMask: 1, bicycleSupportServiceMask: 1, commonRegistrationAddressesMinCompanies: 20 }];
    for (const p of samples) {
      expect(JSON.stringify(resolve(heat.filter, p))).toBe(JSON.stringify(resolve(point.filter, p)));
    }
    if (typeof point.filter === "function") expect(config.rebuildOnParamChange).toContain(heat.suffix);
  });

  it.each(REGISTRY_DENSE)("%s：透明度預設依點數（P-3），熱區透明度＝0.8 ×（滑桿 ÷ 預設）", (id, count, _existing, param) => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === id)!;
    const heat = config.layers.find((l) => l.type === "heatmap")!;
    const opParam = param ?? config.opacityParam!;
    const def = Number(paramDefault(id, opParam));
    expect(def).toBe(param ? densePointOpacity(SHARED_OPACITY_COUNT[param] ?? count) : 1);
    const at = (v: number) => applyLayerOpacity(config, heat.paint(true, { [opParam]: v }), { [opParam]: v })["heatmap-opacity"];
    expect(at(def)).toBeCloseTo(HEATMAP.opacity);
    expect(at(def / 2)).toBeCloseTo(HEATMAP.opacity / 2);
  });

  it("opacity 歸零式篩選 → 熱區 weight 用同條件（行道樹三層）", () => {
    const weight = (id: string, p: Record<string, number>) =>
      JSON.stringify(OVERLAY_REGISTRY.find((c) => c.id === id)!.layers.find((l) => l.type === "heatmap")!.paint(true, p)["heatmap-weight"]);
    expect(weight("streetTreesTaipeiDiff", {})).toBe("1");
    expect(weight("streetTreesTaipeiDiff", { streetTreesTaipeiDiffStatusIdx: 1 })).toContain("disappeared");
    expect(weight("streetTreesTaipei3epoch", { streetTreesTaipei3epochTrajFilterIdx: 1 })).toContain("traj");
    expect(weight("streetTreesNational", { streetTreesNationalCityMask: 1 })).toContain("city");
    expect(weight("riversideTreesTaipei", { riversideTreesTaipeiParkMask: 1 })).toContain("park_name");
  });

  it("civilDefenseShelter 不套熱區：PMTiles minzoom 10，z<10 沒有 tile 可畫", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "civilDefenseShelter")!;
    expect(config.pmtiles?.minzoom).toBe(10);
    expect(config.layers.some((l) => l.type === "heatmap")).toBe(false);
  });

  it("eduCramSchool 不套熱區：切片 minzoom 8 且低縮放大量抽稀，點維持 z8 起畫", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "eduCramSchool")!;
    expect(config.pmtiles?.minzoom).toBe(8);
    expect(config.layers.some((l) => l.type === "heatmap")).toBe(false);
    for (const l of config.layers.filter((l) => l.type === "circle")) expect(l.minzoom).toBeUndefined();
    expect(Number(paramDefault("eduCramSchool", "eduCramSchoolOpacity"))).toBe(densePointOpacity(17_137));
  });
});

// hook 自畫的密集點：各 hook 自己的單元測試驗 layer 細節；這裡用原始碼掃描守住接線不被拿掉。
const HOOK_DENSE: readonly (readonly [string, string, number])[] = [
  ["jpWaterAgriculturalPonds", "useJpWaterLayers.ts", 161_778],
  ["jpReligionOsm", "useJpReligionLayers.ts", 71_040],
  ["jpReligionWikidata", "useJpReligionLayers.ts", 37_154],
  ["jpSchools", "useJpSchoolsLayer.ts", 56_807],
  ["bssNationalBridgePointsPreview", "useBssBridgeLayers.ts", 49_960],
  ["jpAccommodationCanonical", "useJpTourismLayers.ts", 25_459],
  ["jpAccommodationOsm", "useJpTourismLayers.ts", 20_502],
  ["worldTrashDebris", "useWorldTrashDebrisLayer.ts", 25_000],
  ["jpPoliceFacilities", "useJpPoliceFacilitiesLayer.ts", 13_195],
  ["fireEvents", "useFireEventsLayer.ts", 15_398],
  ["fireLatest", "useFireLatestLayer.ts", 15_398],
];
/** 乘數型透明度滑桿（預設 1，點的 alpha 寫在 paint）：火災兩層。 */
const HOOK_MULTIPLIER_OPACITY = new Set(["fireEvents", "fireLatest"]);

describe("R5 hook 密集點全面套用", () => {
  it.each(HOOK_DENSE)("%s：hook 有熱區（%s）且透明度預設依點數", (id, file, count) => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../hooks", file), "utf8");
    expect(src).toMatch(/type: "heatmap"|heatmapLayer\(/);
    expect(src).toContain("heatmapMaxzoom(");
    expect(src).toContain("densePointsFromZoom(");
    const def = Number(paramDefault(id, `${id}Opacity`));
    expect(def).toBe(HOOK_MULTIPLIER_OPACITY.has(id) ? 1 : densePointOpacity(count));
  });
});

// P-3：1k–10k 點的透明度滑桿預設 0.8（2026-10-02 量測清單）。
const OVER_1K_OPACITY: readonly (readonly [string, string])[] = [
  ["jpWaterSupplyFacilities", "jpWaterSupplyFacilitiesOpacity"], ["jpWaterQualityStations", "jpWaterQualityStationsOpacity"],
  ["jpStations", "jpStationsOpacity"], ["pollutionSite", "pollutionSiteOpacity"], ["anfrWirelessSites", "anfrWirelessSitesOpacity"],
  ["canopyGiants", "canopyGiantsOpacity"], ["medPharmacy", "medPharmacyOpacity"], ["jpMedicalHospitals", "jpMedicalHospitalsOpacity"],
  ["wdClothes", "wdClothesOpacity"], ["animalWelfarePoints", "animalWelfarePointsOpacity"], ["protectedTreesNational", "protectedTreesNationalOpacity"],
  ["jpCareCombined", "jpCareCombinedOpacity"], ["wdMixed", "wdMixedOpacity"], ["funeralOperators", "funeralOperatorsOpacity"],
  ["forestTreatmentWorks", "forestTreatmentWorksOpacity"], ["cctv", "cctvOpacity"], ["artsEvents", "artsEventsOpacity"],
  ["tourAttractions", "tourAttractionsOpacity"], ["disasterShelters", "disasterSheltersOpacity"], ["jpWaterSewerFacilities", "jpWaterSewerFacilitiesOpacity"],
  ["livestockFarmChicken", "livestockFarmChickenOpacity"], ["livestockFarmPig", "livestockFarmPigOpacity"], ["wfOther", "wfOtherOpacity"],
  ["bridgeComparisonNewTaipei", "bridgeComparisonNewTaipeiOpacity"], ["jpAccommodationLocal", "jpAccommodationLocalOpacity"],
  ["funeralFacilities", "funeralFacilitiesOpacity"], ["tourRestaurants", "tourRestaurantsOpacity"], ["earthquakesGlobal", "earthquakesGlobalOpacity"],
  ["changhuaTrafficSignals", "changhuaTrafficSignalsOpacity"], ["forestTrailSigns", "forestTrailSignsOpacity"], ["drinkingWaterPoints", "drinkingWaterPointsOpacity"],
  ["welfareLtcInstitutions", "welfareLtcInstitutionsOpacity"], ["parkingOnstreet", "parkingOnstreetOpacity"], ["evChargingStations", "evChargingOpacity"],
  ["gasStationCanonical", "gasStationCanonicalOpacity"], ["ripeAtlasProbes", "ripeAtlasProbesOpacity"], ["parksTaipei", "parksTaipeiOpacity"],
  ["tourHeritage", "tourHeritageOpacity"], ["jpWaterDams", "jpWaterDamsOpacity"], ["playgrounds", "playgroundsOpacity"],
  ["mountainRescueIncidents", "mountainRescueIncidentsOpacity"], ["iPostBoxes", "iPostBoxesOpacity"], ["jpAccommodationJta", "jpAccommodationJtaOpacity"],
  ["religionChurches", "religionChurchesOpacity"], ["parkingOffstreet", "parkingOffstreetOpacity"], ["policeStation", "policeStationOpacity"],
  ["speedCamera", "speedCameraOpacity"], ["gasStationCpc", "gasStationCpcOpacity"], ["communityCenters", "communityCentersOpacity"],
  ["tourCamping", "tourCampingOpacity"], ["tainanBridgeInspections", "tainanBridgeInspectionsOpacity"], ["jpMedicalMaternity", "jpMedicalMaternityOpacity"],
  ["welfareNursingHomes", "welfareNursingHomesOpacity"], ["trafficAccidentYearly", "trafficAccidentYearlyOpacity"], ["welfareChildcare", "welfareChildcareOpacity"],
  ["theftTaoyuan", "theftTaoyuanOpacity"], ["forestSignalPoints", "forestSignalPointsOpacity"], ["welfareChildServices", "welfareChildServicesOpacity"],
  ["religionOtherWorship", "religionOtherWorshipOpacity"], ["livestockFarmDuck", "livestockFarmDuckOpacity"], ["jpWaterGroundwaterSites", "jpWaterGroundwaterSitesOpacity"],
  ["postOffices", "postOfficesOpacity"], ["forestWildlife", "forestWildlifeOpacity"], ["facOsmSupplement", "facOsmSupplementOpacity"],
  ["lpgRetailers", "lpgRetailersOpacity"], ["welfareElderlyHomes", "welfareElderlyHomesOpacity"], ["sportsPublicOther", "sportsPublicOtherOpacity"],
  ["officialBridgesNewTaipei", "officialBridgesNewTaipeiOpacity"],
];

describe("P-3 1k–10k 點透明度預設", () => {
  it.each(OVER_1K_OPACITY)("%s 預設 0.8", (id, param) => {
    expect(Number(paramDefault(id, param))).toBe(POINT_OPACITY.over1k);
  });
});
