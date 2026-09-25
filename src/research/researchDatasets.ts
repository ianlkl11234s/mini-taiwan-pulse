import { describeRegisteredLayer, readRegisteredLayer } from "./registeredLayerReader";
import { searchScore } from "./researchSearch";
import { describeDatasetSemantics } from "./semanticRegistry";
import type { SemanticCard } from "./contracts/semantic-validator.mjs";
import { createAdministrativeBoundaryAdapter } from "./administrativeBoundaryAdapter";
import { localPopulationPreviewAdapters } from "./localPopulationPreview";
import { createRoadEventCurrentAdapter } from "./roadEventDatasetAdapter";
import { chiayiBusRouteAdapter } from "./busRouteDatasetAdapter";
import { yushanHutsAdapter } from "./yushanHutsDataset";
import { createCemeteryZoningDatasetAdapter } from "./cemeteryZoningDatasetAdapter";
import { earthquakeReplayAdapter } from "./earthquakeDatasetAdapter";
import { schoolsGridAdapter } from "./gridDatasetAdapter";
import { AGRI_STATISTICS_RECIPES_BY_KEY } from "../data/agriStatisticsRecipes";
import { fetchNewsEventsDayClustersStrict } from "../data/newsEventsLoader";
import { loadRegionalStatisticsValues } from "../data/regionalStatisticsLoader";
import { assertDatasetDescriptor, boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createAdminStatisticsAdapter, createNewsEventAdapter, createPointDatasetAdapter } from "./queryAdapters";
import { createVerifiedPointDatasetAdapter } from "./verifiedPointDataset";
import { culturalFacilitiesSourceCoordinatesAdapter, postOfficesSourceCoordinatesAdapter } from "./civicCultureDatasets";
import { iPostBoxesSourceCoordinatesAdapter } from "./iPostBoxesDataset";
import { forestryPointAdapters } from "./forestryPointDatasets";
import { forestryProxyAdapters } from "./forestryProxyDatasets";
import { lighthousesSourceCoordinatesAdapter } from "./lighthouseDataset";
import { hotSpringsSourceCoordinatesAdapter } from "./hotSpringDataset";
import { mentalHealthFacilitiesUpstreamCoordinatesAdapter } from "./mentalHealthFacilitiesDataset";
import { govWelfareOfficesUpstreamCoordinatesAdapter } from "./govWelfareOfficesDataset";
import { welfareCentersUpstreamCoordinatesAdapter } from "./welfareCentersDataset";
import { govServiceOfficesTgosAdapter } from "./govServiceOfficesDataset";
import { retailMarketsTgosAdapter } from "./retailMarketsDataset";
import { agriPoiSourceCoordinatesAdapter } from "./agriPoiDataset";
import { publicToiletsSourceCoordinatesAdapter } from "./publicToiletsDataset";
import { communityCentersNativeCoordinatesAdapter } from "./communityCentersDataset";
import { communityCentersListedAdapter } from "./communityCentersListedDataset";
import { sportsVenuesSourceCoordinatesAdapter } from "./sportsVenuesDataset";
import { gasStationsCanonicalAdapter } from "./gasStationsDataset";
import { policeStationsSourceCoordinatesAdapter } from "./policeStationsDataset";
import { pollutionSitesSourceCoordinatesAdapter } from "./pollutionSitesDataset";
import { pollutionFacilitiesAdapter } from "./pollutionFacilitiesDataset";
import { pollutionPenaltyEventsAdapter } from "./pollutionPenaltiesDataset";
import { publicLibrariesListedAdapter, publicLibrariesTgosCoordinatesAdapter } from "./publicLibrariesDataset";
import { coastGuardStationsSourceCoordinatesAdapter } from "./coastGuardStationsDataset";
import { companyPointsAdapter, manufacturingCompanyPointsAdapter } from "./companyPointsDataset";
import { culturalMuseumsOwnerAdapter } from "./culturalMuseumsDataset";
import { performingVenuesAdapter } from "./performingVenuesDataset";
import { speedCameraListedAdapter, speedCameraTaiwanCoordinatesAdapter } from "./speedCameraDataset";
import { fireStationsOwnerAdapter } from "./fireStationsDataset";
import { ltcInstitutionsTgosUpstreamAdapter } from "./ltcInstitutionsDataset";
import { elderlyCareHomesTgosUpstreamAdapter } from "./elderlyCareHomesDataset";
import { welfareChildcareOwnerAdapter, welfareDisabilityOwnerAdapter, welfareSocialWorkOrgsOwnerAdapter } from "./welfareGeocodedOwnerDatasets";
import { welfareLtcInstitutionsOwnerAdapter, welfareElderlyHomesOwnerAdapter } from "./welfareCarePointsOwnerDatasets";
import { eduSchoolElementaryOwnerAdapter, eduSchoolJuniorOwnerAdapter, eduSchoolSeniorOwnerAdapter, eduSchoolUniversityOwnerAdapter, eduSchoolSpecialOwnerAdapter, eduRemoteSchoolsOwnerAdapter } from "./eduSchoolsOwnerDatasets";
import { welfareChildServicesOwnerAdapter } from "./welfareChildServicesOwnerDataset";
import { artsEventsOwnerAdapter } from "./artsEventsOwnerDataset";
import { railStationsTHSROwnerAdapter, railStationsTRAOwnerAdapter, railStationsMetroOwnerAdapter } from "./railStationsOwnerDatasets";
import { antiCorruptionOfficeOwnerAdapter, correctionalFacilityOwnerAdapter, courtOwnerAdapter, immigrationOfficeOwnerAdapter, investigationBureauOwnerAdapter, prosecutorsOfficeOwnerAdapter } from "./justiceFacilitiesOwnerDatasets";
import { busStationsCityOwnerAdapter, busStationsIntercityOwnerAdapter } from "./busStationsOwnerDatasets";
import { taxiStandsSourceCoordinatesAdapter, etcGantrySourceCoordinatesAdapter } from "./transportFixedPointDatasets";
import { factoryLocationsOwnerAdapter } from "./factoryLocationsOwnerDataset";
import { educationKindergartenOwnerAdapter, educationAfterschoolCareOwnerAdapter, educationMutualCareOwnerAdapter } from "./educationChildcareOwnerDatasets";
import { tourismHotelOwnerAdapter, tourismRestaurantOwnerAdapter } from "./tourismHospitalityOwnerDatasets";
import { civilDefenseSheltersOwnerAdapter } from "./civilDefenseSheltersOwnerDataset";
import { tourismFactoriesOwnerAdapter } from "./tourismFactoriesOwnerDataset";
import { bikeStationsFixedPointAdapter, weatherStationsFixedPointAdapter } from "./bikeWeatherFixedPointDatasets";
import { agriWholesaleMarketOwnerAdapter } from "./agriWholesaleMarketOwnerDataset";
import { womenChildWarningOwnerAdapter } from "./justiceEventPointsOwnerDatasets";
import { cctvFixedPointAdapter } from "./cctvFixedPointDataset";
import { funeralFacilitiesOwnerAdapter, funeralOperatorsOwnerAdapter } from "./funeralPointsOwnerDatasets";
import { religionAncestralHallsOwnerAdapter, religionChurchesOwnerAdapter, religionOtherWorshipOwnerAdapter, religionFoundationsOwnerAdapter, religionTop100OwnerAdapter } from "./religionPointsOwnerDatasets";
import { mountainHutsOwnerAdapter, mountainRescueIncidentsOwnerAdapter } from "./mountainPointsOwnerDatasets";
import { nursingHomesOwnerAdapter } from "./nursingHomesOwnerDataset";
import { commonRegistrationAddressesAdapter } from "./commonRegistrationAddressesDataset";
import { canopyGiantsAdapter } from "./canopyGiantsDataset";
import { serviceAreaFixedPointAdapter } from "./serviceAreaFixedDataset";
import { parksFixedPointAdapter } from "./parksFixedDataset";
import { tourHeritageFixedAdapter } from "./tourHeritageFixedDataset";
import { tourEventsFixedPointAdapter } from "./tourEventsFixedDataset";
import { protectedTreesOwnerAdapter } from "./protectedTreesOwnerDataset";
import { riversideTreesTaipeiOwnerAdapter } from "./riversideTreesOwnerDataset";
import { treePitsTaipeiOwnerAdapter } from "./treePitsTaipeiOwnerDataset";
import { forestTreatmentWorksOwnerAdapter } from "./forestTreatmentWorksDataset";
import { forestWildlifeReferenceAdapter } from "./forestWildlifeReferenceDataset";
import { universityStudentsOwnerAdapter } from "./universityStudentsOwnerDataset";
import { livestockFeedOwnerAdapter, livestockMarketOwnerAdapter, livestockSlaughterOwnerAdapter } from "./livestockAuxOwnerDatasets";
import { wasteStopsOwnerAdapter } from "./wasteStopsOwnerDataset";
import { lpgSubpackagingOwnerAdapter, lpgRetailersOwnerAdapter } from "./lpgOwnerDatasets";
import { wasteFacilitiesIncineratorOwnerAdapter, wasteFacilitiesLandfillOwnerAdapter, wasteFacilitiesMonitoringOwnerAdapter, wasteFacilitiesTransferOwnerAdapter, wasteFacilitiesRecyclingOwnerAdapter, wasteFacilitiesScrapYardOwnerAdapter } from "./wasteFacilitiesOwnerDatasets";
import { evChargingOwnerAdapter } from "./evChargingOwnerDataset";
import { geothermalWellsOwnerAdapter } from "./geothermalWellsOwnerDataset";
import { accidentTaipeiOwnerAdapter } from "./accidentTaipeiOwnerDataset";
import { regulatedFacilitiesOwnerAdapter } from "./regulatedFacilitiesOwnerDataset";
import { streetTreesDiffOwnerAdapter } from "./streetTreesDiffOwnerDataset";
import { medAedOwnerAdapter } from "./medAedOwnerDataset";
import { portsOwnerAdapter } from "./portsOwnerDataset";
import { nhiMedicalHospitalOwnerAdapter, nhiMedicalClinicOwnerAdapter, nhiMedicalPharmacyOwnerAdapter } from "./nhiMedicalOwnerDatasets";
import { airportsOwnerAdapter } from "./airportsOwnerDataset";
import { cramSchoolsOwnerAdapter } from "./cramSchoolsOwnerDataset";
import { companyCapitalGridOwnerAdapter } from "./companyCapitalGridOwnerDataset";
import { companyCapitalGrid150mOwnerAdapter, companyCapitalGrid450mOwnerAdapter } from "./companyCapitalGridFineOwnerDatasets";
import { companyAgeStructure450mOwnerAdapter, companyAgeStructure1500mOwnerAdapter, companyIndustryDistribution450mOwnerAdapter, companyIndustryDistribution1500mOwnerAdapter } from "./companyDemographicsOwnerDataset";
import { waterDetentionBasinsAdapter } from "./waterDetentionBasinsDataset";
import { waterFacilitiesOwnerAdapter } from "./waterFacilitiesOwnerDataset";
import { waterMonitorStationsOwnerAdapter } from "./waterMonitorStationsOwnerDataset";
import { wraDamWeirsOwnerAdapter } from "./wraWaterSystemsOwnerDatasets";
import { trafficAccidentYearlyOwnerAdapter, theftTaoyuanOwnerAdapter } from "./policeJusticeHistoricalOwnerDatasets";
import { fireHydrantsOwnerAdapter } from "./fireHydrantsOwnerDataset";
import { culturalFacilitiesOwnerAdapter } from "./culturalFacilitiesOwnerDataset";
import { groundwaterWellsOwnerAdapter } from "./groundwaterWellsOwnerDataset";
import { agriRetailOwnerAdapter } from "./agriRetailOwnerDataset";
import { livestockFarmsOwnerAdapters } from "./livestockFarmsOwnerDatasets";
import { agriProduceWholesaleOwnerAdapter } from "./agriProduceWholesaleOwnerDataset";
import { religionTemplesOwnerAdapter } from "./religionTemplesOwnerDataset";
import { streetTreesNationalOwnerAdapter } from "./streetTreesNationalOwnerDataset";
import { medLtcOwnerAdapter } from "./medLtcOwnerDataset";
import { activeFaultsAdapter } from "./activeFaultsDataset";
import { cyclingRoutesAdapter } from "./cyclingRoutesDataset";
import { forestRecreationOwnerAdapter } from "./forestRecreationOwnerDataset";
import { aquacultureZoneOwnerAdapter } from "./aquacultureZoneOwnerDataset";
import { serviceAreaPolygonAdapter } from "./serviceAreaPolygonDataset";
import { campusPolygonOwnerAdapter } from "./campusPolygonOwnerDataset";
import { aviationNoiseZonesAdapter } from "./aviationNoiseZonesDataset";
import { scenicAreasAdapter } from "./scenicAreasDataset";
import { hotSpringZonesAdapter } from "./hotSpringZonesDataset";
import { aquacultureCageNetAdapter } from "./aquacultureCageNetDataset";
import { soundCameraListedLocationsAdapter } from "./soundCameraDataset";
import { officialNoiseMonitoringAdapter } from "./officialNoiseMonitoringDataset";
import { amusementParksListedAdapter, amusementParksSourceCoordinatesAdapter } from "./amusementParksDataset";
import { campingSourceCoordinatesAdapter } from "./campingDataset";
import { tourAttractionsSourceCoordinatesAdapter } from "./tourAttractionsDataset";
import { forestRoadsAdapter } from "./forestRoadsDataset";
import { speedZoneSegmentsAdapter } from "./speedZoneSegmentsDataset";
import { seniorSchoolDistrictAdapter } from "./seniorSchoolDistrictDataset";
import { hikingTrailsOwnerAdapter } from "./hikingTrailsOwnerDataset";
import { agriLeisureFarmZonesOwnerAdapter } from "./agriLeisureFarmZonesOwnerDataset";
import { cemeteryZoningOwnerAdapter } from "./cemeteryZoningOwnerDataset";
import { cemeteryOsmAdapter } from "./cemeteryOsmDataset";
import { osmPowerLinesOwnerAdapter, osmPowerTowersOwnerAdapter } from "./osmPowerNetworkOwnerDataset";
import { dgbasCountyTransportOwnerAdapters } from "./dgbasCountyTransportOwnerDatasets";
import { landingStationsNodeCoordinatesAdapter, landingStationsOverpassCenterAdapter } from "./landingStationDataset";
import { taipeiZoningAttributeAdapter } from "./zoningAttributeSidecar";
import { createBusOperationStatisticsAdapters } from "./busOperationStatisticsDatasets";
import { QueryExecutor, type QueryExecution, type QueryRecordsInput } from "./queryExecutor";
import { createSocialStatisticsAdapters } from "./statisticsDatasetAdapters";

