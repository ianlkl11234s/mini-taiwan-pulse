/**
 * Layer Manifest 完整性閘（AR-22 Phase 4 — 護欄永久化）
 * ══════════════════════════════════════════════════════════════════
 *
 * ⚠️ 本檔 Phase 4 前是「文字掃描 ratchet」：讀 `useLayerParamsRuntime.ts` 原始碼找
 * `case "key"` 字面、比對三份 BASELINE_* 手寫豁免集。那個形狀有三個問題 ——
 * (1) 掃描原始碼 = heuristic，`paramsCaseKeys()` 連註解都會掃到（P3-3 實際踩過，
 *     檔頭寫個字面就憑空生出幽靈 key）；
 * (2) 豁免集與 manifest 各記一份，兩邊都對得上現況卻可能互相分岔；
 * (3) 它守的是「接線接了沒」，但 348 層搬完 manifest 之後，**接線本身已由 manifest
 *     派生** —— 真正的失敗模式改成了「新層根本沒進 manifest」。
 *
 * 本檔改守 manifest 的**完整性**，三件事：
 *
 *   1. **key 空間完整**：`keyof LayerVisibility` 每一個 key 都必須有 manifest entry。
 *      這條同時封掉 `HANDWRITTEN_LAYER_COLORS` / `HANDWRITTEN_UPSTREAM` 那兩個
 *      `Omit<…, ManifestKey>` 逃生口 —— 它們現在是空物件，但型別**允許**新 key
 *      只登記在那裡而繞過 manifest，tsc 不會紅（layerCatalog 註解自己承認這是
 *      「唯一沒有機械護欄的漏法」）。
 *   2. **必要欄有真值**：tsc 擋得住「欄位不存在」（required field → TS2741），
 *      擋不住「填了空字串／空陣列／空殼血緣」。本檔逐欄體檢並**點名缺什麼**。
 *   3. **豁免必須顯式登記**：`section` / `legend` / `popup` / `params` 四個欄位可以
 *      寫 `null`，那是「有意識地沒有」。但 `null` 本身不會痛 —— 新層照抄一個 `null`
 *      就悄悄豁免掉 UX 四鐵則。四份 ledger 把現況凍結成集合，**雙向**斷言：
 *      新層宣告 null 卻沒進 ledger → 紅；接好線了卻還留在 ledger → 紅（ratchet 只進不退）。
 *
 * ── 與 `data/__tests__/layerManifest.test.ts` 的分工（不重複）──────
 *   layerManifest.test.ts  = 「manifest **宣告** vs **現況**」逐欄對帳
 *                            （section ⇔ THEMES、source ⇔ OVERLAY_REGISTRY、
 *                             legend ⇔ LEGEND_REGISTRY、popup ⇔ GIS_LAYERS、
 *                             params ⇔ 實際控件）。宣告錯 = 紅。
 *   本檔                    = 「manifest 本身完不完整、豁免是不是有意識的決定」。
 *                            不碰任何下游登記簿的值。
 *
 *   兩者合起來才擋得住「新層漏接線」：對帳擋「宣告與現況不符」，
 *   完整性擋「根本沒宣告」與「用 null 靜默豁免」。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { LAYER_COLORS } from "../layerCatalog";
import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerManifestEntry } from "../../../data/layerManifest";
import { buildDefaultVisibility } from "../../../state/layerVisibilityStore";

const entries = MANIFEST_KEYS.map(
  (k) => [k as string, LAYER_MANIFEST[k] as LayerManifestEntry] as const,
);
const manifestKeys = new Set<string>(MANIFEST_KEYS);

/**
 * `LAYER_COLORS` 的型別是 `Record<keyof LayerVisibility, string>` —— tsc 保證它
 * **涵蓋** `LayerVisibility` 的每一個 key，所以它的 runtime key 集合就是
 * 「type-only 的 `keyof LayerVisibility`」唯一可迭代的代理。
 */
