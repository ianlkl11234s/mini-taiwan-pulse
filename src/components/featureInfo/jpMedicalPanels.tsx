import { useEffect, useState } from "react";
import { loadJpMedicalHours } from "../../data/jpMedicalLoader";
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

/** Explicit missing values are not a closed day or zero opening hours. */
function Hours({ recordKind, sourceId, bucket }: { recordKind: string; sourceId: string; bucket: string }) {
  const theme = useFeatureTheme();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ loading: boolean; rows: Record<string, unknown>[]; error?: string }>({ loading: true, rows: [] });
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, rows: [] });
    loadJpMedicalHours(recordKind, sourceId, bucket)
      .then(rows => { if (!cancelled) setState({ loading: false, rows }); })
      .catch(cause => { if (!cancelled) setState({ loading: false, rows: [], error: cause instanceof Error ? cause.message : String(cause) }); });
    return () => { cancelled = true; };
  }, [recordKind, sourceId, bucket, retry]);
  if (state.loading) return <Row label="診療時段" value="載入中…" />;
  if (state.error) return <div role="alert"><Row label="診療時段" value={`載入失敗：${state.error}`} /><button onClick={() => setRetry(n => n + 1)}>重試時段</button></div>;
  if (!state.rows.length) return <Row label="診療時段" value="來源未提供符合此設施的時段" />;
  const departments = new Map<string, Record<string, unknown>[]>();
  for (const row of state.rows) {
    const key = `${text(row["診療科目名"])} · ${text(row["診療科目コード"])}`;
    departments.set(key, [...(departments.get(key) ?? []), row]);
  }
  return <div style={{ marginTop: 10, fontSize: FONT_SIZE.sm, lineHeight: 1.6, color: theme.textStrong }}>
    <strong>科別與公告時段 · {state.rows.length} 筆來源列</strong>
    <div>公告時段不代表目前可接診。未提供不等於休診。</div>
    {[...departments].map(([department, rows]) => <details key={department} style={{ marginTop: 6 }}>
      <summary style={{ cursor: "pointer", padding: "5px 0" }}>{department}（{rows.length} 筆）</summary>
      {rows.map((row, index) => <div key={index} style={{ padding: "5px 8px", marginBottom: 6, borderLeft: "2px solid #64748b" }}>
        <strong>時段 {text(row["診療時間帯"])}</strong>
        {["月", "火", "水", "木", "金", "土", "日", "祝"].map((day, i) => <div key={day}>
          {["週一", "週二", "週三", "週四", "週五", "週六", "週日", "假日"][i]}：
          {text(row[`${day}_診療開始時間`])} – {text(row[`${day}_診療終了時間`])}
          <div style={{ opacity: .75 }}>受付 {text(row[`${day}_外来受付開始時間`])} – {text(row[`${day}_外来受付終了時間`])}</div>
        </div>)}
      </div>)}
    </details>)}
  </div>;
}

export function JpMedicalFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const category = jpMedicalCategory(props.record_kind);
  const kind = typeof props.record_kind === "string" ? props.record_kind : "";
  const sourceId = typeof props.source_id === "string" ? props.source_id : "";
  const bucket = typeof props.detail_bucket === "string" ? props.detail_bucket : "";
  const hasHours = /^(hospital|clinic|dental)$/.test(kind) && sourceId && bucket;
  const website = typeof props.website === "string" && /^https?:\/\//.test(props.website) ? props.website : null;
  return <>
    <Title color={category?.color ?? "#94a3b8"}>{text(props.name)}</Title>
    <Row label="類型" value={category?.label ?? text(props.record_kind)} color={category?.color} />
    <Row label="地址" value={text(props.address)} />
    <Row label="快照日期" value={date(props.snapshot_date)} />
    <Row label="來源" value="厚生労働省 Navii" />
    <Row label="來源 ID" value={text(props.source_id)} />
    {website ? <div style={{ fontSize: FONT_SIZE.sm, overflowWrap: "anywhere", color: theme.textStrong }}>網站：<a href={website} target="_blank" rel="noreferrer" style={{ color: theme.link }}>{website}</a></div> : <Row label="網站" value="未提供" />}
    {hasHours ? <Hours recordKind={kind} sourceId={sourceId} bucket={bucket} /> : <Row label="診療時段" value="此類別來源未提供時段詳情" />}
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
    <Row label="機構 ID" value={text(props.establishment_id)} />
    <Row label="來源 ID" value={text(props.source_id)} />
    <Row label="來源" value="厚生労働省 H17" />
    <Row label="來源快照" value={date(props.source_snapshot_day)} />
    <Row label="資料粒度" value="服務登記；同一機構可有多筆服務" />
    {coLocated.length > 1 && <details style={{ marginTop: 10, fontSize: FONT_SIZE.sm, color: theme.textStrong }}>
      <summary>同位置、目前篩選下 {coLocated.length} 筆服務登記</summary>
      {coLocated.map((row, index) => <div key={index} style={{ margin: "8px 0", overflowWrap: "anywhere" }}>
        <strong>{text(row.name)}</strong>
        <Row label="服務" value={text(row.service_type)} />
        <Row label="機構 ID" value={text(row.establishment_id)} />
        <Row label="快照" value={date(row.source_snapshot_day)} />
      </div>)}
    </details>}
    <Row label="幾何狀態" value={text(props.geometry_status)} />
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
