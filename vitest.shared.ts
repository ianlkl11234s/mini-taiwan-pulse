/**
 * 資產測試清單（CI-4）：要讀 public/ 資料檔「內容」的測試。
 *
 * 主套件（vitest.config.ts，CI 的 test job）排除這些檔，test job 因此不需要 public/ 資料檔；
 * 這些檔由 `npm run check:assets`（vitest.assets.config.ts，CI 的 assets job）先依 deploy/asset-test-files.txt
 * 從 R2 下載、比對 sha256 後再跑。新測試要讀 public/ 資料檔內容時：加進這裡，並把讀的檔加進 deploy/asset-test-files.txt。
 * 只檢查存在／大小／sha256 的測試不要放這裡，改查 lock（src/test/publicAssets.ts 的 lockedAsset）。
 */
export const ASSET_TESTS = [
  "src/chat/tools/__tests__/wasteStopsChatDataset.test.ts",
  "src/data/__tests__/busRouteCumDist.test.ts",
  "src/data/__tests__/classificationCoverage.test.ts",
  "src/data/__tests__/dialectLegend.test.ts",
  "src/data/__tests__/environmentLayersContract.test.ts",
  "src/data/__tests__/environmentWave2Contract.test.ts",
  "src/data/__tests__/noiseLayersContract.test.ts",
  "src/data/__tests__/pmtilesClassificationCoverage.test.ts",
  "src/data/__tests__/railRoutesTypes.test.ts",
  "src/data/__tests__/staticDataContract.test.ts",
  "src/data/transportHubTypes.test.ts",
  "src/map/__tests__/pmtilesContract.test.ts",
  "src/research/__tests__/aquacultureCageNetDataset.test.ts",
  "src/research/__tests__/aviationNoiseZonesDataset.test.ts",
  "src/research/__tests__/boundedGeometry.test.ts",
  "src/research/__tests__/busRouteDatasetAdapter.test.ts",
  "src/research/__tests__/campingDataset.test.ts",
  "src/research/__tests__/canopyGiantsDataset.test.ts",
  "src/research/__tests__/cemeteryZoningDatasetAdapter.test.ts",
  "src/research/__tests__/civicCultureDatasets.test.ts",
  "src/research/__tests__/communityCentersDataset.test.ts",
  "src/research/__tests__/forestWildlifeReferenceDataset.test.ts",
  "src/research/__tests__/forestryPointDatasets.test.ts",
  "src/research/__tests__/forestryProxyDatasets.test.ts",
  "src/research/__tests__/govWelfareOfficesDataset.test.ts",
  "src/research/__tests__/hotSpringDataset.test.ts",
  "src/research/__tests__/hotSpringZonesDataset.test.ts",
  "src/research/__tests__/iPostBoxesDataset.test.ts",
  "src/research/__tests__/landingStationDataset.test.ts",
  "src/research/__tests__/lighthouseDataset.test.ts",
  "src/research/__tests__/mentalHealthFacilitiesDataset.test.ts",
  "src/research/__tests__/officialNoiseMonitoringDataset.test.ts",
  "src/research/__tests__/publicToiletsDataset.test.ts",
  "src/research/__tests__/scenicAreasDataset.test.ts",
  "src/research/__tests__/serviceAreaFixedDataset.test.ts",
  "src/research/__tests__/serviceAreaPolygonDataset.test.ts",
  "src/research/__tests__/soundCameraDataset.test.ts",
  "src/research/__tests__/speedZoneSegmentsDataset.test.ts",
  "src/research/__tests__/tourEventsFixedDataset.test.ts",
  "src/research/__tests__/tourHeritageFixedDataset.test.ts",
  "src/research/__tests__/yushanHutsDataset.test.ts",
];