const allLayerKeys = Object.keys(LAYER_COLORS);

// ══════════════════════════════════════════════════════════════════
//  豁免 ledger（四份）—— 每一筆都必須是有意識的決定，且寫得出理由
// ══════════════════════════════════════════════════════════════════

/**
 * `section: null`（orphan）—— `LayerVisibility` / `LAYER_COLORS` / `LAYER_ICONS` /
 * `UPSTREAM_REGISTRY` 有這個 key，但 **THEMES 沒有**：沒有 sidebar toggle。
 *
 * ⚠️ orphan **不等於死碼**（批 8 已查證）：多數是「從 sidebar 下架但 key 保留供
 * internal use / API gate / 子 UI 控制」。真的要刪層是另一件事，走刪除流程。
 */
const ORPHAN_LEDGER = new Set([
  // wasteRoute / wasteStop：由 wasteTruck 的子 UI 控制，不各給一個 toggle
  "wasteRoute", "wasteStop",
  // medICUBeds：Phase 3 尚未實作渲染，幽靈 toggle 已自 sidebar 移除（2026-06-10）
  "medICUBeds",
  // Energy MVP：KPI 性質，已整合到 monitor 面板（LayerVisibility key 保留）
  "powerStatusHud", "powerRegionDemand",
  // Phase 8 SSOT 整理後從 sidebar 移除（key 保留供 internal use）：
  // - powerPlants legacy → 已被 facPrimary 等 6 layer 取代
  // - osmSolarFarms / osmPowerPlantsStatic → 跟 SSOT facilities 重疊
  // - islandPowerGrid → SSOT facPrimary 內 is_island 已涵蓋
  "powerPlants", "osmSolarFarms", "osmPowerPlantsStatic", "islandPowerGrid",
  // SSOT facOffshore (8 polygon) 被換成 OSM offshoreWindZones (36 polygon) 後從 sidebar 移除
  "facOffshore",
]);

/**
 * `params: null`（鐵則 1 豁免 —— 沒有透明度/參數控件）。
 *
 * ⚠️ Phase 4 前這件事**分兩處記**：7 個在本檔的 `BASELINE_NO_PARAMS`、
 * 另外 5 個靠 `useLayerParamsRuntime.ts` 裡 `case "x": return [];` 的**字面**被
 * `paramsCaseKeys()` 正則掃出來（`emptyByDesign`）。同一件事兩種表達、其中一種
 * 還是掃原始碼文字 —— P4 收斂成 manifest 的 `params: null` 單一表達，
 * 那 5 個空 case 分支隨之刪除（`default: return []` 逐字等價）。
 */
const NO_PARAMS_LEDGER = new Set([
  // ── 原 emptyByDesign（hook 裡寫死 return []，P4 已刪分支）──
  // 純靜態展示層，沒有可調的視覺維度：
  "windPlan",          // 離岸風場規劃區：單一潛力區面，無分類無密度
  "submarineCables",   // 海底電纜：固定線位
  "landingStations",   // 電纜登陸站：固定點位
  "activeFaults",      // 活動斷層：地調所固定線位
  "aqiStations",       // 測站點位本身（數值圖層是 aqiImagery / aqiMicroSensors）
  // ── 原 BASELINE_NO_PARAMS ──
  "medICUBeds",        // 尚無渲染實作
  // wasteScheduleNote：Three.js ShaderMaterial 音符特效，opacity 要動 shader uniform，
  // 屬裝飾性圖層 → 有意識地不做（2026-06-10 決定）
  "wasteScheduleNote",
  "wasteRoute", "wasteStop",     // 由 wasteTruck 子 UI 控制
  "wasteCleaningSquads",         // 單色綠 POI，無 size/opacity slider（透過 isDark 自動配色）
  // powerStatusHud / powerRegionDemand：搬 monitor 面板，不在 sidebar（見 ORPHAN_LEDGER）
  "powerStatusHud", "powerRegionDemand",
]);

