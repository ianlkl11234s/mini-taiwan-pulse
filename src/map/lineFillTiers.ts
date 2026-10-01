/**
 * 2026-09-30 使用者確認照建議＋D 區修正（R3b）。
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

/** R3b：key/實際子圖層 id；共用實體層只套一次。資料與時序編碼 keep。 */
export type HookLineTierSpec = LineTierSpec & { outline?: FillTier };
export const HOOK_LINE_TIERS: Readonly<Record<string, HookLineTierSpec>> = {
  "agriculture/agri-ftw-fields-outline": {"width": "thin", "opacity": "reference"}, // src/map/agricultureLayerFactory.ts
  "animalShelterPressure/animal-shelter-pressure-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useAnimalShelterPressureLayer.ts
  "aviationControl/aviation-control-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useAviationAirspaceLayer.ts
  "aviationRestricted/aviation-restricted-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useAviationAirspaceLayer.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-multi-near-carrier-waterway-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-near-curved-carrier-local-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-no-crossing-nearest-route-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-no-waterway-carrier-consensus-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-offset-direction-line": {"width": "standard", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts（方向線原本比情境線細，保留粗細區分，Claude 驗收修正）
  "bssNationalBridgePreview/bss-national-bridge-preview-ordinary-route-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-original-direction-line": {"width": "standard", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts（方向線原本比情境線細，保留粗細區分，Claude 驗收修正）
  "bssNationalBridgePreview/bss-national-bridge-preview-stage1-local-direction-candidate": {"width": "standard", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts（方向線原本比情境線細，保留粗細區分，Claude 驗收修正）
  "bssNationalBridgePreview/bss-national-bridge-preview-tied-route-consensus-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "bssNationalBridgePreview/bss-national-bridge-preview-waterway-crossing-context": {"width": "emphasis", "opacity": "keep"}, // src/hooks/useBssBridgeLayers.ts
  "coralReefDistribution/coral-reef-distribution-line": {"width": "thin", "opacity": "reference"}, // src/hooks/useCoralReefDistributionLayer.ts
  "droneNoFlyZone/drone-nfz-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDroneRestrictedZonesLayer.ts
  "droneRestrictedZone/drone-restricted-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDroneRestrictedZonesLayer.ts
  "flights/static-trails-line": {"width": "thin", "opacity": "reference"}, // src/map/staticTrails.ts
  "floodAlerts/floodAlerts-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDisasterAlertLayer.ts
  "floodSensorIsochrone/flood-sensor-isochrone-line": {"width": "thin", "opacity": "reference"}, // src/hooks/useFloodSensorIsochroneLayer.ts
  "freewayCongestion/freewayCongestion-line": {"width": "emphasis", "opacity": "standard"}, // src/hooks/useFreewayLayer.ts
  "funeralOperatorDensity/funeral-density-line": {"width": "thin", "opacity": "reference"}, // src/hooks/useFuneralDensityLayer.ts
  "gfwFishingEffort/gfw-fishing-effort-outline": {"width": "thin", "opacity": "reference"}, // src/hooks/useGfwFishingEffortLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-next-outline": {"width": "keep", "opacity": "keep"}, // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-outline": {"width": "keep", "opacity": "keep"}, // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-pmtiles-next-outline": {"width": "keep", "opacity": "keep"}, // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-pmtiles-outline": {"width": "keep", "opacity": "keep"}, // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-pmtiles-preload-outline": {"width": "keep", "opacity": "keep"}, // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyTracks/gfw-hourly-tracks-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useGfwHourlyTracksLayer.ts
  "globalEvents/global-events-relations-line": {"width": "thin", "opacity": "keep"}, // src/hooks/useGlobalEventsLayer.ts
  "jpAdminBoundaries/jp-admin-municipality-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useJpAdminLayers.ts
  "jpAdminPrefecture/jp-admin-prefecture-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useJpAdminLayers.ts
  "jpAirports/jp-airports-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useJpAirportsLayer.ts
  "jpCareCombined/jp-medical-care-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpCareDayServices/jp-medical-care-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpCareEquipment/jp-medical-care-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpCareHomeVisit/jp-medical-care-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpCarePlanning/jp-medical-care-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpCareResidential/jp-medical-care-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpMarineEbsaCoastal/jp-tourism-jp-marine-ebsa-coastal-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpMedicalAreasPrimary/jp-medical-areas-1-outline": {"width": "keep", "opacity": "keep", "outline": "background"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalAreasSecondary/jp-medical-areas-2-outline": {"width": "keep", "opacity": "keep", "outline": "background"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalAreasTertiary/jp-medical-areas-3-outline": {"width": "keep", "opacity": "keep", "outline": "background"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalClinics/jp-medical-facilities-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalDental/jp-medical-facilities-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalHospitals/jp-medical-facilities-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalMaternity/jp-medical-facilities-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpMedicalPharmacies/jp-medical-facilities-aggregate-outline": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/useJpMedicalLayers.ts
  "jpNaturalParksNational/jp-tourism-jp-natural-parks-national-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpNaturalParksPrefectural/jp-tourism-jp-natural-parks-prefectural-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpNaturalParksQuasiNational/jp-tourism-jp-natural-parks-quasi-national-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpNatureConservationArea/jp-tourism-jp-nature-conservation-area-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpNatureConservationSpecialDistrict/jp-tourism-jp-nature-conservation-special-district-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpPrimitiveNatureEnvironmentArea/jp-tourism-jp-primitive-nature-environment-area-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpRailways/jp-railways-line": {"width": "emphasis", "opacity": "standard"}, // src/hooks/useJpRailwaysLayer.ts
  "jpWaterRivers/jp-water-jpWaterRivers": {"width": "standard", "opacity": "standard"}, // src/hooks/useJpWaterLayers.ts
  "jpWildlifeProtectionNational/jp-tourism-jp-wildlife-protection-national-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpWildlifeSpecialProtectionDesignatedArea/jp-tourism-jp-wildlife-special-protection-designated-area-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpWildlifeSpecialProtectionDistrict/jp-tourism-jp-wildlife-special-protection-district-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "jpWorldNaturalHeritageHistorical/jp-tourism-jp-world-natural-heritage-historical-line": {"width": "keep", "opacity": "keep", "outline": "coverage"}, // src/hooks/useJpTourismLayers.ts
  "lifelineAlerts/lifelineAlerts-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDisasterAlertLayer.ts
  "plaActivity/pla-activity-line": {"width": "keep", "opacity": "keep"}, // src/hooks/usePlaActivityLayer.ts
  "propertyValueAdmin/property-value-admin-county-line": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/usePropertyValueAdminLayer.ts
  "propertyValueAdmin/property-value-admin-township-line": {"width": "keep", "opacity": "keep", "outline": "graded"}, // src/hooks/usePropertyValueAdminLayer.ts
  "rail/rail-tracks-line": {"width": "emphasis", "opacity": "standard"}, // src/map/railTracks.ts
  "roadCongestion/road-congestion-line": {"width": "emphasis", "opacity": "standard"}, // src/hooks/useRoadCongestionLayer.ts
  "roadEvents/roadEvents-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useRoadEventsLayer.ts
  "safetyAlerts/safetyAlerts-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDisasterAlertLayer.ts
  "satellitesYaogan/sat-footprint-outer": {"width": "thin", "opacity": "reference"}, // src/hooks/useSatellitesLayer.ts
  "satellitesYaogan/sat-track": {"width": "standard", "opacity": "reference"}, // src/hooks/useSatellitesLayer.ts
  "soilLiquefactionPotential/soil-liquefaction-potential-outline": {"width": "thin", "opacity": "reference"}, // src/hooks/useSoilLiquefactionLayers.ts
  "transitAlerts/transitAlerts-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDisasterAlertLayer.ts
  "typhoonTracks/typhoon-tracks-line-forecast": {"width": "standard", "opacity": "reference"}, // src/hooks/useTyphoonTracksLayer.ts
  "typhoonTracks/typhoon-tracks-line-observed": {"width": "emphasis", "opacity": "standard"}, // src/hooks/useTyphoonTracksLayer.ts
  "vesselWatch/vessel-watch-trail-line": {"width": "standard", "opacity": "reference"}, // src/hooks/useVesselWatchLayer.ts
  "weatherAlerts/weatherAlerts-line": {"width": "standard", "opacity": "standard"}, // src/hooks/useDisasterAlertLayer.ts
};

export const HOOK_FILL_TIERS: Readonly<Record<string, FillTier | "keep">> = {
  "agriCropSuitability/agri-crop-suitability-fill": "graded", // src/map/agricultureLayerFactory.ts
  "agriLeisureFarmZones/agri-leisure-farm-zones-fill": "coverage", // src/map/agricultureLayerFactory.ts
  "agriRuralRegen/agri-rural-regen-fill": "coverage", // src/map/agricultureLayerFactory.ts
  "agriSoil/agri-soil-fill": "coverage", // src/map/agricultureLayerFactory.ts
  "agriSoilFertility/agri-soil-fertility-fill": "graded", // src/map/agricultureLayerFactory.ts
  "agriculture/agri-ftw-fields-fill": "keep", // src/map/agricultureLayerFactory.ts
  "allenCoralAtlas/allen-coral-atlas-benthic-fill": "coverage", // src/hooks/useAllenCoralAtlasLayer.ts
  "allenCoralAtlas/allen-coral-atlas-geomorphic-fill": "coverage", // src/hooks/useAllenCoralAtlasLayer.ts
  "animalShelterPressure/animal-shelter-pressure-fill": "coverage", // src/hooks/useAnimalShelterPressureLayer.ts
  "aspectVector/aspect-vector-fill": "coverage", // src/hooks/useAspectVectorLayer.ts
  "aviationControl/aviation-control-fill": "coverage", // src/hooks/useAviationAirspaceLayer.ts
  "aviationRestricted/aviation-restricted-fill": "coverage", // src/hooks/useAviationAirspaceLayer.ts
  "bridgeResilienceTwinCity/bridge-resilience-village-fill": "coverage", // src/hooks/useBridgeResilienceLayers.ts
  "coralReefDistribution/coral-reef-distribution-fill": "coverage", // src/hooks/useCoralReefDistributionLayer.ts
  "droneNoFlyZone/drone-nfz-fill": "coverage", // src/hooks/useDroneRestrictedZonesLayer.ts
  "droneRestrictedZone/drone-restricted-fill": "coverage", // src/hooks/useDroneRestrictedZonesLayer.ts
  "earthquakeReplay/eq-replay-grid-fill": "keep", // src/map/earthquakeReplayLayerFactory.ts
  "earthquakeReplay/eq-replay-town-fill": "keep", // src/map/earthquakeReplayLayerFactory.ts
  "fireIsochrone/fire-isochrone-coverage-fill": "graded", // src/map/fireIsochroneLayerFactory.ts
  "floodAlerts/floodAlerts-fill": "keep", // src/hooks/useDisasterAlertLayer.ts
  "floodSensorIsochrone/flood-sensor-isochrone-fill": "coverage", // src/hooks/useFloodSensorIsochroneLayer.ts
  "funeralOperatorDensity/funeral-density-fill": "graded", // src/hooks/useFuneralDensityLayer.ts
  "gfwFishingEffort/gfw-fishing-effort-fill": "coverage", // src/hooks/useGfwFishingEffortLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-fill": "keep", // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-next-fill": "keep", // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-pmtiles-fill": "keep", // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-pmtiles-next-fill": "keep", // src/hooks/useGfwHourlyGridLayer.ts
  "gfwHourlyGrid/gfw-hourly-grid-pmtiles-preload-fill": "keep", // src/hooks/useGfwHourlyGridLayer.ts
  "h3Population/h3-population-fill": "graded", // src/map/h3LayerFactory.ts
  "indicators/h3-indicators-fill": "graded", // src/map/demographicsLayerFactory.ts
  "jpAdminBoundaries/jp-admin-municipality-fill": "background", // src/hooks/useJpAdminLayers.ts
  "jpAdminPrefecture/jp-admin-prefecture-fill": "background", // src/hooks/useJpAdminLayers.ts
  "jpAirports/jp-airports-fill": "coverage", // src/hooks/useJpAirportsLayer.ts
  "jpCareCombined/jp-medical-care-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpCareDayServices/jp-medical-care-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpCareEquipment/jp-medical-care-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpCareHomeVisit/jp-medical-care-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpCarePlanning/jp-medical-care-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpCareResidential/jp-medical-care-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpMarineEbsaCoastal/jp-tourism-jp-marine-ebsa-coastal-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpMedicalAreasPrimary/jp-medical-areas-1-fill": "background", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalAreasSecondary/jp-medical-areas-2-fill": "background", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalAreasTertiary/jp-medical-areas-3-fill": "background", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalClinics/jp-medical-facilities-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalDental/jp-medical-facilities-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalHospitals/jp-medical-facilities-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalMaternity/jp-medical-facilities-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpMedicalPharmacies/jp-medical-facilities-aggregate-fill": "graded", // src/hooks/useJpMedicalLayers.ts
  "jpNaturalParksNational/jp-tourism-jp-natural-parks-national-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpNaturalParksPrefectural/jp-tourism-jp-natural-parks-prefectural-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpNaturalParksQuasiNational/jp-tourism-jp-natural-parks-quasi-national-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpNatureConservationArea/jp-tourism-jp-nature-conservation-area-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpNatureConservationSpecialDistrict/jp-tourism-jp-nature-conservation-special-district-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpPopulationMesh1km/jp-population-mesh-fill": "coverage", // src/hooks/useJpPopulationMeshLayer.ts
  "jpPrimitiveNatureEnvironmentArea/jp-tourism-jp-primitive-nature-environment-area-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpWaterLakes/jp-water-jpWaterLakes": "coverage", // src/hooks/useJpWaterLayers.ts
  "jpWaterSupplyAreas/jp-water-jpWaterSupplyAreas": "background", // src/hooks/useJpWaterLayers.ts
  "jpWildlifeProtectionNational/jp-tourism-jp-wildlife-protection-national-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpWildlifeSpecialProtectionDesignatedArea/jp-tourism-jp-wildlife-special-protection-designated-area-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpWildlifeSpecialProtectionDistrict/jp-tourism-jp-wildlife-special-protection-district-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "jpWorldNaturalHeritageHistorical/jp-tourism-jp-world-natural-heritage-historical-fill": "coverage", // src/hooks/useJpTourismLayers.ts
  "lifelineAlerts/lifelineAlerts-fill": "keep", // src/hooks/useDisasterAlertLayer.ts
  "medDesert/medical-isochrone-fill": "graded", // src/map/medicalIsochroneLayerFactory.ts
  "medIsochrone/medical-isochrone-fill": "graded", // src/map/medicalIsochroneLayerFactory.ts
  "plaActivity/pla-activity-fill": "keep", // src/hooks/usePlaActivityLayer.ts
  "popCount/h3-pop-count-fill": "graded", // src/map/demographicsLayerFactory.ts
  "propertyValueAdmin/property-value-admin-county-fill": "graded", // src/hooks/usePropertyValueAdminLayer.ts
  "propertyValueAdmin/property-value-admin-township-fill": "graded", // src/hooks/usePropertyValueAdminLayer.ts
  "roadEvents/roadEvents-fill": "graded", // src/hooks/useRoadEventsLayer.ts
  "safetyAlerts/safetyAlerts-fill": "keep", // src/hooks/useDisasterAlertLayer.ts
  "satellitesYaogan/sat-footprint-inner": "coverage", // src/hooks/useSatellitesLayer.ts
  "slopeVector/slope-vector-fill": "coverage", // src/hooks/useSlopeVectorLayer.ts
  "socioeconomic/h3-socio-fill": "graded", // src/map/demographicsLayerFactory.ts
  "soilLiquefactionPotential/soil-liquefaction-potential-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "soilLiquefactionPotential/soil-liquefaction-potential-not-investigated": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "spatialEconomy/h3-spatial-fill": "graded", // src/map/demographicsLayerFactory.ts
  "temperatureGrid/temperature-grid-fill": "keep", // src/map/temperatureGridLayerFactory.ts
  "transitAlerts/transitAlerts-fill": "keep", // src/hooks/useDisasterAlertLayer.ts
  "weakSoilClay0To5/soil-liquefaction-weakSoilClay0To5-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilClay0To5/soil-liquefaction-weakSoilClay0To5-missing": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilClay10To20/soil-liquefaction-weakSoilClay10To20-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilClay10To20/soil-liquefaction-weakSoilClay10To20-missing": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilClay5To10/soil-liquefaction-weakSoilClay5To10-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilClay5To10/soil-liquefaction-weakSoilClay5To10-missing": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilSand0To5/soil-liquefaction-weakSoilSand0To5-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilSand0To5/soil-liquefaction-weakSoilSand0To5-missing": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilSand10To20/soil-liquefaction-weakSoilSand10To20-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilSand10To20/soil-liquefaction-weakSoilSand10To20-missing": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilSand5To10/soil-liquefaction-weakSoilSand5To10-fill": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weakSoilSand5To10/soil-liquefaction-weakSoilSand5To10-missing": "coverage", // src/hooks/useSoilLiquefactionLayers.ts
  "weatherAlerts/weatherAlerts-fill": "keep", // src/hooks/useDisasterAlertLayer.ts
  "youbikeFullness/h3-youbike-fill": "graded", // src/map/youbikeLayerFactory.ts
};
