/**
 * 英國第 4 波交通 7 層＋第 10 波道路 2 層（C013 樞紐＋X005 站客流、G04-L TfL 軌道與車站、C011 BikePoint、G04-L JamCams、倫敦收費區）：
 * 類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/transportation/gb_transport_hubs.md`、`gb_london_*.md`
 * （2026-10-29 逐一打開授權頁）。
 *
 * 色票沿用台灣／日本同語意圖層：
 *   鐵路車站＝stationsTRA #b8a080、機場＝airports #daa520、渡輪碼頭＝ports #4a90d9、轉運站＝busStationsIntercity #ab47bc；
 *   年進出站人次＝日本車站「運量」5 階（jpStations ridership，同色序、級距改成英國年人次）；
 *   TfL 軌道線＝依 mode 5 類，借日本鐵道事業者種別 5 色（jpRailways）；**未採 TfL 官方線色**（品牌識別，待拍板）；
 *   倫敦車站＝stationsMetro #00bcd4、轉乘站＝TRANSFER_STATION 白底環；
 *   Santander Cycles 站＝bikeStations #ffca28；JamCams＝cctv #26c6da；
 *   收費區＝無人機紅區 #DC3545（塞車費區）／黃區 #FFC107（ULEZ／LEZ）。
 */

export const GB_TRANSPORT_FETCHED_AT = "2026-10-29";
export const GB_TRANSPORT_OGL_V3 = "Open Government Licence v3.0";

// ─────────────────────────── C013 樞紐 gbTransportHubs ＋ X005 gbStationUsage ───────────────────────────

export const GB_HUBS_ATTRIBUTION =
  "Contains public sector information licensed under the Open Government Licence v3.0: NaPTAN (Department for Transport); Estimates of station usage 2024-25 (Office of Rail and Road); Translink Bus & Rail Stations (Translink / OpenDataNI)";
export const GB_HUBS_NAPTAN_URL = "https://www.data.gov.uk/dataset/ff93ffc1-6656-47d8-9155-85ea0b8f2251";
export const GB_HUBS_TRANSLINK_URL = "https://www.opendatani.gov.uk/dataset/translink-ni-railways-stations";
export const GB_ORR_USAGE_URL = "https://dataportal.orr.gov.uk/statistics/usage/estimates-of-station-usage/";
/** ORR 資料頁與 Table 1410 本身沒有授權字樣；授權取自同期 statistical release PDF 的版權頁。 */
export const GB_ORR_LICENSE_PDF_URL = "https://dataportal.orr.gov.uk/media/msigcn24/station-usage-2024-25-statistical-release.pdf";
export const GB_ORR_PERIOD = "2024-04～2025-03";

export type GbHubType = "rail" | "airport" | "ferry" | "bus_station" | "interchange";
export interface GbHubTypeDef { value: GbHubType; color: string; count: number }
/** 宣告順序＝圖例順序。 */
export const GB_HUB_TYPES: readonly GbHubTypeDef[] = [
  { value: "rail", color: "#b8a080", count: 2692 },
  { value: "airport", color: "#daa520", count: 67 },
  { value: "ferry", color: "#4a90d9", count: 498 },
  { value: "bus_station", color: "#ab47bc", count: 21 },
  { value: "interchange", color: "#ab47bc", count: 3 },
];
export const GB_HUBS_COLOR = "#b8a080";
export const GB_HUB_FALLBACK_COLOR = "#94a3b8";
export const gbHubType = (value: unknown) => GB_HUB_TYPES.find((t) => t.value === value);

/** 年進出站人次 5 階（ORR 2024-25）；顏色沿用日本車站運量 5 階，半徑依級距放大（數量語意）。 */
export interface GbUsageBucket { min: number; color: string; radius: number }
export const GB_STATION_USAGE_BUCKETS: readonly GbUsageBucket[] = [
  { min: 0, color: "#fde047", radius: 3 },
  { min: 100_000, color: "#fb923c", radius: 4.5 },
  { min: 1_000_000, color: "#ef4444", radius: 6.5 },
  { min: 10_000_000, color: "#b91c1c", radius: 9 },
  { min: 50_000_000, color: "#7f1d1d", radius: 12 },
];
/** `entries_exits` 為 null（GB 52 站：ORR 無對應列或 [z]）→ 空心灰框「無 ORR 統計」，不畫成 0。 */
export const GB_STATION_USAGE_NO_DATA_COLOR = "#6b7280";
export const GB_STATION_USAGE_COLOR = "#ef4444";
export const GB_STATION_USAGE_MAX = 98_015_658;

