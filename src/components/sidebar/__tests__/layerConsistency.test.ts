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
const BASELINE_NOT_IN_SIDEBAR = new Set(["wasteRoute", "wasteStop", "medICUBeds"]);

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
  // Energy MVP v1：6 layer 先寫死 opacity（HUD/region bars/beam 內部各自常數），
  // 第二版再接 useTransportParams sliders（見 docs/energy-mvp-status.md §3 backlog）
  "powerPlants",
  "powerStatusHud",
  "powerRegionDemand",
  "powerGenerationUnit",
  "osmSubstations",
  "evChargingStations",
]);

/**
 * 已知「LegendPanel 沒有對應圖例」的 layer。
 * 注意：單色 POI / 純線圖層可以合法沒有圖例（鐵則 2 只要求分類 ≥ 2 種的）。
 * 新 layer 若確定不需要圖例 → 加進這份清單（有意識的決定）；
 * 若有多色分類 → 去 LegendPanel.tsx 補 sub-component。
 */
const BASELINE_NO_LEGEND = new Set([
  "flights", "ships", "rail", "stationsTHSR", "stationsTRA", "stationsMetro",
  "ports", "lighthouses", "airports", "highways", "provincialRoads", "cctv",
  "etcGantry", "serviceArea", "serviceAreaPolygon", "taxiStand", "windPlan",
  "busStationsCity", "busStationsIntercity", "bikeStations", "cyclingRoutes",
  "freewayCongestion", "weatherStations", "h3Population", "popCount",
  "indicators", "socioeconomic", "spatialEconomy", "temperatureWave",
  "schools", "convenienceStores", "submarineCables", "landingStations",
  "activeFaults", "youbikeFullness", "cwaCloudImagery",
  "cwaRadarImagery", "aqiImagery", "aqiStations", "aqiMicroSensors",
  "busLive", "busIntercityLive", "waterBasins", "waterRivers", "waterLevees",
  "waterProtectionZones", "waterReservoirs", "waterFacilities",
  "waterMonitorStations", "waterFloodExtreme", "waterDetentionBasins",
  "rainGauge", "riverLevel", "groundwater", "groundwaterWells",
  "taipeiSewer", "taipeiEvacuate", "taipeiPumb", "precipRaster",
  "medICUBeds", "agriculture", "agriSoil", "agriLeisureFarmZones",
  "agriRuralRegen", "farmRoads", "wasteTruck", "wasteSchedule",
  "wasteScheduleNote", "wasteStopsStatic", "wasteRoute", "wasteStop",
  "wfIncinerator", "wfLandfill", "wfTransfer", "wfMedical", "wfMonitoring",
  "wfRecycling", "wfScrapYard", "wfOther", "wdClothes", "wdMixed",
  "wdRecyclingContainer", "wdBattery",
  // Energy MVP：單色 POI（紫變電所 / 綠充電站）— 鐵則 2 只要求分類 ≥ 2 才需圖例
  "osmSubstations", "evChargingStations",
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
