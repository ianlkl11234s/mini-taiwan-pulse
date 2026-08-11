// ══════════════════════════════════════════════════════════════════
//  Layer Catalog — Sidebar 圖層目錄「單一真實來源」
// ══════════════════════════════════════════════════════════════════
//
// LayerSidebar（手機版）與 IconRailSidebar（桌機版）共用此檔。
//
// 結構（2026-07 現況，PR #72 後）：
// - 22 主題（Theme） → 多子群（SubGroup） → 多 Layer
// - SECTIONS 為 derived flat list，每筆 SectionDef = 一個 SubGroup，
//   title 格式：`主題中文 English · 子群中文`，視覺上連續行構成主題分組。
//   下一階段 sidebar 升級後可直接消費 THEMES。
//
// 規則：
// - LAYER_COLORS：型別強制 Record<keyof LayerVisibility, string>，
//   缺 key 會 tsc 報錯 → 新增 layer 必補色。
// - THEMES：新 SSOT；新增 layer 把 key 放進對應 theme.groups[].layers。
// - 命名格式：`中文 English`（例：「水資源 Water」「國道 Highway」）。
// - 預設開關由 useLayerVisibility 控制；動態 RPC 原則上預設關閉。
//
// 排序原則：
// 1. BASE 頂置（不算主題、純底圖）
// 2. 主題順序沿七段敘事帶推進：
//    基準/脈動 → 人與城市 → 公共服務 → 安全緊急 → 環境資源 → 產業 → 情報
// 3. 每主題內子群順序：點位 → 線/面 → 即時 → 分析

import type { LayerVisibility, TransportType } from "../../types";

// ── Color Config ──

import {
  LAYER_MANIFEST, manifestColors,
  type ManifestKey, type LayerManifestEntry,
} from "../../data/layerManifest";

/**
 * 尚未搬進 layerManifest 的手寫色票（AR-22 雙軌過渡）。
 *
 * 型別是 `Omit<Record<全集>, ManifestKey>` —— tsc 雙向把關：
 *   - 漏掉任一「還沒搬」的 key → TS2739 缺屬性
 *   - 已搬進 manifest 的 key 還留在這裡 → excess property 報錯
 * 所以「搬走了但手寫值沒刪」這種「改 manifest 畫面沒反應」的暗雷不可能存在。
 */