export function gbUsageBucketIndex(value: number): number {
  let idx = 0;
  GB_STATION_USAGE_BUCKETS.forEach((b, i) => { if (value >= b.min) idx = i; });
  return idx;
}

// ─────────────────────────── TfL 共通 ───────────────────────────

/** TfL transport data service 條款要求的三句署名（逐字）。不可用 TfL logo、roundel 或官方路線圖樣式暗示合作。 */
export const GB_TFL_ATTRIBUTIONS = [
  "Powered by TfL Open Data",
  "Contains OS data © Crown copyright and database rights 2016",
  "Geomni UK Map data © and database rights [2019]",
] as const;
export const GB_TFL_MAP_ATTRIBUTION = GB_TFL_ATTRIBUTIONS.join(" · ");
export const GB_TFL_LICENSE = "TfL transport data service terms (based on OGL v2.0)";
export const GB_TFL_TERMS_URL = "https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service";
export const GB_TFL_LINES_URL = "https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line,tram";
export const GB_TFL_BIKEPOINT_URL = "https://api.tfl.gov.uk/BikePoint";
export const GB_TFL_JAMCAM_URL = "https://api.tfl.gov.uk/Place/Type/JamCam";
export const GB_TFL_OPEN_DATA_URL = "https://tfl.gov.uk/info-for/open-data-users/our-open-data";

// ─────────────────────────── G04-L 倫敦軌道 gbLondonRailLines／gbLondonStations ───────────────────────────

export type GbLondonRailMode = "tube" | "overground" | "dlr" | "elizabeth-line" | "tram";
export interface GbLondonRailModeDef { value: GbLondonRailMode; color: string; lines: number }
/** 依 mode 5 類（借 jpRailways 5 色）。宣告順序＝圖例順序。 */
export const GB_LONDON_RAIL_MODES: readonly GbLondonRailModeDef[] = [
  { value: "tube", color: "#3b82f6", lines: 11 },
  { value: "overground", color: "#f97316", lines: 6 },
  { value: "elizabeth-line", color: "#a855f7", lines: 1 },
  { value: "dlr", color: "#14b8a6", lines: 1 },
  { value: "tram", color: "#22c55e", lines: 1 },
];
export const GB_LONDON_RAIL_FALLBACK_COLOR = "#9ca3af";
export const GB_LONDON_RAIL_COLOR = "#3b82f6";
export const gbLondonRailMode = (value: unknown) => GB_LONDON_RAIL_MODES.find((m) => m.value === value);

export const GB_LONDON_STATION_COLOR = "#00bcd4";
export function gbLondonStationIsInterchange(props: Record<string, unknown>): boolean {
  return Number(props.line_count ?? 0) >= 2 || props.stop_type === "TransportInterchange";
}

// ─────────────────────────── C011 Santander Cycles gbLondonBikePoints ───────────────────────────

export const GB_BIKEPOINT_COLOR = "#ffca28";
export const GB_BIKEPOINT_COUNT = 798;

// ─────────────────────────── G04-L JamCams gbLondonJamCams ───────────────────────────

export const GB_JAMCAM_COLOR = "#26c6da";
/** `available_at_fetch=false`（95 支）：2026-10-29 取得當下離線 → 空心點；不是即時狀態。 */
export const GB_JAMCAM_OFFLINE_COLOR = "#6b7280";
export const GB_JAMCAM_COUNT = 890;

// ─────────────────────────── G04-L 收費區 gbLondonChargingZones ───────────────────────────

export type GbChargingZone = "congestion_charge" | "ulez_lez";
export interface GbChargingZoneDef { value: GbChargingZone; color: string; areaKm2: number }
/** 圖例順序：上層（塞車費區）在前；地圖上 ulez_lez 在下、congestion_charge 在上。 */
export const GB_CHARGING_ZONES: readonly GbChargingZoneDef[] = [
  { value: "congestion_charge", color: "#DC3545", areaKm2: 21.38 },
  { value: "ulez_lez", color: "#FFC107", areaKm2: 1528.36 },
];
export const GB_CHARGING_ZONE_COLOR = "#DC3545";
export const gbChargingZone = (value: unknown) => GB_CHARGING_ZONES.find((z) => z.value === value);

