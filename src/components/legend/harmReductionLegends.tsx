// 減害服務圖層圖例（legendKit；色票與地圖 paint 同源，皆 import harmReductionTypes）。
import { useLocale } from "../../state/localeStore";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LegendNote, LegendRow, LegendTitle, SwatchDot } from "./legendKit";
import {
  CONDOM_OUTLET_OPTIONS, DUI_CLASS_OPTIONS, HARM_REDUCTION_COLORS, HIV_TESTING_CATEGORY_OPTIONS,
  INTERNET_SERVICE_TYPE_OPTIONS, SELFTEST_CHANNEL_OPTIONS, SMOKING_FACILITY_OPTIONS, TREATMENT_CATEGORY_OPTIONS,
} from "../../data/harmReductionTypes";

function CategoryRows({ domain, options }: { domain: string; options: readonly { value: string; label: string; color: string }[] }) {
  const i18n = useLocale();
  return <>{options.map((option) => <LegendRow key={option.value} swatch={<SwatchDot color={option.color} />}>{enumLabel(domain, option.value, option.label, i18n)}</LegendRow>)}</>;
}

export function HarmReductionNeedleLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionNeedle", LAYER_MANIFEST.harmReductionNeedle.name, i18n).primary} en="Needle & Syringe Services" />
    <LegendRow swatch={<SwatchDot color={HARM_REDUCTION_COLORS.harmReductionNeedle} />}>{i18n.t("legend.harmReduction.needleRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.harmReduction.needleNote", { precision: i18n.t("legend.harmReduction.precision") })}</LegendNote>
  </div>;
}

export function HarmReductionTreatmentLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionTreatment", LAYER_MANIFEST.harmReductionTreatment.name, i18n).primary} en="Substitution & Addiction Treatment" />
    <CategoryRows domain="harmReductionTreatmentCategory" options={TREATMENT_CATEGORY_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.treatmentNote", { precision: i18n.t("legend.harmReduction.precision") })}</LegendNote>
  </div>;
}

export function HarmReductionHivSelftestLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionHivSelftest", LAYER_MANIFEST.harmReductionHivSelftest.name, i18n).primary} en="HIV Self-test Outlets" />
    <CategoryRows domain="harmReductionSelftestChannel" options={SELFTEST_CHANNEL_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.selftestNote", { precision: i18n.t("legend.harmReduction.precision") })}</LegendNote>
  </div>;
}

export function HarmReductionHivTestingLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionHivTesting", LAYER_MANIFEST.harmReductionHivTesting.name, i18n).primary} en="HIV Testing & Care" />
    <CategoryRows domain="harmReductionHivCategory" options={HIV_TESTING_CATEGORY_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.hivTestingNote", { precision: i18n.t("legend.harmReduction.precision") })}</LegendNote>
  </div>;
}

export function HarmReductionPreventionCentersLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionPreventionCenters", LAYER_MANIFEST.harmReductionPreventionCenters.name, i18n).primary} en="Drug Abuse Prevention Centers" />
    <LegendRow swatch={<SwatchDot color={HARM_REDUCTION_COLORS.harmReductionPreventionCenters} />}>{i18n.t("legend.harmReduction.preventionRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.harmReduction.preventionNote")}</LegendNote>
  </div>;
}

// ══════════ 第二批（2026-10-06）══════════

function SingleColorLegend({ title, en, color, row, note }: { title: string; en: string; color: string; row: string; note: string }) {
  return <div>
    <LegendTitle zh={title} en={en} />
    <LegendRow swatch={<SwatchDot color={color} />}>{row}</LegendRow>
    <LegendNote>{note}</LegendNote>
  </div>;
}

export function HarmReductionAlcoholLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  return <SingleColorLegend title={localizeLayerName("harmReductionAlcohol", LAYER_MANIFEST.harmReductionAlcohol.name, i18n).primary} en="Alcohol Treatment & DUI Assessment"
    color={HARM_REDUCTION_COLORS.harmReductionAlcohol} row={t("legend.harmReduction.alcoholRow")}
    note={t("legend.harmReduction.alcoholNote", { precision: t("legend.harmReduction.precision") })} />;
}

export function HarmReductionPrepLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  return <SingleColorLegend title={localizeLayerName("harmReductionPrep", LAYER_MANIFEST.harmReductionPrep.name, i18n).primary} en="HIV PrEP Providers"
    color={HARM_REDUCTION_COLORS.harmReductionPrep} row={t("legend.harmReduction.prepRow")}
    note={t("legend.harmReduction.prepNote", { precision: t("legend.harmReduction.precision") })} />;
}

export function HarmReductionInternetAddictionLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionInternetAddiction", LAYER_MANIFEST.harmReductionInternetAddiction.name, i18n).primary} en="Internet Addiction Services" />
    <CategoryRows domain="harmReductionInternetType" options={INTERNET_SERVICE_TYPE_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.internetNote", { precision: i18n.t("legend.harmReduction.precision") })}</LegendNote>
  </div>;
}

export function HarmReductionAftercareLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  return <SingleColorLegend title={localizeLayerName("harmReductionAftercare", LAYER_MANIFEST.harmReductionAftercare.name, i18n).primary} en="Offender Aftercare Offices"
    color={HARM_REDUCTION_COLORS.harmReductionAftercare} row={t("legend.harmReduction.aftercareRow")}
    note={t("legend.harmReduction.aftercareNote")} />;
}

export function HarmReductionSmokingCessationLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionSmokingCessation", LAYER_MANIFEST.harmReductionSmokingCessation.name, i18n).primary} en="Smoking Cessation Providers" />
    <CategoryRows domain="harmReductionSmokingFacility" options={SMOKING_FACILITY_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.smokingNote", { precision: i18n.t("legend.harmReduction.precision") })}</LegendNote>
  </div>;
}

export function HarmReductionAntiDrugPharmaciesLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  return <SingleColorLegend title={localizeLayerName("harmReductionAntiDrugPharmacies", LAYER_MANIFEST.harmReductionAntiDrugPharmacies.name, i18n).primary} en="Community Anti-drug Pharmacies"
    color={HARM_REDUCTION_COLORS.harmReductionAntiDrugPharmacies} row={t("legend.harmReduction.pharmacyRow")}
    note={t("legend.harmReduction.pharmacyNote")} />;
}

export function HarmReductionCondomOutletsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionCondomOutlets", LAYER_MANIFEST.harmReductionCondomOutlets.name, i18n).primary} en="Condom Outlets" />
    <CategoryRows domain="harmReductionCondomOutlet" options={CONDOM_OUTLET_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.condomNote")}</LegendNote>
  </div>;
}

export function HarmReductionTherapeuticCommunitiesLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  return <SingleColorLegend title={localizeLayerName("harmReductionTherapeuticCommunities", LAYER_MANIFEST.harmReductionTherapeuticCommunities.name, i18n).primary} en="Therapeutic Communities & Halfway Houses"
    color={HARM_REDUCTION_COLORS.harmReductionTherapeuticCommunities} row={t("legend.harmReduction.communityRow")}
    note={t("legend.harmReduction.communityNote")} />;
}

export function HarmReductionDuiCrashesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("harmReductionDuiCrashes", LAYER_MANIFEST.harmReductionDuiCrashes.name, i18n).primary} en="Drunk-driving Crashes" />
    <CategoryRows domain="harmReductionDuiClass" options={DUI_CLASS_OPTIONS} />
    <LegendNote>{i18n.t("legend.harmReduction.duiNote")}</LegendNote>
  </div>;
}
