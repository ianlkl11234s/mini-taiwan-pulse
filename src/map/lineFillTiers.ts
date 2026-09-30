/**
 * 線與面分階（design-system map-layers §3.2 L-1／L-4、§3.3 F-1／F-2；R3a）。
 *
 * 2026-09-30 使用者確認「照建議」，只改 osmPowerLines/cable 透明度 0.6 → 0.85。
 * 比較頁：docs/features/map-layer-restyle/r3-tiers.html。改階直接改這裡，不要回去改 overlayRegistry 的字面值。
 * 只收 OVERLAY_REGISTRY 畫的線面；hook 自己畫的另在 R3b。由 lineFillSpec.ts 的 withLineFillSpec 套用。
 *
 * 面（FILL_TIERS，key＝config id）：
 *   透明度依資料變化 → keep；規則網格 → grid；序列色分級 → graded；現在 ≤0.2 → background；其他 → coverage。
 *   同一個 config 裡非中心線（suffix 不含 core）的線＝這些面的外框，照 F-2 依面的階畫。
 * 線（LINE_TIERS，key＝`config id/suffix`；行政界用 config id）：
 *   寬＝線寬依資料變化 → keep；z14 ≤1.2 → thin；≥3 → emphasis；其他 → standard。
 *   透明度＝依資料 → keep；現在 ≥0.75 → standard（0.85）；其他 → reference（0.6）。
 */
import type { LayerVisibility } from "../types";
import type { LineTier } from "./mapStyleScale";

export type FillTier = "graded" | "coverage" | "background" | "grid";
export type LineOpacityTier = "standard" | "reference";
export interface LineTierSpec { width: LineTier | "keep"; opacity: LineOpacityTier | "keep" }