/**
 * `legend: null`（鐵則 2 豁免 —— 不需要圖例）。
 *
 * 判準（development-rules §4a 規則 2）：**只要同層內用顏色區分出 ≥ 2 種類別/級別
 * 就必須有圖例**。單色 POI / 純線層 / 上游已把色階燒進 PNG 的 raster
 * → 鐵則 2 不適用。下面每一群的理由是逐批搬移時查證過的（見
 * docs/features/layer-manifest/changelog.md 各批），不是目測。
 */
const NO_LEGEND_LEDGER = new Set([
  // 交通：車站/場站/線形皆單色（鐵道車種分色在 rail，已接 RailLegend）
  "stationsTHSR", "stationsTRA", "stationsMetro",
  "ports", "lighthouses", "airports", "highways", "provincialRoads",
  "etcGantry", "serviceArea", "serviceAreaPolygon", "taxiStand", "windPlan",
  "busStationsCity", "busStationsIntercity", "bikeStations", "cyclingRoutes",
  "weatherStations",
  // h3Population：同屬預烤 properties.color 的連續色階（h3LayerFactory 的 DAY/NIGHT
  // 兩套色階），但「現在顯示哪一套」存在 params、沒進 overlayParams，圖例拿不到
  // → 硬畫會有一半機率跟地圖對不上。待把 metric 併進 overlayParams 再補。
  "h3Population",
  "convenienceStores",
  // 公共設施：郵局 / i郵箱 / 活動中心 皆單色 POI（govServiceOffices 3 類分色 → 已接 legend）
  "postOffices", "iPostBoxes", "communityCenters",
  // 公共設施 Batch 2：圖書館 / 社福 / 市場 皆單色 POI（publicToilets 4 級分色 → 已接 legend）
  "publicLibraries", "welfareCenters", "retailMarkets",
  "activeFaults", "youbikeFullness",
  // cwaCloudImagery / cwaRadarImagery：CWA 上游直接給已上色的雲圖／雷達 PNG，
  // 前端只是 raster image source，沒有自己的色階可派生 → 鐵則 2 不適用。
  "cwaCloudImagery", "cwaRadarImagery",
  "busLive", "busIntercityLive", "waterBasins", "waterRivers", "waterLevees",
  // 水庫（單色青面）／滯洪池（單色 #0284c7 點）：paint 無 match/step 分類。
  // 同組的 waterProtectionZones / waterFacilities / waterMonitorStations / waterFloodExtreme
  // 皆為屬性驅動多色，已接 LEGEND_REGISTRY。
  "waterReservoirs", "waterDetentionBasins",
  // groundwaterWells（靜態井位 backdrop，單色灰點）／precipRaster（IoW 上游已把色階
  // 燒進 PNG 的 image source）→ 鐵則 2 不適用。
  "groundwaterWells", "precipRaster",
  "medICUBeds", "agriculture", "agriSoil", "agriLeisureFarmZones",
  "agriRuralRegen", "farmRoads", "wasteTruck", "wasteSchedule",
  "wasteScheduleNote", "wasteStopsStatic", "wasteCleaningSquads", "wasteRoute", "wasteStop",
  "wfIncinerator", "wfLandfill", "wfLandfillCoastal", "wfTransfer", "wfMedical", "wfMonitoring",
  "wfRecycling", "wfScrapYard", "wfOther", "wdClothes", "wdMixed",
  "wdRecyclingContainer", "wdBattery",
  // Bloom 實驗層：單色光暈疊在既有 layer 上（發電廠/變電所/電線/航空管制），無分類
  "powerPlantGlow", "substationEhvGlow", "powerLinesGlow", "aviationRestrictedGlow",
  // Energy MVP：充電站單色 POI（osmSubstations 已升級電網層級分色 → 已接 SubstationLegend）
  "evChargingStations",
  // Base map：行政邊界 3 層皆單色灰 + 等高線 2 層皆單色棕；osmExpressway 單色橘線
  // （osmRoadDrive 才有 highway 分級 6 色 → 已接 OsmRoadDriveLegend）；hillshade 單色灰 raster
  "countyBoundary", "townshipBoundary", "villageBoundary",
  "contour25k", "contourDtm20", "osmExpressway", "hillshade",
  // 🧳 觀光 Tourism：單色 POI / 單色面層（分類 < 2）。有分類/雙模式圖例的 4 層
  // （tourAttractions / tourHotels / tourHeritage / tourEvents）已接 LEGEND_REGISTRY。
  "tourHotSprings", "tourHotSpringZones", "tourScenicAreas",
  "tourFactories", "tourAmusementParks", "tourCamping", "tourRestaurants",
]);

