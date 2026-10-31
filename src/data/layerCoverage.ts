/**
 * 局部資料層的資料範圍（design-system spec §5.42「圖層看不到」、map-layers.md §3.8 V-3）。
 *
 * 只登記「資料只在某個城市／縣市」的圖層；全國都有資料的層不登記。
 * 視野提示卡用它判斷「視野內沒有這層的資料」，並提供「前往〇〇」按鈕（飛到 `bbox`）。
 *
 * 刻意不寫進 `layerManifest.ts`：manifest 是多軌同時編輯的共用登記檔，資料範圍又是
 * 「同目的地合併一個按鈕」的分組鍵，集中成「區域表＋圖層 → 區域」兩張小表最好維護。
 * `bbox` 以本機 PMTiles header 與行政界外框取整（2026-10-31），涵蓋該層全部資料即可，不求精準行政界。
 * 守門：`layerCoverage.test.ts` 掃圖層名稱含城市名的層，沒登記（也沒列例外）就紅。
 */
import type { LayerVisibility } from "../types";

export type CoverageLabel = { zh: string; en: string; ja: string };
/** [west, south, east, north] */
export type CoverageBbox = readonly [number, number, number, number];
export interface CoverageArea {
  label: CoverageLabel;
  bbox: CoverageBbox;
  /** 「前往」要放大到比整框更近時的鏡頭中心；外框偏一邊（倫敦軌道延伸到 Reading）才填，預設框中心 */
  center?: readonly [number, number];
}

export const COVERAGE_AREAS = {
  // gb_london_rail 西到 Reading（伊莉莎白線），其餘四檔都在大倫敦內
  london: { label: { zh: "倫敦", en: "London", ja: "ロンドン" }, bbox: [-0.98, 51.28, 0.34, 51.71], center: [-0.12, 51.51] },
  seoul: { label: { zh: "首爾", en: "Seoul", ja: "ソウル" }, bbox: [126.76, 37.41, 127.19, 37.72] },
  taipei: { label: { zh: "臺北市", en: "Taipei City", ja: "台北市" }, bbox: [121.44, 24.94, 121.69, 25.23] },
  newTaipei: { label: { zh: "新北市", en: "New Taipei City", ja: "新北市" }, bbox: [121.28, 24.67, 122.01, 25.30] },
  // 新北外框已包住臺北市
  twinCity: { label: { zh: "雙北", en: "Taipei & New Taipei", ja: "台北・新北" }, bbox: [121.28, 24.67, 122.01, 25.30] },
  taoyuan: { label: { zh: "桃園市", en: "Taoyuan City", ja: "桃園市" }, bbox: [120.98, 24.59, 121.48, 25.13] },
  hsinchuCity: { label: { zh: "新竹市", en: "Hsinchu City", ja: "新竹市" }, bbox: [120.88, 24.70, 121.03, 24.86] },
  changhua: { label: { zh: "彰化縣", en: "Changhua County", ja: "彰化県" }, bbox: [120.22, 23.78, 120.71, 24.21] },
  taichung: { label: { zh: "臺中市", en: "Taichung City", ja: "台中市" }, bbox: [120.46, 23.99, 121.46, 24.45] },
  tainan: { label: { zh: "臺南市", en: "Tainan City", ja: "台南市" }, bbox: [120.03, 22.88, 120.66, 23.42] },
} as const satisfies Record<string, CoverageArea>;

export type CoverageAreaId = keyof typeof COVERAGE_AREAS;

export const LAYER_COVERAGE: Partial<Record<keyof LayerVisibility, CoverageAreaId>> = {
  // 英國：倫敦（TfL）
  gbLondonRailLines: "london",
  gbLondonStations: "london",
  gbLondonBikePoints: "london",
  gbLondonJamCams: "london",
  gbLondonChargingZones: "london",
  // 南韓：首爾
  krSeoulSubwayCongestion: "seoul",
  statsKrSeoulLivingPopSgg: "seoul",
  statsKrSeoulLivingPopDaySgg: "seoul",
  statsKrSeoulLivingPopNightSgg: "seoul",
  statsKrSeoulDayNightRatioSgg: "seoul",
  // 台灣：臺北市
  accidentTaipei: "taipei",
  riversideTreesTaipei: "taipei",
  renewablePermitsTaipei: "taipei",
  streetTreesTaipei3epoch: "taipei",
  streetTreesTaipeiDiff: "taipei",
  treePitsTaipei: "taipei",
  urbanZoningTaipei: "taipei",
  taipeiRoadTunnels: "taipei",
  taipeiEvacuate: "taipei",
  taipeiPumb: "taipei",
  taipeiSewer: "taipei",
  taipeiWaterloggingHistory: "taipei",
  statsTaipeiFactoryCountByIndustryTownship: "taipei",
  statsTaipeiFactoryCountTownship: "taipei",
  statsTaipeiGarbageCollectedTownship: "taipei",
  statsTaipeiResourceRecyclingTownship: "taipei",
  statsTaipeiRiversideBicycles: "taipei",
  statsTaipeiRiversideRentalStations: "taipei",
  statsTaipeiRiversideRentalTrips: "taipei",
  statsTaipeiSewerRateLegacyTownship: "taipei",
  statsTaipeiSewerRatePublicTownship: "taipei",
  statsTaipeiTrafficViolationCitations: "taipei",
  statsTaipeiUrbanRentalStations: "taipei",
  statsTaipeiUrbanRentalTrips: "taipei",
  statsTaipeiUsagePermitBuildingAreaTownship: "taipei",
  statsTaipeiUsagePermitBuildingCountTownship: "taipei",
  statsTaipeiUsagePermitCountByBuildTypeTownship: "taipei",
  statsTaipeiUsagePermitCountTownship: "taipei",
  statsTaipeiUsagePermitHouseholdCountTownship: "taipei",
  // 新北市、雙北
  bridgeComparisonNewTaipei: "newTaipei",
  officialBridgesNewTaipei: "newTaipei",
  urbanZoningNewTaipei: "newTaipei",
  floodSensorIsochrone: "twinCity",
  // 其他縣市
  theftTaoyuan: "taoyuan",
  statsTaoyuanAirportArrivals: "taoyuan",
  statsTaoyuanAirportDepartures: "taoyuan",
  statsTaoyuanAirportPassengerMovements: "taoyuan",
  statsTaoyuanAirportTransit: "taoyuan",
  officialBridgesHsinchu: "hsinchuCity",
  changhuaTrafficSignals: "changhua",
  statsTaichungRoadNoiseMonitoringStations: "taichung",
  tainanBridgeInspections: "tainan",
  tainanRoadTunnels: "tainan",
};

export function layerCoverage(key: string): { id: CoverageAreaId; area: CoverageArea } | null {
  const id = LAYER_COVERAGE[key as keyof LayerVisibility];
  return id ? { id, area: COVERAGE_AREAS[id] } : null;
}
