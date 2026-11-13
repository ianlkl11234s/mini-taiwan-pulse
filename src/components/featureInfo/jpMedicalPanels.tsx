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

/**
 * 国土数値情報 A38（医療圏 v2.0）屬性定義（KsjTmplt-A38-v2_0）：
 * - 一次 A38a：_002 市区町村名、_004 所屬二次医療圏名
 * - 二次 A38b：_002 圈內市区町村（逗號列出全部，正式資料例：豊島区,北区,板橋区,練馬区）、_004 二次医療圏名、_008 総人口（住民基本台帳）、_011 65才以上人口
 *   人口是整個醫療圈的合計、每個 polygon part 重複附著 → 只顯示、不可加總
 * - 三次 A38c：_001 都道府県名、_002 三次医療圏名（只有北海道分區，其餘為空＝以都道府県為範圍）
 */
function jpMedicalAreaSummary(props: Record<string, unknown>) {
  const s = (key: string) => {
    const value = props[key];
    return value == null || value === "" || value === "null" ? "" : String(value);
  };
  if ("A38b_004" in props) return { level: "b" as const, name: s("A38b_004"), s };
  if ("A38a_002" in props) return { level: "a" as const, name: s("A38a_002"), s };
  if ("A38c_001" in props) return { level: "c" as const, name: s("A38c_002") || s("A38c_001"), s };
  return null;
}

export function JpMedicalAreasPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const { t, formatNumber } = useLocale();
  const na = t("popup.common.notProvided");
  const area = jpMedicalAreaSummary(props);
  const count = (key: string) => {
    const raw = area?.s(key) ?? "";
    const value = Number(raw);
    return raw === "" || !Number.isFinite(value) ? "" : formatNumber(value);
  };
  return <>
    <Title color="#f59e0b">{area?.name || t("popup.jpMedical.areasTitle")}</Title>
    {area?.level === "a" && <Row label={t("popup.jpMedical.secondaryArea")} value={area.s("A38a_004")} />}
    {area?.level === "b" && <>
      <Row label={t("popup.jpMedical.areaMunicipalities")} value={area.s("A38b_002")} />
      <Row label={t("popup.jpMedical.populationTotal")} value={count("A38b_008")} />
      <Row label={t("popup.jpMedical.population65")} value={count("A38b_011")} />
    </>}
    {area?.level === "c" && <Row label={t("popup.jpMedical.prefecture")} value={area.s("A38c_001")} />}
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
