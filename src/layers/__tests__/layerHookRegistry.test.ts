/**
 * Layer Hook Registry 完整性閘（AR-22 P1）
 * ══════════════════════════════════════════════════════════════════
 *
 * 本檔守的失敗模式是 **「漏 call 一個 hook」**——搬進 LayerHost 之前，那件事
 * 完全沒有機械訊號：tsc 綠（沒有型別錯）、既有測試綠（沒有人斷言它被呼叫）、
 * 畫面只是「那一層點下去沒反應」，而且多半要等使用者回報才發現。
 *
 * 現在掛載清單是資料（`layerHookRegistry.tsx` 的有序陣列），可以斷言：
 *
 *   registry.keys ∪ HOOKS_IN_APP_LEDGER ∪ NO_HOOK_LEDGER  ===  MANIFEST_KEYS
 *
 * **雙向**（比照 `components/sidebar/__tests__/layerConsistency.test.ts` 的
 * `ledger()` idiom）：
 *   - manifest 有、三桶都沒有 → 新層沒接任何掛載機制，紅。
 *   - 三桶有、manifest 沒有 → 幽靈 key（打錯字／層已刪），紅。
 *
 * ── ⚠️ 交接時修正過的一條 ──────────────────────────────────────────
 * 任務書原本寫「聯集 ＝ 全部**非 orphan** key」。那條**不成立**：orphan
 * （`section: null`，沒有 sidebar toggle）**照樣有活的掛載 hook** ——
 * `powerRegionDemand` 由 `usePowerRegionBarsLayer` 掛、`powerPlants` /
 * `osmSolarFarms` / `osmPowerPlantsStatic` / `islandPowerGrid` / `facOffshore`
 * 由 `useEnergyPoiLayer` 掛，五個都在 `ORPHAN_LEDGER` 裡。把 orphan 整批排除
 * 會讓這些 key 兩邊都不落，聯集永遠對不上。
 * 改成對 **全部 348 個 MANIFEST_KEYS** 斷言，orphan 落在它真正所屬的那一桶。
 *
 * ── 第三條斷言：NO_HOOK 必須誠實 ──────────────────────────────────
 * `NO_HOOK_LEDGER` 與另外兩桶**互斥**。少了這條，把一個明明有 hook 的 key
 * 塞進 NO_HOOK 也能讓聯集通過 —— 那就退化成「湊數表」而不是事實表。
 */
import { describe, it, expect } from "vitest";

import { MANIFEST_KEYS } from "../../data/layerManifest";
import { LAYER_HOOK_REGISTRY } from "../layerHookRegistry";

// ══════════════════════════════════════════════════════════════════
//  桶 2：hook 留在 App.tsx（pattern E）
// ══════════════════════════════════════════════════════════════════
/**
 * **回傳值被 App 下游消費**，所以不能搬進只會 `return null` 的 Host ——
 * counts 餵 HUD / sidebar 徽章、refs 餵 Three.js render loop 與別的 hook。
 * 把它們橋接出去（context 或 store）是 AR-22 **第 4 階段**的事，本棒不做。
 *
 * ⚠️ 這是 **key 集合**，不是 hook 名單（聯集是對 key 做的）。hook 名寫在註解。
 */
const HOOKS_IN_APP_LEDGER = new Set<string>([
  // useAirspaceData / useShipData / useRailData：loading state 餵 LoadingScreen 的 steps
  // useThreeJsLayers：一支 hook 建 17 個 CustomLayer，scene ref 餵 useMapInteraction 的 raycast
  "flights", "ships", "rail",
  // useRailEngine → { trainCount, activeTrainsRef }：count 餵 sidebar 徽章、ref 餵 RailScene
  // 三支公車 → { busCount, activeBusesRef, loadDay }：loadDay 餵 App 的 replay 跨日訂閱 effect
  "busLive", "busIntercityLive", "touristShuttleLive",
  // useWasteLayer → { trailsRef, count, loadDay }；useWasteScheduleLayer → { routesRef }
  "wasteTruck", "wasteSchedule",
  // 光柱 / 音符：純 Three.js scene（useThreeJsLayers），資料來自 App 的 lazy fetch effect
  "lighthouses", "stationsTHSR", "stationsTRA", "stationsMetro", "airports", "ports",
  "wasteScheduleNote", "fireStations",
  // useTemperatureData → { temperatureData, loading, timeRange }：
  // 同一份資料餵 3D 溫度波（Three.js）與 2D 溫度網格（後者的圖層已進 registry）
  "temperatureWave",
  // useWasteFacilityLayer / useWasteDisposalPointLayer → { byType }：
  // 同一份資料餵 Three.js 6 個 sub-scene 與 App 的 wasteMapboxLayers sync effect
  "wfIncinerator", "wfLandfill", "wfLandfillCoastal", "wfTransfer", "wfMedical",
  "wfMonitoring", "wfRecycling", "wfScrapYard", "wfOther",
  "wdClothes", "wdMixed", "wdRecyclingContainer", "wdBattery",
  // H3 / 人口 / 社經 家族：hook 只回 dataMap + loader，實際建層在 App 的
  // ensure*Layers + update*Layer effect（吃 zoom 驅動的 resolution state）
  "h3Population", "popCount", "indicators", "socioeconomic", "spatialEconomy",
  // useYoubikeH3 → { getCellsForTime }：App 的 effect 用它 + youbikeTimeKey 更新圖層
  "youbikeFullness",
  // usePowerDashboard → { dataRef }：KPI 性質（monitor 面板），
  // 同一個 ref 也經 hostDeps 餵 LayerHost 的 usePowerRegionBarsLayer
  "powerStatusHud",
]);

