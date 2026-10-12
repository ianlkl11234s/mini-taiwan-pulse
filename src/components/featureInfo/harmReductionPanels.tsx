import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import {
  ALCOHOL_SERVICE_OPTIONS, CONDOM_OUTLET_OPTIONS, DUI_CLASS_OPTIONS,
  HARM_REDUCTION_COLORS, HIV_TESTING_CATEGORY_OPTIONS, INTERNET_SERVICE_TYPE_OPTIONS, NEEDLE_SERVICE_OPTIONS,
  PREP_FUNDING_OPTIONS, SELFTEST_CHANNEL_OPTIONS, SMOKING_FACILITY_OPTIONS,
  TREATMENT_CATEGORY_OPTIONS, harmReductionPrecisionLabel, isEstimatedPrecision, labelOf,
} from "../../data/harmReductionTypes";

/**
 * 減害服務圖層 popup。來源 footer 由 FeatureInfoPanel 統一掛（public 檔已帶
 * source_org / source_url / license / fetched_at / source_tier），這裡只補「資料日期」。
 * 類別文字讀上游中文標籤欄 `<欄>_label`（對照表 SSOT 在 analytics 各 pipeline config.yaml labels），
 * 前端不自建英文代碼對照；`*_OPTIONS` 只負責篩選值與色票。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/** 上游中文標籤欄 `<欄>_label` 是資料值；有對應類別代碼時，外文語系改用代碼翻譯，缺譯時回退中文原值。 */
const coded = (domain: string, code: unknown, zhLabel: string, i18n: LocaleSnapshot): string =>
  code == null || code === "" ? zhLabel : enumLabel(domain, String(code), zhLabel, i18n);

function colorOf(options: readonly { value: string; color: string }[], value: unknown, fallback: string): string {
  return options.find((option) => option.value === value)?.color ?? fallback;
}

/** 5 層共通尾段：地址／電話／服務時間／座標精度／資料日期 */
function CommonRows({ props }: Props) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const precision = props.geocode_precision;
  return <>
    <Row field="address" value={str(props.address)} />
    <Row field="phone" value={str(props.phone).replace(/\|/g, "、")} />
    <Row field="serviceHours" value={str(props.service_hours).replace(/\s*\n+\s*/g, "；")} />
    <Row
      field="coordPrecision"
      value={typeof precision === "string" ? enumLabel("harmReductionPrecision", precision, harmReductionPrecisionLabel(precision), i18n) : harmReductionPrecisionLabel(precision)}
      color={isEstimatedPrecision(precision) ? t.warn : undefined}
    />
    <Row field="dataDate" value={str(props.vintage)} mono />
  </>;
}

export function HarmReductionNeedlePanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const sep = tr("popup.common.listSeparator");
  const services = NEEDLE_SERVICE_OPTIONS
    .filter((option) => props[option.flag] === true)
    .map((option) => `${enumLabel("harmReductionNeedleService", option.value, option.label, i18n)}${props[option.is24h] === true ? tr("popup.harmReduction.is24h") : ""}`);
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionNeedle}>{str(props.name) || tr("popup.harmReduction.needleTitle")}</Title>
    <Row label={tr("popup.harmReduction.services")} value={services.join(sep)} color={HARM_REDUCTION_COLORS.harmReductionNeedle} />
    <Row label={tr("popup.harmReduction.siteType")} value={str(props.site_type).replace(/\|/g, sep)} />
    {props.in_cdc_list === false && <Row label={tr("popup.harmReduction.roster")} value={tr("popup.harmReduction.rosterNote")} />}
    <CommonRows props={props} />
  </>;
}

/** 藥癮維持治療月報（最新月與期間平均；無月報的機構不顯示，不當成 0）。 */
function maintenanceText(props: Record<string, unknown>, suffix: "" | "_mean", tr: LocaleSnapshot["t"]): string {
  const parts = [[tr("popup.harmReduction.methadone"), props[`methadone_patients${suffix}`]], [tr("popup.harmReduction.buprenorphine"), props[`buprenorphine_patients${suffix}`]]]
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => `${label} ${tr("popup.harmReduction.persons", { count: value as number })}`);
  return parts.join(tr("popup.common.listSeparator"));
}

