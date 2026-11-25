// 英國國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GbLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const GB_PACK_NOTES = {
  gbAdminBoundaries: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbDataVersion" }, text: "ONS LAD May 2026" } }, { "zh-TW": "資料版本：ONS LAD May 2026", en: "Data version: ONS LAD May 2026", ja: "データ版：ONS LAD May 2026" }],
  gbBridgesTunnels: [{ "zh-TW": "OpenStreetMap 快照 2026-11-13（志願者資料，完整度依地區而異）", en: "OpenStreetMap snapshot 2026-11-13 (volunteer data; completeness varies by area)", ja: "OpenStreetMap スナップショット 2026-11-13（ボランティアデータ、網羅度は地域差あり）" }],
  gbBrownfield: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.environmentLayer.gbBfHectaresNote" } } }],
  gbBuiltUpAreas: [{ "zh-TW": "資料版本：OS Open Built Up Areas 2026-04", en: "Data version: OS Open Built Up Areas 2026-04", ja: "データ版：OS Open Built Up Areas 2026-04" }],
  gbCemeteries: [{ "zh-TW": "資料版本：OS Open Greenspace 2026-04", en: "Data version: OS Open Greenspace 2026-04", ja: "データ版：OS Open Greenspace 2026-04" }],
  gbEarthquakes: [{ "zh-TW": "資料截至 2024-09-02（BGS GeoIndex）", en: "Data up to 2024-09-02 (BGS GeoIndex)", ja: "2024-09-02 までのデータ（BGS GeoIndex）" }],
  gbFuneral: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.funeral.gbOsmNote" } } }],
  gbGolfCourses: [{ "zh-TW": "資料版本：OS Open Greenspace 2026-04", en: "Data version: OS Open Greenspace 2026-04", ja: "データ版：OS Open Greenspace 2026-04" }],
  gbGreenspace: [{ "zh-TW": "資料版本：OS Open Greenspace 2026-04", en: "Data version: OS Open Greenspace 2026-04", ja: "データ版：OS Open Greenspace 2026-04" }],
  gbGroundStability: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.hazard.gbGeoSureNotice" } } }],
  gbHydroStations: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.water.gbHydroNoReadings" } } }],
  gbLandslide: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.hazard.gbRecordNote" } } }, { key: "legend.hazard.gbLandslideLicense" }],
  gbLondonRailLines: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.transport.gbRailColorNote" } } }],
  gbMajorRoads: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.transport.gbCoverage" }, text: { key: "popup.transport.gbRoadCoverageAll" } } }, { "zh-TW": "OSM：北愛爾蘭全部與大不列顛 B 級（OpenStreetMap 2026-11-13 快照，實際線形）", en: "OSM: all of Northern Ireland and Great Britain B roads (OpenStreetMap snapshot 2026-11-13, actual alignment)", ja: "OSM：北アイルランド全体とグレートブリテンの B 級道路（OpenStreetMap 2026-11-13 スナップショット、実際の線形）" }],
  gbMarineProtectedAreas: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.marine.gbMpaNav" } } }],
  gbMaritimeLimits: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbDataVersion" }, text: "UKHO 2026-01-07" } }, { key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.baseMap.gbMaritimeIllustrative" } } }, { "zh-TW": "資料版本：UKHO 2026-01-07", en: "Data version: UKHO 2026-01-07", ja: "データ版：UKHO 2026-01-07" }],
  gbNoise: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.environmentLayer.gbNoiseNote" } } }],
  gbOpenAccessLand: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "legend.environment.gbOaNote" } } }],
  gbPlacesOfWorship: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.publicLife.gbOsmNote" } } }, { "zh-TW": "OpenStreetMap 快照 2026-11-13（志願者資料，完整度依地區而異）", en: "OpenStreetMap snapshot 2026-11-13 (volunteer data; completeness varies by area)", ja: "OpenStreetMap スナップショット 2026-11-13（ボランティアデータ、網羅度は地域差あり）" }],
  gbPollutionInventory: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.environmentLayer.gbPolNote" } } }],
  gbPollutionInventoryEngland: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.environmentLayer.gbEaNote" } } }],
  gbPublicFacilities: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.publicLife.gbOsmNote" } } }, { "zh-TW": "OpenStreetMap 快照 2026-11-13（志願者資料，完整度依地區而異）", en: "OpenStreetMap snapshot 2026-11-13 (volunteer data; completeness varies by area)", ja: "OpenStreetMap スナップショット 2026-11-13（ボランティアデータ、網羅度は地域差あり）" }],
  gbRadiation: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.hazard.gbGammaNote" } } }],
  gbRadon: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.hazard.gbRadonNote" } } }],
  gbRecyclingCentres: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.environmentLayer.gbRecOsmNote" } } }],
  gbRoadFacilities: [{ "zh-TW": "服務區、休息區、收費站：OpenStreetMap 快照 2026-11-13（四地皆為 OSM）", en: "Services, rest areas and toll booths: OpenStreetMap snapshot 2026-11-13 (OSM in all four nations)", ja: "サービスエリア・休憩所・料金所：OpenStreetMap スナップショット 2026-11-13（4 地域とも OSM）" }],
  gbSmallAreaBoundaries: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.baseMap.gbSmallAreaNote" } } }],
  gbSoilParentMaterial: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbNotes" }, text: { key: "popup.agri.gbSoilModelNote" } } }],
  gbSportsFacilities: [{ "zh-TW": "資料版本：OS Open Greenspace 2026-04", en: "Data version: OS Open Greenspace 2026-04", ja: "データ版：OS Open Greenspace 2026-04" }],
  gbSurplusLand: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.baseMap.gbSurplusSourceDate" }, text: "2026-06-29" } }],
  gbTrafficCountsAadf: [{ key: "dataSources.noteWithLabel", vars: { label: { key: "popup.transport.gbCoverage" }, text: { key: "legend.transport.gbAadfNi" } } }],
  gbWastePermits: [{ "zh-TW": "北愛：2021 年 2 月快照", en: "Northern Ireland: February 2021 snapshot", ja: "北アイルランド：2021 年 2 月時点のスナップショット" }],
  // <codemod:append GB_PACK_NOTES>
} satisfies Partial<Record<GbLayerKey, SourceText[]>>;
