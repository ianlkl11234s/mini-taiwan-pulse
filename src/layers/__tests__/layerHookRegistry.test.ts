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
 *
 * ── ⚠️ 曾經的盲區（P4 紅燈演練發現，W3 已補）───────────────────────
 * 聯集語意下，**同時落在 registry 與 `HOOKS_IN_APP_LEDGER` 的 key 原本是不設防的**：
 * 拿掉它的 registry entry，只看聯集斷言照樣綠（App 那一桶仍宣告了掛載機制）。
 * 這種 key 有 7 個，全部是 P4 的「資料在 App、上圖在 Host」分工
 * （rail / h3Population / popCount / indicators / socioeconomic /
 *  spatialEconomy / youbikeFullness）。
 *
 * 這是聯集判準的**本質限制**：它守的是「每個 layer 至少宣告了一種掛載機制」，
 * 不是「每一種機制都還在」。下方「per-key 掛載機制對表」補了這個洞——
 * `DUAL_MOUNT_KEYS` 是手動盤點、與 registry / HOOKS_IN_APP_LEDGER 現況無關的
 * 固定清單，逐 key 檢查兩邊**宣告**都要在場，任一邊的宣告被刪就紅。
 * ⚠️ 這守的是「宣告層級」（registry entry 存在 / 還在 HOOKS_IN_APP_LEDGER 裡）——
 * 跟另外 37 個純 appHook key 一樣，若 App.tsx 裡實際的 hook call 被刪但 ledger
 * 沒跟著改，本測試看不出來（這是 static ledger 天生的限制，不是本棒要補的洞）。
 *
 * **分工邊界**：聯集斷言守「key 完全沒人接」；per-key 對表守「雙桶 key 少接一邊」。
 * 兩者互補——不要因為有了 per-key 表就把聯集斷言簡化掉，單桶 key（多數）仍然
 * 只靠聯集斷言守住；也不要指望 per-key 表能發現「單桶 key 唯一的掛載機制被拿掉」，
 * 那種情況一樣是靠聯集斷言（變成三桶都沒有）抓。
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
  // ⚠️ rail 的 2D 靜態線（updateRailTracks，吃 railTrackMode）P4 起在 RailTracksHost
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
  // H3 / 人口 / 社經 / YouBike 家族：**AR-22 P4 起是「資料在 App、上圖在 Host」的分工**
  //   App 端：loader hook（回 dataMap + loadResolution）＋ zoom 驅動的 resolution state
  //   Host 端：ensure*Layers + update*Layer（吃參數，故必須離開 App，見 gridHosts.tsx）
  // 兩邊都算數，所以這些 key 同時出現在本 ledger 與 registry —— 聯集語意下沒有衝突。
  "h3Population", "popCount", "indicators", "socioeconomic", "spatialEconomy",
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
  // ── OVERLAY_REGISTRY 的靜態 GeoJSON 層（104）──
  "accidentTaipei", "activeFaults", "agriWholesaleMarket", "antiCorruptionOffice",
  "aquacultureCageNet", "aquacultureZone", "artsEvents", "bikeStations",
  "busStationsIntercity", "canopyGiants", "cctv", "cemeteryZoning", "coastGuardStation",
  "commonRegistrationAddresses",
  "communityCenters", "convenienceStores", "correctionalFacility", "court",
  "culturalFacilities", "culturalMuseums", "cyclingRoutes", "eduAfterschoolCare",
  "eduDistrictSenior", "eduKindergarten", "eduMutualCare", "eduRemoteSchools",
  "eduSchoolElementary", "eduSchoolJunior", "eduSchoolSenior", "eduSchoolSpecial",
  "eduSchoolUniversity", "eduUniversityStudents", "etcGantry", "forestAlishanRail",
  "forestDamLakes", "forestEducationCenters", "forestFlatParks", "forestRecreation",
  "forestSignalPoints", "forestTrailSigns", "forestTreatmentWorks", "forestWildlife",
  "funeralFacilities", "funeralOperators", "govServiceOffices", "iPostBoxes",
  "immigrationOffice", "internetExchangePoints", "anfrWirelessSites", "osmCommunicationSites", "ripeAtlasProbes", "ooklaMobilePerformance", "ooklaFixedPerformance", "investigationBureau", "landingStations", "livestockFeed",
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
  // 🤝 社福長照 9 層（第 40 主題）：純 OVERLAY_REGISTRY 靜態 GeoJSON，無 loader / hook。
  // ⚠️ `welfareCenters`（上一行）是**基礎建設**主題的社福中心，不是本批成員 ——
  //    兩者零重疊（本批 welfareGovOffices 已在上游排除 T0103），只是名字像。
  "welfareChildServices", "welfareChildcare", "welfareDisability", "welfareElderlyHomes",
  "welfareGovOffices", "welfareLtcInstitutions", "welfareMentalHealth",
  "welfareNursingHomes", "welfareSocialWorkOrgs",

  // ── OVERLAY_REGISTRY 的 PMTiles 層（63）──
  "agriProduceWholesale", "agriRetail", "aquacultureIntegrated", "aquaculturePonds",
  "aquacultureWaterSatellite", "aquacultureWaterSatelliteMoa", "aquacultureWaterUnion",
  "busStationsCity", "canopyHeight", "cemeteryOsm", "civilDefenseShelter", "contour25k",
  "contourDtm20", "countyBoundary", "courtJurisdiction", "crimeAreaMonthly", "ecoNetworkZones",
  "eduCampusArea", "eduCampusPolygon", "eduCramSchool", "eduDistrictElementary",
  "eduDistrictJunior", "evIsland", "farmRoads", "fireHydrants", "forestCompartments",
  "forestReserve", "forestRoads", "gasCoverageAll", "gasCoverageCpc", "gasCoverageFpcc",
  "gasCoverageTaisugar", "highways", "hikingTrails", "lakesPondsOsm", "maritimeBoundary",
  "medAED", "medClinic",
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
//  雙桶 key：兩種機制都要，缺一不可（補上方已知盲區）
// ══════════════════════════════════════════════════════════════════
/**
 * P4「資料在 App、上圖在 Host」分工的 7 個 key —— App 端掛 loader hook
 * （回 dataMap ＋ zoom 驅動的 resolution state），Host 端掛 ensure/update
 * layer（見 `hosts/gridHosts.tsx`）。兩邊都要，缺一是「這層畫不出來」
 * （host 缺）或「resolution／可見性切換沒反應」（appHook 缺）。
 *
 * ⚠️ 這張表是**手動盤點的固定清單**，不是從 `registryKeys ∩ HOOKS_IN_APP_LEDGER`
 * 即時算出來的交集——若是即時算，registry entry 被刪掉的同時「雙桶」宣告
 * 也會跟著消失，紅燈演練就抓不到（這正是本檔曾經的盲區）。
 *
 * 盤點依據（機械核對，非憑記憶）：
 *   - registry 側：`layerHookRegistry.tsx` L260-266（railTracks / h3Population /
 *     popCount / indicators / socioeconomic / spatialEconomy / youbikeFullness
 *     七筆 entry）
 *   - App 側：`App.tsx` L218（`useRailData`）、L659（`useYoubikeH3`）、
 *     L909-942（h3Population / popCount+indicators / socioeconomic /
 *     spatialEconomy 四段 loader effect；popCount 與 indicators 共用同一個
 *     `loadDemographicsResolution`，各自仍宣告一份 appHook 需求，不是重複計數）
 */
