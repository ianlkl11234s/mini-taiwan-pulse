/**
 * Layer 一致性 ratchet 測試（方案 A Phase 1 — guardrail 先行）
 *
 * 背景：新增 layer 要碰 ~13 個檔案接觸點，歷史上常漏接（圖層 UX 四鐵則：
 * 透明度 slider / 圖例 / popup / dropdown）。在 descriptor config-driven
 * 架構落地前，先用本測試把「目前已知缺口」凍結成 baseline：
 *
 *   - 新 layer 漏接線（不在 baseline）→ 測試 fail，提示去補接線
 *   - 接好線的 layer 還留在 baseline → 測試 fail，提示從 baseline 移除
 *
 * 兩個方向都會 fail = ratchet 只進不退。檢查方式是掃描原始碼文字
 * （case "key" / visibility.key），是 heuristic — 若未來改寫 useTransportParams
 * 或 LegendPanel 的結構，請同步更新比對邏輯。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LAYER_COLORS, SECTIONS } from "../layerCatalog";
import { LEGEND_REGISTRY } from "../../LegendPanel";

const allKeys = Object.keys(LAYER_COLORS);
const sidebarKeys = new Set<string>(SECTIONS.flatMap((s) => s.layers.map((l) => l.key)));

const paramsSource = readFileSync("src/hooks/useTransportParams.ts", "utf8");
const legendCoveredKeys = new Set<string>(LEGEND_REGISTRY.flatMap((e) => e.keys));

/**
 * 已知「沒有 sidebar toggle」的 layer：
 * - wasteRoute/wasteStop 由 wasteTruck 子 UI 控制
 * - medICUBeds Phase 3 尚未實作渲染，幽靈 toggle 已自 sidebar 移除（2026-06-10）
 */
const BASELINE_NOT_IN_SIDEBAR = new Set([
  "wasteRoute", "wasteStop", "medICUBeds",
  // Energy MVP：KPI 性質，預定整合到 monitor 面板（LayerVisibility key 保留）
  "powerStatusHud", "powerRegionDemand",
  // Phase 8 SSOT 整理後從 sidebar 移除（key 保留供 internal use）：
  // - powerPlants legacy → 已被 facPrimary 等 6 layer 取代
  // - osmSolarFarms / osmPowerPlantsStatic → 跟 SSOT facilities 重疊
  // - offshoreWindZones → SSOT facOffshore 取代
  // - islandPowerGrid → SSOT facPrimary 內 is_island 已涵蓋
  "powerPlants", "osmSolarFarms", "osmPowerPlantsStatic",
  "islandPowerGrid",
  // SSOT facOffshore (8 polygon) 被換成 OSM offshoreWindZones (36 polygon) 後從 sidebar 移除
  "facOffshore",
]);

/**
 * 已知「沒有透明度/參數 slider」的 layer：
 * - wasteScheduleNote：Three.js ShaderMaterial 音符特效，opacity 需動 shader uniform，
 *   屬裝飾性圖層 → 有意識地不做（2026-06-10 決定）
 * - medICUBeds：尚無渲染實作
 * - wasteRoute/wasteStop：由 wasteTruck 子 UI 控制
 */
const BASELINE_NO_PARAMS = new Set([
  "medICUBeds",
  "wasteScheduleNote",
  "wasteRoute",
  "wasteStop",
  "wasteCleaningSquads",  // 單色綠 POI，無 size/opacity slider（透過 isDark 自動配色）
  // powerStatusHud + powerRegionDemand：搬 monitor 面板，不在 sidebar
  // 由 BASELINE_NOT_IN_SIDEBAR 接管；參數 slider 不適用
  "powerStatusHud",
  "powerRegionDemand",
]);

/**
 * 已知「LegendPanel 沒有對應圖例」的 layer。
 * 注意：單色 POI / 純線圖層可以合法沒有圖例（鐵則 2 只要求分類 ≥ 2 種的）。
 * 新 layer 若確定不需要圖例 → 加進這份清單（有意識的決定）；
 * 若有多色分類 → 去 LegendPanel.tsx 補 sub-component。
 */
