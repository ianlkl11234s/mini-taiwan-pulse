/**
 * 英國第 4 波交通 7 層（C013 樞紐＋X005 站客流、G04-L TfL 軌道與車站、C011 BikePoint、G04-L JamCams、倫敦收費區）：
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