export const FILL_TIERS: Partial<Record<keyof LayerVisibility, FillTier | "keep">> = {
  activeFaults: "background", // 活動斷層 Fault Zone
  airports: "background", // 機場 Airport
  aquacultureCageNet: "coverage", // 海上箱網 Cage Net
  aquacultureIntegrated: "coverage", // 養殖漁業整合 Integrated
  aquaculturePonds: "coverage", // 逐口魚塭 Aquaculture Ponds
  aquacultureWaterSatellite: "coverage", // 衛星偵測養殖水體 Satellite Detected
  aquacultureWaterSatelliteMoa: "coverage", // 魚塭·官方標籤版(2026-07) MOA Labeled
  aquacultureWaterUnion: "coverage", // 魚塭·整合版 (官方∪衛星) Union
  aquacultureZone: "coverage", // 養殖漁業生產區 Production Zone
  aviationNoiseZones: "background", // 航空噪音法定里別 Aviation Zones
  buildingsGba: "graded", // 建物輪廓 Buildings
  cemeteryOsm: "coverage", // 墓區範圍 OSM Cemeteries
  cemeteryZoning: "coverage", // 都計墓葬用地 Zoning（北北）
  companyAgeStructure: "grid", // 公司年齡結構 Company Age
  companyCapitalGrid: "grid", // 公司資本額網格 Company Capital Grid
  companyIndustryDistribution: "grid", // 登記產業分布 Company Industry
  companyPoints: "keep", // 公司登記分布 Company Registry
  courtJurisdiction: "background", // 法院管轄區 Jurisdiction
  crimeAreaMonthly: "graded", // 鄉鎮市區犯罪統計
  ecoNetworkZones: "coverage", // 國土綠網分區 Eco Network Zones
  eduCampusArea: "graded", // 校地面積 Campus Size
  eduCampusPolygon: "coverage", // 校地範圍 Campus Area
  eduDistrictElementary: "coverage", // 國小學區 Elementary District
  eduDistrictJunior: "coverage", // 國中學區 Junior High District
  eduDistrictSenior: "background", // 高中就學區（縣市級） Senior High District
  facOffshore: "background", // None
  factoryDensityGrid: "grid", // 生產中工廠密度 Factory Density
  forestCompartments: "coverage", // 林班 Compartments
  forestRecreation: "coverage", // 森林遊樂區 Recreation
  forestReserve: "coverage", // 保安林 Reserve
  industrialParkBoundaries: "coverage", // 產業園區邊界 Industrial Parks
  industrialParkComparison: "coverage", // 園區商工比較 Industrial Park Metrics
  industrialPowerPlant: "coverage", // 火力廠 polygon Thermal Plant
  industrialRefinery: "coverage", // 煉油 / 化工廠 Refinery
  industrialStorageTank: "coverage", // 油氣儲槽 Storage Tank
  isobath: "coverage", // 海底等深線 Isobath
  jpAccommodationDensity: "graded", // 旅宿密度網格 宿泊施設密度グリッド
  jpBuildingHeight: "grid", // 建物高度 PLATEAU
  lakesPondsOsm: "coverage", // 湖泊 / 埤塘 Lakes & Ponds
  manufacturingCompanyDensityGrid: "grid", // 製造業公司登記密度 Manufacturing Registry Density
  nationalParks: "coverage", // 國家（自然）公園 National Parks
  noiseCaptureGrid: "keep", // NoiseCapture 公民格網
  noiseControlZones: "background", // 噪音管制區 Control Zones
  nonUrbanZoning: "coverage", // 非都市土地使用分區 Non-Urban Zoning
  offshoreWindZones: "coverage", // 離岸風場 Offshore Wind
  ooklaFixedPerformance: "keep", // Ookla 固定網路效能格網 Fixed Performance Grid
  ooklaFixedTaiwan: "keep", // Ookla 台灣固定網路細格 Taiwan Fixed Fine Grid
  ooklaMobilePerformance: "keep", // Ookla 行動網路效能格網 Mobile Performance Grid
  ooklaMobileTaiwan: "keep", // Ookla 台灣行動細格 Taiwan Mobile Fine Grid
  osmBridgeFootprints: "background", // OSM 橋梁輪廓
  parkingOnstreet: "graded", // 路邊停車 On-street
  policeIsoCityDept: "keep", // 縣市警局 30/60 min
  policeIsoPrecinct: "keep", // 分局 15/30 min
  policeIsoSubstation: "keep", // 派出所 5/10 min
  ports: "background", // 港口 Port
  propertyValueGrid: "keep", // 不動產總市值網格 Value Grid
  publicLifeOsmCoverage: "graded", // 公共生活 OSM 映射密度
  realEstatePresaleGrid: "grid", // 預售熱力圖 Presale Grid
  realEstateRentalGrid: "grid", // 租賃熱力圖 Rental Grid
  realEstateSaleGrid: "grid", // 買賣熱力圖 Sale Grid
  regulatedFacilityDensityGrid: "grid", // 列管設施密度 Regulated Facility Density
  serviceAreaPolygon: "background", // 國道服務區範圍 SA Area
  stationsTHSR: "background", // 高鐵站 THSR Station
  stationsTRA: "background", // 台鐵站 TRA Station
  tourHotSpringZones: "background", // 溫泉露頭區 Hot Spring Zones
  tourScenicAreas: "background", // 國家風景區 Scenic Areas
  treePitsTaipei: "coverage", // 人行道樹穴 Tree Pits
  urbanFormGrid: "grid", // 都市紋理網格 Urban Form
  urbanZoningNewTaipei: "coverage", // 新北土地使用分區 New Taipei Zoning
  urbanZoningTaipei: "coverage", // 北市土地使用分區 Taipei Zoning
  waterFloodExtreme: "keep", // 淹水潛勢 Flood 650mm/24h
  waterProtectionZones: "keep", // 管制區 Protection
  waterReservoirs: "coverage", // 水庫 Reservoir
  waterRivers: "coverage", // 河川 River
  windPlan: "background", // 風電場規劃 Wind Plan
};