const BASELINE_NO_LEGEND = new Set([
  // flights / ships / rail 已於 EM-16 接 LEGEND_REGISTRY（ShipsLegend 6 類船種 /
  // FlightsLegend 單條航跡 / RailLegend 台鐵車種分色）→ 移出 baseline，
  // 不再視為「合法無圖例」。
  "stationsTHSR", "stationsTRA", "stationsMetro",
  "ports", "lighthouses", "airports", "highways", "provincialRoads",
  "etcGantry", "serviceArea", "serviceAreaPolygon", "taxiStand", "windPlan",
  "busStationsCity", "busStationsIntercity", "bikeStations", "cyclingRoutes",
  "weatherStations",
  // h3Population：同屬預烤 properties.color 的連續色階（h3LayerFactory 的 DAY/NIGHT
  // 兩套色階），但「現在顯示哪一套」存在 transportParams.h3Params、沒進 overlayParams，
  // 圖例拿不到 → 硬畫會有一半機率跟地圖對不上。待把 metric 併進 overlayParams 再補。
  "h3Population",
  // 2026-08-08：schools 併入教育主題（第 38），已接 SchoolLevelLegend（學制 5 色）→ 移出 baseline
  "convenienceStores",
  // 公共設施：郵局 / i郵箱 / 活動中心 皆單色 POI（鐵則 2 不適用）；govServiceOffices 3 類分色 → 接 GovServiceOfficeLegend
  "postOffices", "iPostBoxes", "communityCenters",
  // 公共設施 Batch 2：圖書館 / 社福 / 市場 皆單色 POI（鐵則 2 不適用）；publicToilets grade 4 級分色 → 接 PublicToiletLegend
  "publicLibraries", "welfareCenters", "retailMarkets",
  "activeFaults", "youbikeFullness", "cwaCloudImagery",
  // aqiMicroSensors 已升級三模式上色（PM2.5/溫度/濕度）→ 接 MicroSensorLegend，不再列 baseline。
  // aqiImagery / aqiStations 曾因「AqiLegend 手掛在 App.tsx、繞過 LEGEND_REGISTRY」被
  // 誤記為合法無圖例；2026-08-10 收編進 registry 後移出 baseline。
  // cwaCloudImagery / cwaRadarImagery：CWA 上游直接給已上色的雲圖／雷達 PNG，
  // 前端只是 raster image source，沒有自己的色階可派生 → 鐵則 2 不適用。
  "cwaRadarImagery",
  "busLive", "busIntercityLive", "waterBasins", "waterRivers", "waterLevees",
  // 水庫（單色青面）／滯洪池（單色 #0284c7 點）：paint 無 match/step 分類 → 鐵則 2 不適用。
  // 同組的 waterProtectionZones / waterFacilities / waterMonitorStations / waterFloodExtreme
  // 皆為屬性驅動多色，已接 LEGEND_REGISTRY。
  "waterReservoirs", "waterDetentionBasins",
  // groundwaterWells（靜態井位 backdrop，單色灰點）／precipRaster（IoW 上游已把色階燒進
  // PNG 的 image source，前端沒有自己的色票可派生）→ 鐵則 2 不適用。
  // 同組的 rainGauge / riverLevel / groundwater / taipeiSewer / taipeiPumb / taipeiEvacuate
  // 皆為 step / interpolate / match 上色，已接 LEGEND_REGISTRY。
  "groundwaterWells", "precipRaster",
  "medICUBeds", "agriculture", "agriSoil", "agriLeisureFarmZones",
  "agriRuralRegen", "farmRoads", "wasteTruck", "wasteSchedule",
  "wasteScheduleNote", "wasteStopsStatic", "wasteCleaningSquads", "wasteRoute", "wasteStop",
  "wfIncinerator", "wfLandfill", "wfLandfillCoastal", "wfTransfer", "wfMedical", "wfMonitoring",
  "wfRecycling", "wfScrapYard", "wfOther", "wdClothes", "wdMixed",
  "wdRecyclingContainer", "wdBattery",
  // Bloom 實驗層：單色光暈疊在既有 layer 上（發電廠/變電所/電線/航空管制），無分類 → 鐵則 2 不適用
  "powerPlantGlow", "substationEhvGlow", "powerLinesGlow", "aviationRestrictedGlow",
  // Energy MVP：充電站單色 POI — 鐵則 2 只要求分類 ≥ 2 才需圖例
  // osmSubstations 已升級 migration 235 電網層級分色 → 已從 baseline 移除（接 SubstationLegend）
  "evChargingStations",
  // Base map：行政邊界 3 層皆單色灰 + 等高線 2 層皆單色棕（無分類）→ 鐵則 2 不適用
  // osmRoadDrive 才有 highway 分級 6 色 → 必接 legend（見 OsmRoadDriveLegend）
  // osmExpressway 單色橘線（與 osmRoadDrive motorway 同色但無分級） → 不需 legend
  // hillshade 單色灰 raster（無分類） → 不需 legend
  "countyBoundary", "townshipBoundary", "villageBoundary",
  "contour25k", "contourDtm20",
  "osmExpressway", "hillshade",
  // 🧳 觀光 Tourism：單色 POI / 單色面層（分類 < 2）→ 鐵則 2 不適用。
  // 有分類/雙模式圖例的 4 層（tourAttractions 五類+熱度 / tourHotels 四類 /
  // tourHeritage 三類 / tourEvents 二色）已接 LEGEND_REGISTRY，不列入 baseline。
  // 2026-08-02：tourReligion 更名為 religionTop100 搬入宗教群，且宗教群 6 層共用
  // ReligionLegend（已接 LEGEND_REGISTRY），故不再列入本 baseline。
  "tourHotSprings", "tourHotSpringZones", "tourScenicAreas",
  "tourFactories", "tourAmusementParks", "tourCamping", "tourRestaurants",
]);

