import { ALLEN_CORAL_ACQUIRED_AT, ALLEN_CORAL_ATTRIBUTION, ALLEN_CORAL_WARNING } from "../../data/allenCoralAtlasTypes";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row } from "./shared";

function text(value: unknown): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return "未提供";
  return String(value).trim() || "未提供";
}

function area(value: unknown): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return "未提供";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} km²`;
}

/** Allen Coral Atlas MVT omits null fields; absence is shown as 未提供. */
export function AllenCoralAtlasPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#ee6c83", flexShrink: 0 }} />
      <span style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>Allen Coral Atlas</span>
    </div>
    <Row label="分類" value={text(props.class_name)} />
    <Row label="研究區域" value={text(props.region)} />
    <Row label="研究窗口" value={text(props.window_ids)} />
    <Row label="來源完整要素面積" value={area(props.source_area_sqkm)} />
    <Row label="來源版本" value={text(props.source_version)} />
    <Row label="來源年份" value={text(props.source_year)} />
    <Row label="名目解析度" value={props.nominal_resolution_m == null ? "未提供" : `${text(props.nominal_resolution_m)} m`} />
    <Row label="幾何角色" value={text(props.geometry_role)} />
    <Row label="Feature ID" value={text(props.feature_id)} />
    <div style={{ marginTop: 7, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.45 }}>{ALLEN_CORAL_WARNING}</div>
    <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.45 }}>來源完整要素面積未裁切，不能視為研究區珊瑚總面積。取得日 {ALLEN_CORAL_ACQUIRED_AT.slice(0, 10)}，不是觀測日。</div>
    <Row label="出典" value={ALLEN_CORAL_ATTRIBUTION} />
  </>;
}