// ─────────────────────────── 第 10 波：C012 主要路網 gbMajorRoads ＋ C016 計數點 gbTrafficCountsAadf ───────────────────────────
// 授權原句與筆數見 analytics `docs/data-catalog/transportation/gb_major_roads.md`、`gb_traffic_counts_aadf.md`（2026-10-29 讀取）。
// 道路分級色借台灣 osmRoadDrive 的 highway 分級色（ROAD_DRIVE_PAINT_COLORS：motorway／primary／secondary）；
// 交通量 5 級借第 4 波車站年進出人次（運量）序列色。兩者都是「借色，待確認」。

export const GB_DFT_ROAD_TRAFFIC_ATTRIBUTION =
  "Contains public sector information licensed under the Open Government Licence v3.0: Road traffic statistics (Department for Transport)";
export const GB_DFT_ROAD_TRAFFIC_URL = "https://roadtraffic.dft.gov.uk/downloads";
export const GB_ROADS_OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const GB_ROADS_OSM_URL = "https://www.openstreetmap.org/copyright";
export const GB_ROADS_ODBL = "ODbL 1.0";
export const GB_ROADS_MAP_ATTRIBUTION = `${GB_DFT_ROAD_TRAFFIC_ATTRIBUTION} · ${GB_ROADS_OSM_ATTRIBUTION}`;
export const GB_AADF_YEAR = 2025;

export type GbRoadClass = "motorway" | "a_road" | "b_road";
export type GbRoadWidthTier = "emphasis" | "standard" | "thin";
export interface GbRoadClassDef { value: GbRoadClass; color: string; width: GbRoadWidthTier; segments: number }
/** 宣告順序＝圖例順序。線寬依 L-5「等級對應 L-1」：高速公路強調、A 級標準、B 級細。 */
export const GB_ROAD_CLASSES: readonly GbRoadClassDef[] = [
  { value: "motorway", color: "#fb923c", width: "emphasis", segments: 1_524 },
  { value: "a_road", color: "#fcd34d", width: "standard", segments: 25_383 },
  { value: "b_road", color: "#9ca3af", width: "thin", segments: 6_278 },
];
export const GB_ROAD_FALLBACK_COLOR = "#e5e7eb";
export const GB_MAJOR_ROADS_COLOR = "#fb923c";
export const gbRoadClass = (value: unknown) => GB_ROAD_CLASSES.find((c) => c.value === value);

/** DfT 道路類別代碼（MRDB 對到 AADF 計數點補上；北愛 OSM 為 null）。 */
export type GbRoadCategory = "TM" | "PM" | "TA" | "PA" | "MB" | "MCU";

/** AADF 計數點的 road_class（由 road_category 轉成）。z6–7 只畫前三類（幹線高速、地方高速、幹線 A 級）。 */
export type GbAadfRoadClass = "trunk_motorway" | "principal_motorway" | "trunk_a" | "principal_a" | "minor_b" | "minor_c_unclassified";
export const GB_AADF_ROAD_CLASSES: readonly GbAadfRoadClass[] = [
  "trunk_motorway", "principal_motorway", "trunk_a", "principal_a", "minor_b", "minor_c_unclassified",
];
export const GB_AADF_MAJOR_CLASSES: readonly GbAadfRoadClass[] = ["trunk_motorway", "principal_motorway", "trunk_a"];
export const GB_AADF_MAJOR_MINZOOM = 6;
export const GB_AADF_ALL_MINZOOM = 8;

/** 年平均日交通量（車輛／日）5 級；色沿用車站年進出人次（運量）序列，半徑依級距放大（數量語意，B 階）。 */
export interface GbAadfBucket { min: number; color: string; radius: number }
export const GB_AADF_BUCKETS: readonly GbAadfBucket[] = [
  { min: 0, color: "#fde047", radius: 2.5 },
  { min: 5_000, color: "#fb923c", radius: 3.5 },
  { min: 20_000, color: "#ef4444", radius: 4.5 },
  { min: 50_000, color: "#b91c1c", radius: 6 },
  { min: 100_000, color: "#7f1d1d", radius: 7.5 },
];
export const GB_AADF_COLOR = "#ef4444";
export const GB_AADF_COUNT = 22_334;
export function gbAadfBucketIndex(value: number): number {
  let idx = 0;
  GB_AADF_BUCKETS.forEach((b, i) => { if (value >= b.min) idx = i; });
  return idx;
}
export const gbAadfBucketColor = (value: number | null) => (value == null ? null : GB_AADF_BUCKETS[gbAadfBucketIndex(value)]!.color);

/** 「資料方式」選單：全部／只看當年實測（Counted）／只看 DfT 估算（Estimated）。順序＝params encode。 */
export const GB_AADF_METHOD_FILTERS = ["all", "counted", "estimated"] as const;
