import { ALLEN_CORAL_ACQUIRED_AT } from "../../data/allenCoralAtlasTypes";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { Row } from "./shared";

function text(value: unknown, na: string): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return na;
  return String(value).trim() || na;
}

function area(value: unknown, na: string): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return na;
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value, na);
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} km²`;
}

/** Allen Coral Atlas MVT omits null fields; absence is shown as 未提供. */
export function AllenCoralAtlasPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const na = tr("popup.common.notProvided");
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#ee6c83", flexShrink: 0 }} />
      <span style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>Allen Coral Atlas</span>
    </div>
    <Row field="classification" value={text(props.class_name, na)} />
    <Row label={tr("popup.allenCoral.region")} value={text(props.region, na)} />
    <Row label={tr("popup.allenCoral.window")} value={text(props.window_ids, na)} />
    <Row label={tr("popup.allenCoral.sourceArea")} value={area(props.source_area_sqkm, na)} />
    <Row field="sourceVersion" value={text(props.source_version, na)} />
    <Row field="sourceYear" value={text(props.source_year, na)} />
    <Row label={tr("popup.allenCoral.resolution")} value={props.nominal_resolution_m == null ? na : `${text(props.nominal_resolution_m, na)} m`} />
    <Row label={tr("popup.allenCoral.geometryRole")} value={text(props.geometry_role, na)} />
    <Row label="Feature ID" value={text(props.feature_id, na)} />
    <div style={{ marginTop: 7, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.45 }}>{tr("popup.allenCoral.warning")}</div>
    <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.45 }}>{tr("popup.allenCoral.areaNote", { date: ALLEN_CORAL_ACQUIRED_AT.slice(0, 10) })}</div>
    <Row field="attribution" value={tr("popup.allenCoral.attribution")} />
  </>;
}
