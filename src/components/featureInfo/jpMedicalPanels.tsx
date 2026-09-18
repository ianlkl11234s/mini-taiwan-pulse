import { jpMedicalCategory, JP_MEDICAL_CARE_GROUPS } from "../../data/jpMedicalTypes";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { Row } from "./shared";

const text = (value: unknown) => value == null || value === "" || value === "null" ? "未提供" : String(value);
const date = (value: unknown) => text(value).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");

function Title({ color, children }: { color: string; children: string }) {
  const theme = useFeatureTheme();
  return <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
    <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color }} />
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: theme.textStrong }}>{children}</div>
  </div>;
}

export function JpMedicalFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const category = jpMedicalCategory(props.record_kind);
  return <>
    <Title color={category?.color ?? "#94a3b8"}>{text(props.name)}</Title>
    <Row label="類型" value={category?.label ?? text(props.record_kind)} color={category?.color} />
    <Row label="地址" value={text(props.address)} />
    <Row label="快照日期" value={date(props.snapshot_date)} />
    <Row label="來源" value="厚生労働省 Navii" />
    <Row label="來源 ID" value={text(props.source_id)} />
  </>;
}

export function JpMedicalCarePanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const group = JP_MEDICAL_CARE_GROUPS.find(item => item.serviceTypes.some(value => value === props.service_type));
  const coLocated = Array.isArray(props.coLocatedServices) ? props.coLocatedServices.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : [];
  return <>
    <Title color={group?.color ?? "#94a3b8"}>{text(props.name)}</Title>
    <Row label="上位分類" value={group?.label ?? "未分類"} color={group?.color} />
    <Row label="原始服務類型" value={text(props.service_type)} />
    <Row label="地址" value={text(props.address)} />
    <Row label="來源" value="厚生労働省 H17" />
    <Row label="來源快照" value={date(props.source_snapshot_day)} />
    {coLocated.length > 1 && <details style={{ marginTop: 10, fontSize: FONT_SIZE.sm, color: theme.textStrong }}>
      <summary>同位置、目前篩選下 {coLocated.length} 筆服務登記</summary>
      {coLocated.map((row, index) => <div key={index} style={{ margin: "8px 0", overflowWrap: "anywhere" }}>
        <strong>{text(row.name)}</strong>
        <Row label="服務" value={text(row.service_type)} />
        <Row label="快照" value={date(row.source_snapshot_day)} />
      </div>)}
    </details>}
  </>;
}

export function JpMedicalAreasPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  return <>
    <Title color="#f59e0b">醫療圈 · 2020 歷史版</Title>
    <Row label="資料狀態" value="STALE：2020 歷史版" color="#f59e0b" />
    <Row label="來源" value="国土数値情報 医療圏データ（2020）" />
    <Row label="用途" value="行政規劃邊界；不是設施服務範圍或即時就醫可達圈" />
    <Row label="幾何粒度" value="來源 polygon part；不可依此加總人口、面積或圈數" />
    <details style={{ marginTop: 8, color: theme.textStrong }}><summary>來源欄位</summary>
      {Object.entries(props).filter(([key]) => /^A38[abc]_/.test(key)).map(([key, value]) => <Row key={key} label={key} value={text(value)} />)}
      <Row label="Feature ID" value={text(props.feature_id)} />
    </details>
  </>;
}
