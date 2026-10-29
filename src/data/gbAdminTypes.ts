/**
 * 英國行政邊界（第 0b 波 C001）：LAD 與四地統計小區的來源、署名、版本 SSOT。
 * 圖例（legend）與 popup（featureInfo）共用，避免兩邊各抄一份。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/base_map/gb_admin_lad.md`、`gb_admin_small_areas.md`
 * （2026-10-29 當天讀取 ONS／Scottish Government／NISRA 授權頁）。
 */

/** 四地（nation 欄位值）。popup 與圖例依此顯示中文。 */
export const GB_NATIONS = ["England", "Scotland", "Wales", "Northern Ireland"] as const;
export type GbNation = (typeof GB_NATIONS)[number];

export const GB_ADMIN_LAD_COLOR = "#9ca3af";
export const GB_SMALL_AREA_COLOR = "#6b7280";

/** ONS LAD May 2026 UK BGC（361 區：England 296、Scotland 32、Wales 22、Northern Ireland 11）。 */
export const GB_LAD_ATTRIBUTION =
  "Source: Office for National Statistics licensed under the Open Government Licence v.3.0; Contains OS data © Crown copyright and database right 2026";
export const GB_LAD_SOURCE_URL =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/Local_Authority_Districts_May_2026_Boundaries_UK_BGC/FeatureServer";
export const GB_LICENSE = "Open Government Licence v3.0";
export const GB_LAD_VERSION = "ONS LAD May 2026";
export const GB_ADMIN_FETCHED_AT = "2026-10-29";

/** 統計小區四種類型（area_type 欄位值）＋各自來源署名與版本。 */
export const GB_SMALL_AREA_TYPES = [
  {
    value: "LSOA21",
    nations: "England／Wales",
    version: "ONS LSOA December 2021 EW BGC V5",
    attribution: GB_LAD_ATTRIBUTION,
    sourceUrl: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5/FeatureServer",
  },
  {
    value: "DZ22",
    nations: "Scotland",
    version: "Scottish Government Data Zone 2022",
    attribution: "Copyright Scottish Government, contains Ordnance Survey data © Crown copyright and database right 2026",
    sourceUrl: "https://maps.gov.scot/ATOM/shapefiles/SG_DataZoneBdry_2022.zip",
  },
  {
    value: "DZ21",
    nations: "Northern Ireland",
    version: "NISRA Data Zone 2021",
    attribution: "Contains Ordnance Survey of Northern Ireland information licensed under the Open Government Licence v3.0",
    sourceUrl: "https://www.nisra.gov.uk/publications/data-zone-boundaries-gis-format",
  },
  {
    value: "SDZ21",
    nations: "Northern Ireland",
    version: "NISRA Super Data Zone 2021",
    attribution: "Contains Ordnance Survey of Northern Ireland information licensed under the Open Government Licence v3.0",
    sourceUrl: "https://www.nisra.gov.uk/publications/super-data-zone-boundaries-gis-format",
  },
] as const;
export type GbSmallAreaType = (typeof GB_SMALL_AREA_TYPES)[number]["value"];

export function gbSmallAreaType(value: unknown) {
  return GB_SMALL_AREA_TYPES.find((type) => type.value === value);
}

/** 北愛小區層級（DZ 與 SDZ 空間完全重疊，只能擇一顯示）。select 的 encode 順序。 */
export const GB_NI_LEVELS = ["dz", "sdz"] as const;
