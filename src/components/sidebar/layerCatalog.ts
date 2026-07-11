// ══════════════════════════════════════════════════════════════════
//  Layer Catalog — Sidebar 圖層目錄「單一真實來源」
// ══════════════════════════════════════════════════════════════════
//
// LayerSidebar（手機版）與 IconRailSidebar（桌機版）共用此檔。
//
// 結構（2026-06-27 重組）：
// - 14 主題（Theme） → 多子群（SubGroup） → 多 Layer
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
// 2. 主題順序依「日常使用頻率」+「故事性」：MOVE → PEOPLE → ENV → WATER
//    → HAZARD → FIRE → MEDICAL → AGRI → FOREST → WASTE → ENERGY
//    → INFRA → ESTATE → SPACE → NEWS
// 3. 每主題內子群順序：點位 → 線/面 → 即時 → 分析

import type { LayerVisibility, TransportType } from "../../types";

// ── Color Config ──

export const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  rail: "#ee6c00",
  stationsTHSR: "#ff8c00",
  stationsTRA: "#b8a080",
  stationsMetro: "#00bcd4",
  ports: "#4a90d9",
  lighthouses: "#ffd700",
  airports: "#daa520",
  highways: "#ff6b6b",
  provincialRoads: "#ffa94d",
  cctv: "#26c6da",
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
  h3Population: "#ff6b6b",
  popCount: "#f9bd31",
  indicators: "#e25822",
  socioeconomic: "#7c4dff",
  spatialEconomy: "#ff6e40",
  temperatureWave: "#ff6b35",
  schools: "#42a5f5",
  convenienceStores: "#26c6da",
  submarineCables: "#2196F3",
  landingStations: "#26c6da",
  activeFaults: "#ef5350",
  newsEvents: "#ff9800",
  youbikeFullness: "#f57c00",
  earthquakes: "#ff3b30",
  // 全球氣候 GLOBAL CLIMATE
  earthquakesGlobal: "#dc2626",
  typhoonTracks: "#a855f7",
  dustForecast: "#b45309",
  oceanCurrents: "#0ea5e9",
  windField: "#94a3b8",
  lifelineAlerts: "#facc15",
  floodAlerts: "#2563eb",
  weatherAlerts: "#7c3aed",
  transitAlerts: "#f97316",
  safetyAlerts: "#ef4444",
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
  floodSensor: "#ef4444",
  floodSensorIsochrone: "#ef4444",
  taipeiSewer: "#3b82f6",
  taipeiEvacuate: "#22c55e",
  taipeiPumb: "#06b6d4",
  precipRaster: "#60a5fa",
  fireEvents: "#ff5722",
  fireLatest: "#ff1744",
  fireStations: "#e53935",
  fireHydrants: "#2196f3",
  fireIsochrone: "#22c55e",
  medHospital: "#d32f2f",
  medClinic: "#1976d2",
  medPharmacy: "#388e3c",
  medAED: "#fbc02d",
  medLTC: "#8e24aa",
  medIsochrone: "#22c55e",
  medDesert: "#ef4444",
  medICUBeds: "#ff1744",
  erHospital: "#ef4444",
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
  sportsSchool: "#5c6bc0",
  sportsPublicOther: "#26a69a",
  sportsPrivate: "#ef6c00",
  sportsPark: "#66bb6a",
  sportsCenter: "#ec407a",
  farmRoads: "#7a8670",
  ecoNetworkZones: "#4caf50",
  forestCompartments: "#15803D",
  forestReserve: "#0F766E",
  forestRecreation: "#65A30D",
  forestRoads: "#A16207",
  forestTreatmentWorks: "#F59E0B",
  forestTrailSigns: "#84CC16",
  forestSignalPoints: "#22C55E",
  forestEducationCenters: "#0EA5E9",
  forestWildlife: "#A855F7",
  forestDamLakes: "#06B6D4",
  forestFlatParks: "#A3E635",
  forestAlishanRail: "#92400E",
  hikingTrails: "#d62728",
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
  lightning: "#fb923c",
  nuclearRadiation: "#22c55e",
  realEstateRentalGrid: "#41919A",
  realEstateRentalPoint: "#41919A",
  realEstateSaleGrid: "#d73027",
  realEstateSalePoint: "#d73027",
  realEstatePresaleGrid: "#fd8d3c",
  realEstatePresalePoint: "#fd8d3c",
  countyBoundary: "#4b5563",
  townshipBoundary: "#6b7280",
  villageBoundary: "#9ca3af",
  contour25k: "#8B4513",
  contourDtm20: "#a16207",
  osmRoadDrive: "#fb923c",
  osmExpressway: "#FF8C00",
  hillshade: "#6b7280",
  slope: "#e67e22",
  aspect: "#22c55e",
  slopeVector: "#fc8d59",
  aspectVector: "#ff7f00",
  // 警政司法民防 17 layer
  policeStation: "#1e40af",          // 警察 — 深藍
  womenChildWarning: "#ec4899",      // 婦幼 — 粉
  speedCamera: "#dc2626",            // 測速 — 紅
  speedZoneSegment: "#b91c1c",       // 區間測速 — 深紅
  court: "#7c3aed",                  // 法院 — 紫
  prosecutorsOffice: "#a855f7",      // 檢察署 — 淺紫
  correctionalFacility: "#374151",   // 矯正 — 鐵灰
  courtJurisdiction: "#c4b5fd",      // 法院管轄區 — 紫白（polygon fill）
  crimeAreaMonthly: "#991b1b",       // 鄉鎮犯罪 choropleth — 暗紅
  theftTaoyuan: "#f59e0b",           // 竊盜 — 橙
  trafficAccidentYearly: "#fb7185",  // A1 死亡 — 玫紅
  accidentTaipei: "#fda4af",         // 北市事故 — 淡玫
  a1AccidentRealtime: "#ef4444",     // A1 realtime — 鮮紅
  investigationBureau: "#0f766e",    // 調查局 — 墨綠
  antiCorruptionOffice: "#14b8a6",   // 廉政 — 青
  immigrationOffice: "#0ea5e9",      // 移民 — 天藍
  coastGuardStation: "#0284c7",      // 海巡 — 海藍
  civilDefenseShelter: "#64748b",    // 防空避難 — 鋼灰
  aviationControl: "#4682B4",        // ✈️ 飛航情報 / 終端管制（TMA 深藍代表色）
  aviationRestricted: "#DC3545",     // ⛔ 機場管制 / 限航 / 危險（RCR 紅代表色）
  droneNoFlyZone: "#DC3545",         // 🚫 無人機禁航區（紅+未分類）
  droneRestrictedZone: "#FFC107",    // ⚠️ 無人機限航區（黃，需申請）
  // 警察覆蓋分析 isochrone（overlap_count step 色階，這裡填代表色給圖例）
  policeIsoSubstation: "#1e40af",
  policeIsoPrecinct: "#3b82f6",
  policeIsoCityDept: "#60a5fa",
  // 環境污染 POLLUTION
  pollutionFacility: "#f97316",
  pollutionPenaltyCritical: "#ef4444",
  pollutionPenaltyGeneral: "#94a3b8",
  pollutionPenaltyMobile: "#22c55e",
  pollutionSite: "#111827",
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
  /** 預設是否摺疊（BASE = true，其餘 false） */
  defaultCollapsed?: boolean;
  groups: SubGroupDef[];
}