export function HarmReductionTreatmentPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(TREATMENT_CATEGORY_OPTIONS, props.category, HARM_REDUCTION_COLORS.harmReductionTreatment);
  const drugs = [props.has_methadone === true && tr("popup.harmReduction.methadone"), props.has_buprenorphine === true && tr("popup.harmReduction.buprenorphine")].filter(Boolean);
  return <>
    <Title color={color}>{str(props.name) || tr("popup.harmReduction.treatmentTitle")}</Title>
    <Row field="category" value={coded("harmReductionTreatmentCategory", props.category, str(props.category_label), i18n)} color={color} />
    <Row label={tr("popup.harmReduction.facilityType")} value={str(props.facility_type_label)} />
    <Row label={tr("popup.harmReduction.substitutionDrugs")} value={drugs.join(tr("popup.common.listSeparator"))} />
    <Row label={tr("popup.harmReduction.designationValidTo")} value={str(props.designation_valid_to)} mono />
    <Row label={tr("popup.harmReduction.maintenancePatients", { month: str(props.maintenance_month) })} value={maintenanceText(props, "", tr)} />
    <Row
      label={tr("popup.harmReduction.periodAverage", { first: str(props.maintenance_first_month), last: str(props.maintenance_month) })}
      value={maintenanceText(props, "_mean", tr)}
    />
    {props.maintenance_month != null && <Row label={tr("popup.harmReduction.monthlyNoteLabel")} value={tr("popup.harmReduction.monthlyNote")} />}
    <CommonRows props={props} />
  </>;
}

export function HarmReductionHivSelftestPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(SELFTEST_CHANNEL_OPTIONS, props.channel, HARM_REDUCTION_COLORS.harmReductionHivSelftest);
  const voucher = props.voucher_redeem === true ? tr("popup.harmReduction.can") : props.voucher_redeem === false ? tr("popup.common.no") : "";
  return <>
    <Title color={color}>{str(props.name) || tr("popup.harmReduction.selftestTitle")}</Title>
    <Row label={tr("popup.harmReduction.channelType")} value={coded("harmReductionSelftestChannel", props.channel, str(props.channel_label), i18n)} color={color} />
    <Row label={tr("popup.harmReduction.outletType")} value={str(props.outlet_type_label)} />
    <Row label={tr("popup.harmReduction.machineType")} value={str(props.machine_type_label)} />
    <Row label={tr("popup.harmReduction.voucher")} value={voucher} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionHivTestingPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(HIV_TESTING_CATEGORY_OPTIONS, props.category, HARM_REDUCTION_COLORS.harmReductionHivTesting);
  return <>
    <Title color={color}>{str(props.name) || tr("popup.harmReduction.hivTestingTitle")}</Title>
    <Row field="category" value={coded("harmReductionHivCategory", props.category, str(props.category_label), i18n)} color={color} />
    <Row label={tr("popup.harmReduction.facilityLevel")} value={str(props.subtype_label)} />
    <Row label={tr("popup.harmReduction.lineContact")} value={str(props.contact_line)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionPreventionCenterPanel({ props }: Props) {
  const { t: tr } = useLocale();
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionPreventionCenters}>{str(props.name) || tr("popup.harmReduction.preventionTitle")}</Title>
    <CommonRows props={props} />
  </>;
}

// ══════════ 第二批（2026-10-06）══════════

const yesNo = (v: unknown, tr: LocaleSnapshot["t"]): string =>
  v === true ? tr("popup.common.yes") : v === false ? tr("popup.common.no") : "";

export function HarmReductionAlcoholPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const services = str(props.service_type_label)
    || ALCOHOL_SERVICE_OPTIONS.filter((option) => props[option.flag] === true).map((option) => enumLabel("harmReductionAlcoholService", option.value, option.label, i18n)).join(tr("popup.common.listSeparator"));
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionAlcohol}>{str(props.name) || tr("popup.harmReduction.alcoholTitle")}</Title>
    <Row field="serviceItems" value={services} color={HARM_REDUCTION_COLORS.harmReductionAlcohol} />
    <Row label={tr("popup.harmReduction.facilityType")} value={str(props.facility_type_label)} />
    <Row label={tr("popup.harmReduction.alsoDrugTreatment")} value={props.also_drug_treatment === true ? tr("popup.harmReduction.alsoDrugTreatmentYes") : yesNo(props.also_drug_treatment, tr)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionPrepPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const funding = PREP_FUNDING_OPTIONS.filter((option) => props[option.flag] === true).map((option) => enumLabel("harmReductionPrepFunding", option.value, option.label, i18n));
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionPrep}>{str(props.name) || tr("popup.harmReduction.prepTitle")}</Title>
    <Row label={tr("popup.harmReduction.prepFunding")} value={funding.join(tr("popup.common.listSeparator"))} color={HARM_REDUCTION_COLORS.harmReductionPrep} />
    <Row label={tr("popup.harmReduction.facilityType")} value={str(props.facility_type_label)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionInternetAddictionPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(INTERNET_SERVICE_TYPE_OPTIONS, props.service_type, HARM_REDUCTION_COLORS.harmReductionInternetAddiction);
  return <>
    <Title color={color}>{str(props.name) || tr("popup.harmReduction.internetTitle")}</Title>
    <Row label={tr("popup.harmReduction.institutionType")} value={coded("harmReductionInternetType", props.service_type, labelOf(INTERNET_SERVICE_TYPE_OPTIONS, props.service_type), i18n)} color={color} />
    <Row label={tr("popup.harmReduction.department")} value={str(props.dept)} />
    {props.special_clinic === true && <Row label={tr("popup.harmReduction.specialClinic")} value={tr("popup.harmReduction.specialClinicNote")} />}
    <CommonRows props={props} />
  </>;
}