const DUAL_MOUNT_KEYS = new Set<string>([
  "rail", "h3Population", "popCount", "indicators",
  "socioeconomic", "spatialEconomy", "youbikeFullness",
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

// ══════════════════════════════════════════════════════════════════
//  per-key 掛載機制對表（W3：補雙桶 key 盲區）
// ══════════════════════════════════════════════════════════════════
/**
 * 把「需要哪種掛載機制」從隱性的聯集邏輯，變成顯式的 per-key 表，逐 key 比對
 * 「宣告的需求」與「現況」。建表規則：
 *   1. NO_HOOK_LEDGER 的 key → 空集合（本來就不需要任何機制）
 *   2. DUAL_MOUNT_KEYS 的 key → `{host, appHook}` 都要（上方手動盤點的固定清單）
 *   3. 其餘落在 registry 的 key → 只要 `host`
 *   4. 其餘落在 HOOKS_IN_APP_LEDGER 的 key → 只要 `appHook`
 *
 * 第 3、4 類「需要哪一種」仍是從現況推導——但那不是本表要補的洞：單桶 key
 * 若唯一的機制被整個拿掉，既有的「聯集＝MANIFEST_KEYS」斷言已經抓得住
 * （變成三桶都沒有，見上方 uncovered 斷言）。本表要補的洞只有雙桶 key：
 * 它們「需要兩者」是寫死的，不會因為某一邊被刪就跟著從需求表上消失。
 */
type MountKind = "host" | "appHook";

const REQUIRED_MOUNTS = new Map<string, ReadonlySet<MountKind>>();
for (const k of NO_HOOK_LEDGER) REQUIRED_MOUNTS.set(k, new Set());
for (const k of DUAL_MOUNT_KEYS) REQUIRED_MOUNTS.set(k, new Set<MountKind>(["host", "appHook"]));
for (const k of registryKeys) {
  if (!REQUIRED_MOUNTS.has(k)) REQUIRED_MOUNTS.set(k, new Set<MountKind>(["host"]));
}
for (const k of HOOKS_IN_APP_LEDGER) {
  if (!REQUIRED_MOUNTS.has(k)) REQUIRED_MOUNTS.set(k, new Set<MountKind>(["appHook"]));
}

describe("layer hook registry：per-key 掛載機制對表（補雙桶 key 盲區）", () => {
  it("每個 manifest key 的實際掛載機制符合它在 REQUIRED_MOUNTS 的宣告", () => {
    const mismatches: string[] = [];
    for (const key of MANIFEST_KEYS) {
      const required = REQUIRED_MOUNTS.get(key) ?? new Set<MountKind>();
      const actual = new Set<MountKind>();
      if (registryKeys.has(key)) actual.add("host");
      if (HOOKS_IN_APP_LEDGER.has(key)) actual.add("appHook");
      for (const mount of required) {
        if (!actual.has(mount)) mismatches.push(`${key} → 缺 ${mount}`);
      }
    }
    expect(
      mismatches,
      `這些 key 宣告需要的掛載機制，現況少了一部分：\n  ${mismatches.join("\n  ")}\n` +
      `→ 缺 host：layerHookRegistry.tsx 裡對應的 entry 不見了，補回去；\n` +
      `→ 缺 appHook：App.tsx 的 loader effect 不見了，或忘了把它加回 HOOKS_IN_APP_LEDGER。\n` +
      `雙桶 key（DUAL_MOUNT_KEYS）兩邊都要——資料在 App、上圖在 Host，少一邊就是` +
      `「畫不出來」或「切換沒反應」，聯集斷言看不出少了哪一邊，這就是本 describe 要補的盲區。`,
    ).toEqual([]);
  });

  it("DUAL_MOUNT_KEYS 與現況雙桶交集一致（防新增的雙桶 key 沒登記）", () => {
    const actualDual = [...registryKeys].filter((k) => HOOKS_IN_APP_LEDGER.has(k)).sort();
    expect(
      actualDual,
      `registry ∩ HOOKS_IN_APP_LEDGER 現況與 DUAL_MOUNT_KEYS 清單不一致：\n` +
      `  現況交集：${actualDual.join(", ")}\n` +
      `  清單：${[...DUAL_MOUNT_KEYS].sort().join(", ")}\n` +
      `→ 新增的雙桶 key：補進 DUAL_MOUNT_KEYS 並寫盤點依據（哪個檔哪一行）；\n` +
      `→ 清單裡的 key 不再雙桶：從 DUAL_MOUNT_KEYS 移除，否則 per-key 對表會誤判它需要` +
      `一個其實已經不存在的機制。`,
    ).toEqual([...DUAL_MOUNT_KEYS].sort());
  });
});
