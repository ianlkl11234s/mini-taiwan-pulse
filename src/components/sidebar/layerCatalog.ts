// ══════════════════════════════════════════════════════════════════
//  Layer Catalog — Sidebar 圖層目錄「單一真實來源」
// ══════════════════════════════════════════════════════════════════
//
// LayerSidebar（手機版）與 IconRailSidebar（桌機版）共用此檔，
// 消除過去兩邊各自複製 LAYER_COLORS / SECTIONS / TRANSPORT_LABELS
// 導致的漂移（新 layer 只補一邊）。
//
// 規則：
// - LAYER_COLORS：型別強制 Record<keyof LayerVisibility, string>，
//   缺 key 會 tsc 報錯 → 新增 layer 必補色。
// - SECTIONS：以「桌機 IconRailSidebar 版」結構為主（主要介面）。
//   label   = 桌機版顯示文字（預設）。
//   labelMobile = 手機 LayerSidebar 若需不同文字（多為較長全稱）才填，
//                 未填則手機沿用 label。
//
// ⚠️ 桌機/手機 SECTIONS 差異（沿用桌機為主，手機原本沒有的 section 將一併顯示）：
//   - INFRA 多 submarineCables / landingStations（手機原本缺）
//   - 多 FACILITY section（schools / convenienceStores，手機原本缺）
//   - 多 NEWS section（newsEvents，手機原本缺）
//   - ENVIRON 多 cwaCloudImagery / cwaRadarImagery（手機原本缺）
//   詳見任務回報。

import type { LayerVisibility, TransportType } from "../../types";

// ── Color Config ──
// 取兩邊聯集；cwaCloudImagery / cwaRadarImagery 兩邊原本色值漂移，
// 此處以桌機 IconRailSidebar 版為準。

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
  farmRoads: "#7a8670",
  ecoNetworkZones: "#4caf50",
  // FORESTRY 12 base
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
  wasteRoute: "#84cc16",
  wasteStop: "#65a30d",
  // facility 8 sub-types
  wfIncinerator: "#ef4444",
  wfLandfill: "#92400e",
  wfTransfer: "#a855f7",
  wfMedical: "#ec4899",
  wfMonitoring: "#3b82f6",
  wfRecycling: "#22c55e",
  wfScrapYard: "#737373",
  wfOther: "#6b7280",
  // disposal points 4 sub-types
  wdClothes: "#f97316",
  wdMixed: "#14b8a6",
  wdRecyclingContainer: "#84cc16",
  wdBattery: "#fbbf24",
  // SPACE 衛星 (CN 6 + TW + 9 國 LEO 遙測)
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
  // 能源 ENERGY MVP（feat/energy-mvp）— 色配合 fuel_type 主視覺
  powerPlants: "#facc15",          // 黃（核能主色 → 圖例代表色）
  powerStatusHud: "#22c55e",       // 燈號綠（G）
  powerRegionDemand: "#3b82f6",    // 區域藍
  powerGenerationUnit: "#f97316",  // 機組橙（光柱主色）
  osmSubstations: "#a78bfa",       // 變電所紫
  osmPowerLines: "#22d3ee",        // 高壓輸電線 cyan-400（161kV 主色）
  osmPowerTowers: "#0ea5e9",       // 高壓鐵塔 sky-500（69kV 配電色）
  osmWindTurbines: "#67e8f9",      // 風機 cyan-300（offshore 主色）
  osmSolarFarms: "#fbbf24",        // 光電 amber-400
  osmPowerPlantsStatic: "#9ca3af", // OSM 電廠 灰（plant_source 在 paint 內分色）
  offshoreWindZones: "#22d3ee",    // 離岸風電潛力場址 cyan-400 fill
  islandPowerGrid: "#a78bfa",      // 離島電網 violet（其他 fuel 在 paint 分色）
  fossilFuelInfra: "#1f2937",      // 化石燃料 深黑（oil_refinery 代表色）
  geothermalWells: "#ef4444",      // 地熱井 red（熱泉語意）
  renewablePermitsTaipei: "#fbbf24", // 北市再生 amber（學校最多，amber 代表色）
  evChargingStations: "#10b981",   // 充電綠
  // Phase 8 SSOT facilities 6-layer（用戶指定色票）
  facPrimary: "#F2D64B",           // oil_gas 油氣黃（主要運轉中代表 — 黃是最大量）
  facOffshore: "#1F4373",          // wind 深藍（離岸風場）
  facPlanned: "#F2E085",           // solar 淡黃（規劃中常見光電）
  facHistorical: "#8C5D42",        // geothermal 棕（歷史沉感）
  facSecondary: "#8C7C4A",         // bioenergy 卡其（小型分散）
  facOsmSupplement: "#94a3b8",     // 中性灰
  // HAZARD（v2 Phase B）
  lightning: "#fb923c",             // 落雷橘（雲對地主色）
  nuclearRadiation: "#22c55e",      // 核安綠（正常背景值代表色）
};

