// 英國第 7 波公共服務圖例（2026-10-29）：學校、醫療、照護之家、長照服務、消防站、法院。
// 色票與署名 SSOT 在 data/gbCivicTypes.ts；每層標涵蓋範圍（未涵蓋地區）、郵遞區號定位與來源署名。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, useLegendTheme } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_CARE_CI_ATTRIBUTION, GB_CARE_CQC_ATTRIBUTION, GB_CARE_KINDS, GB_COURT_KINDS, GB_COURTS_ATTRIBUTION, GB_FIRE_COLOR, GB_FIRE_COUNTS,
  GB_FIRE_MHCLG_ATTRIBUTION, GB_FIRE_OSM_STROKE_WIDTH, GB_HEALTH_KINDS, GB_HEALTH_ODS_ATTRIBUTION,
  GB_HEALTH_PHS_ATTRIBUTION, GB_ONSPD_ATTRIBUTION, GB_OSM_ATTRIBUTION, GB_SCHOOL_CATEGORIES, GB_SCHOOLS_ATTRIBUTION, gbHealthColor,
  type GbCareKind, type GbCourtKind, type GbHealthKind, type GbSchoolCategory,
} from "../../data/gbCivicTypes";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}
function OnspdNote() {
  return <>{GB_ONSPD_ATTRIBUTION.map((line) => <LegendNote key={line}>{line}</LegendNote>)}</>;
}

export const GB_SCHOOL_CATEGORY_KEYS: Record<GbSchoolCategory, MessageKey> = {
  nursery: "legend.civic.gbSchoolNursery", primary: "legend.civic.gbSchoolPrimary", secondary: "legend.civic.gbSchoolSecondary",
  all_through: "legend.civic.gbSchoolAllThrough", further_education: "legend.civic.gbSchoolFurtherEducation",
  higher_education: "legend.civic.gbSchoolHigherEducation", special: "legend.civic.gbSchoolSpecial", pru: "legend.civic.gbSchoolPru",
  other: "legend.civic.gbSchoolOther",
};

