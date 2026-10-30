/**
 * 英國第 7 波公共服務 5 檔 6 層（C036 學校、C058 醫療、C040＋C041 照護（同檔兩層）、C062 消防站、C076 法院）：
 * 類別、色票、署名 SSOT。圖例、popup 與 hook paint 三邊共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/{education,poi,welfare,fire,police_justice}/gb_*.md`
 * 與 `docs/topic-research/united_kingdom_opendata/waves/w7/layer-plan.md`（2026-10-29 逐一重讀授權頁）。
 *
 * 色票沿用台灣同類圖層（資料色，spec §3.16）：
 *   學段＝`CAMPUS_LEVEL_COLORS`（台灣學校／校地學制色）；英國中學橫跨台灣國中＋高中職，取國中色；
 *     繼續教育學院（16 歲以上、職業為主）取高中職色；一貫制取台灣「實驗／國際」色（非單一學段）；
 *     學生轉介單位（PRU，另類安置）沒有台灣對應，借台灣課後照顧色並在圖例寫明。
 *   醫療＝台灣醫療點位 `MEDICAL_POI_PAINT_COLORS`（醫院／診所／藥局，暗淡兩版）。
 *   照護＝台灣社福 `WELFARE_LAYER_COLORS`：護理照護之家＝護理機構、照護之家＝老人福利機構、居家照顧＝長照機構、
 *     支持性住宅＝身障機構；Shared Lives 與其他社區服務沒有台灣對應，借托育色與社工團體灰並在圖例寫明。
 *   消防＝台灣消防分隊色（`FIRE_STATION_CATS` 分隊）；OSM 補缺同色空心。
 *   法院＝台灣法院 `court` 紫（manifest 字面 #7c3aed，沒有常數可引，於此定義）與檢察署淺紫同色系。
 */
import { CAMPUS_LEVEL_COLORS, EDUCATION_LAYER_COLORS } from "./educationTypes";
import { MEDICAL_POI_PAINT_COLORS } from "./medicalPOITypes";
import { WELFARE_LAYER_COLORS } from "./welfareTypes";
import { FIRE_STATION_CATS } from "./fireTypes";

export const GB_CIVIC_FETCHED_AT = "2026-10-29";
export const GB_CIVIC_OGL_V3 = "Open Government Licence v3.0";
export const GB_CIVIC_FALLBACK_COLOR = CAMPUS_LEVEL_COLORS.non_school!;

/** 來源字串常見的空值寫法一律視為缺值。 */
export function gbCivicText(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return /^(none|nan|nat|null|\?)$/i.test(s) ? "" : s;
}

/** 郵遞區號中心定位（含已終止郵遞區號的最後位置）→ popup 加位置註。 */
export function gbIsPostcodeCentroid(precision: unknown): boolean {
  return typeof precision === "string" && precision.startsWith("postcode_centroid");
}

/** ONSPD 三段署名（郵遞區號定位的點都要附）。 */
export const GB_ONSPD_ATTRIBUTION = [
  "Contains OS data © Crown copyright and database right 2026",
  "Contains Royal Mail data © Royal Mail copyright and database right 2026",
  "Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
] as const;
export const GB_ONSPD_URL = "https://geoportal.statistics.gov.uk/datasets/9e5a92a3cfb14dc7ad43d6ea7a7b8c7f";

// ─────────────────────────── C036 學校 gbSchools ───────────────────────────