const HANDWRITTEN_LAYER_COLORS: Omit<Record<keyof LayerVisibility, string>, ManifestKey> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  stationsTHSR: "#ff8c00",
  stationsTRA: "#b8a080",
  stationsMetro: "#00bcd4",
  ports: "#4a90d9",
  lighthouses: "#ffd700",
  airports: "#daa520",
  highways: "#ff6b6b",
  provincialRoads: "#ffa94d",
  etcGantry: "#f06292",
  serviceArea: "#4db6ac",
  serviceAreaPolygon: "#4db6ac",
  taxiStand: "#f9a825",
  windPlan: "#7efcb0",
  busStationsCity: "#66bb6a",
  busStationsIntercity: "#ab47bc",
  bikeStations: "#ffca28",
  cyclingRoutes: "#66bb6a",
  freewayCongestion: "#ef5350",
  roadCongestion: "#fb923c",
  weatherStations: "#4dd0e1",
  temperatureWave: "#ff6b35",
  temperatureGrid: "#f46d43",
  urbanHeat: "#b2182b",
  // 🎓 教育總覽層 schools 已搬進 layerManifest（AR-22 Phase 2 批 3）——
  //    它不在 EDUCATION_LAYER_COLORS 裡，色票是本表自己的字面值，隨 entry 一起搬走
  // ⚠️ 災害 Hazard 12 層已搬進 layerManifest（AR-22 Phase 2 批 5）——
  //    本處原有 9 層（斷層/地震 3 + 山域 1 + NCDR 示警 5），另 3 層在下方雷暴/核安處。
  //    12 個色票原本就是字面 hex（disasterAlertTypes 的 ALERT_GROUPS 是 event_term-keyed
  //    分色表、從未餵本表），照拍板①判準寫字面。
  //    ⚠️ 「全球氣候 GLOBAL CLIMATE」註解原本夾在中間，其 5 層已於批 4 搬走
  roadEvents: "#ef4444",
  cwaCloudImagery: "#b0c4de",
  cwaRadarImagery: "#4fc3f7",
  aqiImagery: "#8bc34a",
  aqiStations: "#00bcd4",
  aqiMicroSensors: "#7e57c2",
  busLive: "#4fc3f7",
  busIntercityLive: "#ba68c8",
  touristShuttleLive: "#26a69a",
  waterBasins: "#4dd0e1",
  waterRivers: "#38bdf8",
  waterLevees: "#f59e0b",
  waterCanals: "#a78bfa",
  waterProtectionZones: "#10b981",
  waterReservoirs: "#06b6d4",
  waterFacilities: "#fbbf24",
  waterMonitorStations: "#f472b6",
  waterFloodExtreme: "#fb7185",
  waterDetentionBasins: "#0284c7",
  rainGauge: "#3b82f6",
  riverLevel: "#22d3ee",
  groundwater: "#0ea5e9",
  groundwaterWells: "#64748b",
  iotWraRiver: "#06b6d4",
  iotWraStructure: "#a855f7",
  lakesPondsOsm: "#4fc3f7",
  floodSensor: "#ef4444",
  floodSensorIsochrone: "#ef4444",
  taipeiSewer: "#3b82f6",
  taipeiEvacuate: "#22c55e",
  taipeiPumb: "#06b6d4",
  precipRaster: "#60a5fa",
  medICUBeds: "#ff1744",
  parkingOnstreet: "#64748b",
  parkingOffstreet: "#22c55e",
  agriculture: "#2e7d32",
  agriSoil: "#8d6e63",
  agriSoilFertility: "#00897b",
  agriLeisureFarmZones: "#66bb6a",
  agriRuralRegen: "#ffb74d",
  agriCropSuitability: "#1b5e20",
  agriPOI: "#6a1b9a",
  agriRetail: "#e91e63",
  agriProduceWholesale: "#3f51b5",
  agriWholesaleMarket: "#ffd600",
  livestockFarmPig: "#ec6a5e",
  livestockFarmChicken: "#f4b400",
  livestockFarmCattle: "#6d4c41",
  livestockFarmDuck: "#00897b",
  livestockFarmGoose: "#26c6da",
  livestockFarmSheep: "#ab47bc",
  livestockFarmOther: "#9e9e9e",
  livestockSlaughter: "#c62828",
  livestockFeed: "#455a64",
  livestockMarket: "#d500f9",
  aquaculturePonds: "#26c6da",
  aquacultureZone: "#66bb6a",
  aquacultureCageNet: "#5c6bc0",
  aquacultureWaterSatellite: "#26c6da",
  aquacultureWaterSatelliteMoa: "#26c6da",
  aquacultureWaterUnion: "#26c6da",
  aquacultureIntegrated: "#26c6da",
  streetTreesTaipeiDiff: "#2e7d32",
  protectedTreesNational: "#00695c",
  riversideTreesTaipei: "#0288d1",
  streetTreesTaipei3epoch: "#558b2f",
  streetTreesNational: "#43a047",
  treePitsTaipei: "#8d6e63",
  // 📍 底圖 buildingsGba / urbanZoningNewTaipei / nonUrbanZoning 已搬進 layerManifest
  //    （AR-22 Phase 2 批 5，與下方 Base map 區塊的 9 層同批）
  // 🧳 觀光 Tourism 11 層已搬進 layerManifest（AR-22 Phase 2 批 2）——
  //    tourTypes.ts 的 TOUR_*_COLOR 是 category-keyed 的 match 表達式、不是
  //    layer-key-keyed 的色票記錄，本表從未 import 它 → manifest 寫字面 hex。
  // 🛕 宗教 Religion 6 層 / ⚰️ 殯葬 Funeral 5 層已搬進 layerManifest
  //    （AR-22 Phase 2 批 1）—— 色票 SSOT 仍是 religionTypes.ts / funeralTypes.ts
  //    的 *_LAYER_COLORS，manifest 的 color 欄直接引用它們。
  //    ⚠️ spread **不觸發 excess property check**，所以這裡若留著
  //    `...RELIGION_LAYER_COLORS` / `...FUNERAL_LAYER_COLORS`，tsc / 黃金快照 /
  //    契約測試會全綠但登記沒真搬走（manifest 後蓋、值又相同）→ 必須整行刪掉。
  //    這是雙軌護欄唯一擋不到的漏法。
  // 🎓 教育 Education 17 層已搬進 layerManifest（AR-22 Phase 2 批 3）——
  //    `...EDUCATION_LAYER_COLORS` spread 已依上述理由整行刪除（連同本檔的 import）；
  //    色票 SSOT 仍是 educationTypes.ts，manifest 的 color 欄逐 key 引用它。
  farmRoads: "#7a8670",
  ecoNetworkZones: "#4caf50",
  // 🌲 林業 Forestry 16 層已搬進 layerManifest（AR-22 Phase 2 批 3）——
  //    forestReserveTypes / canopyGiantsTypes 匯出的是 category-keyed 的分色表達式
  //    （保安林種類／離步道距離帶），不是 layer-key-keyed 的色票記錄，本表從未
  //    import 它們 → manifest 寫字面 hex（同批 2 觀光的判準）。
  wasteTruck: "#fbbf24",
  wasteSchedule: "#fbbf24",
  wasteScheduleNote: "#fff8d6",
  wasteStopsStatic: "#d97706",
  wasteCleaningSquads: "#22c55e",
  wasteRoute: "#84cc16",
  wasteStop: "#65a30d",
  wfIncinerator: "#ef4444",
  wfLandfill: "#92400e",
  wfLandfillCoastal: "#0891b2",
  wfTransfer: "#a855f7",
  wfMedical: "#ec4899",
  wfMonitoring: "#3b82f6",
  wfRecycling: "#22c55e",
  wfScrapYard: "#737373",
  wfOther: "#6b7280",
  wdClothes: "#f97316",
  wdMixed: "#14b8a6",
  wdRecyclingContainer: "#84cc16",
  wdBattery: "#fbbf24",
  satellitesYaogan: "#ef5350",
  satellitesJilin: "#ff7043",
  satellitesGaofen: "#ec407a",
  satellitesTJS: "#ba68c8",
  satellitesBeidou: "#5e7ce2",
  satellitesShiyan: "#9e9e9e",
  satellitesTaiwan: "#4fc3f7",
  satellitesUSA: "#93c5fd",
  satellitesJapan: "#fb7185",
  satellitesRussia: "#a8a29e",
  satellitesIndia: "#f59e0b",
  satellitesKorea: "#2dd4bf",
  satellitesFrance: "#3b82f6",
  satellitesGermany: "#fde047",
  satellitesItaly: "#34d399",
  satellitesIsrael: "#c4b5fd",
  powerPlants: "#facc15",
  powerPlantGlow: "#f0abfc",
  substationEhvGlow: "#fb923c",
  powerLinesGlow: "#22d3ee",
  aviationRestrictedGlow: "#f87171",
  powerStatusHud: "#22c55e",
  powerRegionDemand: "#3b82f6",
  powerGenerationUnit: "#f97316",
  osmSubstations: "#f97316",
  osmSubstationsEhv: "#ef4444",
  osmPowerLines: "#62D9AD",
  osmPowerTowers: "#468BA6",
  powerPoles: "#94a3b8",
  osmWindTurbines: "#67e8f9",
  osmSolarFarms: "#fbbf24",
  osmPowerPlantsStatic: "#9ca3af",
  offshoreWindZones: "#22d3ee",
  islandPowerGrid: "#a78bfa",
  fossilFuelInfra: "#1f2937",
  geothermalWells: "#ef4444",
  renewablePermitsTaipei: "#fbbf24",
  evChargingStations: "#10b981",
  facPrimary: "#F2D64B",
  facOffshore: "#1F4373",
  facPlanned: "#F2E085",
  facHistorical: "#8C5D42",
  facSecondary: "#8C7C4A",
  facOsmSupplement: "#94a3b8",
  gasStationCpc: "#41AEF2",
  gasStationFpcc: "#22C55E",
  gasStationTaisugar: "#F2522E",
  gasStationOther: "#D1D5DB",
  gasStationCanonical: "#0FBFBF",
  lpgSubpackaging: "#F2622E",
  lpgRetailers: "#D9863D",
  lngTerminal: "#F2B84B",
  pipelineGas: "#F2D64B",
  pipelineOilGas: "#EDF249",
  industrialRefinery: "#F97316",
  industrialStorageTank: "#06B6D4",
  industrialPowerPlant: "#D946EF",
  coalTerminal: "#3B82F6",
  gasCoverageAll: "#F2A516",
  gasCoverageCpc: "#41AEF2",
  gasCoverageFpcc: "#22C55E",
  gasCoverageTaisugar: "#F2522E",
  evIsland: "#F23535",
  // ⚠️ 災害 lightning / lightningCwa / nuclearRadiation 已搬進 layerManifest
  //    （AR-22 Phase 2 批 5，與上方災害 9 層同批）
  // 🏢 房地產 Real Estate 7 層已搬進 layerManifest（AR-22 Phase 2 批 4）——
  //    7 個色票原本就是字面 hex（沒有 *_LAYER_COLORS 常數在餵這張表），照拍板①判準寫字面
  // 📍 底圖 Base Map 12 層已搬進 layerManifest（AR-22 Phase 2 批 5）——
  //    12 個色票原本就是字面 hex（沒有 *_LAYER_COLORS 常數在餵這張表），照拍板①判準寫字面。
  //    ⚠️ osmExpressway 夾在中間但**不屬底圖**（THEMES 位置是「交通 Move / 路網」，批 8）→ 留在本表
  osmExpressway: "#FF8C00",
  // 👮 執法治安 20 層（含警察覆蓋分析 isochrone 3 層）已搬進 layerManifest
  //    （AR-22 Phase 2 批 4）—— 20 個色票原本就是字面 hex，無 spread 可刪
  aviationControl: "#4682B4",        // ✈️ 飛航情報 / 終端管制（TMA 深藍代表色）
  aviationRestricted: "#DC3545",     // ⛔ 機場管制 / 限航 / 危險（RCR 紅代表色）
  droneNoFlyZone: "#DC3545",         // 🚫 無人機禁航區（紅+未分類）
  droneRestrictedZone: "#FFC107",    // ⚠️ 無人機限航區（黃，需申請）
  // 環境污染 POLLUTION
  pollutionPenaltyCritical: "#ef4444",
  pollutionPenaltyGeneral: "#94a3b8",
  pollutionPenaltyMobile: "#22c55e",
  pollutionSite: "#111827",
};