/**
 * `popup: null`（鐵則 3 豁免 —— 沒有 click popup）。
 *
 * ⚠️ **本 ledger 是 Phase 4 就地凍結的現況**（57 筆）。Phase 2 逐批搬移時，每一筆
 * `popup` 宣告都與 `GIS_LAYERS` / `HEADER_LABELS` 機械對帳過（見 layerManifest.test.ts
 * 那條雙向斷言），所以「宣告 null 的層確實沒有接線」是查證過的；
 * **但「它是否*應該*有 popup」是 UX 判斷，沒有逐筆重新考證。**
 *
 * 那不影響本 ledger 的作用：它是 ratchet。新層若也想宣告 `popup: null`，
 * 必須在這裡加一行**並寫下理由** —— 而不是靜默跟著現況走。
 * 既有的 57 筆若哪天補了 popup，也必須從這裡移除（雙向斷言會叫）。
 *
 * 已查證的兩大類（其餘按主題分群，理由待補時逐筆補在該行）：
 *   - **Three.js scene 自帶 picking**：`useMapInteraction` 的 `pickFlight` /
 *     `pickTrain` / `pickBus` 路徑直接 `setFeatureInfo`，不經 GIS_LAYERS 命中，
 *     所以 manifest 的 `popup`（= GIS_LAYERS 的 layerType）本來就是 null。
 *     ⚠️ 這類**有 tooltip**，不是「點了沒反應」。
 *   - **raster / 純線 / 純面背景層**：沒有承載屬性的 feature 可點。
 */
const NO_POPUP_LEDGER = new Set([
  // 交通 Move —— rail / flights / bus 三族走 Three.js scene picking（非 GIS_LAYERS）
  "rail", "flights", "busLive", "busIntercityLive", "touristShuttleLive",
  // 交通 Move —— 純線層 / 站點僅作定位
  "highways", "provincialRoads", "cyclingRoutes",
  "canopyHeight",                                    // 林業：raster 樹冠高度
  // 房地產：格點/點位圖層，數值直接以顏色表達（6 層同族）
  "realEstateRentalGrid", "realEstateRentalPoint",
  "realEstateSaleGrid", "realEstateSalePoint",
  "realEstatePresaleGrid", "realEstatePresalePoint",
  // 人口社經：格點/指標面層
  "popCount", "h3Population", "indicators", "socioeconomic", "spatialEconomy",
  "youbikeFullness",
  "dustForecast",                                    // 全球氣候：raster 沙塵預報
  "hillshade",                                       // 底圖：raster 山影
  // 環境氣候：CWA/EPA 上游 raster（雲圖 / 雷達 / 溫度 / 熱島 / AQI 影像）
  "cwaCloudImagery", "cwaRadarImagery", "temperatureWave", "urbanHeat", "aqiImagery",
  // 水資源：極端淹水面（payload 只有圖例已標示的 depth_class，待 owner 拍板）
  // / 雨量 raster（IoW 上游已把色階燒進 PNG，無數值通道）
  "waterFloodExtreme", "precipRaster",
  // 廢棄物：清運車與排程走 wasteMapboxLayers 自掛 handler / 裝飾性特效
  "wasteTruck", "wasteSchedule", "wasteScheduleNote",
  "agriculture",                                     // 農業：全台耕地底圖面
  // 能源：glow 光暈層疊在既有可點層上（點擊由底下那層接）＋ 桿線 ＋ 風場規劃區
  "powerPlantGlow", "aviationRestrictedGlow", "powerPoles", "powerLinesGlow",
  "substationEhvGlow", "windPlan",
  // orphan（無 sidebar toggle，見 ORPHAN_LEDGER）
  "powerStatusHud", "powerRegionDemand", "medICUBeds", "wasteRoute", "wasteStop",
]);

