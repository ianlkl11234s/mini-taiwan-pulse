import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { applyLayerOpacity } from "../overlayManager";
import { densePointOpacity, densePointsFromZoom, HEATMAP, heatmapMaxzoom, heatmapPaint, POINT_OPACITY } from "../mapStyleScale";
import { LAYER_PARAMS_SPEC, paramDefault } from "../../data/layerParamsSpec";
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
    expect(def).toBe(densePointOpacity(211_530)); // G36：併入台水後 211,530 點
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
  // §3.8 V-1（2026-10-31）：台灣 v2 重切檔 z7 起，≥ 1 萬點的低縮放畫熱區
  ["civilDefenseShelter", 62_695, 7, "civilDefenseShelterOpacity"],
  ["eduCramSchool", 17_137, 7, "eduCramSchoolOpacity"],
  ["provincialRoadMileposts", 30_098, 7, "provincialRoadMilepostsOpacity"],
  ["freewayTrafficSigns", 51_405, 7, "freewayTrafficSignsOpacity"],
  ["placeNames", 36_431, 7, "placeNamesOpacity"],
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
  ["jpEvacuationSites", "useJpEvacuationSitesLayer.ts", 199_346],
  ["jpPublicOffices", "useJpPublicOfficesLayer.ts", 79_532],
  ["jpBusStops", "useJpBusStopsLayer.ts", 278_515],
  ["jpWelfareDisability", "useJpWelfareFacilitiesLayer.ts", 75_945],
  ["jpWelfareChild", "useJpWelfareFacilitiesLayer.ts", 78_627],
  ["fireEvents", "useFireEventsLayer.ts", 15_398],
  ["fireLatest", "useFireLatestLayer.ts", 15_398],
  // 英國（2026-10-30，全英 z5.5–6 目視校正）；熱區由 useGbWaterLayers 的 gbHeatmapBuild 建
  ["gbSchools", "useGbCivicLayers.ts", 30_658],
  ["gbHealthFacilities", "useGbCivicLayers.ts", 21_297], // 熱區只算 GP＋藥局 19,882 點，醫院維持畫點
  ["gbCareHomes", "useGbCivicLayers.ts", 15_758],
  ["gbCareServices", "useGbCivicLayers.ts", 17_237],
  ["gbBrownfield", "useGbEnvPlanningLayers.ts", 30_303],
  ["gbRecyclingCentres", "useGbEnvPlanningLayers.ts", 12_959], // 熱區只算回收桶 11,412 點，回收中心維持畫點
  ["gbLandslide", "useGbHazardLayers.ts", 18_699],
  // 綠地三層：細節是面（z9／z10 起）或代表點（§3.8 V-5 點／面切換），熱區用 representative_point 檔；
  // 熱區由 useGbWaterLayers 的共用 useGbRepPointLayers 建（2026-10-31）；運動場地不含高爾夫球場（獨立圖層 gbGolfCourses，< 1 萬點不畫熱區）
  ["gbGreenspace", "useGbWaterLayers.ts", 80_918],
  ["gbSportsFacilities", "useGbWaterLayers.ts", 51_872],
  ["gbCemeteries", "useGbWaterLayers.ts", 30_208],
  // 南韓（2026-10-31 V-1 全國視角可見性）：橋梁／停車場 z10 起畫點（使用者拍板）；其餘為使用者點名 <1 萬或既有 minzoom 較高者
  ["krBusStops", "useKrTransportLayers.ts", 227_059],
  ["krFuelStations", "useKrEnergyLayers.ts", 7_106],
  ["krPublicBicycleStations", "useKrDataLayers.ts", 4_236],
  ["krCoastalErosionFacilities", "useKrDataLayers.ts", 1_982],
  ["krBridges", "useKrDataLayers.ts", 35_575],
  ["krParkingLots", "useKrDataLayers.ts", 17_699],
  ["krSpeedCameras", "useKrDataLayers.ts", 43_743],
  ["krChildProtectionZones", "useKrDataLayers.ts", 14_639],
  ["krStreetTrees", "useKrDataLayers.ts", 1_043_931], // 低縮放熱區用 kr_street_trees_density 格網（weight＝count），z13 起單棵
];
const HOOK_DETAIL_IS_POLYGON = new Set(["gbGreenspace", "gbSportsFacilities", "gbCemeteries"]);
/** 乘數型透明度滑桿（預設 1，點的 alpha 寫在 paint）：火災兩層。 */
const HOOK_MULTIPLIER_OPACITY = new Set(["fireEvents", "fireLatest"]);

describe("R5 hook 密集點全面套用", () => {
  it.each(HOOK_DENSE)("%s：hook 有熱區（%s）且透明度預設依點數", (id, file, count) => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../hooks", file), "utf8");
    expect(src).toMatch(/type: "heatmap"|heatmapLayer\(|gbHeatmapBuild\(/);
    expect(src).toContain("heatmapMaxzoom(");
    // 綠地三層的細節層是面（出現縮放＝面的 minzoom，z9／z10），熱區 maxzoom 直接接面，不經 densePointsFromZoom
    if (!HOOK_DETAIL_IS_POLYGON.has(id)) expect(src).toContain("densePointsFromZoom(");
    const def = Number(paramDefault(id, `${id}Opacity`));
    expect(def).toBe(HOOK_MULTIPLIER_OPACITY.has(id) ? 1 : densePointOpacity(count));
  });
});

// P-4 豁免（hook）：≥1 萬點但刻意不畫熱區，附理由。
describe("R5 hook 熱區豁免", () => {
  it("gbRenewables 不套熱區：容量 150 kW–GW 級差距大，熱區只反映案件數會誤導；改 z5 起直接畫點、半徑依裝置容量（2026-10-30 使用者決定）", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../hooks/useGbEnergyLayers.ts"), "utf8");
    const block = src.slice(src.indexOf("function renewablesPaint"), src.indexOf("// ─────────────────────────── 電網"));
    expect(block).not.toMatch(/heatmap/i);
    expect(block).toContain("gbCapacityRadiusExpr(");
    expect(block).toMatch(/"source-layer": "gb_renewables", minzoom: 5,/);
    expect(paramsSpecHasHeatmap("gbRenewables")).toBe(false);
  });
});

describe("R5 南韓熱區出點縮放", () => {
  it("橋梁、停車場：熱區在 z<10、z10 起畫點（使用者 2026-10-31 拍板）", () => {
    expect(densePointsFromZoom(35_575, 0)).toBe(10);
    expect(densePointsFromZoom(17_699, 0)).toBe(10);
  });
  it("krRenewables 不套熱區：太陽能陣列 90% 但容量差距大，熱區只反映案件數；改 z4 起畫大型點、z8 起補太陽能", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../hooks/useKrEnergyLayers.ts"), "utf8");
    const block = src.slice(src.indexOf("export function useKrRenewablesLayer"), src.indexOf("// ─────────────────────────── 電網"));
    expect(block).not.toMatch(/heatmap/i);
    expect(paramsSpecHasHeatmap("krRenewables")).toBe(false);
  });
});

function paramsSpecHasHeatmap(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(LAYER_PARAMS_SPEC, key)
    && (LAYER_PARAMS_SPEC as Record<string, { kind: string; role?: string }[]>)[key]!.some((s) => s.kind === "palette" && s.role === "heatmap");
}

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