// 舊型別保留 — 用於 SECTIONS derived flat 結構（兩個 sidebar 元件目前消費此型）
export interface SectionDef {
  title: string;
  layers: LayerDef[];
}

// ── THEMES（新 SSOT）──

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
          { key: "countyBoundary", label: "縣市界 County", expandable: true },
          { key: "townshipBoundary", label: "鄉鎮市區界 Township", expandable: true },
          { key: "villageBoundary", label: "村里界 Village", expandable: true },
        ],
      },
      {
        title: "地形",
        layers: [
          { key: "contour25k", label: "等高線 Contour 25k (10m)", labelMobile: "等高線 25k 10m", expandable: true },
          { key: "contourDtm20", label: "等高線 Contour DTM20 (20m)", labelMobile: "等高線 DTM 20m", expandable: true },
          { key: "hillshade", label: "山體陰影 Hillshade", expandable: true },
          { key: "slope", label: "坡度 Slope (0-45°)", labelMobile: "坡度", expandable: true },
          { key: "aspect", label: "坡向 Aspect (HSV)", labelMobile: "坡向", expandable: true },
          { key: "slopeVector", label: "坡度分級 Slope 6級", labelMobile: "坡度分級", expandable: true },
          { key: "aspectVector", label: "坡向分級 Aspect 8向", labelMobile: "坡向分級", expandable: true },
        ],
      },
      {
        title: "道路底圖",
        layers: [
          { key: "osmRoadDrive", label: "OSM 道路 OSM Roads", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚦 MOVE 交通
  // ───────────────────────────────────────────────────────────────
  {
    title: "交通 Move",
    groups: [
      {
        title: "即時運具",
        layers: [
          { key: "flights", label: "航班 Flight", expandable: true },
          { key: "ships", label: "船舶 Ship", expandable: true },
          { key: "rail", label: "鐵道 Rail", expandable: true },
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
          { key: "cctv", label: "道路攝影機 CCTV", expandable: true },
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
    groups: [
      {
        title: "人口分布",
        layers: [
          { key: "popCount", label: "人口數 Population", expandable: true },
          { key: "h3Population", label: "人流模擬 Pop. Flow", expandable: true },
          { key: "indicators", label: "人口指標 Indicators", expandable: true },
        ],
      },
      {
        title: "社經",
        layers: [
          { key: "socioeconomic", label: "社經面貌 Socio-Econ", expandable: true },
          { key: "spatialEconomy", label: "空間經濟 Spatial-Econ", expandable: true },
        ],
      },
      {
        title: "共享運具",
        layers: [
          { key: "youbikeFullness", label: "YouBike 有車率 Fullness", expandable: true },
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
          { key: "pollutionFacility", label: "污染潛勢設施 Facility", labelMobile: "污染潛勢設施 Facility (152k)", expandable: true },
          { key: "pollutionPenaltyCritical", label: "重大裁處 Critical Penalty", labelMobile: "重大裁處 Critical", expandable: true },
          { key: "pollutionPenaltyGeneral", label: "一般裁處 General Penalty", labelMobile: "一般裁處 General", expandable: true },
          { key: "pollutionPenaltyMobile", label: "移動污染 Mobile Penalty", labelMobile: "移動污染 Mobile", expandable: true },
          { key: "pollutionSite", label: "污染場址 Site", labelMobile: "污染場址 Site (8,253)", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 💧 WATER 水資源
  // ───────────────────────────────────────────────────────────────
  {
    title: "水資源 Water",
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
  // ⚠️ HAZARD 災害
  // ───────────────────────────────────────────────────────────────
  {
    title: "災害 Hazard",
    groups: [
      {
        title: "即時警示",
        layers: [
          { key: "lifelineAlerts", label: "民生中斷 Lifeline", expandable: true },
          { key: "floodAlerts", label: "水文防汛 Flood Alerts", expandable: true },
          { key: "weatherAlerts", label: "氣象特報 Weather Alerts", expandable: true },
          { key: "transitAlerts", label: "交通阻斷 Transit Alerts", expandable: true },
          { key: "safetyAlerts", label: "安全環境 Safety Alerts", expandable: true },
        ],
      },
      {
        title: "地震 / 斷層",
        layers: [
          { key: "earthquakes", label: "地震 Earthquake", expandable: true },
          { key: "activeFaults", label: "活動斷層 Fault Zone", expandable: true },
        ],
      },
      {
        title: "雷暴",
        layers: [
          { key: "lightning", label: "落雷 Lightning 60min", expandable: true },
        ],
      },
      {
        title: "核安",
        layers: [
          { key: "nuclearRadiation", label: "核安輻射 Radiation", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 GLOBAL CLIMATE 全球氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "全球氣候 Global Climate",
    groups: [
      {
        title: "事件",
        layers: [
          { key: "earthquakesGlobal", label: "全球地震 USGS Earthquake", expandable: true },
          { key: "typhoonTracks", label: "颱風軌跡 Typhoon Track", expandable: true },
        ],
      },
      {
        title: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）",
        layers: [
          { key: "windField", label: "風場 Wind Field 10m", expandable: true },
          { key: "oceanCurrents", label: "海流 Ocean Currents", expandable: true },
          { key: "dustForecast", label: "沙塵預報 Dust Forecast", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚒 FIRE 消防
  // ───────────────────────────────────────────────────────────────
  {
    title: "消防 Fire & Rescue",
    groups: [
      {
        title: "點位",
        layers: [
          { key: "fireStations", label: "消防分隊 Fire Station", expandable: true },
          { key: "fireHydrants", label: "消防栓 Hydrant", expandable: true },
        ],
      },
      {
        title: "事件",
        layers: [
          { key: "fireEvents", label: "火災歷史 Fire History", expandable: true },
          { key: "fireLatest", label: "火災 最新年度 Latest", expandable: true },
        ],
      },
      {
        title: "分析",
        layers: [
          { key: "fireIsochrone", label: "救援等時圈 Isochrone", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏥 MEDICAL 醫療
  // ───────────────────────────────────────────────────────────────
  {
    title: "醫療 Medical",
    groups: [
      {
        title: "點位",
        layers: [
          { key: "medHospital", label: "醫院 Hospital", expandable: true },
          { key: "medClinic", label: "診所 / 其他醫療 Clinic", expandable: true },
          { key: "medPharmacy", label: "藥局 Pharmacy", expandable: true },
          { key: "medAED", label: "AED 點位 AED", expandable: true },
          { key: "medLTC", label: "長照機構 LTC", expandable: true },
        ],
      },
      {
        title: "即時 Emergency",
        layers: [
          { key: "erHospital", label: "急診壅塞 ER", expandable: true },
        ],
      },
      {
        title: "分析",
        layers: [
          { key: "medIsochrone", label: "醫療等時圈 Isochrone", expandable: true },
          { key: "medDesert", label: "醫療沙漠 Desert", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌾 AGRICULTURE 農業
  // ───────────────────────────────────────────────────────────────
  {
    title: "農業 Agriculture",
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
  // 🏟️ SPORTS 運動場館
  // ───────────────────────────────────────────────────────────────
  {
    title: "運動 Sports",
    groups: [
      {
        title: "運動場館",
        layers: [
          { key: "sportsSchool", label: "學校場館 School", expandable: true },
          { key: "sportsPublicOther", label: "其他公共場館 Public", expandable: true },
          { key: "sportsPrivate", label: "民營場館 Private", expandable: true },
          { key: "sportsPark", label: "運動公園/開放空間 Park", expandable: true },
          { key: "sportsCenter", label: "國民運動中心 Sports Center", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌲 FORESTRY 林業
  // ───────────────────────────────────────────────────────────────
  {
    title: "林業 Forestry",
    groups: [
      {
        title: "分區",
        layers: [
          { key: "forestCompartments", label: "林班 Compartments", expandable: true },
          { key: "forestReserve", label: "保安林 Reserve", expandable: true },
          { key: "forestRecreation", label: "森林遊樂區 Recreation", expandable: true },
          { key: "forestFlatParks", label: "平地森林 Flat Parks", expandable: true },
        ],
      },
      {
        title: "點位",
        layers: [
          { key: "forestTreatmentWorks", label: "治理工程 Treatment Works", expandable: true },
          { key: "forestTrailSigns", label: "步道路標 Trail Signs", expandable: true },
          { key: "forestSignalPoints", label: "通訊點 Signal Points", expandable: true },
          { key: "forestEducationCenters", label: "自然教育中心 Education", expandable: true },
          { key: "forestDamLakes", label: "堰塞湖 Dam Lakes", expandable: true },
        ],
      },
      {
        title: "線",
        layers: [
          { key: "forestRoads", label: "林道 Forest Roads", expandable: true },
          { key: "forestAlishanRail", label: "阿里山鐵路 Alishan Rail", expandable: true },
          { key: "hikingTrails", label: "全台步道 Hiking Trails", labelMobile: "全台步道 Hiking Trails (7,339)", expandable: true },
        ],
      },
      {
        title: "生態",
        layers: [
          { key: "forestWildlife", label: "野生動物分布 Wildlife", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ♻️ WASTE 廢棄物
  // ───────────────────────────────────────────────────────────────
  {
    title: "廢棄物 Waste",
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
  // ⚡ ENERGY 能源
  // ───────────────────────────────────────────────────────────────
  {
    title: "能源 Energy",
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
  // 🏗️ INFRA 基礎建設
  // ───────────────────────────────────────────────────────────────
  {
    title: "基礎建設 Infrastructure",
    groups: [
      {
        title: "通訊",
        layers: [
          { key: "submarineCables", label: "通訊海纜 Submarine Cable", expandable: true },
          { key: "landingStations", label: "海纜登陸站 Landing Station", expandable: true },
        ],
      },
      {
        title: "公共設施",
        layers: [
          { key: "schools", label: "學校 School", expandable: true },
          { key: "convenienceStores", label: "超商 Convenience Store", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏠 ESTATE 房地產
  // ───────────────────────────────────────────────────────────────
  {
    title: "房地產 Real Estate",
    groups: [
      {
        title: "租賃",
        layers: [
          { key: "realEstateRentalGrid", label: "租賃熱力圖 Rental Grid", expandable: true },
          { key: "realEstateRentalPoint", label: "租賃交易點 Rental Point", expandable: true },
        ],
      },
      {
        title: "買賣",
        layers: [
          { key: "realEstateSaleGrid", label: "買賣熱力圖 Sale Grid", expandable: true },
          { key: "realEstateSalePoint", label: "買賣交易點 Sale Point", expandable: true },
        ],
      },
      {
        title: "預售",
        layers: [
          { key: "realEstatePresaleGrid", label: "預售熱力圖 Presale Grid", expandable: true },
          { key: "realEstatePresalePoint", label: "預售交易點 Presale Point", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰️ SPACE 太空
  // ───────────────────────────────────────────────────────────────
  {
    title: "太空 Space",
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
  // 📰 NEWS 新聞
  // ───────────────────────────────────────────────────────────────
  {
    title: "新聞 News",
    groups: [
      {
        title: "事件",
        layers: [
          { key: "newsEvents", label: "新聞事件 News Events", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚓 LAW & ORDER 執法治安（4 子群、16 個 layer）
  // ───────────────────────────────────────────────────────────────
  {
    title: "執法治安 Law & Order",
    groups: [
      {
        title: "警政",
        layers: [
          { key: "policeStation", label: "警察機關 Police", expandable: true },
          { key: "womenChildWarning", label: "婦幼警示點 Women/Child Warning", expandable: true },
          { key: "speedCamera", label: "測速照相 Speed Camera", expandable: true },
          { key: "speedZoneSegment", label: "區間測速 Speed Zone", expandable: true },
        ],
      },
      {
        title: "警察覆蓋分析",
        layers: [
          { key: "policeIsoSubstation", label: "派出所 5/10 min", expandable: true },
          { key: "policeIsoPrecinct", label: "分局 15/30 min", expandable: true },
          { key: "policeIsoCityDept", label: "縣市警局 30/60 min", expandable: true },
        ],
      },
      {
        title: "司法矯正",
        layers: [
          { key: "court", label: "法院 Courts", expandable: true },
          { key: "prosecutorsOffice", label: "檢察署 Prosecutors", expandable: true },
          { key: "correctionalFacility", label: "矯正機關 Correctional", expandable: true },
          { key: "courtJurisdiction", label: "法院管轄區 Jurisdiction", expandable: true },
        ],
      },
      {
        title: "治安態勢",
        layers: [
          { key: "crimeAreaMonthly", label: "鄉鎮犯罪統計 Crime Area", expandable: true },
          { key: "theftTaoyuan", label: "桃園竊盜 Theft Taoyuan", expandable: true },
          { key: "trafficAccidentYearly", label: "A1 死亡事故 Fatal Accident", expandable: true },
          { key: "accidentTaipei", label: "北市事故點 Taipei Dots", expandable: true },
          { key: "a1AccidentRealtime", label: "A1 即時事故 A1 Realtime", expandable: true },
        ],
      },
      {
        title: "廉政移民海巡",
        layers: [
          { key: "investigationBureau", label: "調查局 MJIB", expandable: true },
          { key: "antiCorruptionOffice", label: "廉政署 AAC", expandable: true },
          { key: "immigrationOffice", label: "移民署 Immigration", expandable: true },
          { key: "coastGuardStation", label: "海巡 Coast Guard", expandable: true },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛡️ CIVIL DEFENSE 民防避難
  // ───────────────────────────────────────────────────────────────
  {
    title: "民防避難 Civil Defense",
    groups: [
      {
        title: "避難設施",
        layers: [
          { key: "civilDefenseShelter", label: "防空避難 Civil Defense Shelters", expandable: true },
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