// ══════════════════════════════════════════════════════════════════
//  桶 3：沒有任何 layer hook（純資料驅動）
// ══════════════════════════════════════════════════════════════════
/**
 * 這些層**不需要** hook：`OVERLAY_REGISTRY` 宣告 source + layer + paint，
 * `overlayManager` 依 visibility / overlayParams 直接驅動；PMTiles 同理。
 * 「新增這種層」＝ 加一筆 registry 設定，不寫 hook —— 所以它們不在桶 1／桶 2
 * 不是漏接，是**本來就沒有那個東西**。
 *
 * ⚠️ 這一桶最容易變成垃圾桶。第三條斷言（與另兩桶互斥）就是防這個：
 * 有 hook 的 key 塞進來會紅。
 */
const NO_HOOK_LEDGER = new Set<string>([
  // ── OVERLAY_REGISTRY 的靜態 GeoJSON 層（103）──
  "accidentTaipei", "activeFaults", "agriWholesaleMarket", "antiCorruptionOffice",
  "aquacultureCageNet", "aquacultureZone", "artsEvents", "bikeStations",
  "busStationsIntercity", "canopyGiants", "cctv", "cemeteryZoning", "coastGuardStation",
  "communityCenters", "convenienceStores", "correctionalFacility", "court",
  "culturalFacilities", "culturalMuseums", "cyclingRoutes", "eduAfterschoolCare",
  "eduDistrictSenior", "eduKindergarten", "eduMutualCare", "eduRemoteSchools",
  "eduSchoolElementary", "eduSchoolJunior", "eduSchoolSenior", "eduSchoolSpecial",
  "eduSchoolUniversity", "eduUniversityStudents", "etcGantry", "forestAlishanRail",
  "forestDamLakes", "forestEducationCenters", "forestFlatParks", "forestRecreation",
  "forestSignalPoints", "forestTrailSigns", "forestTreatmentWorks", "forestWildlife",
  "funeralFacilities", "funeralOperators", "govServiceOffices", "iPostBoxes",
  "immigrationOffice", "investigationBureau", "landingStations", "livestockFeed",
  "livestockMarket", "medHospital", "mountainHuts", "mountainRescueIncidents", "parksTaipei",
  "performingVenues", "policeStation", "postOffices", "prosecutorsOffice",
  "protectedTreesNational", "publicLibraries", "publicToilets", "religionAncestralHalls",
  "religionChurches", "religionFoundations", "religionOtherWorship", "religionTop100",
  "retailMarkets", "riversideTreesTaipei", "schools", "serviceArea", "serviceAreaPolygon",
  "speedCamera", "speedZoneSegment", "sportsCenter", "sportsPark", "sportsPrivate",
  "sportsPublicOther", "sportsSchool", "submarineCables", "taxiStand", "theftTaoyuan",
  "tourAmusementParks", "tourAttractions", "tourCamping", "tourEvents", "tourFactories",
  "tourHeritage", "tourHotSpringZones", "tourHotSprings", "tourHotels", "tourRestaurants",
  "tourScenicAreas", "trafficAccidentYearly", "wasteStopsStatic", "waterBasins",
  "waterDetentionBasins", "waterFacilities", "waterMonitorStations", "waterProtectionZones",
  "weatherStations", "welfareCenters", "windPlan", "womenChildWarning",

  // ── OVERLAY_REGISTRY 的 PMTiles 層（62）──
  "agriProduceWholesale", "agriRetail", "aquacultureIntegrated", "aquaculturePonds",
  "aquacultureWaterSatellite", "aquacultureWaterSatelliteMoa", "aquacultureWaterUnion",
  "busStationsCity", "canopyHeight", "cemeteryOsm", "civilDefenseShelter", "contour25k",
  "contourDtm20", "countyBoundary", "courtJurisdiction", "crimeAreaMonthly", "ecoNetworkZones",
  "eduCampusArea", "eduCampusPolygon", "eduCramSchool", "eduDistrictElementary",
  "eduDistrictJunior", "evIsland", "farmRoads", "fireHydrants", "forestCompartments",
  "forestReserve", "forestRoads", "gasCoverageAll", "gasCoverageCpc", "gasCoverageFpcc",
  "gasCoverageTaisugar", "highways", "hikingTrails", "lakesPondsOsm", "medAED", "medClinic",
  "medLTC", "medPharmacy", "nonUrbanZoning", "osmExpressway", "osmRoadDrive",
  "policeIsoCityDept", "policeIsoPrecinct", "policeIsoSubstation", "propertyValueGrid",
  "provincialRoads", "religionTemples", "streetTreesNational", "streetTreesTaipei3epoch",
  "streetTreesTaipeiDiff", "townshipBoundary", "treePitsTaipei", "urbanFormGrid", "urbanHeat",
  "urbanZoningNewTaipei", "urbanZoningTaipei", "villageBoundary", "waterCanals",
  "waterFloodExtreme", "waterLevees", "waterRivers",

  // ── 自家 layer factory（等時圈 / 農業）：MapView 掛 factory，不經 hook（10）──
  "agriCropSuitability", "agriLeisureFarmZones", "agriPOI", "agriRuralRegen", "agriSoil",
  "agriSoilFertility", "agriculture", "fireIsochrone", "medDesert", "medIsochrone",

  // ── 尚無渲染實作 / 無程式碼引用（3；三者皆在 layerConsistency 的 ORPHAN_LEDGER）──
  // medICUBeds：Phase 3 未實作渲染，幽靈 toggle 已自 sidebar 移除
  // wasteRoute / wasteStop：除了 types 與 manifest，src/ 內零引用（保留 key 供 internal use）
  "medICUBeds", "wasteRoute", "wasteStop",
]);