/** 行政界（L-5）三層另外在 overlayRegistry 明寫中性灰；寬度與透明度仍由這裡套。 */
export const LINE_TIERS: Readonly<Record<string, LineTierSpec>> = {
  "bridgeComparisonNewTaipei/line": { width: "emphasis", opacity: "standard" }, // 新北橋梁 OSM 比對
  "contour25k/line": { width: "keep", opacity: "reference" }, // 等高線 Contour 25k (10m)
  "contourDtm20/line": { width: "keep", opacity: "reference" }, // 等高線 Contour DTM20 (20m)
  "countyBoundary": { width: "emphasis", opacity: "standard" }, // 縣市界 County
  "cyclingRoutes/line": { width: "standard", opacity: "reference" }, // 自行車道 Cycling Route
  "evIsland/line": { width: "standard", opacity: "reference" }, // 充電站 最近距離 EV Island
  "farmRoads/line": { width: "standard", opacity: "standard" }, // 農路 Farm Roads
  "forestRoads/line": { width: "standard", opacity: "standard" }, // 林道 Forest Roads
  "gasCoverageAll/line": { width: "standard", opacity: "standard" }, // 加油站 最近距離 Coverage All
  "gasCoverageCpc/line": { width: "standard", opacity: "standard" }, // 中油 最近距離 Coverage CPC
  "gasCoverageFpcc/line": { width: "standard", opacity: "standard" }, // 台塑 最近距離 Coverage FPCC
  "gasCoverageTaisugar/line": { width: "standard", opacity: "standard" }, // 台糖 最近距離 Coverage Taisugar
  "highways/line": { width: "standard", opacity: "reference" }, // 國道 Highway
  "hikingTrails/line": { width: "standard", opacity: "standard" }, // 全台步道 Hiking Trails
  "maritimeBoundary/line": { width: "standard", opacity: "reference" }, // 領海界線 Maritime Boundary
  "maritimeBoundary/line-24nm": { width: "standard", opacity: "reference" }, // 領海界線 Maritime Boundary
  "officialBridgesHsinchu/line": { width: "emphasis", opacity: "standard" }, // 新竹市橋梁清冊
  "officialBridgesNewTaipei/line": { width: "emphasis", opacity: "standard" }, // 新北市轄管橋梁
  "osmBridgeCarriers/line": { width: "standard", opacity: "standard" }, // OSM 橋梁承載線
  "osmExpressway/line": { width: "emphasis", opacity: "standard" }, // 快速道路 Expressway
  "osmPowerLines/cable": { width: "thin", opacity: "standard" }, // 高壓輸電線 Power Lines
  "osmPowerLines/core": { width: "keep", opacity: "keep" }, // 高壓輸電線 Power Lines
  "osmRoadDrive/line": { width: "keep", opacity: "standard" }, // OSM 道路 OSM Roads
  "pipelineGas/line": { width: "standard", opacity: "standard" }, // 天然氣主幹線 Gas Pipeline
  "pipelineOilGas/line": { width: "standard", opacity: "reference" }, // 油氣管線 OSM Oil/Gas Pipeline
  "provincialRoads/line": { width: "standard", opacity: "reference" }, // 省道 Provincial Road
  "speedZoneSegment/line": { width: "emphasis", opacity: "standard" }, // 區間測速 Speed Zone
  "submarineCables/line": { width: "standard", opacity: "reference" }, // OSM 通訊海纜 Submarine Cable
  "townshipBoundary": { width: "standard", opacity: "standard" }, // 鄉鎮市區界 Township
  "villageBoundary": { width: "thin", opacity: "standard" }, // 村里界 Village
  "waterBasins/line": { width: "thin", opacity: "reference" }, // 流域 Basin
  "waterCanals/core": { width: "thin", opacity: "reference" }, // 灌排渠道 Canal
  "waterLevees/core": { width: "thin", opacity: "keep" }, // 堤防 Levee
  "waterRivers/core": { width: "thin", opacity: "standard" }, // 河川 River
};