function hasParamsCase(key: string): boolean {
  return paramsSource.includes(`case "${key}"`);
}

function hasLegendRef(key: string): boolean {
  return legendCoveredKeys.has(key);
}

function ratchet(
  label: string,
  keys: string[],
  isWired: (key: string) => boolean,
  baseline: Set<string>,
  howToFix: string,
) {
  const missingNotInBaseline = keys.filter((k) => !isWired(k) && !baseline.has(k));
  const wiredButInBaseline = keys.filter((k) => isWired(k) && baseline.has(k));

  expect(
    missingNotInBaseline,
    `新 layer 漏接 ${label}：${missingNotInBaseline.join(", ")}\n→ ${howToFix}\n` +
    `（若確定該 layer 不需要，把 key 加進本測試的 baseline — 這必須是有意識的決定）`,
  ).toEqual([]);

  expect(
    wiredButInBaseline,
    `這些 layer 已接好 ${label}，請從本測試的 baseline 移除（ratchet 只進不退）：` +
    wiredButInBaseline.join(", "),
  ).toEqual([]);
}

describe("layer 一致性 ratchet", () => {
  it("每個 layer key 都有 sidebar toggle（或在 baseline）", () => {
    ratchet(
      "sidebar toggle",
      allKeys,
      (k) => sidebarKeys.has(k),
      BASELINE_NOT_IN_SIDEBAR,
      "在 layerCatalog.ts 的 SECTIONS 對應分區加 { key, label }",
    );
  });

  it("sidebar 的每個 key 都存在於 LAYER_COLORS（防 typo）", () => {
    const unknown = [...sidebarKeys].filter((k) => !(k in LAYER_COLORS));
    expect(unknown).toEqual([]);
  });

  it("每個 layer 都有 useTransportParams 參數 case（或在 baseline）", () => {
    ratchet(
      "透明度/參數 slider",
      allKeys,
      hasParamsCase,
      BASELINE_NO_PARAMS,
      "在 useTransportParams.ts 的 getParamsFor 加 case + useState + deps（鐵則 1）",
    );
  });

  it("每個 layer 都有 LegendPanel 圖例（或在 baseline）", () => {
    ratchet(
      "圖例",
      allKeys,
      hasLegendRef,
      BASELINE_NO_LEGEND,
      "分類 ≥ 2 種就要在 LegendPanel.tsx 加 sub-component（鐵則 2）；單色層可加 baseline",
    );
  });
});
