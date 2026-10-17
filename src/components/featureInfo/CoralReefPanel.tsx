import { CORAL_REEF_ATTRIBUTION, CORAL_REEF_COLOR } from "../../data/coralReefTypes";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import type { LocaleSnapshot } from "../../state/localeStore";

const text = (value: unknown, na: string): string => {
  if (value == null || value === "" || value === "null" || value === "undefined") return na;
  return String(value).trim() || na;
};

const area = (value: unknown, na: string, { formatNumber }: LocaleSnapshot): string => {
  if (value == null || value === "" || value === "null" || value === "undefined") return na;
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value, na);
  if (n > 0 && n < 0.001) return `${n.toExponential(2)} km²`;
  return `${formatNumber(n, { maximumFractionDigits: 3 })} km²`;
};

/** UNEP-WCMC PMTiles 的 19 欄屬性；MVT 缺屬性仍視為 null。 */
export function CoralReefPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const na = tr("popup.common.notProvided");
  const text_ = (value: unknown) => text(value, na);
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: CORAL_REEF_COLOR, flexShrink: 0 }} />
      <span style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{tr("popup.coralReef.title")}</span>
    </div>
    <Row label={tr("popup.coralReef.reefName")} value={text_(props.reef_name)} />
    <Row label={tr("popup.coralReef.featureId")} value={text_(props.feature_id)} />
    <Row field="dataset" value={text_(props.source_dataset)} />
    <Row field="version" value={text_(props.source_version)} />
    <Row label={tr("popup.coralReef.observedYear")} value={text_(props.source_year)} />
    <Row label={tr("popup.coralReef.sourceArea")} value={area(props.area_km2, na, i18n)} />
    <Row label={tr("popup.coralReef.geometryStatus")} value={text_(props.geometry_status)} />
    <Row label={tr("popup.coralReef.geometryDefinition")} value={text_(props.source_loc_def)} />
    <Row label={tr("popup.coralReef.builtAt")} value={text_(props.built_at)} />
    <div style={{ marginTop: 7, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.45 }}>
      {tr("popup.coralReef.note")}
    </div>
    <details style={{ marginTop: 7, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      <summary style={{ cursor: "pointer" }}>{tr("popup.coralReef.sourceDetails")}</summary>
      <Row label={tr("popup.coralReef.originalCompiler")} value={text_(props.origin_org)} />
      <Row label={tr("popup.coralReef.distributor")} value={text_(props.distribution_org)} />
      <Row field="license" value={text_(props.license)} />
      <Row label={tr("popup.coralReef.metadataId")} value={text_(props.source_metadata_id)} />
      <Row label={tr("popup.coralReef.startDate")} value={text_(props.source_start_date)} />
      <Row label={tr("popup.coralReef.endDate")} value={text_(props.source_end_date)} />
      <Row label={tr("popup.coralReef.dateType")} value={text_(props.source_date_type)} />
      <Row label={tr("popup.coralReef.dataType")} value={text_(props.source_data_type)} />
      <Row label={tr("popup.coralReef.sourceVerification")} value={text_(props.source_verification)} />
      <Row label={tr("popup.coralReef.sourceLayer")} value={text_(props.source_layer_name)} />
    </details>
    <Row field="attribution" value={CORAL_REEF_ATTRIBUTION} />
  </>;
}