export const GB_SCHOOLS_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0 (DfE Get Information about Schools; Scottish Government School contact details; Welsh Government Address list of schools; Department of Education NI Locate a school 2016)";
export const GB_SCHOOLS_URL = "https://get-information-schools.service.gov.uk/Downloads";
export type GbSchoolCategory = "nursery" | "primary" | "secondary" | "all_through" | "special" | "pru" | "further_education" | "higher_education" | "other";
/** 宣告順序＝圖例順序；count＝2026-10-29 成品筆數。 */
export const GB_SCHOOL_CATEGORIES: readonly { value: GbSchoolCategory; color: string; count: number }[] = [
  { value: "nursery", color: CAMPUS_LEVEL_COLORS.kindergarten!, count: 879 },
  { value: "primary", color: CAMPUS_LEVEL_COLORS.elementary!, count: 21_079 },
  { value: "secondary", color: CAMPUS_LEVEL_COLORS.junior!, count: 4_456 },
  { value: "all_through", color: CAMPUS_LEVEL_COLORS.experimental!, count: 1_081 },
  { value: "further_education", color: CAMPUS_LEVEL_COLORS.senior!, count: 462 },
  { value: "higher_education", color: CAMPUS_LEVEL_COLORS.university!, count: 128 },
  { value: "special", color: CAMPUS_LEVEL_COLORS.special!, count: 2_304 },
  { value: "pru", color: EDUCATION_LAYER_COLORS.eduAfterschoolCare, count: 169 },
  { value: "other", color: GB_CIVIC_FALLBACK_COLOR, count: 100 },
];
export const GB_SCHOOLS_COLOR = CAMPUS_LEVEL_COLORS.elementary!;
export const GB_SCHOOLS_COUNT = 30_658;
export function gbSchoolCategory(value: unknown) {
  return GB_SCHOOL_CATEGORIES.find((c) => c.value === value);
}

// ─────────────────────────── C058 醫療 gbHealthFacilities ───────────────────────────

export const GB_HEALTH_ODS_ATTRIBUTION = "Organisation Data Service, NHS England, licensed under the Open Government Licence v3.0";
export const GB_HEALTH_ODS_URL = "https://digital.nhs.uk/services/organisation-data-service";
export const GB_HEALTH_PHS_ATTRIBUTION = "Contains public sector information from Public Health Scotland licensed under the Open Government Licence v3.0";
export const GB_HEALTH_PHS_URL = "https://www.opendata.nhs.scot/";
export type GbHealthKind = "hospital" | "gp_practice" | "pharmacy";
/** `paint`＝台灣醫療點位 id（醫院／診所／藥局）。 */
export const GB_HEALTH_KINDS: readonly { value: GbHealthKind; paint: keyof typeof MEDICAL_POI_PAINT_COLORS; count: number }[] = [
  { value: "hospital", paint: "hospital", count: 1_415 },
  { value: "gp_practice", paint: "clinic", count: 7_435 },
  { value: "pharmacy", paint: "pharmacy", count: 12_447 },
];
export const GB_HEALTH_COUNT = 21_297;
export const GB_HEALTH_COLOR = MEDICAL_POI_PAINT_COLORS.hospital.dark;
/** 醫院 <1 萬點 z5 起畫點；GP 診所與藥局 2 萬點原 z9 起，R5 後 z<10 熱區、z≥10 畫點（hook `densePointsFromZoom`）。 */
export const GB_HEALTH_MINZOOM = { hospital: 5, other: 9 } as const;
export function gbHealthKind(value: unknown) {
  return GB_HEALTH_KINDS.find((k) => k.value === value);
}
export function gbHealthColor(kind: GbHealthKind, isDark: boolean): string {
  const k = GB_HEALTH_KINDS.find((x) => x.value === kind)!;
  return MEDICAL_POI_PAINT_COLORS[k.paint][isDark ? "dark" : "light"];
}

// ─────────────────────────── C040＋C041 照護 gbCareHomes／gbCareServices ───────────────────────────