// ── Transport Labels ──
// 用於判斷某 layer 是否為運具（key in TRANSPORT_LABELS）。

export const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: "航班 Flight",
  ships: "船舶 Ship",
  rail: "鐵道 Rail",
  busLive: "公車 Bus",
  busIntercityLive: "公路客運 InterCity",
};

// ── Section Config ──

export interface LayerDef {
  key: keyof LayerVisibility;
  /** 桌機 IconRailSidebar 顯示文字（預設） */
  label: string;
  /** 手機 LayerSidebar 顯示文字（多為較長全稱）；未填則沿用 label */
  labelMobile?: string;
  expandable?: boolean;
}

export interface SectionDef {
  title: string;
  layers: LayerDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    title: "MOVING",
    layers: [
      { key: "flights", label: "航班 Flight", expandable: true },
      { key: "ships", label: "船舶 Ship", expandable: true },
      { key: "rail", label: "鐵道 Rail", expandable: true },
      { key: "busLive", label: "公車 Bus", expandable: true },
      { key: "busIntercityLive", label: "公路客運 InterCity", expandable: true },
    ],
  },
  {
    title: "STATION",
    layers: [
      { key: "stationsTHSR", label: "高鐵站 THSR st.", labelMobile: "高鐵站 THSR Station", expandable: true },
      { key: "stationsTRA", label: "台鐵站 TRA st.", labelMobile: "台鐵站 TRA Station", expandable: true },
      { key: "stationsMetro", label: "捷運站 Metro st.", labelMobile: "捷運站 Metro Station", expandable: true },
      { key: "busStationsCity", label: "市區公車 City Bus", labelMobile: "市區公車站 City Bus", expandable: true },
      { key: "busStationsIntercity", label: "客運 Intercity", labelMobile: "公路客運站 Intercity", expandable: true },
      { key: "bikeStations", label: "自行車站 Bike st.", labelMobile: "公共腳踏車 Bike", expandable: true },
    ],
  },
  {
    title: "ROUTE",
    layers: [
      { key: "highways", label: "國道 Highway", expandable: true },
      { key: "provincialRoads", label: "省道 Prov. Road", labelMobile: "省道 Prov.Road", expandable: true },
      { key: "cyclingRoutes", label: "自行車道 Cycling", expandable: true },
      { key: "cctv", label: "道路攝影機 CCTV", expandable: true },
      { key: "etcGantry", label: "ETC 收費門架 Gantry", expandable: true },
      { key: "serviceArea", label: "國道服務區 Service Area", expandable: true },
      { key: "serviceAreaPolygon", label: "國道服務區範圍 SA Area", expandable: true },
      { key: "taxiStand", label: "計程車招呼站 Taxi Stand", expandable: true },
    ],
  },
  {
    title: "INFRA",
    layers: [
      { key: "ports", label: "港口 Port", labelMobile: "碼頭 Port", expandable: true },
      { key: "airports", label: "機場 Airport", expandable: true },
      { key: "lighthouses", label: "燈塔 Lighthouse", expandable: true },
      { key: "submarineCables", label: "通訊海纜 Submarine Cable", expandable: true },
      { key: "landingStations", label: "海纜登陸站 Landing Stn.", expandable: true },
    ],
  },
  {
    title: "ANALYTICS",
    layers: [
      { key: "h3Population", label: "人口流動 Pop. Flow", labelMobile: "人流模擬 Pop. Flow", expandable: true },
      { key: "popCount", label: "人口數 Population", expandable: true },
      { key: "indicators", label: "指標 Indicators", labelMobile: "人口指標 Indicators", expandable: true },
      { key: "socioeconomic", label: "社經 Socio-Econ", labelMobile: "社經面貌 Socio-Econ", expandable: true },
      { key: "spatialEconomy", label: "空間經濟 Spatial", labelMobile: "空間經濟 Spatial-Econ", expandable: true },
      { key: "youbikeFullness", label: "YouBike 有車率", expandable: true },
    ],
  },
  {
    title: "MONITOR",
    layers: [
      { key: "freewayCongestion", label: "國道壅塞 Congestion", expandable: true },
      { key: "roadEvents", label: "即時路況 Road Events", expandable: true },
    ],
  },
  {
    title: "ENVIRON",
    layers: [
      { key: "weatherStations", label: "氣象站 Weather", expandable: true },
      { key: "windPlan", label: "風電場 Wind Farm", labelMobile: "風場範圍 Wind Farm", expandable: true },
      { key: "temperatureWave", label: "溫度波 Temperature", expandable: true },
      { key: "cwaCloudImagery", label: "衛星雲圖 Cloud", expandable: true },
      { key: "cwaRadarImagery", label: "雷達回波 Radar", expandable: true },
      { key: "aqiImagery", label: "空氣品質色階 AQI Raster", expandable: true },
      { key: "aqiStations", label: "空氣品質測站 AQI Station", expandable: true },
      { key: "aqiMicroSensors", label: "LASS 微型感測 Micro Sensor", expandable: true },
    ],
  },
  {
    title: "FACILITY",
    layers: [
      { key: "schools", label: "學校 School", expandable: true },
      { key: "convenienceStores", label: "超商 Convenience", expandable: true },
    ],
  },
  {
    title: "HAZARD",
    layers: [
      { key: "activeFaults", label: "活動斷層 Fault Zone", expandable: true },
      { key: "earthquakes", label: "地震 Earthquake", expandable: true },
      { key: "lifelineAlerts", label: "民生中斷 Lifeline", expandable: true },
      { key: "floodAlerts", label: "水文防汛 Flood Alerts", expandable: true },
      { key: "weatherAlerts", label: "氣象特報 Weather Alerts", expandable: true },
      { key: "transitAlerts", label: "交通阻斷 Transit Alerts", expandable: true },
      { key: "safetyAlerts", label: "安全環境 Safety Alerts", expandable: true },
    ],
  },
  {
    title: "FIRE & RESCUE",
    layers: [
      { key: "fireEvents", label: "火災歷史 Fire (歷史)", expandable: true },
      { key: "fireLatest", label: "火災 最新年度 Latest", expandable: true },
      { key: "fireStations", label: "消防分隊 Stations", expandable: true },
      { key: "fireHydrants", label: "消防栓 Hydrants", expandable: true },
      { key: "fireIsochrone", label: "救援等時圈 Isochrone", expandable: true },
    ],
  },
  {
    title: "MEDICAL",
    layers: [
      { key: "medHospital", label: "醫院 Hospital", expandable: true },
      { key: "medClinic", label: "診所/其他醫療 Clinic", expandable: true },
      { key: "medPharmacy", label: "藥局 Pharmacy", expandable: true },
      { key: "medAED", label: "AED 點位", expandable: true },
      { key: "medLTC", label: "長照機構 LTC", expandable: true },
      { key: "medIsochrone", label: "醫療等時圈 Isochrone", expandable: true },
      { key: "medDesert", label: "醫療沙漠 Desert", expandable: true },
      // medICUBeds（急重症床位）Phase 3 尚未實作渲染 — 避免幽靈 toggle，先不上 sidebar
      // 實作後恢復：{ key: "medICUBeds", label: "急重症床位 ICU Beds", expandable: true },
    ],
  },
  {
    title: "NEWS",
    layers: [
      { key: "newsEvents", label: "新聞 News", expandable: true },
    ],
  },
  {
    title: "WATER",
    layers: [
      { key: "waterBasins", label: "流域 Basin", expandable: true },
      { key: "waterRivers", label: "河川 River", expandable: true },
      { key: "waterLevees", label: "堤防 Levee", expandable: true },
      { key: "waterCanals", label: "灌排渠道 Canal", expandable: true },
      { key: "waterProtectionZones", label: "管制區 Protection", expandable: true },
      { key: "waterReservoirs", label: "水庫 Reservoir", expandable: true },
      { key: "waterFacilities", label: "水利設施 Facility", expandable: true },
      { key: "waterMonitorStations", label: "監測站 Monitor", expandable: true },
      { key: "waterFloodExtreme", label: "淹水潛勢 Flood 650mm/24h", expandable: true },
      { key: "waterDetentionBasins", label: "滯洪池 Detention", expandable: true },
      { key: "rainGauge", label: "即時雨量 Rain Gauge", expandable: true },
      { key: "riverLevel", label: "河川水位 River Level", expandable: true },
      { key: "groundwaterWells", label: "水井點位 Wells", expandable: true },
      { key: "groundwater", label: "地下水井 Groundwater", expandable: true },
      { key: "iotWraRiver", label: "IoT 河川 (補強) IoT River", expandable: true },
      { key: "iotWraStructure", label: "IoT 水工結構 IoT Structure", expandable: true },
      { key: "floodSensor", label: "都市淹水感測 USWG", expandable: true },
      { key: "floodSensorIsochrone", label: "淹水 3 分步行圈 (雙北)", expandable: true },
      { key: "taipeiSewer", label: "北市下水道水位 Sewer (TP)", expandable: true },
      { key: "taipeiEvacuate", label: "北市疏散門 Evacuate Gate (TP)", expandable: true },
      { key: "taipeiPumb", label: "北市抽水站 Pumb Station (TP)", expandable: true },
      { key: "precipRaster", label: "累積雨量柵格 Precip Raster", expandable: true },
    ],
  },
  {
    title: "AGRICULTURE",
    layers: [
      { key: "agriculture", label: "農田範圍 FTW Fields 2025", expandable: true },
      { key: "agriSoil", label: "全台土壤分類 Soil Map", expandable: true },
      { key: "agriSoilFertility", label: "土壤肥力 250m Soil Fertility", expandable: true },
      { key: "agriLeisureFarmZones", label: "休閒農業區 Leisure Farm Zones", expandable: true },
      { key: "agriRuralRegen", label: "農村再生社區 Rural Regen", expandable: true },
      { key: "agriCropSuitability", label: "作物適栽 Crop Suitability", expandable: true },
      { key: "agriPOI", label: "休農場 / 田媽媽 / 特色農旅 POI", expandable: true },
      { key: "agriRetail", label: "農產零售商 Retail Cos.", expandable: true },
      { key: "agriProduceWholesale", label: "蔬果批發商 Produce Wholesale", expandable: true },
      { key: "agriWholesaleMarket", label: "農產批發市場 Wholesale Market", expandable: true },
      { key: "farmRoads", label: "農路 Farm Roads", expandable: true },
      { key: "ecoNetworkZones", label: "國土綠網分區 Eco Network Zones", expandable: true },
    ],
  },
  {
    title: "FORESTRY",
    layers: [
      { key: "forestCompartments", label: "林班 Compartments", expandable: true },
      { key: "forestReserve", label: "保安林 Reserve", expandable: true },
      { key: "forestRecreation", label: "森林遊樂區 Recreation", expandable: true },
      { key: "forestRoads", label: "林道 Forest Roads", expandable: true },
      { key: "forestTreatmentWorks", label: "治理工程 Treatment Works", expandable: true },
      { key: "forestTrailSigns", label: "步道路標 Trail Signs", expandable: true },
      { key: "forestSignalPoints", label: "通訊點 Signal Points", expandable: true },
      { key: "forestEducationCenters", label: "自然教育中心 Education", expandable: true },
      { key: "forestWildlife", label: "野生動物分布 Wildlife", expandable: true },
      { key: "forestDamLakes", label: "堰塞湖 Dam Lakes", expandable: true },
      { key: "forestFlatParks", label: "平地森林 Flat Parks", expandable: true },
      { key: "forestAlishanRail", label: "阿里山鐵路 Alishan Rail", expandable: true },
      { key: "hikingTrails", label: "全台步道 Hiking Trails", labelMobile: "全台步道 Hiking Trails (7,339)", expandable: true },
    ],
  },
  {
    title: "WASTE",
    layers: [
      { key: "wasteTruck", label: "垃圾車 Truck (含音符)", expandable: true },
      { key: "wasteSchedule", label: "垃圾車（表定）Schedule", expandable: true },
      { key: "wasteScheduleNote", label: "　└ 表定音符 Notes 🎵" },
      { key: "wasteStopsStatic", label: "全台清運點位 (靜態)", expandable: true },
    ],
  },
  {
    title: "WASTE FACILITY",
    layers: [
      { key: "wfIncinerator", label: "焚化爐 Incinerator", labelMobile: "焚化爐 Incinerator (30) 🔥", expandable: true },
      { key: "wfLandfill", label: "衛生掩埋場 Landfill", labelMobile: "衛生掩埋場 Landfill (117) 🟫", expandable: true },
      { key: "wfTransfer", label: "轉運站 Transfer", labelMobile: "轉運站 Transfer (28) 🚛", expandable: true },
      { key: "wfMedical", label: "醫療廢棄物 Medical", labelMobile: "醫療廢棄物 Medical (40) ⚕️", expandable: true },
      { key: "wfMonitoring", label: "地下水監測井 Monitor", labelMobile: "地下水監測井 Monitor (574) 🩸", expandable: true },
      { key: "wfRecycling", label: "資源回收廠 Recycling", labelMobile: "資源回收廠 Recycling (653) ♻️", expandable: true },
      { key: "wfScrapYard", label: "廢車/廢金屬 Scrap", labelMobile: "廢車/廢金屬 Scrap (3)", expandable: true },
      { key: "wfOther", label: "其他事廢設施 Other", labelMobile: "其他事廢設施 Other (3,164)", expandable: true },
    ],
  },
  {
    title: "SPACE",
    layers: [
      { key: "satellitesYaogan", label: "Yaogan 遙感", labelMobile: "中國 Yaogan 遙感", expandable: true },
      { key: "satellitesJilin", label: "Jilin 吉林", labelMobile: "中國 Jilin 吉林", expandable: true },
      { key: "satellitesGaofen", label: "Gaofen 高分", labelMobile: "中國 Gaofen 高分", expandable: true },
      { key: "satellitesTJS", label: "TJS GEO 情報", labelMobile: "TJS / TJSW GEO 情報", expandable: true },
      { key: "satellitesBeidou", label: "Beidou 北斗", labelMobile: "北斗 BD-3 PNT 導航", expandable: true },
      { key: "satellitesShiyan", label: "Shiyan 實踐/餘", labelMobile: "Shiyan / Shijian 試驗", expandable: true },
      { key: "satellitesTaiwan", label: "台灣 FORMOSAT", labelMobile: "台灣衛星 FORMOSAT / TRITON / IRIS-C", expandable: true },
    ],
  },
  {
    title: "SPACE · INTL RECON",
    layers: [
      { key: "satellitesUSA", label: "🇺🇸 美國偵察", labelMobile: "USA · KH/USA/BlackSky/Planet", expandable: true },
      { key: "satellitesJapan", label: "🇯🇵 日本 IGS", labelMobile: "Japan · IGS-OPTICAL/RADAR/ALOS", expandable: true },
      { key: "satellitesRussia", label: "🇷🇺 俄羅斯偵察", labelMobile: "Russia · PERSONA/RESURS/COSMOS", expandable: true },
      { key: "satellitesIndia", label: "🇮🇳 印度遙測", labelMobile: "India · CARTOSAT/RISAT/EOS", expandable: true },
      { key: "satellitesKorea", label: "🇰🇷 韓國 KOMPSAT", labelMobile: "Korea · KOMPSAT", expandable: true },
      { key: "satellitesFrance", label: "🇫🇷 法國 CSO/PLEIADES", labelMobile: "France · CSO/PLEIADES/ELISA", expandable: true },
      { key: "satellitesGermany", label: "🇩🇪 德國 SAR-Lupe", labelMobile: "Germany · SAR-Lupe/SARah/TerraSAR", expandable: true },
      { key: "satellitesItaly", label: "🇮🇹 義大利 COSMO", labelMobile: "Italy · COSMO-SkyMed", expandable: true },
      { key: "satellitesIsrael", label: "🇮🇱 以色列 Ofeq", labelMobile: "Israel · Ofeq/EROS", expandable: true },
    ],
  },
  {
    title: "WASTE DISPOSAL POINT",
    layers: [
      { key: "wdClothes", label: "衣物回收箱 Clothes", labelMobile: "衣物回收箱 Clothes Box (7,236)", expandable: true },
      { key: "wdMixed", label: "混合投放點 Mixed", labelMobile: "混合投放點 Mixed (6,368)", expandable: true },
      { key: "wdRecyclingContainer", label: "街頭資收桶 Container", labelMobile: "街頭資收桶 Container (145)", expandable: true },
      { key: "wdBattery", label: "電池回收 Battery", labelMobile: "電池回收 Battery (2)", expandable: true },
    ],
  },
  {
    // powerStatusHud + powerRegionDemand 不在地圖 sidebar，預定搬 monitor 面板
    // （KPI 性質非地理事件）。LayerVisibility key 保留供 monitor 整合時複用。
    title: "ENERGY · 能源",
    layers: [
      // Phase 8 SSOT facilities 6-layer — 整合後的精簡視覺
      { key: "facPrimary",       label: "主要電廠（運轉中）",  expandable: true },
      { key: "facOffshore",      label: "離岸風電場址",         expandable: true },
      { key: "facPlanned",       label: "規劃 / 未來電廠",      expandable: true },
      { key: "facHistorical",    label: "歷史 — 退役/擱置",     expandable: true },
      { key: "facSecondary",     label: "次要電廠（小型/分散）", expandable: true },
      { key: "facOsmSupplement", label: "OSM 補充（無名單機）",  expandable: true },
      // 電網基礎設施
      { key: "osmSubstations", label: "變電所", expandable: true },
      { key: "osmPowerLines", label: "高壓輸電線", expandable: true },
      { key: "osmPowerTowers", label: "高壓鐵塔", expandable: true },
      // 即時 3D beam（保留）
      { key: "powerGenerationUnit", label: "機組即時出力", expandable: true },
      // OSM 原始細節 layer（為比對 SSOT 用，預設 OFF）
      { key: "osmWindTurbines", label: "OSM 風機", expandable: true },
      { key: "osmSolarFarms", label: "OSM 光電廠", expandable: true },
      { key: "osmPowerPlantsStatic", label: "OSM 電廠（散落）", expandable: true },
      { key: "offshoreWindZones", label: "離岸風場（OSM 36）", expandable: true },
      { key: "islandPowerGrid", label: "離島電網", expandable: true },
      { key: "fossilFuelInfra", label: "化石燃料設施", expandable: true },
      { key: "geothermalWells", label: "地熱井", expandable: true },
      { key: "renewablePermitsTaipei", label: "北市再生能源", expandable: true },
      { key: "evChargingStations", label: "充電站", expandable: true },
      // ⚠️ powerPlants legacy layer 已被 facPrimary+facSecondary+facHistorical+facPlanned 取代
      // 仍保留 LayerVisibility key 供 PowerCard / 3D beam 內部使用
      { key: "powerPlants", label: "電廠（legacy）", expandable: true },
    ],
  },
  {
    // HAZARD：與 disasterAlerts 同層的災害類圖層
    // 落雷需 cluster + zoom-gate（雷雨季 1h 上萬筆）；核安須區分 is_stale 離線 vs 真實警戒。
    title: "HAZARD · 災害",
    layers: [
      { key: "lightning", label: "落雷 60min", expandable: true },
      { key: "nuclearRadiation", label: "核安輻射", expandable: true },
    ],
  },
];
