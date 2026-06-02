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
  disasterAlerts: "#dc2626",
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
      { key: "disasterAlerts", label: "災害示警 Disaster Alerts", expandable: true },
    ],
  },
  {
    title: "FIRE & RESCUE",
    layers: [
      { key: "fireEvents", label: "火災歷史 Fire (歷史)", expandable: true },
      { key: "fireLatest", label: "火災 最新年度 Latest", expandable: false },
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
    title: "WASTE DISPOSAL POINT",
    layers: [
      { key: "wdClothes", label: "衣物回收箱 Clothes", labelMobile: "衣物回收箱 Clothes Box (7,236)", expandable: true },
      { key: "wdMixed", label: "混合投放點 Mixed", labelMobile: "混合投放點 Mixed (6,368)", expandable: true },
      { key: "wdRecyclingContainer", label: "街頭資收桶 Container", labelMobile: "街頭資收桶 Container (145)", expandable: true },
      { key: "wdBattery", label: "電池回收 Battery", labelMobile: "電池回收 Battery (2)", expandable: true },
    ],
  },
];
