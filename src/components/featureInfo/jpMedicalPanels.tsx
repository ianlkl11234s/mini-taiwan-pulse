import { jpMedicalCategory, JP_MEDICAL_CARE_GROUPS } from "../../data/jpMedicalTypes";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

const text = (value: unknown, na: string) => value == null || value === "" || value === "null" ? na : String(value);
const date = (value: unknown, na: string) => text(value, na).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");

export function JpMedicalFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const na = t("popup.common.notProvided");
  const category = jpMedicalCategory(props.record_kind);
  return <>
    <Title color={category?.color ?? "#94a3b8"}>{text(props.name, na)}</Title>
    <Row field="type" value={category ? enumLabel("jpMedicalCategory", category.value, category.label, i18n) : text(props.record_kind, na)} color={category?.color} />
    <Row field="address" value={text(props.address, na)} />
    <Row field="snapshotDate" value={date(props.snapshot_date, na)} />
    <Row field="source" value={t("popup.jpMedical.sourceNavii")} />
    <Row field="sourceId" value={text(props.source_id, na)} />
  </>;
}

export function JpMedicalCarePanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const na = t("popup.common.notProvided");
  const group = JP_MEDICAL_CARE_GROUPS.find(item => item.serviceTypes.some(value => value === props.service_type));
  const coLocated = Array.isArray(props.coLocatedServices) ? props.coLocatedServices.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : [];
  return <>
    <Title color={group?.color ?? "#94a3b8"}>{text(props.name, na)}</Title>
    <Row label={t("popup.jpMedical.parentGroup")} value={group ? enumLabel("jpMedicalCareGroup", group.key, group.label, i18n) : t("popup.common.unclassified")} color={group?.color} />
    <Row label={t("popup.jpMedical.rawServiceType")} value={text(props.service_type, na)} />
    <Row field="address" value={text(props.address, na)} />
    <Row field="source" value={t("popup.jpMedical.sourceH17")} />
    <Row label={t("popup.jpMedical.sourceSnapshot")} value={date(props.source_snapshot_day, na)} />
    {coLocated.length > 1 && <details style={{ marginTop: 10, fontSize: FONT_SIZE.sm, color: theme.textStrong }}>
      <summary>{t("popup.jpMedical.coLocated", { count: coLocated.length })}</summary>
      {coLocated.map((row, index) => <div key={index} style={{ margin: "8px 0", overflowWrap: "anywhere" }}>
        <strong>{text(row.name, na)}</strong>
        <Row label={t("popup.jpMedical.service")} value={text(row.service_type, na)} />
        <Row field="snapshot" value={date(row.source_snapshot_day, na)} />
      </div>)}
    </details>}
  </>;
}

export function JpMedicalAreasPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  const na = t("popup.common.notProvided");
  return <>
    <Title color="#f59e0b">{t("popup.jpMedical.areasTitle")}</Title>
    <Row label={t("popup.jpMedical.dataStatus")} value={t("popup.jpMedical.staleValue")} color="#f59e0b" />
    <Row field="source" value={t("popup.jpMedical.sourceAreas")} />
    <Row label={t("popup.jpMedical.purpose")} value={t("popup.jpMedical.purposeText")} />
    <Row label={t("popup.jpMedical.geometryGrain")} value={t("popup.jpMedical.geometryGrainText")} />
    <details style={{ marginTop: 8, color: theme.textStrong }}><summary>{t("popup.jpMedical.sourceFields")}</summary>
      {Object.entries(props).filter(([key]) => /^A38[abc]_/.test(key)).map(([key, value]) => <Row key={key} label={key} value={text(value, na)} />)}
      <Row label="Feature ID" value={text(props.feature_id, na)} />
    </details>
  </>;
}