// ══════════════════════════════════════════════════════════════════

const registryKeys = new Set<string>();
for (const entry of LAYER_HOOK_REGISTRY) {
  for (const k of entry.keys) registryKeys.add(k);
}
const manifestKeys = new Set<string>(MANIFEST_KEYS);

describe("layer hook registry：結構", () => {
  it("id 不重複（也是 window.__layerRenderCounts 的 key）", () => {
    const seen = new Set<string>();
    const dup = LAYER_HOOK_REGISTRY.map((e) => e.id).filter((id) => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    expect(
      dup,
      `registry 有重複 id：${dup.join(", ")}\n` +
      `→ 同一支 hook 呼叫多次請加後綴（例：useLightningLayer:tpc / :cwa）。` +
      `id 重複會讓 React 的 key 撞號，也會讓 render 計數合併成一筆。`,
    ).toEqual([]);
  });

  it("每個 entry 的 keys 都是 manifest key", () => {
    const phantom = LAYER_HOOK_REGISTRY
      .flatMap((e) => e.keys.map((k) => [e.id, k as string] as const))
      .filter(([, k]) => !manifestKeys.has(k))
      .map(([id, k]) => `${id} → ${k}`);
    expect(phantom, `registry 宣告了 manifest 查無的 key：\n  ${phantom.join("\n  ")}`).toEqual([]);
  });
});

describe("layer hook registry：掛載完整性（三桶雙向凍結）", () => {
  it("registry ∪ HOOKS_IN_APP ∪ NO_HOOK ＝ MANIFEST_KEYS", () => {
    const covered = new Set<string>([
      ...registryKeys, ...HOOKS_IN_APP_LEDGER, ...NO_HOOK_LEDGER,
    ]);

    const uncovered = MANIFEST_KEYS.filter((k) => !covered.has(k)).sort();
    expect(
      uncovered,
      `這些 layer 在 manifest 有 entry，但三桶都沒有：${uncovered.join(", ")}\n` +
      `→ 它現在**不會被掛起來**（畫面少一層，不報錯）。三選一：\n` +
      `   (a) 有 hook 要掛 → 寫一個 Host 並加進 layerHookRegistry（順序照 App 掛載語意）；\n` +
      `   (b) hook 留在 App.tsx（回傳值被下游消費）→ 加進 HOOKS_IN_APP_LEDGER 並寫理由；\n` +
      `   (c) 純 OVERLAY_REGISTRY / PMTiles 驅動、本來就沒有 hook → 加進 NO_HOOK_LEDGER。`,
    ).toEqual([]);

    const phantom = [...covered].filter((k) => !manifestKeys.has(k)).sort();
    expect(
      phantom,
      `這些 key 在三桶裡但 manifest 查無：${phantom.join(", ")}\n` +
      `→ 打錯字，或該層已刪但 ledger 沒跟著清（ratchet 只進不退）。`,
    ).toEqual([]);
  });

  it("NO_HOOK_LEDGER 與另外兩桶互斥（不准當垃圾桶）", () => {
    const hasHook = new Set<string>([...registryKeys, ...HOOKS_IN_APP_LEDGER]);
    const lying = [...NO_HOOK_LEDGER].filter((k) => hasHook.has(k)).sort();
    expect(
      lying,
      `這些 key 明明有 hook（registry 或 App）卻登記成「沒有 hook」：${lying.join(", ")}\n` +
      `→ 從 NO_HOOK_LEDGER 移除。少了這條斷言，把任何 key 塞進 NO_HOOK 都能讓` +
      `聯集通過，這張表就從事實表退化成湊數表。`,
    ).toEqual([]);
  });
});