/**
 * 色票全集 —— 手寫殘量 + manifest 派生。
 * 型別維持 `Record<keyof LayerVisibility, string>`（tsc 護欄不因引入 manifest 而弱化）。
 */
export const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  ...HANDWRITTEN_LAYER_COLORS,
  ...manifestColors(),
};

// ── Transport Labels ──

export const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: "航班 Flight",
  ships: "船舶 Ship",
  rail: "鐵道 Rail",
  busLive: "公車 Bus",
  busIntercityLive: "公路客運 InterCity",
  touristShuttleLive: "台灣好行 Tourist Shuttle",
};

// ── Type Defs ──

export interface LayerDef {
  key: keyof LayerVisibility;
  /** 桌機 IconRailSidebar 顯示文字（預設） */
  label: string;
  /** 手機 LayerSidebar 顯示文字（多為較長全稱）；未填則沿用 label */
  labelMobile?: string;
  expandable?: boolean;
  /**
   * owner-only 私人圖層：非 owner 帳號顯示鎖頭、禁 toggle。
   * runtime SSOT 為下方 GATED_LAYERS（兩個 sidebar + App toggle gate 共用）。
   */
  gated?: boolean;
}

export interface SubGroupDef {
  /** 子群顯示名（中文） */
  title: string;
  layers: LayerDef[];
}

export interface ThemeDef {
  /** 主題名 `中文 English` 格式 */
  title: string;
  /** 預設是否摺疊（僅環境氣候 Environment = false，其餘全部 true） */
  defaultCollapsed?: boolean;
  groups: SubGroupDef[];
}

// 舊型別保留 — 用於 SECTIONS derived flat 結構（兩個 sidebar 元件目前消費此型）
export interface SectionDef {
  title: string;
  layers: LayerDef[];
}

/**
 * 從 layerManifest 取出一筆 LayerDef（AR-22 雙軌過渡）。
 *
 * ⚠️ 用法是**就地替換**：把原本 `{ key: "cctv", label: "…", expandable: true }`
 * 這一行換成 `fromManifest("cctv")`，**位置不動**。THEMES 是有序巢狀結構，
 * 順序就是 UI 顯示順序 —— 若改成「派生的 append 在最後」，圖層會整批換位置，
 * 黃金快照的 themes/sidebarSections section 立刻紅。
 *
 * 選填欄位用條件展開而非 `labelMobile: m.labelMobile`：後者會產生一個值為
 * undefined 的**存在的 key**，跟「這個 key 不存在」在序列化/比對上是兩回事。
 */
function fromManifest(key: ManifestKey): LayerDef {
  // 顯式標成 LayerManifestEntry：LAYER_MANIFEST 走 `satisfies`，逐筆型別只含
  // 該筆真的寫了的欄位 —— 直接讀 m.gated 會被 TS 判成不存在。這裡要的是
  // 「介面上宣告過的選填欄位」語意，widen 到介面才對。
  const m: LayerManifestEntry = LAYER_MANIFEST[key];
  const def: LayerDef = { key: m.key, label: m.label };
  if (m.labelMobile !== undefined) def.labelMobile = m.labelMobile;
  if (m.expandable !== undefined) def.expandable = m.expandable;
  if (m.gated !== undefined) def.gated = m.gated;
  return def;
}

// ── THEMES（新 SSOT）──

/**
 * 「世界 World」主題 title —— 獨立 rail tab「世界」的唯一來源。
 * 桌機主 Layers panel 用 WORLD_TAB_THEME_TITLES 把世界 tab 的主題濾掉（只在世界 tab 出現），
 * 世界 tab 則只渲染這批主題（陣列順序＝世界 tab 內的顯示順序）。
 */
export const WORLD_THEME_TITLE = "世界 World";

/** 劃入「世界」rail tab 的主題清單（2026-07-19 全球氣候自主 Layers panel 搬入）。 */
export const WORLD_TAB_THEME_TITLES: string[] = [WORLD_THEME_TITLE, "全球氣候 Global Climate"];

