/**
 * atlas 批次 2026-10 圖層代表色（零 import 純色票常數，供 layerManifest 引用）。
 * 分類色、filter 與圖例說明在 atlasLayerTypes.ts。
 */
export const ATLAS_LAYER_COLORS = {
  indigenousTribes: "#b45309",
  indigenousIsolationRisk: "#be123c",
  agriRuralCommunityVillages: "#65a30d",
  provincialRoadSigns: "#2563eb",
  provincialRoadMileposts: "#0f766e",
  freewayTrafficSigns: "#16a34a",
  freewayInterchanges: "#047857",
  freewayEcoSensitive: "#0d9488",
  provincialRoadMonitored: "#dc2626",
  provincialRoadEmergencyBays: "#7c3aed",
  floodDisasterPointsNcdr: "#0284c7",
  taipeiWaterloggingHistory: "#2563eb",
  swcbDisasterPhotoPoints: "#a16207",
  cetaceanStrandings: "#0369a1",
  seaTurtleStrandings: "#059669",
  beachWaterQuality: "#0891b2",
  marineMicroplastics: "#9333ea",
  marinePollutionIncidents: "#1f2937",
  namrEdnaSurveySites: "#0e7490",
  placeNames: "#57534e",
  triangulationPoints: "#78350f",
  wraFloodgatesCentral: "#1d4ed8",
  wraCentralDrainage: "#0ea5e9",
  iowStructureMonitoring: "#4338ca",
  wraDredgingPoints: "#a16207",
  wraEcologySurveySites: "#15803d",
  // 海域保護與漁業 G08（2026-10-17）
  natureReserves: "#166534",
  wildlifeProtectedAreas: "#65a30d",
  openFishingLocations: "#0891b2",
  coastalAreaExtents: "#64748b",
  artificialReefCenters: "#ea580c",
  protectedReefCenters: "#b45309",
  setNetFishingAreas: "#7c3aed",
  // 地層下陷＋海堤 G19（2026-10-17）
  landSubsidenceStations: "#0ea5e9",
  landSubsidenceCumulative: "#dc2626",
  landSubsidenceRate: "#f97316",
  seawallZones: "#0f766e",
  // 文化幣藝文消費點 G23（2026-10-24）
  cultureCoinVenues: "#e11d48",
  // 原民會文化健康站 G20（2026-10-24）
  culturalHealthStations: "#c2410c",
  // 國營事業與國有資產 G16（2026-10-24）
  twcServiceOffices: "#1d4ed8",
  twcWaterFacilities: "#0891b2",
  taisugarSugarMills: "#a16207",
  statePropertyTenderListings: "#9333ea",
  // 金融服務據點 G10（2026-10-24）
  atmSitesFisc: "#2563eb",
  financialBranchesFisc: "#0f766e",
  // 金融服務據點延伸 G10 延伸（2026-10-24）
  securitiesFuturesInstitutions: "#4f46e5",
  insuranceInstitutions: "#16a34a",
} as const;
