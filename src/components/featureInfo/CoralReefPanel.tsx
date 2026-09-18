import { CORAL_REEF_ATTRIBUTION, CORAL_REEF_COLOR } from "../../data/coralReefTypes";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row } from "./shared";

const text = (value: unknown): string => {
  if (value == null || value === "" || value === "null" || value === "undefined") return "未提供";
  return String(value).trim() || "未提供";
};

const area = (value: unknown): string => {
  if (value == null || value === "" || value === "null" || value === "undefined") return "未提供";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  if (n > 0 && n < 0.001) return `${n.toExponential(2)} km²`;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} km²`;
};

/** UNEP-WCMC PMTiles 的 19 欄屬性；MVT 缺屬性仍視為 null。 */
export function CoralReefPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: CORAL_REEF_COLOR, flexShrink: 0 }} />
      <span style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>珊瑚礁歷史分布 Historical Coral Reefs</span>
    </div>
    <Row label="礁名" value={text(props.reef_name)} />
    <Row label="Feature ID" value={text(props.feature_id)} />
    <Row label="資料集" value={text(props.source_dataset)} />
    <Row label="版本" value={text(props.source_version)} />
    <Row label="觀測年" value={text(props.source_year)} />
    <Row label="整筆來源面積" value={area(props.area_km2)} />
    <Row label="幾何狀態" value={text(props.geometry_status)} />
    <Row label="幾何定義" value={text(props.source_loc_def)} />
    <Row label="建立時間" value={text(props.built_at)} />
    <div style={{ marginTop: 7, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.45 }}>
      歷史基線，非現況健康、活珊瑚覆蓋率或白化；area_km2 是全球完整來源 feature 面積，非臺灣子集面積且不可加總；本視窗相交不等於行政邊界內的礁體面積。
    </div>
    <details style={{ marginTop: 7, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      <summary style={{ cursor: "pointer" }}>詳細來源欄位</summary>
      <Row label="原始編纂" value={text(props.origin_org)} />
      <Row label="實際分發" value={text(props.distribution_org)} />
      <Row label="授權" value={text(props.license)} />
      <Row label="Metadata ID" value={text(props.source_metadata_id)} />
      <Row label="開始日期" value={text(props.source_start_date)} />
      <Row label="結束日期" value={text(props.source_end_date)} />
      <Row label="日期類型" value={text(props.source_date_type)} />
      <Row label="資料類型" value={text(props.source_data_type)} />
      <Row label="來源驗證" value={text(props.source_verification)} />
      <Row label="來源圖層" value={text(props.source_layer_name)} />
    </details>
    <Row label="出典" value={CORAL_REEF_ATTRIBUTION} />
  </>;
}