// ══════════════════════════════════════════════════════════════════
//  1. key 空間完整性
// ══════════════════════════════════════════════════════════════════

describe("manifest 完整性：key 空間", () => {
  it("每個 LayerVisibility key 都有 manifest entry", () => {
    const missing = allLayerKeys.filter((k) => !manifestKeys.has(k)).sort();
    expect(
      missing,
      `這些 layer key 沒有 manifest entry：${missing.join(", ")}\n` +
      `→ 在 src/data/layerManifest.ts 的 LAYER_MANIFEST 補一筆完整 entry\n` +
      `（section / color / icon / upstream / dataClass / source / legend / popup /` +
      ` params / description / topics，缺一不可；不需要的欄位寫 null 並登記進本檔的 ledger）\n` +
      `⚠️ 只把 key 塞進 HANDWRITTEN_LAYER_COLORS / HANDWRITTEN_UPSTREAM 是繞過 manifest —— ` +
      `tsc 不會紅，但整條派生鏈（sidebar / icon / 血緣 / 圖例 / popup / 參數）都拿不到它。`,
    ).toEqual([]);
  });

  it("manifest 沒有 LayerVisibility 以外的幽靈 key", () => {
    const known = new Set(allLayerKeys);
    const phantom = MANIFEST_KEYS.filter((k) => !known.has(k)).sort();
    expect(phantom, `manifest 有這些 key 但 LAYER_COLORS 查無：${phantom.join(", ")}`).toEqual([]);
  });

  /**
   * 2026-07-02 稽核列的第 5 個靜默失敗點是「`DEFAULT_ON` 漏加」。
   * 那個形狀**已在結構上消失**：`buildDefaultVisibility()` 的 key 全集由
   * `LAYER_COLORS` 派生（型別強制完整），新層不必碰 `layerVisibilityStore`；
   * 且 `DEFAULT_ON` 現為空集合（2026-08-10 起訪客一進站不打任何 RPC）。
   * 保留本條的意義：預設開啟清單若哪天長出成員，它必須是 manifest 認得的 key
   * —— 一個沒有 manifest entry 的層預設開啟＝一進站就載入一個沒人登記的圖層。
   */
  it("預設開啟清單（若有）全部是 manifest key", () => {
    const defaults = buildDefaultVisibility() as unknown as Record<string, boolean>;
    const on = Object.keys(defaults).filter((k) => defaults[k]).sort();
    expect(
      on.filter((k) => !manifestKeys.has(k)),
      "這些層預設開啟卻沒有 manifest entry",
    ).toEqual([]);
    expect(
      Object.keys(defaults).length,
      "buildDefaultVisibility 的 key 數與 LAYER_COLORS 不同 → 派生鏈斷了",
    ).toBe(allLayerKeys.length);
  });
});

// ══════════════════════════════════════════════════════════════════
//  2. 必要欄有真值（tsc 只擋「欄位不存在」，擋不住「填了空的」）
// ══════════════════════════════════════════════════════════════════