export function HarmReductionAftercarePanel({ props }: Props) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionAftercare}>{str(props.name) || tr("popup.harmReduction.aftercareTitle")}</Title>
    <Row label={tr("popup.harmReduction.unit")} value={str(props.office_type_label)} />
    <Row field="dataVersion" value={tr("popup.harmReduction.aftercareVersion")} color={t.warn} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionSmokingCessationPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(SMOKING_FACILITY_OPTIONS, props.facility_type, HARM_REDUCTION_COLORS.harmReductionSmokingCessation);
  return <>
    <Title color={color}>{str(props.name) || tr("popup.harmReduction.smokingTitle")}</Title>
    <Row label={tr("popup.harmReduction.institutionType")} value={coded("harmReductionSmokingFacility", props.facility_type, str(props.facility_type_label), i18n)} color={color} />
    <Row label={tr("popup.harmReduction.smokingServices")} value={str(props.services_label)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionAntiDrugPharmacyPanel({ props }: Props) {
  const { t: tr } = useLocale();
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionAntiDrugPharmacies}>{str(props.name) || tr("popup.harmReduction.pharmacyTitle")}</Title>
    <Row label={tr("popup.harmReduction.program")} value={str(props.program)} />
    <Row field="coverageScope" value={tr("popup.harmReduction.pharmacyScope")} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionCondomOutletPanel({ props }: Props) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(CONDOM_OUTLET_OPTIONS, props.outlet_type, HARM_REDUCTION_COLORS.harmReductionCondomOutlets);
  return <>
    <Title color={color}>{str(props.name) || tr("popup.harmReduction.condomTitle")}</Title>
    <Row field="type" value={coded("harmReductionCondomOutlet", props.outlet_type, str(props.outlet_type_label), i18n)} color={color} />
    <Row label={tr("popup.harmReduction.itemNote")} value={str(props.item_note)} />
    {props.item_confirmed === false && <Row label={tr("popup.harmReduction.item")} value={tr("popup.harmReduction.itemUnconfirmed")} color={t.warn} />}
    <Row field="coverageScope" value={tr("popup.harmReduction.condomScope")} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionTherapeuticCommunityPanel({ props }: Props) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionTherapeuticCommunities}>{str(props.name) || tr("popup.harmReduction.communityTitle")}</Title>
    <Row label={tr("popup.harmReduction.serviceModes")} value={str(props.service_modes)} />
    <Row label={tr("popup.harmReduction.program")} value={str(props.programs)} />
    <Row label={tr("popup.harmReduction.therapeuticCommunity")} value={yesNo(props.is_therapeutic_community, tr)} />
    <Row label={tr("popup.harmReduction.locationNote")} value={tr("popup.harmReduction.locationNoteValue")} color={t.warn} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionDuiCrashPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const color = colorOf(DUI_CLASS_OPTIONS, props.accident_class, HARM_REDUCTION_COLORS.harmReductionDuiCrashes);
  const casualties = [
    typeof props.deaths === "number" ? tr("popup.harmReduction.deaths", { count: props.deaths }) : "",
    typeof props.injuries === "number" ? tr("popup.harmReduction.injuries", { count: props.injuries }) : "",
  ].filter(Boolean).join(tr("popup.common.listSeparator"));
  return <>
    <Title color={color}>{tr("popup.harmReduction.duiTitle")}</Title>
    <Row field="category" value={coded("harmReductionDuiClass", props.accident_class, str(props.accident_class_label), i18n)} color={color} />
    <Row field="occurredAt" value={`${str(props.accident_date)} ${str(props.accident_time)}`.trim()} mono />
    <Row label={tr("popup.harmReduction.casualties")} value={casualties} />
    <Row field="place" value={str(props.location)} />
    <Row label={tr("popup.harmReduction.mainCause")} value={str(props.cause_main)} />
    <Row label={tr("popup.harmReduction.duiBasis")} value={str(props.dui_cause_basis_label)} />
    <Row label={tr("popup.harmReduction.duiParties")} value={typeof props.n_dui_parties === "number" ? tr("popup.harmReduction.persons", { count: props.n_dui_parties }) : ""} />
    <Row label={tr("popup.common.coordinates")} value={tr("popup.harmReduction.policeCoords")} />
    <Row field="dataDate" value={str(props.vintage)} mono />
  </>;
}