export const THEMES: ThemeDef[] = [
  // ───────────────────────────────────────────────────────────────
  // 📍 BASE 底圖（頂置・預設摺疊）
  // ───────────────────────────────────────────────────────────────
  {
    title: "底圖 Base Map",
    defaultCollapsed: true,
    groups: [
      {
        title: "行政邊界",
        layers: [
          fromManifest("countyBoundary"),
          fromManifest("townshipBoundary"),
          fromManifest("villageBoundary"),
        ],
      },
      {
        title: "地形",
        layers: [
          fromManifest("contour25k"),
          fromManifest("contourDtm20"),
          fromManifest("hillshade"),
          fromManifest("slopeVector"),
          fromManifest("aspectVector"),
        ],
      },
      {
        title: "建成環境",
        layers: [
          fromManifest("buildingsGba"),
        ],
      },
      {
        // 官方參考底圖（非分析產物）——上游 topic-research 原始目標即「pulse 底圖層」
        title: "土地使用分區 Zoning",
        layers: [
          fromManifest("urbanZoningTaipei"),
          fromManifest("urbanZoningNewTaipei"),
          // 與上面兩層互補：那兩層是「都市計畫區內」，本層是「非都市土地」，合起來是全國拼圖
          fromManifest("nonUrbanZoning"),
        ],
      },
      {
        title: "道路底圖",
        layers: [
          fromManifest("osmRoadDrive"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚦 MOVE 交通
  // ───────────────────────────────────────────────────────────────
  {
    title: "交通 Move",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時運具",
        layers: [
          { key: "flights", label: "航班 Flight", expandable: true },
          { key: "ships", label: "船舶 Ship", expandable: true },
          fromManifest("rail"),
          { key: "busLive", label: "公車 Bus", expandable: true },
          { key: "busIntercityLive", label: "公路客運 InterCity", expandable: true },
          { key: "touristShuttleLive", label: "台灣好行 Tourist Shuttle", labelMobile: "台灣好行", expandable: true },
        ],
      },
      {
        title: "場站",
        layers: [
          { key: "stationsTHSR", label: "高鐵站 THSR Station", expandable: true },
          { key: "stationsTRA", label: "台鐵站 TRA Station", expandable: true },
          { key: "stationsMetro", label: "捷運站 Metro Station", expandable: true },
          { key: "busStationsCity", label: "市區公車站 City Bus", expandable: true },
          { key: "busStationsIntercity", label: "公路客運站 Intercity", expandable: true },
          { key: "bikeStations", label: "公共自行車 Bike Station", expandable: true },
        ],
      },
      {
        title: "路網",
        layers: [
          { key: "highways", label: "國道 Highway", expandable: true },
          { key: "osmExpressway", label: "快速道路 Expressway", expandable: true },
          { key: "provincialRoads", label: "省道 Provincial Road", expandable: true },
          { key: "cyclingRoutes", label: "自行車道 Cycling Route", expandable: true },
          fromManifest("cctv"),
          { key: "etcGantry", label: "ETC 收費門架 Gantry", expandable: true },
          { key: "serviceArea", label: "國道服務區 Service Area", expandable: true },
          { key: "serviceAreaPolygon", label: "國道服務區範圍 SA Area", expandable: true },
          { key: "taxiStand", label: "計程車招呼站 Taxi Stand", expandable: true },
        ],
      },
      {
        title: "樞紐節點",
        layers: [
          { key: "ports", label: "港口 Port", expandable: true },
          { key: "airports", label: "機場 Airport", expandable: true },
          { key: "lighthouses", label: "燈塔 Lighthouse", expandable: true },
          { key: "aviationControl", label: "飛航情報/終端管制 ✈️ FIR + TMA", expandable: true },
          { key: "aviationRestricted", label: "機場管制/限航/危險 ⛔ CTR+RCR+DANGER", expandable: true },
          { key: "droneNoFlyZone", label: "無人機禁航區 🚫 Drone NFZ", expandable: true },
          { key: "droneRestrictedZone", label: "無人機限航區 ⚠️ Drone Restricted", expandable: true },
        ],
      },
      {
        title: "即時監控",
        layers: [
          { key: "freewayCongestion", label: "國道壅塞 Congestion", expandable: true },
          { key: "roadCongestion", label: "省道路況 Provincial v1", expandable: true },
          { key: "roadEvents", label: "即時路況 Road Events", expandable: true },
        ],
      },
      {
        title: "停車 Parking",
        layers: [
          { key: "parkingOnstreet", label: "路邊停車 On-street", labelMobile: "路邊停車", expandable: true },
          { key: "parkingOffstreet", label: "場外停車場 Off-street", labelMobile: "場外停車場", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 👥 PEOPLE 人口社經
  // ───────────────────────────────────────────────────────────────
  {
    title: "人口社經 People",
    defaultCollapsed: true,
    groups: [
      {
        title: "人口分布",
        layers: [
          fromManifest("popCount"),
          fromManifest("h3Population"),
          fromManifest("indicators"),
        ],
      },
      {
        title: "社經",
        layers: [
          fromManifest("socioeconomic"),
          fromManifest("spatialEconomy"),
        ],
      },
      {
        title: "共享運具",
        layers: [
          fromManifest("youbikeFullness"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏙️ URBAN ANALYSIS 都市分析（都市 × 環境交叉分析；未來熱島效應、風廊等進此區）
  // ───────────────────────────────────────────────────────────────
  {
    title: "都市分析 Urban Analysis",
    defaultCollapsed: true,
    groups: [
      {
        title: "都市紋理",
        layers: [
          fromManifest("urbanFormGrid"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏠 ESTATE 房地產
  // ───────────────────────────────────────────────────────────────
  {
    title: "房地產 Real Estate",
    defaultCollapsed: true,
    groups: [
      {
        title: "租賃",
        layers: [
          fromManifest("realEstateRentalGrid"),
          fromManifest("realEstateRentalPoint"),
        ],
      },
      {
        title: "買賣",
        layers: [
          fromManifest("realEstateSaleGrid"),
          fromManifest("realEstateSalePoint"),
        ],
      },
      {
        title: "預售",
        layers: [
          fromManifest("realEstatePresaleGrid"),
          fromManifest("realEstatePresalePoint"),
        ],
      },
      {
        // 上三組是「單價」（每 m² 多貴），本組是「總量」（這格壓了多少錢）——語意不同，見圖例
        title: "總市值",
        layers: [
          fromManifest("propertyValueGrid"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏗️ INFRA 基礎建設
  // ───────────────────────────────────────────────────────────────
  {
    title: "基礎建設 Infrastructure",
    defaultCollapsed: true,
    groups: [
      {
        title: "通訊",
        layers: [
          fromManifest("submarineCables"),
          fromManifest("landingStations"),
        ],
      },
      {
        title: "公共設施",
        layers: [
          // 2026-08-08：schools 搬到「教育 Education」主題（第 38 主題），此處不再列出
          fromManifest("convenienceStores"),
          fromManifest("postOffices"),
          fromManifest("iPostBoxes"),
          fromManifest("communityCenters"),
          fromManifest("govServiceOffices"),
          fromManifest("publicLibraries"),
          fromManifest("welfareCenters"),
          fromManifest("retailMarkets"),
          fromManifest("publicToilets"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚡ ENERGY 能源
  // ───────────────────────────────────────────────────────────────
  {
    title: "能源 Energy",
    defaultCollapsed: true,
    groups: [
      {
        title: "電力 · 廠",
        layers: [
          { key: "facPrimary", label: "發電廠 主要・運轉中 Primary", expandable: true },
          { key: "facPlanned", label: "發電廠 未來規劃 Planned", expandable: true },
          { key: "facHistorical", label: "發電廠 歷史・退役 Historical", expandable: true },
          { key: "facSecondary", label: "發電廠 小型分散 Secondary", expandable: true },
          { key: "facOsmSupplement", label: "發電廠 OSM 補充 Supplement", expandable: true },
          { key: "powerGenerationUnit", label: "機組即時出力 Live Output", expandable: true },
          { key: "powerPlantGlow", label: "發電廠 Bloom 測試 ✨", expandable: true },
          { key: "aviationRestrictedGlow", label: "機場管制/限航 Rim Glow 測試 ⛔✨", expandable: true },
        ],
      },
      {
        title: "電力 · 電網",
        layers: [
          { key: "osmSubstationsEhv", label: "變電所 超高壓 EHV", expandable: true },
          { key: "substationEhvGlow", label: "變電所 EHV Bloom 測試 ⚡✨", expandable: true },
          { key: "osmSubstations", label: "變電所 區域 Substation", expandable: true },
          { key: "osmPowerLines", label: "高壓輸電線 Power Lines", expandable: true },
          { key: "powerLinesGlow", label: "高壓輸電線 Bloom 測試 ⚡✨", expandable: true },
          { key: "osmPowerTowers", label: "高壓鐵塔 Power Towers", expandable: true },
          { key: "powerPoles", label: "電桿 Power Poles (2.96M)", expandable: true },
        ],
      },
      {
        title: "再生能源",
        layers: [
          { key: "offshoreWindZones", label: "離岸風場 Offshore Wind", expandable: true },
          { key: "osmWindTurbines", label: "風機 Wind Turbines", expandable: true },
          { key: "windPlan", label: "風電場規劃 Wind Plan", expandable: true },
          { key: "geothermalWells", label: "地熱井 Geothermal", expandable: true },
          { key: "renewablePermitsTaipei", label: "北市再生能源許可 Renewable Permits", expandable: true },
          { key: "evChargingStations", label: "電動車充電站 EV Charging", expandable: true },
        ],
      },
      {
        title: "石化 · 加油站",
        layers: [
          { key: "gasStationCpc", label: "加油站 中油 CPC", expandable: true },
          { key: "gasStationFpcc", label: "加油站 台塑 FPCC", expandable: true },
          { key: "gasStationTaisugar", label: "加油站 台糖 Taisugar", expandable: true },
          { key: "gasStationOther", label: "加油站 其他 / 私營 Other", expandable: true },
          { key: "gasStationCanonical", label: "加油站 SSOT 合併 Canonical", expandable: true },
        ],
      },
      {
        title: "石化 · 油氣",
        layers: [
          { key: "lpgSubpackaging", label: "LPG 分裝 / 儲存場 Subpackaging", expandable: true },
          { key: "lpgRetailers", label: "LPG 加氣站 / 瓦斯行 Retailer", expandable: true },
          { key: "lngTerminal", label: "LNG 接收站 Terminal", expandable: true },
          { key: "pipelineGas", label: "天然氣主幹線 Gas Pipeline", expandable: true },
          { key: "pipelineOilGas", label: "油氣管線 OSM Oil/Gas Pipeline", expandable: true },
          { key: "industrialRefinery", label: "煉油 / 化工廠 Refinery", expandable: true },
          { key: "industrialStorageTank", label: "油氣儲槽 Storage Tank", expandable: true },
          { key: "industrialPowerPlant", label: "火力廠 polygon Thermal Plant", expandable: true },
          { key: "coalTerminal", label: "煤炭碼頭 Coal Terminal", expandable: true },
          { key: "fossilFuelInfra", label: "石化能源設施 Fossil Fuel (legacy)", expandable: true },
        ],
      },
      {
        title: "覆蓋分析",
        layers: [
          { key: "gasCoverageAll", label: "加油站 最近距離 Coverage All", expandable: true },
          { key: "gasCoverageCpc", label: "中油 最近距離 Coverage CPC", expandable: true },
          { key: "gasCoverageFpcc", label: "台塑 最近距離 Coverage FPCC", expandable: true },
          { key: "gasCoverageTaisugar", label: "台糖 最近距離 Coverage Taisugar", expandable: true },
          { key: "evIsland", label: "充電站 最近距離 EV Island", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🎓 EDUCATION 教育（2026-08-08 第 38 主題；上游 education 批次）
  // 🔴 6 個學校點層共用同一份 schools.geojson（4,315 點）：
  //    schools 為總覽（依學制上色），5 個 eduSchool* 為分級篩選，
  //    eduRemoteSchools 走 region_type 標記（非偏遠是 JSON null，見 educationTypes.ts）。
  //    schools 於本日自「基礎建設 → 公共設施」搬入本主題。
  //    eduUniversityStudents 雖在「學校」群，但讀自己的 university_students.geojson（159 筆，英文欄位）。
  // ───────────────────────────────────────────────────────────────
  {
    title: "教育 Education",
    defaultCollapsed: true,
    groups: [
      {
        title: "學校 Schools",
        layers: [
          fromManifest("schools"),
          fromManifest("eduSchoolElementary"),
          fromManifest("eduSchoolJunior"),
          fromManifest("eduSchoolSenior"),
          fromManifest("eduSchoolUniversity"),
          fromManifest("eduSchoolSpecial"),
          fromManifest("eduRemoteSchools"),
          fromManifest("eduUniversityStudents"),
        ],
      },
      {
        title: "校地 Campus",
        layers: [
          fromManifest("eduCampusPolygon"),
          // 與上一層同一份切片、同一個 sourceId（只下載一次），差別只在讀法：
          // 上層按學制分色，本層按 area_ha 分 5 級 —— 兩者可獨立開關也可疊看。
          fromManifest("eduCampusArea"),
        ],
      },
      // 🔴 高中就學區是**縣市級**，與前兩者的里級完全不同粒度 —— 三者各自獨立 toggle，
      //    且標籤直接寫明「（縣市級）」，避免使用者誤以為三層是同一套邊界的三個學制。
      {
        title: "學區 District",
        layers: [
          fromManifest("eduDistrictElementary"),
          fromManifest("eduDistrictJunior"),
          fromManifest("eduDistrictSenior"),
        ],
      },
      // 🔴 補習班是**每日更新**的資料源（此為快照），且點數 17,137 為四層之最 → 切片走 PMTiles，
      //    透明度／大小 slider 與其餘三層分開（見 useTransportParams 的 eduCramSchool* param）。
      {
        title: "幼托補習 Childcare & Cram",
        layers: [
          fromManifest("eduKindergarten"),
          fromManifest("eduCramSchool"),
          fromManifest("eduAfterschoolCare"),
          fromManifest("eduMutualCare"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏟️ SPORTS & LEISURE 運動休閒
  // ───────────────────────────────────────────────────────────────
  {
    title: "運動休閒 Sports & Leisure",
    defaultCollapsed: true,
    groups: [
      {
        title: "運動場館",
        layers: [
          fromManifest("sportsSchool"),
          fromManifest("sportsPublicOther"),
          fromManifest("sportsPrivate"),
          fromManifest("sportsPark"),
          fromManifest("sportsCenter"),
        ],
      },
      {
        title: "公園 Parks",
        layers: [
          fromManifest("parksTaipei"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🎭 CULTURE 文化
  // ───────────────────────────────────────────────────────────────
  {
    title: "文化 Culture",
    defaultCollapsed: true,
    groups: [
      {
        title: "設施 Facilities",
        layers: [
          fromManifest("culturalFacilities"),
          fromManifest("culturalMuseums"),
        ],
      },
      {
        title: "藝文活動 Arts & Events",
        layers: [
          fromManifest("artsEvents"),
          fromManifest("performingVenues"),
        ],
      },
      {
        title: "即時 Realtime",
        layers: [
          fromManifest("librarySeats"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛕 RELIGION 宗教（2026-08-02 第 36 主題；上游 religion 批次 23,074 點）
  // ───────────────────────────────────────────────────────────────
  {
    title: "宗教 Religion",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("religionTemples"),
          fromManifest("religionChurches"),
          fromManifest("religionAncestralHalls"),
          fromManifest("religionFoundations"),
          fromManifest("religionOtherWorship"),
        ],
      },
      {
        title: "精選",
        layers: [
          // 2026-08-02 自「觀光 → 玩・人文」搬來並更名（原 key tourReligion），
          // 對應上游 religion.top100（自 tourism.religion 搬移歸位）
          fromManifest("religionTop100"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚰️ FUNERAL 殯葬（2026-08-05 第 37 主題；上游 funeral 批次）
  // 🔴 A／B／C 三源分開不整合 —— 點位（A 官方名冊）／墓區範圍（B OSM 實際使用
  //    + C 都計法定劃設）／密度分析（A 區級）三個子群，讓使用者自行疊圖比對。
  // ───────────────────────────────────────────────────────────────
  {
    title: "殯葬 Funeral",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("funeralFacilities"),
          fromManifest("funeralOperators"),
        ],
      },
      {
        title: "墓區範圍",
        layers: [
          fromManifest("cemeteryOsm"),
          fromManifest("cemeteryZoning"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("funeralOperatorDensity"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🧳 TOURISM 觀光
  // ───────────────────────────────────────────────────────────────
  {
    title: "觀光 Tourism",
    defaultCollapsed: true,
    groups: [
      {
        title: "玩・自然 Nature",
        layers: [
          fromManifest("tourAttractions"),
          fromManifest("tourHotSprings"),
          fromManifest("tourHotSpringZones"),
          fromManifest("tourScenicAreas"),
        ],
      },
      {
        title: "玩・人文 Heritage",
        layers: [
          fromManifest("tourHeritage"),
        ],
      },
      {
        title: "玩・體驗 Experience",
        layers: [
          fromManifest("tourEvents"),
          fromManifest("tourFactories"),
          fromManifest("tourAmusementParks"),
          fromManifest("tourCamping"),
        ],
      },
      {
        title: "住・食 Stay & Eat",
        layers: [
          fromManifest("tourHotels"),
          fromManifest("tourRestaurants"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ♻️ WASTE 廢棄物
  // ───────────────────────────────────────────────────────────────
  {
    title: "廢棄物 Waste",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時",
        layers: [
          { key: "wasteTruck", label: "垃圾車 Truck (含音符)", expandable: true },
          { key: "wasteSchedule", label: "垃圾車（表定）Schedule", expandable: true },
          { key: "wasteScheduleNote", label: "　└ 表定音符 Notes 🎵" },
          { key: "wasteCleaningSquads", label: "清潔隊 Squads", labelMobile: "清潔隊 Squads (359) 🧹" },
        ],
      },
      {
        title: "投放點",
        layers: [
          { key: "wasteStopsStatic", label: "全台清運點位 Stops (靜態)", expandable: true },
          { key: "wdClothes", label: "衣物回收箱 Clothes", labelMobile: "衣物回收箱 Clothes Box (7,236)", expandable: true },
          { key: "wdMixed", label: "混合投放點 Mixed", labelMobile: "混合投放點 Mixed (6,368)", expandable: true },
          { key: "wdRecyclingContainer", label: "街頭資收桶 Container", labelMobile: "街頭資收桶 Container (145)", expandable: true },
          { key: "wdBattery", label: "電池回收 Battery", labelMobile: "電池回收 Battery (2)", expandable: true },
        ],
      },
      {
        title: "處理設施",
        layers: [
          { key: "wfIncinerator", label: "焚化爐 Incinerator", labelMobile: "焚化爐 Incinerator (30) 🔥", expandable: true },
          { key: "wfLandfill", label: "衛生掩埋場 Landfill", labelMobile: "衛生掩埋場 Landfill (154) 🟫", expandable: true },
          { key: "wfLandfillCoastal", label: "濱海掩埋場 Coastal", labelMobile: "濱海掩埋場 Coastal (23) 🌊", expandable: true },
          { key: "wfTransfer", label: "轉運站 Transfer", labelMobile: "轉運站 Transfer (28) 🚛", expandable: true },
          { key: "wfMedical", label: "醫療廢棄物 Medical", labelMobile: "醫療廢棄物 Medical (40) ⚕️", expandable: true },
          { key: "wfMonitoring", label: "地下水監測井 Monitor", labelMobile: "地下水監測井 Monitor (574) 🩸", expandable: true },
          { key: "wfRecycling", label: "資源回收廠 Recycling", labelMobile: "資源回收廠 Recycling (653) ♻️", expandable: true },
          { key: "wfScrapYard", label: "廢車 / 廢金屬 Scrap", labelMobile: "廢車 / 廢金屬 Scrap (3)", expandable: true },
          { key: "wfOther", label: "其他事廢設施 Other", labelMobile: "其他事廢設施 Other (3,164)", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏥 MEDICAL 醫療
  // ───────────────────────────────────────────────────────────────
  {
    title: "醫療 Medical",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("medHospital"),
          fromManifest("medClinic"),
          fromManifest("medPharmacy"),
          fromManifest("medAED"),
          fromManifest("medLTC"),
        ],
      },
      {
        title: "即時 Emergency",
        layers: [
          fromManifest("erHospital"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("medIsochrone"),
          fromManifest("medDesert"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚒 FIRE 消防
  // ───────────────────────────────────────────────────────────────
  {
    title: "消防 Fire & Rescue",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("fireStations"),
          fromManifest("fireHydrants"),
        ],
      },
      {
        title: "事件",
        layers: [
          fromManifest("fireEvents"),
          fromManifest("fireLatest"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("fireIsochrone"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚠️ HAZARD 災害
  // ───────────────────────────────────────────────────────────────
  {
    title: "災害 Hazard",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時警示",
        layers: [
          fromManifest("lifelineAlerts"),
          fromManifest("floodAlerts"),
          fromManifest("weatherAlerts"),
          fromManifest("transitAlerts"),
          fromManifest("safetyAlerts"),
        ],
      },
      {
        title: "地震 / 斷層",
        layers: [
          fromManifest("earthquakes"),
          fromManifest("earthquakeReplay"),
          fromManifest("activeFaults"),
        ],
      },
      {
        title: "雷暴",
        layers: [
          fromManifest("lightning"),
          fromManifest("lightningCwa"),
        ],
      },
      {
        // 山域事故：與「🌲 林業」的步道 / 通訊點 / 山屋 疊圖 = 登山安全敘事
        title: "山域事故 Mountain Rescue",
        layers: [
          fromManifest("mountainRescueIncidents"),
        ],
      },
      {
        title: "核安",
        layers: [
          fromManifest("nuclearRadiation"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛡️ CIVIL DEFENSE 民防避難
  // ───────────────────────────────────────────────────────────────
  {
    title: "民防避難 Civil Defense",
    defaultCollapsed: true,
    groups: [
      {
        title: "避難設施",
        layers: [
          fromManifest("civilDefenseShelter"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚓 LAW & ORDER 執法治安（4 子群、16 個 layer）
  // ───────────────────────────────────────────────────────────────
  {
    title: "執法治安 Law & Order",
    defaultCollapsed: true,
    groups: [
      {
        title: "警政",
        layers: [
          fromManifest("policeStation"),
          fromManifest("womenChildWarning"),
          fromManifest("speedCamera"),
          fromManifest("speedZoneSegment"),
        ],
      },
      {
        title: "警察覆蓋分析",
        layers: [
          fromManifest("policeIsoSubstation"),
          fromManifest("policeIsoPrecinct"),
          fromManifest("policeIsoCityDept"),
        ],
      },
      {
        title: "司法矯正",
        layers: [
          fromManifest("court"),
          fromManifest("prosecutorsOffice"),
          fromManifest("correctionalFacility"),
          fromManifest("courtJurisdiction"),
        ],
      },
      {
        title: "治安態勢",
        layers: [
          fromManifest("crimeAreaMonthly"),
          fromManifest("theftTaoyuan"),
          fromManifest("trafficAccidentYearly"),
          fromManifest("accidentTaipei"),
          fromManifest("a1AccidentRealtime"),
        ],
      },
      {
        title: "廉政移民海巡",
        layers: [
          fromManifest("investigationBureau"),
          fromManifest("antiCorruptionOffice"),
          fromManifest("immigrationOffice"),
          fromManifest("coastGuardStation"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌤️ ENV 環境氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "環境氣候 Environment",
    groups: [
      {
        title: "氣象",
        layers: [
          { key: "weatherStations", label: "氣象站 Weather Station", expandable: true },
          { key: "cwaCloudImagery", label: "衛星雲圖 Cloud Imagery", expandable: true },
          { key: "cwaRadarImagery", label: "雷達回波 Radar Imagery", expandable: true },
          { key: "temperatureWave", label: "溫度波 Temperature Wave", expandable: true },
          { key: "temperatureGrid", label: "溫度網格 Temperature Grid", expandable: true },
          { key: "urbanHeat", label: "都市熱島 Urban Heat", expandable: true },
        ],
      },
      {
        title: "空品",
        layers: [
          { key: "aqiImagery", label: "空氣品質色階 AQI Raster", expandable: true },
          { key: "aqiStations", label: "空氣品質測站 AQI Station", expandable: true },
          { key: "aqiMicroSensors", label: "LASS 微型感測 Micro Sensor", expandable: true },
        ],
      },
      {
        title: "環境污染",
        layers: [
          fromManifest("pollutionFacility"),
          { key: "pollutionPenaltyCritical", label: "重大裁處 Critical Penalty", labelMobile: "重大裁處 Critical", expandable: true },
          { key: "pollutionPenaltyGeneral", label: "一般裁處 General Penalty", labelMobile: "一般裁處 General", expandable: true },
          { key: "pollutionPenaltyMobile", label: "移動污染 Mobile Penalty", labelMobile: "移動污染 Mobile", expandable: true },
          { key: "pollutionSite", label: "污染場址 Site", labelMobile: "污染場址 Site (8,253)", expandable: true },
        ],
      },
      {
        title: "都市樹木 Urban Trees",
        layers: [
          { key: "streetTreesTaipeiDiff", label: "行道樹變化 Street Tree Diff", expandable: true },
          { key: "streetTreesTaipei3epoch", label: "行道樹三時點 Street Tree 3-Epoch", expandable: true },
          { key: "streetTreesNational", label: "行道樹全國 Street Trees TW", expandable: true },
          { key: "protectedTreesNational", label: "受保護樹木 Protected Trees", expandable: true },
          { key: "riversideTreesTaipei", label: "河濱喬木 Riverside Trees", expandable: true },
          { key: "treePitsTaipei", label: "人行道樹穴 Tree Pits", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 💧 WATER 水資源
  // ───────────────────────────────────────────────────────────────
  {
    title: "水資源 Water",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          { key: "waterFacilities", label: "水利設施 Facility", expandable: true },
          { key: "waterMonitorStations", label: "監測站 Monitor", expandable: true },
          { key: "waterReservoirs", label: "水庫 Reservoir", expandable: true },
          { key: "groundwaterWells", label: "水井點位 Wells", expandable: true },
          { key: "rainGauge", label: "即時雨量 Rain Gauge", expandable: true },
          { key: "riverLevel", label: "河川水位 River Level", expandable: true },
          { key: "floodSensor", label: "都市淹水感測 USWG", expandable: true },
          { key: "iotWraRiver", label: "IoT 河川 IoT River", expandable: true },
          { key: "iotWraStructure", label: "IoT 水工結構 IoT Structure", expandable: true },
          { key: "taipeiSewer", label: "北市下水道水位 Sewer (TP)", expandable: true },
          { key: "taipeiEvacuate", label: "北市疏散門 Evacuate Gate (TP)", expandable: true },
          { key: "taipeiPumb", label: "北市抽水站 Pumb Station (TP)", expandable: true },
        ],
      },
      {
        title: "面 / 線",
        layers: [
          { key: "waterBasins", label: "流域 Basin", expandable: true },
          { key: "waterRivers", label: "河川 River", expandable: true },
          { key: "waterLevees", label: "堤防 Levee", expandable: true },
          { key: "waterCanals", label: "灌排渠道 Canal", expandable: true },
          { key: "waterProtectionZones", label: "管制區 Protection", expandable: true },
          { key: "waterDetentionBasins", label: "滯洪池 Detention", expandable: true },
          { key: "groundwater", label: "地下水井 Groundwater", expandable: true },
          { key: "lakesPondsOsm", label: "湖泊 / 埤塘 Lakes & Ponds", expandable: true },
        ],
      },
      {
        title: "分析",
        layers: [
          { key: "waterFloodExtreme", label: "淹水潛勢 Flood 650mm/24h", expandable: true },
          { key: "floodSensorIsochrone", label: "淹水 3 分步行圈 Isochrone (雙北)", expandable: true },
          { key: "precipRaster", label: "累積雨量柵格 Precip Raster", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 GLOBAL CLIMATE 全球氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "全球氣候 Global Climate",
    defaultCollapsed: true,
    groups: [
      {
        title: "事件",
        layers: [
          fromManifest("earthquakesGlobal"),
          fromManifest("typhoonTracks"),
        ],
      },
      {
        title: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）",
        layers: [
          fromManifest("windField"),
          fromManifest("oceanCurrents"),
          fromManifest("dustForecast"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌾 AGRICULTURE 農業
  // ───────────────────────────────────────────────────────────────
  {
    title: "農業 Agriculture",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          { key: "agriPOI", label: "休農場 / 田媽媽 / 特色農旅 POI", expandable: true },
          { key: "agriRetail", label: "農產零售商 Retail", expandable: true },
          { key: "agriProduceWholesale", label: "蔬果批發商 Produce Wholesale", expandable: true },
          { key: "agriWholesaleMarket", label: "農產批發市場 Wholesale Market", expandable: true },
        ],
      },
      {
        title: "畜牧 Livestock",
        layers: [
          { key: "livestockFarmPig", label: "畜禽飼養場·豬 Pig Farms", expandable: true },
          { key: "livestockFarmChicken", label: "畜禽飼養場·雞 Chicken Farms", expandable: true },
          { key: "livestockFarmCattle", label: "畜禽飼養場·牛 Cattle Farms", expandable: true },
          { key: "livestockFarmDuck", label: "畜禽飼養場·鴨 Duck Farms", expandable: true },
          { key: "livestockFarmGoose", label: "畜禽飼養場·鵝 Goose Farms", expandable: true },
          { key: "livestockFarmSheep", label: "畜禽飼養場·羊 Sheep/Goat Farms", expandable: true },
          { key: "livestockFarmOther", label: "畜禽飼養場·其他 Other Farms", expandable: true },
          { key: "livestockSlaughter", label: "屠宰場 Slaughterhouses", expandable: true },
          { key: "livestockFeed", label: "飼料廠 Feed Factories", expandable: true },
          { key: "livestockMarket", label: "拍賣/批發市場 Markets", expandable: true },
        ],
      },
      {
        title: "養殖漁業 Aquaculture",
        layers: [
          { key: "aquaculturePonds", label: "逐口魚塭 Aquaculture Ponds", expandable: true },
          { key: "aquacultureZone", label: "養殖漁業生產區 Production Zone", expandable: true },
          { key: "aquacultureCageNet", label: "海上箱網 Cage Net", expandable: true },
          { key: "aquacultureWaterSatellite", label: "衛星偵測養殖水體 Satellite Detected", expandable: true },
          { key: "aquacultureWaterSatelliteMoa", label: "魚塭·官方標籤版(2026-07) MOA Labeled", expandable: true },
          { key: "aquacultureWaterUnion", label: "魚塭·整合版 (官方∪衛星) Union", expandable: true },
          { key: "aquacultureIntegrated", label: "養殖漁業整合 Integrated", expandable: true },
        ],
      },
      {
        title: "面 / 分區",
        layers: [
          { key: "agriculture", label: "農田範圍 FTW Fields 2025", expandable: true },
          { key: "agriLeisureFarmZones", label: "休閒農業區 Leisure Farm Zones", expandable: true },
          { key: "agriRuralRegen", label: "農村再生社區 Rural Regen", expandable: true },
          { key: "ecoNetworkZones", label: "國土綠網分區 Eco Network Zones", expandable: true },
        ],
      },
      {
        title: "土壤",
        layers: [
          { key: "agriSoil", label: "全台土壤分類 Soil Map", expandable: true },
          { key: "agriSoilFertility", label: "土壤肥力 250m Soil Fertility", expandable: true },
          { key: "agriCropSuitability", label: "作物適栽 Crop Suitability", expandable: true },
        ],
      },
      {
        title: "線",
        layers: [
          { key: "farmRoads", label: "農路 Farm Roads", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌲 FORESTRY 林業
  // ───────────────────────────────────────────────────────────────
  {
    title: "林業 Forestry",
    defaultCollapsed: true,
    groups: [
      {
        title: "分區",
        layers: [
          fromManifest("forestCompartments"),
          fromManifest("forestReserve"),
          fromManifest("forestRecreation"),
          fromManifest("forestFlatParks"),
          fromManifest("canopyHeight"),
          fromManifest("canopyGiants"),
        ],
      },
      {
        title: "點位",
        layers: [
          fromManifest("forestTreatmentWorks"),
          fromManifest("forestTrailSigns"),
          fromManifest("forestSignalPoints"),
          fromManifest("forestEducationCenters"),
          fromManifest("mountainHuts"),
          fromManifest("forestDamLakes"),
        ],
      },
      {
        title: "線",
        layers: [
          fromManifest("forestRoads"),
          fromManifest("forestAlishanRail"),
          fromManifest("hikingTrails"),
        ],
      },
      {
        title: "生態",
        layers: [
          fromManifest("forestWildlife"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰️ SPACE 太空
  // ───────────────────────────────────────────────────────────────
  {
    title: "太空 Space",
    defaultCollapsed: true,
    groups: [
      {
        title: "台灣",
        layers: [
          { key: "satellitesTaiwan", label: "台灣 FORMOSAT / TRITON / IRIS-C", expandable: true },
        ],
      },
      {
        title: "中國",
        layers: [
          { key: "satellitesYaogan", label: "Yaogan 遙感", expandable: true },
          { key: "satellitesJilin", label: "Jilin 吉林", expandable: true },
          { key: "satellitesGaofen", label: "Gaofen 高分", expandable: true },
          { key: "satellitesTJS", label: "TJS / TJSW GEO 情報", expandable: true },
          { key: "satellitesBeidou", label: "北斗 BD-3 PNT", expandable: true },
          { key: "satellitesShiyan", label: "Shiyan / Shijian 試驗", expandable: true },
        ],
      },
      {
        title: "國際偵察",
        layers: [
          { key: "satellitesUSA", label: "🇺🇸 USA · KH / BlackSky / Planet", expandable: true },
          { key: "satellitesJapan", label: "🇯🇵 Japan · IGS / ALOS", expandable: true },
          { key: "satellitesRussia", label: "🇷🇺 Russia · PERSONA / RESURS / COSMOS", expandable: true },
          { key: "satellitesIndia", label: "🇮🇳 India · CARTOSAT / RISAT / EOS", expandable: true },
          { key: "satellitesKorea", label: "🇰🇷 Korea · KOMPSAT", expandable: true },
          { key: "satellitesFrance", label: "🇫🇷 France · CSO / PLEIADES / ELISA", expandable: true },
          { key: "satellitesGermany", label: "🇩🇪 Germany · SAR-Lupe / SARah", expandable: true },
          { key: "satellitesItaly", label: "🇮🇹 Italy · COSMO-SkyMed", expandable: true },
          { key: "satellitesIsrael", label: "🇮🇱 Israel · Ofeq / EROS", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰 SITUATION 情勢 — 每日回顧型的情勢內容（非秒級即時）
  // ───────────────────────────────────────────────────────────────
  {
    title: "情勢 Situation",
    defaultCollapsed: true,
    groups: [
      {
        title: "事件",
        layers: [
          fromManifest("newsEvents"),
        ],
      },
      {
        title: "軍事",
        layers: [
          fromManifest("plaActivity"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 WORLD 世界（獨立 rail tab「世界」專屬；桌機主 Layers panel 排除此主題）
  // ───────────────────────────────────────────────────────────────
  {
    title: WORLD_THEME_TITLE,
    groups: [
      {
        title: "環境",
        layers: [
          fromManifest("worldTrashDebris"),
        ],
      },
    ],
  },

];

// ── SECTIONS（derived flat — backward compat for 兩個 sidebar 元件）──
// 每個 SubGroup 攤平為一筆 SectionDef，title = `主題 English · 子群中文`，
// 視覺上連續行構成主題分組。下一階段 sidebar 升級後可直接消費 THEMES。

export const SECTIONS: SectionDef[] = THEMES.flatMap((theme) =>
  theme.groups.map((group) => ({
    title: `${theme.title} · ${group.title}`,
    layers: group.layers,
  })),
);

// SECTIONS 派生 → 給 overlayManager hydrate 等需要 user-facing label 的場景查表
export const LAYER_LABELS: Partial<Record<keyof LayerVisibility, string>> = (() => {
  const out: Partial<Record<keyof LayerVisibility, string>> = {};
  for (const section of SECTIONS) {
    for (const def of section.layers) out[def.key] = def.label;
  }
  return out;
})();

// ── owner-only 私人圖層 SSOT（見 docs/features/owner-gated-layers）──
// 只有登入且 profiles.tier='owner' 的帳號能開啟。非 owner：sidebar 顯示鎖頭 + toggle no-op。
// DB 端由 migration 275 同步：對應 RPC 加 owner 檢查 + REVOKE anon。
// ⚠️ 明確排除（保持公開）：waterCanals（灌排渠道）、powerPoles（電桿 2.96M）。
export const GATED_LAYERS: ReadonlySet<keyof LayerVisibility> = new Set<keyof LayerVisibility>([
  // 畜牧 Livestock（改走 owner-only RPC；不含 livestockFeed / livestockMarket）
  "livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle", "livestockFarmDuck",
  "livestockFarmGoose", "livestockFarmSheep", "livestockFarmOther", "livestockSlaughter",
  // 石化 · 油氣
  "lpgSubpackaging", "lpgRetailers", "lngTerminal", "pipelineGas", "pipelineOilGas",
  "industrialRefinery", "industrialStorageTank", "industrialPowerPlant", "coalTerminal",
  "fossilFuelInfra",
  // 電力 · 電網
  "osmSubstationsEhv", "osmSubstations", "osmPowerLines", "osmPowerTowers",
  "substationEhvGlow", "powerLinesGlow",
  // 電力 · 廠
  "facPrimary", "facPlanned", "facHistorical", "facSecondary", "facOsmSupplement",
  "powerGenerationUnit", "powerPlantGlow",
  // 僅做 UI 鎖（資料載入路徑不動）
  "aviationRestrictedGlow",
  // 已從 sidebar 下架但 API 敏感（無鎖頭 UI；仍 gate 掉 bulk/chat 等程式化開啟路徑）
  "facOffshore", "osmPowerPlantsStatic", "powerPlants",
]);

/** 對某使用者而言此 key 是否上鎖（gated 且非 owner）。 */
export function isLayerLockedFor(key: keyof LayerVisibility, isOwner: boolean): boolean {
  return !isOwner && GATED_LAYERS.has(key);
}