/** 回傳這筆 entry 所有「填了但沒真值」的欄位名 + 原因。 */
function missingFields(key: string, m: LayerManifestEntry): string[] {
  const bad: string[] = [];

  if (m.key !== key) bad.push(`key（entry.key="${m.key}" 與 record key 不同）`);
  if (!/^#[0-9a-fA-F]{3,8}$/.test(m.color)) bad.push(`color（"${m.color}" 不是 hex 色碼）`);
  if (!m.icon) bad.push("icon（不是 lucide 元件參照）");
  if (!m.description?.trim()) bad.push("description（空字串）");
  if (!Array.isArray(m.topics) || m.topics.length === 0 || m.topics.some((t) => !t.trim())) {
    bad.push("topics（空陣列或含空字串）");
  }
  if (!["A", "B", "C", "D"].includes(m.dataClass)) bad.push(`dataClass（"${m.dataClass}" 不是 A/B/C/D）`);

  const sources = Array.isArray(m.source) ? m.source : [m.source];
  if (sources.length === 0) bad.push("source（空陣列）");
  for (const s of sources) {
    if (s.kind === "custom") {
      if (!s.note?.trim()) bad.push("source.note（custom source 沒說明資料實際從哪來）");
    } else if (!s.sourceId?.trim()) {
      bad.push("source.sourceId（空字串）");
    }
  }

  // 血緣：verified 必須真的指到 catalog dataset；非 verified 必須說得出為什麼
  const u = m.upstream;
  if (!u) {
    bad.push("upstream");
  } else if (u.status === "verified" && u.datasets.length === 0) {
    bad.push("upstream.datasets（status=verified 卻沒有任何 catalog dataset）");
  } else if (
    u.status !== "verified" &&
    !u.note && !u.processing && !u.derivedFromLayers && !u.derivedFromDatasets
  ) {
    bad.push(`upstream（status=${u.status} 卻沒有 note／血緣說明）`);
  }

  // themed entry 才有 LayerDef 那一組；orphan 的 label 在型別上是 never
  if (m.section !== null) {
    if (!m.label?.trim()) bad.push("label（空字串）");
    if (!m.section.theme?.trim() || !m.section.group?.trim()) bad.push("section（theme/group 空字串）");
  }

  return bad;
}

describe("manifest 完整性：必要欄有真值", () => {
  it("每筆 entry 的必要欄都填了真值（不是空字串／空陣列／空殼血緣）", () => {
    const problems = entries
      .map(([k, m]) => [k, missingFields(k, m)] as const)
      .filter(([, bad]) => bad.length > 0)
      .map(([k, bad]) => `${k}: ${bad.join("、")}`);

    expect(
      problems,
      `這些 manifest entry 的欄位是空殼：\n  ${problems.join("\n  ")}\n` +
      `→ 去 src/data/layerManifest.ts 補真值。欄位「不存在」由 tsc 擋（TS2741），` +
      `本條擋的是「填了但等於沒填」。`,
    ).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════
//  3. 豁免 ledger 雙向凍結（ratchet：只進不退）
// ══════════════════════════════════════════════════════════════════

/**
 * 把「manifest 裡宣告 null 的 key 集合」與 ledger 雙向釘死。
 *
 * - 宣告 null 卻不在 ledger → 新層靜默豁免了鐵則，紅。
 * - 在 ledger 卻沒宣告 null → 接好線了還留著豁免，紅（ratchet 只進不退）。
 */
function ledger(
  label: string,
  isExempt: (m: LayerManifestEntry) => boolean,
  led: Set<string>,
  howToFix: string,
) {
  const declared = entries.filter(([, m]) => isExempt(m)).map(([k]) => k).sort();
  const undeclaredExempt = declared.filter((k) => !led.has(k));
  const staleLedger = [...led].filter((k) => !declared.includes(k)).sort();

  expect(
    undeclaredExempt,
    `這些 layer 在 manifest 宣告了「沒有 ${label}」但沒登記進本檔的 ledger：` +
    `${undeclaredExempt.join(", ")}\n→ ${howToFix}\n` +
    `（豁免必須是**有意識的決定**：在 ledger 加一行並寫下理由，` +
    `否則新層照抄一個 null 就悄悄跳過了 UX 鐵則）`,
  ).toEqual([]);

  expect(
    staleLedger,
    `這些 layer 已經有 ${label} 了，請從本檔的 ledger 移除（ratchet 只進不退）：` +
    `${staleLedger.join(", ")}`,
  ).toEqual([]);
}

describe("manifest 完整性：豁免 ledger", () => {
  it("orphan（section: null）＝ ORPHAN_LEDGER", () => {
    ledger(
      "sidebar toggle",
      (m) => m.section === null,
      ORPHAN_LEDGER,
      "要上 sidebar → 在 manifest 填 section: { theme, group } + label（THEMES 由此派生）",
    );
  });

  it("鐵則 1：params: null ＝ NO_PARAMS_LEDGER（透明度/參數控件）", () => {
    ledger(
      "透明度/參數控件",
      (m) => m.params === null,
      NO_PARAMS_LEDGER,
      "在 src/data/layerParamsSpec.ts 的 LAYER_PARAMS_SPEC 加一筆 " +
      "opacitySlider(\"<key>Opacity\", 0.8)，manifest 的 params 同步寫 { count, kinds }",
    );
  });

  it("鐵則 2：legend: null ＝ NO_LEGEND_LEDGER（圖例）", () => {
    ledger(
      "圖例",
      (m) => m.legend === null,
      NO_LEGEND_LEDGER,
      "同層分類 ≥ 2 種顏色就要在 LegendPanel.tsx 寫 sub-component + LEGEND_REGISTRY 加一行，" +
      "manifest 的 legend 填該圖例 id（development-rules §4a 規則 2）",
    );
  });

  it("鐵則 3：popup: null ＝ NO_POPUP_LEDGER（click popup）", () => {
    ledger(
      "click popup",
      (m) => m.popup === null,
      NO_POPUP_LEDGER,
      "承載屬性的 feature 都要接 FeatureInfoPanel：types 的 FeatureInfo.layerType 加 key → " +
      "featureInfo/registry 的 PANEL_REGISTRY + HEADER_LABELS 各加一行 → " +
      "useMapInteraction 的 GIS_LAYERS 加條目，manifest 的 popup 填該 layerType" +
      "（development-rules §4a 規則 3）",
    );
  });
});

// ══════════════════════════════════════════════════════════════════
//  4. 鐵則 4 沒有 per-layer 觸點，但兩個 sidebar 的閾值必須同步
// ══════════════════════════════════════════════════════════════════

describe("鐵則 4：select 控件渲染閾值", () => {
  /**
   * §4a 規則 4：`options.length ≤ 3` → 橫向 button row；`≥ 4` → 原生 `<select>`。
   * 這條**不是 per-layer 觸點**（兩個 sidebar 自動依 options 長度切換，新層不用做任何事），
   * 唯一的失敗模式是「兩個 sidebar 的閾值改了一邊忘了另一邊」——
   * 桌機看到 dropdown、手機看到撐爆的 button row。
   */
  it("IconRailSidebar 與 LayerSidebar 用同一個閾值", () => {
    const THRESHOLD = "ctrl.options.length > 3";
    for (const file of [
      "src/components/IconRailSidebar.tsx",
      "src/components/LayerSidebar.tsx",
    ]) {
      expect(
        readFileSync(file, "utf8").includes(THRESHOLD),
        `${file} 找不到 \`${THRESHOLD}\` —— 兩個 sidebar 的 select 閾值分岔了，` +
        `或渲染邏輯改了形狀（請同步更新本測試）。§4a 規則 4：≥ 4 個 option 必用原生 <select>，` +
        `中文標籤的 button row 一定撐爆 240px 窄欄。`,
      ).toBe(true);
    }
  });
});