export const GB_CARE_CQC_ATTRIBUTION = "Contains CQC information licensed under the Open Government Licence v3.0";
export const GB_CARE_CQC_URL = "https://www.cqc.org.uk/about-us/transparency/using-cqc-data";
export const GB_CARE_CI_ATTRIBUTION = "Contains Care Inspectorate information licensed under the Open Government Licence v3.0";
export const GB_CARE_CI_URL = "https://www.careinspectorate.com/resources-data/publications-and-statistics/library/datastore-30-sep-2026";
export type GbCareKind = "care_home_nursing" | "care_home" | "home_care" | "supported_living" | "shared_lives" | "other_community";
/** `home`＝住宿照顧（gbCareHomes）；其餘歸長照服務（gbCareServices）。宣告順序＝圖例順序。 */
export const GB_CARE_KINDS: readonly { value: GbCareKind; color: string; count: number; home: boolean }[] = [
  { value: "care_home_nursing", color: WELFARE_LAYER_COLORS.welfareNursingHomes, count: 4_489, home: true },
  { value: "care_home", color: WELFARE_LAYER_COLORS.welfareElderlyHomes, count: 11_269, home: true },
  { value: "home_care", color: WELFARE_LAYER_COLORS.welfareLtcInstitutions, count: 14_427, home: false },
  { value: "supported_living", color: WELFARE_LAYER_COLORS.welfareDisability, count: 2_319, home: false },
  { value: "shared_lives", color: WELFARE_LAYER_COLORS.welfareChildcare, count: 174, home: false },
  { value: "other_community", color: WELFARE_LAYER_COLORS.welfareSocialWorkOrgs, count: 317, home: false },
];
export const GB_CARE_HOMES_COUNT = 15_758;
export const GB_CARE_SERVICES_COUNT = 17_237;
export const GB_CARE_HOMES_COLOR = WELFARE_LAYER_COLORS.welfareElderlyHomes;
export const GB_CARE_SERVICES_COLOR = WELFARE_LAYER_COLORS.welfareLtcInstitutions;
/** 點位為服務機構登記地址（不是服務對象住處）的類別。 */
export const GB_CARE_OFFICE_ADDRESS_KINDS: ReadonlySet<string> = new Set(["home_care", "supported_living"]);
export function gbCareKind(value: unknown) {
  return GB_CARE_KINDS.find((k) => k.value === value);
}

// ─────────────────────────── C062 消防站 gbFireStations ───────────────────────────

export const GB_FIRE_MHCLG_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0 (MHCLG Fire and rescue incident level dataset: Fire Stations)";
export const GB_FIRE_MHCLG_URL = "https://www.gov.uk/government/statistics/fire-statistics-incident-level-datasets";
export const GB_OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const GB_OSM_URL = "https://www.openstreetmap.org/copyright";
export const GB_FIRE_COLOR = FIRE_STATION_CATS.find((c) => c.cat === "分隊")!.color;
/** OSM 補缺：同色空心（填色淡化、描邊同色）。 */
export const GB_FIRE_OSM_FILL_FACTOR = 0.2;
export const GB_FIRE_OSM_STROKE_WIDTH = 1.5;
export const GB_FIRE_COUNTS = { official: 1_398, osm: 589 } as const;
export const GB_FIRE_COUNT = 1_987;

// ─────────────────────────── C076 法院 gbCourts ───────────────────────────

export const GB_COURTS_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0 (HMCTS Find a Court or Tribunal, Ministry of Justice)";
export const GB_COURTS_URL = "https://www.find-court-tribunal.service.gov.uk/";
export type GbCourtKind = "crown" | "county_family" | "magistrates" | "tribunal" | "other";
/** 台灣法院紫 #7c3aed／檢察署淺紫 #a855f7 同色系（同 manifest court／prosecutorsOffice）；其他據點中性灰。 */
export const GB_COURT_KINDS: readonly { value: GbCourtKind; color: string; count: number }[] = [
  { value: "crown", color: "#7c3aed", count: 84 },
  { value: "county_family", color: "#a855f7", count: 138 },
  { value: "magistrates", color: "#c4b5fd", count: 100 },
  { value: "tribunal", color: "#6366f1", count: 59 },
  { value: "other", color: GB_CIVIC_FALLBACK_COLOR, count: 69 },
];
export const GB_COURTS_COLOR = GB_COURT_KINDS[0]!.color;
export const GB_COURTS_COUNT = 450;
export function gbCourtKind(value: unknown) {
  return GB_COURT_KINDS.find((k) => k.value === value);
}
