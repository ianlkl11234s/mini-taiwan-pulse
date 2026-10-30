/**
 * 英國第 8 波文化與觀光 3 層（C045 文化設施、C046 藝文場館、C056 觀光體驗）：類別、色票、署名 SSOT。
 * 圖例、popup 與 hook paint 三邊共用。授權原句與筆數驗算見 taipei-gis-analytics
 * `docs/data-catalog/culture/gb_cultural_facilities.md`、`gb_arts_venues.md`、`docs/data-catalog/tourism/gb_visitor_experience.md`
 * 與 `docs/topic-research/united_kingdom_opendata/waves/w8/layer-plan.md`（2026-10-29）。
 *
 * 色票沿用台灣同類圖層（資料色，spec §3.16），不自訂新色：
 *   文化設施：博物館＝台灣文化設施「博物館」、圖書館＝「特色圖書館」；美術館／畫廊沒有台灣對應，
 *     借台灣地方文化館「藝術與工藝」色。OSM 補缺同色空心（比照第 7 波消防站）。
 *   藝文場館：劇院＝台灣表演場館色、電影院＝台灣文化幣「電影院」色；藝術中心借台灣文化設施「文化行政據點」色、
 *     音樂廳借台灣文化幣「流行音樂」色（台灣表演場館把劇場與音樂廳併成一色，沒有分開的語意）。
 *   觀光體驗：景點＝台灣觀光景點色（manifest tourAttractions 字面 #e65100）、遊客中心＝台灣遊客中心色、
 *     主題樂園＝台灣民營遊樂園色（manifest tourAmusementParks 字面 #00acc1）；動物園與水族館沒有台灣對應，
 *     合用一色，借台灣觀光景點「自然」子類色。
 */
import { CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES, CULTURE_MISSING_COLOR, PERFORMING_VENUE_COLOR } from "./cultureTypes";
import { CULTURE_COIN_CATEGORY_OPTIONS } from "./atlasLayerTypes";
import { PUBLIC_LIFE_COLORS } from "./publicLifePalette";
import { TOUR_ATTRACTION_CATS } from "./tourTypes";

export const GB_CULTURE_FETCHED_AT = "2026-10-29";
export const GB_CULTURE_FALLBACK_COLOR = CULTURE_MISSING_COLOR;
export const GB_CULTURE_ODBL = "ODbL 1.0";
export const GB_CULTURE_OGL_V3 = "Open Government Licence v3.0";
/** 點資料檔 z5–13；hook 用 layer minzoom 控制顯示。 */
export const GB_CULTURE_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
/** 2026-10-30：全部 z5 起（原景點 z9、其他 z7；總數 <1 萬點、z5 起切片完整，全英視角可見）。 */
export const GB_CULTURE_MINZOOM = { default: 5, attraction: 5 } as const;

const facilityColor = (name: string) => CULTURAL_FACILITY_TYPES.find((c) => c.name === name)!.color;
const museumTypeColor = (name: string) => CULTURAL_MUSEUM_TYPES.find((c) => c.name === name)!.color;
const coinColor = (value: string) => CULTURE_COIN_CATEGORY_OPTIONS.find((c) => c.value === value)!.color!;
const tourCatColor = (label: string) => TOUR_ATTRACTION_CATS.find((c) => c.label === label)!.color;

/** 來源字串常見的空值寫法一律視為缺值。 */
export function gbCultureText(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return /^(none|nan|null)$/i.test(s) ? "" : s;
}
/** OSM `access` 這幾種值要在 popup 標「非公眾開放」。 */
export const GB_CULTURE_RESTRICTED_ACCESS: ReadonlySet<string> = new Set(["private", "no", "customers"]);

// ─────────────────────────── C045 文化設施 gbCulturalFacilities ───────────────────────────

export const GB_LIBRARIES_NI_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0: Library locations NI (Libraries NI, OpenDataNI)";
export const GB_LIBRARIES_NI_URL = "https://www.opendatani.gov.uk/@libraries-ni/library-locations-ni";
export type GbCulturalKind = "museum" | "gallery" | "library";
/** 宣告順序＝圖例順序；count＝2026-10-29 成品筆數。 */
export const GB_CULTURAL_KINDS: readonly { value: GbCulturalKind; color: string; count: number }[] = [
  { value: "museum", color: facilityColor("博物館"), count: 3_079 },
  { value: "gallery", color: museumTypeColor("藝術與工藝"), count: 1_282 },
  { value: "library", color: facilityColor("特色圖書館"), count: 3_951 },
];
export const GB_CULTURAL_COUNT = 8_312;
export const GB_CULTURAL_SOURCE_COUNTS = { official: 98, osm: 8_214 } as const;
export const GB_CULTURAL_COLOR = GB_CULTURAL_KINDS[0]!.color;
/** OSM 補缺：同色空心（填色淡化、描邊同色）。 */
export const GB_CULTURAL_OSM_FILL_FACTOR = 0.2;
export const GB_CULTURAL_OSM_STROKE_WIDTH = 1.5;
export function gbCulturalKind(value: unknown) {
  return GB_CULTURAL_KINDS.find((k) => k.value === value);
}

// ─────────────────────────── C046 藝文場館 gbArtsVenues ───────────────────────────

export type GbArtsKind = "theatre" | "cinema" | "arts_centre" | "concert_hall";
export const GB_ARTS_KINDS: readonly { value: GbArtsKind; color: string; count: number }[] = [
  { value: "theatre", color: PERFORMING_VENUE_COLOR, count: 1_592 },
  { value: "cinema", color: coinColor("cinema"), count: 831 },
  { value: "arts_centre", color: facilityColor("文化行政據點"), count: 756 },
  { value: "concert_hall", color: coinColor("pop_music"), count: 31 },
];
export const GB_ARTS_COUNT = 3_210;
export const GB_ARTS_COLOR = PERFORMING_VENUE_COLOR;
export function gbArtsKind(value: unknown) {
  return GB_ARTS_KINDS.find((k) => k.value === value);
}

// ─────────────────────────── C056 觀光體驗 gbVisitorExperience ───────────────────────────

export type GbVisitorKind = "attraction" | "visitor_centre" | "zoo" | "theme_park" | "aquarium";
const ZOO_AQUARIUM_COLOR = tourCatColor("自然 Nature");
export const GB_VISITOR_KINDS: readonly { value: GbVisitorKind; color: string; count: number }[] = [
  { value: "attraction", color: "#e65100", count: 5_436 },
  { value: "visitor_centre", color: PUBLIC_LIFE_COLORS.visitorCentres, count: 1_089 },
  { value: "theme_park", color: "#00acc1", count: 192 },
  { value: "zoo", color: ZOO_AQUARIUM_COLOR, count: 285 },
  { value: "aquarium", color: ZOO_AQUARIUM_COLOR, count: 48 },
];
export const GB_VISITOR_COUNT = 7_050;
export const GB_VISITOR_COLOR = GB_VISITOR_KINDS[0]!.color;
export function gbVisitorKind(value: unknown) {
  return GB_VISITOR_KINDS.find((k) => k.value === value);
}