/** 英國學校：學段 9 色（沿用台灣學制色）；北愛 2016 名冊、蘇格蘭只有公立與 grant-aided。 */
export function GbSchoolsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbSchools", i18n)} en="Schools" />
    {GB_SCHOOL_CATEGORIES.map((c) => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{i18n.t(GB_SCHOOL_CATEGORY_KEYS[c.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.gbSchoolsScotland")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbSchoolsNi")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbPostcodeNote")}</LegendNote>
    <DenseHeatmapLegendRow layers={["gbSchools"]} />
    <LegendNote>{i18n.t("legend.civic.gbPointsZoom10")}</LegendNote>
    <LegendNote>{GB_SCHOOLS_ATTRIBUTION}</LegendNote>
    <OnspdNote />
  </div>;
}

export const GB_HEALTH_KIND_KEYS: Record<GbHealthKind, MessageKey> = {
  hospital: "legend.civic.gbHealthHospital", gp_practice: "legend.civic.gbHealthGp", pharmacy: "legend.civic.gbHealthPharmacy",
};

/** 英國醫療：醫院／GP 診所／藥局（沿用台灣醫療點位色）；北愛未涵蓋；英格蘭與威爾斯醫院為名稱比對。 */
export function GbHealthFacilitiesLegend() {
  const i18n = useLocale();
  const { isDark } = useLegendTheme();
  return <div>
    <LegendTitle zh={layerTitle("gbHealthFacilities", i18n)} en="Health Facilities" />
    {GB_HEALTH_KINDS.map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={gbHealthColor(k.value, isDark)} />}>{i18n.t(GB_HEALTH_KIND_KEYS[k.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.gbHealthNiUncovered")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbHealthNameMatch")}</LegendNote>
    <DenseHeatmapLegendRow layers={["gbHealthFacilities"]} />
    <LegendNote>{i18n.t("legend.civic.gbHealthZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbPostcodeNote")}</LegendNote>
    <LegendNote>{GB_HEALTH_ODS_ATTRIBUTION}</LegendNote>
    <LegendNote>{GB_HEALTH_PHS_ATTRIBUTION}</LegendNote>
    <OnspdNote />
  </div>;
}

export const GB_CARE_KIND_KEYS: Record<GbCareKind, MessageKey> = {
  care_home_nursing: "legend.civic.gbCareHomeNursing", care_home: "legend.civic.gbCareHome", home_care: "legend.civic.gbCareHomeCare",
  supported_living: "legend.civic.gbCareSupportedLiving", shared_lives: "legend.civic.gbCareSharedLives", other_community: "legend.civic.gbCareOtherCommunity",
};

function GbCareLegend({ layerKey, en, home }: { layerKey: "gbCareHomes" | "gbCareServices"; en: string; home: boolean }) {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle(layerKey, i18n)} en={en} />
    {GB_CARE_KINDS.filter((k) => k.home === home).map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>{i18n.t(GB_CARE_KIND_KEYS[k.value])}</LegendRow>)}
    {home ? <LegendNote>{i18n.t("legend.civic.gbCareNursingNote")}</LegendNote> : <LegendNote>{i18n.t("legend.civic.gbCareOfficeNote")}</LegendNote>}
    <LegendNote>{i18n.t("legend.civic.gbCareUncovered")}</LegendNote>
    {home ? null : <LegendNote>{i18n.t("legend.civic.gbCareChildNote")}</LegendNote>}
    <LegendNote>{i18n.t("legend.civic.gbCarePostcodeNote")}</LegendNote>
    <DenseHeatmapLegendRow layers={[layerKey]} />
    <LegendNote>{i18n.t("legend.civic.gbPointsZoom10")}</LegendNote>
    <LegendNote>{GB_CARE_CQC_ATTRIBUTION}</LegendNote>
    <LegendNote>{GB_CARE_CI_ATTRIBUTION}</LegendNote>
    <OnspdNote />
  </div>;
}
/** 英國照護之家（住宿照顧）：護理照護之家／照護之家。 */
export function GbCareHomesLegend() {
  return <GbCareLegend layerKey="gbCareHomes" en="Care Homes" home />;
}
/** 英國長照服務：居家照顧、支持性住宅、Shared Lives、其他社區服務。 */
export function GbCareServicesLegend() {
  return <GbCareLegend layerKey="gbCareServices" en="Care Services" home={false} />;
}

/** 英國消防站：官方（英格蘭）實心／OSM 補缺（蘇格蘭、威爾斯、北愛）空心。 */
export function GbFireStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbFireStations", i18n)} en="Fire Stations" />
    <LegendRow swatch={<SwatchDot color={GB_FIRE_COLOR} />}>{i18n.t("legend.civic.gbFireOfficial", { n: i18n.formatNumber(GB_FIRE_COUNTS.official) })}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" opacity={1} stroke={GB_FIRE_COLOR} strokeWidth={GB_FIRE_OSM_STROKE_WIDTH} />}>{i18n.t("legend.civic.gbFireOsm", { n: i18n.formatNumber(GB_FIRE_COUNTS.osm) })}</LegendRow>
    <LegendNote>{i18n.t("legend.civic.gbFireNote")}</LegendNote>
    <LegendNote>{GB_FIRE_MHCLG_ATTRIBUTION}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
    <OnspdNote />
  </div>;
}

export const GB_COURT_KIND_KEYS: Record<GbCourtKind, MessageKey> = {
  crown: "legend.civic.gbCourtCrown", county_family: "legend.civic.gbCourtCountyFamily", magistrates: "legend.civic.gbCourtMagistrates",
  tribunal: "legend.civic.gbCourtTribunal", other: "legend.civic.gbCourtOther",
};

/** 英國法院：5 類（沿用台灣法院紫色系）；只涵蓋英格蘭與威爾斯。 */
export function GbCourtsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbCourts", i18n)} en="Courts & Tribunals" />
    {GB_COURT_KINDS.map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>{i18n.t(GB_COURT_KIND_KEYS[k.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.gbCourtsUncovered")}</LegendNote>
    <LegendNote>{GB_COURTS_ATTRIBUTION}</LegendNote>
    <OnspdNote />
  </div>;
}