// Full MOI geometry is pinned as a localhost owner-only source; the display PMTiles release is separate.
const localRawBoundaries = [createAdministrativeBoundaryAdapter({
    datasetId: "tw-county-boundaries-raw", sourceUrl: "/__local-research-boundaries/county.geojson",
    layerRefs: ["countyBoundary"],
    sourceSha256: "5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6",
    version: "COUNTY_MOI_1140318", observedAt: "2025-03-18", rawAcquiredAt: null,
    publisher: "內政部國土測繪中心；SEGIS existing local snapshot",
    license: "政府資料開放授權條款-第1版（data.gov.tw dataset 7442）；本地 preview 資產尚未發布",
    codeProperty: "行政區域代碼", nameProperty: "名稱", expectedAreas: 22, maxBytes: 16 * 1024 * 1024,
  })];

// Immutable localhost-only previews; they deliberately have no permanent map layers.
const localPopulationPreview = import.meta.env.DEV && import.meta.env.VITE_RESEARCH_POPULATION_PREVIEW === "1"
  ? localPopulationPreviewAdapters : [];

const PADDY = AGRI_STATISTICS_RECIPES_BY_KEY.statsPaddyLandAreaTownship;

const discoveryOnlyDescriptors: readonly DatasetDescriptor[] = [
  {
    schemaVersion: "pulse-dataset/0.1", datasetId: "allen_coral_atlas", label: "Allen Coral Atlas 淺海棲地分類", description: "僅 owner 私人非商業研究；搜尋、說明與查詢都必須每次重新驗權。目前未建立 query adapter。",
    layerRefs: ["allenCoralAtlas"], kind: "polygon", recordGrain: "feature", primaryKey: [], fields: [],
    geometry: { type: "MultiPolygon", crs: null, role: "generalized", precision: "5m nominal classification source rendered through owner-only PMTiles; analytical geometry contract is not registered", spatialAnalysisEligible: false },
    timeFields: [], coverage: "本地 owner-only 快照內的完整相交 polygon；不代表全球珊瑚健康或活珊瑚覆蓋", license: "owner-only private non-commercial research; no public redistribution", valueSemantics: DEFAULT_VALUE_SEMANTICS,
    versions: [], source: { publisher: "Allen Coral Atlas Partnership and Arizona State University", reference: "owner-authenticated fixed Range endpoint", lineage: "private classified habitat snapshot -> owner-authenticated PMTiles Range reads; no public cache" },
    access: boundedAccess({ mode: "owner_only", method: "owner_range", fields: [], maxRowsPerQuery: 1, maxScanRows: 1, queryEnabled: false }), supportedOperations: [], adapterId: "owner-range-query-unavailable",
  },
];

const schoolsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-schools", label: "全國各級學校", description: "教育部學校校址點位；機構與校區語意沿用來源。",
  layerRefs: ["schools"], kind: "point", recordGrain: "place", primaryKey: ["record_id"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "code", type: "string", nullable: true, nullMeaning: "來源未提供學校代碼", unit: null },
    { name: "school_name", type: "string", nullable: true, nullMeaning: "來源未提供校名", unit: null },
    { name: "school_level", type: "string", nullable: true, nullMeaning: "來源未提供學制", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "district", type: "string", nullable: true, nullMeaning: "來源未提供行政區", unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址", unit: null },
    { name: "region_type", type: "string", nullable: true, nullMeaning: "未標示偏遠地區類別，不等於一般地區的權威判定", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source geocoded school coordinate", spatialAnalysisEligible: true }, timeFields: [],
  coverage: "全臺；實際完整度須由來源 receipt 驗證", license: "unknown", valueSemantics: DEFAULT_VALUE_SEMANTICS,
  versions: [],
  source: { publisher: "教育部", reference: "/education/schools.geojson", lineage: "public GeoJSON -> validated Point records" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["record_id", "code", "school_name", "school_level", "city", "district", "address", "region_type", "geometry"], filters: ["code", "school_name", "school_level", "city", "district", "region_type"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: 10_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geojson-point-v1",
};

const medicalHospitalsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-medical-hospitals", label: "全國醫院", description: "健保特約醫院院區點位；設施數不代表醫療量能或服務覆蓋。",
  layerRefs: ["medHospital"], kind: "point", recordGrain: "place", primaryKey: ["record_id"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "facility_id", type: "string", nullable: true, nullMeaning: "來源未提供院區識別碼", unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "來源未提供院名", unit: null },
    { name: "facility_name", type: "string", nullable: true, nullMeaning: "來源未提供設施名稱", unit: null },
    { name: "hospital_name", type: "string", nullable: true, nullMeaning: "來源未提供醫院名稱", unit: null },
    { name: "county", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source facility coordinate", spatialAnalysisEligible: true }, timeFields: [],
  coverage: "全臺健保特約醫院；實際完整度須由來源 receipt 驗證", license: "unknown", valueSemantics: DEFAULT_VALUE_SEMANTICS, versions: [],
  source: { publisher: "衛生福利部中央健康保險署", reference: "/geo/medical_hospitals.geojson", lineage: "public GeoJSON -> validated Point records" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["record_id", "facility_id", "name", "facility_name", "hospital_name", "county", "city", "address", "geometry"], filters: ["facility_id", "name", "facility_name", "hospital_name", "county", "city"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geojson-point-v1",
};

const librariesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-public-libraries", label: "公共圖書館", description: "全國公共圖書館含分館的來源設施紀錄；教育與學習資源的一個面向，不代表座位、開館狀態或教育品質。",
  layerRefs: ["publicLibraries"], kind: "point", recordGrain: "place", primaryKey: ["record_id"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    ...["name", "type", "county"].map(name => ({ name, type: "string" as const, nullable: true, nullMeaning: "來源未提供", unit: null })),
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source library coordinate", spatialAnalysisEligible: true }, timeFields: [],
  coverage: "來源快照內全國公共圖書館含分館；現況完整性 unknown", license: "unknown", valueSemantics: DEFAULT_VALUE_SEMANTICS, versions: [],
  source: { publisher: "unknown; existing publicLibraries layer asset", reference: "/culture/public_libraries_national.geojson", lineage: "existing layer GeoJSON -> validated source records; no seat/capacity inference" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["record_id", "name", "type", "county", "geometry"], filters: ["name", "type", "county"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: 10_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geojson-point-v1",
};
const librariesAdapter = createPointDatasetAdapter(librariesDescriptor, async () => {
  const snapshot = await loadPointDataset({ datasetId: librariesDescriptor.datasetId, url: librariesDescriptor.source.reference, idField: "record_id", safeFields: ["name", "type", "county"] });
  return { rows: snapshot.rows, source: receipt(librariesDescriptor.datasetId, snapshot.checksumSha256, librariesDescriptor.source.reference, snapshot.checksumSha256), coverage: librariesDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length + Object.values(snapshot.exclusions).reduce((a, b) => a + b, 0), bytesScanned: snapshot.bytes, downloadedBytes: snapshot.cacheHit ? 0 : snapshot.bytes, requests: snapshot.cacheHit ? 0 : 1, cacheHit: snapshot.cacheHit };
});

const convenienceStoresDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-convenience-stores", label: "全國便利商店", description: "既有 convenienceStores 圖層的來源門市點位；可做來源座標的探索性鄰近查詢，但不代表即時營業、完整門市母體或步行可達性。",
  layerRefs: ["convenienceStores"], kind: "point", recordGrain: "place", primaryKey: ["record_id"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "來源未提供門市名稱", unit: null },
    { name: "brand", type: "string", nullable: true, nullMeaning: "來源未提供品牌", unit: null },
    { name: "addr", type: "string", nullable: true, nullMeaning: "來源未提供地址；不得由空字串推論無地址", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source-provided store coordinate; upstream acquisition and positional accuracy are not recorded in this artifact", spatialAnalysisEligible: true }, timeFields: [],
  coverage: "Existing 13,223-feature nationwide layer snapshot; upstream completeness, acquisition date, closures and current operating status are unknown.", license: "unknown", valueSemantics: DEFAULT_VALUE_SEMANTICS, versions: [],
  source: { publisher: "unknown; existing convenienceStores layer asset", reference: "/geo/convenience_stores.geojson", lineage: "existing registered GeoJSON -> validated Point records; no live opening-status or walking-network inference" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["record_id", "name", "brand", "addr", "geometry"], filters: ["name", "brand", "addr"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geojson-point-v1",
};
const convenienceStoresAdapter = createPointDatasetAdapter(convenienceStoresDescriptor, async () => {
  const snapshot = await loadPointDataset({ datasetId: convenienceStoresDescriptor.datasetId, url: convenienceStoresDescriptor.source.reference, idField: "record_id", safeFields: ["name", "brand", "addr"] });
  return { rows: snapshot.rows, source: receipt(convenienceStoresDescriptor.datasetId, snapshot.checksumSha256, convenienceStoresDescriptor.source.reference, snapshot.checksumSha256), coverage: convenienceStoresDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length + Object.values(snapshot.exclusions).reduce((a, b) => a + b, 0), bytesScanned: snapshot.bytes, downloadedBytes: snapshot.cacheHit ? 0 : snapshot.bytes, requests: snapshot.cacheHit ? 0 : 1, cacheHit: snapshot.cacheHit };
});

const newsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-news-events", label: "國內新聞事件", description: "按發布日取得的 raw event records；報導、事件與地圖 cluster 不混為同一 grain。",
  layerRefs: ["newsEvents"], kind: "event", recordGrain: "event", primaryKey: ["event_id"],
  fields: [
    { name: "event_id", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "title", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "summary", type: "string", nullable: true, nullMeaning: "來源未提供摘要", unit: null },
    { name: "category", type: "string", nullable: true, nullMeaning: "來源未分類", unit: null },
    { name: "source", type: "string", nullable: true, nullMeaning: "來源名稱未提供", unit: null },
    { name: "url", type: "string", nullable: true, nullMeaning: "來源連結未提供", unit: null },
    { name: "published_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "occurred_at", type: "datetime", nullable: true, nullMeaning: "來源未提供事件發生時間；不可用發布時間代填", unit: null },
    { name: "confidence", type: "number", nullable: true, nullMeaning: "尚未評估 confidence", unit: null },
    { name: "gis_relevance", type: "number", nullable: true, nullMeaning: "尚未評估 GIS relevance", unit: null },
    { name: "severity", type: "number", nullable: true, nullMeaning: "尚未評估 severity", unit: null },
    { name: "is_event", type: "boolean", nullable: true, nullMeaning: "尚未判定是否為事件", unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "消息未定位", unit: null },
    { name: "geometry_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "township cluster proxy or none", spatialAnalysisEligible: false },
  timeFields: [{ name: "published_at", role: "published", timezone: "UTC" }, { name: "occurred_at", role: "occurred", timezone: "UTC" }],
  coverage: "selected publication day and explicit relevance/event/severity filters", license: "unknown", valueSemantics: DEFAULT_VALUE_SEMANTICS,
  versions: [],
  source: { publisher: "registered news feeds", reference: "supabase:public.get_news_events_day_clustered_v2", lineage: "source articles -> classified events -> township clusters -> raw events extracted without display defaults" },
  access: boundedAccess({ mode: "owner_only", method: "rpc", fields: ["event_id", "title", "summary", "category", "source", "url", "published_at", "occurred_at", "confidence", "gis_relevance", "severity", "is_event", "geometry", "geometry_precision"], filters: ["event_id", "title", "category", "source", "gis_relevance", "severity", "is_event"], timeFields: ["published_at", "occurred_at"], maxRowsPerQuery: 50, maxScanRows: 10_000 }), supportedOperations: ["query_records", "aggregate"], adapterId: "news-event-rpc-v1",
};

const statisticsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "land-use:paddy-area-township", label: PADDY.label, description: "固定 release 與 dimensions 的鄉鎮水田面積行政統計；數值需與 status 一起解讀。",
  layerRefs: [PADDY.layer_key], kind: "admin_statistic", recordGrain: "admin_statistic", primaryKey: ["release_id", "area_code"],
  fields: [
    { name: "release_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "value", type: "number", nullable: true, nullMeaning: "由 status/source_token 區分 suppressed、not_reported 或 missing，不得轉為零", unit: PADDY.unit },
    { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_status", type: "string", nullable: true, nullMeaning: "來源未另提供狀態", unit: null },
    { name: "source_token", type: "string", nullable: true, nullMeaning: "observed 數值通常沒有原始缺值符號", unit: null },
    { name: "period_start", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "period_end", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "none", crs: null, role: "none", precision: "records require an explicit version-matched boundary join", spatialAnalysisEligible: false },
  timeFields: [{ name: "period_start", role: "period_start", timezone: "Asia/Taipei" }, { name: "period_end", role: "period_end", timezone: "Asia/Taipei" }],
  coverage: JSON.stringify(PADDY.release_options[0]?.coverage ?? { status: "unknown" }), license: String(PADDY.source.license ?? "unknown"), valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "status/source_token distinguishes missing, suppressed and not_reported; null is never zero", suppressed: "suppressed status requires value=null and may retain only the source token", zero: "value=0 is valid only with status=observed" },
  versions: PADDY.release_options.map(option => ({ versionId: option.release_id, observedAt: option.period_end, availableAt: null, checksumSha256: null, mutable: false })),
  source: { publisher: String(PADDY.source.publisher ?? "unknown"), reference: String(PADDY.source.source_landing_url ?? "unknown"), lineage: "immutable current pointer -> hashed manifest -> exact release artifact; geometry is not returned by query_records" },
  access: boundedAccess({ mode: "public", method: "statistics_snapshot", fields: ["release_id", "area_code", "value", "status", "source_status", "source_token", "period_start", "period_end", "boundary_version"], filters: ["release_id", "area_code", "status", "source_status"], timeFields: ["period_start", "period_end"], maxRowsPerQuery: 50, maxScanRows: 1_000 }), parameters: [{ name: "releaseId", type: "string", required: true, options: PADDY.release_options.map(option => option.release_id) }], supportedOperations: ["query_records", "aggregate"], adapterId: "regional-statistics-v1",
};

function receipt(sourceId: string, version: string, reference: string, checksumSha256: string | null = null): SourceReceipt {
  return { sourceId, version, acquiredAt: new Date().toISOString(), checksumSha256, reference };
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

async function contentHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function requireDate(value: Scalar | undefined): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  return value;
}

// Opt-in local acceptance only; production keeps the existing canonical source.
const schoolsPartition = import.meta.env.DEV && import.meta.env.VITE_RESEARCH_POINT_PARTITIONS === "1" ? {
  manifestUrl: "/__local-research-point-partitions/schools/manifest.json",
  manifestSha256: "a531452a19ddb104634096baf99f13065479630bf6443063602eb9e7999da09b",
  sourceSha256: "7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3",
} : undefined;
const schoolsAdapter = createPointDatasetAdapter(schoolsDescriptor, async (_parameters, signal, context) => {
  const snapshot = await loadPointDataset({ datasetId: schoolsDescriptor.datasetId, url: schoolsDescriptor.source.reference, idField: "code", safeFields: schoolsDescriptor.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: schoolsPartition }, { bbox: context?.bbox, signal });
  return {
    rows: snapshot.rows, source: receipt("tw-schools", snapshot.checksumSha256, schoolsDescriptor.source.reference, snapshot.checksumSha256),
    coverage: schoolsDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length + Object.values(snapshot.exclusions).reduce((sum, value) => sum + value, 0), bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit,
  };
});

const nursingHomesUpstreamAdapter = createVerifiedPointDatasetAdapter({
  datasetId: "tw-nursing-homes-upstream", label: "護理機構來源自帶座標子集",
  description: "護理機構來源紀錄中僅保留 coord_source=upstream_wgs84 且 coord_precision=upstream 的來源自帶座標子集。1,499 筆為原始 1,611 筆來源紀錄的固定子集，計數不是唯一機構數；觀測期間 unknown。",
  sourceUrl: "/welfare/nursing_homes_national.geojson",
  expectedSha256: "775bc1a88a5e8675e48ed7930645a5e7df505968c0821ed080843e7e75bef3d9",
  expectedSourceRows: 1611, expectedSelectedRows: 1499,
  selection: { coord_source: "upstream_wgs84", coord_precision: "upstream" },
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "uid", type: "string", nullable: true, nullMeaning: "來源未提供識別碼", unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "來源未提供機構名稱", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "inst_code", type: "string", nullable: true, nullMeaning: "來源未提供機構代碼", unit: null },
    { name: "nh_type", type: "string", nullable: true, nullMeaning: "來源未提供機構類型", unit: null },
    { name: "coord_source", type: "string", nullable: true, nullMeaning: "來源未標示座標來源", unit: null },
    { name: "coord_precision", type: "string", nullable: true, nullMeaning: "來源未標示座標精度", unit: null },
    { name: "src_datasets", type: "string", nullable: true, nullMeaning: "來源未提供資料集來源", unit: null },
    { name: "n_src", type: "number", nullable: true, nullMeaning: "來源未提供來源數量", unit: null },
    { name: "beds_nh", type: "string", nullable: true, nullMeaning: "來源未提供床數文字", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  publisher: "衛生福利部；existing nursing-home source artifact", license: "政府資料開放授權條款（OGDL）; source provenance receipt",
  precision: "來源標示 upstream_wgs84 且 upstream；未另行驗證位置精度",
});

const medicalHospitalsAdapter = createPointDatasetAdapter(medicalHospitalsDescriptor, async () => {
  const snapshot = await loadPointDataset({ datasetId: medicalHospitalsDescriptor.datasetId, url: medicalHospitalsDescriptor.source.reference, idField: "facility_id", safeFields: medicalHospitalsDescriptor.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) });
  return {
    rows: snapshot.rows, source: receipt("tw-medical-hospitals", snapshot.checksumSha256, medicalHospitalsDescriptor.source.reference, snapshot.checksumSha256),
    coverage: medicalHospitalsDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length + Object.values(snapshot.exclusions).reduce((sum, value) => sum + value, 0), bytesScanned: snapshot.bytes, downloadedBytes: snapshot.cacheHit ? 0 : snapshot.bytes, requests: snapshot.cacheHit ? 0 : 1, cacheHit: snapshot.cacheHit,
  };
});

const newsAdapter = createNewsEventAdapter(newsDescriptor, async parameters => {
  const date = requireDate(parameters.date);
  const minRelevance = parameters.minRelevance;
  const eventsOnly = parameters.eventsOnly;
  const minSeverity = parameters.minSeverity;
  if (![0, 2, 3].includes(minRelevance as number) || typeof eventsOnly !== "boolean" || ![0, 1, 2].includes(minSeverity as number)) throw new Error("INVALID_NEWS_FILTER");
  const clusters = await fetchNewsEventsDayClustersStrict(date, { minRelevance: minRelevance as 0 | 2 | 3, eventsOnly, minSeverity: minSeverity as 0 | 1 | 2 });
  const rows = new Map<number, Record<string, unknown>>();
  let omittedFromMap = 0;
  let rowsScanned = 0;
  for (const cluster of clusters) {
    const validGeometry = typeof cluster.lon === "number" && Number.isFinite(cluster.lon) && typeof cluster.lat === "number" && Number.isFinite(cluster.lat);
    for (const event of cluster.events ?? []) {
      rowsScanned++;
      if (rows.has(event.id)) continue;
      if (!validGeometry) omittedFromMap++;
      rows.set(event.id, {
        event_id: event.id, title: event.title, summary: event.summary, category: event.category, source: event.source, url: event.url,
        published_at: new Date(event.published_ts * 1000).toISOString(), occurred_at: null,
        confidence: event.confidence, gis_relevance: event.gis_relevance, severity: event.severity, is_event: event.is_event,
        geometry: validGeometry ? { type: "Point", coordinates: [cluster.lon, cluster.lat] } : null,
        geometry_precision: validGeometry ? "township_cluster_proxy" : "none",
      });
    }
  }
  const normalizedRows = [...rows.values()];
  const snapshotHash = await contentHash(normalizedRows);
  return {
    rows: normalizedRows, source: receipt("tw-news-events-rpc", `${date}:${snapshotHash}`, newsDescriptor.source.reference, snapshotHash),
    coverage: newsDescriptor.coverage, freshness: "unknown", exclusions: { omitted_from_map_no_geometry: omittedFromMap }, rowsScanned,
  };
});

const statisticsAdapter = createAdminStatisticsAdapter(statisticsDescriptor, async parameters => {
  const release = PADDY.release_options.find(option => option.release_id === parameters.releaseId);
  if (!release) throw new Error("RELEASE_NOT_ALLOWED");
  const result = await loadRegionalStatisticsValues({ datasetId: PADDY.dataset_id, indicatorId: PADDY.indicator_id, level: PADDY.level, dimensions: release.dimensions, releaseId: release.release_id, layerKey: PADDY.layer_key, includeHealth: true, allowReleaseFallback: false });
  return {
    rows: result.values.observations.map(row => ({ ...row, release_id: result.values.release.release_id, period_start: result.values.release.period_start, period_end: result.values.release.period_end, boundary_version: result.values.release.boundary_version })),
    source: receipt("regional-statistics", release.release_id, statisticsDescriptor.source.reference, typeof result.sources.raw_sha256 === "string" ? result.sources.raw_sha256 : null),
    coverage: JSON.stringify(result.health?.coverage ?? release.coverage), freshness: release.health === "STALE" ? "stale" : "unknown", rowsScanned: result.values.total,
  };
});

export const RESEARCH_QUERY_EXECUTOR = new QueryExecutor([
  schoolsAdapter,
  medicalHospitalsAdapter,
  nursingHomesUpstreamAdapter,
  newsAdapter,
  statisticsAdapter,
  schoolsGridAdapter,
  librariesAdapter,
  convenienceStoresAdapter,
  earthquakeReplayAdapter,
  chiayiBusRouteAdapter,
  yushanHutsAdapter,
  createCemeteryZoningDatasetAdapter(),
  createRoadEventCurrentAdapter(),
  postOfficesSourceCoordinatesAdapter,
  culturalFacilitiesSourceCoordinatesAdapter,
  iPostBoxesSourceCoordinatesAdapter,
  ...forestryPointAdapters,
  ...forestryProxyAdapters,
  lighthousesSourceCoordinatesAdapter,
  hotSpringsSourceCoordinatesAdapter,
  mentalHealthFacilitiesUpstreamCoordinatesAdapter,
  govWelfareOfficesUpstreamCoordinatesAdapter,
  welfareCentersUpstreamCoordinatesAdapter,
  govServiceOfficesTgosAdapter,
  retailMarketsTgosAdapter,
  agriPoiSourceCoordinatesAdapter,
  publicToiletsSourceCoordinatesAdapter,
  communityCentersNativeCoordinatesAdapter,
  communityCentersListedAdapter,
  sportsVenuesSourceCoordinatesAdapter,
  gasStationsCanonicalAdapter,
  policeStationsSourceCoordinatesAdapter,
  pollutionSitesSourceCoordinatesAdapter,
  pollutionFacilitiesAdapter,
  pollutionPenaltyEventsAdapter,
  publicLibrariesListedAdapter,
  publicLibrariesTgosCoordinatesAdapter,
  coastGuardStationsSourceCoordinatesAdapter,
  companyPointsAdapter,
  manufacturingCompanyPointsAdapter,
  culturalMuseumsOwnerAdapter,
  performingVenuesAdapter,
  speedCameraListedAdapter,
  speedCameraTaiwanCoordinatesAdapter,
  fireStationsOwnerAdapter,
  ltcInstitutionsTgosUpstreamAdapter,
  elderlyCareHomesTgosUpstreamAdapter,
  welfareChildcareOwnerAdapter,
  welfareDisabilityOwnerAdapter,
  welfareSocialWorkOrgsOwnerAdapter,
  welfareLtcInstitutionsOwnerAdapter,
  welfareElderlyHomesOwnerAdapter,
  eduSchoolElementaryOwnerAdapter,
  eduSchoolJuniorOwnerAdapter,
  eduSchoolSeniorOwnerAdapter,
  eduSchoolUniversityOwnerAdapter,
  eduSchoolSpecialOwnerAdapter,
  eduRemoteSchoolsOwnerAdapter,
  welfareChildServicesOwnerAdapter,
  artsEventsOwnerAdapter,
  railStationsTHSROwnerAdapter,
  railStationsTRAOwnerAdapter,
  railStationsMetroOwnerAdapter,
  antiCorruptionOfficeOwnerAdapter,
  correctionalFacilityOwnerAdapter,
  courtOwnerAdapter,
  immigrationOfficeOwnerAdapter,
  investigationBureauOwnerAdapter,
  prosecutorsOfficeOwnerAdapter,
  busStationsCityOwnerAdapter,
  busStationsIntercityOwnerAdapter,
  taxiStandsSourceCoordinatesAdapter,
  etcGantrySourceCoordinatesAdapter,
  factoryLocationsOwnerAdapter,
  educationKindergartenOwnerAdapter,
  educationAfterschoolCareOwnerAdapter,
  educationMutualCareOwnerAdapter,
  tourismHotelOwnerAdapter,
  tourismRestaurantOwnerAdapter,
  civilDefenseSheltersOwnerAdapter,
  tourismFactoriesOwnerAdapter,
  bikeStationsFixedPointAdapter,
  weatherStationsFixedPointAdapter,
  agriWholesaleMarketOwnerAdapter,
  womenChildWarningOwnerAdapter,
  cctvFixedPointAdapter,
  funeralFacilitiesOwnerAdapter,
  funeralOperatorsOwnerAdapter,
  religionAncestralHallsOwnerAdapter,
  religionChurchesOwnerAdapter,
  religionOtherWorshipOwnerAdapter,
  religionFoundationsOwnerAdapter,
  religionTop100OwnerAdapter,
  mountainHutsOwnerAdapter,
  mountainRescueIncidentsOwnerAdapter,
  nursingHomesOwnerAdapter,
  commonRegistrationAddressesAdapter,
  canopyGiantsAdapter,
  serviceAreaFixedPointAdapter,
  parksFixedPointAdapter,
  tourHeritageFixedAdapter,
  tourEventsFixedPointAdapter,
  protectedTreesOwnerAdapter,
  riversideTreesTaipeiOwnerAdapter,
  treePitsTaipeiOwnerAdapter,
  forestTreatmentWorksOwnerAdapter,
  forestWildlifeReferenceAdapter,
  universityStudentsOwnerAdapter,
  livestockFeedOwnerAdapter,
  livestockMarketOwnerAdapter,
  livestockSlaughterOwnerAdapter,
  wasteStopsOwnerAdapter,
  lpgSubpackagingOwnerAdapter,
  lpgRetailersOwnerAdapter,
  wasteFacilitiesIncineratorOwnerAdapter,
  wasteFacilitiesLandfillOwnerAdapter,
  wasteFacilitiesMonitoringOwnerAdapter,
  wasteFacilitiesTransferOwnerAdapter,
  wasteFacilitiesRecyclingOwnerAdapter,
  wasteFacilitiesScrapYardOwnerAdapter,
  evChargingOwnerAdapter,
  geothermalWellsOwnerAdapter,
  accidentTaipeiOwnerAdapter,
  regulatedFacilitiesOwnerAdapter,
  streetTreesDiffOwnerAdapter,
  medAedOwnerAdapter,
  portsOwnerAdapter,
  nhiMedicalHospitalOwnerAdapter,
  nhiMedicalClinicOwnerAdapter,
  nhiMedicalPharmacyOwnerAdapter,
  airportsOwnerAdapter,
  cramSchoolsOwnerAdapter,
  companyCapitalGridOwnerAdapter,
  companyCapitalGrid150mOwnerAdapter,
  companyCapitalGrid450mOwnerAdapter,
  companyAgeStructure450mOwnerAdapter,
  companyAgeStructure1500mOwnerAdapter,
  companyIndustryDistribution450mOwnerAdapter,
  companyIndustryDistribution1500mOwnerAdapter,
  waterDetentionBasinsAdapter,
  waterFacilitiesOwnerAdapter,
  waterMonitorStationsOwnerAdapter,
  wraDamWeirsOwnerAdapter,
  trafficAccidentYearlyOwnerAdapter,
  theftTaoyuanOwnerAdapter,
  fireHydrantsOwnerAdapter,
  culturalFacilitiesOwnerAdapter,
  groundwaterWellsOwnerAdapter,
  agriRetailOwnerAdapter,
  ...livestockFarmsOwnerAdapters,
  agriProduceWholesaleOwnerAdapter,
  religionTemplesOwnerAdapter,
  streetTreesNationalOwnerAdapter,
  medLtcOwnerAdapter,
  activeFaultsAdapter,
  cyclingRoutesAdapter,
  forestRecreationOwnerAdapter,
  aquacultureZoneOwnerAdapter,
  serviceAreaPolygonAdapter,
  campusPolygonOwnerAdapter,
  aviationNoiseZonesAdapter,
  scenicAreasAdapter,
  hotSpringZonesAdapter,
  aquacultureCageNetAdapter,
  soundCameraListedLocationsAdapter,
  officialNoiseMonitoringAdapter,
  amusementParksSourceCoordinatesAdapter,
  amusementParksListedAdapter,
  campingSourceCoordinatesAdapter,
  tourAttractionsSourceCoordinatesAdapter,
  forestRoadsAdapter,
  speedZoneSegmentsAdapter,
  seniorSchoolDistrictAdapter,
  hikingTrailsOwnerAdapter,
  agriLeisureFarmZonesOwnerAdapter,
  cemeteryZoningOwnerAdapter,
  cemeteryOsmAdapter,
  osmPowerLinesOwnerAdapter,
  osmPowerTowersOwnerAdapter,
  ...dgbasCountyTransportOwnerAdapters,
  landingStationsNodeCoordinatesAdapter,
  landingStationsOverpassCenterAdapter,
  taipeiZoningAttributeAdapter,
  ...createBusOperationStatisticsAdapters(),
  ...localRawBoundaries,
  ...localPopulationPreview,
  ...createSocialStatisticsAdapters(),
]);

function allDescriptors(): DatasetDescriptor[] {
  const descriptors = [...RESEARCH_QUERY_EXECUTOR.descriptors(), ...discoveryOnlyDescriptors];
  descriptors.forEach(assertDatasetDescriptor);
  return descriptors;
}

/** Current registry snapshot for one caller operation; never hydrates a source or caches across calls. */
export function registeredDatasetSnapshot(): readonly DatasetDescriptor[] {
  return allDescriptors();
}

/** Read-only descriptor lookup for manifest-derived capability reporting; never hydrates a source. */
export function registeredDatasetForLayer(layerKey: string): DatasetDescriptor | null {
  return registeredDatasetsForLayer(layerKey)[0] ?? null;
}

/** Registry-derived layer mapping used by discovery and capability reporting; it never loads a source. */
export function registeredDatasetsForLayer(layerKey: string): readonly DatasetDescriptor[] {
  return allDescriptors().filter(descriptor => descriptor.layerRefs.includes(layerKey));
}

/** Temporary projection for the legacy browser-chat tools; metadata stays owned by the dataset descriptor. */
export function legacyDatasetMeta(datasetId: string): { url: string; label: string; description: string } {
  const descriptor = RESEARCH_QUERY_EXECUTOR.describe(datasetId);
  if (!descriptor || descriptor.access.mode !== "public" || descriptor.access.method !== "static_asset") throw new Error("LEGACY_DATASET_NOT_AVAILABLE");
  const filterFields = descriptor.access.query.filters.join(" / ");
  const url = descriptor.source.reference.startsWith("/") ? `.${descriptor.source.reference}` : descriptor.source.reference;
  return { url, label: descriptor.label, description: `${descriptor.description} 可篩選欄位：${filterFields}。` };
}

function datasetAuthorized(descriptor: DatasetDescriptor, locked: ReadonlySet<string>): boolean {
  if (descriptor.layerRefs.some(key => locked.has(key))) return false;
  const references = new Set(descriptor.layerRefs.map(key => describeRegisteredLayer(key)?.url.replace(/^\.\//, "/")).filter(Boolean));
  return ![...locked].some(key => {
    const source = describeRegisteredLayer(key)?.url.replace(/^\.\//, "/");
    return source !== undefined && references.has(source);
  });
}

export function searchDatasets(query: string, offset = 0, limit = 20, locked: ReadonlySet<string> = new Set()) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("INVALID_INPUT");
  const matched = allDescriptors().filter(descriptor => descriptor.access.discovery.search && datasetAuthorized(descriptor, locked)).map(descriptor => ({ descriptor, score: searchScore(query, `${descriptor.datasetId} ${descriptor.label} ${descriptor.description} ${descriptor.layerRefs.join(" ")}`) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.descriptor);
  // Discovery is intentionally compact. Full fields, versions, coverage,
  // provenance and value semantics belong to describe_dataset; returning them
  // here makes common topic searches exceed the browser relay's bounded result.
  const datasets = matched.slice(offset, offset + limit).map(descriptor => ({
    schemaVersion: descriptor.schemaVersion,
    datasetId: descriptor.datasetId,
    label: descriptor.label,
    description: descriptor.description.slice(0, 240),
    descriptionTruncated: descriptor.description.length > 240,
    layerRefs: descriptor.layerRefs,
    kind: descriptor.kind,
    recordGrain: descriptor.recordGrain,
    geometry: {
      type: descriptor.geometry.type,
      role: descriptor.geometry.role,
      spatialAnalysisEligible: descriptor.geometry.spatialAnalysisEligible,
    },
    access: {
      mode: descriptor.access.mode,
      method: descriptor.access.method,
      queryEnabled: descriptor.access.query.enabled,
    },
    supportedOperations: descriptor.supportedOperations,
    versionCount: descriptor.versions.length,
  }));
  return { query, offset, limit, totalMatched: matched.length, returned: datasets.length, truncated: offset + datasets.length < matched.length, datasets };
}

export function describeDataset(datasetId: string, locked: ReadonlySet<string> = new Set()): DatasetDescriptor & { semantics: SemanticCard | null } {
  const descriptor = allDescriptors().find(item => item.datasetId === datasetId) ?? null;
  if (!descriptor || !descriptor.access.discovery.describe || !datasetAuthorized(descriptor, locked)) throw new Error("DATASET_NOT_FOUND");
  return { ...descriptor, semantics: describeDatasetSemantics(datasetId) };
}

export async function queryRecords(input: QueryRecordsInput): Promise<Record<string, unknown>> {
  return await RESEARCH_QUERY_EXECUTOR.execute(input) as unknown as Record<string, unknown>;
}

/** Use before persisting a query plan so required selectors fail before materialization. */
export function validateQueryRecordsInput(input: QueryRecordsInput): QueryRecordsInput {
  return RESEARCH_QUERY_EXECUTOR.validateParameters(input);
}

export async function queryRecordsDetailed(input: QueryRecordsInput): Promise<QueryExecution> {
  return await RESEARCH_QUERY_EXECUTOR.executeDetailed(input);
}

/** Resolve an analysis dataset from its manifest layer without inventing a second registry. */
export async function datasetForLayer(layerKey: string, locked: ReadonlySet<string> = new Set()): Promise<DatasetDescriptor> {
  const registered = allDescriptors().find(descriptor => descriptor.layerRefs.includes(layerKey));
  if (registered) {
    if (!datasetAuthorized(registered, locked)) throw new Error("LAYER_DENIED");
    return registered;
  }
  const datasetId = `layer:${layerKey}`;
  await ensureDataset(datasetId, locked);
  return describeDataset(datasetId, locked);
}

const hydrating = new Map<string, Promise<void>>();
/** Hydrate only a manifest-owned local Point asset, never a user-supplied URL. */
export async function ensureDataset(datasetId: string, locked: ReadonlySet<string> = new Set()): Promise<void> {
  const discoveryOnly = discoveryOnlyDescriptors.find(descriptor => descriptor.datasetId === datasetId);
  if (discoveryOnly) {
    if (!datasetAuthorized(discoveryOnly, locked)) throw new Error("DATASET_NOT_FOUND");
    return;
  }
  const registered = RESEARCH_QUERY_EXECUTOR.describe(datasetId);
  if (registered) {
    if (!datasetAuthorized(registered, locked)) throw new Error("DATASET_NOT_FOUND");
    return;
  }
  if (!datasetId.startsWith("layer:")) throw new Error("DATASET_NOT_FOUND");
  const layerKey = datasetId.slice(6);
  if (locked.has(layerKey)) throw new Error("LAYER_DENIED");
  const pending = hydrating.get(datasetId); if (pending) return pending;
  if (hydrating.size >= 8) throw new Error("DATASET_REGISTRY_LIMIT");
  const work = (async () => {
    const { descriptor, snapshot } = await readRegisteredLayer(layerKey, { locked });
    let reads = 0;
    RESEARCH_QUERY_EXECUTOR.register({ descriptor, allowedParameters: {}, async read() {
      const cached = reads++ > 0;
      return { rows: snapshot.rows, sourceRefs: [snapshot.source], coverage: snapshot.coverage, freshness: snapshot.freshness ?? "unknown", exclusions: { ...snapshot.exclusions },
        rowsScanned: snapshot.rowsScanned ?? snapshot.rows.length, bytesScanned: snapshot.bytesScanned ?? null, downloadedBytes: cached ? 0 : snapshot.downloadedBytes ?? null, requests: cached ? 0 : 1, cacheHit: cached, expiresAt: null };
    } });
  })();
  hydrating.set(datasetId, work);
  try { await work; } finally { hydrating.delete(datasetId); }
}
